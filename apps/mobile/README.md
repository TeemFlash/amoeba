# Mobi

При подключённом Firebase житель может подать заявку на бытовую помощь, согласовать встречу с назначенным волонтёром, проверить статус и отозвать заявку. Волонтёр видит открытые заявки, принимает их и отмечает выполнение. Гости видят опубликованные встречи, а жители могут занять место и отменить запись. Приложение поддерживает русский и казахский языки и крупный текст.

Порядок выдачи роли, публикации встреч и проверки рабочего режима описан в [руководстве оператора](../../docs/mvp/FIREBASE-OPERATIONS.md). Исполняемое приложение находится в `App.tsx` и `src/`.

Приложение построено на **TypeScript, React Native и Expo**. Полностью пустая конфигурация Firebase включает прежнее учебное демо с локальным `AsyncStorage`. В подключённом приложении прежние записи жителей доступны через архив демо.

## Запуск

Нужны Node.js и npm. В каталоге `apps/mobile` выполните:

```sh
npm ci
npm run start
```

Expo Dev Tools предложит открыть Android, iOS или web. Для запуска сразу в браузере:

```sh
npm run web
```

Проверенный автономный Android APK находится в `android/app/build/outputs/apk/release/app-release.apk`. APK подписан локальным тестовым ключом и включает ARM64 и x86_64. На эмуляторе Pixel 10 он открыл действующее расписание Firebase и повторно запустился без Metro. Для повторной локальной сборки из сгенерированного каталога `android` на Windows:

```powershell
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '-Pandroid.enableMinifyInReleaseBuilds=false'
```

## Проверки

```sh
npm test                 # домен и сериализованное хранилище
npm run typecheck        # TypeScript без emit
npm run lint             # Expo ESLint
npx expo install --check # совместимость зависимостей с SDK
npm run export:web       # production web bundle
```

## Firebase setup

For this workspace root has already written the genuine web SDK configuration to ignored `.env.local`; do not copy or publish its values. For a separate checkout, copy `.env.example` to `.env.local` and use the Web app values from the provisioned Firebase project. With all five `EXPO_PUBLIC_FIREBASE_*` fields blank the existing local demo is used; partial configuration shows a setup error. See [`FIREBASE-PROVISIONING`](../../docs/mvp/FIREBASE-PROVISIONING.md) for current setup blockers.

To run against local emulators only, set `EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-mobi-rules` and `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1` in `.env.local`, then start Auth and Firestore emulators from this directory with `npx firebase emulators:start --project demo-mobi-rules --only auth,firestore`. The browser preview uses `127.0.0.1`; Android emulator uses `10.0.2.2`. Emulator data is local and is not a live Firebase connection.

Firestore is provisioned in `asia-south1`. For the current rules release and verification results, see [Firebase operations](../../docs/mvp/FIREBASE-OPERATIONS.md). The Google provider is enabled. Native Google login requires a development build and registered platform IDs. Interactive Google sign-in still needs testing on the intended devices.

## Структура

- `App.tsx` — приложение, навигация, boot/retry и завершение команд.
- `src/domain/` — типы, фиксированные учебные каталоги, правила переходов и валидация.
- `src/storage/` — сериализованный repository и адаптер AsyncStorage.
- `src/screens/` — главная, помощь, встречи, история, аккаунт и экран инструкции/сброса.
- `src/firebase/` — Firebase Auth, очереди и статусы рабочих заявок, закрытые сообщения участников, учёт мест на встречах и чтение архива.
- `firestore.rules`, `rules-tests/` — Firestore access rules and emulator security tests.
- `src/ui/` — типизированная навигация, крупные общие компоненты и голубые/лавандовые/кремовые токены.
- `assets/illustrations/` — шесть декоративных сцен, подключаемых через `MobiIllustration` без сетевой зависимости.
- `tests/` — проверки предметных переходов и отказов хранилища.

## Граница демо

Учебный каталог, черновики и история локального режима хранятся отдельно от рабочих заявок. При подключённом Firebase расписание формируется из опубликованных оператором встреч. Принять заявку на помощь может только вошедший волонтёр с выданным доступом.

Web preview и автоматические тесты не подтверждают работу физических сборок Android/iOS или системных дикторов VoiceOver/TalkBack. Web-проверка увеличенного текста не является нативным Dynamic Type тестом. Казахский текст требует редакторской проверки носителем языка; иконка Expo пока шаблонная.

Правила продукта и API: [ASTRA-RULES](../../docs/mvp/ASTRA-RULES.md). Firebase design/checklist: [FIREBASE-DESIGN](../../docs/mvp/FIREBASE-DESIGN.md), [FIREBASE-IMPLEMENTATION](../../docs/mvp/FIREBASE-IMPLEMENTATION.md). План реализации: [IMPLEMENTATION](../../docs/mvp/IMPLEMENTATION.md). Результат review: [ASTRA-REVIEW](../../docs/mvp/ASTRA-REVIEW.md). Проверки: [VERIFICATION](../../docs/mvp/VERIFICATION.md), [browser QA artifacts](../../docs/mvp/qa/README.md). Общий отчёт: [LUNA-REPORT](../../docs/mvp/LUNA-REPORT.md).
