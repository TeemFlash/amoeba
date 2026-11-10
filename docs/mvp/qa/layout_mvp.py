from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json,re,os
out=Path(os.environ.get('QA_OUTPUT_DIR','qa-results'));out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 results=[]
 for width in [320,390]:
  page=b.new_page(viewport={'width':width,'height':844});page.goto(os.environ.get('DEMO_URL','http://localhost:8083'));page.wait_for_load_state('networkidle')
  page.get_by_role('button',name='Бытовая помощь',exact=True).click();page.get_by_role('button',name=re.compile('^Выбрать')).first.click();page.get_by_role('button',name='Далее',exact=True).click();page.get_by_role('button',name='Қазақша',exact=True).click()
  expect(page.get_by_role('radio',name='Демонстрациялық сол жағалау',exact=True)).to_be_visible()
  for scale in [1,2]:
   if scale==2:
    page.evaluate('''()=>{document.querySelectorAll('[dir="auto"]').forEach(e=>{let c=getComputedStyle(e);e.style.fontSize=(parseFloat(c.fontSize)*2)+'px';if(c.lineHeight!=='normal')e.style.lineHeight=(parseFloat(c.lineHeight)*2)+'px'})}''')
   overflow=page.evaluate('''()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('[role="button"],[role="radio"],[role="tab"]')].map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollWidth,client:e.clientWidth})).filter(e=>e.rect.right>innerWidth+1||e.rect.left< -1||e.scroll>e.client+1)})''')
   page.get_by_role('radio',name='Демонстрациялық сол жағалау',exact=True).scroll_into_view_if_needed()
   page.screenshot(path=str(out/f'kz-form-{width}-text-{scale}x.png'))
   assert overflow['document']<=width and not overflow['outside'],overflow
   results.append({'width':width,'textScale':scale,'horizontalOverflow':False})
  page.close()
 (out/'layout-results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results));b.close()
