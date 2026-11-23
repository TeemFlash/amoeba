# Sara UI redesign

The MVP now uses a clear cobalt, pale-blue, white, and warm-accent visual system instead of repeated oversized outlined cards. The home screen presents the two existing demo paths as distinct service rows, shows a real catalog meeting preview, and keeps draft continuation compact. Catalogs, request and meeting forms, history, and about/confirmation screens have matching typography, varied surface tones, meaningful icons, status/date context, and contextual accessible names.

Shared UI tokens and components live in `apps/mobile/src/ui/theme.ts`, `components.tsx`, and `icons.tsx`; the layout decisions are summarized in `apps/mobile/DESIGN.md`. Brief screen transitions respect reduced-motion settings. Web icons are hidden from the accessibility tree with `aria-hidden`; native decorative icons use native accessibility props. Choice and tab controls expose selected state, and keyboard focus remains visible.

The current browser QA was performed by the root agent. It covered help form validation, selecting district and time, saving, reload, history, full-meeting behavior without an enrollment action, RU preview with the existing draft retained, KZ Home and About at 320 px without overflow, visible keyboard focus, selected tab semantics, and decorative SVG icons absent from the accessibility tree after reload with no new console errors. It did not cover retry/cancel behavior, radio selected semantics, or successful meeting enrollment in this redesign pass. Native device/screen-reader behavior, native 200% text scaling, and native reduced-motion execution were not tested. Web text-scale emulation is not native-device proof.

No domain or storage behavior was changed as part of this redesign. Demo boundaries and the implementation contract remain in [IMPLEMENTATION.md](IMPLEMENTATION.md). Historical review and QA records from the earlier MVP pass are not evidence for this redesign pass.

## Text and screen cleanup - 2026-11-17

Follow-up cleanup removed the home hero and duplicate history action, made action descriptions optional, shortened RU/KZ catalog copy, and removed decorative badges and repeated demo explanations from detail screens. The global notice is now a compact line; About carries the concise local-storage and no-real-service explanation. `npm test` (39/39), typecheck, lint, and `export:web` pass; root browser review confirmed saved draft selections remain intact through locale switching at 390 px. Domain transitions, storage, and navigation semantics were not changed.
