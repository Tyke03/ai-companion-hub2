# AI Companion Hub — Manual Screen-Reader Validation Script

**Batch:** 2A (screen-reader validation)
**Status:** Test-plan only — no genuine assistive-technology environment was
available to the implementing agent (WSL2 Ubuntu 24.04; no NVDA, no VoiceOver,
no Orca). This document is the executable script for a human tester running a
real screen reader.
**Target app:** local preview or the Batch 2A Vercel Preview, **not** production.
**Base release:** v0.8.0-live (`7c9baf6`)

Do not enter real credentials, send API requests, invoke AI generation, upload
or download files, publish material, or submit to external providers.

---

## 1. Environment setup

Choose one combination and note it in the results sheet:

- **Windows:** NVDA (latest stable) + Firefox or Chrome/Edge.
  - NVDA download: https://www.nvaccess.org/download/
  - NVDA docs: https://www.nvaccess.org/files/nvda/documentation/userGuide.html
- **macOS:** VoiceOver + Safari (built in).
  - Enable: System Settings → Accessibility → VoiceOver, or press Cmd+F5.
- **Optional mobile:** TalkBack (Android) or VoiceOver (iOS) if genuinely
  available. Do not claim mobile screen-reader results otherwise.

Record for every session:

- Screen reader + version
- Browser + version
- OS + version
- Viewport (desktop ≈1440px; mobile ≈375px for section 9 only)

---

## 2. Global navigation and structure (all five routes)

For each route (`/`, `/prompts`, `/tools`, `/compare`, `/community`):

1. Load the route. With the virtual cursor at the top, press
   `Insert+F7` (NVDA) / `VO+F2` then "Headings" (VoiceOver) to list headings.
   - **Expected:** exactly one `H1` per page, a sensible heading hierarchy,
     and useful heading text that matches the visible page purpose.
2. Navigate landmarks (`D` key in NVDA browse mode; `VO+U` rotor → Landmarks
   in VoiceOver).
   - **Expected:** header / main navigation / main content are exposed
     sensibly; the reading order matches the visual layout left-to-right,
     top-to-bottom.
3. Tab from the top of the page.
   - **Expected:** header navigation links have understandable names, a
     visible focus indicator appears at each stop, and the focus order is
     logical. Repeated navigation behaves consistently between routes.
4. Confirm decorative icons are not announced as confusing noise (e.g., an
   icon-only element should be `aria-hidden` or have a meaningful label).

---

## 3. /prompts and /compare

1. Prompt template cards:
   - **Expected:** card title, artifact type, "Universal · Plain text" or
     verified target label, format, confidence, runtime macros (or "None"),
     and paste/use instruction are each announced meaningfully.
   - **Expected:** the "Copy raw template" and "Open in Builder" buttons
     announce distinct, purposeful names — never a generic "button".
2. /compare matrix:
   - **Expected:** rows/columns give understandable context (row/column
     headers), filter controls identify their purpose and current state, and
     no cell is announced without context.
3. Search/filter controls (if present):
   - **Expected:** input announces its label and any current value/state.

---

## 4. Character Builder (/tools → Character Builder)

1. Tool selection (tab or link):
   - **Expected:** announces selected/current state.
2. V2/V3 controls:
   - **Expected:** announces the version and that V3 is a **draft**
     (e.g., "V3 (draft)").
3. Each main card field (name, description, personality, scenario, greeting,
   etc.):
   - **Expected:** persistent label announced when focus enters the field.
4. Import (Text) dialog:
   - Activate "Import (Text)" with the keyboard.
   - **Expected:** dialog title and purpose are announced; focus moves into
     the dialog.
   - Type invalid JSON (`not valid json`), activate Import.
   - **Expected:** a single clear error is announced (assertive, once — no
     duplicate/conflicting toast + inline double announcement); entered text
     remains in the textarea; the dialog stays open.
   - Press Escape.
   - **Expected:** the dialog closes and focus returns to the "Import (Text)"
     trigger.
5. Import (File/PNG) guidance:
   - **Expected:** the trigger announces accepted file types and the 25 MB
     PNG limit in a screen-reader-accessible way.
6. Preservation notices (after a V2 import with `character_book` / unknown
   fields):
   - **Expected:** notices are understandable and not overly repetitive; they
     do not imply the opaque content is editable.

---

## 5. Prompt Builder (/tools → Prompt Builder)

1. Template selection:
   - **Expected:** announces selected state and template purpose.
2. Editable author fields vs. literal runtime macros:
   - **Expected:** bracket placeholders like `[Character Name]` are announced
     as editable text; runtime macros like `{{user}}` are distinguishable and
     never presented as editable author fields.
3. Output/preview region:
   - **Expected:** has a useful accessible name and can be reached/read.
4. Copy/reset/clear status feedback (exercise only local actions):
   - **Expected:** status is announced once, understandably.

---

## 6. Lorebook Builder (/tools/lorebook-builder)

1. Entry controls:
   - **Expected:** meaningful names and state (selected/pressed) for entry
     list buttons.
2. Search, Keys, Secondary Keys, Insertion order, Position, Content, Constant:
   - **Expected:** each announces its label; the Constant toggle announces
     on/off state.
3. Import/preview dialog (if present):
   - **Expected:** title and purpose announced; focus enters, Escape closes,
     focus returns to the trigger; any error/status is announced once.

---

## 7. Persona Builder (/tools/persona-builder)

1. Profile fields:
   - **Expected:** each announces its persistent label.
2. Format toggles:
   - **Expected:** announce current selected/pressed state and change on
     activation.
3. Generated output preview:
   - **Expected:** useful name; reachable and readable.

---

## 8. Doc Consolidator and API Tester (/tools)

### Doc Consolidator
1. Service/source/input/output controls:
   - **Expected:** each identifies its purpose.
2. Read-only output/code-like preview:
   - **Expected:** reachable and understandable.
3. Disabled/unavailable controls:
   - **Expected:** explain why they are unavailable.
4. Do **not** fetch remote URLs or invoke consolidation.

### API Tester
1. Provider, Base endpoint, API key, Model fields:
   - **Expected:** meaningful labels.
2. Disabled no-key/no-model state:
   - **Expected:** clearly communicated (e.g., the request action is disabled
     and its reason is announced).
3. Focus/navigation alone:
   - **Expected:** sends **no** request.
4. Error/help text:
   - **Expected:** announced correctly when visible.

---

## 9. Mobile / small viewport (≈375px)

1. Verify core labels, messages, and dialog actions remain understandable and
   not visually clipped.
2. Do **not** claim native mobile screen-reader testing unless a genuine
   mobile screen-reader environment was used.

---

## 10. Findings sheet

For every confirmed issue, record:

- Severity: blocker / high / medium / low
- Route/tool and viewport
- Screen reader + browser + OS
- Exact keystrokes or navigation path
- Expected announcement/behavior
- Actual announcement/behavior
- Reproducible? (yes/no)
- Suggested narrow remediation
- Screenshot/recording reference only if safe and free of private data

Do not file cosmetic preferences as accessibility defects unless they
materially affect navigation, comprehension, focus, or operation.

---

## 11. Result summary

- Overall result: PASS / PASS WITH ISSUES / FAIL
- Environments actually tested
- Workflows tested
- Confirmed findings by severity
- Any fixes made (this batch made none; fixes belong to a future authorized
  batch after this script is executed)

---

## 12. Scope and boundaries

- This script is **test-plan-only**. No application code was changed in
  Batch 2A because no real screen-reader environment was available and
  speculative fixes are explicitly out of scope.
- No claim of full WCAG compliance or universal screen-reader support is made.
- Automated axe scans and keyboard-only Playwright tests passed for the
  covered routes and workflows (see the Batch 2A report); they do not replace
  this manual pass.
