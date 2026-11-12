# Mobi UI implementation work log

2026-11-10. User asked “implement it” after accepting the static design board. Execute `MOBI-IMPLEMENTATION.md`; this work is the actual Expo app, not another presentation.

## Final outcome

Implementation and independent Astra review are complete within source/emulator/web scope. All U1–U12 findings were fixed and verified; later focused checks cover event-draft Home continuation and leaving the root account screen after ordinary sign-in. The ownership/in-progress entries below are chronological notes, superseded by this outcome.

Final evidence: 90 unit checks, 8 emulator rules checks, 22 local UI, 15 account UI, 10 handoff/conflict, 7 recovery, 5 event-resume/auth-navigation checks and 30 responsive cases pass. Typecheck, lint, Expo dependency check, web export and both Android/iOS Hermes exports pass. `git diff --check` passes. Native exports are packaging checks, not device acceptance.

Reviewed Firestore rules were deployed to the existing project and verified byte-for-byte against local source; anonymous read remains 403. Six live SDK checks confirm new/legacy help data, idempotency and cancellation. Both synthetic QA attempts were cleaned; no real user data was changed. See `qa/2026-11-10-implemented-ui/live-data-results.json` and `live-rules-results.json`.

Production web preview: `http://127.0.0.1:8093`, served from `apps/mobile/dist`, exec session 83629. The current live client configuration is bundled; no external hosting or store release was performed. Production first-launch probe reports zero runtime errors/overflow/small targets. Native devices, screen readers and completed Google OAuth remain unverified.

The final responsive rerun completed 30/30 after the last label/navigation changes. Root stopped the temporary Metro 8091/8092 and Firebase emulator processes after QA; the production preview on 8093 remains available.

## Ownership and state

- Astra (`astra_design`): plan/contract and independent review. Plan and scoped override written. Initial store and data review performed; final recheck pending.
- Luna (`luna_board`): App integration, typed routes, typography/theme/components, bilingual copy, Home/welcome/auth/Profile and HelpScreens. Actively implementing. Owns guest/auth transfer integration, note flushing and preferences use.
- Luna (`luna_data`): domain/catalog/validation, applications/intents/serialization, Firestore rules and tests. Reports completed data changes, 71 focused checks and 8 emulator checks passing. No deployment performed. Source review/recheck and final integration still pending.
- Luna (`luna_illustrations`): six PNG assets and MobiIllustration finished; preference/guest stores and tests finished initially. Now fixes guest ID/review validation and implements EventScreens/EntriesScreen, with explicit ownership confirmed by main UI worker. Coordinates translation keys with main UI worker.
- Root: orchestrates, exports/tests/browser QA, necessary reviewed rules deployment/live smoke, final documentation. Does not label Luna self-review as Astra review.

## Baseline and environment

- Existing dirty work is preserved. Baseline `npm test`: 61/61 passed.
- Pre-change source-only backup: `$env:TEMP\mobi-before-ui-20261110` (no environment credentials).
- Python Playwright/Pillow available through `PYTHONPATH=$env:TEMP\mobi-design-tools`.
- Local development preview is running on `http://127.0.0.1:8091`, with `EXPO_NO_DOTENV=1` and browser auto-open disabled. Exec session 74208. It is local mode and not live Firebase evidence.
- JBR: `C:/Program Files/Android/Android Studio/jbr`. Firebase emulator ports 8080/9099 were shut down after data-worker tests.
- `adb devices` returned no connected device. Native device and screen-reader behavior are not verified.

## Review findings to track

- Data D1: reject partial date/note in serialization instead of silently producing a legacy payload. Worker reports fixed.
- Data D2: changing form substep must also leave review. Worker reports fixed.
- Data D3: account review draft must have district and slot. Worker reports fixed.
- Non-BMP notes: worker emulator test accepts 140 emoji (280 UTF-16 units), rejects 141. Independent final evidence pending.
- Guest G1/G2: same operation-ID regex as account; reject review drafts missing district/time. Store worker is fixing.
- During guest handoff, lock/flush latest note and capture a stable snapshot. ID-only compare-clear does not protect newer typing under the same operation.
- Root early visual feedback: implement the compact approved Home composition, not only recolor old large stacked cards. Main worker reports compact Home rebuilt.

## Remaining gates

Finish integration; run unit/typecheck/lint/export/Expo dependency checks; independent Astra source/rules review; local and emulator browser flows with legacy/new data, note persistence, every Edit, guest/auth handoff/conflicts, retries/cancellation/filtering, actual text-size persistence, RU/KZ and narrow/enlarged layouts. Then narrowly deploy the reviewed rules to existing `mobi-senior-20261110` and live-test synthetic extended help save/read/cancel with cleanup. Update verification/progress/review with actual evidence and native limitations. Do not publish or create a new Firebase project.

## Integration evidence (in progress)

- Root unit run: 90/90 passed; Expo dependency check reports up to date. Main integration typecheck passed before latest review fixes; final rerun remains required. Initial lint exposed note ref writes during render, sent to Luna.
- Astra independently re-ran data/store checks (81/81) and Firestore/Auth emulator checks (8/8). D1–D3 and G1/G2 closed. Reviewed rules SHA-256: `d40422286ee0253db267130efb7fa2996f3fe6032abc73c5075d0f1f414a99ba`. No rules deployment yet.
- Root actual local browser checks pass help steps, individual edits, reload/resume, local save, Keep/confirmed cancellation, unavailable activity states and event confirm/review. An intermittent stale note overwrite after editing/language switch was reproduced and sent to Luna; it is not accepted as passing yet.
- Root actual emulator browser first run: 10 checks passed for guest draft date/note, auth gate, registration return to review, exact handoff fields/operation ID, account save/read/reload/cancel and logout isolation. Signed-in sequential edits added after Astra found a distinct stale-closure bug.
- Recovery checks already confirm immediate Back/reload and language note persistence, and preference read Retry. Preference write error was invisible; fix pending.
- Astra UI findings U1–U12 cover account field conversion, full boot retry, preference feedback, handoff intent lifetime, note races, draft replacement confirmation, legacy lookups/source identity, cancelled retry result, signed-in command serialization, transfer retry, and atomic guest replacement. Luna fixes are underway. U8/U9 screen fixes and status green/amber/grey variants reported complete.
- Reusable root QA scripts: `qa/mobi_ui_smoke.py`, `qa/mobi_cloud_ui_smoke.py`, `qa/mobi_recovery_ui.py`, `qa/mobi_handoff_ui.py`. Opt-in live SDK smoke prepared in `qa/mobi_live_data_smoke.ts`, not run before review gates.
- Local Metro: port 8091/session 74208. Emulator Metro: port 8092/session 54245. Firebase emulators: session 58636, project `demo-mobi-rules`. These are isolated from live Firebase.
