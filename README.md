# FEHA Dev

Live development patch channel for **Flesh Enshrouded // Heart Ablaze — ADK Suite**.

Private Cyberpunk UI/audio assets stay in the user's Forge/browser asset map and are never committed here.

## Current dev build

**0.10.121 — Player Join Bridge + Deep Stability**

Cyberdeck V3 is active. V2 remains recovery fallback only.

## Player join bridge

Players were previously seeing the installed/legacy Entry Gateway because the repo hot-loader only ran on the GM client. The repo now ships an installable **FEHA Live Dev Bridge** that runs on every Foundry client at world join.

Manifest URL:

`https://raw.githubusercontent.com/aidenfortihong-blip/feha-dev/main/module.json`

Once the bridge module is installed and enabled for the world, GM and players both load the same current repo build automatically. During startup it temporarily shields the old gateway, loads the validated build, replaces any already-visible legacy gateway, and suppresses late legacy gateway roots from older duplicate gateway modules.

The bridge package itself is:

`https://raw.githubusercontent.com/aidenfortihong-blip/feha-dev/main/dist/feha-live-dev-bridge.zip`

## Cyberdeck architecture

Authoritative architecture:
`HANDOFF/CYBERDECK_ARCHITECTURE_0.9.md`

Prime rule:

> **JACK IN renders entities. Adapters own mechanics.**

Do not add new device mechanics directly to `FEHA_TABLETOP_UI_V3.js`.

### Runtime modules

- `foundry/cyberdeck/FEHA_CYBER_CORE.js`
  - module lifecycle
  - event bus
  - `game.adk.cyberdeck` namespace

- `foundry/cyberdeck/FEHA_NETWORK_DEVICES.js`
  - normalized Network Entity records
  - Security DC/type/capability registry
  - real Door Wall discovery
  - tagged Token/Tile/Wall/AmbientLight discovery
  - custom/probed devices
  - per-user discovery gating

- `foundry/cyberdeck/FEHA_DEVICE_ACTIONS.js`
  - device breach checks
  - session access
  - capability dispatch
  - Foundry Door actions
  - GM-authoritative world mutations

- `foundry/cyberdeck/FEHA_NETWORK_APPROVALS.js`
  - player PROBE requests
  - online GM approval queue
  - GM type/name/DC assignment
  - socket authority for player world mutations

- `foundry/cyberdeck/FEHA_CAMERA_FEEDS.js`
  - camera placement
  - compromised camera POV
  - client-local vision source
  - multiple session camera feeds
  - RETURN TO NET vision restoration

- `foundry/FEHA_TABLETOP_UI_V3.js`
  - Cyberdeck/JACK IN presentation
  - scene map
  - token/device endpoint cards
  - zoom/pan/declutter
  - UI action routing

## Network device defaults

| Device | Suggested DC | Default capabilities |
|---|---:|---|
| Lights | 10 | Power off/on, overload |
| Camera | 11 | Place/view feed, rotate, disable |
| Door | 12 | Open, close, lock, unlock |
| Alarm | 13 | Disable, enable, trigger |
| Turret | 15 | Disable, enable, rotate, takeover |
| Terminal | 16 | Reveal network, download data |
| System/Core | 18 | Reveal network, control subsystem |

GM can override any Security DC.

General bands:
- 8–10 unsecured/basic
- 11–13 secured endpoint
- 14–16 important controller
- 17–19 central infrastructure
- 20+ exceptional/military/core

## JACK IN

Current:
- active Scene map as cyberized underlay
- exact Token positions
- duplicate Actor Tokens stay distinct
- collision-resolved cards + exact-position anchors/tethers
- mouse-wheel zoom
- drag pan
- FIT / RESET
- actor Quickhacks
- save/damage resolver
- direct HP/temp-HP application
- Network Device endpoints
- device Security DC breach
- PROBE unknown map positions for GM approval
- real Foundry Door actions
- per-user custom-device discovery
- hacked camera-feed placement and camera POV

## Important files

- `latest-dev.js` — shared FEHA patch services + V2 fallback
- `latest-dev.css`
- `cyberdeck-v3.css`
- `module.json` — installable FEHA Live Dev Bridge manifest
- `foundry/FEHA_CLIENT_BOOTSTRAP.js` — automatic all-client join bootstrap
- `dist/feha-live-dev-bridge.zip` — install/update package
- `foundry/ADK_DEV_LOADER.js`
- `foundry/FEHA_TABLETOP_UI_V3.js`
- `foundry/cyberdeck/*`
- `version.json`
- `HANDOFF/CYBERDECK_ARCHITECTURE_0.9.md`
- `foundry/FEHA_HANDOFF_EXPORTER.js`
- `foundry/FEHA_MODULE_SOURCE_EXPORTER.js`

## Dev loader order

1. base FEHA patch
2. Cyber Core
3. Network Devices
4. Device Actions
5. Network Approvals
6. Camera Feeds
7. initialize Cyber Core
8. Cyberdeck V3 UI

The loader resolves `main` to an immutable commit SHA before executing sources. It is client-safe; the Live Dev Bridge invokes it automatically for both GM and player clients.

## Locked rules

- roster: Ponyboy, Derke, Sasha, Zach only
- no Heat/Humanity
- RAM restores on Short Rest only
- `flags.fleshEnshrouded.ramCost` is canonical
- V2 is fallback only
- hidden/secret map information must be discovery-gated
- world mutations from player clients must go through GM authority
- no Trace/ICE subsystem unless the user later changes direction

## Development rule

The public dev repository is a live iteration channel, not the final production package. Approved systems should eventually be migrated into the proper FEHA module source.
