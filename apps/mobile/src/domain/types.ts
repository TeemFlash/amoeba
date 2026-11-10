export type Locale = 'ru' | 'kz';
export type Localized = Record<Locale, string>;
export type ServiceId = 'groceries' | 'home-help' | 'digital-help';
export type DistrictId = 'demo-center' | 'demo-left-bank';
export type SlotId = 'demo-morning' | 'demo-afternoon';
export type EventId = 'tea' | 'walk-full' | 'club-cancelled';
export type EventAvailability = 'open' | 'full' | 'cancelled';
export type EntryStatus = 'saved-demo' | 'cancelled-demo';

export interface Service {
  id: ServiceId;
  title: Localized;
  description: Localized;
  includes: Localized;
  excludes: Localized;
}
export interface DemoEvent {
  id: EventId;
  title: Localized;
  description: Localized;
  dateLabel: Localized;
  place: Localized;
  languages: Localized;
  accessibility: Localized;
  availability: EventAvailability;
}
export interface HelpDraft {
  operationId: string;
  serviceId: ServiceId;
  districtId: DistrictId | null;
  slotId: SlotId | null;
  step: 'form' | 'review';
}
export interface EntryBase {
  id: string;
  operationId: string;
  status: EntryStatus;
  createdAt: string;
  cancelledAt: string | null;
}
export type Entry =
  | (EntryBase & { kind: 'help'; serviceId: ServiceId; districtId: DistrictId; slotId: SlotId })
  | (EntryBase & { kind: 'event'; eventId: EventId });
export interface AppState {
  schemaVersion: 1;
  locale: Locale;
  draft: HelpDraft | null;
  entries: Entry[];
}
export type ErrorCode =
  | 'DRAFT_EXISTS' | 'DRAFT_NOT_FOUND' | 'INVALID_SELECTION'
  | 'DISTRICT_REQUIRED' | 'SLOT_REQUIRED' | 'EVENT_FULL' | 'EVENT_CANCELLED'
  | 'ALREADY_ENROLLED' | 'ENTRY_NOT_FOUND' | 'STORAGE_READ_FAILED'
  | 'STORAGE_CORRUPT' | 'STORAGE_WRITE_FAILED';
export type Result<T> = { ok: true; value: T } | { ok: false; error: { code: ErrorCode; existingEntryId?: string } };
export type Command =
  | { type: 'setLocale'; locale: Locale }
  | { type: 'startHelp'; serviceId: ServiceId; operationId: string; replace?: boolean }
  | { type: 'editHelp'; patch: Partial<Pick<HelpDraft, 'districtId' | 'slotId'>> }
  | { type: 'setDraftStep'; step: 'form' | 'review' }
  | { type: 'discardDraft' }
  | { type: 'submitHelp'; operationId: string }
  | { type: 'enrollEvent'; eventId: EventId; operationId: string }
  | { type: 'cancelEntry'; entryId: string };
export interface Transition { state: AppState; entryId?: string }
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface Repository {
  load(): Promise<Result<AppState>>;
  execute(command: Command): Promise<Result<Transition>>;
  reset(): Promise<Result<AppState>>;
}
