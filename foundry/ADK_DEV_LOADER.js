// ADK // DEV LOADER
// Paste once into a Foundry Script Macro.
// Loads the newest FEHA dev CSS + JS from GitHub without reinstalling the module.

(async () => {
  if (!game.user?.isGM) return ui.notifications.error("ADK DEV LOADER is GM only.");

  const BASE = "https://raw.githubusercontent.com/aidenfortihong-blip/feha-dev/main";
  const bust = Date.now();

  try {
    ui.notifications.info("FEHA DEV // fetching latest patch...");

    // Cleanup old injected stylesheet.
    document.getElementById("adk-dev-live-css")?.remove();

    // Cleanup previous runtime when it exposes cleanup().
    try { globalThis.ADKDevPatch?.cleanup?.(); } catch (e) { console.warn(e); }

    const [cssRes, jsRes, verRes] = await Promise.all([
      fetch(`${BASE}/latest-dev.css?v=${bust}`, { cache: "no-store" }),
      fetch(`${BASE}/latest-dev.js?v=${bust}`, { cache: "no-store" }),
      fetch(`${BASE}/version.json?v=${bust}`, { cache: "no-store" })
    ]);

    if (!cssRes.ok) throw new Error(`CSS fetch failed: ${cssRes.status}`);
    if (!jsRes.ok) throw new Error(`JS fetch failed: ${jsRes.status}`);

    const [css, js] = await Promise.all([cssRes.text(), jsRes.text()]);
    const version = verRes.ok ? await verRes.json().catch(() => null) : null;

    const style = document.createElement("style");
    style.id = "adk-dev-live-css";
    style.dataset.adkDevPatch = "1";
    style.textContent = css;
    document.head.appendChild(style);

    // Execute in page global scope.
    (0, eval)(js + "\n//# sourceURL=feha-dev/latest-dev.js");

    const v = version?.version ?? globalThis.ADKDevPatch?.build ?? "latest";
    ui.notifications.info(`FEHA DEV // ${v} loaded`);
    console.log("FEHA DEV version:", version ?? v);
  } catch (err) {
    console.error("FEHA DEV LOADER failed", err);
    ui.notifications.error("FEHA DEV LOADER failed — check console.");
  }
})();