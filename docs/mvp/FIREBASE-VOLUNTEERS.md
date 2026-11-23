# Volunteer access in the Mobi demo

This document records the earlier demo queue. For the current resident and volunteer workflows, including private coordination and completion, use the [operations guide](FIREBASE-OPERATIONS.md).

A volunteer signs in with an ordinary Firebase account and sees the demo help queue and a profile with personal pickup counts. Help applications submitted from the updated account flow enter the queue. Events, device-only drafts and previously saved applications stay outside it.

## Grant or revoke access

Find the account’s UID in Firebase Authentication. In the matching Firestore database, a trusted project operator creates the document `volunteerRoles/{uid}`. For example, add an informational `grantedAt` timestamp recording when you granted access. **Document existence grants the role. Delete the document to revoke access.** Use the Authentication and Firestore emulators with the same demo project ID for local practice. The mobile client can read only its own grant and cannot list or edit grants.

Rules check the grant on each protected read or write. A volunteer account has no client access to resident applications, including applications the account saved before receiving the role. Removing the grant restores ordinary account access. Prior pickups retain their original attribution.

## Calls and pickup counts

A new cloud help submission writes three documents in one transaction.

| Path | Purpose |
| --- | --- |
| `users/{uid}/applications/{operationId}` | Resident’s private application, including optional note. |
| `users/{uid}/helpCallLinks/{operationId}` | Private, immutable link used when cancelling a published call. Older applications have no link. |
| `helpCalls/{operationId}` | Service, district, slot, optional date represented by a nullable ID, timestamps, pickup state and volunteer attribution. |

All volunteers may query open calls using `status == 'open'`. A successful pickup records the signed-in volunteer’s UID and a server timestamp. Concurrent attempts can award the call once. A resident can still cancel a picked-up request. Cancellation keeps the pickup attribution and removes the call from the open queue.

Profile statistics come from `claimedBy == currentUid`. Every returned call counts as a pickup, including calls the resident later cancelled. Active pickups have status `claimed`. Resident-cancelled pickups have status `cancelled`. These figures describe activity in the demo.

## Release compatibility

Older builds can still save and cancel private help applications using the original schema. They present no volunteer disclosure, so these submissions stay private. The queue and link rules require the corresponding application to be created in the same transaction, preventing retroactive publication of any private request. The updated app publishes its new help submissions atomically and also handles cancellation of published calls. Deploy the compatible rules before distributing the updated app. Existing applications, retries and event registrations retain their original records.

## Verification on 2026-11-23

TypeScript, Expo lint, the web export, 91 unit tests and 14 Firestore emulator tests passed. In Chrome against the local Auth and Firestore emulators, two volunteers opened the same request. The first pickup received credit and the second volunteer saw that the request was unavailable. Cancelling the request as the resident preserved the first volunteer’s pickup and updated their active and cancelled counts. The browser checks also covered role grants and revocation during a session, account switching, reload and the Kazakh profile at 320px with large text.

The volunteer rules await deployment. Native Android and iOS testing is pending. Expo’s online dependency check also flagged existing patch updates for `expo`, `expo-crypto`, `expo-dev-client` and `expo-status-bar`.
