# FEHA / ADK MASTER HANDOFF
**Project:** Flesh Enshrouded Heart Ablaze (FEHA / ADK)
**Date:** 2026-09-26
**Foundry baseline:** Foundry VTT 14.361 / dnd5e 5.3.3
**Dev repository:** https://github.com/aidenfortihong-blip/feha-dev
**Current live dev build:** 0.6.2

## Read this first
This is a real Foundry VTT cyberpunk rules/UI layer. The long-term goal is to move away from endless browser hotfixes and toward a proper FEHA/ADK module that owns Chrome Manager, Cyberdeck Terminal, Market/shops, character-sheet integrations, wallet/currency presentation, item/manufacturer systems, sound, visual language, and shared components.

Current dev workflow:
1. Assistant patches GitHub directly.
2. User runs ADK DEV LOADER.
3. User sends screenshot.
4. Assistant evaluates and patches exact selectors.

Do not make the user manually edit GitHub when repo write access is available.

## Immediate priorities
### Source-of-truth export
Before major new backend/mechanics work, run both Foundry exporters and upload the resulting JSON files:
- `foundry/FEHA_MODULE_SOURCE_EXPORTER.js`
- `foundry/FEHA_HANDOFF_EXPORTER.js`

These exports should become the authoritative basis for the installed module source, live actor/item structures, runtime APIs, and private CP2077 asset maps.

### Character-sheet integration
Next desired sheet work:
- rename **Spells** presentation to **Quickhacks**
- show **RAM** in the Quickhacks area
- use the real exported actor/item/backend fields once available rather than guessing

### Wallet
The broken embedded character-sheet wallet and surviving Chrome/Cyberdeck €$ launchers were suppressed in the dev patch while preserving backend wallet data.

Canonical wallet API:
- `globalThis.ADKWallet`
- internally uses GP
- displays **€$**

Long-term direction:
- wallet mechanics stay intact
- wallet/balance gets its own dedicated UI later
- do not reintroduce embedded wallet blocks into Chrome Manager or Cyberdeck

### Derke portrait
Newest requested Derke image:
`https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png`

### Ponyboy portrait
Correct Ponyboy image:
`https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/40e1fb5d-6265-4dfd-93d3-d6344dc14180.png`

### Core roster
For current player-facing ADK apps, the canonical active roster is:
- Ponyboy
- Derke
- Sasha
- Zach

Cyberdeck selector is explicitly locked to those four in build 0.6.1+.

Do not surface Nina, Florence, Cael, Xiao, or Jing in the current Cyberdeck roster. Do not delete their Foundry Actor documents.

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
- 0.4.16 removed the narrow `.system-state` strip that created a double-bar look beside the subsystem counter.
- 0.4.18 removed subsystem-row horizontal separator lines entirely.
Do not reintroduce either casually.

### Center
- portrait-side top mini signal removed
- center LINK/LATENCY/INTEGRITY/AUGMENTS strip removed
- system title is a clean bottom dock
- 0.4.20–0.4.21 removed remaining decorative portrait telemetry bars and stage pseudo-element line clutter

### Right ports
Intended:
- installed chrome = full-width row
- remaining vacant ports below = two columns
- all-vacant subsystem can remain three-across

### Empty cache
Giant white atlas bars were fixed in 0.4.8. Do not render CP2077 white mask crops literally.

## Cyberdeck V2
Build 0.6.0 replaced the legacy purple Cyberdeck presentation entirely.

Canonical entry point remains:
- `game.adk.openCyberdeck()`

The dev patch now overrides that entry point with a FEHA-owned Cyberdeck UI rather than styling the old template.

Current rules/direction:
- roster: Ponyboy, Derke, Sasha, Zach only
- no Heat UI
- no Humanity UI
- primary telemetry: RAM, installed deck/hardware link, software load
- RAM recovery remains Short Rest only
- Quickhacks are persistent software items and can be loaded/ejected/run from the Cyberdeck
- use actual actor/item art heavily
- use CP2077 private UI assets heavily
- use existing FEHA sound engine heavily
- no wallet/€$ UI inside Cyberdeck

Current Cyberdeck tabs:
- Quickhacks
- Network
- Memory
- Diagnostics

Current visual direction:
- flat black CRT/terminal shell
- cyan/magenta/yellow functional color
- clipped/chamfered geometry
- dense diagnostics
- segmented RAM
- large item/quickhack/support-chrome art
- asset-backed HUD/frame/button/crossline/barcode/glow treatment
- large JACK IN action
- stronger sounds on open/close/hover/actor switch/tab/load/eject/run/rest/JACK IN

Build 0.6.2 maps these private CP2077 UI assets into Cyberdeck V2 when the browser asset bridge is present:
- frame background
- HUD patch
- highlight
- lines
- crossline
- outerline
- button holders
- reward frame
- buffer graphics
- barcodes
- code strip
- frame glow / small glow

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

Canonical V3 dev loader:
- resolves main -> exact commit SHA
- fetches immutable base CSS/JS + Cyberdeck V3 CSS/JS from that SHA
- cleans previous V3/base runtime
- suppresses deprecated V2 presentation while V3 owns the launcher
- restores V2 only as a recovery fallback if V3 load fails
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
- 0.4.17 legacy character-sheet wallet suppression
- 0.4.18 subsystem row lines removed
- 0.4.19 surviving €$ launcher / broken legacy wallet editor suppression
- 0.4.20–0.4.21 portrait HUD/stage line cleanup
- 0.5.0–0.5.3 exploratory legacy Cyberdeck styling/diagnostics; superseded by Cyberdeck V2
- 0.6.0 complete FEHA-owned Cyberdeck V2 replacement
- 0.6.1 larger/readable Cyberdeck + roster locked to Ponyboy/Derke/Sasha/Zach
- 0.6.2 Heat/Humanity removed; Cyberpunk asset-heavy beauty pass + expanded sound feedback
- 0.8.0 Cyberdeck V3 single-screen loadout + separate fullscreen JACK IN scene view
- 0.8.1–0.8.3 V3 layout/readability/polish, full-width JACK IN, live refresh, canonical Short Rest behavior
- 0.8.4 deep audit/hardening: V2/V3 race removed, canonical V3 loader, lifecycle/action locks, cache/deck/support detection fixes, overflow handling, active-scene target validation, collision avoidance, sound/observer cleanup

## Signal profile
There is already a native telemetry engine in current dev JS:
- deterministic waveform
- requestAnimationFrame
- about 30 fps throttling
- actor/system seed
- barcode pulse

User also pasted a standalone signal-profile hotfix macro. Do not accidentally run two independent animation loops. Compare before merging.

## Delivery preferences
- if the ADK/dev repo can own a change, patch it directly instead of giving the user a macro/snippet to paste
- use Foundry macros only when live-world access/export/migration genuinely requires Foundry execution
- complete Foundry macros, not fragments
- macro should update/overwrite target automatically when practical
- show progress/completion for long migrations
- use screenshot-driven iteration
- inspect actual repo/current CSS/JS before patching

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


## Export helpers now in the repo
Run these as GM Script Macros in Foundry before starting the next chat:

1. `foundry/FEHA_MODULE_SOURCE_EXPORTER.js`
   - captures the installed ADK/FEHA module manifest
   - captures manifest-listed JS / ES modules / CSS / language files
   - recursively follows referenced text source such as imported JS, CSS, HBS, HTML, JSON, TXT, and Markdown
   - records referenced binary asset paths without copying the binaries
   - downloads `FEHA_ADK_MODULE_SOURCE_*.json`

2. `foundry/FEHA_HANDOFF_EXPORTER.js`
   - exports Ponyboy / Derke / Sasha / Zach Actor JSON
   - exports all world Item JSON and folder metadata
   - exports the two known FEHA CP2077 private asset maps from browser storage
   - exports current runtime asset map
   - records runtime API names for ADKWallet / ADKCore / Chrome backend
   - downloads `FEHA_ADK_HANDOFF_*.json`

Upload both JSON files into the next chat/project. Those two files are the bridge from the live Foundry world into a source-grounded rebuild.

## Next-chat first actions
1. Read this handoff.
2. Inspect current repo, especially `latest-dev.js`, `latest-dev.css`, and `version.json`.
3. Load and inspect the two Foundry export JSON files if provided.
4. Treat exported installed-module source and live actor/item data as authoritative over guessed field names.
5. Continue **Cyberdeck V3 from build 0.8.4**. V2 is recovery fallback only; do not revive it as the primary UI.
6. Keep Cyberdeck roster to Ponyboy / Derke / Sasha / Zach.
7. Continue character-sheet work: Spells -> Quickhacks presentation and RAM display, grounded in exported data.
8. Start moving important systems from live patch code into the real module source once module source is available.
9. Preserve the current Chrome Manager visual language and wallet suppression.


---

# AUTHORITATIVE CYBERDECK V3 ADDENDUM — 2026-09-26 // BUILD 0.8.4

This section supersedes older Cyberdeck V2 continuation language elsewhere in this document.

## Active runtime
- Base shared patch: `latest-dev.js` build 0.8.4.
- Cyberdeck UI/runtime: `foundry/FEHA_TABLETOP_UI_V3.js` build 0.8.4.
- Cyberdeck presentation: `cyberdeck-v3.css`.
- Canonical loader: `foundry/ADK_DEV_LOADER.js`.
- `version.json` is the compact machine-readable audit summary.
- V2 remains in `latest-dev.js` only as a fallback if V3 cannot load.

## Locked Cyberdeck architecture
The normal Cyberdeck is a **single loadout screen**, not a tabbed app:
- operator portrait
- RAM
- compact Short Rest RAM restore
- installed Cyberdeck
- support chrome
- loaded Quickhacks
- owned software library / LOAD-EJECT
- large full-width JACK IN action

Do not restore Network / Memory / Diagnostics tabs.
Do not restore Heat or Humanity.

JACK IN opens a separate fullscreen active-scene view:
- green code/handshake transition
- scene actor-token sweep
- operator center node
- scene target nodes
- Foundry target acquisition
- loaded Quickhack execution bar
- closing JACK IN returns to the loadout screen

## Roster
Only:
- Ponyboy
- Derke
- Sasha
- Zach

## Mechanics
- RAM restores on Short Rest only.
- Long Rest does not restore RAM.
- No passive RAM regeneration.
- Actor inventory Quickhacks count as owned even if legacy purchase metadata is absent.
- `flags.fleshEnshrouded.ramCost` is canonical when present.
- Over-capacity loaded Quickhacks after a deck downgrade remain visible but cannot execute until ejected.
- Deck passives / Quickhack saves, damage, conditions, and chained effects remain descriptive/manual unless the stable FEHA module later gains canonical automation.

## 0.8.4 audit fixes
- removed V2/V3 launcher race
- removed document-wide V3 reclaim observer
- canonical repo loader now loads V3 directly
- dead hot-reload callbacks cannot resurrect old builds
- runtime action locks survive rerenders
- Cyberdeck recognition matches module names (Cyberdeck / Paraline / Netdriver / Tetratronic / Raven Micro)
- other Cyberdecks cannot count as support chrome
- stashed cache cyberware is not treated as installed
- ordinary inventory cannot leak into owned chrome through fallback slot inference
- exporter APIs remain available under V3
- base observer only scans newly-added DOM subtrees rather than the full document on each mutation
- private UI/audio assets can bootstrap directly from the private Forge/localStorage map
- sound volume preserves per-event mix and missing private sounds fall back individually
- JACK IN validates current-scene targets and avoids common node/operator overlap
- closing JACK IN returns to Cyberdeck
- failed LOAD no longer leaves controls disabled
- async actor switching no longer gets pulled back to an old operator
- Derke V3 portrait uses the approved `1 Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png` Forge source
- user-facing F12 recovery instructions removed
- shipped JS syntax + CSS structure verified after audit

## Known data caveat
The 2026-09-26 handoff export contains legacy Quickhack records whose prose RAM number can disagree with `flags.ramCost`. V3 treats the flag as canonical and corrects its own displayed text without silently rewriting world source items. A fresh live export should be used before any catalog-wide source-data migration.
