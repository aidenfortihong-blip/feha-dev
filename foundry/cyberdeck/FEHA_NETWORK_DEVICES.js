// FEHA // NETWORK DEVICES
// Data-driven Network Entity registry + scene scanners.
// No UI or action logic belongs in this file.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_NETWORK_DEVICES requires FEHA_CYBER_CORE.");

  const VERSION = "0.10.2";
  const FLAG_SCOPE = "fleshEnshrouded";
  const DEVICE_FLAG = "networkDevice";
  const SCENE_DEVICE_FLAG = "networkDevices";

  const SECURITY = Object.freeze({
    0:{label:"UNSECURED",dc:0},
    1:{label:"BASIC",dc:10},
    2:{label:"SECURED",dc:12},
    3:{label:"HARDENED",dc:14},
    4:{label:"CENTRAL",dc:16},
    5:{label:"CORE",dc:18},
    6:{label:"EXCEPTIONAL",dc:20}
  });

  const CAPABILITIES = Object.freeze({
    ROTATE:{label:"ROTATE",group:"physical"},
    DISABLE:{label:"DISABLE",group:"state"},
    ENABLE:{label:"ENABLE",group:"state"},
    OPEN:{label:"OPEN",group:"door"},
    CLOSE:{label:"CLOSE",group:"door"},
    LOCK:{label:"LOCK",group:"door"},
    UNLOCK:{label:"UNLOCK",group:"door"},
    TAKEOVER:{label:"TAKE CONTROL",group:"turret"},
    FIRE:{label:"FIRE",group:"turret"},
    REVEAL_NETWORK:{label:"REVEAL NETWORK",group:"intel"},
    DOWNLOAD_DATA:{label:"DOWNLOAD DATA",group:"intel"},
    TRIGGER:{label:"TRIGGER",group:"alarm"},
    POWER_OFF:{label:"POWER OFF",group:"power"},
    POWER_ON:{label:"POWER ON",group:"power"},
    OVERLOAD:{label:"OVERLOAD",group:"power"},
    CONTROL_SUBSYSTEM:{label:"CONTROL SUBSYSTEM",group:"system"}
  });

  const ACCESS_SCOPES = Object.freeze({
    endpoint:{
      label:"ENDPOINT",
      dcMod:0,
      description:"One physical device."
    },
    local:{
      label:"LOCAL",
      dcMod:1,
      description:"A small cluster or one local controller."
    },
    subsystem:{
      label:"SUBSYSTEM",
      dcMod:2,
      description:"One meaningful security/building subsystem."
    },
    building:{
      label:"BUILDING",
      dcMod:3,
      description:"Broad control across the current site."
    },
    core:{
      label:"CORE",
      dcMod:5,
      description:"High-value central infrastructure."
    }
  });

  const TYPES = Object.freeze({
    door:{
      label:"DOOR",
      icon:"fa-solid fa-door-open",
      baseDC:12,
      defaultScope:"endpoint",
      capabilities:["OPEN","CLOSE","LOCK","UNLOCK"]
    },
    turret:{
      label:"TURRET",
      icon:"fa-solid fa-crosshairs",
      baseDC:15,
      defaultScope:"endpoint",
      capabilities:["DISABLE","ENABLE","ROTATE","TAKEOVER"]
    },
    terminal:{
      label:"TERMINAL",
      icon:"fa-solid fa-terminal",
      baseDC:15,
      defaultScope:"subsystem",
      capabilities:["REVEAL_NETWORK","DOWNLOAD_DATA"]
    },
    alarm:{
      label:"ALARM",
      icon:"fa-solid fa-bell",
      baseDC:13,
      defaultScope:"endpoint",
      capabilities:["DISABLE","ENABLE","TRIGGER"]
    },
    lights:{
      label:"LIGHTING",
      icon:"fa-solid fa-lightbulb",
      baseDC:10,
      defaultScope:"endpoint",
      capabilities:["POWER_OFF","POWER_ON","OVERLOAD"]
    },
    system:{
      label:"SYSTEM",
      icon:"fa-solid fa-network-wired",
      baseDC:16,
      defaultScope:"building",
      capabilities:["REVEAL_NETWORK","CONTROL_SUBSYSTEM"]
    }
  });

  const norm = value => String(value ?? "").trim().toLowerCase();
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  function collectionContents(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  }

  function sceneRect(scene) {
    return (
      scene?.dimensions?.sceneRect ??
      canvas?.dimensions?.sceneRect ??
      {x:0,y:0,width:1,height:1}
    );
  }

  function toPercent(scene,x,y) {
    const rect = sceneRect(scene);
    const width = Math.max(1,Number(rect.width)||1);
    const height = Math.max(1,Number(rect.height)||1);

    return {
      xPct:clamp(((Number(x)-Number(rect.x??0))/width)*100,0,100),
      yPct:clamp(((Number(y)-Number(rect.y??0))/height)*100,0,100)
    };
  }

  function centerForDocument(scene,doc) {
    const name = String(doc?.documentName ?? doc?.constructor?.name ?? "");

    if (/Wall/i.test(name)) {
      const c = doc?.c ?? doc?.coordinates ?? doc?._source?.c ?? [];
      if (Array.isArray(c) && c.length >= 4) {
        return {
          x:(Number(c[0])+Number(c[2]))/2,
          y:(Number(c[1])+Number(c[3]))/2
        };
      }
    }

    if (/AmbientLight/i.test(name)) {
      return {x:Number(doc?.x??0),y:Number(doc?.y??0)};
    }

    if (/Tile/i.test(name)) {
      return {
        x:Number(doc?.x??0)+(Number(doc?.width??0)/2),
        y:Number(doc?.y??0)+(Number(doc?.height??0)/2)
      };
    }

    if (/Token/i.test(name)) {
      const gridSize = Math.max(
        1,
        Number(scene?.grid?.size ?? canvas?.grid?.size ?? canvas?.dimensions?.size ?? 100)||100
      );

      return {
        x:Number(doc?.x??0)+(Number(doc?.width??1)*gridSize/2),
        y:Number(doc?.y??0)+(Number(doc?.height??1)*gridSize/2)
      };
    }

    return {
      x:Number(doc?.x??0),
      y:Number(doc?.y??0)
    };
  }

  function typeDef(type) {
    return TYPES[norm(type)] ?? TYPES.system;
  }

  function normalizeScope(scope,type=null) {
    const requested = norm(scope);
    if (ACCESS_SCOPES[requested]) return requested;

    const fallback = typeDef(type)?.defaultScope ?? "endpoint";
    return ACCESS_SCOPES[fallback] ? fallback : "endpoint";
  }

  function suggestedDC(type,scope=null) {
    const def = typeDef(type);
    const accessScope = normalizeScope(scope,type);
    const base = Number(def.baseDC ?? def.defaultDC ?? 12) || 12;
    const modifier = Number(ACCESS_SCOPES[accessScope]?.dcMod ?? 0) || 0;
    return Math.max(0,Math.floor(base + modifier));
  }

  function securityLabel(dc) {
    const value = Number(dc)||0;
    const entries = Object.values(SECURITY);
    return entries.reduce((best,current) =>
      Math.abs(current.dc-value) < Math.abs(best.dc-value)
        ? current
        : best
    ,entries[0]).label;
  }

  function defaultCapabilities(type) {
    return [...(typeDef(type).capabilities ?? [])];
  }

  function sanitizeCapabilities(type,values) {
    const provided = Array.isArray(values) ? values : [];
    const clean = provided
      .map(value => String(value ?? "").trim().toUpperCase())
      .filter(value => CAPABILITIES[value]);

    return clean.length ? [...new Set(clean)] : defaultCapabilities(type);
  }

  function cloneObject(value) {
    if (!value || typeof value !== "object") return {};
    try { return structuredClone(value); }
    catch { return JSON.parse(JSON.stringify(value)); }
  }

  function makeRecord({
    id,
    sceneId,
    type,
    name,
    xPct,
    yPct,
    securityDC,
    capabilities,
    sourceUuid=null,
    sourceType=null,
    sourceId=null,
    discoveredBy=[],
    state={},
    origin="scene",
    metadata={},
    accessScope=null
  }) {
    const key = norm(type) || "system";
    const def = typeDef(key);
    const scope = normalizeScope(accessScope ?? metadata?.accessScope,key);
    const dc = Number.isFinite(Number(securityDC))
      ? Math.max(0,Math.floor(Number(securityDC)))
      : suggestedDC(key,scope);

    return {
      id:String(id),
      sceneId:String(sceneId ?? ""),
      type:key,
      typeLabel:def.label,
      icon:def.icon,
      name:String(name || def.label),
      xPct:clamp(Number(xPct)||0,0,100),
      yPct:clamp(Number(yPct)||0,0,100),
      securityDC:dc,
      securityLabel:securityLabel(dc),
      accessScope:scope,
      accessScopeLabel:ACCESS_SCOPES[scope]?.label ?? "ENDPOINT",
      capabilities:sanitizeCapabilities(key,capabilities),
      sourceUuid:sourceUuid ? String(sourceUuid) : null,
      sourceType:sourceType ? String(sourceType) : null,
      sourceId:sourceId ? String(sourceId) : null,
      discoveredBy:Array.isArray(discoveredBy) ? [...new Set(discoveredBy.map(String))] : [],
      state:cloneObject(state),
      origin:String(origin),
      metadata:cloneObject(metadata)
    };
  }

  function readDeviceFlag(doc) {
    try {
      return doc?.getFlag?.(FLAG_SCOPE,DEVICE_FLAG) ??
        doc?.flags?.[FLAG_SCOPE]?.[DEVICE_FLAG] ??
        null;
    } catch {
      return null;
    }
  }

  function taggedRecord(scene,doc,origin="tagged") {
    const flag = readDeviceFlag(doc);
    if (!flag || flag === false) return null;

    const config = flag === true ? {} : flag;
    if (config?.enabled === false) return null;

    const type = norm(config?.type ?? config?.deviceType ?? "system");
    const center = centerForDocument(scene,doc);
    const pos = toPercent(scene,center.x,center.y);

    return makeRecord({
      id:config?.id ?? ("doc:"+(doc.uuid ?? doc.id)),
      sceneId:scene.id,
      type,
      name:config?.name ?? doc.name ?? typeDef(type).label,
      xPct:config?.xPct ?? pos.xPct,
      yPct:config?.yPct ?? pos.yPct,
      securityDC:config?.securityDC ?? config?.dc,
      accessScope:config?.accessScope ?? config?.scope,
      capabilities:config?.capabilities,
      sourceUuid:doc.uuid ?? null,
      sourceType:doc.documentName ?? null,
      sourceId:doc.id ?? null,
      discoveredBy:Array.isArray(config?.discoveredBy)
        ? config.discoveredBy
        : [],
      state:config?.state ?? {},
      origin,
      metadata:config?.metadata ?? {}
    });
  }

  function isDoorWall(wall) {
    const raw = Number(wall?.door ?? wall?._source?.door ?? 0);
    return Number.isFinite(raw) && raw > 0;
  }

  function doorRecord(scene,wall) {
    if (!isDoorWall(wall)) return null;

    const center = centerForDocument(scene,wall);
    const pos = toPercent(scene,center.x,center.y);
    const flag = readDeviceFlag(wall);
    const config = flag && typeof flag === "object" ? flag : {};

    const doorType = Number(
      wall?.door ??
      wall?._source?.door ??
      0
    );

    const secretType = Number(
      globalThis.CONST?.WALL_DOOR_TYPES?.SECRET ??
      2
    );

    const discoveredBy = Array.isArray(config?.discoveredBy)
      ? config.discoveredBy
      : [];

    if (
      doorType === secretType &&
      !game.user?.isGM &&
      !discoveredBy.includes(game.user?.id)
    ) {
      return null;
    }

    return makeRecord({
      id:config?.id ?? ("door:"+wall.id),
      sceneId:scene.id,
      type:"door",
      name:config?.name ?? wall.name ?? ("DOOR "+String(wall.id).slice(0,4).toUpperCase()),
      xPct:pos.xPct,
      yPct:pos.yPct,
      securityDC:config?.securityDC ?? config?.dc ?? suggestedDC("door","endpoint"),
      accessScope:config?.accessScope ?? config?.scope ?? "endpoint",
      capabilities:config?.capabilities ?? defaultCapabilities("door"),
      sourceUuid:wall.uuid ?? null,
      sourceType:wall.documentName ?? "Wall",
      sourceId:wall.id,
      discoveredBy:config?.discoveredBy ?? [],
      state:config?.state ?? {},
      origin:"foundry-door",
      metadata:{
        ...(config?.metadata ?? {}),
        doorState:Number(wall?.ds ?? wall?._source?.ds ?? 0)
      }
    });
  }

  function visibleToCurrentUser(record) {
    if (!record) return false;
    if (game.user?.isGM) return true;

    const discoveredBy = Array.isArray(record.discoveredBy)
      ? record.discoveredBy
      : [];

    return (
      discoveredBy.length === 0 ||
      discoveredBy.includes(game.user?.id)
    );
  }

  function customRecords(scene) {
    let raw = [];

    try {
      raw =
        scene?.getFlag?.(FLAG_SCOPE,SCENE_DEVICE_FLAG) ??
        scene?.flags?.[FLAG_SCOPE]?.[SCENE_DEVICE_FLAG] ??
        [];
    } catch {}

    if (!Array.isArray(raw)) return [];

    return raw.map((record,index) =>
      makeRecord({
        ...record,
        id:record?.id ?? ("custom:"+scene.id+":"+index),
        sceneId:scene.id,
        origin:record?.origin ?? "custom"
      })
    );
  }

  function scanScene(scene=canvas?.scene) {
    if (!scene) return [];

    const records = new Map();

    for (const wall of collectionContents(scene.walls)) {
      const door = doorRecord(scene,wall);

      if (door) {
        // Door-specific normalization already consumes the networkDevice flag.
        // Do not create a second tagged endpoint for the same Wall.
        records.set(door.id,door);
        continue;
      }

      const tagged = taggedRecord(scene,wall,"tagged-wall");
      if (tagged && visibleToCurrentUser(tagged)) {
        records.set(tagged.id,tagged);
      }
    }

    for (const token of collectionContents(scene.tokens)) {
      const tagged = taggedRecord(scene,token,"tagged-token");
      if (tagged && visibleToCurrentUser(tagged)) {
        records.set(tagged.id,tagged);
      }
    }

    for (const tile of collectionContents(scene.tiles)) {
      const tagged = taggedRecord(scene,tile,"tagged-tile");
      if (tagged && visibleToCurrentUser(tagged)) {
        records.set(tagged.id,tagged);
      }
    }

    for (const light of collectionContents(scene.lights)) {
      const tagged = taggedRecord(scene,light,"tagged-light");
      if (tagged && visibleToCurrentUser(tagged)) {
        records.set(tagged.id,tagged);
      }
    }

    for (const record of customRecords(scene)) {
      // Camera was fully removed in 0.10.2. Ignore any legacy Scene records
      // left behind by earlier development builds.
      if (record?.type === "camera") continue;

      if (visibleToCurrentUser(record)) {
        records.set(record.id,record);
      }
    }

    return [...records.values()];
  }

  // "fleshEnshrouded" is a flag namespace, not a package id, so
  // Document#setFlag rejects it ("Flag scope ... is not valid"). Write the
  // flag path directly, like the rest of FEHA.
  async function writeSceneDevices(scene,records) {
    return scene.update({
      ["flags."+FLAG_SCOPE+"."+SCENE_DEVICE_FLAG]:records
    });
  }

  async function revealCustomDevices(sceneId,userId=game.user?.id) {
    if (!game.user?.isGM && userId !== game.user?.id) {
      throw new Error("Cannot reveal Network Devices for another user.");
    }

    const scene = game.scenes?.get?.(sceneId);
    if (!scene) throw new Error("Network Device scene not found.");

    const current = customRecords(scene);
    let changed = 0;

    const next = current.map(record => {
      const discoveredBy = new Set(record.discoveredBy ?? []);

      if (!discoveredBy.has(userId)) {
        discoveredBy.add(userId);
        changed++;
      }

      return {
        ...record,
        discoveredBy:[...discoveredBy]
      };
    });

    if (changed) {
      await writeSceneDevices(scene,next);

      await core.emit(
        "devices:changed",
        {
          sceneId,
          revealedFor:userId,
          count:changed
        }
      );
    }

    return changed;
  }

  async function upsertCustomDevice(sceneId,input) {
    if (!game.user?.isGM) {
      throw new Error("Only a GM may persist Network Devices.");
    }

    const scene = game.scenes?.get?.(sceneId);
    if (!scene) throw new Error("Network Device scene not found.");

    const current = customRecords(scene);
    const randomId =
      foundry?.utils?.randomID?.() ??
      (crypto?.randomUUID?.() ?? String(Date.now()));

    const record = makeRecord({
      ...input,
      sceneId,
      id:input?.id ?? ("custom:"+randomId)
    });

    const index = current.findIndex(entry => entry.id === record.id);
    if (index >= 0) current[index] = record;
    else current.push(record);

    await writeSceneDevices(scene,current);

    await core.emit("devices:changed",{sceneId,record});
    return record;
  }

  async function removeCustomDevice(sceneId,id) {
    if (!game.user?.isGM) {
      throw new Error("Only a GM may remove Network Devices.");
    }

    const scene = game.scenes?.get?.(sceneId);
    if (!scene) return false;

    const next = customRecords(scene).filter(record => record.id !== id);
    await writeSceneDevices(scene,next);
    await core.emit("devices:changed",{sceneId,removedId:id});
    return true;
  }

  const api = {
    version:VERSION,
    security:SECURITY,
    accessScopes:ACCESS_SCOPES,
    capabilities:CAPABILITIES,
    types:TYPES,
    typeDef,
    normalizeScope,
    suggestedDC,
    securityLabel,
    defaultCapabilities,
    makeRecord,
    scanScene,
    visibleToCurrentUser,
    revealCustomDevices,
    upsertCustomDevice,
    removeCustomDevice,

    async init() {
      console.log("FEHA NETWORK DEVICES",VERSION,"ready");
    },

    async destroy() {
      if (globalThis.FEHA_NETWORK_DEVICES === api) {
        delete globalThis.FEHA_NETWORK_DEVICES;
      }
    }
  };

  core.registerModule("devices",api);
  globalThis.FEHA_NETWORK_DEVICES = api;
})();
