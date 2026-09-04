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
        assert px[3] > 0, px  # частично непрозрачна (≈160 по построению)
        assert not (px[0] > 150 and px[2] > 150 and px[1] < 100), px  # розовость подавлена
        # приглушённая маджента с виньеткой (как её реально рисует модель):
        # ключ и пороги оцениваются по картинке, фон обязан выкоситься полностью
        v = os.path.join(d, 'v.png')
        vim = Image.new('RGB', (400, 600))
        vpx = vim.load()
        for x in range(400):
            for y in range(600):
                t = (x / 399 + y / 599) / 2
                vpx[x, y] = (int(166 + t * 58), int(22 + t * 26), int(109 + t * 47))
        for x in range(150, 250):
            for y in range(200, 560):
                vpx[x, y] = (90, 70, 50)
        vim.save(v)
        outv = os.path.join(d, 'outv')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', outv, '--size', '700x900',
                        '--chroma', 'FF00FF', f'z_idle={v}'], capture_output=True, text=True, check=True)
        iv = Image.open(os.path.join(outv, 'z_idle.webp')).convert('RGBA')
        assert iv.getpixel((5, 5))[3] == 0, iv.getpixel((5, 5))
        assert iv.getpixel((350, 850))[3] > 200, iv.getpixel((350, 850))
        # явные --near/--far: адаптив не используется, результат всё равно валиден
        outn = os.path.join(d, 'outn')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', outn, '--size', '700x900',
                        '--chroma', 'FF00FF', '--near', '10', '--far', '20', f'n_idle={a}'],
                       capture_output=True, text=True, check=True)
        inn = Image.open(os.path.join(outn, 'n_idle.webp')).convert('RGBA')
        assert inn.size == (700, 900)
        assert inn.getpixel((5, 5))[3] == 0, inn.getpixel((5, 5))
        assert inn.getpixel((350, 850))[3] > 200, inn.getpixel((350, 850))
        # --far <= --near отвергается парсером (а не молча делит на ноль)
        bad = subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', os.path.join(d, 'outbad'),
                              '--size', '700x900', '--near', '30', '--far', '30', f'q_idle={a}'], capture_output=True, text=True)
        assert bad.returncode != 0, bad
        assert '--far must be greater than --near' in bad.stderr, bad.stderr
        # sanity-подсказка: фон далёк от мадженты → аварийный выход, а не «откат к подсказке»
        g = os.path.join(d, 'g.png')
        gim = Image.new('RGB', (400, 600), (60, 120, 180))
        gpx = gim.load()
        for x in range(150, 250):
            for y in range(200, 560):
                gpx[x, y] = (200, 40, 40)
        gim.save(g)
        far = subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', os.path.join(d, 'outg'),
                              '--size', '700x900', '--chroma', 'FF00FF', f'g_idle={g}'], capture_output=True, text=True)
        assert far.returncode != 0, far
        assert 'not a chroma key' in far.stderr, far.stderr
        # фигура упирается в край кадра: общий кроп срезал бы её → аварийный выход.
        # адаптивный near ограничен сверху (30): p99 рамки здесь — это уже цвет фигуры,
        # без ограничения порог уезжал и кадр выкашивался целиком (вырожденный кей вместо
        # понятной ошибки о рамке). Оба пути — адаптивный и с явными порогами — обязаны
        # выйти ненулём именно проверкой рамки.
        e = os.path.join(d, 'e.png'); make_sprite(e, (100, 200, 300, 600), (200, 40, 40))
        edge = subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', os.path.join(d, 'oute'),
                               '--size', '700x900', '--chroma', 'FF00FF', f'e_idle={e}'], capture_output=True, text=True)
        assert edge.returncode != 0, edge
        assert 'touches the frame border' in edge.stderr, edge.stderr
        edge2 = subprocess.run([sys.executable, 'tools/postprocess.py', 'character', '--out-dir', os.path.join(d, 'oute2'),
                                '--size', '700x900', '--chroma', 'FF00FF', '--near', '10', '--far', '20',
                                f'e_idle={e}'], capture_output=True, text=True)
        assert edge2.returncode != 0, edge2
        assert 'touches the frame border' in edge2.stderr, edge2.stderr
        # plain
        big = os.path.join(d, 'bg.png'); Image.new('RGB', (2048, 1536), (10, 20, 30)).save(big)
        outbg = os.path.join(d, 'bg.webp')
        subprocess.run([sys.executable, 'tools/postprocess.py', 'plain', '--out', outbg, '--size', '1600x900', '--quality', '72', big], check=True)
        assert Image.open(outbg).size == (1600, 900)
        print('postprocess ok')

if __name__ == '__main__':
    main()
