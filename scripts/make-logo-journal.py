"""Maakt het journal-logo uit het originele DCRAMERE-logo.   python3 scripts/make-logo-journal.py

Wat er gebeurt:
  - het embleem en het woord DCRAMERE blijven pixel voor pixel zoals het origineel;
  - het woord JOURNAL komt eronder, in een serif die op je letters lijkt (Cinzel) en met hetzelfde goudverloop,
    dat uit je eigen letters wordt afgelezen;
  - de scheidingslijn en de slogan 'SEE. DECIPHER. TRADE.' schuiven omlaag, ook pixel voor pixel het origineel;
  - onderaan komt een notitieboekje met candlesticks als journal-symbool.
Uitvoer:
  scripts/assets/dcramere-journal-logo.png   volledig logo (1000 px breed, voor PDF-omslag)
  scripts/assets/dcramere-journal-mark.png   embleem + boekje zonder letters (bron voor de app-iconen)
  public/brand/logo-journal.png              volledig logo (inlogscherm)
  public/brand/emblem.png                    klein embleem (kop van de app)
Vereist Pillow en @fontsource/cinzel (npm install)."""
import io
import statistics
import struct
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC = Path("scripts/assets/dcramere-logo.png")  # origineel logo op 1000x1000
CINZEL = Path("node_modules/@fontsource/cinzel/files/cinzel-latin-500-normal.woff")
SS = 4  # supersampling voor het tekenen van het symbool


def woff_to_ttf(path):
    """WOFF 1.0 -> sfnt (TTF/OTF) in het geheugen, zodat Pillow het kan lezen."""
    d = path.read_bytes()
    assert d[:4] == b"wOFF", "geen WOFF-bestand"
    flavor, _length, num = struct.unpack(">4sIH", d[4:14])
    tables = []
    for i in range(num):
        tag, off, comp, orig, csum = struct.unpack(">4sIIII", d[44 + 20 * i : 64 + 20 * i])
        raw = d[off : off + comp]
        tables.append((tag, csum, zlib.decompress(raw) if comp != orig else raw))
    tables.sort(key=lambda t: t[0])
    n = len(tables)
    entry = 1
    while entry * 2 <= n:
        entry *= 2
    out = bytearray(struct.pack(">4sHHHH", flavor, n, entry * 16, entry.bit_length() - 1, n * 16 - entry * 16))
    pos = 12 + 16 * n
    body = bytearray()
    for tag, csum, data in tables:
        out += struct.pack(">4sIII", tag, csum, pos + len(body), len(data))
        body += data + b"\0" * (-len(data) % 4)
    return io.BytesIO(bytes(out) + bytes(body))


def gold_profile(img, y0, y1, x0, x1):
    """Het goudverloop van bovenaan naar onderaan de letters: lijst van (r,g,b) per rij."""
    px = img.load()
    rows = []
    for y in range(y0, y1):
        cols = [px[x, y] for x in range(x0, x1) if max(px[x, y]) > 150]
        rows.append(tuple(int(statistics.median(c[i] for c in cols)) for i in range(3)) if len(cols) > 20 else None)
    last = next(r for r in rows if r)
    for i, r in enumerate(rows):
        if r is None:
            rows[i] = last
        last = rows[i]
    return rows


def gradient_fill(mask, profile):
    """Kleurt een masker (L) met het goudverloop, van de bovenrand van het masker naar de onderrand."""
    bbox = mask.getbbox()
    out = Image.new("RGB", mask.size, (0, 0, 0))
    if not bbox:
        return out
    top, bottom = bbox[1], bbox[3]
    px = out.load()
    for y in range(top, bottom):
        t = (y - top) / max(1, bottom - top - 1)
        c = profile[min(len(profile) - 1, int(t * (len(profile) - 1)))]
        for x in range(bbox[0], bbox[2]):
            px[x, y] = c
    return out


def paste_gold(canvas, mask, profile):
    canvas.paste(gradient_fill(mask, profile), (0, 0), mask)


def draw_book(cx, cy, k=1.2):
    """Notitieboekje met links tekstregels en rechts candlesticks. Geeft een masker (L) op canvasgrootte terug."""
    W, H = canvas_size
    m = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)

    K = k  # het symbool is op 1.0 getekend en wordt hier vergroot

    def P(x, y):
        return ((cx + x * K) * SS, (cy + y * K) * SS)

    def line(pts, width):
        pts = [P(*p) for p in pts]
        width = width * 1.12
        d.line(pts, fill=255, width=int(width * SS), joint="curve")
        r = width * SS / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)

    s = 5.2
    # Pagina's (twee vleugels met een lichte welving) en de rug
    left = [(0, -6), (-22, -21), (-52, -25), (-86, -16), (-86, 46), (-52, 56), (-22, 55), (0, 42)]
    right = [(-x, y) for x, y in left]
    line(left + [left[0]], s)
    line(right + [right[0]], s)
    line([(0, -6), (0, 42)], s * 0.8)
    # Omslag eronder
    line([(-96, -6), (-96, 60), (-52, 70), (-20, 69), (0, 55), (20, 69), (52, 70), (96, 60), (96, -6)], s * 0.9)
    # Linkerpagina: tekstregels
    for i, (y, x0) in enumerate([(-4, -72), (11, -72), (26, -72), (41, -72)]):
        line([(x0, y), (-14 if i < 3 else -38, y + 1.5)], 4.2)
    # Rechterpagina: candlesticks die omhoog lopen
    candles = [(16, 36, 8), (30, 29, 12), (44, 21, 9), (58, 10, 13), (72, 2, 10)]
    for x, bottom, height in candles:
        top = bottom - height
        line([(x, top - 6), (x, bottom + 5)], 2.6)  # lont
        d.rounded_rectangle((*P(x - 4.6, top), *P(x + 4.6, bottom)), radius=SS * 1.2, fill=255)  # lichaam
    return m.resize((W, H), Image.LANCZOS)


def draw_side_lines(cy, profile):
    """De gespitste sierlijnen links en rechts van het boekje, zoals onder het origineel."""
    W, H = canvas_size
    m = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(m)
    mid = W // 2
    for sign in (-1, 1):
        for i in range(0, 150):
            t = i / 149
            half = 2.6 * (1 - t) ** 0.8  # spits uitlopend naar buiten
            x = mid + sign * (172 + i * 1.0)
            d.rectangle(((x) * SS, (cy - half) * SS, (x + 1) * SS, (cy + half) * SS), fill=255)
        r = 2.6  # afgeronde binnenkant
        xe = mid + sign * 172
        d.ellipse(((xe - r) * SS, (cy - r) * SS, (xe + r) * SS, (cy + r) * SS), fill=255)
    return m.resize((W, H), Image.LANCZOS)


src = Image.open(SRC).convert("RGB")
assert src.size == (1000, 1000)
# Werk op de oorspronkelijke 1254 px-verhouding: schaal terug naar de maten van het origineel
BASE = 1254
orig = src.resize((BASE, BASE), Image.LANCZOS)

profile = gold_profile(orig, 895, 1003, 130, 1125)

# Indeling (pixels op 1254 breed)
JOURNAL_TOP = 1040
JOURNAL_CAP = 58
SHIFT = 100  # scheidingslijn + slogan schuiven omlaag
BOOK_CY = 1300
HEIGHT = 1432
canvas_size = (BASE, HEIGHT)

canvas = Image.new("RGB", canvas_size, (0, 0, 0))
canvas.paste(orig.crop((0, 0, BASE, 1006)), (0, 0))  # embleem + DCRAMERE
band = orig.crop((0, 1015, BASE, 1107))  # scheidingslijn + slogan
canvas.paste(band, (0, 1015 + SHIFT))

# JOURNAL
font_file = woff_to_ttf(CINZEL)
probe = ImageFont.truetype(font_file, 100)
cap100 = probe.getbbox("H")[3] - probe.getbbox("H")[1]
size = round(100 * JOURNAL_CAP / cap100)
font_file.seek(0)
font = ImageFont.truetype(font_file, size)
tracking = round(size * 0.42)
word = "JOURNAL"
widths = [font.getlength(c) for c in word]
total = sum(widths) + tracking * (len(word) - 1)
tm = Image.new("L", canvas_size, 0)
td = ImageDraw.Draw(tm)
x = (BASE - total) / 2
for c, w in zip(word, widths):
    td.text((x, JOURNAL_TOP - font.getbbox("H")[1]), c, font=font, fill=255)
    x += w + tracking
paste_gold(canvas, tm, profile)

# Symbool + sierlijnen
book = draw_book(BASE // 2, BOOK_CY)
paste_gold(canvas, book, profile)
paste_gold(canvas, draw_side_lines(BOOK_CY, profile), [profile[len(profile) // 3]])

# Uitvoer
canvas.resize((1000, round(HEIGHT * 1000 / BASE)), Image.LANCZOS).save("scripts/assets/dcramere-journal-logo.png", optimize=True)
Path("public/brand").mkdir(parents=True, exist_ok=True)
canvas.resize((640, round(HEIGHT * 640 / BASE)), Image.LANCZOS).save("public/brand/logo-journal.png", optimize=True)

# Embleem + boekje zonder letters (voor de app-iconen) en het kleine embleem voor de kop
emblem_band = orig.crop((0, 0, BASE, 880))
ep = emblem_band.load()
xs = [x for x in range(BASE) for y in range(0, 880, 3) if max(ep[x, y]) > 40]
ys = [y for y in range(880) for x in range(0, BASE, 3) if max(ep[x, y]) > 40]
pad = 14
emblem = emblem_band.crop((max(0, min(xs) - pad), max(0, min(ys) - pad), min(BASE, max(xs) + pad), min(880, max(ys) + pad)))
emblem.resize((160, round(emblem.height * 160 / emblem.width)), Image.LANCZOS).save("public/brand/emblem.png", optimize=True)

# Voor het icoon is het boekje veel groter dan in het logo, anders is het op 180 px niet te herkennen.
BOOK_K = 1.9
gap = 30
mark_h = emblem.height + gap + round(165 * BOOK_K) + 24
mark = Image.new("RGB", (emblem.width, mark_h), (0, 0, 0))
mark.paste(emblem, (0, 0))
canvas_size = (mark.width, mark.height)
paste_gold(mark, draw_book(mark.width // 2, emblem.height + gap + round(70 * BOOK_K), BOOK_K), profile)
mark.save("scripts/assets/dcramere-journal-mark.png", optimize=True)
print(f"logo {canvas.size} · embleem {emblem.size} · mark {mark.size}")
