# Помощь рядом — локальное демо

Демо построено на **TypeScript, React Native и Expo** с web preview через React Native Web. `AsyncStorage` сохраняет черновик и историю локально на текущем устройстве или в браузере. В проекте нет backend, API, аккаунтов, платежей, сетевой отправки и свободного ввода персональных данных.

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

## Структура

- `App.tsx` — приложение, навигация, boot/retry и завершение команд.
- `src/domain/` — типы, фиксированные учебные каталоги, правила переходов и валидация.
- `src/storage/` — сериализованный repository и адаптер AsyncStorage.
- `src/screens/` — главная, помощь, встречи, история и экран инструкции/сброса.
- `src/ui/` — типизированная навигация, общие компоненты и зелёно-кремовые токены.
- `tests/` — проверки предметных переходов и отказов хранилища.

## Граница демо

Оба пути — помощь по дому и встречи — используют только вымышленные предложения, места и даты. Плашка сообщает: «Демо. Услуги не заказываются, встречи не проводятся». «Сохранено в демо» означает запись только в локальном хранилище. Приложение не назначает исполнителя или организатора и ничего никому не отправляет.

Web preview и автоматические тесты не подтверждают работу физических сборок Android/iOS или системных дикторов VoiceOver/TalkBack. Web-проверка увеличенного текста не является нативным Dynamic Type тестом. Казахский текст требует редакторской проверки носителем языка; иконка Expo пока шаблонная.

Правила продукта и API: [ASTRA-RULES](../../docs/mvp/ASTRA-RULES.md). План реализации: [IMPLEMENTATION](../../docs/mvp/IMPLEMENTATION.md). Результат review: [ASTRA-REVIEW](../../docs/mvp/ASTRA-REVIEW.md). Проверки: [VERIFICATION](../../docs/mvp/VERIFICATION.md), [browser QA artifacts](../../docs/mvp/qa/README.md). Общий отчёт: [LUNA-REPORT](../../docs/mvp/LUNA-REPORT.md).
