// ADK // DEV LOADER v2
// Paste once into a Foundry Script Macro.
// Resolves main -> exact commit SHA first, then loads immutable files from that commit.
// This avoids raw.githubusercontent branch-cache lag.

(async () => {
  if (!game.user?.isGM) return ui.notifications.error("ADK DEV LOADER is GM only.");

  const OWNER = "aidenfortihong-blip";
  const REPO = "feha-dev";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const bust = Date.now();

  try {
    ui.notifications.info("FEHA DEV // resolving latest build...");

    // Resolve main to an immutable commit SHA so GitHub's raw branch cache cannot serve an old patch.
    const commitRes = await fetch(`${API}/commits/main?t=${bust}`, {
      cache: "no-store",
      headers: { "Accept": "application/vnd.github+json" }
    });
    if (!commitRes.ok) throw new Error(`Commit lookup failed: ${commitRes.status}`);

    const commit = await commitRes.json();
    const sha = commit?.sha;
    if (!sha) throw new Error("GitHub returned no commit SHA.");

    const BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}`;

    document.getElementById("adk-dev-live-css")?.remove();
    try { globalThis.ADKDevPatch?.cleanup?.(); } catch (e) { console.warn(e); }

    const [cssRes, jsRes] = await Promise.all([
      fetch(`${BASE}/latest-dev.css?t=${bust}`, { cache: "no-store" }),
      fetch(`${BASE}/latest-dev.js?t=${bust}`, { cache: "no-store" })
    ]);

    if (!cssRes.ok) throw new Error(`CSS fetch failed: ${cssRes.status}`);
    if (!jsRes.ok) throw new Error(`JS fetch failed: ${jsRes.status}`);

    const [css, js] = await Promise.all([cssRes.text(), jsRes.text()]);

    const style = document.createElement("style");
    style.id = "adk-dev-live-css";
    style.dataset.adkDevPatch = "1";
    style.dataset.adkCommit = sha.slice(0, 7);
    style.textContent = css;
    document.head.appendChild(style);

    (0, eval)(js + `\n//# sourceURL=feha-dev/${sha.slice(0, 7)}/latest-dev.js`);

    const version = globalThis.ADKDevPatch?.build ?? sha.slice(0, 7);
    ui.notifications.info(`FEHA DEV // ${version} loaded [${sha.slice(0, 7)}]`);
    console.log("FEHA DEV resolved commit:", sha, "build:", version);
  } catch (err) {
    console.error("FEHA DEV LOADER failed", err);
    ui.notifications.error("FEHA DEV LOADER failed — press F12 and send me the red error.");
  }
})();