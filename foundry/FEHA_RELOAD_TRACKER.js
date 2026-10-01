// FEHA // WEAPON TRACKER BACKEND
// Headless canonical firearm state + combat controller.
// The only player-facing firearm tracker UI is FEHA_WEAPON_SHEET.
// This module tracks attacks/reload state and invokes the hidden dnd5e activity.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_TRACKER requires FEHA_CYBER_CORE.");

  const VERSION = "2.5.0";
  const FLAG = "fleshEnshrouded";
  const LEGACY_HUD_ID = "feha-weapon-tracker-hud";
  const hooks = [];
  const countedRolls = new WeakSet();
  const lastAttackByWeapon = new Map();

  function definition(item) {
    return globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.weapons?.definition?.(item) ??
      globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.uniqueWeapons?.definition?.(item) ??
      null;
  }

  function actorFor(item) {
    return item?.parent?.documentName === "Actor" ? item.parent : null;
  }

  function weaponKey(item) {
    const actor = actorFor(item);
    return String(actor?.id ?? "")+":"+String(item?.id ?? "");
  }

  function activityItem(activity) {
    if (activity?.item) return activity.item;
    if (activity?.parent?.documentName === "Item") return activity.parent;
    return null;
  }

  function isTrackable(item) {
    const def = definition(item);
    return Boolean(
      item?.type === "weapon" &&
      def &&
      def.weaponClass !== "Bow" &&
      Number(def.functionalAttacks ?? 0) > 0
    );
  }

  function capacity(item) {
    const def = definition(item);
    return Math.max(0,Math.floor(Number(def?.functionalAttacks ?? 0) || 0));
  }

  function reloadPoints(item) {
    const def = definition(item);
    return Math.max(
      0,
      Math.floor(Number(def?.reloadPoints ?? def?.reloadActions ?? 0) || 0)
    );
  }

  function statePath(item,key) {
    return "flags."+FLAG+".weaponTracker."+String(item.id)+"."+key;
  }

  function state(item) {
    const actor = actorFor(item);
    const max = capacity(item);
    const reloadMax = reloadPoints(item);
    const raw =
      actor?.flags?.[FLAG]?.weaponTracker?.[String(item.id)] ?? {};

    const used = Math.max(
      0,
      Math.min(max,Math.floor(Number(raw.used ?? 0) || 0))
    );

    const reload = Math.max(
      0,
      Math.min(reloadMax,Math.floor(Number(raw.reload ?? 0) || 0))
    );

    return {
      used,
      remaining:Math.max(0,max-used),
      capacity:max,
      reload,
      reloadMax,
      empty:max > 0 && used >= max
    };
  }

  async function writeState(item,{used,reload}) {
    const actor = actorFor(item);
    if (!actor || actor.isOwner === false) {
      return {ok:false,reason:"not-owner",state:state(item)};
    }

    const max = capacity(item);
    const reloadMax = reloadPoints(item);

    const nextUsed = Math.max(
      0,
      Math.min(max,Math.floor(Number(used ?? 0) || 0))
    );

    const nextReload = Math.max(
      0,
      Math.min(reloadMax,Math.floor(Number(reload ?? 0) || 0))
    );

    await actor.update({
      [statePath(item,"used")]:nextUsed,
      [statePath(item,"reload")]:nextReload,
      [statePath(item,"updatedAt")]:Date.now()
    });

    return {ok:true,state:state(item)};
  }

  async function recordShot(item) {
    if (!isTrackable(item)) {
      return {ok:false,reason:"not-trackable",state:state(item)};
    }

    const before = state(item);
    if (before.empty) {
      return {ok:false,reason:"empty",state:before};
    }

    return writeState(item,{
      used:before.used+1,
      reload:0
    });
  }

  async function undoShot(item) {
    const before = state(item);
    return writeState(item,{
      used:Math.max(0,before.used-1),
      reload:before.reload
    });
  }

  async function resetWeapon(item) {
    return writeState(item,{used:0,reload:0});
  }

  async function addReload(item,points,label) {
    const before = state(item);

    if (!before.reloadMax) {
      return resetWeapon(item);
    }

    const next = before.reload + Math.max(0,Number(points) || 0);

    if (next >= before.reloadMax) {
      return writeState(item,{used:0,reload:0});
    }

    return writeState(item,{
      used:before.used,
      reload:next
    });
  }

  // Class-based reload (FEHA_WEAPON_HANDLING): one press refills the weapon.
  // Full-turn weapons (LMG / sniper) must pass their reload check first.
  async function reload(item) {
    const handling = globalThis.FEHA_WEAPON_HANDLING;
    const check = await handling?.rollReloadCheck?.(item) ?? {ok:true};
    if (!check.ok) {
      if (check.reason !== "cancelled") {
        ui.notifications?.warn?.(
          "FEHA // "+String(item?.name ?? "weapon")+" reload failed ("+
          String(check.total ?? "?")+" vs DC "+String(check.dc ?? "?")+
          "). Try again next turn."
        );
      }
      return {ok:false,reason:check.reason ?? "check-failed",check,state:state(item)};
    }
    const result = await resetWeapon(item);
    return {...result,check};
  }

  function equippedFirearms(actor) {
    if (!actor) return [];
    return [...(actor.items?.contents ?? actor.items ?? [])]
      .filter(item => item?.system?.equipped === true)
      .filter(isTrackable);
  }

  function activities(item) {
    const collection = item?.system?.activities;
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    if (typeof collection.values === "function") {
      try { return [...collection.values()]; } catch {}
    }
    if (typeof collection === "object") return Object.values(collection);
    return [];
  }

  function legacyAttackStub(activity) {
    const source = activity?._source ?? activity ?? {};
    if (String(source?.type ?? activity?.type ?? "").toLowerCase() !== "attack") return false;

    const name = String(source?.name ?? "").trim();
    const sort = Number(source?.sort ?? activity?.sort ?? 0) || 0;
    const range = source?.range ?? {};
    const damage = source?.damage ?? {};
    const parts = Array.isArray(damage?.parts)
      ? damage.parts
      : Array.isArray(damage?.parts?.contents)
        ? damage.parts.contents
        : [];
    const effects = Array.isArray(source?.effects) ? source.effects : [];

    const rangeValue = range?.value;
    const noRange =
      rangeValue == null ||
      rangeValue === "" ||
      Number(rangeValue) === 0;

    return (
      (!name || name.toLowerCase() === "attack") &&
      sort === 0 &&
      String(range?.units ?? "") === "self" &&
      noRange &&
      damage?.includeBase === true &&
      parts.length === 0 &&
      effects.length === 0
    );
  }

  function primaryAttack(item) {
    const attacks = activities(item).filter(activity =>
      String(activity?.type ?? activity?._source?.type ?? "").toLowerCase() === "attack"
    );

    if (!attacks.length) return null;

    const usable = attacks.filter(activity => !legacyAttackStub(activity));
    const pool = usable.length ? usable : attacks;

    const score = activity => {
      const source = activity?._source ?? activity ?? {};
      const range = source?.range ?? activity?.range ?? {};
      const attack = source?.attack ?? activity?.attack ?? {};
      let value = 0;

      if (String(source?.name ?? activity?.name ?? "").trim()) value += 2;
      if ((Number(source?.sort ?? activity?.sort ?? 0) || 0) > 0) value += 3;
      if ((Number(range?.value ?? 0) || 0) > 0) value += 4;
      if (String(range?.units ?? "") === "ft") value += 1;
      if (String(attack?.ability ?? "").trim()) value += 2;
      if (activity?.img || source?.img) value += 1;

      return value;
    };

    return [...pool].sort((a,b) => score(b)-score(a))[0] ?? null;
  }

  async function useAttack(item,event=null) {
    const activity = primaryAttack(item);
    if (!activity || typeof activity.use !== "function") {
      ui.notifications?.warn?.(
        "FEHA Weapon Tracker // no usable attack activity found for "+
        String(item?.name ?? "weapon")+"."
      );
      return {ok:false,reason:"no-attack-activity"};
    }

    // The shot is spent by dnd5e.postRollAttack, i.e. only when an attack
    // roll actually happens. activity.use() resolves as soon as the usage
    // card is posted, while the roll dialog may still be open (or get
    // cancelled), so counting here double-spent slow clicks and charged
    // cancelled attacks.
    try {
      const result = await activity.use({event,legacy:false});

      if (result === false || result === null) {
        return {ok:false,reason:"attack-cancelled",result,activity};
      }

      return {ok:true,result,activity};
    } catch (error) {
      console.warn(
        "FEHA WEAPON TRACKER // attack use failed",
        item?.name,
        error
      );
      ui.notifications?.warn?.(
        "FEHA Weapon Tracker // attack failed. Check console."
      );
      return {ok:false,reason:"attack-failed",error};
    }
  }

  async function rollDamage(item,event=null) {
    const activity = primaryAttack(item);
    if (!activity || typeof activity.rollDamage !== "function") {
      ui.notifications?.warn?.(
        "FEHA Weapon Tracker // no damage action found for "+
        String(item?.name ?? "weapon")+"."
      );
      return {ok:false,reason:"no-damage-action"};
    }

    const context =
      lastAttackByWeapon.get(weaponKey(item)) ??
      null;

    const config = {event};
    if (context?.attackMode) config.attackMode = context.attackMode;
    if (context?.isCritical === true) config.isCritical = true;
    if (context?.ammunition) config.ammunition = context.ammunition;

    try {
      const result = await activity.rollDamage(config);
      return {ok:true,result,activity,context};
    } catch (error) {
      console.warn(
        "FEHA WEAPON TRACKER // damage roll failed",
        item?.name,
        error
      );
      ui.notifications?.warn?.(
        "FEHA Weapon Tracker // damage roll failed. Check console."
      );
      return {ok:false,reason:"damage-failed",error};
    }
  }

  function rememberAttackContext(item,rolls=[]) {
    const first =
      Array.isArray(rolls)
        ? rolls[0]
        : rolls?.[0] ?? null;

    const options = first?.options ?? {};
    const actor = actorFor(item);

    let ammunition = null;
    const ammoId =
      String(options?.ammunition ?? "").trim();

    if (ammoId && actor?.items?.get) {
      ammunition = actor.items.get(ammoId) ?? null;
    }

    const context = {
      at:Date.now(),
      attackMode:String(options?.attackMode ?? "") || null,
      isCritical:Boolean(first?.isCritical),
      ammunition,
      rollId:String(first?.id ?? first?._id ?? "")
    };

    lastAttackByWeapon.set(weaponKey(item),context);
    return context;
  }

  function purgeLegacyPanels() {
    try {
      document.getElementById(LEGACY_HUD_ID)?.remove?.();

      for (const node of document.querySelectorAll(
        '[data-feha-reload-tracker], [id^="feha-reload-tracker-"]'
      )) {
        node.remove();
      }
    } catch {}
  }

  // Backward-compatible API only. Any old macro/module that calls
  // weaponTracker.open() now opens the canonical weapon sheet instead of
  // resurrecting the retired floating HUD.
  function open(input=null) {
    let item = input?.documentName === "Item" ? input : null;

    if (!item) {
      const actor =
        input?.documentName === "Actor"
          ? input
          : canvas?.tokens?.controlled?.[0]?.actor ??
            game.user?.character ??
            null;

      item = equippedFirearms(actor)[0] ?? null;
    }

    if (!item || !isTrackable(item)) {
      ui.notifications?.warn?.(
        "FEHA Weapon Sheet // no equipped canonical firearm found."
      );
      return null;
    }

    purgeLegacyPanels();

    try {
      item.sheet?.render?.(true);
    } catch (error) {
      console.warn(
        "FEHA WEAPON TRACKER // canonical sheet open failed",
        item?.name,
        error
      );
    }

    return item;
  }

  function onPostRollAttack(rolls,data={}) {
    const activity = data?.subject ?? null;
    const item = activityItem(activity);
    if (!isTrackable(item)) return;

    const actor = actorFor(item);
    if (!actor || actor.isOwner === false) return;

    // One shot per attack roll, however the attack was started (FEHA sheet,
    // dnd5e sheet, macro). Guard against the hook firing twice for one roll.
    const first = Array.isArray(rolls) ? rolls[0] : rolls?.[0] ?? null;
    if (first && typeof first === "object") {
      if (countedRolls.has(first)) return;
      countedRolls.add(first);
    }

    rememberAttackContext(item,rolls);

    void recordShot(item).catch(error => {
      console.warn(
        "FEHA WEAPON TRACKER // shot tracking failed",
        item?.name,
        error
      );
    });
  }

  async function cleanupLegacyState() {
    if (!game.user?.isGM) return {actors:0};

    let actors = 0;

    for (const actor of game.actors?.contents ?? []) {
      if (
        !Object.prototype.hasOwnProperty.call(
          actor.flags?.[FLAG] ?? {},
          "reloadTracker"
        )
      ) {
        continue;
      }

      try {
        await actor.update({
          ["flags."+FLAG+".-=reloadTracker"]:null
        });
        actors++;
      } catch (error) {
        console.warn(
          "FEHA WEAPON TRACKER // legacy reload state cleanup failed",
          actor?.name,
          error
        );
      }
    }

    return {actors};
  }

  function installHooks() {
    hooks.push([
      "dnd5e.postRollAttack",
      Hooks.on("dnd5e.postRollAttack",onPostRollAttack)
    ]);
  }

  const api = {
    version:VERSION,
    definition,
    capacity,
    reloadPoints,
    state,
    primaryAttack,
    useAttack,
    rollDamage,
    rememberAttackContext,
    cleanupLegacyState,
    recordShot,
    undoShot,
    addReload,
    reload,
    reset:resetWeapon,
    equippedFirearms,
    open,

    async init() {
      purgeLegacyPanels();
      await cleanupLegacyState();
      installHooks();

      game.adk ??= {};
      game.adk.weaponTracker = api;

      // Transitional alias remains backend-only for old callers.
      game.adk.reloadTracker = api;

      globalThis.FEHA_WEAPON_TRACKER = api;
      globalThis.FEHA_RELOAD_TRACKER = api;

      console.log(
        "FEHA WEAPON TRACKER",
        VERSION,
        "online // headless backend // canonical sheet is the only tracker UI"
      );
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
      lastAttackByWeapon.clear();
      purgeLegacyPanels();

      if (game?.adk?.weaponTracker === api) delete game.adk.weaponTracker;
      if (game?.adk?.reloadTracker === api) delete game.adk.reloadTracker;
      if (globalThis.FEHA_WEAPON_TRACKER === api) delete globalThis.FEHA_WEAPON_TRACKER;
      if (globalThis.FEHA_RELOAD_TRACKER === api) delete globalThis.FEHA_RELOAD_TRACKER;
    }
  };

  core.registerModule("weaponTracker",api);
  globalThis.FEHA_WEAPON_TRACKER = api;
  globalThis.FEHA_RELOAD_TRACKER = api;
})();
