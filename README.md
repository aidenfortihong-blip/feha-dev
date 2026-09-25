# FEHA Dev

Live development patch channel for **Flesh Enshrouded // Heart Ablaze — ADK Suite**.

This repository is intentionally public so a Foundry VTT world hosted on Forge can fetch the current development patch without reinstalling the module for every UI iteration.

## Files

- `latest-dev.js` — live JavaScript patch
- `latest-dev.css` — live CSS patch
- `version.json` — current dev patch metadata
- `foundry/ADK_DEV_LOADER.js` — paste-once Foundry macro source

## Workflow

1. Keep the stable FEHA module installed on Forge.
2. Run the **ADK DEV LOADER** macro in Foundry.
3. The macro fetches the newest CSS/JS with cache busting.
4. Previous dev CSS/runtime is cleaned up.
5. The Chrome UI is reopened so changes can be tested immediately.
6. Once a patch is approved, it gets baked into the next proper module release.

Do not use this repository as the permanent production module package.
