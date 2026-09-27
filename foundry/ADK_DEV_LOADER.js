// FEHA // ADK DEV LOADER
// Modular Cyberdeck development loader.

(async () => {
  if (!game.user?.isGM) {
    return ui.notifications.error("ADK DEV LOADER is GM only.");
  }

  const OWNER = "aidenfortihong-blip";
  const REPO = "feha-dev";
  const API = "https://api.github.com/repos/" + OWNER + "/" + REPO;
  const bust = Date.now();

  const files = {
    baseCss:"latest-dev.css",
    v3Css:"cyberdeck-v3.css",
    baseJs:"latest-dev.js",
    core:"foundry/cyberdeck/FEHA_CYBER_CORE.js",
    devices:"foundry/cyberdeck/FEHA_NETWORK_DEVICES.js",
    actions:"foundry/cyberdeck/FEHA_DEVICE_ACTIONS.js",
    approvals:"foundry/cyberdeck/FEHA_NETWORK_APPROVALS.js",
    cameraPlacement:"foundry/cyberdeck/FEHA_CAMERA_PLACEMENT.js",
    v3:"foundry/FEHA_TABLETOP_UI_V3.js"
  };

  try {
    ui.notifications.info("FEHA DEV // resolving latest modular build...");

    const commitRes = await fetch(
      API + "/commits/main?t=" + bust,
      {
        cache:"no-store",
        headers:{Accept:"application/vnd.github+json"}
      }
    );

    if (!commitRes.ok) {
      throw new Error("Commit lookup failed: " + commitRes.status);
    }

    const commit = await commitRes.json();
    const sha = commit?.sha;

    if (!sha) {
      throw new Error("GitHub returned no commit SHA.");
    }

    const BASE =
      "https://raw.githubusercontent.com/" +
      OWNER + "/" + REPO + "/" + sha;

    try {
      globalThis.FEHA_TABLETOP_UI_V3?.destroy?.();
    } catch (err) {
      console.warn("FEHA DEV // previous V3 cleanup warning",err);
    } finally {
      delete globalThis.FEHA_TABLETOP_UI_V3;
    }

    try {
      await globalThis.FEHA_CYBER_CORE?.destroy?.();
    } catch (err) {
      console.warn("FEHA DEV // previous cyber-core cleanup warning",err);
    } finally {
      delete globalThis.FEHA_CYBER_CORE;
    }

    try {
      globalThis.ADKDevPatch?.cleanup?.();
    } catch (err) {
      console.warn("FEHA DEV // previous base cleanup warning",err);
    }

    globalThis.FEHA_CYBERDECK_V3_ACTIVE = true;

    document.getElementById("adk-dev-live-css")?.remove();
    document.getElementById("feha-jackin-overlay")?.remove();
    document.getElementById("feha-cyberdeck-v2")?.remove();
    document.getElementById("feha-network-approval-queue")?.remove();
    document.getElementById("feha-camera-feed-hud")?.remove();
    document.getElementById("feha-camera-placement")?.remove();
    document.getElementById("feha-camera-placement-style")?.remove();

    const entries = Object.entries(files);

    const responses = await Promise.all(
      entries.map(async ([key,path]) => {
        const response = await fetch(
          BASE + "/" + path + "?t=" + bust,
          {cache:"no-store"}
        );

        if (!response.ok) {
          throw new Error(path + " fetch failed: " + response.status);
        }

        return [key,await response.text(),path];
      })
    );

    const source = Object.fromEntries(
      responses.map(([key,text]) => [key,text])
    );

    const style = document.createElement("style");
    style.id = "adk-dev-live-css";
    style.dataset.adkDevPatch = "1";
    style.dataset.adkCommit = sha.slice(0,7);
    style.textContent = source.baseCss + "\n\n" + source.v3Css;
    document.head.appendChild(style);

    const evaluate = (text,path) => {
      (0,eval)(
        text +
        "\n//# sourceURL=feha-dev/" +
        sha.slice(0,7) +
        "/" +
        path
      );
    };

    evaluate(source.baseJs,files.baseJs);
    evaluate(source.core,files.core);
    evaluate(source.devices,files.devices);
    evaluate(source.actions,files.actions);
    evaluate(source.approvals,files.approvals);
    evaluate(source.cameraPlacement,files.cameraPlacement);

    await globalThis.FEHA_CYBER_CORE?.init?.();

    const requiredModules = [
      "devices",
      "deviceActions",
      "deviceApprovals",
      "cameraPlacement"
    ];

    const missingModules = requiredModules.filter(
      name => !globalThis.FEHA_CYBER_CORE?.module?.(name)
    );

    if (missingModules.length) {
      throw new Error(
        "Cyberdeck module registration failed: " +
        missingModules.join(", ")
      );
    }

    evaluate(source.v3,files.v3);

    const version =
      globalThis.FEHA_TABLETOP_UI_V3?.version ??
      globalThis.FEHA_CYBER_CORE?.version ??
      globalThis.ADKDevPatch?.build ??
      sha.slice(0,7);

    ui.notifications.info(
      "FEHA DEV // " +
      version +
      " loaded [" +
      sha.slice(0,7) +
      "]"
    );

    console.log(
      "FEHA DEV resolved commit:",
      sha,
      "build:",
      version,
      "modules:",
      [...(globalThis.FEHA_CYBER_CORE?.modules?.().keys?.() ?? [])]
    );
  } catch (err) {
    console.error("FEHA DEV LOADER failed",err);

    try {
      await globalThis.FEHA_CYBER_CORE?.destroy?.();
    } catch {}

    delete globalThis.FEHA_CYBERDECK_V3_ACTIVE;

    try {
      globalThis.ADKDevPatch?.resumeCyberdeckV2?.();
    } catch (fallbackErr) {
      console.warn("FEHA DEV // V2 recovery warning",fallbackErr);
    }

    ui.notifications.error(
      "FEHA DEV LOADER failed — send me the visible error or a screenshot."
    );
  }
})();
