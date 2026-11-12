# Mobi illustrations

These six transparent PNGs are raster exports of the original reusable SVG symbols in [`../../design/illustrations.svg`](../../design/illustrations.svg). The SVG is the editable source of truth; no external images or fonts are used.

Re-render from `apps/mobile` with Playwright Chromium:

```powershell
$env:PYTHONPATH = "$env:TEMP/mobi-design-tools"
python assets/illustrations/render.py
```

The renderer exports `armchair.png`, `phone.png`, `apple.png`, `tea.png`, `park.png`, and `game.png` at 640×480 with a transparent background.
