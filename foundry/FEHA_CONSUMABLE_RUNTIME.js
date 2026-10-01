// FEHA // CONSUMABLE RUNTIME
// Using a catalog consumable applies what its card says: healing, temporary
// HP, RAM, or a timed bonus as an Active Effect. It enforces "once per Short
// Rest per product" and uses up one of the item.
//
// The item-use entry point is the bridge in FEHA_GRENADE_RUNTIME, which asks
// this module whether it handles the item.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  const catalog = globalThis.FEHA_CONSUMABLE_CATALOG;

  if (!core || !catalog) {
    throw new Error("FEHA_CONSUMABLE_RUNTIME requires Cyber Core + Consumable Catalog.");
  }

  const VERSION = "1.0.1";
  const FLAG = "fleshEnshrouded";
  const USED_FLAG = "consumablesUsed";
  const EFFECT_FLAG = "consumableEffect";
  const KIT_FLAG = "neuralAdaptationUsed";
  const ICON = "icons/svg/aura.svg";

  const minutes = value => ({value,units:"minutes"});
  const rounds = value => ({value,units:"rounds",expiry:"turnEnd"});
  const add = (key,value) => ({key,value:String(value),type:"add"});

  // What each product does. `changes` are applied by Foundry while the effect
  // lasts; `note` marks a bonus the table applies by hand because it only
  // counts in a situation the game cannot see.
  const EFFECTS = {
    "kurohane-black-tea":{buff:{duration:minutes(10),changes:[add("system.skills.ste.bonuses.check","+1")]}},
    "kurohane-night-cola":{buff:{duration:minutes(10),changes:[add("system.skills.ste.bonuses.check","+1")]}},
    "kurohane-quiet-energy":{buff:{duration:minutes(10),changes:[add("system.skills.ste.bonuses.check","+2")]}},

    "bastion-electrolyte":{tempHp:8},
    "bastion-recovery-drink":{tempHp:12},
    "bastion-trauma-booster":{tempHp:25},

    "lumen-focus":{buff:{duration:minutes(10),changes:[add("system.bonuses.rwak.attack","+2")],oneShot:"rangedAttack"}},
    "lumen-focus-plus":{buff:{duration:rounds(3),changes:[add("system.bonuses.rwak.attack","+1")]}},
    "lumen-clearview":{buff:{duration:minutes(10),changes:[],oneShot:"rangedAdvantage"}},

    "vektor-balance":{tempHp:5,buff:{duration:rounds(2),changes:[add("system.attributes.movement.walk",5)]}},
    "vektor-dual":{tempHp:8,buff:{duration:rounds(2),changes:[add("system.attributes.movement.walk",5)]}},
    "vektor-mix":{tempHp:12,buff:{duration:rounds(2),changes:[add("system.attributes.movement.walk",10)]}},

    "helix-stamina-booster":{buff:{duration:rounds(2),changes:[add("system.attributes.movement.walk",10)]}},
    "helix-oxy-booster":{buff:{duration:rounds(2),changes:[add("system.attributes.movement.walk",15)]}},
    "helix-health-booster":{heal:"4d8 + 8"},

    "forgeline-load-booster":{buff:{duration:minutes(10),changes:[add("system.abilities.str.bonuses.check","+2")]}},
    "forgeline-heavy-load-booster":{buff:{duration:minutes(10),changes:[add("system.abilities.str.bonuses.check","+4")]}},
    "forgeline-breacher-booster":{buff:{duration:minutes(10),changes:[],note:true}},

    "jade-arc-ion-water":{buff:{duration:{value:1,units:"hours"},changes:[],note:true}},
    "jade-arc-grounding-tonic":{buff:{duration:{value:1,units:"hours"},changes:[],note:true}},
    "jade-arc-coolant-mix":{buff:{duration:rounds(2),changes:[add("system.traits.dr.value","lightning")]}},

    "corvus-memory-booster":{ram:3},
    "corvus-black-memory-booster":{ram:6},
    "corvus-neural-adaptation-kit":{capacity:1}
  };

  const hooks = [];

  const esc = value => foundry.utils.escapeHTML(String(value ?? ""));

  function list(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  }

  function definition(item) {
    const def = catalog.definition?.(item) ?? null;
    return def && EFFECTS[def.key] ? def : null;
  }

  // Only a copy carried by a character is usable; the shop's master item is not.
  function handles(item) {
    return Boolean(
      item?.type === "consumable" &&
      item.actor &&
      item.flags?.[FLAG]?.consumableKey &&
      definition(item)
    );
  }

  function usedKeys(actor) {
    const value = actor?.flags?.[FLAG]?.[USED_FLAG];
    return Array.isArray(value) ? value.map(String) : [];
  }

  function cyberdeck(actor) {
    try {
      return globalThis.FEHA_TABLETOP_UI_V3?.model?.(actor) ?? null;
    } catch {
      return null;
    }
  }

  // Why this product would be wasted right now, or null if it can be used.
  function refusal(actor,def,spec) {
    if (spec.capacity) {
      return actor.flags?.[FLAG]?.[KIT_FLAG]
        ? actor.name+" has already had a Neural Adaptation Kit."
        : null;
    }

    if (usedKeys(actor).includes(def.key)) {
      return actor.name+" has already used "+def.name+" since their last rest.";
    }

    const hp = actor.system?.attributes?.hp ?? {};

    if (spec.heal && Number(hp.value ?? 0) >= Number(hp.effectiveMax ?? hp.max ?? 0)) {
      return actor.name+" is already at full HP.";
    }

    if (spec.tempHp && !spec.buff && Number(hp.temp ?? 0) >= spec.tempHp) {
      return actor.name+" already has "+Number(hp.temp)+" temporary HP.";
    }

    if (spec.ram) {
      const deck = cyberdeck(actor);
      if (!deck?.deck) return actor.name+" has no cyberdeck installed.";
      if (deck.currentRam >= deck.maxRam) return actor.name+" is already at full RAM.";
    }

    return null;
  }

  async function consumeOne(item) {
    const quantity = Number(item.system?.quantity ?? 1) || 1;

    if (quantity > 1) {
      await item.update({"system.quantity":quantity - 1});
    } else {
      await item.delete();
    }
  }


  // Most characters in this world have no base walking speed recorded, so a
  // speed bonus would show as the bonus alone. Any effect that changes speed
  // first raises an unset speed to the standard 30 ft.
  function withBaseSpeed(changes) {
    const WALK = "system.attributes.movement.walk";
    if (!changes.some(change => change.key === WALK)) return changes;

    return [{key:WALK,value:"30",type:"upgrade",priority:5},...changes];
  }

  async function applyBuff(actor,item,def,buff) {
    // Taking the same product again replaces its effect instead of stacking.
    const previous = list(actor.effects)
      .filter(effect => effect.flags?.[FLAG]?.[EFFECT_FLAG]?.key === def.key)
      .map(effect => effect.id);

    if (previous.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect",previous);
    }

    await actor.createEmbeddedDocuments("ActiveEffect",[{
      name:def.name,
      img:item.img || ICON,
      type:"base",
      description:"<p>"+esc(def.effectText)+"</p>",
      system:{changes:withBaseSpeed(buff.changes)},
      duration:buff.duration,
      flags:{
        [FLAG]:{
          [EFFECT_FLAG]:{
            key:def.key,
            oneShot:buff.oneShot ?? null
          }
        }
      }
    }]);
  }

  async function use(item) {
    const actor = item.actor;
    const def = definition(item);
    const spec = EFFECTS[def.key];

    if (!actor.isOwner) {
      ui.notifications?.warn?.("You cannot use items for "+actor.name+".");
      return null;
    }

    const blocked = refusal(actor,def,spec);

    if (blocked) {
      ui.notifications?.warn?.(blocked+" Nothing was used.");
      return null;
    }

    const results = [];
    const update = {};
    const hp = actor.system?.attributes?.hp ?? {};
    let healRoll = null;

    if (spec.heal) {
      healRoll = new Roll(spec.heal);
      await healRoll.evaluate();

      const max = Number(hp.effectiveMax ?? hp.max ?? 0);
      const before = Number(hp.value ?? 0);
      const after = Math.min(max,before + Number(healRoll.total));

      update["system.attributes.hp.value"] = after;
      results.push("Regained "+(after - before)+" HP ("+before+" to "+after+").");
    }

    if (spec.tempHp) {
      const current = Number(hp.temp ?? 0);

      if (spec.tempHp > current) {
        update["system.attributes.hp.temp"] = spec.tempHp;
        results.push("Temporary HP set to "+spec.tempHp+".");
      } else {
        results.push("Kept "+current+" temporary HP (the higher amount).");
      }
    }

    if (spec.ram) {
      const deck = cyberdeck(actor);
      const after = Math.min(deck.maxRam,deck.currentRam + spec.ram);

      update["flags."+FLAG+".ramCurrent"] = after;
      results.push("RAM "+deck.currentRam+" to "+after+".");
    }

    if (spec.capacity) {
      const bonus = Number(actor.flags?.[FLAG]?.cyberwareCapacityBonus ?? 0) || 0;

      update["flags."+FLAG+".cyberwareCapacityBonus"] = bonus + spec.capacity;
      update["flags."+FLAG+"."+KIT_FLAG] = true;
      results.push("Maximum Cyberware Capacity +"+spec.capacity+", permanently.");
    } else {
      update["flags."+FLAG+"."+USED_FLAG] = [...usedKeys(actor),def.key];
    }

    await actor.update(update);

    if (spec.buff) {
      await applyBuff(actor,item,def,spec.buff);
      results.push(
        spec.buff.note
          ? def.effectText+" The table applies this bonus when it comes up."
          : def.effectText
      );
    }

    await consumeOne(item);

    const content =
      "<p><strong>"+esc(actor.name)+" uses "+esc(def.name)+"</strong></p>"+
      "<p>"+results.map(esc).join("<br>")+"</p>";

    if (healRoll) {
      await healRoll.toMessage({
        speaker:ChatMessage.getSpeaker({actor}),
        flavor:content
      });
    } else {
      await ChatMessage.create({
        speaker:ChatMessage.getSpeaker({actor}),
        content
      });
    }

    return {key:def.key,results};
  }

  function consumableEffects(actor,oneShot) {
    return list(actor?.effects).filter(effect =>
      effect.flags?.[FLAG]?.[EFFECT_FLAG]?.oneShot === oneShot &&
      !effect.disabled &&
      !effect.duration?.expired
    );
  }

  function isRangedAttack(activity) {
    const item = activity?.item ?? null;

    return (
      activity?.actionType === "rwak" ||
      activity?.attack?.type?.value === "ranged" ||
      /R$/.test(String(item?.system?.type?.value ?? ""))
    );
  }

  // "Your next ranged attack has advantage."
  function onPreRollAttack(config) {
    try {
      const activity = config?.subject ?? null;
      const actor = activity?.actor ?? activity?.item?.actor ?? null;

      if (!actor || !isRangedAttack(activity)) return;
      if (!consumableEffects(actor,"rangedAdvantage").length) return;

      config.advantage = true;

      for (const roll of config.rolls ?? []) {
        roll.options ??= {};
        roll.options.advantage = true;
      }
    } catch (error) {
      console.warn("FEHA CONSUMABLES // preRollAttack failed",error);
    }
  }

  // A "next ranged attack" bonus is spent by the attack it applied to.
  async function onPostRollAttack(rolls,data={}) {
    try {
      const activity = data?.subject ?? null;
      const actor = activity?.actor ?? activity?.item?.actor ?? null;

      if (!actor?.isOwner || !isRangedAttack(activity)) return;

      const spent = [
        ...consumableEffects(actor,"rangedAttack"),
        ...consumableEffects(actor,"rangedAdvantage")
      ].map(effect => effect.id);

      if (spent.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",spent);
      }
    } catch (error) {
      console.warn("FEHA CONSUMABLES // postRollAttack failed",error);
    }
  }

  // A rest clears the once-per-rest list and any consumable effect still up.
  async function onRestCompleted(actor) {
    try {
      if (!actor?.isOwner) return;

      if (usedKeys(actor).length) {
        await actor.update({["flags."+FLAG+"."+USED_FLAG]:[]});
      }

      const leftover = list(actor.effects)
        .filter(effect => effect.flags?.[FLAG]?.[EFFECT_FLAG])
        .map(effect => effect.id);

      if (leftover.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",leftover);
      }
    } catch (error) {
      console.warn("FEHA CONSUMABLES // rest reset failed",error);
    }
  }

  // Foundry marks a timed effect expired and stops applying it; the GM client
  // then removes the spent ones so they do not pile up on the sheet.
  async function onUpdateCombat(combat,changed) {
    if (game.users?.activeGM?.id !== game.user?.id) return;
    if (!changed || (!("turn" in changed) && !("round" in changed))) return;

    for (const combatant of list(combat.combatants)) {
      const actor = combatant.actor;
      if (!actor) continue;

      const expired = list(actor.effects)
        .filter(effect =>
          effect.flags?.[FLAG]?.[EFFECT_FLAG] &&
          effect.duration?.expired
        )
        .map(effect => effect.id);

      if (expired.length) {
        try {
          await actor.deleteEmbeddedDocuments("ActiveEffect",expired);
        } catch (error) {
          console.warn("FEHA CONSUMABLES // expiry cleanup failed",error);
        }
      }
    }
  }

  const api = {
    version:VERSION,
    effects:EFFECTS,
    handles,
    use,

    async init() {
      await api.destroy();

      hooks.push(
        ["dnd5e.preRollAttackV2",Hooks.on("dnd5e.preRollAttackV2",onPreRollAttack)],
        ["dnd5e.postRollAttack",Hooks.on("dnd5e.postRollAttack",onPostRollAttack)],
        ["dnd5e.restCompleted",Hooks.on("dnd5e.restCompleted",onRestCompleted)],
        ["updateCombat",Hooks.on("updateCombat",onUpdateCombat)]
      );

      console.log("FEHA CONSUMABLE RUNTIME",VERSION,"ready");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
    }
  };

  core.registerModule("consumableRuntime",api);
})();
