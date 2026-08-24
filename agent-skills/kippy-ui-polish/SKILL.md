---
name: kippy-ui-polish
description: Polish and review Kippy web interfaces without changing product behavior or architecture. Use when implementing or refining Kippy React screens, matching an approved Figma design, improving visual hierarchy, spacing, typography, responsive or RTL behavior, accessibility states, interaction feedback, or motion; also use for a focused UI/UX or animation review before completion. Preserve existing routes, Hebrew copy, flows, contracts, components, and dependencies unless the user explicitly expands scope.
---

# Kippy UI Polish

Improve Kippy's interface as a safety product: calm, trustworthy, legible, and
predictable. Make the smallest coherent change that improves the requested
experience and can be verified in the running product.

## Non-Negotiable Product Contract

- Preserve routes, navigation destinations, deep links, and route parameters.
- Preserve Hebrew copy, labels, terminology, and content order unless copy
  editing is explicitly requested.
- Preserve authentication, authorization, Supabase calls, query keys, data
  shapes, form payloads, analytics, and device or Android contracts.
- Preserve user flows and destructive-action safeguards.
- Preserve existing component APIs and caller behavior unless a coordinated API
  change is explicitly in scope.
- Verify the active stack and versions from current manifests and lockfiles.
  Preserve the repository's React, Vite, TypeScript, Tailwind CSS, shadcn/Radix,
  Framer Motion, Lucide, Sonner, and Vaul choices unless a dependency or
  migration change is explicitly authorized.
- Reuse existing components, hooks, tokens, utilities, and patterns before
  creating new abstractions.
- Do not add, replace, or upgrade dependencies for visual convenience.
- Do not rewrite architecture to mirror a mockup or design-tool layer tree.
- Do not hotlink fonts, images, icons, videos, or other assets.
- Do not place secrets or real child, family, location, message, or account data
  in fixtures, screenshots, Figma, logs, or generated examples.
- Use synthetic, clearly fictional data for every design and test artifact.

If the requested polish conflicts with any item above, stop and explain the
conflict before editing.

## Establish the UI Baseline

Before changing code:

1. Read the applicable repository instructions and inspect the target route.
2. Trace the rendered component tree, relevant state, and shared UI primitives.
3. Inspect nearby screens for established layout, wording, and interaction
   patterns.
4. Inspect `src/index.css`, `tailwind.config.ts`, and `components.json` when
   tokens, theme scopes, responsive behavior, or primitives are involved.
5. Identify every state the screen can render: loading, populated, empty,
   error, offline, disabled, pending, and success where applicable.
6. Capture a browser baseline at a representative narrow mobile viewport and a
   desktop viewport when the app can run.
7. State the intended visual change and the behavior that must remain unchanged.

Do not infer UI behavior solely from a screenshot. Confirm it in code.

## Apply Kippy's Visual Direction

- Favor calm hierarchy over decoration.
- Make the primary task obvious through order, scale, contrast, and spacing.
- Keep safety alerts unambiguous without making routine screens feel alarming.
- Reserve destructive colors for destructive or critical states.
- Prefer short, stable spacing rhythms and aligned edges over arbitrary offsets.
- Use the existing CSS variables and active theme scope before introducing new
  values.
- Keep typography legible at supported accessibility text-size levels.
- Avoid dense control clusters, novelty layouts, glass effects, excessive glow,
  and animation used only to appear sophisticated.
- Keep cards and surfaces visually related; do not create a different design
  language for a single route.
- Use Lucide icons already available in the project; keep icon style and stroke
  weight consistent.
- Pair unfamiliar icons with text. Do not rely on color or iconography alone to
  communicate safety state.
- Prefer progressive disclosure when secondary detail competes with the primary
  action.

## Design Mobile-First and RTL-First

- Start from the narrowest supported viewport, then add wider layouts.
- Keep primary actions reachable and stable without covering content or browser
  safe areas.
- Aim for at least 44 by 44 CSS pixels for primary touch targets and preserve
  sufficient separation between adjacent actions.
- Allow Hebrew labels, names, and translated strings to wrap without clipping.
- Test long synthetic names, large text settings, and multi-line status copy.
- Use logical direction and start/end alignment where supported.
- Audit physical left/right margins, paddings, positioning, borders, rounded
  corners, chevrons, progress direction, and slide direction.
- Mirror directional icons when meaning depends on direction; do not mirror
  universal symbols.
- Keep numbers, times, phone numbers, codes, and mixed Hebrew/Latin text readable
  with appropriate local direction handling.
- Do not force a desktop grid into a horizontally scrolling mobile layout unless
  the product interaction explicitly requires it.

## Preserve Accessible Interaction

- Use semantic elements and existing Radix primitives instead of clickable
  generic containers.
- Preserve keyboard navigation, logical focus order, visible focus, Escape
  behavior, and focus return for overlays.
- Provide accessible names for icon-only controls and associate labels,
  descriptions, validation, and errors with their fields.
- Keep status information available to assistive technology without announcing
  decorative updates.
- Verify contrast in the actual theme and state, including muted, disabled,
  hover, focus, and error presentations.
- Never make hover the only way to discover or perform an action.
- Keep destructive actions explicit and confirmation behavior intact.
- Give loading, empty, error, and retry states purposeful content and stable
  layout.
- Preserve user input after recoverable errors.
- Avoid layout shifts that move a pending or destructive action beneath the
  user's pointer.

## Use Motion Sparingly

- Animate only when motion clarifies causality, hierarchy, continuity, or
  feedback.
- Prefer opacity and transform for transient UI.
- Keep routine transitions short and restrained.
- Avoid looping, ambient, parallax, celebratory, or attention-seeking motion in
  monitoring and safety-critical screens.
- Never use Tailwind's `transition-all`; list only the properties that need to
  transition.
- Avoid animating layout-sensitive properties when a transform can express the
  same result.
- Keep exit transitions fast and never delay the user's next action for polish.
- Respect both the app's `.reduce-motion` mode and the operating system
  `prefers-reduced-motion` preference.
- Use Framer Motion's reduced-motion support when Framer Motion controls the
  interaction.
- Make content and actions fully usable when motion is removed.
- Do not add motion to every element merely because a motion library is present.

## Use Figma as an Optional Visual Source

Use Figma only when the user supplies or identifies an approved Figma source, or
explicitly asks for design work there.

- Treat Figma as evidence for visual intent, tokens, component variants, assets,
  and responsive composition.
- Compare the design with current routes, product behavior, and shared
  primitives before implementing it.
- Map design elements onto the existing architecture rather than reproducing
  layer structure literally.
- Preserve code and product contracts when Figma is stale or incomplete.
- Surface meaningful conflicts and choose repository truth for behavior.
- Request only the access needed for the current design.
- Use synthetic data in frames and screenshots.
- Continue from repository evidence when Figma is unavailable and the task does
  not require an exact match.

## Implement in a Narrow Pass

1. Define the target route, components, viewports, states, and acceptance checks.
2. Reuse or extend the nearest existing primitive.
3. Implement structure and responsive behavior before decorative polish.
4. Add all applicable states before adding motion.
5. Keep class lists readable; extract repeated variants with existing project
   patterns rather than duplicating long strings.
6. Search the changed scope for `transition-all`, directional assumptions,
   missing accessible names, and accidental external asset URLs.
7. Review the diff for behavior, copy, contract, dependency, and scope drift.

Do not perform a broad redesign when the request identifies one screen or
component. Report adjacent opportunities instead of silently expanding scope.

## Verify the Result

Use the running product, not code inspection alone.

### Browser review

- Exercise the affected flow at mobile and desktop widths.
- Inspect Hebrew RTL layout, wrapping, scrolling, fixed elements, overlays, and
  keyboard focus.
- Exercise loading, empty, populated, error, disabled, pending, and success
  states that can be reached safely.
- Check browser console and relevant network failures.
- Compare before and after screenshots when the change is materially visual.
- Recheck with reduced motion and an enlarged text setting where supported.

### Automated checks

- Run the repository's discovered lint, build, and targeted test commands.
- Run existing Playwright tests for the affected flow when the setup is
  available.
- Add or update deterministic Playwright coverage when behavior or a critical
  visual state changed and the current task authorizes tests.
- Prefer role, label, and stable test-id locators over CSS structure.
- Avoid brittle pixel-perfect assertions for normal responsive variation.
- Record `NOT RUN` with the exact blocker when the app, fixture, browser,
  dependency, account, or safe test data is unavailable.
- Never describe an unavailable or skipped check as passed.

Before declaring the implementation complete, use `kippy-release-gate` when it
is available and report:

- the routes and files changed;
- the product behavior deliberately preserved;
- the visual and accessibility decisions made;
- the viewports, states, and commands actually checked;
- any missing evidence, residual risk, or follow-up opportunity.

## Provenance

This workflow is MIT-inspired by selected motion-review practices from
[Emil Kowalski's skills](https://github.com/emilkowalski/skills) and selected
visual-quality heuristics from
[Taste Skill](https://github.com/Leonxlnx/taste-skill). It is a concise,
Kippy-specific adaptation rather than a copy of either upstream skill. Consult
upstream licenses before importing upstream text or code beyond this attribution.
