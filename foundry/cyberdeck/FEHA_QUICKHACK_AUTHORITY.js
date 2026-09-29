// FEHA // QUICKHACK SILENT AUTHORITY
// Validated player -> GM execution bridge for Quickhack mutations.
// Players retain normal Foundry permissions; the active GM silently performs
// only the allowlisted operations defined here.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_QUICKHACK_AUTHORITY requires FEHA_CYBER_CORE.");

  const VERSION = "2.1.0";
  const FLAG = "fleshEnshrouded";
  const CH = "module.flesh-enshrouded-heart-ablaze";
  const MARK = "fehaQuickhackAuthorityV2";
  const TIMEOUT = 20000;
  const TURN_MS = 6000;

  const pending = new Map();
  const hooks = [];
  const lastCombatantByCombat = new Map();
  let socketHandler = null;
  let cleanupTimer = null;

  const ABILITY_LABELS = {
    str:"Strength",
    dex:"Dexterity",
    con:"Constitution",
    int:"Intelligence",
    wis:"Wisdom",
    cha:"Charisma"
  };

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function actorIdentity(actor) {
    return String(
      actor?.uuid ??
      actor?.id ??
      ""
    );
  }

  function runtimeActors() {
    const actors = new Map();

    for (const actor of list(game.actors)) {
      const key = actorIdentity(actor);
      if (key) actors.set(key,actor);
    }

    for (const scene of list(game.scenes)) {
      for (const token of list(scene?.tokens)) {
        const actor = token?.actor ?? null;
        const key = actorIdentity(actor);
        if (key) actors.set(key,actor);
      }
    }

    return [...actors.values()];
  }

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
            "Quickhack authority timed out. Make sure the active GM is online and running the same FEHA build."
          )
        );
      },TIMEOUT);
    });
  }

  function canonicalDefinition(item) {
    return globalThis.FEHA_QUICKHACK_CATALOG?.definition?.(item) ?? null;
  }

  function validateOperator(payload) {
    const user = game.users?.get?.(payload.userId) ?? null;
    const operator = game.actors?.get?.(payload.operatorActorId) ?? null;
    const scene = game.scenes?.get?.(payload.sceneId) ?? null;
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
    const definition = canonicalDefinition(quickhack);

    const looksQuickhack =
      flags.quickhack === true ||
      flags.isQuickhack === true ||
      flags.loadedQuickhack === true ||
      flags.quickhackLoaded === true ||
      String(flags.sourceCategory ?? "").toLowerCase() === "quickhacks" ||
      Boolean(definition);

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
      quickhack,
      definition
    };
  }

  function validateBase(payload,{targetRequired=true}={}) {
    const base = validateOperator(payload);
    const token =
      payload.targetTokenId
        ? base.scene?.tokens?.get?.(payload.targetTokenId) ?? null
        : null;

    const target = token?.actor ?? null;

    if (targetRequired && !token) {
      throw new Error("Quickhack target Token is unavailable.");
    }

    if (targetRequired && !target) {
      throw new Error("Quickhack target Actor is unavailable.");
    }

    return {
      ...base,
      token,
      target
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

  async function evaluateRoll(formula) {
    const roll = new Roll(String(formula));
    await roll.evaluate();
    return roll;
  }

  function abilityModifier(actor,key) {
    const ability = actor?.system?.abilities?.[key] ?? {};
    const prepared = Number(ability.mod);
    if (Number.isFinite(prepared)) return prepared;

    const score = Number(ability.value);
    return Number.isFinite(score)
      ? Math.floor((score - 10) / 2)
      : 0;
  }

  function actorProficiency(actor) {
    const value = Number(
      actor?.system?.attributes?.prof ??
      actor?.system?.details?.prof ??
      2
    );

    return Number.isFinite(value) ? value : 2;
  }

  function saveModifier(actor,key) {
    const ability = actor?.system?.abilities?.[key] ?? {};

    for (const candidate of [
      ability?.save?.total,
      ability?.save?.value,
      ability?.saveModifier
    ]) {
      const value = Number(candidate);
      if (Number.isFinite(value)) return value;
    }

    const mod = abilityModifier(actor,key);
    const proficiencyScale = Number(ability.proficient ?? 0);
    const prof =
      actorProficiency(actor) *
      (Number.isFinite(proficiencyScale) ? proficiencyScale : 0);

    const localBonus = Number(ability?.bonuses?.save);
    const globalBonus = Number(actor?.system?.bonuses?.abilities?.save);

    return (
      mod +
      prof +
      (Number.isFinite(localBonus) ? localBonus : 0) +
      (Number.isFinite(globalBonus) ? globalBonus : 0)
    );
  }

  async function rollSaveLocal(base,payload) {
    const key = String(payload.ability ?? "").toLowerCase();
    const definition = base.definition;
    const canonical = String(definition?.meta?.save ?? "").toLowerCase();
    const chooseAny = definition?.meta?.operatorChoosesSave === true;

    if (!ABILITY_LABELS[key]) {
      throw new Error("Invalid saving throw ability.");
    }

    if (!chooseAny && (!canonical || key !== canonical)) {
      throw new Error("That Quickhack cannot request this saving throw.");
    }

    const modifier = saveModifier(base.target,key);
    const roll = await evaluateRoll(
      "1d20" + (modifier >= 0 ? "+" : "") + modifier
    );

    const total = Number(roll.total ?? 0);

    return {
      ability:key,
      label:ABILITY_LABELS[key],
      modifier,
      die:Number(roll?.dice?.[0]?.total ?? (total - modifier)),
      total,
      formula:roll.formula
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
    const ceiling = maximum == null ? 500 : maximum;

    if (amount > ceiling) {
      throw new Error(
        "Quickhack damage exceeds the validated formula maximum."
      );
    }

    return amount;
  }

  async function rollAndApplyDamage(base,payload) {
    const key = base.definition?.key ?? "";

    if (!["synapse-burn","arc-overload"].includes(key)) {
      throw new Error(
        "This Quickhack cannot use direct damage-roll authority."
      );
    }

    const formula = String(base.definition?.meta?.damage ?? "");
    if (!formula) throw new Error("Quickhack has no canonical damage formula.");

    const factor = Number(payload.factor ?? 1);
    if (![1,0.5].includes(factor)) {
      throw new Error("Invalid Quickhack damage factor.");
    }

    if (
      factor === 0.5 &&
      base.definition?.meta?.halfOnSuccess !== true
    ) {
      throw new Error("This Quickhack cannot apply half damage.");
    }

    const roll = await evaluateRoll(formula);
    const raw = Math.max(0,Math.floor(Number(roll.total ?? 0)));
    const applied = Math.floor(raw * factor);
    const result = await damageLocal(base.target,applied);

    return {
      formula,
      type:String(base.definition?.meta?.damageType ?? "untyped"),
      raw,
      applied,
      result
    };
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
      String(flags.sourceCategory ?? "").toLowerCase() === "cyberware" ||
      Boolean(flags.cyberwareSlot) ||
      Boolean(flags.installedCyberware) ||
      Boolean(flags.cyberware)
    );
  }

  function installedCyberware(item) {
    if (!isCyberware(item)) return false;

    const flags = item?.flags?.[FLAG] ?? {};

    return (
      flags.installed !== false &&
      flags.isInstalled !== false &&
      flags.chromeLockDisabled !== true
    );
  }

  function isLegCyberware(item) {
    if (!installedCyberware(item)) return false;

    const flags = item?.flags?.[FLAG] ?? {};

    const haystack = norm([
      item?.name,
      flags.cyberwareSlot,
      flags.effectText,
      item?.system?.description?.value
    ].filter(Boolean).join(" "));

    return /leg|legs|ankle|knee|calf|tendon|locomotion|movement|reinforced tendons|fortified ankles/.test(haystack);
  }

  function isFirearm(item) {
    const flags = item?.flags?.[FLAG] ?? {};

    const haystack = norm([
      item?.name,
      item?.type,
      flags.weaponClass,
      flags.weaponType,
      flags.sourceCategory,
      item?.system?.type?.value,
      item?.system?.type?.baseItem
    ].filter(Boolean).join(" "));

    const explicit =
      flags.firearm === true ||
      /firearm|gun|pistol|revolver|rifle|shotgun|smg|submachine|sniper|launcher/.test(haystack);

    const clearlyMelee =
      /sword|knife|dagger|club|bat|axe|hammer|spear|melee/.test(haystack);

    return explicit && !clearlyMelee;
  }

  function isExplosive(item) {
    const flags = item?.flags?.[FLAG] ?? {};

    const haystack = norm([
      item?.name,
      item?.type,
      flags.weaponClass,
      flags.weaponType,
      flags.sourceCategory,
      flags.effectText,
      item?.system?.description?.value
    ].filter(Boolean).join(" "));

    return (
      flags.explosive === true ||
      /grenade|explosive|mine|charge|c4|detonator/.test(haystack)
    );
  }

  function sanitizedItem(item) {
    const flags = item?.flags?.[FLAG] ?? {};

    return {
      id:item.id,
      name:String(item.name ?? "Item"),
      img:String(item.img ?? ""),
      quantity:Math.max(
        0,
        Number(item.system?.quantity ?? 1) || 0
      ),
      equipped:
        item.system?.equipped === true ||
        flags.installed === true ||
        flags.isInstalled === true,
      installed:installedCyberware(item)
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

    let predicate = isExplosive;

    if (requested === "cyberware") predicate = isCyberware;
    if (requested === "firearms") predicate = isFirearm;

    return list(base.target.items)
      .filter(predicate)
      .map(sanitizedItem);
  }

  function targetSenses(actor) {
    const senses = actor?.system?.attributes?.senses ?? {};
    const text = norm(
      [
        senses?.special,
        senses?.value,
        actor?.system?.traits?.senses,
        actor?.system?.details?.type?.value
      ].filter(Boolean).join(" ")
    );

    const blindsight =
      Number(senses?.blindsight ?? 0) > 0 ||
      /blindsight|blind sense/.test(text);

    return {blindsight};
  }

  function inspectTarget(base) {
    const flags = base.target?.flags?.[FLAG] ?? {};
    const actorText = norm([
      base.target?.name,
      base.target?.system?.details?.type?.value,
      base.target?.system?.details?.race,
      flags.actorType
    ].filter(Boolean).join(" "));

    const hasCyberware =
      list(base.target?.items).some(installedCyberware);

    const electronic =
      flags.electronic === true ||
      flags.robot === true ||
      flags.drone === true ||
      flags.turret === true ||
      /robot|drone|turret|android|synthetic|machine|mech|camera/.test(actorText);

    const senses = targetSenses(base.target);
    const legs = list(base.target?.items).filter(isLegCyberware);

    return {
      blindsight:senses.blindsight,
      hasCyberware,
      electronic,
      cyberneticElectronic:hasCyberware || electronic,
      hasLegCyberware:legs.length > 0
    };
  }

  function statusDefinition(statusId) {
    const wanted = norm(statusId);

    return list(globalThis.CONFIG?.statusEffects)
      .find(effect => {
        const id = norm(effect?.id);
        const name = norm(effect?.name);
        return (
          id === wanted ||
          name === wanted ||
          id.includes(wanted) ||
          name.includes(wanted)
        );
      }) ?? null;
  }

  function currentCombatForScene(scene) {
    const combat = game.combat;

    if (
      !combat?.started ||
      String(combat.scene?.id ?? combat.sceneId ?? "") !== String(scene?.id ?? "")
    ) {
      return null;
    }

    return combat;
  }

  function expiryFor(base,durationTurns) {
    const turns = Math.max(1,Math.floor(Number(durationTurns) || 1));
    const combat = currentCombatForScene(base.scene);

    if (combat) {
      const currentTokenId =
        combat.combatant?.tokenId ??
        combat.current?.tokenId ??
        null;

      return {
        mode:"combat",
        combatId:combat.id,
        targetTokenId:base.token?.id ?? null,
        remainingTurnEnds:
          turns +
          (
            String(currentTokenId ?? "") ===
            String(base.token?.id ?? "")
              ? 1
              : 0
          )
      };
    }

    return {
      mode:"time",
      expiresAt:Date.now() + (turns * TURN_MS)
    };
  }

  function effectImage(base,status) {
    return (
      status?.img ??
      status?.icon ??
      base.quickhack?.img ??
      "icons/svg/aura.svg"
    );
  }

  async function removeExistingQuickhackEffect(actor,kind) {
    const effect = list(actor?.effects).find(candidate =>
      String(candidate?.flags?.[FLAG]?.quickhackEffectKind ?? "") ===
      String(kind)
    );

    if (effect) {
      try { await effect.delete(); } catch {}
    }
  }

  async function createTimedEffect(
    base,
    {
      kind,
      name,
      statusId=null,
      durationTurns=1,
      changes=[],
      extraFlags={}
    }
  ) {
    const status = statusId ? statusDefinition(statusId) : null;
    const expiry = expiryFor(base,durationTurns);

    await removeExistingQuickhackEffect(base.target,kind);

    const data = {
      name,
      img:effectImage(base,status),
      changes,
      statuses:
        status?.id
          ? [status.id]
          : [],
      flags:{
        [FLAG]:{
          quickhackTimed:true,
          quickhackEffectKind:kind,
          quickhackItemId:base.quickhack.id,
          quickhackExpiry:expiry,
          ...extraFlags
        }
      }
    };

    const created =
      await base.target.createEmbeddedDocuments(
        "ActiveEffect",
        [data]
      );

    return {
      effectId:created?.[0]?.id ?? null,
      expiry
    };
  }

  async function applyStatusLocal(base,payload) {
    const key = base.definition?.key ?? "";
    const requested = String(payload.status ?? "");

    const rules = {
      "dead-air":{
        status:"deafened",
        name:"DEAFENED // DEAD AIR",
        turns:2
      },
      "optic-zero":{
        status:"blinded",
        name:"BLINDED // OPTIC ZERO",
        turns:1
      },
      "system-collapse":{
        status:"incapacitated",
        name:"INCAPACITATED // SYSTEM COLLAPSE",
        turns:1
      },
      "synapse-burn":{
        status:"no-reactions",
        name:"NO REACTIONS // SYNAPSE BURN",
        turns:1
      },
      "arc-overload":{
        status:"no-reactions",
        name:"NO REACTIONS // ARC OVERLOAD",
        turns:1
      }
    };

    const rule = rules[key];

    if (!rule || requested !== rule.status) {
      throw new Error(
        "That status is not permitted for this Quickhack."
      );
    }

    const nativeStatus =
      ["deafened","blinded","incapacitated"].includes(rule.status)
        ? rule.status
        : null;

    return createTimedEffect(base,{
      kind:rule.status,
      name:rule.name,
      statusId:nativeStatus,
      durationTurns:rule.turns,
      extraFlags:{
        noReactions:rule.status === "no-reactions"
      }
    });
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
      ["flags."+FLAG+".brokenByQuickhack"]:true,
      ["flags."+FLAG+".brokenOriginalName"]:originalName
    });

    return sanitizedItem(item);
  }

  async function applyChromeLock(base,payload) {
    if (base.definition?.key !== "chrome-lock") {
      throw new Error("Only Chrome Lock may disable cyberware.");
    }

    const item = base.target.items?.get?.(payload.itemId) ?? null;

    if (!item || !isCyberware(item) || !installedCyberware(item)) {
      throw new Error("Selected cyberware is not currently installed.");
    }

    const f = item.flags?.[FLAG] ?? {};
    const durationTurns =
      Number(base.definition?.meta?.durationTurns ?? 1) || 1;

    const expiry = expiryFor(base,durationTurns);

    const state = {
      expiry,
      originalInstalled:f.installed,
      originalIsInstalled:f.isInstalled,
      originalSystemEquipped:item.system?.equipped
    };

    const update = {
      ["flags."+FLAG+".installed"]:false,
      ["flags."+FLAG+".isInstalled"]:false,
      ["flags."+FLAG+".chromeLockDisabled"]:true,
      ["flags."+FLAG+".chromeLockState"]:state
    };

    if (typeof item.system?.equipped === "boolean") {
      update["system.equipped"] = false;
    }

    await item.update(update);

    await createTimedEffect(base,{
      kind:"chrome-lock",
      name:"CHROME LOCK // " + String(item.name ?? "CYBERWARE"),
      durationTurns,
      extraFlags:{
        chromeLockItemId:item.id
      }
    });

    return {
      item:sanitizedItem(item),
      expiry
    };
  }

  async function restoreChromeItem(item) {
    const state =
      item?.flags?.[FLAG]?.chromeLockState ??
      null;

    if (!state) return false;

    const update = {
      ["flags."+FLAG+".installed"]:
        state.originalInstalled !== false,
      ["flags."+FLAG+".isInstalled"]:
        state.originalIsInstalled !== false,
      ["flags."+FLAG+".chromeLockDisabled"]:false
    };

    if (typeof state.originalSystemEquipped === "boolean") {
      update["system.equipped"] =
        state.originalSystemEquipped;
    }

    await item.update(update);

    try {
      await item.unsetFlag(FLAG,"chromeLockState");
    } catch {
      try {
        await item.update({
          ["flags."+FLAG+".-=chromeLockState"]:null
        });
      } catch {}
    }

    return true;
  }

  async function applyMotorLock(base) {
    if (base.definition?.key !== "motor-lock") {
      throw new Error("Only Motor Lock may set locomotion to zero.");
    }

    if (!inspectTarget(base).hasLegCyberware) {
      throw new Error(
        "Target has no installed leg cyberware."
      );
    }

    const override =
      Number(
        globalThis.CONST?.ACTIVE_EFFECT_MODES?.OVERRIDE ??
        5
      );

    const changes = [
      "walk",
      "fly",
      "swim",
      "climb",
      "burrow"
    ].map(mode => ({
      key:"system.attributes.movement." + mode,
      mode:override,
      value:0,
      priority:50
    }));

    return createTimedEffect(base,{
      kind:"motor-lock",
      name:"MOTOR LOCK // SPEED 0",
      durationTurns:1,
      changes
    });
  }

  function tokenCenter(token,scene) {
    const gridSize = Number(scene?.grid?.size ?? 100) || 100;
    const width = Number(token?.width ?? 1) || 1;
    const height = Number(token?.height ?? 1) || 1;

    return {
      x:Number(token?.x ?? 0) + (width * gridSize / 2),
      y:Number(token?.y ?? 0) + (height * gridSize / 2)
    };
  }

  function feetBetween(scene,a,b) {
    const gridSize = Number(scene?.grid?.size ?? 100) || 100;
    const gridDistance = Number(scene?.grid?.distance ?? 5) || 5;
    const pixels = Math.hypot(
      Number(a.x ?? 0) - Number(b.x ?? 0),
      Number(a.y ?? 0) - Number(b.y ?? 0)
    );

    return (pixels / gridSize) * gridDistance;
  }

  async function applyAreaDamage(base,payload) {
    if (base.definition?.key !== "toxic-bloom") {
      throw new Error("Only Toxic Bloom may use area damage authority.");
    }

    const x = Number(payload.x);
    const y = Number(payload.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Toxic Bloom placement is invalid.");
    }

    const radius =
      Number(base.definition?.meta?.radiusFt ?? 10) || 10;

    const formula =
      String(base.definition?.meta?.damage ?? "8d6");

    const roll = await evaluateRoll(formula);
    const raw = Math.max(0,Math.floor(Number(roll.total ?? 0)));
    let affectedCount = 0;

    for (const token of list(base.scene?.tokens)) {
      const actor = token?.actor ?? null;
      if (!actor) continue;

      const center = tokenCenter(token,base.scene);
      if (feetBetween(base.scene,{x,y},center) > radius) continue;

      await damageLocal(actor,raw);
      affectedCount++;
    }

    return {
      formula,
      type:String(base.definition?.meta?.damageType ?? "poison"),
      raw,
      applied:raw,
      radius,
      affectedCount
    };
  }

  async function applyCombustion(base) {
    if (base.definition?.key !== "combustion") {
      throw new Error("Only Combustion may use combustion authority.");
    }

    const primaryFormula =
      String(base.definition?.meta?.damage ?? "10d6");

    const primaryRoll = await evaluateRoll(primaryFormula);
    const primaryRaw =
      Math.max(0,Math.floor(Number(primaryRoll.total ?? 0)));

    const primaryResult =
      await damageLocal(base.target,primaryRaw);

    const reducedToZero =
      primaryResult.before.value > 0 &&
      primaryResult.after.value === 0;

    if (!reducedToZero) {
      return {
        primary:{
          formula:primaryFormula,
          raw:primaryRaw,
          applied:primaryRaw,
          result:primaryResult
        },
        exploded:false,
        burst:null
      };
    }

    const burstFormula =
      String(base.definition?.meta?.deathBurst ?? "5d6");

    const radius =
      Number(base.definition?.meta?.deathBurstRadiusFt ?? 10) || 10;

    const burstRoll = await evaluateRoll(burstFormula);
    const burstRaw =
      Math.max(0,Math.floor(Number(burstRoll.total ?? 0)));

    const origin = tokenCenter(base.token,base.scene);
    let affectedCount = 0;

    for (const token of list(base.scene?.tokens)) {
      if (String(token?.id ?? "") === String(base.token?.id ?? "")) continue;

      const actor = token?.actor ?? null;
      if (!actor) continue;

      if (
        feetBetween(
          base.scene,
          origin,
          tokenCenter(token,base.scene)
        ) > radius
      ) {
        continue;
      }

      await damageLocal(actor,burstRaw);
      affectedCount++;
    }

    return {
      primary:{
        formula:primaryFormula,
        raw:primaryRaw,
        applied:primaryRaw,
        result:primaryResult
      },
      exploded:true,
      burst:{
        formula:burstFormula,
        raw:burstRaw,
        applied:burstRaw,
        radius,
        affectedCount
      }
    };
  }

  async function useExplosive(base,payload) {
    if (base.definition?.key !== "cookoff") {
      throw new Error("Only Cookoff may detonate an explosive.");
    }

    const item = base.target.items?.get?.(payload.itemId) ?? null;

    if (!item || !isExplosive(item)) {
      throw new Error("Selected explosive is no longer available.");
    }

    const grenadeRuntime =
      globalThis.FEHA_GRENADE_RUNTIME ??
      core.module?.("grenadeRuntime") ??
      null;

    if (
      grenadeRuntime?.isGrenade?.(item) &&
      typeof grenadeRuntime.detonateCookoff === "function"
    ) {
      return grenadeRuntime.detonateCookoff({
        actor:base.target,
        item,
        scene:base.scene,
        token:base.token,
        userId:base.user?.id ?? game.user?.id ?? null
      });
    }

    let used = false;
    let error = null;

    if (typeof item.use === "function") {
      try {
        await item.use(
          {configureDialog:false},
          {configureDialog:false}
        );
        used = true;
      } catch (err) {
        error = err;
      }
    }

    if (!used && typeof item.roll === "function") {
      try {
        await item.roll({
          configureDialog:false
        });
        used = true;
      } catch (err) {
        error = err;
      }
    }

    if (!used) {
      const quantity =
        Math.max(0,Number(item.system?.quantity ?? 1) || 0);

      if (quantity > 1) {
        await item.update({
          "system.quantity":quantity - 1
        });
      } else if (quantity === 1) {
        try {
          await item.delete();
        } catch {}
      }

      try {
        await ChatMessage.create({
          speaker:ChatMessage.getSpeaker({actor:base.target}),
          content:
            "<p><strong>COOKOFF // EXPLOSIVE DETONATED</strong></p>" +
            "<p>" +
            String(item.name ?? "Explosive")
              .replace(/&/g,"&amp;")
              .replace(/</g,"&lt;")
              .replace(/>/g,"&gt;") +
            "</p>"
        });
      } catch {}

      if (error) {
        console.warn(
          "FEHA QUICKHACK AUTHORITY // explosive item use fallback",
          error
        );
      }
    }

    return {
      item:sanitizedItem(item),
      invoked:used,
      fallback:!used
    };
  }

  function expiryExpired(expiry,{combatId=null,tokenId=null,now=Date.now()}={}) {
    if (!expiry) return {
      expired:false,
      next:expiry
    };

    if (expiry.mode === "time") {
      return {
        expired:
          Number(expiry.expiresAt ?? Infinity) <= now,
        next:expiry
      };
    }

    if (
      expiry.mode === "combat" &&
      combatId &&
      tokenId &&
      String(expiry.combatId ?? "") === String(combatId) &&
      String(expiry.targetTokenId ?? "") === String(tokenId)
    ) {
      const remaining =
        Math.max(
          0,
          Math.floor(Number(expiry.remainingTurnEnds ?? 0)) - 1
        );

      return {
        expired:remaining <= 0,
        next:{
          ...expiry,
          remainingTurnEnds:remaining
        }
      };
    }

    return {
      expired:false,
      next:expiry
    };
  }

  async function processActorExpiry(
    actor,
    {
      combatId=null,
      tokenId=null,
      now=Date.now()
    }={}
  ) {
    if (!actor) return;

    for (const effect of list(actor.effects)) {
      const f = effect?.flags?.[FLAG] ?? {};
      if (f.quickhackTimed !== true) continue;

      const state =
        expiryExpired(
          f.quickhackExpiry,
          {combatId,tokenId,now}
        );

      if (state.expired) {
        try { await effect.delete(); } catch {}
      } else if (
        state.next &&
        state.next !== f.quickhackExpiry &&
        state.next.remainingTurnEnds !==
          f.quickhackExpiry?.remainingTurnEnds
      ) {
        try {
          await effect.update({
            ["flags."+FLAG+".quickhackExpiry"]:state.next
          });
        } catch {}
      }
    }

    for (const item of list(actor.items)) {
      const state =
        item?.flags?.[FLAG]?.chromeLockState ??
        null;

      if (!state?.expiry) continue;

      const next =
        expiryExpired(
          state.expiry,
          {combatId,tokenId,now}
        );

      if (next.expired) {
        try {
          await restoreChromeItem(item);
        } catch (err) {
          console.warn(
            "FEHA QUICKHACK AUTHORITY // Chrome Lock restore failed",
            item?.name,
            err
          );
        }
      } else if (
        next.next &&
        next.next.remainingTurnEnds !==
          state.expiry?.remainingTurnEnds
      ) {
        try {
          await item.update({
            ["flags."+FLAG+".chromeLockState"]:{
              ...state,
              expiry:next.next
            }
          });
        } catch {}
      }
    }
  }

  async function processCombatTurnEnd(combat,tokenId) {
    if (!game.user?.isGM || !combat || !tokenId) return;

    const combatant =
      list(combat.combatants)
        .find(entry =>
          String(entry?.tokenId ?? "") === String(tokenId)
        ) ??
      null;

    const actor = combatant?.actor ?? null;

    if (actor) {
      await processActorExpiry(actor,{
        combatId:combat.id,
        tokenId
      });
    }
  }

  function currentCombatTokenId(combat) {
    return (
      combat?.combatant?.tokenId ??
      combat?.current?.tokenId ??
      null
    );
  }

  async function onCombatUpdate(combat,changed) {
    if (!game.user?.isGM) return;

    const advanced =
      Object.prototype.hasOwnProperty.call(changed ?? {},"turn") ||
      Object.prototype.hasOwnProperty.call(changed ?? {},"round");

    const currentTokenId =
      currentCombatTokenId(combat);

    if (advanced) {
      const previousTokenId =
        combat?.previous?.tokenId ??
        (
          combat?.previous?.combatantId
            ? combat.combatants?.get?.(
                combat.previous.combatantId
              )?.tokenId
            : null
        ) ??
        lastCombatantByCombat.get(combat.id) ??
        null;

      if (previousTokenId) {
        await processCombatTurnEnd(
          combat,
          previousTokenId
        );
      }
    }

    lastCombatantByCombat.set(
      combat.id,
      currentTokenId
    );
  }

  async function cleanupExpiredByTime() {
    if (!game.user?.isGM) return;

    const now = Date.now();

    for (const actor of runtimeActors()) {
      await processActorExpiry(actor,{now});
    }
  }

  async function executeLocal(action,payload) {
    const targetless =
      action === "area-damage";

    const base =
      validateBase(
        payload,
        {targetRequired:!targetless}
      );

    switch (String(action ?? "")) {
      case "damage": {
        const amount =
          validateDamageAmount(base,payload);

        return damageLocal(
          base.target,
          amount
        );
      }

      case "roll-save": {
        return rollSaveLocal(base,payload);
      }

      case "inspect-target": {
        return inspectTarget(base);
      }

      case "list-items": {
        return {
          items:listTargetItems(
            base,
            payload.kind
          )
        };
      }

      case "mark-broken": {
        return {
          item:await renameBroken(
            base,
            payload
          )
        };
      }

      case "chrome-lock": {
        return applyChromeLock(
          base,
          payload
        );
      }

      case "motor-lock": {
        return applyMotorLock(base);
      }

      case "apply-status": {
        return applyStatusLocal(
          base,
          payload
        );
      }

      case "damage-roll": {
        return rollAndApplyDamage(
          base,
          payload
        );
      }

      case "area-damage": {
        return applyAreaDamage(
          base,
          payload
        );
      }

      case "combustion": {
        return applyCombustion(base);
      }

      case "use-explosive": {
        return useExplosive(
          base,
          payload
        );
      }

      default:
        throw new Error(
          "Unsupported Quickhack authority operation."
        );
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
      return executeLocal(
        action,
        {
          ...full,
          userId:game.user.id
        }
      );
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

    if (
      kind !== "request" ||
      !game.user?.isGM
    ) {
      return;
    }

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
      const result =
        await executeLocal(
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
        error:String(
          error?.message ??
          error
        )
      });
    }
  }

  function reactionLocked(actor) {
    if (!actor) return false;

    return list(actor.effects).some(effect =>
      effect?.flags?.[FLAG]?.noReactions === true
    );
  }

  function activityActor(activity) {
    return (
      activity?.actor ??
      activity?.item?.actor ??
      activity?.item?.parent ??
      null
    );
  }

  function reactionActivity(activity) {
    const type =
      String(
        activity?.activation?.type ??
        activity?.system?.activation?.type ??
        activity?.item?.system?.activation?.type ??
        ""
      ).toLowerCase();

    return type.startsWith("reaction");
  }

  function installHooks() {
    if (!globalThis.Hooks?.on) return;

    hooks.push([
      "dnd5e.preUseActivity",
      globalThis.Hooks.on(
        "dnd5e.preUseActivity",
        activity => {
          if (!reactionActivity(activity)) return true;

          const actor = activityActor(activity);
          if (!reactionLocked(actor)) return true;

          ui.notifications?.warn?.(
            String(actor?.name ?? "Target")+
            " cannot take reactions right now."
          );

          return false;
        }
      )
    ]);

    hooks.push([
      "updateCombat",
      globalThis.Hooks.on(
        "updateCombat",
        (combat,changed) => {
          void onCombatUpdate(
            combat,
            changed
          );
        }
      )
    ]);

    hooks.push([
      "deleteCombat",
      globalThis.Hooks.on(
        "deleteCombat",
        combat => {
          lastCombatantByCombat.delete(
            combat?.id
          );
        }
      )
    ]);
  }

  function removeHooks() {
    for (const [name,id] of hooks.splice(0)) {
      try {
        globalThis.Hooks?.off?.(
          name,
          id
        );
      } catch {}
    }
  }

  const api = {
    version:VERSION,
    authorityGM,
    request,

    damage(payload={}) {
      return request(
        "damage",
        payload
      );
    },

    rollSave(payload={}) {
      return request(
        "roll-save",
        payload
      );
    },

    inspectTarget(payload={}) {
      return request(
        "inspect-target",
        payload
      );
    },

    listTargetItems(payload={}) {
      return request(
        "list-items",
        payload
      );
    },

    markBroken(payload={}) {
      return request(
        "mark-broken",
        payload
      );
    },

    chromeLock(payload={}) {
      return request(
        "chrome-lock",
        payload
      );
    },

    motorLock(payload={}) {
      return request(
        "motor-lock",
        payload
      );
    },

    applyStatus(payload={}) {
      return request(
        "apply-status",
        payload
      );
    },

    damageRoll(payload={}) {
      return request(
        "damage-roll",
        payload
      );
    },

    areaDamage(payload={}) {
      return request(
        "area-damage",
        payload
      );
    },

    combustion(payload={}) {
      return request(
        "combustion",
        payload
      );
    },

    useExplosive(payload={}) {
      return request(
        "use-explosive",
        payload
      );
    },

    async init() {
      if (socketHandler) {
        try {
          game.socket?.off?.(
            CH,
            socketHandler
          );
        } catch {}
      }

      socketHandler = receive;
      game.socket?.on?.(
        CH,
        socketHandler
      );

      installHooks();

      if (game.user?.isGM) {
        const combat = game.combat;

        if (combat?.id) {
          lastCombatantByCombat.set(
            combat.id,
            currentCombatTokenId(combat)
          );
        }

        cleanupTimer =
          setInterval(
            () => void cleanupExpiredByTime(),
            2000
          );

        void cleanupExpiredByTime();
      }

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
          game.socket?.off?.(
            CH,
            socketHandler
          );
        } catch {}
      }

      socketHandler = null;

      for (const resolver of [...pending.values()]) {
        try {
          resolver.cancel?.();
        } catch {}
      }

      pending.clear();
      removeHooks();

      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }

      lastCombatantByCombat.clear();

      if (
        game?.adk?.quickhackAuthority === api
      ) {
        delete game.adk.quickhackAuthority;
      }

      if (
        globalThis.FEHA_QUICKHACK_AUTHORITY === api
      ) {
        delete globalThis.FEHA_QUICKHACK_AUTHORITY;
      }
    }
  };

  core.registerModule(
    "quickhackAuthority",
    api
  );

  globalThis.FEHA_QUICKHACK_AUTHORITY = api;
})();
