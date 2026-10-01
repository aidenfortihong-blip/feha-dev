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

## 9. Balance pass 2 + Market cards + readability (0.11.88) — live

- Catalog weapons carry `system.proficient = 1` (set by FEHA_WEAPON_ECONOMY 1.5.0); FEHA classes grant no weapon proficiencies. Nue Bree (Cael, non-catalog) intentionally untouched.
- Consumables 1.5.0 rescaled (Health Booster 4d8+8 / 250 CR, temp HP 8/12/25, etc.). Effects are GM-applied text.
- Grenades 2.6.0: 17 lines x Mk.I-V + Ozob's Nose = 86. Legacy names map to their old Mk and are renamed. Missing tiers are cloned into world folders by `createMissingTiers`. Rarity follows Mk; marketStockWeight 0.2. Loader expects 86 and key `frag-regular-mk4`.
- Unique weapon catalog drops duplicate identical attack activities.
- Market weapon cards (stock patch 1.7.0): DMG/RANGE/MAG/RELOAD/STR grid, manufacturer trait box (red) + weapon special box (cyan), class chip replaces WEAPONS, even row heights.
- Readability: every 5-10px font-size in latest-dev.css, market/cyberdeck skins and the weapon sheet raised to 10-11px.
- Backup: compendium world.feha-balance2-backup-2026-09-30 (177 items).

## 10. Character rework (world data, not repo) + next task

- Ponyboy / Derke / Sasha / Zach reworked directly on the actors. Backup: compendium world.feha-character-backup-2026-09-30 (pre-change actors).
- Two custom feats each (flag fleshEnshrouded.characterFeature), no flaws: Ponyboy Swagger + Big Brother; Derke Fake Out + Slip Away; Sasha Organizer + Pickle Jar Prepper; Zach Body Moves on Its Own + Data Analyst.
- Abilities: Ponyboy 16/13/15/12/12/10 HP 30; Derke 15/16/13/10/12/12 HP 24; Sasha 8/14/12/16/13/14 HP 25; Zach 12/16/13/15/12/8 HP 22.
- Cyberware capacity = 12 + 4*level + CON mod + flags.fleshEnshrouded.cyberwareCapacityBonus (installed module chrome-legacy.js maxCapacity). Targets: Ponyboy 26, Derke 24, Sasha 22, Zach 22 (bonus 4/11/-3/1). Re-tune the bonus if they level.
- NEXT: user wants the Entry Gateway fixed (problem not yet described; ask for a screenshot/description). Entry gateway code is in the installed module scripts/entry-gateway.js and the world macro ADK // ENTRY GATEWAY.

## 11. Unattended bug sweep (branch `gateway-and-bugsweep`, NOT shipped)

Everything below is on the test branch only. Load it on the GM client by SHA (see §"Branch testing"). Ship = fast-forward main after the user says "ship it" (bump version.json + V3 VERSION first).

Fixed and verified live on the GM client:
- **Entry Gateway**: new `gateway-cp.css` (red CP skin, bundled by the loader as `gatewaySkinCss`). JACK IN bar no longer pushed off-screen once access is granted; fits 1366x768; intro video overscanned to crop the YouTube title/"More videos"/logo; captions unloaded on `onApiChange`.
- **Ammo tracking (FEHA_RELOAD_TRACKER 2.5.0)**: a shot is spent only by `dnd5e.postRollAttack`. Before, `useAttack` also counted 90 ms after `activity.use()` resolved, so a roll dialog left open >1.5 s spent two shots and a cancelled attack spent one.
- **Reload check (FEHA_WEAPON_HANDLING 1.1.0)**: rolls with `{configure:false}` (no generic "Strength Ability Check" dialog).
- **Grenades**: zone sync serialized per template (duplicate SMOKE markers).
- **Quickhacks**: option picker z-index 130000 (was hidden behind the JACKED IN overlay at 120000, looked like a frozen upload); bonus-action refusal carries `code:"FEHA_QH_REFUSED"` and shows as a warning.
- **Chrome Manager**: inspector hardware ports render as rows (labels overflowed after the readability pass).
- **GM playtest actors**: any actor with `flags.fleshEnshrouded.playtest === true` is selectable by GMs in Market / Chrome / Cyberdeck.
- **Load time 32 s -> ~1 s, 0 writes per load**:
  - FEHA_WEAPON_READINESS (4.1.3) and FEHA_WEAPON_CATALOG both wrote marketPass / weaponReadinessVersion / doTheseFinalizedVersion with their own values: 156 writes per load. Readiness now skips those keys for catalog-owned guns (`dropCatalogOwnedKeys`).
  - Readiness `demoteOldManaged` demoted all 33 melee + 4 unique weapons every load (marketPass starts with "weapon-"), purged them from saved shop stock, then the economy re-enabled them. Melee/unique catalog items are now skipped.
  - Unique catalog no longer writes market fields the economy owns (they flipped every load).
  - Armor signature effects were deleted+recreated every load (comparison included Foundry defaults); now compared on stored source fields.
  - Grenade/quickhack cards re-saved every load (escaped apostrophes, flag key order).
  - Market stock is no longer re-rolled on reload unless stock was invalidated.

Open questions for the user (not changed):
- LMG/sniper reload DC = STR requirement (16-17): a STR 16 character succeeds ~35%, not the ~60% the balance model assumed.
- Derke is level 0 (no class item): proficiency +1, and capacity math treats him as level 0.
- Unique weapons are sold in arms/black/corporate shops (economy) although the unique catalog calls them one-off rewards.
- Short Rest in the Cyberdeck restores RAM instantly with no confirmation, even mid-combat.
- Credits live in three fields (system.currency.gp, flags.credits, flags.eurodollars); the Market keeps them in sync.

Test artifacts left in the world: Actor folder "FEHA TEST" (TEST Gunner, TEST Dummy A/B), scene "FEHA TEST ARENA", one test combat, a handful of grenade/quickhack chat cards.

### §11 additions (same branch, version bumped to 0.11.89, still NOT shipped)

- **JACKED IN + quickhack picker**: monochrome FUI skin (cyberdeck-cp.css); all loaded quickhacks fit in the bar; picker options set `aria-pressed`.
- **Cyberdeck**: loaded-slot cards stack (names were hidden with 5 slots); disabled JACK IN bar reads as unavailable; shorter memory tile labels.
- **Chrome Manager inspector**: compact port rows, readable dossier text, BROWSE action pinned (sticky).
- **Weapon sheet**: ammo pips use the real `.is-on` class (all pips were lit); rule cards 13px.
- **Market**: card formatting also runs after input/change/keyup (search box, hotbar key).
- **Vektor Grenade Null** (FEHA_ARMOR_RUNTIME 1.3.0): Mk.I-IV half grenade damage + save advantage (`grenadeResistant`), Mk.V immune (`grenadeImmune`). Before, every Mk was immune although the card (since 0.11.86) said otherwise. Grenade cards now report damage actually taken.
- **Brace automated** (FEHA_WEAPON_HANDLING 1.2.0): turn-start position remembered per client on `updateCombat`/`combatStart`; LMG attacks get disadvantage when the shooter is >10 ft from it. Net displacement, combat only.
- **Helix Self-Charging Cell automated** (FEHA_RELOAD_TRACKER 2.6.0): shots stamp `weaponTracker.<itemId>.shotTurn`; when a turn ends the active GM refills equipped Helix firearms that did not fire that turn and whispers a note. Weapon catalog 3.7.0 / REVIEW_SEED handling-0.11.89 updates the trait text (one-time rewrite of 91 items).
- Verified in the test arena: attacks/penalties, ammo tracking, reload checks, 6 grenade types incl. burn tick and smoke zone cleanup, quickhacks (damage, status with picker, Cookoff, RAM/turn gating, short rest), Market purchase/stock/NO FUNDS/NO CAP, Chrome install/eject + STR negation, Bastion DR, Jade fire resistance.
- Known, not fixable from the repo: installed module `scripts/legacy/chrome-legacy.js` `repairChromeData()` calls `Item.updateDocuments(...)` for actor-owned items without `{parent: actor}`; it throws once per Chrome Manager render and the function's second half never runs. Fix in the module: pass `{parent: state.actor}`.
- Also in the installed module: Market button says "BUY + INSTALL" for cyberware but the purchase only stashes it (installed:false); install happens in Chrome Manager.
- Ammo spent by silent test rolls on real PCs (Ponyboy Black Requiem, Florence Optic Zero) was reset to full.

### §11 additions, part 2 (same branch)

- **Market stock was not rule-driven at all.** FEHA_MARKET_STOCK_PATCH patched the *source text of a world Market macro*; the Market now runs from the installed module (`scripts/legacy/market-legacy.js`, `openLegacyMarket()` re-runs the whole body on every open), so the patch found no macro ("no ADK Market macro found") and shops used the module's own roll: 8-12 fully random items, no category guarantees, every weapon treated as Mk.I. After the grenade Mk.I-V lines (86 items) grenades flooded shops.
  - Fix (stock patch 2.0.0, schema 2.0.0): the module reads `world.adkMarketStockV16` on open and only rolls for an empty `shop:tier` key, so FEHA fills all 30 keys itself (`ensureStock`, GM only) with `buildStock` (min/max size, category guarantees, `marketStockWeight`, weapon `marketBand` <= vendor tier, `marketReady`, `marketAllowedShops`) and intercepts `#reroll-stock` (capture-phase click -> `rerollShop` -> save -> close/reopen Market, which restores the same shop). Stock stays finite: purchases remove items until the GM rerolls. Old stock backup: browser localStorage key `feha-stock-backup-2026-10-01` on the GM machine.
  - Still module-side (not fixable from the repo): the Mk filter chips treat weapons as Mk.I.
- **Network devices / cameras never worked**: every read used `doc.getFlag("fleshEnshrouded", ...)` and every write `setFlag(...)`; Foundry rejects that scope because it is not a package id (the module id is `flesh-enshrouded-heart-ablaze`), and the reads were inside try/catch so they silently returned nothing. All FEHA flag access now goes through `doc.flags.fleshEnshrouded...` / `doc.update({"flags.fleshEnshrouded...": ...})`. Verified: custom alarm/terminal/turret devices save, scan, show in JACKED IN, breach + capability execute; door OPEN changes the wall state.
- `cyberdeck-v3.css` (Cyberdeck + JACKED IN base styles) got the same 10-11px text floor; device tiles and the device panel are skinned in cyberdeck-cp.css.
- Do NOT "fix" the module's `repairChromeData` by supplying the missing parent without reading it: its second half sets `installed = (flag !== false)` on every actor's cyberware, i.e. it would auto-install anything lacking an explicit `installed:false`. The throw currently prevents that.

### §11 state when the unattended session ended

- Branch `gateway-and-bugsweep`, head = "Market: GM removes player purchases from stock; honest cyberware buy label" (stock patch 2.1.0). Everything before that commit was verified live on the GM client. **That last commit is syntax-checked only**: the Forge server idled out before it could be loaded. To verify: buy an item as a non-GM player and confirm it leaves `world.adkMarketStockV16["shop:tier"]`; check cyberware buy buttons read "BUY".
- All 20 quickhacks were executed against test dummies through FEHA_QUICKHACK_RUNTIME (prepare + execute) with no errors.
- Not restored because the server stopped: in the Claude built-in browser profile only, the client setting `core.messageMode` is "gm" (set to keep test rolls out of public chat); the GM user's last viewed scene is "FEHA TEST ARENA".
- Test artifacts to delete when convenient: Actor folder "FEHA TEST" (3 actors), scene "FEHA TEST ARENA" (door wall + 3 custom network devices), and test chat cards from 2026-10-01.
- To ship: fast-forward `main` to this branch (version already 0.11.89 in version.json and FEHA_TABLETOP_UI_V3.js), then `game.adk.reload()` on the GM client and confirm "0.11.89 loaded".
