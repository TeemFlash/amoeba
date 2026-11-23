# Firebase project provisioning — 2026-11-10

**Operational release, 2026-11-23.** The live default Firestore database in `mobi-senior-20261110` now uses the resident and volunteer rules. Release `e3f9db06-edea-4771-b3e5-11db4ca558e2` became active at 07:00:35 UTC. Its source was fetched after deployment and its SHA-256 matched the rules approved by Astra 6.2 xhigh, `f3bf6e0caa6c81265fa8b435b2da2c96d5bf5b775745fdd550112c70e883d84e`. The previous release was `8d5637af-1a04-43b5-a7d5-3978a2f63dfa`. See the [operations guide](FIREBASE-OPERATIONS.md) for account grants, meeting publication and current checks. The sections below record the earlier demo deployment.

## Project and apps

Root created Firebase project **Mobi**, project ID `mobi-senior-20261110`, project number `550019867322`. The unrelated Spark project was left untouched. Registered applications use package/bundle ID `dev.enactus.seniorhelp.demo`:

| Platform | Firebase app ID | Status |
|---|---|---|
| Web | `1:550019867322:web:7024e92b6950d36b955883` | Registered; SDK configuration is in ignored `apps/mobile/.env.local` |
| Android | `1:550019867322:android:172bfaa7e976e940955883` | Registered; generated debug-keystore SHA-1 registered; device sign-in remains unverified |
| iOS | `1:550019867322:ios:c7b3ef78ba133f0e955883` | Registered; Google iOS client ID / URL scheme in ignored env; device sign-in remains unverified |

Do not copy SDK configuration values into tracked documentation. The CLI project default is recorded in `apps/mobile/.firebaserc`; the genuine web SDK values remain in the ignored `.env.local` file.

## Firestore

Created a **Standard / Firestore Native** database in `asia-south1` (Mumbai), with `freeTier: true`; billing was not enabled. Reviewed local `apps/mobile/firestore.rules` were deployed successfully. Root independently fetched the active deployed rules through the rules API and verified the content exactly matches the reviewed local file. A live unauthenticated list request was denied with HTTP 403. This verifies the deployed access boundary, not authenticated application saves. Evidence: [live-provisioning-results.json](qa/2026-11-10-firebase/live-provisioning-results.json).

`npm run export:web` passed using the genuine project configuration. The live smoke used the export served at `http://127.0.0.1:8098`. The root's existing preview at `http://127.0.0.1:8084` serves the same current static bundle; reload it to use the verified bundle, with no Metro restart required.

## Authentication and remaining setup

Firebase Authentication now has **Email/Password** and **Google** providers enabled, with a support email. Authorized domain `127.0.0.1` was added. The genuine Google web client ID and iOS client ID/URL scheme are in ignored `apps/mobile/.env.local`; Google client configuration was validated against the project. Live Email/Password authentication and application writes are verified by the 16/16 live smoke below. Interactive Google OAuth has not been performed (`liveGoogleOAuthTested: false`).

Android prebuild succeeded and the generated debug-keystore SHA-1 was registered; the Firebase SDK configuration includes the matching Android OAuth client. This does not demonstrate native Google sign-in. No APK/IPA was built or installed; `adb devices` returned no device. iOS/native OAuth still needs a development build and device verification.

## Live browser verification — 2026-11-10

The opt-in live smoke passed **16/16** against the exact project `mobi-senior-20261110`. The test observed `identitytoolkit.googleapis.com` and Firestore paths for the expected project, with 0 page errors and 0 HTTP error responses. It registered two synthetic `@example.test` accounts using Email/Password, saved help and event applications, verified reload, logout, cross-account isolation, direct B→A collection denial, and cancellation. The test did not click Google sign-in and did not send password-reset email. Evidence: [live smoke result](qa/2026-11-10-firebase/live/firebase-live-smoke-results.json).

Interactive Google OAuth remains untested. A separate probe confirmed the Google button opens the real Google sign-in page (`accounts.google.com`) and the form is visible; no user completed sign-in. Evidence: [Google popup probe](qa/2026-11-10-firebase/live-google-popup-results.json). Provider settings and the Google authorization endpoint are recorded in [auth config results](qa/2026-11-10-firebase/live-auth-config-results.json).

Live test accounts were synthetic and are not user accounts. Root verified that all **4** synthetic accounts across the three live QA attempts are absent and all **8** associated collections are empty. No real user accounts were touched. Credentials and ID tokens were not persisted. Cleanup evidence: [live-cleanup-results.json](qa/2026-11-10-firebase/live-cleanup-results.json).

## What this does not establish

- Live Email/Password and Firestore paths verified in web do not establish interactive Google OAuth or native device behavior.
- Emulator checks do not demonstrate live login or live account saves.
- Android/iOS Firebase app registration does not demonstrate native builds, sign-in, or runtime behavior.
- Firebase records in the app remain demonstration requests, not real service bookings.
