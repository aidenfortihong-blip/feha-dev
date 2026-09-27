# FEHA / ADK NEW CHAT STARTER — 2026-09-27

Continue the FEHA / ADK Foundry project from:

`aidenfortihong-blip/feha-dev`

## First thing to do

Read:

`HANDOFF/FEHA_MASTER_HANDOFF_2026-09-27.md`

Then inspect the current repo before making any changes.

## Current build

**0.10.38**

## Working rules

- Patch GitHub directly. Do not ask me to paste repo code into Foundry.
- One conceptual change per pass. Test it, then move on.
- Preserve working functionality.
- V3 is primary. V2 is fallback only.
- Real Scene Token positions are authoritative in JACK IN.
- Current JACK IN uses direct trace lines only; do not restore relays unless I ask.
- Do not spend Quickhack RAM until APPLY DAMAGE / APPLY EFFECT.
- Target repeat-click deselects.
- Do not rerender JACK IN on simple target-state changes.
- Camera tokens are not normal actor targets.

## Current task

We are working on Cameras.

Camera placement foundation is already implemented in 0.10.38:
- Actor folder named `Camera`
- per-operator/per-user Camera actor
- user OWNER permission
- JACK IN CAMERA placement mode
- placement ghost
- normalized JACK IN position -> matching real active Scene Camera token
- existing Camera tokens mirror back into JACK IN
- FOV metadata already stored on Camera token flags

**Next pass: FOV only.**

Build:
- selectable FOV presets
- directional cone
- rotation control
- persist angle/rotation through `FEHA_CAMERAS.js`

Do not rebuild placement.
Do not add camera range/movement in the same pass unless I explicitly ask.
Do not add relays.
Do not refactor unrelated CSS.

If I say “continue cameras,” start from the current 0.10.38 repo and patch the FOV pass directly.
