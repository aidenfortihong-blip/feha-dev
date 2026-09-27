# FEHA Cyberdeck Architecture

Authoritative architecture for Cyberdeck V3 / JACK IN development.

Current architecture generation: **0.9.x**

## Prime rule

**JACK IN renders entities. Adapters own mechanics.**

Do not add device-specific mechanics, world-document writes, socket authority, or camera/turret behavior directly to `FEHA_TABLETOP_UI_V3.js`.

The UI may:
- request models from services
- render normalized entities
- collect user intent
- call service APIs
- render returned results

The UI must not:
- know how a Foundry Door changes state
- know how a camera vision source works
- decide a device Security DC
- persist custom devices
- authorize player world mutations
- contain per-device switch logic

## Runtime modules

### `foundry/cyberdeck/FEHA_CYBER_CORE.js`

Responsibilities:
- module registry
- subsystem lifecycle
- small event bus
- one stable namespace: `game.adk.cyberdeck`

Every new subsystem should expose:
- `version`
- `init(core)` when useful
- `destroy(core)`
- focused public methods

Hot reload requirement:
- all listeners, sources, timers, DOM owned by a module must be removable by `destroy()`.

### `foundry/cyberdeck/FEHA_NETWORK_DEVICES.js`

Responsibilities:
- normalized Network Entity records
- device type registry
- capability registry
- Security DC defaults
- scene scanning/adaptation
- custom/probed device persistence
- per-user discovery state

Current device types / suggested DC:
- Camera: 11
- Door: 12
- Alarm: 13
- Turret: 15
- Terminal: 16
- System/Core: 18
- Lights: 10

The GM can override any DC.

Network Entity contract:

```text
id
sceneId
type
typeLabel
name
xPct
yPct
securityDC
securityLabel
capabilities[]
sourceUuid
sourceType
sourceId
discoveredBy[]
state
origin
metadata
```

JACK IN must consume this normalized form rather than branching on Foundry document classes.

### `foundry/cyberdeck/FEHA_DEVICE_ACTIONS.js`

Responsibilities:
- device breach checks
- session access cache
- capability dispatch
- Foundry-document resolution
- generic state mutations
- real Door Wall actions
- GM-authoritative mutation delegation

Device breach:
- d20 + operator INT modifier + proficiency
- versus device Security DC
- successful access persists for that actor/device for the current client session

A capability first emits:
`device:execute:<CAPABILITY>`

Specialized adapters get first refusal.

If no adapter handles it, generic/device-core logic may execute it.

### `foundry/cyberdeck/FEHA_NETWORK_APPROVALS.js`

Responsibilities:
- socket authority bridge
- player unknown-device probe requests
- online GM approval queue
- GM type/name/DC assignment
- authoritative Scene/Wall mutation relay
- per-user network reveal requests

Unknown object flow:
1. Player enters PROBE mode.
2. Player marks a map location.
3. Online GM receives request.
4. GM denies or chooses type + name + Security DC.
5. Approved device becomes a normalized custom Network Entity.
6. The requesting player discovers it.

Do not create a separate approval/socket implementation for each future device.

### `foundry/cyberdeck/FEHA_CAMERA_FEEDS.js`

Responsibilities:
- camera feed placement
- feed session memory
- client-local camera POV
- camera feed switching
- restoring normal player vision

Camera feed implementation is isolated from JACK IN.

Current implementation uses Foundry's public PointVisionSource lifecycle:
- create source with unique source ID
- initialize at selected Scene coordinate
- add source to vision collection
- temporarily suppress normal vision sources
- restore normal sources on RETURN TO NET

Camera feeds are session-local in 0.9.1. Persistence across reconnects can be added later without changing JACK IN.

## UI runtime

### `foundry/FEHA_TABLETOP_UI_V3.js`

Responsibilities:
- Cyberdeck loadout rendering
- JACK IN rendering
- viewport zoom/pan
- scene-map presentation
- actor endpoint card declutter
- normalized device endpoint rendering
- Quickhack resolution presentation
- action routing into services

Device-specific UI should be data-driven:
- render capabilities supplied by device record
- render Security DC supplied by device record
- call `deviceActions.executeCapability`
- handle generic returned UI modes
- do not implement physical device mechanics here

## Device philosophy

Device **capabilities** matter more than device classes.

Current capability vocabulary:
- PLACE_FEED
- VIEW_FEED
- ROTATE
- DISABLE
- ENABLE
- OPEN
- CLOSE
- LOCK
- UNLOCK
- TAKEOVER
- FIRE
- REVEAL_NETWORK
- DOWNLOAD_DATA
- TRIGGER
- POWER_OFF
- POWER_ON
- OVERLOAD
- CONTROL_SUBSYSTEM

A future device should preferably be implemented as:
1. normalized type definition
2. capabilities
3. optional adapter handlers

—not new JACK IN conditionals.

## Foundry source adapters

Current sources:
- real Door Walls -> auto-detected Door devices
- tagged Tokens -> any tagged Network Device
- tagged Tiles -> any tagged Network Device
- tagged Walls -> non-door Network Devices
- tagged AmbientLights -> lighting devices
- Scene-flag custom records -> probes / narrative devices

Flag:
`flags.fleshEnshrouded.networkDevice`

Scene custom-device store:
`flags.fleshEnshrouded.networkDevices`

Secret Foundry doors must not automatically leak to non-GM users.

## Network terminals / central systems

Endpoints are generally easier than controllers.

Typical DC bands:
- 8–10: unsecured/basic
- 11–13: secured endpoint
- 14–16: important controller
- 17–19: central infrastructure
- 20+: exceptional/military/core

A Terminal or System may expose `REVEAL_NETWORK`, allowing broader device discovery.

## Planned specialized adapters

### Turret adapter
Should own:
- rotation
- IFF / allegiance state
- takeover
- optional FIRE integration with bound turret Actor/Token

Do not put turret attack math in JACK IN.

### Environmental adapter
May own:
- vents
- shutters
- sprinklers
- machinery
- conveyors
- environmental hazards

Prefer one generic environment adapter with capabilities over many bespoke device types.

## Planned non-device modules

These should also be extracted from V3 rather than expanded inline:

- `FEHA_QUICKHACKS.js`
  - explicit Quickhack schema
  - legacy effectText parser
  - loaded/library state

- `FEHA_RESOLVER.js`
  - saves
  - damage
  - secondary targeting
  - resolution state machine

- `FEHA_EFFECTS.js`
  - conditions / Active Effects
  - durations
  - reaction loss
  - disabled cyberware

- `FEHA_INTEL.js`
  - target HP
  - saves
  - resistances/immunities
  - cyber/electronic classification

- `FEHA_DECKS.js`
  - deck/manufacturer passive registry
  - beforeRamSpend / afterQuickhack / etc.

- `FEHA_NETWORK_LOG.js`
  - compact in-JACK-IN event history

No Trace/ICE subsystem is planned unless the user later explicitly changes direction.

## Patchability rules

1. No duplicated rules.
2. One canonical service owns each mechanic.
3. World writes happen through authority-aware services.
4. UI never guesses permissions.
5. Legacy prose parsing is fallback only.
6. Prefer explicit item/device flags for new content.
7. Migrations must be versioned/idempotent.
8. New modules must clean up after themselves.
9. Player-visible hidden-map information must be discovery-gated.
10. Screenshots drive visual iteration; exported live/module data drives mechanics.

## Loader order

```text
latest-dev.js
FEHA_CYBER_CORE.js
FEHA_NETWORK_DEVICES.js
FEHA_DEVICE_ACTIONS.js
FEHA_NETWORK_APPROVALS.js
FEHA_CAMERA_FEEDS.js
FEHA_CYBER_CORE.init()
FEHA_TABLETOP_UI_V3.js
```

V2 remains recovery fallback only.
