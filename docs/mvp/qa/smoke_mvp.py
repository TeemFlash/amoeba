from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import json,re,os
OUT=Path(os.environ.get('QA_OUTPUT_DIR','qa-results')); OUT.mkdir(parents=True,exist_ok=True)
KEY='enactus-senior-demo:v1'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
 ctx=b.new_context(viewport={'width':390,'height':844}); page=ctx.new_page();errors=[];checks=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(os.environ.get('DEMO_URL','http://localhost:8083')); page.wait_for_load_state('networkidle')
 def button(name):return page.get_by_role('button',name=name,exact=True)
 def click(name):button(name).click()
 def tab(name):page.get_by_role('tab',name=name,exact=True).click()
 def snap():return page.evaluate('(k)=>JSON.parse(localStorage.getItem(k))',arg=KEY)
 def check(name,test):
  assert test,name
  checks.append(name)
 def next_item(i=0):page.get_by_role('button',name=re.compile('^Выбрать')).nth(i).click()
 def help_form():
  tab('Главная');click('Бытовая помощь');next_item();click('Далее')
 def wait_field(field,value):page.wait_for_function('([k,f,v])=>JSON.parse(localStorage.getItem(k)).draft?.[f]===v',arg=[KEY,field,value])
 page.screenshot(path=str(OUT/'home-ru.png'))
 tab('Мои обращения');expect(page.get_by_text('Здесь пока пусто',exact=True)).to_be_visible();checks.append('empty history')
 help_form();click('Далее');expect(page.get_by_text('Выберите демонстрационный район.',exact=True).first).to_be_visible();check('empty form creates no entry',len(snap()['entries'])==0)
 page.get_by_role('radio',name='Демонстрационный центр',exact=True).click();wait_field('districtId','demo-center')
 page.get_by_role('radio',name='Учебный пример: утром',exact=True).click();wait_field('slotId','demo-morning')
 page.reload();page.wait_for_load_state('networkidle');click('Продолжить черновик');expect(page.get_by_role('radio',name='Демонстрационный центр',exact=True)).to_have_attribute('aria-checked','true');checks.append('restored choice exposes checked state');checks.append('draft survives reload')
 click('Далее');click('Қазақша');page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).locale==="kz"',arg=KEY)
 expect(button('Демода сақтау')).to_be_visible();check('locale preserves draft',snap()['draft']['districtId']=='demo-center')
 click('Русский');page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).locale==="ru"',arg=KEY)
 click('Изменить выбор');page.get_by_role('radio',name='Учебный пример: после обеда',exact=True).click();wait_field('slotId','demo-afternoon');click('Далее')
 # Inject a real web storage failure at the browser boundary for the final save.
 page.evaluate('''() => {const original=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k==='enactus-senior-demo:v1'){Storage.prototype.setItem=original;throw new Error('QA one-time write failure')}return original.call(this,k,v)}}''')
 click('Сохранить в демо');expect(page.get_by_text('Не удалось подтвердить сохранение. Повторите попытку.',exact=True).first).to_be_visible();check('failed submit does not falsely succeed',len(snap()['entries'])==0)
 button('Повторить').first.click();page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).entries.length===1',arg=KEY);expect(button('Отменить в демо')).to_be_visible();checks.append('retry completes navigation and saves once')
 page.screenshot(path=str(OUT/'help-saved.png'))
 page.reload();page.wait_for_load_state('networkidle');tab('Мои обращения');page.get_by_role('button',name=re.compile('^Открыть запись')).first.click();click('Отменить в демо');click('Оставить');check('declined cancel preserves record',snap()['entries'][0]['status']=='saved-demo');click('Назад');expect(page.get_by_text('Отменить эту запись в демо?',exact=True)).to_have_count(0);page.get_by_role('button',name=re.compile('^Открыть запись')).first.click();checks.append('Back after Keep does not reopen cancellation');click('Отменить в демо');click('Отменить в демо');page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).entries[0].status==="cancelled-demo"',arg=KEY);checks.append('confirmed cancellation persists')
 # Open, full and cancelled event scenarios.
 tab('Главная');click('Встречи');next_item(1);expect(page.get_by_text('В этом примере места закончились. Новая запись недоступна.',exact=True)).to_be_visible();check('full event blocks continuation',button('Далее').count()==0)
 click('Назад');next_item(2);expect(page.get_by_text('Этот учебный пример встречи отменён. Запись недоступна.',exact=True)).to_be_visible();check('cancelled event blocks continuation',button('Далее').count()==0)
 click('Назад');next_item(0);click('Далее');click('Записаться в демо');page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).entries.length===2',arg=KEY);checks.append('event saved')
 tab('Главная');click('Встречи');next_item(0);click('Далее');expect(button('Отменить в демо')).to_be_visible();check('active duplicate opens existing entry',len(snap()['entries'])==2)
 click('Отменить в демо');click('Отменить в демо');page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).entries.every(x=>x.status==="cancelled-demo")',arg=KEY)
 tab('Главная');click('Встречи');next_item(0);click('Далее');click('Записаться в демо');page.wait_for_function('(k)=>JSON.parse(localStorage.getItem(k)).entries.length===3',arg=KEY);checks.append('new enrollment after cancellation')
 tab('Об приложении');click('Сбросить данные демо');click('Оставить');check('declined reset preserves history',len(snap()['entries'])==3);click('Сбросить данные демо');click('Сбросить данные демо');page.wait_for_function('(k)=>!localStorage.getItem(k)||JSON.parse(localStorage.getItem(k)).entries.length===0',arg=KEY);checks.append('confirmed reset')
 # Corruption must be visible and preserved until confirmation.
 page.evaluate('(k)=>localStorage.setItem(k,"{broken")',arg=KEY);page.reload();page.wait_for_load_state('networkidle');expect(page.get_by_text('Данные демо не распознаны',exact=True)).to_be_visible();check('corrupt data preserved',page.evaluate('(k)=>localStorage.getItem(k)',arg=KEY)=='{broken')
 click('Қазақша');expect(page.get_by_text('Демо деректері танылмады',exact=True)).to_be_visible();checks.append('error screen language works without storage overwrite')
 # Screenshot and result; reset action text in KZ.
 page.screenshot(path=str(OUT/'corrupt-kz.png'))
 check('no browser runtime errors',not errors)
 (OUT/'smoke-results.json').write_text(json.dumps({'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2))
 print(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2));b.close()
