#!/usr/bin/env python3
"""Generate iOS splash screen for Dombi PWA."""
from PIL import Image
import os

WIDTH = 1290
HEIGHT = 2796
BG_COLOR = (4, 120, 87)  # #047857

def generate():
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)

    icon_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons', 'icon-512.png')
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert('RGBA')
        icon_size = 300
        icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
        x = (WIDTH - icon_size) // 2
        y = (HEIGHT - icon_size) // 2
        img.paste(icon, (x, y), icon)

    out_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'splash')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'iphone-startup.png')
    img.save(out_path, 'PNG')
    print(f'Splash generated: {out_path}')

if __name__ == '__main__':
    generate()
