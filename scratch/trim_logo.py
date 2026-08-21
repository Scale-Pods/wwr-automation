from PIL import Image
import os

logo_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'logo.png')
img = Image.open(logo_path)

# Trim transparent bounding box
bbox = img.getbbox()
if bbox:
    cropped = img.crop(bbox)
    cropped.save(logo_path, "PNG")
    print(f"Cropped logo.png from {img.size} to {cropped.size}")
else:
    print("No bbox found")
