# Mobile UI design contract

The first screen is **Help**. The three primary destinations are Help, Meetings, and My records; About remains in the app header. The help catalog starts with the available synthetic examples and places an existing draft continuation before them, with an explicit unconfirmed-save label while a write is pending.

Use an ivory background, ink-colored text, and deep blue for primary actions. Present catalogs and saved records as readable divided rows instead of repeating large cards. Keep focused surfaces for a choice summary, an important warning, or a confirmation. Buttons and choices stay at least 56 px high; body copy stays at least 18 px. Let RU/KZ text wrap, including at 320 px and enlarged text settings.

Keep the product boundary visible: local demo state only. Event rows show the available synthetic date, place, and status; unavailable examples keep their reason. Record rows announce their type, status, and date. Preserve help validation, pending/error/retry feedback, draft replacement confirmation, and record cancel/Keep flows. Do not suggest a real provider, booking, or delivered service.

`src/ui/theme.ts` owns shared tokens; `src/ui/components.tsx` owns accessible controls and divided rows; individual screens own flow-specific content. Research notes in `docs/mvp/` inform hierarchy and wording, not claims about review frequency or user prevalence. Typecheck, tests, lint, and web export are the implementation checks; device-native accessibility and layout still require a native device pass.
