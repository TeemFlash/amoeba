# Проверка локального MVP

## Navbar icons / single-line labels — 2026-11-10

Focused regression: **48/48 PASS**, zero browser runtime errors. RU/KZ, widths 320/360/390, standard and large text, all four selected tabs. Assertions require a single text line, full ink width fitting its cell (not merely CSS clipping), font ≥18 px, target ≥56 px, and four equal-row tabs at standard 390 px. Source includes a 4/2/1 column fallback for growing system text. Typecheck, lint and production web export pass; source-only native View icons add no dependencies. Native device text scaling remains unverified. [Result](../../artifacts/mobi-navbar/verification.json), [Kazakh screenshot](../../artifacts/mobi-navbar/navbar-kz-tabHome.png).

## Реализованный Mobi UI — финальная проверка 2026-11-10

Проверялось приложение `apps/mobile`, не статический дизайн-борд. Код реализовала Luna; Astra отдельно проверила исходники и независимо выполнила 90 unit/storage тестов. Root выполнил следующие проверки на Windows:

| Проверка | Результат |
|---|---|
| Unit/domain/storage/serialization/session | 90/90 PASS |
| Firestore/Auth emulator security | 8/8 PASS |
| TypeScript, ESLint, Expo dependency compatibility | PASS |
| Production web export | PASS |
| Android и iOS Hermes bundle export | PASS; без запуска устройства |
| Local UI: шаги, Edit, языки, reload, save/retry, cancel, фильтры, крупный текст | 22/22 PASS |
| Account UI: гостевой выбор, auth→review, правки после входа, note Next/Skip, история | 15/15 PASS |
| Конфликты переноса, retry, legacy readonly, атомарная замена | 10/10 PASS |
| Home продолжает guest/account event draft; обычный вход без черновика→Home | 5/5 PASS |
| Note Back/reload/Skip, ошибки настроек, подтверждённый reset повреждённых данных | 7/7 PASS |
| Home/review/profile/events/auth; RU/KZ; 390/320; standard/large/2× web text | 30/30 PASS |
| Live Firebase SDK и actual applications repository | 6/6 PASS + cleanup |

В финальном local UI прогоне 0 browser runtime errors; все 11 дополнительно снятых состояний без горизонтального переполнения и целей ниже 56 px. Web text emulation не подтверждает нативный Dynamic Type. Все шесть PNG иллюстраций включены в бандлы. Генерируемые `dist`, `design` и native output исключены из TypeScript discovery, чтобы export не влиял на проверку исходников.

Деплой `firestore:rules` завершён в `mobi-senior-20261110` 11:50:52 UTC, release ruleset `8d5637af-1a04-43b5-a7d5-3978a2f63dfa`. Повторное чтение deployed source подтвердило SHA-256 `d40422286ee0253db267130efb7fa2996f3fe6032abc73c5075d0f1f414a99ba`, точное совпадение локального файла и HTTP 403 для анонимного чтения. Live test использовал настоящий `createApplicationsRepository`: новая пара date/note, legacy форма без добавления полей, повтор одного ID, запрет смены note, cancel с сохранением полей. Синтетические аккаунты и записи обоих QA запусков удалены. Первый вспомогательный cleanup встретил мутацию options в CLI client; после исправления копирования options прежняя QA-запись целево очищена до успешного повторного запуска. Это ошибка QA-helper, не приложения.

Подробные результаты: [local](qa/2026-11-10-implemented-ui/ui-smoke-results.json), [cloud UI](qa/2026-11-10-implemented-ui/cloud-ui-results.json), [handoff](qa/2026-11-10-implemented-ui/handoff-ui-results.json), [recovery](qa/2026-11-10-implemented-ui/recovery-ui-results.json), [layout](qa/2026-11-10-implemented-ui/layout-ui-results.json), [live data](qa/2026-11-10-implemented-ui/live-data-results.json), [deployed rules](qa/2026-11-10-implemented-ui/live-rules-results.json).

Ограничения: Android/iOS device/APK/IPA, экранные дикторы, native Google sign-in и завершённый интерактивный Google OAuth не проверены. Live UI старого этапа не приравнивается к новому live-browser прогону: текущие новые поля проверены actual repository + SDK, а UI — на эмуляторах. Примеры не являются реальными услугами. Исторические результаты ниже не заменяют этот текущий статус.

## Firebase/Auth и заявки — 2026-11-10

В рамках пользовательского запроса добавлены Firebase Auth/Firestore, локальный emulator route, аккаунтные черновики и история, безопасные rules и recovery идемпотентных сохранений. Firebase проект/учётные данные ещё не подключены. Astra независимо просмотрела source fixes и сообщила об отсутствии оставшихся блокирующих замечаний по своему объёму; root отдельно выполняет browser/emulator acceptance.

Результаты реализации на последнем локальном исходнике: `npm test` — **61/61 PASS**; `npm run typecheck` — **PASS**; `npm run lint` — **PASS** после исправления двух lint findings. Expo public config без заданных Google OAuth значений успешно разрешился с пустым `plugins` и прежними bundle/package identifiers. Root сообщил `npm run export:web`, `npx expo install --check` и Android JavaScript bundle export — **PASS**; последний подтверждает экспорт JS, не сборку/запуск на Android устройстве.

Итоговые результаты root на локальной эмуляторной конфигурации: cloud browser smoke **15/15 PASS**, runtime errors **0**; сохранённый unconfigured legacy smoke **20/20 PASS**; account layouts **24/24 PASS**; Google emulator sign-in/logout **2/2 PASS**; offline/recovery **9/9 PASS**, включая повтор истории после offline, единственное сохранение стабильного pending intent и неизменность локального legacy draft. Кнопки Continue/Retry отключены на время account hydration. Firestore rules emulator suite прошёл **6/6**, включая adversarial owner/pointer/duplicate cases. JSON результаты и экранные снимки: [qa/2026-11-10-firebase](qa/2026-11-10-firebase/); тестовые сценарии: [firebase_smoke.py](qa/firebase_smoke.py), [firebase_recovery.py](qa/firebase_recovery.py), [firebase_google_emulator.py](qa/firebase_google_emulator.py), [firebase_layout.py](qa/firebase_layout.py).

Проект provisioning выполнен после исходного emulator acceptance: Firebase project и Firestore созданы, проверенные Firestore rules развернуты, web export с настоящей web SDK конфигурацией завершился успешно. Email/Password и Google providers включены, support email и preview-домен настроены; web/iOS client config лежит только в ignored `.env.local`. Android debug-keystore SHA-1 зарегистрирован. Подробности: [FIREBASE-PROVISIONING](FIREBASE-PROVISIONING.md).

Live browser smoke: **16/16 PASS** against project `mobi-senior-20261110`, 0 page errors, 0 HTTP error responses. Verified live email/password account registration, help/event cloud saves, reload, logout, cross-account isolation, direct B→A Firestore list denial, and cancellation. Output: [firebase-live-smoke-results.json](qa/2026-11-10-firebase/live/firebase-live-smoke-results.json). Root verified all **4** synthetic test accounts across three attempts were removed and all **8** associated collections are empty; no user accounts were touched. Cleanup evidence: [live-cleanup-results.json](qa/2026-11-10-firebase/live-cleanup-results.json).

Google provider configuration and endpoint were verified. The Google button opens the real Google sign-in form on `accounts.google.com`, but no interactive Google login was completed (`liveGoogleOAuthTested:false`): [probe result](qa/2026-11-10-firebase/live-google-popup-results.json). Native Android/iOS sign-in/device behavior, APK installation, TalkBack/VoiceOver and real email delivery remain unverified. All catalog entries are synthetic examples; no real assistance is booked.

## Редизайн по визуальному примеру — 2026-11-10

Обновлены общая визуальная система, шапка, навигация, главная, каталоги, формы, условия, сводки, история, подтверждения и восстановление. Сохранены RU/KZ, действия и локальные данные. [Дизайн-контракт Astra](MOBI-DESIGN.md), [локальная иллюстрация и prompt](../../apps/mobile/assets/MOBI-ART.md). Артефакты отдельного прогона: [qa/2026-11-10-design](qa/2026-11-10-design/).

- `npm test`: **41/41 PASS**; `npm run typecheck`, `npm run lint`, `npx expo install --check`, `npm run export:web`: **PASS**. Экспорт содержит JS и локальную иллюстрацию; внешних изображений/шрифтов не добавлено.
- `smoke_mvp.py`: **20/20 PASS**, runtime errors **0**. Сохранение, write failure/retry, восстановление, отмена, RU/KZ, встречи и reset сохранены.
- `design_mobi.py`: **152/152 PASS** — 19 состояний × RU/KZ × 320/390px × 1×/2× текста. Проверены горизонтальное переполнение текстов/контролов, высота touch targets >=56px и отсутствие разрывов слов навигации. Включены повреждённое хранилище и его reset. Отдельные assertions проверяют форму «Район и время», заголовок boot-reset, выбранную вкладку About при reset и `aria-pressed` языка.
- `layout_mvp.py`: **4/4 PASS**; исходный сценарий формы сохранён. `branding_mobi.py`: Mobi RU/KZ/title, старый черновик и видимый keyboard focus — **PASS**.
- `contrast_mobi.py`: **15/15** пар токенов >=4.5:1, минимум **5.78:1**, белый текст основной кнопки **7.01:1**. Это измерение выбранных цветовых пар, не аудит всех состояний/изображений.
- Визуально просмотрены главная, review, встречи, KZ-форма 320px/2× и boot-reset. Обнаруженный разрыв слова «приложении» устранён: подписи переносятся целыми словами, вкладки занимают дополнительные строки при необходимости. Тексты не уменьшались и не сокращались.

Повторение: обслуживать `apps/mobile/dist` на loopback как описано ниже; установить `DEMO_URL`, `QA_OUTPUT_DIR`, при необходимости `CHROMIUM_PATH`; выполнить пять Python-скриптов из `qa`. Использован Google Chrome 156.0.8078.80 и изолированные Playwright-контексты. Независимый source/visual-review Astra: [ASTRA-REVIEW](ASTRA-REVIEW.md).

**Границы:** 2× web-текст — эмуляция DOM font-size/line-height. Native Android/iOS, Dynamic Type/Android fontScale, TalkBack/VoiceOver, KZ-редактура и исследование с пожилыми людьми не выполнялись. Проверки не являются сертификатом доступности или готовностью реальной услуги.

## Mobi — повторная проверка 2026-11-10, Windows

Текущий запрос выполнен на основе существующего локального MVP. Имя Expo, заголовок web-страницы и имя интерфейса на RU/KZ — `Mobi`. Сохранены Android package и ключ AsyncStorage, чтобы переименование не меняло идентичность установки и локальных данных. Исправлено принятие недопустимого runtime-значения в `setDraftStep`.

Фактически выполнены: `npm ci`; `npm test` — **41/41 PASS**; `npm run typecheck` — PASS; `npm run lint` — PASS; `npx expo install --check` — PASS; `npx expo-doctor` — **20/20 PASS**; `npm run export:web` — PASS. Экспорт: `apps/mobile/dist`, HTML title `Mobi`. `git diff --check` — PASS. Luna наблюдала падение двух новых regression tests до исправления и успешный повтор после; основной агент повторил полный suite.

Production web export обслуживался на `http://127.0.0.1:8084` через `python -m http.server 8084 --bind 127.0.0.1 --directory apps/mobile/dist`. Playwright с установленным Google Chrome **156.0.8078.80**: smoke **20/20**, runtime errors **0**; layout **4/4** (320/390 px × 1×/2× текста), без горизонтального переполнения. Скриншот KZ 320 px/2× визуально просмотрен. Отдельно проверены title и RU/KZ имя Mobi, восстановление синтетического черновика из прежнего ключа, сохранение его при смене языка и базовый клавиатурный focus (`auto`, `1px`). Артефакты: [qa/2026-11-10](qa/2026-11-10/); сценарии: [smoke_mvp.py](qa/smoke_mvp.py), [layout_mvp.py](qa/layout_mvp.py), [branding_mobi.py](qa/branding_mobi.py).

Первый запуск bundled Chromium headless shell завершился `spawn UNKNOWN` до открытия приложения; повтор с установленным Chrome прошёл. Вызовы Expo также выводили предупреждение окружения о `NO_COLOR`/`FORCE_COLOR`, команды завершились с кодом 0. `npm ci` сообщил **10 moderate** уязвимостей; зависимости в этой задаче не обновлялись, принудительные исправления не применялись.

Astra независимо проверила исходники и приняла изменения без блокирующих замечаний: [ASTRA-REVIEW](ASTRA-REVIEW.md). Android/iOS сборки и устройства, TalkBack/VoiceOver, системное масштабирование шрифтов и редакторская проверка KZ в этом прогоне **не выполнялись**. Это проверенное локальное демо; реальные услуги не оказываются.

## Историческая проверка 2026-11-09

Дата: 2026-11-09. Проверяемая сборка: `apps/mobile`, Expo SDK 58, React Native 0.88, React Native Web.

## Автоматические проверки

На текущем исходном состоянии прошли:

| Проверка | Результат |
|---|---|
| `npm test` | 39/39 проверок домена и хранилища пройдены; включая обязательные поля при прямом submit, сериализацию параллельных submit, повтор после отмены, повреждённые ссылки/статусы и сбои read/write/reset. |
| `npm run typecheck` | PASS (`tsc --noEmit`). |
| `npx eslint .` | PASS. |
| `npx expo install --check` | PASS; версии соответствуют установленному Expo SDK. |
| `npx expo-doctor` | PASS, 20/20. |
| `npm run export:web` | PASS; веб-бандл экспортирован (499 KB JS). |

Независимый браузерный прогон Playwright: 20/20 сценариев PASS, включая пустую историю, обязательные поля формы, восстановление выбранного radio со checked state, reload черновика, смену языка, реальный отказ `localStorage.setItem` при submit → retry → одна запись, подтверждение/отказ отмены, полный и отменённый примеры встреч, дубль/повторную запись, отказ/подтверждение reset и повреждённые данные. Ошибок страницы: 0.

Layout QA прошёл 320 и 390 px при 1×/2× web textScale (4/4: `horizontalOverflow=false`). Скриншот 320 px и 2× текста визуально проверен: форма прокручивается, элементы не перекрываются. Увеличение текста в браузере — имитация, не тест нативного системного fontScale.

Keyboard smoke подтвердил видимый фокус клавиатуры: `outlineStyle=auto`, `outlineWidth=1px` на кнопке смены языка.

## Границы подтверждения

Успешные тесты домена подтверждают переходы локального состояния и сериализацию записи; web preview проверяет веб-адаптацию. Они не подтверждают физические сборки и запуск Android/iOS, доступность с VoiceOver/TalkBack, реальную доступность встреч, пользовательское исследование или проверку казахского перевода носителем языка. Локальные записи не отправляются оператору или серверу. Нативная сборка для этого этапа не обязательна; iOS toolchain на этом Linux-хосте отсутствует.

## Аудит npm

`npm audit` после установки зависимостей: 12 moderate, 0 high, 0 critical. Уязвимости приходят из двух групп:

| Зависимость/роль | Характер | Предлагаемое автоматическое исправление | Решение |
|---|---|---|---|
| `expo` (runtime direct) и его `@expo/cli`, `@expo/fingerprint`, `glob`, `minimatch` | Умеренные advisory в toolchain/зависимостях CLI. | npm предлагает понизить Expo до 52.0.49. | Не применено: ломает требуемую совместимость с текущим SDK 58. |
| `eslint-config-expo` (direct dev), `eslint-plugin-expo`, `@typescript-eslint/*` | Умеренные advisory только в lint/dev цепочке. | npm предлагает понизить конфиг Expo до 6.0.0. | Не применено: несовместимый старый конфиг для SDK 58; lint проходит. |

`npm audit fix --force` не запускался; автоматические major-понижения не применялись. Патч-исправления, совместимого с зафиксированным SDK и конфигом в текущем графе, audit не предложил. Перепроверить audit после обновления Expo-конфигурации до следующей совместимой версии.
