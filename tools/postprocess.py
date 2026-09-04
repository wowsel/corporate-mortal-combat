#!/usr/bin/env python3
"""Постобработка сгенерированных картинок.

character: хромакей + общий кроп нескольких поз одного персонажа + якорь.
plain:     cover-кроп до размера + WebP.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageFilter


def hex_rgb(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_ycbcr(arr):
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return y, cb, cr


def border_frame_mask(shape, frac=0.03):
    """Булева маска внешней рамки шириной frac от стороны (минимум 1 px)."""
    h, w = shape[:2]
    bw = max(1, int(round(frac * w))); bh = max(1, int(round(frac * h)))
    m = np.zeros((h, w), dtype=bool)
    m[:bh, :] = True; m[-bh:, :] = True; m[:, :bw] = True; m[:, -bw:] = True
    return m


def hue_class(key_rgb):
    """'magenta' | 'green' | None — по относительному соотношению каналов ключа."""
    r, g, b = (float(v) for v in key_rgb)
    if min(r, b) > g + 30:
        return 'magenta'
    if g > max(r, b) + 30:
        return 'green'
    return None


def estimate_key(arr, hint_rgb, frac=0.03):
    """Оценивает реальный цвет фона как медиану рамки и валидирует его подсказкой.

    Модель почти никогда не рисует ровный #FF00FF: получается приглушённая маджента
    с виньеткой. Поэтому ключ берём из самой картинки, а --chroma используем только
    как sanity-подсказку: если оценка ушла дальше 90 единиц CbCr от подсказки,
    значит рамка кадра не хромакейная — прерываем работу (SystemExit), чтобы оператор
    посмотрел на сырьё, а не молча получил испорченный спрайт.
    """
    m = border_frame_mask(arr.shape, frac)
    est = np.median(arr[m], axis=0)
    hint = np.array(hint_rgb, dtype=np.float32)
    ecb, ecr = rgb_to_ycbcr(est.reshape(1, 1, 3))[1:]
    hcb, hcr = rgb_to_ycbcr(hint.reshape(1, 1, 3))[1:]
    d = float(np.sqrt((ecb - hcb) ** 2 + (ecr - hcr) ** 2).reshape(-1)[0])
    if d > 90.0:
        raise SystemExit(
            f'error: estimated background {tuple(int(v) for v in est)} is {d:.0f} CbCr units '
            f'from the hinted chroma {tuple(int(v) for v in hint)}: the border of the frame is not '
            f'a chroma key. Look at the raw image (or pass the right --chroma).')
    return est.astype(np.float32), m


def chroma_key(img, key_rgb, near=None, far=None):
    """Возвращает RGBA: маска по расстоянию в CbCr до ключа, мягкая кромка, despill.

    Ключ оценивается по самой картинке (медиана рамки), пороги — адаптивные:
    near = p99(расстояний пикселей рамки до ключа) + 8, far = near + 45.
    near/far можно задать явно (CLI --near/--far) — тогда адаптив не используется.
    """
    arr = np.asarray(img.convert('RGB')).astype(np.float32)
    key, border = estimate_key(arr, key_rgb)
    _, cb, cr = rgb_to_ycbcr(arr)
    kcb, kcr = rgb_to_ycbcr(key.reshape(1, 1, 3))[1:]
    dist = np.sqrt((cb - kcb) ** 2 + (cr - kcr) ** 2)
    if near is None:
        near = float(np.percentile(dist[border], 99)) + 8.0
    if far is None:
        far = near + 45.0
    alpha = np.clip((dist - near) / (far - near), 0.0, 1.0)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    # despill только там, где ключ действительно «маджентовый» (оба канала ключа выше третьего);
    # красный галстук (200,40,40) или твид (150,110,80) не трогаем: у них min(r,b) <= g → spill = 0
    cls = hue_class(key)
    if cls == 'magenta':
        spill = np.clip((np.minimum(r, b) - g) / 60.0, 0.0, 1.0)
        lim = g + (np.maximum(r, b) - g) * 0.35
        r = r * (1 - spill) + np.minimum(r, lim) * spill
        b = b * (1 - spill) + np.minimum(b, lim) * spill
    elif cls == 'green':
        spill = np.clip((g - np.maximum(r, b)) / 60.0, 0.0, 1.0)
        lim = (r + b) / 2 + (g - (r + b) / 2) * 0.35
        g = g * (1 - spill) + np.minimum(g, lim) * spill
    # лёгкая эрозия + размытие альфы: убирает однопиксельную грязную кромку
    alpha = np.clip((alpha - 0.06) / 0.94, 0.0, 1.0)
    out = np.stack([r, g, b, alpha * 255], axis=-1)
    rgba = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    a = rgba.split()[3].filter(ImageFilter.GaussianBlur(0.8))
    rgba.putalpha(a)
    return rgba


def alpha_bbox(rgba, thresh=24):
    a = np.asarray(rgba.split()[3])
    ys, xs = np.where(a > thresh)
    if len(xs) == 0:
        return (0, 0, rgba.width, rgba.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def assert_keyed(rgba, aid, thresh=24, frac=0.03):
    """Проверяет, что кей не выродился, и возвращает (доля непрозрачного, доля рамки).

    Без этой проверки полностью провалившийся кей (весь кадр непрозрачный или, наоборот,
    выкошенная фигура) молча уезжает дальше: alpha_bbox отдаёт весь кадр, общий кроп
    ломается, а на выходе получается «правильный» по размеру, но мусорный спрайт.
    """
    a = np.asarray(rgba.split()[3])
    solid = a > thresh
    opaque = float(solid.mean())
    border = border_frame_mask(a.shape, frac)
    border_opaque = float(solid[border].mean())
    if not 0.02 <= opaque <= 0.70:
        raise SystemExit(
            f'error: {aid}: degenerate chroma key — {opaque * 100:.1f}% of the frame is opaque '
            f'(expected 2%-70%). Look at the raw image, then fix --chroma/--near/--far.')
    if border_opaque > 0.05:
        raise SystemExit(
            f'error: {aid}: subject touches the frame border — {border_opaque * 100:.1f}% of the '
            f'border is opaque (expected <5%). The shared crop would cut the figure off.')
    return opaque, border_opaque


def do_character(args):
    w, h = map(int, args.size.lower().split('x'))
    key = hex_rgb(args.chroma)
    items = []
    for spec in args.items:
        aid, path = spec.split('=', 1)
        rgba = chroma_key(Image.open(path), key, args.near, args.far)
        opaque, border_opaque = assert_keyed(rgba, aid)
        sys.stderr.write(f'{aid}: opaque {opaque * 100:.1f}% of frame, {border_opaque * 100:.2f}% of border\n')
        if args.flip:
            rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)
        items.append((aid, rgba, alpha_bbox(rgba)))
    # общий bbox по всем позам (все сырые картинки одного размера — иначе приводим к первому)
    base_size = items[0][1].size
    norm = []
    for aid, rgba, bbox in items:
        if rgba.size != base_size:
            rgba = rgba.convert('RGBa').resize(base_size, Image.LANCZOS).convert('RGBA'); bbox = alpha_bbox(rgba)
        norm.append((aid, rgba, bbox))
    x0 = min(b[0] for _, _, b in norm); y0 = min(b[1] for _, _, b in norm)
    x1 = max(b[2] for _, _, b in norm); y1 = max(b[3] for _, _, b in norm)
    pad = int(0.04 * max(x1 - x0, y1 - y0))
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad); x1 = min(base_size[0], x1 + pad); y1 = min(base_size[1], y1 + pad)
    cw, ch = x1 - x0, y1 - y0
    scale = min(w / cw, h / ch)
    nw, nh = int(round(cw * scale)), int(round(ch * scale))
    ox = (w - nw) // 2
    oy = h - nh  # прижимаем к низу: ноги у всех поз на одной линии
    os.makedirs(args.out_dir, exist_ok=True)
    files = {}
    for aid, rgba, _ in norm:
        # ресайз в премультиплицированном режиме (RGBa): иначе LANCZOS подмешает в кромку
        # тёмно-фиолетовый RGB прозрачных пикселей фона
        crop = rgba.crop((x0, y0, x1, y1)).convert('RGBa').resize((nw, nh), Image.LANCZOS).convert('RGBA')
        canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        # alpha_composite, а не paste с маской: paste умножает RGB на альфу и даёт чёрный ореол
        canvas.alpha_composite(crop, (ox, oy))
        out = os.path.join(args.out_dir, f'{aid}.webp')
        canvas.save(out, 'WEBP', quality=args.quality, method=6)
        files[aid] = out
    # якорь: центр по x, нижняя непрозрачная строка по всем позам (обычно h - небольшой отступ)
    bottoms = []
    for aid in files:
        img = Image.open(files[aid]).convert('RGBA')
        bottoms.append(alpha_bbox(img)[3])
    anchor = [w // 2, int(max(bottoms))]
    print(json.dumps({'anchor': anchor, 'files': files}))


def do_plain(args):
    w, h = map(int, args.size.lower().split('x'))
    img = Image.open(args.src).convert('RGB')
    scale = max(w / img.width, h / img.height)
    nw, nh = int(round(img.width * scale)), int(round(img.height * scale))
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - w) // 2; top = (nh - h) // 2
    img = img.crop((left, top, left + w, top + h))
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    img.save(args.out, 'WEBP', quality=args.quality, method=6)
    print(json.dumps({'file': args.out, 'size': [w, h]}))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('character')
    c.add_argument('--out-dir', required=True); c.add_argument('--size', default='700x900')
    c.add_argument('--chroma', default='FF00FF'); c.add_argument('--flip', type=int, default=0)
    c.add_argument('--near', type=float, default=None); c.add_argument('--far', type=float, default=None)
    c.add_argument('--quality', type=int, default=80); c.add_argument('items', nargs='+')
    c.set_defaults(fn=do_character)
    q = sub.add_parser('plain')
    q.add_argument('--out', required=True); q.add_argument('--size', required=True)
    q.add_argument('--quality', type=int, default=72); q.add_argument('src')
    q.set_defaults(fn=do_plain)
    args = p.parse_args()
    if args.cmd == 'character':
        if (args.near is None) != (args.far is None):
            c.error('--near and --far must be given together (or neither)')
        if args.near is not None and args.near < 0:
            c.error('--near must be >= 0')
        if args.far is not None and args.far < 0:
            c.error('--far must be >= 0')
        if args.near is not None and args.far is not None and args.far <= args.near:
            c.error('--far must be greater than --near')
    args.fn(args)


if __name__ == '__main__':
    main()
