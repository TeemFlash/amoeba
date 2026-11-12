# Firebase implementation checklist — Luna

2026-11-10. Implement [FIREBASE-DESIGN.md](FIREBASE-DESIGN.md). Astra owns this contract and independent review; Luna owns code/tests. Work in place on the current dirty branch; do not commit, stash, revert prior work or spawn additional agents. Existing baseline: root reports 41/41 tests PASS; root preserved review baseline in `.git/firebase-baseline`. Project and Firestore are now provisioned; Authentication remains blocked pending console setup. See [FIREBASE-PROVISIONING](FIREBASE-PROVISIONING.md).

**Implementation status:** local source, emulator rules and account UI are implemented; Astra's source review found no remaining blocker. Local unit/type/lint checks pass; root confirmed web export, Expo dependency check, Android JS bundle export, cloud smoke 15/15, legacy smoke 20/20, recovery 9/9, Google emulator sign-in/logout 2/2, and 24/24 account layouts. Root provisioned the Firebase project/Firestore and deployed reviewed rules; email/password and Google providers are enabled. Live browser smoke passed 16/16 with two isolated synthetic accounts, live saves, reload, cancellation and direct cross-account denial. Interactive Google login and native device verification remain untested.

## 1. Foundation and configuration

- [x] Inspect SDK 58 package versions; use `npx expo install` for Firebase, Expo Crypto, dev-client and native Google Sign-In as needed. Do not force dependency resolution.
- [x] Add typed configuration parsing and `.env.example`; distinguish entirely absent config (existing local demo), complete config (cloud mode), and partial/invalid config (visible setup error). Never place placeholder project IDs into a live connection.
- [x] Add singleton Firebase initialization with native/web auth persistence in platform files. Add Google adapters: native Original API ID token exchange, web Firebase popup. Native import must not break web or unconfigured Expo Go browsing. Add actual native config conditionally when files/values exist; no nonexistent service-file references.
- [x] Add tests for configuration modes and auth error mapping. Preserve existing storage key and repository behavior.

## 2. Cloud data and security

- [x] Introduce a testable account/application repository with injected remote/local adapters and clock/ID generator where useful. Keep pure legacy domain tests operational; share validation rather than rewriting working local persistence.
- [x] Implement application Firestore serialization/validation and operations: help submit, event submit with active-event pointer, idempotent cancellation. Use operation-document transactions and server timestamps; validate immutable payload on duplicate IDs.
- [x] Persist UID-scoped draft and pending intent before sending. Restore pending event/help intent on restart; retry the same ID and payload. Distinguish remote acknowledgment from failed local cleanup. Never save cloud entries into the device-wide legacy snapshot.
- [x] Add restrictive `firestore.rules`, `firebase.json`, indexes only if required, and emulator/rules test command. Do not deploy to an unidentified project. Cover owner A/B/anonymous isolation, invalid payloads, immutable fields, cancellation, no deletion/reactivation and atomic event pointers.
- [x] Exercise concurrent enrollments and retries against the emulator; mocks do not substitute for rule checks.

## 3. Session and UI

- [x] Add explicit auth/loading/signed-out/signed-in/error state and a session generation guard. Detach listeners and erase visible account data/navigation on UID transition; stale async results cannot update another session. Capture operation UID at creation and execution.
- [x] Add Account route/screen using current RN components and theme: sign-in, create account, reset password, Google, account identity, logout. Label inputs, preserve keyboard usability and supply complete RU/KZ copy. Do not show raw SDK errors, log credentials or persist passwords.
- [x] Keep signed-out browsing; in configured mode, gate start of an application through Account, then return to its catalog/terms (do not auto-submit). Load account applications on login and refresh/retry. Show save/cancel success only after remote acknowledgment.
- [x] Preserve unconfigured local demo behavior. In configured mode, show legacy local history separately/read-only and keep local reset clearly scoped; no silent migration. Add account/cloud-specific wording so new records never say “only on this device.”
- [x] Add focused tests for account changes during delayed loads/mutations, pending-intent recovery, remote-success/local-cleanup-failure, failed reads not appearing empty, rejected saves not appearing successful, and no migration/leak between accounts.

## 4. Project setup and integration

- [x] Coordinate with root once Firebase plugin/account access exists. Project/apps/Firestore are provisioned, reviewed rules deployed, providers enabled, and live Email/Password/application smoke passed. Do not invent project values or enable billing.
- [x] Document local `.env` values, authorized preview domain, Android signing fingerprints, web OAuth client ID, iOS bundle/client ID and URL scheme, service config file paths, and native development build requirement. Record unresolved setup dependencies precisely.
- [x] Keep Google scopes to identity; no server auth-code exchange or custom backend. Logout ends Firebase session even when native provider cleanup fails and never deletes records. Missing native Google support is reported without claiming it works.
- [x] Update current app/root README, AGENTS scoped restriction, ASTRA-RULES override, PROGRESS, VERIFICATION and provisioning record with actual implementation/setup status; preserve earlier historical sections. Astra owns and updated ASTRA-REVIEW.

## 5. Validation and handoff

- [x] Run `npm test`, `npm run typecheck`, `npx expo lint`, `npm run export:web`, `npx expo install --check`; fix attributable issues. Run emulator tests separately with recorded results.
- [x] Supply root browser preview and exact smoke paths: unconfigured legacy flow, configured missing/error states, account registration/login/logout, two-account isolation, help/event saving, retry, reload and cancellation. Root can perform browser/UI checks.
- [ ] Run actual Google web sign-in only when real project config/access is ready. Native Google needs actual dev-build/device verification; report unperformed Android/iOS and screen-reader checks rather than substituting web evidence.
- [x] Hand Astra changed paths, concise design deviations, check outputs, known limitations and real-project setup state. Astra reviewed source; live Email/Password and Firestore saves are verified. Interactive Google OAuth and native device validation remain open and must not be represented as tested.
