// FEHA // DERKE IMPORT
// Legacy Derke recovery/import utility.
// Deep-clean baseline: retained for explicit recovery only. It no longer runs
// automatically on every loader cycle because its old 9.0/11.0 chrome/player
// scaffolding would fight the upcoming unified PC rebuild.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_DERKE_IMPORT requires FEHA_CYBER_CORE.");

  const VERSION = "1.2.0";
  const FLAG = "fleshEnshrouded";

  const ACTOR_ID = "Vr0A1KFh8HFLdDt2";
  const ACTOR_NAME = "Derke";
  const ROSTER_KEY = "derke";
  const ROSTER_CODE = "DK-02";
  const PORTRAIT =
    "https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png";

  const ROOT_FOLDER = "ADK Campaign PCs";
  const PC_FOLDER = "OMEGA — Streetkids";
  const BUILD_VERSION = "1.0";
  const PERSONAL_FEATURE = "Kinetic Shift";

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const norm = value =>
    String(value ?? "")
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

  async function ensureFolder(name,parentId=null) {
    let folder =
      list(game.folders).find(candidate =>
        String(candidate?.type ?? "") === "Actor" &&
        String(candidate?.name ?? "") === name &&
        folderParentId(candidate) === String(parentId ?? "")
      ) ??
      null;

    if (!folder) {
      folder = await globalThis.Folder.create({
        name,
        type:"Actor",
        folder:parentId || null,
        sorting:"a"
      });
    }

    return folder;
  }

  async function ensurePcFolder() {
    const root = await ensureFolder(ROOT_FOLDER,null);
    const pcs = await ensureFolder(PC_FOLDER,root.id);
    return pcs;
  }

  function findDerke() {
    return (
      game.actors?.get?.(ACTOR_ID) ??
      list(game.actors).find(actor =>
        norm(actor?.flags?.[FLAG]?.adkCharacter) === ROSTER_KEY
      ) ??
      list(game.actors).find(actor =>
        norm(actor?.name) === ROSTER_KEY
      ) ??
      null
    );
  }

  function tokenPatch(actor) {
    return {
      "prototypeToken.name":ACTOR_NAME,
      "prototypeToken.actorLink":true,
      "prototypeToken.width":1,
      "prototypeToken.height":1,
      "prototypeToken.texture.src":PORTRAIT,
      "prototypeToken.texture.fit":"contain",
      "prototypeToken.texture.scaleX":1,
      "prototypeToken.texture.scaleY":1,
      "prototypeToken.texture.anchorX":0.5,
      "prototypeToken.texture.anchorY":0.5,
      "prototypeToken.texture.alphaThreshold":0.75,
      "prototypeToken.sight.enabled":true,
      "prototypeToken.sight.angle":360,
      "prototypeToken.sight.visionMode":"basic"
    };
  }

  function actorPatch(actor,folderId) {
    const update = {
      name:ACTOR_NAME,
      img:PORTRAIT,
      folder:folderId,

      ["flags."+FLAG+".adkCharacter"]:ROSTER_KEY,
      ["flags."+FLAG+".adkCode"]:ROSTER_CODE,
      ["flags."+FLAG+".adkPlayable"]:true,
      ["flags."+FLAG+".derkeImportVersion"]:VERSION
    };

    const flags = actor?.flags?.[FLAG] ?? {};

    if (!Object.prototype.hasOwnProperty.call(flags,"eurodollars")) {
      update["flags."+FLAG+".eurodollars"] = 0;
    }

    if (!Object.prototype.hasOwnProperty.call(flags,"ramCurrent")) {
      update["flags."+FLAG+".ramCurrent"] = 0;
    }

    // Match the lightweight OMEGA PC scaffolding without resetting live
    // progression every time the loader runs.
    update["flags."+FLAG+".adkBuilder"] = true;
    update["flags."+FLAG+".adkVersion"] = "9.0";
    update["flags."+FLAG+".adkLoadoutVersion"] = "11.0";
    update["flags."+FLAG+".chromeRulesVersion"] = "12.0";
    update["flags."+FLAG+".team"] = "OMEGA";

    if (!Object.prototype.hasOwnProperty.call(flags,"chromeCapacity")) {
      update["flags."+FLAG+".chromeCapacity"] = 3;
    }

    if (!Object.prototype.hasOwnProperty.call(flags,"chromeMax")) {
      update["flags."+FLAG+".chromeMax"] = 3;
    }

    if (!Object.prototype.hasOwnProperty.call(flags,"chromeUsed")) {
      update["flags."+FLAG+".chromeUsed"] = 0;
    }

    Object.assign(update,tokenPatch(actor));

    return update;
  }

  async function createDerke(folderId) {
    const data = {
      _id:ACTOR_ID,
      name:ACTOR_NAME,
      type:"character",
      img:PORTRAIT,
      folder:folderId,
      flags:{
        [FLAG]:{
          adkCharacter:ROSTER_KEY,
          adkCode:ROSTER_CODE,
          adkPlayable:true,
          eurodollars:0,
          ramCurrent:0,
          derkeImportVersion:VERSION
        }
      },
      prototypeToken:{
        name:ACTOR_NAME,
        actorLink:true,
        width:1,
        height:1,
        texture:{
          src:PORTRAIT,
          anchorX:0.5,
          anchorY:0.5,
          fit:"contain",
          scaleX:1,
          scaleY:1,
          tint:"#ffffff",
          alphaThreshold:0.75
        },
        sight:{
          enabled:true,
          range:0,
          angle:360,
          visionMode:"basic"
        }
      }
    };

    try {
      return await globalThis.Actor.create(
        data,
        {keepId:true}
      );
    } catch (error) {
      console.warn(
        "FEHA DERKE IMPORT // keepId create failed, retrying with generated ID",
        error
      );

      const fallback = {...data};
      delete fallback._id;

      return await globalThis.Actor.create(fallback);
    }
  }

  async function ensureCyberwareCache(actor) {
    if (!actor) return null;

    const existing =
      list(actor.items).find(item =>
        item.type === "container" &&
        (
          item.flags?.[FLAG]?.cyberStorage === true ||
          norm(item.name) === "cyberware cache"
        )
      ) ??
      null;

    if (existing) {
      const patch = {};

      if (existing.flags?.[FLAG]?.cyberStorage !== true) {
        patch["flags."+FLAG+".cyberStorage"] = true;
      }

      if (
        String(existing.flags?.[FLAG]?.ownedGearVersion ?? "") !==
        "1.0"
      ) {
        patch["flags."+FLAG+".ownedGearVersion"] = "1.0";
      }

      if (Object.keys(patch).length) {
        await existing.update(patch);
      }

      return existing;
    }

    const [created] =
      await actor.createEmbeddedDocuments(
        "Item",
        [{
          name:"Cyberware Cache",
          type:"container",
          img:"icons/containers/bags/pack-leather-black-brown.webp",
          system:{
            quantity:1,
            weight:{
              value:0,
              units:"lb"
            },
            equipped:false,
            description:{
              value:
                "<h2>Cyberware Cache</h2>"+
                "<p>A shielded neural-hardware carrier for purchased chrome, cyberdecks, support hardware, and licensed quickhacks.</p>",
              chat:""
            },
            identifier:"cyberware-cache",
            identified:true,
            container:null,
            price:{
              value:0,
              denomination:"gp"
            }
          },
          flags:{
            [FLAG]:{
              cyberStorage:true,
              ownedGearVersion:"1.0"
            }
          }
        }]
      );

    return created ?? null;
  }

  function needsBuild(actor) {
    return String(
      actor?.flags?.[FLAG]?.derkeBuildVersion ?? ""
    ) !== BUILD_VERSION;
  }

  function buildPatch() {
    return {
      ["system.abilities.str.value"]:14,
      ["system.abilities.dex.value"]:16,
      ["system.abilities.con.value"]:14,
      ["system.abilities.int.value"]:12,
      ["system.abilities.wis.value"]:13,
      ["system.abilities.cha.value"]:10,

      ["system.abilities.str.proficient"]:0,
      ["system.abilities.dex.proficient"]:1,
      ["system.abilities.con.proficient"]:1,
      ["system.abilities.int.proficient"]:0,
      ["system.abilities.wis.proficient"]:0,
      ["system.abilities.cha.proficient"]:0,

      ["system.skills.acr.value"]:2,
      ["system.skills.ani.value"]:0,
      ["system.skills.arc.value"]:0,
      ["system.skills.ath.value"]:0,
      ["system.skills.dec.value"]:0,
      ["system.skills.his.value"]:0,
      ["system.skills.ins.value"]:0,
      ["system.skills.itm.value"]:0,
      ["system.skills.inv.value"]:0,
      ["system.skills.med.value"]:0,
      ["system.skills.nat.value"]:0,
      ["system.skills.prc.value"]:0,
      ["system.skills.prf.value"]:0,
      ["system.skills.per.value"]:0,
      ["system.skills.rel.value"]:0,
      ["system.skills.slt.value"]:0,
      ["system.skills.ste.value"]:0,
      ["system.skills.sur.value"]:0,

      ["system.attributes.ac.calc"]:"flat",
      ["system.attributes.ac.flat"]:15,
      ["system.attributes.hp.max"]:24,
      ["system.attributes.hp.value"]:24,
      ["system.attributes.movement.walk"]:30,
      ["system.attributes.movement.units"]:"ft",

      ["system.resources.primary.value"]:2,
      ["system.resources.primary.max"]:0,
      ["system.resources.primary.label"]:"Power Level",
      ["system.resources.secondary.value"]:0,
      ["system.resources.secondary.max"]:0,
      ["system.resources.secondary.label"]:"",
      ["system.resources.tertiary.value"]:0,
      ["system.resources.tertiary.max"]:0,
      ["system.resources.tertiary.label"]:"Chrome",

      ["flags."+FLAG+".chromeCapacity"]:3,
      ["flags."+FLAG+".chromeMax"]:3,
      ["flags."+FLAG+".chromeUsed"]:0,
      ["flags."+FLAG+".derkeBuildVersion"]:BUILD_VERSION
    };
  }

  async function ensurePersonalFeature(actor) {
    if (!actor) return null;

    const personal =
      list(actor.items).filter(item =>
        item.type === "feat" &&
        item.flags?.[FLAG]?.kind === "personal-feature"
      );

    let feature =
      personal.find(item =>
        norm(item.name) === norm(PERSONAL_FEATURE)
      ) ??
      null;

    // Derke should have one defining personal skill, same broad structure as
    // Ponyboy's Dark Horse / Zach's Counterfighter.
    for (const item of personal) {
      if (feature && item.id === feature.id) continue;

      if (item.flags?.[FLAG]?.adkGenerated === true) {
        await item.delete();
      }
    }

    const data = {
      name:PERSONAL_FEATURE,
      type:"feat",
      img:"icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
      system:{
        description:{
          value:
            "<h2>Kinetic Shift</h2>"+
            "<p><strong>2/Long Rest.</strong> After you hit with an attack, move up to 10 ft without provoking opportunity attacks.</p>",
          chat:""
        },
        uses:{
          spent:0,
          max:"2",
          recovery:[
            {
              period:"lr",
              type:"recoverAll"
            }
          ]
        },
        activities:{},
        advancement:{},
        identifier:"kinetic-shift",
        source:{
          revision:1,
          rules:"2024"
        },
        prerequisites:{
          items:[],
          repeatable:false
        },
        properties:[],
        requirements:"",
        type:{
          value:"",
          subtype:""
        }
      },
      flags:{
        [FLAG]:{
          adkGenerated:true,
          adkBuilder:true,
          adkVersion:"9.0",
          kind:"personal-feature",
          derkeFeatureVersion:BUILD_VERSION
        }
      }
    };

    if (!feature) {
      const [created] =
        await actor.createEmbeddedDocuments(
          "Item",
          [data]
        );

      return created ?? null;
    }

    await feature.update({
      name:data.name,
      img:data.img,
      "system.description.value":data.system.description.value,
      "system.uses.max":"2",
      "system.uses.recovery":data.system.uses.recovery,
      "system.identifier":"kinetic-shift",
      ["flags."+FLAG+".adkGenerated"]:true,
      ["flags."+FLAG+".adkBuilder"]:true,
      ["flags."+FLAG+".adkVersion"]:"9.0",
      ["flags."+FLAG+".kind"]:"personal-feature",
      ["flags."+FLAG+".derkeFeatureVersion"]:BUILD_VERSION
    });

    return feature;
  }

  async function buildDerke(actor) {
    if (!actor) return false;

    if (needsBuild(actor)) {
      await actor.update(buildPatch());
    }

    await ensurePersonalFeature(actor);
    return true;
  }

  async function importDerke() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        created:false,
        repaired:false
      };
    }

    const folder = await ensurePcFolder();

    let actor = findDerke();
    let created = false;

    if (!actor) {
      actor = await createDerke(folder.id);
      created = true;
    }

    if (!actor) {
      throw new Error("Derke actor could not be created.");
    }

    await actor.update(
      actorPatch(actor,folder.id)
    );

    await ensureCyberwareCache(actor);
    await buildDerke(actor);

    try {
      globalThis.ADKChromeBackend?.refreshActors?.();
    } catch {}

    try {
      globalThis.__FEHA_PLAYABLE_ROSTER_NORMALIZER?.refresh?.();
    } catch {}

    const result = {
      skipped:false,
      created,
      repaired:true,
      built:true,
      powerLevel:2,
      personalFeature:PERSONAL_FEATURE,
      actorId:actor.id,
      name:actor.name,
      folder:folder.name,
      portrait:PORTRAIT
    };

    console.log(
      "FEHA DERKE IMPORT",
      VERSION,
      result
    );

    ui.notifications?.info?.(
      created
        ? "FEHA // Derke imported into ADK roster."
        : "FEHA // Derke actor repaired and synced with ADK."
    );

    return result;
  }

  const api = {
    version:VERSION,
    actorId:ACTOR_ID,
    rosterKey:ROSTER_KEY,
    rosterCode:ROSTER_CODE,
    portrait:PORTRAIT,
    buildVersion:BUILD_VERSION,
    personalFeature:PERSONAL_FEATURE,
    findDerke,
    buildDerke,
    importDerke,

    async init() {
      globalThis.FEHA_DERKE_IMPORT = api;
      game.adk ??= {};
      game.adk.derkeImport = api;

      // Recovery-only. Do not mutate Derke during ordinary DEV LOADER runs.
      // The four-PC sheet rebuild will own current character scaffolding.
      console.log(
        "FEHA DERKE IMPORT",
        VERSION,
        "registered // automatic legacy repair disabled"
      );
    },

    async destroy() {
      if (game?.adk?.derkeImport === api) {
        delete game.adk.derkeImport;
      }

      if (globalThis.FEHA_DERKE_IMPORT === api) {
        delete globalThis.FEHA_DERKE_IMPORT;
      }
    }
  };

  core.registerModule("derkeImport",api);
  globalThis.FEHA_DERKE_IMPORT = api;
})();
