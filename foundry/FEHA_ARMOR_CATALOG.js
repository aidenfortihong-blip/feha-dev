// FEHA // ARMOR CATALOG
// Canonical body-armor progression, pricing, manufacturer identity, and passive effects.

(() => {
  try { globalThis.FEHA_ARMOR_CATALOG?.destroy?.(); } catch {}

  const VERSION = "1.1.0";
  const REWRITE = "1.1";
  const FLAG = "fleshEnshrouded";
  const ROOT_NAME = "03 — ARMOR";

  const COMPANY_ORDER = [
    "ForgeLine Industries",
    "Bastion Strategic",
    "Jade Arc Systems",
    "Corvus Neural",
    "Vektor Dynamics",
    "Helix Vitae",
    "Kurohane Group"
  ];

  const availabilityByMk = {
    1:"Common",
    2:"Professional",
    3:"Restricted",
    4:"Elite",
    5:"Prototype"
  };

  const profiles = [
    {
      company:"ForgeLine Industries",
      line:"Rivet Work Armor",
      flavor:"Overbuilt industrial armor with no concern for weight, subtlety, or comfort. ForgeLine solves incoming fire by putting more material between it and you.",
      armorType:"heavy",
      dexCap:0,
      ac:[16,18,20,23,25],
      price:[900,2200,6000,16000,40000],
      weight:[35,45,60,80,110],
      effect:mk => ({
        key:"powered-bracing",
        name:"Powered Bracing",
        value:mk >= 4 ? 3 : 2,
        text:
          "Powered Bracing: +" + (mk >= 4 ? 3 : 2) +
          " to Strength checks and Strength saving throws."
      })
    },
    {
      company:"Bastion Strategic",
      line:"Bastion Combat Plate",
      flavor:"Measured military combat plate: still heavy and built for serious calibers, but engineered to stay tactical instead of becoming a walking bunker.",
      armorType:"heavy",
      dexCap:0,
      ac:[15,17,19,22,24],
      price:[850,2000,5500,15000,36000],
      weight:[24,30,37,45,56],
      effect:mk => ({
        key:"tactical-layering",
        name:"Tactical Layering",
        value:mk,
        text:
          "Tactical Layering: reduce damage from weapon attacks by " +
          mk + "."
      })
    },
    {
      company:"Jade Arc Systems",
      line:"Fire-Control Harness",
      flavor:"Heavy energy-combat armor built around rail systems, insulated power routing, and hard protection for operators working around violent electrical discharge.",
      armorType:"heavy",
      dexCap:0,
      ac:[15,17,19,21,23],
      price:[900,2100,6000,16000,38000],
      weight:[22,28,35,43,52],
      effect:mk => ({
        key:"faraday-armor",
        name:"Faraday Armor",
        value:mk,
        text:
          "Faraday Armor: resistance to lightning damage and advantage on saving throws against EMP effects."
      })
    },
    {
      company:"Corvus Neural",
      line:"Interface Security Suit",
      flavor:"Expensive neural-defense armor full of eccentric shielding, signal isolation, and operator-first design choices that only Corvus would build this way.",
      armorType:"medium",
      dexCap:0,
      ac:[14,16,18,20,22],
      price:[950,2300,6500,17000,42000],
      weight:[11,12,14,16,18],
      effect:mk => ({
        key:"neural-isolation",
        name:"Neural Isolation",
        value:[1,1,2,2,3][mk-1],
        text:
          "Neural Isolation: +" + [1,1,2,2,3][mk-1] +
          " to saving throws made against Quickhacks."
      })
    },
    {
      company:"Vektor Dynamics",
      line:"Flexweave Mobility Suit",
      flavor:"Adaptive multi-role armor designed to stay quick, take a hit, and work across changing combat situations without overcommitting to a single specialty.",
      armorType:"medium",
      dexCap:2,
      ac:[14,16,17,19,21],
      price:[700,1700,4500,12000,30000],
      weight:[12,14,16,18,20],
      effect:mk => ({
        key:"adaptive-flexplate",
        name:"Adaptive Flexplate",
        value:2,
        text:
          "Adaptive Flexplate: add your Dexterity modifier to AC, to a maximum of +2."
      })
    },
    {
      company:"Helix Vitae",
      line:"Living Dermal Suit",
      flavor:"Fast-response bio-integrated armor built for movement. Helix accepts less raw plating to keep the wearer accelerating, repositioning, and acting quickly.",
      armorType:"medium",
      dexCap:1,
      ac:[13,15,17,19,21],
      price:[750,1800,5000,13000,32000],
      weight:[8,9,10,11,12],
      effect:mk => ({
        key:"kinetic-assist",
        name:"Kinetic Assist",
        value:[5,5,10,10,15][mk-1],
        text:
          "Kinetic Assist: +" + [5,5,10,10,15][mk-1] +
          " ft walking Speed."
      })
    },
    {
      company:"Kurohane Group",
      line:"Ghostweave Suit",
      flavor:"Low-profile Arasaka-style covert armor built around speed, silence, and avoiding the shot instead of trying to become heavier than it.",
      armorType:"light",
      dexCap:null,
      ac:[13,15,16,18,20],
      price:[800,1900,5000,14000,34000],
      weight:[5,6,7,8,9],
      effect:mk => ({
        key:"ghostweave",
        name:"Ghostweave",
        value:[1,1,2,2,3][mk-1],
        text:
          "Ghostweave: add your full Dexterity modifier to AC and gain +" +
          [1,1,2,2,3][mk-1] +
          " to Dexterity (Stealth) checks."
      })
    }
  ];

  const definitions = [];

  for (const profile of profiles) {
    for (let mk = 1; mk <= 5; mk++) {
      const signature = profile.effect(mk);

      definitions.push({
        key:
          profile.company.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") +
          "-" + mk,
        line:profile.line,
        name:profile.line+" Mk."+["0","I","II","III","IV","V"][mk],
        company:profile.company,
        mk,
        availability:availabilityByMk[mk],
        ac:profile.ac[mk-1],
        price:profile.price[mk-1],
        weight:profile.weight[mk-1],
        armorType:profile.armorType,
        dexCap:profile.dexCap,
        flavor:profile.flavor,
        signature
      });
    }
  }

  const normalize = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const byName = new Map(
    definitions.map(def => [normalize(def.name),def])
  );

  const byKey = new Map(
    definitions.map(def => [normalize(def.key),def])
  );

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  function definition(value) {
    if (!value) return null;

    if (typeof value === "string") {
      return (
        byKey.get(normalize(value)) ??
        byName.get(normalize(value)) ??
        null
      );
    }

    const flags = value.flags?.[FLAG] ?? {};

    for (const candidate of [
      flags.armorKey,
      value.name,
      flags.originalLibraryName
    ]) {
      const key = normalize(candidate);

      if (byKey.has(key)) return byKey.get(key);
      if (byName.has(key)) return byName.get(key);
    }

    return null;
  }

  function isArmor(item) {
    if (!item || item.documentName !== "Item") return false;

    const flags = item.flags?.[FLAG] ?? {};
    const category = normalize(
      flags.sourceCategory ??
      flags.category ??
      ""
    );

    return Boolean(
      definition(item) &&
      (
        flags.bodyArmor === true ||
        category === "armor outer" ||
        category === "armor" ||
        /\/03\s*—?\s*armor\//i.test(
          String(item.folder?.path ?? "")
        )
      )
    );
  }

  function mkLabel(mk) {
    return "Mk."+["0","I","II","III","IV","V"][mk];
  }

  function dexText(def) {
    if (def.dexCap === null) return "Full Dexterity modifier";
    if (Number(def.dexCap) > 0) {
      return "Dexterity modifier, maximum +" + Number(def.dexCap);
    }
    return "None";
  }

  function rewriteDescription(def) {
    return (
      '<section data-feha-armor-card="'+REWRITE+'" '+
      'style="border:1px solid #35515b;background:#071116;padding:13px 14px;color:#dce8ec !important">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;'+
        'padding-bottom:9px;border-bottom:1px solid #263941">'+
          '<small style="color:#72dff2;font-size:10px;font-weight:900;letter-spacing:.12em">'+
            'FEHA BODY ARMOR // '+esc(def.company.toUpperCase())+
          '</small>'+
          '<strong style="color:#eefaff;font-size:12px">'+esc(mkLabel(def.mk))+'</strong>'+
        '</div>'+
        '<p style="margin:10px 0 11px;line-height:1.45;color:#c6d7dd !important">'+
          esc(def.flavor)+
        '</p>'+
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;'+
        'padding:9px 0;border-top:1px solid #1f3239;border-bottom:1px solid #1f3239">'+
          '<div><small style="color:#8ca2ac">ARMOR CLASS</small><br><strong style="color:#fff;font-size:18px">'+def.ac+'</strong></div>'+
          '<div><small style="color:#8ca2ac">DEX CONTRIBUTION</small><br><strong style="color:#fff">'+esc(dexText(def))+'</strong></div>'+
          '<div><small style="color:#8ca2ac">WEIGHT</small><br><strong style="color:#fff">'+def.weight+' lb</strong></div>'+
          '<div><small style="color:#8ca2ac">MARKET</small><br><strong style="color:#f2d76f">€$'+Number(def.price).toLocaleString()+'</strong> <span style="color:#93aab3">// '+esc(def.availability)+'</span></div>'+
        '</div>'+
        '<div style="margin-top:10px">'+
          '<small style="display:block;color:#f0c85a;font-size:10px;font-weight:900;letter-spacing:.11em;margin-bottom:4px">'+
            esc(def.signature.name.toUpperCase())+
          '</small>'+
          '<p style="margin:0;line-height:1.5;color:#e4f0f3 !important">'+
            esc(def.signature.text)+
          '</p>'+
        '</div>'+
      '</section>'
    );
  }

  function activeEffectSpec(def) {
    const changes = [];

    if (def.company === "ForgeLine Industries") {
      changes.push(
        {
          key:"system.abilities.str.bonuses.check",
          value:String(def.signature.value),
          type:"add",
          priority:null
        },
        {
          key:"system.abilities.str.bonuses.save",
          value:String(def.signature.value),
          type:"add",
          priority:null
        }
      );
    }

    if (def.company === "Jade Arc Systems") {
      changes.push({
        key:"system.traits.dr.value",
        value:"lightning",
        type:"add",
        priority:null
      });
    }

    if (def.company === "Helix Vitae") {
      changes.push({
        key:"system.attributes.movement.walk",
        value:String(def.signature.value),
        type:"add",
        priority:null
      });
    }

    if (def.company === "Kurohane Group") {
      changes.push({
        key:"system.skills.ste.bonuses.check",
        value:String(def.signature.value),
        type:"add",
        priority:null
      });
    }

    if (!changes.length) return null;

    return {
      name:def.signature.name,
      img:null,
      type:"base",
      system:{changes},
      disabled:false,
      duration:{
        value:null,
        units:"seconds",
        expiry:null,
        expired:false
      },
      description:def.signature.text,
      origin:null,
      tint:"#ffffff",
      transfer:true,
      statuses:[],
      sort:0,
      flags:{
        [FLAG]:{
          armorSignature:true,
          armorKey:def.key,
          armorRewriteVersion:REWRITE
        }
      }
    };
  }

  async function syncEffect(item,def) {
    const existing =
      list(item.effects).filter(effect =>
        effect.flags?.[FLAG]?.armorSignature === true
      );

    const spec = activeEffectSpec(def);

    if (!spec) {
      if (existing.length) {
        await item.deleteEmbeddedDocuments(
          "ActiveEffect",
          existing.map(effect => effect.id)
        );
      }
      return;
    }

    const canonical = JSON.stringify({
      name:spec.name,
      system:spec.system,
      description:spec.description,
      transfer:spec.transfer,
      flags:spec.flags
    });

    const matches =
      existing.length === 1 &&
      JSON.stringify({
        name:existing[0].name,
        system:existing[0].system?.toObject
          ? existing[0].system.toObject()
          : existing[0].system,
        description:existing[0].description,
        transfer:existing[0].transfer,
        flags:{
          [FLAG]:existing[0].flags?.[FLAG]
        }
      }) === canonical;

    if (matches) return;

    if (existing.length) {
      await item.deleteEmbeddedDocuments(
        "ActiveEffect",
        existing.map(effect => effect.id)
      );
    }

    await item.createEmbeddedDocuments(
      "ActiveEffect",
      [spec]
    );
  }

  function rootFolder() {
    return (
      list(game.folders)
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
        "FEHA Armor could not find the '"+ROOT_NAME+"' Item folder."
      );
    }

    const folders = new Map();

    for (const company of COMPANY_ORDER) {
      let folder =
        list(game.folders).find(candidate =>
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
    if (!isArmor(item)) return false;

    const def = definition(item);
    if (!def) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};

    if (
      folderId &&
      !item.parent &&
      String(item.folder?.id ?? item.folder ?? "") !== String(folderId)
    ) {
      update.folder = folderId;
    }

    const flagValues = {
      armorKey:def.key,
      armorCatalogVersion:VERSION,
      armorRewriteVersion:REWRITE,
      manufacturer:def.company,
      company:def.company,
      sourceCategory:"Armor_Outer",
      shopType:"arms",
      bodyArmor:true,
      curatedCatalogV10:true,
      catalogEnabled:true,
      marketPass:"armor-1.1",
      marketCategory:"Armor_Outer",
      marketPrice:def.price,
      bodyArmorBaseAC:def.ac,
      bodyArmorAC:def.ac,
      effectText:def.signature.text,
      armorSignatureKey:def.signature.key,
      armorSignatureValue:def.signature.value,
      mk:def.mk,
      rating:def.mk,
      tier:def.mk,
      ratingLabel:mkLabel(def.mk),
      priceCredits:def.price,
      availability:def.availability,
      rawArmorClass:def.ac,
      dexCap:def.dexCap,
      armorWeight:def.weight
    };

    for (const [key,value] of Object.entries(flagValues)) {
      let same = false;
      try {
        same =
          JSON.stringify(flags[key] ?? null) ===
          JSON.stringify(value);
      } catch {
        same = flags[key] === value;
      }

      if (!same) {
        update["flags."+FLAG+"."+key] = value;
      }
    }

    if (Number(item.system?.armor?.value) !== def.ac) {
      update["system.armor.value"] = def.ac;
    }

    const currentDex = item.system?.armor?.dex ?? null;
    const targetDex = def.dexCap;

    if (
      JSON.stringify(currentDex) !==
      JSON.stringify(targetDex)
    ) {
      update["system.armor.dex"] = targetDex;
    }

    if (
      String(item.system?.type?.value ?? "") !==
      String(def.armorType)
    ) {
      update["system.type.value"] = def.armorType;
    }

    if (
      Number(item.system?.weight?.value ?? 0) !==
      Number(def.weight)
    ) {
      update["system.weight.value"] = Number(def.weight);
    }

    if (
      item.system?.price &&
      Number(item.system.price.value ?? 0) !==
      Number(def.price)
    ) {
      update["system.price.value"] = Number(def.price);
    }

    const description = rewriteDescription(def);

    if (
      String(item.system?.description?.value ?? "") !==
      description
    ) {
      update["system.description.value"] = description;
    }

    if (Object.keys(update).length) {
      await item.update(update);
    }

    await syncEffect(item,def);
    return Boolean(Object.keys(update).length);
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {
        worldUpdated:0,
        ownedUpdated:0,
        canonicalCount:definitions.length,
        skipped:true
      };
    }

    const {folders} = await ensureCompanyFolders();

    let worldUpdated = 0;
    let ownedUpdated = 0;

    for (const item of list(game.items)) {
      const def = definition(item);
      if (!def || !isArmor(item)) continue;

      if (
        await migrateItem(
          item,
          folders.get(def.company)?.id ?? null
        )
      ) {
        worldUpdated++;
      }
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (await migrateItem(item,null)) {
          ownedUpdated++;
        }
      }
    }

    return {
      worldUpdated,
      ownedUpdated,
      canonicalCount:definitions.length,
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
            signature:Object.freeze({...def.signature})
          })
        ])
      )
    ),
    list:() => definitions.map(def => ({
      ...def,
      signature:{...def.signature}
    })),
    definition,
    isArmor,
    rewriteDescription,
    migrateItem,
    migrateAll,
    destroy() {
      if (globalThis.FEHA_ARMOR_CATALOG === api) {
        delete globalThis.FEHA_ARMOR_CATALOG;
      }
      if (game?.adk?.armor === api) {
        delete game.adk.armor;
      }
    }
  };

  game.adk ??= {};
  game.adk.armor = api;
  globalThis.FEHA_ARMOR_CATALOG = api;

  console.log(
    "FEHA ARMOR CATALOG",
    VERSION,
    "ready //",
    definitions.length,
    "canonical armor items"
  );
})();
