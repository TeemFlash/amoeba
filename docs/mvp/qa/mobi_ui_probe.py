"""Inspect the actual Expo UI. This does not inspect the static design board."""
from pathlib import Path
import json
import os
import subprocess

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / 'apps' / 'mobile'
OUT = Path(os.environ.get('QA_OUTPUT_DIR', str(Path(__file__).parent / '2026-11-10-implemented-ui')))
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('DEMO_URL', 'http://127.0.0.1:8091')


def definitions():
    script = r"""
import {readFileSync} from 'node:fs';
import {t} from './src/i18n.ts';
import * as catalog from './src/domain/catalog.ts';
const source=readFileSync('src/i18n.ts','utf8').split('const kz')[0];
const keys=[...new Set([...source.matchAll(/\b(\w+):\s*'/g)].map(m=>m[1]))];
console.log(JSON.stringify({labels:Object.fromEntries(['ru','kz'].map(l=>[l,Object.fromEntries(keys.map(k=>[k,t(l,k)]))])),catalog}));
"""
    result = subprocess.run(['node', '--import', 'tsx', '--input-type=module', '-e', script], cwd=APP, check=True, capture_output=True, text=True, encoding='utf-8')
    return json.loads(result.stdout)


def layout(page):
    return page.evaluate(r"""() => {
      const elements=[...document.querySelectorAll('[dir="auto"],input,textarea,[role="button"],[role="radio"],[role="tab"]')];
      const outside=elements.filter(e=>{
        const r=e.getBoundingClientRect();
        return r.width && (r.left < -1 || r.right > innerWidth+1 || e.scrollWidth>e.clientWidth+2);
      }).map(e=>({text:(e.textContent||e.getAttribute('aria-label')||'').slice(0,120),width:e.clientWidth,scroll:e.scrollWidth}));
      const smallTargets=[...document.querySelectorAll('[role="button"],[role="radio"],[role="tab"],input:not([type="hidden"]),textarea')]
        .filter(e=>e.getBoundingClientRect().height>0&&e.getBoundingClientRect().height<55.9)
        .map(e=>({text:e.getAttribute('aria-label')||e.textContent,height:e.getBoundingClientRect().height}));
      return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,outside,smallTargets};
    }""")


if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.get_by_text('Mobi', exact=True).first.wait_for()
        page.wait_for_timeout(300)
        text = page.locator('body').inner_text()
        page.screenshot(path=str(OUT / 'current-screen.png'))
        report = {'url': URL, 'pageErrors': errors, 'layout': layout(page), 'text': text}
        (OUT / 'current-probe.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))
        browser.close()
