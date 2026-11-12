"""Header wrapping regression on the real production web preview."""
import json
from playwright.sync_api import sync_playwright,expect
from mobi_ui_probe import ROOT,definitions
out=ROOT/'artifacts'/'mobi-header';out.mkdir(parents=True,exist_ok=True)
labels=definitions()['labels'];results=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch()
 try:
  for locale in ['ru','kz']:
   for size in ['standard','large']:
    context=browser.new_context(viewport={'width':390,'height':844})
    data={'mobi-preferences:v1':{'version':1,'welcomeCompleted':True,'textSize':size},'enactus-senior-demo:v1':{'schemaVersion':1,'locale':locale,'draft':None,'entries':[]}}
    context.add_init_script(f'for(const[k,v]of Object.entries({json.dumps(data)}))localStorage.setItem(k,JSON.stringify(v));')
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8093')
    expect(page.get_by_role('button',name=labels[locale]['signIn'],exact=True)).to_be_visible()
    for width in [390,360,320,400]:
     page.set_viewport_size({'width':width,'height':844})
     page.evaluate('()=>document.querySelectorAll("*").forEach(e=>{if(e.scrollTop)e.scrollTop=0;})')
     metric=page.get_by_role('button',name=labels[locale]['languageRu'],exact=True).evaluate('''e=>{
      const row=e.parentElement.parentElement;
      const children=[...row.children].map(x=>{const r=x.getBoundingClientRect();return{text:x.textContent,width:r.width,left:r.left,right:r.right,cy:r.y+r.height/2};});
      const controls=[...row.querySelectorAll('[role="button"]')].map(x=>({label:x.getAttribute('aria-label'),height:x.getBoundingClientRect().height}));
      const overflow=[...row.querySelectorAll('[dir="auto"]')].filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent);
      return{children,controls,overflow};
     }''')
     assert all(c['height']>=56 for c in metric['controls']),metric
     assert all(c['left']>=0 and c['right']<=width for c in metric['children']),metric
     assert not metric['overflow'],metric
     same_row=max(c['cy'] for c in metric['children'])-min(c['cy'] for c in metric['children'])<=1
     if size=='standard' and width>=360:assert same_row,(locale,width,metric)
     results.append({'locale':locale,'size':size,'width':width,'oneRow':same_row,**metric})
     page.screenshot(path=str(out/f'header-{locale}-{width}-{size}.png'))
    context.close()
  assert not errors,errors
  print(json.dumps({'passed':len(results),'errors':errors}))
 finally:
  (out/'verification.json').write_text(json.dumps({'cases':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
