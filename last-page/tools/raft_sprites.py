"""Flat sheets of paper seen from a low angle (the film's page painter): rideable rafts. rows = palettes, cols = variants."""
import sys, json
WORK, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, WORK)
import numpy as np
from PIL import Image
from lp import pages as PG
from lp.ink import Cel
CW, CH = 280, 110
PALS = ['cream', 'violet', 'gold', 'dawn']
VAR = [(-70, 0, 90, .25), (-72, 3, 91, .3), (-68, -3, 89, .2), (-73, 1, 90.5, .35)]
sheet = np.zeros((CH * len(PALS), CW * len(VAR), 4), np.uint8); boxes = []
for r, pal in enumerate(PALS):
    for k, (ax, ay, az, bend) in enumerate(VAR):
        c = Cel(CW, CH, 0, 0)
        PG.page(c, PG.rot3(ax, ay, az), (CW / 2, CH / 2), 205, pal=pal, seed=60 + k * 3 + r, bend=bend, rim=.8, beta=0.0, scurve=0.0)
        a = c.rgba(); al = a[..., 3:4]
        rgb = np.where(al > 1e-4, a[..., :3] / np.maximum(al, 1e-4), 0)
        img = (np.clip(np.concatenate([rgb, al], -1), 0, 1) * 255 + .5).astype(np.uint8)
        ys, xs = np.nonzero(img[..., 3] > 128); boxes.append([int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())])
        sheet[r * CH:(r + 1) * CH, k * CW:(k + 1) * CW] = img
Image.fromarray(sheet).save(f'{OUT}/rafts.png', optimize=True)
json.dump({'w': CW, 'h': CH, 'pals': PALS, 'boxes': boxes}, open(f'{OUT}/rafts.json', 'w')); print(boxes)
