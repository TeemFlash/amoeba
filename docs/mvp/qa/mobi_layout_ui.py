"""Responsive checks on actual UI; web text emulation is not native font-scale proof."""
import json
from playwright.sync_api import sync_playwright,expect
from mobi_ui_probe import definitions,layout,OUT

defs=definitions();results=[]
with sync_playwright() as p:
 browser=p.chromium.launch()
 try:
  for locale in ['ru','kz']:
   labels=defs['labels'][locale]
   for width,size,scale in [(390,'standard',1),(320,'large',1),(320,'standard',2)]:
    for screen in ['home','review','profile','events','auth']:
     context=browser.new_context(viewport={'width':width,'height':844})
     draft={'operationId':'layout-help','serviceId':'home-help','districtId':'astana-esil','dateId':'demo-nov12','slotId':'demo-10-12','note':'Пожелание · Тілек','step':'review','formStep':'note'}
     data={'enactus-senior-demo:v1':{'schemaVersion':1,'locale':locale,'draft':draft,'entries':[]},'mobi-preferences:v1':{'version':1,'welcomeCompleted':True,'textSize':size}}
     context.add_init_script(f'for(const[k,v]of Object.entries({json.dumps(data)}))localStorage.setItem(k,JSON.stringify(v));')
     page=context.new_page();page.goto('http://127.0.0.1:'+('8092' if screen=='auth' else '8091'))
     if screen=='auth':expect(page.get_by_role('button',name=labels['signIn'],exact=True)).to_be_visible()
     else:
      expect(page.get_by_role('tab',name=labels['tabHome'],exact=True)).to_be_visible()
      if screen=='review':page.get_by_role('button',name=labels['continueDraft'],exact=True).click()
      elif screen in ['profile','events']:page.get_by_role('tab',name=labels['tabProfile' if screen=='profile' else 'tabActivities'],exact=True).click()
     if scale==2:page.evaluate('''()=>document.querySelectorAll('[dir="auto"],input,textarea').forEach(e=>{const s=getComputedStyle(e);e.style.fontSize=parseFloat(s.fontSize)*2+'px';if(s.lineHeight!=='normal')e.style.lineHeight=parseFloat(s.lineHeight)*2+'px';})''')
     page.get_by_role('button').last.scroll_into_view_if_needed()
     result={'locale':locale,'screen':screen,'size':size,'textEmulation':scale,**layout(page)}
     results.append(result)
     if screen in ['home','review'] and width==390:
      page.wait_for_function('()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
      page.evaluate('()=>document.querySelectorAll("*").forEach(e=>{if(e.scrollTop)e.scrollTop=0;})')
      page.screenshot(path=str(OUT/f'final-{screen}-{locale}.png'))
     if result['outside'] or result['smallTargets'] or result['documentWidth']>width:
      page.screenshot(path=str(OUT/f'layout-failure-{screen}-{locale}-{width}-{scale}.png'),full_page=True)
      raise AssertionError(result)
     context.close()
  print(json.dumps({'passed':len(results)}))
 finally:
  (OUT/'layout-ui-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
