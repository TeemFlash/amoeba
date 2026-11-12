"""Check Mobi's exported identity, retained storage, and basic keyboard access."""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

out = Path(os.environ.get('QA_OUTPUT_DIR', 'qa-results'))
out.mkdir(parents=True, exist_ok=True)
key = 'enactus-senior-demo:v1'
legacy = {
    'schemaVersion': 1, 'locale': 'ru', 'entries': [],
    'draft': {'operationId': 'before-mobi-rename', 'serviceId': 'groceries',
              'districtId': 'demo-center', 'slotId': 'demo-morning', 'step': 'review'},
}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.goto(os.environ.get('DEMO_URL', 'http://localhost:8083'))
    expect(page).to_have_title('Mobi')
    expect(page.get_by_text('Mobi', exact=True)).to_be_visible()
    page.keyboard.press('Tab')
    focus = page.evaluate('''() => {
        const e = document.activeElement, s = getComputedStyle(e);
        return {role: e.getAttribute('role'), label: e.getAttribute('aria-label'),
                outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth};
    }''')
    assert focus['role'] == 'button', focus
    assert focus['outlineStyle'] != 'none' and focus['outlineWidth'] != '0px', focus
    page.keyboard.press('Enter')
    page.evaluate('([k,s]) => localStorage.setItem(k,JSON.stringify(s))', [key, legacy])
    page.reload()
    page.get_by_role('button', name='Продолжить черновик', exact=True).click()
    expect(page.get_by_role('button', name='Сохранить в демо', exact=True)).to_be_visible()
    page.get_by_role('button', name='Қазақша', exact=True).click()
    expect(page.get_by_text('Mobi', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Демода сақтау', exact=True)).to_be_visible()
    page.wait_for_function('(k) => JSON.parse(localStorage.getItem(k)).locale === "kz"', arg=key)
    saved = page.evaluate('(k) => JSON.parse(localStorage.getItem(k))', key)
    assert saved['draft'] == legacy['draft']
    page.screenshot(path=str(out / 'mobi-kz-review.png'), full_page=True)
    result = {'title': page.title(), 'ruAndKzName': 'Mobi', 'legacyDraftPreserved': True,
              'keyboardFocus': focus, 'browser': browser.version}
    (out / 'branding-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    browser.close()
