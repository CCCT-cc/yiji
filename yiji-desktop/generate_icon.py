import os
from PIL import Image, ImageDraw, ImageFont

ROOT = r'C:\Users\HUAWEI\WorkBuddy\2026-09-02-19-27-28\yiji-desktop'
ICO = os.path.join(ROOT, 'icon.ico')
PNG = os.path.join(ROOT, 'icon.png')

BRAND = (47, 125, 79)       # #2f7d4f
WHITE = (255, 255, 255)

S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角绿底 tile
d.rounded_rectangle([0, 0, S, S], radius=112, fill=BRAND)

# 白色圆币
m = 150
d.ellipse([m, m, S - m, S - m], fill=WHITE)

# 居中「记」字（绿色）
font = None
for fp in [r'C:\Windows\Fonts\msyhbd.ttc', r'C:\Windows\Fonts\msyh.ttc',
           r'C:\Windows\Fonts\simhei.ttf', r'C:\Windows\Fonts\simsun.ttc']:
    try:
        font = ImageFont.truetype(fp, 200, index=0)
        break
    except Exception:
        continue
if font is None:
    font = ImageFont.load_default()

ch = '记'
bbox = d.textbbox((0, 0), ch, font=font)
w = bbox[2] - bbox[0]
h = bbox[3] - bbox[1]
x = (S - w) / 2 - bbox[0]
y = (S - h) / 2 - bbox[1]
d.text((x, y), ch, font=font, fill=BRAND)

img.save(PNG)

# 多尺寸 ICO
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
imgs = [img.resize(s, Image.LANCZOS) for s in sizes]
img.save(ICO, sizes=sizes)
print('ICON_WRITTEN', ICO, os.path.getsize(ICO))
