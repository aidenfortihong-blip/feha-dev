// FEHA // ADK DEV LOADER V3
// Foundry VTT tabletop development loader for the user's FEHA repository.
// Resolves main -> immutable commit SHA, then loads the base patch + Cyberdeck V3.

(async () => {
  if (!game.user?.isGM) {
    return ui.notifications.error("ADK DEV LOADER is GM only.");
  }

  const OWNER = "aidenfortihong-blip";
  const REPO = "feha-dev";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const bust = Date.now();

  try {
    ui.notifications.info("FEHA DEV // resolving latest build...");

    const commitRes = await fetch(
      `${API}/commits/main?t=${bust}`,
      {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json" }
      }
    );

    if (!commitRes.ok) {
      throw new Error(`Commit lookup failed: ${commitRes.status}`);
    }

    const commit = await commitRes.json();
    const sha = commit?.sha;
    if (!sha) throw new Error("GitHub returned no commit SHA.");

    const BASE =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${sha}`;

    try {
      globalThis.FEHA_TABLETOP_UI_V3?.destroy?.();
    } catch (err) {
      console.warn("FEHA DEV // previous V3 cleanup warning", err);
    }

    try {
      globalThis.ADKDevPatch?.cleanup?.();
    } catch (err) {
      console.warn("FEHA DEV // previous base cleanup warning", err);
    }

    document.getElementById("adk-dev-live-css")?.remove();
    document.getElementById("feha-jackin-overlay")?.remove();
    document.getElementById("feha-cyberdeck-v2")?.remove();

    const [
      baseCssRes,
      v3CssRes,
      baseJsRes,
      v3JsRes
    ] = await Promise.all([
      fetch(`${BASE}/latest-dev.css?t=${bust}`, { cache: "no-store" }),
      fetch(`${BASE}/cyberdeck-v3.css?t=${bust}`, { cache: "no-store" }),
      fetch(`${BASE}/latest-dev.js?t=${bust}`, { cache: "no-store" }),
      fetch(
        `${BASE}/foundry/FEHA_TABLETOP_UI_V3.js?t=${bust}`,
        { cache: "no-store" }
      )
    ]);

    for (const [label,response] of [
      ["base CSS",baseCssRes],
      ["V3 CSS",v3CssRes],
      ["base JS",baseJsRes],
      ["V3 JS",v3JsRes]
    ]) {
      if (!response.ok) {
        throw new Error(`${label} fetch failed: ${response.status}`);
      }
    }

    const [
      baseCss,
      v3Css,
      baseJs,
      v3Js
    ] = await Promise.all([
      baseCssRes.text(),
      v3CssRes.text(),
      baseJsRes.text(),
      v3JsRes.text()
    ]);

    const style = document.createElement("style");
    style.id = "adk-dev-live-css";
    style.dataset.adkDevPatch = "1";
    style.dataset.adkCommit = sha.slice(0,7);
    style.textContent = baseCss + "\n\n" + v3Css;
    document.head.appendChild(style);

    (0,eval)(
      baseJs +
      `\n//# sourceURL=feha-dev/${sha.slice(0,7)}/latest-dev.js`
    );

    (0,eval)(
      v3Js +
      `\n//# sourceURL=feha-dev/${sha.slice(0,7)}/FEHA_TABLETOP_UI_V3.js`
    );

    const version =
      globalThis.FEHA_TABLETOP_UI_V3?.version ??
      globalThis.ADKDevPatch?.build ??
      sha.slice(0,7);

    ui.notifications.info(
      `FEHA DEV // ${version} loaded [${sha.slice(0,7)}]`
    );

    console.log(
      "FEHA DEV resolved commit:",
      sha,
      "build:",
      version
    );
  } catch (err) {
    console.error("FEHA DEV LOADER failed", err);
    ui.notifications.error(
      "FEHA DEV LOADER failed — send me the visible error or a screenshot."
    );
  }
})();
