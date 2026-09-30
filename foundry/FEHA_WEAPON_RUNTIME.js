// FEHA // WEAPON RUNTIME OBSERVER
// Build 0.11.51 foundation: diagnostics only. This module never mutates
// Actors, Items, Tokens, Combat, rolls, or activity configuration.

(() => {
  try { globalThis.FEHA_WEAPON_RUNTIME?.destroy?.(); } catch {}

  const core = globalThis.FEHA_CYBER_CORE;
  const catalog = globalThis.FEHA_WEAPON_CATALOG;

  if (!core) throw new Error("FEHA_WEAPON_RUNTIME requires FEHA_CYBER_CORE.");
  if (!catalog) throw new Error("FEHA_WEAPON_RUNTIME requires FEHA_WEAPON_CATALOG.");

  const VERSION = "0.1.0";
  const BUILD = "0.11.51";
  const FLAG = "fleshEnshrouded";
  const MAX_DIAGNOSTICS = 500;

  const hooks = [];
  const timers = new Set();
  const entries = [];
  const tokenPositions = new Map();
  const capacityStates = new Map();
  const pendingDamage = new Map();
  const pendingDamageByOptions = new WeakMap();
  const recentAppliedDamage = new Map();
  const pendingAttacks = new Map();

  const featureState = Object.freeze({
    deadSilent:Object.freeze({
      label:"Kurohane Dead Silent",
      implemented:false,
      enabled:false
    }),
    cunningAction:Object.freeze({
      label:"Vektor Cunning Action",
      implemented:false,
      enabled:false
    }),
    forgeLineAnchor:Object.freeze({
      label:"ForgeLine Anchor",
      implemented:false,
      enabled:false
    }),
    selfChargingCell:Object.freeze({
      label:"Helix Self-Charging Cell",
      implemented:false,
      enabled:false
    }),
    ramThief:Object.freeze({
      label:"Corvus RAM Thief",
      implemented:false,
      enabled:false
    }),
    actionSurge:Object.freeze({
      label:"Bastion Action Surge",
      implemented:false,
      enabled:false
    }),
    arcChain:Object.freeze({
      label:"Jade Arc Arc Chain",
      implemented:false,
      enabled:false
    })
  });

  let initialized = false;
  let destroyed = false;
  let diagnosticsEnabled = true;
  let sequence = 0;
  let activeTurn = null;

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const numberOrNull = value => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  function copy(value) {
    if (value === undefined) return undefined;
    try { return globalThis.structuredClone(value); } catch {}
    try { return JSON.parse(JSON.stringify(value)); } catch {}
    return value;
  }

  function identity(document) {
    if (!document) return null;
    return {
      id:String(document.id ?? "") || null,
      uuid:String(document.uuid ?? "") || null,
      name:String(document.name ?? "") || null
    };
  }

  function actorIdentity(actor) {
    if (!actor) return null;
    return {
      ...identity(actor),
      type:String(actor.type ?? "") || null
    };
  }

  function actorKey(actor) {
    return String(actor?.uuid ?? actor?.id ?? "");
  }

  function itemKey(item) {
    return String(item?.uuid ?? item?.id ?? "");
  }

  function tokenDocument(token) {
    return token?.document ?? token ?? null;
  }

  function tokenIdentity(token) {
    const document = tokenDocument(token);
    const actor = token?.actor ?? document?.actor ?? null;
    if (!document) return null;
    return {
      ...identity(document),
      actor:actorIdentity(actor),
      sceneId:String(document.parent?.id ?? document.scene?.id ?? "") || null
    };
  }

  function hpSnapshot(actor) {
    const hp = actor?.system?.attributes?.hp ?? {};
    return {
      value:numberOrNull(hp.value),
      max:numberOrNull(hp.max),
      temp:numberOrNull(hp.temp),
      tempmax:numberOrNull(hp.tempmax)
    };
  }

  function activityItem(activity) {
    if (activity?.item) return activity.item;
    if (activity?.parent?.documentName === "Item") return activity.parent;
    return null;
  }

  function activityActor(activity) {
    const item = activityItem(activity);
    return (
      activity?.actor ??
      item?.actor ??
      (item?.parent?.documentName === "Actor" ? item.parent : null) ??
      null
    );
  }

  function activityIdentity(activity) {
    if (!activity) return null;
    return {
      id:String(activity.id ?? "") || null,
      uuid:String(activity.uuid ?? "") || null,
      name:String(activity.name ?? activity.label ?? "") || null,
      type:String(activity.type ?? activity.constructor?.metadata?.type ?? "") || null
    };
  }

  function canonicalDefinition(item) {
    if (!item || item.type !== "weapon") return null;
    const flags = item.flags?.[FLAG] ?? {};
    return (
      catalog.definition?.(item) ??
      catalog.definition?.(flags.weaponCatalogKey) ??
      null
    );
  }

  function firearmIdentity(item) {
    if (!item || item.type !== "weapon") return null;

    const flags = item.flags?.[FLAG] ?? {};
    const definition = canonicalDefinition(item);
    const kind = String(
      definition
        ? (definition.weaponClass === "Bow" ? "bow" : "firearm")
        : (flags.weaponKind ?? "")
    ).toLowerCase();

    const managed = Boolean(
      definition ||
      flags.weaponCatalogKey ||
      flags.doTheseFinalized === true ||
      flags.weaponReadiness === "done"
    );

    if (!managed || kind !== "firearm") return null;

    return {
      ...identity(item),
      catalogKey:String(definition?.key ?? flags.weaponCatalogKey ?? "") || null,
      manufacturer:String(
        definition?.company ??
        flags.manufacturer ??
        flags.company ??
        flags.weaponGroup ??
        ""
      ) || null,
      weaponClass:String(definition?.weaponClass ?? flags.weaponClass ?? "") || null,
      technology:String(
        definition?.technology ??
        flags.weaponTechnology ??
        flags.weaponSystem ??
        ""
      ) || null,
      equipped:item.system?.equipped === true
    };
  }

  function equippedFirearms(actor) {
    return list(actor?.items)
      .filter(item => item?.system?.equipped === true)
      .map(firearmIdentity)
      .filter(Boolean);
  }

  function capacitySnapshot(item) {
    const firearm = firearmIdentity(item);
    if (!firearm) return null;

    const flags = item.flags?.[FLAG] ?? {};
    const definition = canonicalDefinition(item);
    const uses = item.system?.uses ?? {};
    const usesValue = numberOrNull(uses.value);
    const usesSpent = numberOrNull(uses.spent);
    const usesMax = numberOrNull(uses.max);
    const derivedRemaining =
      usesValue !== null
        ? usesValue
        : (
            usesSpent !== null && usesMax !== null
              ? Math.max(0,usesMax - usesSpent)
              : null
          );

    return {
      item:firearm,
      capacityType:String(definition?.capacityType ?? flags.capacityType ?? "") || null,
      canonicalPhysicalMaximum:numberOrNull(
        definition?.physicalCapacity ?? flags.physicalMagazine
      ),
      canonicalFunctionalMaximum:numberOrNull(
        definition?.functionalAttacks ??
        flags.functionalMagazine ??
        flags.magazineSize
      ),
      systemUses:{
        value:usesValue,
        spent:usesSpent,
        max:usesMax,
        remaining:derivedRemaining
      },
      itemQuantity:numberOrNull(item.system?.quantity),
      currentCapacityKnown:derivedRemaining !== null,
      note:
        derivedRemaining !== null
          ? "Current value observed from system.uses."
          : "Catalog values are maxima only; current magazine/charge is not represented on this Item."
    };
  }

  function bonusActionState(actor,stamp=activeTurn?.stamp ?? null) {
    const flags = actor?.flags?.[FLAG] ?? {};
    const usedStamp = String(flags.bonusActionTurnStamp ?? "") || null;
    return {
      tracked:Boolean(usedStamp),
      usedStamp,
      source:String(flags.bonusActionSource ?? "") || null,
      usedThisTurn:Boolean(stamp && usedStamp === stamp),
      quickhackTurnStamp:String(flags.quickhackTurnStamp ?? "") || null
    };
  }

  function targetIdentity(target) {
    const document = tokenDocument(target);
    const actor = target?.actor ?? document?.actor ?? null;
    if (!document && !actor) return null;
    return {
      token:document ? identity(document) : null,
      actor:actorIdentity(actor)
    };
  }

  function selectedTargets(usageConfig=null) {
    const candidates = [];
    const add = value => {
      for (const target of list(value)) candidates.push(target);
    };

    add(usageConfig?.targets);
    add(usageConfig?.target?.tokens);
    add(game.user?.targets);

    const unique = new Map();
    for (const target of candidates) {
      const result = targetIdentity(target);
      if (!result) continue;
      const key = String(result.token?.uuid ?? result.token?.id ?? result.actor?.uuid ?? result.actor?.id ?? "");
      if (key && !unique.has(key)) unique.set(key,result);
    }

    return [...unique.values()];
  }

  function combatStamp(combat) {
    if (!combat?.id) return null;
    return [combat.id,combat.round ?? 0,combat.turn ?? -1].join(":");
  }

  function combatantActor(combat) {
    return combat?.combatant?.actor ?? combat?.combatant?.token?.actor ?? null;
  }

  function turnSnapshot(combat) {
    const stamp = combatStamp(combat);
    const actor = combatantActor(combat);
    const combatant = combat?.combatant ?? null;
    if (!stamp || !actor) return null;
    const firearms = equippedFirearms(actor);
    return {
      combatId:String(combat.id),
      round:Number(combat.round ?? 0),
      turn:Number(combat.turn ?? -1),
      stamp,
      combatantId:String(combatant?.id ?? "") || null,
      actor:actorIdentity(actor),
      token:tokenIdentity(combatant?.token),
      moved:false,
      equippedFirearms:firearms,
      equippedFirearmAmbiguous:firearms.length > 1,
      bonusAction:bonusActionState(actor,stamp)
    };
  }

  function turnContext() {
    return activeTurn ? copy(activeTurn) : null;
  }

  function rollSummary(roll) {
    const options = roll?.options ?? {};
    return {
      total:numberOrNull(roll?.total),
      formula:String(roll?.formula ?? roll?._formula ?? "") || null,
      advantage:Boolean(options.advantage),
      disadvantage:Boolean(options.disadvantage),
      critical:Boolean(options.critical),
      fumble:Boolean(options.fumble),
      attackMode:String(options.attackMode ?? "") || null,
      ammunitionId:String(options.ammunition ?? "") || null
    };
  }

  function summarizeUpdates(updates) {
    if (!updates || typeof updates !== "object") return [];
    const out = [];
    const walk = (value,path,depth) => {
      if (out.length >= 40 || depth > 4) return;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        out.push({path,value:copy(value)});
        return;
      }
      for (const [key,child] of Object.entries(value)) {
        walk(child,path ? path+"."+key : key,depth+1);
      }
    };
    walk(updates,"",0);
    return out;
  }

  function resolveUuid(uuid) {
    if (!uuid) return null;
    try { return globalThis.fromUuidSync?.(uuid,{strict:false}) ?? null; } catch {}
    try { return globalThis.fromUuidSync?.(uuid) ?? null; } catch {}
    return null;
  }

  function damageSource(options={}) {
    const message = options?.originatingMessage ?? null;
    const safely = callback => {
      try { return callback?.() ?? null; } catch { return null; }
    };
    const candidates = [
      {item:options?.item,path:"options.item"},
      {item:options?.activity?.item,path:"options.activity.item"},
      {item:safely(() => message?.getAssociatedItem?.()),path:"originatingMessage.getAssociatedItem"},
      {item:safely(() => message?.getAssociatedActivity?.()?.item),path:"originatingMessage.getAssociatedActivity.item"}
    ];

    try {
      const origin = message?.getOriginatingMessage?.();
      if (origin && origin !== message) {
        candidates.push({
          item:origin.getAssociatedItem?.(),
          path:"originatingMessage.getOriginatingMessage.getAssociatedItem"
        });
      }
    } catch {}

    const uuid =
      message?.flags?.dnd5e?.item?.uuid ??
      safely(() => message?.getFlag?.("dnd5e","item.uuid")) ??
      null;
    if (uuid) candidates.push({item:resolveUuid(uuid),path:"flags.dnd5e.item.uuid"});

    for (const candidate of candidates) {
      let firearm = null;
      try { firearm = firearmIdentity(candidate.item); } catch {}
      if (firearm) {
        return {
          firearm,
          path:candidate.path,
          messageId:String(message?.id ?? "") || null,
          confirmed:true
        };
      }
    }

    return {
      firearm:null,
      path:null,
      messageId:String(message?.id ?? "") || null,
      confirmed:false
    };
  }

  function diagnosticLabel(type) {
    return {
      "weapon-use":"FEHA WEAPON OBSERVER // USE START",
      "attack-roll":"FEHA WEAPON OBSERVER // FIRE",
      "turn-moved":"FEHA TURN // MOVED",
      damage:"FEHA DAMAGE",
      "kill-confirmed":"FEHA KILL // CONFIRMED",
      rest:"FEHA REST",
      "capacity-change":"FEHA WEAPON OBSERVER // CAPACITY"
    }[type] ?? null;
  }

  function record(type,payload={}) {
    const entry = {
      sequence:++sequence,
      timestamp:new Date().toISOString(),
      type:String(type),
      ...copy(payload)
    };

    entries.push(entry);
    if (entries.length > MAX_DIAGNOSTICS) {
      entries.splice(0,entries.length - MAX_DIAGNOSTICS);
    }

    const label = diagnosticLabel(entry.type);
    if (diagnosticsEnabled && label) console.info(label,copy(entry));
    return entry;
  }

  function rememberCapacity(item) {
    const state = capacitySnapshot(item);
    const key = itemKey(item);
    if (state && key) capacityStates.set(key,state);
    return state;
  }

  function seedCapacityStates() {
    capacityStates.clear();
    for (const actor of list(game.actors)) {
      for (const item of list(actor?.items)) rememberCapacity(item);
    }
  }

  function rememberToken(token) {
    const document = tokenDocument(token);
    const key = String(document?.uuid ?? document?.id ?? "");
    if (!key) return;
    tokenPositions.set(key,{
      x:numberOrNull(document.x),
      y:numberOrNull(document.y),
      elevation:numberOrNull(document.elevation)
    });
  }

  function seedTokenPositions() {
    tokenPositions.clear();
    for (const scene of list(game.scenes)) {
      for (const token of list(scene?.tokens)) rememberToken(token);
    }
  }

  function installHook(event,handler) {
    hooks.push([event,Hooks.on(event,handler)]);
  }

  function onCombatUpdate(combat) {
    const next = turnSnapshot(combat);
    const nextStamp = next?.stamp ?? null;
    const previousStamp = activeTurn?.stamp ?? null;
    if (nextStamp === previousStamp) return;

    if (activeTurn) record("turn-end",{turn:turnContext()});
    activeTurn = next;
    if (activeTurn) record("turn-start",{turn:turnContext()});
  }

  function onCombatDelete(combat) {
    if (String(activeTurn?.combatId ?? "") !== String(combat?.id ?? "")) return;
    record("combat-end",{turn:turnContext()});
    activeTurn = null;
  }

  function onTokenUpdate(token,changed,options,userId) {
    const moved = ["x","y","elevation"].some(key =>
      Object.prototype.hasOwnProperty.call(changed ?? {},key)
    );
    if (!moved) return;

    const document = tokenDocument(token);
    const key = String(document?.uuid ?? document?.id ?? "");
    const before = key ? copy(tokenPositions.get(key) ?? null) : null;
    const after = {
      x:numberOrNull(changed?.x ?? document?.x),
      y:numberOrNull(changed?.y ?? document?.y),
      elevation:numberOrNull(changed?.elevation ?? document?.elevation)
    };
    if (key) tokenPositions.set(key,after);

    const actor = token?.actor ?? document?.actor ?? null;
    const activeTokenKey = String(activeTurn?.token?.uuid ?? activeTurn?.token?.id ?? "");
    const movedTokenKey = String(document?.uuid ?? document?.id ?? "");
    const isActive = activeTokenKey
      ? activeTokenKey === movedTokenKey
      : Boolean(
          activeTurn?.actor &&
          actor &&
          (
            String(activeTurn.actor.uuid ?? "") === String(actor.uuid ?? "") ||
            String(activeTurn.actor.id ?? "") === String(actor.id ?? "")
          )
        );
    if (!isActive) return;

    activeTurn.moved = true;
    record("turn-moved",{
      turn:turnContext(),
      actor:actorIdentity(actor),
      token:tokenIdentity(token),
      before,
      after,
      userId:String(userId ?? "") || null,
      reliability:before ? "observer-cache-before-and-document-after" : "document-after-only"
    });
  }

  function weaponContext(activity,usageConfig=null) {
    const item = activityItem(activity);
    const firearm = firearmIdentity(item);
    if (!firearm) return null;
    const actor = activityActor(activity);
    const firearms = equippedFirearms(actor);
    return {
      actor:actorIdentity(actor),
      weapon:firearm,
      activity:activityIdentity(activity),
      targets:selectedTargets(usageConfig),
      targetReliability:"selected targets at hook time; not confirmed hits",
      capacity:capacitySnapshot(item),
      equippedFirearms:firearms,
      equippedFirearmAmbiguous:firearms.length > 1,
      bonusAction:bonusActionState(actor),
      turn:turnContext()
    };
  }

  function attackKey(activity) {
    const actor = activityActor(activity);
    return [actorKey(actor),activity?.uuid ?? activity?.id ?? itemKey(activityItem(activity))].join(":");
  }

  function onPreUseActivity(activity,usageConfig) {
    const context = weaponContext(activity,usageConfig);
    if (!context) return;
    record("weapon-use",{
      ...context,
      stage:"pre-use",
      reliability:"dnd5e.preUseActivity"
    });
  }

  function onPostUseActivity(activity,usageConfig,results) {
    const context = weaponContext(activity,usageConfig);
    if (!context) return;
    record("weapon-use-complete",{
      ...context,
      stage:"post-use",
      messageId:String(results?.message?.id ?? "") || null,
      reliability:"dnd5e.postUseActivity"
    });
  }

  function ammoPlan(activity,ammoUpdate) {
    if (!ammoUpdate) return null;
    const actor = activityActor(activity);
    const ammo = actor?.items?.get?.(ammoUpdate.id) ?? null;
    return {
      item:identity(ammo) ?? {id:String(ammoUpdate.id ?? "") || null,uuid:null,name:null},
      quantityBefore:numberOrNull(ammo?.system?.quantity),
      quantityAfter:numberOrNull(ammoUpdate.quantity),
      destroy:Boolean(ammoUpdate.destroy),
      reliability:"native dnd5e ammunition update"
    };
  }

  function onRollAttack(rolls,data={}) {
    const activity = data?.subject ?? null;
    const context = weaponContext(activity);
    if (!context) return;
    const ammunition = ammoPlan(activity,data?.ammoUpdate);
    pendingAttacks.set(attackKey(activity),{ammunition});
    record("attack-roll",{
      ...context,
      rolls:list(rolls).map(rollSummary),
      ammunition,
      resultReliability:"roll total and roll options only; hit/miss is not confirmed by this hook",
      reliability:"dnd5e.rollAttack before native ammunition consumption"
    });
  }

  function onPostRollAttack(rolls,data={}) {
    const activity = data?.subject ?? null;
    const context = weaponContext(activity);
    if (!context) return;
    const key = attackKey(activity);
    const pending = pendingAttacks.get(key) ?? null;
    pendingAttacks.delete(key);

    const actor = activityActor(activity);
    const ammoId = pending?.ammunition?.item?.id ?? null;
    const ammo = ammoId ? actor?.items?.get?.(ammoId) ?? null : null;
    const ammunition = pending?.ammunition
      ? {
          ...pending.ammunition,
          quantityObservedAfter:numberOrNull(ammo?.system?.quantity),
          destroyedAfter:Boolean(ammoId && !ammo)
        }
      : null;

    record("attack-roll-complete",{
      ...context,
      rolls:list(rolls).map(rollSummary),
      ammunition,
      capacity:capacitySnapshot(activityItem(activity)),
      reliability:"dnd5e.postRollAttack after native ammunition consumption"
    });
  }

  function onRollDamage(rolls,data={}) {
    const activity = data?.subject ?? null;
    const context = weaponContext(activity);
    if (!context) return;
    record("damage-roll",{
      ...context,
      rolls:list(rolls).map(rollSummary),
      targetApplicationConfirmed:false,
      reliability:"dnd5e.rollDamage confirms the roll, not which target receives it"
    });
  }

  function onPostActivityConsumption(activity,usageConfig,messageConfig,updates) {
    const context = weaponContext(activity,usageConfig);
    if (!context) return;
    record("activity-consumption",{
      ...context,
      appliedUpdates:summarizeUpdates(updates),
      messageId:String(
        messageConfig?.data?._id ??
        messageConfig?.data?.id ??
        messageConfig?.data?.flags?.dnd5e?.originatingMessage ??
        ""
      ) || null,
      capacityAfter:capacitySnapshot(activityItem(activity)),
      reliability:"dnd5e.postActivityConsumption after activity resource updates"
    });
  }

  function onPreApplyDamage(actor,amount,updates,options={}) {
    const key = actorKey(actor);
    if (!key) return;
    const queue = pendingDamage.get(key) ?? [];
    const pending = {
      before:hpSnapshot(actor),
      projectedAfter:{
        value:numberOrNull(updates?.["system.attributes.hp.value"]),
        temp:numberOrNull(updates?.["system.attributes.hp.temp"]),
        tempmax:numberOrNull(updates?.["system.attributes.hp.tempmax"])
      },
      amount:numberOrNull(amount),
      source:damageSource(options),
      queuedAt:Date.now()
    };
    queue.push(pending);
    if (options && typeof options === "object") {
      pendingDamageByOptions.set(options,pending);
    }
    if (queue.length > 20) queue.splice(0,queue.length - 20);
    pendingDamage.set(key,queue);
  }

  function onApplyDamage(actor,amount,options={}) {
    const key = actorKey(actor);
    const queue = pendingDamage.get(key) ?? [];
    const exact =
      options && typeof options === "object"
        ? pendingDamageByOptions.get(options) ?? null
        : null;
    const pending = exact ?? queue[0] ?? null;
    const pendingIndex = queue.indexOf(pending);
    if (pendingIndex >= 0) queue.splice(pendingIndex,1);
    if (options && typeof options === "object") {
      pendingDamageByOptions.delete(options);
    }
    if (queue.length) pendingDamage.set(key,queue);
    else pendingDamage.delete(key);

    const before = pending?.before ?? null;
    const after = hpSnapshot(actor);
    const source = damageSource(options);
    const resolvedSource = source.confirmed ? source : (pending?.source ?? source);
    const zeroTransition = Boolean(
      before?.value !== null &&
      after.value !== null &&
      before.value > 0 &&
      after.value <= 0
    );
    const payload = {
      actor:actorIdentity(actor),
      hpBefore:before,
      hpAfter:after,
      amount:numberOrNull(amount) ?? pending?.amount ?? null,
      projectedAfter:pending?.projectedAfter ?? null,
      source:resolvedSource.firearm,
      sourcePath:resolvedSource.path,
      sourceConfirmed:resolvedSource.confirmed === true,
      zeroHpTransition:zeroTransition,
      turn:turnContext(),
      reliability:"dnd5e.preApplyDamage plus dnd5e.applyDamage"
    };

    record("damage",payload);
    recentAppliedDamage.set(key,{at:Date.now(),afterValue:after.value});

    if (zeroTransition && resolvedSource.confirmed && resolvedSource.firearm) {
      record("kill-confirmed",{
        actor:actorIdentity(actor),
        hpBefore:before,
        hpAfter:after,
        weapon:resolvedSource.firearm,
        sourcePath:resolvedSource.path,
        turn:turnContext(),
        reliability:"0 HP transition and canonical firearm source confirmed by damage application"
      });
    } else if (zeroTransition) {
      record("zero-hp-transition",{
        actor:actorIdentity(actor),
        hpBefore:before,
        hpAfter:after,
        sourceConfirmed:false,
        turn:turnContext(),
        reliability:"0 HP transition confirmed; responsible weapon unknown"
      });
    }
  }

  function onDamageActor(actor,changes,changed,userId) {
    const key = actorKey(actor);
    if (!key) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (destroyed) return;

      const after = hpSnapshot(actor);
      const recent = recentAppliedDamage.get(key);
      if (
        recent &&
        Date.now() - recent.at < 1000 &&
        recent.afterValue === after.value
      ) return;

      const hpChange = numberOrNull(changes?.hp);
      const tempChange = numberOrNull(changes?.temp);
      const before = {
        ...after,
        value:
          after.value !== null && hpChange !== null
            ? after.value - hpChange
            : null,
        temp:
          after.temp !== null && tempChange !== null
            ? after.temp - tempChange
            : null
      };
      const zeroTransition = Boolean(
        before.value !== null &&
        after.value !== null &&
        before.value > 0 &&
        after.value <= 0
      );

      record("damage",{
        actor:actorIdentity(actor),
        hpBefore:before,
        hpAfter:after,
        amount:numberOrNull(changes?.total) === null
          ? null
          : -Number(changes.total),
        update:summarizeUpdates(changed),
        source:null,
        sourcePath:null,
        sourceConfirmed:false,
        zeroHpTransition:zeroTransition,
        userId:String(userId ?? "") || null,
        turn:turnContext(),
        reliability:"dnd5e.damageActor confirms HP delta; source is unavailable"
      });

      if (zeroTransition) {
        record("zero-hp-transition",{
          actor:actorIdentity(actor),
          hpBefore:before,
          hpAfter:after,
          sourceConfirmed:false,
          turn:turnContext(),
          reliability:"0 HP transition confirmed; responsible weapon unknown"
        });
      }
    },0);
    timers.add(timer);
  }

  function onItemUpdate(item,changed,options,userId) {
    const firearm = firearmIdentity(item);
    if (!firearm) return;
    const key = itemKey(item);
    const before = key ? copy(capacityStates.get(key) ?? null) : null;
    const after = capacitySnapshot(item);
    if (key && after) capacityStates.set(key,after);

    const relevant = summarizeUpdates(changed).filter(entry =>
      /(^|\.)(uses|quantity|equipped)(\.|$)/i.test(entry.path)
    );
    const beforeRemaining = before?.systemUses?.remaining ?? null;
    const afterRemaining = after?.systemUses?.remaining ?? null;
    const remainingChanged =
      beforeRemaining !== null &&
      afterRemaining !== null &&
      beforeRemaining !== afterRemaining;

    if (!relevant.length && !remainingChanged) return;
    record("capacity-change",{
      weapon:firearm,
      before,
      after,
      changed:relevant,
      direction:
        remainingChanged
          ? (afterRemaining > beforeRemaining ? "increase" : "decrease")
          : "unknown",
      reloadOrRechargeConfirmed:false,
      userId:String(userId ?? "") || null,
      reliability:
        "Item update observed; an increase can suggest reload/recharge but does not identify the operation"
    });
  }

  function onItemCreate(item) {
    rememberCapacity(item);
  }

  function onItemDelete(item) {
    const key = itemKey(item);
    if (key) capacityStates.delete(key);
  }

  function onRestCompleted(actor,result,config) {
    const type = String(result?.type ?? config?.type ?? "") || null;
    record("rest",{
      actor:actorIdentity(actor),
      restType:type,
      shortRest:type === "short",
      longRest:type === "long",
      result:{
        newDay:Boolean(result?.newDay),
        hitPoints:numberOrNull(result?.deltas?.hitPoints ?? result?.dhp),
        hitDice:numberOrNull(result?.deltas?.hitDice ?? result?.dhd)
      },
      equippedFirearms:equippedFirearms(actor),
      capacities:list(actor?.items).map(capacitySnapshot).filter(Boolean),
      bonusAction:bonusActionState(actor),
      reliability:"dnd5e.restCompleted after native short/long rest updates"
    });
  }

  function installHooks() {
    if (hooks.length) return;
    installHook("updateCombat",onCombatUpdate);
    installHook("deleteCombat",onCombatDelete);
    installHook("updateToken",onTokenUpdate);
    installHook("updateItem",onItemUpdate);
    installHook("createItem",onItemCreate);
    installHook("deleteItem",onItemDelete);
    installHook("dnd5e.preUseActivity",onPreUseActivity);
    installHook("dnd5e.postUseActivity",onPostUseActivity);
    installHook("dnd5e.rollAttack",onRollAttack);
    installHook("dnd5e.postRollAttack",onPostRollAttack);
    installHook("dnd5e.rollDamage",onRollDamage);
    installHook("dnd5e.postActivityConsumption",onPostActivityConsumption);
    installHook("dnd5e.preApplyDamage",onPreApplyDamage);
    installHook("dnd5e.applyDamage",onApplyDamage);
    installHook("dnd5e.damageActor",onDamageActor);
    installHook("dnd5e.restCompleted",onRestCompleted);
  }

  function featureSnapshot() {
    return Object.fromEntries(
      Object.entries(featureState).map(([name,state]) => [name,{...state}])
    );
  }

  function featureName(name) {
    const wanted = String(name ?? "").replace(/[^a-z0-9]/gi,"").toLowerCase();
    return Object.keys(featureState).find(key =>
      key.replace(/[^a-z0-9]/gi,"").toLowerCase() === wanted ||
      featureState[key].label.replace(/[^a-z0-9]/gi,"").toLowerCase() === wanted
    ) ?? null;
  }

  const api = {
    version:VERSION,
    build:BUILD,
    observerOnly:true,

    status() {
      return {
        version:VERSION,
        build:BUILD,
        observerOnly:true,
        initialized,
        destroyed,
        diagnosticsEnabled,
        diagnosticCount:entries.length,
        hookCount:hooks.length,
        hooks:hooks.map(([event]) => event),
        activeTurn:turnContext(),
        pendingDamageActors:pendingDamage.size,
        features:featureSnapshot()
      };
    },

    diagnostics(options={}) {
      const type = String(options?.type ?? "");
      const limit = Math.max(0,Number(options?.limit ?? MAX_DIAGNOSTICS) || 0);
      const selected = type
        ? entries.filter(entry => entry.type === type)
        : entries;
      return copy(selected.slice(-limit));
    },

    enableDiagnostics() {
      diagnosticsEnabled = true;
      return api.status();
    },

    disableDiagnostics() {
      diagnosticsEnabled = false;
      return api.status();
    },

    features() {
      return featureSnapshot();
    },

    enable(name) {
      const key = featureName(name);
      if (!key) return {ok:false,error:"Unknown weapon runtime feature.",features:featureSnapshot()};
      console.warn(
        "FEHA WEAPON OBSERVER // feature remains disabled in observer-only build",
        featureState[key].label
      );
      return {
        ok:false,
        name:key,
        enabled:false,
        reason:"Build 0.11.51 is observer-only.",
        feature:{...featureState[key]}
      };
    },

    disable(name) {
      const key = featureName(name);
      if (!key) return {ok:false,error:"Unknown weapon runtime feature.",features:featureSnapshot()};
      return {ok:true,name:key,enabled:false,feature:{...featureState[key]}};
    },

    disableAll() {
      return featureSnapshot();
    },

    async init() {
      if (initialized) return api;
      destroyed = false;
      installHooks();
      seedTokenPositions();
      seedCapacityStates();
      activeTurn = turnSnapshot(game.combat ?? null);
      initialized = true;

      game.adk ??= {};
      game.adk.weaponRuntime = api;
      globalThis.FEHA_WEAPON_RUNTIME = api;

      record("observer-online",{
        version:VERSION,
        build:BUILD,
        observerOnly:true,
        currentTurn:turnContext(),
        hookCount:hooks.length
      });
      console.log("FEHA WEAPON RUNTIME",VERSION,"observer online // build",BUILD);
      return api;
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      tokenPositions.clear();
      capacityStates.clear();
      pendingDamage.clear();
      recentAppliedDamage.clear();
      pendingAttacks.clear();
      entries.splice(0);
      activeTurn = null;
      initialized = false;
      destroyed = true;

      if (game?.adk?.weaponRuntime === api) delete game.adk.weaponRuntime;
      if (globalThis.FEHA_WEAPON_RUNTIME === api) delete globalThis.FEHA_WEAPON_RUNTIME;
    }
  };

  core.registerModule("weaponRuntime",api);
  globalThis.FEHA_WEAPON_RUNTIME = api;
})();
