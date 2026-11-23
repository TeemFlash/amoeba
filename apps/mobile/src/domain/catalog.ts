import type { DemoEvent, DistrictId, EventId, Service, ServiceId, SlotId } from './types';

export const services: readonly Service[] = [
  {
    id: 'groceries',
    title: { ru: 'Покупки рядом', kz: 'Жақын жерден сатып алу' },
    description: { ru: 'Планирование списка покупок.', kz: 'Сатып алу тізімін жоспарлау.' },
    includes: { ru: 'Список покупок.', kz: 'Сатып алу тізімі.' },
    excludes: { ru: 'Доставка не предусмотрена.', kz: 'Жеткізу қарастырылмаған.' },
  },
  {
    id: 'home-help',
    title: { ru: 'Помощь по дому', kz: 'Үй шаруасына көмек' },
    description: { ru: 'Небольшие дела по дому.', kz: 'Үйдегі шағын шаруалар.' },
    includes: { ru: 'Выбор района и времени.', kz: 'Аудан мен уақытты таңдау.' },
    excludes: { ru: 'Уборка и ремонт не предусмотрены.', kz: 'Жинау мен жөндеу қарастырылмаған.' },
  },
  {
    id: 'digital-help',
    title: { ru: 'Подсказка с телефоном', kz: 'Телефонға қатысты кеңес' },
    description: { ru: 'Подсказки по настройкам телефона.', kz: 'Телефон баптаулары бойынша кеңес.' },
    includes: { ru: 'Объяснение настроек.', kz: 'Баптауларды түсіндіру.' },
    excludes: { ru: 'Удалённого доступа к телефону нет.', kz: 'Телефонға қашықтан қосылу жоқ.' },
  },
];

export const events: readonly DemoEvent[] = [
  {
    id: 'tea', title: { ru: 'Чай и разговор', kz: 'Шай үстіндегі әңгіме' },
    description: { ru: 'Небольшая встреча за чаем.', kz: 'Шай үстіндегі шағын кездесу.' },
    dateLabel: { ru: 'Пример: 20 ноября, 15:00', kz: 'Мысал: 20 қараша, 15:00' },
    place: { ru: 'Условное место; не адрес', kz: 'Шартты орын; мекенжай емес' },
    languages: { ru: 'Русский и казахский', kz: 'Орысша және қазақша' },
    accessibility: { ru: 'Доступность места не проверена.', kz: 'Орынның қолжетімділігі тексерілмеген.' }, availability: 'open',
  },
  {
    id: 'walk-full', title: { ru: 'Неспешная прогулка', kz: 'Баяу серуен' },
    description: { ru: 'Мест нет.', kz: 'Орын жоқ.' },
    dateLabel: { ru: 'Пример: 22 ноября, 11:00', kz: 'Мысал: 22 қараша, 11:00' },
    place: { ru: 'Условное место; не адрес', kz: 'Шартты орын; мекенжай емес' },
    languages: { ru: 'Русский и казахский', kz: 'Орысша және қазақша' },
    accessibility: { ru: 'Доступность места не проверена.', kz: 'Орынның қолжетімділігі тексерілмеген.' }, availability: 'full',
  },
  {
    id: 'club-cancelled', title: { ru: 'Клуб настольных игр', kz: 'Үстел ойындары клубы' },
    description: { ru: 'Встреча отменена.', kz: 'Кездесу өткізілмейді.' },
    dateLabel: { ru: 'Пример: 24 ноября, 16:00', kz: 'Мысал: 24 қараша, 16:00' },
    place: { ru: 'Условное место; не адрес', kz: 'Шартты орын; мекенжай емес' },
    languages: { ru: 'Русский и казахский', kz: 'Орысша және қазақша' },
    accessibility: { ru: 'Доступность места не проверена.', kz: 'Орынның қолжетімділігі тексерілмеген.' }, availability: 'cancelled',
  },
];

export const districts: readonly { id: DistrictId; title: { ru: string; kz: string } }[] = [
  { id: 'demo-center', title: { ru: 'Центр', kz: 'Орталық' } },
  { id: 'demo-left-bank', title: { ru: 'Левый берег', kz: 'Сол жағалау' } },
];
export const slots: readonly { id: SlotId; title: { ru: string; kz: string } }[] = [
  { id: 'demo-morning', title: { ru: 'Утром', kz: 'Таңертең' } },
  { id: 'demo-afternoon', title: { ru: 'После обеда', kz: 'Түстен кейін' } },
];
export const serviceIds = new Set<ServiceId>(services.map((item) => item.id));
export const eventIds = new Set<EventId>(events.map((item) => item.id));
export const districtIds = new Set<DistrictId>(districts.map((item) => item.id));
export const slotIds = new Set<SlotId>(slots.map((item) => item.id));
