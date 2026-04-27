# Quiet Studio Icon Set

Canonical home for the Quiet Studio toolkit icons. All icons share the same house style:

- `viewBox="0 0 24 24"`
- `fill="none"`
- `stroke="currentColor"` — inherits color from parent for theme flexibility
- `stroke-width="1.9"`
- `stroke-linecap="round"`
- `stroke-linejoin="round"`

The full set of nine icons is used across the marketing landing (`index.html` toolkit section) and the Quiet Studio app shell (`app.html` rail, dashboard, and All Tools drawer).

## Icons

| Filename | Tool | Description |
|---|---|---|
| `lens.svg` | Lens | Refine language, inspect meaning, sharpen phrasing |
| `pulse.svg` | Pulse | Live signal line for quick insight, checks, and momentum |
| `blueprint.svg` | Blueprint | Structured planning and system thinking laid out as a framework |
| `vision.svg` | Vision | Framing device for composition, direction, and visual judgment |
| `spark.svg` | Spark | Compact creative spark for first ideas and fast generation |
| `my-ideas.svg` | My Ideas | Saved stack of working concepts, drafts, and reusable ideas |
| `story-engine.svg` | Story Engine | Guided multi-step journey from raw idea to ready-to-post playbook |
| `voice-dna.svg` | Voice DNA | Learned voice profile that captures and sharpens the creator's signature over time |
| `reach.svg` | Reach | One core story branching outward into native variants for many platforms |

## Provenance

- Six original icons (Lens, Pulse, Blueprint, Vision, Spark, My Ideas) designed by Perplexity for the marketing landing toolkit section, committed to `index.html` inline.
- Three new icons (Story Engine, Voice DNA, Reach) designed by Perplexity in matching style for the Quiet Studio app shell.
- All nine wired into `app.html` in commit `144cd12` (v2.2 of Quiet Studio shell).

## Usage

Drop any `<svg>` directly into HTML. Color inherits via `currentColor` so styling is controlled by the parent's `color` CSS property.

```html
<svg class="my-icon-class" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <!-- paths -->
</svg>
```

```css
.my-icon-class {
  width: 24px;
  height: 24px;
  color: var(--ink);
}
```
