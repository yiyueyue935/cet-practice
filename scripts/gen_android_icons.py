# -*- coding: utf-8 -*-
"""生成安卓启动图标与启动屏：app/icons/icon-512.png -> 各密度 mipmap + splash layer-list"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_ICONS = os.path.join(ROOT, "app", "icons")
RES = os.path.join(ROOT, "cap", "android", "app", "src", "main", "res")

DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

src = Image.open(os.path.join(APP_ICONS, "icon-512.png")).convert("RGBA")
print("source:", src.size)

for folder, size in DENSITIES.items():
    d = os.path.join(RES, folder)
    os.makedirs(d, exist_ok=True)
    img = src.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(d, "ic_launcher.png"))
    # 圆形裁切版
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    round_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_img.paste(img, (0, 0), mask)
    round_img.save(os.path.join(d, "ic_launcher_round.png"))
    print(folder, size, "ok")

# 启动屏：纯色底 + 居中图标（layer-list，不再用会被拉伸的位图）
colors = os.path.join(RES, "values", "colors.xml")
with open(colors, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splashBg">#F5F2EA</color>\n</resources>\n')

splash_png = os.path.join(RES, "drawable", "splash.png")
if os.path.exists(splash_png):
    os.remove(splash_png)
    print("removed default splash.png")
with open(os.path.join(RES, "drawable", "splash.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n'
            '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <item android:drawable="@color/splashBg"/>\n'
            '    <item>\n'
            '        <bitmap android:src="@mipmap/ic_launcher" android:gravity="center"/>\n'
            '    </item>\n'
            '</layer-list>\n')
print("splash.xml ok")
