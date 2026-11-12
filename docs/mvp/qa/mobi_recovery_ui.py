"""Storage recovery and immediate navigation checks in isolated local browser contexts."""
import json
from playwright.sync_api import expect, sync_playwright
from mobi_ui_probe import definitions, OUT

labels=definitions()['labels']['ru']
KEY='enactus-senior-demo:v1'
PREF='mobi-preferences:v1'
draft={'operationId':'qa-immediate-note','serviceId':'groceries','districtId':'astana-esil','dateId':'demo-nov12','slotId':'demo-10-12','note':'old','step':'form','formStep':'note'}
state={'schemaVersion':1,'locale':'ru','draft':draft,'entries':[]}
pref={'version':1,'welcomeCompleted':True,'textSize':'standard'}
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    def fresh(seed=True, injection=''):
        ctx=browser.new_context(viewport={'width':390,'height':844})
        if seed: ctx.add_init_script(f'if(!localStorage.getItem({json.dumps(KEY)})){{localStorage.setItem({json.dumps(KEY)}, {json.dumps(json.dumps(state))});localStorage.setItem({json.dumps(PREF)}, {json.dumps(json.dumps(pref))});}}')
        if injection: ctx.add_init_script(injection)
        page=ctx.new_page(); page.set_default_timeout(12000); page.goto('http://127.0.0.1:8091')
        return ctx,page
    def button(page,key): return page.get_by_role('button',name=labels[key],exact=True)
    def record(name,condition=True):
        assert condition,name
        checks.append(name)
    try:
        ctx,page=fresh()
        button(page,'continueDraft').click()
        note=page.get_by_role('textbox',name=labels['noteTitle'],exact=True)
        expect(note).to_have_value('old')
        note.fill('Immediate back retained')
        button(page,'back').click()
        button(page,'continueDraft').click()
        expect(note).to_have_value('Immediate back retained')
        page.reload(); button(page,'continueDraft').click()
        expect(note).to_have_value('Immediate back retained')
        record('immediate Back and reload preserve latest typed note')
        note.fill('This note must be skipped')
        button(page,'noteSkip').click()
        expect(button(page,'saveDemo')).to_be_visible()
        page.wait_for_timeout(750)
        record('Skip clears note and no delayed write restores it',page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).draft.note',KEY)=='')
        button(page,'editNote').click()
        note.fill('Immediate language retained')
        button(page,'languageKz').click()
        page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k))?.draft?.note==="Immediate language retained"',arg=KEY)
        record('immediate language switch preserves latest note')
        ctx.close()
        # A one-shot read failure must recover all three stores, not remain loading.
        injection='''window.qaReadFailed=false; const originalGet=Storage.prototype.getItem; Storage.prototype.getItem=function(k){if(k==='mobi-preferences:v1'&&!window.qaReadFailed){window.qaReadFailed=true;throw new Error('QA read failure');}return originalGet.call(this,k);};'''
        ctx,page=fresh(injection=injection)
        button(page,'retry').click()
        expect(page.get_by_role('tab',name=labels['tabHome'],exact=True)).to_be_visible()
        record('preferences read failure Retry finishes boot without reset')
        ctx.close()
        ctx,page=fresh()
        page.get_by_role('tab',name=labels['tabProfile'],exact=True).click()
        page.evaluate('''()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mobi-preferences:v1')throw new Error('QA write failure');return window.originalSet.call(this,k,v);};}''')
        page.get_by_role('radio',name=labels['textSizeLarge'],exact=True).click()
        expect(page.get_by_role('alert').first).to_be_visible()
        record('preference write failure is visible and keeps accepted value',page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).textSize',PREF)=='standard')
        page.evaluate('()=>{Storage.prototype.setItem=window.originalSet;}')
        button(page,'retry').click()
        expect(page.get_by_role('alert')).to_have_count(0)
        page.get_by_role('radio',name=labels['textSizeLarge'],exact=True).click()
        page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).textSize==="large"',arg=PREF)
        record('preference failure recovers and later choice saves')
        ctx.close()
        ctx,page=fresh(seed=False,injection='''if(!sessionStorage.getItem('qaSeeded')){localStorage.setItem('enactus-senior-demo:v1','{broken');sessionStorage.setItem('qaSeeded','yes');}''')
        button(page,'resetDemo').click()
        expect(button(page,'keep')).to_be_visible()
        button(page,'resetDemo').click()
        expect(button(page,'welcomeStart')).to_be_visible()
        record('confirmed reset of corrupt app data finishes boot at welcome')
        ctx.close()
        print(json.dumps({'checks':checks}))
    except Exception as e:
        page.screenshot(path=str(OUT/'recovery-failure.png'))
        (OUT/'recovery-failure.txt').write_text(page.locator('body').inner_text(),encoding='utf-8')
        print(json.dumps({'failed':str(e),'checks':checks}))
        raise
    finally:
        (OUT/'recovery-ui-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
        browser.close()
