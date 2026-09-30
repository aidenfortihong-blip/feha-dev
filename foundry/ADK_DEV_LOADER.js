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
    grenades:"foundry/FEHA_GRENADE_CATALOG.js",
    consumables:"foundry/FEHA_CONSUMABLE_CATALOG.js",
    armor:"foundry/FEHA_ARMOR_CATALOG.js",
    weapons:"foundry/FEHA_WEAPON_CATALOG.js",
    melee:"foundry/FEHA_MELEE_CATALOG.js",
    uniqueWeapons:"foundry/FEHA_UNIQUE_WEAPON_CATALOG.js",
    weaponEconomy:"foundry/FEHA_WEAPON_ECONOMY.js",
    grenadeRuntime:"foundry/FEHA_GRENADE_RUNTIME.js",
    core:"foundry/cyberdeck/FEHA_CYBER_CORE.js",
    modRetirement:"foundry/FEHA_MOD_RETIREMENT.js",
    specialRetirement:"foundry/FEHA_SPECIAL_RETIREMENT.js",
    armorRuntime:"foundry/FEHA_ARMOR_RUNTIME.js",
    lumenRetirement:"foundry/FEHA_LUMEN_RETIREMENT.js",
    derkeImport:"foundry/FEHA_DERKE_IMPORT.js",
    weaponReadiness:"foundry/FEHA_WEAPON_READINESS.js",
    weaponRuntime:"foundry/FEHA_WEAPON_RUNTIME.js",
    weaponTracker:"foundry/FEHA_RELOAD_TRACKER.js",
    worldHygiene:"foundry/FEHA_WORLD_HYGIENE.js",
    marketStockPatch:"foundry/FEHA_MARKET_STOCK_PATCH.js",
    quickhacks:"foundry/cyberdeck/FEHA_QUICKHACK_CATALOG.js",
    quickhackAuthority:"foundry/cyberdeck/FEHA_QUICKHACK_AUTHORITY.js",
    quickhackRuntime:"foundry/cyberdeck/FEHA_QUICKHACK_RUNTIME.js",
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

  // A reload used to throw a stack of startup info toasts from every module.
  // Keep warnings/errors visible, but collapse normal loader chatter into the
  // console and show one final success toast.
  const originalInfoToast =
    ui?.notifications?.info ?? null;
  let infoToastsMuted = false;

  const muteInfoToasts = () => {
    if (!isGM || !ui?.notifications || !originalInfoToast || infoToastsMuted) return;
    try {
      ui.notifications.info = (...args) => {
        console.info("FEHA DEV // suppressed startup toast",...args);
        return null;
      };
      infoToastsMuted = true;
    } catch {}
  };

  const restoreInfoToasts = () => {
    if (!infoToastsMuted || !ui?.notifications || !originalInfoToast) return;
    try { ui.notifications.info = originalInfoToast; } catch {}
    infoToastsMuted = false;
  };

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
    muteInfoToasts();
    console.info(
      isGM
        ? "FEHA DEV // resolving latest modular build..."
        : "FEHA DEV // resolving latest modular build for player client..."
    );

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
      "baseJs","grenades","consumables","armor","weapons","melee","uniqueWeapons","weaponEconomy","core","modRetirement","specialRetirement","armorRuntime","lumenRetirement","derkeImport","weaponReadiness","weaponRuntime","weaponTracker","worldHygiene","marketStockPatch","grenadeRuntime","quickhacks","quickhackAuthority","quickhackRuntime","devices","actions","approvals","cameras","sync","v3"
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
    evaluate(source.grenades,files.grenades,sha);
    evaluate(source.consumables,files.consumables,sha);
    evaluate(source.armor,files.armor,sha);
    evaluate(source.weapons,files.weapons,sha);
    evaluate(source.melee,files.melee,sha);
    evaluate(source.uniqueWeapons,files.uniqueWeapons,sha);
    evaluate(source.weaponEconomy,files.weaponEconomy,sha);
    evaluate(source.core,files.core,sha);
    evaluate(source.modRetirement,files.modRetirement,sha);
    evaluate(source.specialRetirement,files.specialRetirement,sha);
    evaluate(source.armorRuntime,files.armorRuntime,sha);
    evaluate(source.lumenRetirement,files.lumenRetirement,sha);
    evaluate(source.derkeImport,files.derkeImport,sha);
    evaluate(source.weaponReadiness,files.weaponReadiness,sha);
    evaluate(source.weaponRuntime,files.weaponRuntime,sha);
    evaluate(source.weaponTracker,files.weaponTracker,sha);
    evaluate(source.worldHygiene,files.worldHygiene,sha);
    evaluate(source.marketStockPatch,files.marketStockPatch,sha);
    evaluate(source.grenadeRuntime,files.grenadeRuntime,sha);
    evaluate(source.quickhacks,files.quickhacks,sha);
    evaluate(source.quickhackAuthority,files.quickhackAuthority,sha);
    evaluate(source.quickhackRuntime,files.quickhackRuntime,sha);
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
      const qhAuthorityVersion =
        String(qhAuthorityModule.version ?? "UNKNOWN");

      console.info(
        "FEHA DEV // QUICKHACK AUTHORITY // LOADED // v" +
        qhAuthorityVersion
      );

      ui?.notifications?.info?.(
        "FEHA // QUICKHACK AUTHORITY ONLINE // v" +
        qhAuthorityVersion
      );
    }

    const requiredModules = [
      "modRetirement",
      "specialRetirement",
      "armorRuntime",
      "lumenRetirement",
      "derkeImport",
      "weaponReadiness",
      "weaponRuntime",
      "weaponTracker",
      "worldHygiene",
      "marketStockPatch",
      "grenadeRuntime",
      "quickhacks",
      "quickhackAuthority",
      "quickhackRuntime",
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

    // Cross-module contract checks. These intentionally fail the hot reload
    // before V3 opens if Grenades / Quickhacks are only partially connected.
    const grenadeCatalog =
      globalThis.FEHA_GRENADE_CATALOG ??
      game.adk?.grenades ??
      null;

    const consumableCatalog =
      globalThis.FEHA_CONSUMABLE_CATALOG ??
      game.adk?.consumables ??
      null;

    const armorCatalog =
      globalThis.FEHA_ARMOR_CATALOG ??
      game.adk?.armor ??
      null;

    const weaponCatalog =
      globalThis.FEHA_WEAPON_CATALOG ??
      game.adk?.weapons ??
      null;

    const meleeCatalog =
      globalThis.FEHA_MELEE_CATALOG ??
      game.adk?.melee ??
      null;

    const uniqueWeaponCatalog =
      globalThis.FEHA_UNIQUE_WEAPON_CATALOG ??
      game.adk?.uniqueWeapons ??
      null;

    const weaponEconomy =
      globalThis.FEHA_WEAPON_ECONOMY ??
      game.adk?.weaponEconomy ??
      null;

    const armorRuntime =
      globalThis.FEHA_ARMOR_RUNTIME ??
      globalThis.FEHA_CYBER_CORE?.module?.("armorRuntime") ??
      null;

    const derkeImport =
      globalThis.FEHA_DERKE_IMPORT ??
      globalThis.FEHA_CYBER_CORE?.module?.("derkeImport") ??
      null;

    const weaponReadiness =
      globalThis.FEHA_WEAPON_READINESS ??
      globalThis.FEHA_CYBER_CORE?.module?.("weaponReadiness") ??
      null;

    const weaponRuntime =
      globalThis.FEHA_WEAPON_RUNTIME ??
      globalThis.FEHA_CYBER_CORE?.module?.("weaponRuntime") ??
      null;

    const weaponTracker =
      globalThis.FEHA_WEAPON_TRACKER ??
      globalThis.FEHA_RELOAD_TRACKER ??
      globalThis.FEHA_CYBER_CORE?.module?.("weaponTracker") ??
      null;

    const worldHygiene =
      globalThis.FEHA_WORLD_HYGIENE ??
      globalThis.FEHA_CYBER_CORE?.module?.("worldHygiene") ??
      null;

    const marketStockPatch =
      globalThis.FEHA_MARKET_STOCK_PATCH ??
      globalThis.FEHA_CYBER_CORE?.module?.("marketStockPatch") ??
      null;

    const grenadeRuntime =
      globalThis.FEHA_GRENADE_RUNTIME ??
      globalThis.FEHA_CYBER_CORE?.module?.("grenadeRuntime") ??
      null;

    const quickhackCatalog =
      globalThis.FEHA_QUICKHACK_CATALOG ??
      globalThis.FEHA_CYBER_CORE?.module?.("quickhacks") ??
      null;

    const quickhackRuntime =
      globalThis.FEHA_QUICKHACK_RUNTIME ??
      globalThis.FEHA_CYBER_CORE?.module?.("quickhackRuntime") ??
      null;

    const quickhackAuthority =
      globalThis.FEHA_QUICKHACK_AUTHORITY ??
      globalThis.FEHA_CYBER_CORE?.module?.("quickhackAuthority") ??
      null;

    const requireMethods = (label,object,names) => {
      if (!object) {
        throw new Error(label+" is unavailable.");
      }

      const missing = names.filter(
        name => typeof object?.[name] !== "function"
      );

      if (missing.length) {
        throw new Error(
          label+" contract missing: "+missing.join(", ")
        );
      }
    };

    requireMethods(
      "Grenade Catalog",
      grenadeCatalog,
      ["list","definition","schema","migrateAll"]
    );

    requireMethods(
      "Consumable Catalog",
      consumableCatalog,
      ["list","definition","migrateAll","rewriteDescription"]
    );

    requireMethods(
      "Armor Catalog",
      armorCatalog,
      ["list","definition","migrateAll","rewriteDescription"]
    );

    requireMethods(
      "Weapon Catalog",
      weaponCatalog,
      [
        "list","definition","migrateAll","rewriteDescription",
        "legacyAttackStub","canonicalAttackUpdate"
      ]
    );

    requireMethods(
      "Melee Catalog",
      meleeCatalog,
      ["list","definition","migrateAll","rewriteDescription"]
    );

    requireMethods(
      "Unique Weapon Catalog",
      uniqueWeaponCatalog,
      ["list","definition","migrateAll","rewriteDescription"]
    );

    requireMethods(
      "Weapon Economy",
      weaponEconomy,
      ["powerRating","profile","migrateAll"]
    );

    requireMethods(
      "Armor Runtime",
      armorRuntime,
      [
        "equippedDefinition",
        "quickhackSaveBonus",
        "empSaveAdvantage",
        "empImmune",
        "grenadeImmune",
        "helixSpeedBonus",
        "forgeLineAcBonus",
        "forgeLineRangedAcBonus",
        "bastionFirearmDr",
        "bastionBulletProfile",
        "adjustDamage"
      ]
    );

    requireMethods(
      "Derke Import",
      derkeImport,
      ["findDerke","buildDerke","importDerke"]
    );

    requireMethods(
      "Weapon Readiness",
      weaponReadiness,
      ["isDoneWeapon","migrate"]
    );

    requireMethods(
      "Weapon Runtime",
      weaponRuntime,
      [
        "status",
        "diagnostics",
        "enableDiagnostics",
        "disableDiagnostics",
        "features",
        "enable",
        "disable",
        "disableAll",
        "destroy"
      ]
    );

    requireMethods(
      "Weapon Tracker",
      weaponTracker,
      [
        "capacity",
        "reloadPoints",
        "state",
        "primaryAttack",
        "useAttack",
        "rollDamage",
        "rememberAttackContext",
        "cleanupLegacyState",
        "recordShot",
        "undoShot",
        "addReload",
        "reset",
        "equippedFirearms",
        "open"
      ]
    );

    requireMethods(
      "World Hygiene",
      worldHygiene,
      [
        "scan",
        "runFullPass",
        "cleanupLegacyWeaponActivities",
        "deleteActivityFromItem",
        "attackCleanupPlan",
        "identifierIssues",
        "hideLegacyActivityRows"
      ]
    );

    if (
      !Array.isArray(weaponReadiness.doneNames) ||
      weaponReadiness.doneNames.length < 1
    ) {
      throw new Error(
        "Weapon Readiness found no finalized guns in the Do these folders."
      );
    }

    requireMethods(
      "Market Stock Patch",
      marketStockPatch,
      ["patchMarketMacro"]
    );

    requireMethods(
      "Grenade Runtime",
      grenadeRuntime,
      [
        "isGrenade",
        "use",
        "detonateCookoff",
        "assertBonusActionAvailable",
        "markBonusActionUsed"
      ]
    );

    requireMethods(
      "Quickhack Catalog",
      quickhackCatalog,
      ["list","definition","ramCost","migrateAll"]
    );

    requireMethods(
      "Quickhack Runtime",
      quickhackRuntime,
      ["handles","requiresTarget","prepare","execute","markTurnUsed"]
    );

    requireMethods(
      "Quickhack Authority",
      quickhackAuthority,
      [
        "listTargetItems",
        "applyStatus",
        "damageRoll",
        "areaDamage",
        "combustion",
        "useExplosive"
      ]
    );

    const grenadeDefs =
      grenadeCatalog.list?.() ?? [];

    const consumableDefs =
      consumableCatalog.list?.() ?? [];

    const armorDefs =
      armorCatalog.list?.() ?? [];

    const weaponDefs =
      weaponCatalog.list?.() ?? [];

    const meleeDefs =
      meleeCatalog.list?.() ?? [];

    const uniqueWeaponDefs =
      uniqueWeaponCatalog.list?.() ?? [];

    const quickhackDefs =
      quickhackCatalog.list?.() ?? [];

    if (grenadeDefs.length !== 18) {
      throw new Error(
        "Grenade integration expected 18 canonical grenades but found "+
        grenadeDefs.length+"."
      );
    }

    if (consumableDefs.length !== 24) {
      throw new Error(
        "Consumable integration expected 24 canonical products but found "+
        consumableDefs.length+"."
      );
    }

    if (armorDefs.length !== 35) {
      throw new Error(
        "Armor integration expected 35 canonical pieces after Lumen retirement but found "+
        armorDefs.length+"."
      );
    }

    if (weaponDefs.length !== 78) {
      throw new Error(
        "Weapon integration expected exactly 78 canonical firearms but found "+
        weaponDefs.length+"."
      );
    }

    if (weaponReadiness.doneNames.length !== 78) {
      throw new Error(
        "Weapon readiness expected exactly 78 finalized Do these guns but found "+
        weaponReadiness.doneNames.length+"."
      );
    }

    if (weaponDefs.length !== weaponReadiness.doneNames.length) {
      throw new Error(
        "Weapon integration expected the permanent catalog to match the Do these set ("+
        weaponReadiness.doneNames.length+") but found "+
        weaponDefs.length+"."
      );
    }

    if (meleeDefs.length !== 33) {
      throw new Error(
        "Melee integration expected 33 balanced weapons but found "+
        meleeDefs.length+"."
      );
    }

    if (uniqueWeaponDefs.length !== 7) {
      throw new Error(
        "Unique Weapon integration expected 7 one-off weapons but found "+
        uniqueWeaponDefs.length+"."
      );
    }

    if (quickhackDefs.length !== 20) {
      throw new Error(
        "Quickhack integration expected 20 canonical Quickhacks but found "+
        quickhackDefs.length+"."
      );
    }

    if (
      !quickhackDefs.some(def => def?.key === "cookoff") ||
      !grenadeDefs.some(def => def?.key === "frag-regular")
    ) {
      throw new Error(
        "Grenade / Quickhack bridge identities failed postflight."
      );
    }

    const observerFeatures =
      weaponRuntime.features?.() ?? {};

    const unsafeObserverFeatures =
      Object.entries(observerFeatures).filter(([,feature]) =>
        feature?.implemented === true ||
        feature?.enabled === true
      );

    if (unsafeObserverFeatures.length) {
      throw new Error(
        "Weapon Runtime observer safety failed; gameplay feature(s) unexpectedly active: "+
        unsafeObserverFeatures.map(([name]) => name).join(", ")
      );
    }

    const observerStatus =
      weaponRuntime.status?.() ?? {};

    if (observerStatus.observerOnly !== true) {
      throw new Error(
        "Weapon Runtime expected observerOnly=true in the clean baseline."
      );
    }

    console.info(
      "FEHA DEV // ITEM CONTRACTS // OK // "+
      grenadeDefs.length+" grenades // "+
      consumableDefs.length+" consumables // "+
      armorDefs.length+" armor // "+
      weaponDefs.length+" weapons // "+
      meleeDefs.length+" melee // "+
      uniqueWeaponDefs.length+" unique weapons // "+
      quickhackDefs.length+" quickhacks"
    );

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

    // Run final canonical item migrations after the entire build is installed.
    // This prevents legacy world-item descriptions/effects from surviving an
    // otherwise successful hot reload.
    if (isGM) {
      const grenadeMigration =
        await globalThis.FEHA_GRENADE_CATALOG?.migrateAll?.();

      if (grenadeMigration) {
        console.info(
          "FEHA DEV // GRENADE CATALOG CANONICALIZED",
          grenadeMigration
        );
      }

      const consumableMigration =
        await globalThis.FEHA_CONSUMABLE_CATALOG?.migrateAll?.();

      if (consumableMigration) {
        console.info(
          "FEHA DEV // CONSUMABLE CATALOG CANONICALIZED",
          consumableMigration
        );
      }

      const armorMigration =
        await globalThis.FEHA_ARMOR_CATALOG?.migrateAll?.();

      if (armorMigration) {
        console.info(
          "FEHA DEV // ARMOR CATALOG CANONICALIZED",
          armorMigration
        );
      }

      const weaponMigration =
        await globalThis.FEHA_WEAPON_CATALOG?.migrateAll?.();

      if (weaponMigration) {
        console.info(
          "FEHA DEV // WEAPON CATALOG CANONICALIZED",
          weaponMigration
        );
      }

      const meleeMigration =
        await globalThis.FEHA_MELEE_CATALOG?.migrateAll?.();

      if (meleeMigration) {
        console.info(
          "FEHA DEV // MELEE CATALOG CANONICALIZED",
          meleeMigration
        );
      }

      const quickhackMigration =
        await globalThis.FEHA_QUICKHACK_CATALOG?.migrateAll?.();

      if (quickhackMigration) {
        console.info(
          "FEHA DEV // QUICKHACK CATALOG CANONICALIZED",
          quickhackMigration
        );
      }

      // Run uniques after Quickhacks so one-off weapon identity always wins
      // for deliberate shared names such as Motor Lock and Optic Zero.
      const uniqueWeaponMigration =
        await globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.migrateAll?.();

      if (uniqueWeaponMigration) {
        console.info(
          "FEHA DEV // UNIQUE WEAPON CATALOG CANONICALIZED",
          uniqueWeaponMigration
        );
      }

      const weaponEconomyMigration =
        await globalThis.FEHA_WEAPON_ECONOMY?.migrateAll?.();

      if (weaponEconomyMigration) {
        console.info(
          "FEHA DEV // WEAPON ECONOMY PRICED",
          weaponEconomyMigration
        );
      }

      // Final visual sweep. Older FEHA copies can live outside the current
      // curated folders, so category migrations may intentionally skip them.
      // If an item still contains one of our old FEHA card wrappers, rewrite
      // ONLY its description using the matching canonical catalog. This is
      // deliberately description-only: it cannot move folders, alter stats,
      // inventory, ownership, or combat data.
      const staleCardSweep = {
        world:0,
        owned:0,
        failed:0
      };

      const repairStaleCard = async item => {
        if (!item?.system?.description) return false;

        // Foundry <=14.367 can reject a weapon update when any nested
        // persisted identifier in the dnd5e system tree is blank/invalid.
        // Skip only those malformed weapons until 14.368+ fixes _updateDiff.
        if (item?.type === "weapon") {
          const build = Number(game.release?.build ?? 0);
          if (!build || build < 368) {
            const root = item?._source?.system;
            const stack = root && typeof root === "object" ? [root] : [];
            let invalidIdentifier = false;

            while (stack.length && !invalidIdentifier) {
              const current = stack.pop();
              if (!current || typeof current !== "object") continue;

              for (const [key,value] of Object.entries(current)) {
                if (
                  key === "identifier" &&
                  !/^[a-z0-9_-]+$/i.test(String(value ?? ""))
                ) {
                  invalidIdentifier = true;
                  break;
                }
                if (value && typeof value === "object") stack.push(value);
              }
            }

            if (invalidIdentifier) return false;
          }
        }

        const html =
          String(item.system.description.value ?? "");

        if (!html) {
          return false;
        }

        const staleReviewWrapper =
          /FINAL GUN|REVIEW STATUS|GM REVIEW NOTES|Final reviewed values synced|GUN REVIEW/i.test(html);

        // A stale card can already carry the unified-shell marker if an older
        // partial rewrite wrapped legacy inner HTML. Never trust the marker
        // alone; explicit legacy review text always wins and forces repair.
        if (
          html.includes('data-feha-ui="item-card-v1"') &&
          !staleReviewWrapper
        ) {
          return false;
        }

        let catalog = null;
        let def = null;
        let next = null;

        const forceGunNames = new Set([
          "Osprey Prototype",
          "Iron Psalm",
          "Hercules Prototype",
          "Long Vigil",
          "Razor Choir",
          "Twin Viper",
          "Rasetsu Prototype",
          "Black Requiem",
          "Monarch Zero",
          "Pale Kestrel",
          "Red Wisp"
        ]);

        try {
          if (forceGunNames.has(String(item.name ?? ""))) {
            catalog = globalThis.FEHA_WEAPON_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def);
          } else 
          if (
            /data-feha-unique-weapon-card=/i.test(html)
          ) {
            catalog = globalThis.FEHA_UNIQUE_WEAPON_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def);
          } else if (
            /data-feha-melee-card=/i.test(html)
          ) {
            catalog = globalThis.FEHA_MELEE_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def);
          } else if (
            /data-feha-weapon-card=|FINAL GUN|REVIEW STATUS|GM REVIEW NOTES/i.test(html)
          ) {
            catalog = globalThis.FEHA_WEAPON_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def);
          } else if (
            /data-feha-armor-card=/i.test(html)
          ) {
            catalog = globalThis.FEHA_ARMOR_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def);
          } else if (
            /data-feha-grenade-card=/i.test(html)
          ) {
            catalog = globalThis.FEHA_GRENADE_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def,item);
          } else if (
            /data-feha-consumable-card=/i.test(html)
          ) {
            catalog = globalThis.FEHA_CONSUMABLE_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) next = catalog.rewriteDescription(def);
          } else if (
            /data-feha-qh-card=/i.test(html)
          ) {
            catalog = globalThis.FEHA_QUICKHACK_CATALOG;
            def = catalog?.definition?.(item) ?? null;
            if (def) {
              next = catalog.rewriteDescription(
                html,
                def,
                item
              );
            }
          }

          if (
            !def ||
            !next ||
            String(next) === html
          ) {
            return false;
          }

          await item.update({
            "system.description.value":String(next)
          });

          return true;
        } catch (error) {
          staleCardSweep.failed++;
          console.warn(
            "FEHA DEV // STALE ITEM CARD REPAIR FAILED",
            item?.name,
            item?.uuid ?? item?.id,
            error
          );
          return false;
        }
      };

      for (const item of game.items?.contents ?? []) {
        if (await repairStaleCard(item)) {
          staleCardSweep.world++;
        }
      }

      for (const actor of game.actors?.contents ?? []) {
        for (const item of actor.items?.contents ?? []) {
          if (await repairStaleCard(item)) {
            staleCardSweep.owned++;
          }
        }
      }

      console.info(
        "FEHA DEV // UNIFIED ITEM CARD SWEEP",
        staleCardSweep
      );

      const hygienePass =
        await worldHygiene.runFullPass({
          cleanup:true,
          notify:true
        });

      console.info(
        "FEHA DEV // WORLD HYGIENE PASS",
        hygienePass
      );

      const hygieneSummary =
        hygienePass?.after ??
        hygienePass?.report?.summary ??
        {};

      if (Number(hygieneSummary.canonicalFirearmMultiAttackItems ?? 0) > 0) {
        console.warn(
          "FEHA DEV // canonical firearms still contain multiple attack activities",
          hygienePass?.report?.canonicalFirearmMultiAttack ?? []
        );

        ui.notifications?.warn?.(
          "FEHA cleanup: "+
          Number(hygieneSummary.canonicalFirearmMultiAttackItems ?? 0)+
          " canonical firearm copy/copies still have multiple stored attacks. "+
          "Legacy rows are hidden; check the hygiene report for quarantined or ambiguous items."
        );
      }

      if (Number(hygieneSummary.runtimeTracerGlobals ?? 0) > 0) {
        console.warn(
          "FEHA DEV // stale diagnostic globals remain from an earlier session",
          hygienePass?.report?.runtimeHealth?.temporaryTracerGlobals ?? []
        );
      }

      // Hot-reload visibility pass: Foundry can keep already-open item sheets
      // rendered from their old HTML even after the underlying document updates.
      // Force every currently-open document sheet/app to redraw so catalog
      // migrations are visible immediately without a browser refresh.
      const refreshApps = new Set();

      try {
        for (const app of Object.values(ui?.windows ?? {})) {
          if (app) refreshApps.add(app);
        }
      } catch {}

      try {
        for (const app of globalThis.foundry?.applications?.instances ?? []) {
          if (app) refreshApps.add(app);
        }
      } catch {}

      for (const app of refreshApps) {
        try {
          const document =
            app?.document ??
            app?.object ??
            app?.item ??
            null;

          const isQuickhack =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_QUICKHACK_CATALOG?.definition?.(document)
            );

          const isGrenade =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_GRENADE_CATALOG?.definition?.(document)
            );

          const isConsumable =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_CONSUMABLE_CATALOG?.definition?.(document)
            );

          const isArmor =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_ARMOR_CATALOG?.definition?.(document)
            );

          const isWeapon =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_WEAPON_CATALOG?.definition?.(document)
            );

          const isMelee =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_MELEE_CATALOG?.definition?.(document)
            );

          const isUniqueWeapon =
            document?.documentName === "Item" &&
            Boolean(
              globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.definition?.(document)
            );

          if (
            isQuickhack ||
            isGrenade ||
            isConsumable ||
            isArmor ||
            isWeapon ||
            isMelee ||
            isUniqueWeapon ||
            app?.rendered === true
          ) {
            await Promise.resolve(app.render?.(true));
          }
        } catch (refreshError) {
          console.debug(
            "FEHA DEV // hot sheet refresh skipped",
            refreshError
          );
        }
      }

      // Refresh the Items sidebar too. A normal ADK hot reload should never
      // require a browser/page reload just to see migrated item changes.
      try { await Promise.resolve(ui?.items?.render?.(true)); } catch {}
      try { await Promise.resolve(ui?.sidebar?.tabs?.items?.render?.(true)); } catch {}

      try {
        const visibleActorId =
          document.getElementById("feha-jackin-overlay")?.dataset?.actorId ??
          document.getElementById("feha-cyberdeck-v2")?.dataset?.actorId ??
          null;

        if (visibleActorId) {
          globalThis.FEHA_TABLETOP_UI_V3?.render?.(visibleActorId);
        }
      } catch {}
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

    restoreInfoToasts();

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
    restoreInfoToasts();
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
