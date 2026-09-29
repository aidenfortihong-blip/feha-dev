// FEHA // ADK DEV LOADER
// Modular Cyberdeck development loader.
// Deep-pass hardening: fetch + validate first, then swap the live runtime.

(async () => {
  const OWNER = "aidenfortihong-blip";
  const REPO = "feha-dev";
  const API = "https://api.github.com/repos/" + OWNER + "/" + REPO;
  const bust = Date.now();
  const isGM = Boolean(game.user?.isGM);

  const files = {
    baseCss:"latest-dev.css",
    v3Css:"cyberdeck-v3.css",
    baseJs:"latest-dev.js",
    core:"foundry/cyberdeck/FEHA_CYBER_CORE.js",
    quickhacks:"foundry/cyberdeck/FEHA_QUICKHACK_CATALOG.js",
    quickhackAuthority:"foundry/cyberdeck/FEHA_QUICKHACK_AUTHORITY.js",
    devices:"foundry/cyberdeck/FEHA_NETWORK_DEVICES.js",
    actions:"foundry/cyberdeck/FEHA_DEVICE_ACTIONS.js",
    approvals:"foundry/cyberdeck/FEHA_NETWORK_APPROVALS.js",
    cameras:"foundry/cyberdeck/FEHA_CAMERAS.js",
    sync:"foundry/FEHA_MULTIPLAYER_SYNC.js",
    v3:"foundry/FEHA_TABLETOP_UI_V3.js",
    manifest:"version.json"
  };

  let swapped = false;
  let injectedStyle = null;
  let resolvedSha = null;

  const compileCheck = (text,path) => {
    try {
      new Function(String(text ?? ""));
    } catch (err) {
      throw new Error(
        path + " syntax preflight failed: " +
        String(err?.message ?? err)
      );
    }
  };

  const cssBraceCheck = (text,path) => {
    const source = String(text ?? "");
    let depth = 0;
    let quote = "";
    let escaped = false;
    let comment = false;

    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const next = source[i+1] ?? "";

      if (comment) {
        if (ch === "*" && next === "/") {
          comment = false;
          i++;
        }
        continue;
      }

      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === quote) quote = "";
        continue;
      }

      if (ch === "/" && next === "*") {
        comment = true;
        i++;
        continue;
      }

      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }

      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth < 0) {
          throw new Error(path + " CSS preflight found an extra closing brace.");
        }
      }
    }

    if (comment || quote || depth !== 0) {
      throw new Error(
        path + " CSS preflight failed: " +
        (comment ? "unterminated comment" :
         quote ? "unterminated string" :
         "unbalanced braces (" + depth + ")")
      );
    }
  };

  const evaluate = (text,path,sha) => {
    (0,eval)(
      text +
      "\n//# sourceURL=feha-dev/" +
      sha.slice(0,7) +
      "/" +
      path
    );
  };

  try {
    if (isGM) {
      ui.notifications.info("FEHA DEV // resolving latest modular build...");
    } else {
      console.info("FEHA DEV // resolving latest modular build for player client...");
    }

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
    resolvedSha = sha ?? null;

    if (!sha) {
      throw new Error("GitHub returned no commit SHA.");
    }

    const BASE =
      "https://raw.githubusercontent.com/" +
      OWNER + "/" + REPO + "/" + sha;

    // FETCH FIRST. A network failure here leaves the current working runtime
    // completely untouched.
    const responses = await Promise.all(
      Object.entries(files).map(async ([key,path]) => {
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

    // PREFLIGHT FIRST. Never destroy a known-good runtime for malformed or
    // partially committed source.
    for (const key of [
      "baseJs","core","quickhacks","quickhackAuthority","devices","actions","approvals","cameras","sync","v3"
    ]) {
      compileCheck(source[key],files[key]);
    }

    cssBraceCheck(source.baseCss,files.baseCss);
    cssBraceCheck(source.v3Css,files.v3Css);

    let buildManifest = null;
    try {
      buildManifest = JSON.parse(source.manifest);
    } catch (err) {
      throw new Error(
        "version.json preflight failed: " +
        String(err?.message ?? err)
      );
    }

    const manifestVersion =
      String(buildManifest?.version ?? "").trim();

    const v3Version =
      source.v3.match(
        /const\s+VERSION\s*=\s*["']([^"']+)["']/
      )?.[1] ?? "";

    if (!manifestVersion || !v3Version) {
      throw new Error("Build preflight could not resolve version metadata.");
    }

    if (manifestVersion !== v3Version) {
      throw new Error(
        "Partial build detected: version.json=" +
        manifestVersion +
        " but V3=" +
        v3Version +
        ". Current runtime was kept intact."
      );
    }

    // From this line onward we are intentionally replacing the live runtime.
    swapped = true;

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

    const style = document.createElement("style");
    style.id = "adk-dev-live-css";
    style.dataset.adkDevPatch = "1";
    style.dataset.adkCommit = sha.slice(0,7);
    style.textContent = source.baseCss + "\n\n" + source.v3Css;
    document.head.appendChild(style);
    injectedStyle = style;

    evaluate(source.baseJs,files.baseJs,sha);
    evaluate(source.core,files.core,sha);
    evaluate(source.quickhacks,files.quickhacks,sha);
    evaluate(source.quickhackAuthority,files.quickhackAuthority,sha);
    evaluate(source.devices,files.devices,sha);
    evaluate(source.actions,files.actions,sha);
    evaluate(source.approvals,files.approvals,sha);
    evaluate(source.cameras,files.cameras,sha);
    evaluate(source.sync,files.sync,sha);

    if (!globalThis.FEHA_CYBER_CORE) {
      throw new Error("Cyberdeck Core did not install.");
    }

    await globalThis.FEHA_CYBER_CORE.init();

    const qhAuthorityModule =
      globalThis.FEHA_CYBER_CORE?.module?.("quickhackAuthority") ??
      globalThis.FEHA_QUICKHACK_AUTHORITY ??
      null;

    if (qhAuthorityModule) {
      console.info(
        "FEHA DEV // QUICKHACK AUTHORITY // LOADED // v" +
        String(qhAuthorityModule.version ?? "UNKNOWN")
      );
    }

    const requiredModules = [
      "quickhacks",
      "quickhackAuthority",
      "devices",
      "deviceActions",
      "deviceApprovals",
      "cameras",
      "multiplayerSync"
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

    evaluate(source.v3,files.v3,sha);

    const loadedVersion =
      globalThis.FEHA_TABLETOP_UI_V3?.version ?? "";

    if (loadedVersion !== manifestVersion) {
      throw new Error(
        "Postflight version mismatch: expected " +
        manifestVersion +
        ", loaded " +
        String(loadedVersion || "NONE")
      );
    }

    await globalThis.FEHA_MULTIPLAYER_SYNC?.attachUiBridges?.();

    const reloadLocalClient = async () => {
      if (globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT) {
        return globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT;
      }

      const task = (async () => {
        const url =
          "https://raw.githubusercontent.com/" +
          OWNER + "/" + REPO + "/main/foundry/ADK_DEV_LOADER.js?t=" +
          Date.now();

        const response = await fetch(url,{cache:"no-store"});
        if (!response.ok) {
          throw new Error(
            "ADK reload fetch failed: " + response.status
          );
        }

        const source = await response.text();
        compileCheck(source,"foundry/ADK_DEV_LOADER.js");

        const result = (0,eval)(
          source +
          "\n//# sourceURL=feha-reloader/foundry/ADK_DEV_LOADER.js"
        );

        if (result?.then) await result;
        return true;
      })();

      globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT = task;

      try {
        return await task;
      } finally {
        if (globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT === task) {
          delete globalThis.__FEHA_ADK_RELOAD_IN_FLIGHT;
        }
      }
    };

    game.adk ??= {};
    game.adk.reload = reloadLocalClient;
    game.adk.reloadDev = reloadLocalClient;
    game.adk.reloadCurrentClient = reloadLocalClient;
    globalThis.FEHA_ADK_RELOAD = reloadLocalClient;

    // The hotbar Macro is a world document and may still contain the historical
    // "GM only" guard. Do not require users to edit that world Macro. On every
    // client, redirect ONLY the ADK DEV LOADER macro to the client-local reload
    // function before its stale command body can execute.
    const macroClass =
      globalThis.CONFIG?.Macro?.documentClass ??
      globalThis.Macro ??
      null;

    const macroProto = macroClass?.prototype ?? null;
    const macroBridgeKey = "__FEHA_ADK_RELOAD_MACRO_BRIDGE";

    if (
      macroProto &&
      typeof macroProto.execute === "function"
    ) {
      const existingBridge = globalThis[macroBridgeKey];

      if (
        existingBridge?.proto === macroProto &&
        macroProto.execute === existingBridge.wrapper
      ) {
        existingBridge.reload = reloadLocalClient;
      } else {
        const originalExecute = macroProto.execute;

        const bridge = {
          proto:macroProto,
          original:originalExecute,
          reload:reloadLocalClient,
          wrapper:null
        };

        bridge.wrapper = function(...args) {
          const name =
            String(this?.name ?? "")
              .replace(/\s+/g," ")
              .trim();

          if (
            /^ADK DEV LOADER(?: V\d+)?$/i.test(name)
          ) {
            return bridge.reload();
          }

          return originalExecute.apply(this,args);
        };

        macroProto.execute = bridge.wrapper;
        globalThis[macroBridgeKey] = bridge;
      }
    }

    if (isGM) {
      ui.notifications.info(
        "FEHA DEV // " +
        loadedVersion +
        " loaded [" +
        sha.slice(0,7) +
        "]"
      );
    } else {
      console.info(
        "FEHA DEV // player client loaded " +
        loadedVersion +
        " [" +
        sha.slice(0,7) +
        "]"
      );
    }

    console.log(
      "FEHA DEV integrity pass:",
      {
        sha,
        version:loadedVersion,
        modules:[...(globalThis.FEHA_CYBER_CORE?.modules?.().keys?.() ?? [])],
        preflight:"passed",
        postflight:"passed"
      }
    );
  } catch (err) {
    console.error(
      "FEHA DEV LOADER failed",
      {
        error:err,
        sha:resolvedSha,
        swapped
      }
    );

    if (swapped) {
      try {
        globalThis.FEHA_TABLETOP_UI_V3?.destroy?.();
      } catch {}

      try {
        await globalThis.FEHA_CYBER_CORE?.destroy?.();
      } catch {}

      delete globalThis.FEHA_CYBERDECK_V3_ACTIVE;

      let recovered = false;

      try {
        recovered =
          globalThis.ADKDevPatch?.resumeCyberdeckV2?.() === true;
      } catch (fallbackErr) {
        console.warn(
          "FEHA DEV // V2 recovery warning",
          fallbackErr
        );
      }

      if (!recovered) {
        try {
          globalThis.ADKDevPatch?.cleanup?.();
        } catch {}

        injectedStyle?.remove?.();
      }
    }

    ui.notifications.error(
      swapped
        ? "FEHA DEV LOADER failed after swap — safe fallback attempted. Check console."
        : "FEHA DEV preflight failed — current build was kept intact. Check console."
    );
  }
})();
