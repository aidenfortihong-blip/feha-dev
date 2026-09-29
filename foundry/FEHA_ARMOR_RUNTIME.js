// FEHA // ARMOR RUNTIME
// Lightweight runtime helpers for canonical armor signatures.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_ARMOR_RUNTIME requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const hooks = [];

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function equippedDefinition(actor) {
    if (!actor) return null;

    for (const item of list(actor.items)) {
      if (item.system?.equipped !== true) continue;

      const def =
        globalThis.FEHA_ARMOR_CATALOG?.definition?.(item) ??
        null;

      if (def) return def;
    }

    return null;
  }

  function quickhackSaveBonus(actor) {
    const def = equippedDefinition(actor);

    if (def?.company !== "Corvus Neural") return 0;

    return Math.max(
      0,
      Number(def.signature?.value ?? 0) || 0
    );
  }

  function empSaveAdvantage(actor) {
    return (
      equippedDefinition(actor)?.company ===
      "Jade Arc Systems"
    );
  }

  function weaponDamageReduction(actor) {
    const def = equippedDefinition(actor);

    if (def?.company !== "Bastion Strategic") return 0;

    return Math.max(
      0,
      Number(def.signature?.value ?? def.mk ?? 0) || 0
    );
  }

  function hasLightningResistance(actor) {
    return (
      equippedDefinition(actor)?.company ===
      "Jade Arc Systems"
    );
  }

  function adjustDamage(
    actor,
    amount,
    damageType,
    {sourceKind=""}={}
  ) {
    let value =
      Math.max(
        0,
        Math.floor(Number(amount) || 0)
      );

    const type =
      String(damageType ?? "")
        .trim()
        .toLowerCase();

    if (
      value > 0 &&
      type === "lightning" &&
      hasLightningResistance(actor)
    ) {
      value = Math.floor(value / 2);
    }

    if (
      value > 0 &&
      String(sourceKind).toLowerCase() === "weapon"
    ) {
      value =
        Math.max(
          0,
          value - weaponDamageReduction(actor)
        );
    }

    return value;
  }

  function originItem(options={}) {
    const origin = options.origin ?? null;

    const candidates = [
      origin?.item,
      origin?.parent?.documentName === "Item"
        ? origin.parent
        : null,
      origin?.documentName === "Item"
        ? origin
        : null,
      options.originatingMessage?.item ??
        null
    ].filter(Boolean);

    if (candidates.length) return candidates[0];

    const uuidCandidates = [
      options.originatingMessage?.system?.context?.item?.uuid,
      options.originatingMessage?.system?.context?.itemUuid,
      options.originatingMessage?.flags?.dnd5e?.itemUuid,
      options.origin?.itemUuid
    ].filter(Boolean);

    for (const uuid of uuidCandidates) {
      try {
        const doc = fromUuidSync(String(uuid));
        if (doc?.documentName === "Item") return doc;
        if (doc?.item?.documentName === "Item") return doc.item;
      } catch {}
    }

    return null;
  }

  function isWeaponDamage(options={}) {
    const item = originItem(options);

    if (item?.type === "weapon") return true;

    const text = [
      options.origin?.constructor?.name,
      options.origin?.type,
      options.originatingMessage?.system?.context?.type,
      options.originatingMessage?.flags?.dnd5e?.type
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return /weapon|attack/.test(text);
  }

  function reduceDamageDescriptions(
    damages,
    reduction
  ) {
    let remaining =
      Math.max(
        0,
        Math.floor(Number(reduction) || 0)
      );

    if (!remaining) return 0;

    let reduced = 0;

    for (const part of damages ?? []) {
      if (!remaining) break;

      const current = Number(part?.value);

      if (!Number.isFinite(current) || current <= 0) {
        continue;
      }

      const delta =
        Math.min(
          remaining,
          Math.floor(current)
        );

      part.value = Math.max(0,current - delta);

      remaining -= delta;
      reduced += delta;
    }

    return reduced;
  }

  function installHooks() {
    hooks.push(
      Hooks.on(
        "dnd5e.preCalculateDamage",
        (actor,damages,options={}) => {
          const reduction =
            weaponDamageReduction(actor);

          if (!reduction) return;
          if (!isWeaponDamage(options)) return;

          const reduced =
            reduceDamageDescriptions(
              damages,
              reduction
            );

          if (reduced > 0) {
            console.debug(
              "FEHA ARMOR // BASTION TACTICAL LAYERING",
              {
                actor:actor?.name,
                reduced
              }
            );
          }
        }
      )
    );
  }

  const api = {
    version:VERSION,
    equippedDefinition,
    quickhackSaveBonus,
    empSaveAdvantage,
    weaponDamageReduction,
    hasLightningResistance,
    adjustDamage,

    async init() {
      installHooks();

      game.adk ??= {};
      game.adk.armorRuntime = api;
      globalThis.FEHA_ARMOR_RUNTIME = api;

      console.log(
        "FEHA ARMOR RUNTIME",
        VERSION,
        "online"
      );
    },

    async destroy() {
      for (const id of hooks.splice(0)) {
        try {
          Hooks.off(
            "dnd5e.preCalculateDamage",
            id
          );
        } catch {}
      }

      if (game?.adk?.armorRuntime === api) {
        delete game.adk.armorRuntime;
      }

      if (globalThis.FEHA_ARMOR_RUNTIME === api) {
        delete globalThis.FEHA_ARMOR_RUNTIME;
      }
    }
  };

  core.registerModule("armorRuntime",api);
  globalThis.FEHA_ARMOR_RUNTIME = api;
})();
