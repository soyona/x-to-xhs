# Design QA

- source visual truth path: `/Users/kanglei/.codex/visualizations/2026/07/25/019f9977-5ba6-7ff1-abcf-db95fceebdaa/01-current-empty-workspace.png`
- implementation screenshot path: `/Users/kanglei/.codex/visualizations/2026/07/25/019f9977-5ba6-7ff1-abcf-db95fceebdaa/02-two-column-failed-state.png`
- passed-state screenshot path: `/Users/kanglei/.codex/visualizations/2026/07/25/019f9977-5ba6-7ff1-abcf-db95fceebdaa/03-two-column-passed-state.png`
- mobile screenshot path: `/Users/kanglei/.codex/visualizations/2026/07/25/019f9977-5ba6-7ff1-abcf-db95fceebdaa/04-two-column-mobile-failed-state.png`
- combined comparison path: `/Users/kanglei/.codex/visualizations/2026/07/25/019f9977-5ba6-7ff1-abcf-db95fceebdaa/05-design-qa-comparison.png`
- desktop viewport: `1280 x 720` CSS px, source and implementation both `1280 x 720` pixels, density normalized 1:1
- mobile viewport: `671 x 789` CSS px, implementation `671 x 789` pixels, density 1:1
- state: source is the original empty three-column shell; implementation is the populated two-column failed, repairing, passed, restored, and manual-review flow

## Full-view comparison evidence

The two-column implementation preserves the source shell, typography family,
header and footer heights, 14px workspace inset, panel border treatment, red
accent, warm document background, compact metadata, and existing icon family.
The former 309px validation column is intentionally merged into the document
workflow; the source panel remains 316px and the document panel expands to
922px at 1280px.

The source and implementation do not show the same content state because the
source product had no populated inline-check state. Common shell surfaces were
compared at the same viewport; the new state hierarchy was evaluated from the
failed and passed screenshots.

## Focused comparison evidence

Focused review covered the workflow summary, title card, expanded failed check,
collapsed passed check, repair button, restore button, and mobile stacked
panels. A separate crop was unnecessary because these controls are legible in
the 1:1 desktop captures.

## Required fidelity surfaces

- Fonts and typography: existing font stack, weight hierarchy, line height, and
  compact metadata scale are preserved. Failure details remain readable without
  competing with generated content.
- Spacing and layout rhythm: source panel width and shell geometry are
  preserved; inline states use the existing 7–11px card rhythm and radii.
- Colors and visual tokens: existing accent, green success, muted text, border,
  and surface tokens are reused. State meaning is also written in text.
- Image quality and asset fidelity: no image assets are present in the source or
  implementation. Existing product icons were reused; no replacement imagery
  was introduced.
- Copy and content: “修复此部分” accurately describes a scoped repair request
  without promising that the server replaces only one field. Manual checks
  explicitly state that they do not affect automatic failure counts.
- Responsive behavior: desktop and `671 x 789` mobile captures have no document
  overflow. Mobile uses two equal-height internal-scroll panels.
- Accessibility: inline details use real buttons with `aria-expanded`, status
  regions use text plus color, native checkboxes retain labels, and repairing
  state disables conflicting actions.

## Interaction evidence

- Title copy changed visibly from “复制” to “已复制”.
- One manual checkbox changed the counter from `0/8` to `1/8`.
- “修复全部问题” and the title-scoped “修复此部分” both exposed a visible
  repairing state.
- Repair changed `7/11` to `11/11`, collapsed all passed details, and exposed
  “恢复上一版本”.
- Restore returned the draft to `7/11` with four failures.
- Browser console errors and warnings: none.
- `documentElement.scrollHeight === innerHeight` and
  `documentElement.scrollWidth === innerWidth` at both tested viewports.

## Findings

No actionable P0, P1, or P2 differences remain. The information-architecture
change is intentional and matches the approved two-column direction.

## Comparison history

- Initial implementation: passed checks stayed expanded after a repair.
  Severity: P2 because success created avoidable visual noise.
- Fix: collapse inline details automatically when their failed count reaches
  zero.
- Post-fix evidence: the passed-state DOM reported zero expanded check toggles,
  and the updated screenshot shows compact green success rows.

## Follow-up polish

- P3: add a dedicated focus-ring token for all buttons in a future accessibility
  polish pass; current browser focus indication remains available.

final result: passed
