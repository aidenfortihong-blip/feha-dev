// FEHA // CYBERWARE RUNTIME
// Makes installed chrome do what FEHA_CYBERWARE_CATALOG says.
//
// CHARGE: the cyberware capacity a character has left unused (maximum minus
// installed chrome, plus any charge cells). Activating chrome spends charge;
// a rest gives it all back. A character who fills every slot has little left
// to fire the big systems, and one who leaves room can use them more often.
//
// Passive bonuses are kept as one Active Effect per installed item
// ("CHROME // name") on the character, created and removed as chrome is
// installed and ejected.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  const catalog = globalThis.FEHA_CYBERWARE_CATALOG;

  if (!core || !catalog) {
    throw new Error("FEHA_CYBERWARE_RUNTIME requires Cyber Core + Cyberware Catalog.");
  }

  const VERSION = "1.2.1";
  const FLAG = "fleshEnshrouded";
  const SPENT_FLAG = "cyberwareChargeSpent";
  const USED_FLAG = "cyberwareUsedThisRest";
  const WEAPON_FLAG = "cyberarmWeapon";

  // Cyberarm weapons are built from this world weapon (its attack activity
  // and sheet layout), then given their own name, damage and reach.
  const WEAPON_TEMPLATE = "Katana";
  const BLADE_CLASSES = ["Katana","Knife","Machete","Sword","Heavy Blade"];
  const PASSIVE_FLAG = "cyberwarePassive";
  const ACTIVE_FLAG = "cyberwareActive";
  const MANAGER_ID = "adk-chrome-manager-34";
  const CHIP_CLASS = "feha-cw-charge";

  // Forcing chrome without the charge for it: damage dice per missing charge.
  const PUSH_DICE = 2;

  // Mirrors the Chrome Manager module (chrome-legacy.js).
  const CAPACITY_BASE = 12;
  const CAPACITY_PER_LEVEL = 4;

  const hooks = [];
  const syncing = new Set();
  const resync = new Set();
  let clickHandler = null;

  const esc = value => foundry.utils.escapeHTML(String(value ?? ""));

  function list(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  }

  const flags = doc => doc?.flags?.[FLAG] ?? {};

  function isInstalled(item) {
    if (!catalog.isCyberware(item) || !item.actor) return false;

    const f = flags(item);
    return f.installed === true || f.isInstalled === true;
  }

  function installed(actor) {
    return list(actor?.items)
      .filter(isInstalled)
      .map(item => ({item,def:catalog.definition(item)}));
  }

  function capacityCost(item) {
    const f = flags(item);
    const rating = Math.max(1,Math.min(5,Number(f.rating ?? f.tier ?? 2) || 2));
    const slot = String(f.cyberwareSlot ?? "");

    return rating + (slot === "Operating System" || slot === "Arms" ? 1 : 0);
  }

  // {max, used, bonus, pool, spent, remaining}
  function charge(actor) {
    const chrome = installed(actor);

    const boosters = chrome
      .filter(entry => /cyberware capacity booster/i.test(entry.item.name))
      .reduce((total,entry) =>
        total + 2 + (Number(flags(entry.item).rating) || 0),0);

    const max = Math.max(
      1,
      CAPACITY_BASE +
      CAPACITY_PER_LEVEL * (Number(actor?.system?.details?.level ?? 0) || 0) +
      (Number(actor?.system?.abilities?.con?.mod ?? 0) || 0) +
      (Number(flags(actor).cyberwareCapacityBonus ?? 0) || 0) +
      boosters
    );

    const used = chrome.reduce(
      (total,entry) => total + capacityCost(entry.item),
      0
    );

    const bonus = chrome.reduce(
      (total,entry) => total + (Number(entry.def?.chargeBonus) || 0),
      0
    );

    const pool = Math.max(0,max - used) + bonus;
    const spent = Math.max(0,Number(flags(actor)[SPENT_FLAG] ?? 0) || 0);

    return {
      max,
      used,
      bonus,
      pool,
      spent:Math.min(spent,pool),
      remaining:Math.max(0,pool - spent)
    };
  }

  function chargeCost(actor,def) {
    const discount = installed(actor).reduce((total,entry) => {
      const amount = Number(entry.def?.chargeDiscount) || 0;
      if (!amount) return total;

      const slots = entry.def.discountSlots;
      return slots && !slots.includes(def.slot) ? total : total + amount;
    },0);

    return Math.max(1,Number(def.active.charge) - discount);
  }

  // ---- Passive bonuses -----------------------------------------------------

  // Most characters in this world have no base walking speed recorded, so a
  // speed bonus would show as the bonus alone. Any effect that changes speed
  // first raises an unset speed to the standard 30 ft.
  function withBaseSpeed(changes) {
    const WALK = "system.attributes.movement.walk";
    // Always a copy: Foundry fills in defaults on the objects it is given,
    // and the catalog rows must stay exactly as written (their text is the
    // fingerprint that decides whether an effect is up to date).
    const copy = foundry.utils.deepClone(changes);
    if (!copy.some(change => change.key === WALK)) return copy;

    return [{key:WALK,value:"30",type:"upgrade",priority:5},...copy];
  }

  // What an installed item changes on this actor. Most of it is the catalog
  // row as written; HP per level is worked out here, because characters in
  // this world have a hand-set maximum HP that dnd5e's own per-level bonus
  // does not touch.
  function passiveChanges(actor,def) {
    const changes = [...(def?.changes ?? [])];

    if (def?.hpPerLevel) {
      const level = Math.max(1,Number(actor?.system?.details?.level ?? 0) || 0);

      changes.push({
        key:"system.attributes.hp.max",
        value:String(def.hpPerLevel * level),
        type:"add"
      });
    }

    return changes;
  }

  const fingerprint = (actor,def) =>
    VERSION+JSON.stringify(passiveChanges(actor,def));

  async function syncActor(actor) {
    if (!actor?.isOwner) return;

    // A change that arrives mid-sync is not dropped: the sync runs once more
    // when the current pass finishes.
    if (syncing.has(actor.id)) {
      resync.add(actor.id);
      return;
    }

    syncing.add(actor.id);

    try {
      const wanted = new Map(
        installed(actor)
          .filter(entry => passiveChanges(actor,entry.def).length)
          .map(entry => [entry.item.id,entry])
      );

      const stale = [];

      for (const effect of list(actor.effects)) {
        const meta = flags(effect)[PASSIVE_FLAG];
        if (!meta) continue;

        const entry = wanted.get(meta.itemId);

        if (entry && meta.fingerprint === fingerprint(actor,entry.def)) {
          wanted.delete(meta.itemId);
        } else {
          stale.push(effect.id);
        }
      }

      if (stale.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",stale);
      }

      if (wanted.size) {
        await actor.createEmbeddedDocuments(
          "ActiveEffect",
          [...wanted.values()].map(({item,def}) => ({
            name:"CHROME // "+def.name,
            img:item.img || "icons/svg/upgrade.svg",
            type:"base",
            description:"<p>"+esc(def.effectText)+"</p>",
            system:{changes:withBaseSpeed(passiveChanges(actor,def))},
            flags:{
              [FLAG]:{
                [PASSIVE_FLAG]:{
                  itemId:item.id,
                  fingerprint:fingerprint(actor,def)
                }
              }
            }
          }))
        );
      }

      await syncWeapons(actor);
    } catch (error) {
      console.warn("FEHA CYBERWARE // passive sync failed",actor?.name,error);
    } finally {
      syncing.delete(actor.id);
    }

    if (resync.delete(actor.id)) await syncActor(actor);
  }

  // ---- Cyberarm weapons ----------------------------------------------------
  // Mantis Blades, Monowire and gorilla fists are real weapons in the owner's
  // inventory, next to their guns, for as long as the chrome is installed.

  function weaponData(item,def) {
    const spec = def.weapon;
    const template = list(game.items).find(candidate =>
      candidate.type === "weapon" && candidate.name === WEAPON_TEMPLATE
    );
    if (!template) return null;

    const data = template.toObject();
    delete data._id;

    data.name = spec.name;
    data.img = item.img || data.img;
    data.folder = null;
    data.flags = {
      [FLAG]:{
        [WEAPON_FLAG]:{itemId:item.id,fingerprint:VERSION+JSON.stringify(spec)},
        meleeClass:spec.type === "slashing" ? "Katana" : "Blunt",
        manufacturer:def.company
      }
    };

    const system = data.system;
    system.description = {
      value:"<p>"+esc(def.effectText)+"</p><p><em>Part of "+esc(def.name)+
        ". It leaves your inventory if the chrome is removed.</em></p>"
    };
    system.equipped = true;
    system.proficient = 1;
    system.quantity = 1;
    system.weight = {...(system.weight ?? {}),value:0};
    system.price = {...(system.price ?? {}),value:0};
    system.properties = spec.finesse ? ["fin"] : [];
    system.range = {...(system.range ?? {}),value:spec.reach,reach:spec.reach,long:0,units:"ft"};
    system.damage.base = {
      ...system.damage.base,
      number:0,
      denomination:0,
      bonus:"",
      custom:{enabled:true,formula:spec.damage},
      types:[spec.type]
    };

    for (const activity of Object.values(system.activities ?? {})) {
      if (activity.type !== "attack") continue;
      activity.attack.ability = spec.ability;
      activity.attack.critical = {threshold:spec.crit ?? 20};
    }

    return data;
  }

  async function syncWeapons(actor) {
    const wanted = new Map(
      installed(actor)
        .filter(entry => entry.def?.weapon)
        .map(entry => [entry.item.id,entry])
    );

    const stale = [];

    for (const weapon of list(actor.items)) {
      const meta = flags(weapon)[WEAPON_FLAG];
      if (!meta) continue;

      const entry = wanted.get(meta.itemId);
      const current =
        entry && meta.fingerprint === VERSION+JSON.stringify(entry.def.weapon);

      if (current) wanted.delete(meta.itemId);
      else stale.push(weapon.id);
    }

    if (stale.length) await actor.deleteEmbeddedDocuments("Item",stale);

    const fresh = [...wanted.values()]
      .map(({item,def}) => weaponData(item,def))
      .filter(Boolean);

    if (fresh.length) await actor.createEmbeddedDocuments("Item",fresh);
  }

  // The client that made the change does the sync, so it runs exactly once.
  // createItem and deleteItem pass (item, options, userId); updateItem passes
  // (item, changes, options, userId). The user id is always the last argument.
  function onItemChange(item,...rest) {
    const userId = rest.at(-1);
    if (userId !== game.user?.id) return;
    if (!item?.actor || !catalog.isCyberware(item)) return;

    syncActor(item.actor);
    queueChip();
  }

  // ---- Activation ----------------------------------------------------------

  async function confirmPush(actor,def,cost,available) {
    const missing = cost - available;

    return foundry.applications.api.DialogV2.confirm({
      window:{title:"Push past the limit"},
      content:
        "<p><strong>"+esc(def.name)+"</strong> needs "+cost+" charge and "+
        esc(actor.name)+" has "+available+".</p>"+
        "<p>Force it anyway and take <strong>"+(missing * PUSH_DICE)+"d6 psychic damage</strong> "+
        "that nothing can reduce?</p>",
      rejectClose:false
    });
  }

  async function rollFormula(actor,formula) {
    const roll = new Roll(String(formula),actor.getRollData?.() ?? {});
    await roll.evaluate();
    return roll;
  }

  async function activate(item) {
    const actor = item?.actor ?? null;
    const def = catalog.definition(item);

    if (!actor || !def?.active) return null;

    if (!actor.isOwner) {
      ui.notifications?.warn?.("You cannot activate chrome for "+actor.name+".");
      return null;
    }

    if (!isInstalled(item)) {
      ui.notifications?.warn?.(def.name+" is not installed.");
      return null;
    }

    const spec = def.active;
    const hp = actor.system?.attributes?.hp ?? {};
    const hpMax = Number(hp.effectiveMax ?? hp.max ?? 0);
    const hpNow = Number(hp.value ?? 0);

    const other = spec.healsTarget
      ? [...(game.user?.targets ?? [])]
          .map(token => token.actor)
          .find(target => target && target.id !== actor.id) ?? null
      : null;

    if (spec.heal && !other && hpNow >= hpMax) {
      ui.notifications?.warn?.(actor.name+" is already at full HP.");
      return null;
    }

    const deck = spec.ram
      ? globalThis.FEHA_TABLETOP_UI_V3?.model?.(actor) ?? null
      : null;

    if (spec.ram && (!deck?.deck || deck.currentRam >= deck.maxRam)) {
      ui.notifications?.warn?.(
        deck?.deck
          ? actor.name+" is already at full RAM."
          : actor.name+" has no cyberdeck installed."
      );
      return null;
    }

    const usedThisRest = list(flags(actor)[USED_FLAG]).map(String);

    if (spec.oncePerRest && usedThisRest.includes(def.key)) {
      ui.notifications?.warn?.(
        actor.name+" has already used "+def.name+" since their last rest."
      );
      return null;
    }

    const state = charge(actor);
    const cost = chargeCost(actor,def);
    const paid = Math.min(cost,state.remaining);
    const lines = [];
    const rolls = [];
    const update = {
      ["flags."+FLAG+"."+SPENT_FLAG]:state.spent + paid
    };

    if (spec.oncePerRest) {
      update["flags."+FLAG+"."+USED_FLAG] = [...usedThisRest,def.key];
    }

    let hpAfter = hpNow;

    if (paid < cost) {
      if (!(await confirmPush(actor,def,cost,state.remaining))) return null;

      const strain = await rollFormula(actor,((cost - paid) * PUSH_DICE)+"d6");
      rolls.push(strain);
      hpAfter = Math.max(0,hpAfter - Number(strain.total));
      lines.push(
        "Pushed past the limit: "+strain.total+" psychic damage."
      );
    }

    if (spec.heal) {
      const heal = await rollFormula(actor,spec.heal);
      rolls.push(heal);

      if (other) {
        lines.push(other.name+" regains "+heal.total+" HP (GM applies it).");
      } else {
        const before = hpAfter;
        hpAfter = Math.min(hpMax,hpAfter + Number(heal.total));
        lines.push("Regained "+(hpAfter - before)+" HP.");
      }
    }

    if (spec.halfHp) {
      hpAfter = Math.max(hpAfter,Math.floor(hpMax / 2));
      lines.push("Back on your feet at "+hpAfter+" HP.");
    }

    if (hpAfter !== hpNow) {
      update["system.attributes.hp.value"] = hpAfter;
    }

    if (spec.tempHp) {
      const temp = Number((await rollFormula(actor,spec.tempHp)).total);

      if (temp > Number(hp.temp ?? 0)) {
        update["system.attributes.hp.temp"] = temp;
      }

      lines.push(temp+" temporary HP.");
    }

    if (spec.ram) {
      const after = Math.min(deck.maxRam,deck.currentRam + spec.ram);
      update["flags."+FLAG+".ramCurrent"] = after;
      lines.push("RAM "+deck.currentRam+" to "+after+".");
    }

    if (spec.roll) {
      const effectRoll = await rollFormula(actor,spec.roll);
      rolls.push(effectRoll);
      lines.push("Rolled "+effectRoll.total+" ("+spec.roll+").");
    }

    await actor.update(update);

    // A bonus against one attack only means something inside a fight; outside
    // combat nothing would ever end it.
    const inCombat = list(game.combats).some(combat =>
      combat.started &&
      list(combat.combatants).some(combatant => combatant.actorId === actor.id)
    );

    if (spec.duration && (inCombat || !spec.turnOnly)) {
      const previous = list(actor.effects)
        .filter(effect => flags(effect)[ACTIVE_FLAG]?.itemId === item.id)
        .map(effect => effect.id);

      if (previous.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",previous);
      }

      await actor.createEmbeddedDocuments("ActiveEffect",[{
        name:spec.label ? spec.label+" // "+def.name : def.name,
        img:item.img || "icons/svg/upgrade.svg",
        type:"base",
        description:"<p>"+esc(def.effectText)+"</p>",
        system:{changes:withBaseSpeed(spec.changes ?? [])},
        statuses:spec.statuses ?? [],
        duration:spec.duration,
        flags:{[FLAG]:{[ACTIVE_FLAG]:{
          itemId:item.id,
          turnOnly:Boolean(spec.turnOnly),
          attackAdvantage:Boolean(spec.attackAdvantage)
        }}}
      }]);
    }

    const after = charge(actor);

    const content =
      '<div class="feha-chat-card">'+
      '<small class="feha-chat-kicker">CYBERWARE // '+paid+' CHARGE</small>'+
      "<h3>"+esc(def.name)+"</h3>"+
      "<p>"+esc(def.effectText)+"</p>"+
      (lines.length
        ? '<p class="feha-chat-result">'+lines.map(esc).join("<br>")+"</p>"
        : "")+
      '<small class="feha-chat-foot">'+after.remaining+" of "+
      after.pool+" charge left</small>"+
      "</div>";

    await ChatMessage.create({
      speaker:ChatMessage.getSpeaker({actor}),
      content,
      rolls,
      sound:rolls.length ? CONFIG.sounds?.dice : undefined
    });

    queueChip();

    return {key:def.key,paid,remaining:after.remaining};
  }

  // Chrome with an activation is used; everything else opens its sheet as usual.
  function handles(item) {
    return Boolean(
      catalog.isCyberware(item) &&
      item.actor &&
      catalog.definition(item)?.active
    );
  }

  // ---- Chrome Manager ------------------------------------------------------

  // The manager's own USE only counts item uses; charge is what limits chrome.
  function onManagerClick(event) {
    const button = event.target?.closest?.(
      "#"+MANAGER_ID+" [data-feha-activate], #"+MANAGER_ID+" [data-use], #"+MANAGER_ID+" [data-use-item]"
    );
    if (!button) return;

    const backend = globalThis.ADKChromeBackend ?? null;
    const actor = backend?.getActor?.() ?? backend?.actor ?? null;
    const item = actor?.items?.get?.(
      button.dataset.fehaActivate ??
      button.dataset.use ??
      button.dataset.useItem
    );

    if (!item || !handles(item)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    activate(item)
      .catch(error => {
        console.error("FEHA CYBERWARE // activation failed",error);
        ui.notifications?.error?.("Cyberware activation failed.");
      })
      .finally(() => {
        try { backend?.refresh?.(); } catch {}
      });
  }

  let chipQueued = false;

  function queueChip() {
    if (chipQueued) return;
    chipQueued = true;

    requestAnimationFrame(() => {
      chipQueued = false;
      syncManager(document.getElementById(MANAGER_ID));
    });
  }

  // Called from latest-dev.js markRoot() after every Chrome Manager redraw.
  function syncManager(root) {
    if (!root) return;

    const head = root.querySelector(".adk-v6-capacity-head");
    const backend = globalThis.ADKChromeBackend ?? null;
    const actor = backend?.getActor?.() ?? backend?.actor ?? null;
    if (!head || !actor) return;

    const state = charge(actor);
    const text = state.remaining+" / "+state.pool;

    let chip = head.querySelector("."+CHIP_CLASS);

    if (!chip) {
      chip = document.createElement("div");
      chip.className = CHIP_CLASS;
      chip.title =
        "Charge is your unused Cyberware Capacity. Active chrome spends it; a rest restores it.";
      chip.innerHTML = "<span>CHARGE</span><b></b>";
      head.appendChild(chip);
    }

    const value = chip.querySelector("b");
    if (value.textContent !== text) value.textContent = text;

    // The inspector hides the module's own USE buttons, so active chrome gets
    // an ACTIVATE button in the item dossier.
    const eject = root.querySelector("button.adk-v6-primary[data-remove]");
    const item = eject ? actor.items?.get?.(eject.dataset.remove) : null;
    const def = item ? catalog.definition(item) : null;
    const existing = root.querySelector("[data-feha-activate]");

    if (!def?.active) {
      existing?.remove();
      return;
    }

    const cost = chargeCost(actor,def);
    const detail =
      String(def.active.action).toUpperCase()+" // "+cost+" CHARGE"+
      (state.remaining < cost ? " // PUSH FOR DAMAGE" : "");

    let button = existing;

    if (!button || button.dataset.fehaActivate !== item.id) {
      existing?.remove();
      button = document.createElement("button");
      button.type = "button";
      button.className = "adk-v6-primary feha-cw-activate";
      button.dataset.fehaActivate = item.id;
      button.innerHTML = "<span>ACTIVATE</span><small></small>";
      // Directly under the effect text, so it is visible without scrolling.
      const effectBox = eject.parentElement?.querySelector(".hardware-effect");
      if (effectBox) effectBox.after(button);
      else eject.before(button);
    }

    const small = button.querySelector("small");
    if (small.textContent !== detail) small.textContent = detail;
  }

  function isWounded(actor) {
    const hp = actor?.system?.attributes?.hp ?? {};
    const max = Number(hp.effectiveMax ?? hp.max ?? 0);
    return max > 0 && Number(hp.value ?? 0) < max / 2;
  }

  function isBlade(weapon) {
    const f = flags(weapon);
    return (
      BLADE_CLASSES.includes(String(f.meleeClass ?? f.weaponClass ?? "")) ||
      (f[WEAPON_FLAG] && weapon?.system?.damage?.base?.types?.has?.("slashing"))
    );
  }

  function isMelee(activity) {
    return (
      activity?.actionType === "mwak" ||
      activity?.attack?.type?.value === "melee"
    );
  }

  // Damage riders: No Pain No Gain, Knife Sharpener, Blood Depleter.
  function onPreRollDamage(config) {
    try {
      const activity = config?.subject ?? null;
      const actor = activity?.actor ?? activity?.item?.actor ?? null;
      const first = config?.rolls?.[0];
      if (!actor || !first || activity?.type !== "attack") return;

      const weapon = activity.item ?? null;
      const chrome = installed(actor).map(entry => entry.def).filter(Boolean);
      const extra = [];

      if (chrome.some(def => def.rider === "woundedFury") && isWounded(actor)) {
        extra.push("2d6");
      }

      if (chrome.some(def => def.rider === "sharpBlades") && isBlade(weapon)) {
        extra.push("2d8");
      }

      if (chrome.some(def => def.rider === "bloodDepleter") && isMelee(activity)) {
        const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
        if (target && isWounded(target)) extra.push("2d6");
      }

      if (extra.length) first.parts = [...(first.parts ?? []),...extra];
    } catch (error) {
      console.warn("FEHA CYBERWARE // preRollDamage failed",error);
    }
  }

  // Attacks made while an activation grants advantage (stopped time), and
  // the attack bonuses installed chrome gives.
  function onPreRollAttack(config) {
    try {
      const activity = config?.subject ?? null;
      const actor = activity?.actor ?? activity?.item?.actor ?? null;
      if (!actor) return;

      const granted = list(actor.effects).some(effect =>
        flags(effect)[ACTIVE_FLAG]?.attackAdvantage &&
        !effect.disabled &&
        !effect.duration?.expired
      );

      if (granted) {
        config.advantage = true;

        for (const roll of config.rolls ?? []) {
          roll.options ??= {};
          roll.options.advantage = true;
        }
      }

      const weapon = activity?.item ?? null;
      const chrome = installed(actor).map(entry => entry.def).filter(Boolean);
      const bonuses = [];

      // Smart link: the best installed link, with Smart weapons only.
      if (flags(weapon).weaponTechnology === "Smart") {
        const link = Math.max(0,...chrome.map(def => Number(def.smartBonus) || 0));
        if (link) bonuses.push(String(link));
      }

      // No Pain No Gain: below half HP.
      if (chrome.some(def => def.rider === "woundedFury") && isWounded(actor)) {
        bonuses.push("2");
      }

      const first = config.rolls?.[0];

      if (first && bonuses.length) {
        first.parts = [...(first.parts ?? []),...bonuses];
      }

      // Knife Sharpener: blades crit on 19.
      if (
        first &&
        chrome.some(def => def.rider === "sharpBlades") &&
        isBlade(weapon)
      ) {
        first.options ??= {};
        first.options.criticalSuccess = Math.min(
          19,
          Number(first.options.criticalSuccess ?? 20) || 20
        );
      }
    } catch (error) {
      console.warn("FEHA CYBERWARE // preRollAttack failed",error);
    }
  }

  // ---- Rest, regeneration, expiry ------------------------------------------

  async function onRestCompleted(actor) {
    try {
      if (!actor?.isOwner) return;

      const update = {};

      if (Number(flags(actor)[SPENT_FLAG] ?? 0) > 0) {
        update["flags."+FLAG+"."+SPENT_FLAG] = 0;
      }

      if (list(flags(actor)[USED_FLAG]).length) {
        update["flags."+FLAG+"."+USED_FLAG] = [];
      }

      if (installed(actor).some(entry => entry.def?.restHealHalf)) {
        const hp = actor.system?.attributes?.hp ?? {};
        const max = Number(hp.effectiveMax ?? hp.max ?? 0);
        const healed = Math.min(
          max,
          Number(hp.value ?? 0) + Math.floor(max / 2)
        );

        if (healed > Number(hp.value ?? 0)) {
          update["system.attributes.hp.value"] = healed;
        }
      }

      if (Object.keys(update).length) await actor.update(update);

      const leftover = list(actor.effects)
        .filter(effect => flags(effect)[ACTIVE_FLAG])
        .map(effect => effect.id);

      if (leftover.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect",leftover);
      }

      queueChip();
    } catch (error) {
      console.warn("FEHA CYBERWARE // rest reset failed",error);
    }
  }

  async function onUpdateCombat(combat,changed) {
    if (game.users?.activeGM?.id !== game.user?.id) return;
    if (!changed || (!("turn" in changed) && !("round" in changed))) return;

    try {
      // Spent activations: Foundry marks them expired, the GM removes them.
      // One-attack reactions end as soon as the turn they were used in ends.
      for (const combatant of list(combat.combatants)) {
        const actor = combatant.actor;
        if (!actor) continue;

        const expired = list(actor.effects)
          .filter(effect => {
            const meta = flags(effect)[ACTIVE_FLAG];
            return meta && (meta.turnOnly || effect.duration?.expired);
          })
          .map(effect => effect.id);

        if (expired.length) {
          await actor.deleteEmbeddedDocuments("ActiveEffect",expired);
        }
      }

      // Regeneration at the start of the acting creature's turn.
      const actor = combat.combatant?.actor ?? null;
      if (!actor) return;

      const regen = installed(actor).reduce(
        (total,entry) => total + (Number(entry.def?.regen) || 0),
        0
      );
      if (!regen) return;

      const hp = actor.system?.attributes?.hp ?? {};
      const max = Number(hp.effectiveMax ?? hp.max ?? 0);
      const value = Number(hp.value ?? 0);

      if (value > 0 && value < max) {
        await actor.update({
          "system.attributes.hp.value":Math.min(max,value + regen)
        });
      }
    } catch (error) {
      console.warn("FEHA CYBERWARE // combat upkeep failed",error);
    }
  }

  const api = {
    version:VERSION,
    charge,
    chargeCost,
    installed,
    handles,
    use:activate,
    activate,
    syncActor,
    syncManager,

    async init() {
      await api.destroy();

      if (game.user?.isGM) {
        try {
          const result = await catalog.migrateAll();

          if (result.unknown?.length) {
            console.warn(
              "FEHA CYBERWARE // items with no catalog entry",
              result.unknown
            );
          }
        } catch (error) {
          console.error("FEHA CYBERWARE // migration failed",error);
          ui.notifications?.error?.("Cyberware migration failed. Check console.");
        }

        for (const actor of list(game.actors)) {
          if (list(actor.items).some(catalog.isCyberware)) {
            await syncActor(actor);
          }
        }
      }

      hooks.push(
        ["createItem",Hooks.on("createItem",onItemChange)],
        ["updateItem",Hooks.on("updateItem",onItemChange)],
        ["deleteItem",Hooks.on("deleteItem",onItemChange)],
        ["dnd5e.restCompleted",Hooks.on("dnd5e.restCompleted",onRestCompleted)],
        ["dnd5e.preRollAttackV2",Hooks.on("dnd5e.preRollAttackV2",onPreRollAttack)],
        ["dnd5e.preRollDamageV2",Hooks.on("dnd5e.preRollDamageV2",onPreRollDamage)],
        ["updateCombat",Hooks.on("updateCombat",onUpdateCombat)],
        ["updateActor",Hooks.on("updateActor",queueChip)]
      );

      clickHandler = onManagerClick;
      document.addEventListener("click",clickHandler,true);

      guardOwnedItemUpdates();

      console.log("FEHA CYBERWARE RUNTIME",VERSION,"ready");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }

      if (clickHandler) {
        document.removeEventListener("click",clickHandler,true);
        clickHandler = null;
      }

      restoreItemUpdates?.();

      document.querySelector("#"+MANAGER_ID+" ."+CHIP_CLASS)?.remove();
    }
  };

  // The installed Chrome Manager saves cyberware flags with
  // Item.updateDocuments and no parent, which only works for world items and
  // throws for chrome a character owns. Rows that belong to a character are
  // sent to that character instead; everything else passes through untouched.
  let restoreItemUpdates = null;

  function guardOwnedItemUpdates() {
    const base = foundry.abstract.Document;
    const original = base.updateDocuments;

    const guarded = async function(updates = [],operation = {}) {
      if (
        this.documentName !== "Item" ||
        operation?.parent ||
        operation?.pack ||
        !Array.isArray(updates)
      ) {
        return original.call(this,updates,operation);
      }

      const world = [];
      const owned = new Map();

      for (const row of updates) {
        const owner = game.items.has(row?._id)
          ? null
          : list(game.actors).find(actor => actor.items.has(row?._id));

        if (!owner) world.push(row);
        else owned.set(owner,[...(owned.get(owner) ?? []),row]);
      }

      if (!owned.size) return original.call(this,updates,operation);

      const done = world.length
        ? await original.call(this,world,operation)
        : [];

      for (const [actor,rows] of owned) {
        done.push(...await actor.updateEmbeddedDocuments("Item",rows,operation));
      }

      return done;
    };

    base.updateDocuments = guarded;
    restoreItemUpdates = () => {
      if (base.updateDocuments === guarded) base.updateDocuments = original;
      restoreItemUpdates = null;
    };
  }

  core.registerModule("cyberwareRuntime",api);
  globalThis.FEHA_CYBERWARE_RUNTIME = api;
})();
