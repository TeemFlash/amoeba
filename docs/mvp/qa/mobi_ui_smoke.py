"""Functional UI checks for the implemented Mobi app in isolated browser storage."""
import json
import os
import re

from playwright.sync_api import expect, sync_playwright
from mobi_ui_probe import OUT, URL, definitions, layout

defs = definitions()
locale = 'ru'
checks, errors, layouts = [], [], []
KEY = 'enactus-senior-demo:v1'


def tr(key):
    return defs['labels'][locale][key]


with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width': 390, 'height': 844})
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(15000)

    def button(key): return page.get_by_role('button', name=tr(key), exact=True)
    def click(key): button(key).click()
    def tab(key): page.get_by_role('tab', name=tr(key), exact=True).click()
    def record(name, condition=True):
        assert condition, name
        checks.append(name)
    def snapshot(name):
        result = layout(page)
        layouts.append({'screen': name, **result})
        page.screenshot(path=str(OUT / f'{name}.png'))
    def local_state(): return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))', KEY)
    def open_help():
        click('helpPath')
        service = next(x for x in defs['catalog']['services'] if x['id'] == 'home-help')
        page.get_by_role('button', name=f"{tr('choosePrefix')} {service['title'][locale]}", exact=True).click()
        click('next')
    def choose(key): page.get_by_role('radio', name=tr(key), exact=True).click()

    try:
        page.goto(URL)
        expect(button('welcomeStart')).to_be_visible()
        snapshot('welcome-ru')
        click('welcomeStart')
        expect(page.get_by_role('tab', name=tr('tabHome'), exact=True)).to_be_visible()
        record('first launch welcome completes and opens local demo')
        snapshot('home-ru')
        open_help()
        choose('districtEsil')
        choose('dateNov12')
        choose('slot10to12')
        note = page.get_by_role('textbox', name=tr('noteTitle'), exact=True)
        expect(note).to_be_visible()
        note.fill('Помочь разобрать книги')
        # The note must persist without pressing Next.
        page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k))?.draft?.note === "Помочь разобрать книги"', arg=KEY)
        record('typed note persists before Next')
        click('next')
        expect(button('saveDemo')).to_be_visible()
        record('separate district/date/time/note steps reach review')
        snapshot('review-ru')
        original = local_state()['draft']
        click('editDate')
        choose('dateNov14')
        expect(button('saveDemo')).to_be_visible()
        changed = local_state()['draft']
        record('editing date returns to review and preserves all other choices', changed['dateId'] == 'demo-nov14' and all(changed[k] == original[k] for k in ['operationId', 'serviceId', 'districtId', 'slotId', 'note']))
        for edit, choice, field, value in [('editDistrict', 'districtAlmaty', 'districtId', 'astana-almaty'), ('editTime', 'slot14to16', 'slotId', 'demo-14-16')]:
            before = local_state()['draft']
            click(edit)
            choose(choice)
            expect(button('saveDemo')).to_be_visible()
            after = local_state()['draft']
            record(edit + ' returns to review preserving other fields', after[field] == value and all(after[k] == before[k] for k in ['operationId', 'serviceId', 'districtId', 'dateId', 'slotId', 'note'] if k != field))
        click('editCategory')
        service = next(x for x in defs['catalog']['services'] if x['id'] == 'groceries')
        page.get_by_role('button', name=f"{tr('choosePrefix')} {service['title'][locale]}", exact=True).click()
        expect(button('saveDemo')).to_be_visible()
        record('category edit preserves operation ID', local_state()['draft']['operationId'] == original['operationId'])
        click('editNote')
        page.get_by_role('textbox', name=tr('noteTitle'), exact=True).fill('Updated note')
        click('next')
        expect(button('saveDemo')).to_be_visible()
        original = local_state()['draft']
        record('note edit returns to review', original['note'] == 'Updated note')
        page.get_by_role('button', name=tr('languageKz'), exact=True).click()
        locale = 'kz'
        expect(button('saveDemo')).to_be_visible()
        record('review language switch preserves selected data', local_state()['draft']['note'] == original['note'])
        snapshot('review-kz')
        page.reload()
        expect(page.get_by_role('tab', name=tr('tabHome'), exact=True)).to_be_visible()
        click('continueDraft')
        expect(button('saveDemo')).to_be_visible()
        record('draft reload and resume returns to complete review')
        click('saveDemo')
        page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k))?.entries?.length === 1', arg=KEY)
        record('local help save persists exactly one extended entry', local_state()['entries'][0]['dateId'] == 'demo-nov14' and local_state()['entries'][0]['note'] == original['note'])
        snapshot('success-kz')
        click('openEntry')
        click('cancelEntry')
        snapshot('cancel-confirm-kz')
        click('keep')
        record('Keep leaves request active', local_state()['entries'][0]['status'] == 'saved-demo')
        click('cancelEntry')
        click('cancelNow')
        page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).entries[0].status === "cancelled-demo"', arg=KEY)
        record('explicit cancellation retains request and selections', local_state()['entries'][0]['note'] == original['note'])
        click('tabEntries')
        tab('tabActivities')
        for event_id, reason in [('walk-full', 'eventFullReason'), ('games-cancelled', 'eventCancelledReason')]:
            event = next(x for x in defs['catalog']['events'] if x['availability'] == ('full' if event_id == 'walk-full' else 'cancelled'))
            page.get_by_role('button', name=f"{tr('choosePrefix')} {event['title'][locale]}", exact=True).click()
            expect(button(reason)).to_be_disabled()
            record(event['availability'] + ' activity cannot be booked')
            click('back')
        event = next(x for x in defs['catalog']['events'] if x['id'] == 'tea')
        page.get_by_role('button', name=f"{tr('choosePrefix')} {event['title'][locale]}", exact=True).click()
        click('eventSave')
        expect(button('eventContinueToReview')).to_be_visible()
        record('event confirm does not save', len(local_state()['entries']) == 1)
        click('eventContinueToReview')
        record('event review does not auto-save', len(local_state()['entries']) == 1)
        snapshot('event-review-kz')
        # Inject a reversible local write failure; keep original selections for retry.
        page.evaluate('''() => { window.qaSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v) { if(k==='enactus-senior-demo:v1' && JSON.parse(v).entries.length>1) throw new Error('QA write failure'); return window.qaSetItem.call(this,k,v); }; }''')
        click('eventReviewAction')
        expect(page.get_by_role('alert').first).to_be_visible()
        record('failed save preserves history and review', len(local_state()['entries']) == 1)
        snapshot('save-error-kz')
        page.evaluate('() => {Storage.prototype.setItem=window.qaSetItem;}')
        click('retry')
        expect(button('openEntry')).to_be_visible()
        record('retry saves one event', len(local_state()['entries']) == 2)
        click('tabHome')
        tab('tabEntries')
        choose('requestsFilterHelp')
        expect(page.get_by_role('button', name=re.compile('^' + re.escape(tr('openEntryPrefix'))))).to_have_count(1)
        choose('requestsFilterEvents')
        expect(page.get_by_role('button', name=re.compile('^' + re.escape(tr('openEntryPrefix'))))).to_have_count(1)
        choose('requestsFilterAll')
        expect(page.get_by_role('button', name=re.compile('^' + re.escape(tr('openEntryPrefix'))))).to_have_count(2)
        record('request filters include cancelled assistance and active event')
        tab('tabProfile')
        choose('textSizeLarge')
        page.wait_for_function('()=>JSON.parse(localStorage.getItem("mobi-preferences:v1"))?.textSize === "large"')
        snapshot('profile-large-kz')
        page.reload()
        tab('tabProfile')
        expect(page.get_by_role('radio', name=tr('textSizeLarge'), exact=True)).to_have_attribute('aria-checked', 'true')
        record('large text preference survives reload')
        page.set_viewport_size({'width': 320, 'height': 844})
        snapshot('profile-large-320-kz')
        tab('tabHome')
        snapshot('home-large-320-kz')
        record('no browser runtime errors', not errors)
        print(json.dumps({'checks': checks, 'errors': errors, 'layouts': layouts}, ensure_ascii=False))
    except Exception as error:
        page.screenshot(path=str(OUT / 'smoke-failure.png'))
        (OUT / 'smoke-failure.txt').write_text(page.locator('body').inner_text(), encoding='utf-8')
        print(json.dumps({'failed': str(error), 'checks': checks, 'errors': errors}, ensure_ascii=False))
        raise
    finally:
        (OUT / 'ui-smoke-results.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'layouts': layouts}, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()
