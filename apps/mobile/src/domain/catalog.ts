import type { DateId, DemoEvent, DistrictId, EventId, Service, ServiceId, SlotId } from './types';

export const services: readonly Service[] = [
  {
    id: 'groceries',
    title: { ru: 'Покупки рядом', kz: 'Жақын жерден сатып алу' },
    description: { ru: 'Учебный пример помощи с обычными покупками.', kz: 'Күнделікті сатып алуға көмектесудің оқу мысалы.' },
    includes: { ru: 'Список покупок и выбор демонстрационного района.', kz: 'Сатып алу тізімі мен демонстрациялық ауданды таңдау.' },
    excludes: { ru: 'Нет реального исполнителя, заказа и доставки.', kz: 'Нақты орындаушы, тапсырыс немесе жеткізу жоқ.' },
  },
  {
    id: 'home-help',
    title: { ru: 'Помощь по дому', kz: 'Үй шаруасына көмек' },
    description: { ru: 'Учебный пример простой помощи по дому.', kz: 'Үй шаруасына қарапайым көмектің оқу мысалы.' },
    includes: { ru: 'Выбор демонстрационного района и примерного времени.', kz: 'Демонстрациялық аудан мен үлгі уақытты таңдау.' },
    excludes: { ru: 'Нет реального исполнителя, уборки или ремонта.', kz: 'Нақты орындаушы, тазалау немесе жөндеу жоқ.' },
  },
  {
    id: 'digital-help',
    title: { ru: 'Подсказка с телефоном', kz: 'Телефонға қатысты кеңес' },
    description: { ru: 'Учебный пример спокойного объяснения настроек.', kz: 'Баптауларды түсіндірудің оқу мысалы.' },
    includes: { ru: 'Демонстрационный район и примерный интервал.', kz: 'Демонстрациялық аудан мен үлгі аралық.' },
    excludes: { ru: 'Нет реального консультанта и удалённого доступа к устройству.', kz: 'Нақты кеңесші де, құрылғыға қашықтан кіру де жоқ.' },
  },
];

export const events: readonly DemoEvent[] = [
  {
    id: 'tea', title: { ru: 'Чай и разговор', kz: 'Шай үстіндегі әңгіме' },
    description: { ru: 'Учебный пример спокойной встречи.', kz: 'Жайлы кездесудің оқу мысалы.' },
    dateLabel: { ru: 'Учебная дата: 20 ноября, 15:00', kz: 'Оқу күні: 20 қараша, 15:00' },
    place: { ru: 'Демонстрационное место — не адрес для посещения', kz: 'Демонстрациялық орын — баратын мекенжай емес' },
    languages: { ru: 'Язык встречи в демо: русский и казахский', kz: 'Демодағы кездесу тілі: орысша және қазақша' },
    accessibility: { ru: 'Доступность места не проверена.', kz: 'Орынның қолжетімділігі тексерілмеген.' }, availability: 'open',
  },
  {
    id: 'walk-full', title: { ru: 'Неспешная прогулка', kz: 'Баяу серуен' },
    description: { ru: 'Учебный пример встречи со статусом «мест нет».', kz: '«Орын жоқ» мәртебесі бар кездесудің оқу мысалы.' },
    dateLabel: { ru: 'Учебная дата: 22 ноября, 11:00', kz: 'Оқу күні: 22 қараша, 11:00' },
    place: { ru: 'Демонстрационное место — не адрес для посещения', kz: 'Демонстрациялық орын — баратын мекенжай емес' },
    languages: { ru: 'Язык встречи в демо: русский и казахский', kz: 'Демодағы кездесу тілі: орысша және қазақша' },
    accessibility: { ru: 'Доступность места не проверена.', kz: 'Орынның қолжетімділігі тексерілмеген.' }, availability: 'full',
  },
  {
    id: 'club-cancelled', title: { ru: 'Клуб настольных игр', kz: 'Үстел ойындары клубы' },
    description: { ru: 'Учебный пример встречи со статусом «отменена».', kz: '«Өткізілмейді» мәртебесі бар кездесудің оқу мысалы.' },
    dateLabel: { ru: 'Учебная дата: 24 ноября, 16:00', kz: 'Оқу күні: 24 қараша, 16:00' },
    place: { ru: 'Демонстрационное место — не адрес для посещения', kz: 'Демонстрациялық орын — баратын мекенжай емес' },
    languages: { ru: 'Язык встречи в демо: русский и казахский', kz: 'Демодағы кездесу тілі: орысша және қазақша' },
    accessibility: { ru: 'Доступность места не проверена.', kz: 'Орынның қолжетімділігі тексерілмеген.' }, availability: 'cancelled',
  },
];

export const districts: readonly { id: DistrictId; title: { ru: string; kz: string } }[] = [
  { id: 'demo-center', title: { ru: 'Демонстрационный центр', kz: 'Демонстрациялық орталық' } },
  { id: 'demo-left-bank', title: { ru: 'Демонстрационный левый берег', kz: 'Демонстрациялық сол жағалау' } },
  { id: 'astana-esil', title: { ru: 'Есильский район (пример)', kz: 'Есіл ауданы (мысал)' } },
  { id: 'astana-almaty', title: { ru: 'Алматинский район (пример)', kz: 'Алматы ауданы (мысал)' } },
  { id: 'astana-saryarka', title: { ru: 'Район Сарыарка (пример)', kz: 'Сарыарқа ауданы (мысал)' } },
  { id: 'astana-baikonur', title: { ru: 'Район Байконыр (пример)', kz: 'Байқоңыр ауданы (мысал)' } },
];
export const slots: readonly { id: SlotId; title: { ru: string; kz: string } }[] = [
  { id: 'demo-morning', title: { ru: 'Учебный пример: утром', kz: 'Оқу мысалы: таңертең' } },
  { id: 'demo-afternoon', title: { ru: 'Учебный пример: после обеда', kz: 'Оқу мысалы: түстен кейін' } },
  { id: 'demo-10-12', title: { ru: '10:00–12:00 (пример)', kz: '10:00–12:00 (мысал)' } },
  { id: 'demo-14-16', title: { ru: '14:00–16:00 (пример)', kz: '14:00–16:00 (мысал)' } },
];
export const selectableDistricts = districts.filter((item) => item.id.startsWith('astana-'));
export const selectableSlots = slots.filter((item) => item.id === 'demo-10-12' || item.id === 'demo-14-16');
export const dates: readonly { id: DateId; title: { ru: string; kz: string } }[] = [
  { id: 'demo-nov12', title: { ru: '12 ноября (пример)', kz: '12 қараша (мысал)' } },
  { id: 'demo-nov14', title: { ru: '14 ноября (пример)', kz: '14 қараша (мысал)' } },
  { id: 'demo-nov17', title: { ru: '17 ноября (пример)', kz: '17 қараша (мысал)' } },
  { id: 'demo-nov19', title: { ru: '19 ноября (пример)', kz: '19 қараша (мысал)' } },
];
export const serviceIds = new Set<ServiceId>(services.map((item) => item.id));
export const eventIds = new Set<EventId>(events.map((item) => item.id));
export const districtIds = new Set<DistrictId>(districts.map((item) => item.id));
export const slotIds = new Set<SlotId>(slots.map((item) => item.id));
export const dateIds = new Set<DateId>(dates.map((item) => item.id));
