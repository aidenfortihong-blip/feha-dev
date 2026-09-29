// FEHA // LUMEN OPTICS RETIREMENT
// Lumen Optics no longer exists in FEHA. Rehomes useful equipment and removes redundant leftovers.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_LUMEN_RETIREMENT requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const PACKAGE = "flesh-enshrouded-heart-ablaze";
  const BACKUP_KEY = "retiredLumenBackupV1";

  const COMPANY_ALIASES = {
    "ForgeLine Industries":["ForgeLine Industries","-Forgeline"],
    "Bastion Strategic":["Bastion Strategic","-Bastion"],
    "Jade Arc Systems":["Jade Arc Systems","-Jade Arc"],
    "Corvus Neural":["Corvus Neural","-Corvus"],
    "Vektor Dynamics":["Vektor Dynamics","-Vektor"],
    "Helix Vitae":["Helix Vitae","-Helix"],
    "Kurohane Group":["Kurohane Group","-Kurohane"]
  };

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
    const names = [];
    let current = folder;
    let guard = 0;

    while (current && guard++ < 40) {
      names.unshift(String(current.name ?? ""));
      current = current.folder ?? current.parent ?? null;
    }

    return names.join("/");
  }

  function isLumenItem(item) {
    if (!item) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const company = norm(
      flags.manufacturer ??
      flags.company ??
      ""
    );

    return Boolean(
      company === "lumen optics" ||
      /(^|\/)Lumen Optics(\/|$)/i.test(
        folderPath(item.folder)
      ) ||
      /Lumen Optics/i.test(
        String(item.system?.description?.value ?? "")
      )
    );
  }

  function category(item) {
    const flags = item.flags?.[FLAG] ?? {};
    return norm(
      flags.sourceCategory ??
      flags.category ??
      item.type ??
      ""
    );
  }

  function targetCompany(item) {
    const name = norm(item?.name);
    const cat = category(item);
    const path = norm(folderPath(item?.folder));

    if (
      name.startsWith("observer tactical shell") ||
      cat === "armor outer" ||
      path.includes("03 armor")
    ) {
      return null;
    }

    if (
      cat === "mods" ||
      path.includes("07 mods")
    ) {
      return null;
    }

    if (
      cat === "grenades" ||
      path.includes("04 grenades")
    ) {
      if (name.includes("recon")) {
        return "Corvus Neural";
      }

      if (name.includes("flashbang")) {
        return "Bastion Strategic";
      }

      return "Vektor Dynamics";
    }

    if (
      cat === "consumables" ||
      path.includes("06 consumables")
    ) {
      return "Vektor Dynamics";
    }

    if (
      cat === "cyberware" ||
      path.includes("02 cyberware")
    ) {
      if (name.includes("optical camo")) {
        return "Kurohane Group";
      }

      return "Corvus Neural";
    }

    if (
      item?.type === "weapon" ||
      cat === "weapons" ||
      path.includes("01 weapons")
    ) {
      if (name === "tomahawk") {
        return "Kurohane Group";
      }

      return "Jade Arc Systems";
    }

    return null;
  }

  function rootFolder(folder) {
    let current = folder;
    let candidate = null;
    let guard = 0;

    while (current && guard++ < 40) {
      if (/^\d+\s*—/i.test(String(current.name ?? ""))) {
        candidate = current;
      }

      current = current.folder ?? current.parent ?? null;
    }

    return candidate;
  }

  async function ensureTargetFolder(item,company) {
    const root = rootFolder(item.folder);
    if (!root) return null;

    const aliases =
      COMPANY_ALIASES[company] ??
      [company];

    let folder =
      list(game.folders).find(candidate =>
        String(candidate?.type ?? "") === "Item" &&
        aliases.includes(String(candidate?.name ?? "")) &&
        String(candidate?.folder?.id ?? candidate?.folder ?? "") ===
          String(root.id)
      ) ??
      null;

    if (!folder) {
      folder =
        await globalThis.Folder.create({
          name:company,
          type:"Item",
          folder:root.id,
          sorting:"a"
        });
    }

    return folder;
  }

  function rewriteDescription(html,company) {
    let value =
      String(html ?? "")
        .replace(/Lumen Optics/gi,company)
        .replace(/LUMEN\s+OPTICS/gi,company.toUpperCase());

    value = value.replace(
      /(<strong>\s*Manufacturer:\s*<\/strong>\s*)([^<]+)/i,
      (_match,prefix) => prefix + company
    );

    return value;
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

    game.settings.register(
      PACKAGE,
      BACKUP_KEY,
      {
        name:"FEHA Retired Lumen Backup",
        hint:"Internal backup captured before Lumen Optics retirement.",
        scope:"world",
        config:false,
        type:Object,
        default:{snapshots:[]}
      }
    );

    return true;
  }

  async function backup(worldItems,ownedItems,folders) {
    ensureBackupSetting();

    const current =
      deepClone(
        game.settings.get(PACKAGE,BACKUP_KEY) ??
        {snapshots:[]}
      );

    current.snapshots ??= [];

    current.snapshots.push({
      retiredAt:new Date().toISOString(),
      worldItems:worldItems.map(item => ({
        id:item.id,
        name:item.name,
        folderPath:folderPath(item.folder),
        data:item.toObject()
      })),
      ownedItems:ownedItems.map(({actor,item}) => ({
        actorId:actor.id,
        actorName:actor.name,
        itemId:item.id,
        data:item.toObject()
      })),
      folders:folders.map(folder => ({
        id:folder.id,
        path:folderPath(folder),
        data:folder.toObject()
      }))
    });

    await game.settings.set(
      PACKAGE,
      BACKUP_KEY,
      current
    );
  }

  async function rehome(item,company,{owned=false}={}) {
    const flags = item.flags?.[FLAG] ?? {};
    const update = {
      ["flags."+FLAG+".manufacturer"]:company,
      ["flags."+FLAG+".company"]:company,
      ["flags."+FLAG+".lumenRetired"]:true,
      ["flags."+FLAG+".lumenRetirementVersion"]:VERSION
    };

    const description =
      rewriteDescription(
        item.system?.description?.value,
        company
      );

    if (
      description !==
      String(item.system?.description?.value ?? "")
    ) {
      update["system.description.value"] = description;
    }

    if (!owned) {
      const folder =
        await ensureTargetFolder(
          item,
          company
        );

      if (
        folder &&
        String(item.folder?.id ?? item.folder ?? "") !==
          String(folder.id)
      ) {
        update.folder = folder.id;
      }
    }

    await item.update(update);
  }

  async function deleteWorld(items) {
    let count = 0;

    for (const item of items) {
      try {
        await item.delete();
        count++;
      } catch (error) {
        console.warn(
          "FEHA LUMEN RETIREMENT // world item delete failed",
          item?.name,
          error
        );
      }
    }

    return count;
  }

  async function deleteOwned(entries) {
    let count = 0;

    for (const {item} of entries) {
      try {
        await item.delete();
        count++;
      } catch (error) {
        console.warn(
          "FEHA LUMEN RETIREMENT // owned item delete failed",
          item?.name,
          error
        );
      }
    }

    return count;
  }

  async function deleteLumenFolders() {
    const folders =
      list(game.folders)
        .filter(folder =>
          String(folder?.type ?? "") === "Item" &&
          String(folder?.name ?? "") === "Lumen Optics"
        )
        .sort(
          (a,b) =>
            folderPath(b).split("/").length -
            folderPath(a).split("/").length
        );

    let count = 0;

    for (const folder of folders) {
      try {
        const hasDocs =
          list(folder.contents).length > 0;
        const hasChildren =
          list(folder.children).length > 0;

        if (hasDocs || hasChildren) continue;

        await folder.delete();
        count++;
      } catch (error) {
        console.warn(
          "FEHA LUMEN RETIREMENT // folder cleanup failed",
          folderPath(folder),
          error
        );
      }
    }

    return count;
  }

  async function retire() {
    if (!game.user?.isGM) {
      return {skipped:true};
    }

    const worldItems =
      list(game.items).filter(isLumenItem);

    const ownedItems = [];

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (isLumenItem(item)) {
          ownedItems.push({actor,item});
        }
      }
    }

    const lumenFolders =
      list(game.folders).filter(folder =>
        String(folder?.type ?? "") === "Item" &&
        String(folder?.name ?? "") === "Lumen Optics"
      );

    if (
      worldItems.length ||
      ownedItems.length ||
      lumenFolders.length
    ) {
      await backup(
        worldItems,
        ownedItems,
        lumenFolders
      );
    }

    const deleteWorldItems = [];
    const deleteOwnedItems = [];
    let worldRehomed = 0;
    let ownedRehomed = 0;

    for (const item of worldItems) {
      const company = targetCompany(item);

      if (!company) {
        deleteWorldItems.push(item);
        continue;
      }

      await rehome(
        item,
        company,
        {owned:false}
      );

      worldRehomed++;
    }

    for (const entry of ownedItems) {
      const company =
        targetCompany(entry.item);

      if (!company) {
        deleteOwnedItems.push(entry);
        continue;
      }

      await rehome(
        entry.item,
        company,
        {owned:true}
      );

      ownedRehomed++;
    }

    const worldDeleted =
      await deleteWorld(deleteWorldItems);

    const ownedDeleted =
      await deleteOwned(deleteOwnedItems);

    const foldersDeleted =
      await deleteLumenFolders();

    const result = {
      skipped:false,
      worldRehomed,
      ownedRehomed,
      worldDeleted,
      ownedDeleted,
      foldersDeleted
    };

    console.log(
      "FEHA LUMEN RETIREMENT",
      VERSION,
      result
    );

    return result;
  }

  const api = {
    version:VERSION,
    isLumenItem,
    targetCompany,
    retire,

    async init() {
      globalThis.FEHA_LUMEN_RETIREMENT = api;
      game.adk ??= {};
      game.adk.lumenRetirement = api;

      if (game.user?.isGM) {
        await retire();
      }
    },

    async destroy() {
      if (game?.adk?.lumenRetirement === api) {
        delete game.adk.lumenRetirement;
      }

      if (globalThis.FEHA_LUMEN_RETIREMENT === api) {
        delete globalThis.FEHA_LUMEN_RETIREMENT;
      }
    }
  };

  core.registerModule("lumenRetirement",api);
  globalThis.FEHA_LUMEN_RETIREMENT = api;
})();
