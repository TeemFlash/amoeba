import type { EventId, ServiceId } from '../domain/types';
import type { TranslationKey } from '../i18n';

export type Route =
  | { name: 'home' }
  | { name: 'help-catalog' }
  | { name: 'help-terms'; serviceId: ServiceId }
  | { name: 'help-form' }
  | { name: 'help-review' }
  | { name: 'events' }
  | { name: 'event-terms'; eventId: EventId }
  | { name: 'event-review'; eventId: EventId; operationId: string }
  | { name: 'entries' }
  | { name: 'entry'; entryId: string }
  | { name: 'cancel-confirm'; entryId: string }
  | { name: 'about' }
  | { name: 'cities' }
  | { name: 'sign-in' }
  | { name: 'discard-confirm' }
  | { name: 'replace-confirm'; serviceId: ServiceId }
  | { name: 'reset-confirm' };

export const initialRoute: Route = { name: 'help-catalog' };
export const startupRoute: Route = { name: 'sign-in' };
export const routeTitle = (route: Route): TranslationKey => {
  switch (route.name) {
    case 'home': return 'homeTitle';
    case 'help-catalog': return 'helpCatalogTitle';
    case 'help-terms': return 'termsTitle';
    case 'help-form': return 'helpCatalogTitle';
    case 'help-review': return 'reviewTitle';
    case 'events': return 'eventsTitle';
    case 'event-terms': return 'eventTermsTitle';
    case 'event-review': return 'eventReviewTitle';
    case 'entries': return 'entriesTitle';
    case 'entry': return 'entryDetails';
    case 'cancel-confirm': return 'confirmCancelTitle';
    case 'about': return 'aboutTitle';
    case 'cities': return 'chooseCity';
    case 'sign-in': return 'signIn';
    case 'discard-confirm': return 'confirmDiscardTitle';
    case 'replace-confirm': return 'confirmReplaceTitle';
    case 'reset-confirm': return 'confirmReset';
  }
};
