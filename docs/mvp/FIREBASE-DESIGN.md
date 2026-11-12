# Firebase accounts and saved applications — Astra

Date: 2026-11-10. Design author: Astra; implementation: Luna; independent acceptance: Astra. This is the concrete contract for the user's request to connect Firebase, add login/logout and save applications. The user clarified **email/password and Google sign-in**, using a **new Firebase project**. Technical choices below are Astra's implementation decisions, not preferences attributed to the user. Project provisioning remains pending authenticated access; this document does not claim a working connection.

## Scope and current behavior

The explicit request overrides the older no-backend/no-account restrictions in AGENTS.md, ASTRA-RULES.md and IMPLEMENTATION.md for Firebase Authentication and Cloud Firestore only. Keep the Mobi visual design, RU/KZ, accessible controls, typed navigation, visible Back and Android BackHandler. Catalogs remain synthetic. Saving an application to the account does not order a service, reserve a real event place, assign a helper or promise a reply.

Today, `App.tsx` owns the command queue and retry UI; `storage/repository.ts` serializes the entire `AppState` into `enactus-senior-demo:v1`. Pure transitions validate help/event choices, preserve operation IDs, retain cancelled records and prevent duplicate active event entries within that local state. There is no authentication or server. Preserve existing dirty changes and research/HUB materials.

When Firebase is configured, the new behavior is: browse examples without login; sign in/create an account before creating a new application; save confirmed applications under that Firebase UID; reload them after signing back in, including on another device; cancel an application with the existing explicit confirmation. Put a clearly labeled Account entry in the current navigation. While signed out, My Applications offers sign-in and separately labeled historical device examples. When Firebase is entirely unconfigured, preserve the existing working local demo repository and flows; Account explains that connection setup is needed. Explicitly distinguish this local mode in the UI. Partial/invalid configuration is a setup error, never an automatic fallback after a cloud error.

## Chosen approach

Use the modular **Firebase JavaScript SDK** for Authentication and Firestore on Android, iOS and web. Install a compatible current version through `npx expo install firebase` and keep the lockfile. The app is Expo SDK 58; the current Expo guide requires Firebase 12 or later. This preserves one data/auth implementation and the existing web preview. [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/), [SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/).

Use `@react-native-google-signin/google-signin` Original API on native platforms, obtaining the Google ID token and exchanging it with `GoogleAuthProvider.credential` and `signInWithCredential`. Use Firebase `signInWithPopup` on web, started directly from the user's button press. Put these in platform-specific files so web never imports the native module. This is a deliberate minimal choice; native Google requires a **development build**, not Expo Go. The current Expo guide also offers Nitro Google Sign-In, but adopting another native integration is unnecessary for this slice. [Expo Google authentication](https://docs.expo.dev/guides/google-authentication/), [Google Sign-In Expo setup](https://react-native-google-signin.github.io/docs/setting-up/expo), [Firebase Google authentication](https://firebase.google.com/docs/auth/web/google-signin).

Alternatives considered: React Native Firebase would add native Auth/Firestore setup plus a separate web adapter; an email-only Expo Go implementation would omit the user's Google requirement. Neither is chosen. No custom server, Cloud Functions, Storage bucket or analytics is required.

## Account behavior

- Provide email/password registration, sign-in, password reset, Google sign-in and logout. Account creation is necessary for a new project. Use Firebase's configured password policy and map errors to human RU/KZ text; never trim a password or log credentials. Password reset uses a neutral success message. Clear password fields after completion or leaving the form.
- Native Auth initializes once with `initializeAuth` and `getReactNativePersistence(AsyncStorage)`; web uses browser auth persistence. Wait for the first auth-state callback before deciding whether an account is signed in. The SDK owns session persistence; never write tokens into application snapshots or describe AsyncStorage as encrypted. [Firebase Auth persistence API](https://firebase.google.com/docs/reference/js/auth#getreactnativepersistence).
- Display the current account email and a clear Logout action. Logout ends the Firebase session and clears the native Google sign-in selection where supported, without revoking Google access or deleting applications. Handle provider cancellation as cancellation, not a failed application save. Surface blocked popup, missing native capability and missing configuration honestly.
- Identity is **UID**, never email. Do not copy documents between accounts based on matching emails. If Firebase reports a provider conflict, explain that the existing sign-in method is needed; do not silently create/merge accounts. General account linking and account deletion are outside this request.
- A session generation counter guards every async completion. On any UID change/logout, detach old listeners and immediately clear visible entries, account draft, pending actions, errors and navigation details. The next account loads from its own namespace. In-flight results for an old generation must not alter the new UI or trigger retries under a new UID. Capture UID in each repository operation; never look up a different current UID when a delayed operation runs.

## Data and save contract

Use separate documents, not one growing array snapshot:

```text
users/{uid}/applications/{operationId}
users/{uid}/activeEvents/{eventId}
```

Application documents carry schemaVersion 1, the existing discriminated help/event fields, `id = DEMO-<operationId>`, operationId, `status: saved-demo | cancelled-demo`, and Firestore timestamps `createdAt`/`cancelledAt` (null until cancelled). Ownership follows the UID path; no email, password or Google token belongs in a document. Convert timestamps to ISO strings at the existing domain boundary, validating all incoming fields. Unknown/corrupt records cause a visible data error; never silently replace cloud state with empty history.

Drafts and locale remain local. Keep account drafts and any unresolved save intent under a **UID-scoped** storage key. Locale may be device-wide. A pending intent contains its UID, stable operation ID and frozen selected fields, persisted before the first network attempt. This includes event review, whose current operation ID exists only in navigation. Generate new operation IDs with Expo Crypto UUIDs. Changing a failed save's content requires a genuinely new intention; retry keeps the original ID and fields.

Cloud mutations use transactions:

1. **Help:** read the operation document; if it already exists with matching kind/selection, return it unchanged, even if cancelled. Otherwise validate the draft and create the document with server timestamps. A mismatched reuse of the ID is an error.
2. **Event:** read the operation document first, then the event's active pointer. Return a matching previous operation unchanged. If another active record exists, return `ALREADY_ENROLLED` and its ID. Otherwise validate the catalog availability and atomically create the application plus active pointer. Full/cancelled examples remain unavailable. The transaction and rules must agree on active-pointer consistency.
3. **Cancel:** read the application. An already-cancelled record returns unchanged, preserving the first cancelledAt. Otherwise set cancelled status/server timestamp; for an event, atomically release its matching active pointer. Never release another application's pointer. Cancellation cannot reactivate or edit the saved selection.

All transaction reads precede writes. Transaction callbacks are pure and may be retried; do not set UI state inside them. Server success is shown only after transaction completion; local draft cleanup failure must not cause a confirmed cloud save to be reported as unsaved or create another ID. Preserve the known remote result, allow local cleanup retry, and reconcile on next load. [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

Firestore rules are mandatory before connecting a writable real project: deny anonymous access and other UIDs; allow only declared fields/types/enums and consistent document IDs; create only saved-demo records with server timestamp; allow only saved-to-cancelled updates with immutable identity/selection/createdAt; deny application deletion and reactivation. Event application and active-pointer changes must be checked together using `getAfter` so a client cannot bypass the one-active-event invariant. Default deny every other path. Test rules with two UIDs, unauthenticated clients and direct invalid writes.

## Network and history behavior

The first release requires a connection to load account history and confirm save/cancel. A loading or failed history read is not an empty history. Offer Retry; do not start destructive resets or silently switch to local saving. Refresh cloud history on account entry and successful mutation; a realtime listener is optional, not required to promise reload-on-another-device behavior.

Firestore JS in React Native does not provide durable Firestore persistence. Do not enable browser persistent Firestore caches for this release; use memory cache consistently. There is no background offline outbox or claim of automatic offline sync. Offline transactions fail; a lost response may leave the outcome unknown. Show a localized confirmation failure, retain the intent and ID, and retry/reconcile the same document. A timeout does not cancel an underlying network call; stale completions still require session/operation guards. [Firebase supported environments](https://firebase.google.com/docs/web/environments-js-sdk), [transaction behavior](https://firebase.google.com/docs/firestore/manage-data/transactions).

Existing `enactus-senior-demo:v1` data remains untouched by account operations. Do not automatically upload or assign old device examples/drafts to the first account. In configured mode, show old entries separately as read-only **On this device — previous demo** history; old unfinished drafts must not become an account draft without a future explicit import feature. In entirely unconfigured local mode, preserve all existing create/edit/cancel/draft behavior and its local-only wording. The legacy reset remains a separately confirmed action affecting only that key. A local reset must never delete cloud applications or sign out the Firebase session.

Replace now-false text such as “stored only on this device” for new account records with “Saved in your account. This is a demo; no service has been ordered.” Explain local drafts versus saved account records in About. Keep the persistent demo notice and DEMO identifiers. Do not claim data was sent to a service provider.

## Configuration and real-project setup

Create a new Firebase project after account/plugin access is available. Use Firestore Standard/Native mode with restrictive rules, enable Email/Password and Google in Firebase Auth, and register web, Android and iOS app identifiers. Keep Android `dev.enactus.seniorhelp.demo`; use the same identifier for the new iOS bundle ID unless provisioning reveals a conflict. Configure Google support email from the authenticated owner's project setup, authorized web domains (including the local preview hostname), web OAuth client ID, native app registration, Android signing fingerprints, and iOS URL scheme/client ID. Obtain Android/iOS Google service config from the actual project. The Google native adapter requires a **web-type** OAuth client ID to receive an ID token. [Google integration notes](https://react-native-google-signin.github.io/docs/integration-notes).

Use `.env.example` with `EXPO_PUBLIC_FIREBASE_*` client configuration and explicit Google client configuration; document how to copy actual project values into ignored local configuration. Client Firebase values are not admin secrets. Never bundle service-account credentials, OAuth client secrets or admin tokens. Validate required fields before initialization; missing config should keep browsing usable and show Account unavailable with setup guidance, never fake successful auth/saving. Native plugin configuration must not refer to nonexistent placeholder service files.

Select and record the actual Firestore location before creating the database; do not silently incur billing or enable unrelated products. Auth/plugin access, project values, signing fingerprints and iOS build access are setup dependencies, not architecture choices to push back to the user. No publishing/store submission/EAS update is part of this request. Local development builds are needed to validate native Google.

## Implementation and acceptance

Luna should first add narrow platform Firebase/auth adapters and a testable account/application service, then wire the existing UI and RU/KZ copy. Reuse domain validation where correct; do not replace the pure legacy repository with Firebase calls hidden in its storage adapter. Add Firebase config, rules and emulator test setup, and update current project instructions with this scoped override while preserving historical reviews.

Required evidence:

- Existing domain/storage suite plus focused tests for stable retries, mismatched IDs, remote success/local cleanup failure, cancellation timestamps, account A → logout → B while A's read/write is delayed, UID-scoped pending intent recovery, and no automatic legacy migration.
- Firestore emulator tests for owner-only access, field validation, immutable history, no reactivation, simultaneous event enrollment and pointer/application atomicity. Mocks alone do not establish rules safety.
- `npm test`, `npm run typecheck`, `npx expo lint`, `npm run export:web`, `npx expo install --check`.
- Web flow: register/sign in, save help/event, reload, logout, second-account isolation, sign back in/history, cancellation and duplicate retry; Google popup real-project smoke when available; network/error/config-missing states; RU/KZ and narrow layouts for account fields.
- Native development build/device checks for Google token exchange, returning from account picker, logout/account selection, auth persistence after restart and UI accessibility. Web export/emulators do not prove these work. iOS requires accessible Apple tooling; explicitly report any unperformed platform checks.

Report separately: source implementation, emulator validation, deployed real-project configuration, actual web login, actual Android login and actual iOS login. Do not call the app “connected” solely because an SDK was installed or placeholders compile. Astra reviews Luna's changes independently and records evidence and remaining setup limitations in ASTRA-REVIEW.md.
