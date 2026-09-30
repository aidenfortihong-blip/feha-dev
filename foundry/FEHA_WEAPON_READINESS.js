// FEHA // WEAPON ORGANIZER + READINESS
// Canonical mega-pass guns live directly in their manufacturer folders.
// Melee is consolidated under MELEE; every other non-canonical weapon/item
// inside 01 — WEAPONS is parked under OTHER for later review.
// Legacy DONE / NOT DONE / reskin organizer folders are removed once empty.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_READINESS requires FEHA_CYBER_CORE.");

  const VERSION = "3.0.0";
  const FLAG = "fleshEnshrouded";
  const ROOT_NAME = "01 — WEAPONS";
  const STOCK_KEY = "adkMarketStockV16";

  const COMPANY_FOLDER = Object.freeze({
    "Bastion Strategic":"-Bastion",
    "Corvus Neural":"-Corvus",
    "ForgeLine Industries":"-Forgeline",
    "Helix Vitae":"-Helix",
    "Jade Arc Systems":"-Jade Arc",
    "Kurohane Group":"-Kurohane",
    "Vektor Dynamics":"-Vektor"
  });

  const MELEE_FOLDER = "MELEE";
  const OTHER_FOLDER = "OTHER";

  let marketObserver = null;
  let marketClickGuard = null;

  const DONE_NAMES =
    (globalThis.FEHA_WEAPON_CATALOG?.list?.() ?? [])
      .map(def => String(def?.name ?? "").trim())
      .filter(Boolean);

  if (DONE_NAMES.length !== 81) {
    throw new Error(
      "FEHA Weapon Organizer expected 81 catalog definitions but received " +
      DONE_NAMES.length + "."
    );
  }

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

  const DONE_WEAPONS = new Set(DONE_NAMES.map(norm));

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

  function isUnderRoot(item,root) {
    if (!item?.folder || !root) return false;

    return ancestorChain(item.folder).some(folder =>
      String(folder?.id ?? "") === String(root.id)
    );
  }

  function folderDepth(folder) {
    let depth = 0;
    let current = folder;
    let guard = 0;

    while (current && guard++ < 50) {
      depth++;
      current = current.folder ?? current.parent ?? null;
    }

    return depth;
  }

  function childFolder(parent,name) {
    return (
      list(game.folders).find(folder =>
        String(folder?.type ?? "") === "Item" &&
        folderParentId(folder) === String(parent?.id ?? "") &&
        String(folder?.name ?? "") === String(name)
      ) ??
      null
    );
  }

  async function ensureChildFolder(parent,name) {
    let folder = childFolder(parent,name);
    if (folder) return folder;

    folder = await globalThis.Folder.create({
      name,
      type:"Item",
      folder:parent.id,
      sorting:"a"
    });

    return folder;
  }

  function canonicalDefinition(item) {
    if (item?.type !== "weapon") return null;

    // FEHA_WEAPON_CATALOG 2.0.1+ resolves documents by exact CURRENT name.
    // This intentionally ignores stale base-model flags on reskins.
    return globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ?? null;
  }

  function isDoneWeapon(item) {
    return Boolean(canonicalDefinition(item)) &&
      DONE_WEAPONS.has(norm(item?.name));
  }

  function isMelee(item) {
    if (item?.type !== "weapon") return false;

    const flags = item.flags?.[FLAG] ?? {};
    const kind = norm(flags.weaponKind);
    const meleeClass = String(flags.meleeClass ?? "").trim();
    const systemType = String(item.system?.type?.value ?? "");

    return (
      kind === "melee" ||
      Boolean(meleeClass) ||
      /(?:^|\b)(?:simplem|martialm)(?:\b|$)/i.test(systemType)
    );
  }

  function marketUpdates(item,canonical) {
    if (item?.type !== "weapon") return {};

    const flags = item.flags?.[FLAG] ?? {};
    const updates = {};
    const values = canonical
      ? {
          sourceCategory:"Weapons",
          catalogEnabled:true,
          curatedCatalogV10:true,
          marketReady:true,
          marketPass:"weapon-organizer-3.0",
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
          marketPass:"weapon-organizer-3.0",
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
    const root = document.getElementById("adk-market-15");
    if (!root) return;

    const cards = new Set(
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

      const item =
        game.items?.get?.(itemIdFromMarketNode(node)) ??
        null;

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
          "#adk-market-15 [data-buy-item]," +
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
        "That weapon is parked outside the canonical gun catalog and is unavailable in the Market."
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

  async function deleteEmptyLegacyFolders(root,keepIds) {
    let deleted = 0;
    let changed = true;
    let passes = 0;

    while (changed && passes++ < 25) {
      changed = false;

      const descendants =
        list(game.folders)
          .filter(folder =>
            String(folder?.type ?? "") === "Item" &&
            String(folder?.id ?? "") !== String(root.id) &&
            ancestorChain(folder).some(ancestor =>
              String(ancestor?.id ?? "") === String(root.id)
            )
          )
          .sort((a,b) => folderDepth(b) - folderDepth(a));

      for (const folder of descendants) {
        if (keepIds.has(String(folder.id))) continue;

        const hasItems =
          list(game.items).some(item =>
            String(item?.folder?.id ?? item?.folder ?? "") ===
            String(folder.id)
          );

        const hasChildren =
          list(game.folders).some(child =>
            folderParentId(child) === String(folder.id)
          );

        if (hasItems || hasChildren) continue;

        try {
          await folder.delete();
          deleted++;
          changed = true;
        } catch (error) {
          console.warn(
            "FEHA WEAPON ORGANIZER // could not remove empty legacy folder",
            folder?.name,
            folder?.id,
            error
          );
        }
      }
    }

    return deleted;
  }

  async function migrate() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        canonical:0,
        melee:0,
        other:0,
        moved:0,
        updated:0,
        foldersCreated:0,
        foldersDeleted:0,
        staleStockRemoved:0
      };
    }

    const root = rootFolder();

    if (!root) {
      throw new Error(
        "FEHA Weapon Organizer could not find the '"+ROOT_NAME+"' Item folder."
      );
    }

    const beforeFolderIds =
      new Set(
        list(game.folders).map(folder => String(folder.id))
      );

    const companyFolders = new Map();

    for (const [company,folderName] of Object.entries(COMPANY_FOLDER)) {
      const folder = await ensureChildFolder(root,folderName);
      companyFolders.set(company,folder);
    }

    const meleeFolder =
      await ensureChildFolder(root,MELEE_FOLDER);

    const otherFolder =
      await ensureChildFolder(root,OTHER_FOLDER);

    const keepIds =
      new Set([
        ...[...companyFolders.values()].map(folder => String(folder.id)),
        String(meleeFolder.id),
        String(otherFolder.id)
      ]);

    let canonicalCount = 0;
    let meleeCount = 0;
    let otherCount = 0;
    let moved = 0;
    let updated = 0;

    const blockedIds = new Set();

    // Snapshot before moving so ancestry checks remain stable throughout pass.
    const candidates =
      list(game.items).filter(item =>
        isUnderRoot(item,root)
      );

    for (const item of candidates) {
      const def = canonicalDefinition(item);
      let destination = otherFolder;
      let canonical = false;

      if (def) {
        destination =
          companyFolders.get(def.company) ??
          otherFolder;

        canonical =
          destination !== otherFolder;

        if (canonical) {
          canonicalCount++;
        } else {
          otherCount++;
        }
      } else if (isMelee(item)) {
        destination = meleeFolder;
        meleeCount++;
      } else {
        destination = otherFolder;
        otherCount++;
      }

      const patch =
        marketUpdates(item,canonical);

      if (
        String(item?.folder?.id ?? item?.folder ?? "") !==
        String(destination.id)
      ) {
        patch.folder = destination.id;
        moved++;
      }

      if (item?.type === "weapon" && !canonical) {
        blockedIds.add(String(item.id));
      }

      if (Object.keys(patch).length) {
        try {
          await item.update(patch);
          updated++;
        } catch (error) {
          console.warn(
            "FEHA WEAPON ORGANIZER // item move/update failed",
            item?.name,
            item?.id,
            error
          );
        }
      }
    }

    const staleStockRemoved =
      await cleanMarketStock(blockedIds);

    const foldersDeleted =
      await deleteEmptyLegacyFolders(root,keepIds);

    const foldersCreated =
      list(game.folders).filter(folder =>
        !beforeFolderIds.has(String(folder.id)) &&
        (
          keepIds.has(String(folder.id)) ||
          [MELEE_FOLDER,OTHER_FOLDER].includes(
            String(folder?.name ?? "")
          )
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
      canonical:canonicalCount,
      melee:meleeCount,
      other:otherCount,
      moved,
      updated,
      foldersCreated,
      foldersDeleted,
      staleStockRemoved
    };

    console.log(
      "FEHA WEAPON ORGANIZER",
      VERSION,
      result
    );

    if (canonicalCount !== DONE_NAMES.length) {
      ui.notifications?.warn?.(
        "FEHA Weapon Organizer expected " +
        DONE_NAMES.length +
        " canonical guns but found " +
        canonicalCount +
        ". Check console."
      );
    } else {
      ui.notifications?.info?.(
        "FEHA weapons organized: " +
        canonicalCount +
        " guns // " +
        meleeCount +
        " melee // " +
        otherCount +
        " other."
      );
    }

    return result;
  }

  const api = {
    version:VERSION,
    doneNames:[...DONE_NAMES],
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
