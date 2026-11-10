# Локальная сборка Android APK

Дата: 2026-11-09. Проект: `apps/mobile`, Expo SDK 58. Package ID: `dev.enactus.seniorhelp.demo`.

## Текущий результат

- `android.package` задан в `apps/mobile/app.json` как `dev.enactus.seniorhelp.demo`.
- Выполнен `npx expo prebuild --platform android`; нативный проект сгенерирован Expo в `apps/mobile/android/`.
- Prebuild завершился успешно. Он сообщил предупреждение: для применения `userInterfaceStyle` установите `expo-system-ui`; это предупреждение осталось неразрешённым.
- Запущена локальная release-команда с ABI `arm64-v8a` и JDK 17:

  ```sh
  cd apps/mobile/android
  JAVA_HOME=/usr/lib/jvm/java-17-openjdk \
    ANDROID_HOME=/home/sam/Android/Sdk \
    ANDROID_SDK_ROOT=/home/sam/Android/Sdk \
    PATH=/usr/lib/jvm/java-17-openjdk/bin:/home/sam/Android/Sdk/platform-tools:/usr/local/bin:/usr/bin:/bin \
    ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon
  ```

- По просьбе продолжить сборку в Android Studio CLI Gradle был корректно прерван во время начальной компиляции Expo/React Native Gradle-плагинов. До Android `assembleRelease` задача не дошла. На момент остановки APK отсутствовал; готовый APK, успешный `assembleRelease` и APK-подпись не подтверждены.
- Кэш Gradle и частично загруженные артефакты оставлены на месте. Сгенерированная папка `apps/mobile/android/` также оставлена. В её локальном `gradle/wrapper/gradle-wrapper.properties` URL дистрибутива Gradle 9.4.1 заменён на официальный `downloads.gradle.org` после замера скорости; исходная версия Gradle сохранена. Эта папка игнорируется Git.
- На хосте найден JDK 17 (`/usr/lib/jvm/java-17-openjdk`), Android SDK в `/home/sam/Android/Sdk`, платформы Android 34 и 37. NDK в SDK до остановки не обнаружен; Expo Gradle plugin SDK 58 указывает default NDK `27.1.12297006`. Первая сборка не дошла до стадии, на которой можно было подтвердить его установку или автоматически загрузить.
- Сгенерированный `android/app/build.gradle` назначает `signingConfigs.debug` release-варианту. Если Android Studio завершит эту конфигурацию, подпись будет тестовой локальной debug-подписью, не ключом Google Play и не store release.
- Android Studio открывает `apps/mobile/android` и синхронизирует проект. Для запуска сборки из IDE добавлена общая конфигурация `.run/Build_standalone_APK.run.xml`; она запускает `:app:assembleRelease` с `-PreactNativeArchitectures=arm64-v8a`. Эта конфигурация ещё не запускалась.

## Продолжение в Android Studio

В Android Studio выберите конфигурацию **Build standalone APK** в списке Run и нажмите Run. Она соберёт задачу `:app:assembleRelease` с ABI `arm64-v8a`. APK ожидается в `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. После успешной сборки подтвердите подпись через `apksigner verify --print-certs <apk>`. Сгенерированный release variant назначает тестовую debug-подпись, не ключ Google Play. Конфигурация включает `export:embed` для JS bundle, поэтому APK должен запускаться без Metro; фактический APK и автономный запуск пока не проверены.

## Документация

- [Expo SDK 58: Prebuild](https://docs.expo.dev/versions/v58.0.0/workflow/prebuild/)
- [Expo SDK 58: локальная сборка приложения](https://docs.expo.dev/versions/v58.0.0/guides/local-app-development/)
- [Expo SDK 58: Expo CLI](https://docs.expo.dev/versions/v58.0.0/more/expo-cli/)

Сборка локальная. EAS, публикация и установка на устройство этим шагом не выполнялись.
