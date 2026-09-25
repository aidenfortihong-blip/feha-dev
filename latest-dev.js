(() => {
  const BUILD = "0.1.0";
  globalThis.ADKDevPatch?.cleanup?.();

  const state = {
    build: BUILD,
    cleanup() {
      document.querySelectorAll("[data-adk-dev-patch]").forEach(el => el.remove());
      delete globalThis.ADKDevPatch;
    },
    reopenChrome() {
      try {
        document.getElementById("adk-chrome-manager-34")?.remove();
        if (globalThis.game?.adk?.openChrome) {
          setTimeout(() => game.adk.openChrome(), 60);
        }
      } catch (err) {
        console.error("FEHA dev reopen failed", err);
      }
    }
  };

  globalThis.ADKDevPatch = state;
  console.log("%cFEHA DEV PATCH %c" + BUILD, "color:#70f7e7;font-weight:900", "color:#fff");
  ui?.notifications?.info?.("FEHA DEV PATCH " + BUILD + " loaded");
  state.reopenChrome();
})();