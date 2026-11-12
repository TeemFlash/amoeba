# Mobi — presentation board plan

2026-11-10. Design decisions and independent review: Astra. Implementation: Luna. This is the user's requested **presentation design**, not a change to the running Expo/Firebase application.

## Deliverables and boundary

Create only new files in `apps/mobile/design/`: self-contained editable `index.html` with inline CSS/SVG, reusable SVG illustration sources where useful, a reproducible local export script, `board.png`, individual **390 × 844 px** PNG frames, and a short README recording export and limitations. No remote font/image dependencies. Do not edit application source, packages, existing assets, Firebase configuration, or dirty working-tree files. No commit, publish, login, or live account operations.

The board is a visual specification of requested future UI. Date/free-text note steps, guest entry, profile/text-size controls, and four-tab navigation are design proposals; do not claim they already work in the MVP. The latest explicit user design brief overrides the previous MOBI-DESIGN visual tokens and old closed-list-only design constraint for this isolated presentation. Existing live Email/Password and Firestore web checks do not establish complete Google OAuth, native behavior, screen-reader behavior, or user-tested accessibility.

## Visual system

- Exact requested palette: pale blue `#E3F0FC` ground and `#D4E6FA` quiet wave shapes; white rounded cards; lavender `#C9D3F8`, butter `#FFF6DC`; navy text `#1F2A44`. Secondary text must remain high-contrast (for example `#465873`).
- User blue `#2196F3` is an accent/illustration color. Use existing darker `#2457A7` for white-label primary buttons (about 7:1); white on `#2196F3` is insufficient for normal AA text. State this adjustment in the board's token panel.
- Body and meaningful secondary text 18–20 px; titles 26–32 px; buttons 20 px with minimum 56 px targets, preferred 60 px. Main spacing 16/20/24; card radius **20–24 px**. No tiny disclaimer text or disabled-opacity body copy.
- Each frame is a 390 × 844 viewport, including safe-area allowance. Keep key actions and conditions legible. If content needs scrolling, show a clear continuation cue; never shrink text to pack content. The HTML can scroll within the viewport, while screenshot exports must include each required key state visibly.
- All primary screens show RU/KZ controls with a strong selected state and full text navigation labels. Welcome uses large **«Русский» / «Қазақша»** language buttons. Use visible Back labels on subordinate steps. Exactly four main sections: **Home / Activities / My requests / Profile**, with readable RU or KZ labels and icons and targets at least 56 px. Permit two-line tab labels; do not omit Activities or shrink label text to fit.
- Original flat SVG art: dignified older adults, varied clothing and posture, armchair/phone/apple, tea, park, board game. Art is decorative, uses no embedded UI text, and depicts no assigned helper or real organizer. Prefer ample whitespace and restrained card compositions over ornamental repetition.

## Non-negotiable meaning

Every frame retains visible demo wording: «Демо. Услуги не заказываются, встречи не проводятся.» KZ: «Демо. Қызметтерге тапсырыс берілмейді, кездесулер өткізілмейді.» Synthetic dates, districts and places are marked as examples. No exact addresses, personal contacts, real service claims, medical claims, fake reviews, or promises of a helper response.

Conditions must say «Стоимость не определена. В демо оплаты нет». No «бесплатно». Explain that a real helper/organizer is not appointed; an event venue is demonstrative and not an address to visit; venue accessibility is not verified. Success is «Сохранено в демо» and explicitly «Никому не отправлено. Помощник не вызван.» For events, no real place is reserved. In this board choose the **account demonstration** for saved-state examples: «Демо-запись сохранена в аккаунте»; do not also claim device-only storage. Guest browse leads to sign-in before account saving, with selections retained in the proposed flow.

Review exposes an «Изменить» action for **every choice**, including category, district, date, time and optional note. Changes return to review without losing other choices. Back/language changes preserve a draft. Retry preserves choices and does not falsely claim that a failed write definitely did not happen. Saved requests are not edited in place: cancel via separate confirmation, then start a new example. Cancelled requests remain visible in history. Full/cancelled activities are readable but cannot be joined. Selected/disabled/status/error meaning is communicated in text and shapes, not color alone.

## Frames (28)

| # | Frame | Visible required content |
|---|---|---|
| 01 | Welcome | Mobi, Astana, welcoming older adult/armchair art, clear start action, large Русский/Қазақша language buttons |
| 02 | Sign-in | Email/password fields, visible password label, Google entry, guest browsing, registration link; no supplied credentials |
| 03 | Sign-up | Distinct registration screen, labelled email/password fields, create-account action, Google and guest alternatives |
| 04 | Home RU | Help and activities cards; visible saved draft with Continue; calm illustration; all four tabs |
| 05 | Home KZ | Complete KZ counterpart, same information and selected draft; all four tabs |
| 06 | Help categories | Products, home help, digital help; three large labelled choices |
| 07 | Help detail | Selected service, readable includes/excludes checklist, cost and helper caveats, Continue |
| 08 | District | Step progress, example districts, visible radio selection |
| 09 | Date | Example dates clearly labelled demo, selection, Back/Continue |
| 10 | Time | Two clear intervals, one selected, Back/Continue |
| 11 | Optional note | **Free-text optional note field**, synthetic example value, Skip/Continue; do not substitute a closed-list picker |
| 12 | Review RU | Every chosen field with individual Edit, including free-text note; final demo-save CTA and clear consequence |
| 13 | Review KZ | Fully translated counterpart, identical values and edit affordances |
| 14 | Help saved | Saved-in-demo, no helper contacted, view request/home actions |
| 15 | Activities | Available, full and cancelled examples simultaneously visible; tea/park/boardgame art and textual reasons |
| 16 | Available activity detail | Date/time/language/demo venue, unverified access, cost/organizer caveats, signup action |
| 17 | Full activity detail | Full status, readable reason, disabled signup, return to activities |
| 18 | Cancelled activity detail | Cancelled status, readable reason, disabled signup, return to activities |
| 19 | Activity signup confirmation | **Separate confirmation screen**, named event/date, Continue and Back; not merged with review |
| 20 | Activity review | Event/date/place summary and Edit/back; final save-in-demo confirmation |
| 21 | Activity saved | Demo record saved, no real attendance/place reservation, requests action |
| 22 | Requests — All | Exactly **All / Assistance / Activities** filters; visibly include both saved-demo and cancelled-demo rows |
| 23 | Requests — Assistance | Same type filters, Assistance selected, matching help records including cancelled status |
| 24 | Requests — Activities | Same type filters, Activities selected, matching event records including cancelled status |
| 25 | Request detail | Full chosen values, DEMO identifier, saved-demo status, cancel action |
| 26 | Cancel confirmation | Consequence and retained history, separate Keep and Cancel in demo actions |
| 27 | Save/retry error | “Не удалось подтвердить сохранение”; retained summary, Retry; no successful-state icon |
| 28 | Profile | RU/KZ, standard/large text controls with sample, account/guest state, sign-out |

Use logical row groups on a wide board: introduction, help selection, review/results, activities, requests/recovery. Outside phone frames add concise section labels, palette/type scale and flow arrows. Export full board with all frames plus individually named PNGs, and provide a compact preview/contact sheet if the full raster is too large for convenient viewing.

## Implementation and acceptance

1. Luna builds the self-contained HTML/SVG board and local deterministic export script. Semantic markup and reusable frame/card/button helpers are appropriate; no framework or new project dependencies needed.
2. Render at exact 390 × 844 for individual frames. Inspect actual line wrapping, primary CTA, demo text, languages, navigation, and note/review values. Ensure no overlap or clipped labels. Export board and per-frame PNGs from the same source.
3. Validate frame count/dimensions, no remote assets, target sizes, used text colors, all mandatory states and explicit per-choice edit controls. Static presentation verification does not establish application behavior. Do not run/claim the native app suite as proof of this board.
4. Astra independently inspects final source and representative/full-size renders (at least RU/KZ Home and Review, dense conditions, activities, history, error, cancellation), reports concrete defects, and rechecks fixes. README distinguishes actual checks from pending KZ editorial, target-user, native and screen-reader evaluation.

Current MVP conflicts are intentionally isolated: the domain presently has district/time only and no arbitrary note/date fields; the configured signed-out mode must not silently save local records; existing navigation differs from the proposed four-tab/Profile design. The user explicitly requests these features in the presentation, so **include them** without migrating schemas or implying they have shipped.
