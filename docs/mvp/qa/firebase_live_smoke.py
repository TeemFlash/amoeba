"""Opt-in browser smoke for the provisioned Mobi Firebase project.

This test creates real Firebase Authentication users and Firestore records.
It never tests Google OAuth or sends password-reset email. Created UIDs are
written only to the ignored .git/firebase-baseline cleanup registry.
"""
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright, expect
import json
import os
import re
import secrets
import time


PROJECT_ID = 'mobi-senior-20261110'
if os.environ.get('FIREBASE_LIVE_QA') != '1':
    raise SystemExit('Refusing live Firebase access: set FIREBASE_LIVE_QA=1 for explicit opt-in.')
if os.environ.get('FIREBASE_LIVE_PROJECT_ID') != PROJECT_ID:
    raise SystemExit(f'Refusing project mismatch: FIREBASE_LIVE_PROJECT_ID must equal {PROJECT_ID}.')
URL = os.environ.get('DEMO_URL')
if not URL:
    raise SystemExit('Set DEMO_URL to the current live-config web export preview.')

OUT = Path(os.environ.get('QA_OUTPUT_DIR', 'firebase-live-qa-results'))
OUT.mkdir(parents=True, exist_ok=True)
REGISTRY = Path('.git/firebase-baseline/live-test-users.json')
KEY = 'enactus-senior-demo:v1'
stamp = str(time.time_ns())
email_a = f'qa-live-a-{stamp}@example.test'
email_b = f'qa-live-b-{stamp}@example.test'
# Fresh random password stays in memory only. This script never prints or writes it.
password = 'Mobi-QA-' + secrets.token_urlsafe(24) + '7!'
checks, errors = [], []
request_failures, http_error_statuses = [], []
auth_hosts, firestore_projects, observed_hosts = set(), set(), set()
created_users = {}
id_tokens = {}  # Memory-only for the cross-account denial probe; cleared before exit.

legacy = {'schemaVersion': 1, 'locale': 'ru', 'draft': None, 'entries': [{
    'id': 'DEMO-legacy-live-qa', 'operationId': 'legacy-live-qa', 'kind': 'help',
    'serviceId': 'groceries', 'districtId': 'demo-center', 'slotId': 'demo-morning',
    'status': 'saved-demo', 'createdAt': '2026-11-09T10:00:00.000Z', 'cancelledAt': None,
}]}


def persist_created_users():
    """Persist cleanup identifiers only; never retain credentials or tokens."""
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    current = {'projectId': PROJECT_ID, 'users': []}
    if REGISTRY.exists():
        try:
            existing = json.loads(REGISTRY.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError('Existing cleanup registry is unreadable; refusing to overwrite it.') from exc
        if existing.get('projectId') != PROJECT_ID or not isinstance(existing.get('users'), list):
            raise RuntimeError('Existing cleanup registry has an unexpected shape/project; refusing to overwrite it.')
        current = existing
    known = {user.get('uid') for user in current['users'] if isinstance(user, dict)}
    for user in created_users.values():
        if user['uid'] not in known:
            current['users'].append(user)
            known.add(user['uid'])
    current['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    REGISTRY.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def project_ids_in_request(url):
    decoded = unquote(url)
    return set(re.findall(r'projects/([A-Za-z0-9.-]+)', decoded))


def record(name, condition=True):
    assert condition, name
    checks.append(name)


def capture_failure_state(page, label):
    """Save browser state for diagnosis without recording credentials or tokens."""
    page.screenshot(path=str(OUT / f'{label}-failure.png'), full_page=True)
    body = page.locator('body').inner_text()
    body = re.sub(r'qa-live-[ab]-\d+@example\.test', '<synthetic-email>', body)
    (OUT / f'{label}-failure.txt').write_text(body, encoding='utf-8')


def assert_entry_count(page, expected, label):
    try:
        expect(page.get_by_role('button', name=re.compile('^Открыть запись'))).to_have_count(expected)
    except Exception:
        capture_failure_state(page, label)
        raise


def button(page, name):
    return page.get_by_role('button', name=name, exact=True)


def fill_account(page, email, register=False):
    if register:
        button(page, 'Нет аккаунта? Создать').click()
    page.get_by_label('Электронная почта', exact=True).fill(email)
    page.get_by_label('Пароль', exact=True).fill(password)
    if register:
        page.get_by_label('Повторите пароль', exact=True).fill(password)
    button(page, 'Создать аккаунт' if register else 'Войти').click()


def logged_in(page, email):
    page.get_by_role('tab', name='Аккаунт', exact=True).click()
    expect(page.get_by_text(email, exact=True)).to_be_visible()
    expect(button(page, 'Выйти из аккаунта')).to_be_enabled()
    expect(page.get_by_text('Проверяем аккаунт…', exact=True)).to_have_count(0)


def on_request(request):
    parsed = urlparse(request.url)
    host = parsed.hostname or ''
    if 'googleapis.com' in host or host.endswith('.firebaseapp.com'):
        observed_hosts.add(host)
    if host == 'identitytoolkit.googleapis.com' and 'accounts:signUp' in parsed.path:
        auth_hosts.add(host)
    if host == 'firestore.googleapis.com':
        firestore_projects.update(project_ids_in_request(request.url))


def on_response(response):
    parsed = urlparse(response.url)
    host = parsed.hostname or ''
    if response.status >= 400:
        http_error_statuses.append({'host': host, 'method': response.request.method, 'status': response.status})
    if parsed.hostname != 'identitytoolkit.googleapis.com' or 'accounts:signUp' not in parsed.path:
        return
    if response.status < 200 or response.status >= 300:
        return
    try:
        body = response.json()
    except Exception:
        return
    uid, email = body.get('localId'), body.get('email')
    if not isinstance(uid, str) or not uid or email not in {email_a, email_b}:
        return
    # Keep the ID token only in process memory for the direct cross-account rules probe.
    token = body.get('idToken')
    if isinstance(token, str) and token:
        id_tokens[email] = token
    # Persist UID/email metadata only; never retain refreshToken, password, or raw response.
    created_users[email] = {
        'uid': uid,
        'email': email,
        'projectId': PROJECT_ID,
        'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }
    persist_created_users()


def on_request_failed(request):
    parsed = urlparse(request.url)
    failure = request.failure or ''
    code = re.search(r'net::(ERR_[A-Z_]+)', failure)
    request_failures.append({
        'host': parsed.hostname or '',
        'method': request.method,
        'failureCode': code.group(1) if code else 'request-failed',
    })


def run():
    page = None
    browser = None
    status = 'failed'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH'))
            context = browser.new_context(viewport={'width': 390, 'height': 844})
            context.add_init_script(
                f"if (!localStorage.getItem({json.dumps(KEY)})) "
                f"localStorage.setItem({json.dumps(KEY)}, {json.dumps(json.dumps(legacy))});"
            )
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', on_request)
            page.on('response', on_response)
            page.on('requestfailed', on_request_failed)
            page.set_default_timeout(30000)
            expect.set_options(timeout=30000)

            page.goto(URL)
            expect(page.get_by_role('tab', name='Аккаунт', exact=True)).to_be_visible()
            button(page, 'Бытовая помощь').click()
            page.get_by_role('button', name=re.compile('^Выбрать')).first.click()
            button(page, 'Далее').click()
            expect(button(page, 'Войти')).to_be_visible()
            record('signed-out application flow requires authentication')

            fill_account(page, email_a, register=True)
            expect(button(page, 'Далее')).to_be_visible()
            expect(page.get_by_text('Проверяем аккаунт…', exact=True)).to_have_count(0)
            record('live email/password registration returns without auto-submit', email_a in created_users)
            button(page, 'Далее').click()
            page.get_by_role('radio', name='Демонстрационный центр', exact=True).click()
            page.get_by_role('radio', name='Учебный пример: утром', exact=True).click()
            button(page, 'Далее').click()
            button(page, 'Сохранить в демо').click()
            expect(button(page, 'Отменить запись в аккаунте')).to_be_visible()
            record('help application saves to the live account')
            page.reload()
            logged_in(page, email_a)
            page.get_by_role('tab', name='Мои обращения', exact=True).click()
            assert_entry_count(page, 1, 'live-help-reload')
            record('live account application survives reload')
            record(
                'legacy local record remains separate',
                page.evaluate('(k)=>JSON.parse(localStorage.getItem(k)).entries.length', KEY) == 1,
            )
            logged_in(page, email_a)
            button(page, 'Выйти из аккаунта').click()
            expect(button(page, 'Войти')).to_be_visible()
            page.get_by_role('tab', name='Мои обращения', exact=True).click()
            assert_entry_count(page, 0, 'live-logout-isolation')
            record('logout hides live account applications')

            page.get_by_role('tab', name='Аккаунт', exact=True).click()
            fill_account(page, email_b, register=True)
            logged_in(page, email_b)
            page.get_by_role('tab', name='Мои обращения', exact=True).click()
            assert_entry_count(page, 0, 'live-account-b-isolation')
            record('second live account cannot see first account history', email_b in created_users)
            # B's in-memory Firebase ID token must not list A's Firestore collection.
            # The request URL contains the exact provisioned project and users/{uid}/applications path.
            api = p.request.new_context(timeout=20000)
            try:
                probe = api.get(
                    f'https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users/{created_users[email_a]["uid"]}/applications',
                    headers={'Authorization': f'Bearer {id_tokens[email_b]}'},
                )
                record('live Firestore denies account B direct listing account A collection', probe.status == 403)
            finally:
                api.dispose()

            logged_in(page, email_b)
            button(page, 'Выйти из аккаунта').click()
            fill_account(page, email_a)
            logged_in(page, email_a)
            page.get_by_role('tab', name='Мои обращения', exact=True).click()
            assert_entry_count(page, 1, 'live-account-a-relogin')
            record('relogin restores owning account history')

            page.get_by_role('tab', name='Главная', exact=True).click()
            button(page, 'Встречи').click()
            page.get_by_role('button', name=re.compile('^Выбрать')).first.click()
            button(page, 'Далее').click()
            button(page, 'Записаться в демо').click()
            expect(button(page, 'Отменить запись в аккаунте')).to_be_visible()
            record('event application saves to the live account')
            page.reload()
            logged_in(page, email_a)
            page.get_by_role('tab', name='Мои обращения', exact=True).click()
            assert_entry_count(page, 2, 'live-event-reload')
            record('both live application kinds survive reload')

            page.get_by_role('button', name=re.compile('^Открыть запись')).first.click()
            button(page, 'Отменить запись в аккаунте').click()
            button(page, 'Оставить').click()
            expect(button(page, 'Отменить запись в аккаунте')).to_be_visible()
            button(page, 'Отменить запись в аккаунте').click()
            button(page, 'Подтвердить отмену записи').click()
            expect(page.get_by_text('Отменено в демо', exact=True).first).to_be_visible()
            record('explicit live cancellation succeeds')
            page.reload()
            logged_in(page, email_a)
            page.get_by_role('tab', name='Мои обращения', exact=True).click()
            assert_entry_count(page, 2, 'live-cancel-reload')
            expect(page.get_by_text('Отменено в демо', exact=True).first).to_be_visible()
            record('cancelled live application remains in history')

            record('Firebase Auth requests reached live Identity Toolkit', 'identitytoolkit.googleapis.com' in auth_hosts)
            record('Firestore traffic names the exact live project', PROJECT_ID in firestore_projects)
            record('no browser runtime errors', not errors)
            browser.close()
            browser = None
            status = 'passed'
    finally:
        persist_created_users()
        metadata = {
            'status': status,
            'liveFirebase': 'identitytoolkit.googleapis.com' in auth_hosts and PROJECT_ID in firestore_projects,
            'liveGoogleOAuthTested': False,
            'expectedProjectId': PROJECT_ID,
            'observedFirestoreProjectIds': sorted(firestore_projects),
            'observedFirebaseHosts': sorted(observed_hosts),
            'checks': checks,
            'pageErrors': errors,
            'requestFailures': request_failures,
            'httpErrorStatuses': http_error_statuses,
            'createdAccountCount': len(created_users),
            'credentialsPersisted': False,
        }
        (OUT / 'firebase-live-smoke-results.json').write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        if browser:
            try:
                if browser.is_connected():
                    browser.close()
            except Exception:
                pass
        id_tokens.clear()
        print(json.dumps({
            'status': status,
            'liveFirebase': metadata['liveFirebase'],
            'liveGoogleOAuthTested': False,
            'passed': len(checks),
            'createdAccountCount': len(created_users),
        }, ensure_ascii=False))


if __name__ == '__main__':
    run()
