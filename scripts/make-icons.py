"""Maakt de app-iconen (beginscherm, favicon) uit het DCRAMERE-logo.   python3 scripts/make-icons.py
Het embleem wordt bijgesneden tot de ring met oog en halter (de letters worden op icoongrootte onleesbaar)
en op zwart gezet, in de huisstijl van de app. Vereist Pillow."""
from PIL import Image

SRC = "scripts/assets/dcramere-logo.png"  # 1000x1000, zwarte achtergrond
OUT = "public"
src = Image.open(SRC).convert("RGB")
w, h = src.size

# De ring met oog en halter, zonder het woord DCRAMERE en de slagzin (die beginnen op ~71% van de hoogte).
art = src.crop((int(w * 0.05), int(h * 0.04), int(w * 0.95), int(h * 0.70)))

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
print("iconen gemaakt")
