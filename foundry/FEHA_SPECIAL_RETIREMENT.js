// FEHA // SPECIAL RETIREMENT
// Retires the one-item legacy Special category and its folder tree.
// Creates a hidden recoverable backup before deletion.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_SPECIAL_RETIREMENT requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const PACKAGE = "flesh-enshrouded-heart-ablaze";
  const BACKUP_KEY = "retiredSpecialBackupV1";
  const MARKET_NS = "world";
  const MARKET_STOCK = "adkMarketStockV16";

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

  function folderPath(folder) {
    const parts = [];
    let current = folder;
    let guard = 0;

    while (current && guard++ < 40) {
      parts.unshift(String(current.name ?? ""));
      current = current.folder ?? current.parent ?? null;
    }

    return parts.join("/");
  }

  function isSpecialFolder(folder) {
    if (!folder) return false;
    const path = norm(folderPath(folder));

    return (
      /(^| )08 special( |$)/.test(path) ||
      path.includes("curated catalog 08 special")
    );
  }

  function isSpecialItem(item) {
    if (!item) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const category = norm(flags.sourceCategory ?? flags.category ?? "");
    const name = norm(item.name);
    const original = norm(flags.originalLibraryName ?? "");
    const sourcePath = String(flags.sourcePath ?? "");

    return Boolean(
      category === "special" ||
      isSpecialFolder(item.folder) ||
      /\/special\//i.test(sourcePath) ||
      name === "cyberspace interface suit" ||
      original === "q114 cyberspace jumpsuit f"
    );
  }

  function deepClone(value) {
    try {
      return globalThis.foundry?.utils?.deepClone?.(value) ??
        JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  function ensureBackupSetting() {
    const full = PACKAGE+"."+BACKUP_KEY;

    if (game.settings?.settings?.has?.(full)) return true;

    try {
      game.settings.register(
        PACKAGE,
        BACKUP_KEY,
        {
          name:"FEHA Retired Special Backup",
          hint:"Internal backup created before the legacy Special category was removed.",
          scope:"world",
          config:false,
          type:Object,
          default:{
            snapshots:[]
          }
        }
      );

      return true;
    } catch (error) {
      if (game.settings?.settings?.has?.(full)) return true;

      console.error(
        "FEHA SPECIAL RETIREMENT // backup setting registration failed",
        error
      );

      return false;
    }
  }

  async function readBackup() {
    if (!ensureBackupSetting()) {
      throw new Error("Could not register the retired Special backup setting.");
    }

    let value = null;

    try {
      value = game.settings.get(PACKAGE,BACKUP_KEY);
    } catch {}

    if (!value || typeof value !== "object") {
      value = {snapshots:[]};
    }

    if (!Array.isArray(value.snapshots)) {
      value.snapshots = [];
    }

    return deepClone(value);
  }

  async function backupBeforeDelete(worldItems,ownedItems,folders) {
    if (!worldItems.length && !ownedItems.length && !folders.length) {
      return false;
    }

    const backup = await readBackup();

    const snapshot = {
      retiredAt:new Date().toISOString(),
      build:globalThis.FEHA_TABLETOP_UI_V3?.version ?? null,
      worldItems:worldItems.map(item => ({
        id:item.id,
        uuid:item.uuid,
        folderPath:folderPath(item.folder),
        data:item.toObject()
      })),
      ownedItems:ownedItems.map(({actor,item}) => ({
        actorId:actor.id,
        actorName:String(actor.name ?? ""),
        itemId:item.id,
        data:item.toObject()
      })),
      folders:folders.map(folder => ({
        id:folder.id,
        name:String(folder.name ?? ""),
        path:folderPath(folder),
        data:folder.toObject()
      }))
    };

    backup.snapshots.push(snapshot);

    await game.settings.set(
      PACKAGE,
      BACKUP_KEY,
      backup
    );

    const verify = await readBackup();
    const last =
      verify.snapshots?.[verify.snapshots.length - 1] ??
      null;

    if (
      !last ||
      String(last.retiredAt ?? "") !==
      String(snapshot.retiredAt)
    ) {
      throw new Error(
        "Special backup verification failed. No Special data was deleted."
      );
    }

    return true;
  }

  async function cleanMarketStock(worldIds) {
    if (!worldIds.size) return 0;

    const full = MARKET_NS+"."+MARKET_STOCK;
    if (!game.settings?.settings?.has?.(full)) return 0;

    let stock = null;

    try {
      stock = deepClone(
        game.settings.get(MARKET_NS,MARKET_STOCK) ?? {}
      );
    } catch {
      return 0;
    }

    if (!stock || typeof stock !== "object") return 0;

    let removed = 0;

    for (const [key,value] of Object.entries(stock)) {
      if (!Array.isArray(value)) continue;

      const next = value.filter(entry => {
        const id =
          typeof entry === "string"
            ? entry
            : String(
                entry?.id ??
                entry?._id ??
                entry?.itemId ??
                ""
              );

        const keep = !worldIds.has(String(id));
        if (!keep) removed++;
        return keep;
      });

      stock[key] = next;
    }

    if (removed) {
      try {
        await game.settings.set(
          MARKET_NS,
          MARKET_STOCK,
          stock
        );
      } catch (error) {
        console.warn(
          "FEHA SPECIAL RETIREMENT // Market stock cleanup failed",
          error
        );
      }
    }

    return removed;
  }

  async function deleteWorldItems(items) {
    const ids = items.map(item => item.id);
    if (!ids.length) return 0;

    try {
      if (typeof globalThis.Item?.deleteDocuments === "function") {
        await globalThis.Item.deleteDocuments(ids);
        return ids.length;
      }
    } catch {}

    let count = 0;

    for (const item of items) {
      try {
        await item.delete();
        count++;
      } catch (error) {
        console.warn(
          "FEHA SPECIAL RETIREMENT // world item deletion failed",
          item?.name,
          error
        );
      }
    }

    return count;
  }

  async function deleteOwnedItems(entries) {
    const grouped = new Map();

    for (const entry of entries) {
      if (!grouped.has(entry.actor.id)) {
        grouped.set(entry.actor.id,{
          actor:entry.actor,
          ids:[]
        });
      }

      grouped.get(entry.actor.id).ids.push(entry.item.id);
    }

    let count = 0;

    for (const {actor,ids} of grouped.values()) {
      try {
        await actor.deleteEmbeddedDocuments("Item",ids);
        count += ids.length;
      } catch (error) {
        console.warn(
          "FEHA SPECIAL RETIREMENT // owned item deletion failed",
          actor?.name,
          error
        );
      }
    }

    return count;
  }

  async function deleteFolders(folders) {
    const ordered = [...folders].sort(
      (a,b) =>
        folderPath(b).split("/").length -
        folderPath(a).split("/").length
    );

    let count = 0;

    for (const folder of ordered) {
      try {
        await folder.delete();
        count++;
      } catch (error) {
        console.warn(
          "FEHA SPECIAL RETIREMENT // folder deletion failed",
          folderPath(folder),
          error
        );
      }
    }

    return count;
  }

  async function retire() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        reason:"gm-only"
      };
    }

    const worldItems =
      list(game.items).filter(isSpecialItem);

    const ownedItems = [];

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (isSpecialItem(item)) {
          ownedItems.push({actor,item});
        }
      }
    }

    const folders =
      list(game.folders).filter(folder =>
        String(folder?.type ?? "") === "Item" &&
        isSpecialFolder(folder)
      );

    await backupBeforeDelete(
      worldItems,
      ownedItems,
      folders
    );

    const worldIds =
      new Set(
        worldItems.map(item => String(item.id))
      );

    const stockRemoved =
      await cleanMarketStock(worldIds);

    const worldDeleted =
      await deleteWorldItems(worldItems);

    const ownedDeleted =
      await deleteOwnedItems(ownedItems);

    const foldersDeleted =
      await deleteFolders(folders);

    try {
      await globalThis.ADKMarket?.refresh?.();
    } catch {}

    const result = {
      skipped:false,
      worldDeleted,
      ownedDeleted,
      foldersDeleted,
      stockRemoved
    };

    if (
      worldDeleted ||
      ownedDeleted ||
      foldersDeleted
    ) {
      ui.notifications?.info?.(
        "FEHA // SPECIAL CATEGORY REMOVED // "+
        worldDeleted+" catalog item removed, "+
        ownedDeleted+" owned copy removed, "+
        foldersDeleted+" folder(s) removed."
      );
    }

    console.log(
      "FEHA SPECIAL RETIREMENT",
      VERSION,
      result
    );

    return result;
  }

  const api = {
    version:VERSION,
    isSpecialItem,
    retire,

    async init() {
      globalThis.FEHA_SPECIAL_RETIREMENT = api;
      game.adk ??= {};
      game.adk.specialRetirement = api;

      if (game.user?.isGM) {
        await retire();
      }
    },

    async destroy() {
      if (game?.adk?.specialRetirement === api) {
        delete game.adk.specialRetirement;
      }

      if (globalThis.FEHA_SPECIAL_RETIREMENT === api) {
        delete globalThis.FEHA_SPECIAL_RETIREMENT;
      }
    }
  };

  core.registerModule("specialRetirement",api);
  globalThis.FEHA_SPECIAL_RETIREMENT = api;
})();
