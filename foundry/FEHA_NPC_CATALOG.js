// FEHA // NPC CATALOG
// Ready-made people of Alabastra, built from the items already in the world:
// weapons, armour, chrome, quickhacks, grenades and consumables come from the
// curated catalogs, so an NPC's gear behaves exactly like a player's.
//
// Nothing is created until the GM asks: the Actors tab gets an
// IMPORT FEHA NPCS button (or call game.adk.npcs.import()). Import is
// repeatable; an NPC that already exists is left alone unless it is rebuilt
// on purpose.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_NPC_CATALOG requires FEHA_CYBER_CORE.");
  }

  const VERSION = "1.0.1";
  const FLAG = "fleshEnshrouded";
  const ROOT_FOLDER = "FEHA NPCS";
  const TOKEN_IMG = "icons/svg/mystery-man.svg";
  const BUTTON_CLASS = "feha-npc-import";

  // Combat tiers, set against this world's numbers (a hit is 20-60 damage,
  // player characters have 22-30 HP at level 2-3).
  //   0 bystander   1 street-level   2 trained   3 elite   4 boss
  const TIERS = {
    0:{hp:9,ac:10,cr:0,charge:0},
    1:{hp:22,ac:13,cr:0.5,charge:4},
    2:{hp:42,ac:15,cr:3,charge:6},
    3:{hp:75,ac:17,cr:6,charge:9},
    4:{hp:135,ac:19,cr:10,charge:14}
  };

  const STREET = "Street";
  const YAKUZA = "Yakuza";
  const CIVCORP = "CivCorp";
  const VIGIL = "Marble Vigil";
  const CORP = "Corporate";
  const NAVY = "Navy";
  const CIVILIAN = "Civilians";

  // Weapon picks are selectors, not names, so they survive catalog changes:
  //   w("Pistol",2)                    any pistol up to market band 2
  //   w("Katana",3,"Kurohane Group")   restricted to one maker
  const w = (cls,band,maker=null) => ({cls,band,maker});

  const ab = (str,dex,con,int,wis,cha) => ({str,dex,con,int,wis,cha});

  // key, name, faction, tier, abilities, gear, text
  const DEFINITIONS = [
    // ---- Street -------------------------------------------------------------
    {
      key:"street-thug",name:"Street Thug",faction:STREET,tier:1,
      abilities:ab(14,12,13,9,10,10),
      weapons:[w("Blunt",1),w("Knife",1)],
      bio:"New Niemir muscle who gets paid in favours. Fights up close and runs when the odds turn.",
      tactics:"Closes to melee, gangs up on one target, breaks at half strength."
    },
    {
      key:"street-gunner",name:"Street Gunner",faction:STREET,tier:1,
      abilities:ab(11,14,12,10,11,10),
      weapons:[w("Pistol",2),w("Knife",1)],armor:"Ghostweave Suit Mk.I",
      bio:"A corner shooter with a cheap piece and something to prove.",
      tactics:"Shoots from cover and will not cross open ground."
    },
    {
      key:"street-chromehead",name:"Chromehead",faction:STREET,tier:2,
      abilities:ab(16,14,15,9,10,9),
      weapons:[w("Machete",2),w("Pistol",2)],armor:"Living Dermal Suit Mk.I",
      chrome:["Mantis Blades","Berserk C1","Dense Marrow"],
      bio:"Back-alley chrome stacked on a body that was not built for it. Twitchy, loud and proud of the blades.",
      tactics:"Fires Berserk on the first turn and leaps at the nearest shooter."
    },
    {
      key:"street-netrunner",name:"Street Netrunner",faction:STREET,tier:2,hp:30,
      abilities:ab(9,14,11,16,12,11),
      weapons:[w("Pistol",2)],armor:"Ghostweave Suit Mk.I",
      chrome:["Corvus Paraline","Ram Upgrade"],
      quickhacks:["Optic Zero","Chrome Lock","Dead Air"],
      bio:"Self-taught off pirated seminars and a second-hand deck. Works for whoever fronts the hardware.",
      tactics:"Stays out of sight, blinds the best shooter, then locks chrome."
    },
    {
      key:"street-fixer",name:"Fixer",faction:STREET,tier:2,hp:36,
      abilities:ab(10,13,12,14,14,16),
      weapons:[w("Heavy Pistol",2)],armor:"Ghostweave Suit Mk.II",
      chrome:["Kiroshi Optics","Mask CW"],
      consumables:["Helix Health Booster"],
      bio:"Knows a ripperdoc, a lawyer and a way out of the district. Sells all three.",
      tactics:"Talks first. If it turns, one shot and gone; the bodyguards do the fighting."
    },

    // ---- Yakuza -------------------------------------------------------------
    {
      key:"yakuza-kobun",name:"Yakuza Kobun",faction:YAKUZA,tier:1,hp:26,
      abilities:ab(13,14,12,10,11,10),
      weapons:[w("Katana",2,"Kurohane Group"),w("Pistol",2,"Kurohane Group")],
      armor:"Ghostweave Suit Mk.I",
      bio:"A junior soldier in a good suit. Loyal, tattooed and eager to be noticed.",
      tactics:"Fights in pairs and never leaves a senior member's side."
    },
    {
      key:"yakuza-enforcer",name:"Yakuza Enforcer",faction:YAKUZA,tier:2,
      abilities:ab(16,12,15,10,11,11),
      weapons:[w("Shotgun",3),w("Knife",1)],armor:"Flexweave Mobility Suit Mk.II",
      chrome:["Subdermal Plating","Reinforced Muscles"],
      bio:"Collects debts and breaks doors. The plating under the skin has turned more than one blade.",
      tactics:"Holds the doorway and makes the party come through the shotgun."
    },
    {
      key:"yakuza-blade",name:"Yakuza Blade",faction:YAKUZA,tier:3,
      abilities:ab(14,18,14,11,13,11),
      weapons:[w("Katana",3,"Kurohane Group"),w("Pistol",3,"Kurohane Group")],
      armor:"Ghostweave Suit Mk.III",
      chrome:["Kerenzikov","Kiroshi Optics","Catch Me If You Can"],
      bio:"The clan's duelist. Quiet, patient, and faster than the eye says is possible.",
      tactics:"Picks one opponent and stays on them. Saves Kerenzikov for the hit that would matter."
    },
    {
      key:"yakuza-wakagashira",name:"Yakuza Wakagashira",faction:YAKUZA,tier:4,
      abilities:ab(15,18,16,13,14,16),
      weapons:[w("Katana",3,"Kurohane Group"),w("Heavy Pistol",4)],
      armor:"Ghostweave Suit Mk.IV",
      chrome:["Sandevistan C2","Subdermal Skin Lattice","Kiroshi Optics Hunter","Second Heart"],
      consumables:["Helix Health Booster"],
      bio:"The oyabun's first lieutenant. Runs the HQ, settles disputes personally, and has a second heart for the day it goes wrong.",
      tactics:"Opens with the Sandevistan to cut down the biggest threat, then duels. Second Heart brings him back once."
    },

    // ---- CivCorp ------------------------------------------------------------
    {
      key:"civcorp-peacekeeper",name:"CivCorp Peacekeeper",faction:CIVCORP,tier:1,hp:26,ac:14,
      abilities:ab(13,12,13,10,11,10),
      weapons:[w("Baton",1),w("Pistol",2,"Bastion Strategic")],
      armor:"Interface Security Suit Mk.I",
      bio:"Contract police on a quota. Paid per arrest, so everyone looks like a suspect.",
      tactics:"Tries to arrest first. Calls for backup the moment a weapon comes out."
    },
    {
      key:"civcorp-rifleman",name:"CivCorp Rifleman",faction:CIVCORP,tier:2,
      abilities:ab(13,15,14,10,12,10),
      weapons:[w("Assault Rifle",3),w("Pistol",2)],armor:"Interface Security Suit Mk.II",
      grenades:[["Grenade Frag Regular Mk.I",1]],
      bio:"The response team that arrives after the peacekeepers call it in.",
      tactics:"Takes cover at range, suppresses, and throws the frag at anyone bunched up."
    },
    {
      key:"civcorp-riot",name:"CivCorp Riot Enforcer",faction:CIVCORP,tier:2,hp:50,ac:16,
      abilities:ab(16,11,16,9,11,9),
      weapons:[w("Shotgun",3,"Bastion Strategic"),w("Baton",2)],
      armor:"Bastion Combat Plate Mk.II",
      grenades:[["Grenade Flash Regular Mk.I",1],["Grenade Smoke Regular Mk.I",1]],
      bio:"Crowd control in full plate. Used on strikes, vigils and anything that looks like organising.",
      tactics:"Flash first, then walks forward behind the plate."
    },
    {
      key:"civcorp-netrunner",name:"CivCorp Netrunner",faction:CIVCORP,tier:2,hp:32,
      abilities:ab(9,13,12,17,13,10),
      weapons:[w("SMG",3)],armor:"Interface Security Suit Mk.II",
      chrome:["Corvus Netdriver","Self Ice","Ram Upgrade"],
      quickhacks:["Optic Zero","Chrome Lock","Motor Lock","Wiretap","Dead Trigger"],
      bio:"Sits in the van and listens. Every arrest record in the district has passed through this deck.",
      tactics:"Never the first one seen. Breaks the party's guns and legs while the riflemen work."
    },
    {
      key:"civcorp-warden",name:"CivCorp Warden",faction:CIVCORP,tier:3,
      abilities:ab(16,13,16,12,14,13),
      weapons:[w("Heavy Pistol",3),w("Baton",2)],armor:"Bastion Combat Plate Mk.III",
      chrome:["Reflex Recorder","Pain Reductor","Kiroshi Optics"],
      consumables:["Bastion Trauma Booster"],
      bio:"Runs a private detention block where every occupied bed is revenue. Knows each prisoner by number.",
      tactics:"Locks down the block and fights from behind the guards. Does not surrender the facility."
    },

    // ---- Marble Vigil -------------------------------------------------------
    {
      key:"vigil-operative",name:"Marble Vigil Operative",faction:VIGIL,tier:3,
      abilities:ab(14,18,15,13,14,11),
      weapons:[w("SMG",4),w("Pistol",3)],armor:"Flexweave Mobility Suit Mk.III",
      chrome:["Sandevistan C1","Kiroshi Optics","Synaptic Accelerator"],
      grenades:[["Grenade Flash Regular Mk.II",1]],
      bio:"National security, now under CivCorp contract. They do not make arrests.",
      tactics:"Acts first, uses the Sandevistan to reach a flank, and never fights fair."
    },
    {
      key:"vigil-marksman",name:"Marble Vigil Marksman",faction:VIGIL,tier:3,hp:60,
      abilities:ab(12,19,14,13,16,10),
      weapons:[w("Sniper Rifle",4),w("Pistol",3)],armor:"Ghostweave Suit Mk.III",
      chrome:["Optical Camo","Kiroshi Optics Hunter"],
      bio:"The Vigil's overwatch. Most targets never learn there was a second team.",
      tactics:"Sets up far away, goes invisible when found, relocates rather than trading shots."
    },
    {
      key:"vigil-breacher",name:"Marble Vigil Breacher",faction:VIGIL,tier:3,hp:90,ac:18,
      abilities:ab(18,13,17,10,12,10),
      weapons:[w("Shotgun",4),w("Heavy Blunt",3)],armor:"Bastion Combat Plate Mk.III",
      chrome:["Berserk C2","Subdermal Plating","Strong Arms"],
      grenades:[["Grenade Frag Regular Mk.II",1]],
      bio:"First through the door on every raid. The gorilla arms open most of them without a charge.",
      tactics:"Frag, then Berserk, then straight through the middle."
    },
    {
      key:"vigil-captain",name:"Marble Vigil Captain",faction:VIGIL,tier:4,
      abilities:ab(16,18,17,15,16,15),
      weapons:[w("Assault Rifle",4),w("Katana",3)],armor:"Fire-Control Harness Mk.IV",
      chrome:["Sandevistan C3","Subdermal Skin Lattice","Kiroshi Optics Combined","Second Heart","Bio Conductors"],
      consumables:["Helix Health Booster","Bastion Trauma Booster"],
      grenades:[["Grenade EMP Sticky Mk.II",1]],
      bio:"A veteran of the Vargas years who kept the job through every change of government. Answers to the Council, in theory.",
      tactics:"Commands from cover until a gap opens, then stops time and ends it. Retreats if the mission is lost."
    },

    // ---- Corporate ----------------------------------------------------------
    {
      key:"kurohane-guard",name:"Kurohane Security",faction:CORP,tier:2,
      abilities:ab(13,15,13,11,12,11),
      weapons:[w("Assault Rifle",3,"Kurohane Group"),w("Pistol",2,"Kurohane Group")],
      armor:"Interface Security Suit Mk.II",
      bio:"Uniformed corporate security. Polite until the badge scan fails.",
      tactics:"Holds a post. Will not pursue off Kurohane property."
    },
    {
      key:"kurohane-agent",name:"Kurohane Agent",faction:CORP,tier:3,
      abilities:ab(13,18,14,15,14,15),
      weapons:[w("SMG",3,"Kurohane Group"),w("Katana",2,"Kurohane Group")],
      armor:"Ghostweave Suit Mk.III",
      chrome:["Optical Camo","Kerenzikov","Kurohane Shadow","Kiroshi Optics"],
      bio:"A problem solver from the Group's internal affairs office. Arrives quietly and leaves no report.",
      tactics:"Starts invisible, takes the first shot with advantage, then closes with the blade."
    },
    {
      key:"bastion-heavy",name:"Bastion Heavy",faction:CORP,tier:3,hp:95,ac:19,
      abilities:ab(18,11,18,10,12,9),
      weapons:[w("LMG",4),w("Heavy Pistol",3,"Bastion Strategic")],
      armor:"Bastion Combat Plate Mk.IV",
      chrome:["Gun Stabilizer","Pain Reductor","Subdermal Plating"],
      bio:"A contract gunner in the heaviest plate Bastion sells. Slow, and does not need to be fast.",
      tactics:"Sets up, braces, and denies a whole corridor. Vulnerable if flanked."
    },
    {
      key:"corvus-netrunner",name:"Corvus Netrunner",faction:CORP,tier:3,hp:55,
      abilities:ab(9,14,13,19,15,12),
      weapons:[w("SMG",3,"Corvus Neural")],armor:"Interface Security Suit Mk.III",
      chrome:["Raven Microcyber","Self Ice","Ex Disk","Cogito Frame"],
      quickhacks:["Synapse Burn","System Collapse","Optic Zero","Chrome Lock","Combustion","Rollback"],
      consumables:["Corvus Black Memory Booster"],
      bio:"Corvus Neural's in-house intrusion specialist. Treats a firefight as a debugging session.",
      tactics:"Burns the party's own netrunner first, then collapses whoever is dealing the most damage."
    },
    {
      key:"helix-medtech",name:"Helix Medtech",faction:CORP,tier:2,hp:34,
      abilities:ab(10,13,13,15,16,12),
      weapons:[w("Pistol",2,"Helix Vitae")],armor:"Living Dermal Suit Mk.II",
      chrome:["Blood Pump","Biomonitor","Kiroshi Optics"],
      consumables:["Helix Health Booster","Helix Health Booster","Helix Oxy Booster"],
      bio:"A trauma technician on a Helix Vitae retainer. Treats whoever holds the contract.",
      tactics:"Keeps the others standing. Surrenders if left alone."
    },

    // ---- Navy ---------------------------------------------------------------
    {
      key:"navy-rating",name:"Navy Rating",faction:NAVY,tier:1,hp:24,ac:14,
      abilities:ab(13,13,13,10,11,10),
      weapons:[w("Pistol",2),w("Baton",1)],armor:"Rivet Work Armor Mk.I",
      bio:"A sailor of the harbour fleet. More loyal to the Admiral than to any corporation.",
      tactics:"Follows orders. Fights as a crew, never alone."
    },
    {
      key:"navy-marine",name:"Navy Marine",faction:NAVY,tier:2,hp:46,
      abilities:ab(15,14,15,10,12,10),
      weapons:[w("Assault Rifle",3),w("Knife",1)],armor:"Rivet Work Armor Mk.II",
      grenades:[["Grenade Frag Regular Mk.I",1]],
      bio:"Boarding party. Trained to fight in corridors too narrow to miss in.",
      tactics:"Advances in a stack and clears room by room."
    },

    // ---- Civilians ----------------------------------------------------------
    {
      key:"civilian",name:"Alabastra Civilian",faction:CIVILIAN,tier:0,hostile:false,
      abilities:ab(10,10,10,10,10,10),
      bio:"Works two jobs, owes on the Cinder allocation, and would rather not be a witness.",
      tactics:"Runs. Will talk to CivCorp afterwards if frightened enough."
    },
    {
      key:"shopkeeper",name:"Shopkeeper",faction:CIVILIAN,tier:0,hp:14,ac:11,hostile:false,
      abilities:ab(11,10,12,11,13,12),
      weapons:[w("Shotgun Pistol",3)],
      bio:"Keeps something under the counter. Has used it before and did not enjoy it.",
      tactics:"Warns once. Fires once. Then hides."
    },
    {
      key:"organizer",name:"Community Organizer",faction:CIVILIAN,tier:1,hp:18,ac:11,hostile:false,
      abilities:ab(10,11,12,13,14,16),
      weapons:[w("Knife",1)],
      bio:"Runs legal aid clinics and watch lists out of a back room. Striking is illegal, so officially this is a book club.",
      tactics:"Does not fight. Gets people out the back while someone else buys time."
    },
    {
      key:"ripperdoc",name:"Ripperdoc",faction:CIVILIAN,tier:1,hp:20,ac:12,hostile:false,
      abilities:ab(10,14,12,16,13,11),
      weapons:[w("Knife",1)],
      chrome:["Kiroshi Optics","Biomonitor"],
      consumables:["Helix Health Booster","Helix Health Booster"],
      bio:"Unlicensed, underpaid, and the only clinic most of New Niemir can afford.",
      tactics:"Neutral ground. Whoever starts shooting in the clinic loses a ripperdoc."
    }
  ];

  const hooks = [];

  const flags = doc => doc?.flags?.[FLAG] ?? {};
  const esc = value => foundry.utils.escapeHTML(String(value ?? ""));

  function list(collection) {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  }

  // Stable pick, so the same NPC always gets the same gun.
  function hash(text) {
    let value = 0;
    for (const char of String(text)) {
      value = (value * 31 + char.charCodeAt(0)) >>> 0;
    }
    return value;
  }

  // Names repeat across catalogs (there is an "Optic Zero" quickhack and an
  // "Optic Zero" gun), so a lookup always names the catalog it wants.
  function worldItem(name,category) {
    return list(game.items).find(item =>
      item.name === name &&
      flags(item).sourceCategory === category
    ) ?? null;
  }

  function pickWeapon(selector,seed) {
    const candidates = list(game.items)
      .filter(item => {
        const f = flags(item);
        return (
          item.type === "weapon" &&
          f.weaponClass === selector.cls &&
          Number(f.marketBand ?? 1) <= selector.band &&
          // Signature and joke weapons stay out of rank-and-file hands.
          !/^unique/i.test(String(f.manufacturer ?? "")) &&
          f.uniqueWeapon !== true &&
          Number(f.marketBand ?? 1) < 5 &&
          (!selector.maker || f.manufacturer === selector.maker)
        );
      })
      .sort((a,b) => a.name.localeCompare(b.name));

    if (!candidates.length) return null;

    // Prefer the best band allowed, then pick among those.
    const top = Math.max(...candidates.map(item => Number(flags(item).marketBand ?? 1)));
    const best = candidates.filter(item => Number(flags(item).marketBand ?? 1) === top);

    return best[hash(seed) % best.length];
  }

  function capacityCost(item) {
    const f = flags(item);
    const rating = Math.max(1,Math.min(5,Number(f.rating ?? f.tier ?? 2) || 2));
    return rating + (["Operating System","Arms"].includes(f.cyberwareSlot) ? 1 : 0);
  }

  // Everything an NPC carries, as item data ready to embed. Missing world
  // items are reported, never guessed.
  function buildItems(def) {
    const items = [];
    const missing = [];

    const push = (source,mutate) => {
      const data = source.toObject();
      delete data._id;
      data.folder = null;
      mutate?.(data);
      items.push(data);
    };

    (def.weapons ?? []).forEach((selector,index) => {
      const weapon = pickWeapon(selector,def.key+":"+index);

      if (!weapon) {
        missing.push(selector.cls+" (band "+selector.band+")");
        return;
      }

      push(weapon,data => { data.system.equipped = true; });
    });

    if (def.armor) {
      const armor = worldItem(def.armor,"Armor_Outer");
      if (armor) push(armor,data => { data.system.equipped = true; });
      else missing.push(def.armor);
    }

    for (const name of def.chrome ?? []) {
      const chrome = worldItem(name,"Cyberware");

      if (!chrome) {
        missing.push(name);
        continue;
      }

      push(chrome,data => {
        Object.assign(data.flags[FLAG],{
          installed:true,
          isInstalled:true,
          marketPurchased:true
        });
        if ("equipped" in (data.system ?? {})) data.system.equipped = true;
      });
    }

    for (const name of def.quickhacks ?? []) {
      const hack = worldItem(name,"Quickhacks");

      if (!hack) {
        missing.push(name);
        continue;
      }

      push(hack,data => { data.flags[FLAG].loadedQuickhack = true; });
    }

    for (const [name,quantity] of def.grenades ?? []) {
      const grenade = worldItem(name,"Grenades");
      if (grenade) push(grenade,data => { data.system.quantity = quantity; });
      else missing.push(name);
    }

    for (const name of def.consumables ?? []) {
      const consumable = worldItem(name,"Consumables");
      if (consumable) push(consumable);
      else missing.push(name);
    }

    return {items,missing};
  }

  function biography(def) {
    return (
      "<p>"+esc(def.bio)+"</p>"+
      "<p><strong>Tactics.</strong> "+esc(def.tactics)+"</p>"
    );
  }

  function actorData(def,folderId,items) {
    const tier = TIERS[def.tier];
    const hp = def.hp ?? tier.hp;
    const con = Math.floor((def.abilities.con - 10) / 2);

    // Charge is unused cyberware capacity (FEHA_CYBERWARE_RUNTIME). NPCs have
    // no level, so the bonus is set to leave them the tier's charge pool.
    const used = items
      .filter(item => item.flags?.[FLAG]?.installed === true)
      .reduce((total,item) => total + capacityCost(item),0);

    const capacityBonus = used ? used + tier.charge - 12 - con : 0;
    const hostile = def.hostile !== false;

    return {
      name:def.name,
      type:"npc",
      img:TOKEN_IMG,
      folder:folderId,
      system:{
        abilities:Object.fromEntries(
          Object.entries(def.abilities).map(([key,value]) => [key,{value}])
        ),
        attributes:{
          hp:{value:hp,max:hp},
          ac:{calc:"flat",flat:def.ac ?? tier.ac},
          movement:{walk:30,units:"ft"}
        },
        details:{
          cr:tier.cr,
          type:{value:"humanoid"},
          biography:{value:biography(def)}
        }
      },
      prototypeToken:{
        name:def.name,
        actorLink:false,
        appendNumber:true,
        disposition:hostile
          ? CONST.TOKEN_DISPOSITIONS.HOSTILE
          : CONST.TOKEN_DISPOSITIONS.NEUTRAL,
        displayName:CONST.TOKEN_DISPLAY_MODES.HOVER,
        displayBars:CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        bar1:{attribute:"attributes.hp"},
        sight:{enabled:true,range:60},
        texture:{src:TOKEN_IMG}
      },
      flags:{
        [FLAG]:{
          npcKey:def.key,
          npcCatalogVersion:VERSION,
          npcFaction:def.faction,
          npcTier:def.tier,
          cyberwareCapacityBonus:capacityBonus
        }
      },
      items
    };
  }

  async function ensureFolder(name,parentId=null) {
    const existing = list(game.folders).find(folder =>
      folder.type === "Actor" &&
      folder.name === name &&
      String(folder.folder?.id ?? "") === String(parentId ?? "")
    );

    return existing ?? Folder.create({
      name,
      type:"Actor",
      folder:parentId,
      sorting:"a"
    });
  }

  function existing(def) {
    return list(game.actors).find(actor =>
      flags(actor).npcKey === def.key
    ) ?? null;
  }

  // Create every catalog NPC that does not exist yet. With rebuild:true an
  // existing catalog NPC has its gear replaced from the catalog (anything the
  // GM added to it by hand is lost), which is how a catalog fix reaches NPCs
  // that were already imported.
  async function importAll({keys=null,rebuild=false}={}) {
    if (!game.user?.isGM) {
      throw new Error("Only the GM can import NPCs.");
    }

    const wanted = DEFINITIONS.filter(def => !keys || keys.includes(def.key));
    const root = await ensureFolder(ROOT_FOLDER);
    const folders = new Map();
    const created = [];
    const skipped = [];
    const rebuilt = [];
    const missing = {};

    for (const def of wanted) {
      const current = existing(def);

      if (current && !rebuild) {
        skipped.push(def.name);
        continue;
      }

      if (current) {
        const built = buildItems(def);
        if (built.missing.length) missing[def.name] = built.missing;

        await current.deleteEmbeddedDocuments(
          "Item",
          list(current.items).map(item => item.id)
        );
        await current.createEmbeddedDocuments("Item",built.items);
        await current.update({
          ["flags."+FLAG+".cyberwareCapacityBonus"]:
            actorData(def,null,built.items).flags[FLAG].cyberwareCapacityBonus,
          ["flags."+FLAG+".npcCatalogVersion"]:VERSION
        });
        await core.module("cyberwareRuntime")?.syncActor?.(current);

        rebuilt.push(def.name);
        continue;
      }

      if (!folders.has(def.faction)) {
        folders.set(def.faction,await ensureFolder(def.faction,root.id));
      }

      const built = buildItems(def);
      if (built.missing.length) missing[def.name] = built.missing;

      const actor = await Actor.create(
        actorData(def,folders.get(def.faction).id,built.items),
        {renderSheet:false}
      );

      // Passive chrome bonuses (FEHA_CYBERWARE_RUNTIME).
      await core.module("cyberwareRuntime")?.syncActor?.(actor);

      created.push(def.name);
    }

    const result = {created,rebuilt,skipped,missing,version:VERSION};
    console.log("FEHA NPC CATALOG",result);
    return result;
  }

  async function openImportDialog() {
    if (!game.user?.isGM) return null;

    const todo = DEFINITIONS.filter(def => !existing(def));

    if (!todo.length) {
      ui.notifications?.info?.(
        "All "+DEFINITIONS.length+" FEHA NPCs are already in the Actors tab, under "+ROOT_FOLDER+"."
      );
      return null;
    }

    const byFaction = {};
    for (const def of todo) {
      (byFaction[def.faction] ??= []).push(def.name);
    }

    const rows = Object.entries(byFaction)
      .map(([faction,names]) =>
        "<p><strong>"+esc(faction)+"</strong><br>"+names.map(esc).join(", ")+"</p>"
      )
      .join("");

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:{title:"Import FEHA NPCs"},
      content:
        "<p>Create "+todo.length+" NPCs in the Actors tab, in a folder called "+
        esc(ROOT_FOLDER)+"? Drag one onto a map to use it.</p>"+rows,
      rejectClose:false
    });

    if (!confirmed) return null;

    try {
      const result = await importAll();
      const gaps = Object.keys(result.missing).length;

      ui.notifications?.info?.(
        "Imported "+result.created.length+" NPCs."+
        (gaps ? " "+gaps+" are missing some gear; see the console." : "")
      );

      return result;
    } catch (error) {
      console.error("FEHA NPC CATALOG // import failed",error);
      ui.notifications?.error?.("NPC import failed. Check console.");
      return null;
    }
  }

  // GM button in the Actors tab header.
  function addImportButton() {
    if (!game.user?.isGM) return;

    const actions = document.querySelector("#actors .directory-header .header-actions");
    if (!actions || actions.querySelector("."+BUTTON_CLASS)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.innerHTML = '<i class="fa-solid fa-users" inert></i> <span>Import FEHA NPCs</span>';
    button.addEventListener("click",() => openImportDialog());
    actions.appendChild(button);
  }

  const api = {
    version:VERSION,
    definitions:DEFINITIONS,
    tiers:TIERS,
    import:importAll,
    openImportDialog,

    async init() {
      await api.destroy();

      hooks.push([
        "renderActorDirectory",
        Hooks.on("renderActorDirectory",addImportButton)
      ]);

      addImportButton();

      if (game.adk) game.adk.npcs = api;

      console.log("FEHA NPC CATALOG",VERSION,"ready",DEFINITIONS.length,"NPCs");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }

      document.querySelector("#actors ."+BUTTON_CLASS)?.remove();
    }
  };

  core.registerModule("npcCatalog",api);
})();
