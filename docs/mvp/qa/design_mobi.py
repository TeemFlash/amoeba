"""Exercise the refreshed screen layouts in RU/KZ at 320/390px and 2x text."""
import json
import os
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

out = Path(os.environ.get('QA_OUTPUT_DIR', 'qa-results'))
out.mkdir(parents=True, exist_ok=True)
results = []
errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('DEMO_URL', 'http://localhost:8083'))
    expect(page.get_by_text('Mobi', exact=True)).to_be_visible()

    def button(name):
        return page.get_by_role('button', name=name, exact=True)

    def click(name):
        button(name).click()

    def tab(name):
        page.get_by_role('tab', name=name, exact=True).click()

    def selected(index=0):
        page.get_by_role('button', name=re.compile('^Выбрать')).nth(index).click()

    def inspect(name, boot=False):
        for language, switch in [('ru', 'Русский'), ('kz', 'Қазақша')]:
            click(switch)
            expect(button(switch)).to_have_attribute('aria-pressed', 'true')
            if not boot:
                page.wait_for_function('(locale) => JSON.parse(localStorage.getItem("enactus-senior-demo:v1")).locale === locale', arg=language)
            for width in [320, 390]:
                page.set_viewport_size({'width': width, 'height': 844})
                for scale in [1, 2]:
                    if scale == 2:
                        page.evaluate('''() => document.querySelectorAll('[dir="auto"]').forEach(e => {
                            const s = getComputedStyle(e);
                            e.dataset.qaStyle = e.getAttribute('style') || '';
                            e.style.fontSize = parseFloat(s.fontSize) * 2 + 'px';
                            if(s.lineHeight !== 'normal') e.style.lineHeight = parseFloat(s.lineHeight) * 2 + 'px';
                        })''')
                    layout = page.evaluate('''() => ({
                        document: document.documentElement.scrollWidth,
                        outside: [...document.querySelectorAll('[dir="auto"], [role="button"], [role="radio"], [role="tab"]')]
                            .filter(e => {const r=e.getBoundingClientRect(); return r.width && (r.right>innerWidth+1 || r.left< -1 || e.scrollWidth>e.clientWidth+1)})
                            .map(e => ({text:e.textContent, width:e.clientWidth, scroll:e.scrollWidth})),
                        smallTargets: [...document.querySelectorAll('[role="button"], [role="radio"], [role="tab"]')]
                            .filter(e => e.getBoundingClientRect().height < 55)
                            .map(e => e.getAttribute('aria-label') || e.textContent)
                    })''')
                    result = {'screen': name, 'locale': language, 'width': width, 'scale': scale, **layout}
                    split_words = page.evaluate('''() => {
                        const broken=[];
                        document.querySelectorAll('[role="tab"]').forEach(tab => {
                            const walker=document.createTreeWalker(tab,NodeFilter.SHOW_TEXT);
                            let node;
                            while(node=walker.nextNode()) for(const match of node.textContent.matchAll(/\\S+/g)) {
                                const range=document.createRange();
                                range.setStart(node,match.index); range.setEnd(node,match.index+match[0].length);
                                const rows=new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top)));
                                if(rows.size>1) broken.push(match[0]);
                            }
                        }); return broken;
                    }''')
                    result['splitNavigationWords'] = split_words
                    results.append(result)
                    (out / 'design-results.json').write_text(json.dumps({'checks': results, 'pageErrors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
                    assert layout['document'] <= width and not layout['outside'] and not layout['smallTargets'] and not split_words, result
                    if width == 390 and scale == 1 and language == 'ru':
                        page.get_by_text('Mobi', exact=True).scroll_into_view_if_needed()
                        page.screenshot(path=str(out / f'design-{name}.png'), full_page=True)
                    if scale == 2:
                        page.evaluate('''() => document.querySelectorAll('[data-qa-style]').forEach(e => {
                            e.setAttribute('style', e.dataset.qaStyle); delete e.dataset.qaStyle;
                        })''')
        page.set_viewport_size({'width': 390, 'height': 844})
        click('Русский')
        if not boot:
            page.wait_for_function('() => JSON.parse(localStorage.getItem("enactus-senior-demo:v1")).locale === "ru"')

    inspect('home')
    tab('Мои обращения'); inspect('empty-history')
    tab('Главная'); click('Бытовая помощь'); inspect('help-catalog')
    selected(); inspect('help-terms')
    click('Далее'); expect(page.get_by_role('heading', name='Район и время', exact=True)).to_be_visible(); inspect('help-form')
    page.get_by_role('radio', name='Демонстрационный центр', exact=True).click()
    page.get_by_role('radio', name='Учебный пример: утром', exact=True).click()
    click('Далее'); inspect('help-review')
    click('Сохранить в демо'); expect(button('Отменить в демо')).to_be_visible(); inspect('saved-entry')
    click('Отменить в демо'); inspect('cancel-confirm')
    click('Отменить в демо'); expect(button('Отменить в демо')).to_have_count(0); inspect('cancelled-entry')
    tab('Мои обращения'); inspect('history')
    tab('Главная'); click('Встречи'); inspect('events')
    selected(1); inspect('event-full'); click('Назад')
    selected(2); inspect('event-cancelled'); click('Назад')
    selected(); inspect('event-terms'); click('Далее'); inspect('event-review')
    tab('Об приложении'); inspect('about'); click('Сбросить данные демо')
    expect(page.get_by_role('tab', name='Об приложении', exact=True)).to_have_attribute('aria-selected', 'true')
    inspect('reset-confirm')
    page.evaluate('() => localStorage.setItem("enactus-senior-demo:v1", "{broken")'); page.reload()
    expect(page.get_by_text('Данные демо не распознаны', exact=True)).to_be_visible(); inspect('corrupt-storage', boot=True)
    click('Сбросить данные демо')
    expect(page.get_by_role('heading', name='Сбросить данные на этом устройстве?', exact=True)).to_be_visible()
    inspect('corrupt-reset', boot=True)
    assert not errors, errors
    print(json.dumps({'layoutChecks': len(results), 'screens': len(set(r['screen'] for r in results)), 'pageErrors': errors}))
    browser.close()
