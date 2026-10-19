"""Maakt de app-iconen (beginscherm, favicon) uit het journal-logo.   python3 scripts/make-icons.py
Eerst `python3 scripts/make-logo-journal.py` (maakt scripts/assets/dcramere-journal-mark.png: het embleem met ring,
oog en candlesticks plus het notitieboekje, zonder de letters die op icoongrootte onleesbaar worden).
Het geheel komt op zwart, in de huisstijl van de app. Vereist Pillow."""
from PIL import Image

SRC = "scripts/assets/dcramere-journal-mark.png"  # embleem + notitieboekje, zonder letters (zie make-logo-journal.py)
OUT = "public"
art = Image.open(SRC).convert("RGB")


def icon(size, fill):
    """Zwart vierkant met het embleem op `fill` (0..1) van de breedte, gecentreerd."""
    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    scale = size * fill / max(art.width, art.height)  # past in beide richtingen binnen het vierkant
    emblem = art.resize((max(1, int(art.width * scale)), max(1, int(art.height * scale))), Image.LANCZOS)
    canvas.paste(emblem, ((size - emblem.width) // 2, (size - emblem.height) // 2))
    return canvas


icon(512, 0.92).save(f"{OUT}/icons/icon-512.png", optimize=True)
icon(192, 0.92).save(f"{OUT}/icons/icon-192.png", optimize=True)
icon(512, 0.64).save(f"{OUT}/icons/maskable-512.png", optimize=True)  # Android snijdt hier cirkel/afgeronde vorm uit
icon(180, 0.84).save(f"{OUT}/apple-touch-icon.png", optimize=True)   # iOS rondt de hoeken zelf af
icon(32, 0.98).save(f"{OUT}/favicon-32.png", optimize=True)
icon(16, 0.98).save(f"{OUT}/favicon-16.png", optimize=True)
print(f"iconen gemaakt (bron {art.width}x{art.height}px)")
