# Design QA: 模型与 API 方案 3

- Source visual truth: `/Users/kanglei/.codex/generated_images/019fae14-5edc-74f0-accc-ee36d003e377/call_TIE0Cw49rNcf3QaoalZKkbOQ.png`
- Implementation screenshot: `/private/tmp/x-to-xhs-option3-desktop-final.jpg`
- Full-view comparison: `/private/tmp/x-to-xhs-option3-comparison.jpg`
- Focused comparison: `/private/tmp/x-to-xhs-option3-focus-comparison.jpg`
- Viewport: 1280 × 720 CSS px
- Source pixels: 1536 × 919, normalized to 1279 × 720
- Implementation pixels: 1280 × 720
- Density normalization: both comparison inputs normalized to 720 px height at 1× screenshot density
- State: 设置 → 模型与 API；Gemini 已配置并展开

## Full-view comparison

The implementation preserves the selected direction's progressive disclosure:
provider summaries remain compact, only one provider is expanded, persistent
footer actions remain visible, and Key management is secondary to configuration.

Intentional product-data deviations:

- All five real providers remain available; the concept image only showed four.
- Current model values are preserved instead of the concept's `未设置` placeholders.
- Model remains a free-text input because the existing product accepts provider
  model identifiers rather than a fixed select list.
- The generated mock's duplicate expanded-row chevrons are replaced with one
  labelled manage button and one rotating chevron.

## Focused comparison

The Gemini region matches the selected hierarchy: saved-Key status and model
share the first row, multi-Key help remains below the Key status, replacement is
a secondary action, and local removal is separated by a divider with explicit
scope copy. The focused comparison is readable without an additional crop.

## Required fidelity surfaces

- Fonts and typography: existing application font stack, compact weight scale,
  label hierarchy, truncation, and line height are preserved.
- Spacing and layout rhythm: provider summary height, two-column detail grid,
  divider rhythm, radii, and footer separation match the selected direction.
- Colors and visual tokens: existing red accent, green configured badge,
  pale-red danger state, borders, and surfaces are reused without a new palette.
- Image quality and assets: the target contains no raster product assets.
  The disclosure icon uses the project's existing Lucide icon library.
- Copy and content: local-only removal scope is explicit; no Key value or suffix
  is returned or rendered.
- Responsiveness: 390 × 844 verification has no horizontal overflow, keeps the
  page itself fixed, and provides 44 px manage and destructive-action targets.
- Accessibility: manage buttons expose `aria-expanded` and `aria-controls`;
  visible text labels remain on every destructive action; focus indicators are
  retained.

## Interaction verification

- Provider manage controls switch the single expanded section.
- Configured providers can enter and cancel replacement mode.
- Unconfigured providers expose an empty password input.
- Local removal enters a staged state and can be undone before saving.
- Browser console errors and warnings: none.

## Comparison history

### Iteration 1

- Finding: P1 — expanded details overflowed a stretched provider grid row and
  the local-removal section was clipped.
- Fix: set provider-list rows to `max-content` and align grid content to the top,
  allowing the list itself to scroll.
- Post-fix evidence: `/private/tmp/x-to-xhs-option3-implementation-2.jpg`.

### Iteration 2

- No remaining P0, P1, or P2 findings.
- Final evidence: `/private/tmp/x-to-xhs-option3-desktop-final.jpg`,
  `/private/tmp/x-to-xhs-option3-mobile.jpg`, and
  `/private/tmp/x-to-xhs-option3-focus-comparison.jpg`.

## Follow-up polish

- P3: the real application intentionally retains its denser small-text scale,
  which is slightly more compact than the generated concept.

final result: passed
