"""Maakt de app-iconen (beginscherm, favicon) uit het DCRAMERE-logo.   python3 scripts/make-icons.py
Het coaching-logo bevat een halter; voor het journal halen we die weg en laten we de groeilijn met pijl staan.
Daarna wordt het embleem bijgesneden tot de ring met oog (de letters worden op icoongrootte onleesbaar)
en op zwart gezet, in de huisstijl van de app. Vereist Pillow."""
from PIL import Image

SRC = "scripts/assets/dcramere-logo.png"  # 1000x1000, zwarte achtergrond
OUT = "public"
src = Image.open(SRC).convert("RGB")
w, h = src.size
assert (w, h) == (1000, 1000), "de coördinaten hieronder gelden voor het 1000x1000 logo"


def remove_dumbbell(img):
    """Wist de halter (stangen en gewichten) en vult de plek met het donkere schijnsel eromheen.
    De groeilijn met pijl eronder blijft intact: rechts en onderaan wordt daarom minder gewist."""
    px = img.load()
    ref_row = 534  # net boven de gewichten: de echte schijnsel-kleur, zodat de vulling naadloos aansluit
    # (x0, x1, y0, y1) in pixels van het 1000x1000 logo; gemeten op de halter en de lijn eronder.
    blocks = [
        (278, 460, 536, 641),   # linker gewichten
        (440, 560, 572, 603),   # stang
        (540, 678, 536, 641),   # rechter gewichten (links van de lijn-bocht)
        (678, 722, 536, 624),   # buitenste rechter gewicht; lager loopt de groeilijn
    ]
    # Het schijnsel per kolom uit de rij erboven; de puntjes onder de driehoek (x 488-512) worden overgeslagen
    # door een kolom ernaast te nemen.
    base = {}
    for x in range(270, 730):
        xs = 480 if 486 <= x <= 514 else x
        vals = [px[min(729, max(270, xs + d)), ref_row] for d in (-2, -1, 0, 1, 2)]
        base[x] = tuple(sum(v[i] for v in vals) / len(vals) for i in range(3))
    for x0, x1, y0, y1 in blocks:
        for y in range(y0, y1):
            f = max(0.0, 1.0 - (y - ref_row) / 65.0)
            for x in range(x0, x1):
                r, g, bl = base[x]
                px[x, y] = (round(r * f), round(g * f), round(bl * f))
    return img


src = remove_dumbbell(src.copy())
src.save("scripts/assets/dcramere-emblem-journal.png", optimize=True)  # tussenproduct, handig voor controle

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
