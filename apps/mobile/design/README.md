# Mobi presentation board

`index.html` is a self-contained visual specification for a proposed Mobi mobile experience. It includes a reusable design-system panel and 30 static screen states. Each `.phone[data-screen]` is designed at 390 × 844 CSS pixels. Screen copy and interaction affordances describe a presentation concept; they do not imply these screens or flows are implemented in the Expo app.

## Preview and export

Open `index.html` in a current browser to inspect the complete four-column board. The local `render_board.py` script renders the board and individual frames to `exports/` with Playwright/Chromium. Run:

```powershell
python apps/mobile/design/render_board.py
```

The export includes the overview, numbered 390 × 844 frames, and a verification report. It requires a local Playwright installation and Chromium; the HTML itself has no remote assets or runtime dependencies.

Files to view or share:

- `exports/board.png`: full presentation board with design tokens and 30 phone frames.
- `exports/contact-sheet.jpg`: compact overview of all screens.
- `exports/screens/`: individual 390 × 844 PNGs. Home is 04 (RU) / 05 (KZ); assistance Review is 12 (RU) / 13 (KZ).
- `illustrations.svg`: six original reusable vector illustrations, also embedded in the HTML.
- `exports/verification.json`: measured dimensions, control heights, text sizes, layout checks, token contrast and source hash.

Export prerequisites: Python with `playwright` and `pillow`, and the Playwright Chromium browser. Install those in your preferred Python environment; the Expo project's dependencies are not used or changed.

The final static render contains 30 frames at the requested size. The export check found no horizontal overflow, clipped top-level content, meaningful text below 18 px, or measured controls below 56 px high. It recorded no page errors or external requests. Nine documented text/background token pairs meet the 4.5:1 normal-text threshold. This is a limited design/render check, not a full WCAG audit.

## Design boundaries

This board intentionally presents an account sign-in/sign-up and Google entry, guest browsing, date and free-text note selection, and four-tab navigation as a proposed flow. The current MVP may not implement those parts. No displayed synthetic district, time, date, activity, venue, status, or demo ID describes a real service or reservation. Demo records are framed as account examples and are not sent to a helper or organizer.

The visual review only checks static browser rendering. It does not establish native Android/iOS behavior, TalkBack/VoiceOver behavior, Dynamic Type, a complete Google OAuth flow, language editorial quality, or usability with older adults. Those need separate evaluation.
