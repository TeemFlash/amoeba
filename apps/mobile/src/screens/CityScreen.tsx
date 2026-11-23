import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Locale } from '../domain/types';
import { cityName, filterCities, type CityId } from '../domain/cities';
import { t } from '../i18n';
import { Button, ErrorNotice, Heading, Label, Screen } from '../ui/components';
import { Icon } from '../ui/icons';
import { theme } from '../ui/theme';

export function CityScreen({ locale, selectedCity, error, choose, cancel, disabled = false }: { locale: Locale; selectedCity: CityId; error: string | null; choose: (id: CityId) => void; cancel: () => void; disabled?: boolean }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => filterCities(query, locale), [query, locale]);
  return <Screen>
    <Heading>{t(locale, 'chooseCity')}</Heading>
    <Text nativeID="city-search-label" style={styles.searchLabel}>{t(locale, 'citySearch')}</Text>
    <TextInput nativeID="city-search" value={query} onChangeText={setQuery} accessibilityLabel={t(locale, 'citySearch')} {...( { 'aria-labelledby': 'city-search-label' } as object)} placeholder={t(locale, 'citySearchPlaceholder')} placeholderTextColor={theme.colors.secondary} style={styles.search} autoCapitalize="none" returnKeyType="search" />
    <Label muted>{t(locale, 'cityDemoExplanation')}</Label>
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <View style={styles.list} accessibilityLabel={t(locale, 'chooseCity')}>
      {matches.map(({ id }) => {
        const selected = id === selectedCity;
        const name = cityName(id as CityId, locale);
        return <Pressable key={id} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected }} onPress={() => choose(id as CityId)} disabled={disabled} style={({ pressed }) => [styles.row, selected && styles.selected, disabled && { opacity: 0.55 }, pressed && styles.pressed]}>
          <Text allowFontScaling style={styles.city}>{name}</Text>
          {selected ? <Icon name="check" color={theme.colors.primary} size={24} /> : null}
        </Pressable>;
      })}
      {!matches.length ? <Label>{t(locale, 'cityNoResults')}</Label> : null}
    </View>
    <Button label={t(locale, 'cancel')} kind="secondary" onPress={cancel} disabled={disabled} />
  </Screen>;
}

const styles = StyleSheet.create({
  searchLabel: { color: theme.colors.text, fontSize: 18, lineHeight: 27, fontWeight: '700' },
  search: { minHeight: 56, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface, paddingHorizontal: 14, color: theme.colors.text, fontSize: 18 },
  list: { width: '100%', gap: 8 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface, paddingHorizontal: 16 },
  selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softBlue },
  city: { color: theme.colors.text, fontSize: 18, lineHeight: 27 },
  pressed: { opacity: 0.8 },
});
