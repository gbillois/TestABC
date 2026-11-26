"""Paper birds (flap cycle), loose pages and the lantern from the film's painters -> straight-alpha PNG sheets."""
import sys, os, json
WORK, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, WORK)
import numpy as np, cv2
from PIL import Image
from lp import pages as PG, props
from lp.ink import Cel

def straight(a):
    al = a[..., 3:4]; rgb = np.where(al > 1e-4, a[..., :3] / np.maximum(al, 1e-4), 0)
    return (np.clip(np.concatenate([rgb, al], -1), 0, 1) * 255 + .5).astype(np.uint8)

def sheet(frames, cols, name):
    h, w = frames[0].shape[:2]; rows = (len(frames) + cols - 1) // cols
    s = np.zeros((rows * h, cols * w, 4), np.uint8)
    for i, f in enumerate(frames): s[i // cols * h:(i // cols + 1) * h, i % cols * w:(i % cols + 1) * w] = f
    Image.fromarray(s).save(f'{OUT}/{name}.png', optimize=True); print(name, s.shape)

meta = {}
# paper birds: rows = (design, palette), cols = 7 flap phases. Flying right, seen slightly from below/side.
S = 150; span = 46
rows = [('crane', 'cream', 4), (PG.NAMES[1], 'cream', 11), (PG.NAMES[2], 'violet', 23), ('crane', 'gold', 31), (PG.NAMES[3], 'dawn', 7)]
fr = []
R = PG.basis(np.array([1.0, -.15, .25]), np.array([.05, -.25, .95]))
for des, pal, sd in rows:
    for ph in PG.CYCLE:
        c = Cel(S, S, 0, 0)
        PG.bird(c, des, ph, R, (S / 2, S / 2), span, pal=pal, seed=sd, drawing=ph, light=(-.45, -.78, -.42), rim=.9, persp=.18)
        fr.append(straight(c.rgba()))
sheet(fr, 7, 'birds'); meta['birds'] = dict(w=S, h=S, cols=7, rows=[f'{d}:{p}' for d, p, _ in rows])
# loose pages (collectibles): 8 different sheets
P = 120; fr = []
for k in range(8):
    c = Cel(P, P, 0, 0)
    PG.page(c, PG.rot3(15 * (k % 3) - 10, 20 - 8 * k % 30, -12 + 6 * k), (P / 2, P / 2), 80, pal='cream', seed=50 + k, drawing=0, bend=.7 + .1 * (k % 4), rim=.8)
    fr.append(straight(c.rgba()))
sheet(fr, 8, 'pages'); meta['pages'] = dict(w=P, h=P, cols=8, n=8)
# the blank last page: flat, no text
c = Cel(P, P, 0, 0); PG.page(c, PG.rot3(-55, 0, -8), (P / 2, P / 2), 90, pal='dawn', seed=99, bend=.25, text=False, rim=.6)
Image.fromarray(straight(c.rgba())).save(f'{OUT}/blank_page.png', optimize=True)
# lantern: unlit + lit flicker (4)
L = 110; fr = []
for k in range(5):
    c = Cel(L, L, 0, 0)
    props.lantern(c, L / 2, L - 6, .9, seed=k % 4, lw=1.6, lit=0. if k == 0 else 1., dim=k == 0, lean=[0, .1, -.1, .2, -.05][k])
    fr.append(straight(c.rgba()))
sheet(fr, 5, 'lantern'); meta['lantern'] = dict(w=L, h=L, cols=5)
json.dump(meta, open(f'{OUT}/props.json', 'w'))
