// FEHA // LIVE DEV CLIENT BRIDGE
// Runs on every Foundry client. It waits for the installed FEHA suite, then
// hot-loads the same validated repo build the GM uses.

(() => {
  const VERSION = "0.10.125";
  const OWNER = "aidenfortihong-blip";
  const REPO = "feha-dev";
  const LOADER_PATH = "foundry/ADK_DEV_LOADER.js";
  const SHIELD_ID = "feha-live-bridge-gateway-shield";
  const GATEWAY_ID = "adk-entry-gateway";
  const WAIT_MS = 20000;

  if (
    globalThis.FEHA_LIVE_CLIENT_BRIDGE?.version === VERSION &&
    globalThis.FEHA_LIVE_CLIENT_BRIDGE?.active === true
  ) {
    return;
  }

  let shieldTimer = null;

  function installGatewayShield() {
    let style = document.getElementById(SHIELD_ID);

    if (!style) {
      style = document.createElement("style");
      style.id = SHIELD_ID;
      style.textContent =
        "#" + GATEWAY_ID + ":not(.feha-eg-custom){" +
        "visibility:hidden!important;" +
        "opacity:0!important;" +
        "pointer-events:none!important;" +
        "}";
      document.head.appendChild(style);
    }

    clearTimeout(shieldTimer);
    shieldTimer = setTimeout(() => {
      document.getElementById(SHIELD_ID)?.remove();
    }, WAIT_MS + 5000);
  }

  function removeGatewayShield() {
    clearTimeout(shieldTimer);
    shieldTimer = null;
    document.getElementById(SHIELD_ID)?.remove();
  }

  async function waitForSuite() {
    const started = Date.now();

    while (Date.now() - started < WAIT_MS) {
      if (
        globalThis.ADKEntryGateway &&
        globalThis.game?.adk
      ) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve,50));
    }

    return false;
  }

  async function fetchAndRunLoader() {
    const url =
      "https://raw.githubusercontent.com/" +
      OWNER + "/" + REPO + "/main/" +
      LOADER_PATH +
      "?t=" + Date.now();

    const response = await fetch(url,{cache:"no-store"});

    if (!response.ok) {
      throw new Error(
        "FEHA client loader fetch failed: " +
        response.status
      );
    }

    const source = await response.text();

    try {
      new Function(source);
    } catch (err) {
      throw new Error(
        "FEHA client loader syntax check failed: " +
        String(err?.message ?? err)
      );
    }

    const task = (0,eval)(
      source +
      "\n//# sourceURL=feha-live-bridge/" +
      LOADER_PATH
    );

    if (task?.then) {
      await task;
    }

    return true;
  }

  async function reloadLocalClient() {
    if (globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT) {
      return globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT;
    }

    const task = fetchAndRunLoader();
    globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT = task;

    try {
      await task;
      ui?.notifications?.info?.(
        "ADK // this client reloaded."
      );
      return true;
    } catch (err) {
      console.error("FEHA local client reload failed",err);
      ui?.notifications?.error?.(
        "ADK reload failed on this client. Check console."
      );
      throw err;
    } finally {
      if (globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT === task) {
        delete globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT;
      }
    }
  }

  function installLocalReloadApi() {
    game.adk ??= {};
    game.adk.reload = reloadLocalClient;
    game.adk.reloadDev = reloadLocalClient;
    game.adk.reloadCurrentClient = reloadLocalClient;
    globalThis.FEHA_ADK_RELOAD = reloadLocalClient;
  }

  async function boot() {
    const state = globalThis.FEHA_LIVE_CLIENT_BRIDGE = {
      version:VERSION,
      active:false,
      loading:true,
      loadedVersion:null,
      error:null
    };

    installGatewayShield();

    try {
      const suiteReady = await waitForSuite();

      if (!suiteReady) {
        throw new Error(
          "Timed out waiting for the installed FEHA / ADK suite."
        );
      }

      await fetchAndRunLoader();

      if (!globalThis.__FEHA_ENTRY_GATEWAY_NORMALIZER) {
        throw new Error(
          "Latest Entry Gateway did not attach."
        );
      }

      installLocalReloadApi();

      state.active = true;
      state.loading = false;
      state.loadedVersion =
        globalThis.FEHA_TABLETOP_UI_V3?.version ??
        null;

      removeGatewayShield();

      console.info(
        "FEHA LIVE BRIDGE // player client linked",
        {
          bridge:VERSION,
          build:state.loadedVersion,
          user:game.user?.name ?? game.user?.id
        }
      );
    } catch (err) {
      state.loading = false;
      state.error = String(err?.message ?? err);

      removeGatewayShield();

      console.error(
        "FEHA LIVE BRIDGE // client bootstrap failed",
        err
      );

      ui?.notifications?.error?.(
        "FEHA live client link failed. Falling back to the installed Gateway."
      );
    }
  }

  installGatewayShield();

  // The reload entry point itself is client-local and available to every user.
  // It performs no privileged world mutation and never asks a GM to approve it.
  if (globalThis.game?.adk) {
    installLocalReloadApi();
  }

  if (globalThis.game?.ready) {
    void boot();
  } else {
    Hooks.once("ready",() => void boot());
  }
})();
