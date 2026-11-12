"""RU/KZ account form layout checks; 2x text is web emulation, not native scaling."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json, os

out = Path(os.environ.get('QA_OUTPUT_DIR', 'firebase-qa-results'))
out.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    for locale in ['ru', 'kz']:
        for width in [320, 390]:
            for form in ['signin', 'register', 'reset']:
                context = browser.new_context(viewport={'width': width, 'height': 844})
                page = context.new_page()
                page.goto(os.environ.get('DEMO_URL', 'http://127.0.0.1:8097'))
                page.get_by_role('tab', name='Аккаунт', exact=True).click()
                expect(page.get_by_role('button', name='Войти', exact=True)).to_be_visible()
                if form == 'register': page.get_by_role('button', name='Нет аккаунта? Создать', exact=True).click()
                if form == 'reset': page.get_by_role('button', name='Забыли пароль?', exact=True).click()
                if locale == 'kz': page.get_by_role('button', name='Қазақша', exact=True).click()
                for scale in [1, 2]:
                    if scale == 2:
                        page.evaluate('''() => {document.querySelectorAll('[dir="auto"],input').forEach(e => {const c=getComputedStyle(e);e.style.fontSize=(parseFloat(c.fontSize)*2)+'px';if(c.lineHeight!=='normal')e.style.lineHeight=(parseFloat(c.lineHeight)*2)+'px';})}''')
                    layout = page.evaluate('''() => ({document:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('button,input,[role="tab"]')].map(e=>({label:e.getAttribute('aria-label')||e.textContent,r:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth})).filter(e=>e.r.right>innerWidth+1||e.r.left< -1||e.scroll>e.client+1)})''')
                    assert layout['document'] <= width and not layout['outside'], (locale, width, form, scale, layout)
                    page.get_by_role('button').last.scroll_into_view_if_needed()
                    if width == 320 and scale == 2:
                        page.screenshot(path=str(out / f'account-{form}-{locale}-320-2x.png'), full_page=True)
                    results.append({'locale': locale, 'width': width, 'form': form, 'textScale': scale, 'horizontalOverflow': False})
                context.close()
    browser.close()
(out / 'firebase-layout-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': len(results)}))
