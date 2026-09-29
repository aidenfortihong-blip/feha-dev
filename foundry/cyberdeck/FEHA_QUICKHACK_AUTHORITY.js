// FEHA // QUICKHACK SILENT AUTHORITY
// Validated player -> GM execution bridge for Quickhack mutations.
// Players never receive GM permissions; the active GM silently performs allowlisted operations.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_QUICKHACK_AUTHORITY requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const CH = "module.flesh-enshrouded-heart-ablaze";
  const MARK = "fehaQuickhackAuthorityV1";
  const TIMEOUT = 15000;

  const pending = new Map();
  let socketHandler = null;

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

  const rid = () =>
    globalThis.foundry?.utils?.randomID?.() ??
    globalThis.crypto?.randomUUID?.() ??
    String(Date.now()) + Math.random().toString(36);

  const ownerLevel = () =>
    Number(globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3);

  function owns(user,document) {
    if (!user || !document) return false;
    if (user.isGM) return true;

    try {
      if (typeof document.testUserPermission === "function") {
        return document.testUserPermission(user,ownerLevel());
      }
    } catch {}

    const ownership = document.ownership ?? document.permission ?? {};
    return Number(
      ownership[user.id] ??
      ownership.default ??
      0
    ) >= ownerLevel();
  }

  function authorityGM() {
    return (
      game.users?.activeGM ??
      list(game.users)
        .filter(user => user?.isGM && user?.active)
        .sort((a,b) => String(a.id).localeCompare(String(b.id)))[0] ??
      null
    );
  }

  function emit(kind,payload={}) {
    game.socket?.emit?.(CH,{
      [MARK]:true,
      kind,
      payload
    });
  }

  function wait(requestId) {
    let timer = null;

    return new Promise((resolve,reject) => {
      const settle = payload => {
        clearTimeout(timer);

        if (pending.get(requestId) === settle) {
          pending.delete(requestId);
        }

        if (payload?.error) {
          reject(new Error(String(payload.error)));
        } else {
          resolve(payload?.result ?? null);
        }
      };

      settle.cancel = () =>
        settle({
          error:"Quickhack authority reloaded before the request completed."
        });

      pending.set(requestId,settle);

      timer = setTimeout(() => {
        if (pending.get(requestId) !== settle) return;
        pending.delete(requestId);
        reject(
          new Error(
            "Quickhack authority timed out. Make sure the GM client is online and running the same FEHA build."
          )
        );
      },TIMEOUT);
    });
  }

  function canonicalDefinition(item) {
    return globalThis.FEHA_QUICKHACK_CATALOG?.definition?.(item) ?? null;
  }

  function validateBase(payload) {
    const user = game.users?.get?.(payload.userId) ?? null;
    const operator = game.actors?.get?.(payload.operatorActorId) ?? null;
    const scene = game.scenes?.get?.(payload.sceneId) ?? null;
    const token = scene?.tokens?.get?.(payload.targetTokenId) ?? null;
    const target = token?.actor ?? null;
    const quickhack = operator?.items?.get?.(payload.quickhackItemId) ?? null;

    if (!user?.active) {
      throw new Error("Requesting player is no longer online.");
    }

    if (!operator) {
      throw new Error("Quickhack operator Actor is unavailable.");
    }

    if (!scene) {
      throw new Error("Quickhack Scene is unavailable.");
    }

    if (!token) {
      throw new Error("Quickhack target Token is unavailable.");
    }

    if (!target) {
      throw new Error("Quickhack target Actor is unavailable.");
    }

    if (!quickhack) {
      throw new Error("Quickhack software is unavailable.");
    }

    const assignedRaw = user.character ?? null;
    const assignedId =
      typeof assignedRaw === "string"
        ? assignedRaw
        : assignedRaw?.id ?? null;

    if (
      !owns(user,operator) &&
      String(assignedId ?? "") !== String(operator.id)
    ) {
      throw new Error(
        "Requesting player is not authorized for the Quickhack operator."
      );
    }

    const flags = quickhack.flags?.[FLAG] ?? {};
    const looksQuickhack =
      flags.quickhack === true ||
      flags.isQuickhack === true ||
      flags.loadedQuickhack === true ||
      flags.quickhackLoaded === true ||
      String(flags.sourceCategory ?? "").toLowerCase() === "quickhacks" ||
      Boolean(canonicalDefinition(quickhack));

    if (!looksQuickhack) {
      throw new Error("Selected software is not a Quickhack.");
    }

    const loaded =
      flags.loadedQuickhack === true ||
      flags.quickhackLoaded === true ||
      flags.loaded === true;

    if (!loaded) {
      throw new Error("Quickhack is no longer loaded.");
    }

    return {
      user,
      operator,
      scene,
      token,
      target,
      quickhack,
      definition:canonicalDefinition(quickhack)
    };
  }

  function hp(actor) {
    const data = actor?.system?.attributes?.hp ?? {};

    return {
      value:Math.max(0,Number(data.value ?? 0)),
      max:Math.max(0,Number(data.max ?? 0)),
      temp:Math.max(0,Number(data.temp ?? 0))
    };
  }

  async function damageLocal(actor,amount) {
    const damage = Math.max(
      0,
      Math.floor(Number(amount) || 0)
    );

    const before = hp(actor);
    let remaining = damage;
    let temp = before.temp;
    let value = before.value;

    const tempSpent = Math.min(temp,remaining);
    temp -= tempSpent;
    remaining -= tempSpent;
    value = Math.max(0,value - remaining);

    const update = {
      "system.attributes.hp.value":value
    };

    if (temp !== before.temp) {
      update["system.attributes.hp.temp"] = temp;
    }

    await actor.update(update);

    return {
      damage,
      before,
      after:{
        value,
        max:before.max,
        temp
      }
    };
  }

  function formulaMaximum(formula) {
    const match = String(formula ?? "")
      .replace(/\s+/g,"")
      .match(/^(\d+)d(\d+)([+-]\d+)?$/i);

    if (!match) return null;

    const count = Math.max(0,Number(match[1]) || 0);
    const faces = Math.max(0,Number(match[2]) || 0);
    const bonus = Number(match[3] ?? 0) || 0;

    return Math.max(0,(count * faces) + bonus);
  }

  function validateDamageAmount(base,payload) {
    const amount = Math.max(
      0,
      Math.floor(Number(payload.damage) || 0)
    );

    const formula =
      base.definition?.meta?.damage ??
      null;

    const maximum = formulaMaximum(formula);

    // Canonical damage Quickhacks are bounded by their actual dice formula.
    // Legacy/non-catalog hacks keep a conservative ceiling rather than exposing
    // an arbitrary GM update pipe to player clients.
    const ceiling =
      maximum == null
        ? 500
        : maximum;

    if (amount > ceiling) {
      throw new Error(
        "Quickhack damage exceeds the validated formula maximum."
      );
    }

    return amount;
  }

  function itemCategory(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    return norm(
      flags.sourceCategory ??
      flags.category ??
      item?.type ??
      ""
    );
  }

  function isCyberware(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    return (
      itemCategory(item) === "cyberware" ||
      Boolean(flags.cyberwareSlot) ||
      Boolean(flags.installedCyberware) ||
      Boolean(flags.cyberware)
    );
  }

  function isFirearm(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    const haystack = norm([
      item?.name,
      flags.weaponClass,
      flags.weaponType,
      flags.sourceCategory,
      item?.system?.type?.value,
      item?.system?.type?.baseItem
    ].filter(Boolean).join(" "));

    return (
      itemCategory(item) === "weapons" &&
      (
        /firearm|gun|pistol|revolver|rifle|shotgun|smg|sniper|launcher/.test(haystack) ||
        flags.firearm === true
      )
    );
  }

  function isExplosive(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    const haystack = norm([
      item?.name,
      flags.weaponClass,
      flags.weaponType,
      flags.sourceCategory,
      flags.effectText
    ].filter(Boolean).join(" "));

    return (
      flags.explosive === true ||
      /grenade|explosive|mine|charge/.test(haystack)
    );
  }

  function sanitizedItem(item) {
    return {
      id:item.id,
      name:String(item.name ?? "Item"),
      img:String(item.img ?? ""),
      quantity:Math.max(
        0,
        Number(item.system?.quantity ?? 1) || 0
      ),
      equipped:Boolean(item.system?.equipped)
    };
  }

  function listTargetItems(base,kind) {
    const key = base.definition?.key ?? "";
    const requested = norm(kind);

    const allowed =
      (key === "chrome-lock" && requested === "cyberware") ||
      (key === "dead-trigger" && requested === "firearms") ||
      (key === "cookoff" && requested === "explosives");

    if (!allowed) {
      throw new Error(
        "That Quickhack cannot inspect this target inventory category."
      );
    }

    const predicate =
      requested === "cyberware"
        ? isCyberware
        : requested === "firearms"
          ? isFirearm
          : isExplosive;

    return list(base.target.items)
      .filter(predicate)
      .map(sanitizedItem);
  }

  async function renameBroken(base,payload) {
    if (base.definition?.key !== "dead-trigger") {
      throw new Error("Only Dead Trigger may break a firearm.");
    }

    const item = base.target.items?.get?.(payload.itemId) ?? null;

    if (!item || !isFirearm(item)) {
      throw new Error("Selected firearm is no longer available.");
    }

    if (/^BROKEN\s*\/\//i.test(String(item.name ?? ""))) {
      return sanitizedItem(item);
    }

    const originalName = String(item.name ?? "Firearm");

    await item.update({
      name:"BROKEN // " + originalName,
      [`flags.${FLAG}.brokenByQuickhack`]:true,
      [`flags.${FLAG}.brokenOriginalName`]:originalName
    });

    return sanitizedItem(item);
  }

  async function setCyberwareEquipped(base,payload) {
    if (base.definition?.key !== "chrome-lock") {
      throw new Error("Only Chrome Lock may change cyberware equipment state.");
    }

    const item = base.target.items?.get?.(payload.itemId) ?? null;

    if (!item || !isCyberware(item)) {
      throw new Error("Selected cyberware is no longer available.");
    }

    const equipped = Boolean(payload.equipped);

    await item.update({
      "system.equipped":equipped,
      [`flags.${FLAG}.chromeLockDisabled`]:!equipped
    });

    return sanitizedItem(item);
  }

  async function executeLocal(action,payload) {
    const base = validateBase(payload);

    switch (String(action ?? "")) {
      case "damage": {
        const amount = validateDamageAmount(base,payload);
        return damageLocal(base.target,amount);
      }

      case "list-items": {
        return {
          items:listTargetItems(base,payload.kind)
        };
      }

      case "mark-broken": {
        return {
          item:await renameBroken(base,payload)
        };
      }

      case "set-cyberware-equipped": {
        return {
          item:await setCyberwareEquipped(base,payload)
        };
      }

      default:
        throw new Error("Unsupported Quickhack authority operation.");
    }
  }

  async function request(action,payload={}) {
    const sceneId =
      payload.sceneId ??
      canvas?.scene?.id ??
      null;

    const full = {
      ...payload,
      sceneId
    };

    if (game.user?.isGM) {
      return executeLocal(action,{
        ...full,
        userId:game.user.id
      });
    }

    const gm = authorityGM();

    if (!gm) {
      throw new Error(
        "No online GM authority is available for this Quickhack."
      );
    }

    const requestId = rid();

    const promise = wait(requestId);

    emit("request",{
      requestId,
      userId:game.user.id,
      gmId:gm.id,
      action:String(action),
      payload:full
    });

    return promise;
  }

  async function receive(message) {
    if (!message?.[MARK]) return;

    const kind = message.kind;
    const data = message.payload ?? {};

    if (kind === "response") {
      if (
        String(data.userId ?? "") !==
        String(game.user?.id ?? "")
      ) {
        return;
      }

      pending.get(data.requestId)?.(data);
      return;
    }

    if (kind !== "request" || !game.user?.isGM) return;

    const preferred = authorityGM();

    if (
      data.gmId &&
      String(data.gmId) !== String(game.user.id)
    ) {
      return;
    }

    if (
      !data.gmId &&
      preferred &&
      String(preferred.id) !== String(game.user.id)
    ) {
      return;
    }

    try {
      const result = await executeLocal(
        data.action,
        {
          ...(data.payload ?? {}),
          userId:data.userId
        }
      );

      emit("response",{
        requestId:data.requestId,
        userId:data.userId,
        result
      });
    } catch (error) {
      emit("response",{
        requestId:data.requestId,
        userId:data.userId,
        error:String(error?.message ?? error)
      });
    }
  }

  const api = {
    version:VERSION,
    authorityGM,

    request,

    damage(payload={}) {
      return request("damage",payload);
    },

    listTargetItems(payload={}) {
      return request("list-items",payload);
    },

    markBroken(payload={}) {
      return request("mark-broken",payload);
    },

    setCyberwareEquipped(payload={}) {
      return request("set-cyberware-equipped",payload);
    },

    async init() {
      if (socketHandler) {
        try {
          game.socket?.off?.(CH,socketHandler);
        } catch {}
      }

      socketHandler = receive;
      game.socket?.on?.(CH,socketHandler);

      globalThis.FEHA_QUICKHACK_AUTHORITY = api;
      game.adk ??= {};
      game.adk.quickhackAuthority = api;

      console.log(
        "FEHA QUICKHACK AUTHORITY",
        VERSION,
        "ready // silent GM execution enabled"
      );
    },

    async destroy() {
      if (socketHandler) {
        try {
          game.socket?.off?.(CH,socketHandler);
        } catch {}
      }

      socketHandler = null;

      for (const resolver of [...pending.values()]) {
        try { resolver.cancel?.(); } catch {}
      }

      pending.clear();

      if (game?.adk?.quickhackAuthority === api) {
        delete game.adk.quickhackAuthority;
      }

      if (globalThis.FEHA_QUICKHACK_AUTHORITY === api) {
        delete globalThis.FEHA_QUICKHACK_AUTHORITY;
      }
    }
  };

  core.registerModule("quickhackAuthority",api);
  globalThis.FEHA_QUICKHACK_AUTHORITY = api;
})();
