# FEHA / ADK MASTER HANDOFF — 2026-09-27

**Project:** Flesh Enshrouded Heart Ablaze / ADK  
**Current focus:** Cyberdeck V3 / JACK IN / Camera system  
**Foundry baseline:** Foundry VTT 14.361 / dnd5e 5.3.3  
**Repository:** `aidenfortihong-blip/feha-dev`  
**Branch:** `main`  
**Current live dev build:** **0.10.38**  
**Primary UI file:** `foundry/FEHA_TABLETOP_UI_V3.js`  
**Primary V3 CSS:** `cyberdeck-v3.css`

---

# 0. READ THIS FIRST

This document is the handoff for continuing the FEHA / ADK Foundry project without reconstructing months of context.

The most important working rule is:

> **Patch the GitHub repo directly. Do not ask the user to paste code into Foundry unless the task genuinely requires live-world execution.**

The user expects the assistant to inspect the current repo, patch it, bump the version, verify syntax/readback, and then ask for a screenshot/test.

The user recently explicitly changed workflow because too many interacting systems were being modified at once:

> **ONE CHANGE PER PASS. TEST IT. THEN MOVE ON.**

Do not bundle topology + zoom + typography + camera + mechanics into one patch. When the user asks to fix one thing, touch only that conceptual subsystem unless a tiny compatibility edit is strictly necessary.

For Foundry macros/migrations that truly require world access:
- provide the complete macro, not a fragment;
- macros should update/overwrite their target automatically when practical;
- show progress and completion for long migrations;
- however, normal Cyberdeck/UI development belongs in the repo.

---

# 1. CURRENT REPO / DEV WORKFLOW

Canonical development loop:

1. Inspect exact current repo code.
2. Patch GitHub directly.
3. Bump `foundry/FEHA_TABLETOP_UI_V3.js` version when V3 behavior changes.
4. Update `version.json` with a narrow scope and notes.
5. Syntax-check JS.
6. Fetch/read back the committed file.
7. User runs **ADK DEV LOADER**.
8. User sends screenshot / reports one issue.
9. Patch only that issue.

Current loader:
`foundry/ADK_DEV_LOADER.js`

It resolves `main` to an exact commit SHA, fetches immutable source from that SHA, cleans previous runtime, loads CSS, loads the modular Cyberdeck runtime, initializes it, then evaluates V3.

Current modular load order:

1. `latest-dev.js`
2. `foundry/cyberdeck/FEHA_CYBER_CORE.js`
3. `foundry/cyberdeck/FEHA_NETWORK_DEVICES.js`
4. `foundry/cyberdeck/FEHA_DEVICE_ACTIONS.js`
5. `foundry/cyberdeck/FEHA_NETWORK_APPROVALS.js`
6. `foundry/cyberdeck/FEHA_CAMERAS.js`
7. `FEHA_CYBER_CORE.init()`
8. `foundry/FEHA_TABLETOP_UI_V3.js`

V2 exists only as recovery fallback. Do not re-promote V2.

Important limitation:
**the dev loader is still GM-only.**
The camera/network modules contain player/GM socket authority paths, but normal player-client multiplayer testing requires the modular runtime to be loaded through the real FEHA module or another player-safe bootstrap.

---

# 2. PRIME ARCHITECTURE RULE

The architecture contract remains:

> **JACK IN renders entities. Adapters own mechanics.**

Do not stuff specialized mechanics back into `FEHA_TABLETOP_UI_V3.js`.

Current responsibilities:

- `FEHA_CYBER_CORE.js`
  - module registry
  - lifecycle
  - event bus

- `FEHA_NETWORK_DEVICES.js`
  - normalized Network Device records
  - scene scanning
  - security/DC metadata
  - discovery state
  - persistence helpers

- `FEHA_DEVICE_ACTIONS.js`
  - breach/access logic
  - real Foundry device actions
  - capability execution
  - authority routing hooks

- `FEHA_NETWORK_APPROVALS.js`
  - sockets
  - GM approval queue
  - probe/reveal/device command authority

- `FEHA_CAMERAS.js`
  - real Camera actors/tokens
  - ownership
  - normalized camera scene records
  - GM-authoritative placement
  - player request sockets
  - FOV metadata storage foundation

- `FEHA_TABLETOP_UI_V3.js`
  - Cyberdeck loadout rendering
  - JACK IN scene rendering
  - targeting UI
  - Quickhack resolution UI
  - camera placement interaction layer
  - viewport behavior

Full older architecture reference:
`HANDOFF/CYBERDECK_ARCHITECTURE_0.9.md`

---

# 3. CURRENT ACTIVE ROSTER

The current canonical player-facing Cyberdeck roster is only:

- Ponyboy
- Derke
- Sasha
- Zach

Do not surface Nina, Florence, Cael, Xiao, Jing, etc. in the current Cyberdeck selector.

Do not delete their Foundry Actors.

Current portrait overrides known from prior work:

**Derke**
`https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png`

**Ponyboy**
`https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/40e1fb5d-6265-4dfd-93d3-d6344dc14180.png`

---

# 4. CAMPAIGN / CHARACTER CONTEXT

The cyberpunk arc is part of the broader **Flesh Enshrouded Heart Ablaze** campaign.

Core setting premise:
- Night City monopolizes Cinderbloom.
- Outside regions become cold/wasteland because heat/resources are centralized.
- Entry to the city comes through merit, lottery, corporate access, or similar controlled channels.
- PCs cap around level 5; later progression is intended to come primarily through cyberware rather than normal D&D class scaling.
- The user later wanted the cyberpunk PCs to feel less like normal D&D classes and more like native setting characters.

Team Omega / friends:

**Ponyboy**
- “Dark Horse Aura.”
- tough, swaggering, chill, resourceful.
- does not like asking for help.
- family shop was destroyed after refusing to incorporate.
- pays parents’ medical treatment.
- Sasha helped teach him math.

**Zach**
- earnest, polite, kind, hardworking.
- easily ragebaited.
- inferiority complex around people he thinks are superior.
- won a lottery to attend school.
- literature-club leader.
- martial arts training but weaker fighting spirit when intimidated by status/superiority.

**Sasha**
- kind, forgiving, opinionated.
- prodigal netrunner.
- very human/nurturing.
- wanted to be a teacher.
- sees education as a way to free people from labor.
- strong technical aptitude.

**Nina**
- feral, unpredictable, manic.
- not part of the current Cyberdeck roster.

Team Alpha includes:
- Cael — Arasaka scholarship intern; participates in the burn order.
- Florence — serious, authoritative, disciplined.

Important campaign event:
- session begins normally;
- apartment locks via RFID / windows are too high;
- later switch to Team Alpha;
- Cael has invited Omega into the relevant school/classroom/union sequence.

---

# 5. CYBERDECK V3 — CURRENT LOADOUT SCREEN

The normal Cyberdeck is a **single-screen loadout app**, not a tabbed application.

Do not restore old Network / Memory / Diagnostics tabs.

Current screen concept:
- operator portrait rail
- RAM / Short Rest restore
- installed Cyberdeck summary
- loaded Quickhacks
- software library / LOAD-EJECT
- support chrome / deck passive
- right-side Network Telemetry
- large JACK IN entry action

No:
- Heat
- Humanity
- Trace/ICE UI as a core player resource
- wallet / €$ inside Cyberdeck

RAM:
- restores on Short Rest only
- no passive regen
- no per-combat reset
- Long Rest should not be relied on as RAM restore
- `flags.fleshEnshrouded.ramCost` is canonical when present

The user likes strong cyberpunk motion/color, but the very first HyperFX pass was too fast and overwhelming.
Current visual preference:
- high-stimulation cyberpunk is good;
- ambient motion should be slower/smoother;
- big flashes/glitches should happen on important actions rather than constantly.

The exact Claude-style black CRT/cyan-magenta-yellow terminal language is **for Cyberdeck specifically**.
Do not automatically apply that exact language to Chrome Manager or Market.

---

# 6. JACK IN — CURRENT VISUAL / TOPOLOGY STATE

This section is extremely important because many recent patches were about simplifying JACK IN after topology became over-engineered.

## Scene background

JACK IN uses the real active Foundry Scene background as a cyber underlay.

Animated backgrounds/GIFs must not restart just because the user targets something.
Targeting is therefore updated **in place** instead of calling a full `renderJack()`.

Do not casually reintroduce full rerenders for target-state changes.

## Actor positions

**Real Foundry Token positions are authoritative.**

Actor nodes are centered on the exact normalized scene-token center.

Do not use a topology/collision solver to move real actors away from their scene positions.

Camera tokens are explicitly excluded from normal actor-node scanning.

Same-Actor duplicate Tokens should remain distinct scene endpoints.

## Actor node appearance

Current actor endpoints:
- square
- portrait fills the full square
- no actor name inside the square
- no HOSTILE / FRIENDLY text inside
- no TOKEN number/signature inside
- unselected actor has no ACQUIRE text
- selected actor shows only a small `LOCKED` overlay
- hostile border = yellow
- friendly border = cyan
- selected border = red/magenta
- one clean border; old pulse/duplicate outline chrome is suppressed

## Actor size

Normal actor squares are constant screen-size during JACK IN zoom.

Their base constant size is derived from the real Foundry token footprint at 100% instead of an arbitrary hard-coded 154px box.

Do not reintroduce the old token-size floor/inverse semantic scaling mess unless the user explicitly changes direction.

## Operator / Zach size

Operator position is the real operator token position.

Operator portrait size is tied to the **real operator token footprint**.

Current desired behavior:
- at 100% zoom: operator portrait ~= 1× actual token footprint
- at maximum zoom: operator portrait grows smoothly to ~= 1.5× actual token footprint
- decorative operator frame/rings scale around that portrait

The user's clarification was specifically:
“1.5 bigger than his token,” not “1.5× some arbitrary operator UI size.”

## Direct trace lines

Relays were intentionally removed after repeated topology problems.

Current network visualization is **direct lines only**:
- operator -> each actor
- exact real scene endpoint coordinates
- hostile trace = yellow
- friendly trace = cyan
- selected trace = red/magenta
- dashed animated line
- no route packets
- no relay boxes
- no route branches
- no Scene Gate

Do not restore relays unless the user explicitly asks after validating simple direct traces.

Internal relay/link model data may still exist, but it is not rendered.

---

# 7. JACK IN TARGETING — CURRENT BEHAVIOR

Targeting is a toggle.

- click an unselected actor -> target/select it
- click that same actor again -> deselect it
- click a different actor -> release old target and select new target

On deselect:
- selected node styling clears
- selected trace styling clears
- bottom-left target portrait returns to no target
- Quickhack RUN buttons disable because there is no target

Target selection must remain an in-place DOM patch.

## Bottom-left target panel

The old TARGET LOCK readout is now a portrait panel.

When an actor is selected:
- large portrait appears bottom-left
- target name appears
- LOCKED state appears
- relation coloring carries into the panel

Switching targets swaps the portrait immediately.

Deselecting:
- hides portrait
- returns to NO TARGET / SELECT ACTOR

This is intentionally static HUD outside the zoomed world.

---

# 8. QUICKHACK EXECUTION — CURRENT BEHAVIOR

A very recent bugfix changed RAM consumption to transactional behavior.

**Do not spend RAM when RUN is clicked.**

Current correct flow:

1. select target
2. click RUN
3. Quickhack save/damage/effect resolution is previewed
4. opening that resolution costs **0 RAM**
5. closing with × / RETURN TO NET costs **0 RAM**
6. RAM is only consumed when the player actually commits:
   - `APPLY DAMAGE`, or
   - `APPLY EFFECT`

Each resolution may commit RAM only once.

Footer:
- before commit: `RAM COST // X`
- after commit: `RAM SPENT // X`

Damage hacks:
- roll/save preview happens before commit
- APPLY DAMAGE modifies real temp HP/HP
- successful application then commits RAM

Non-damage hacks:
- have an APPLY EFFECT button
- committing it spends RAM

Important:
RUN buttons used to stay grayed out after backing out of a preview.
Build 0.10.36 fixed this:
- closing the preview refreshes RUN-button availability immediately
- no need to click the target again

Do not regress this.

Known limitation:
non-damage effects are not yet robust Foundry Active Effects. APPLY EFFECT is currently the commit point / adjudication action, not a full generic condition engine.

---

# 9. NETWORK DEVICES

Current network device architecture remains active.

`FEHA_NETWORK_DEVICES.js` provides:
- normalized device records
- real Foundry Door discovery
- explicit tagged scene-document discovery
- custom persisted device records
- Security DC
- access scope
- discoveredBy gating

Current type registry includes:
- door
- turret
- terminal
- alarm
- lights
- system

Camera is **not** implemented as a generic Network Device type in this build.
It is its own dedicated `cameras` module.

Current suggested DC direction from prior architecture:
- Lights ~10
- Door ~12
- Alarm ~13
- Turret ~15
- Terminal ~17
- System/Core ~19
GM may override.

`FEHA_DEVICE_ACTIONS.js` owns breach/access/capabilities.

`FEHA_NETWORK_APPROVALS.js` owns GM-authoritative request routing:
- probe requests
- reveal requests
- remote device commands
- approval queue

There is known multi-GM/socket complexity in authority systems from earlier work. The current camera module intentionally selects one deterministic online authority GM to avoid duplicate camera request handling.

---

# 10. CAMERA SYSTEM — CURRENT BUILD 0.10.38

This is the newest subsystem and the exact place the next chat should continue.

File:
`foundry/cyberdeck/FEHA_CAMERAS.js`

Module name:
`cameras`

Camera module internal version:
`0.1.0`

## What is already implemented

### Camera Actor folder

On GM init, the system ensures an Actor folder exists named:

`Camera`

This is a real Foundry Actor folder.

### Per-operator / per-user Camera actor

The system creates/fetches a Camera Actor keyed by:
- operator Actor ID
- owner User ID

Actor flag:
`flags.fleshEnshrouded.cameraActor`

Stored fields include:
- enabled
- operatorActorId
- ownerUserId
- createdAt

Current Camera actor:
- actor type: `npc`
- default image: `icons/svg/eye.svg`
- name: `CAMERA // <operator name>`
- prototype token is actor-linked
- default token width/height: 0.5 grid units

The requesting user is given OWNER permission on that Camera actor.

Validation:
the requesting user must own the operator Actor.

### Player / GM authority

The camera module uses:
channel:
`module.flesh-enshrouded-heart-ablaze`

marker:
`fehaCameraSystemV1`

A player request is routed to one active authority GM.

Current request types:
- ensure Camera actor
- place Camera

The GM validates operator ownership and performs world mutation.

### Camera token flag

Real placed Camera tokens carry:
`flags.fleshEnshrouded.cameraToken`

Current data:
- enabled
- operatorActorId
- ownerUserId
- fovAngle
- fovRange
- rotation
- createdAt

Current defaults:
- FOV angle: 60
- FOV range: 60
- rotation: 0

These FOV values are stored now specifically so the next pass can build the editor without migrating token data later.

### JACK IN Camera placement

JACK IN now has a CAMERA tool in the viewport controls.

Current placement flow:
1. click CAMERA
2. system ensures the requesting user's Camera actor exists
3. JACK IN enters camera placement mode
4. a camera ghost follows the pointer on the JACK IN world
5. click a free position on the JACK IN map
6. normalized JACK IN percentage is converted to the matching active Scene position
7. GM-authoritative camera service creates the real Foundry Camera token there
8. JACK IN renders a CAM marker at the same normalized position
9. placement mode exits

Right-click while in camera placement cancels placement.

Pressing CAMERA again while placement is active also cancels.

Existing real Camera tokens are scanned back into JACK IN from the active Scene.

Camera tokens are excluded from ordinary actor-target scanning.

Camera node size is screen-space compensated so JACK IN zoom does not make the camera marker unreadable.

## What is NOT implemented yet

**FOV editing is intentionally the next camera pass.**

Not yet exposed:
- FOV preset chooser
- FOV cone overlay
- range editor
- rotation editor
- post-placement move tool
- post-placement rotate handle
- post-placement FOV update persistence
- actual “view through camera” spectator/vision feed behavior

The user explicitly described the desired next direction:

> when they click the camera button you give them a token they can place on the jacked in scene, when they click it in the token gets put on the corresponding spot on the actual scene, also make the fov a thing like, they can select the fov out of some select options and then turn and position the fov

Placement foundation is now built.
**Next task should be FOV only, one step at a time.**

Recommended next pass:
1. click an existing JACK IN camera marker
2. open a compact camera control panel
3. FOV preset select: e.g. 30 / 45 / 60 / 90 / 120
4. render a simple directional cone in JACK IN
5. allow rotation with either:
   - slider/buttons, or
   - draggable direction handle
6. persist `fovAngle` and `rotation` into the real Camera token flag / token rotation
7. do **not** add range movement/editing in the same pass unless the user explicitly wants it bundled

Then test.

After that, separately add range and/or moving existing cameras.

---

# 11. CAMERA IMPLEMENTATION DETAILS THE NEXT CHAT SHOULD NOT GUESS

Current Camera constants in `FEHA_CAMERAS.js`:

- `FLAG_SCOPE = "fleshEnshrouded"`
- `ACTOR_FLAG = "cameraActor"`
- `TOKEN_FLAG = "cameraToken"`
- `CAMERA_FOLDER = "Camera"`
- `CAMERA_IMG = "icons/svg/eye.svg"`
- `TOKEN_SIZE = 0.5`
- authority request timeout = 15 seconds

Current public camera API:
- `isCameraActor(actor)`
- `isCameraToken(token)`
- `scanScene(scene)`
- `cameraRecord(scene, token)`
- `ensureCameraActor(operatorActorId, userId)`
- `placeCamera({operatorActorId,userId,sceneId,xPct,yPct})`

The next camera work should extend this adapter with update/edit methods rather than directly mutating camera tokens from V3.

For example, preferred future API:
- `updateCamera({tokenId, sceneId, operatorActorId, userId, rotation, fovAngle, fovRange})`
- possibly `moveCamera(...)`
- possibly `removeCamera(...)`

These should preserve GM authority and ownership validation.

Do not bypass the adapter just because V3 can technically call `token.document.update()`.

---

# 12. CURRENT ZOOM / VIEWPORT RULES

Current viewport:
- minimum zoom = 1.0
- maximum zoom = 3.0
- wheel zoom
- RMB drag pan
- FIT
- RESET

Do not allow zoom below 100%; earlier sub-100% raster downscaling made text/portraits blurry.

Actor nodes:
- fixed screen size through zoom
- their coordinates still move with map zoom/pan

Camera markers:
- fixed screen size through zoom

Operator:
- token-relative portrait size
- grows gradually to 1.5× token footprint at max zoom

Trace lines:
- live in the zoomed world
- use non-scaling stroke behavior for readable width

---

# 13. CSS TECHNICAL DEBT

`cyberdeck-v3.css` is large and contains many historical override strata.

This is known.

Do **not** do a giant CSS rewrite while another feature is being debugged.

Current rule:
append a narrow, versioned final override block for the active pass unless a deliberate cleanup/refactor is specifically requested.

Past topology failures were partly caused by multiple old rules interacting.
When changing size/position:
- inspect the tail / active latest override;
- understand previous selectors;
- ensure the final rule wins intentionally;
- avoid changing unrelated selectors.

A future dedicated CSS consolidation pass would be useful, but it should be its own task.

---

# 14. IMPORTANT RECENT BUILD SEQUENCE

These are the recent changes that define current behavior.

## 0.10.25
- real scene Token coordinates became absolute authority for actor cards
- actor collision displacement disabled

## 0.10.26
- actor nodes changed to squares
- relay boxes removed
- route lines/packets removed
- actor anchor diamonds removed

## 0.10.27
- portrait-first actor nodes
- experimented with token-size zoom floor

## 0.10.28
- removed actor zoom-floor system
- actor nodes became constant screen-size
- portrait full-bleed
- ACQUIRE removed from initial markup direction

## 0.10.29
- replaced arbitrary 154px actor size with size derived from actual real token footprint at 100%

## 0.10.30
- cleaned actor outline states
- removed ACQUIRE completely from in-place target updates
- first operator 1.5× experiment

## 0.10.31
- changed operator from constant 1.5× to progressive zoom growth

## 0.10.32
- tied operator portrait size to actual operator token footprint
- 1× real token at 100%
- ~1.5× real token at max zoom

## 0.10.33
- bottom-left TARGET LOCK portrait panel

## 0.10.34
- Quickhack RAM deferred until APPLY DAMAGE / APPLY EFFECT
- backing out costs 0 RAM
- preview no longer rerenders JACK IN

## 0.10.35
- direct operator-to-actor trace lines restored
- no relays

## 0.10.36
- closing Quickhack preview restores RUN buttons immediately

## 0.10.37
- click selected actor again to deselect

## 0.10.38
- new dedicated Camera subsystem
- Camera Actor folder / Camera actor ownership
- JACK IN camera placement ghost
- corresponding real Foundry Camera token placement
- camera tokens mirrored back into JACK IN
- FOV metadata foundation
- **FOV editing is next**

---

# 15. DO NOT ACCIDENTALLY UNDO THESE

This list is meant for the next chat.

Do not:
- ask the user to manually paste repo patches
- restore V2 as primary Cyberdeck
- add Network/Memory/Diagnostics tabs
- reintroduce Heat or Humanity
- put wallet/€$ into Cyberdeck
- move actor cards away from real token positions
- use relays before the user asks for them
- add giant relay topology while camera work is happening
- reintroduce ACQUIRE labels
- make selected cards change geometry
- spend RAM on RUN/preview
- restart animated scene backgrounds when targeting
- require a second target click to re-enable RUN after backing out
- prevent repeat-click deselection
- hard-code actor square size to arbitrary 154px
- size Zach from arbitrary operator-frame pixels instead of his real token footprint
- treat Camera tokens as normal target actors
- make V3 directly own GM-authoritative Camera world mutation when the camera adapter should own it
- refactor all CSS while implementing FOV
- bring back camera behavior from older deleted camera prototypes; 0.10.38 is the new foundation

---

# 16. CHROME MANAGER / OTHER APP CONTEXT

Naming:
- never call anything “Augmentation Theatre.”
- full cyberware UI = **Chrome Manager**
- bottom hardware cache = **Owned Chrome**
- right panel = **Hardware Dossier**
- center = portrait stage

Chrome Manager direction:
- left: system/subsystem index
- center: character portrait hero
- right: hardware dossier
- bottom: Owned Chrome

Systems include:
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

Portrait stage:
- no mannequin
- no skeleton
- no anatomy rig
- do not obscure face/body
- HUD should sit mostly around/behind portrait

Do not casually reintroduce old left-rail separator clutter or duplicate subsystem bars.

---

# 17. SHOP / ITEM / MANUFACTURER ROADMAP

Longstanding roadmap:

1. Shops should reroll/randomize eligible stock rather than show every item.
2. Remove redundant normal clothing; focus on body armor.
3. Manufacturers need distinct, easy-to-use, memorable, powerful mechanics.
4. UI should be large/readable.
5. Quickhacks should be purchasable through stores only.
6. Chrome Manager +/- controls should work with owned parts.
7. Chrome Manager left list should represent owned chrome rather than just installed chrome.

Normalized flag direction:
- `mk`
- `manufacturer`
- `weaponClass`
- `shopType`
- `bodyArmor`
- `cyberwareSlot`
- `quickhack`
- `catalogEnabled`

Item direction:
- guns more powerful
- no AP system
- armor AC higher
- gun tiers roughly 1d6 through 5d6
- companies should change playstyle
- avoid generic cloned +1/+2 bonuses
- Mk V equipment should feel unique
- shop tier chooser exists/was desired
- item color follows **Mk**, not dealer tier
- trusted players should have access to shop items
- details popups should appear above the shop UI

Starting PCs:
- around 3 chrome
- one strong gun
- chrome capacity varies per character

---

# 18. MAP PIPELINE CONTEXT

The project also has a large map pipeline.

Prior sources:
- SolutionMaps
- FragMaps
- Dystopian / Violent Monkey exploration

At one point the world contained:
- 506 scenes
- 418 SOL maps target inventory
- 369 old SOL MAPS
- 131 FRAG MAPS

Direction:
- WEBP battle maps
- 4K where possible
- ungridded preferred
- grid verification/logging because many maps do not have exact square-cell fits
- avoid duplicate scene/background imports

This is not the current task; do not derail camera/Cyberdeck work into map ingestion unless the user changes focus.

---

# 19. PRIVATE CP2077 ASSET CONTEXT

The user extracted UI/audio assets from their own local Cyberpunk 2077 installation.

Do not put proprietary source media into the public GitHub repo.

Private Forge locations:
- `FEHA/cp2077/audio/`
- `FEHA/cp2077/ui/`

Browser/private maps:
- `fehaCP2077PrivateAssetsV1`
- `fehaCP2077LocalSfxV1`

Runtime asset map:
- `globalThis.FEHA_CP2077_ASSETS`

Current sound events include:
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

Use private Forge URLs / local data maps and public-safe fallback audio.
Do not commit proprietary CP2077 media.

---

# 20. VISUAL CONSTITUTION

Overall FEHA UI:
- graphite-black industrial base
- character accent colors as signals, not flood fills
- clipped/mechanical/interlocking/asymmetrical/brutalist geometry
- avoid generic glassmorphism
- Oxanium headings
- Rajdhani UI
- Share Tech Mono telemetry
- cyberpunk but readable

Motion:
- slower ambient movement
- sharp action feedback
- signal fracture/glitch on important interaction
- do not run constant giant sweeps or high-frequency noise everywhere

Avoid:
- giant screen-wide sweep spam
- rounded SaaS cards
- endless neon rectangles
- white CP2077 mask textures rendered literally
- tiny gray unreadable text

Cyberdeck specifically may be more terminal/CRT/cyan-magenta-yellow than other apps.

---

# 21. WALLET / BACKEND CONTEXT

Canonical wallet:
`globalThis.ADKWallet`

Backend:
`globalThis.ADKCore`

Wallet:
- GP internally
- displayed as €$
- broken old embedded wallet UI was suppressed
- do not restore wallet inside Cyberdeck/Chrome Manager
- preserve mechanics for future dedicated wallet UI

---

# 22. SOURCE EXPORT / LIVE WORLD DATA

The repo contains:
- `foundry/FEHA_MODULE_SOURCE_EXPORTER.js`
- `foundry/FEHA_HANDOFF_EXPORTER.js`

These are useful when the assistant needs live Foundry world/module data that GitHub cannot reveal.

The user already exported/uploaded handoff/module-source JSON during prior work.

When source/live data conflicts with old handoff prose:
**prefer the current repo and current live export.**

Never ask for:
- passwords
- API keys
- Forge credentials
- GitHub tokens
- OAuth secrets

---

# 23. CURRENT KNOWN LIMITATIONS / RISKS

## Camera
Placement is implemented.
FOV editing is not yet implemented.

## Player runtime
ADK DEV LOADER is GM-only.
The camera module's player authority code cannot be fully validated as a normal player until the modular runtime is loaded for players.

## Quickhack effects
Damage application is real.
Generic non-damage status effects are not yet a full Active Effect automation engine.

## Turrets
ROTATE/FIRE remain future adapter work.

## CSS
V3 CSS has significant historical override debt.

## Relays
Internal relay model exists but rendered relays are intentionally absent.
Direct lines are the current approved topology.

## Multi-GM
Network authority/socket systems historically need care to avoid duplicate mutation.
The camera adapter currently chooses one deterministic active authority GM.

---

# 24. HOW TO PATCH THE REPO

Repository:
`aidenfortihong-blip/feha-dev`

Typical GitHub connector flow:

- fetch current file
- edit exact current content
- syntax check V3 JS
- update file with current SHA
- update `version.json`
- read back

Do not assume old line numbers remain valid.

Current key files:
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

---

# 25. EXACT NEXT TASK

The current conversation hit its maximum length immediately after beginning Camera work.

The repo has already reached **0.10.38 camera-placement-foundation**.

The next chat should NOT rebuild camera placement from scratch.

It should:

1. read this handoff;
2. inspect `FEHA_CAMERAS.js`;
3. inspect camera portions of `FEHA_TABLETOP_UI_V3.js`;
4. confirm 0.10.38 is current;
5. continue with **FOV only**.

Recommended first FOV patch:

- clicking an existing JACK IN camera marker opens a small camera editor
- add FOV preset dropdown/buttons:
  - 30°
  - 45°
  - 60°
  - 90°
  - 120°
- render a directional cone anchored to the camera marker
- add rotation control
- persist FOV angle + rotation through the Camera adapter onto the real Foundry token/flags
- keep camera position unchanged in this pass
- do not add range movement or actual video feed yet
- test with screenshot
- only after that add range and moving existing cameras

This follows the user's explicit “one thing at a time” workflow.

---

# 26. NEW CHAT BEHAVIOR EXPECTATION

Do not start by explaining that context may be missing.

Read the repo/handoff and continue.

If the user says:
“continue cameras”
the intended response is to inspect current 0.10.38 camera code and work on FOV controls, not to ask them to explain the camera concept again.

If the user says:
“patch it”
patch GitHub directly.

If the user reports one screenshot issue:
fix only that issue.

---

# 27. SHORT CURRENT STATE SNAPSHOT

**Build:** 0.10.38

**Cyberdeck:** single-screen loadout.

**JACK IN:**
- real active Scene underlay
- exact actor-token positions
- square full-bleed portraits
- target toggle on repeat click
- bottom-left target portrait panel
- direct operator->actor trace lines
- no relays
- no route packets
- 100–300% zoom
- Quickhack preview does not spend RAM
- APPLY DAMAGE / APPLY EFFECT commits RAM
- closing preview re-enables RUN correctly

**Operator:**
- real scene position
- portrait based on real token size
- 1× token at 100% zoom
- ~1.5× token at max zoom

**Camera 0.10.38:**
- real Camera Actor folder
- per-operator/per-user Camera actor
- requesting user gets OWNER
- JACK IN CAMERA placement mode
- ghost follows map
- click -> corresponding real Scene Camera token
- Camera token mirrored back into JACK IN
- camera actor/token flags implemented
- FOV angle/range/rotation metadata stored
- **FOV editor is next**

**Workflow:** one change per pass.

---

# 28. COPY-PASTE BOOTSTRAP FOR A NEW CHAT

Use this if needed:

> Continue the FEHA / ADK Foundry project from the repo `aidenfortihong-blip/feha-dev`. Read `HANDOFF/FEHA_MASTER_HANDOFF_2026-09-27.md` first, then inspect the current repo before changing anything. Current build is 0.10.38. Patch GitHub directly; do not ask me to paste code. Work one conceptual change per pass. We are currently on the Camera system: placement foundation is already implemented. The next pass is FOV selection/rotation only, using the real Camera adapter and preserving GM authority. Do not rebuild placement, do not add relays, and do not refactor unrelated CSS.
