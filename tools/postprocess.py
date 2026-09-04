#!/usr/bin/env python3
"""Постобработка сгенерированных картинок.

character: хромакей + общий кроп нескольких поз одного персонажа + якорь.
plain:     cover-кроп до размера + WebP.
"""
import argparse, json, os
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


def chroma_key(img, key_rgb, near=45.0, far=115.0):
    """Возвращает RGBA: маска по расстоянию в CbCr до ключа, мягкая кромка, despill.

    Расстояние в CbCr от чистой мадженты до нейтрального серого ≈ 136; near/far ≈ 1/3 и 5/6
    от него, чтобы сглаженная кромка «50% фон + 50% субъект» (≈68) получила alpha ≈ 0.3, а не 0.95.
    """
    arr = np.asarray(img.convert('RGB')).astype(np.float32)
    _, cb, cr = rgb_to_ycbcr(arr)
    kcb, kcr = rgb_to_ycbcr(np.array(key_rgb, dtype=np.float32).reshape(1, 1, 3))[1:]
    dist = np.sqrt((cb - kcb) ** 2 + (cr - kcr) ** 2)
    alpha = np.clip((dist - near) / (far - near), 0.0, 1.0)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    kr, kg, kb = key_rgb
    # despill только там, где цвет действительно «маджентовый» (оба канала ключа выше третьего);
    # красный галстук (200,40,40) или твид (150,110,80) не трогаем: у них min(r,b) <= g → spill = 0
    if kr > 128 and kb > 128 and kg < 128:
        spill = np.clip((np.minimum(r, b) - g) / 60.0, 0.0, 1.0)
        lim = g + (np.maximum(r, b) - g) * 0.35
        r = r * (1 - spill) + np.minimum(r, lim) * spill
        b = b * (1 - spill) + np.minimum(b, lim) * spill
    elif kg > 128 and kr < 128:  # зелёный ключ
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


def do_character(args):
    w, h = map(int, args.size.lower().split('x'))
    key = hex_rgb(args.chroma)
    items = []
    for spec in args.items:
        aid, path = spec.split('=', 1)
        rgba = chroma_key(Image.open(path), key)
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
    c.add_argument('--quality', type=int, default=80); c.add_argument('items', nargs='+')
    c.set_defaults(fn=do_character)
    q = sub.add_parser('plain')
    q.add_argument('--out', required=True); q.add_argument('--size', required=True)
    q.add_argument('--quality', type=int, default=72); q.add_argument('src')
    q.set_defaults(fn=do_plain)
    args = p.parse_args(); args.fn(args)


if __name__ == '__main__':
    main()
