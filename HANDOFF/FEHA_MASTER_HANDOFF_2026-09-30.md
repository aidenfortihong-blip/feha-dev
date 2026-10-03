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

## 12. 0.11.89 shipped to main (2026-10-01)

Everything in §11 is live, plus the user's decisions:
- Reload check is always **Dexterity** vs DC = STR requirement (FEHA_WEAPON_HANDLING 1.3.0).
- **RAM refills only on a Short/Long Rest from the character sheet** (`dnd5e.restCompleted` hook in V3); the Cyberdeck's rest button is gone.
- **Breaching a device costs RAM per attempt**, pass or fail: DC <=12 -> 1, 13-15 -> 2, 16+ -> 3 (`breachRamCost` in V3). Unsecured or already-breached devices are free.
- Unique weapons stay purchasable but rare: economy weight 0.02 and vendor tier 4+ only, now actually applied by the stock builder.
- Derke got the same "Power Level 2" ActiveEffect as Ponyboy/Zach (levels in this world come from that effect: `system.details.level` override); his cyberware capacity bonus is now 3 (total 24).
- Verified live: player-purchase stock removal (createItem hook), rest RAM restore, breach RAM cost and the not-enough-RAM refusal.

## 13. 0.11.90: network devices removed (shipped to main 2026-10-01)

User decision 2026-10-01: hackable doors / turrets / terminals were never meant to be a system. The GM runs doors as roleplay and cameras as, at most, one DC check.

- Deleted: `FEHA_NETWORK_DEVICES.js`, `FEHA_DEVICE_ACTIONS.js`, `FEHA_NETWORK_APPROVALS.js` (loader no longer fetches or requires them). V3 lost device nodes, the device panel, breach + `breachRamCost`, and player camera placement in JACKED IN. The recon grenade scan no longer lists devices. Dead `.jack-device-*` / `.jack-camera-ghost` CSS is still in `cyberdeck-v3.css` and `cyberdeck-cp.css` (harmless).
- **CYBER CHECK** button in the Cyberdeck RAM panel (`data-v3-action="cyber-check"`, `rollCyberCheck` in V3): 1d20 + INT mod + proficiency, costs `CYBER_CHECK_RAM` = 1, rolled to chat with the player's normal message mode. No DC in the UI; the GM decides.
- **Cameras are a GM tool** (`FEHA_CAMERAS.js` 0.2.0, no sockets): Token controls get a "Place camera for a player" button (`getSceneControlButtons`, tool `fehaCamera`) -> DialogV2 player picker -> `placeCameraFor(userId)` creates/reuses actor "CAMERA // <user>" (folder "Camera", owner = that user only) and drops a token with sight (60 ft, 360) at the centre of the GM's view. `Token#_isVisionSource` is wrapped so a player's own camera stays a vision source while they have their character selected (restored in `destroy`). JACKED IN still shows a CAM tile, only for cameras the viewer owns.
- Verified live on the GM client from the branch: load with no errors, Cyber Check roll + RAM spend + re-render, JACKED IN with no devices, camera dialog + token + ownership. The user confirmed the player-side view through the camera from a player login.
- Left in the world: one test camera token "CAMERA // Aiden" on "FEHA TEST ARENA"; old `flags.fleshEnshrouded` device data on that scene is now ignored.

## 14. 0.11.91 - 0.11.94 (2026-10-01)

- 0.11.91 text pass (shipped): see `HANDOFF/TEXT_PASS_0.11.91.md`. Module-owned Market / Chrome Manager wording is swapped on screen by `foundry/FEHA_UI_TEXT.js` (exact-match map).
- 0.11.92 gateway boot log (shipped): fixed subsystem codes, `BIO/01..07` codes per scan step.
- 0.11.93 JACKED IN token sizes (shipped): `jackTokenFootprint` in V3 draws each token at its true map footprint (scales with zoom, 28 px minimum); labels keep one size via `--jack-zoom` in cyberdeck-cp.css.
- 0.11.94 consumables (branch `consumables` until shipped): `foundry/FEHA_CONSUMABLE_RUNTIME.js`. Entry point is the existing item-use bridge in FEHA_GRENADE_RUNTIME (`consumableRuntime.handles(item)`), so there is still only one wrapper on `Item#use`. Per-product table `EFFECTS` (heal / tempHp / ram / capacity / buff). Buffs are v14 Active Effects (`type:"base"`, `system.changes`, `duration:{value,units,expiry}`); Foundry expires them and the active GM deletes expired ones on `updateCombat`. Once-per-rest list is the array `flags.fleshEnshrouded.consumablesUsed`, cleared on `dnd5e.restCompleted`. A use that would be wasted is refused and nothing is consumed. Three products are reminders only (situational bonus the game cannot see): ForgeLine Breacher Booster, Jade Arc Ion Water, Jade Arc Grounding Tonic.
- Ghost Key and Network Sweep are GM-run; only their text changed.
- Not ours: advancing a combat turn logs `Cannot use 'in' operator to search for 'turn' in undefined` from `CombatTracker5e._onRender` in foundry.mjs.

## 15. 0.11.95 cyberware rebuild (branch `cyberware`, 2026-10-01)

User brief: as faithful to Cyberpunk 2077 / Edgerunners as a turn-based table allows, allowed to be strong, and active chrome is fuelled by the character's unused cyberware capacity. An ideas doc from the user may follow.

- `foundry/FEHA_CYBERWARE_CATALOG.js` (2.0.x): all 101 world cyberware items by name. Each row: slot, Mk, maker, effect text, plus machine-readable extras (`changes`, `active`, `chargeBonus`, `chargeDiscount`, `regen`, `restHealHalf`, `flags`, `deck`). GM-only `migrateAll()` rewrites world + owned items (flags, description card, price, `system.uses`). **The first run saved the old data to the world setting `world.fehaCyberwareBackup2026-10-01`** (uuid -> flags/description/price/uses).
- The installed module still owns install / slots / capacity: cost = `flags.rating` (+1 Operating System and Arms), slot = `flags.cyberwareSlot`, effect text = `flags.effectText`. Cyberdecks only had their maker corrected; V3 owns their numbers.
- Slot moves (were mis-slotted): Cyber Rotors -> Skeleton, Discharge Connector / Knife Sharpener / Shock Absorber / Syndicate Interface Tattoo -> Hands, Nano Tech Plates / Optical Camo -> Integumentary, Neo Fiber / Proximity Reducer -> Nervous, Regeneration Lattice / Second Heart -> Circulatory, Visual Cortex Support -> Frontal Cortex. Mk changes: Optical Camo 2 -> 3, Sandevistan Apogee 3 -> 5, Second Heart 3 -> 5.
- `foundry/FEHA_CYBERWARE_RUNTIME.js` (1.0.x):
  - **Charge** = max capacity - installed cost + charge cells (`charge(actor)` mirrors the module's formula: 12 + 4 x level + CON + `cyberwareCapacityBonus` + booster). Spent charge is `flags.fleshEnshrouded.cyberwareChargeSpent`, cleared on `dnd5e.restCompleted`.
  - `activate(item)`: spends charge (minus Bio Conductors / Kerenzikov Boost discounts), applies heal / temp HP / RAM / roll and a timed Active Effect, posts to chat. Short on charge -> DialogV2 "push past the limit" for 2d6 psychic per missing charge.
  - Entry points: the shared `Item#use` bridge in FEHA_GRENADE_RUNTIME, and an ACTIVATE button injected into the Chrome Manager item dossier (`syncManager`, called from latest-dev.js `markRoot`). The module's own USE buttons are hidden by existing CSS and are intercepted if clicked. A CHARGE readout sits under the capacity bar.
  - Passive bonuses: one actor Active Effect per installed item ("CHROME // name", flag `cyberwarePassive`), synced by the client that changed the item and by the GM on load.
  - GM on `updateCombat`: deletes expired activations, ends one-attack reactions (`turnOnly`) at the turn change, applies `regen`.
- Speed: most characters have no base walk speed recorded, so any effect that changes speed first upgrades an unset speed to 30 ft (`withBaseSpeed`, also added to FEHA_CONSUMABLE_RUNTIME 1.0.1).
- V3 `hackDC` adds installed `flags.quickhackDcBonus` (Cogito Frame).
- Not automated (text only, table applies): extra attacks / actions from Sandevistan, "attacks against you have disadvantage", cyberarm weapon attacks (Mantis Blades 8d8, Nano Wires 9d8, unarmed dice), on-kill and on-hit riders, "cannot drop below 1 HP".
- Verified on the test actor as GM: migration (101 matched, 0 unknown), passive sync, charge maths, discounts, heal / AC / invisible activations, push dialog, rest reset, Sandevistan expiry and Kerenzikov turn-end in a mock combat, Chrome Manager readout + ACTIVATE. Not verified from a player login.

## 16. 0.11.96 Sandevistan time stop + cyberware balance pass (2026-10-01)

- Sandevistan is a time stop (user request): on activation the user immediately takes extra turns while nothing else can move, act or react. C1 = a move and one attack; C2, C3 = one turn; C4 = two; Apogee = three. C3+ attack with advantage (`attackAdvantage` on the activation effect, applied in `dnd5e.preRollAttackV2`). The "TIME STOPPED // name" effect is `turnOnly`, so the GM client removes it when the tracker advances. The extra turns themselves are not automated: the GM does not advance the tracker.
- Balance pass (catalog 2.1.0), costs scaled so a 13-26 charge pool buys one or two big activations: Sandevistan 3/5/6/9/12, Berserk 3/4/6/8, Kerenzikov 3, Reflex Recorder 2, Optical Camo 5, Blood Pump 6, Sudden Aid 4, Second Heart 10, Projectile Launcher 4, Micro Generator 4, Self Ice 3, Tactical Icon Processor 3. Tougher passives against 25-60 damage hits: Endoskeleton +4 HP/level, Bone Marrow Cells +6 HP/level, physical soak Heavy Reactive 3 / Reactive 4 / Subdermal Plating 6 / Skin Lattice 5 (+1 AC), Pain Reductor 4 (all damage), Biomonitor 3d8 + prof.
- **Shipped without a GM-side test**: the Claude browser session had been switched to the player login (shared cookie), so only "loads with no errors as a player" was verified. Still to check as GM: migration applies the new text and costs, time stop effect appears and clears on the turn change, advantage on C3+ attacks.

## 17. 0.11.97 looks pass (2026-10-01)

- New skin file `chat-cp.css` (loader key `chatSkinCss`, bundled into `#feha-market-cp-css`). Tokens `--fcc-*`. Covers: chat messages (red rail public, yellow rail whisper), dnd5e chat cards and dice, DialogV2 windows, the player list / connection readout, left tool buttons and scene navigation, right sidebar tabs, chat controls + ProseMirror toolbar + input (stacked with no gaps), and the macro hotbar. Faded-UI opacity is forced to 1 on those pieces.
- Cyberware and consumable chat messages use `.feha-chat-card` (kicker, h3, `.feha-chat-result`, `.feha-chat-foot`).
- Not skinned: the contents of the other sidebar tabs (combat, scenes, actors, items, journal, settings) and character sheets.

## 18. 0.12.0 NPC catalog (2026-10-01)

- `foundry/FEHA_NPC_CATALOG.js` (module `npcCatalog`, `game.adk.npcs`): 29 NPC definitions in seven factions (Street, Yakuza, CivCorp, Marble Vigil, Corporate, Navy, Civilians), tiers 0-4 (`TIERS`: HP / AC / CR / charge). Setting comes from the user's lore doc (memory `feha-world-lore`).
- Gear is copied from world items at import: weapons by selector `w(class, maxBand, maker?)` with a stable hash pick (unique and band-5 weapons excluded); armour, chrome, quickhacks, grenades and consumables by name **and** `sourceCategory` (names repeat across catalogs, e.g. "Optic Zero"). Chrome is flagged installed, quickhacks `loadedQuickhack`, and `cyberwareCapacityBonus` is set so each NPC has its tier's charge pool.
- Nothing is created on load. GM button "Import FEHA NPCs" in the Actors tab header (`renderActorDirectory`) -> DialogV2 confirm -> `import()` creates folder "FEHA NPCS" > faction and skips NPCs that already exist (`flags.fleshEnshrouded.npcKey`). `import({rebuild:true})` replaces the gear on existing catalog NPCs.
- Actors are unlinked `npc` type, flat AC, walk 30, default mystery-man art, hostile disposition (civilians neutral).
- The 29 were imported into the live world on 2026-10-01 from the test branch (GM login "Evan (DM)").

### §18 additions (same day)

- NPC catalog 1.1.0: 46 NPCs. New factions "Kurohane Group" (11, incl. tier-5 "Adam Smasher": `TIERS[5]`, `best()` selector allows band-5 weapons) and "Bastion Strategic" (6); Marble Vigil has 7. Portraits are still the default silhouette: the user rejected the AI pack found online, image search sites are blocked in the Claude browser, and files cannot be moved into Forge from this side. Agreed route: the user uploads a folder of art to Forge and Claude matches images to NPCs.
- Cyberware catalog 2.1.2: world items are filed under their maker's folder inside "02 — CYBERWARE" (`makerFolders()`); cyberdecks get the same description card as other chrome (card line "CYBERDECK // N RAM // N QUICKHACK SLOTS"), with price and capacity cost brought in line; their RAM / slot flags and effect text are untouched.
- item-cp.css: item sheet title scales to fit long names (container query); not visually confirmed.

## 19. 0.12.1 cyberware capstones (branch `playstyles`, 2026-10-01)

- Max RAM is 22: Raven Microcyber 12 + Ex Disk 5 + Neuro Matrix 3 + Ram Upgrade 2 (all three Frontal Cortex slots). With the new Corvus Apex Cyberdeck (14) it is 24.
- Camillo Ram Manager is once per rest (`active.oncePerRest`, actor flag array `cyberwareUsedThisRest`, cleared on rest). It was repeatable for charge, which made RAM effectively unlimited.
- Catalog 2.2.x supports new items: a row with `from:"Template"` is cloned once in the world from that item (`createMissing`), then migrated like any other. `deckSpec` gives a catalog-added deck its RAM / slots / text and sets `flags.cyberdeck`. New: Berserk C5, Mantis Blades Apex, Projectile Launcher Apex, Ballistic Coprocessor, Corvus Apex Cyberdeck (106 world items).
- Moved to Mk.V with stronger text: Strong Arms, Kiroshi Optics Hunter, Chiton, Throwing Range Servos, Rockerboy Interface Tattoo. Sudden Aid can treat a targeted ally (`healsTarget`: the roll is posted for the target and the GM applies it).
- Bug fixed: effects were created from the catalog's own change objects, which Foundry mutates with defaults; the fingerprint then differed every session and passive effects were deleted and recreated on every load. `withBaseSpeed` now always deep-clones (cyberware runtime 1.1.1, consumable runtime 1.0.3).
- Load timing: a clean reload is ~1 s of FEHA code; the rest is the GitHub download (6-7 s when GitHub is slow). Still recreated on every load, not from this change: armour effects "ANCHOR PLATING // BRACED" and "KINETIC SYNC // HELIX" (FEHA_ARMOR_RUNTIME), and the module flips the image of "Tactical Icon Processor" between two files.

### §19 additions: full cyberware effect test (2026-10-01, runtime 1.1.3, catalog 2.2.2)

Every catalog item was exercised on TEST Gunner as GM (temporary level-3 effect, mock combat on FEHA TEST ARENA).

- 43 passive items: installed, each change key compared before / after, effect removed on delete. All pass.
- 25 active items: activated in combat; charge paid, timed effect, heal / temp HP / RAM / roll, chat card all checked. All pass.
- Special handling verified: Charge System, Time Bank (charge pool), Ram Upgrade / Neuro Matrix / Ex Disk (max RAM), Cogito Frame (quickhack DC +1), ForgeLine Sigma (STR requirement negated), Discharge Connector (reload-advantage flag), Enhanced Blood Vessels (rest heal), Regeneration Lattice (turn-start heal).
- Bugs found and fixed by the test:
  - `onItemChange` read the user id from the wrong argument for createItem / deleteItem (they pass 3 arguments, updateItem 4), so passives only synced on update (Chrome Manager install / eject) and on GM load. A deleted chrome item left its effect behind.
  - A change arriving mid-sync was dropped; it now queues one more pass (`resync`).
  - Endoskeleton / Bone Marrow Cells used `hp.bonuses.level`, which dnd5e ignores for a hand-set max HP. They now add `hpPerLevel x level` to `system.attributes.hp.max` (`passiveChanges`); the value is refreshed on the next sync after a level change.
- About 19 items remain text-only (the table applies them): Memory Boost, Mechatronic Core, Smart Return Actuator, the throwing implants, Mask CW, Electroshock Mechanism, Mantis Blades (both), Nano Wires, Smart Link, Smartlink Tattoo, Syndicate Interface Tattoo, Knife Sharpener, Joint Lock, No Pain No Gain, Heal On Kill, Blood Depleter, Viral Venom. Many automated items also carry a text-only rider.

### §19 additions: cyberarm weapons and roll riders (0.12.2, runtime 1.2.0, catalog 2.3.0)

- Catalog `weapon:{name,damage,type,ability,reach,crit?}`: while the chrome is installed the runtime keeps a real weapon item on the actor (`syncWeapons`, run at the end of `syncActor`), flagged `flags.fleshEnshrouded.cyberarmWeapon = {itemId, fingerprint}`, built from the world weapon "Katana" with FEHA catalog flags stripped. Removed when the chrome is ejected or deleted. Mantis Blades 8d8, Mantis Blades Apex 12d8 (crit 19), Monowire 9d8 reach 15 (Nano Wires), Power Grip Fists 5d8, Gorilla Arms 9d10 (Strong Arms). Attacks are free; they do not spend charge.
- `dnd5e.preRollAttackV2`: `config.rolls[0].parts` is undefined at that point, so bonuses are added by assigning `parts = [...(parts ?? []), bonus]`; `options.criticalSuccess` sets the crit range. Smart links (`smartBonus`) apply when the weapon has `weaponTechnology === "Smart"` (9 weapons); No Pain No Gain (+2 below half HP); Knife Sharpener (crit 19 on blades).
- `dnd5e.preRollDamageV2`: No Pain No Gain +2d6, Knife Sharpener +2d8 on blades, Blood Depleter +2d6 on a melee hit against a targeted creature below half HP (not exercised in testing).
- Verified on TEST Gunner: weapons appear / roll / disappear, smart bonus only on a Smart weapon, wounded and blade riders. A clean reload afterwards made no cyberware writes (1.7 s).

## 20. Maps, lights, bug test and cleanup (0.12.3, branch `bugtest-2026-10-03`, 2026-10-03)

**World data (live, not in the repo):**
- Scene folders: CAMPAIGN (the two session folders), MAPS (16 folders by type of place; a place with several versions has its own subfolder). The old names and folders are in the journal "FEHA Scene Layout Backup 2026-10-02".
- 142 Nebula Maps scenes (day, no-grid images) were added from the Forge folder `Megafolder - Maps/Cyberpunk Maps/Nebula Maps`. Grid = image width / squares in the file name. Four have no size in the name and are set to 20 squares wide (flag `guessedGrid`).
- Walls: the GM is walling by hand. State on 2026-10-03: 702 scenes, 351 with walls. 224 have the map pack's own walls and doors (restored from the journal "FEHA Wall Backup 2026-10-02"), 99 have an automatic outline on the black border, 28 Nebula scenes were outlined room by room with doors. Everything Claude created carries `flags.fleshEnshrouded.walledBy = "claude"`; restored pack walls carry `flags.fleshEnshrouded.restored`.
- Lights: 587 scenes have lights. Every coloured light is capped at colour strength 0.15 (Claude's are 0.08, at most 6 squares); neon colours pulse slowly, warm orange flickers faintly. Original settings are in the journal "FEHA Light Backup 2026-10-02".
- GM rule for walls: outline rooms, doors on doorways, lights, nothing inside rooms.

**Repo:**
- `tools/maps/FEHA_MAP_WALLER.js` and `tools/maps/FEHA_HAND_WALLER.js`: GM-side helpers pasted into the console (not loaded by the game). The first traces the black border and finds lit fixtures; the second shows a map with a percent grid so walls, doors and lights can be placed by eye. Use the tracer with `dark:3`; higher values follow shadows.
- `foundry/FEHA_NEBULA_MAP_IMPORTER.js` (added on main outside this handoff's sessions): GM-only button in the Scenes tab.
- `foundry/FEHA_CYBERWARE_RUNTIME.js` 1.2.1: `guardOwnedItemUpdates`. The installed Chrome Manager (`repairChromeData` in its `chrome-legacy.js`) calls `Item.updateDocuments` with no parent for chrome a character owns, which throws. The guard sends those rows to the owning character. Remove it if the installed module is ever fixed.
- `.gitignore` added: `graphify-out/`, `nebula/`, `portraits-edgerunner/`. These hold third-party art and subscriber links and must never be committed.

**Bug test 2026-10-03 (GM client):** all 41 JS files pass a syntax check; every file the loader lists exists; version.json matches the V3 version; the game loads with no FEHA errors; Market, Chrome Manager and Cyberdeck open; the four party characters have valid HP, items, feats and cyberware charge; no invalid documents. Not tested this round: a player login, combat flows, quickhacks.

**Left for the GM (Claude does not delete world data):** actor folder "FEHA TEST" (TEST Dummy A/B, TEST Gunner); two unused combat encounters; macros named "Macro", "Macro (2)", "Macro (3)"; Ponyboy carries Dense Marrow twice (neither installed); the three backup journals once the layout is approved. `module.json` still says 0.10.125 (it describes the installed bridge module, not this repo's version). 22 merged remote branches can be deleted.

## 21. v1.0 release QA (0.12.4, branch `v1-qa`, 2026-10-03)

Tested live with three GM clients and one player client (Cera / Sasha) on a throwaway scene.

**Fixed:**
- **Messaging.** The installed module `flesh-enshrouded-heart-ablaze` has no `socket` in its manifest, so Foundry never relayed `module.flesh-enshrouded-heart-ablaze`. Everything a player sent to the GM was dropped: quickhacks timed out, player grenades, Market session requests, refund notices, `openForUser`. `FEHA_MULTIPLAYER_SYNC`, `FEHA_QUICKHACK_AUTHORITY` and `FEHA_GRENADE_RUNTIME` now send through `User#query` (`CONFIG.queries["feha.multiplayerSync" | "feha.quickhackAuthority" | "feha.grenadeRuntime"]`). Do not go back to `game.socket` unless the installed manifest gets `"socket": true`, and never use both: every message would arrive twice.
- **One writer with several GMs.** Jobs that write to the world on a timer or on a hook ran on every GM (`game.user.isGM`): grenade ticks (damage and chat card once per GM), effect and zone expiry, zone markers, Helix speed and ForgeLine brace effects, cyberware passive sync. They now run on `game.users.activeGM` only (`isAuthority()` in the grenade, quickhack authority and armor runtimes; `onItemChange` in the cyberware runtime). A GM who throws a zone grenade no longer marks it; the active GM does, from `createMeasuredTemplate`.
- **Market.** Players get only characters they own in the Market and Chrome Manager pickers, and no REROLL STOCK button. A purchase is only reconciled when its `marketPurchasedAt` stamp is under ten minutes old and not seen before: a copy of a bought item (dragged to another character) used to be deleted and refunded.
- **Weapon sheet.** Redraws on `updateActor` when `flags.fleshEnshrouded.weaponTracker` changes (the shot is spent at the attack roll, after the click handler's own refresh). The fired/damage/range line wraps.
- **Cyberdeck CSS.** Loaded quickhack names wrap between words; jack-in tray rows keep their height.
- Grenade tick card shows the damage actually applied after armor.

**Not FEHA, seen during the test:**
- `CombatTracker5e._onRender ... 'turn' in undefined` on every turn change comes from Foundry core when the world holds more than one combat and the changed one is not the viewed one. Deleting the unused combat encounters removes it.
- Ponyboy, Sasha and Zach have no walking speed on their sheets (0 ft); Derke has 30.
- The Entry Gateway (installed module) lets a player pick any candidate; it is cosmetic and does not change the assigned character.
- A GM clicking directly on a token while placing a grenade selects the token; click beside it.

## 22. Content sweep (0.12.5, branch `v1-qa`, 2026-10-03)

0.12.4 went to main on the GM's "ship it". Then every content entry was exercised live:
- **Weapons:** all 118 (78 firearms, 33 melee, 7 unique) on a throwaway actor: attack roll, shot recorded, damage formula matches the catalog, magazine empties, cannot fire empty, reload returns to full. One weapon of each firearm class was also run from the player client with its real reload rule. Slaughtomatic rolling below zero is its written rule (`100d100-9000`, below 0 deals 0).
- **Quickhacks:** all 20 from the player client through `FEHA_QUICKHACK_RUNTIME.prepare` / `execute`, save-gated ones until both outcomes were seen.
- **Grenades:** all 86 entries have a schema and a world item; one of each of the 18 lines thrown from the player client.

**Fixed:**
- `FEHA_QUICKHACK_AUTHORITY` `isExplosive` / `isFirearm` classify by the grenade runtime and the weapon catalogs. The old text match made 32 of 118 weapons "explosives" for Cookoff ("recharge", "determine" in descriptions) and missed every DMR and LMG for Dead Trigger. Quickhack feats that share a name with a unique weapon (Ghost Key, Motor Lock, Optic Zero) are excluded by item type.
- `FEHA_GRENADE_RUNTIME`: result card rows are name + save on one line, damage and effects on the next; `isCyberware` rejects weapon items.
- Query handlers are removed in `destroy()` only if still registered by that copy (`queryHandler`). A request that arrives during the few seconds of a GM hot reload is still lost and times out.
- dnd5e 5.3 sense paths: `senses.ranges.*`.

**Style pass (same version):** `core-cp.css` is a new stylesheet, loaded first in the skin bundle by `ADK_DEV_LOADER.js` so the Market, Chrome Manager, Cyberdeck, item and chat skins keep the last word. It restyles what Foundry and dnd5e draw themselves by re-pointing the CSS variables they read (`--font-*`, `--dnd5e-color-*`, `--dnd5e-font-*`, `--filigree-*`) plus a few structural rules: window frames, form controls, dnd5e actor sheets (banner art, badges, lozenges and textures replaced by flat cut-corner shapes), roll dialogs, notifications, the pause banner, tooltips, context menus, token HUD. The skill and save boxes draw inside a closed shadow root and can only be recoloured through `--filigree-*`. FEHA's own windows were checked after the change and look the same as before.

## 23. Combat test (0.12.6)

Full combat on a throwaway scene with TEST Gunner and the two dummies: initiative, attacks and damage, quickhacks, grenades with a burn tick, chrome activation, movement, ForgeLine brace, reloads, end of combat. Found: FEHA read `game.combat` (the encounter the tracker shows) to decide whether an actor is in combat. This world has a leftover active encounter with no scene, so bonus-action limits were off and turn-based quickhack/grenade effects fell back to a few seconds of real time. `combatForActor` / `currentCombatForScene` (grenade runtime, quickhack runtime and authority), the weapon tracker shot stamp and the armor runtime start-up now prefer `game.combat` but fall back to the started encounter that contains the actor or scene. Everything else in the fight behaved: one burn tick, effects expiring on the right turn, brace +1 AC after a turn without moving, cancelled grenade throws cost nothing, end of combat clears combat effects.
