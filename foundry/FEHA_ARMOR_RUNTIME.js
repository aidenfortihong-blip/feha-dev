// FEHA // ARMOR RUNTIME
// Runtime helpers and conditional automation for canonical armor signatures.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_ARMOR_RUNTIME requires FEHA_CYBER_CORE.");

  const VERSION = "1.3.3";
  const FLAG = "fleshEnshrouded";
  const hooks = [];
  let activeForgeTurn = null;

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function equippedDefinition(actor) {
    if (!actor) return null;
    for (const item of list(actor.items)) {
      if (item.system?.equipped !== true) continue;
      const def = globalThis.FEHA_ARMOR_CATALOG?.definition?.(item) ?? null;
      if (def) return def;
    }
    return null;
  }

  function equippedArmorItem(actor) {
    if (!actor) return null;
    return list(actor.items).find(item =>
      item.system?.equipped === true &&
      Boolean(globalThis.FEHA_ARMOR_CATALOG?.definition?.(item))
    ) ?? null;
  }

  function quickhackSaveBonus(actor) {
    const def = equippedDefinition(actor);
    if (def?.company !== "Corvus Neural") return 0;
    return Math.max(0,Number(def.signature?.value ?? 0) || 0);
  }

  function empSaveAdvantage(actor) {
    const def = equippedDefinition(actor);
    return def?.company === "Jade Arc Systems" && Number(def.mk) < 3;
  }

  function empImmune(actor) {
    const def = equippedDefinition(actor);
    return def?.company === "Jade Arc Systems" && Number(def.mk) >= 3;
  }

  // Vektor "Grenade Null" (see FEHA_ARMOR_CATALOG): Mk.V is immune to
  // grenades; Mk.I-IV take half grenade damage and save with advantage.
  function grenadeNullMk(actor) {
    const def = equippedDefinition(actor);
    if (def?.company !== "Vektor Dynamics") return 0;
    return Math.max(
      1,
      Math.floor(Number(def.mk ?? def.signature?.value ?? 1) || 1)
    );
  }

  function grenadeImmune(actor) {
    return grenadeNullMk(actor) >= 5;
  }

  function grenadeResistant(actor) {
    const mk = grenadeNullMk(actor);
    return mk >= 1 && mk < 5;
  }

  function halveDamageDescriptions(damages) {
    let removed = 0;
    for (const part of damages ?? []) {
      const current = Number(part?.value);
      if (!Number.isFinite(current) || current <= 0) continue;
      const next = Math.floor(current / 2);
      removed += current - next;
      part.value = next;
    }
    return removed;
  }

  function hasFireResistance(actor) {
    return equippedDefinition(actor)?.company === "Jade Arc Systems";
  }

  function isHelixFirearm(item) {
    if (!item || item.type !== "weapon" || item.system?.equipped !== true) return false;
    const flags = item.flags?.[FLAG] ?? {};
    const company = String(flags.manufacturer ?? flags.company ?? "");
    const kind = String(flags.weaponKind ?? "").toLowerCase();
    return company === "Helix Vitae" && kind !== "melee" && kind !== "bow";
  }

  function helixSpeedBonus(actor) {
    const def = equippedDefinition(actor);
    if (def?.company !== "Helix Vitae") return 0;
    if (!list(actor?.items).some(isHelixFirearm)) return 0;
    return Math.max(0,Number(def.signature?.value ?? (5 * Number(def.mk || 0))) || 0);
  }

  // Armor upkeep writes effects, so one client does it: the active GM. With
  // several GMs connected each one used to create its own copy of the bonus.
  const isAuthority = () => game.users?.activeGM?.isSelf === true;

  async function syncHelixSpeed(actor) {
    if (!actor || !isAuthority()) return false;

    const current = list(actor.effects).filter(effect =>
      effect.flags?.[FLAG]?.armorHelixKineticSync === true
    );

    const bonus = helixSpeedBonus(actor);

    if (!bonus) {
      if (current.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",current.map(e => e.id));
        return true;
      }
      return false;
    }

    const spec = {
      name:"KINETIC SYNC // HELIX",
      img:null,
      type:"base",
      system:{
        changes:[{
          key:"system.attributes.movement.walk",
          value:String(bonus),
          type:"add",
          priority:null
        }]
      },
      disabled:false,
      duration:{value:null,units:"seconds",expiry:null,expired:false},
      description:"Helix armor synchronized to an equipped Helix firearm: +"+bonus+" ft walking Speed.",
      origin:null,
      tint:"#ffffff",
      transfer:false,
      statuses:[],
      sort:0,
      flags:{
        [FLAG]:{
          armorHelixKineticSync:true,
          speedBonus:bonus,
          runtimeVersion:VERSION
        }
      }
    };

    const existing = current[0] ?? null;
    const existingBonus = Number(existing?.flags?.[FLAG]?.speedBonus ?? 0);

    if (existing && current.length === 1 && existingBonus === bonus) return false;

    if (current.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect",current.map(e => e.id));
    }
    await actor.createEmbeddedDocuments("ActiveEffect",[spec]);
    return true;
  }

  function combatantActor(combat) {
    return combat?.combatant?.actor ?? null;
  }

  function combatStamp(combat) {
    if (!combat?.id) return null;
    return String(combat.id)+":"+String(combat.round ?? 0)+":"+String(combat.turn ?? 0);
  }

  async function setForgeBraced(actor,value,stamp=null) {
    if (!actor || !isAuthority()) return;

    const def = equippedDefinition(actor);
    const bonus =
      value && def?.company === "ForgeLine Industries"
        ? Math.max(0,Number(def.signature?.value ?? def.mk ?? 0) || 0)
        : 0;

    const current = actor.flags?.[FLAG] ?? {};
    const existing = list(actor.effects).filter(effect =>
      effect.flags?.[FLAG]?.armorForgeLineBraced === true
    );

    const stateChanged =
      Boolean(current.forgeLineBraced) !== Boolean(value) ||
      String(current.forgeLineBracedFrom ?? "") !== String(stamp ?? "");

    if (stateChanged) {
      await actor.update({
        ["flags."+FLAG+".forgeLineBraced"]:Boolean(value),
        ["flags."+FLAG+".forgeLineBracedFrom"]:stamp ?? ""
      });
    }

    if (!bonus) {
      if (existing.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",existing.map(e => e.id));
      }
      return;
    }

    if (
      existing.length === 1 &&
      Number(existing[0]?.flags?.[FLAG]?.acBonus ?? 0) === bonus
    ) return;

    if (existing.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect",existing.map(e => e.id));
    }

    await actor.createEmbeddedDocuments("ActiveEffect",[{
      name:"ANCHOR PLATING // BRACED",
      img:null,
      type:"base",
      system:{
        changes:[{
          key:"system.attributes.ac.bonus",
          value:String(bonus),
          type:"add",
          priority:null
        }]
      },
      disabled:false,
      duration:{value:null,units:"seconds",expiry:null,expired:false},
      description:"Stationary ForgeLine posture: +"+bonus+" AC until the start of this actor's next turn.",
      origin:null,
      tint:"#ffffff",
      transfer:false,
      statuses:[],
      sort:0,
      flags:{
        [FLAG]:{
          armorForgeLineBraced:true,
          acBonus:bonus,
          runtimeVersion:VERSION
        }
      }
    }]);
  }

  async function finalizeForgeTurn(turn) {
    if (!turn?.actorId || !turn?.stamp || !isAuthority()) return;
    const actor = game.actors?.get?.(turn.actorId) ?? null;
    const def = equippedDefinition(actor);
    if (def?.company !== "ForgeLine Industries") return;
    const movedStamp = String(actor.flags?.[FLAG]?.forgeLineMovedStamp ?? "");
    await setForgeBraced(actor,movedStamp !== String(turn.stamp),turn.stamp);
  }

  function forgeLineAcBonus(actor) {
    const def = equippedDefinition(actor);
    if (def?.company !== "ForgeLine Industries") return 0;
    if (actor?.flags?.[FLAG]?.forgeLineBraced !== true) return 0;
    return Math.max(0,Number(def.signature?.value ?? 0) || 0);
  }

  // Compatibility aliases retained for any old macros that referenced the
  // ranged-only helper names before Anchor Plating became universal AC.
  function forgeLineRangedAcBonus(actor) {
    return forgeLineAcBonus(actor);
  }

  function rangedArmorClass(actor) {
    const base = Number(actor?.system?.attributes?.ac?.value ?? 0) || 0;
    return base + forgeLineAcBonus(actor);
  }

  function isFirearmItem(item) {
    if (!item || item.type !== "weapon") return false;
    const flags = item.flags?.[FLAG] ?? {};
    const kind = String(flags.weaponKind ?? "").toLowerCase();
    if (kind) return kind === "firearm";

    const def =
      globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.weapons?.definition?.(item) ??
      null;

    return Boolean(def && def.weaponClass !== "Bow");
  }

  function bastionFirearmDr(actor,item) {
    const def = equippedDefinition(actor);
    if (def?.company !== "Bastion Strategic") return 0;
    if (!isFirearmItem(item)) return 0;
    return Math.max(0,Math.floor(Number(def.signature?.value ?? 0) || 0));
  }

  function bastionBulletProfile(actor,item) {
    const dr = bastionFirearmDr(actor,item);
    return dr ? {dr} : null;
  }

  function originItem(options={}) {
    const origin = options.origin ?? null;
    const candidates = [
      origin?.item,
      origin?.parent?.documentName === "Item" ? origin.parent : null,
      origin?.documentName === "Item" ? origin : null,
      options.originatingMessage?.item ?? null,
      (() => {
        try {
          return options.originatingMessage
            ?.getAssociatedActivity?.()
            ?.item ?? null;
        } catch {
          return null;
        }
      })()
    ].filter(Boolean);

    if (candidates.length) return candidates[0];

    const uuidCandidates = [
      // dnd5e 5.3.3 ActivityMixin.messageFlags stores the canonical Item UUID
      // here on both attack and damage roll messages.
      options.originatingMessage?.flags?.dnd5e?.item?.uuid,
      options.originatingMessage?.system?.context?.item?.uuid,
      options.originatingMessage?.system?.context?.itemUuid,
      options.originatingMessage?.flags?.dnd5e?.itemUuid,
      options.origin?.itemUuid
    ].filter(Boolean);

    for (const uuid of uuidCandidates) {
      try {
        const doc = fromUuidSync(String(uuid));
        if (doc?.documentName === "Item") return doc;
        if (doc?.item?.documentName === "Item") return doc.item;
      } catch {}
    }
    return null;
  }

  function isGrenadeItem(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    return String(flags.sourceCategory ?? "").toLowerCase() === "grenades" ||
      Boolean(flags.grenadeKey);
  }

  function reduceFirstDamagePart(damages,reduction,floor=0) {
    const amount = Math.max(0,Math.floor(Number(reduction) || 0));
    if (!amount) return 0;

    for (const part of damages ?? []) {
      const current = Number(part?.value);
      if (!Number.isFinite(current) || current <= floor) continue;
      const delta = Math.min(amount,Math.max(0,Math.floor(current - floor)));
      part.value = Math.max(floor,current - delta);
      return delta;
    }
    return 0;
  }

  function zeroDamageDescriptions(damages) {
    let removed = 0;
    for (const part of damages ?? []) {
      const current = Number(part?.value);
      if (!Number.isFinite(current) || current <= 0) continue;
      removed += current;
      part.value = 0;
    }
    return removed;
  }

  function adjustDamage(actor,amount,damageType,{sourceKind=""}={}) {
    let value = Math.max(0,Math.floor(Number(amount) || 0));
    const type = String(damageType ?? "").trim().toLowerCase();
    const source = String(sourceKind ?? "").trim().toLowerCase();

    if (value > 0 && source === "grenade" && grenadeImmune(actor)) {
      return 0;
    }

    if (value > 0 && source === "grenade" && grenadeResistant(actor)) {
      value = Math.floor(value / 2);
    }

    if (value > 0 && type === "fire" && hasFireResistance(actor)) {
      value = Math.floor(value / 2);
    }

    return value;
  }

  function installHooks() {
    hooks.push(
      ["dnd5e.preCalculateDamage",Hooks.on(
        "dnd5e.preCalculateDamage",
        (actor,damages,options={}) => {
          const item = originItem(options);

          if (grenadeImmune(actor) && isGrenadeItem(item)) {
            const removed = zeroDamageDescriptions(damages);
            if (removed > 0) {
              console.debug("FEHA ARMOR // VEKTOR GRENADE NULL",{actor:actor?.name,removed});
            }
            return;
          }

          if (grenadeResistant(actor) && isGrenadeItem(item)) {
            halveDamageDescriptions(damages);
            return;
          }

          const dr = bastionFirearmDr(actor,item);
          if (!dr) return;

          const reduced = reduceFirstDamagePart(damages,dr,0);

          if (reduced > 0) {
            console.debug(
              "FEHA ARMOR // BASTION TAKE THE BULLET",
              {
                actor:actor?.name,
                weapon:item?.name,
                firearmDR:dr,
                reduced
              }
            );
          }
        }
      )]
    );

    if (game.user?.isGM) {
      hooks.push(
        ["updateToken",Hooks.on("updateToken",async (token,changed) => {
          const moved =
            Object.prototype.hasOwnProperty.call(changed,"x") ||
            Object.prototype.hasOwnProperty.call(changed,"y") ||
            Object.prototype.hasOwnProperty.call(changed,"elevation");
          if (!moved) return;

          const actor = token?.actor ?? null;
          if (!actor) return;

          // Anchor Plating is earned by not moving during YOUR turn and
          // lasts until the start of your next turn. Movement outside your turn
          // (including forced movement) must not erase the already-earned AC.
          if (
            activeForgeTurn?.actorId === actor.id &&
            activeForgeTurn?.stamp
          ) {
            await actor.update({
              ["flags."+FLAG+".forgeLineMovedStamp"]:activeForgeTurn.stamp
            });
          }
        })]
      );

      hooks.push(
        ["updateCombat",Hooks.on("updateCombat",async combat => {
          const stamp = combatStamp(combat);
          const current = combatantActor(combat);

          if (
            activeForgeTurn?.stamp &&
            activeForgeTurn.stamp !== stamp
          ) {
            await finalizeForgeTurn(activeForgeTurn);
          }

          if (
            current &&
            activeForgeTurn?.stamp !== stamp
          ) {
            if (equippedDefinition(current)?.company === "ForgeLine Industries") {
              await setForgeBraced(current,false,null);
            }
            activeForgeTurn = {
              actorId:current.id,
              stamp
            };
          }
        })]
      );

      const syncActorFromItem = item => {
        const actor = item?.parent?.documentName === "Actor" ? item.parent : null;
        if (!actor) return;
        queueMicrotask(() => void syncHelixSpeed(actor).catch(() => {}));
      };

      for (const event of ["createItem","updateItem","deleteItem"]) {
        hooks.push([event,Hooks.on(event,syncActorFromItem)]);
      }
    }
  }

  const api = {
    version:VERSION,
    equippedDefinition,
    equippedArmorItem,
    quickhackSaveBonus,
    empSaveAdvantage,
    empImmune,
    grenadeImmune,
    grenadeResistant,
    hasFireResistance,
    helixSpeedBonus,
    syncHelixSpeed,
    forgeLineAcBonus,
    forgeLineRangedAcBonus,
    rangedArmorClass,
    bastionFirearmDr,
    bastionBulletProfile,
    adjustDamage,

    async init() {
      installHooks();

      // The running fight, even when the tracker shows another encounter.
      const combat =
        (game.combat?.started ? game.combat : null) ??
        list(game.combats).find(entry => entry?.started) ??
        null;
      const current = combatantActor(combat);
      const stamp = combatStamp(combat);
      if (current && stamp) {
        activeForgeTurn = {actorId:current.id,stamp};
      }

      if (game.user?.isGM) {
        for (const actor of list(game.actors)) {
          try { await syncHelixSpeed(actor); } catch {}

          // Hot reload removes runtime-owned ActiveEffects in destroy().
          // Rehydrate an already-earned ForgeLine brace from actor flags so a
          // mid-combat DEV LOADER run does not silently erase valid AC.
          if (
            actor.flags?.[FLAG]?.forgeLineBraced === true &&
            equippedDefinition(actor)?.company === "ForgeLine Industries"
          ) {
            try {
              await setForgeBraced(
                actor,
                true,
                actor.flags?.[FLAG]?.forgeLineBracedFrom ?? null
              );
            } catch {}
          }
        }
      }

      game.adk ??= {};
      game.adk.armorRuntime = api;
      globalThis.FEHA_ARMOR_RUNTIME = api;

      console.log("FEHA ARMOR RUNTIME",VERSION,"online");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }

      // Only the client that recreates these effects on init removes them.
      if (isAuthority()) {
        for (const actor of list(game.actors)) {
          for (const effect of list(actor.effects).filter(effect =>
            effect.flags?.[FLAG]?.armorHelixKineticSync === true ||
            effect.flags?.[FLAG]?.armorForgeLineBraced === true
          )) {
            try { await effect.delete(); } catch {}
          }
        }
      }

      if (game?.adk?.armorRuntime === api) delete game.adk.armorRuntime;
      if (globalThis.FEHA_ARMOR_RUNTIME === api) delete globalThis.FEHA_ARMOR_RUNTIME;
    }
  };

  core.registerModule("armorRuntime",api);
  globalThis.FEHA_ARMOR_RUNTIME = api;
})();