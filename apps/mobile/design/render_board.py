"""Export Mobi's local presentation board; does not launch the Expo app.

Requires: playwright, pillow, and a Playwright Chromium installation.
Run: python render_board.py
"""
import json
import hashlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "exports"
OUT.mkdir(exist_ok=True)
(OUT / "screens").mkdir(exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1800, "height": 1000}, device_scale_factor=1)
    errors = []
    external = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: external.append(request.url) if request.url.startswith(("http:", "https:")) else None)
    page.goto((ROOT / "index.html").as_uri())
    page.wait_for_selector(".phone[data-screen]")
    page.evaluate("document.fonts.ready")
    page.add_style_tag(content="* { animation: none !important; transition: none !important; } body { margin: 0; }")
    frames = page.locator(".phone[data-screen]")
    results = []
    for index in range(frames.count()):
        frame = frames.nth(index)
        name = frame.get_attribute("data-screen")
        metrics = frame.evaluate("""el => {
          const bounds=el.getBoundingClientRect();
          const textNodes=[...el.querySelectorAll('*')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&!e.closest('.statusbar,svg'));
          const controls=[...el.querySelectorAll('button,input,textarea,a[href],.btn,.lang,.navitem,.choice,.edit,.back,.filter,.show-password')];
          const content=el.querySelector('.scroll');
          const contentBounds=content?.getBoundingClientRect();
          return {
            width:bounds.width,height:bounds.height,
            smallTargets:controls.filter(e=>e.getBoundingClientRect().height<55.9).map(e=>({text:e.textContent||e.getAttribute('aria-label'),height:e.getBoundingClientRect().height})),
            horizontalOverflow:textNodes.filter(e=>e.getBoundingClientRect().left<bounds.left-1||e.getBoundingClientRect().right>bounds.right+1||e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),
            smallText:textNodes.filter(e=>parseFloat(getComputedStyle(e).fontSize)<18).map(e=>({text:e.textContent,size:getComputedStyle(e).fontSize})),
            clippedContent:contentBounds?[...content.children].filter(e=>e.getBoundingClientRect().bottom>contentBounds.bottom+1).map(e=>e.textContent):[],
            scrollAreas:[...el.querySelectorAll('*')].filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowY)&&e.scrollHeight>e.clientHeight+2).map(e=>({class:e.className,height:e.clientHeight,scrollHeight:e.scrollHeight}))
          };
        }""")
        frame.screenshot(path=str(OUT / "screens" / f"{name}.png"))
        title = frame.locator("xpath=..").locator(".caption strong").inner_text()
        results.append({"screen": name, "title": title, **metrics})
    page.screenshot(path=str(OUT / "board.png"), full_page=True)
    browser.close()

with Image.open(OUT / "board.png") as board:
    preview = board.copy()
    preview.thumbnail((1800, 12000), Image.Resampling.LANCZOS)
    preview.save(OUT / "board-preview.jpg", quality=94)

font_path = Path("C:/Windows/Fonts/segoeui.ttf")
font = ImageFont.truetype(str(font_path), 16) if font_path.exists() else ImageFont.load_default()
sheet = Image.new("RGB", (1135, 40 + ((len(results) + 4) // 5) * 470), "#E3F0FC")
draw = ImageDraw.Draw(sheet)
for index, result in enumerate(results):
    x = 20 + (index % 5) * 225
    y = 20 + (index // 5) * 470
    label = f'{result["screen"]}  {result["title"]}'
    while draw.textlength(label, font=font) > 210:
        label = label[:-2].rstrip("…") + "…"
    draw.text((x, y), label, font=font, fill="#1F2A44")
    with Image.open(OUT / "screens" / f'{result["screen"]}.png') as phone:
        phone = phone.resize((195, 422), Image.Resampling.LANCZOS)
        sheet.paste(phone, (x, y + 28))
sheet.save(OUT / "contact-sheet.jpg", quality=94)

def luminance(color):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * w for v, w in zip(linear, (0.2126, 0.7152, 0.0722)))


pairs = [("#FFFFFF", "#2457A7"), ("#1F2A44", "#E3F0FC"),
         ("#465873", "#FFFFFF"), ("#465873", "#C9D3F8"),
         ("#465873", "#FFF6DC"), ("#2457A7", "#E3F0FC"),
         ("#1F2A44", "#DFF2E7"), ("#1F2A44", "#FCE9DC"),
         ("#1F2A44", "#E1E5F5")]
contrast = []
for foreground, background in pairs:
    low, high = sorted((luminance(foreground), luminance(background)))
    ratio = (high + 0.05) / (low + 0.05)
    contrast.append({"foreground": foreground, "background": background,
                     "ratio": round(ratio, 2), "normalTextAA": ratio >= 4.5})

report = {"sourceSha256": hashlib.sha256((ROOT / "index.html").read_bytes()).hexdigest(),
          "frames": len(results), "pageErrors": errors, "externalRequests": external,
          "tokenContrast": contrast, "results": results}
(OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"frames": len(results), "pageErrors": errors, "externalRequests": external,
                  "wrongDimensions": [r["screen"] for r in results if r["width"] != 390 or r["height"] != 844],
                  "smallTargets": sum(len(r["smallTargets"]) for r in results),
                  "horizontalOverflow": sum(len(r["horizontalOverflow"]) for r in results),
                  "smallText": sum(len(r["smallText"]) for r in results),
                  "clippedContent": sum(len(r["clippedContent"]) for r in results),
                  "scrollingScreens": [r["screen"] for r in results if r["scrollAreas"]]}, ensure_ascii=False))
