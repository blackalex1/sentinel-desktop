import os
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw

def process_sentinel_icon():
    source_path = r"C:\Users\black\.gemini\antigravity\brain\6a7a99e0-831d-47f7-8ed5-3edb119a54d8\sentinel_win_flat_v2_1786638206284.jpg"
    target_base = r"c:\Users\black\PycharmProjects\x-pc"
    icons_dir = os.path.join(target_base, "src-tauri", "icons")
    
    # 1. Load source image
    img = Image.open(source_path).convert("RGBA")
    w, h = img.size
    
    # 2. Enhance colors and crispness for icons
    color_enhancer = ImageEnhance.Color(img)
    img = color_enhancer.enhance(1.15)  # Slightly boost neon cyan & purple
    
    contrast_enhancer = ImageEnhance.Contrast(img)
    img = contrast_enhancer.enhance(1.10)
    
    sharpness_enhancer = ImageEnhance.Sharpness(img)
    img = sharpness_enhancer.enhance(1.25)
    
    # 3. Create anti-aliased rounded squircle alpha mask (supersampled 4x)
    scale = 4
    mask_size = (w * scale, h * scale)
    corner_radius = int(w * 0.22 * scale)  # Modern Windows/Android squircle curve
    
    big_mask = Image.new("L", mask_size, 0)
    draw = ImageDraw.Draw(big_mask)
    draw.rounded_rectangle([(0, 0), mask_size], radius=corner_radius, fill=255)
    
    # Downsample mask with high quality LANCZOS for silky smooth anti-aliased edges
    smooth_mask = big_mask.resize((w, h), Image.Resampling.LANCZOS)
    
    # Apply alpha mask
    final_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    final_img.paste(img, (0, 0), smooth_mask)
    
    # 4. Save master PNGs
    os.makedirs(icons_dir, exist_ok=True)
    master_png = os.path.join(target_base, "logo.png")
    public_png = os.path.join(target_base, "public", "logo.png")
    
    final_img.save(master_png, "PNG", optimize=True)
    final_img.save(public_png, "PNG", optimize=True)
    print(f"Saved master logo to {master_png}")
    
    # 5. Generate all Tauri icon sizes
    sizes = {
        "32x32.png": (32, 32),
        "64x64.png": (64, 64),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "icon.png": (512, 512),
        "Square30x30Logo.png": (30, 30),
        "Square44x44Logo.png": (44, 44),
        "Square71x71Logo.png": (71, 71),
        "Square89x89Logo.png": (89, 89),
        "Square107x107Logo.png": (107, 107),
        "Square142x142Logo.png": (142, 142),
        "Square150x150Logo.png": (150, 150),
        "Square284x284Logo.png": (284, 284),
        "Square310x310Logo.png": (310, 310),
        "StoreLogo.png": (50, 50),
    }
    
    for filename, (sw, sh) in sizes.items():
        resized = final_img.resize((sw, sh), Image.Resampling.LANCZOS)
        out_path = os.path.join(icons_dir, filename)
        resized.save(out_path, "PNG", optimize=True)
    
    # 6. Generate multi-resolution Windows ICO
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_path = os.path.join(icons_dir, "icon.ico")
    final_img.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"Generated multi-resolution ICO at {ico_path}")
    print("Pillow processing completed successfully!")

if __name__ == "__main__":
    process_sentinel_icon()
