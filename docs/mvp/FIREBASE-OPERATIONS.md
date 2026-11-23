# Mobi operations

The Firebase-backed app has two account roles. Residents request help and register for meetings. Volunteers accept requests, coordinate with the resident and record completion. A guest can browse published meetings. The Firestore console is the operator interface for granting volunteer access and publishing the meeting schedule.

## Enable volunteer access

1. Have the volunteer sign in once using their own account.
2. In Firebase Authentication for `mobi-senior-20261110`, find that account and copy its UID.
3. In the default Firestore database, create `volunteerRoles/{uid}` using that exact UID as the document ID. An informational `grantedAt` timestamp can record when access was granted. The existence of this document grants the role.
4. The signed-in app observes the change. The volunteer can open the queue and view their own assignments. To revoke access, delete the grant for that UID. Coordinate outstanding assignments before revocation.

## Handle a request

A resident selects a category, district, date and time interval in Astana time, reviews who will see their information and submits. The open queue shows scheduling details. Once a volunteer takes the request, the two participants can read the resident’s note and exchange meeting instructions privately. Each participant can replace their own latest message. The resident can withdraw an open or accepted request. The assigned volunteer can mark an accepted request complete. Both participants can check the outcome from their history.

## Publish a meeting

Create one document per confirmed meeting in `operationalMeetings`. Use a stable document ID of 1–128 ASCII letters, digits, underscores or hyphens. Only a trusted operator can edit the schedule. Set the following fields in the Firestore console.

| Field | Firestore type | Value |
| --- | --- | --- |
| `published` | Boolean | Set to `true` when the details are ready for residents. |
| `title` | Map | Nonempty `ru` and `kz` strings, up to 150 characters each. |
| `description` | Map | Nonempty `ru` and `kz` strings, up to 1,000 characters each. Include participation conditions. |
| `place` | Map | Nonempty `ru` and `kz` strings, up to 300 characters each. Use the confirmed public meeting place. |
| `startsAt` | Timestamp | The actual start instant. The app displays Astana time. |
| `status` | String | `open`, `closed` or `cancelled`. |
| `capacity` | Integer | Number of available places at publication. Keep capacity at least as high as the current enrollment count when editing. |
| `enrolledCount` | Integer | Initialize to zero. The app updates this on registration and withdrawal. Preserve the current value when editing the schedule. |

Keep the same document ID when rescheduling. To cancel a published meeting, set `status` to `cancelled` and keep the document published so attendees can see the reason registration closed. A resident’s history retains the details they originally agreed to.

## Demo data

Older app versions wrote synthetic requests to separate collections. Operational requests and meeting registrations use their own collections. A resident can open the labeled demo archive. With all Firebase settings blank the device runs the local demo. An emulator build connects to its own test database. Use that mode when practicing the two-role workflow.

## Verification on 2026-11-23

- The production web bundle opened the live Mobi meeting catalog in Russian and Kazakh. It was empty at the time of the check. No meeting, role grant or request was seeded in production.
- The browser workflow used separate resident and volunteer sessions with the Firebase Auth and Firestore emulators. A resident submitted a request, a volunteer accepted it, both exchanged private instructions and both saw completion after reload. The other volunteer lost access to the claimed item. Revoking the volunteer grant returned the signed-in volunteer to the resident home screen.
- A guest’s reviewed request survived reload and transfer to a signed-in resident, who explicitly submitted it. Withdrawing it preserved a single history entry. A separate meeting test covered bilingual publication, enrollment, rescheduling and returning the seat on cancellation.
- Sol 6.2 implemented the release. Astra 6.2 at xhigh reviewed the role transitions and rules and verified 19 Firestore emulator tests, 91 unit tests, TypeScript and Expo lint. The production rules match the approved SHA-256 recorded in [Firebase provisioning](FIREBASE-PROVISIONING.md).
- The Windows Android build produced a standalone local-test APK with the production Firebase configuration, bundled JavaScript and both `arm64-v8a` and `x86_64` native libraries. It uses the Android debug signing key and APK Signature Scheme v2. The checked artifact’s SHA-256 is `cd627867a68e009d63f91ee0392b0c7562ee35266e89c112c430c4a3100c0b28`. The iOS JavaScript bundle exported successfully. Physical devices, interactive Google sign-in and screen readers still need verification.
- On the Pixel 10 Android emulator the standalone APK opened the live empty schedule and restarted successfully without Metro. In a separate Android development build connected to the Auth and Firestore emulators, a resident signed in with Email/Password, received volunteer access during the session, retained it after a cold start and returned to the resident workspace when the grant was revoked.
- Expo’s SDK compatibility check reports four existing patch-version differences in `expo`, `expo-crypto`, `expo-dev-client` and `expo-status-bar`.
