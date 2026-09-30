// FEHA // MELEE CATALOG
// Balanced around one Action = one strike. Sandevistan multiplies Actions;
// Gorilla Arms satisfy melee STR requirements. Most weapons intentionally have
// no bespoke effect: their statline is their identity.
(() => {
  try { globalThis.FEHA_MELEE_CATALOG?.destroy?.(); } catch {}

  const VERSION = "1.0.0";
  const REWRITE = "melee-1.0-a";
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
      text:"Errata remembers heat during your turn. First hit: normal. Second consecutive hit against the same target: +2d8 fire. Third and later consecutive hits against that target: +4d8 fire and treat worn armor's weapon-damage reduction as 0 for the hit. Runaway resets at the end of your turn or when you attack a different target.",
      automation:"manual",
      stages:[
        {hit:1,bonus:null},
        {hit:2,bonus:"2d8 fire"},
        {hit:3,bonus:"4d8 fire",ignoresWornArmorReduction:true}
      ],
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
    ["Baseball Bat","Blunt","3d6","bludgeoning",10,5,null,null],
    ["Baton Beta","Baton","2d8","bludgeoning",null,5,null,null],
    ["Baton Murphy","Baton","3d8","bludgeoning",10,5,null,null],
    ["Baton Tinker Bell","Baton","2d8","bludgeoning",null,5,null,null],
    ["Butcher's Knife","Knife","3d6","slashing",null,5,null,null],
    ["Cane Fingers","Knife","2d6","piercing",null,5,null,null],
    ["Chainsword Legendary","Heavy Blade","5d10","slashing",14,5,null,null],
    ["Chef's Knife","Knife","2d6","slashing",null,5,null,null],
    ["Crowbar","Blunt","2d8","bludgeoning",10,5,null,null],
    ["Dildo Stout","Blunt","1d100","bludgeoning",null,5,null,null],
    ["Errata","Katana","4d8","slashing",11,5,null,null],
    ["Fanged Axe Military","Axe","4d10","slashing",13,5,null,null],
    ["Hammer","Blunt","3d10","bludgeoning",12,5,null,null],
    ["Iron Pipe","Blunt","2d8","bludgeoning",10,5,null,null],
    ["Kanabo","Heavy Blunt","4d12","bludgeoning",15,5,null,null],
    ["Katana","Katana","4d8","slashing",10,5,null,null],
    ["Katana Go G","Katana","4d8","slashing",10,5,null,null],
    ["Katana Takemura","Katana","4d8+6","slashing",11,5,null,null],
    ["Knife Kurtz","Knife","3d6","piercing",null,5,null,null],
    ["Knife Military","Knife","3d6","piercing",null,5,null,null],
    ["Knife Stinger","Knife","3d6","piercing",null,5,null,null],
    ["Kukri","Knife","3d8","slashing",10,5,null,null],
    ["Kukri Voodoo","Knife","3d8","slashing",10,5,null,null],
    ["Machete","Machete","3d8","slashing",10,5,null,null],
    ["Machete Maelstrom","Machete","4d8","slashing",12,5,null,null],
    ["Machete Valentinos","Machete","3d8+4","slashing",10,5,null,null],
    ["Neurotoxin Knife","Knife","2d6","piercing",null,5,null,null],
    ["Punk Knife Pimp","Knife","3d6","piercing",null,5,null,null],
    ["Sword Witcher","Sword","4d10","slashing",12,5,null,null],
    ["Tanto","Knife","3d6","piercing",null,5,null,null],
    ["Tire Iron","Blunt","2d8","bludgeoning",10,5,null,null],
    ["Tomahawk","Axe","3d8","slashing",10,5,20,60],
    ["VB Axe","Heavy Axe","5d10","slashing",14,5,null,null]
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
      ? '<div style="margin-top:12px;padding:11px;border:1px solid #8f2f22;background:#190b08">'+
          '<small style="display:block;color:#ff6b51;font-size:10px;font-weight:900;letter-spacing:.13em;margin-bottom:6px">ICONIC EFFECT // '+esc(def.special.name)+'</small>'+
          '<p style="margin:0;line-height:1.52;color:#ffe1d8 !important">'+esc(def.special.text)+'</p>'+
        '</div>'
      : "";

    const thrown = def.thrownRange != null
      ? String(def.thrownRange)+"/"+String(def.thrownLong)+" ft"
      : "—";

    const gorilla = def.strengthRequirement != null
      ? '<div style="margin-top:10px;padding:9px 10px;border-left:3px solid #d3a83c;background:#12120c;color:#d9d5bf !important;font-size:11px"><strong style="color:#f3d36c">GORILLA ARMS:</strong> satisfies this weapon\'s STR requirement.</div>'
      : "";

    return '<section data-feha-melee-card="'+REWRITE+'" style="border:1px solid #57332c;background:#0b0d0f;padding:13px 14px;color:#e7ecee !important">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #3a2926">'+
        '<small style="color:#ff7a61;font-size:10px;font-weight:900;letter-spacing:.12em">FEHA // MELEE</small>'+
        '<strong style="color:#f6e9e5;font-size:12px">ONE ACTION // ONE STRIKE</strong>'+
      '</div>'+
      '<h2 style="margin:10px 0 4px;color:#fff">'+esc(def.name)+'</h2>'+
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #262d30;border-bottom:1px solid #262d30">'+
        '<div><small>CLASS</small><br><strong>'+esc(def.weaponClass)+'</strong></div>'+
        '<div><small>DAMAGE</small><br><strong>'+esc(def.damage)+'</strong></div>'+
        '<div><small>REACH</small><br><strong>'+esc(def.reach)+' ft</strong></div>'+
        '<div><small>STR REQUIREMENT</small><br><strong>'+esc(def.strengthRequirement ?? "—")+'</strong></div>'+
        '<div><small>THROWN</small><br><strong>'+esc(thrown)+'</strong></div>'+
        '<div><small>CUSTOM EFFECT</small><br><strong style="color:'+(def.special?"#ff7a61":"#9aa6aa")+'">'+(def.special?"YES":"—")+'</strong></div>'+
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

  async function migrateItem(item) {
    if (!item || item.type !== "weapon") return false;
    const def = definition(item);
    if (!def) return false;

    const owned = Boolean(item.parent?.documentName === "Actor");
    if (!owned && !isMeleeSource(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};

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