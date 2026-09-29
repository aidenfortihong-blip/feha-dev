// FEHA // QUICKHACK CATALOG
// Canonical ADK Quickhack definitions and one-time world/owned-item migration.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_QUICKHACK_CATALOG requires FEHA_CYBER_CORE.");

  const VERSION = "2.0.0";
  const FLAG = "fleshEnshrouded";
  const REWRITE = "2.0";

  const definitions = [
    {
      key:"blind",
      name:"Blind Program",
      aliases:["Blind Program"],
      ramCost:2,
      effectText:"Blinded for 1 turn. A target with blindsense is immune to this Quickhack's Blinded effect.",
      meta:{durationTurns:1,condition:"blinded",immuneIf:"blindsight"}
    },
    {
      key:"brain-melt",
      name:"Brain Melt Program",
      aliases:["Brain Melt Program"],
      ramCost:4,
      effectText:"Intelligence save; 10d6 psychic damage, half on success. On a failed save, the target also loses reactions until the end of its next turn.",
      meta:{save:"int",damage:"10d6",damageType:"psychic",halfOnSuccess:true,removeReactionsOnFail:true}
    },
    {
      key:"breach-protocol",
      name:"Breach Protocol",
      aliases:["Breach Protocol"],
      ramCost:3,
      effectText:"Open one locked networked door directly in front of you. No save.",
      meta:{targetType:"door",opensLockedDoor:true,noSave:true}
    },
    {
      key:"comms-call-in",
      name:"Comms Call In Program",
      aliases:["Comms Call In Program"],
      ramCost:2,
      effectText:"Wisdom save. On a failure, you tap the target's active communications and can listen to its conversation for up to 1 minute.",
      meta:{save:"wis",durationRounds:10,listenToComms:true}
    },
    {
      key:"comms-noise",
      name:"Comms Noise Program",
      aliases:["Comms Noise Program"],
      ramCost:3,
      effectText:"The target is Deafened for 2 turns and cannot send or receive calls, alarms, network messages, or other comms during that time.",
      meta:{durationTurns:2,condition:"deafened",silenceComms:true,noSave:true}
    },
    {
      key:"contagion",
      name:"Contagion Program",
      aliases:["Contagion Program"],
      ramCost:4,
      effectText:"Place an instantaneous 10-foot-radius gas cloud at a point you can target. Creatures in the radius take 8d6 poison damage. The cloud does not linger.",
      meta:{damage:"8d6",damageType:"poison",radiusFt:10,placeable:true,instantaneous:true,noSave:true}
    },
    {
      key:"disable-cyberware",
      name:"Disable Cyberware Program",
      aliases:["Disable Cyberware Program"],
      ramCost:2,
      effectText:"Intelligence save or one active cyberware system is disabled until the end of the target's next turn.",
      meta:{save:"int",disableCyberware:true,durationTurns:1}
    },
    {
      key:"emp-overload",
      name:"EMP Overload Program",
      aliases:["EMP Overload Program"],
      ramCost:5,
      effectText:"Constitution save; 12d12 lightning damage to a cybernetic or electronic target, half on success. On a failed save, the target also loses reactions until the end of its next turn.",
      meta:{save:"con",damage:"12d12",damageType:"lightning",halfOnSuccess:true,cyberneticOnly:true,removeReactionsOnFail:true}
    },
    {
      key:"generic",
      name:"Generic Program",
      aliases:["Generic Program"],
      ramCost:2,
      effectText:"Reaction: when a networked creature you can see succeeds on an attack roll, ability check, or saving throw, force it to reroll and use the lower result. Then choose yourself or one ally you can see; the chosen creature has advantage on its next attack roll, ability check, or saving throw before the end of its next turn.",
      meta:{reaction:true,forceLowerReroll:true,grantAdvantage:true}
    },
    {
      key:"grenade-explode",
      name:"Grenade Explode Program",
      aliases:["Grenade Explode Program"],
      ramCost:4,
      effectText:"No save. Detonate one explosive carried by the target. Resolve that explosive's normal damage, radius, damage type, and other effects.",
      meta:{detonateCarriedExplosive:true,noSave:true}
    },
    {
      key:"locomotion-malfunction",
      name:"Locomotion Malfunction Program",
      aliases:["Locomotion Malfunction Program"],
      ramCost:1,
      effectText:"No save. If the target has cybernetic legs or leg actuators, disable them until the end of its next turn; its Speed becomes 0 for the duration.",
      meta:{legsOnly:true,noSave:true,durationTurns:1,speedZero:true}
    },
    {
      key:"madness",
      name:"Madness Program",
      aliases:["Madness Program"],
      ramCost:3,
      effectText:"Wisdom save or the target immediately uses its reaction to make one attack against the nearest creature it can reach or target.",
      meta:{save:"wis",forcedAttackNearest:true}
    },
    {
      key:"memory-wipe",
      name:"Memory Wipe Program",
      aliases:["Memory Wipe Program"],
      ramCost:2,
      effectText:"Choose the saving throw ability when you use this Quickhack. On a failed save, the target forgets everything that happened during the previous 1 minute.",
      meta:{operatorChoosesSave:true,memoryLossSeconds:60}
    },
    {
      key:"combustion",
      name:"Combustion Program",
      aliases:["Combustion Program","Overheat Program"],
      ramCost:4,
      effectText:"The target takes 10d6 fire damage immediately. If this damage kills the target, it explodes and every other creature within 10 feet takes 5d6 fire damage.",
      meta:{damage:"10d6",damageType:"fire",deathBurst:"5d6",deathBurstType:"fire",deathBurstRadiusFt:10,noSave:true}
    },
    {
      key:"ping",
      name:"Ping Program",
      aliases:["Ping Program"],
      ramCost:2,
      effectText:"Reveal all networked devices within 50 feet, including cameras, turrets, doors, alarms, terminals, and similar systems, plus hostile creatures in range that have cyberware. Revealed targets cannot benefit from being hidden from you until the end of your next turn.",
      meta:{radiusFt:50,revealDevices:true,revealCyberwareHostiles:true,durationTurns:1}
    },
    {
      key:"suicide",
      name:"Suicide Program",
      aliases:["Suicide Program"],
      ramCost:3,
      effectText:"Wisdom save or the target immediately uses its reaction to make one damaging attack against itself.",
      meta:{save:"wis",forcedSelfAttack:true}
    },
    {
      key:"system-collapse",
      name:"System Collapse Program",
      aliases:["System Collapse Program"],
      ramCost:6,
      effectText:"Intelligence save or the target becomes incapacitated until the end of its next turn.",
      meta:{save:"int",condition:"incapacitated",durationTurns:1}
    },
    {
      key:"take-control",
      name:"Take Control Program",
      aliases:["Take Control Program"],
      ramCost:6,
      effectText:"Charisma save or you gain control of the target for up to 1 minute and can see through its eyes. You can direct its movement and non-hostile actions. If it makes an attack or takes another hostile or damaging action, control ends immediately after that action.",
      meta:{save:"cha",durationRounds:10,controlTarget:true,seeThroughEyes:true,breaksAfterHostileAction:true}
    },
    {
      key:"weapon-malfunction",
      name:"Weapon Malfunction Program",
      aliases:["Weapon Malfunction Program"],
      ramCost:5,
      effectText:"Intelligence save or one firearm the target is wielding is permanently broken until repaired.",
      meta:{save:"int",breakFirearm:true,permanentUntilRepaired:true}
    },
    {
      key:"whistle",
      name:"Whistle Program",
      aliases:["Whistle Program"],
      ramCost:3,
      effectText:"Wisdom save or the target moves up to 20 feet toward a point you choose. This movement does not provoke opportunity attacks.",
      meta:{save:"wis",forcedMoveFt:20,noOpportunityAttacks:true}
    }
  ];

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

  function rewriteDescription(html,def) {
    const raw = String(html ?? "");
    if (!raw || typeof document === "undefined") return raw;

    const root = document.createElement("div");
    root.innerHTML = raw;

    const h2 = root.querySelector("h2");
    if (h2) h2.textContent = def.name;

    const effectHeading = [...root.querySelectorAll("h3")]
      .find(node => normalize(node.textContent) === "effect");

    if (effectHeading) {
      let effectNode = effectHeading.nextElementSibling;
      while (
        effectNode &&
        effectNode.tagName !== "P"
      ) {
        effectNode = effectNode.nextElementSibling;
      }
      if (effectNode) effectNode.textContent = def.effectText;
    }

    const balance = root.querySelector(
      'section[data-adk-final-balance]'
    );

    if (balance) {
      const divs = [...balance.querySelectorAll(":scope > div")];

      if (divs[2]) {
        divs[2].textContent = def.effectText;
      }

      const ramLine = divs.find(node =>
        /^RAM\s*:/i.test(String(node.textContent ?? "").trim())
      );

      if (ramLine) {
        ramLine.innerHTML =
          "<strong>RAM:</strong> " +
          String(def.ramCost);
      }
    }

    return root.innerHTML;
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
      def
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
