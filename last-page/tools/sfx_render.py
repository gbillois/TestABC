"""Render one-shot SFX with the film's synth functions -> WAV."""
import sys, os
WORK, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(WORK, 'audio')); os.chdir(WORK)
import numpy as np, soundfile as sf
from core import SR
import sfx, inst

def mono(x):
    if isinstance(x, tuple): x = x[0]
    x = np.asarray(x, float)
    if x.ndim == 2: x = x.mean(0) if x.shape[0] == 2 else x.mean(1)
    return x

def save(name, x, gain=1.0, tail=.03):
    x = mono(x); x = x / (np.abs(x).max() + 1e-9) * .89 * gain
    n = len(x); f = np.ones(n); k = int(SR * tail); f[-k:] = np.linspace(1, 0, k)
    sf.write(f'{OUT}/{name}.wav', (x * f).astype(np.float32), SR, subtype='PCM_16'); print(name, '%.2fs' % (n / SR))

for i in range(4): save(f'step_wood{i}', sfx.paw(10 + i, .6, 'wood'), .5)
for i in range(3): save(f'step_paper{i}', sfx.paw(30 + i, .6, 'paper'), .5)
save('jump', sfx.flap(3, .35, 1.0, True), .55)
save('land', sfx.paw(50, 1.0, 'wood'), .8)
save('lantern', sfx.lantern_down(7), .8)
save('flame', sfx.flame(2.0, 8), .4)
save('page', sfx.rustle(.5, 9, 1.0, 'thin'), .6)
save('snap', sfx.snap(4, .5), .7)
save('flap', sfx.flap(12, .3), .6)
save('jolt', sfx.jolt(5, 1.0), .9)
save('slap', sfx.slap(6, .6), .7)
save('whoomph', sfx.whoomph(2, 1.0, 1.6), 1.0)
# felt piano notes (the film's motif instrument): a pentatonic set for pickups and the closing note
for m in (69, 72, 74, 76, 79, 81):
    save(f'piano{m}', inst.piano_note(m, .55, .35, 100 + m), .7, tail=.3)
save('piano_end', inst.piano_note(64, .6, 2.5, 7), .9, tail=1.0)
