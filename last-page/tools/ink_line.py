"""The film's brushed tagline (and its seal) as ink on transparent paper.
ink_line.png: RGBA final ink.  ink_time.png: per-pixel write time (0..255) so the game can let it write itself."""
import sys
WORK, OUT = sys.argv[1], sys.argv[2]
TEXT = sys.argv[3] if len(sys.argv) > 3 else "Every story begins with a blank page."
NAME = sys.argv[5] if len(sys.argv) > 5 else "ink_line"
SC = float(sys.argv[4]) if len(sys.argv) > 4 else .62
sys.path.insert(0, WORK)
import numpy as np, cv2
from PIL import Image
from lp import ink_letters as IL
from lp.brush import Sheet, ink_at

sc = SC; lw = IL.line_width(TEXT)
Wd, Hd = int(lw * sc + 80), int(300 * sc + 80)
sh = Sheet(Wd, Hd, K=5, margin=12)
for s, a, b in IL.line_strokes(TEXT, sc, 40, 40 + 205 * sc, seed=21): sh.add(s, a * 100, b * 100)
sh.bake()
maps = sh.maps()
cov, wet = ink_at(maps, 1e3)
# write time: earliest frame each pixel gets ink
T = np.full(cov.shape, 1e4, np.float32)
for D, F in maps: T = np.where(D > .02, np.minimum(T, F), T)
T = np.where(T > 1e3, 100, T)
ink = np.array([46, 30, 40], np.float32) / 255
rgba = np.dstack([np.broadcast_to(ink, cov.shape + (3,)), np.clip(cov * 1.05, 0, 1)])
Image.fromarray((rgba * 255 + .5).astype(np.uint8)).save(f'{OUT}/{NAME}.png', optimize=True)
Image.fromarray(np.clip(T / 100 * 255, 0, 255).astype(np.uint8)).save(f'{OUT}/{NAME}_time.png', optimize=True)
if NAME != 'ink_line': print(Wd, Hd); sys.exit()
m = IL.seal_mask(150, 270)
m = m / max(m.max(), 1e-6)
seal = np.dstack([np.full(m.shape, .74), np.full(m.shape, .18), np.full(m.shape, .16), m])
Image.fromarray((np.clip(seal, 0, 1) * 255).astype(np.uint8)).save(f'{OUT}/seal.png', optimize=True)
print(Wd, Hd, m.shape)
