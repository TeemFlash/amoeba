"""Legacy separation, draft conflicts and network recovery against local emulators."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os, json, re, time

out=Path(os.environ.get('QA_OUTPUT_DIR','firebase-qa-results'));out.mkdir(parents=True,exist_ok=True)
checks=[]
legacy={'schemaVersion':1,'locale':'ru','entries':[],'draft':{'operationId':'legacy-draft','serviceId':'groceries','districtId':'demo-center','slotId':'demo-morning','step':'review'}}
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH'))
    ctx=b.new_context(viewport={'width':390,'height':844})
    ctx.add_init_script("if(!localStorage.getItem('enactus-senior-demo:v1'))localStorage.setItem('enactus-senior-demo:v1',"+json.dumps(json.dumps(legacy))+");")
    page=ctx.new_page();page.set_default_timeout(20000)
    def button(name):return page.get_by_role('button',name=name,exact=True)
    def click(name):button(name).click()
    def tab(name):page.get_by_role('tab',name=name,exact=True).click()
    def drafts():return page.evaluate("()=>Object.keys(localStorage).filter(k=>k.startsWith('mobi-account:')&&k.endsWith(':draft')).map(k=>JSON.parse(localStorage.getItem(k)))")
    try:
        page.goto(os.environ.get('DEMO_URL','http://127.0.0.1:8097'))
        expect(page.get_by_role('tab',name='Аккаунт',exact=True)).to_be_visible()
        expect(button('Продолжить черновик')).to_have_count(0)
        checks.append('signed-out cloud mode hides legacy draft editing')
        tab('Аккаунт');click('Нет аккаунта? Создать')
        page.get_by_label('Электронная почта',exact=True).fill(f'recovery-{time.time_ns()}@example.test')
        page.get_by_label('Пароль',exact=True).fill('Mobi-Recovery-782!')
        page.get_by_label('Повторите пароль',exact=True).fill('Mobi-Recovery-782!')
        click('Создать аккаунт')
        expect(button('Выйти из аккаунта')).to_be_visible()
        expect(page.get_by_text('Проверяем аккаунт…',exact=True)).to_have_count(0)
        expect(button('Продолжить черновик')).to_have_count(0)
        checks.append('legacy draft is not assigned to new account')
        tab('Главная');click('Бытовая помощь');page.get_by_role('button',name=re.compile('^Выбрать')).first.click();click('Далее')
        page.get_by_role('radio',name='Демонстрационный центр',exact=True).click()
        page.get_by_role('radio',name='Учебный пример: утром',exact=True).click()
        original=drafts()[0]
        tab('Главная');click('Встречи');page.get_by_role('button',name=re.compile('^Выбрать')).first.click();click('Далее')
        expect(button('Записаться в демо')).to_have_count(0)
        assert drafts()[0]==original
        checks.append('event start cannot silently replace help draft')
        tab('Главная');click('Продолжить черновик');click('Далее')
        ctx.set_offline(True);click('Сохранить в демо')
        expect(page.get_by_text('Не удалось подтвердить сохранение через интернет. Черновик сохранён; повторите с той же записью.',exact=True).first).to_be_visible(timeout=25000)
        expect(button('Изменить выбор')).to_be_disabled()
        checks.append('failed network save preserves and locks intent')
        ctx.set_offline(False);tab('Аккаунт')
        expect(page.get_by_text('Проверяем аккаунт…',exact=True)).to_have_count(0,timeout=20000)
        click('Повторить сохранение')
        expect(page.get_by_text('Сохранено в аккаунте. Это демо; услуга не заказана.',exact=True)).to_be_visible()
        checks.append('retry completes the original application')
        tab('Мои обращения');expect(page.get_by_role('button',name=re.compile('^Открыть запись'))).to_have_count(1)
        checks.append('retry creates one application')
        tab('Главная');ctx.set_offline(True);tab('Мои обращения')
        expect(page.get_by_text('Не удалось получить историю из аккаунта. История не считается пустой; проверьте соединение и повторите.',exact=True).first).to_be_visible(timeout=25000)
        expect(page.get_by_text('В аккаунте пока нет сохранённых записей.',exact=True)).to_have_count(0)
        checks.append('failed history read shows error rather than empty state')
        ctx.set_offline(False);click('Повторить')
        expect(page.get_by_role('button',name=re.compile('^Открыть запись'))).to_have_count(1)
        checks.append('history retry restores saved application')
        assert page.evaluate("()=>JSON.parse(localStorage.getItem('enactus-senior-demo:v1')).draft.operationId")=='legacy-draft'
        checks.append('legacy draft remains untouched through account mutations')
    except Exception:
        page.screenshot(path=str(out/'recovery-failure.png'),full_page=True)
        (out/'recovery-failure.txt').write_text(page.locator('body').inner_text(),encoding='utf-8')
        raise
    finally:
        ctx.set_offline(False)
        (out/'firebase-recovery-results.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'passed':len(checks),'checks':checks}))
        b.close()
