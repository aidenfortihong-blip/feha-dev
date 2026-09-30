// FEHA // DO THESE WEAPON FINALIZER
// The world Item folder named "Do these" is authoritative.
// Every weapon inside its seven manufacturer subfolders is treated as finished,
// regardless of exact weapon name. This intentionally includes repaired variants
// such as "(Neon)" entries.
// IMPORTANT: this module does NOT rewrite damage, range, descriptions, notes,
// or other GM-edited mechanics. It only finalizes folder membership/market flags.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_READINESS requires FEHA_CYBER_CORE.");

  const VERSION = "4.0.0";
  const FLAG = "fleshEnshrouded";
  const REVIEW_ROOT = "Do these";
  const STOCK_KEY = "adkMarketStockV16";

  const COMPANY_BY_FOLDER = Object.freeze({
    "-Bastion":"Bastion Strategic",
    "-Corvus":"Corvus Neural",
    "-Forgeline":"ForgeLine Industries",
    "-Helix":"Helix Vitae",
    "-Jade Arc":"Jade Arc Systems",
    "-Kurohane":"Kurohane Group",
    "-Vektor":"Vektor Dynamics"
  });

  let marketObserver = null;
  let marketClickGuard = null;

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function rootFolder() {
    return (
      list(game.folders).find(folder =>
        String(folder?.type ?? "") === "Item" &&
        String(folder?.name ?? "").trim().toLowerCase() === REVIEW_ROOT.toLowerCase()
      ) ??
      null
    );
  }

  function ancestorChain(folder) {
    const chain = [];
    let current = folder;
    let guard = 0;

    while (current && guard++ < 50) {
      chain.push(current);
      current = current.folder ?? current.parent ?? null;
    }

    return chain;
  }

  function isUnder(item,root) {
    if (!item?.folder || !root) return false;

    return ancestorChain(item.folder).some(folder =>
      String(folder?.id ?? "") === String(root.id)
    );
  }

  function companyFor(item,root) {
    if (!isUnder(item,root)) return null;

    for (const folder of ancestorChain(item.folder)) {
      const company = COMPANY_BY_FOLDER[String(folder?.name ?? "")];
      if (company) return company;
      if (String(folder?.id ?? "") === String(root.id)) break;
    }

    return null;
  }

  function finishedWeapons() {
    const root = rootFolder();
    if (!root) return [];

    return list(game.items).filter(item =>
      item?.type === "weapon" &&
      Boolean(companyFor(item,root))
    );
  }

  function isDoneWeapon(item) {
    if (item?.type !== "weapon") return false;

    const root = rootFolder();

    return Boolean(
      root &&
      companyFor(item,root)
    ) || item.flags?.[FLAG]?.doTheseFinalized === true;
  }

  function finalFlags(item,company) {
    const flags = item.flags?.[FLAG] ?? {};
    const update = {};

    const values = {
      manufacturer:company,
      company,
      weaponGroup:company,
      weaponKind:"firearm",
      sourceCategory:"Weapons",
      shopType:"arms",
      curatedCatalogV10:true,
      catalogEnabled:true,
      marketReady:true,
      marketPass:"do-these-finalized-4.0",
      marketCategory:"Weapons",
      weaponReadiness:"done",
      weaponReadinessVersion:VERSION,
      needsReview:false,
      noMk:true,
      doTheseFinalized:true,
      doTheseFinalizedVersion:VERSION
    };

    for (const [key,value] of Object.entries(values)) {
      let same = false;

      try {
        same =
          JSON.stringify(flags[key] ?? null) ===
          JSON.stringify(value);
      } catch {
        same = flags[key] === value;
      }

      if (!same) {
        update["flags."+FLAG+"."+key] = value;
      }
    }

    for (const stale of [
      "mk",
      "rating",
      "tier",
      "ratingLabel",
      "marketTier"
    ]) {
      if (Object.prototype.hasOwnProperty.call(flags,stale)) {
        update["flags."+FLAG+".-="+stale] = null;
      }
    }

    return update;
  }

  async function demoteOldManaged(finishedIds) {
    const blockedIds = new Set();
    let demoted = 0;

    for (const item of list(game.items)) {
      if (item?.type !== "weapon") continue;
      if (finishedIds.has(String(item.id))) continue;

      const flags = item.flags?.[FLAG] ?? {};
      const marketPass = String(flags.marketPass ?? "");

      const managed =
        flags.marketReady === true &&
        (
          marketPass.startsWith("weapon-") ||
          marketPass.startsWith("do-these-")
        );

      if (!managed) continue;

      const patch = {
        ["flags."+FLAG+".marketReady"]:false,
        ["flags."+FLAG+".catalogEnabled"]:false,
        ["flags."+FLAG+".curatedCatalogV10"]:false,
        ["flags."+FLAG+".shopType"]:"none",
        ["flags."+FLAG+".sourceCategory"]:"Weapons_Unfinished",
        ["flags."+FLAG+".marketCategory"]:"Weapons_Unfinished",
        ["flags."+FLAG+".weaponReadiness"]:"not-done",
        ["flags."+FLAG+".doTheseFinalized"]:false
      };

      await item.update(patch);
      blockedIds.add(String(item.id));
      demoted++;
    }

    return {demoted,blockedIds};
  }

  async function cleanMarketStock(blockedIds) {
    if (!blockedIds?.size) return 0;

    const fullKey = "world."+STOCK_KEY;
    if (!game.settings?.settings?.has?.(fullKey)) return 0;

    const current =
      globalThis.foundry?.utils?.deepClone?.(
        game.settings.get("world",STOCK_KEY) ?? {}
      ) ??
      {};

    let removed = 0;
    let changed = false;

    for (const [key,ids] of Object.entries(current)) {
      if (!Array.isArray(ids)) continue;

      const next = ids.filter(id => {
        const blocked = blockedIds.has(String(id));
        if (blocked) removed++;
        return !blocked;
      });

      if (next.length !== ids.length) {
        current[key] = next;
        changed = true;
      }
    }

    if (changed) {
      await game.settings.set("world",STOCK_KEY,current);
    }

    return removed;
  }

  function marketEligible(item) {
    if (!item || item.type !== "weapon") return true;
    return item.flags?.[FLAG]?.marketReady === true;
  }

  function guardMarketDom() {
    const root = document.getElementById("adk-market-15");
    if (!root) return;

    for (const node of root.querySelectorAll("[data-buy-item],[data-open-item]")) {
      const card = node.closest(".item-card");
      const id = String(
        node?.dataset?.buyItem ??
        node?.dataset?.openItem ??
        ""
      );
      const item = game.items?.get?.(id) ?? null;

      if (
        card &&
        item?.type === "weapon" &&
        !marketEligible(item)
      ) {
        card.remove();
      }
    }
  }

  function installMarketGuard() {
    if (marketObserver || marketClickGuard) return;

    marketClickGuard = event => {
      const node =
        event.target?.closest?.(
          "#adk-market-15 [data-buy-item]," +
          "#adk-market-15 [data-open-item]"
        ) ??
        null;

      if (!node) return;

      const id = String(
        node?.dataset?.buyItem ??
        node?.dataset?.openItem ??
        ""
      );
      const item = game.items?.get?.(id) ?? null;

      if (
        item?.type !== "weapon" ||
        marketEligible(item)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      ui.notifications?.warn?.(
        "That weapon is outside the finalized Do these set."
      );
    };

    document.addEventListener(
      "click",
      marketClickGuard,
      true
    );

    marketObserver =
      new MutationObserver(() => {
        queueMicrotask(guardMarketDom);
      });

    marketObserver.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    guardMarketDom();
  }

  function removeMarketGuard() {
    try {
      marketObserver?.disconnect?.();
    } catch {}

    marketObserver = null;

    if (marketClickGuard) {
      document.removeEventListener(
        "click",
        marketClickGuard,
        true
      );
    }

    marketClickGuard = null;
  }

  async function migrate() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        finished:finishedWeapons().length,
        updated:0,
        demoted:0,
        staleStockRemoved:0
      };
    }

    const root = rootFolder();

    if (!root) {
      throw new Error(
        "FEHA Weapon Finalizer could not find the Item folder named '" +
        REVIEW_ROOT +
        "'."
      );
    }

    const finished = finishedWeapons();
    const finishedIds =
      new Set(
        finished.map(item => String(item.id))
      );

    let updated = 0;

    for (const item of finished) {
      const company = companyFor(item,root);
      if (!company) continue;

      const patch = finalFlags(item,company);

      if (!Object.keys(patch).length) continue;

      try {
        await item.update(patch);
        updated++;
      } catch (error) {
        console.warn(
          "FEHA DO THESE // flag finalization failed",
          item?.name,
          item?.id,
          error
        );
      }
    }

    const demotion =
      await demoteOldManaged(finishedIds);

    const staleStockRemoved =
      await cleanMarketStock(demotion.blockedIds);

    try {
      const reroll =
        document.querySelector(
          "#adk-market-15 #reroll-stock"
        );

      if (reroll) {
        reroll.click();
      } else {
        globalThis.ADKMarket?.refresh?.();
      }
    } catch {}

    guardMarketDom();

    const result = {
      skipped:false,
      finished:finished.length,
      updated,
      demoted:demotion.demoted,
      staleStockRemoved,
      byCompany:Object.fromEntries(
        Object.values(COMPANY_BY_FOLDER).map(company => [
          company,
          finished.filter(
            item => companyFor(item,root) === company
          ).length
        ])
      )
    };

    console.log(
      "FEHA DO THESE WEAPON FINALIZER",
      VERSION,
      result
    );

    ui.notifications?.info?.(
      "FEHA guns finalized from Do these: " +
      finished.length +
      " weapons."
    );

    return result;
  }

  const api = {
    version:VERSION,

    get doneNames() {
      return finishedWeapons()
        .map(item => String(item?.name ?? "").trim())
        .filter(Boolean);
    },

    isDoneWeapon,
    migrate,

    async init() {
      globalThis.FEHA_WEAPON_READINESS = api;
      game.adk ??= {};
      game.adk.weaponReadiness = api;

      installMarketGuard();

      if (game.user?.isGM) {
        await migrate();
      }
    },

    async destroy() {
      removeMarketGuard();

      if (game?.adk?.weaponReadiness === api) {
        delete game.adk.weaponReadiness;
      }

      if (globalThis.FEHA_WEAPON_READINESS === api) {
        delete globalThis.FEHA_WEAPON_READINESS;
      }
    }
  };

  core.registerModule("weaponReadiness",api);
  globalThis.FEHA_WEAPON_READINESS = api;
})();
