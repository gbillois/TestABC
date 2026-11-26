"""Render the film's side-view fox into sprite frames (premultiplied -> straight RGBA PNG)."""
import sys, os, math, json
WORK, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, WORK)
import numpy as np, cv2
from PIL import Image
from lp import foxside as fs
from lp.ink import Cel
from lp.foxact import pseed, posekey

H = 150                      # standing height px
CW, CH = 340, 230            # frame size
GX, GY = 175, 205            # ground origin in frame

def poses():
    out = {}
    out['run'] = [fs.trot(i / 12.) for i in range(12)]
    st = fs.pose(earb=.08)
    out['idle'] = [st, fs.pose(st, head=(30.5, -59.6)), fs.pose(st, blink=1.), fs.pose(st, ears=.35)]
    out['crouch'] = [fs.pose(sh=(17, -31), hip=(-19, -30), head=(36, -50), hang=.5, earb=.15,
                             tail=((-.30, 13), (.2, 14), (.15, 15), (-.1, 14), (-.2, 10)))]
    rise = fs.pose(hip=(-20, -44), sh=(18, -50), head=(34, -71), hang=-.30, fn=(30, -22), ff=(36, -20), hn=(-40, -6), hf=(-34, -4),
                   fnp=.8, ffp=.7, hnp=-.3, hfp=-.25, earb=-.05, tail=((.30, 13), (.30, 14), (.15, 15), (-.1, 14), (-.2, 10)))
    fall = fs.pose(hip=(-21, -46), sh=(19, -44), head=(36, -63), hang=.15, fn=(36, -2), ff=(30, -4), hn=(-24, -14), hf=(-18, -12),
                   fnp=-.2, ffp=-.15, hnp=.5, hfp=.45, earb=.25, ears=.2, tail=((-.35, 13), (-.1, 14), (.2, 15), (.1, 14), (-.1, 10)))
    out['jump'] = [rise, fs.lerp(rise, fall, .5), fall]
    out['land'] = [fs.pose(sh=(17, -33), hip=(-19, -33), head=(35, -53), hang=.35, earb=.2,
                           tail=((-.20, 13), (.15, 14), (.20, 15), (0, 14), (-.1, 10)))]
    out['look'] = [fs.pose(head=(28, -61.8), hang=-.60, earb=.0, ears=.35, tail=((.28, 13), (.30, 14), (.05, 15), (-.35, 14), (-.50, 10)))]
    return out

def render(P, pal):
    c = Cel(CW, CH, 0, 0)
    fs.side(c, GX, GY, H, P, pal, max(1.5, H * .0135), pseed(*posekey(P)), key=1, rim=True)
    a = c.rgba(); al = a[..., 3:4]
    rgb = np.where(al > 1e-4, a[..., :3] / np.maximum(al, 1e-4), 0)
    return (np.clip(np.concatenate([rgb, al], -1), 0, 1) * 255 + .5).astype(np.uint8)

meta = {'w': CW, 'h': CH, 'gx': GX, 'gy': GY, 'hpx': H, 'anims': {}}
P = poses()
for pal in sys.argv[3:]:
    frames, idx = [], 0
    for name, L in P.items():
        meta['anims'][name] = list(range(idx, idx + len(L))); idx += len(L)
        frames += [render(p, pal) for p in L]
    cols = 8; rows = (len(frames) + cols - 1) // cols
    sheet = np.zeros((rows * CH, cols * CW, 4), np.uint8)
    for i, f in enumerate(frames): sheet[i // cols * CH:(i // cols + 1) * CH, i % cols * CW:(i % cols + 1) * CW] = f
    Image.fromarray(sheet).save(f'{OUT}/fox_{pal}.png', optimize=True)
    print(pal, len(frames), sheet.shape)
meta['cols'] = 8
json.dump(meta, open(f'{OUT}/fox.json', 'w'))
