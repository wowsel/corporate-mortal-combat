import json, os, subprocess, sys, tempfile
from PIL import Image

def make_sprite(path, box, color):
    img = Image.new('RGB', (400, 600), (255, 0, 255))
    px = img.load()
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            px[x, y] = color
    img.save(path)

def main():
    with tempfile.TemporaryDirectory() as d:
        a = os.path.join(d, 'a.png'); b = os.path.join(d, 'b.png')
        make_sprite(a, (150, 200, 250, 560), (200, 40, 40))   # фигура пониже, «красный галстук»
        make_sprite(b, (120, 100, 280, 560), (40, 60, 200))   # фигура шире и выше
        out = os.path.join(d, 'out')
        res = subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', out, '--size', '700x900',
                              '--chroma', 'FF00FF', f'x_idle={a}', f'x_attack={b}'], capture_output=True, text=True, check=True)
        meta = json.loads(res.stdout)
        assert 'anchor' in meta and len(meta['anchor']) == 2, meta
        ia = Image.open(os.path.join(out, 'x_idle.webp')).convert('RGBA')
        ib = Image.open(os.path.join(out, 'x_attack.webp')).convert('RGBA')
        assert ia.size == (700, 900) and ib.size == (700, 900)
        # фон прозрачный, фигура непрозрачная
        assert ia.getpixel((5, 5))[3] == 0
        assert ia.getpixel((350, 850))[3] > 200, ia.getpixel((350, 850))
        # обе позы стоят на одной линии: нижняя непрозрачная строка совпадает
        def bottom(img):
            alpha = img.split()[3]
            bbox = alpha.getbbox(); return bbox[3]
        assert abs(bottom(ia) - bottom(ib)) <= 2, (bottom(ia), bottom(ib))
        # despill не должен гасить красный: галстук остаётся красным
        r, g, bch, _ = ia.getpixel((350, 850))
        assert r > 170 and g < 90 and bch < 90, (r, g, bch)
        # маджентовый налёт (180,90,170): дистанция до ключа больше near, частично прозрачна, но розовость подавлена
        c = os.path.join(d, 'c.png'); make_sprite(c, (150, 200, 250, 560), (180, 90, 170))
        outc = os.path.join(d, 'outc')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', outc, '--size', '700x900',
                        '--chroma', 'FF00FF', f'y_idle={c}'], capture_output=True, text=True, check=True)
        ic = Image.open(os.path.join(outc, 'y_idle.webp')).convert('RGBA')
        px = ic.getpixel((350, 850))
        if px[3] > 0:
            assert not (px[0] > 150 and px[2] > 150 and px[1] < 100), px  # розовость подавлена
        # plain
        big = os.path.join(d, 'bg.png'); Image.new('RGB', (2048, 1536), (10, 20, 30)).save(big)
        outbg = os.path.join(d, 'bg.webp')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'plain', '--out', outbg, '--size', '1600x900', '--quality', '72', big], check=True)
        assert Image.open(outbg).size == (1600, 900)
        print('postprocess ok')

if __name__ == '__main__':
    main()
