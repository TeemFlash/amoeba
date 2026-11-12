"""Render the approved reusable SVG symbols to transparent 640x480 PNGs.

Requires Playwright with Chromium. From apps/mobile:
  $env:PYTHONPATH = "$env:TEMP/mobi-design-tools"
  python assets/illustrations/render.py
"""
from pathlib import Path
from xml.etree import ElementTree
from html import escape
import re

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
SVG_PATH = ROOT / 'design' / 'illustrations.svg'
OUT = Path(__file__).resolve().parent
SIZE = 640
SVG_NS = '{http://www.w3.org/2000/svg}'

source = ElementTree.parse(SVG_PATH).getroot()
defs = source.find(f'{SVG_NS}defs')
if defs is None:
    raise ValueError(f'No defs found in {SVG_PATH}')

scenes = ('armchair', 'phone', 'apple', 'tea', 'park', 'game')
symbol_ids = {symbol.attrib['id'] for symbol in defs.findall(f'{SVG_NS}symbol')}
missing = [scene for scene in scenes if f'art-{scene}' not in symbol_ids]
if missing:
    raise ValueError(f'Missing symbols in {SVG_PATH}: {missing}')

raw_svg = SVG_PATH.read_text(encoding='utf-8')
defs_match = re.search(r'<defs>(.*?)</defs>', raw_svg, flags=re.DOTALL)
if defs_match is None:
    raise ValueError(f'Could not read raw defs markup from {SVG_PATH}')
# Preserve the source's unprefixed SVG tags: HTML's SVG parser does not apply
# XML namespace prefixes the same way ElementTree does when serializing nodes.
defs_markup = defs_match.group(1)
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": SIZE, "height": 480}, device_scale_factor=1)
    for scene in scenes:
        markup = f'''<!doctype html><html><head><style>
          html,body{{margin:0;width:100%;height:100%;background:transparent;}}
          svg{{display:block;width:{SIZE}px;height:480px;}}
        </style></head><body>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
            {defs_markup}<use href="#art-{escape(scene)}"/>
          </svg>
        </body></html>'''
        page.set_content(markup)
        page.locator('svg').screenshot(path=str(OUT / f'{scene}.png'), omit_background=True)
    browser.close()

print(f'Rendered {len(scenes)} transparent PNGs at {SIZE}x480 from {SVG_PATH}')
