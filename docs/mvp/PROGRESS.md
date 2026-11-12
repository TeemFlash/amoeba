# Журнал реализации

## Header screenshot wrapping — 2026-11-10

User reported that RU/KZ moved below Back/logo in screenshots. Root reproduced the production header at390px: usable width336px, children+gaps336.140625px because logo minimum width110px. Flex wrapping moved the language group; at400px it fit. A single-variable browser probe confirmed the cause. Luna changed only the logo minimum to72px, retaining full text and56px controls. Root production regression16/16PASS (RU/KZ,320/360/390/400,standard/large): no overflow, preserved targets, standard headers≥360px on one row. Typecheck/lint/web export pass. All18 screenshots, friend JPG and share ZIP regenerated; capture script now refreshes the share exports automatically. Evidence: `artifacts/mobi-header/diagnosis.json`, `verification.json`.

## Исправление нижней навигации — 2026-11-10

По скриншоту пользователя Luna заменила текстовые символы на четыре согласованные outline-иконки из native View: дом, люди, список заявок и профиль. Подписи остаются на одной строке; короткие визуальные KZ-метки отделены от полных доступных названий. Сохраняются 18 px и масштабирование текста, цель не меньше 56 px, выделение активной вкладки. Расчёт доступной ширины переключает 4/2/1 колонки без уменьшения шрифта; standard 390 px остаётся одной строкой из четырёх вкладок.

Root: **48/48 browser checks PASS**, runtime errors 0, RU/KZ × 320/360/390 × standard/large × все активные вкладки; проверены фактическая ширина текста без обрезания, одна строка и размеры целей. Typecheck/lint и production web export проходят. Preview на `http://127.0.0.1:8093` и screenshot ZIP обновлены. Артефакты: `artifacts/mobi-navbar/verification.json`; сценарий `qa/mobi_navbar_ui.py`. Нативный system font-scale учитывается в расчёте, но физическое устройство этим web-прогоном не проверено. Данные, Auth и Firestore не менялись.

## Mobi: реализация принятого UI — 2026-11-10

По запросу «implement it» реализован настоящий Expo UI по [MOBI-IMPLEMENTATION](MOBI-IMPLEMENTATION.md), а статический борд сохранён отдельно. Luna выполнила код и иллюстрации, Astra — контракт и независимое ревью, root — интеграционные проверки и узкое обновление правил Firebase. Предыдущие изменения рабочего дерева и исследования сохранены; Git commit/release не выполнялся.

Добавлены отдельные экраны welcome/auth/profile, четыре вкладки, шесть иллюстраций, RU/KZ, устойчивые настройки текста, пятишаговая помощь с датой и пожеланием, Edit каждого поля, отдельный success, подтверждение/проверка записи на встречу, фильтры и отменённая история. Гостевой черновик сохраняется отдельно, переносится после входа с тем же operationId, требует решения конфликта и не отправляется автоматически. Старые записи/черновики и замороженные pending intents совместимы без разрушительной миграции.

Проверки root: unit **90/90**, rules emulator **8/8**, local UI **22/22**, account UI **15/15**, handoff/conflicts **10/10**, recovery **7/7**, responsive matrix **30/30**. Typecheck/lint, Expo compatibility, production web export, Android/iOS Hermes export проходят. Последние бандлы — проверка упаковки JavaScript, не APK/IPA или проверка устройства.

Проверенные правила развернуты только в существующий `mobi-senior-20261110`; live SDK подтвердил новые date/note, чтение старого формата, idempotency, отказ при смене намерения под тем же ID и отмену без изменения выбора. **6 live проверок PASS**, синтетические аккаунты/документы очищены; реальные пользователи не затрагивались. [Артефакты](qa/2026-11-10-implemented-ui), [ревью Astra](ASTRA-REVIEW.md).

Текущий хост Windows; `adb devices` не обнаружил устройство. Android/iOS device runtime, TalkBack/VoiceOver, системное масштабирование и завершённый Google OAuth остаются непроверенными. Исторические записи ниже относятся к прежним этапам.

План: IMPLEMENTATION.md; контракт: ASTRA-RULES.md. Git-репозитория нет; журнал хранится явно здесь, вместо Git-зависимого sdd-workspace. Текущий запрос разрешает реализацию локального демо; UX-only этап 002 сохраняется как историческое основание.

## Проверка плана до реализации

| Задания | Производитель → потребитель / внутренняя согласованность | Решение |
|---|---|---|
| 1 | Тесты переходов и хранения → чистый domain/repository | API задан; ошибки не меняют принятый snapshot |
| 2 | UI помощи → сохранение/отмена | Совпадает с локальными статусами; успех только после записи |
| 3 | Встречи/язык/reset → общий repository | Никаких отдельных обходных записей |
| 4 | Проверки → отчёт и README | Web не заменяет native; явно отмечать пробелы |
| 1 ↔ 2 | Command/Result → help UI | Использовать контракт дословно, стабильно сохранять operationId |
| 1 ↔ 3 | Domain/catalog/repository → event UI | Общий тип Entry, локальный active duplicate guard |
| 1 ↔ 4 | npm scripts → проверка | Имена команд определены |
| 2 ↔ 3 | i18n/theme/navigation → общие экраны | Типизированный полный словарь, язык не меняет экран |
| 2 ↔ 4 | UI помощи → browser smoke | Проверять сохранение после reload и отмену |
| 3 ↔ 4 | Встречи/RU-KZ/reset → browser smoke | Full/cancelled и reset с подтверждением |

Практическое правило: партии последовательны. Luna выполняет код, Astra проверяет итог и при необходимости даёт исправления. Новых финансовых/серверных задач нет.

## Статус

- Astra: правила и план готовы.
- Luna: реализация запущена; Expo TypeScript scaffold, далее домен/хранилище → интерфейс → встречи/RU-KZ → проверки.
- Родитель: окружение Node/npm и Android SDK найдены; аппарат не авторизован adb; iOS недоступен на Linux. Проверка будет в локальном web preview; native проверки не приписываются.

## Независимая приёмка (до выполнения)

- Чистое хранилище: главная и пустая история.
- Помощь: условия → район/интервал → review → изменить → сохранить → reload → отменить (сначала отказаться).
- Черновик: выйти/перезагрузить → продолжить; смена языка сохраняет значения.
- Встречи: доступная → запись → дубль → отмена → новая запись; full/cancelled недоступны.
- RU/KZ: заголовки, данные, ошибки, подтверждение.
- Повреждённое хранилище: ошибка вместо перезаписи; подтверждаемый reset.
- 320/390px, увеличенный текст: действия не обрезаны, горизонтального overflow нет.
- Контраст цветовых пар, клавиатурный focus, runtime errors.
- Native сборка/экранные дикторы/тестирование пожилыми: не считать выполненными по web preview.

## Предварительное ревью Astra

Типы/API согласованы. Переданы Luna 4 дополнения: submit без полей; retry отменённой операции; вложенное повреждение snapshot; отказ/дублирование конечного сохранения. Luna исправляет в реализации. Это ещё не runtime acceptance.

## Партия 1

Luna сообщила: 35 domain/storage checks PASS, typecheck PASS. Типы, каталог, transitions, validation, serial repository реализованы. Astra выполняет read-only review исходников. Родитель не повторяет suite до итогового состояния. Партия 2 в работе.

Родитель подтвердил 35/35 PASS запуском npm test. Astra затем воспроизвёл 4 новых дефекта: failed reload оставляет запись доступной; очистка поля review создаёт invalid snapshot; event с ID draft конфликтует; result разделяет mutable state repository. Переданы Luna для исправления с regression tests. Готовность партии1 условная до re-review.

Партия1 fix round1: R1–R4 закрыты повторным review Astra;39 checks PASS, дополнительные runtime repro PASS. Домен/хранилище приняты; UI не включён в этот verdict.

## Уточнение окружения и инструкций

create-expo автоматически создал вложенный Git в apps/mobile, без initial commit, и staged scaffold. Root по-прежнему не Git. Проверка исходников должна включать untracked, а не только git diff. Автогенерированный apps/mobile/AGENTS.md предписывает Expo Router, тогда как конкретный контракт Astra допускает простой typed stack. Сохраняем конкретное решение Astra для узкого демо; Luna обновляет generic guidance и добавляет lint. При расширении навигации решение потребуется пересмотреть.

## Браузерная проверка

Playwright/Chromium, fresh context localhost:8083:20 functional checks PASS, включая actual rejected localStorage write→Retry→entry, reload, RU/KZ, отмену/Keep+Back, open/full/cancelled event, active duplicate/re-enroll, reset и corrupt storage→KZ. Uncaught page errors:0. Проверка доступности отдельно: aria-checked пока отсутствует в DOM;320px с2x text дал overflow и почти исчезнувшую область контента из-за фиксированной шапки. Эти дефекты переданы Luna и ещё не закрыты. Скрипты/JSON в work/mvp-qa у родителя; итоговые доказательства будут скопированы после исправления.

## Финальная приёмка

R1–R4 и U1–U7 закрыты Astra; блокирующих замечаний нет. Родитель повторил39 unit/storage checks, typecheck, npm lint и полный npx eslint ., web export:PASS. Независимый browser smoke20/20 (включая aria-checked), layout320/390×1x/2x4/4 PASS, basic keyboard focus PASS. Доказательства и повторяемые scripts:qa/README.md. Web export предупреждает только о конфликтующих NO_COLOR/FORCE_COLOR в окружении; сборка exit0.

Ограничения: native APK/IPA/device/dictor/system fontScale и локальные пользовательские интервью не выполнены; KZ требует редактора. npm audit12 moderate без совместимого предложенного patch; destructive major downgrade не применялся. Это локальное demo acceptance, не выпуск реального сервиса.

## Переименование Mobi и исправление перехода — 2026-11-10

По текущему запросу приложения Expo, slug и оба словаря `appName` установлены в `Mobi`; заголовки README и package metadata согласованы. Android package и ключ хранилища сохранены. Astra обнаружила, что runtime-значение шага вне `form`/`review` принималось `setDraftStep` и могло записать snapshot, который затем отвергает `parseState`. Добавлены доменный и repository regression tests; оба падали до исправления. Luna ограничила переход разрешёнными значениями. Проверки npm test и typecheck выполняются после фикса; полный финальный прогон и браузерная проверка остаются у родителя.

Финальный результат 2026-11-10: основной агент подтвердил 41/41 tests, typecheck, lint, web export, Expo install check и expo-doctor 20/20. Production export прошёл browser smoke 20/20, layout 4/4, проверку имени Mobi на RU/KZ, восстановления прежнего черновика и клавиатурного focus. Astra приняла исходники без блокирующих замечаний. Свежие доказательства в `qa/2026-11-10`, подробности и ограничения в `VERIFICATION.md`. Работа выполнена в Git-ветке `feat/mobi-app` на Windows; ранние сведения об отсутствии Git/Linux описывают прежний запуск.

## Визуальный редизайн Mobi — 2026-11-10

По [плану Astra](MOBI-DESIGN.md) обновлены голубая палитра, типографика, скругления и размеры общих компонентов; App shell, шапка и нижняя навигация сохраняют общую прокрутку и подписи RU/KZ. Главная подключает предоставленную локальную иллюстрацию; каталоги, условия, шаги помощи/встреч, история, детали, инструкция и подтверждения получили новую визуальную иерархию. Добавлены локализованные подписи этапов. Domain/storage и действия не менялись. `npm run typecheck` и `npm run lint` — PASS; полный export, сквозной browser smoke и screen/layout QA выполняет основной агент.

Обратная связь Astra по рендеру: исправлены естественный перенос полных подписей нижней навигации без разрыва слов, заголовок reset-confirm в ветке boot error, название формы «Район и время» / «Аудан мен уақыт» и активная вкладка «Об приложении» на reset-confirm. Typecheck/lint и повторный layout/smoke запрошены; финальный QA выполняет основной агент.

Итог основного агента: 41/41 unit/storage tests, typecheck/lint, Expo compatibility и web export PASS. Smoke 20/20; расширенный layout 152/152 (19 состояний, RU/KZ, 320/390px, 1×/2×); исходный layout 4/4; branding/legacy draft/keyboard PASS; контраст 15/15 пар. D1–D4 и web aria-selected/aria-pressed проверены в браузере; финальные скриншоты просмотрены. Артефакты `qa/2026-11-10-design`, отчёт `VERIFICATION.md`. Нативные устройства/дикторы и пользовательское исследование остаются вне выполненной проверки.

## Firebase Auth и заявки — 2026-11-10

По явному запросу пользователя (новый Firebase-проект, email/password + Google sign-in, сохранённые заявки) реализованы конфигурация local/cloud/emulator, platform auth adapters, учётная история и черновики, idempotent save/cancel, pending-intent recovery, сессионные race guards, ограничительные Firestore rules и emulator tests. Режим без Firebase сохраняет прежний local demo; частичная конфигурация не переключается молча на local. Изменения Astra проверила отдельно: заключение по исходникам и исправлениям F1–F7/residual — без новых блокирующих замечаний; Astra независимо подтвердила 61/61 unit tests.

Проверка Luna после последнего ограничения кнопок Continue/Retry во время account hydration: `npm test` **61/61 PASS**, `npm run typecheck` **PASS**, `npm run lint` **PASS** после двух узких исправлений, Expo public config без Google параметров показывает `plugins: []` и сохраняет Android/iOS identifiers. Root подтвердил web export, Expo check и Android JS bundle export PASS (JS bundle не означает тест устройства). Итог root: cloud smoke **15/15 PASS**, legacy smoke **20/20 PASS**, account layouts **24/24 PASS**, Google emulator sign-in/logout **2/2 PASS**, offline/recovery **9/9 PASS**. Firebase rules emulator suite ранее прошёл **6/6**.

Ограничения на момент реализации: Firebase emulator и web preview сами по себе не доказывают live login, Android/iOS build/device behavior или TalkBack/VoiceOver. Синтетические записи не являются реальными услугами. Дальнейшие этапы provisioning и live acceptance записаны ниже и в [FIREBASE-PROVISIONING](FIREBASE-PROVISIONING.md).

## Firebase provisioning — 2026-11-10

Root создал проект `mobi-senior-20261110` (Mobi), зарегистрировал web/Android/iOS apps с bundle/package `dev.enactus.seniorhelp.demo`, создал стандартную Firestore database в `asia-south1` (Mumbai) и успешно развернул проверенные `firestore.rules`. Реальные Web SDK значения находятся только в игнорируемом `apps/mobile/.env.local`; `.firebaserc` указывает новый проект по умолчанию. Web export с project config прошёл. Несвязанный Spark project не менялся, billing не включали.

После этого provisioning пользователь включил Email/Password и Google Auth providers, настроил support email, добавил authorized domain `127.0.0.1` и передал Google web/iOS client values в ignored `.env.local`. Android SHA-1 созданного debug keystore также зарегистрирован; Android/iOS Google native runtime не проверен. Billing не включали. Live-config browser smoke `firebase_live_smoke.py` прошёл **16/16** по фактическим запросам в проект `mobi-senior-20261110`: email/password registration, две изолированные учётные записи, direct Firestore denial B→A, help/event saves, reload, logout и cancel. 0 page errors и 0 HTTP errors; Firestore channel aborts при reload не считаются ошибками. Root подтвердил очистку всех **4** синтетических аккаунтов и **8** их коллекций, реальные пользователи не затрагивались; credentials/tokens не записывались. Google popup открывает `accounts.google.com`, но интерактивный вход не завершён; `liveGoogleOAuthTested:false`. Артефакты в `qa/2026-11-10-firebase/live` и `qa/2026-11-10-firebase/live-google-popup-results.json`. Native device/APK verification остаётся pending.
