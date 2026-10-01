// FEHA // MELEE CATALOG
// Balanced around one Action = one strike. Sandevistan multiplies Actions;
// Gorilla Arms satisfy melee STR requirements. Most weapons intentionally have
// no bespoke effect: their statline is their identity.
(() => {
  try { globalThis.FEHA_MELEE_CATALOG?.destroy?.(); } catch {}

  const VERSION = "1.2.0";
  const REWRITE = "melee-1.1-unified";
  const FLAG = "fleshEnshrouded";
  const MELEE_FOLDERS = new Set(["melee","-melee"]);

  const SPECIALS = Object.freeze({
    "Chainsword Legendary":{
      key:"redline-teeth",
      name:"REDLINE // TEETH IN THE WOUND",
      text:"Once per turn, when Chainsword Legendary hits a target it already hit earlier in the same turn, REDLINE triggers: add 3d10 slashing damage and treat worn armor's weapon-damage reduction as 0 for that hit. This is deliberately built to become monstrous when extra Actions let the wielder keep the teeth in one target.",
      automation:"manual",
      bonusDamage:"3d10",
      sameTargetSameTurn:true,
      ignoresWornArmorReduction:true,
      oncePerTurn:true
    },
    "Errata":{
      key:"thermal-runaway",
      name:"THERMAL RUNAWAY",
      text:"Errata compounds heat during the wielder's turn. The first successful hit is normal. Each consecutive successful hit against the same target adds +4d8 fire damage for every previous Errata hit that turn: hit 2 adds +4d8, hit 3 adds +8d8, hit 4 adds +12d8, continuing without a cap. From the third hit onward, worn armor's weapon-damage reduction is treated as 0 for that hit. The chain resets at end of turn or when a different target is chosen.",
      automation:"manual",
      bonusPerPreviousHit:"4d8 fire",
      uncapped:true,
      ignoresWornArmorReductionFromHit:3,
      resets:"end-turn-or-target-change"
    },
    "Neurotoxin Knife":{
      key:"blackout-dose",
      name:"BLACKOUT DOSE",
      text:"On a hit, the target makes a Constitution save against the wielder's melee save DC. On a failure it is Poisoned and cannot take Reactions until the end of its next turn. If a target already Poisoned by this knife fails another BLACKOUT DOSE save before that effect ends, its nervous system crashes and it is Stunned until the end of its next turn instead.",
      automation:"manual",
      save:"constitution",
      firstFailure:["poisoned","no-reactions"],
      repeatFailure:"stunned"
    }
  });

  const ROWS = Object.freeze([
    ["Baseball Bat","Blunt","7d6","bludgeoning",10,5,null,null],
    ["Baton Beta","Baton","5d8","bludgeoning",null,5,null,null],
    ["Baton Murphy","Baton","6d8","bludgeoning",10,5,null,null],
    ["Baton Tinker Bell","Baton","5d8","bludgeoning",null,5,null,null],
    ["Butcher's Knife","Knife","7d6","slashing",null,5,null,null],
    ["Cane Fingers","Knife","6d6","piercing",null,5,null,null],
    ["Chainsword Legendary","Heavy Blade","12d10","slashing",14,5,null,null],
    ["Chef's Knife","Knife","6d6","slashing",null,5,null,null],
    ["Crowbar","Blunt","5d8","bludgeoning",10,5,null,null],
    ["Dildo Stout","Blunt","1d100","bludgeoning",null,5,null,null],
    ["Errata","Katana","16d8","slashing",11,5,null,null],
    ["Fanged Axe Military","Axe","6d10","slashing",13,5,null,null],
    ["Hammer","Blunt","5d10","bludgeoning",12,5,null,null],
    ["Iron Pipe","Blunt","5d8","bludgeoning",10,5,null,null],
    ["Kanabo","Heavy Blunt","6d12","bludgeoning",15,5,null,null],
    ["Katana","Katana","7d8","slashing",10,5,null,null],
    ["Katana Go G","Katana","7d8","slashing",10,5,null,null],
    ["Katana Takemura","Katana","7d8+10","slashing",11,5,null,null],
    ["Knife Kurtz","Knife","7d6","piercing",null,5,null,null],
    ["Knife Military","Knife","7d6","piercing",null,5,null,null],
    ["Knife Stinger","Knife","7d6","piercing",null,5,null,null],
    ["Kukri","Knife","6d8","slashing",10,5,null,null],
    ["Kukri Voodoo","Knife","6d8","slashing",10,5,null,null],
    ["Machete","Machete","6d8","slashing",10,5,null,null],
    ["Machete Maelstrom","Machete","7d8","slashing",12,5,null,null],
    ["Machete Valentinos","Machete","5d8+7","slashing",10,5,null,null],
    ["Neurotoxin Knife","Knife","6d6","piercing",null,5,null,null],
    ["Punk Knife Pimp","Knife","7d6","piercing",null,5,null,null],
    ["Sword Witcher","Sword","6d10","slashing",12,5,null,null],
    ["Tanto","Knife","7d6","piercing",null,5,null,null],
    ["Tire Iron","Blunt","5d8","bludgeoning",10,5,null,null],
    ["Tomahawk","Axe","7d8","slashing",10,5,20,60],
    ["VB Axe","Heavy Axe","8d10","slashing",14,5,null,null]
  ]);

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const slug = value => norm(value).replace(/\s+/g,"-");
  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };
  const same = (a,b) => {
    try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }
    catch { return a === b; }
  };
  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  const DEFINITIONS = Object.freeze(
    ROWS.map(row => {
      const [name,weaponClass,damage,damageType,strengthRequirement,reach,thrownRange,thrownLong] = row;
      return Object.freeze({
        key:slug(name),
        name,
        weaponClass,
        damage,
        damageType,
        strengthRequirement,
        reach,
        thrownRange,
        thrownLong,
        special:SPECIALS[name] ? Object.freeze({...SPECIALS[name]}) : null
      });
    })
  );

  const byName = new Map(DEFINITIONS.map(def => [norm(def.name),def]));
  const byKey = new Map(DEFINITIONS.map(def => [norm(def.key),def]));

  function definition(value) {
    if (!value) return null;
    if (typeof value === "string") {
      return byKey.get(norm(value)) ?? byName.get(norm(value)) ?? null;
    }
    return byName.get(norm(value?.name)) ?? null;
  }

  function ancestorChain(folder) {
    const chain = [];
    let current = folder;
    let guard = 0;
    while (current && guard++ < 50) {
      chain.push(current);
      current = current.folder ?? current.parent ?? null;
    }
    return chain;
  }

  function isMeleeSource(item) {
    if (!item?.folder) return false;
    return ancestorChain(item.folder).some(folder =>
      MELEE_FOLDERS.has(String(folder?.name ?? "").trim().toLowerCase())
    );
  }

  function rewriteDescription(def) {
    const special = def.special
      ? '<div style="margin-top:10px;padding:10px;border:1px solid #5d4d20;background:#171308">'+
          '<small style="display:block;color:#f0c85a;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:5px">SPECIAL SYSTEM // '+esc(def.special.name)+'</small>'+
          '<p style="margin:0;line-height:1.5;color:#f4ead0 !important">'+esc(def.special.text)+'</p>'+
        '</div>'
      : "";

    const thrown = def.thrownRange != null
      ? String(def.thrownRange)+"/"+String(def.thrownLong)+" ft"
      : "—";

    const gorilla = def.strengthRequirement != null
      ? '<div style="margin-top:10px;padding:9px 10px;border-left:3px solid #4b7180;background:#0a151a;color:#b9cbd2 !important;font-size:11px"><strong style="color:#7ee6ff">GORILLA ARMS:</strong> satisfies this weapon\'s STR requirement.</div>'
      : "";

    return '<section data-feha-ui="item-card-v1" data-feha-melee-card="'+REWRITE+'" style="border:1px solid #2b5662;background:#071116;padding:13px 14px;color:#dce8ec !important">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #263941">'+
        '<small style="color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.12em">FEHA // MELEE WEAPON</small>'+
        '<strong style="color:#eefaff;font-size:12px">ONE ACTION // ONE STRIKE</strong>'+
      '</div>'+
      '<h2 style="margin:10px 0 4px;color:#fff">'+esc(def.name)+'</h2>'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #1f3239;border-bottom:1px solid #1f3239">'+
        '<div><small style="color:#8ca2ac">CLASS</small><br><strong style="color:#fff">'+esc(def.weaponClass)+'</strong></div>'+
        '<div><small style="color:#8ca2ac">DAMAGE</small><br><strong style="color:#fff">'+esc(def.damage)+'</strong></div>'+
        '<div><small style="color:#8ca2ac">DAMAGE TYPE</small><br><strong style="color:#fff">'+esc(String(def.damageType ?? "—").toUpperCase())+'</strong></div>'+
        '<div><small style="color:#8ca2ac">REACH</small><br><strong style="color:#fff">'+esc(def.reach)+' ft</strong></div>'+
        '<div><small style="color:#8ca2ac">STR REQUIREMENT</small><br><strong style="color:#fff">'+esc(def.strengthRequirement ?? "—")+'</strong></div>'+
        '<div><small style="color:#8ca2ac">THROWN</small><br><strong style="color:#fff">'+esc(thrown)+'</strong></div>'+
      '</div>'+gorilla+special+
    '</section>';
  }

  function flagValues(def) {
    return {
      meleeCatalogKey:def.key,
      meleeCatalogVersion:VERSION,
      meleeRewriteVersion:REWRITE,
      meleeWeapon:true,
      meleeOneActionOneStrike:true,
      weaponClass:def.weaponClass,
      weaponKind:"melee",
      baseDamageFormula:def.damage,
      damageFormula:def.damage,
      strengthRequirement:def.strengthRequirement,
      meleeReachFt:def.reach,
      thrownRangeFt:def.thrownRange,
      thrownLongRangeFt:def.thrownLong,
      gorillaArmsSatisfiesStrength:true,
      specialRule:def.special,
      effectText:def.special?.text ?? null,
      noMk:true,
      needsReview:false
    };
  }

  function enforceDexAttackUpdates(item,update) {
    const activities = item?.system?.activities;
    let rows = [];

    if (Array.isArray(activities)) rows = activities;
    else if (Array.isArray(activities?.contents)) rows = activities.contents;
    else if (typeof activities?.values === "function") {
      try { rows = [...activities.values()]; } catch {}
    } else if (activities && typeof activities === "object") {
      rows = Object.values(activities);
    }

    for (const activity of rows) {
      const source = activity?._source ?? activity ?? {};
      if (String(source?.type ?? activity?.type ?? "").toLowerCase() !== "attack") continue;

      const id = String(activity?.id ?? activity?._id ?? "");
      if (!id) continue;

      const ability = String(
        source?.attack?.ability ??
        activity?.attack?.ability ??
        ""
      ).trim().toLowerCase();

      if (ability !== "dex") {
        update["system.activities."+id+".attack.ability"] = "dex";
      }
    }
  }

  async function migrateItem(item) {
    if (!item || item.type !== "weapon") return false;
    const def = definition(item);
    if (!def) return false;

    const owned = Boolean(item.parent?.documentName === "Actor");
    if (!owned && !isMeleeSource(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};
    enforceDexAttackUpdates(item,update);

    for (const stale of ["mk","rating","tier","ratingLabel","marketTier"]) {
      if (Object.prototype.hasOwnProperty.call(flags,stale)) {
        update["flags."+FLAG+".-="+stale] = null;
      }
    }

    for (const [key,value] of Object.entries(flagValues(def))) {
      if (!same(flags[key],value)) update["flags."+FLAG+"."+key] = value;
    }

    const desc = String(item.system?.description?.value ?? "");
    if (
      String(flags.meleeRewriteVersion ?? "") !== REWRITE ||
      !desc.includes('data-feha-melee-card="'+REWRITE+'"')
    ) {
      update["system.description.value"] = rewriteDescription(def);
    }

    const damageBase = item.system?.damage?.base ?? {};
    if (
      String(damageBase?.custom?.formula ?? "") !== String(def.damage) ||
      damageBase?.custom?.enabled !== true
    ) {
      update["system.damage.base.number"] = 0;
      update["system.damage.base.denomination"] = 0;
      update["system.damage.base.bonus"] = "";
      update["system.damage.base.types"] = [def.damageType];
      update["system.damage.base.custom.enabled"] = true;
      update["system.damage.base.custom.formula"] = def.damage;
    }

    if (Number(item.system?.range?.reach ?? 0) !== Number(def.reach)) {
      update["system.range.reach"] = Number(def.reach);
    }

    if (def.thrownRange != null) {
      if (Number(item.system?.range?.value ?? 0) !== Number(def.thrownRange)) {
        update["system.range.value"] = Number(def.thrownRange);
      }
      if (Number(item.system?.range?.long ?? 0) !== Number(def.thrownLong)) {
        update["system.range.long"] = Number(def.thrownLong);
      }
    } else {
      if (Number(item.system?.range?.value ?? 0) !== 5) update["system.range.value"] = 5;
      if (item.system?.range?.long != null) update["system.range.long"] = null;
    }

    if (String(item.system?.range?.units ?? "") !== "ft") {
      update["system.range.units"] = "ft";
    }

    const desiredType = ["Baseball Bat","Chef's Knife","Crowbar","Dildo Stout","Hammer","Iron Pipe","Tire Iron"].includes(def.name)
      ? "simpleM"
      : "martialM";

    if (String(item.system?.type?.value ?? "") !== desiredType) {
      update["system.type.value"] = desiredType;
    }

    if (String(item.system?.identifier ?? "") !== slug(def.name)) {
      update["system.identifier"] = slug(def.name);
    }

    if (!Object.keys(update).length) return false;
    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {skipped:true,world:0,owned:0,canonicalCount:DEFINITIONS.length};
    }

    const sources = list(game.items).filter(item =>
      item?.type === "weapon" && isMeleeSource(item)
    );

    const missing = DEFINITIONS
      .filter(def => !sources.some(item => definition(item)?.key === def.key))
      .map(def => def.name);

    let world = 0;
    let owned = 0;

    for (const item of sources) {
      try {
        if (await migrateItem(item)) world++;
      } catch (error) {
        console.warn("FEHA MELEE // world migration failed",item?.name,error);
      }
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (!definition(item)) continue;
        try {
          if (await migrateItem(item)) owned++;
        } catch (error) {
          console.warn("FEHA MELEE // owned migration failed",actor?.name,item?.name,error);
        }
      }
    }

    const result = {
      skipped:false,
      world,
      owned,
      canonicalCount:DEFINITIONS.length,
      missing
    };

    console.log("FEHA MELEE CATALOG",VERSION,"canonicalized",result);
    if (missing.length) {
      ui.notifications?.warn?.(
        "FEHA Melee: "+missing.length+" expected weapon(s) missing from the MELEE folder. Check console."
      );
    }
    return result;
  }

  const api = {
    version:VERSION,
    rewriteVersion:REWRITE,
    list:() => DEFINITIONS.map(def => ({...def,special:def.special?{...def.special}:null})),
    definition,
    rewriteDescription,
    migrateItem,
    migrateAll,
    destroy() {
      if (globalThis.FEHA_MELEE_CATALOG === api) delete globalThis.FEHA_MELEE_CATALOG;
      if (game?.adk?.melee === api) delete game.adk.melee;
    }
  };

  game.adk ??= {};
  game.adk.melee = api;
  globalThis.FEHA_MELEE_CATALOG = api;
  console.log("FEHA MELEE CATALOG",VERSION,"ready //",DEFINITIONS.length,"balanced melee weapons");
})();