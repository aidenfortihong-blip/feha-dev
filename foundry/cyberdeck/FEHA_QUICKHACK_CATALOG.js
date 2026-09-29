// FEHA // QUICKHACK CATALOG
// Canonical ADK Quickhack definitions and one-time world/owned-item migration.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_QUICKHACK_CATALOG requires FEHA_CYBER_CORE.");

  const VERSION = "3.0.0";
  const FLAG = "fleshEnshrouded";
  const REWRITE = "3.0";

  const definitions = [
    {
      key:"optic-zero",
      name:"Optic Zero",
      aliases:["Optic Zero","Blind Program"],
      mk:3,
      ramCost:4,
      effectText:"The target is Blinded until the end of its next turn. Creatures that can perceive through blindsense are unaffected.",
      meta:{durationTurns:1,condition:"blinded",immuneIf:"blindsight"}
    },
    {
      key:"synapse-burn",
      name:"Synapse Burn",
      aliases:["Synapse Burn","Brain Melt Program"],
      mk:4,
      ramCost:5,
      effectText:"The target makes an Intelligence save, taking 10d6 psychic damage on a failure or half as much on a success. On a failure, it also loses its reactions until the end of its next turn.",
      meta:{save:"int",damage:"10d6",damageType:"psychic",halfOnSuccess:true,removeReactionsOnFail:true}
    },
    {
      key:"ghost-key",
      name:"Ghost Key",
      aliases:["Ghost Key","Breach Protocol"],
      mk:1,
      ramCost:1,
      effectText:"Force open one locked networked door directly in front of you.",
      meta:{targetType:"door",opensLockedDoor:true,noSave:true}
    },
    {
      key:"wiretap",
      name:"Wiretap",
      aliases:["Wiretap","Comms Call In Program"],
      mk:1,
      ramCost:1,
      effectText:"The target makes a Wisdom save. On a failure, you tap into its active communications and can listen to its conversation for up to 1 minute.",
      meta:{save:"wis",durationRounds:10,listenToComms:true}
    },
    {
      key:"dead-air",
      name:"Dead Air",
      aliases:["Dead Air","Comms Noise Program"],
      mk:2,
      ramCost:2,
      effectText:"The target is Deafened for 2 turns, and its calls, alarms, network messages, and other communications are cut off for the same duration.",
      meta:{durationTurns:2,condition:"deafened",silenceComms:true,noSave:true}
    },
    {
      key:"toxic-bloom",
      name:"Toxic Bloom",
      aliases:["Toxic Bloom","Contagion Program"],
      mk:4,
      ramCost:6,
      effectText:"Create a 10-foot-radius burst of toxic gas at a point you can target. Creatures caught in the burst take 8d6 poison damage, and the gas disperses immediately afterward.",
      meta:{damage:"8d6",damageType:"poison",radiusFt:10,placeable:true,instantaneous:true,noSave:true}
    },
    {
      key:"chrome-lock",
      name:"Chrome Lock",
      aliases:["Chrome Lock","Disable Cyberware Program"],
      mk:2,
      ramCost:2,
      effectText:"The target makes an Intelligence save. On a failure, one active cyberware system is disabled until the end of its next turn.",
      meta:{save:"int",disableCyberware:true,durationTurns:1}
    },
    {
      key:"arc-overload",
      name:"Arc Overload",
      aliases:["Arc Overload","EMP Overload Program"],
      mk:5,
      ramCost:8,
      effectText:"A cybernetic or electronic target makes a Constitution save, taking 12d12 lightning damage on a failure or half as much on a success. On a failure, it also loses its reactions until the end of its next turn.",
      meta:{save:"con",damage:"12d12",damageType:"lightning",halfOnSuccess:true,cyberneticOnly:true,removeReactionsOnFail:true}
    },
    {
      key:"rollback",
      name:"Rollback",
      aliases:["Rollback","Generic Program"],
      mk:4,
      ramCost:4,
      effectText:"As a reaction when a networked creature you can see succeeds on an attack roll, ability check, or saving throw, force it to reroll and use the lower result. Then choose yourself or one ally you can see; the chosen creature has advantage on its next attack roll, ability check, or saving throw before the end of its next turn.",
      meta:{reaction:true,forceLowerReroll:true,grantAdvantage:true}
    },
    {
      key:"cookoff",
      name:"Cookoff",
      aliases:["Cookoff","Grenade Explode Program"],
      mk:3,
      ramCost:3,
      effectText:"Detonate one explosive carried by the target, using that explosive's normal damage, radius, damage type, and other effects.",
      meta:{detonateCarriedExplosive:true,noSave:true}
    },
    {
      key:"motor-lock",
      name:"Motor Lock",
      aliases:["Motor Lock","Locomotion Malfunction Program"],
      mk:2,
      ramCost:2,
      effectText:"If the target relies on cybernetic legs or leg actuators, disable them until the end of its next turn. Its Speed becomes 0 for the duration.",
      meta:{legsOnly:true,noSave:true,durationTurns:1,speedZero:true}
    },
    {
      key:"frenzy",
      name:"Frenzy",
      aliases:["Frenzy","Madness Program"],
      mk:3,
      ramCost:3,
      effectText:"The target makes a Wisdom save. On a failure, it immediately uses its reaction to make one attack against the nearest creature it can reach or target.",
      meta:{save:"wis",forcedAttackNearest:true}
    },
    {
      key:"blank-slate",
      name:"Blank Slate",
      aliases:["Blank Slate","Memory Wipe Program"],
      mk:3,
      ramCost:3,
      effectText:"Choose the ability used for the target's saving throw when you upload this Quickhack. On a failure, the target forgets everything that happened during the previous 1 minute.",
      meta:{operatorChoosesSave:true,memoryLossSeconds:60}
    },
    {
      key:"combustion",
      name:"Combustion",
      aliases:["Combustion","Combustion Program","Overheat Program"],
      mk:5,
      ramCost:7,
      effectText:"The target takes 10d6 fire damage immediately. If the damage kills it, the target erupts and every other creature within 10 feet takes 5d6 fire damage.",
      meta:{damage:"10d6",damageType:"fire",deathBurst:"5d6",deathBurstType:"fire",deathBurstRadiusFt:10,noSave:true}
    },
    {
      key:"network-sweep",
      name:"Network Sweep",
      aliases:["Network Sweep","Ping Program"],
      mk:2,
      ramCost:2,
      effectText:"Reveal networked devices within 50 feet, including cameras, turrets, doors, alarms, terminals, and similar systems, along with hostile creatures in range that have cyberware. Revealed targets cannot remain hidden from you until the end of your next turn.",
      meta:{radiusFt:50,revealDevices:true,revealCyberwareHostiles:true,durationTurns:1}
    },
    {
      key:"self-terminate",
      name:"Self-Terminate",
      aliases:["Self-Terminate","Suicide Program"],
      mk:4,
      ramCost:5,
      effectText:"The target makes a Wisdom save. On a failure, it immediately uses its reaction to make one damaging attack against itself.",
      meta:{save:"wis",forcedSelfAttack:true}
    },
    {
      key:"system-collapse",
      name:"System Collapse",
      aliases:["System Collapse","System Collapse Program"],
      mk:4,
      ramCost:6,
      effectText:"The target makes an Intelligence save. On a failure, it becomes Incapacitated until the end of its next turn.",
      meta:{save:"int",condition:"incapacitated",durationTurns:1}
    },
    {
      key:"puppet-wire",
      name:"Puppet Wire",
      aliases:["Puppet Wire","Take Control Program"],
      mk:5,
      ramCost:8,
      effectText:"The target makes a Charisma save. On a failure, you gain control of it for up to 1 minute and can see through its eyes. You can direct its movement and non-hostile actions. If it makes an attack or takes another hostile or damaging action, control ends immediately after that action.",
      meta:{save:"cha",durationRounds:10,controlTarget:true,seeThroughEyes:true,breaksAfterHostileAction:true}
    },
    {
      key:"dead-trigger",
      name:"Dead Trigger",
      aliases:["Dead Trigger","Weapon Malfunction Program"],
      mk:3,
      ramCost:5,
      effectText:"The target makes an Intelligence save. On a failure, one firearm it is wielding breaks and remains unusable until repaired.",
      meta:{save:"int",breakFirearm:true,permanentUntilRepaired:true}
    },
    {
      key:"lure",
      name:"Lure",
      aliases:["Lure","Whistle Program"],
      mk:2,
      ramCost:2,
      effectText:"The target makes a Wisdom save. On a failure, it moves up to 20 feet toward a point you choose. This movement does not provoke opportunity attacks.",
      meta:{save:"wis",forcedMoveFt:20,noOpportunityAttacks:true}
    }
  ];

  const TIER = {
    1:{label:"Mk.I",quality:"Civilian",availability:"Common",price:200,tierIdentity:"Entry-level civilian software with narrow, reliable utility."},
    2:{label:"Mk.II",quality:"Professional",availability:"Professional",price:450,tierIdentity:"Professional-grade tactical software with dependable field value."},
    3:{label:"Mk.III",quality:"High-Grade",availability:"Restricted",price:1200,tierIdentity:"Restricted combat-grade software with strong encounter impact."},
    4:{label:"Mk.IV",quality:"Elite",availability:"Black Market",price:3200,tierIdentity:"Elite intrusion software capable of decisive control or major damage."},
    5:{label:"Mk.V",quality:"Prototype",availability:"Prototype",price:8000,tierIdentity:"Prototype-tier software with encounter-defining or extreme effects."}
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

  function rewriteDescription(html,def) {
    const raw = String(html ?? "");
    if (!raw || typeof document === "undefined") return raw;

    const root = document.createElement("div");
    root.innerHTML = raw;

    const h2 = root.querySelector("h2");
    if (h2) h2.textContent = def.name;

    const tier = TIER[def.mk] ?? TIER[1];

    const paragraphs = [...root.querySelectorAll("p")];

    const setLabeledParagraph = (label,html) => {
      const p = paragraphs.find(node =>
        [...node.querySelectorAll("strong")].some(strong =>
          normalize(strong.textContent) === normalize(label)
        )
      );
      if (p) p.innerHTML = html;
    };

    setLabeledParagraph(
      "Rating:",
      "<strong>Rating:</strong> " +
      tier.label +
      " — " +
      tier.quality
    );

    setLabeledParagraph(
      "RAM Cost:",
      "<strong>RAM Cost:</strong> " +
      String(def.ramCost)
    );

    setLabeledParagraph(
      "Price:",
      "<strong>Price:</strong> ₡" +
      Number(tier.price).toLocaleString()
    );

    setLabeledParagraph(
      "Availability:",
      "<strong>Availability:</strong> " +
      tier.availability
    );

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

      if (divs[1]) {
        divs[1].innerHTML =
          "<strong>" +
          tier.label +
          "</strong> • " +
          tier.availability;
      }

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

      const marketLine = divs.find(node =>
        /^Market\s*:/i.test(String(node.textContent ?? "").trim())
      );

      if (marketLine) {
        marketLine.innerHTML =
          "<strong>Market:</strong> €$ " +
          Number(tier.price).toLocaleString();
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
