from PIL import Image
import os, shutil

public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
logo_path = os.path.join(public_dir, 'logo.png')
img = Image.open(logo_path)
w, h = img.size

# Copy logo.png to logo-full.png
shutil.copyfile(logo_path, os.path.join(public_dir, 'logo-full.png'))

# Crop left globe icon for logo-icon.png
# Globe is on the left side of logo.png (approx 0..h x 0..h)
icon_w = min(w, h)
icon_img = img.crop((0, 0, icon_w, h))
icon_img.save(os.path.join(public_dir, 'logo-icon.png'), "PNG")
icon_img.save(os.path.join(public_dir, 'favicon.png'), "PNG")
icon_img.save(os.path.join(public_dir, 'apple-icon.png'), "PNG")
icon_img.save(os.path.join(public_dir, 'favicon.ico'), "ICO")

print(f"Updated all logo and icon files in public/! Logo size: {w}x{h}")
