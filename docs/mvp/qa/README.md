# Браузерные доказательства

## Реализованный интерфейс Mobi — 2026-11-10

Текущие артефакты находятся в [2026-11-10-implemented-ui](2026-11-10-implemented-ui). Они сняты с Expo приложения. Статический борд в `apps/mobile/design` остаётся отдельным результатом предыдущего этапа.

- `mobi_ui_smoke.py`: local demo, все Edit, сохранение черновика, RU/KZ, встречи, отмена, ошибка записи/Retry, фильтры, крупный текст — 22 checks.
- `mobi_cloud_ui_smoke.py`: localhost:8092 + Firebase emulators, guest→auth→review, правки после входа, save/history/cancel/logout — 15 checks.
- `mobi_handoff_ui.py`: оба решения конфликта, сбой и retry переноса, legacy readonly и атомарная замена — 10 checks.
- `mobi_event_resume_ui.py`: Home продолжает гостевой/учётный черновик встречи с тем же ID; обычный вход без черновика позволяет вернуться Home — 5 checks.
- `mobi_recovery_ui.py`: последнее пожелание при Back/Skip/языке, ошибки настроек, corrupt reset — 7 checks.
- `mobi_layout_ui.py`: 30 responsive состояний. 2× — web text emulation, не системный native font-scale.
- `mobi_live_data_smoke.ts`: opt-in с точным project ID; 6 проверок actual repository на live Firebase, targeted cleanup только созданных QA UID/documents. Credentials остаются в памяти.

Python checks используют Playwright. `mobi_ui_probe.py` извлекает актуальные локализованные accessible labels из TypeScript, чтобы не зависеть от устаревших строк прошлой версии. `DEMO_URL` по умолчанию localhost:8091 для local. Cloud/handoff жёстко привязаны к локальному emulator preview. JSON-файлы содержат финальные результаты; `*-failure.*` — диагностические снимки промежуточных исправленных сбоев и не являются финальной приёмкой.

## Редизайн по примеру — 2026-11-10

Актуальный набор: [2026-11-10-design](2026-11-10-design/). `smoke_mvp.py` — 20/20; `design_mobi.py` — 152 проверки 19 экранных состояний RU/KZ при 320/390px и 1×/2× текста; `layout_mvp.py` — 4/4; `branding_mobi.py` — имя, сохранённый черновик и keyboard focus; `contrast_mobi.py` — 15 цветовых пар. Проверены полные подписи навигации без разрывов слов, aria-selected/aria-pressed и reset-заголовок.

Запускайте сценарии с общими `DEMO_URL`, `CHROMIUM_PATH`, `QA_OUTPUT_DIR`, описанными ниже. Контрастный сценарий использует стандартный Python и читает текущий theme; остальные используют Playwright. Результаты относятся к web export и не заменяют проверку телефонов/экранных дикторов.

## Повторная проверка Mobi — 2026-11-10

В [2026-11-10](2026-11-10/) сохранены новые результаты production web export на Windows: smoke 20/20, layout 4/4, Mobi на RU/KZ и в title, восстановление старого ключа хранилища, базовый keyboard focus. Использован установленный Google Chrome 156.0.8078.80 через Playwright; bundled headless shell не запустился (`spawn UNKNOWN`). Исторические артефакты ниже сохранены.

Для повтора задайте `DEMO_URL` адресу локального сервера и `QA_OUTPUT_DIR` новой папке результатов. При необходимости задайте `CHROMIUM_PATH` пути установленного Chrome. Помимо двух прежних сценариев выполните `python branding_mobi.py`. Все сценарии используют изолированные контексты с синтетическими данными.

## Live Firebase acceptance — 2026-11-10

`firebase_live_smoke.py` прошёл **16/16** против проекта `mobi-senior-20261110`. Он создаёт реальные Auth-пользователей и документы, поэтому требует явного `FIREBASE_LIVE_QA=1`, точного `FIREBASE_LIVE_PROJECT_ID=mobi-senior-20261110` и подготовленного `DEMO_URL`. Пароль случайный и остаётся в памяти; UIDs для последующей очистки пишутся только в ignored `.git/firebase-baseline/live-test-users.json`. Сценарий не отправляет reset-email и не кликает Google provider. Live Google popup probe отдельно подтвердил открытие `accounts.google.com`, но не завершил login. Итоговые результаты и ограничения: [live Firebase evidence](2026-11-10-firebase/).

## Исторический прогон

Проверено 2026-11-09 в Chromium на локальном Expo web preview. `smoke-results.json`:20 проверок, включая настоящую инъекцию ошибки localStorage.setItem, Retry, reload, отмену, RU/KZ, встречи, повреждённое хранилище и aria-checked. `layout-results.json`:320/390 CSS px ×1/2 размера текста, без горизонтального переполнения. Скриншоты получены из приложения, не нарисованы.

2× здесь означает увеличение DOM fontSize и lineHeight. Это проверка web-компоновки, не Dynamic Type/TalkBack/VoiceOver на устройствах. `keyboard-results.json` подтверждает один базовый проход Tab/Enter с видимым focus; это не полный аудит клавиатуры. `contrast-results.json` содержит измеренные пары цветов, не сертификат всей доступности.

## Повторение

Запустите приложение на loopback: из apps/mobile выполнить `npm ci`, затем `npm run web -- --localhost --port 8083`. В отдельном Python virtualenv установите `playwright`, затем `python -m playwright install chromium`.

Выполните `python smoke_mvp.py` и `python layout_mvp.py` из этой папки. Настройки окружения: `DEMO_URL` (по умолчанию http://localhost:8083), `CHROMIUM_PATH` (при использовании своего Chromium), `QA_OUTPUT_DIR` (по умолчанию qa-results). Каждый сценарий использует новый изолированный браузерный контекст с учебными данными.

Скрипты сохранены с той же логикой проверок; пути браузера/сервера/результатов вынесены в переменные окружения для воспроизводимости. Телефоны, системные дикторы, реальные пенсионеры и качество KZ перевода этим прогоном не проверены.
