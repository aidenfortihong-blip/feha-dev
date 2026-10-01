// FEHA // WEAPON HANDLING
//
// Class-based weapon handling rules shared by the weapon sheet, reload
// tracker and catalog cards:
//
//   Reload       Pistol / Heavy Pistol / SMG / Shotgun Pistol -> Bonus Action
//                Assault Rifle / DMR / Shotgun / Bow / single-shot -> Action
//                LMG / Sniper Rifle -> Full turn (Action, cannot move) and a
//                reload check: LMG Strength / Sniper Dexterity vs DC = the
//                weapon's STR requirement (10 if none). Fail = try again.
//   STR          Below a weapon's STR requirement: disadvantage and max 10 ft
//                movement on turns you use it, unless installed cyberware
//                negates it (STR_NEGATORS).
//   Brace (LMG)  Disadvantage if you moved more than 10 ft this turn.
//   Scoped       Snipers (except close-range snipers) have disadvantage
//                against targets within 30 ft.
//
// Disadvantage for STR and Scoped is applied automatically through
// dnd5e.preRollAttackV2 (every attack path, not only the sheet button).
// Movement limits and Brace are table rules surfaced on the sheet.

(() => {
  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";

  const BONUS_RELOAD = new Set(["Pistol","Heavy Pistol","SMG","Shotgun Pistol"]);
  const FULL_RELOAD = new Set(["LMG","Sniper Rifle"]);
  const CLOSE_RANGE_SNIPERS = new Set(["Ashura","Long Vigil"]);
  const SCOPED_MIN_FT = 30;

  // Installed cyberware that removes the STR-requirement penalty. Edit freely
  // when cyberware is reworked; matching ignores a trailing Mk suffix.
  const STR_NEGATORS = new Set([
    "Strong Arms",
    "Power Grip",
    "Reinforced Muscles",
    "Gun Stabilizer"
  ]);

  const baseName = name =>
    String(name ?? "").replace(/\s*Mk\.?\s*[IVX]+$/i,"").trim();

  function definition(item) {
    return (
      globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.definition?.(item) ??
      globalThis.FEHA_MELEE_CATALOG?.definition?.(item) ??
      null
    );
  }

  function isMelee(def) {
    return Boolean(def && (def.reach || def.range == null) && !def.functionalAttacks);
  }

  function profile(defOrItem) {
    const def = defOrItem?.weaponClass ? defOrItem : definition(defOrItem);
    if (!def) return null;

    const cls = String(def.weaponClass ?? "");
    const melee = isMelee(def);
    const singleShot = !melee && Number(def.functionalAttacks) === 1;
    const sniper = cls === "Sniper Rifle";
    const closeRange = CLOSE_RANGE_SNIPERS.has(def.name);

    let reload = "none";
    if (!melee) {
      if (FULL_RELOAD.has(cls)) reload = "full";
      else if (singleShot) reload = "action";
      else if (BONUS_RELOAD.has(cls)) reload = "bonus";
      else reload = "action";
    }

    const reloadCheck = reload === "full"
      ? {
          ability:cls === "LMG" ? "str" : "dex",
          label:cls === "LMG" ? "STRENGTH" : "DEXTERITY",
          dc:Number(def.strengthRequirement) || 10
        }
      : null;

    return {
      melee,
      weaponClass:cls,
      reload,
      reloadCheck,
      reloadLabel:{
        bonus:"BONUS ACTION",
        action:"ACTION",
        full:"FULL TURN",
        none:"—"
      }[reload],
      brace:cls === "LMG",
      scoped:sniper && !closeRange,
      closeRange:sniper && closeRange,
      strengthRequirement:Number(def.strengthRequirement) || null
    };
  }

  // Rules lines for catalog cards and the weapon sheet.
  function rulesText(defOrItem) {
    const p = profile(defOrItem);
    if (!p) return [];
    const lines = [];
    if (p.reload === "bonus") lines.push("RELOAD // Bonus Action.");
    if (p.reload === "action") lines.push("RELOAD // Action.");
    if (p.reload === "full") {
      lines.push(
        "RELOAD // Full turn: your Action, you cannot move, and you make a DC " +
        p.reloadCheck.dc + " " + p.reloadCheck.label +
        " check (some feats or cyberware remove the check). On a failure the reload does not complete; try again next turn."
      );
    }
    if (p.brace) lines.push("BRACE // Attacks have disadvantage if you moved more than 10 ft this turn.");
    if (p.scoped) lines.push("SCOPED // Disadvantage against targets within 30 ft.");
    if (p.closeRange) lines.push("CLOSE-RANGE SNIPER // No scope penalty.");
    if (p.strengthRequirement) {
      lines.push(
        "STR " + p.strengthRequirement +
        " // Below it: disadvantage and max 10 ft movement on turns you use this weapon, unless installed cyberware negates it."
      );
    }
    return lines;
  }

  // Feats / cyberware can opt into handling exemptions with
  //   flags.fleshEnshrouded.handling = {
  //     skipReloadCheck: true,      // full-turn reloads need no check
  //     reloadAdvantage: true,      // reload check rolls with advantage
  //     negateStrRequirement: true  // ignore STR-requirement penalties
  //   }
  // Cyberware counts only while installed; feats and other items always count.
  function grants(actor, key) {
    return [...(actor?.items ?? [])].filter(item => {
      const f = item?.flags?.[FLAG] ?? {};
      if (f.handling?.[key] !== true) return false;
      const isCyberware = f.sourceCategory === "Cyberware" || f.cyberwareSlot;
      return !isCyberware || f.installed === true || f.isInstalled === true;
    });
  }

  function negatingCyberware(actor) {
    const named = [...(actor?.items ?? [])].filter(item => {
      const f = item?.flags?.[FLAG] ?? {};
      const installed = f.installed === true || f.isInstalled === true;
      return installed && STR_NEGATORS.has(baseName(item.name));
    });
    return [...new Set([...named, ...grants(actor, "negateStrRequirement")])];
  }

  function strPenalty(actor, defOrItem) {
    const p = profile(defOrItem);
    const req = p?.strengthRequirement;
    const str = Number(actor?.system?.abilities?.str?.value ?? 0);
    if (!req || !actor || str >= req) {
      return {under:false, negated:false, req, str, by:[]};
    }
    const by = negatingCyberware(actor).map(i => i.name);
    return {under:true, negated:by.length > 0, req, str, by};
  }

  function tokenFor(actor) {
    return actor?.getActiveTokens?.()?.[0] ?? null;
  }

  function distanceFt(a, b) {
    try {
      const path = canvas?.grid?.measurePath?.([a.center, b.center]);
      if (path && Number.isFinite(path.distance)) return path.distance;
    } catch {}
    return null;
  }

  function scopedTooClose(actor) {
    const self = tokenFor(actor);
    if (!self) return [];
    return [...(game.user?.targets ?? [])].filter(t => {
      const d = distanceFt(self, t);
      return d != null && d <= SCOPED_MIN_FT;
    });
  }

  // Reasons this attack must roll with disadvantage (automated rules only).
  function attackPenalties(item) {
    const actor = item?.actor ?? item?.parent ?? null;
    const p = profile(item);
    if (!actor || !p) return [];
    const reasons = [];
    const s = strPenalty(actor, item);
    if (s.under && !s.negated) reasons.push("STR " + s.str + " below requirement " + s.req);
    if (p.scoped) {
      const close = scopedTooClose(actor);
      if (close.length) reasons.push("SCOPED: target within " + SCOPED_MIN_FT + " ft");
    }
    return reasons;
  }

  // Rolls the reload check for full-reload weapons. Returns {ok, roll, total}.
  // Weapons without a check always succeed.
  async function rollReloadCheck(item) {
    const actor = item?.actor ?? item?.parent ?? null;
    const p = profile(item);
    if (!p?.reloadCheck) return {ok:true, skipped:true};
    const skipBy = grants(actor, "skipReloadCheck");
    if (skipBy.length) return {ok:true, skipped:true, by:skipBy.map(i => i.name)};
    if (!actor?.rollAbilityCheck) return {ok:false, reason:"no-actor"};
    const {ability, dc, label} = p.reloadCheck;
    const advantage = grants(actor, "reloadAdvantage").length > 0;
    const rolls = await actor.rollAbilityCheck(
      {ability, target:dc, advantage},
      {},
      {data:{flavor:"RELOAD // " + item.name + " // " + label + " DC " + dc}}
    );
    const roll = Array.isArray(rolls) ? rolls[0] : rolls;
    if (!roll) return {ok:false, reason:"cancelled"};
    return {ok:Number(roll.total) >= dc, roll, total:Number(roll.total), dc};
  }

  let hookId = null;

  function onPreRollAttack(config) {
    try {
      const item = config?.subject?.item ?? config?.subject?.parent?.parent ?? null;
      if (!item || item.type !== "weapon") return;
      const reasons = attackPenalties(item);
      if (!reasons.length) return;
      config.disadvantage = true;
      for (const roll of config.rolls ?? []) {
        roll.options ??= {};
        roll.options.disadvantage = true;
      }
      ui.notifications?.info?.(
        "FEHA // " + item.name + " attacks with disadvantage: " + reasons.join("; ") + "."
      );
    } catch (error) {
      console.warn("FEHA WEAPON HANDLING // preRollAttack failed", error);
    }
  }

  function init() {
    destroy();
    hookId = Hooks.on("dnd5e.preRollAttackV2", onPreRollAttack);
  }

  function destroy() {
    if (hookId != null) {
      try { Hooks.off("dnd5e.preRollAttackV2", hookId); } catch {}
      hookId = null;
    }
  }

  const api = {
    version:VERSION,
    BONUS_RELOAD,
    FULL_RELOAD,
    CLOSE_RANGE_SNIPERS,
    STR_NEGATORS,
    profile,
    rulesText,
    strPenalty,
    attackPenalties,
    rollReloadCheck,
    init,
    destroy
  };

  globalThis.FEHA_WEAPON_HANDLING?.destroy?.();
  globalThis.FEHA_WEAPON_HANDLING = api;
  if (globalThis.game) {
    game.adk ??= {};
    game.adk.weaponHandling = api;
  }
  init();
})();
