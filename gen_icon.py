from PIL import Image, ImageDraw

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background: rounded square, dark slate (matches app canvas color)
radius = 104
draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=(27, 31, 38, 255))
draw.rounded_rectangle([1, 1, SIZE - 2, SIZE - 2], radius=radius - 1, outline=(43, 48, 59, 255), width=3)

# Folder glyph outline, amber accent — echoes the sidebar folder icon in-app
amber = (232, 163, 61, 255)
fw = 20  # stroke width
folder_pts = [
    (120, 190), (120, 176 + 34 * 0),  # placeholder, replaced below with explicit path
]

def rounded_folder(draw, x, y, w, h, tab_w, tab_h, color, width):
    # Simple flat-top folder shape as a closed polygon, drawn with a thick outline.
    points = [
        (x, y + tab_h),
        (x, y + h),
        (x + w, y + h),
        (x + w, y + tab_h),
        (x + tab_w + 28, y + tab_h),
        (x + tab_w, y),
        (x, y),
        (x, y + tab_h),
    ]
    draw.line(points, fill=color, width=width, joint="curve")

rounded_folder(draw, 120, 176, 280, 220, 84, 34, amber, fw)

# "N" mark in the center of the folder, off-white
n_color = (232, 234, 237, 255)
nx, ny, nh, nw = 216, 236, 100, 80
n_points_left = [(nx, ny + nh), (nx, ny)]
n_points_diag = [(nx, ny), (nx + nw, ny + nh)]
n_points_right = [(nx + nw, ny + nh), (nx + nw, ny)]
stroke = 20
draw.line(n_points_left, fill=n_color, width=stroke, joint="curve")
draw.line(n_points_diag, fill=n_color, width=stroke, joint="curve")
draw.line(n_points_right, fill=n_color, width=stroke, joint="curve")

img.save("/home/claude/niko-files/src/assets/icon-512.png")

for size in (256, 128, 64, 48, 32):
    img.resize((size, size), Image.LANCZOS).save(f"/home/claude/niko-files/src/assets/icon-{size}.png")

img.save("/home/claude/niko-files/src/assets/icon.png")
print("done")
