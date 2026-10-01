// FEHA // GRENADE CATALOG
// Canonical physical grenade definitions + idempotent Foundry item migration.
// This owns grenade identity/data only. Runtime automation can consume grenadeSchema later.

(() => {
  try { globalThis.FEHA_GRENADE_CATALOG?.destroy?.(); } catch {}

  const VERSION = "2.6.0";
  const REWRITE = "2.6-mk-lines";
  const FLAG = "fleshEnshrouded";
  const ROOT_NAME = "04 — GRENADES";
  const COMPANY_ORDER = [
    "Kurohane Group",
    "Bastion Strategic",
    "Vektor Dynamics",
    "Helix Vitae",
    "ForgeLine Industries",
    "Jade Arc Systems",
    "Corvus Neural"
  ];

  // Every grenade line (except the one-off Ozob's Nose) is sold in Mk.I-V.
  // Damage, tick damage and utility area/duration scale with Mk; price is
  // MK_PRICE x delivery multiplier (x0.4 for utility), rounded to 25 CR.
  // `base` + `legacyMk` are the line's original single-tier name and Mk:
  // items still carrying that name map to that Mk and are renamed on migration.
  const ROMAN = ["0","I","II","III","IV","V"];
  const MKS = [1,2,3,4,5];
  const MK_PRICE = {1:300,2:600,3:1000,4:1600,5:2500};
  const DELIVERY_MULT = {regular:1,sticky:1.3,homing:1.6};
  const MK_AVAILABILITY = {
    1:"Common",
    2:"Professional",
    3:"Restricted",
    4:"Black Market",
    5:"Black Market"
  };
  const MK_RARITY = {
    1:"common",
    2:"uncommon",
    3:"rare",
    4:"veryRare",
    5:"legendary"
  };
  const BLAST = {1:"6d6",2:"8d6",3:"10d6",4:"12d6",5:"14d6"};
  const EMP_BLAST = {1:"6d6",2:"7d6",3:"8d6",4:"10d6",5:"12d6"};
  const TICK = {1:"1d6",2:"2d6",3:"2d6",4:"3d6",5:"4d6"};
  const FLASH = {1:"2d6",2:"2d6",3:"3d6",4:"4d6",5:"5d6"};
  const STOCK_WEIGHT = 0.2;

  const price = (mk,delivery,utility=false) =>
    Math.round(
      MK_PRICE[mk] *
      (DELIVERY_MULT[delivery] ?? 1) *
      (utility ? 0.4 : 1) /
      25
    ) * 25;

  const lines = [
    {
      key:"frag-homing", base:"Frag Grenade Homing", legacyMk:3,
      company:"Vektor Dynamics", delivery:"homing",
      build:mk => {
        const dmg = BLAST[mk];
        return {
          effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Creatures in the blast make a Dexterity save, taking "+dmg+" piercing damage on a failure or half on a success. The primary target has disadvantage on the save and cannot benefit from half or three-quarters cover.",
          schema:{save:"dex",damage:dmg,damageType:"piercing",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryDisadvantage:true,primaryIgnoresCover:true}
        };
      }
    },
    {
      key:"frag-sticky", base:"Frag Grenade Sticky", legacyMk:1,
      company:"Vektor Dynamics", delivery:"sticky",
      build:mk => {
        const dmg = BLAST[mk];
        return {
          effectText:"Throw at a point, surface, or creature within 60 ft. A creature targeted directly makes a Dexterity save against attachment. On a failure the grenade sticks to it and that creature automatically fails the blast save. The grenade detonates in a 10-ft radius for "+dmg+" piercing damage; other creatures make a Dexterity save for half.",
          schema:{attachSave:"dex",save:"dex",damage:dmg,damageType:"piercing",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckAutoFail:true}
        };
      }
    },
    {
      key:"frag-regular", base:"Grenade Frag Regular", legacyMk:4,
      company:"ForgeLine Industries", delivery:"regular",
      build:mk => {
        const dmg = BLAST[mk];
        return {
          effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking "+dmg+" piercing damage on a failure or half on a success.",
          schema:{save:"dex",damage:dmg,damageType:"piercing",radiusFt:15,rangeFt:60,halfOnSuccess:true}
        };
      }
    },
    {
      key:"biohazard-homing", base:"Grenade Biohazard Homing", legacyMk:3,
      company:"Helix Vitae", delivery:"homing",
      build:mk => {
        const dmg = BLAST[mk];
        return {
          effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and bursts in a 10-ft radius. Creatures in the burst make a Constitution save, taking "+dmg+" poison damage on a failure or half on a success. A failed save also applies Poisoned until the end of the creature's next turn. The primary target has disadvantage on the save.",
          schema:{save:"con",damage:dmg,damageType:"poison",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryDisadvantage:true,conditionOnFail:"poisoned",durationTurns:1}
        };
      }
    },
    {
      key:"biohazard-regular", base:"Grenade Biohazard Regular", legacyMk:3,
      company:"Helix Vitae", delivery:"regular",
      build:mk => {
        const dmg = BLAST[mk];
        return {
          effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Constitution save, taking "+dmg+" poison damage on a failure or half on a success. A failed save also applies Poisoned until the end of the creature's next turn.",
          schema:{save:"con",damage:dmg,damageType:"poison",radiusFt:15,rangeFt:60,halfOnSuccess:true,conditionOnFail:"poisoned",durationTurns:1}
        };
      }
    },
    {
      key:"cutting-regular", base:"Grenade Cutting Regular", legacyMk:2,
      company:"Kurohane Group", delivery:"regular",
      build:mk => {
        const dmg = BLAST[mk];
        const tick = TICK[mk];
        return {
          effectText:"Throw to a point within 60 ft. Monofilament fragments rip through a 10-ft radius. Creatures make a Dexterity save, taking "+dmg+" slashing damage on a failure or half on a success. A creature that fails also Bleeds for "+tick+" slashing damage at the start of its next turn; the bleed damage and cleanup are automatic.",
          schema:{save:"dex",damage:dmg,damageType:"slashing",radiusFt:10,rangeFt:60,halfOnSuccess:true,tickOnFail:{kind:"bleed",formula:tick,damageType:"slashing"}}
        };
      }
    },
    {
      key:"emp-homing", base:"Grenade EMP Homing", legacyMk:3,
      company:"Jade Arc Systems", delivery:"homing",
      build:mk => {
        const dmg = EMP_BLAST[mk];
        return {
          effectText:"Choose a creature or electronic target you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Targets make a Constitution save, taking "+dmg+" lightning damage on a failure or half on a success. Cybernetic and electronic targets have disadvantage. A failed cybernetic/electronic target loses reactions until the end of its next turn; if it is the primary target, one active non-weapon cyberware system is automatically disabled for the same duration and then restored.",
          schema:{save:"con",damage:dmg,damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,electronicsDisadvantage:true,removeReactionsOnCyberFail:true,primaryDisableCyberware:true,durationTurns:1}
        };
      }
    },
    {
      key:"emp-regular", base:"Grenade EMP Regular", legacyMk:1,
      company:"Jade Arc Systems", delivery:"regular",
      build:mk => {
        const dmg = EMP_BLAST[mk];
        return {
          effectText:"Throw to a point within 60 ft. Targets in a 15-ft radius make a Constitution save, taking "+dmg+" lightning damage on a failure or half on a success. Cybernetic and electronic targets have disadvantage; on a failed save they also lose reactions until the end of their next turn.",
          schema:{save:"con",damage:dmg,damageType:"lightning",radiusFt:15,rangeFt:60,halfOnSuccess:true,electronicsDisadvantage:true,removeReactionsOnCyberFail:true,durationTurns:1}
        };
      }
    },
    {
      key:"emp-sticky", base:"Grenade EMP Sticky", legacyMk:1,
      company:"Jade Arc Systems", delivery:"sticky",
      build:mk => {
        const dmg = EMP_BLAST[mk];
        return {
          effectText:"Throw at a point, surface, creature, or device within 60 ft. A creature targeted directly makes a Dexterity save against attachment. On a failure it sticks and the target automatically fails the blast save. The 10-ft EMP burst deals "+dmg+" lightning damage, half on a successful Constitution save. Cybernetic and electronic targets have disadvantage; failed cybernetic/electronic targets lose reactions, and a directly stuck target also has one active non-weapon cyberware system disabled until the end of its next turn. All restoration is automatic.",
          schema:{attachSave:"dex",save:"con",damage:dmg,damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckAutoFail:true,electronicsDisadvantage:true,removeReactionsOnCyberFail:true,primaryDisableCyberware:true,durationTurns:1}
        };
      }
    },
    {
      key:"incendiary-homing", base:"Grenade Incendiary Homing", legacyMk:2,
      company:"Vektor Dynamics", delivery:"homing",
      build:mk => {
        const dmg = BLAST[mk];
        const tick = TICK[mk];
        return {
          effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Creatures make a Dexterity save, taking "+dmg+" fire damage on a failure or half on a success. A failed save also applies Burning for "+tick+" fire damage at the start of the creature's next turn, then removes itself automatically. The primary target has disadvantage on the initial save.",
          schema:{save:"dex",damage:dmg,damageType:"fire",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryDisadvantage:true,tickOnFail:{kind:"burn",formula:tick,damageType:"fire"}}
        };
      }
    },
    {
      key:"incendiary-regular", base:"Grenade Incendiary Regular", legacyMk:3,
      company:"ForgeLine Industries", delivery:"regular",
      build:mk => {
        const dmg = BLAST[mk];
        const tick = TICK[mk];
        return {
          effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking "+dmg+" fire damage on a failure or half on a success. A failed save also applies Burning for "+tick+" fire damage at the start of the creature's next turn, then removes itself automatically.",
          schema:{save:"dex",damage:dmg,damageType:"fire",radiusFt:15,rangeFt:60,halfOnSuccess:true,tickOnFail:{kind:"burn",formula:tick,damageType:"fire"}}
        };
      }
    },
    {
      key:"incendiary-sticky", base:"Grenade Incendiary Sticky", legacyMk:2,
      company:"Bastion Strategic", delivery:"sticky",
      build:mk => {
        const dmg = BLAST[mk];
        const tick = TICK[mk];
        return {
          effectText:"Throw at a point, surface, or creature within 60 ft. A directly targeted creature makes a Dexterity save against attachment. On a failure the grenade sticks and the target automatically fails the blast save. The 10-ft blast deals "+dmg+" fire damage, half on a successful Dexterity save. Failed creatures Burn for "+tick+" fire damage at the start of their next turn; the tick and cleanup are automatic.",
          schema:{attachSave:"dex",save:"dex",damage:dmg,damageType:"fire",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckAutoFail:true,tickOnFail:{kind:"burn",formula:tick,damageType:"fire"}}
        };
      }
    },
    {
      key:"flash-regular", base:"Grenade Flash Regular", legacyMk:2,
      company:"Bastion Strategic", delivery:"regular", utility:true,
      build:mk => {
        const dmg = FLASH[mk];
        return {
          effectText:"Throw to a point within 60 ft. Creatures in a 20-ft radius make a Constitution save, taking "+dmg+" thunder damage on a failure or half on a success. On a failure they are Deafened, lose reactions, and—if they rely on sight—are Blinded until the end of their next turn. These effects are applied and removed automatically.",
          schema:{save:"con",damage:dmg,damageType:"thunder",radiusFt:20,rangeFt:60,halfOnSuccess:true,flashbang:true,removeReactionsOnFail:true,durationTurns:1}
        };
      }
    },
    {
      key:"flashbang-homing", base:"Grenade Flashbang Homing", legacyMk:1,
      company:"Bastion Strategic", delivery:"homing", utility:true,
      build:mk => {
        const dmg = FLASH[mk];
        return {
          effectText:"Choose a creature you can see within 60 ft. The flashbang homes to it and bursts in a 15-ft radius. Creatures make a Constitution save, taking "+dmg+" thunder damage on a failure or half on a success. On a failure they are Deafened, lose reactions, and—if they rely on sight—are Blinded until the end of their next turn. The primary target has disadvantage on the save. Effects clean themselves up automatically.",
          schema:{save:"con",damage:dmg,damageType:"thunder",radiusFt:15,rangeFt:60,halfOnSuccess:true,flashbang:true,removeReactionsOnFail:true,primaryDisadvantage:true,durationTurns:1}
        };
      }
    },
    {
      key:"recon-regular", base:"Grenade Recon Regular", legacyMk:2,
      company:"Corvus Neural", delivery:"regular", utility:true,
      build:mk => {
        const radius = {1:25,2:30,3:35,4:40,5:50}[mk];
        return {
          effectText:"Throw to a point within 60 ft. Place a "+radius+"-ft-radius scan template. The grenade immediately identifies creatures, active cyberware, and networked devices inside the area to the operator. The scan is instantaneous and the template removes itself automatically after resolving.",
          schema:{radiusFt:radius,rangeFt:60,scan:true,noDamage:true,transientTemplateMs:2500}
        };
      }
    },
    {
      key:"recon-sticky", base:"Grenade Recon Sticky", legacyMk:4,
      company:"Corvus Neural", delivery:"sticky", utility:true,
      build:mk => {
        const radius = {1:20,2:25,3:30,4:30,5:40}[mk];
        const rounds = {1:3,2:5,3:7,4:10,5:10}[mk];
        const span = rounds >= 10 ? "1 minute" : rounds+" rounds";
        return {
          effectText:"Throw at a point, surface, or creature within 60 ft. The sensor sticks where it lands and creates a "+radius+"-ft-radius measured scan zone for "+span+". If attached to a creature the zone follows that token automatically. Creatures inside are automatically marked RECON // REVEALED; the zone and its markers clean themselves up when the duration ends.",
          schema:{radiusFt:radius,rangeFt:60,scan:true,noDamage:true,sticky:true,zoneKind:"recon",zoneRounds:rounds}
        };
      }
    },
    {
      key:"smoke-regular", base:"Grenade Smoke Regular", legacyMk:3,
      company:"Kurohane Group", delivery:"regular", utility:true,
      build:mk => {
        const radius = {1:15,2:20,3:25,4:30,5:35}[mk];
        const rounds = {1:1,2:1,3:1,4:2,5:3}[mk];
        return {
          effectText:"Throw to a point within 60 ft. Place a "+radius+"-ft-radius smoke template. The area is heavily obscured for "+rounds+" round"+(rounds === 1 ? "" : "s")+". Tokens entering the zone are automatically marked SMOKE // HEAVILY OBSCURED; the marker is removed when they leave, and the template deletes itself automatically when the duration ends.",
          schema:{radiusFt:radius,rangeFt:60,noDamage:true,zoneKind:"smoke",zoneRounds:rounds}
        };
      }
    }
  ];

  const definitions = [];
  const legacyNames = new Map();

  for (const line of lines) {
    for (const mk of MKS) {
      const built = line.build(mk);
      const def = {
        key:line.key+"-mk"+mk,
        line:line.key,
        company:line.company,
        name:line.base+" Mk."+ROMAN[mk],
        mk,
        price:price(mk,line.delivery,line.utility === true),
        availability:MK_AVAILABILITY[mk],
        delivery:line.delivery,
        effectText:built.effectText,
        schema:built.schema
      };
      definitions.push(def);
      if (mk === line.legacyMk) legacyNames.set(line.base,def);
    }
  }

  // One-off: no Mk line.
  definitions.push({
    key:"ozobs-nose",
    line:"ozobs-nose",
    company:"ForgeLine Industries",
    name:"Grenade Ozobs Nose",
    mk:3, price:1750, availability:"Restricted", delivery:"regular",
    effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 15d6 explosive damage on a failure or half on a success. A failed save also knocks the creature Prone and blasts it up to 10 ft directly away from the detonation if movement is unobstructed.",
    schema:{save:"dex",damage:"15d6",damageType:"explosive",radiusFt:15,rangeFt:60,halfOnSuccess:true,proneOnFail:true,knockbackFt:10}
  });

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
  for (const [legacy,def] of legacyNames) {
    byName.set(normalize(legacy),def);
  }

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
    const manufacturer =
      String(def?.company ?? "ForgeLine Industries").trim() ||
      "ForgeLine Industries";

    const mkLabel = "Mk." + ["0","I","II","III","IV","V"][def.mk];
    const delivery = String(def.delivery ?? "regular").toUpperCase();
    const schema = def.schema ?? {};
    const damage =
      schema.damage
        ? String(schema.damage)+" "+String(schema.damageType ?? "").toUpperCase()
        : "—";
    const range =
      schema.rangeFt != null ? String(schema.rangeFt)+" ft" : "—";
    const area =
      schema.radiusFt != null ? String(schema.radiusFt)+" ft radius" : "—";

    return (
      '<section data-feha-ui="item-card-v1" data-feha-grenade-card="'+REWRITE+'" '+
      'style="border:1px solid #2b5662;background:#071116;padding:13px 14px;color:#dce8ec !important">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:9px;border-bottom:1px solid #263941">'+
          '<small style="color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.12em">'+
            'FEHA // '+esc(manufacturer.toUpperCase())+' // GRENADE'+
          '</small>'+
          '<strong style="color:#eefaff;font-size:12px">'+esc(mkLabel)+'</strong>'+
        '</div>'+
        '<h2 style="margin:10px 0 4px;color:#fff">'+esc(def.name)+'</h2>'+
        '<p style="margin:0 0 11px;font-size:11px;line-height:1.45;color:#8ba0a8 !important">'+
          esc(def.availability)+' // '+esc(delivery)+
        '</p>'+
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;padding:10px 0;border-top:1px solid #1f3239;border-bottom:1px solid #1f3239">'+
          '<div><small style="color:#8ca2ac">DELIVERY</small><br><strong style="color:#fff">'+esc(delivery)+'</strong></div>'+
          '<div><small style="color:#8ca2ac">DAMAGE</small><br><strong style="color:#fff">'+esc(damage)+'</strong></div>'+
          '<div><small style="color:#8ca2ac">RANGE</small><br><strong style="color:#fff">'+esc(range)+'</strong></div>'+
          '<div><small style="color:#8ca2ac">AREA</small><br><strong style="color:#fff">'+esc(area)+'</strong></div>'+
          '<div><small style="color:#8ca2ac">MARKET</small><br><strong style="color:#f0c85a">CR '+Number(def.price).toLocaleString()+'</strong></div>'+
          '<div><small style="color:#8ca2ac">ACTIVATION</small><br><strong style="color:#fff">BONUS ACTION</strong></div>'+
        '</div>'+
        '<div style="margin-top:10px;padding:10px;border:1px solid #24404a;background:#09171c">'+
          '<small style="display:block;color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:5px">EFFECT</small>'+
          '<p style="margin:0;line-height:1.5;color:#dce8ec !important">'+esc(def.effectText)+'</p>'+
        '</div>'+
      '</section>'
    );
  }

  function rootFolder() {
    return (
      (game.folders?.contents ?? [])
        .filter(folder =>
          String(folder?.type ?? "") === "Item" &&
          String(folder?.name ?? "") === ROOT_NAME
        )
        .sort((a,b) => {
          const aTop =
            a?.folder?.name === "ADK V10 — CURATED CATALOG"
              ? 0
              : 1;
          const bTop =
            b?.folder?.name === "ADK V10 — CURATED CATALOG"
              ? 0
              : 1;
          return aTop - bTop;
        })[0] ??
      null
    );
  }

  async function ensureCompanyFolders() {
    const root = rootFolder();

    if (!root) {
      throw new Error(
        "FEHA Grenades could not find the '"+ROOT_NAME+"' Item folder."
      );
    }

    const folders = new Map();

    for (const company of COMPANY_ORDER) {
      let folder =
        (game.folders?.contents ?? []).find(candidate =>
          String(candidate?.type ?? "") === "Item" &&
          String(candidate?.name ?? "") === company &&
          String(candidate?.folder?.id ?? candidate?.folder ?? "") ===
            String(root.id)
        ) ??
        null;

      if (!folder) {
        folder =
          await globalThis.Folder.create({
            name:company,
            type:"Item",
            folder:root.id,
            sorting:"a"
          });
      }

      folders.set(company,folder);
    }

    return {root,folders};
  }

  async function migrateItem(item,folderId=null) {
    const def = definition(item);
    if (!item || !def || !looksLikeGrenade(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};
    const mkLabel = "Mk." + ["0","I","II","III","IV","V"][def.mk];

    if (
      folderId &&
      !item.parent &&
      String(item.folder?.id ?? item.folder ?? "") !== String(folderId)
    ) {
      update.folder = folderId;
    }

    if (item.name !== def.name) update.name = def.name;

    if (flags.manufacturer !== def.company) {
      update[`flags.${FLAG}.manufacturer`] = def.company;
    }

    if (flags.company !== def.company) {
      update[`flags.${FLAG}.company`] = def.company;
    }
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
    if (flags.shopType !== "arms") {
      update[`flags.${FLAG}.shopType`] = "arms";
    }
    if (flags.curatedCatalogV10 !== true) {
      update[`flags.${FLAG}.curatedCatalogV10`] = true;
    }
    if (flags.catalogEnabled !== true) {
      update[`flags.${FLAG}.catalogEnabled`] = true;
    }
    if (flags.marketPass !== "catalog-1.0") {
      update[`flags.${FLAG}.marketPass`] = "catalog-1.0";
    }
    if (flags.marketCategory !== "Grenades") {
      update[`flags.${FLAG}.marketCategory`] = "Grenades";
    }
    if (Number(flags.marketPrice) !== def.price) {
      update[`flags.${FLAG}.marketPrice`] = def.price;
    }
    if (Number(flags.priceCredits) !== def.price) {
      update[`flags.${FLAG}.priceCredits`] = def.price;
    }
    if (flags.availability !== def.availability) {
      update[`flags.${FLAG}.availability`] = def.availability;
    }
    // Five Mk tiers per line: weight each down so grenades keep roughly
    // their old share of random market stock.
    const stockWeight = def.line === "ozobs-nose" ? 1 : STOCK_WEIGHT;
    if (Number(flags.marketStockWeight) !== stockWeight) {
      update[`flags.${FLAG}.marketStockWeight`] = stockWeight;
    }
    if (flags.actionType !== "bonus") {
      update[`flags.${FLAG}.actionType`] = "bonus";
    }
    if (flags.bonusAction !== true) {
      update[`flags.${FLAG}.bonusAction`] = true;
    }
    if (flags.grenadeRewriteVersion !== REWRITE) {
      update[`flags.${FLAG}.grenadeRewriteVersion`] = REWRITE;
    }

    const nextSchema = {
      version:REWRITE,
      key:def.key,
      company:def.company,
      delivery:def.delivery,
      actionType:"bonus",
      bonusAction:true,
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
      item.system?.price &&
      String(item.system.price.denomination ?? "") !== "gp"
    ) {
      update["system.price.denomination"] = "gp";
    }

    if (
      item.system?.activation &&
      String(item.system.activation.type ?? "") !== "bonus"
    ) {
      update["system.activation.type"] = "bonus";
      if (
        Object.prototype.hasOwnProperty.call(
          item.system.activation,
          "cost"
        )
      ) {
        update["system.activation.cost"] = 1;
      }
    }

    if (
      item.system?.uses &&
      (
        String(item.system.uses.max ?? "") !== "" ||
        Number(item.system.uses.spent ?? 0) !== 0
      )
    ) {
      update["system.uses.max"] = "";
      update["system.uses.spent"] = 0;
    }

    const rarity = MK_RARITY[def.mk];
    if (
      rarity &&
      item.system &&
      "rarity" in item.system &&
      String(item.system.rarity ?? "") !== rarity
    ) {
      update["system.rarity"] = rarity;
    }

    const description = rewriteDescription(def,item);

    if (
      description !==
      String(item.system?.description?.value ?? "")
    ) {
      update["system.description.value"] = description;
    }

    // Nothing to change: skip the no-op update (94 of them per load).
    if (!Object.keys(update).length) return false;

    await item.update(update);
    return true;
  }

  // Each Mk tier is its own world item so the Market can stock it. Missing
  // tiers are cloned from any existing world item of the same line, then
  // canonicalized by migrateItem.
  async function createMissingTiers(folders) {
    const worldGrenades = (game.items?.contents ?? [])
      .filter(item => looksLikeGrenade(item));

    const present = new Set(
      worldGrenades.map(item => definition(item)?.key).filter(Boolean)
    );

    let created = 0;

    for (const def of definitions) {
      if (present.has(def.key)) continue;

      const template = worldGrenades.find(item =>
        definition(item)?.line === def.line
      );
      if (!template) continue;

      try {
        const data = template.toObject();
        delete data._id;
        delete data._stats;
        data.name = def.name;
        data.folder = folders.get(def.company)?.id ?? data.folder ?? null;
        data.flags ??= {};
        data.flags[FLAG] = {
          ...(data.flags[FLAG] ?? {}),
          originalLibraryName:def.name,
          sourceCategory:"Grenades"
        };
        if (data.system && "identifier" in data.system) {
          data.system.identifier = normalize(def.name).replace(/\s+/g,"-");
        }

        const [item] = await globalThis.Item.createDocuments([data]);
        if (item) {
          await migrateItem(item,data.folder);
          present.add(def.key);
          created++;
        }
      } catch (err) {
        console.warn(
          "FEHA GRENADES // tier creation failed",
          def.name,
          err
        );
      }
    }

    return created;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {world:0,owned:0,skipped:true};
    }

    let world = 0;
    let owned = 0;
    let foldersCreated = 0;

    const beforeFolders =
      new Set(
        (game.folders?.contents ?? [])
          .filter(folder =>
            String(folder?.type ?? "") === "Item" &&
            COMPANY_ORDER.includes(String(folder?.name ?? "")) &&
            String(folder?.folder?.name ?? "") === ROOT_NAME
          )
          .map(folder => String(folder.id))
      );

    const {folders} = await ensureCompanyFolders();

    const afterFolders =
      new Set(
        (game.folders?.contents ?? [])
          .filter(folder =>
            String(folder?.type ?? "") === "Item" &&
            COMPANY_ORDER.includes(String(folder?.name ?? "")) &&
            String(folder?.folder?.name ?? "") === ROOT_NAME
          )
          .map(folder => String(folder.id))
      );

    foldersCreated =
      [...afterFolders].filter(id => !beforeFolders.has(id)).length;

    for (const item of game.items?.contents ?? []) {
      try {
        const def = definition(item);
        const folderId =
          def
            ? folders.get(def.company)?.id ?? null
            : null;

        if (await migrateItem(item,folderId)) world++;
      } catch (err) {
        console.warn(
          "FEHA GRENADES // world migration failed",
          item?.name,
          err
        );
      }
    }

    const created = await createMissingTiers(folders);

    for (const actor of game.actors?.contents ?? []) {
      for (const item of actor.items ?? []) {
        try {
          if (await migrateItem(item,null)) owned++;
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
      {world,owned,created,foldersCreated}
    );

    return {
      world,
      owned,
      created,
      foldersCreated,
      skipped:false
    };
  }

  const api = {
    version:VERSION,
    rewriteVersion:REWRITE,
    companies:[...COMPANY_ORDER],
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
            company:def.company,
            delivery:def.delivery,
            actionType:"bonus",
            bonusAction:true,
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
