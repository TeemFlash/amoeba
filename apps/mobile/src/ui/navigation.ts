import type { EventId, ServiceId } from '../domain/types';
import type { TranslationKey } from '../i18n';

export type Route =
  | { name: 'welcome' }
  | { name: 'home' }
  | { name: 'help-catalog'; returnToReview?: boolean }
  | { name: 'help-terms'; serviceId: ServiceId }
  | { name: 'help-form' }
  | { name: 'help-step'; step: 'district' | 'date' | 'time' | 'note'; returnToReview?: boolean }
  | { name: 'help-review' }
  | { name: 'events' }
  | { name: 'event-terms'; eventId: EventId }
  | { name: 'event-confirm'; eventId: EventId; operationId: string }
  | { name: 'event-review'; eventId: EventId; operationId: string }
  | { name: 'entry-success'; entryId: string }
  | { name: 'entries' }
  | { name: 'profile' }
  | { name: 'account' }
  | { name: 'entry'; entryId: string; source?: 'local' | 'account' | 'legacy' }
  | { name: 'cancel-confirm'; entryId: string; source?: 'local' | 'account' | 'legacy' }
  | { name: 'about' }
  | { name: 'discard-confirm' }
  | { name: 'replace-confirm'; serviceId: ServiceId }
  | { name: 'reset-confirm' };

export const initialRoute: Route = { name: 'home' };
export const routeTitle = (route: Route): TranslationKey => {
  switch (route.name) {
    case 'welcome': return 'welcomeTitle';
    case 'home': return 'homeTitle';
    case 'help-catalog': return 'helpCatalogTitle';
    case 'help-terms': return 'termsTitle';
    case 'help-form': return 'formTitle';
    case 'help-step': return 'formTitle';
    case 'help-review': return 'reviewTitle';
    case 'events': return 'eventsTitle';
    case 'event-terms': return 'eventTermsTitle';
    case 'event-confirm': return 'eventConfirmTitle';
    case 'event-review': return 'eventReviewTitle';
    case 'entry-success': return 'entrySuccessTitle';
    case 'entries': return 'entriesTitle';
    case 'profile': return 'profileTitle';
    case 'account': return 'accountTitle';
    case 'entry': return 'entryDetails';
    case 'cancel-confirm': return 'confirmCancelTitle';
    case 'about': return 'aboutTitle';
    case 'discard-confirm': return 'confirmDiscardTitle';
    case 'replace-confirm': return 'confirmReplaceTitle';
    case 'reset-confirm': return 'confirmReset';
  }
};
