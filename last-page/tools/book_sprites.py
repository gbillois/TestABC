"""Loose closed books lying flat (the film's book painter), 12 per lighting -> sheet."""
import sys, math, json
WORK, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, WORK)
import numpy as np
from PIL import Image
from lp import books as bk
from lp.ink import Cel
LIGHTS = {'moon': ('#9aa4d4', '#1c1a30'), 'lantern': ('#e8b886', '#2b2233'), 'gold': ('#ffe6bc', '#4a3a52')}
CW, CH, N = 300, 110, 12
meta = {'w': CW, 'h': CH, 'cols': 4, 'n': N, 'tops': []}
for name, (fn, fl) in LIGHTS.items():
    r = np.random.default_rng(3); L = bk.Light(fn, floor=fl)
    sheet = np.zeros((CH * 3, CW * 4, 4), np.uint8); tops = []
    for i in range(N):
        it = bk.make_item(r, w=.05, h=.26)
        ln = float(r.uniform(200, 260)); wd = float(r.uniform(44, 64)); th = float(r.uniform(16, 26))
        c = Cel(CW, CH, 0, 0)
        bk.book_free(c, CW / 2 - 16, CH / 2 - 8, wd, ln, math.pi / 2 + float(r.normal(0, .015)), it, L, seed=i, lw=2.2, thick=th)
        a = c.rgba(); al = a[..., 3:4]
        rgb = np.where(al > 1e-4, a[..., :3] / np.maximum(al, 1e-4), 0)
        img = (np.clip(np.concatenate([rgb, al], -1), 0, 1) * 255 + .5).astype(np.uint8)
        ys, xs = np.nonzero(img[..., 3] > 128); tops.append([int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())])
        sheet[i // 4 * CH:(i // 4 + 1) * CH, i % 4 * CW:(i % 4 + 1) * CW] = img
    Image.fromarray(sheet).save(f'{OUT}/books_{name}.png', optimize=True)
    meta['tops'] = tops
json.dump(meta, open(f'{OUT}/books.json', 'w')); print(meta['tops'])
