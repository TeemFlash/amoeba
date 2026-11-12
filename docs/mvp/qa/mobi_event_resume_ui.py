"""Home event-draft continuation and ordinary sign-in exit, emulator only."""
import json,secrets,time
from urllib.request import Request,urlopen
from playwright.sync_api import sync_playwright,expect
from mobi_ui_probe import OUT,definitions
labels=definitions()['labels']['ru'];checks=[]
email=f'mobi-event-{time.time_ns()}@example.test';password='QA-'+secrets.token_urlsafe(18)+'7!'
request=Request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-api-key',data=json.dumps({'email':email,'password':password,'returnSecureToken':True}).encode(),headers={'Content-Type':'application/json'})
with urlopen(request) as r:uid=json.load(r)['localId']
with sync_playwright() as p:
 browser=p.chromium.launch()
 try:
  for mode in ['guest','account','signin-empty']:
   context=browser.new_context(viewport={'width':390,'height':844})
   draft={'kind':'event','eventId':'tea','operationId':'qa-event-resume'}
   data={'mobi-preferences:v1':{'version':1,'welcomeCompleted':True,'textSize':'standard'},'enactus-senior-demo:v1':{'schemaVersion':1,'locale':'ru','draft':None,'entries':[]}}
   key='mobi-guest:v1' if mode=='guest' else f'mobi-account:v1:{uid}:draft'
   if mode!='signin-empty':data[key]=draft if mode=='guest' else {**draft,'uid':uid}
   context.add_init_script(f'for(const[k,v]of Object.entries({json.dumps(data)}))if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify(v));')
   page=context.new_page();page.goto('http://127.0.0.1:8092')
   def button(k):return page.get_by_role('button',name=labels[k],exact=True)
   if mode=='guest':button('continueAsGuest').click()
   else:
    page.get_by_role('textbox',name=labels['emailLabel'],exact=True).fill(email)
    page.get_by_label(labels['passwordLabel'],exact=True).fill(password);button('signIn').click()
    expect(button('logout')).to_be_visible();button('back').click()
   expect(page.get_by_role('tab',name=labels['tabHome'],exact=True)).to_be_visible()
   if mode=='signin-empty':checks.append('ordinary sign-in without draft can leave account for Home')
   else:
    button('continueDraft').click();expect(button('eventReviewAction')).to_be_visible()
    assert page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).operationId',key)==draft['operationId']
    checks.append(mode+' event Home continuation keeps operation ID and reaches review')
    assert page.evaluate('()=>JSON.parse(localStorage.getItem("enactus-senior-demo:v1")).entries.length')==0
    button('back').click();expect(button('continueDraft')).to_be_visible()
    checks.append(mode+' event draft remains resumable after Back without automatic save')
   context.close()
  print(json.dumps({'checks':checks}))
 finally:
  (OUT/'event-resume-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8');browser.close()
