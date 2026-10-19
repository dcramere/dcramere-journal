"""Maakt de app-iconen (beginscherm, favicon) uit het originele DCRAMERE-logo.   python3 scripts/make-icons.py
Het embleem (ring, oog en candlesticks) wordt losgeknipt van het woord DCRAMERE en de slogan eronder, want
die letters worden op icoongrootte onleesbaar. Het geheel komt op zwart, in de huisstijl van de app. Vereist Pillow."""
from PIL import Image

SRC = "scripts/assets/dcramere-logo.png"  # 1000x1000, zwarte achtergrond
OUT = "public"
src = Image.open(SRC).convert("RGB")
w, h = src.size
assert (w, h) == (1000, 1000), "de coördinaten hieronder gelden voor het 1000x1000 logo"

# Het embleem eindigt op ~69% van de hoogte; het woord DCRAMERE begint op ~71%. Knip ertussen.
band = src.crop((0, 0, w, int(h * 0.70)))
px = band.load()
xs = [x for x in range(band.width) for y in range(0, band.height, 2) if max(px[x, y]) > 40]
ys = [y for y in range(band.height) for x in range(0, band.width, 2) if max(px[x, y]) > 40]
pad = 12
art = band.crop((max(0, min(xs) - pad), max(0, min(ys) - pad), min(band.width, max(xs) + pad), min(band.height, max(ys) + pad)))


def icon(size, fill):
    """Zwart vierkant met het embleem op `fill` (0..1) van de breedte, gecentreerd."""
    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    target = int(size * fill)
    scale = target / art.width
    emblem = art.resize((target, max(1, int(art.height * scale))), Image.LANCZOS)
    canvas.paste(emblem, ((size - emblem.width) // 2, (size - emblem.height) // 2))
    return canvas


icon(512, 0.92).save(f"{OUT}/icons/icon-512.png", optimize=True)
icon(192, 0.92).save(f"{OUT}/icons/icon-192.png", optimize=True)
icon(512, 0.64).save(f"{OUT}/icons/maskable-512.png", optimize=True)  # Android snijdt hier cirkel/afgeronde vorm uit
icon(180, 0.84).save(f"{OUT}/apple-touch-icon.png", optimize=True)   # iOS rondt de hoeken zelf af
icon(32, 0.98).save(f"{OUT}/favicon-32.png", optimize=True)
icon(16, 0.98).save(f"{OUT}/favicon-16.png", optimize=True)
print(f"iconen gemaakt (embleem {art.width}x{art.height}px)")
