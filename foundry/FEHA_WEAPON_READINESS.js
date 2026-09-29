// FEHA // WEAPON READINESS
// Keeps unfinished/variant weapons out of the Market and organizes every
// manufacturer folder into DONE / NOT DONE.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_READINESS requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const ROOT_NAME = "01 — WEAPONS";
  const DONE_NAME = "DONE";
  const NOT_DONE_NAME = "NOT DONE";
  const STOCK_KEY = "adkMarketStockV16";
  let marketObserver = null;
  let marketClickGuard = null;

  // Canonical finished weapons approved for the Market.
  // Exact normalized names only: variants/suffixed editions remain NOT DONE.
  const DONE_WEAPONS = new Set([
    "breachhound",
    "crusher",
    "hexburst",
    "igla",
    "lexington",
    "liberty",
    "overture",
    "saratoga",
    "tactician",
    "umbra",
    "unity",
    "warwake",
    "ashura",
    "dian",
    "kyokokukamusari",
    "masamune"
  ]);

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  function folderParentId(folder) {
    return String(
      folder?.folder?.id ??
      folder?.folder ??
      folder?.parent?.id ??
      ""
    );
  }

  function rootFolder() {
    return (
      list(game.folders)
        .filter(folder =>
          String(folder?.type ?? "") === "Item" &&
          String(folder?.name ?? "") === ROOT_NAME
        )
        .sort((a,b) => {
          const ap = String(a?.folder?.name ?? "");
          const bp = String(b?.folder?.name ?? "");
          const aCurated = ap === "ADK V10 — CURATED CATALOG" ? 0 : 1;
          const bCurated = bp === "ADK V10 — CURATED CATALOG" ? 0 : 1;
          return aCurated - bCurated;
        })[0] ??
      null
    );
  }

  function manufacturerFolders(root) {
    if (!root) return [];

    return list(game.folders).filter(folder =>
      String(folder?.type ?? "") === "Item" &&
      folderParentId(folder) === String(root.id) &&
      ![DONE_NAME,NOT_DONE_NAME].includes(
        String(folder?.name ?? "").toUpperCase()
      )
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

  function companyFolderForItem(item,root,companies) {
    if (!item?.folder || !root) return null;

    const chain = ancestorChain(item.folder);
    const found = chain.find(folder =>
      companies.some(company =>
        String(company.id) === String(folder.id)
      )
    );

    return found ?? null;
  }

  function isWeaponInRoot(item,root,companies) {
    if (!item || item.documentName !== "Item") return false;
    if (item.type !== "weapon") return false;

    const company = companyFolderForItem(item,root,companies);
    if (company) return true;

    const flags = item.flags?.[FLAG] ?? {};
    const category = norm(flags.sourceCategory ?? flags.category);

    return (
      category === "weapons" &&
      ancestorChain(item.folder).some(folder =>
        String(folder.id) === String(root?.id)
      )
    );
  }

  function isDoneWeapon(item) {
    return Boolean(
      globalThis.FEHA_WEAPON_CATALOG?.definition?.(item)
    ) || DONE_WEAPONS.has(norm(item?.name));
  }

  async function ensureStatusFolder(company,name) {
    let folder =
      list(game.folders).find(candidate =>
        String(candidate?.type ?? "") === "Item" &&
        String(candidate?.name ?? "").toUpperCase() === name &&
        folderParentId(candidate) === String(company.id)
      ) ??
      null;

    if (!folder) {
      folder = await globalThis.Folder.create({
        name,
        type:"Item",
        folder:company.id,
        sorting:"a"
      });
    }

    return folder;
  }

  async function ensureFolders(root) {
    const companies = manufacturerFolders(root);
    const status = new Map();

    for (const company of companies) {
      const done = await ensureStatusFolder(company,DONE_NAME);
      const notDone = await ensureStatusFolder(company,NOT_DONE_NAME);

      status.set(String(company.id),{
        company,
        done,
        notDone
      });
    }

    return {companies,status};
  }

  function marketUpdates(item,done) {
    const flags = item.flags?.[FLAG] ?? {};
    const updates = {};
    const values = done
      ? {
          sourceCategory:"Weapons",
          catalogEnabled:true,
          curatedCatalogV10:true,
          marketReady:true,
          marketPass:"weapon-readiness-1.0",
          marketCategory:"Weapons",
          weaponReadiness:"done",
          weaponReadinessVersion:VERSION,
          shopType:"arms"
        }
      : {
          sourceCategory:"Weapons_Unfinished",
          catalogEnabled:false,
          curatedCatalogV10:false,
          marketReady:false,
          marketPass:"weapon-readiness-1.0",
          marketCategory:"Weapons_Unfinished",
          weaponReadiness:"not-done",
          weaponReadinessVersion:VERSION,
          shopType:"none"
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
        updates["flags."+FLAG+"."+key] = value;
      }
    }

    return updates;
  }

  async function cleanMarketStock(blockedIds) {
    if (!blockedIds.size) return 0;

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

  function itemIdFromMarketNode(node) {
    return String(
      node?.dataset?.buyItem ??
      node?.dataset?.openItem ??
      ""
    );
  }

  function guardMarketDom() {
    const root =
      document.getElementById("adk-market-15");

    if (!root) return;

    const cards =
      new Set(
        [
          ...root.querySelectorAll("[data-buy-item]"),
          ...root.querySelectorAll("[data-open-item]")
        ]
          .map(node => node.closest(".item-card"))
          .filter(Boolean)
      );

    for (const card of cards) {
      const node =
        card.querySelector("[data-buy-item]") ??
        card.querySelector("[data-open-item]");

      const id = itemIdFromMarketNode(node);
      const item = game.items?.get?.(id) ?? null;

      if (
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
          "#adk-market-15 [data-buy-item],"+
          "#adk-market-15 [data-open-item]"
        ) ??
        null;

      if (!node) return;

      const item =
        game.items?.get?.(
          itemIdFromMarketNode(node)
        ) ??
        null;

      if (
        item?.type !== "weapon" ||
        marketEligible(item)
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      ui.notifications?.warn?.(
        "That weapon is still marked NOT DONE and is unavailable in the Market."
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
        done:0,
        notDone:0,
        foldersCreated:0,
        staleStockRemoved:0
      };
    }

    const root = rootFolder();

    if (!root) {
      throw new Error(
        "FEHA Weapon Readiness could not find the '"+ROOT_NAME+"' Item folder."
      );
    }

    const beforeFolderIds =
      new Set(
        list(game.folders).map(folder => String(folder.id))
      );

    const {companies,status} = await ensureFolders(root);

    let doneCount = 0;
    let notDoneCount = 0;
    let moved = 0;
    let updated = 0;
    const blockedIds = new Set();

    for (const item of list(game.items)) {
      if (!isWeaponInRoot(item,root,companies)) continue;

      const company =
        companyFolderForItem(item,root,companies);

      if (!company) {
        console.warn(
          "FEHA WEAPON READINESS // weapon has no manufacturer parent",
          item.name,
          item.id
        );
        continue;
      }

      const bucket = status.get(String(company.id));
      if (!bucket) continue;

      const done = isDoneWeapon(item);
      const destination =
        done
          ? bucket.done
          : bucket.notDone;

      const patch = marketUpdates(item,done);

      if (
        String(item.folder?.id ?? item.folder ?? "") !==
        String(destination.id)
      ) {
        patch.folder = destination.id;
        moved++;
      }

      if (!done) {
        blockedIds.add(String(item.id));
        notDoneCount++;
      } else {
        doneCount++;
      }

      if (Object.keys(patch).length) {
        await item.update(patch);
        updated++;
      }
    }

    const staleStockRemoved =
      await cleanMarketStock(blockedIds);

    const foldersCreated =
      list(game.folders).filter(folder =>
        !beforeFolderIds.has(String(folder.id)) &&
        [DONE_NAME,NOT_DONE_NAME].includes(
          String(folder.name ?? "").toUpperCase()
        )
      ).length;

    try {
      const reroll =
        document.querySelector(
          "#adk-market-15 #reroll-stock"
        );

      if (reroll && game.user?.isGM) {
        reroll.click();
      } else {
        globalThis.ADKMarket?.refresh?.();
      }
    } catch {}

    guardMarketDom();

    const result = {
      skipped:false,
      manufacturers:companies.length,
      done:doneCount,
      notDone:notDoneCount,
      moved,
      updated,
      foldersCreated,
      staleStockRemoved
    };

    console.log(
      "FEHA WEAPON READINESS",
      VERSION,
      result
    );

    if (doneCount !== DONE_WEAPONS.size) {
      ui.notifications?.warn?.(
        "FEHA Weapon Readiness expected "+
        DONE_WEAPONS.size+
        " finished weapons but found "+
        doneCount+
        ". Check console for missing catalog entries."
      );
    } else {
      ui.notifications?.info?.(
        "FEHA weapons sorted: "+
        doneCount+
        " DONE // "+
        notDoneCount+
        " NOT DONE."
      );
    }

    return result;
  }

  const api = {
    version:VERSION,
    doneNames:[...DONE_WEAPONS],
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
