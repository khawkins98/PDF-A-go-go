# PDF-A-go-go v2.0 Project Plan

Ready for a fresh coat of paint? We’re flipping PDF-A-go-go’s interface from side-scrolling to straightforward vertical scrolling—and you’ll care because it slashes complexity, squashes navigation quirks, and feels instantly familiar.

> **You’ll learn …** the what, why, and how behind this refactor, key milestones, and exactly where to lend a hand. _This assumes you’ve pulled `refactor-step-by-step` and skimmed the existing horizontal-scroll code._

---

## Why the Up-Down Pivot Matters

```css
/* New core: a single, vertically scrollable wrapper */
.viewer {
  overflow-y: auto; /* native momentum on touch & trackpads */
  height: 100vh;
  scroll-snap-type: y mandatory; /* keeps pages neatly aligned */
}

.page {
  scroll-snap-align: start;
  margin: 0 auto; /* centered page */
}
```

The snippet shows the lean vertical-scroll foundation—no custom grab-and-throw math, no juggling “current page” across five neighbors. Users (and devs) rejoice.

### Benefits at a Glance

- **Common UX pattern**: mirrors every modern document viewer.
- **Less code, fewer bugs**: drop bespoke physics & page-tracking logic.
- **Simpler interaction model**: keyboards, mice, touch all map naturally.
- **Accessibility boost**: assistive tech already understands vertical docs.

---

## High-Level Milestones

1. **Layout & Styling** – Replace horizontal flexbox with vertical flow, touch nothing else.
2. **Input Handling** – Strip custom grab/scroll acceleration; add optional side-hover scroll affordances on desktop.
3. **Test Suite Overhaul** – Realign Playwright specs and performance tests.
4. **Performance & Polish** – Verify lazy-loading, snapping, and memory footprint.
5. **Docs & Release** – Update README, version bump, draft changelog.

> Tentative timeline: **2 sprint weeks**—see detailed breakdown below.

---

## Detailed Task Breakdown

### 🚦 Reality Check: What’s Already Working

| Area | Status | Notes |
| --- | --- | --- |
| Vertical layout | ✅ **Done** | Pages flow top-to-bottom; snap points feel solid |
| Rendering pipeline | ✅ **Healthy** | Perf logs show ~400 ms high-res renders; lazy loading intact |
| Keyboard navigation | ✅ **Good** | Arrow / Pg keys flip pages; ARIA page announcements fire |
| Momentum drag (mouse) | ⚠️ **Still Active** | `_setupGrabAndScroll` inertia math needs removal |
| Wheel acceleration | ⚠️ **Still Active** | `_setupWheelScrollHandler` custom easing present |
| Hover scroll zones | ⏳ **Missing** | No side-edge listeners or CSS |
| CSS cleanup | 🧐 **Mixed** | `overflow-x: scroll` still set; `display: "column"` typo in JS |
| Tests | 🔴 **Broken** | Old selectors (`.page-horizontal`) failing in Playwright |

### 🎯 Next Concrete Steps (in priority order)

1. **Delete acceleration handlers** – Remove `_setupGrabAndScroll` and velocity logic in `_setupWheelScrollHandler`.
2. **Add desktop hover zones** – Two slim fixed divs that on hover call `scrollBy({ top: ±viewportHeight, behavior: 'smooth' })`; gate behind `(hover: hover)`.
3. **Fix CSS nits** – Set `overflow-x: hidden` and change inline `display` to `flex` on `pagesContainer`.
4. **Remove auto-resize on resize grip** – Keep canvas scale fixed when container height grows; ensure grip still works for vertical space.
5. **Increase default page width** – Set page wrapper to `max-width: 90%` of viewer container; handle DPI scaling gracefully.
5. **Rewrite tests** – Update selectors, assert vertical scroll, add hover-zone coverage, include resize-grip behaviour.
6. **Polish & docs** – Re-run perf spec, update README visuals, finalize changelog.

### 1️⃣ Layout & UI Refactor

- [ ] Convert page container from horizontal flex to vertical column.
- [ ] Update `pdf-a-go-go.css` styles; deprecate left/right gutters.
- [ ] Ensure mobile viewport fit & landscape support.
- [ ] Verify scroll-snap alignment across browsers.
- [ ] Make each PDF page render at ~90% of the container’s width for improved legibility (responsive to viewport changes).
- [ ] Disable PDF auto-resize when the embed area is resized via `data-show-resize-grip`; maintain page scale while allowing taller viewport.

### 2️⃣ Input Handling & Interaction

- [ ] **Remove** grab-and-scroll acceleration calculations (`scrollablePdfViewer.js`).
- [ ] Add subtle hover zones on left/right edges that nudge scroll vertically (desktop only).
- [ ] Preserve existing keyboard shortcuts (↑ ↓ PgUp PgDn, spacebar).
- [ ] Confirm accessible roles (`role="document"`, ARIA landmarks).

### 3️⃣ Testing

- [ ] Rewrite Playwright specs: update selectors from `.page-horizontal` → `.page`.
- [ ] Expand coverage: ensure first/last page visibility, snap points, keyboard nav.
- [ ] Stress-test 100-page PDFs for jank & memory leaks.

### 4️⃣ Performance & Regression Checks

- [ ] Benchmark scroll FPS before/after (use `tests/performance.spec.ts`).
- [ ] Throttle network to confirm lazy-load placeholders still work.
- [ ] Audit Lighthouse accessibility & performance scores.

### 5️⃣ Docs, Versioning, & Release

- [ ] Update `README.md` gifs & examples.
- [ ] Draft `CHANGELOG.md` for v2.0 (breaking changes highlighted).
- [ ] Tag release, publish on npm (if applicable).

---

## Risks & Mitigations

| Risk                                        | Impact             | Mitigation                                            |
| ------------------------------------------- | ------------------ | ----------------------------------------------------- |
| Snap behaviour inconsistent across browsers | Janky scroll       | Polyfill or feature-detect, add unit test             |
| Large PDFs stall scroll                     | Perceived perf hit | Keep lazy-load, consider virtualization               |
| Custom hover scroll feels gimmicky          | UX confusion       | Gate behind `prefers-hover` media query & user toggle |

---

## Definition of Done ✅

- [ ] All remaining to-dos below are shipped
- [ ] CI passes (tests + lint)
- [ ] Docs & changelog updated
- [ ] No regressions in core viewer metrics (FPS, memory, accessibility score)

### Remaining To-Dos (live checklist)

- [ ] **Update tests**
- [ ] **Remove grab and scroll acceleration calculations**
- [ ] **Add mouse-over scroll area on right/left for desktop**
- [ ] **Disable PDF auto-resize when using `data-show-resize-grip` (maintain scale)**
- [ ] **Set default page width to 90% of container for better legibility**

---

## Who Does What?

| Owner | Area                 |
| ----- | -------------------- |
| @you  | Layout, interactions |
| @me   | Tests, docs, release |

Feel free to swap or pair as workloads shift.

---

## Wrap-Up

That’s the game plan: a leaner, cleaner vertical viewer that feels right at home. Thanks for hopping on—questions, memes, or feedback, just ping me. Let’s ship this and make scrolling boring (in the best way possible!).
