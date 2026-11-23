import type { Localized } from './types';

export const cities = [
  { id: 'astana', name: { ru: 'Астана', kz: 'Астана' } },
  { id: 'almaty', name: { ru: 'Алматы', kz: 'Алматы' } },
  { id: 'shymkent', name: { ru: 'Шымкент', kz: 'Шымкент' } },
  { id: 'karaganda', name: { ru: 'Караганда', kz: 'Қарағанды' } },
  { id: 'aktobe', name: { ru: 'Актобе', kz: 'Ақтөбе' } },
  { id: 'taraz', name: { ru: 'Тараз', kz: 'Тараз' } },
  { id: 'pavlodar', name: { ru: 'Павлодар', kz: 'Павлодар' } },
  { id: 'ust-kamenogorsk', name: { ru: 'Усть-Каменогорск', kz: 'Өскемен' } },
  { id: 'semey', name: { ru: 'Семей', kz: 'Семей' } },
  { id: 'atyrau', name: { ru: 'Атырау', kz: 'Атырау' } },
  { id: 'kostanay', name: { ru: 'Костанай', kz: 'Қостанай' } },
  { id: 'kyzylorda', name: { ru: 'Кызылорда', kz: 'Қызылорда' } },
  { id: 'oral', name: { ru: 'Уральск', kz: 'Орал' } },
  { id: 'petropavl', name: { ru: 'Петропавловск', kz: 'Петропавл' } },
  { id: 'aktau', name: { ru: 'Актау', kz: 'Ақтау' } },
  { id: 'temirtau', name: { ru: 'Темиртау', kz: 'Теміртау' } },
  { id: 'turkistan', name: { ru: 'Туркестан', kz: 'Түркістан' } },
  { id: 'kokshetau', name: { ru: 'Кокшетау', kz: 'Көкшетау' } },
  { id: 'taldykorgan', name: { ru: 'Талдыкорган', kz: 'Талдықорған' } },
  { id: 'ekibastuz', name: { ru: 'Экибастуз', kz: 'Екібастұз' } },
  { id: 'zhanaozen', name: { ru: 'Жанаозен', kz: 'Жаңаөзен' } },
  { id: 'zhezkazgan', name: { ru: 'Жезказган', kz: 'Жезқазған' } },
  { id: 'balkhash', name: { ru: 'Балхаш', kz: 'Балқаш' } },
  { id: 'ridder', name: { ru: 'Риддер', kz: 'Риддер' } },
  { id: 'konaev', name: { ru: 'Конаев', kz: 'Қонаев' } },
] as const satisfies { id: string; name: Localized }[];

export type CityId = (typeof cities)[number]['id'];
export const cityIds = new Set<string>(cities.map(({ id }) => id));
export const cityName = (id: CityId, locale: 'ru' | 'kz') => cities.find((city) => city.id === id)!.name[locale];

export function filterCities(query: string, locale: 'ru' | 'kz') {
  const normalized = query.trim().toLocaleLowerCase(locale);
  if (!normalized) return cities;
  return cities.filter(({ name }) => Object.values(name).some((value) => value.toLocaleLowerCase(locale).includes(normalized)));
}
