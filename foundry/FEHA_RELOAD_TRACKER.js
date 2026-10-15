// FEHA // WEAPON TRACKER BACKEND
// Headless canonical firearm state + combat controller.
// The only player-facing firearm tracker UI is FEHA_WEAPON_SHEET.
// This module tracks attacks/reload state and invokes the hidden dnd5e activity.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_TRACKER requires FEHA_CYBER_CORE.");

  const VERSION = "3.0.0";
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

  // Has this weapon been given native charges (uses.max = its capacity)?
  function native(item) {
    return Number(item?.system?.uses?.max ?? 0) > 0;
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

    // Shots are the item's own charges (system.uses) once it has them;
    // older copies still read the actor flag.
    const spent = native(item) ? item.system.uses.spent : raw.used;
    const used = Math.max(
      0,
      Math.min(max,Math.floor(Number(spent ?? 0) || 0))
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

  // "combatId:round:turn" of the running combat, or "" outside combat.
  function turnStamp(combat=game.combat,round=combat?.round,turn=combat?.turn) {
    if (!combat?.started) return "";
    return [combat.id,Number(round ?? 0),Number(turn ?? 0)].join(":");
  }

  // The started encounter the wielder is in. game.combat is only the one the
  // tracker shows, which can be a different, leftover encounter.
  function combatFor(actor) {
    const fits = combat =>
      Boolean(combat?.started) &&
      [...(combat.combatants ?? [])].some(entry =>
        String(entry?.actorId ?? entry?.actor?.id ?? "") === String(actor?.id ?? "")
      );

    if (fits(game.combat)) return game.combat;
    return [...(game.combats ?? [])].find(fits) ?? game.combat;
  }

  async function writeState(item,{used,reload,shotTurn}) {
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

    if (native(item) && Number(item.system.uses.spent ?? 0) !== nextUsed) {
      await item.update({"system.uses.spent":nextUsed});
    }

    const update = {
      ...(native(item) ? {} : {[statePath(item,"used")]:nextUsed}),
      [statePath(item,"reload")]:nextReload,
      [statePath(item,"updatedAt")]:Date.now()
    };

    if (shotTurn !== undefined) {
      update[statePath(item,"shotTurn")] = shotTurn;
    }

    await actor.update(update);

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
      reload:0,
      // Remembered so turn-end rules (Helix Self-Charging Cell) know whether
      // this weapon fired during the wielder's turn.
      shotTurn:turnStamp(combatFor(actorFor(item)))
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

    // Native charges were already spent by dnd5e when the attack was used;
    // only note that the weapon fired this turn (Helix Self-Charging Cell).
    if (native(item)) {
      const shotTurn = turnStamp(combatFor(actor));
      void actor.update({[statePath(item,"shotTurn")]:shotTurn}).catch(() => {});
      return;
    }

    void recordShot(item).catch(error => {
      console.warn(
        "FEHA WEAPON TRACKER // shot tracking failed",
        item?.name,
        error
      );
    });
  }

  // Native charges: a firearm's magazine is its item uses (max = capacity),
  // its Attack spends one, and a Reload activity refills it. dnd5e itself
  // then refuses to attack with an empty weapon, from any sheet or macro.
  const RELOAD_FLAG = "reloadActivity";

  function reloadActivity(item) {
    return activitiesOf(item).find(a => a?.flags?.[FLAG]?.[RELOAD_FLAG] === true) ?? null;
  }

  function activitiesOf(item) {
    const c = item?.system?.activities;
    if (!c) return [];
    if (typeof c.values === "function") return [...c.values()];
    return Object.values(c);
  }

  function reloadActivation(item) {
    const mode = globalThis.FEHA_WEAPON_HANDLING?.profile?.(item)?.reload ?? "action";
    if (mode === "bonus") return {type:"bonus",value:1,condition:""};
    if (mode === "full") return {type:"special",value:null,condition:"Takes your whole turn (DEX check)"};
    return {type:"action",value:1,condition:""};
  }

  async function ensureNative(item) {
    if (!isTrackable(item)) return false;
    const max = capacity(item);
    const attack = primaryAttack(item);
    if (!max || !attack) return false;

    const update = {};
    const uses = item._source?.system?.uses ?? {};
    if (String(uses.max ?? "") !== String(max)) {
      update["system.uses.max"] = String(max);
      // First conversion: carry over shots already fired on the old tracker.
      const old = actorFor(item)?.flags?.[FLAG]?.weaponTracker?.[String(item.id)]?.used;
      update["system.uses.spent"] = Math.max(0,Math.min(max,Number(old ?? uses.spent ?? 0) || 0));
    }

    const targets = attack._source?.consumption?.targets ?? [];
    const spendsOne = targets.length === 1 &&
      targets[0].type === "itemUses" && !targets[0].target && String(targets[0].value) === "1";
    if (!spendsOne) {
      update["system.activities."+attack.id+".consumption.targets"] =
        [{type:"itemUses",target:"",value:"1",scaling:{mode:"",formula:""}}];
      update["system.activities."+attack.id+".consumption.spellSlot"] = false;
    }

    if (Object.keys(update).length) await item.update(update);

    const activation = reloadActivation(item);
    const existing = reloadActivity(item);
    if (!existing) {
      await item.createActivity("utility",{
        name:"Reload",
        img:"icons/svg/regen.svg",
        sort:100001,
        activation,
        flags:{[FLAG]:{[RELOAD_FLAG]:true}}
      },{renderSheet:false});
    } else if (
      existing._source?.activation?.type !== activation.type ||
      String(existing._source?.activation?.condition ?? "") !== activation.condition
    ) {
      await item.update({["system.activities."+existing.id+".activation"]:activation});
    }
    return Object.keys(update).length > 0 || !existing;
  }

  async function migrateAll() {
    if (game.users?.activeGM?.isSelf !== true) return {skipped:true};
    let world = 0, owned = 0;
    for (const item of game.items) {
      try { if (await ensureNative(item)) world++; } catch (error) {
        console.warn("FEHA WEAPON TRACKER // native charges failed",item?.name,error);
      }
    }
    for (const actor of game.actors) {
      for (const item of actor.items) {
        try { if (await ensureNative(item)) owned++; } catch (error) {
          console.warn("FEHA WEAPON TRACKER // native charges failed",actor?.name,item?.name,error);
        }
      }
    }
    return {world,owned};
  }

  // A weapon picked up later (Market, loot) gets its charges and Reload too.
  function onCreateItem(item,options,userId) {
    if (userId !== game.user?.id || !item?.parent) return;
    void ensureNative(item).catch(() => {});
  }

  // Using the Reload activity refills the weapon (full-turn weapons roll
  // their reload check first).
  function onPostUseActivity(activity) {
    if (activity?.flags?.[FLAG]?.[RELOAD_FLAG] !== true) return;
    const item = activityItem(activity);
    if (!item) return;
    void reload(item).catch(error => {
      console.warn("FEHA WEAPON TRACKER // reload failed",item?.name,error);
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

  // Helix SELF-CHARGING CELL: at the end of a turn in which the wielder did
  // not fire the Helix weapon they are wielding, it is fully restored. One
  // GM client applies it when the turn passes.
  async function onUpdateCombat(combat,changed) {
    if (!("turn" in (changed ?? {})) && !("round" in (changed ?? {}))) return;
    if (!combat?.started) return;
    if (game.users?.activeGM?.isSelf !== true) return;

    const previous = combat.previous ?? null;
    if (!previous?.combatantId) return;

    const actor =
      combat.combatants?.get?.(previous.combatantId)?.actor ?? null;
    if (!actor) return;

    const endedTurn = turnStamp(combat,previous.round,previous.turn);

    for (const item of equippedFirearms(actor)) {
      if (definition(item)?.company !== "Helix Vitae") continue;

      const current = state(item);
      if (current.used < 1) continue;

      const raw =
        actor.flags?.[FLAG]?.weaponTracker?.[String(item.id)] ?? {};
      if (String(raw.shotTurn ?? "") === endedTurn) continue;

      try {
        await resetWeapon(item);

        await ChatMessage.create({
          speaker:ChatMessage.getSpeaker({actor}),
          whisper:ChatMessage.getWhisperRecipients("GM")
            .concat(
              game.users.filter(user =>
                !user.isGM &&
                actor.testUserPermission?.(user,"OWNER")
              )
            )
            .map(user => user.id),
          content:
            "<strong>SELF-CHARGING CELL</strong> // "+
            foundry.utils.escapeHTML(String(item.name))+
            " recharged to full ("+current.capacity+"/"+current.capacity+")."
        });
      } catch (error) {
        console.warn(
          "FEHA WEAPON TRACKER // self-charging cell failed",
          item?.name,
          error
        );
      }
    }
  }

  function installHooks() {
    hooks.push([
      "dnd5e.postRollAttack",
      Hooks.on("dnd5e.postRollAttack",onPostRollAttack)
    ]);

    hooks.push([
      "dnd5e.postUseActivity",
      Hooks.on("dnd5e.postUseActivity",onPostUseActivity)
    ]);

    hooks.push([
      "createItem",
      Hooks.on("createItem",onCreateItem)
    ]);

    hooks.push([
      "updateCombat",
      Hooks.on("updateCombat",onUpdateCombat)
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
    ensureNative,
    migrateAll,
    reloadActivity,
    equippedFirearms,
    open,

    async init() {
      purgeLegacyPanels();
      await cleanupLegacyState();
      installHooks();
      try {
        const native = await migrateAll();
        if (native.world || native.owned) console.log("FEHA WEAPON TRACKER // native charges",native);
      } catch (error) {
        console.warn("FEHA WEAPON TRACKER // native charge migration failed",error);
      }

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
