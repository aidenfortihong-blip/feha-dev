// FEHA // WORLD HYGIENE
// Read-only world audit plus one deliberately narrow safe cleanup:
// remove obsolete default dnd5e attack stubs when a weapon already has a real attack.
// No catalog balance, cyberware, actor stats, folders, prices, or rules are changed.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WORLD_HYGIENE requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.1";
  const FLAG = "fleshEnshrouded";

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    if (typeof collection.values === "function") {
      try { return [...collection.values()]; } catch {}
    }
    try { return [...collection]; } catch { return []; }
  };

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  function itemActivities(item) {
    const activities = item?.system?.activities;
    if (!activities) return [];
    if (Array.isArray(activities)) return activities;
    if (Array.isArray(activities.contents)) return activities.contents;
    if (typeof activities.values === "function") {
      try { return [...activities.values()]; } catch {}
    }
    if (typeof activities === "object") return Object.values(activities);
    return [];
  }

  function attackActivities(item) {
    return itemActivities(item).filter(activity =>
      String(activity?.type ?? "").toLowerCase() === "attack"
    );
  }

  function activityId(activity) {
    return String(activity?.id ?? activity?._id ?? "");
  }

  function legacyAttackStub(activity) {
    const source = activity?._source ?? activity ?? {};
    if (String(source?.type ?? activity?.type ?? "").toLowerCase() !== "attack") return false;

    // dnd5e prepares an unnamed legacy activity as "Attack", which made the
    // original hygiene pass mistake the empty stub for a legitimate attack.
    // Classify from persisted source data whenever available.
    const name = String(source?.name ?? "").trim();
    const sort = Number(source?.sort ?? activity?.sort ?? 0) || 0;
    const activation = source?.activation ?? {};
    const range = source?.range ?? {};
    const damage = source?.damage ?? {};
    const parts = list(damage?.parts);
    const effects = list(source?.effects);

    const value = range?.value;
    const emptyRangeValue =
      value == null || value === "" || Number(value) === 0;

    return (
      !name &&
      sort === 0 &&
      String(activation?.type ?? "action") === "action" &&
      String(range?.units ?? "") === "self" &&
      emptyRangeValue &&
      damage?.includeBase === true &&
      parts.length === 0 &&
      effects.length === 0
    );
  }

  function realAttack(activity) {
    const source = activity?._source ?? activity ?? {};
    if (String(source?.type ?? activity?.type ?? "").toLowerCase() !== "attack") return false;
    if (legacyAttackStub(activity)) return false;

    const name = String(source?.name ?? activity?.name ?? "").trim();
    const sort = Number(source?.sort ?? activity?.sort ?? 0) || 0;
    const range = source?.range ?? activity?.range ?? {};
    const rangeValue = Number(range?.value ?? 0) || 0;

    return Boolean(name || sort > 0 || rangeValue > 0);
  }

  function identifierIssues(root) {
    const issues = [];
    const seen = new WeakSet();

    const walk = (value,path) => {
      if (!value || typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);

      for (const [key,child] of Object.entries(value)) {
        const next = path ? path+"."+key : key;

        if (key === "identifier") {
          const text = String(child ?? "");
          if (!/^[a-z0-9_-]+$/i.test(text)) {
            issues.push({path:next,value:text});
          }
        }

        if (child && typeof child === "object") walk(child,next);
      }
    };

    walk(root,"");
    return issues;
  }

  function staleDescription(item) {
    const html = String(item?.system?.description?.value ?? "");
    if (!html) return false;

    return /FINAL GUN|REVIEW STATUS|GM REVIEW NOTES|Final reviewed values synced|GUN REVIEW|ADK WEAPON PROFILE|Manufacturer signature effects are handled by ADK Patch 2/i.test(html);
  }

  function folderPath(item) {
    const folder = item?.folder;
    if (!folder) return "";

    const parts = [];
    let current = folder;
    let guard = 0;

    while (current && guard++ < 30) {
      parts.unshift(String(current.name ?? ""));
      current = current.folder ?? current.parent ?? null;
    }

    return parts.filter(Boolean).join("/");
  }

  function allTrackedItems() {
    const rows = [];

    for (const item of list(game.items)) {
      rows.push({item,scope:"world",owner:""});
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        rows.push({
          item,
          scope:"actor",
          owner:String(actor.name ?? actor.id ?? "")
        });
      }
    }

    return rows;
  }

  function duplicateGroups(rows,keyFn) {
    const map = new Map();

    for (const row of rows) {
      const key = keyFn(row);
      if (!key) continue;
      if (!map.has(key)) map.set(key,[]);
      map.get(key).push(row);
    }

    return [...map.entries()]
      .filter(([,group]) => group.length > 1)
      .map(([key,group]) => ({key,count:group.length,group}));
  }

  function catalogCoverage(catalog,label) {
    const defs = list(catalog?.list?.() ?? []);
    if (!defs.length) {
      return {label,available:false,definitions:0,worldMatches:0,missing:[],duplicates:[]};
    }

    const world = list(game.items);
    const byName = new Map();

    for (const item of world) {
      const key = norm(item.name);
      if (!byName.has(key)) byName.set(key,[]);
      byName.get(key).push(item);
    }

    const missing = [];
    const duplicates = [];
    let worldMatches = 0;

    for (const def of defs) {
      const matches = byName.get(norm(def?.name)) ?? [];
      worldMatches += matches.length;
      if (!matches.length) missing.push(String(def?.name ?? def?.key ?? "UNKNOWN"));
      if (matches.length > 1) {
        duplicates.push({
          name:String(def?.name ?? def?.key ?? "UNKNOWN"),
          count:matches.length,
          uuids:matches.map(item => String(item.uuid ?? item.id ?? ""))
        });
      }
    }

    return {
      label,
      available:true,
      definitions:defs.length,
      worldMatches,
      missing,
      duplicates
    };
  }

  function scan() {
    const rows = allTrackedItems();
    const worldRows = rows.filter(row => row.scope === "world");
    const actorRows = rows.filter(row => row.scope === "actor");

    const byType = {};
    const bySourceCategory = {};
    const duplicateAttackActivities = [];
    const safeLegacyAttackCleanup = [];
    const ambiguousMultiAttack = [];
    const invalidIdentifiers = [];
    const staleDescriptions = [];
    const retiredOrLegacyWorld = [];
    const duplicateActorCyberwareSource = [];

    for (const row of rows) {
      const item = row.item;
      const type = String(item?.type ?? "unknown");
      byType[type] = (byType[type] ?? 0) + 1;

      const flags = item?.flags?.[FLAG] ?? {};
      const sourceCategory = String(flags.sourceCategory ?? "");
      if (sourceCategory) {
        bySourceCategory[sourceCategory] =
          (bySourceCategory[sourceCategory] ?? 0) + 1;
      }

      const attacks = attackActivities(item);
      if (attacks.length > 1) {
        const stubs = attacks.filter(legacyAttackStub);
        const real = attacks.filter(realAttack);

        const info = {
          scope:row.scope,
          owner:row.owner,
          name:String(item?.name ?? ""),
          uuid:String(item?.uuid ?? item?.id ?? ""),
          attackCount:attacks.length,
          legacyStubCount:stubs.length,
          realAttackCount:real.length,
          folder:folderPath(item)
        };

        duplicateAttackActivities.push(info);

        if (stubs.length > 0 && real.length > 0) {
          safeLegacyAttackCleanup.push(info);
        } else {
          ambiguousMultiAttack.push(info);
        }
      }

      const idIssues = identifierIssues(item?._source?.system ?? item?.system ?? {});
      if (idIssues.length) {
        invalidIdentifiers.push({
          scope:row.scope,
          owner:row.owner,
          name:String(item?.name ?? ""),
          uuid:String(item?.uuid ?? item?.id ?? ""),
          issues:idIssues.slice(0,30)
        });
      }

      if (staleDescription(item)) {
        staleDescriptions.push({
          scope:row.scope,
          owner:row.owner,
          name:String(item?.name ?? ""),
          uuid:String(item?.uuid ?? item?.id ?? "")
        });
      }

      if (row.scope === "world") {
        const path = folderPath(item);
        if (
          /(?:^|\/)07\s*[—-]\s*MODS(?:\/|$)/i.test(path) ||
          /ARCHIVED CLOTHING/i.test(path) ||
          sourceCategory === "Mods" ||
          flags.retired === true ||
          flags.catalogEnabled === false
        ) {
          retiredOrLegacyWorld.push({
            name:String(item?.name ?? ""),
            uuid:String(item?.uuid ?? item?.id ?? ""),
            type,
            folder:path,
            sourceCategory,
            retired:Boolean(flags.retired),
            catalogEnabled:flags.catalogEnabled
          });
        }
      }
    }

    const duplicateWorldNames = duplicateGroups(
      worldRows,
      row => [
        norm(row.item?.name),
        String(row.item?.type ?? ""),
        folderPath(row.item)
      ].join("|")
    ).map(entry => ({
      key:entry.key,
      count:entry.count,
      items:entry.group.map(row => ({
        name:String(row.item?.name ?? ""),
        uuid:String(row.item?.uuid ?? row.item?.id ?? ""),
        type:String(row.item?.type ?? ""),
        folder:folderPath(row.item)
      }))
    }));

    const duplicateActorNames = duplicateGroups(
      actorRows,
      row => [
        row.owner,
        norm(row.item?.name),
        String(row.item?.type ?? "")
      ].join("|")
    ).map(entry => ({
      key:entry.key,
      count:entry.count,
      items:entry.group.map(row => ({
        owner:row.owner,
        name:String(row.item?.name ?? ""),
        uuid:String(row.item?.uuid ?? row.item?.id ?? ""),
        type:String(row.item?.type ?? "")
      }))
    }));

    const cyberByOwnerSource = new Map();

    for (const row of actorRows) {
      const item = row.item;
      const flags = item?.flags?.[FLAG] ?? {};
      if (String(flags.sourceCategory ?? "") !== "Cyberware") continue;

      const source =
        String(flags.catalogSourceUuid ?? flags.cyberwareKey ?? "").trim();
      if (!source) continue;

      const key = row.owner+"|"+source;
      if (!cyberByOwnerSource.has(key)) cyberByOwnerSource.set(key,[]);
      cyberByOwnerSource.get(key).push(item);
    }

    for (const [key,group] of cyberByOwnerSource.entries()) {
      if (group.length < 2) continue;
      duplicateActorCyberwareSource.push({
        key,
        count:group.length,
        items:group.map(item => ({
          name:String(item.name ?? ""),
          uuid:String(item.uuid ?? item.id ?? ""),
          installed:Boolean(item.flags?.[FLAG]?.installed)
        }))
      });
    }

    const catalogs = [
      catalogCoverage(globalThis.FEHA_WEAPON_CATALOG ?? game.adk?.weapons,"weapons"),
      catalogCoverage(globalThis.FEHA_MELEE_CATALOG ?? game.adk?.melee,"melee"),
      catalogCoverage(globalThis.FEHA_UNIQUE_WEAPON_CATALOG ?? game.adk?.uniqueWeapons,"uniqueWeapons"),
      catalogCoverage(globalThis.FEHA_ARMOR_CATALOG ?? game.adk?.armor,"armor"),
      catalogCoverage(globalThis.FEHA_GRENADE_CATALOG ?? game.adk?.grenades,"grenades"),
      catalogCoverage(globalThis.FEHA_CONSUMABLE_CATALOG ?? game.adk?.consumables,"consumables"),
      catalogCoverage(globalThis.FEHA_QUICKHACK_CATALOG ?? game.adk?.quickhacks,"quickhacks")
    ];

    const report = {
      version:VERSION,
      build:String(globalThis.FEHA_TABLETOP_UI_V3?.version ?? ""),
      generatedAt:new Date().toISOString(),
      environment:{
        foundry:String(game.version ?? game.release?.version ?? ""),
        foundryBuild:Number(game.release?.build ?? 0) || null,
        system:String(game.system?.id ?? ""),
        systemVersion:String(game.system?.version ?? "")
      },
      counts:{
        worldItems:worldRows.length,
        actorItems:actorRows.length,
        actors:list(game.actors).length,
        byType,
        bySourceCategory
      },
      duplicateAttackActivities,
      safeLegacyAttackCleanup,
      ambiguousMultiAttack,
      invalidIdentifiers,
      staleDescriptions,
      duplicateWorldNames,
      duplicateActorNames,
      duplicateActorCyberwareSource,
      retiredOrLegacyWorld,
      catalogs
    };

    report.summary = {
      duplicateAttackItems:duplicateAttackActivities.length,
      safeLegacyAttackItems:safeLegacyAttackCleanup.length,
      ambiguousMultiAttackItems:ambiguousMultiAttack.length,
      invalidIdentifierItems:invalidIdentifiers.length,
      staleDescriptionItems:staleDescriptions.length,
      duplicateWorldNameGroups:duplicateWorldNames.length,
      duplicateActorNameGroups:duplicateActorNames.length,
      duplicateActorCyberwareSourceGroups:duplicateActorCyberwareSource.length,
      retiredOrLegacyWorldItems:retiredOrLegacyWorld.length,
      catalogMissingTotal:catalogs.reduce((sum,row) => sum + row.missing.length,0),
      catalogDuplicateTotal:catalogs.reduce((sum,row) => sum + row.duplicates.length,0)
    };

    globalThis.__FEHA_WORLD_HYGIENE_REPORT = report;
    return report;
  }

  function hasInvalidPersistedIdentifier(item) {
    const build = Number(game.release?.build ?? 0);
    if (build >= 368) return false;
    return identifierIssues(item?._source?.system ?? {}).length > 0;
  }

  async function cleanupLegacyWeaponActivities({notify=false}={}) {
    if (!game.user?.isGM) {
      return {ok:false,reason:"gm-only",removed:0,itemsChanged:0,skipped:[]};
    }

    let removed = 0;
    let itemsChanged = 0;
    const skipped = [];
    const failures = [];

    for (const row of allTrackedItems()) {
      const item = row.item;
      if (item?.type !== "weapon") continue;

      const attacks = attackActivities(item);
      if (attacks.length < 2) continue;

      const stubs = attacks.filter(legacyAttackStub);
      const real = attacks.filter(realAttack);
      if (!stubs.length || !real.length) continue;

      if (hasInvalidPersistedIdentifier(item)) {
        skipped.push({
          scope:row.scope,
          owner:row.owner,
          name:String(item.name ?? ""),
          uuid:String(item.uuid ?? item.id ?? ""),
          reason:"Foundry <14.368 invalid nested identifier quarantine"
        });
        continue;
      }

      const update = {};
      const ids = stubs.map(activityId).filter(Boolean);
      if (!ids.length) continue;

      for (const id of ids) {
        update["system.activities.-="+id] = null;
      }

      try {
        await item.update(update);
        removed += ids.length;
        itemsChanged++;
      } catch (error) {
        failures.push({
          scope:row.scope,
          owner:row.owner,
          name:String(item.name ?? ""),
          uuid:String(item.uuid ?? item.id ?? ""),
          ids,
          error:String(error?.message ?? error)
        });
      }
    }

    const result = {
      ok:failures.length === 0,
      removed,
      itemsChanged,
      skipped,
      failures
    };

    globalThis.__FEHA_WORLD_HYGIENE_LAST_CLEANUP = result;

    if (notify && (removed || skipped.length || failures.length)) {
      ui.notifications.info(
        "FEHA HYGIENE // removed "+removed+
        " legacy attack stub"+(removed===1?"":"s")+
        " from "+itemsChanged+" item"+(itemsChanged===1?"":"s")+
        (skipped.length ? " // "+skipped.length+" quarantined" : "")+
        (failures.length ? " // "+failures.length+" failed" : "")
      );
    }

    return result;
  }

  async function runFullPass({cleanup=true,notify=true}={}) {
    const before = scan();
    const cleanupResult = cleanup
      ? await cleanupLegacyWeaponActivities({notify:false})
      : {ok:true,removed:0,itemsChanged:0,skipped:[],failures:[]};
    const after = scan();

    const result = {
      version:VERSION,
      before:before.summary,
      cleanup:cleanupResult,
      after:after.summary,
      report:after
    };

    globalThis.__FEHA_WORLD_HYGIENE_LAST_PASS = result;

    console.groupCollapsed(
      "FEHA WORLD HYGIENE // "+VERSION+
      " // removed "+cleanupResult.removed+
      " legacy attack stubs"
    );
    console.log("Before",before.summary);
    console.log("Cleanup",cleanupResult);
    console.log("After",after.summary);
    console.log("Full report",after);
    console.groupEnd();

    if (notify) {
      const s = after.summary;
      ui.notifications.info(
        "FEHA HYGIENE // "+
        cleanupResult.removed+" duplicate attack stub"+
        (cleanupResult.removed===1?"":"s")+" removed // "+
        s.ambiguousMultiAttackItems+" ambiguous attacks // "+
        s.invalidIdentifierItems+" identifier issue items // "+
        s.staleDescriptionItems+" stale descriptions // "+
        s.duplicateWorldNameGroups+" duplicate world-name groups"
      );
    }

    return result;
  }

  const api = {
    version:VERSION,
    scan,
    runFullPass,
    cleanupLegacyWeaponActivities,
    legacyAttackStub,
    realAttack,
    identifierIssues,

    async init() {
      game.adk ??= {};
      game.adk.worldHygiene = api;
      globalThis.FEHA_WORLD_HYGIENE = api;
      console.log("FEHA WORLD HYGIENE",VERSION,"online");
    },

    async destroy() {
      if (game?.adk?.worldHygiene === api) delete game.adk.worldHygiene;
      if (globalThis.FEHA_WORLD_HYGIENE === api) delete globalThis.FEHA_WORLD_HYGIENE;
    }
  };

  core.registerModule("worldHygiene",api);
  globalThis.FEHA_WORLD_HYGIENE = api;
})();
