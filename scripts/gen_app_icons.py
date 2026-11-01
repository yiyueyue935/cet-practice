# -*- coding: utf-8 -*-
"""生成「过级」图标：Web PWA + Android 各密度 mipmap。

设计：深蓝渐变底 + 白色「过」+ 金色 CET 4·6
- 普通图标：圆角方形
- maskable：满幅渐变，内容缩到安全区
- Android 自适应：背景色 + 透明前景（内容缩到 66%）
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FONT_BD = 'C:/Windows/Fonts/msyhbd.ttc'
FONT_RG = 'C:/Windows/Fonts/msyh.ttc'
TOP = (11, 30, 75)       # #0B1E4B
BOT = (32, 62, 112)      # #203E70
GOLD = (255, 217, 131)   # #FFD983
WHITE = (255, 255, 255)


def gradient(size):
    img = Image.new('RGB', (size, size), TOP)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    # 右上角柔光
    glow = Image.new('L', (size, size), 0)
    gd = ImageDraw.Draw(glow)
    r = int(size * 0.55)
    gd.ellipse([size - r, -r, size + r, r], fill=46)
    glow = glow.filter(__import__('PIL.ImageFilter', fromlist=['GaussianBlur']).GaussianBlur(size // 8))
    img.paste(Image.new('RGB', (size, size), (90, 124, 190)), (0, 0), glow)
    return img


def draw_content(img, scale=0.86):
    """整体（过 + 金线 + CET）作为一个块垂直居中；scale 控制占幅（安全区）。"""
    size = img.size[0]
    d = ImageDraw.Draw(img)
    s = size * scale
    cx = size / 2

    f = ImageFont.truetype(FONT_BD, int(s * 0.55))
    tb = d.textbbox((0, 0), '过', font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    f2 = ImageFont.truetype(FONT_BD, int(s * 0.13))
    label = 'CET 4·6'
    tb2 = d.textbbox((0, 0), label, font=f2)
    tw2, th2 = tb2[2] - tb2[0], tb2[3] - tb2[1]

    gap = s * 0.05
    line_h = max(4, size // 190)
    total = th + gap + line_h + gap + th2
    top = (size - total) / 2

    d.text((cx - tw / 2 - tb[0], top - tb[1]), '过', font=f, fill=WHITE)
    ly = top + th + gap
    lw = s * 0.30
    d.rounded_rectangle([cx - lw / 2, ly, cx + lw / 2, ly + line_h], radius=line_h / 2, fill=GOLD)
    d.text((cx - tw2 / 2 - tb2[0], ly + line_h + gap - tb2[1]), label, font=f2, fill=GOLD)


def rounded(img, radius_ratio=0.22):
    size = img.size[0]
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def icon(size, maskable=False):
    base = gradient(size)
    if maskable:
        draw_content(base, scale=0.66)
        return base.convert('RGBA')
    draw_content(base, scale=0.86)
    return rounded(base)


def foreground(size):
    """Android 自适应前景：透明底，内容在中心 66% 安全区。"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_content(img, scale=0.60)
    return img


def main():
    web = os.path.join(ROOT, 'app', 'icons')
    os.makedirs(web, exist_ok=True)
    icon(192).save(os.path.join(web, 'icon-192.png'))
    icon(512).save(os.path.join(web, 'icon-512.png'))
    icon(512, maskable=True).save(os.path.join(web, 'icon-512-maskable.png'))
    icon(1024).save(os.path.join(ROOT, '.workbuddy', 'shots', 'icon-preview.png'))

    res = os.path.join(ROOT, 'cap', 'android', 'app', 'src', 'main', 'res')
    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fg = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for dpi, px in legacy.items():
        d = os.path.join(res, 'mipmap-' + dpi)
        os.makedirs(d, exist_ok=True)
        icon(px).save(os.path.join(d, 'ic_launcher.png'))
        # 圆形图标：圆形裁剪
        im = gradient(px)
        draw_content(im, scale=0.86)
        mask = Image.new('L', (px, px), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, px - 1, px - 1], fill=255)
        out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        out.paste(im, (0, 0), mask)
        out.save(os.path.join(d, 'ic_launcher_round.png'))
        foreground(fg[dpi]).save(os.path.join(d, 'ic_launcher_foreground.png'))
    print('图标已生成：web 3 张 + android 5 档')


if __name__ == '__main__':
    main()
