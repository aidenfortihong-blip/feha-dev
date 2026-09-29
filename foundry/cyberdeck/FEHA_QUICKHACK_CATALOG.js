// FEHA // QUICKHACK CATALOG
// Canonical ADK Quickhack definitions and one-time world/owned-item migration.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_QUICKHACK_CATALOG requires FEHA_CYBER_CORE.");

  const VERSION = "4.1.0";
  const FLAG = "fleshEnshrouded";
  const REWRITE = "4.1";

  const definitions = [
    {
      key:"optic-zero",
      name:"Optic Zero",
      aliases:["Optic Zero","Blind Program"],
      mk:3,
      ramCost:4,
      effectText:"As a bonus action, choose one creature whose visual systems you can access. The target is Blinded until the end of its next turn. A creature that can perceive its surroundings with blindsense is unaffected.",
      meta:{durationTurns:1,condition:"blinded",immuneIf:"blindsight"}
    },
    {
      key:"synapse-burn",
      name:"Synapse Burn",
      aliases:["Synapse Burn","Brain Melt Program"],
      mk:4,
      ramCost:5,
      effectText:"As a bonus action, choose one creature you can hack. The target must make an Intelligence saving throw. On a failed save, it takes 10d6 psychic damage and cannot take reactions until the end of its next turn. On a successful save, it takes half as much damage and suffers no additional effect.",
      meta:{save:"int",damage:"10d6",damageType:"psychic",halfOnSuccess:true,removeReactionsOnFail:true}
    },
    {
      key:"ghost-key",
      name:"Ghost Key",
      aliases:["Ghost Key","Breach Protocol"],
      mk:1,
      ramCost:1,
      effectText:"As a bonus action, choose one locked networked door directly in front of you. The door immediately unlocks and opens.",
      meta:{targetType:"door",opensLockedDoor:true,noSave:true}
    },
    {
      key:"wiretap",
      name:"Wiretap",
      aliases:["Wiretap","Comms Call In Program"],
      mk:1,
      ramCost:1,
      effectText:"As a bonus action, choose one creature whose communications you can access. The target must make a Wisdom saving throw. On a failed save, you can listen to its active communications for up to 1 minute.",
      meta:{save:"wis",durationRounds:10,listenToComms:true}
    },
    {
      key:"dead-air",
      name:"Dead Air",
      aliases:["Dead Air","Comms Noise Program"],
      mk:2,
      ramCost:2,
      effectText:"As a bonus action, choose one creature you can hack. The target is Deafened until the end of its second turn after this Quickhack is used. During that time, it cannot send or receive calls, alarms, network messages, or other communications.",
      meta:{durationTurns:2,condition:"deafened",silenceComms:true,noSave:true}
    },
    {
      key:"toxic-bloom",
      name:"Toxic Bloom",
      aliases:["Toxic Bloom","Contagion Program"],
      mk:4,
      ramCost:6,
      effectText:"As a bonus action, choose a point you can target. A burst of toxic gas fills a 10-foot-radius sphere centered on that point. Each creature in the area takes 8d6 poison damage, after which the gas immediately disperses.",
      meta:{damage:"8d6",damageType:"poison",radiusFt:10,placeable:true,instantaneous:true,noSave:true}
    },
    {
      key:"chrome-lock",
      name:"Chrome Lock",
      aliases:["Chrome Lock","Disable Cyberware Program"],
      mk:2,
      ramCost:2,
      effectText:"As a bonus action, choose one creature with active cyberware. The target must make an Intelligence saving throw. On a failed save, choose one active cyberware system it possesses; that system is disabled until the end of the target's next turn.",
      meta:{save:"int",disableCyberware:true,durationTurns:1}
    },
    {
      key:"arc-overload",
      name:"Arc Overload",
      aliases:["Arc Overload","EMP Overload Program"],
      mk:5,
      ramCost:8,
      effectText:"As a bonus action, choose one cybernetic or electronic target you can hack. The target must make a Constitution saving throw. On a failed save, it takes 12d12 lightning damage and cannot take reactions until the end of its next turn. On a successful save, it takes half as much damage and suffers no additional effect.",
      meta:{save:"con",damage:"12d12",damageType:"lightning",halfOnSuccess:true,cyberneticOnly:true,removeReactionsOnFail:true}
    },
    {
      key:"rollback",
      name:"Rollback",
      aliases:["Rollback","Generic Program"],
      mk:4,
      ramCost:4,
      effectText:"As a bonus action, choose one networked creature you can see. Until the start of your next turn, the next time that creature succeeds on an attack roll, ability check, or saving throw, it must reroll the d20 and use the lower result. When this occurs, choose yourself or one ally you can see. The chosen creature has advantage on the next attack roll, ability check, or saving throw it makes before the end of its next turn.",
      meta:{bonusAction:true,armedTrigger:true,forceLowerReroll:true,grantAdvantage:true,durationTurns:1}
    },
    {
      key:"cookoff",
      name:"Cookoff",
      aliases:["Cookoff","Grenade Explode Program"],
      mk:3,
      ramCost:3,
      effectText:"As a bonus action, choose one explosive carried by a creature you can hack. The explosive immediately detonates, using its normal damage, area, damage type, and other effects.",
      meta:{detonateCarriedExplosive:true,noSave:true}
    },
    {
      key:"motor-lock",
      name:"Motor Lock",
      aliases:["Motor Lock","Locomotion Malfunction Program"],
      mk:2,
      ramCost:2,
      effectText:"As a bonus action, choose one creature that relies on cybernetic legs or leg actuators. Its cybernetic locomotion is disabled until the end of its next turn, and its Speed becomes 0 for the duration.",
      meta:{legsOnly:true,noSave:true,durationTurns:1,speedZero:true}
    },
    {
      key:"frenzy",
      name:"Frenzy",
      aliases:["Frenzy","Madness Program"],
      mk:3,
      ramCost:3,
      effectText:"As a bonus action, choose one creature you can hack. The target must make a Wisdom saving throw. On a failed save, it must immediately use its reaction, if available, to make one attack against a creature chosen by the operator.",
      meta:{save:"wis",forcedAttackChosen:true}
    },
    {
      key:"blank-slate",
      name:"Blank Slate",
      aliases:["Blank Slate","Memory Wipe Program"],
      mk:3,
      ramCost:3,
      effectText:"As a bonus action, choose one creature you can hack and choose one ability score. The target must make a saving throw using that ability. On a failed save, it forgets everything that happened during the previous 1 minute.",
      meta:{operatorChoosesSave:true,memoryLossSeconds:60}
    },
    {
      key:"combustion",
      name:"Combustion",
      aliases:["Combustion","Combustion Program","Overheat Program"],
      mk:5,
      ramCost:7,
      effectText:"As a bonus action, choose one creature you can hack. The target takes 10d6 fire damage. If this damage reduces the target to 0 hit points, it erupts; every other creature within 10 feet of it takes 5d6 fire damage.",
      meta:{damage:"10d6",damageType:"fire",deathBurst:"5d6",deathBurstType:"fire",deathBurstRadiusFt:10,noSave:true}
    },
    {
      key:"network-sweep",
      name:"Network Sweep",
      aliases:["Network Sweep","Ping Program"],
      mk:2,
      ramCost:2,
      effectText:"As a bonus action, perform a network sweep in a 50-foot radius centered on you. Until the end of your next turn, you know the location of networked devices in the area, including cameras, turrets, doors, alarms, terminals, and similar systems, as well as hostile creatures in the area that possess cyberware. A revealed target cannot be hidden from you for the duration.",
      meta:{radiusFt:50,revealDevices:true,revealCyberwareHostiles:true,durationTurns:1}
    },
    {
      key:"self-terminate",
      name:"Self-Terminate",
      aliases:["Self-Terminate","Suicide Program"],
      mk:4,
      ramCost:5,
      effectText:"As a bonus action, choose one creature you can hack. The target must make a Wisdom saving throw. On a failed save, it must immediately use its reaction, if available, to make one damaging attack against itself.",
      meta:{save:"wis",forcedSelfAttack:true}
    },
    {
      key:"system-collapse",
      name:"System Collapse",
      aliases:["System Collapse","System Collapse Program"],
      mk:4,
      ramCost:6,
      effectText:"As a bonus action, choose one creature you can hack. The target must make an Intelligence saving throw. On a failed save, it is Incapacitated until the end of its next turn.",
      meta:{save:"int",condition:"incapacitated",durationTurns:1}
    },
    {
      key:"puppet-wire",
      name:"Puppet Wire",
      aliases:["Puppet Wire","Take Control Program"],
      mk:5,
      ramCost:8,
      effectText:"As a bonus action, choose one creature you can hack. The target must make a Charisma saving throw. On a failed save, you gain control of it for up to 1 minute and can see through its eyes. While controlled, you can direct its movement and non-hostile actions. If the target makes an attack or takes another hostile or damaging action, the effect ends immediately after that action resolves.",
      meta:{save:"cha",durationRounds:10,controlTarget:true,seeThroughEyes:true,breaksAfterHostileAction:true}
    },
    {
      key:"dead-trigger",
      name:"Dead Trigger",
      aliases:["Dead Trigger","Weapon Malfunction Program"],
      mk:3,
      ramCost:5,
      effectText:"As a bonus action, choose one creature you can hack that is wielding a firearm. The target must make an Intelligence saving throw. On a failed save, choose one firearm it is wielding; that weapon breaks and cannot be used until repaired.",
      meta:{save:"int",breakFirearm:true,permanentUntilRepaired:true}
    },
    {
      key:"lure",
      name:"Lure",
      aliases:["Lure","Whistle Program"],
      mk:2,
      ramCost:2,
      effectText:"As a bonus action, choose one creature you can hack and one point you can see within 20 feet of it. The target must make a Wisdom saving throw. On a failed save, it immediately moves up to 20 feet toward that point. This movement does not provoke opportunity attacks.",
      meta:{save:"wis",forcedMoveFt:20,noOpportunityAttacks:true}
    }
  ];

  const TIER = {
    1:{label:"Mk.I",quality:"Civilian",availability:"Common",price:2500,tierIdentity:"Entry-level civilian software with narrow, reliable utility."},
    2:{label:"Mk.II",quality:"Professional",availability:"Professional",price:6000,tierIdentity:"Professional-grade tactical software with dependable field value."},
    3:{label:"Mk.III",quality:"High-Grade",availability:"Restricted",price:15000,tierIdentity:"Restricted combat-grade software with strong encounter impact."},
    4:{label:"Mk.IV",quality:"Elite",availability:"Black Market",price:35000,tierIdentity:"Elite intrusion software capable of decisive control or major damage."},
    5:{label:"Mk.V",quality:"Prototype",availability:"Prototype",price:80000,tierIdentity:"Prototype-tier software with encounter-defining or extreme effects."}
  };

  const normalize = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const byAlias = new Map();

  for (const definition of definitions) {
    for (const alias of definition.aliases ?? [definition.name]) {
      byAlias.set(normalize(alias),definition);
    }
    byAlias.set(normalize(definition.name),definition);
  }

  function definition(value) {
    const name =
      typeof value === "string"
        ? value
        : value?.name;

    return byAlias.get(normalize(name)) ?? null;
  }

  function effectText(value) {
    return definition(value)?.effectText ?? null;
  }

  function ramCost(value) {
    const def = definition(value);
    return def ? Number(def.ramCost) : null;
  }

  function displayName(value) {
    return definition(value)?.name ?? String(
      typeof value === "string"
        ? value
        : value?.name ?? ""
    );
  }

  function mk(value) {
    return Number(definition(value)?.mk ?? 0) || null;
  }

  function tierInfo(value) {
    const rating = mk(value);
    return rating ? {...TIER[rating]} : null;
  }

  function rewriteDescription(html,def,item=null) {
    if (typeof document === "undefined") {
      return String(html ?? "");
    }

    const tier = TIER[def.mk] ?? TIER[1];
    const itemFlags = item?.flags?.[FLAG] ?? {};

    const manufacturer = String(
      itemFlags.manufacturer ??
      itemFlags.company ??
      "Corvus Neural"
    ).trim() || "Corvus Neural";

    const escapeHtml = value => String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");

    const price =
      "€$" +
      Number(tier.price).toLocaleString();

    return (
      '<section data-feha-qh-card="4.1" '+
      'style="border:1px solid #29434d;background:#071016;padding:14px 15px;'+
      'box-shadow:inset 0 0 0 1px rgba(61,220,255,.04)">'+

        '<header style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;'+
        'padding-bottom:10px;border-bottom:1px solid #29434d">'+
          '<div>'+
            '<small style="display:block;color:#75dfff;font-size:10px;font-weight:800;'+
            'letter-spacing:.13em;text-transform:uppercase">'+
              'QUICKHACK // '+escapeHtml(manufacturer)+
            '</small>'+
            '<h2 style="margin:3px 0 0;font-size:22px;line-height:1.05">'+
              escapeHtml(def.name)+
            '</h2>'+
          '</div>'+
          '<span style="flex:0 0 auto;border:1px solid #75dfff;color:#75dfff;'+
          'padding:4px 8px;font-size:11px;font-weight:900;letter-spacing:.08em">'+
            escapeHtml(tier.label)+
          '</span>'+
        '</header>'+

        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 12px">'+
          '<span style="border:1px solid #3d4d54;background:#0d171c;padding:4px 7px;'+
          'font-size:11px"><strong>RAM</strong> '+escapeHtml(def.ramCost)+'</span>'+
          '<span style="border:1px solid #3d4d54;background:#0d171c;padding:4px 7px;'+
          'font-size:11px">'+escapeHtml(tier.availability)+'</span>'+
          '<span style="border:1px solid #6c6031;background:#17150c;color:#f1d86d;padding:4px 7px;'+
          'font-size:11px;font-weight:800">'+escapeHtml(price)+'</span>'+
        '</div>'+

        '<div>'+
          '<small style="display:block;color:#8ea8b4;font-size:10px;font-weight:900;'+
          'letter-spacing:.12em;margin-bottom:4px">EFFECT</small>'+
          '<p style="margin:0;line-height:1.45">'+
            escapeHtml(def.effectText)+
          '</p>'+
        '</div>'+
      '</section>'
    );
  }

  function looksLikeQuickhack(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    const sourceCategory = String(
      flags.sourceCategory ??
      flags.category ??
      ""
    ).toLowerCase();

    return Boolean(
      definition(item) ||
      flags.quickhack === true ||
      sourceCategory === "quickhacks" ||
      /\/quickhacks\//i.test(String(flags.sourcePath ?? ""))
    );
  }

  async function migrateItem(item) {
    const def = definition(item);
    if (!item || !def || !looksLikeQuickhack(item)) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const update = {};

    if (item.name !== def.name) {
      update.name = def.name;
    }

    if (flags.effectText !== def.effectText) {
      update[`flags.${FLAG}.effectText`] = def.effectText;
    }

    if (Number(flags.ramCost) !== Number(def.ramCost)) {
      update[`flags.${FLAG}.ramCost`] = Number(def.ramCost);
    }

    const tier = TIER[def.mk] ?? TIER[1];

    if (Number(flags.rating) !== Number(def.mk)) {
      update[`flags.${FLAG}.rating`] = Number(def.mk);
    }

    if (Number(flags.mk) !== Number(def.mk)) {
      update[`flags.${FLAG}.mk`] = Number(def.mk);
    }

    if (Number(flags.tier) !== Number(def.mk)) {
      update[`flags.${FLAG}.tier`] = Number(def.mk);
    }

    if (flags.ratingLabel !== tier.label) {
      update[`flags.${FLAG}.ratingLabel`] = tier.label;
    }

    if (Number(flags.priceCredits) !== Number(tier.price)) {
      update[`flags.${FLAG}.priceCredits`] = Number(tier.price);
    }

    if (flags.availability !== tier.availability) {
      update[`flags.${FLAG}.availability`] = tier.availability;
    }

    if (flags.tierIdentity !== tier.tierIdentity) {
      update[`flags.${FLAG}.tierIdentity`] = tier.tierIdentity;
    }

    if (flags.quickhack !== true) {
      update[`flags.${FLAG}.quickhack`] = true;
    }

    if (flags.sourceCategory !== "Quickhacks") {
      update[`flags.${FLAG}.sourceCategory`] = "Quickhacks";
    }

    if (flags.quickhackRewriteVersion !== REWRITE) {
      update[`flags.${FLAG}.quickhackRewriteVersion`] = REWRITE;
    }

    const nextDescription = rewriteDescription(
      item.system?.description?.value,
      def,
      item
    );

    if (
      nextDescription &&
      nextDescription !== String(
        item.system?.description?.value ?? ""
      )
    ) {
      update["system.description.value"] = nextDescription;
    }

    if (!Object.keys(update).length) return false;

    await item.update(update);
    return true;
  }

  async function migrateAll() {
    if (!game.user?.isGM) return {
      world:0,
      owned:0,
      skipped:true
    };

    let world = 0;
    let owned = 0;

    for (const item of game.items?.contents ?? []) {
      try {
        if (await migrateItem(item)) world++;
      } catch (err) {
        console.warn(
          "FEHA QUICKHACKS // world migration failed",
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
            "FEHA QUICKHACKS // owned migration failed",
            actor?.name,
            item?.name,
            err
          );
        }
      }
    }

    console.info(
      "FEHA QUICKHACKS // rewrite " +
      REWRITE +
      " ready",
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
          Object.freeze({...def})
        ])
      )
    ),
    list:() => definitions.map(def => ({...def})),
    definition,
    effectText,
    ramCost,
    displayName,
    mk,
    tierInfo,
    migrateAll,

    async init() {
      globalThis.FEHA_QUICKHACK_CATALOG = api;
      game.adk ??= {};
      game.adk.quickhacks = api;

      if (game.user?.isGM) {
        await migrateAll();
      }

      console.log(
        "FEHA QUICKHACK CATALOG",
        VERSION,
        "ready"
      );
    },

    async destroy() {
      if (game?.adk?.quickhacks === api) {
        delete game.adk.quickhacks;
      }

      if (globalThis.FEHA_QUICKHACK_CATALOG === api) {
        delete globalThis.FEHA_QUICKHACK_CATALOG;
      }
    }
  };

  core.registerModule("quickhacks",api);
  globalThis.FEHA_QUICKHACK_CATALOG = api;
})();
