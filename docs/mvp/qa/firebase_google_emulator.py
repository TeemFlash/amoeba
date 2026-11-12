"""Tests Firebase's emulated Google popup adapter, NOT live Google OAuth."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os, time, json

out = Path(os.environ.get('QA_OUTPUT_DIR', 'firebase-qa-results'))
out.mkdir(parents=True, exist_ok=True)
email = f'google-emulator-{time.time_ns()}@example.test'
with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
    page = b.new_page(viewport={'width': 390, 'height': 844})
    page.goto(os.environ.get('DEMO_URL', 'http://127.0.0.1:8097'))
    page.get_by_role('tab', name='Аккаунт', exact=True).click()
    with page.expect_popup() as info:
        page.get_by_role('button', name='Войти через Google', exact=True).click()
    popup = info.value
    popup.wait_for_load_state('networkidle')
    popup.get_by_text('Add new account', exact=True).click()
    popup.locator('#email-input').fill(email)
    popup.locator('#display-name-input').fill('Synthetic emulator account')
    popup.get_by_role('button', name='Sign in with Google.com', exact=True).click()
    expect(page.get_by_text(email, exact=True)).to_be_visible()
    expect(page.get_by_text('Проверяем аккаунт…', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Выйти из аккаунта', exact=True).click()
    expect(page.get_by_role('button', name='Войти', exact=True)).to_be_visible()
    b.close()
result = {'checks': ['emulated Google popup signs into Firebase', 'logout returns to sign-in'], 'liveGoogleOAuthTested': False}
(out / 'google-emulator-results.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
