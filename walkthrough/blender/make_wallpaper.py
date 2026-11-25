"""A wallpaper print for one wall, made in Blender.

Run (Blender in the background, no window):
    blender --background --factory-startup --python make_wallpaper.py -- <image> <out .js> <name> <wall width / height> [rotate|repeat]

rotate (for a landscape design on a tall wall): the design is turned a quarter turn and
trimmed equally on both sides to the wall's proportions, so one print covers the wall.
repeat: the design keeps its orientation, runs across the full width of the wall and repeats
down its height the way rolls of wallpaper are hung, every other repeat mirrored top to
bottom so each join meets its own reflection. Either way nothing is stretched. The print is written as a
small script (window.WALLPAPERS[name] = { src, w, h }) that the walkthrough loads and that
build.py puts inside the single HTML file.
"""
import base64
import os
import sys
import tempfile

import bpy
import numpy as np

ARGS = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, NAME, ASPECT = ARGS[0], ARGS[1], ARGS[2], float(ARGS[3])
MODE = ARGS[4] if len(ARGS) > 4 else 'repeat'
MAXPX = int(ARGS[5]) if len(ARGS) > 5 else 0  # optional: largest side in pixels (a small repeating texture needs less)

img = bpy.data.images.load(SRC)
w0, h0 = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(h0, w0, 4)[::-1]  # top row first
k = 1
if MODE == 'rotate':
    px = np.rot90(px, k=-1)                                              # a quarter turn clockwise
    h, w = px.shape[0], px.shape[1]
    if w / h > ASPECT:                                                   # trim the sides equally
        cw = int(round(h * ASPECT)); x0 = (w - cw) // 2; px = px[:, x0:x0 + cw]
    else:                                                                # or top and bottom
        ch = int(round(w / ASPECT)); y0 = (h - ch) // 2; px = px[y0:y0 + ch]
    wall = px
else:
    h, w = px.shape[0], px.shape[1]
    H = int(round(w / ASPECT))                                           # the wall's height in pixels
    tiles, total, k = [], 0, 0
    while total < H:
        tiles.append(px if k % 2 == 0 else px[::-1])                      # mirror every other repeat
        total += h
        k += 1
    wall = np.concatenate(tiles, axis=0)[:H]
h, w = wall.shape[0], wall.shape[1]
H = h
wall = wall[::-1].copy()                                                 # back to Blender's bottom-up rows
wall[:, :, 3] = 1.0

out = bpy.data.images.new('wallpaper_' + NAME, w, H, alpha=False)
out.pixels.foreach_set(wall.ravel())
if MAXPX and max(w, H) > MAXPX:
    k2 = MAXPX / max(w, H)
    w, H = max(1, int(round(w * k2))), max(1, int(round(H * k2)))
    out.scale(w, H)
tmp = os.path.join(tempfile.gettempdir(), 'wallpaper_%s.jpg' % NAME)
out.filepath_raw = tmp
out.file_format = 'JPEG'
try:
    out.save(filepath=tmp, quality=86)
except TypeError:  # older Blender: no quality argument
    out.save()
data = base64.b64encode(open(tmp, 'rb').read()).decode()
os.remove(tmp)

entry = 'window.WALLPAPERS[%r] = { src: "data:image/jpeg;base64,%s", w: %d, h: %d };' % (NAME, data, w, H)
keep = []  # the other prints already in the file (a wallpaper, a carpet...) stay; this one is replaced
if os.path.exists(OUT):
    for ln in open(OUT, encoding='utf-8').read().splitlines():
        if ln.startswith('window.WALLPAPERS[') and not ln.startswith('window.WALLPAPERS[%r]' % NAME):
            keep.append(ln)
js = ('/* Prints made in Blender by blender/make_wallpaper.py (wallpapers, carpets). Do not edit by hand. */\n'
      'window.WALLPAPERS = window.WALLPAPERS || {};\n' + '\n'.join(keep + [entry]) + '\n')
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
print('wallpaper %s (%s): %d x %d px from %d x %d, %d print(s), %d KB' % (NAME, MODE, w, H, w0, h0, k, len(js) // 1024))
