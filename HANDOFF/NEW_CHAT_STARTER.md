# FEHA / ADK NEW CHAT STARTER — 2026-09-30

Continue the FEHA / ADK Foundry project from:

`aidenfortihong-blip/feha-dev`

## First thing to do

Read:

`HANDOFF/FEHA_MASTER_HANDOFF_2026-09-30.md` (current), then `HANDOFF/FEHA_MASTER_HANDOFF_2026-09-28.md` for Gateway / JACK IN / roster rules

Then inspect the current repo before making any changes.

## Current build

**0.11.80** (see `version.json`)

## Non-negotiable working rules

- Patch GitHub directly. Do not ask me to paste normal repo code into Foundry.
- One conceptual change per pass unless I explicitly ask for a bundle.
- Current repo/main and version.json beat older handoffs/README.
- V3 is primary. V2 is fallback only.
- Playable roster is Ponyboy, Derke, Sasha, Zach only.
- Do not surface Jing.
- Preserve working Market / Wallet / Cyberdeck / JACK IN behavior unless I ask to change it.

## Gateway state (unchanged since 0.10.79)

Gateway behavior is unchanged since 0.10.79:

1. Gateway preloads YouTube video id `mH2wmyeiIpA`.
2. Exact typed valid name attempts to start the YouTube audio.
3. Player authenticates.
4. ESTABLISH LINK retries/resumes playback from the button gesture if autoplay blocked it.
5. Longer blue 3D fly-through runs.
6. The already-running video fades in from behind the blue field.
7. Main transition centerpiece says **ACTIVATED // CONNECTION ESTABLISHED**.
8. Blue UI fades away.
9. Video owns the screen.
10. Player gets **SKIP INTRO**.
11. Skip or natural video end returns to the live scene.

AI/browser speech voice is removed.
Old private MP3 match-track importer is removed.

## Important regressions to avoid

- no gray Gateway wash
- no strip under CYBERPUNK
- left side scrolls and auto-follows
- right side never scrolls
- no role/archetype subtitle
- no SIGNATURE/CLEARANCE filler
- no AI voice
- no Jing
- no relays in JACK IN
- RUN preview does not spend RAM
- Credits/CR remains canonical (no €$ anywhere)
- Market/Chrome selector actor must equal the backend actor (never Cael)
- Test on a branch on the GM client before pushing main — main is live for players

If I send a screenshot with one problem, patch that one problem directly.
