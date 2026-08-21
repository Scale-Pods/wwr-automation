from PIL import Image
import os

logo_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'logo.png')
img = Image.open(logo_path).convert("RGBA")
pixels = img.load()
width, height = img.size

print(f"Loaded logo.png: {width}x{height}")

# Flood fill or sample outer corners to remove checkerboard grid
corner_samples = [pixels[0,0], pixels[width-1, 0], pixels[0, height-1], pixels[width-1, height-1]]
print("Corner pixel samples:", corner_samples)

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Check if pixel is grey checkerboard pattern (r, g, b close to each other and between 30 and 190)
        # while NOT being part of the blue globe or white/gold text
        is_blue = b > r + 30 and b > 80
        is_bright_white = r > 210 and g > 210 and b > 210
        is_grey_checkerboard = (abs(r - g) < 20 and abs(g - b) < 20 and 35 <= r <= 190)

        if is_grey_checkerboard and not is_blue and not is_bright_white:
            pixels[x, y] = (0, 0, 0, 0)

img.save(logo_path, "PNG")
print("Saved clean transparent logo.png!")
