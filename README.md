# Amoeba — «Помощь рядом»

Рабочий проект на TypeScript, React Native и Expo для Android, iOS и web preview находится в [`apps/mobile`](apps/mobile). Он демонстрирует бытовую помощь и учебные встречи; данные вымышлены и сохраняются только в AsyncStorage браузера или устройства. Инструкции запуска есть в [`apps/mobile/README.md`](apps/mobile/README.md).

```sh
cd apps/mobile
npm ci
npm run start       # Expo Dev Tools: Android, iOS или web
npm run web         # открыть web preview
```

Проверки проекта:

```sh
npm test
npm run typecheck
npm run lint
npm run export:web
```

Это демо не принимает заказы и не проводит встречи. Нет регистрации, серверной части, платежей, сетевой отправки или ввода персональных данных. Статусы «Сохранено в демо» и «Отменено в демо» описывают только локальную запись на текущем устройстве. Сброс доступен в разделе «О приложении».

Каталоги, тексты и даты — учебные примеры. Web preview не подтверждает работу native сборок, VoiceOver/TalkBack или пригодность для пожилых людей; KZ текст нуждается в редакторской проверке носителем. Иконка Expo временная.

Документы реализации: [IMPLEMENTATION](docs/mvp/IMPLEMENTATION.md), [ASTRA-REVIEW](docs/mvp/ASTRA-REVIEW.md), [VERIFICATION](docs/mvp/VERIFICATION.md), [browser QA artifacts](docs/mvp/qa/README.md), [LUNA-REPORT](docs/mvp/LUNA-REPORT.md). Правила и границы: [ASTRA-RULES](docs/mvp/ASTRA-RULES.md).

Предыдущий контекст проекта и отложенное бюджетное направление: [исследование Luna](docs/ux/luna-research.md), [приоритеты Astra](docs/ux/astra-priorities.md), [STARTUP-PLAN](STARTUP-PLAN.md). Эти материалы остаются исходным контекстом; бюджет не входит в текущий локальный MVP.

## Android Studio

Требуются Node.js/npm, Android Studio и Android SDK. После `npm ci` в `apps/mobile` выполните:

```sh
npx expo prebuild --platform android
```

Откройте `apps/mobile/android` в Android Studio, дождитесь Gradle Sync, выберите конфигурацию **Build standalone APK** и нажмите Run. Она запускает `:app:assembleRelease` для `arm64-v8a`. APK появится в `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Генерируемый Expo Android-проект и локальные ключи не хранятся в Git. Для публикации в магазине требуется собственная release-подпись.

Текущий подтверждённый результат — web-проверки; успешная Android-сборка и установка на устройство пока не подтверждены. Подробности: [ANDROID-BUILD](docs/mvp/ANDROID-BUILD.md).
