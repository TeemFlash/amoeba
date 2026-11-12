"""Guest transfer conflicts and storage failure recovery against emulator only."""
import json
import secrets
import time
from urllib.request import Request,urlopen
from playwright.sync_api import sync_playwright,expect
from mobi_ui_probe import OUT,definitions

labels=definitions()['labels']['ru']; checks=[]
email=f'mobi-conflict-{time.time_ns()}@example.test'; password='QA-'+secrets.token_urlsafe(18)+'7!'
request=Request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-api-key',data=json.dumps({'email':email,'password':password,'returnSecureToken':True}).encode(),headers={'Content-Type':'application/json'})
with urlopen(request) as r: uid=json.load(r)['localId']
guest={'kind':'help','operationId':'qa-guest-conflict','serviceId':'groceries','districtId':'astana-esil','dateId':'demo-nov12','slotId':'demo-10-12','note':'Latest guest note','step':'review','formStep':'note'}
account={**guest,'uid':uid,'operationId':'qa-existing-account','serviceId':'home-help','note':'Existing account note'}
account_key=f'mobi-account:v1:{uid}:draft'
legacy={'id':'DEMO-legacy-ui','operationId':'legacy-ui','kind':'help','serviceId':'groceries','districtId':'demo-center','slotId':'demo-morning','status':'saved-demo','createdAt':'2026-11-09T10:00:00.000Z','cancelledAt':None}
with sync_playwright() as p:
 browser=p.chromium.launch()
 def button(k):return page.get_by_role('button',name=labels[k],exact=True)
 def click(k):button(k).click()
 def record(name,ok=True):
  assert ok,name
  checks.append(name)
 def read(k):return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',k)
 def start(existing=True):
  ctx=browser.new_context(viewport={'width':390,'height':844})
  data={'mobi-preferences:v1':{'version':1,'welcomeCompleted':True,'textSize':'standard'},'mobi-guest:v1':guest,'enactus-senior-demo:v1':{'schemaVersion':1,'locale':'ru','draft':None,'entries':[legacy]}}
  if existing:data[account_key]=account
  ctx.add_init_script(f'for(const [k,v] of Object.entries({json.dumps(data)})){{if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(v));}}')
  pg=ctx.new_page();pg.set_default_timeout(15000);pg.goto('http://127.0.0.1:8092');return ctx,pg
 def login():
  page.get_by_role('textbox',name=labels['emailLabel'],exact=True).fill(email)
  page.get_by_label(labels['passwordLabel'],exact=True).fill(password)
  click('signIn')
 try:
  for choice,expected in [('guestDraftContinue',account),('guestDraftReplace',guest)]:
   ctx,page=start()
   click('continueAsGuest');click('continueDraft');click('saveDemo');login()
   expect(button(choice)).to_be_visible()
   record(choice+' conflict preserves both drafts before decision',read('mobi-guest:v1')==guest and read(account_key)==account)
   click(choice);expect(button('saveDemo')).to_be_visible()
   selected=read(account_key)
   record(choice+' returns to chosen review without autosave',selected['operationId']==expected['operationId'] and selected['note']==expected['note'] and read('mobi-guest:v1') is None)
   ctx.close()
  ctx,page=start(existing=False)
  click('continueAsGuest');click('continueDraft');click('saveDemo')
  page.evaluate('''()=>{window.origSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('mobi-account:v1:')&&k.endsWith(':draft'))throw new Error('QA transfer write failure');return window.origSet.call(this,k,v);};}''')
  login();expect(button('retry')).to_be_visible()
  record('transfer failure leaves guest source intact',read('mobi-guest:v1')==guest and read(account_key) is None)
  page.evaluate('()=>{Storage.prototype.setItem=window.origSet;}');click('retry')
  expect(button('saveDemo')).to_be_visible()
  record('explicit transfer Retry preserves operation and note',read(account_key)['operationId']==guest['operationId'] and read(account_key)['note']==guest['note'] and read('mobi-guest:v1') is None)
  # Legacy device history remains visible, clearly device-owned, with no account cancel action.
  click('back')
  page.get_by_role('tab',name=labels['tabEntries'],exact=True).click()
  page.get_by_role('button',name=labels['openEntryPrefix']+' '+definitions()['catalog']['services'][0]['title']['ru'],exact=True).click()
  expect(page.get_by_text(labels['accountLocalHistory'],exact=True)).to_be_visible()
  expect(page.get_by_text(labels['entryDateUnspecified'],exact=True)).to_be_visible()
  record('legacy device entry detail has no enabled account cancellation',button('accountCancelEntry').count()==0 or button('accountCancelEntry').is_disabled())
  ctx.close()
  ctx,page=start(existing=False)
  click('continueAsGuest');click('helpPath')
  service=next(s for s in definitions()['catalog']['services'] if s['id']=='home-help')
  page.get_by_role('button',name=labels['choosePrefix']+' '+service['title']['ru'],exact=True).click()
  click('next');expect(button('replaceDraft')).to_be_visible()
  record('choosing another category requires replacement confirmation',read('mobi-guest:v1')==guest)
  page.evaluate('''()=>{window.origSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mobi-guest:v1')throw new Error('QA replacement failure');return window.origSet.call(this,k,v);};}''')
  click('replaceDraft');expect(page.get_by_role('alert').first).to_be_visible()
  record('failed guest replacement preserves original complete draft',read('mobi-guest:v1')==guest)
  page.evaluate('()=>{Storage.prototype.setItem=window.origSet;}');click('replaceDraft')
  expect(page.get_by_role('radio',name=labels['districtEsil'],exact=True)).to_be_visible()
  record('replacement succeeds only after explicit retry',read('mobi-guest:v1')['serviceId']=='home-help' and read('mobi-guest:v1')['operationId']!=guest['operationId'])
  ctx.close()
  print(json.dumps({'checks':checks}))
 except Exception as e:
  page.screenshot(path=str(OUT/'handoff-failure.png'))
  (OUT/'handoff-failure.txt').write_text(page.locator('body').inner_text().replace(email,'<synthetic-email>'),encoding='utf-8')
  print(json.dumps({'failed':str(e),'checks':checks}));raise
 finally:
  (OUT/'handoff-ui-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
  browser.close()
