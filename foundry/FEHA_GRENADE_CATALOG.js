// FEHA // GRENADE CATALOG
// Canonical physical grenade definitions + idempotent Foundry item migration.
// This owns grenade identity/data only. Runtime automation can consume grenadeSchema later.

(() => {
  try { globalThis.FEHA_GRENADE_CATALOG?.destroy?.(); } catch {}

  const VERSION = "2.5.0";
  const REWRITE = "2.5-unified";
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

  const definitions = [
    {
      key:"frag-homing",
      company:"Vektor Dynamics",
      name:"Frag Grenade Homing",
      mk:3, price:1600, availability:"Restricted", delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Creatures in the blast make a Dexterity save, taking 10d6 piercing damage on a failure or half on a success. The primary target has disadvantage on the save and cannot benefit from half or three-quarters cover.",
      schema:{save:"dex",damage:"10d6",damageType:"piercing",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryDisadvantage:true,primaryIgnoresCover:true}
    },
    {
      key:"frag-sticky",
      company:"Vektor Dynamics",
      name:"Frag Grenade Sticky",
      mk:1, price:400, availability:"Common", delivery:"sticky",
      effectText:"Throw at a point, surface, or creature within 60 ft. A creature targeted directly makes a Dexterity save against attachment. On a failure the grenade sticks to it and that creature automatically fails the blast save. The grenade detonates in a 10-ft radius for 6d6 piercing damage; other creatures make a Dexterity save for half.",
      schema:{attachSave:"dex",save:"dex",damage:"6d6",damageType:"piercing",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckAutoFail:true}
    },
    {
      key:"biohazard-homing",
      company:"Helix Vitae",
      name:"Grenade Biohazard Homing",
      mk:3, price:1600, availability:"Restricted", delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and bursts in a 10-ft radius. Creatures in the burst make a Constitution save, taking 10d6 poison damage on a failure or half on a success. A failed save also applies Poisoned until the end of the creature's next turn. The primary target has disadvantage on the save.",
      schema:{save:"con",damage:"10d6",damageType:"poison",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryDisadvantage:true,conditionOnFail:"poisoned",durationTurns:1}
    },
    {
      key:"biohazard-regular",
      company:"Helix Vitae",
      name:"Grenade Biohazard Regular",
      mk:3, price:1000, availability:"Restricted", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Constitution save, taking 10d6 poison damage on a failure or half on a success. A failed save also applies Poisoned until the end of the creature's next turn.",
      schema:{save:"con",damage:"10d6",damageType:"poison",radiusFt:15,rangeFt:60,halfOnSuccess:true,conditionOnFail:"poisoned",durationTurns:1}
    },
    {
      key:"cutting-regular",
      company:"Kurohane Group",
      name:"Grenade Cutting Regular",
      mk:2, price:600, availability:"Professional", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Monofilament fragments rip through a 10-ft radius. Creatures make a Dexterity save, taking 8d6 slashing damage on a failure or half on a success. A creature that fails also Bleeds for 2d6 slashing damage at the start of its next turn; the bleed damage and cleanup are automatic.",
      schema:{save:"dex",damage:"8d6",damageType:"slashing",radiusFt:10,rangeFt:60,halfOnSuccess:true,tickOnFail:{kind:"bleed",formula:"2d6",damageType:"slashing"}}
    },
    {
      key:"emp-homing",
      company:"Jade Arc Systems",
      name:"Grenade EMP Homing",
      mk:3, price:1600, availability:"Restricted", delivery:"homing",
      effectText:"Choose a creature or electronic target you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Targets make a Constitution save, taking 8d6 lightning damage on a failure or half on a success. Cybernetic and electronic targets have disadvantage. A failed cybernetic/electronic target loses reactions until the end of its next turn; if it is the primary target, one active non-weapon cyberware system is automatically disabled for the same duration and then restored.",
      schema:{save:"con",damage:"8d6",damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,electronicsDisadvantage:true,removeReactionsOnCyberFail:true,primaryDisableCyberware:true,durationTurns:1}
    },
    {
      key:"emp-regular",
      company:"Jade Arc Systems",
      name:"Grenade EMP Regular",
      mk:1, price:300, availability:"Common", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Targets in a 15-ft radius make a Constitution save, taking 6d6 lightning damage on a failure or half on a success. Cybernetic and electronic targets have disadvantage; on a failed save they also lose reactions until the end of their next turn.",
      schema:{save:"con",damage:"6d6",damageType:"lightning",radiusFt:15,rangeFt:60,halfOnSuccess:true,electronicsDisadvantage:true,removeReactionsOnCyberFail:true,durationTurns:1}
    },
    {
      key:"emp-sticky",
      company:"Jade Arc Systems",
      name:"Grenade EMP Sticky",
      mk:1, price:400, availability:"Common", delivery:"sticky",
      effectText:"Throw at a point, surface, creature, or device within 60 ft. A creature targeted directly makes a Dexterity save against attachment. On a failure it sticks and the target automatically fails the blast save. The 10-ft EMP burst deals 6d6 lightning damage, half on a successful Constitution save. Cybernetic and electronic targets have disadvantage; failed cybernetic/electronic targets lose reactions, and a directly stuck target also has one active non-weapon cyberware system disabled until the end of its next turn. All restoration is automatic.",
      schema:{attachSave:"dex",save:"con",damage:"6d6",damageType:"lightning",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckAutoFail:true,electronicsDisadvantage:true,removeReactionsOnCyberFail:true,primaryDisableCyberware:true,durationTurns:1}
    },
    {
      key:"flash-regular",
      company:"Bastion Strategic",
      name:"Grenade Flash Regular",
      mk:2, price:250, availability:"Professional", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 20-ft radius make a Constitution save, taking 2d6 thunder damage on a failure or half on a success. On a failure they are Deafened, lose reactions, and—if they rely on sight—are Blinded until the end of their next turn. These effects are applied and removed automatically.",
      schema:{save:"con",damage:"2d6",damageType:"thunder",radiusFt:20,rangeFt:60,halfOnSuccess:true,flashbang:true,removeReactionsOnFail:true,durationTurns:1}
    },
    {
      key:"flashbang-homing",
      company:"Bastion Strategic",
      name:"Grenade Flashbang Homing",
      mk:1, price:200, availability:"Common", delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The flashbang homes to it and bursts in a 15-ft radius. Creatures make a Constitution save, taking 2d6 thunder damage on a failure or half on a success. On a failure they are Deafened, lose reactions, and—if they rely on sight—are Blinded until the end of their next turn. The primary target has disadvantage on the save. Effects clean themselves up automatically.",
      schema:{save:"con",damage:"2d6",damageType:"thunder",radiusFt:15,rangeFt:60,halfOnSuccess:true,flashbang:true,removeReactionsOnFail:true,primaryDisadvantage:true,durationTurns:1}
    },
    {
      key:"frag-regular",
      company:"ForgeLine Industries",
      name:"Grenade Frag Regular",
      mk:4, price:1600, availability:"Black Market", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 12d6 piercing damage on a failure or half on a success.",
      schema:{save:"dex",damage:"12d6",damageType:"piercing",radiusFt:15,rangeFt:60,halfOnSuccess:true}
    },
    {
      key:"incendiary-homing",
      company:"Vektor Dynamics",
      name:"Grenade Incendiary Homing",
      mk:2, price:950, availability:"Professional", delivery:"homing",
      effectText:"Choose a creature you can see within 60 ft. The grenade homes to it and detonates in a 10-ft radius. Creatures make a Dexterity save, taking 8d6 fire damage on a failure or half on a success. A failed save also applies Burning for 2d6 fire damage at the start of the creature's next turn, then removes itself automatically. The primary target has disadvantage on the initial save.",
      schema:{save:"dex",damage:"8d6",damageType:"fire",radiusFt:10,rangeFt:60,halfOnSuccess:true,primaryDisadvantage:true,tickOnFail:{kind:"burn",formula:"2d6",damageType:"fire"}}
    },
    {
      key:"incendiary-regular",
      company:"ForgeLine Industries",
      name:"Grenade Incendiary Regular",
      mk:3, price:1000, availability:"Restricted", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 10d6 fire damage on a failure or half on a success. A failed save also applies Burning for 2d6 fire damage at the start of the creature's next turn, then removes itself automatically.",
      schema:{save:"dex",damage:"10d6",damageType:"fire",radiusFt:15,rangeFt:60,halfOnSuccess:true,tickOnFail:{kind:"burn",formula:"2d6",damageType:"fire"}}
    },
    {
      key:"incendiary-sticky",
      company:"Bastion Strategic",
      name:"Grenade Incendiary Sticky",
      mk:2, price:775, availability:"Professional", delivery:"sticky",
      effectText:"Throw at a point, surface, or creature within 60 ft. A directly targeted creature makes a Dexterity save against attachment. On a failure the grenade sticks and the target automatically fails the blast save. The 10-ft blast deals 8d6 fire damage, half on a successful Dexterity save. Failed creatures Burn for 2d6 fire damage at the start of their next turn; the tick and cleanup are automatic.",
      schema:{attachSave:"dex",save:"dex",damage:"8d6",damageType:"fire",radiusFt:10,rangeFt:60,halfOnSuccess:true,sticky:true,stuckAutoFail:true,tickOnFail:{kind:"burn",formula:"2d6",damageType:"fire"}}
    },
    {
      key:"ozobs-nose",
      company:"ForgeLine Industries",
      name:"Grenade Ozobs Nose",
      mk:3, price:1750, availability:"Restricted", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Creatures in a 15-ft radius make a Dexterity save, taking 15d6 explosive damage on a failure or half on a success. A failed save also knocks the creature Prone and blasts it up to 10 ft directly away from the detonation if movement is unobstructed.",
      schema:{save:"dex",damage:"15d6",damageType:"explosive",radiusFt:15,rangeFt:60,halfOnSuccess:true,proneOnFail:true,knockbackFt:10}
    },
    {
      key:"recon-regular",
      company:"Corvus Neural",
      name:"Grenade Recon Regular",
      mk:2, price:250, availability:"Professional", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Place a 30-ft-radius scan template. The grenade immediately identifies creatures, active cyberware, and networked devices inside the area to the operator. The scan is instantaneous and the template removes itself automatically after resolving.",
      schema:{radiusFt:30,rangeFt:60,scan:true,noDamage:true,transientTemplateMs:2500}
    },
    {
      key:"recon-sticky",
      company:"Corvus Neural",
      name:"Grenade Recon Sticky",
      mk:4, price:825, availability:"Black Market", delivery:"sticky",
      effectText:"Throw at a point, surface, or creature within 60 ft. The sensor sticks where it lands and creates a 30-ft-radius measured scan zone for 1 minute. If attached to a creature the zone follows that token automatically. Creatures inside are automatically marked RECON // REVEALED; the zone and its markers clean themselves up when the duration ends.",
      schema:{radiusFt:30,rangeFt:60,scan:true,noDamage:true,sticky:true,zoneKind:"recon",zoneRounds:10}
    },
    {
      key:"smoke-regular",
      company:"Kurohane Group",
      name:"Grenade Smoke Regular",
      mk:3, price:400, availability:"Restricted", delivery:"regular",
      effectText:"Throw to a point within 60 ft. Place a 25-ft-radius smoke template. The area is heavily obscured for 1 round. Tokens entering the zone are automatically marked SMOKE // HEAVILY OBSCURED; the marker is removed when they leave, and the template deletes itself automatically when the duration ends.",
      schema:{radiusFt:25,rangeFt:60,noDamage:true,zoneKind:"smoke",zoneRounds:1}
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
      {world,owned,foldersCreated}
    );

    return {
      world,
      owned,
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
