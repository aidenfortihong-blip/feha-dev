// FEHA // CONSUMABLE CATALOG
// Canonical naming, company folders, simple effects, and world-sensible prices.
// This pass intentionally avoids complicated runtime mechanics.

(() => {
  const VERSION = "1.0.0";
  const REWRITE = "1.0";
  const FLAG = "fleshEnshrouded";
  const ROOT_NAME = "06 — CONSUMABLES";

  const COMPANY_ORDER = [
    "Kurohane Group",
    "Bastion Strategic",
    "Lumen Optics",
    "Vektor Dynamics",
    "Helix Vitae",
    "ForgeLine Industries",
    "Jade Arc Systems",
    "Corvus Neural"
  ];

  const AVAILABILITY_TEXT = {
    "Common":
      "Ordinary consumer product; normally available through convenience, grocery, pharmacy, or general retail channels.",
    "Professional":
      "Specialty medical, industrial, or professional-use product; available through licensed or specialist sellers.",
    "Restricted":
      "Controlled or medically regulated product; normally requires a licensed source, fixer, clinic, or restricted vendor.",
    "Black Market":
      "Illicit or tightly controlled product normally sourced through fixers or black-market sellers."
  };

  const definitions = [
    // KUROHANE GROUP
    {
      key:"kurohane-black-tea",
      legacy:"Medium Quality Drink3",
      name:"Kurohane Black Tea",
      company:"Kurohane Group",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:5,
      effectText:"For 10 minutes, gain +1 to Dexterity (Stealth) checks."
    },
    {
      key:"kurohane-night-cola",
      legacy:"Medium Quality Drink7",
      name:"Kurohane Night Cola",
      company:"Kurohane Group",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:6,
      effectText:"For 10 minutes, gain +1 to Dexterity (Stealth) checks."
    },
    {
      key:"kurohane-quiet-energy",
      legacy:"Medium Quality Drink14",
      name:"Kurohane Quiet Energy",
      company:"Kurohane Group",
      kind:"drink",
      mk:2,
      availability:"Common",
      price:9,
      effectText:"For 10 minutes, gain +2 to Dexterity (Stealth) checks."
    },

    // BASTION STRATEGIC
    {
      key:"bastion-electrolyte",
      legacy:"Medium Quality Drink10",
      name:"Bastion Electrolyte",
      company:"Bastion Strategic",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:5,
      effectText:"Gain 3 temporary HP."
    },
    {
      key:"bastion-recovery-drink",
      legacy:"Medium Quality Drink11",
      name:"Bastion Recovery Drink",
      company:"Bastion Strategic",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:8,
      effectText:"Gain 5 temporary HP."
    },
    {
      key:"bastion-trauma-booster",
      legacy:"Blackmarket Health Booster",
      name:"Bastion Trauma Booster",
      company:"Bastion Strategic",
      kind:"booster",
      mk:3,
      availability:"Professional",
      price:60,
      effectText:"Gain 12 temporary HP."
    },

    // LUMEN OPTICS
    {
      key:"lumen-focus",
      legacy:"Medium Quality Drink1",
      name:"Lumen Focus",
      company:"Lumen Optics",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:6,
      effectText:"Gain +1 to your next ranged attack roll made within 10 minutes."
    },
    {
      key:"lumen-focus-plus",
      legacy:"Medium Quality Drink12",
      name:"Lumen Focus Plus",
      company:"Lumen Optics",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:9,
      effectText:"For 2 rounds, gain +1 to ranged attack rolls."
    },
    {
      key:"lumen-clearview",
      legacy:"Medium Quality Drink13",
      name:"Lumen Clearview",
      company:"Lumen Optics",
      kind:"drink",
      mk:2,
      availability:"Professional",
      price:12,
      effectText:"Gain +2 to your next ranged attack roll made within 10 minutes."
    },

    // VEKTOR DYNAMICS
    {
      key:"vektor-balance",
      legacy:"Medium Quality Drink2",
      name:"Vektor Balance",
      company:"Vektor Dynamics",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:6,
      effectText:"Gain 2 temporary HP and +5 ft Speed for 2 rounds."
    },
    {
      key:"vektor-dual",
      legacy:"Medium Quality Drink5",
      name:"Vektor Dual",
      company:"Vektor Dynamics",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:8,
      effectText:"Gain 3 temporary HP and +5 ft Speed for 2 rounds."
    },
    {
      key:"vektor-mix",
      legacy:"Medium Quality Drink8",
      name:"Vektor Mix",
      company:"Vektor Dynamics",
      kind:"drink",
      mk:2,
      availability:"Professional",
      price:10,
      effectText:"Gain 4 temporary HP and +5 ft Speed for 2 rounds."
    },

    // HELIX VITAE
    {
      key:"helix-stamina-booster",
      legacy:"Stamina Booster",
      name:"Helix Stamina Booster",
      company:"Helix Vitae",
      kind:"booster",
      mk:1,
      availability:"Common",
      price:18,
      effectText:"Gain +10 ft Speed for 2 rounds."
    },
    {
      key:"helix-oxy-booster",
      legacy:"Oxy Booster",
      name:"Helix Oxy Booster",
      company:"Helix Vitae",
      kind:"booster",
      mk:2,
      availability:"Professional",
      price:24,
      effectText:"Gain +15 ft Speed for 2 rounds."
    },
    {
      key:"helix-health-booster",
      legacy:"Health Booster",
      name:"Helix Health Booster",
      company:"Helix Vitae",
      kind:"booster",
      mk:2,
      availability:"Professional",
      price:40,
      effectText:"Regain 2d8 + 2 HP."
    },

    // FORGELINE INDUSTRIES
    {
      key:"forgeline-load-booster",
      legacy:"Carry Capacity Booster",
      name:"ForgeLine Load Booster",
      company:"ForgeLine Industries",
      kind:"booster",
      mk:2,
      availability:"Professional",
      price:30,
      effectText:"For 10 minutes, gain +2 to Strength checks."
    },
    {
      key:"forgeline-heavy-load-booster",
      legacy:"Blackmarket Carry Capacity Booster",
      name:"ForgeLine Heavy Load Booster",
      company:"ForgeLine Industries",
      kind:"booster",
      mk:3,
      availability:"Restricted",
      price:75,
      effectText:"For 10 minutes, gain +4 to Strength checks."
    },
    {
      key:"forgeline-breacher-booster",
      legacy:"Blackmarket Stamina Booster",
      name:"ForgeLine Breacher Booster",
      company:"ForgeLine Industries",
      kind:"booster",
      mk:2,
      availability:"Professional",
      price:45,
      effectText:"For 10 minutes, gain +4 to Strength checks made to force, lift, bend, or break objects."
    },

    // JADE ARC SYSTEMS
    {
      key:"jade-arc-ion-water",
      legacy:"Medium Quality Drink4",
      name:"Jade Arc Ion Water",
      company:"Jade Arc Systems",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:5,
      effectText:"Gain +1 to your next saving throw against an EMP or lightning effect made within 1 hour."
    },
    {
      key:"jade-arc-grounding-tonic",
      legacy:"Medium Quality Drink6",
      name:"Jade Arc Grounding Tonic",
      company:"Jade Arc Systems",
      kind:"drink",
      mk:1,
      availability:"Common",
      price:8,
      effectText:"Gain +2 to your next saving throw against an EMP or lightning effect made within 1 hour."
    },
    {
      key:"jade-arc-coolant-mix",
      legacy:"Medium Quality Drink9",
      name:"Jade Arc Coolant Mix",
      company:"Jade Arc Systems",
      kind:"drink",
      mk:2,
      availability:"Professional",
      price:10,
      effectText:"Gain resistance to lightning damage until the end of your next turn."
    },

    // CORVUS NEURAL
    {
      key:"corvus-memory-booster",
      legacy:"Memory Booster",
      name:"Corvus Memory Booster",
      company:"Corvus Neural",
      kind:"booster",
      mk:2,
      availability:"Professional",
      price:45,
      effectText:"Restore 2 RAM."
    },
    {
      key:"corvus-black-memory-booster",
      legacy:"Blackmarket Memory Booster",
      name:"Corvus Black Memory Booster",
      company:"Corvus Neural",
      kind:"booster",
      mk:3,
      availability:"Restricted",
      price:110,
      effectText:"Restore 4 RAM."
    },
    {
      key:"corvus-neural-adaptation-kit",
      legacy:"CW Capacity Perma Reward",
      name:"Corvus Neural Adaptation Kit",
      company:"Corvus Neural",
      kind:"medical kit",
      mk:4,
      availability:"Restricted",
      price:2500,
      effectText:"Consume permanently: increase maximum Cyberware Capacity by 1."
    }
  ];

  const byLegacy = new Map();
  const byCurrent = new Map();

  const normalize = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const slug = value => normalize(value).replace(/\s+/g,"-");

  for (const def of definitions) {
    byLegacy.set(normalize(def.legacy),def);
    byCurrent.set(normalize(def.name),def);
    byCurrent.set(normalize(def.key),def);
  }

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
        byCurrent.get(normalize(value)) ??
        byLegacy.get(normalize(value)) ??
        null
      );
    }

    const flags = value.flags?.[FLAG] ?? {};

    const candidates = [
      flags.consumableKey,
      value.name,
      flags.originalLibraryName,
      value.system?.identifier
    ];

    for (const candidate of candidates) {
      const key = normalize(candidate);

      if (byCurrent.has(key)) {
        return byCurrent.get(key);
      }

      if (byLegacy.has(key)) {
        return byLegacy.get(key);
      }
    }

    return null;
  }

  function looksLikeConsumable(item) {
    if (!item || item.documentName !== "Item") return false;

    const flags = item.flags?.[FLAG] ?? {};
    const category =
      normalize(flags.sourceCategory ?? flags.category);

    return Boolean(
      definition(item) &&
      (
        item.type === "consumable" ||
        category === "consumables" ||
        /\/consumables\//i.test(String(flags.sourcePath ?? ""))
      )
    );
  }

  function mkLabel(mk) {
    return "Mk." + ["0","I","II","III","IV","V"][
      Math.max(0,Math.min(5,Number(mk) || 0))
    ];
  }

  function rewriteDescription(def) {
    return (
      '<section data-feha-consumable-card="'+REWRITE+'" '+
      'style="border:1px solid #33424a;background:#081015;padding:12px 14px;color:#dce8ec !important">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;'+
        'padding-bottom:9px;border-bottom:1px solid #263941">'+
          '<small style="color:#f0c85a;font-size:10px;font-weight:900;letter-spacing:.12em">'+
            esc(def.company.toUpperCase())+' // CONSUMABLE'+
          '</small>'+
          '<strong style="color:#eefaff;font-size:12px">'+
            esc(mkLabel(def.mk))+
          '</strong>'+
        '</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 12px;align-items:center;color:#9fb3bc !important">'+
          '<span style="font-size:12px;color:#eefaff !important"><strong>'+esc(String(def.kind).toUpperCase())+'</strong></span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#aebfc6 !important">'+esc(def.availability)+'</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#f2d76f;font-weight:900">€$'+Number(def.price).toLocaleString()+'</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#7ee6ff !important;font-weight:900">BONUS ACTION IN COMBAT</span>'+
          '<span style="color:#516872">•</span>'+
          '<span style="font-size:12px;color:#aebfc6 !important">1 USE</span>'+
        '</div>'+
        '<div style="color:#dce8ec !important">'+
          '<small style="display:block;color:#8ca2ac !important;font-size:10px;font-weight:900;'+
          'letter-spacing:.11em;margin-bottom:5px">EFFECT</small>'+
          '<p style="margin:0;line-height:1.55;color:#dce8ec !important">'+esc(def.effectText)+'</p>'+
        '</div>'+
      '</section>'
    );
  }

  function availabilityText(def) {
    return AVAILABILITY_TEXT[def.availability] ?? "";
  }

  function rootFolder() {
    return (
      list(game.folders)
        .filter(folder =>
          String(folder?.type ?? "") === "Item" &&
          String(folder?.name ?? "") === ROOT_NAME
        )
        .sort((a,b) => {
          const aTop = a?.folder?.name === "ADK V10 — CURATED CATALOG" ? 0 : 1;
          const bTop = b?.folder?.name === "ADK V10 — CURATED CATALOG" ? 0 : 1;
          return aTop - bTop;
        })[0] ??
      null
    );
  }

  async function ensureCompanyFolders() {
    const root = rootFolder();

    if (!root) {
      throw new Error(
        "FEHA Consumables could not find the '"+ROOT_NAME+"' Item folder."
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

    return {
      root,
      folders
    };
  }

  function updateData(item,def,folderId=null) {
    const flags = item.flags?.[FLAG] ?? {};
    const system = item.system ?? {};
    const update = {};
    const rating = mkLabel(def.mk);
    const description = rewriteDescription(def);

    if (String(item.name ?? "") !== def.name) {
      update.name = def.name;
    }

    if (folderId && !item.parent) {
      const currentFolder =
        String(item.folder?.id ?? item.folder ?? "");

      if (currentFolder !== String(folderId)) {
        update.folder = folderId;
      }
    }

    const flagValues = {
      consumableKey:def.key,
      consumableCatalogVersion:VERSION,
      consumableRewriteVersion:REWRITE,
      manufacturer:def.company,
      company:def.company,
      sourceCategory:"Consumables",
      effectText:def.effectText,
      mk:def.mk,
      rating:def.mk,
      tier:def.mk,
      ratingLabel:rating,
      priceCredits:def.price,
      availability:def.availability,
      availabilityText:availabilityText(def),
      catalogEnabled:true,
      actionType:"bonus",
      bonusAction:true
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

    if (
      String(system?.description?.value ?? "") !==
      description
    ) {
      update["system.description.value"] = description;
    }

    if (
      system?.price &&
      Number(system.price.value ?? 0) !== Number(def.price)
    ) {
      update["system.price.value"] = Number(def.price);
    }

    if (
      system?.price &&
      String(system.price.denomination ?? "") !== "gp"
    ) {
      update["system.price.denomination"] = "gp";
    }

    if (
      String(system?.identifier ?? "") !==
      slug(def.name)
    ) {
      update["system.identifier"] = slug(def.name);
    }

    if (
      system?.uses &&
      String(system.uses.max ?? "") !== "1"
    ) {
      update["system.uses.max"] = "1";
    }

    if (
      system?.uses &&
      Number(system.uses.spent ?? 0) !== 0
    ) {
      update["system.uses.spent"] = 0;
    }

    if (
      system?.activation &&
      String(system.activation.type ?? "") !== "bonus"
    ) {
      update["system.activation.type"] = "bonus";

      if (
        Object.prototype.hasOwnProperty.call(
          system.activation,
          "cost"
        )
      ) {
        update["system.activation.cost"] = 1;
      }
    }

    return update;
  }

  async function migrateItem(item,folderId=null) {
    if (!looksLikeConsumable(item)) return false;

    const def = definition(item);
    if (!def) return false;

    const update =
      updateData(
        item,
        def,
        folderId
      );

    if (!Object.keys(update).length) return false;

    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) {
      return {
        worldUpdated:0,
        ownedUpdated:0,
        foldersCreated:0,
        skipped:true
      };
    }

    const beforeIds =
      new Set(
        list(game.folders)
          .filter(folder =>
            String(folder?.type ?? "") === "Item" &&
            COMPANY_ORDER.includes(
              String(folder?.name ?? "")
            ) &&
            String(folder?.folder?.name ?? "") === ROOT_NAME
          )
          .map(folder => String(folder.id))
      );

    const {folders} =
      await ensureCompanyFolders();

    let worldUpdated = 0;
    let ownedUpdated = 0;

    for (const item of list(game.items)) {
      const def = definition(item);
      if (!def || !looksLikeConsumable(item)) continue;

      const folderId =
        folders.get(def.company)?.id ??
        null;

      if (
        await migrateItem(
          item,
          folderId
        )
      ) {
        worldUpdated++;
      }
    }

    for (const actor of list(game.actors)) {
      for (const item of list(actor.items)) {
        if (
          await migrateItem(
            item,
            null
          )
        ) {
          ownedUpdated++;
        }
      }
    }

    const afterIds =
      new Set(
        list(game.folders)
          .filter(folder =>
            String(folder?.type ?? "") === "Item" &&
            COMPANY_ORDER.includes(
              String(folder?.name ?? "")
            ) &&
            String(folder?.folder?.name ?? "") === ROOT_NAME
          )
          .map(folder => String(folder.id))
      );

    const foldersCreated =
      [...afterIds].filter(id => !beforeIds.has(id)).length;

    return {
      worldUpdated,
      ownedUpdated,
      foldersCreated,
      canonicalCount:definitions.length
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
          Object.freeze({...def})
        ])
      )
    ),
    list:() => definitions.map(def => ({...def})),
    definition,
    migrateItem,
    migrateAll,
    rewriteDescription
  };

  game.adk ??= {};
  game.adk.consumables = api;
  globalThis.FEHA_CONSUMABLE_CATALOG = api;

  console.log(
    "FEHA CONSUMABLE CATALOG",
    VERSION,
    "ready //",
    definitions.length,
    "products"
  );
})();
