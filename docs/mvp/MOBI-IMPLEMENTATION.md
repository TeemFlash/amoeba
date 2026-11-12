# Mobi: implement the accepted presentation

Date: 2026-11-10. Astra: rules, shared contracts and independent review. Luna: implementation. Root: integration, browser/device checks and necessary Firebase rules deployment. The user's latest **“implement it”** authorizes implementation of the accepted presentation and its requested behaviors in the existing Expo app; no further design approval is needed.

## Scope and preserved foundations

Reference: `apps/mobile/design/index.html`, its 30 frames and `REVIEW.md`. This phase implements welcome, sign-in/sign-up/Google/guest entry, RU/KZ Home and draft continuation, three help categories, conditions, district/date/time/free-text note steps, per-choice review editing, save result, activities and unavailable details, confirmation/review/result, type-filtered requests including cancelled history, explicit cancellation, preserved-choice retry, and Profile language/text-size/sign-out. All strings and errors, not merely the two presentation examples, need RU/KZ.

Keep Expo SDK 58, the custom typed stack, Android BackHandler, Firebase Auth/Firestore adapters, UID isolation, stable operation IDs, existing local fallback and the existing dirty working tree. Do not replace the app with HTML/WebView, add a router/server, reset stored history, rewrite research/HUB material, change package IDs or publish. Root has a pre-change source backup and a 61-test passing baseline. The date/note/new district/navigation changes below explicitly supersede the old closed-list/no-new-state restriction for this phase; demo limitations remain.

## Shared data contract (freeze before parallel work)

Data worker owns `src/domain/*`, `src/storage/repository.ts`, `src/firebase/{applications,intents,firestoreSerialization}.ts`, `firestore.rules`, related unit and rules tests. UI worker owns `App.tsx`, screens, navigation, i18n, theme/components, new preference/guest stores and their tests. Asset worker owns `assets/illustrations/*` and `src/ui/MobiIllustration.tsx`. Do not edit another worker's files; send any interface adjustment through root/Astra. Existing `useFirebaseAccount.ts` is UI/integration-owned; changes to its store interfaces must be coordinated.

```ts
type DateId = 'demo-nov12' | 'demo-nov14' | 'demo-nov17' | 'demo-nov19';
type HelpFormStep = 'district' | 'date' | 'time' | 'note';
// Extend, do not replace, the old unions:
type DistrictId = 'demo-center' | 'demo-left-bank'
  | 'astana-esil' | 'astana-almaty' | 'astana-saryarka' | 'astana-baikonur';
type SlotId = 'demo-morning' | 'demo-afternoon' | 'demo-10-12' | 'demo-14-16';

// Existing HelpDraft fields remain; add:
dateId?: DateId | null;
note?: string;
formStep?: HelpFormStep;
// Keep step: 'form' | 'review'; formStep records the substep.

// Help Entry and help ApplicationIntent add an optional pair:
dateId?: DateId;
note?: string;

// Extend editHelp.patch to Partial<Pick<HelpDraft,
// 'serviceId' | 'districtId' | 'dateId' | 'slotId' | 'note'>>.
// Add command:
{ type: 'setHelpFormStep'; formStep: HelpFormStep }
// Add ErrorCode: DATE_REQUIRED (localized by UI).
```

New drafts always initialize `dateId: null`, `note: ''`, `formStep: 'district'`. Optional note is plain text, maximum 280 JavaScript UTF-16 code units; preserve the user's value without silently trimming/replacing it. Show the limit and reject overlong input. No HTML interpretation. Do not solicit exact address, phone, health or other sensitive details. An empty note is valid; an explicit undefined/null/non-string note is invalid. Date must be a known closed-list ID, not a device-derived “today”.

Export `dates`, `selectableDistricts`, `selectableSlots`, and full lookup/ID collections. New selections offer the four named Astana district examples and 10:00–12:00 / 14:00–16:00. Retain old district/time objects and their labels for existing history/drafts. Never relabel an old generic morning record as an exact appointment. All dates/places remain clearly labelled demonstrations, not live schedule information.

`editHelp` validates allowed fields, updates only the specified fields, preserves operationId and other selections, and changes `step` to `form` when a value changes. Changing category from review edits the draft; it does not discard its date/note or start an unrelated ID. `setHelpFormStep` validates its enum and records form position without inventing missing values. `setDraftStep(review)` and **new** `submitHelp` require service, district, date and slot; missing date yields `DATE_REQUIRED`. Note remains optional. Review edit flows may return directly to review once the new selection is valid.

## Backward-compatible persistence (no destructive migration)

Keep local key `enactus-senior-demo:v1` and `schemaVersion: 1`. New fields are additive. `parseState` accepts existing entries/drafts without them, preserves them when present, and rejects invalid present values. Never automatically overwrite a loaded legacy snapshot merely to add defaults. Old help entries display “Дата не указана / Күні көрсетілмеген” and no note when absent. A legacy unfinished draft is preserved and asks for its missing date before new submission; its other selections stay intact. Resume an old form at its first missing required field; resume an old review with missing date at date selection rather than falsely presenting complete review.

Cloud documents also retain version 1. Help records/intents have exactly two valid shapes: old required fields with **both** dateId/note absent, or those fields plus **both** a valid dateId and bounded string note. Reject partial pairs. Event shape is unchanged. New UI always writes the new pair. Serialization, parsing, intent equality and idempotent transaction matching include the optional pair, including the distinction between absent legacy fields and present new fields. Reusing an ID with a changed date or note must fail. Cancel changes only status/cancelledAt and preserves old/new fields byte-for-byte.

Pending account save intents are already frozen user intentions. The store must read and retry old intents **unchanged**; do not normalize an old pending intent by injecting a date/note or generating a new ID. New drafts may add defaults on the next deliberate edit, but pending save payloads must preserve their original shape. Keep exact-key validation, per-UID queues, compare-before-clear, cleanup-pending handling and session-generation guards. Account draft validation accepts old shapes and the added draft fields, including formStep; corruption stays a visible recoverable error, not a silent empty state.

Update Firestore rules to accept the two help shapes, the union of old/new district and slot IDs, and bounded date/note values. Preserve owner-only access, server timestamps, immutable selections, saved→cancelled-only updates, no deletion/reactivation and active-event atomicity. Narrow deployment of reviewed rules to the **existing** Firebase project is necessary because deployed old rules reject new fields; root performs it only after emulator acceptance and source review. Do not create projects, alter Auth providers, enable billing or loosen unrelated paths. No fallback to silently dropping new fields when rules reject a request.

## Navigation, welcome, preferences and guest

Extend `Route` rather than replace the custom stack. Use `welcome`, `profile`, `help-step` with `{step: HelpFormStep, returnToReview?: boolean}`, `event-confirm` carrying eventId/operationId, and `entry-success` carrying entryId. Retain existing catalog/terms/review/entries/detail/cancel/about/reset/replace routes; `help-form` may remain a compatibility alias that resolves the first missing step. Preserve a visible Back and hardware Back using the same stack. Success Back leads to requests, not the previous save action.

Exactly four top-level tabs: Home, Activities, My requests, Profile. About/how-it-works/reset remain reachable inside Profile. Highlight the correct parent section. It is acceptable to omit tab bars on focused forms as in the accepted board; language switching and Back remain reachable. At large text, adapt/wrap the navigation rather than shrink its font or clip labels.

New separate preference key `mobi-preferences:v1`:

```ts
type Preferences = { version: 1; welcomeCompleted: boolean; textSize: 'standard' | 'large' };
```

Locale remains the existing device-wide `AppState.locale`; do not introduce a second competing language source. On first use show Welcome with large Русский/Қазақша buttons and Start. Persist language and completion before advancing. After welcome: an existing authenticated session goes Home; configured signed-out mode shows sign-in with guest continuation; entirely local mode continues to the local demo. Await the initial auth callback; do not flash another account's state. Preference read/write errors are visible with retry; do not overwrite malformed preferences silently. Never reset application data to recover preference failure.

Standard typography uses the accepted 18–20 body / 26–32 headings / >=56 targets. Large means a real **1.25×** multiplier for app text and inputs through a shared typography context/wrapper; native/system font scaling remains enabled on top. Migrate direct Text/TextInput styles as well as shared components. Do not merely change the sample text. Persist the setting and preserve current screen/draft/locale when it changes.

Configured guest mode can browse **and fill a draft through review**. Persist this new guest draft under `mobi-guest:v1`, separately from legacy local/account keys. A guest draft is either help (HelpDraft fields) or event (eventId, stable operationId). Guest final Save opens auth and captures the intended return route; it never writes an anonymous Firestore document or a local completed request. Invalid Firebase configuration still permits browsing but reports unavailable account saving; it does not masquerade as local mode.

After auth **and account hydration**, transfer only the guest selection that the user explicitly intended to save into that UID's draft, retaining operationId and every selection. Write the destination first and clear the guest source only after success. Return to review; do not auto-submit merely because login succeeded. If the account has a different draft, offer Continue account draft or explicitly replace it with guest choices; if it has an unresolved pending intent, resolve that first. Failed transfer preserves the guest source. UID changes during transfer use the existing generation guard. Never automatically import the old `enactus-senior-demo:v1` history/draft. Entirely unconfigured mode retains the genuine local save/cancel flow and device-only wording.

## Screen behavior and UI integration

- Welcome/auth: use real existing email/password/register/reset/Google actions; add accessible show/hide password controls, guest navigation and clear error states. Do not trim passwords, log credentials, imply cancelled Google sign-in succeeded, or mark native OAuth tested. Preserve existing registration confirmation/password-reset features even if the compact board omits them.
- Home: prominent help/activity cards, compact dignified art, current help/event draft continuation and correct pending wording. Back, language, tabs and reload must preserve the complete draft. The note input needs a latest-value serialized persistence strategy; a slow earlier write must not replace newer typing. Do not wire every keystroke through a busy guard that discards input. Flush captured input before moving steps and verify reload after typing.
- Help: includes/excludes checklist, cost/no-helper caveats, four separate steps with required-field validation, optional text note and Skip, then review. Every choice has a real Edit route, including category. Editing one field preserves all others and returns to review. Existing draft replacement still requires explicit confirmation.
- Activity: status and date visible in catalog; full/cancelled details remain readable with disabled signup and reason. Available detail → **confirmation → review → result**, retaining one operationId through Back/retry. Only review saves. Catalog date/place/language are fixed properties of the selected activity, not new invented editable venue/schedule data: any displayed Edit affordance must return to the actual event selection/details path, never be a no-op. Label it contextually to avoid promising arbitrary venue/date editing. Preserve duplicate handling and re-enrollment after cancellation.
- Result/history: navigate to distinct help/event success only after confirmed storage/Firestore result. State no helper was called and no real event place reserved; accurately distinguish account/local storage. Requests have All / Assistance / Activities filters and include cancelled records. Filtering does not delete entries or hide cancelled history permanently. Saved entries are viewed/cancelled, not edited in place.
- Cancellation: Keep dismisses confirmation; Confirm updates once and returns to retained cancelled detail. Errors remain on recoverable context. Retry of an uncertain save uses the same frozen intent/operation ID and goes to the confirmed result, including when retry originated from Profile. Never generate a second ID merely to clear an error.
- Profile: actual language/text-size controls, session/guest status, sign-in or sign-out, existing About/reset access. Logout succeeds only after Firebase confirms it, hides the previous account immediately on auth-state change, and never clears another UID's data. Preserve pending/draft data under its owner for later recovery.

Visual tokens: background `#E3F0FC`, waves `#D4E6FA`, lavender `#C9D3F8`, butter `#FFF6DC`, navy `#1F2A44`, white surfaces, radius20–24, primary `#2457A7` with white text and `#2196F3` accents. Integrate asset worker's `MobiIllustration` (`scene: 'armchair'|'phone'|'apple'|'tea'|'park'|'game'`, `height=140`, optional ImageStyle); static local requires and decorative accessibility exclusion. No new image/rendering dependency is needed. Bound illustration width beside text; use one outer scrolling flow at large type, safe areas and keyboard-safe reachable actions. The phone presentation is a direction, not a reason to hardcode 844px screen height in the app.

## Execution order and verification gates

1. **Data Luna:** extend enums/catalogs/types; add focused failing tests for new fields, legacy snapshots/intents, changed-intent ID reuse and rules denial, then implement domain/serialization/rules. Send interfaces and passing tests to UI worker. Root can run an early emulator pass.
2. **UI Luna in parallel:** implement independent tokens/components/typography/preferences, navigation, welcome/auth/Profile and screen layouts against the pinned contract. Integrate guest store and new data fields after data interfaces land; asset worker lands the six local scenes. Avoid editing data-worker files.
3. **Integration:** update App conversions and every help intent construction so date/note/formStep are never dropped. Preserve current race/busy/cleanup guards. Wire result navigation, guest handoff/conflicts and all new step/edit flows. Complete bilingual dictionaries and meaningful tests for preferences/guest-transfer/route decisions.
4. **Astra:** independently review changed source, old-data/intent invariants, auth/session boundaries and actual rendered flows; report concrete failures to Luna. Do not call implementation self-review an Astra review.
5. **Root final gates:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run export:web`, `npx expo install --check`, Firestore/Auth emulator suite. Old/new help records and intents, date/note validation, field immutability, auth denial and event-pointer atomicity need emulator coverage. Reject partial date/note pairs, invalid dates, non-string/overlong notes and unrelated fields.
6. **Browser acceptance:** local and emulator modes; first/repeat launch; RU/KZ; actual text-size persistence; guest browse→all choices→auth→review, conflict and failed-transfer recovery; each review Edit; note typing/reload; local and account save/reload; unavailable events; confirm→review→success; double click and retry exactly one entry; filters/cancel/Keep; old records/drafts/pending replay; A→logout→B with delayed responses; invalid config and denied writes. Check 320/390px, standard/large plus 200% text emulation, long KZ, input keyboard focus and no obscured final action. Reuse/extend existing QA scripts rather than silently weakening old assertions.
7. After emulator+review, root deploys only necessary Firestore rules to the existing project and performs a narrowly scoped live synthetic help date/note save/read/cancel smoke, cleaning only its own test records/accounts. Verify old record readability and do not expose tokens/credentials. Record actual deployment/live results separately from emulator evidence.

Update PROGRESS/VERIFICATION and append Astra review with changed paths, evidence and any remaining native limitation. Android/iOS device, TalkBack/VoiceOver, system font scaling, completed Google OAuth and native-language/user research require real tests; web preview or an Android JS bundle cannot establish them.
