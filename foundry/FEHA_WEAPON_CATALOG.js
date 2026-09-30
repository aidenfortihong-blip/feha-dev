// FEHA // FINISHED WEAPON CATALOG
// The description-card stats for the 16 approved DONE weapons are canonical.
// World and actor-owned copies are migrated so sheet data matches the card.

(() => {
  try { globalThis.FEHA_WEAPON_CATALOG?.destroy?.(); } catch {}

  const VERSION = "1.3.0";
  const REWRITE = "1.3";
  const FLAG = "fleshEnshrouded";

  const definitions = [
    {
      key:"breachhound",
      name:"Breachhound",
      marketBand:2,
      company:"Bastion Strategic",
      weaponClass:"Shotgun",
      damage:"14d2",
      range:10,
      longRange:20,
      reloadActions:3,
      magazineSize:7,
      strengthRequirement:"12",
      multiattack:1,
      price:1500,
      availability:"Professional",
      technology:"Power",
      identity:"Bastion breach shotgun built around brutal close-range output without going fully ForgeLine-heavy."
    },
    {
      key:"crusher",
      name:"Crusher",
      marketBand:3,
      company:"Bastion Strategic",
      weaponClass:"Shotgun",
      damage:"20d2",
      range:15,
      longRange:30,
      reloadActions:2,
      magazineSize:5,
      strengthRequirement:null,
      price:3400,
      availability:"Restricted",
      technology:"Power",
      identity:"Compact Bastion combat shotgun: high-caliber stopping power in a tactical package."
    },
    {
      key:"hexburst",
      name:"Hexburst",
      marketBand:3,
      company:"Bastion Strategic",
      weaponClass:"Assault Rifle",
      damage:"6d8",
      range:60,
      longRange:null,
      reloadActions:2,
      magazineSize:5,
      strengthRequirement:"11",
      price:3000,
      availability:"Restricted",
      technology:"Power",
      identity:"Burst-pattern Bastion rifle that trades magazine depth for a harder-hitting assault profile."
    },
    {
      key:"igla",
      name:"Igla",
      marketBand:2,
      company:"Bastion Strategic",
      weaponClass:"Shotgun",
      damage:"12d2",
      range:20,
      longRange:null,
      reloadActions:2,
      magazineSize:2,
      strengthRequirement:"11",
      multiattack:1,
      price:1100,
      availability:"Professional",
      technology:"Power",
      identity:"Compact tactical shotgun with a tiny magazine and fast, violent close-range handling."
    },
    {
      key:"lexington",
      name:"Lexington",
      marketBand:1,
      company:"Bastion Strategic",
      weaponClass:"Pistol",
      damage:"4d6",
      range:30,
      longRange:null,
      reloadActions:1,
      magazineSize:4,
      strengthRequirement:null,
      price:450,
      availability:"Common",
      technology:"Power",
      identity:"Bastion service pistol tuned above ordinary sidearm output while staying practical and mobile."
    },
    {
      key:"liberty",
      name:"Liberty",
      marketBand:1,
      company:"Bastion Strategic",
      weaponClass:"Heavy Pistol",
      damage:"1d30",
      range:40,
      longRange:null,
      reloadActions:1,
      magazineSize:5,
      strengthRequirement:null,
      price:650,
      availability:"Common",
      technology:"Power",
      identity:"Heavy-caliber Bastion sidearm with an intentionally swingy single-die damage profile."
    },
    {
      key:"overture",
      name:"Overture",
      marketBand:2,
      company:"Bastion Strategic",
      weaponClass:"Heavy Pistol",
      damage:"2d20",
      range:40,
      longRange:180,
      reloadActions:2,
      magazineSize:3,
      strengthRequirement:null,
      price:1800,
      availability:"Professional",
      technology:"Power",
      identity:"Long-reaching heavy pistol with only three shots and a deliberately slow reload."
    },
    {
      key:"saratoga",
      name:"Saratoga",
      marketBand:3,
      company:"Bastion Strategic",
      weaponClass:"SMG",
      damage:"8d6",
      range:30,
      longRange:null,
      reloadActions:1,
      magazineSize:5,
      strengthRequirement:null,
      price:3800,
      availability:"Restricted",
      technology:"Power",
      identity:"Aggressive Bastion SMG built for high close-range output and fast tactical handling."
    },
    {
      key:"tactician",
      name:"Tactician",
      marketBand:4,
      company:"Bastion Strategic",
      weaponClass:"Shotgun",
      damage:"30d2",
      range:15,
      longRange:null,
      reloadActions:5,
      magazineSize:5,
      strengthRequirement:"12",
      price:7200,
      availability:"Elite",
      technology:"Power",
      identity:"A huge tactical shotgun that hits extremely hard but pays for it with bulk and a punishing reload."
    },
    {
      key:"umbra",
      name:"Umbra",
      marketBand:1,
      company:"Bastion Strategic",
      weaponClass:"Assault Rifle",
      damage:"3d8",
      range:90,
      longRange:null,
      reloadActions:1,
      magazineSize:10,
      strengthRequirement:null,
      price:800,
      availability:"Common",
      technology:"Power",
      identity:"Balanced Bastion assault rifle: practical range, useful magazine depth, and no exotic subsystem."
    },
    {
      key:"unity",
      name:"Unity",
      marketBand:2,
      company:"Bastion Strategic",
      weaponClass:"Pistol",
      damage:"5d6",
      range:30,
      longRange:null,
      reloadActions:1,
      magazineSize:3,
      strengthRequirement:null,
      price:1700,
      availability:"Professional",
      technology:"Power",
      identity:"High-grade Bastion pistol packing unusually large damage into a very small magazine."
    },
    {
      key:"warwake",
      name:"Warwake",
      marketBand:4,
      company:"Bastion Strategic",
      weaponClass:"LMG",
      damage:"8d10",
      range:50,
      longRange:null,
      reloadActions:8,
      magazineSize:8,
      strengthRequirement:"16",
      price:8200,
      availability:"Elite",
      technology:"Power",
      identity:"Bastion's heaviest approved gun: enormous sustained-fire output without crossing into ForgeLine immobility."
    },
    {
      key:"ashura",
      name:"Ashura",
      marketBand:2,
      company:"Corvus Neural",
      weaponClass:"Sniper Rifle",
      damage:"3d12",
      range:200,
      longRange:null,
      reloadActions:1,
      magazineSize:1,
      strengthRequirement:"11",
      price:2600,
      availability:"Professional",
      technology:"Smart",
      identity:"Corvus single-shot smart sniper built around an integrated neural optic.",
      special:{
        key:"darkvision-optic",
        name:"NEURAL OPTIC",
        text:"While wielded, the integrated optic provides Darkvision 60 ft.",
        darkvisionFt:60,
        automation:"manual"
      }
    },
    {
      key:"dian",
      name:"Dian",
      marketBand:3,
      company:"Corvus Neural",
      weaponClass:"SMG",
      damage:"5d6",
      range:40,
      longRange:80,
      reloadActions:1,
      magazineSize:6,
      strengthRequirement:null,
      price:4500,
      availability:"Restricted",
      technology:"Smart",
      identity:"Quirky Corvus smart SMG built to turn its own shots into network access.",
      special:{
        key:"camera-dart",
        name:"CAMERA DART",
        text:"The integrated camera can be fired and deployed as an attached camera token. Its feed can be viewed and used as an IoT origin for Quickhacks.",
        automation:"manual"
      }
    },
    {
      key:"kyokokukamusari",
      name:"Kyokokukamusari",
      marketBand:4,
      company:"Corvus Neural",
      weaponClass:"Assault Rifle",
      damage:"4d8",
      range:60,
      longRange:180,
      reloadActions:1,
      magazineSize:4,
      strengthRequirement:"11/12",
      price:6800,
      availability:"Elite",
      technology:"Smart",
      identity:"Eccentric Corvus rifle whose reload system doubles as a flashbang delivery mechanism.",
      special:{
        key:"flashbang-magazine",
        name:"FLASHBANG MAGAZINE",
        text:"On reload, the integrated flashbang magazine can trigger. Resolve the blast using the campaign's Flashbang Grenade rules.",
        automation:"manual"
      }
    },
    {
      key:"masamune",
      name:"Masamune",
      marketBand:5,
      company:"Corvus Neural",
      weaponClass:"Assault Rifle",
      damage:"5d8",
      range:60,
      longRange:180,
      reloadActions:2,
      magazineSize:6,
      strengthRequirement:"11/12",
      price:14000,
      availability:"Prototype",
      technology:"Smart",
      identity:"Expensive Corvus prototype rifle built as both a firearm and a neural intrusion relay.",
      special:{
        key:"neural-relay",
        name:"NEURAL RELAY",
        text:"2 charges per Long Rest. Expend 1 charge to route a Quickhack through the weapon's targeting link.",
        charges:2,
        recovery:"long",
        automation:"manual"
      }
    }
  ];

  const normalize = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const slug = value => normalize(value).replace(/\s+/g,"-");

  const byName = new Map(
    definitions.map(def => [normalize(def.name),def])
  );

  const byKey = new Map(
    definitions.map(def => [normalize(def.key),def])
  );

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function definition(value) {
    if (!value) return null;

    if (typeof value === "string") {
      return byKey.get(normalize(value)) ??
        byName.get(normalize(value)) ??
        null;
    }

    const flags = value.flags?.[FLAG] ?? {};

    for (const candidate of [
      flags.weaponCatalogKey,
      value.name,
      flags.originalLibraryName
    ]) {
      const n = normalize(candidate);
      if (byKey.has(n)) return byKey.get(n);
      if (byName.has(n)) return byName.get(n);
    }

    return null;
  }

  function rangeText(def) {
    return def.longRange
      ? def.range+"/"+def.longRange+" ft"
      : def.range+" ft";
  }

  function strengthText(def) {
    return def.strengthRequirement ?? "—";
  }

  function specialText(def) {
    if (def.special?.text) return def.special.text;
    if (def.multiattack) {
      return "Multiattack: "+def.multiattack+".";
    }
    return def.identity;
  }

  function rewriteDescription(def) {
    const special = def.special?.text
      ? (
          '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #20363e">'+
            '<small style="display:block;color:#f0c85a;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:5px">'+
              esc(def.special.name)+
            '</small>'+
            '<p style="margin:0;line-height:1.5;color:#e7f2f5 !important">'+
              esc(def.special.text)+
            '</p>'+
          '</div>'
        )
      : "";

    const multiattack = def.multiattack
      ? (
          '<div><small style="color:#8ca2ac">MULTIATTACK</small><br>'+
          '<strong style="color:#fff">'+esc(def.multiattack)+'</strong></div>'
        )
      : (
          '<div><small style="color:#8ca2ac">TECH</small><br>'+
          '<strong style="color:#fff">'+esc(def.technology)+'</strong></div>'
        );

    return (
      '<section data-feha-weapon-card="'+REWRITE+'" '+
      'style="border:1px solid #2b5662;background:#071116;padding:13px 14px;color:#dce8ec !important">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #263941">'+
          '<small style="color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.12em">'+
            'FEHA // '+esc(def.company.toUpperCase())+' // WEAPON'+
          '</small>'+
          '<strong style="color:#eefaff;font-size:12px">'+esc(def.weaponClass.toUpperCase())+'</strong>'+
        '</div>'+
        '<h2 style="margin:10px 0 4px;color:#fff">'+esc(def.name)+'</h2>'+
        '<p style="margin:0 0 11px;line-height:1.45;color:#b9ccd3 !important">'+esc(def.identity)+'</p>'+
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #1f3239;border-bottom:1px solid #1f3239">'+
          '<div><small style="color:#8ca2ac">DAMAGE</small><br><strong style="color:#fff;font-size:17px">'+esc(def.damage)+'</strong></div>'+
          '<div><small style="color:#8ca2ac">RANGE</small><br><strong style="color:#fff">'+esc(rangeText(def))+'</strong></div>'+
          '<div><small style="color:#8ca2ac">MAGAZINE</small><br><strong style="color:#fff">'+esc(def.magazineSize)+'</strong></div>'+
          '<div><small style="color:#8ca2ac">RELOAD</small><br><strong style="color:#fff">'+esc(def.reloadActions)+' action'+(def.reloadActions===1?'':'s')+'</strong></div>'+
          '<div><small style="color:#8ca2ac">STR REQUIREMENT</small><br><strong style="color:#fff">'+esc(strengthText(def))+'</strong></div>'+
          multiattack+
        '</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;align-items:center">'+
          '<span style="font-size:12px;color:#f2d76f;font-weight:900">€$'+Number(def.price).toLocaleString()+'</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#aebfc6">'+esc(def.availability)+'</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#7ee6ff;font-weight:900">'+esc(def.technology.toUpperCase())+'</span>'+
        '</div>'+
        special+
      '</section>'
    );
  }

  function damagePatch(def) {
    return {
      "system.damage.base.number":0,
      "system.damage.base.denomination":0,
      "system.damage.base.bonus":"",
      "system.damage.base.types":["piercing"],
      "system.damage.base.custom.enabled":true,
      "system.damage.base.custom.formula":def.damage
    };
  }

  function diceParts(formula) {
    const match = String(formula ?? "").match(/^(\d+)d(\d+)$/i);
    return match
      ? {
          count:Number(match[1]),
          die:Number(match[2])
        }
      : {
          count:null,
          die:null
        };
  }

  function groupProfile(def) {
    if (def.company === "Bastion Strategic") {
      return {
        role:"Tactical Assault",
        weight:"medium-heavy",
        magazine:"medium",
        caliber:"medium to heavy",
        damage:"high",
        fireRate:"high",
        energy:false,
        special:"measured military firepower without ForgeLine immobility"
      };
    }

    return {
      role:"Neural Interface",
      weight:"light to medium",
      magazine:"small to medium",
      caliber:"small to medium",
      damage:"medium",
      fireRate:"medium",
      energy:false,
      special:"smart and neural-linked functions"
    };
  }

  function flagValues(def) {
    const dice = diceParts(def.damage);

    return {
      weaponCatalogKey:def.key,
      weaponCatalogVersion:VERSION,
      weaponRewriteVersion:REWRITE,
      manufacturer:def.company,
      company:def.company,
      weaponGroup:def.company,
      weaponClass:def.weaponClass,
      weaponKind:"firearm",
      weaponTechnology:def.technology,
      weaponSystem:def.technology,
      weaponDiceCount:dice.count,
      weaponDie:dice.die,
      groupProfile:groupProfile(def),
      baseDamageFormula:def.damage,
      damageFormula:def.damage,
      rangeFt:def.range,
      longRangeFt:def.longRange,
      reloadActions:def.reloadActions,
      magazineSize:def.magazineSize,
      strengthRequirement:def.strengthRequirement,
      multiattack:def.multiattack ?? null,
      specialRule:def.special ?? null,
      effectText:specialText(def),
      sourceCategory:"Weapons",
      shopType:"arms",
      curatedCatalogV10:true,
      catalogEnabled:true,
      marketReady:true,
      weaponReadiness:"done",
      marketPass:"weapon-catalog-1.0",
      marketCategory:"Weapons",
      marketPrice:def.price,
      priceCredits:def.price,
      marketBand:def.marketBand,
      availability:def.availability,
      bodyArmor:false,
      quickhack:false,
      needsReview:false,
      noMk:true
    };
  }

  async function migrateItem(item) {
    const def = definition(item);
    if (!item || item.type !== "weapon" || !def) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};
    const values = flagValues(def);

    for (const stale of [
      "mk",
      "rating",
      "tier",
      "ratingLabel",
      "marketTier"
    ]) {
      if (Object.prototype.hasOwnProperty.call(flags,stale)) {
        update["flags."+FLAG+".-="+stale] = null;
      }
    }

    if (String(item.name ?? "") !== def.name) {
      update.name = def.name;
    }

    for (const [key,value] of Object.entries(values)) {
      let same = false;
      try {
        same = JSON.stringify(flags[key] ?? null) === JSON.stringify(value);
      } catch {
        same = flags[key] === value;
      }
      if (!same) update["flags."+FLAG+"."+key] = value;
    }

    const description = rewriteDescription(def);
    if (String(item.system?.description?.value ?? "") !== description) {
      update["system.description.value"] = description;
    }

    const dPatch = damagePatch(def);
    for (const [key,value] of Object.entries(dPatch)) {
      const path = key.replace(/^system\./,"").split(".");
      let current = item.system;
      for (const segment of path) current = current?.[segment];
      let same = false;
      try { same = JSON.stringify(current ?? null) === JSON.stringify(value); }
      catch { same = current === value; }
      if (!same) update[key] = value;
    }

    if (Number(item.system?.range?.value ?? 0) !== Number(def.range)) {
      update["system.range.value"] = Number(def.range);
    }

    const currentLong = item.system?.range?.long ?? null;
    const targetLong = def.longRange ?? null;
    if (JSON.stringify(currentLong) !== JSON.stringify(targetLong)) {
      update["system.range.long"] = targetLong;
    }

    if (String(item.system?.range?.units ?? "") !== "ft") {
      update["system.range.units"] = "ft";
    }

    if (
      item.system?.price &&
      Number(item.system.price.value ?? 0) !== Number(def.price)
    ) {
      update["system.price.value"] = Number(def.price);
    }

    if (
      item.system?.price &&
      String(item.system.price.denomination ?? "") !== "gp"
    ) {
      update["system.price.denomination"] = "gp";
    }

    if (String(item.system?.identifier ?? "") !== slug(def.name)) {
      update["system.identifier"] = slug(def.name);
    }

    if (String(item.system?.type?.value ?? "") !== "martialR") {
      update["system.type.value"] = "martialR";
    }

    if (!Object.keys(update).length) return false;

    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {world:0,owned:0,canonicalCount:definitions.length,skipped:true};
    }

    let world = 0;
    let owned = 0;

    for (const item of list(game.items)) {
      try {
        if (await migrateItem(item)) world++;
      } catch (error) {
        console.warn(
          "FEHA WEAPON CATALOG // world migration failed",
          item?.name,
          error
        );
      }
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        try {
          if (await migrateItem(item)) owned++;
        } catch (error) {
          console.warn(
            "FEHA WEAPON CATALOG // owned migration failed",
            actor?.name,
            item?.name,
            error
          );
        }
      }
    }

    const result = {
      world,
      owned,
      canonicalCount:definitions.length,
      skipped:false
    };

    console.log(
      "FEHA WEAPON CATALOG",
      VERSION,
      "canonicalized",
      result
    );

    try {
      globalThis.ADKMarket?.refresh?.();
    } catch {}

    return result;
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
            special:def.special
              ? Object.freeze({...def.special})
              : null
          })
        ])
      )
    ),
    list:() => definitions.map(def => ({
      ...def,
      special:def.special ? {...def.special} : null
    })),
    definition,
    rewriteDescription,
    migrateItem,
    migrateAll,
    destroy() {
      if (globalThis.FEHA_WEAPON_CATALOG === api) {
        delete globalThis.FEHA_WEAPON_CATALOG;
      }
      if (game?.adk?.weapons === api) {
        delete game.adk.weapons;
      }
    }
  };

  game.adk ??= {};
  game.adk.weapons = api;
  globalThis.FEHA_WEAPON_CATALOG = api;

  console.log(
    "FEHA WEAPON CATALOG",
    VERSION,
    "ready //",
    definitions.length,
    "canonical DONE weapons"
  );
})();
