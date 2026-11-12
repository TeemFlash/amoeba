"""Focused navbar labels, targets, selection and screenshot checks."""
import json,os
from playwright.sync_api import sync_playwright,expect
from mobi_ui_probe import ROOT,definitions
out=ROOT/'artifacts'/'mobi-navbar';out.mkdir(parents=True,exist_ok=True)
defs=definitions();results=[];errors=[]
url=os.environ.get('DEMO_URL','http://127.0.0.1:8094')
with sync_playwright() as p:
 browser=p.chromium.launch()
 try:
  for locale in ['ru','kz']:
   labels=defs['labels'][locale]
   for width in [390,360,320]:
    for size in ['standard','large']:
     context=browser.new_context(viewport={'width':width,'height':844})
     data={'enactus-senior-demo:v1':{'schemaVersion':1,'locale':locale,'draft':None,'entries':[]},'mobi-preferences:v1':{'version':1,'welcomeCompleted':True,'textSize':size}}
     context.add_init_script(f'for(const[k,v]of Object.entries({json.dumps(data)}))localStorage.setItem(k,JSON.stringify(v));')
     page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url)
     expect(page.get_by_role('tab',name=labels['tabHome'],exact=True)).to_be_visible()
     for key in ['tabHome','tabActivities','tabEntries','tabProfile']:
      target=page.get_by_role('tab',name=labels[key],exact=True);target.click();expect(target).to_have_attribute('aria-selected','true')
      metrics=page.get_by_role('tab').evaluate_all('''els=>els.map(e=>{
       const text=[...e.querySelectorAll('[dir="auto"]')].at(-1);const s=getComputedStyle(text);const r=text.getBoundingClientRect();const box=e.getBoundingClientRect();const range=document.createRange();range.selectNodeContents(text);const ink=range.getBoundingClientRect();
       return {name:e.getAttribute('aria-label'),text:text.textContent,height:box.height,labelHeight:r.height,lineHeight:parseFloat(s.lineHeight),fontSize:parseFloat(s.fontSize),inkWidth:ink.width,available:r.width,left:box.left,right:box.right,top:box.top};
      })''')
      for item in metrics:
       assert item['height']>=56,(locale,width,size,item)
       assert item['fontSize']>=18,(locale,width,size,item)
       assert item['labelHeight']<=item['lineHeight']+1,(locale,width,size,'multiline',item)
       assert item['inkWidth']<=item['available']+1,(locale,width,size,'clipped',item)
       assert item['left']>=-1 and item['right']<=width+1,(locale,width,size,'overflow',item)
      if width==390 and size=='standard':assert len({round(m['top']) for m in metrics})==1,'390 standard must use one row'
      results.append({'locale':locale,'width':width,'size':size,'selected':key,'tabs':metrics})
      if width==390 and size=='standard':page.get_by_role('tablist').screenshot(path=str(out/f'navbar-{locale}-{key}.png'))
     page.get_by_role('tab',name=labels['tabHome'],exact=True).click()
     page.wait_for_function('()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
     page.screenshot(path=str(out/f'home-{locale}-{width}-{size}.png'))
     context.close()
  assert not errors,errors
  print(json.dumps({'passed':len(results),'errors':errors}))
 except Exception:
  page.screenshot(path=str(out/'failure.png'));raise
 finally:
  (out/'verification.json').write_text(json.dumps({'cases':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
