// FEHA // GRENADE CATALOG
// Canonical physical grenade definitions + idempotent Foundry item migration.
// This owns grenade identity/data only. Runtime automation can consume grenadeSchema later.

(() => {
  try { globalThis.FEHA_GRENADE_CATALOG?.destroy?.(); } catch {}

  const VERSION = "1.0.0";
  const REWRITE = "1.0";
  const FLAG = "fleshEnshrouded";

  const definitions = [
    {
      key:"frag-homing",
      name:"Frag Grenade Homing",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Creatures in the blast make a Dexterity save, taking 4d6 piercing damage on a failure or half on a success. The primary target cannot benefit from half or three-quarters cover against this save.",
      schema:{save:"dex",damage:"4d6",damageType:"piercing",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryIgnoresCover:true}
    },
    {
      key:"frag-sticky",
      name:"Frag Grenade Sticky",
      mk:1,
      price:60,
      availability:"Common",
      delivery:"sticky",
      effectText:"Throw at a point, surface, or creature within 60 ft. A creature targeted directly makes a Dexterity save; on a failure the grenade sticks to it and moves with it until it detonates at the end of the current turn. The blast has a 10-ft radius and deals 2d6 piercing damage, half on a successful Dexterity save. A creature the grenade is stuck to has disadvantage on the blast save.",
      schema:{save:"dex",damage:"2d6",damageType:"piercing",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckTargetDisadvantage:true,delayedToEndOfTurn:true}
    },
    {
      key:"biohazard-homing",
      name:"Grenade Biohazard Homing",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and bursts in a 10-ft radius. Creatures in the cloud make a Constitution save, taking 3d6 poison damage on a failure or half on a success. A creature that fails is also Poisoned until the end of its next turn. The primary target cannot benefit from half or three-quarters cover against this save.",
      schema:{save:"con",damage:"3d6",damageType:"poison",radiusFt:10,rangeFt:60,halfOnSuccess:true,condition:"poisoned",durationTurns:1,primaryIgnoresCover:true}
    },
    {
      key:"biohazard-regular",
      name:"Grenade Biohazard Regular",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. A toxic cloud fills a 15-ft radius. Creatures in the area make a Constitution save, taking 3d6 poison damage on a failure or half on a success; a failed save also Poisons the creature until the end of its next turn. The contaminated cloud remains until the start of your next turn, and a creature entering it for the first time must make the save.",
      schema:{save:"con",damage:"3d6",damageType:"poison",radiusFt:15,rangeFt:60,halfOnSuccess:true,condition:"poisoned",durationTurns:1,persistentUntilStartNextTurn:true}
    },
    {
      key:"cutting-regular",
      name:"Grenade Cutting Regular",
      mk:2,
      price:120,
      availability:"Professional",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. Monofilament fragments fill a 10-ft radius. Creatures in the blast make a Dexterity save, taking 3d6 slashing damage on a failure or half on a success. A creature that fails also Bleeds for 1d6 slashing damage at the start of its next turn; receiving healing or using an action to staunch the wound ends the bleed.",
      schema:{save:"dex",damage:"3d6",damageType:"slashing",radiusFt:10,rangeFt:60,halfOnSuccess:true,bleedDamage:"1d6",bleedTurns:1}
    },
    {
      key:"emp-homing",
      name:"Grenade EMP Homing",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"homing",
      effectText:"Choose a creature or electronic device you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Targets make a Constitution save, taking 3d6 lightning damage on a failure or half on a success; cybernetic and electronic targets have disadvantage on the save. On a failed save, the primary cybernetic/electronic target also cannot take reactions and one active non-weapon cyberware system is disabled until the end of its next turn.",
      schema:{save:"con",damage:"3d6",damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,electronicsDisadvantage:true,removeReactionsOnFail:true,disableCyberwareOnPrimaryFail:true,durationTurns:1}
    },
    {
      key:"emp-regular",
      name:"Grenade EMP Regular",
      mk:1,
      price:60,
      availability:"Common",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. Targets in a 10-ft radius make a Constitution save, taking 2d6 lightning damage on a failure or half on a success. Cybernetic and electronic targets have disadvantage on the save.",
      schema:{save:"con",damage:"2d6",damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,electronicsDisadvantage:true}
    },
    {
      key:"emp-sticky",
      name:"Grenade EMP Sticky",
      mk:1,
      price:60,
      availability:"Common",
      delivery:"sticky",
      effectText:"Throw at a point, surface, creature, or device within 60 ft. A creature targeted directly makes a Dexterity save; on a failure the grenade sticks to it until detonation at the end of the current turn. The 10-ft EMP burst deals 2d6 lightning damage, half on a successful Constitution save; cybernetic and electronic targets have disadvantage on that save. If stuck directly to a cybernetic/electronic target, a failed blast save also removes its reactions until the start of its next turn.",
      schema:{attachSave:"dex",save:"con",damage:"2d6",damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,electronicsDisadvantage:true,removeReactionsIfStuck:true,delayedToEndOfTurn:true}
    },
    {
      key:"flash-regular",
      name:"Grenade Flash Regular",
      mk:2,
      price:120,
      availability:"Professional",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 20-ft radius make a Constitution save. On a failure, a creature is Blinded until the end of its next turn. Creatures that do not rely on sight are unaffected.",
      schema:{save:"con",radiusFt:20,rangeFt:60,condition:"blinded",durationTurns:1,sightDependent:true,noDamage:true}
    },
    {
      key:"flashbang-homing",
      name:"Grenade Flashbang Homing",
      mk:1,
      price:60,
      availability:"Common",
      delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The flashbang homes to it and bursts in a 15-ft radius. Creatures in the area make a Constitution save or are Blinded until the end of their next turn. The primary target has disadvantage on this save. Creatures that do not rely on sight are unaffected.",
      schema:{save:"con",radiusFt:15,rangeFt:60,condition:"blinded",durationTurns:1,sightDependent:true,primaryDisadvantage:true,noDamage:true}
    },
    {
      key:"frag-regular",
      name:"Grenade Frag Regular",
      mk:4,
      price:800,
      availability:"Black Market",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 5d6 piercing damage on a failure or half on a success.",
      schema:{save:"dex",damage:"5d6",damageType:"piercing",radiusFt:15,rangeFt:60,halfOnSuccess:true}
    },
    {
      key:"incendiary-homing",
      name:"Grenade Incendiary Homing",
      mk:2,
      price:120,
      availability:"Professional",
      delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Creatures in the blast make a Dexterity save, taking 3d6 fire damage on a failure or half on a success. A creature that fails ignites and takes 1d6 fire damage at the end of its next turn unless it or an adjacent creature uses an action to extinguish the flames. The primary target cannot benefit from half or three-quarters cover against the initial save.",
      schema:{save:"dex",damage:"3d6",damageType:"fire",radiusFt:10,rangeFt:60,halfOnSuccess:true,burnDamage:"1d6",burnTurns:1,primaryIgnoresCover:true}
    },
    {
      key:"incendiary-regular",
      name:"Grenade Incendiary Regular",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 4d6 fire damage on a failure or half on a success. The blast area burns until the start of your next turn; a creature that enters the burning area for the first time or ends its turn there takes 1d6 fire damage.",
      schema:{save:"dex",damage:"4d6",damageType:"fire",radiusFt:15,rangeFt:60,halfOnSuccess:true,burningZoneDamage:"1d6",persistentUntilStartNextTurn:true}
    },
    {
      key:"incendiary-sticky",
      name:"Grenade Incendiary Sticky",
      mk:2,
      price:120,
      availability:"Professional",
      delivery:"sticky",
      effectText:"Throw at a point, surface, or creature within 60 ft. A creature targeted directly makes a Dexterity save; on a failure the grenade sticks and detonates at the end of the current turn. The 10-ft blast deals 3d6 fire damage, half on a successful Dexterity save. A creature the grenade is stuck to that fails the blast save also takes 1d6 fire damage at the end of its next turn unless the flames are extinguished with an action.",
      schema:{attachSave:"dex",save:"dex",damage:"3d6",damageType:"fire",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,burnDamage:"1d6",burnTurns:1,delayedToEndOfTurn:true}
    },
    {
      key:"ozobs-nose",
      name:"Grenade Ozobs Nose",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 5d6 explosive damage on a failure or half on a success. A creature that fails the save is also knocked Prone.",
      schema:{save:"dex",damage:"5d6",damageType:"explosive",radiusFt:15,rangeFt:60,halfOnSuccess:true,conditionOnFail:"prone"}
    },
    {
      key:"recon-regular",
      name:"Grenade Recon Regular",
      mk:2,
      price:120,
      availability:"Professional",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. The grenade scans a 25-ft radius until the end of the next round. You know the location of creatures, active cyberware, and networked devices inside the scan. A creature revealed by the scan cannot become hidden from you while it remains in the area; invisibility still grants its normal combat benefits, but its location is known.",
      schema:{radiusFt:25,rangeFt:60,durationRounds:1,revealCreatures:true,revealCyberware:true,revealNetworkDevices:true,preventHiddenForOperator:true,noDamage:true}
    },
    {
      key:"recon-sticky",
      name:"Grenade Recon Sticky",
      mk:4,
      price:800,
      availability:"Black Market",
      delivery:"sticky",
      effectText:"Throw at a point, surface, or creature within 60 ft. The sensor sticks where it lands and scans a 30-ft radius for 1 minute. You know the location of creatures, active cyberware, and networked devices inside the scan, including positions behind ordinary visual concealment. A creature carrying the stuck sensor moves the scan zone with it. Revealed creatures cannot become hidden from you while inside the zone.",
      schema:{radiusFt:30,rangeFt:60,durationRounds:10,sticky:true,revealCreatures:true,revealCyberware:true,revealNetworkDevices:true,mobileZoneIfAttached:true,preventHiddenForOperator:true,noDamage:true}
    },
    {
      key:"smoke-regular",
      name:"Grenade Smoke Regular",
      mk:3,
      price:300,
      availability:"Restricted",
      delivery:"regular",
      effectText:"Throw to a point within 60 ft. A 25-ft-radius cloud of dense smoke appears and is heavily obscured until the end of the next round. A strong wind or comparable ventilation can disperse it early.",
      schema:{radiusFt:25,rangeFt:60,durationRounds:1,heavilyObscured:true,dispersible:true,noDamage:true}
    }
  ];

  const quality = {
    1:"Civilian",
    2:"Professional",
    3:"High-Grade",
    4:"Elite",
    5:"Prototype"
  };

  const normalize = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const byName = new Map(
    definitions.map(def => [normalize(def.name),def])
  );

  function definition(value) {
    if (typeof value === "string") {
      return byName.get(normalize(value)) ?? null;
    }

    const flags = value?.flags?.[FLAG] ?? {};
    const sourcePath = String(flags.sourcePath ?? "");
    let sourceFile = "";

    try {
      sourceFile = decodeURIComponent(
        sourcePath.split("/").pop() ?? ""
      ).replace(/\.[^.]+$/,"");
    } catch {
      sourceFile = (sourcePath.split("/").pop() ?? "")
        .replace(/\.[^.]+$/,"");
    }

    const candidates = [
      value?.name,
      flags.originalLibraryName,
      flags.originalName,
      value?.system?.identifier,
      sourceFile
    ];

    for (const candidate of candidates) {
      const found = byName.get(normalize(candidate));
      if (found) return found;
    }

    const compact = candidates
      .map(candidate => normalize(candidate).replace(/\s+/g,""))
      .filter(Boolean);

    for (const [name,def] of byName) {
      const key = name.replace(/\s+/g,"");
      if (
        compact.some(candidate =>
          candidate === key ||
          candidate.includes(key) ||
          key.includes(candidate)
        )
      ) {
        return def;
      }
    }

    return null;
  }

  function looksLikeGrenade(item) {
    if (!item) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const category = String(
      flags.sourceCategory ??
      flags.category ??
      ""
    ).trim().toLowerCase();

    return Boolean(
      definition(item) &&
      (
        category === "grenades" ||
        /\/grenades\//i.test(String(flags.sourcePath ?? "")) ||
        /\/04\s*—?\s*grenades\//i.test(String(item.folder?.path ?? ""))
      )
    );
  }

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  function rewriteDescription(def,item) {
    const flags = item?.flags?.[FLAG] ?? {};
    const manufacturer = String(
      flags.manufacturer ??
      flags.company ??
      "ForgeLine Industries"
    ).trim() || "ForgeLine Industries";

    const mkLabel = "Mk." + ["0","I","II","III","IV","V"][def.mk];
    const delivery = String(def.delivery ?? "regular").toUpperCase();

    return (
      '<section data-feha-grenade-card="'+REWRITE+'" '+
      'style="border:1px solid #33424a;background:#081015;padding:12px 14px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;'+
        'padding-bottom:9px;border-bottom:1px solid #263941">'+
          '<small style="color:#f0c85a;font-size:10px;font-weight:900;letter-spacing:.12em">'+
            esc(manufacturer.toUpperCase())+' // GRENADE'+
          '</small>'+
          '<strong style="color:#eefaff;font-size:12px">'+
            esc(mkLabel)+
          '</strong>'+
        '</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 12px;align-items:center">'+
          '<span style="font-size:12px"><strong>'+esc(delivery)+'</strong></span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px">'+esc(def.availability)+'</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#f2d76f;font-weight:900">€$'+
            Number(def.price).toLocaleString()+
          '</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px">1 USE</span>'+
        '</div>'+
        '<div>'+
          '<small style="display:block;color:#8ca2ac;font-size:10px;font-weight:900;'+
          'letter-spacing:.11em;margin-bottom:5px">EFFECT</small>'+
          '<p style="margin:0;line-height:1.48">'+esc(def.effectText)+'</p>'+
        '</div>'+
      '</section>'
    );
  }

  async function migrateItem(item) {
    const def = definition(item);
    if (!item || !def || !looksLikeGrenade(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};
    const mkLabel = "Mk." + ["0","I","II","III","IV","V"][def.mk];

    if (item.name !== def.name) update.name = def.name;
    if (flags.effectText !== def.effectText) {
      update[`flags.${FLAG}.effectText`] = def.effectText;
    }
    if (Number(flags.mk) !== def.mk) {
      update[`flags.${FLAG}.mk`] = def.mk;
    }
    if (Number(flags.rating) !== def.mk) {
      update[`flags.${FLAG}.rating`] = def.mk;
    }
    if (Number(flags.tier) !== def.mk) {
      update[`flags.${FLAG}.tier`] = def.mk;
    }
    if (flags.ratingLabel !== mkLabel) {
      update[`flags.${FLAG}.ratingLabel`] = mkLabel;
    }
    if (flags.sourceCategory !== "Grenades") {
      update[`flags.${FLAG}.sourceCategory`] = "Grenades";
    }
    if (Number(flags.priceCredits) !== def.price) {
      update[`flags.${FLAG}.priceCredits`] = def.price;
    }
    if (flags.availability !== def.availability) {
      update[`flags.${FLAG}.availability`] = def.availability;
    }
    if (flags.grenadeRewriteVersion !== REWRITE) {
      update[`flags.${FLAG}.grenadeRewriteVersion`] = REWRITE;
    }

    const nextSchema = {
      version:REWRITE,
      key:def.key,
      delivery:def.delivery,
      ...def.schema
    };

    let schemaChanged = true;
    try {
      schemaChanged =
        JSON.stringify(flags.grenadeSchema ?? null) !==
        JSON.stringify(nextSchema);
    } catch {}

    if (schemaChanged) {
      update[`flags.${FLAG}.grenadeSchema`] = nextSchema;
    }

    if (
      item.system?.price &&
      Number(item.system.price.value) !== def.price
    ) {
      update["system.price.value"] = def.price;
    }

    if (
      item.system?.uses &&
      String(item.system.uses.max ?? "") !== "1"
    ) {
      update["system.uses.max"] = "1";
      update["system.uses.spent"] = 0;
    }

    const description = rewriteDescription(def,item);

    if (
      description !==
      String(item.system?.description?.value ?? "")
    ) {
      update["system.description.value"] = description;
    }

    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {world:0,owned:0,skipped:true};
    }

    let world = 0;
    let owned = 0;

    for (const item of game.items?.contents ?? []) {
      try {
        if (await migrateItem(item)) world++;
      } catch (err) {
        console.warn(
          "FEHA GRENADES // world migration failed",
          item?.name,
          err
        );
      }
    }

    for (const actor of game.actors?.contents ?? []) {
      for (const item of actor.items ?? []) {
        try {
          if (await migrateItem(item)) owned++;
        } catch (err) {
          console.warn(
            "FEHA GRENADES // owned migration failed",
            actor?.name,
            item?.name,
            err
          );
        }
      }
    }

    console.info(
      "FEHA GRENADES // rewrite "+REWRITE+" ready",
      {world,owned}
    );

    return {world,owned,skipped:false};
  }

  const api = {
    version:VERSION,
    rewriteVersion:REWRITE,
    definitions:Object.freeze(
      Object.fromEntries(
        definitions.map(def => [
          def.key,
          Object.freeze({
            ...def,
            schema:Object.freeze({...def.schema})
          })
        ])
      )
    ),
    list:() => definitions.map(def => ({
      ...def,
      schema:{...def.schema}
    })),
    definition,
    effectText:value => definition(value)?.effectText ?? null,
    schema:value => {
      const def = definition(value);
      return def
        ? {
            version:REWRITE,
            key:def.key,
            delivery:def.delivery,
            ...def.schema
          }
        : null;
    },
    migrateItem,
    migrateAll,
    destroy() {
      if (game?.adk?.grenades === api) {
        delete game.adk.grenades;
      }
      if (globalThis.FEHA_GRENADE_CATALOG === api) {
        delete globalThis.FEHA_GRENADE_CATALOG;
      }
    }
  };

  game.adk ??= {};
  game.adk.grenades = api;
  globalThis.FEHA_GRENADE_CATALOG = api;

  console.log(
    "FEHA GRENADE CATALOG",
    VERSION,
    "ready"
  );
})();
