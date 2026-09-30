# FEHA Claude Code Instructions

This repository includes project-local Claude Code skills under `.claude/skills/`. Use them when their trigger matches the task instead of treating them as passive reference files.

## UI / design skill routing

- For any substantial FEHA UI redesign or polish pass, use `design-taste-frontend` first to avoid generic or templated UI.
- For FEHA's cyberpunk visual language, choose the most relevant Awesome Design Skills reference among:
  - `matrix` for dense terminal / cyber-slick interfaces.
  - `neon` for high-contrast luminous accents.
  - `brutalism` for raw, hard-edged utility layouts.
  - `sleek` for cleaner, lower-noise application surfaces.
  Do not blend all four by default. Pick the one that best matches the specific FEHA application and preserve each application's established visual identity.
- When the user provides a screenshot, mockup, or visual reference and asks to match or rebuild it, use `image-to-code`.
- Before considering a UI pass finished, use `web-design-guidelines` to audit accessibility, interaction quality, hierarchy, spacing, overflow, responsive behavior, and obvious UX regressions.
- When a runnable FEHA web/Foundry surface is available, use `playwright-cli` to validate the actual rendered interface, interactions, console errors, layout overflow, and regressions instead of relying only on static code inspection.

## Playwright availability

The `playwright-cli` skill is project-local and discoverable by Claude Code. The executable itself is an external Node tool. If `playwright-cli` is unavailable in the environment, use an already-installed local version via `npx` when possible; otherwise ask before installing `@playwright/cli`.

## FEHA design principle

Do not let generic design-system advice erase FEHA's established application-specific identity. Skills are quality and implementation aids, not permission to homogenize the Cyberdeck, Market, Chrome Manager, weapon sheets, or tabletop UI into one style.

## Engineering skill routing

- Use `ponytail` on normal FEHA coding, bug-fix, refactor, and dependency decisions. Default to its `full` intensity: trace the real flow first, then prefer the smallest root-cause fix over another patch layer. Do not use it to skip validation, error handling, accessibility, security, or explicitly requested behavior.
- Use `graphify` for broad codebase/architecture questions, dependency tracing, cross-file relationships, or before a large refactor when understanding FEHA's accumulated module interactions matters. If `graphify-out/graph.json` already exists, query it instead of rebuilding. Do not build/rebuild a graph for every small edit.
- Use `agentskills` when creating, importing, validating, or reorganizing project-local skills under `.claude/skills/`. Its bundled references define the portable Agent Skills format and authoring/integration rules.
- Use `omniroute` only when OmniRoute itself is configured or the user asks to use/configure it. The skill is discoverable here, but actual routing requires a running OmniRoute instance plus `OMNIROUTE_URL` and `OMNIROUTE_KEY`; do not pretend the skill file alone provides the service.
- Use `foundry-vtt-module-dev` for Foundry VTT implementation details, v14 APIs, ApplicationV2, hooks, document models, canvas/PIXI, sockets, rolls, migration behavior, and Foundry-specific debugging. Prefer its bundled v14 references over guessing from older Foundry patterns.
- Use `debug` whenever FEHA behavior is broken or regressed: reproduce first, localize the failure, test one hypothesis at a time, fix the root cause, then retest the original flow. Pair it with `playwright-cli` for rendered Foundry/UI bugs.
- Use `verification-before-completion` before saying a code change is fixed, complete, passing, or regression-free. Run fresh verification appropriate to the change; for UI work, exercise the actual flow with Playwright when the Foundry surface is available. Evidence comes before the success claim.

## External runtime note

Some project-local skills describe external CLIs/services rather than embedding those runtimes in this repository. Detect availability before use. In particular, `graphify` may install/use the `graphifyy` Python package when explicitly invoked, and `omniroute` requires the OmniRoute service. Do not silently reconfigure the user's machine or provider routing merely because the skill exists.

