# Mobi

Реализован интерфейс из принятого дизайн-борда: RU/KZ, welcome и гостевой режим, четыре вкладки, отдельные шаги района/даты/времени/пожелания, редактируемая проверка выбора, сохранение и подтверждённая отмена, встречи со статусами, фильтры истории и настройка крупного текста. Шесть локальных иллюстраций находятся в `assets/illustrations`. Вход переносит гостевой выбор в аккаунт без автоматического сохранения заявки.

Текущие результаты: [verification](../../docs/mvp/VERIFICATION.md), [independent Astra review](../../docs/mvp/ASTRA-REVIEW.md). Статический борд остаётся в [design/index.html](design/index.html); исполняемое приложение — `App.tsx` и `src/`.

Демо построено на **TypeScript, React Native и Expo** с web preview через React Native Web. В локальном режиме `AsyncStorage` сохраняет черновик и историю на текущем устройстве или в браузере. По явному запросу пользователя добавлены Firebase Auth и Firestore для аккаунтов и сохранённых заявок. Live email/password регистрация, заявки, reload, cancel и изоляция пользователей проверены браузерным smoke; интерактивный Google OAuth и native device sign-in не проверены. Статус: [`FIREBASE-PROVISIONING`](../../docs/mvp/FIREBASE-PROVISIONING.md). Примеры услуг и встреч вымышлены.

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

Firestore is created in `asia-south1` and reviewed rules are deployed. Live Email/Password sign-in and saves were verified by browser QA. Google provider configuration is enabled and the button opens Google's sign-in page, but interactive Google login remains unverified. Native Google login requires a development build and registered platform IDs; device sign-in and native runtime have not been verified.

## Структура

- `App.tsx` — приложение, навигация, boot/retry и завершение команд.
- `src/domain/` — типы, фиксированные учебные каталоги, правила переходов и валидация.
- `src/storage/` — сериализованный repository и адаптер AsyncStorage.
- `src/screens/` — главная, помощь, встречи, история, аккаунт и экран инструкции/сброса.
- `src/firebase/` — platform auth adapters, Firebase configuration, account repository, scoped intent storage and session guards.
- `firestore.rules`, `rules-tests/` — Firestore access rules and emulator security tests.
- `src/ui/` — типизированная навигация, крупные общие компоненты и голубые/лавандовые/кремовые токены.
- `assets/illustrations/` — шесть декоративных сцен, подключаемых через `MobiIllustration` без сетевой зависимости.
- `tests/` — проверки предметных переходов и отказов хранилища.

## Граница демо

Оба пути — помощь по дому и встречи — используют только вымышленные предложения, места и даты. Это не реальные услуги и не встречи. Без Firebase настройки данные остаются локально; в Firebase-режиме заявки сохраняются в аккаунт, но исполнитель/организатор не назначается. Локальный reset не удаляет облачные заявки.

Web preview и автоматические тесты не подтверждают работу физических сборок Android/iOS или системных дикторов VoiceOver/TalkBack. Web-проверка увеличенного текста не является нативным Dynamic Type тестом. Казахский текст требует редакторской проверки носителем языка; иконка Expo пока шаблонная.

Правила продукта и API: [ASTRA-RULES](../../docs/mvp/ASTRA-RULES.md). Firebase design/checklist: [FIREBASE-DESIGN](../../docs/mvp/FIREBASE-DESIGN.md), [FIREBASE-IMPLEMENTATION](../../docs/mvp/FIREBASE-IMPLEMENTATION.md). План реализации: [IMPLEMENTATION](../../docs/mvp/IMPLEMENTATION.md). Результат review: [ASTRA-REVIEW](../../docs/mvp/ASTRA-REVIEW.md). Проверки: [VERIFICATION](../../docs/mvp/VERIFICATION.md), [browser QA artifacts](../../docs/mvp/qa/README.md). Общий отчёт: [LUNA-REPORT](../../docs/mvp/LUNA-REPORT.md).
