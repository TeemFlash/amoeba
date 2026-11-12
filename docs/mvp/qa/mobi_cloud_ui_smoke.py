"""Actual guest/account UI smoke, restricted to the local emulator preview."""
import json
import re
import secrets
import time
from playwright.sync_api import expect, sync_playwright
from mobi_ui_probe import definitions, layout, OUT

URL = 'http://127.0.0.1:8092'
defs = definitions()
labels = defs['labels']['ru']
checks, errors, layouts = [], [], []
email = f'mobi-ui-{time.time_ns()}@example.test'
password = 'QA-' + secrets.token_urlsafe(18) + '7!'

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width':390, 'height':844})
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    def button(k): return page.get_by_role('button', name=labels[k], exact=True)
    def click(k): button(k).click()
    def tab(k): page.get_by_role('tab', name=labels[k], exact=True).click()
    def choose(k): page.get_by_role('radio', name=labels[k], exact=True).click()
    def record(k, condition=True):
        assert condition, k
        checks.append(k)
    def storage(k): return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))', k)
    def snapshot(k):
        page.screenshot(path=str(OUT / f'cloud-{k}.png'))
        layouts.append({'screen':k, **layout(page)})
    def fill_account(register=False):
        if register: click('createAccountPrompt')
        page.get_by_role('textbox', name=labels['emailLabel'], exact=True).fill(email)
        page.get_by_label(labels['passwordLabel'], exact=True).fill(password)
        if register: page.get_by_label(labels['passwordAgainLabel'], exact=True).fill(password)
        click('register' if register else 'signIn')
    try:
        page.goto(URL)
        click('welcomeStart')
        expect(button('signIn')).to_be_visible()
        snapshot('auth')
        click('continueAsGuest')
        click('helpPath')
        service=next(x for x in defs['catalog']['services'] if x['id']=='home-help')
        page.get_by_role('button', name=f"{labels['choosePrefix']} {service['title']['ru']}",exact=True).click()
        click('next')
        choose('districtEsil'); choose('dateNov12'); choose('slot10to12')
        page.get_by_role('textbox',name=labels['noteTitle'],exact=True).fill('Guest note preserved')
        click('next')
        expect(button('saveDemo')).to_be_visible()
        guest=storage('mobi-guest:v1')
        record('guest reaches review with persisted date and note', guest['dateId']=='demo-nov12' and guest['note']=='Guest note preserved')
        click('saveDemo')
        expect(button('signIn')).to_be_visible()
        record('guest save opens authentication without completed local entry',len(storage('enactus-senior-demo:v1')['entries'])==0)
        fill_account(register=True)
        expect(button('saveDemo')).to_be_visible()
        record('registration returns to review without automatic save', storage('mobi-guest:v1') is None)
        account_drafts=page.evaluate('()=>Object.keys(localStorage).filter(k=>k.startsWith("mobi-account:v1:")&&k.endsWith(":draft")).map(k=>JSON.parse(localStorage.getItem(k)))')
        record('guest handoff preserves every help selection and operation ID', len(account_drafts)==1 and all(account_drafts[0][k]==guest[k] for k in ['operationId','serviceId','districtId','dateId','slotId','note']))
        snapshot('review-after-auth')
        for edit, choice, field, value in [('editDistrict','districtAlmaty','districtId','astana-almaty'),('editDate','dateNov14','dateId','demo-nov14'),('editTime','slot14to16','slotId','demo-14-16')]:
            click(edit); choose(choice)
            expect(button('saveDemo')).to_be_visible()
            current=page.evaluate('()=>Object.keys(localStorage).filter(k=>k.startsWith("mobi-account:v1:")&&k.endsWith(":draft")).map(k=>JSON.parse(localStorage.getItem(k)))[0]')
            record('signed-in '+edit+' persists after sequential step transition',current[field]==value and current['note']==guest['note'] and current['operationId']==guest['operationId'])
        click('editNote')
        page.get_by_role('textbox',name=labels['noteTitle'],exact=True).fill('Account edited note')
        click('next');expect(button('saveDemo')).to_be_visible()
        page.wait_for_timeout(500)
        current=page.evaluate('()=>Object.keys(localStorage).filter(k=>k.startsWith("mobi-account:v1:")&&k.endsWith(":draft")).map(k=>JSON.parse(localStorage.getItem(k)))[0]')
        record('signed-in note edit preserves latest value through immediate Next',current['note']=='Account edited note')
        click('editNote');click('noteSkip');expect(button('saveDemo')).to_be_visible()
        page.wait_for_timeout(500)
        current=page.evaluate('()=>Object.keys(localStorage).filter(k=>k.startsWith("mobi-account:v1:")&&k.endsWith(":draft")).map(k=>JSON.parse(localStorage.getItem(k)))[0]')
        record('signed-in Skip clears note without delayed restoration',current['note']=='')
        click('editNote');page.get_by_role('textbox',name=labels['noteTitle'],exact=True).fill('Account edited note');click('next')
        expect(button('saveDemo')).to_be_visible()
        click('saveDemo')
        expect(button('openEntry')).to_be_visible()
        click('openEntry')
        expect(page.get_by_text('Account edited note',exact=True)).to_be_visible()
        record('cloud save and detail preserve date and note')
        click('tabEntries')
        page.reload()
        tab('tabEntries')
        opens=page.get_by_role('button',name=re.compile('^'+re.escape(labels['openEntryPrefix'])))
        expect(opens).to_have_count(1)
        record('account history survives reload')
        opens.first.click()
        click('accountCancelEntry'); click('keep')
        expect(button('accountCancelEntry')).to_be_visible()
        click('accountCancelEntry'); click('accountCancelNow')
        expect(page.get_by_text(labels['entryStatusCancelled'],exact=True).first).to_be_visible()
        record('account cancellation requires confirmation and retains history')
        click('tabEntries'); tab('tabProfile'); click('logout')
        expect(button('signIn')).to_be_visible()
        record('logout returns to authentication')
        click('continueAsGuest'); tab('tabEntries')
        expect(opens).to_have_count(0)
        record('signed-out guest cannot see prior account history')
        snapshot('signed-out-history')
        record('no browser runtime errors',not errors)
        print(json.dumps({'checks':checks,'errors':errors,'layouts':layouts},ensure_ascii=False))
    except Exception as error:
        snapshot('failure')
        (OUT/'cloud-failure.txt').write_text(page.locator('body').inner_text().replace(email,'<synthetic-email>'),encoding='utf-8')
        print(json.dumps({'failed':str(error),'checks':checks,'errors':errors},ensure_ascii=False))
        raise
    finally:
        (OUT/'cloud-ui-results.json').write_text(json.dumps({'checks':checks,'errors':errors,'layouts':layouts},ensure_ascii=False,indent=2),encoding='utf-8')
        browser.close()
