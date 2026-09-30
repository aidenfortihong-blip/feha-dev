// FEHA // DO THESE WEAPON FINALIZER
// The world Item folder named "Do these" is authoritative.
// Every weapon inside its seven manufacturer subfolders is treated as finished,
// regardless of exact weapon name. This includes repaired variant-looking items.
// Review import v1 reconciles the user's final description-card edits with live
// Foundry stats once, then stops touching mechanics on later loader runs.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_READINESS requires FEHA_CYBER_CORE.");

  const VERSION = "4.1.2";
  const REVIEW_IMPORT = "2026-09-30-do-these-export-1";
  const DESCRIPTION_REPAIR = "2026-09-30-final-card-repair-1";
  const FLAG = "fleshEnshrouded";
  const REVIEW_ROOT = "Do these";
  const STOCK_KEY = "adkMarketStockV16";
  const quarantinedIdentifierWarnings = new Set();

  function legacyIdentifierQuarantined(item) {
    if (item?.type !== "weapon") return false;

    const build = Number(game.release?.build ?? 0);
    if (build >= 368) return false;

    const root = item?._source?.system;
    if (!root || typeof root !== "object") return false;

    const stack = [root];
    while (stack.length) {
      const current = stack.pop();
      if (!current || typeof current !== "object") continue;

      for (const [key,value] of Object.entries(current)) {
        if (key === "identifier") {
          const text = String(value ?? "");
          if (!/^[a-z0-9_-]+$/i.test(text)) {
            const token = String(item?.uuid ?? item?.id ?? item?.name);
            if (!quarantinedIdentifierWarnings.has(token)) {
              quarantinedIdentifierWarnings.add(token);
              console.warn(
                "FEHA WEAPON READINESS // quarantined legacy nested identifier until Foundry 14.368+",
                item?.name,
                item?.uuid ?? item?.id,
                text
              );
            }
            return true;
          }
        }

        if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }

    return false;
  }

  const COMPANY_BY_FOLDER = Object.freeze({
    "-Bastion":"Bastion Strategic",
    "-Corvus":"Corvus Neural",
    "-Forgeline":"ForgeLine Industries",
    "-Helix":"Helix Vitae",
    "-Jade Arc":"Jade Arc Systems",
    "-Kurohane":"Kurohane Group",
    "-Vektor":"Vektor Dynamics"
  });

  const SPECIAL_OVERRIDES = Object.freeze({
    "Metel":{
      name:"Tracker",
      text:"Twice per Long Rest, target one creature. One Quickhack may target that creature without direct visual contact even if it leaves network range. Reloading erases the signature.",
      uses:2,
      recovery:"long",
      automation:"manual"
    },
    "Razor Choir":{
      name:"TRUESIGHT OPTIC",
      text:"While actively wielded, the integrated optic provides Truesight 30 ft.",
      truesightFt:30,
      automation:"manual"
    }
  });

  let marketObserver = null;
  let marketClickGuard = null;

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const same = (a,b) => {
    try {
      return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    } catch {
      return a === b;
    }
  };

  function rootFolder() {
    return (
      list(game.folders).find(folder =>
        String(folder?.type ?? "") === "Item" &&
        String(folder?.name ?? "").trim().toLowerCase() ===
          REVIEW_ROOT.toLowerCase()
      ) ??
      null
    );
  }

  function ancestorChain(folder) {
    const chain = [];
    let current = folder;
    let guard = 0;

    while (current && guard++ < 50) {
      chain.push(current);
      current = current.folder ?? current.parent ?? null;
    }

    return chain;
  }

  function isUnder(item,root) {
    if (!item?.folder || !root) return false;

    return ancestorChain(item.folder).some(folder =>
      String(folder?.id ?? "") === String(root.id)
    );
  }

  function companyFor(item,root) {
    if (!isUnder(item,root)) return null;

    for (const folder of ancestorChain(item.folder)) {
      const company =
        COMPANY_BY_FOLDER[String(folder?.name ?? "")];

      if (company) return company;

      if (
        String(folder?.id ?? "") ===
        String(root.id)
      ) {
        break;
      }
    }

    return null;
  }

  function finishedWeapons() {
    const root = rootFolder();
    if (!root) return [];

    return list(game.items).filter(item =>
      item?.type === "weapon" &&
      Boolean(companyFor(item,root))
    );
  }

  function textFromHtml(html) {
    const node = document.createElement("div");
    node.innerHTML = String(html ?? "");

    return String(node.textContent ?? "")
      .replace(/\u00a0/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function actualDamage(item) {
    const base = item?.system?.damage?.base ?? {};

    const custom =
      String(base?.custom?.formula ?? "").trim();

    if (custom) return custom;

    const count =
      Number(base?.number ?? 0);

    const die =
      Number(base?.denomination ?? 0);

    const bonus =
      String(base?.bonus ?? "").trim();

    if (count > 0 && die > 0) {
      return (
        count+"d"+die+
        (
          bonus
            ? (
                bonus.startsWith("+") ||
                bonus.startsWith("-")
                  ? bonus
                  : "+"+bonus
              )
            : ""
        )
      );
    }

    return "";
  }

  function num(value) {
    const match =
      String(value ?? "").match(/-?\d+/);

    return match
      ? Number(match[0])
      : null;
  }

  function parseReview(item) {
    const html =
      String(
        item?.system?.description?.value ??
        ""
      );

    const text =
      textFromHtml(html);

    const standard =
      /GUN REVIEW/i.test(text);

    const oldProfile =
      /ADK WEAPON PROFILE/i.test(text);

    const out = {
      standard,
      oldProfile,
      text,
      weaponClass:null,
      damage:null,
      range:null,
      longRange:null,
      capacity:undefined,
      capacityLabel:null,
      attacks:undefined,
      reload:undefined,
      strength:undefined,
      strengthLabel:null,
      technology:null,
      note:null
    };

    if (standard) {
      const marker =
        text.toUpperCase().indexOf("GUN REVIEW");

      if (marker >= 0) {
        const after =
          text.slice(marker+"GUN REVIEW".length);

        const nameIndex =
          after.indexOf(String(item.name ?? ""));

        if (nameIndex >= 0) {
          out.weaponClass =
            after.slice(0,nameIndex).trim() ||
            null;
        }
      }
    } else if (oldProfile) {
      const classMatch =
        text.match(
          /Class:\s*(.*?)(?=Weapon System:|Damage:)/
        );

      if (classMatch) {
        out.weaponClass =
          classMatch[1].trim() ||
          null;
      }
    }

    const damageMatch =
      standard
        ? text.match(
            /DAMAGE\s*([0-9]+d[0-9]+(?:\s*[+-]\s*\d+)*)/i
          )
        : text.match(
            /Damage:\s*([0-9]+d[0-9]+(?:\s*[+-]\s*\d+)*)/i
          );

    if (damageMatch) {
      out.damage =
        damageMatch[1]
          .replace(/\s+/g,"");
    }

    const rangeMatch =
      standard
        ? text.match(
            /RANGE\s*(\d+)\s*\/\s*(\d*)\s*ft?/i
          )
        : text.match(
            /Range:\s*(\d+)\s*\/\s*(\d*)\s*ft?/i
          );

    if (rangeMatch) {
      out.range =
        Number(rangeMatch[1]);

      out.longRange =
        rangeMatch[2]
          ? Number(rangeMatch[2])
          : null;
    }

    let capacityMatch = null;

    if (standard) {
      capacityMatch =
        text.match(
          /(PHYSICAL MAG|PHYSICAL SHELLS|ENERGY CAPACITY|HEAT ENDURANCE)\s*([—-]|\d+)/i
        );
    } else {
      capacityMatch =
        text.match(
          /Mag Size:\s*([—-]|\d+|big)/i
        );
    }

    if (capacityMatch) {
      const raw =
        standard
          ? capacityMatch[2]
          : capacityMatch[1];

      out.capacityLabel =
        String(raw).trim();

      if (
        raw === "—" ||
        raw === "-"
      ) {
        out.capacity = null;
      } else if (
        String(raw).toLowerCase() === "big"
      ) {
        out.capacity = undefined;
      } else {
        out.capacity =
          Number(raw);
      }
    }

    if (standard) {
      const attacksMatch =
        text.match(
          /ATTACKS BEFORE (?:RELOAD|RECHARGE)\s*([—-]|\d+)/i
        );

      if (attacksMatch) {
        const raw =
          attacksMatch[1];

        out.attacks =
          raw === "—" ||
          raw === "-"
            ? null
            : Number(raw);
      }
    }

    const reloadMatch =
      standard
        ? text.match(
            /(?:RELOAD|RECHARGE)\s*([—-]|\d+)\s*action/i
          )
        : text.match(
            /Reload Actions:\s*([—-]|\d+)/i
          );

    if (reloadMatch) {
      const raw =
        reloadMatch[1];

      out.reload =
        raw === "—" ||
        raw === "-"
          ? null
          : Number(raw);
    }

    const strengthMatch =
      text.match(
        /STR REQUIREMENT:?\s*([—-]|~?\d+(?:\/\d+)?)/i
      );

    if (strengthMatch) {
      const raw =
        strengthMatch[1];

      out.strengthLabel =
        raw;

      if (
        raw === "—" ||
        raw === "-"
      ) {
        out.strength = null;
      } else if (
        String(raw).includes("/")
      ) {
        const choices =
          String(raw)
            .match(/\d+/g)
            ?.map(Number) ??
          [];

        out.strength =
          choices.length
            ? Math.max(...choices)
            : null;
      } else {
        out.strength =
          num(raw);
      }
    }

    const techMatch =
      text.match(
        /(?:SYSTEM|TECH|Weapon System:)\s*(Power|Smart|Tech|Energy)/i
      );

    if (techMatch) {
      out.technology =
        techMatch[1];
    }

    const noteMatch =
      text.match(
        /GM REVIEW NOTES\s*(.*)$/i
      );

    if (noteMatch) {
      const raw =
        noteMatch[1].trim();

      if (
        raw &&
        !/Write requested changes here/i.test(raw)
      ) {
        out.note = raw;
      }
    }

    return out;
  }

  function normalizeClass(value) {
    const raw =
      String(value ?? "")
        .replace(/\s+/g," ")
        .trim();

    if (!raw) return null;

    const lower =
      raw.toLowerCase();

    if (lower === "shotgun pistol") return "Shotgun Pistol";
    if (lower === "bow") return "Bow";
    if (lower === "heavy pistol") return "Heavy Pistol";
    if (lower === "sniper rifle") return "Sniper Rifle";
    if (lower === "assault rifle") return "Assault Rifle";
    if (lower === "pistol") return "Pistol";
    if (lower === "shotgun") return "Shotgun";
    if (lower === "smg") return "SMG";
    if (lower === "lmg") return "LMG";
    if (lower === "dmr") return "DMR";

    return raw;
  }

  function diceCount(formula) {
    const match =
      String(formula ?? "")
        .match(/^(\d+)d\d+/i);

    return match
      ? Number(match[1])
      : null;
  }

  function resolveReviewed(item) {
    const flags =
      item.flags?.[FLAG] ??
      {};

    const review =
      parseReview(item);

    const actual = {
      damage:actualDamage(item),
      range:
        Number(
          item.system?.range?.value ??
          0
        ) ||
        null,
      longRange:
        item.system?.range?.long == null
          ? null
          : (
              Number(
                item.system.range.long
              ) ||
              null
            )
    };

    const base = {
      weaponClass:
        flags.weaponClass ??
        null,
      damage:
        flags.damageFormula ??
        flags.baseDamageFormula ??
        null,
      range:
        flags.rangeFt ??
        null,
      longRange:
        flags.longRangeFt ??
        null,
      physicalMagazine:
        flags.physicalMagazine ??
        null,
      functionalMagazine:
        flags.functionalMagazine ??
        flags.magazineSize ??
        null,
      capacityType:
        flags.capacityType ??
        null,
      reload:
        flags.reloadActions ??
        null,
      strength:
        flags.strengthRequirement ??
        null,
      technology:
        flags.weaponTechnology ??
        flags.weaponSystem ??
        null
    };

    // Old ADK profile entries were precisely the missed/repaired guns.
    // For those, the description is intentionally authoritative wherever
    // it contains a parseable value.
    const descWins =
      review.oldProfile === true;

    const changedFromBase =
      (value,baseValue) =>
        value !== undefined &&
        !same(value,baseValue);

    const choose =
      (descValue,baseValue,actualValue) => {
        if (descWins) {
          if (descValue !== undefined) return descValue;
          if (actualValue !== undefined) return actualValue;
          return baseValue;
        }

        if (
          descValue !== undefined &&
          changedFromBase(
            descValue,
            baseValue
          )
        ) {
          return descValue;
        }

        if (
          actualValue !== undefined &&
          actualValue !== null &&
          changedFromBase(
            actualValue,
            baseValue
          )
        ) {
          return actualValue;
        }

        if (baseValue !== undefined) {
          return baseValue;
        }

        if (descValue !== undefined) {
          return descValue;
        }

        return actualValue;
      };

    const weaponClass =
      normalizeClass(
        choose(
          review.weaponClass,
          base.weaponClass,
          undefined
        )
      ) ??
      "Firearm";

    let damage =
      String(
        choose(
          review.damage,
          base.damage,
          actual.damage
        ) ??
        actual.damage ??
        "1d6"
      );

    let range =
      Number(
        choose(
          review.range,
          base.range,
          actual.range
        ) ??
        actual.range ??
        30
      );

    let longRange =
      choose(
        review.longRange,
        base.longRange,
        actual.longRange
      );

    if (longRange != null) {
      longRange =
        Number(longRange);
    }

    let capacity =
      choose(
        review.capacity,
        base.physicalMagazine ??
          base.functionalMagazine,
        undefined
      );

    let attacks =
      choose(
        review.attacks,
        base.functionalMagazine,
        undefined
      );

    let reload =
      choose(
        review.reload,
        base.reload,
        undefined
      );

    let strength =
      choose(
        review.strength,
        base.strength,
        undefined
      );

    let technology =
      String(
        choose(
          review.technology,
          base.technology,
          undefined
        ) ??
        "Power"
      );

    // Explicit natural-language GM notes from this completed review.
    const note =
      String(review.note ?? "")
        .toLowerCase();

    if (item.name === "Crusher" && note.includes("5 shells")) {
      capacity = 5;
      attacks = 5;
    }

    if (item.name === "Igla" && note.includes("16d2")) {
      damage = "16d2";
    }

    if (item.name === "Liberty" && note.includes("mag") && note.includes("4")) {
      capacity = 4;
      const count =
        diceCount(damage);

      attacks =
        count && count > 0
          ? Math.max(
              1,
              Math.floor(
                capacity / count
              )
            )
          : 4;
    }

    if (item.name === "Tactician" && note.includes("5")) {
      capacity = 5;
      attacks = 5;
    }

    // Old profile only has one "Mag Size" field. Treat it as the usable
    // capacity and endurance value so the repaired item behaves as written.
    if (
      review.oldProfile &&
      review.capacity !== undefined
    ) {
      attacks =
        review.capacity;
    }

    // Standard energy cards use ENERGY CAPACITY and ATTACKS as the same
    // endurance currency unless the GM explicitly wrote different values.
    const capacityType =
      base.capacityType ??
      (
        technology.toLowerCase() === "energy"
          ? "charge"
          : (
              /shotgun/i.test(weaponClass)
                ? "shells"
                : "rounds"
            )
      );

    if (
      (capacityType === "charge" ||
       capacityType === "heat") &&
      review.capacity !== undefined
    ) {
      attacks =
        review.attacks !== undefined
          ? review.attacks
          : review.capacity;
    }

    return {
      review,
      weaponClass,
      damage,
      range,
      longRange,
      capacity:
        capacity === undefined
          ? null
          : capacity,
      attacks:
        attacks === undefined
          ? null
          : attacks,
      capacityType,
      reload:
        reload === undefined
          ? null
          : reload,
      strength:
        strength === undefined
          ? null
          : strength,
      technology,
      capacityLabel:
        review.capacityLabel,
      strengthLabel:
        review.strengthLabel
    };
  }

  function mechanicalPatch(item,resolved,company) {
    const flags =
      item.flags?.[FLAG] ??
      {};

    const update = {};

    const values = {
      manufacturer:company,
      company,
      weaponGroup:company,
      weaponClass:
        resolved.weaponClass,
      weaponKind:
        resolved.weaponClass === "Bow"
          ? "ranged"
          : "firearm",
      weaponTechnology:
        resolved.technology,
      weaponSystem:
        resolved.technology,
      baseDamageFormula:
        resolved.damage,
      damageFormula:
        resolved.damage,
      rangeFt:
        resolved.range,
      longRangeFt:
        resolved.longRange,
      capacityType:
        resolved.capacityType,
      physicalMagazine:
        (
          resolved.capacityType === "rounds" ||
          resolved.capacityType === "shells"
        )
          ? resolved.capacity
          : null,
      functionalMagazine:
        resolved.attacks,
      magazineSize:
        resolved.attacks,
      reloadActions:
        resolved.reload,
      strengthRequirement:
        resolved.strength,
      capacityLabel:
        resolved.capacityLabel ??
        null,
      strengthLabel:
        resolved.strengthLabel ??
        null,
      sourceCategory:"Weapons",
      shopType:"arms",
      curatedCatalogV10:true,
      catalogEnabled:true,
      marketReady:true,
      marketPass:"do-these-finalized-4.1",
      marketCategory:"Weapons",
      weaponReadiness:"done",
      weaponReadinessVersion:VERSION,
      needsReview:false,
      noMk:true,
      doTheseFinalized:true,
      doTheseFinalizedVersion:VERSION,
      reviewImportVersion:
        REVIEW_IMPORT
    };

    const special =
      SPECIAL_OVERRIDES[
        String(item.name ?? "")
      ] ??
      null;

    if (special) {
      values.specialRule =
        special;

      values.effectText =
        special.text;
    }

    for (
      const [key,value] of
      Object.entries(values)
    ) {
      if (!same(flags[key],value)) {
        update[
          "flags."+FLAG+"."+key
        ] = value;
      }
    }

    for (const stale of [
      "mk",
      "rating",
      "tier",
      "ratingLabel",
      "marketTier"
    ]) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(flags,stale)
      ) {
        update[
          "flags."+FLAG+".-="+stale
        ] = null;
      }
    }

    const currentDamage =
      actualDamage(item);

    if (
      String(currentDamage) !==
      String(resolved.damage)
    ) {
      update[
        "system.damage.base.number"
      ] = 0;

      update[
        "system.damage.base.denomination"
      ] = 0;

      update[
        "system.damage.base.bonus"
      ] = "";

      update[
        "system.damage.base.types"
      ] = ["piercing"];

      update[
        "system.damage.base.custom.enabled"
      ] = true;

      update[
        "system.damage.base.custom.formula"
      ] = resolved.damage;
    }

    if (
      Number(
        item.system?.range?.value ??
        0
      ) !==
      Number(resolved.range)
    ) {
      update[
        "system.range.value"
      ] = Number(
        resolved.range
      );
    }

    if (
      !same(
        item.system?.range?.long ??
          null,
        resolved.longRange ??
          null
      )
    ) {
      update[
        "system.range.long"
      ] =
        resolved.longRange ??
        null;
    }

    if (
      String(
        item.system?.range?.units ??
        ""
      ) !== "ft"
    ) {
      update[
        "system.range.units"
      ] = "ft";
    }

    if (
      resolved.weaponClass !== "Bow" &&
      String(
        item.system?.type?.value ??
        ""
      ) !== "martialR"
    ) {
      update[
        "system.type.value"
      ] = "martialR";
    }

    return update;
  }

  function finalFlags(item,company) {
    const flags =
      item.flags?.[FLAG] ??
      {};

    const update = {};

    const values = {
      manufacturer:company,
      company,
      weaponGroup:company,
      sourceCategory:"Weapons",
      shopType:"arms",
      curatedCatalogV10:true,
      catalogEnabled:true,
      marketReady:true,
      marketPass:"do-these-finalized-4.1",
      marketCategory:"Weapons",
      weaponReadiness:"done",
      weaponReadinessVersion:VERSION,
      needsReview:false,
      noMk:true,
      doTheseFinalized:true,
      doTheseFinalizedVersion:VERSION
    };

    for (
      const [key,value] of
      Object.entries(values)
    ) {
      if (!same(flags[key],value)) {
        update[
          "flags."+FLAG+"."+key
        ] = value;
      }
    }

    for (const stale of [
      "mk",
      "rating",
      "tier",
      "ratingLabel",
      "marketTier"
    ]) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(flags,stale)
      ) {
        update[
          "flags."+FLAG+".-="+stale
        ] = null;
      }
    }

    return update;
  }

  async function demoteOldManaged(finishedIds) {
    const blockedIds =
      new Set();

    let demoted = 0;

    for (const item of list(game.items)) {
      if (
        item?.type !== "weapon"
      ) {
        continue;
      }

      if (
        finishedIds.has(
          String(item.id)
        )
      ) {
        continue;
      }

      const flags =
        item.flags?.[FLAG] ??
        {};

      const marketPass =
        String(
          flags.marketPass ??
          ""
        );

      const managed =
        flags.marketReady === true &&
        (
          marketPass.startsWith("weapon-") ||
          marketPass.startsWith("do-these-")
        );

      if (!managed) continue;
      if (legacyIdentifierQuarantined(item)) continue;

      await item.update({
        ["flags."+FLAG+".marketReady"]:false,
        ["flags."+FLAG+".catalogEnabled"]:false,
        ["flags."+FLAG+".curatedCatalogV10"]:false,
        ["flags."+FLAG+".shopType"]:"none",
        ["flags."+FLAG+".sourceCategory"]:"Weapons_Unfinished",
        ["flags."+FLAG+".marketCategory"]:"Weapons_Unfinished",
        ["flags."+FLAG+".weaponReadiness"]:"not-done",
        ["flags."+FLAG+".doTheseFinalized"]:false
      });

      blockedIds.add(
        String(item.id)
      );

      demoted++;
    }

    return {
      demoted,
      blockedIds
    };
  }

  async function cleanMarketStock(blockedIds) {
    if (!blockedIds?.size) return 0;

    const fullKey =
      "world."+STOCK_KEY;

    if (
      !game.settings?.settings?.has?.(
        fullKey
      )
    ) {
      return 0;
    }

    const current =
      globalThis.foundry?.utils?.deepClone?.(
        game.settings.get(
          "world",
          STOCK_KEY
        ) ??
        {}
      ) ??
      {};

    let removed = 0;
    let changed = false;

    for (
      const [key,ids] of
      Object.entries(current)
    ) {
      if (!Array.isArray(ids)) continue;

      const next =
        ids.filter(id => {
          const blocked =
            blockedIds.has(
              String(id)
            );

          if (blocked) removed++;

          return !blocked;
        });

      if (
        next.length !==
        ids.length
      ) {
        current[key] =
          next;

        changed = true;
      }
    }

    if (changed) {
      await game.settings.set(
        "world",
        STOCK_KEY,
        current
      );
    }

    return removed;
  }

  function marketEligible(item) {
    if (
      !item ||
      item.type !== "weapon"
    ) {
      return true;
    }

    return (
      item.flags?.[FLAG]
        ?.marketReady === true
    );
  }

  function guardMarketDom() {
    const root =
      document.getElementById(
        "adk-market-15"
      );

    if (!root) return;

    for (
      const node of
      root.querySelectorAll(
        "[data-buy-item]," +
        "[data-open-item]"
      )
    ) {
      const card =
        node.closest(
          ".item-card"
        );

      const id =
        String(
          node?.dataset?.buyItem ??
          node?.dataset?.openItem ??
          ""
        );

      const item =
        game.items?.get?.(id) ??
        null;

      if (
        card &&
        item?.type === "weapon" &&
        !marketEligible(item)
      ) {
        card.remove();
      }
    }
  }

  function installMarketGuard() {
    if (
      marketObserver ||
      marketClickGuard
    ) {
      return;
    }

    marketClickGuard =
      event => {
        const node =
          event.target?.closest?.(
            "#adk-market-15 [data-buy-item]," +
            "#adk-market-15 [data-open-item]"
          ) ??
          null;

        if (!node) return;

        const id =
          String(
            node?.dataset?.buyItem ??
            node?.dataset?.openItem ??
            ""
          );

        const item =
          game.items?.get?.(id) ??
          null;

        if (
          item?.type !== "weapon" ||
          marketEligible(item)
        ) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        ui.notifications?.warn?.(
          "That weapon is outside the finalized Do these set."
        );
      };

    document.addEventListener(
      "click",
      marketClickGuard,
      true
    );

    marketObserver =
      new MutationObserver(
        () => {
          queueMicrotask(
            guardMarketDom
          );
        }
      );

    marketObserver.observe(
      document.body,
      {
        childList:true,
        subtree:true
      }
    );

    guardMarketDom();
  }

  function removeMarketGuard() {
    try {
      marketObserver
        ?.disconnect?.();
    } catch {}

    marketObserver = null;

    if (marketClickGuard) {
      document.removeEventListener(
        "click",
        marketClickGuard,
        true
      );
    }

    marketClickGuard = null;
  }

  function isDoneWeapon(item) {
    if (
      item?.type !== "weapon"
    ) {
      return false;
    }

    const root =
      rootFolder();

    return Boolean(
      (
        root &&
        companyFor(
          item,
          root
        )
      ) ||
      item.flags?.[FLAG]
        ?.doTheseFinalized === true
    );
  }

  async function migrate() {
    if (!game.user?.isGM) {
      return {
        skipped:true,
        finished:
          finishedWeapons().length,
        imported:0,
        updated:0,
        demoted:0,
        staleStockRemoved:0
      };
    }

    const root =
      rootFolder();

    if (!root) {
      throw new Error(
        "FEHA Weapon Finalizer could not find the Item folder named '" +
        REVIEW_ROOT +
        "'."
      );
    }

    const finished =
      finishedWeapons();

    const finishedIds =
      new Set(
        finished.map(
          item =>
            String(item.id)
        )
      );

    let imported = 0;
    let updated = 0;

    for (
      const item of
      finished
    ) {
      const company =
        companyFor(
          item,
          root
        );

      if (!company) continue;
      if (legacyIdentifierQuarantined(item)) continue;

      const importedBefore =
        String(
          item.flags?.[FLAG]
            ?.reviewImportVersion ??
          ""
        ) === REVIEW_IMPORT;

      const patch =
        importedBefore
          ? finalFlags(
              item,
              company
            )
          : mechanicalPatch(
              item,
              resolveReviewed(item),
              company
            );

      // 0.11.38 repair: the Do these folder tree is authoritative. Some items
      // had the completed review/import flags but still retained the legacy
      // "ADK WEAPON PROFILE" HTML. Repair the card from the permanent reviewed
      // catalog once, independently of the old import stamp.
      const catalog =
        globalThis.FEHA_WEAPON_CATALOG ??
        game.adk?.weapons ??
        null;

      const definition =
        catalog?.definition?.(item) ??
        null;

      const repairedBefore =
        String(
          item.flags?.[FLAG]
            ?.descriptionRepairVersion ??
          ""
        ) === DESCRIPTION_REPAIR;

      if (
        definition &&
        !repairedBefore
      ) {
        patch["system.description.value"] =
          catalog.rewriteDescription(
            definition
          );

        patch[
          "flags."+FLAG+
          ".descriptionRepairVersion"
        ] = DESCRIPTION_REPAIR;
      }

      if (
        !Object.keys(patch).length
      ) {
        continue;
      }

      try {
        await item.update(
          patch
        );

        updated++;

        if (!importedBefore) {
          imported++;
        }
      } catch (error) {
        console.warn(
          "FEHA DO THESE // review import failed",
          item?.name,
          item?.id,
          error
        );
      }
    }

    const demotion =
      await demoteOldManaged(
        finishedIds
      );

    const staleStockRemoved =
      await cleanMarketStock(
        demotion.blockedIds
      );

    try {
      const reroll =
        document.querySelector(
          "#adk-market-15 #reroll-stock"
        );

      if (reroll) {
        reroll.click();
      } else {
        globalThis.ADKMarket
          ?.refresh?.();
      }
    } catch {}

    guardMarketDom();

    const result = {
      skipped:false,
      finished:finished.length,
      imported,
      updated,
      demoted:
        demotion.demoted,
      staleStockRemoved,
      byCompany:
        Object.fromEntries(
          Object.values(
            COMPANY_BY_FOLDER
          ).map(company => [
            company,
            finished.filter(
              item =>
                companyFor(
                  item,
                  root
                ) === company
            ).length
          ])
        )
    };

    console.log(
      "FEHA DO THESE WEAPON FINALIZER",
      VERSION,
      result
    );

    ui.notifications?.info?.(
      "FEHA guns finalized from Do these: " +
      finished.length +
      " weapons // " +
      imported +
      " review edits imported."
    );

    return result;
  }

  const api = {
    version:VERSION,
    reviewImportVersion:
      REVIEW_IMPORT,

    get doneNames() {
      return finishedWeapons()
        .map(
          item =>
            String(
              item?.name ??
              ""
            ).trim()
        )
        .filter(Boolean);
    },

    isDoneWeapon,
    resolveReviewed,
    migrate,

    async init() {
      globalThis.FEHA_WEAPON_READINESS =
        api;

      game.adk ??= {};
      game.adk.weaponReadiness =
        api;

      installMarketGuard();

      if (game.user?.isGM) {
        await migrate();
      }
    },

    async destroy() {
      removeMarketGuard();

      if (
        game?.adk
          ?.weaponReadiness ===
        api
      ) {
        delete game.adk
          .weaponReadiness;
      }

      if (
        globalThis
          .FEHA_WEAPON_READINESS ===
        api
      ) {
        delete globalThis
          .FEHA_WEAPON_READINESS;
      }
    }
  };

  core.registerModule(
    "weaponReadiness",
    api
  );

  globalThis.FEHA_WEAPON_READINESS =
    api;
})();
