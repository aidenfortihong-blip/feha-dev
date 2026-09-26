# FEHA NEW CHAT STARTER

Continue the **Flesh Enshrouded Heart Ablaze / ADK Foundry VTT project**.

Repository:
https://github.com/aidenfortihong-blip/feha-dev

Before editing anything:
1. Read `HANDOFF/FEHA_MASTER_HANDOFF_2026-09-26.md` completely.
2. Inspect current `latest-dev.js`, `latest-dev.css`, and `version.json`.
3. If the user uploaded `FEHA_ADK_MODULE_SOURCE_*.json` and `FEHA_ADK_HANDOFF_*.json`, use those as the live Foundry/module source of truth.
4. Patch GitHub directly when possible.
5. Do not make the user manually paste tiny CSS/JS patches if repo write access exists.
6. Never ask for passwords, GitHub tokens, Forge credentials, API keys, or OAuth secrets.

Current live dev baseline:
- **0.6.2**
- Chrome Manager cleanup is stable enough to leave alone unless a regression appears.
- Legacy wallet presentation is suppressed while `ADKWallet` data remains intact.
- The legacy purple Cyberdeck UI has been replaced by **Cyberdeck V2**.
- Cyberdeck roster is **Ponyboy / Derke / Sasha / Zach only**.
- Cyberdeck has **no Heat and no Humanity**.
- Cyberdeck telemetry is **RAM / installed deck / software load**.
- Cyberdeck should use the private CP2077 asset pack and FEHA sound engine aggressively.
- Do not revive the old Cyberdeck template.

Immediate priorities:
- obtain/use the actual installed ADK module source and live actor/item export
- continue Cyberdeck V2 from the real data/backend
- character sheet: present **Spells as Quickhacks** and display **RAM** near that section
- progressively move live-patch systems into the real module source
- preserve current Chrome Manager visual language and wallet suppression

When screenshots conflict with assumptions, inspect the real source/export instead of stacking guessed DOM patches.
