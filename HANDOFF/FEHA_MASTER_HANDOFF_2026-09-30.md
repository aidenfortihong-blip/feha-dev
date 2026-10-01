# FEHA / ADK MASTER HANDOFF — 2026-09-30

**Project:** Flesh Enshrouded Heart Ablaze / ADK
**Repository:** `aidenfortihong-blip/feha-dev` · branch `main`
**Live world:** `caradactyl.forge-vtt.com` (Forge)
**Foundry baseline:** 14.367 · dnd5e 5.3.3
**Current verified build (live on main):** **0.11.87**
**Known-good checkpoint:** branch `checkpoint-before-claude` (`eeebb69`, build 0.11.78)

This supersedes `FEHA_MASTER_HANDOFF_2026-09-28.md` (build 0.10.79). The older
handoffs remain the reference for Gateway, JACK IN, Quickhack RAM rules, Network
Devices, Cameras, canonical roster and visual constitution — none of those rules
changed. `README.md` "current build" line is not authoritative; `version.json` is.

---

## 1. How FEHA runs (read before editing)

1. The only thing installed in Foundry from this repo is the **FEHA Live Dev
   Bridge** module (`module.json`, `foundry/FEHA_CLIENT_BOOTSTRAP.js`).
2. On `ready`, every client (GM and players) fetches
   `foundry/ADK_DEV_LOADER.js` from `main`.
3. The loader resolves `main` to a commit SHA, fetches ~30 JS files + 2 CSS,
   syntax-checks all of them, refuses to run if `version.json.version` ≠
   `FEHA_TABLETOP_UI_V3.js` `VERSION`, then `eval`s them in order and finally
   runs catalog migrations **on the GM client only**.
4. Modules talk through globals (`globalThis.FEHA_*`, `game.adk.*`) and Foundry
   hooks, not imports. A static dependency graph (`graphify-out/`, untracked)
   shows each file as its own island — cross-system breakage shows up at runtime.

**Consequence:** a push to `main` is a production deploy to every player on next
join, and a GM load rewrites world items via migrations.

### Load order (ADK_DEV_LOADER.js)

`latest-dev.js` → grenade / consumable / armor / weapon / melee / unique-weapon
catalogs → weapon economy → Cyber Core → mod / special retirement → armor runtime
→ lumen retirement → Derke import → weapon readiness → weapon runtime → reload
tracker → weapon sheet → world hygiene → Market stock patch → grenade runtime →
Quickhack catalog / authority / runtime → network devices → device actions →
network approvals → cameras → multiplayer sync → **V3 UI last** → GM migrations.

### Code that is NOT in this repo

- **Installed module `flesh-enshrouded-heart-ablaze` 0.6.0** (on Forge): legacy
  Chrome Manager (`scripts/legacy/chrome-legacy.js`), `game.adk.openChrome`
  entry, Market/Chrome backends (`ADKMarket`, `ADKChromeBackend`).
- **World macros:** `ADK CORE`, `ADK // MARKET`, `ADK // CHROME`,
  `ADK // CYBERDECK`, `ADK // ENTRY GATEWAY`, `ADK RELOADER`.
- `FEHA_MARKET_STOCK_PATCH.js` edits Market macro source by string surgery, then
  post-processes rendered Market cards after clicks (deliberately no
  MutationObserver — an earlier observer froze the Shop).

---

## 2. Release workflow (current)

1. Branch from `main`, make one conceptual change.
2. Bump **both** `version.json` and `FEHA_TABLETOP_UI_V3.js` `VERSION`.
3. Syntax-check changed JS (`new Function(source)` in Node).
4. Push the branch and test it **on the GM client only**: fetch the branch's
   `ADK_DEV_LOADER.js`, replace `API + "/commits/main?t="` with the branch ref,
   and `eval` it in the live world. Players stay on `main`.
5. Reproduce the original bug, verify the fix, check the console.
6. Fast-forward `main`, push, then `game.adk.reload()` and re-verify.

This PC has no global git identity; commits use
`-c user.name=aidenfortihong-blip -c user.email=aidenfortihong@gmail.com`.

---

## 3. What changed since 0.10.79 (summary)

- **0.10.121–0.10.137** — Live Dev Bridge (all clients load repo build),
  multiplayer sync, player-safe reloader, Quickhack GM authority + chat approval,
  Quickhack catalog rewrite/rebalance.
- **0.11.x early** — operator/zoom polish, gun repair, unique weapons, melee and
  armor balance, weapon economy, manufacturer passives, unified item sheets.
- **0.11.52–0.11.58** — Foundry 14.367 nested-identifier bug: weapon updates with
  invalid persisted `visibility.identifier` fail in `preUpdateDocumentArray`.
  Affected items are **quarantined** (skipped) until Foundry ≥ 14.368.
- **0.11.59–0.11.64** — reload points, manual manufacturer rules, world hygiene
  audit + safe duplicate-attack cleanup (uses dnd5e `deleteActivity`).
- **0.11.65–0.11.72** — custom FEHA weapon sheet; the weapon sheet is the only
  player-facing firearm tracker UI (reload tracker is headless). Universal DEX
  weapon attacks.
- **0.11.73–0.11.78** — Market weapon cards: one canonical description, no Mk on
  weapons, compact stat row; Shop freeze fixed by removing the Market observer.
- **0.11.79** — Market and Chrome Manager opened on a hidden off-roster actor
  (Cael) while the selector showed Derke → purchases/installs hit Cael. The
  roster filter removed the selected `<option>` without firing `change`; it now
  dispatches `change` so each app's backend follows the visible selector.
- **0.11.80** — Credits show **CR** everywhere. The CR rewrite only ran when a
  whole FEHA root was added; now it also rewrites rerenders inside an open root
  and bare text-node writes. Armor/consumable/grenade/Quickhack catalogs print
  `CR`. A one-off world pass also relabelled the 101 world + 25 owned cyberware
  descriptions (`Market: €$ N` → `Market: CR N`); no `€$` remains in item data.

---

## 4. Open issues

1. **Weapon identifier bug — fixed in 0.11.81.** The "Foundry 14.367 nested
   identifier bug" (0.11.52–0.11.58) was FEHA's own: `FEHA_WEAPON_CATALOG.js`
   `norm`/`slug` had regex literals with doubled backslashes (`\\u0300`, `\\s`), so
   identifiers were written as `chilles`, blank (`MA70`, `HMG`) or
   `osprey prototype`, and Foundry rejected them. The quarantine checks also
   counted unset optional fields as invalid (143 false positives). Both fixed;
   weapons back up in compendium `world.feha-weapon-backup-2026-09-30`.
   Remaining quarantine logic (`build >= 368`) is now belt-and-braces only.
2. **Installed module bug:** `chrome-legacy.js` `repairChromeData()` calls
   `Item.updateDocuments(...)` for actor-owned cyberware **without
   `{parent: actor}`**, so it throws "Item id … does not exist in the Items5e
   collection" whenever the opened actor has stashed/uninstalled chrome
   (e.g. Ponyboy, Cael). Harmless today (the repo's `repairCacheMetadata`
   already writes the same flags correctly) but noisy. Fix belongs in the
   installed module source.
3. **Bridge module on Forge is 0.10.121**; repo manifest is 0.10.125. Update it
   through Forge's module manager.
4. Ponyboy's Chrome Manager showed `OWNED CHROME 0` while he owns 3 uninstalled
   cyberware items — unverified whether that count is intended.
5. Old macro backups (29) were moved into the macro folder
   `🗑 DELETE ME — old ADK macro backups` for the user to delete.
6. Handoff debt from 0.10.79 still stands: camera FOV/editing, turret adapter,
   non-damage Quickhack Active Effects, CSS override debt, Gateway timer
   lifecycle, multi-GM authority.

---

## 5. Regression checklist additions

- Market/Chrome selector actor === backend actor
  (`ADKMarket.state.actorId`, `ADKChromeBackend.getActor()`), never Cael.
- Market wallet shows the selected actor's credits as `CR N`; no `€$` anywhere.
- Market weapon cards: one description, no Mk badge, DETAILS opens FEHA weapon
  sheet (≈1 s render delay is normal).
- Load log ends with `FEHA DEV integrity pass … preflight: passed, postflight:
  passed`.

---

## 6. CP2077 UI redesign (0.11.82 – 0.11.84)

The user supplied three references: CP2077 vendor/inventory screen (Market),
CP2077 ripperdoc screen (Chrome Manager) and a monochrome "HUD / FUI ELEMENTS
// CYBERDECK" tile sheet (Cyberdeck). Each app keeps its own identity.

- **Skins load last** in `<style id="feha-market-cp-css">` built by the loader
  from `market-cp.css` + `chrome-cp.css` + `cyberdeck-cp.css`, with one Google
  Fonts @import (Rajdhani, Chakra Petch, Share Tech Mono, Dela Gothic One).
  Selectors use `html body` + a doubled/tripled root id so they outrank the
  older theme layers (latest-dev.css, runtime neon theme) without editing them.
- **Market (0.11.82, live):** red-on-black HUD, cyan active states, yellow CR,
  rarity stripe from `system.rarity` (Market Stock Patch 1.6.1 tags cards with
  `data-feha-rarity`). Per-character accent vars are retargeted to CP colours.
- **Chrome Manager (0.11.83, live):** `foundry/FEHA_CHROME_RIPPERDOC.js` adds a
  body map (10 systems around the portrait, square slot tiles). It is
  presentation only: tiles call `ADKChromeNative.selectSystem/inventory` and
  click the module's own `[data-inspect-item]`; install/eject/use stay on the
  module's buttons. `latest-dev.js` `markRoot()` calls `augment()`; unchanged
  signature = no-op. The v6 renderer itself lives in the installed module
  (`scripts/chrome-visual.js`), not in this repo. Install/eject round trip
  verified on Ponyboy's Dense Marrow.
- **Cyberdeck (0.11.84, live):** CSS tile-sheet re-flow (`.v3-main` is
  `display: contents`, so its legacy `::before/::after` stay hidden). V3
  `segments()` now always renders 24 RAM tiles: `is-filled` (available),
  `is-spent`, `is-locked` (beyond deck max); no deck = one NO DECK tile.
  Telemetry graph is locked to 320:176 and animated (flow/pulse/sweep; off
  under reduced motion). Colour portrait, yellow accents, red warnings,
  yellow JACK IN. Deck-installed state untested (no roster deck).
- Known: at 1280px the Chrome body-map columns overlap the portrait edges by
  ~90px (readable; left as-is). JACK IN map (network overlay) not restyled.

---

## 7. Item cards (0.11.85) and lethal balance patch 1 (0.11.86) — live

- **Item cards:** `item-cp.css` (loaded with the other skins) styles dnd5e item
  sheets, catalog description cards (`section[data-feha-ui="item-card-v1"]`)
  and the FEHA weapon sheet as the CP2077 item tooltip. 126 cyberware
  descriptions had a leftover `₡` glyph, now `CR`.
- **Balance philosophy (user):** lethal. A street pistol should feel scary;
  **high armor AC is the intended counterweight**, so armor AC/prices were
  left at their original values. Top guns ~50 per turn; big single-shot
  snipers may exceed that per shot.
- **Method:** expected damage per turn over a full reload cycle (one attack
  per turn; reload = Action +2 / Bonus +1, so 1–2 reload points cost no
  turns), vs AC 14 at +5. Curve `14 + 36*((rating-30)/70)^1.4` (melee x1.15,
  uniques x1.1); weapons outside ±15% had dice scaled within their die type.
  Power ratings in `FEHA_WEAPON_ECONOMY.js` re-derived from final damage, so
  price = `150 + 7*rating^1.75` x rarity multiplier.
- Grenades: Mk1 6d6 → Mk4 12d6 (EMP one step lighter, Ozob 15d6), priced by
  Mk with delivery multipliers. Arc Overload 10d10. Flexweave halves grenade
  damage below Mk V. Neural Adaptation Kit once per character (text rule).
- Untouched by user request: manufacturer traits, magazines/reloads, joke
  weapons (Slaughtomatic, Dildo Stout, Shovel Caretaker), all cyberware (user
  will rework cyberware themselves).
- Backups: compendiums `world.feha-balance-backup-2026-09-30` (all 399 items
  pre-patch) and `world.feha-weapon-backup-2026-09-30`.
- Revisit when characters reach level 5 (Extra Attack roughly doubles gun
  output under this model).

---

## 8. Class-based weapon handling (0.11.87) — live

`foundry/FEHA_WEAPON_HANDLING.js` (global `FEHA_WEAPON_HANDLING`, loaded
after latest-dev.js) owns the rules; reload points are retired.

- Reload: Pistol/Heavy Pistol/SMG/Shotgun Pistol = Bonus Action;
  Assault Rifle/DMR/Shotgun/Bow and any single-shot weapon = Action;
  LMG/Sniper = full turn (Action, no movement) + reload check (LMG STR,
  sniper DEX, DC = weapon STR requirement, 10 if none). Fail = retry.
- STR requirement: below it → disadvantage (automatic) + max 10 ft move
  (table rule) unless installed Strong Arms / Power Grip / Reinforced
  Muscles / Gun Stabilizer (`STR_NEGATORS`) or an item flagged
  `flags.fleshEnshrouded.handling.negateStrRequirement`.
- LMG Brace (table rule): disadvantage if moved > 10 ft. Sniper Scoped
  (automatic): disadvantage vs targets within 30 ft. `CLOSE_RANGE_SNIPERS`
  = Ashura, Long Vigil (no scope, 60/180 ft).
- Feat/cyberware flags: `handling.skipReloadCheck`, `handling.reloadAdvantage`.
- Disadvantage applies via `dnd5e.preRollAttackV2` (all attack paths).
  Weapon sheet: single RELOAD button (`FEHA_RELOAD_TRACKER.reload`), HANDLING
  rule card, STR warning bar. Market cards show reload type.
- Re-tune for the new model (LMG/sniper checks counted at 60%): 17 weapons,
  single hits capped near 100 avg; capped single-shot weapons keep their
  prior power rating so price reflects alpha.
- Backup: `world.feha-handling-backup-2026-09-30` (all weapons pre-0.11.87).
