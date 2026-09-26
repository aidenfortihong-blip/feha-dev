# FEHA Dev

Live development patch channel for **Flesh Enshrouded // Heart Ablaze — ADK Suite**.

This repository is intentionally public so a Foundry VTT world hosted on Forge can fetch the current development patch without reinstalling the module for every UI iteration. Private Cyberpunk UI/audio assets stay in the user's Forge/browser asset map and are never committed here.

## Current dev build

**0.8.4 — Cyberdeck V3 deep-audit hardening**

Cyberdeck V3 is the active dev Cyberdeck. The older V2 runtime remains only as a recovery fallback and must not compete with V3 while the V3 loader is active.

## Important files

- `latest-dev.js` — shared live FEHA patch services and V2 fallback
- `latest-dev.css` — shared Chrome/legacy dev styling
- `cyberdeck-v3.css` — Cyberdeck V3 + JACK IN presentation
- `foundry/FEHA_TABLETOP_UI_V3.js` — Cyberdeck V3/JACK IN runtime
- `foundry/ADK_DEV_LOADER.js` — canonical GM dev-loader macro source
- `version.json` — current dev patch metadata
- `foundry/FEHA_HANDOFF_EXPORTER.js` — live-world handoff exporter
- `foundry/FEHA_MODULE_SOURCE_EXPORTER.js` — installed-module source exporter

## Workflow

1. Keep the stable FEHA module installed on Forge.
2. Run the **ADK DEV LOADER** macro in Foundry.
3. The loader resolves `main` to an exact Git commit SHA.
4. It cleans the previous V3/base runtime, then fetches both base and V3 CSS/JS from that immutable commit.
5. The base patch starts with V2 Cyberdeck presentation suspended while V3 owns `game.adk.openCyberdeck`.
6. If V3 fails to load, the loader clears the V3 flag and asks the base patch to restore V2 as a recovery fallback.
7. Open Cyberdeck normally and test the reported build/version.

Chrome Manager is only reopened by the base patch if it was already open; loading Cyberdeck changes no longer forces Chrome Manager open.

## Cyberdeck V3 rules

- roster: Ponyboy, Derke, Sasha, Zach only
- loadout screen: RAM, Short Rest, installed deck/support chrome, loaded Quickhacks, owned software, JACK IN
- no Heat or Humanity meters
- RAM restores on Short Rest only
- Quickhacks physically present in the actor inventory count as owned
- JACK IN opens a separate fullscreen active-scene target/execution view
- all actor-backed active-scene tokens are discoverable subject to Foundry hidden-token visibility
- Quickhack RAM cost uses `flags.fleshEnshrouded.ramCost` when present
- Quickhack/deck effect adjudication remains manual/chat-based where the installed FEHA module is also manual

## Development rule

Do not use this repository as the permanent production module package. Once a dev patch is approved, migrate the stable behavior into the proper FEHA module.
