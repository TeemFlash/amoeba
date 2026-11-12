"""Capture the implemented production web UI, with no account creation or remote writes."""
import json
import math
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from mobi_ui_probe import definitions, ROOT

out=ROOT/'artifacts'/'mobi-screenshots'
out.mkdir(parents=True,exist_ok=True)
defs=definitions(); locale='ru'; shots=[]
with sync_playwright() as p:
 browser=p.chromium.launch()
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 def button(k):return page.get_by_role('button',name=defs['labels'][locale][k],exact=True)
 def click(k):button(k).click()
 def tab(k):page.get_by_role('tab',name=defs['labels'][locale][k],exact=True).click()
 def shot(name,label,bottom=False):
  page.wait_for_function('()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
  page.evaluate('(bottom)=>document.querySelectorAll("*").forEach(e=>{if(e.scrollHeight>e.clientHeight&&["auto","scroll"].includes(getComputedStyle(e).overflowY))e.scrollTop=bottom?e.scrollHeight:0;})',bottom)
  page.wait_for_timeout(120)
  page.screenshot(path=str(out/(name+'.png')))
  shots.append({'file':name+'.png','label':label,'width':390,'height':844})
  print(name,flush=True)
 try:
  page.goto('http://127.0.0.1:8093')
  expect(button('welcomeStart')).to_be_visible();shot('01-welcome-ru','Welcome / language')
  click('welcomeStart');expect(button('signIn')).to_be_visible();shot('02-sign-in-ru','Sign in')
  click('continueAsGuest');shot('03-home-ru','Home / Russian')
  click('languageKz');locale='kz';shot('04-home-kz','Home / Kazakh')
  click('languageRu');locale='ru';click('helpPath');shot('05-assistance-ru','Assistance categories')
  service=next(s for s in defs['catalog']['services'] if s['id']=='home-help')
  page.get_by_role('button',name=defs['labels'][locale]['choosePrefix']+' '+service['title'][locale],exact=True).click()
  shot('06-help-detail-ru','Help details');click('next');shot('07-district-ru','Choose a district')
  page.get_by_role('radio',name=defs['labels'][locale]['districtEsil'],exact=True).click();shot('08-date-ru','Choose a date')
  page.get_by_role('radio',name=defs['labels'][locale]['dateNov12'],exact=True).click();shot('09-time-ru','Choose a time')
  page.get_by_role('radio',name=defs['labels'][locale]['slot10to12'],exact=True).click();shot('10-note-ru','Optional note')
  click('next');expect(button('saveDemo')).to_be_visible();shot('11-review-ru','Review / Russian');shot('12-review-ru-lower','Review / lower section',True)
  click('languageKz');locale='kz';shot('13-review-kz','Review / Kazakh');shot('14-review-kz-lower','Review / lower section',True)
  page.reload();click('continueAsGuest');shot('15-home-draft-kz','Home / saved draft',True)
  tab('tabActivities');shot('16-activities-kz','Social activities')
  tab('tabProfile');shot('17-profile-kz','Profile and settings');shot('18-profile-kz-lower','Text-size settings',True)
  # Compose an HTML gallery from unaltered screenshot files.
  featured=['01-welcome-ru','02-sign-in-ru','03-home-ru','04-home-kz','05-assistance-ru','11-review-ru','13-review-kz','16-activities-kz']
  selected=[s for name in featured for s in shots if s['file']==name+'.png']
  cards=''.join(f'<article><h2>{s["label"]}</h2><img src="{s["file"]}" width="390" height="844"></article>' for s in selected)
  html='''<!doctype html><meta charset="utf-8"><title>Mobi — implemented UI</title><style>*{box-sizing:border-box}body{margin:0;padding:44px;background:#dceafa;color:#1f2a44;font:18px Arial,sans-serif}h1{font-size:42px;margin:0 0 10px}p{margin:0 0 32px;color:#465873}main{display:grid;grid-template-columns:repeat(4,390px);gap:32px}h2{font-size:20px;margin:0 0 12px}img{display:block;border-radius:24px;box-shadow:0 7px 20px #1f2a4415}article{width:390px}</style><h1>Mobi</h1><p>Implemented app · 390 × 844 browser preview · Russian & Kazakh</p><main>'''+cards+'</main>'
  (out/'gallery.html').write_text(html,encoding='utf-8')
  gallery=browser.new_page(viewport={'width':1744,'height':1200},device_scale_factor=1)
  gallery.goto((out/'gallery.html').as_uri());gallery.wait_for_function('()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
  gallery.screenshot(path=str(out/'mobi-screenshots.png'),full_page=True)
  gallery.locator('body > p').evaluate('(e)=>e.textContent="Everyday help & social activities | Demo | Russian & Kazakh"')
  gallery.screenshot(path=str(out/'Mobi-preview.jpg'),type='jpeg',quality=92,full_page=True)
  (out/'manifest.json').write_text(json.dumps({'source':'Implemented production web UI at localhost:8093; isolated guest browser session; no account or remote record created','shots':shots},ensure_ascii=False,indent=2),encoding='utf-8')
 finally:browser.close()
with zipfile.ZipFile(out/'Mobi-screenshots.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for path in out.iterdir():
  if path.suffix in ['.png','.html','.json']:archive.write(path,path.name)
with zipfile.ZipFile(out/'Mobi-share.zip','w',zipfile.ZIP_DEFLATED) as archive:
 archive.write(out/'Mobi-preview.jpg','Mobi-preview.jpg')
 for shot in shots:archive.write(out/shot['file'],'Screenshots/'+shot['file'])
print(json.dumps({'screenshots':len(shots),'folder':str(out)}))
