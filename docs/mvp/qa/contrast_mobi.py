"""Measure text/background token pairs in the current Mobi theme."""
import json
import os
import re
from pathlib import Path

theme = (Path(__file__).resolve().parents[3] / 'apps/mobile/src/ui/theme.ts').read_text(encoding='utf-8')
colors = dict(re.findall(r"(\w+): '(#[A-Fa-f0-9]{6})'", theme))

def luminance(color):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    return sum(c * weight for c, weight in zip(linear, [.2126, .7152, .0722]))

pairs = [('surface', 'primary'), ('primary', 'softBlue'), ('danger', 'dangerSurface')]
pairs += [(foreground, background) for foreground in ['text', 'secondary']
          for background in ['background', 'surface', 'softBlue', 'lavender', 'cream', 'muted']]
results = []
for foreground, background in pairs:
    light, dark = sorted([luminance(colors[foreground]), luminance(colors[background])], reverse=True)
    ratio = (light + .05) / (dark + .05)
    results.append({'foreground': foreground, 'background': background, 'ratio': round(ratio, 2), 'passes4_5': ratio >= 4.5})
assert all(result['passes4_5'] for result in results), results
out = Path(os.environ.get('QA_OUTPUT_DIR', 'qa-results'))
out.mkdir(parents=True, exist_ok=True)
(out / 'contrast-results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps({'pairs': len(results), 'minimumRatio': min(result['ratio'] for result in results)}))
