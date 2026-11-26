"""python plates.py WORK OUT shot frame[,frame..] [nofox]: finished film frames as JPEG."""
import sys, os, importlib, time
WORK, OUT, shot, frames = sys.argv[1], sys.argv[2], sys.argv[3], [int(v) for v in sys.argv[4].split(',')]
nofox = len(sys.argv) > 5 and sys.argv[5] == 'nofox'
sys.path.insert(0, WORK); os.chdir(WORK)
import numpy as np, cv2
cv2.setNumThreads(1)
from lp import comp, foxact
if nofox: foxact.draw = lambda img, key, f, M: img
S = importlib.import_module('shots.' + shot).Shot(); t = time.time(); S.setup(); print(shot, 'setup %.0fs' % (time.time() - t), flush=True)
for f in frames:
    im8 = comp.to8(np.clip(comp.finish(S.frame(f), f, **getattr(S, 'finish', {})), 0, 1), f)
    cv2.imwrite(f'{OUT}/{shot}_{f:04d}{"_nf" if nofox else ""}.jpg', cv2.cvtColor(im8, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(shot, f, 'done', flush=True)
