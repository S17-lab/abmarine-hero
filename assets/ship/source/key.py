import sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.int16)
H, W, _ = a.shape
spread = a.max(axis=2) - a.min(axis=2)
v = a.mean(axis=2)
bg = (spread <= 9) & (((np.abs(v - 254) <= 17)) | (np.abs(v - 203) <= 21))

def flood(mask, seeds):
    seen = np.zeros(mask.shape, bool); q = deque()
    for y, x in seeds:
        if mask[y, x] and not seen[y, x]:
            seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen

seeds = [(0, x) for x in range(W)] + [(H-1, x) for x in range(W)] + \
        [(y, 0) for y in range(H)] + [(y, W-1) for y in range(H)]
out_bg = flood(bg, seeds)
print('фон от рамки: %.1f%%' % (100 * out_bg.mean()))

# просветы, запертые геометрией судна (небо под тентом, вырезы палубы):
# это шахматка, до которой не дотянулся заливка от рамки
inner = bg & ~out_bg
lab2 = np.zeros((H, W), np.int32); c2 = 0; opened = 0
for y0 in range(H):
    for x0 in range(W):
        if inner[y0, x0] and lab2[y0, x0] == 0:
            c2 += 1; pts = [(y0, x0)]; lab2[y0, x0] = c2; q = deque([(y0, x0)])
            while q:
                y, x = q.popleft()
                for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                    if 0 <= ny < H and 0 <= nx < W and inner[ny, nx] and lab2[ny, nx] == 0:
                        lab2[ny, nx] = c2; q.append((ny, nx)); pts.append((ny, nx))
            if len(pts) < 150:
                continue
            m = lab2 == c2
            vals = v[m]
            white = (np.abs(vals - 254) <= 17).mean()
            grey  = (np.abs(vals - 203) <= 21).mean()
            if white > .2 and grey > .2:       # обе клетки на месте — это фон
                out_bg |= m; opened += len(pts)
print('открыто внутренних просветов: %d px' % opened)

# добить «островки» шахматки, отрезанные блочностью JPEG:
# компоненты переднего плана меньше 1500 px и светло-серые — это не судно
fg = ~out_bg
lab = np.zeros((H, W), np.int32); cur = 0; sizes = {}
for y0 in range(H):
    for x0 in range(W):
        if fg[y0, x0] and lab[y0, x0] == 0:
            cur += 1; n = 0; q = deque([(y0, x0)]); lab[y0, x0] = cur
            while q:
                y, x = q.popleft(); n += 1
                for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                    if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = cur; q.append((ny, nx))
            sizes[cur] = n
main = max(sizes, key=sizes.get)
drop = 0
for cid, n in sizes.items():
    if cid == main or n >= 1500:
        continue
    m = lab == cid
    if v[m].mean() > 175 and spread[m].mean() < 16:     # светло-серое — остаток фона
        fg[m] = False; drop += n
print('компонентов %d, главная %d px, убрано мусора %d px' % (len(sizes), sizes[main], drop))

alpha = np.where(fg, 255, 0).astype(np.uint8)
am = Image.fromarray(alpha, 'L').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
out = im.convert('RGBA'); out.putalpha(am)
na = np.asarray(am)
cols = np.where(na.max(axis=0) > 24)[0]; rows = np.where(na.max(axis=1) > 24)[0]
box = (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)
print('bbox', box, '→', box[2]-box[0], 'x', box[3]-box[1])
out.crop(box).save(dst)
print('saved', dst)
