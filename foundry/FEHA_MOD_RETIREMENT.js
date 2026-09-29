// FEHA // MOD RETIREMENT
// Removes the legacy universal mod ecosystem from active play.
// A GM-side backup is stored before any destructive deletion.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_MOD_RETIREMENT requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const PACKAGE = "flesh-enshrouded-heart-ablaze";
  const BACKUP_KEY = "retiredModsBackupV1";
  const BACKUP_VERSION = "1.0";
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

  function inModsFolder(folder) {
    const path = norm(folderPath(folder));
    return (
      /(^| )07 mods( |$)/.test(path) ||
      path.includes("curated catalog 07 mods")
    );
  }

  function descriptionText(item) {
    const raw = String(item?.system?.description?.value ?? "");
    return raw.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  }

  function isLegacyMod(item) {
    if (!item) return false;

    const f = item.flags?.[FLAG] ?? {};
    const category = norm(f.sourceCategory ?? f.category ?? "");
    const shopType = norm(f.shopType ?? "");
    const sourcePath = String(f.sourcePath ?? "");
    const folder = item.folder ?? null;
    const desc = norm(descriptionText(item));

    return Boolean(
      category === "mods" ||
      category === "mod" ||
      shopType === "mods" ||
      shopType === "mod" ||
      /\/mods\//i.test(sourcePath) ||
      inModsFolder(folder) ||
      /category mods/.test(desc)
    );
  }

  function stripModSlotParagraph(raw) {
    let text = String(raw ?? "");

    text = text.replace(
      /<p\b[^>]*>\s*<strong\b[^>]*>\s*Mod\s*Slots?:\s*<\/strong>\s*[^<]*<\/p>/gi,
      ""
    );

    text = text.replace(
      /<div\b[^>]*>\s*<strong\b[^>]*>\s*Mod\s*Slots?:\s*<\/strong>\s*[^<]*<\/div>/gi,
      ""
    );

    return text;
  }

  function slotCleanupUpdate(item) {
    const f = item?.flags?.[FLAG] ?? {};
    const raw = String(item?.system?.description?.value ?? "");
    const clean = stripModSlotParagraph(raw);
    const update = {_id:item.id};
    let changed = false;

    if (Object.prototype.hasOwnProperty.call(f,"modSlots")) {
      update["flags."+FLAG+".-=modSlots"] = null;
      changed = true;
    }

    if (clean !== raw) {
      update["system.description.value"] = clean;
      changed = true;
    }

    return changed ? update : null;
  }

  function ensureBackupSetting() {
    const full = PACKAGE+"."+BACKUP_KEY;

    if (game.settings?.settings?.has?.(full)) return true;

    try {
      game.settings.register(
        PACKAGE,
        BACKUP_KEY,
        {
          name:"FEHA Retired Mods Backup",
          hint:"Internal backup created before the legacy universal mod system was removed.",
          scope:"world",
          config:false,
          type:Object,
          default:{
            version:BACKUP_VERSION,
            snapshots:[]
          }
        }
      );

      return true;
    } catch (error) {
      if (game.settings?.settings?.has?.(full)) return true;

      console.error(
        "FEHA MOD RETIREMENT // backup setting registration failed",
        error
      );

      return false;
    }
  }

  function deepClone(value) {
    try {
      return globalThis.foundry?.utils?.deepClone?.(value) ??
        JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  async function readBackup() {
    if (!ensureBackupSetting()) {
      throw new Error("Could not register the retired-mod backup setting.");
    }

    let value = null;

    try {
      value = game.settings.get(PACKAGE,BACKUP_KEY);
    } catch {}

    if (!value || typeof value !== "object") {
      value = {
        version:BACKUP_VERSION,
        snapshots:[]
      };
    }

    if (!Array.isArray(value.snapshots)) {
      value.snapshots = [];
    }

    return deepClone(value);
  }

  async function writeBackup(value) {
    if (!ensureBackupSetting()) {
      throw new Error("Could not register the retired-mod backup setting.");
    }

    await game.settings.set(
      PACKAGE,
      BACKUP_KEY,
      value
    );
  }

  function snapshotPayload(worldMods,ownedMods,modFolders) {
    return {
      retiredAt:new Date().toISOString(),
      build:
        globalThis.FEHA_TABLETOP_UI_V3?.version ??
        null,
      worldItems:
        worldMods.map(item => ({
          id:item.id,
          uuid:item.uuid,
          folderPath:folderPath(item.folder),
          data:item.toObject()
        })),
      ownedItems:
        ownedMods.map(({actor,item}) => ({
          actorId:actor.id,
          actorName:String(actor.name ?? ""),
          itemId:item.id,
          data:item.toObject()
        })),
      folders:
        modFolders.map(folder => ({
          id:folder.id,
          name:String(folder.name ?? ""),
          path:folderPath(folder),
          data:folder.toObject()
        }))
    };
  }

  async function backupBeforeDelete(worldMods,ownedMods,modFolders) {
    if (!worldMods.length && !ownedMods.length && !modFolders.length) {
      return {saved:false};
    }

    const backup = await readBackup();
    const snapshot =
      snapshotPayload(
        worldMods,
        ownedMods,
        modFolders
      );

    backup.version = BACKUP_VERSION;
    backup.snapshots.push(snapshot);

    await writeBackup(backup);

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
        "Retired-mod backup verification failed. No mods were deleted."
      );
    }

    return {
      saved:true,
      snapshot
    };
  }

  async function cleanMarketStock(worldModIds) {
    if (!worldModIds.size) return 0;

    const full = MARKET_NS+"."+MARKET_STOCK;

    if (!game.settings?.settings?.has?.(full)) return 0;

    let stock = null;

    try {
      stock = deepClone(
        game.settings.get(
          MARKET_NS,
          MARKET_STOCK
        ) ?? {}
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

        const keep = !worldModIds.has(String(id));
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
          "FEHA MOD RETIREMENT // Market stock cleanup failed",
          error
        );
      }
    }

    return removed;
  }

  async function deleteWorldMods(worldMods) {
    const ids = worldMods.map(item => item.id);
    if (!ids.length) return 0;

    try {
      if (typeof globalThis.Item?.deleteDocuments === "function") {
        await globalThis.Item.deleteDocuments(ids);
        return ids.length;
      }
    } catch (error) {
      console.warn(
        "FEHA MOD RETIREMENT // batch world-item deletion failed; falling back",
        error
      );
    }

    let count = 0;

    for (const item of worldMods) {
      try {
        await item.delete();
        count++;
      } catch (error) {
        console.warn(
          "FEHA MOD RETIREMENT // could not delete",
          item?.name,
          error
        );
      }
    }

    return count;
  }

  async function deleteOwnedMods(ownedMods) {
    const byActor = new Map();

    for (const entry of ownedMods) {
      if (!byActor.has(entry.actor.id)) {
        byActor.set(entry.actor.id,{
          actor:entry.actor,
          ids:[]
        });
      }

      byActor.get(entry.actor.id).ids.push(entry.item.id);
    }

    let count = 0;

    for (const {actor,ids} of byActor.values()) {
      try {
        await actor.deleteEmbeddedDocuments("Item",ids);
        count += ids.length;
      } catch (error) {
        console.warn(
          "FEHA MOD RETIREMENT // owned mod deletion failed",
          actor?.name,
          error
        );
      }
    }

    return count;
  }

  async function deleteModFolders(modFolders) {
    const ordered = [...modFolders].sort(
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
          "FEHA MOD RETIREMENT // folder deletion failed",
          folderPath(folder),
          error
        );
      }
    }

    return count;
  }

  async function stripAllModSlots() {
    const worldUpdates = [];

    for (const item of list(game.items)) {
      if (isLegacyMod(item)) continue;

      const update = slotCleanupUpdate(item);
      if (update) worldUpdates.push(update);
    }

    if (worldUpdates.length) {
      try {
        await globalThis.Item.updateDocuments(worldUpdates);
      } catch {
        for (const update of worldUpdates) {
          const item = game.items?.get?.(update._id);
          if (!item) continue;

          const local = {...update};
          delete local._id;

          try { await item.update(local); } catch {}
        }
      }
    }

    let ownedUpdated = 0;

    for (const actor of list(game.actors)) {
      const updates = [];

      for (const item of list(actor.items)) {
        if (isLegacyMod(item)) continue;

        const update = slotCleanupUpdate(item);
        if (update) updates.push(update);
      }

      if (!updates.length) continue;

      try {
        await actor.updateEmbeddedDocuments(
          "Item",
          updates
        );

        ownedUpdated += updates.length;
      } catch {
        for (const update of updates) {
          const item = actor.items?.get?.(update._id);
          if (!item) continue;

          const local = {...update};
          delete local._id;

          try {
            await item.update(local);
            ownedUpdated++;
          } catch {}
        }
      }
    }

    return {
      worldUpdated:worldUpdates.length,
      ownedUpdated
    };
  }

  async function retire() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        reason:"gm-only"
      };
    }

    const worldMods =
      list(game.items).filter(isLegacyMod);

    const ownedMods = [];

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (isLegacyMod(item)) {
          ownedMods.push({actor,item});
        }
      }
    }

    const modFolders =
      list(game.folders).filter(folder =>
        String(folder?.type ?? "") === "Item" &&
        inModsFolder(folder)
      );

    await backupBeforeDelete(
      worldMods,
      ownedMods,
      modFolders
    );

    const worldModIds =
      new Set(worldMods.map(item => String(item.id)));

    const stockRemoved =
      await cleanMarketStock(worldModIds);

    const worldDeleted =
      await deleteWorldMods(worldMods);

    const ownedDeleted =
      await deleteOwnedMods(ownedMods);

    const foldersDeleted =
      await deleteModFolders(modFolders);

    const slotCleanup =
      await stripAllModSlots();

    try {
      await globalThis.ADKMarket?.refresh?.();
    } catch {}

    const result = {
      skipped:false,
      worldDeleted,
      ownedDeleted,
      foldersDeleted,
      stockRemoved,
      worldSlotFieldsRemoved:slotCleanup.worldUpdated,
      ownedSlotFieldsRemoved:slotCleanup.ownedUpdated
    };

    if (
      worldDeleted ||
      ownedDeleted ||
      foldersDeleted ||
      slotCleanup.worldUpdated ||
      slotCleanup.ownedUpdated
    ) {
      ui.notifications?.info?.(
        "FEHA // MOD SYSTEM RETIRED // "+
        worldDeleted+" catalog mods removed, "+
        ownedDeleted+" owned mods removed, "+
        foldersDeleted+" mod folders removed."
      );
    }

    console.log(
      "FEHA MOD RETIREMENT",
      VERSION,
      result
    );

    return result;
  }

  const api = {
    version:VERSION,
    isLegacyMod,
    retire,

    async init() {
      globalThis.FEHA_MOD_RETIREMENT = api;
      game.adk ??= {};
      game.adk.modRetirement = api;

      if (game.user?.isGM) {
        await retire();
      }
    },

    async destroy() {
      if (game?.adk?.modRetirement === api) {
        delete game.adk.modRetirement;
      }

      if (globalThis.FEHA_MOD_RETIREMENT === api) {
        delete globalThis.FEHA_MOD_RETIREMENT;
      }
    }
  };

  core.registerModule("modRetirement",api);
  globalThis.FEHA_MOD_RETIREMENT = api;
})();
