# FEHA / ADK MASTER HANDOFF — 2026-09-28

**Project:** Flesh Enshrouded Heart Ablaze / ADK  
**Repository:** `aidenfortihong-blip/feha-dev`  
**Branch:** `main`  
**Foundry baseline:** 14.361 / dnd5e 5.3.3  
**Current verified build:** **0.10.79**  
**Current scope:** `youtube-edgerunners-intro-handoff`

---

# 0. READ THIS FIRST

This is the authoritative repo handoff for the current project state.

The user explicitly does **not** want to reconstruct context or paste normal repo code into Foundry.

## Non-negotiable workflow

1. Inspect the exact current repo first.
2. Patch GitHub directly.
3. Work **one conceptual change per pass** unless the user explicitly asks for a bundle.
4. Bump `foundry/FEHA_TABLETOP_UI_V3.js` VERSION for V3/Gateway behavior changes.
5. Update `version.json`.
6. Syntax-check JS.
7. Commit with current blob SHA.
8. Read back and verify.
9. User runs **ADK DEV LOADER** and tests.

Do **not** start a new chat by asking the user to explain the roster, Gateway, camera concept, current repo, or current task again.

## Source priority

If anything conflicts:

1. current repo on `main`
2. current `version.json`
3. current live Foundry/module exports
4. this handoff
5. older handoffs / README
6. old chat recollection

Older handoffs still contain valuable architecture history but have stale task/build information.

---

# 1. CURRENT SNAPSHOT

- Build: **0.10.79**
- Current focus: **Entry Gateway cinematic login / music / intro handoff**
- Canonical player-facing roster: **Ponyboy, Derke, Sasha, Zach**
- Transition centerpiece: **ACTIVATED // CONNECTION ESTABLISHED**
- AI/browser speech voice: **removed**
- Current intro media: YouTube video ID **mH2wmyeiIpA**
- Exact typed valid name attempts to start intro audio
- ESTABLISH LINK retries/resumes playback via button user gesture
- Blue 3D transition is intentionally longer than the original bumper
- Video fades in from behind the blue 3D transition
- Blue UI fades away
- Video owns the screen
- Player gets **SKIP INTRO**
- Natural video end also exits to live Foundry scene
- Old private MP3 match-track importer was removed in 0.10.79
- Camera placement remains implemented but is **parked**, not deleted

---

# 2. REPO / LOADER

Important files:

- `latest-dev.js`
- `latest-dev.css`
- `cyberdeck-v3.css`
- `version.json`
- `foundry/ADK_DEV_LOADER.js`
- `foundry/FEHA_TABLETOP_UI_V3.js`
- `foundry/cyberdeck/FEHA_CYBER_CORE.js`
- `foundry/cyberdeck/FEHA_NETWORK_DEVICES.js`
- `foundry/cyberdeck/FEHA_DEVICE_ACTIONS.js`
- `foundry/cyberdeck/FEHA_NETWORK_APPROVALS.js`
- `foundry/cyberdeck/FEHA_CAMERAS.js`
- `foundry/FEHA_HANDOFF_EXPORTER.js`
- `foundry/FEHA_MODULE_SOURCE_EXPORTER.js`

Current loader order:

1. latest-dev.js
2. FEHA_CYBER_CORE.js
3. FEHA_NETWORK_DEVICES.js
4. FEHA_DEVICE_ACTIONS.js
5. FEHA_NETWORK_APPROVALS.js
6. FEHA_CAMERAS.js
7. FEHA_CYBER_CORE.init()
8. FEHA_TABLETOP_UI_V3.js

The DEV LOADER is still **GM-only**.

V2 is recovery fallback only.

---

# 3. PRIME ARCHITECTURE RULE

> **JACK IN renders entities. Adapters own mechanics.**

Do not move specialized world mutation, socket authority, camera mechanics, turret rules, or device-specific behavior into `FEHA_TABLETOP_UI_V3.js`.

Current module responsibilities:

- **Cyber Core** — module registry, lifecycle, event bus
- **Network Devices** — normalized records, scanning, types/capabilities, Security DC, discovery state
- **Device Actions** — breach/access, capability execution, Foundry mutations
- **Network Approvals** — sockets, GM approval/authority
- **Cameras** — Foundry-backed camera actors/tokens + placement authority
- **V3 UI** — presentation and user interaction

---

# 4. CANONICAL ROSTER

Player-facing ADK roster is exactly:

- Ponyboy
- Derke
- Sasha
- Zach

Rules:

- spelling is **Derke**, never Derka
- show **Sasha**, not Sasha Bogdanov
- legacy `Raiden` actor references may normalize to Zach
- Sasha-prefixed actor names may normalize to Sasha
- do not surface Nina, Cael, Florence, Xiao, Jing, etc. unless user explicitly changes roster
- do not delete those Actors from the world just because selectors filter them

Current Gateway art:

- Ponyboy: `https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/Ponyboy.png`
- Derke: `https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png`
- Sasha: `https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/Sasha.png`
- Zach: `https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/ea2ba918-d53f-43d8-b03e-da556fd27862.png`

There is **no Jing** in the current custom Gateway model.

If Jing appears, the native/legacy Gateway resurfaced or the custom API replacement failed. Debug load order. Do not add Jing back.

---

# 5. VISUAL CONSTITUTION

Shared FEHA language:

- graphite / near-black industrial base
- cyan, yellow, red/magenta accents as signals
- clipped/chamfered/brutalist geometry
- readable typography
- no generic SaaS rounded-card look
- no broad gray haze
- no white CP2077 mask textures rendered literally
- ambient motion can be rich but should be slower/smoother
- strong flashes/glitches belong to meaningful actions

Cyberdeck specifically may use the strongest CRT / cyan-magenta-yellow terminal language.

Chrome Manager and Market should feel related but distinct.

---

# 6. PRIVATE CP2077 ASSETS

The user privately extracted Cyberpunk 2077 UI/audio assets from their own local install.

**Never commit proprietary CP2077 media into the public GitHub repo.**

Private runtime locations / maps:

- `FEHA/cp2077/ui/`
- `FEHA/cp2077/audio/`
- `localStorage.fehaCP2077PrivateAssetsV1`
- `localStorage.fehaCP2077LocalSfxV1`
- optional `globalThis.FEHA_CP2077_ASSETS`

Known logical names include:

- `ffe5273fdf_frame_bg`
- `6691702ad7_hud_patch_frame`
- `2ae8c588ae_fluff_highlight`
- `ef56f53fa5_fluff_lines`
- `d4e7518fde_crossLine`
- `9674e9d0b8_outerLine`
- `5c8f822dbf_gog_button_holder`
- `ac81a43116_gog_button_holder_02`
- `a13706adc6_gog_frame_reward`
- `59feb7cd32_frame_glow`
- `8cd8de72f8_frame_glow_small`
- `7c16fcece5_fluff_barcode1`
- `2bead2d3f6_fluff_barcode3`
- `88ab2fcdee_fluff_barcode4`
- `1a0c3eb3ee_fluff_code1`
- `a2ad0aec28_bar`
- `38888b05f0_bar_long2`
- `3ec9bd29f0_counterLabel`
- `83986e3d27_counterLabel_stroke`
- `697dae4bde_buffer_empty`
- `4416a73d89_buffer_activated`

---

# 7. ENTRY GATEWAY — CURRENT 0.10.79

The old native Entry Gateway is no longer the active design.

`latest-dev.js` owns a full custom Gateway while preserving public `ADKEntryGateway.open/reopen/close/reset`.

## Layout

Header:
- SESSION ACCESS NODE // ADK
- large CYBERPUNK title
- state chip

Left side:
- identity authentication
- boot lines
- ENTER ID
- registry match
- authenticate
- biometric stack
- diagnostic console

Right side:
- fixed compact candidate rail
- exactly four candidates
- no role/archetype subtitle text
- no scrolling
- profile card with portrait, name, BIO-ID, SYNC
- no SIGNATURE filler
- no CLEARANCE filler

Footer:
- encryption/node metadata
- ESTABLISH LINK
- GM BYPASS

Old SET MATCH TRACK button is gone.

## Scrolling

- left work column is the only scrollable side
- it auto-follows incoming boot/auth/biometric output
- right side must not scroll

## Boot lines

- POWER BUS ................. ONLINE
- SESSION NODE .............. CONNECTED
- CIVIL ID REGISTRY ......... MOUNTED
- BIOMETRIC SERVICES ........ STANDBY
- NEURAL HANDSHAKE .......... ARMED
- IDENTITY GATE ............. READY

## Authentication

Exact typed name:
- selects candidate
- fills profile/accent
- enables AUTHENTICATE
- logs registry match
- now attempts to start hidden YouTube intro audio

Auth verification:
- CIVIL REGISTRY HASH
- VOICEPRINT
- RETINAL SIGNATURE
- BIOMETRIC MESH
- NEURAL LATENCY
- CORTICAL SIGNATURE
- SESSION CLEARANCE

On success:
- ACCESS GRANTED
- ESTABLISH LINK becomes available

Session key:
`adk-entry-gateway:passed:v1`

## Important visual regressions to avoid

0.10.68 removed:
- broad gray wash/haze
- little gray strip under CYBERPUNK

Do not bring either back.

0.10.69:
- left-only scrolling
- fixed compact right rail
- role/archetype text removed
- SIGNATURE/CLEARANCE removed

0.10.70:
- left pane auto-follow output

0.10.77:
- AI/browser speech voice removed

0.10.78:
- large 3D centerpiece changed to **ACTIVATED // CONNECTION ESTABLISHED**

---

# 8. YOUTUBE INTRO HANDOFF — CURRENT 0.10.79

Current media source:

- video id: `mH2wmyeiIpA`
- URL: `https://www.youtube.com/watch?v=mH2wmyeiIpA`

The old uploaded/private MP3 workflow is not the active system anymore.

## Flow

1. Gateway opens.
2. YouTube IFrame API/player is preloaded during Gateway boot.
3. Player types exact valid name.
4. Hidden player attempts to begin audio.
5. Authentication continues while media keeps running.
6. Player clicks ESTABLISH LINK.
7. That button user gesture retries/resumes playback if browser autoplay blocked the typed-name start.
8. Blue 3D session transition runs longer than before.
9. During SESSION TRANSFER, the already-running video begins fading in from behind the blue field.
10. Final system state is **ACTIVATED // CONNECTION ESTABLISHED**.
11. Blue overlay fades away.
12. YouTube intro owns the screen.
13. **SKIP INTRO** appears.
14. Skip fades/stops/destroys media and returns to scene.
15. Natural video end does the same.

## 3D transition direction

The intended feel is SAO-style depth without using the literal phrase LINK START:

- real CSS perspective
- concentric rings from deep negative Z
- radial rails
- particles flying toward/past viewer
- camera-forward drift
- title punches toward viewer
- final lunge / bright activation feel

Do not flatten it back into a static terminal screen.

## Current overlay/stage behavior

Custom intro stage:
- `feha-gateway-intro-stage`
- starts visually hidden
- `is-revealing`
- `is-visible`
- `can-skip`
- `is-finishing`

Blue 3D handoff classes:
- `is-video-reveal`
- `is-video-handoff`

The video should fill screen without exposing normal YouTube controls.

## Important caveat

Browser autoplay policy may block audible playback from typing.

The ESTABLISH LINK click retry exists specifically for this.

If audio starts only after ESTABLISH LINK, first consider autoplay policy before rewriting the whole system.

The YouTube video also depends on network access and embed permission.

Do not publish a downloaded copyrighted copy of the video/song into this public repo.

---

# 9. SOUND ENGINE

Shared FEHA sounds include:

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
- session_join

Fallback public-safe files live in `audio/kenney/`.

User preference:
- tactile distinct sounds
- softer overall
- avoid harsh Market/Gateway audio
- avoid indiscriminate hover spam

---

# 10. CREDITS WALLET / MARKET / CHROME

## Credits

Canonical:
- `flags.fleshEnshrouded.credits`
- displayed as **CR**

0.10.50 migrated old GP/Eurodollar state and kept legacy compatibility aliases.

Do not put Wallet back inside Cyberdeck/Chrome unless asked.

## Market

Current:
- actor selector
- six storefronts
- dealer tiers
- reroll
- search
- filters
- details
- buy/no-funds
- pagination
- trusted-player catalog

Visual:
- black clipped shell
- cyan system lines
- yellow action
- red currency/danger
- restrained scans

Removed:
- stale CAP
- redundant top directory/store icon

Sounds were deliberately softened.

## Chrome Manager

Must keep current four-character roster filtering.

Direction:
- owned but not installed visible separately
- installed cyberware in correct slots
- +/- / install-remove functionality
- capacity can vary by character

Chrome is not a literal Cyberdeck reskin.

---

# 11. CYBERDECK LOADOUT

Single-screen loadout app.

Do not restore old Network / Memory / Diagnostics tabs.

Core screen:
- operator portrait rail
- RAM
- Short Rest restore
- installed Cyberdeck summary
- loaded Quickhacks
- software library LOAD/EJECT
- support chrome/deck passive
- right-side Network Telemetry
- JACK IN

No:
- Heat
- Humanity
- Trace/ICE core resource
- wallet inside Cyberdeck

RAM:
- restores on Short Rest only
- no passive regen
- no per-combat reset
- `flags.fleshEnshrouded.ramCost` canonical when present

---

# 12. JACK IN

## Scene / positions

- uses real active Foundry Scene background
- real Token centers are authoritative
- targeting updates in-place; do not full-rerender and restart animated backgrounds
- duplicate Tokens remain distinct endpoints
- Camera tokens excluded from normal actor scan

## Actor endpoint appearance

- square
- full portrait
- no name inside square
- no HOSTILE/FRIENDLY text
- no token number/signature
- unselected: no ACQUIRE
- selected: small LOCKED
- hostile border yellow
- friendly cyan
- selected red/magenta
- one clean border

## Trace topology

Current approved topology is **direct lines only**:

- operator → actor
- exact scene endpoints
- hostile yellow
- friendly cyan
- selected red/magenta
- dashed animated line

No:
- relays
- route packets
- branch boxes
- Scene Gate

Do not restore relays unless explicitly asked.

## Zoom

- min 1.0
- max 3.0
- wheel zoom
- RMB pan
- FIT
- RESET
- actor nodes fixed screen-size
- Camera markers fixed screen-size
- operator portrait tied to real operator token footprint
- operator ~1x token at 100%, ~1.5x token footprint at max zoom

## Targeting

- click unselected actor → select
- click same actor again → deselect
- click different actor → switch
- deselect clears node/trace target styling
- bottom-left target portrait hides
- Quickhack RUN buttons disable without target

Target changes must remain in-place DOM updates.

---

# 13. QUICKHACK RAM TRANSACTION RULE

**RUN does not spend RAM.**

Correct flow:

1. select target
2. RUN
3. preview save/damage/effect
4. preview costs 0 RAM
5. close/RETURN TO NET costs 0 RAM
6. APPLY DAMAGE or APPLY EFFECT commits RAM once

Before commit:
- `RAM COST // X`

After commit:
- `RAM SPENT // X`

Damage:
- real temp HP/HP application
- RAM spent on successful apply

Non-damage:
- APPLY EFFECT is current commit/adjudication point
- generic Active Effect automation is still incomplete

Closing preview must immediately restore RUN availability when target/RAM are valid.

---

# 14. NETWORK DEVICES / GM AUTHORITY

`FEHA_NETWORK_DEVICES.js`:
- normalized records
- types/capabilities
- access scopes
- Security DC
- scene scanning
- discovery

`FEHA_DEVICE_ACTIONS.js`:
- breach/access
- capability execution
- Foundry mutations

`FEHA_NETWORK_APPROVALS.js`:
- player→GM authority
- probe approval
- reveal requests
- remote device commands
- bounded timeouts

Typical direction:
- Lights ~10
- Door ~12
- Alarm ~13
- Turret ~15
- Terminal ~17
- System/Core ~19

GM may override.

Turret ROTATE/FIRE still need a future specialized adapter.

---

# 15. CAMERA SYSTEM — PARKED FOUNDATION

File:
`foundry/cyberdeck/FEHA_CAMERAS.js`

Internal version:
`0.1.0`

Current constants:
- FLAG_SCOPE = fleshEnshrouded
- ACTOR_FLAG = cameraActor
- TOKEN_FLAG = cameraToken
- CHANNEL = module.flesh-enshrouded-heart-ablaze
- MARKER = fehaCameraSystemV1
- Camera folder = Camera
- image = icons/svg/eye.svg
- token size = 0.5
- request timeout = 15s

Implemented:
- real Camera Actor folder
- per-operator/per-user Camera Actor
- user OWNER permission
- operator ownership validation
- JACK IN CAMERA placement tool
- placement ghost
- normalized JACK IN coordinates → real Scene token
- GM-authoritative placement
- existing cameras scan back into JACK IN
- Camera token metadata includes fovAngle, fovRange, rotation

Not implemented:
- FOV preset selector
- cone visualization
- rotation editor
- range editor
- moving existing camera
- post-placement FOV editing UI
- actual view-through-camera feed

If user returns to cameras, continue from this foundation. Do not rebuild placement.

---

# 16. BROADER ROADMAP CONTEXT

Maps:
- historical world: ~506 scenes
- 418 SolutionMaps target/4K inventory
- 369 old SOL MAPS
- 131 FRAG MAPS
- WEBP preferred
- 4K where practical
- ungridded preferred
- avoid duplicates
- verify grids

Gear:
- rerollable/randomized shops
- focus body armor over redundant clothing
- stronger manufacturer identity
- simple/powerful/memorable mechanics
- larger readable UI
- Quickhacks in stores
- Chrome owned-vs-installed correctness
- stronger guns
- higher armor AC direction
- Mk V armor needs unique traits
- cohesive tiered cyberware catalog
- original-world company names preferred

Do not derail current Gateway work into maps/items unless user changes focus.

---

# 17. USER COLLABORATION RULES

- patch repo directly
- do not ask user to paste normal repo code
- one conceptual change per pass
- user tests through screenshots frequently
- treat screenshot feedback as authoritative for visual issues
- be decisive and practical
- do not over-explain process
- when user says “do it,” patch it
- do not generate images unless explicitly requested
- for live-world macros only: give full macro, not fragment; preferably self-updating; show progress for long migrations
- downloads have historically been unreliable, so macros may also need to be pasted in chat

---

# 18. KNOWN LIMITATIONS / RISKS

- DEV LOADER is GM-only
- Camera FOV/editing unfinished
- Turret adapter unfinished
- non-damage Quickhack Active Effects incomplete
- effectText parsing remains technical debt
- CSS has historical override debt
- Gateway async sleep/timer cancellation has lifecycle debt if teardown ever appears stuck
- YouTube depends on autoplay policy, network and embed permission
- multi-GM authority needs care to avoid duplicate mutation
- README.md is stale; do not trust its current-build claim

---

# 19. REGRESSION CHECKLIST

Gateway:
- 4 candidates only
- no Jing
- no gray wash
- no strip under CYBERPUNK
- readable text
- left side scrolls + auto-follows
- right side never scrolls
- no role/archetype text
- no SIGNATURE/CLEARANCE filler
- no AI/browser voice
- 3D fly-toward-viewer feeling
- centerpiece ACTIVATED // CONNECTION ESTABLISHED
- YouTube audio exact-name attempt
- ESTABLISH LINK retry
- video reveal behind blue field
- SKIP INTRO

Cyberdeck/JACK IN:
- four-player roster
- no Heat/Humanity/Trace/ICE
- Short Rest RAM
- repeat-click deselect
- no target-state full rerender
- direct traces only
- exact token centers
- zoom 100–300%
- RUN preview free
- APPLY commits RAM
- closing preview restores RUN

Wallet/Market/Chrome:
- Credits / CR
- no stale CAP
- no redundant top Market directory icon
- softened sounds
- no out-of-roster selector actors
- no embedded Wallet in Cyberdeck/Chrome unless asked

---

# 20. IF SOMETHING BREAKS

## Visual changes do not appear

- verify user ran ADK DEV LOADER
- compare `version.json` and V3 VERSION
- verify custom DOM root/class
- if nothing changes at all, suspect loader/runtime/native UI, not just CSS specificity

Gateway root:
- `#adk-entry-gateway.feha-eg-custom`

## Jing/native Gateway appears

- custom data has no Jing
- native/legacy Gateway resurfaced
- debug API/load order
- do not add Jing patch into current custom model

## CP2077 private assets missing

- check localStorage private asset map
- generic fallbacks should still render cleanly
- do not hardcode guessed private URLs

## YouTube intro missing

- check IFrame API loaded
- check YT.Player ready
- if exact-name audio blocked, test ESTABLISH LINK retry
- check player error/state
- make sure only one intro stage exists
- do not resurrect old private match-music system alongside YouTube
- SKIP should call finishIntroMedia and resolve handoff

---

# 21. SELECTED VERSION TIMELINE

- 0.10.38 — Camera placement foundation
- 0.10.45 — Market visual rebuild
- 0.10.50 — Credits wallet canonical
- 0.10.51 — Market CAP removed
- 0.10.53 — redundant Market directory icon removed
- 0.10.54 — four-player roster normalization
- 0.10.55–0.10.60 — Market/Gateway sound and stability iterations
- 0.10.61–0.10.65 — legacy Gateway safety/timing/Derke-Jing bridge work
- 0.10.66 — full custom repo-owned Gateway, no Jing
- 0.10.67 — CP2077 asset bridge + bigger typography
- 0.10.68 — gray wash/header strip removed
- 0.10.69 — left-only scroll, compact fixed right rail, role/signature/clearance removal
- 0.10.70 — left output auto-follow
- 0.10.71 — dedicated join sound
- 0.10.72 — first fullscreen transition
- 0.10.73 — true 3D fly-through
- 0.10.74 — LINK START renamed SESSION INIT
- 0.10.75 — custom Web Audio + temporary voice
- 0.10.76 — temporary private MP3 exact-name music flow
- 0.10.77 — AI voice removed
- 0.10.78 — centerpiece becomes ACTIVATED // CONNECTION ESTABLISHED
- **0.10.79 — YouTube Edgerunners intro handoff, longer blue transition, video reveal, SKIP INTRO, old importer removed**

---

# 22. CURRENT NEXT TASK

The 0.10.79 patch has landed.

The next chat should **test/iterate 0.10.79**, not start from the old camera-next-task assumption.

Most likely next steps:

1. user runs ADK DEV LOADER
2. user tests exact-name audio start
3. if blocked, see whether ESTABLISH LINK starts it
4. tune only reveal timing/opacity if needed
5. fix SKIP lifecycle only if needed
6. adjust how much video shows through blue field only if user dislikes the blend

If the user switches back to cameras, resume FOV/rotation from the existing camera placement foundation.

---

# 23. DO-NOT-ASK QUICK ANSWERS

- Repo? `aidenfortihong-blip/feha-dev`
- Branch? `main`
- Build? **0.10.79**
- Playable roster? Ponyboy, Derke, Sasha, Zach
- Derka? No. **Derke**
- Sasha surname? Do not display one
- Jing? No
- Paste code? No; patch repo
- Right Gateway scroll? No
- Left Gateway scroll? Yes + auto-follow
- Gateway roles/signature/clearance? Removed
- AI voice? Removed
- Transition text? **ACTIVATED // CONNECTION ESTABLISHED**
- Intro media? YouTube ID `mH2wmyeiIpA`
- Old MP3 importer? Removed
- Publish copyrighted music/CP assets to public repo? No
- Relays? No rendered relays
- RUN spend RAM? No
- Currency? Credits / CR
- Camera gone? No, placement foundation remains
- DEV LOADER player-safe? No, GM-only
- Conflicting docs? Current repo + version.json win

---

# 24. NEW CHAT BOOTSTRAP

> Continue FEHA / ADK from repo `aidenfortihong-blip/feha-dev`, branch `main`. Read `HANDOFF/FEHA_MASTER_HANDOFF_2026-09-28.md` first, then inspect the current repo. Current verified build is 0.10.79. Patch GitHub directly; do not ask me to paste code. Work one conceptual change per pass. Current Gateway flow: exact typed valid name attempts to start YouTube intro audio (video id mH2wmyeiIpA), authentication continues, ESTABLISH LINK launches the longer blue 3D transition, the already-running video fades in from behind the blue field, the centerpiece says ACTIVATED // CONNECTION ESTABLISHED, then the blue overlay fades away and the YouTube intro owns the screen with SKIP INTRO. AI speech is removed. Canonical player roster is Ponyboy, Derke, Sasha, Zach. Preserve Market/Wallet/Cyberdeck/JACK IN behavior unless I explicitly ask to change it.

