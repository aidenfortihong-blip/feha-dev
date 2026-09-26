# FEHA / ADK MASTER HANDOFF
**Project:** Flesh Enshrouded Heart Ablaze (FEHA / ADK)
**Date:** 2026-09-26
**Foundry baseline:** Foundry VTT 14.361 / dnd5e 5.3.3
**Dev repository:** https://github.com/aidenfortihong-blip/feha-dev
**Current live dev build:** 0.4.16

## Read this first
This is a real Foundry VTT cyberpunk rules/UI layer. The long-term goal is to move away from endless browser hotfixes and toward a proper FEHA/ADK module that owns Chrome Manager, Cyberdeck Terminal, Market/shops, character-sheet integrations, wallet/currency presentation, item/manufacturer systems, sound, visual language, and shared components.

Current dev workflow:
1. Assistant patches GitHub directly.
2. User runs ADK DEV LOADER.
3. User sends screenshot.
4. Assistant evaluates and patches exact selectors.

Do not make the user manually edit GitHub when repo write access is available.

## Immediate priorities
### Character-sheet wallet
The current ADK wallet block is visually glitching in the sheet header near ability scores.

User direction:
- remove/hide those embedded wallet blocks for now
- preserve wallet mechanics
- later redesign wallet/balance as a dedicated UI with its own identity/container/ID

Canonical wallet API:
- `globalThis.ADKWallet`
- internally uses GP
- displays **€$**

### Derke portrait
Newest requested Derke image:
`https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png`

### Ponyboy portrait
Correct Ponyboy image:
`https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/40e1fb5d-6265-4dfd-93d3-d6344dc14180.png`

### Chrome Manager roster
Keep visible/core:
- Ponyboy
- Derke
- Sasha
- Zach
- Jing may remain if present

Hide from selector:
- Nina
- Florence
- Cael
- Xiao

Do not delete their Foundry Actor documents.

## Naming
Do not call it “Augmentation Theatre.”

Use:
- **Chrome Manager** = full cyberware UI
- **Owned Chrome** = bottom hardware cache
- **Systems** = Cortex / Arms / Dermal Shell / etc.
- **Hardware Dossier** = right-side item/detail panel
- **portrait stage** = center character presentation

Build 0.4.15 added runtime terminology replacement for old “Augmentation Theatre/Theater” strings.

## Chrome Manager layout
- Left: subsystem/system index
- Middle: character portrait as hero
- Right: hardware dossier
- Bottom: Owned Chrome drawer

Systems:
- Cortex
- Arms
- Structural Frame
- Nervous System
- Dermal Shell
- Operating System
- Face / Optics
- Hands
- Circulatory
- Lower Mobility

Portrait direction:
- keep portrait in middle
- no mannequin
- no skeleton
- no body rig
- no literal anatomy rig
- HUD mostly around/behind portrait
- do not obscure face/body

## Visual constitution
- graphite-black industrial base
- character accent colors used as signals, not flood fills
- clipped/mechanical/interlocking/asymmetrical/brutalist geometry
- no generic glassmorphism
- mostly still until player acts
- Oxanium headings
- Rajdhani UI
- Share Tech Mono telemetry

Motion hierarchy:
- subtle ambient
- clean navigation
- sharp glitch/flash feedback
- larger effects only for important actions

Signature effect: signal fracture
- 2–3 slice misalignment
- character-color offset
- snaps back
- use sparingly

Avoid:
- giant screen-wide sweeps
- giant wave effects
- constant noisy motion
- rounded SaaS cards
- neon flooding
- endless glow rectangles

## Current UI fixes
### Left rail
Build 0.4.16 removed the narrow `.system-state` strip that created a double-bar look beside the subsystem counter. Do not reintroduce it casually.

### Center
- portrait-side top mini signal removed
- center LINK/LATENCY/INTEGRITY/AUGMENTS strip removed
- system title is a clean bottom dock

### Right ports
Intended:
- installed chrome = full-width row
- remaining vacant ports below = two columns
- all-vacant subsystem can remain three-across

### Empty cache
Giant white atlas bars were fixed in 0.4.8. Do not render CP2077 white mask crops literally.

## Cyberpunk 2077 private asset pack
User used ChatGPT Work + WolvenKit against their own local Cyberpunk 2077 install.

Private scalp summary:
- 813 original Ink/font/texture resources
- 470 structured JSON exports
- 343 PNG textures
- 1,262 source sprite crops
- 12,014 atlas slots
- 45,557 widget records
- 26,241 animation-track records
- 4,992 style-property records
- 14 sfnt font exports
- 16 primary production sounds
- 8 alternates
- 30 candidate/original audio sources
- 27 selected UI PNGs on private Forge
- 16 WAVs on private Forge
- 32 unresolved referenced resources recorded

Private Forge locations:
- `FEHA/cp2077/audio/`
- `FEHA/cp2077/ui/`

Browser/private asset bridge keys:
- `fehaCP2077PrivateAssetsV1`
- `fehaCP2077LocalSfxV1`

Runtime:
- `globalThis.FEHA_CP2077_ASSETS`

Do not put proprietary CP2077 source media in the public repo.

Curated logical UI names:
- 5a1f20d7c3_armor_barbg
- a2ad0aec28_bar
- 38888b05f0_bar_long2
- 3ec9bd29f0_counterLabel
- 83986e3d27_counterLabel_stroke
- 4113949e24_cw_barbg
- aa246e3117_cw_mask
- 697dae4bde_buffer_empty
- 4416a73d89_buffer_activated
- 59feb7cd32_frame_glow
- 8cd8de72f8_frame_glow_small
- 7c16fcece5_fluff_barcode1
- 2bead2d3f6_fluff_barcode3
- 88ab2fcdee_fluff_barcode4
- 1a0c3eb3ee_fluff_code1
- 2ae8c588ae_fluff_highlight
- ef56f53fa5_fluff_lines
- d4e7518fde_crossLine
- 9674e9d0b8_outerLine
- 5c8f822dbf_gog_button_holder
- ac81a43116_gog_button_holder_02
- a13706adc6_gog_frame_reward
- 6691702ad7_hud_patch_frame
- ffe5273fdf_frame_bg

Many extracted PNGs are source masks. Prefer CSS masks/geometry over raw image rendering.

## Cyberpunk SFX
Known event names:
- hover
- select
- subsystem_select
- actor_switch
- drawer_open
- drawer_close
- cyberware_select
- scan
- install
- remove
- error
- confirm
- cache_open
- cache_close
- compatibility_ok
- compatibility_fail

Current engine supports:
- private Forge URLs
- local data audio
- Kenney fallback

Do not push proprietary audio to public GitHub.

## Mechanics / APIs
Canonical:
- `globalThis.ADKWallet`
- `globalThis.ADKCore`

Rules:
- wallet uses GP internally, shows €$
- RAM recovers on Short Rest only
- not on Long Rest
- no per-combat auto reset
- no mechanical Cinder

Older chrome baseline:
- capacity 12 + 4/level
- body slot limits
- real source/backend overrides prose when conflicts exist

Starting PCs:
- about 3 chrome
- 1 strong gun
- per-character capacity varies

## Item/manufacturer direction
Normalized flag direction:
- mk
- manufacturer
- weaponClass
- shopType
- bodyArmor
- cyberwareSlot
- quickhack
- catalogEnabled

Design:
- guns should feel powerful
- companies should create distinct playstyles
- manufacturer effects simple, memorable, powerful
- avoid cloned generic bonuses
- no AP
- armor AC higher than stock 5e expectation
- shops randomized/rerollable
- tier chooser
- item color follows Mk, not dealer tier
- quickhacks only in stores
- trusted players have access to shop items
- details popup above shop UI
- Chrome Manager left side shows owned, not merely installed

## Dev repo
Repository:
`aidenfortihong-blip/feha-dev`

Important files:
- `latest-dev.js`
- `latest-dev.css`
- `version.json`
- `foundry/ADK_DEV_LOADER.js`
- `audio/kenney/*`

Loader v2:
- resolves main -> exact commit SHA
- fetches immutable JS/CSS from that SHA
- cleans previous patch
- injects CSS
- evals JS
- reports build + SHA

## Build history
- 0.4.0 full CP2077 rerun
- 0.4.1 raw white overlay cleanup
- 0.4.2 left rail polish
- 0.4.3 telemetry isolation / hero cleanup
- 0.4.4 fake numeric clutter cleanup
- 0.4.5 portrait-side mini signal removed
- 0.4.6 center status strip removed / title dock rebuilt
- 0.4.7–0.4.9 hardware port iteration
- 0.4.10 Nina/Florence/Cael hidden
- 0.4.11–0.4.14 Derke/Ponyboy portrait override work
- 0.4.15 naming -> Chrome Manager
- 0.4.16 subsystem double-bar removed

## Signal profile
There is already a native telemetry engine in current dev JS:
- deterministic waveform
- requestAnimationFrame
- about 30 fps throttling
- actor/system seed
- barcode pulse

User also pasted a standalone signal-profile hotfix macro. Do not accidentally run two independent animation loops. Compare before merging.

## Delivery preferences
- complete Foundry macros, not fragments
- macro should update/overwrite target automatically when practical
- show progress/completion for long migrations
- if GitHub can be patched directly, patch it directly
- use screenshot-driven iteration
- inspect actual repo/current CSS before patching

## Source-of-truth package wanted next
The next chat should work from:

1. **Full installed ADK module source**
   - manifest
   - JS / ES modules
   - CSS
   - templates
   - helpers
   - backend classes
   - related text/JSON files

2. **Cyberpunk private asset manifest**
   - asset names + Forge paths/URLs
   - no need to upload thousands of binaries

3. **Important Foundry data**
   - Ponyboy
   - Derke
   - Sasha
   - Zach
   - cyberware
   - cyberdecks
   - quickhacks
   - support chrome
   - manufacturers
   - related world/module items
   - compendium data if available

4. **Large binaries**
   - Google Drive or ZIP if not already reachable by Forge URL

5. **Never request or include**
   - passwords
   - API keys
   - Forge credentials
   - GitHub tokens
   - OAuth secrets

## Next-chat first actions
1. Read this handoff.
2. Inspect current repo.
3. Obtain/export actual installed module source and real Foundry data.
4. Hide/remove broken wallet UI while preserving wallet mechanics.
5. Update Derke to newest portrait.
6. Start moving important systems from live patch code into the real module source.
7. Preserve the current Chrome Manager visual language.
