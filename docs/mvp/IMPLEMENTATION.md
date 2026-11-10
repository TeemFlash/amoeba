# Исполнимое задание Luna: локальное демо

> Реализатор: Luna. Архитектура и приёмка: Astra. Применяется [ASTRA-RULES.md](ASTRA-RULES.md). Сначала выполнить эти четыре партии, затем передать основной ветке/агенту проверяемый результат. Не расширять приложение до реальной услуги. Не запускать дополнительных агентов. Прежние UX-only формулировки описывают предыдущий этап, а не запрет текущего поручения.

## Расположение и API

Всё приложение в `apps/mobile/`. Существующие исследовательские материалы не удалять. Создать:

```text
apps/mobile/
  App.tsx                         # провайдер состояния, загрузка, общий каркас
  app.json, package.json, package-lock.json, tsconfig.json
  src/domain/types.ts             # типы ASTRA-RULES и Command/Result ниже
  src/domain/catalog.ts           # только синтетические RU/KZ предложения
  src/domain/transitions.ts       # чистые переходы и начальное состояние
  src/domain/validation.ts        # валидация/нормализация snapshot
  src/storage/repository.ts       # сериализованная запись, чтение, reset
  src/storage/asyncStorage.ts     # единственный адаптер реального хранилища
  src/i18n.ts                     # полный typed dictionary RU/KZ
  src/ui/theme.ts                 # цвета, размеры, spacing
  src/ui/components.tsx           # Screen, Button, Card, Notice, Choice
  src/ui/navigation.ts            # Route union, stack/back helpers
  src/screens/HomeScreen.tsx
  src/screens/HelpScreens.tsx     # каталог, условия, форма, review
  src/screens/EventScreens.tsx    # каталог, условия, review
  src/screens/EntriesScreen.tsx   # список, детали, подтверждение отмены
  src/screens/AboutScreen.tsx     # инструкция, язык, reset
  tests/domain.test.ts
  tests/repository.test.ts
  README.md                       # запуск, demo boundary, где хранятся данные
docs/mvp/VERIFICATION.md           # команды/результаты, реальные ограничения
```

Не создавать отдельный сервер. Не использовать DOM-элементы в мобильном UI: React Native primitives и RN Web. Простая навигация с типизированным стеком и Android `BackHandler` допустима; router не обязателен. Обратная история браузера не обещается при собственном стеке; видимый Back обязателен.

```ts
type ErrorCode = 'DRAFT_EXISTS' | 'DRAFT_NOT_FOUND' | 'INVALID_SELECTION'
  | 'DISTRICT_REQUIRED' | 'SLOT_REQUIRED' | 'EVENT_FULL' | 'EVENT_CANCELLED'
  | 'ALREADY_ENROLLED' | 'ENTRY_NOT_FOUND' | 'STORAGE_READ_FAILED'
  | 'STORAGE_CORRUPT' | 'STORAGE_WRITE_FAILED';
type Result<T> = { ok: true; value: T } | { ok: false;
  error: { code: ErrorCode; existingEntryId?: string } };
type Command =
  | { type: 'setLocale'; locale: Locale }
  | { type: 'startHelp'; serviceId: ServiceId; operationId: string; replace?: boolean }
  | { type: 'editHelp'; patch: Partial<Pick<HelpDraft, 'districtId' | 'slotId'>> }
  | { type: 'setDraftStep'; step: 'form' | 'review' }
  | { type: 'discardDraft' }
  | { type: 'submitHelp'; operationId: string }
  | { type: 'enrollEvent'; eventId: EventId; operationId: string }
  | { type: 'cancelEntry'; entryId: string };
type Transition = { state: AppState; entryId?: string };
function initialState(): AppState;
function transition(state: AppState, command: Command, now: string): Result<Transition>;
function parseState(raw: string): Result<AppState>;
interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
interface Repository {
  load(): Promise<Result<AppState>>;
  execute(command: Command): Promise<Result<Transition>>;
  reset(): Promise<Result<AppState>>;
}
function createRepository(storage: StorageAdapter, now: () => string): Repository;
```

`transition` не мутирует вход; ошибки не меняют state. `parseState` не доверяет TypeScript-cast JSON. `execute` вызывается после успешного load; до load UI заблокирован. В случае вызова до загрузки repository возвращает `STORAGE_READ_FAILED`, ничего не пишет. `reset` разрешён и из экрана ошибки чтения после пользовательского подтверждения. Ошибки `removeItem` отображаются как `STORAGE_WRITE_FAILED`, видимый state не сбрасывается.

ID операции создать в UI один раз перед началом черновика/переходом к event review; использовать надёжный локальный генератор (`expo-crypto.randomUUID` с совместимой зависимостью допустим). ID и timestamp инъецируются/фиксируются в тестах, DOM/React не нужны для доменной проверки. При отправке из сохранённого review брать operationId черновика. У event review сохранить ID между повторами/перерендерами. Новый ID только для нового пользовательского намерения; double tap не новый intent.

## Партия 1 — домен, хранилище и запускаемый каркас

1. Создать Expo TypeScript приложение в `apps/mobile` (blank TypeScript шаблон или минимальный совместимый manifest), поставить web support и AsyncStorage через Expo installer, сохранить lockfile. Поддерживаемая текущая стабильная версия, без `--force`/`--legacy-peer-deps`. Native build сейчас не обязателен; зависимости должны соответствовать SDK.
2. Написать тесты перечисленных переходов: отсутствующие поля, помощь успешно сохранена, duplicate operationId, отмена/повтор отмены, full/cancelled события, активный дубль встречи, новая запись после отмены, setLocale без изменения данных. Затем чистую реализацию домена.
3. Реализовать хранение через инъецируемый adapter и последовательную очередь. Тесты: null → initial; валидный round trip; повреждённый JSON/неизвестная версия/невалидные enum/дубликаты → STORAGE_CORRUPT; rejected read; rejected write без подтверждённого успеха; retry после ошибки; две параллельные команды не теряют изменения; reset с исключением не очищает UI.
4. Добавить скрипты `start`, `web`, `typecheck`, `test`, `export:web`. Для доменных тестов допустим `tsx --test tests/*.test.ts` и встроенный `node:assert/strict`; не подключать тяжёлый тестовый стек ради чистых функций.

Готовность: `npm run test`, `npm run typecheck`, простая стартовая страница. Эта партия заканчивается кодом и успешными доменными проверками, не очередным планом.

## Партия 2 — бытовая помощь и история

1. Создать словарь, theme и общие доступные компоненты. Каркас с demo-плашкой, названием, RU/KZ, тремя разделами и видимым Back. Обработать loading/read error/corruption до показа изменяющих кнопок.
2. Реализовать главную, каталог из трёх услуг, условия (состав, исключения, неизвестная стоимость, отсутствие исполнителя), выбор из двух районов/двух интервалов, review и «Изменить». Выборы сразу сохраняются как черновик. Для неуспешного сохранения держать пользовательский выбор в текущей форме, показать ошибку/повтор; не потерять ввод при смене языка.
3. Итог после успешного `submitHelp`: перейти на детали обращения, показать ID с префиксом DEMO и точное значение статуса. «Мои обращения» показывает новые сверху, тип, название, время локального создания и статус; пустой экран ведёт к двум задачам.
4. Реализовать детали и отдельное подтверждение отмены. Черновик можно продолжить/удалить с подтверждением; начало другой услуги не затирает старый без подтверждения.

Готовность: основной сквозной путь и восстановление черновика/истории после reload. Никаких подставных экранов «успех» без записи.

## Партия 3 — встречи и завершённая RU/KZ версия

1. Каталог встреч: open/full/cancelled, видимые причины. Детали включают учебную дату/место, язык, отсутствие реального организатора, неизвестную доступность и стоимость. Подтверждение перед локальной записью.
2. Активный дубль ведёт к прежней записи; отменённая запись остаётся в истории; повторная новая запись после отмены допустима. Все действия используют тот же repository.
3. «Об приложении»: инструкция, описание локального хранения, отсутствие отправки/оператора/реальных встреч, выбор языка и подтверждаемый сброс демо.
4. Проверить полноту ключей RU/KZ типизацией; не оставлять русские ошибки/условия в KZ-ветке. Полный проход со сменой языка на review; выбранные значения и текущий экран сохраняются.

Готовность: оба сценария, язык и reset работают. Нет кликабельных кнопок, обещающих нереализованную возможность.

## Партия 4 — проверка, исправления и передача

1. Выполнить `npm run test`, `npm run typecheck`, `npm run export:web`, `npx expo install --check`; исправить относящиеся к реализации ошибки. `expo-doctor` при доступности добавить как проверку окружения. Не менять unrelated research/docs ради зелёного отчёта.
2. Запустить web preview на свободном loopback-порту. В доступном браузере пройти оба пути, локальную историю после reload, отмену с отказом/подтверждением, смену RU/KZ, full/cancelled, черновик и reset. Проверить 320px/390px, длинные RU/KZ подписи, крупный текст/zoom, отсутствие перекрытия содержимого нижней навигацией, контраст и клавиатуру. Если native/браузерного инструмента нет, сообщить родителю конкретный способ запуска и что ещё надо проверить; не выдумывать скриншоты.
3. Обновить корневой README: теперь есть **локальное демо**, ссылка на `apps/mobile`, две команды запуска, стек, boundaries; исторические UX-документы остаются основаниями. В `docs/mvp/VERIFICATION.md` записать фактические команды, их результат, сценарии и непроведённые проверки Android/iOS/TalkBack/VoiceOver/с носителем KZ.
4. Передать Astra/основному агенту изменённые пути, URL preview/команду запуска, результаты и известные ограничения для review. Не делать публикацию, релиз, платежные/внешние интеграции. Не называть локальное демо готовым реальным сервисом.

Готовность: воспроизводимое демо, проверяемые исходники и честный отчёт. Если окружение ограничивает одну проверку, закончить остальной исполнимый scope и отдельно назвать блокировку.
