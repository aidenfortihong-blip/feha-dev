// FEHA // WEAPON HANDLING
//
// Class-based weapon handling rules shared by the weapon sheet, reload
// tracker and catalog cards:
//
//   Reload       Pistol / Heavy Pistol / SMG / Shotgun Pistol -> Bonus Action
//                Assault Rifle / DMR / Shotgun / Bow / single-shot -> Action
//                LMG / Sniper Rifle -> Full turn (Action, cannot move) and a
//                Dexterity reload check vs DC = the weapon's STR requirement
//                (10 if none). Fail = try again.
//   STR          Below a weapon's STR requirement: disadvantage and max 10 ft
//                movement on turns you use it, unless installed cyberware
//                negates it (STR_NEGATORS).
//   Brace (LMG)  Disadvantage if you moved more than 10 ft this turn
//                (measured from where your turn started; in combat only).
//   Scoped       Snipers (except close-range snipers) have disadvantage
//                against targets within 30 ft.
//
// Disadvantage for STR, Scoped and Brace is applied automatically through
// dnd5e.preRollAttackV2 (every attack path, not only the sheet button).
// The 10 ft movement limits themselves are table rules surfaced on the sheet.

(() => {
  const VERSION = "1.6.0";
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
          ability:"dex",
          label:"DEXTERITY",
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
    if (p.brace) lines.push("BRACE // Attacks have disadvantage if you moved more than 10 ft this turn (applied automatically in combat).");
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

  // ---- Brace (LMG) ---------------------------------------------------------
  // Where each combatant stood when its turn began. Brace compares that spot
  // with where the shooter is now, so "moved more than 10 ft this turn" means
  // ended up more than 10 ft from where the turn started (walking out and
  // back is not counted). Kept in memory per client; a client that joins
  // mid-turn simply has no record and applies no penalty.
  const BRACE_MAX_FT = 10;
  let turnStart = null;

  function currentTurnKey(combat=game.combat) {
    if (!combat?.started) return "";
    return [combat.id,combat.round,combat.turn].join(":");
  }

  function rememberTurnStart(combat=game.combat) {
    const key = currentTurnKey(combat);
    const tokenId = combat?.combatant?.tokenId ?? null;
    const token = tokenId ? canvas?.tokens?.get?.(tokenId) ?? null : null;

    turnStart = key && token
      ? {key, tokenId, center:{x:token.center.x, y:token.center.y}}
      : null;
  }

  function movedThisTurnFt(actor) {
    if (!turnStart || turnStart.key !== currentTurnKey()) return null;
    const token = canvas?.tokens?.get?.(turnStart.tokenId) ?? null;
    if (!token || token.actor?.id !== actor?.id) return null;
    try {
      const path = canvas.grid.measurePath([turnStart.center, token.center]);
      return Number.isFinite(path?.distance) ? path.distance : null;
    } catch {
      return null;
    }
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
    if (p.brace) {
      const moved = movedThisTurnFt(actor);
      if (moved != null && moved > BRACE_MAX_FT + 0.01) {
        reasons.push("BRACE: moved " + Math.round(moved) + " ft this turn");
      }
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
    // No configuration dialog: the DC and advantage are fixed by the rules, and
    // a generic "Strength Ability Check" prompt hid what was being rolled.
    const rolls = await actor.rollAbilityCheck(
      {ability, target:dc, advantage},
      {configure:false},
      {data:{flavor:"RELOAD // " + item.name + " // " + label + " DC " + dc}}
    );
    const roll = Array.isArray(rolls) ? rolls[0] : rolls;
    if (!roll) return {ok:false, reason:"cancelled"};
    return {ok:Number(roll.total) >= dc, roll, total:Number(roll.total), dc};
  }

  let hookId = null;
  let combatHookIds = [];
  let coverHookId = null;
  let coverRenderHookId = null;

  // Cover is not automated: whoever rolls damage picks the target's cover in
  // the damage roll window (None / Half -25% / Three-Quarters -50%). The
  // choice rides on the rolls into the chat card, and Apply Damage cuts by it
  // before armor soak.
  const COVER_CUT = {half:0.75, threeQuarters:0.5};
  const COVER_LABEL = {half:"HALF COVER (-25%)", threeQuarters:"THREE-QUARTERS COVER (-50%)"};

  function rollCover(options={}) {
    const rolls = options?.originatingMessage?.rolls ?? [];
    for (const roll of rolls) {
      const cover = roll?.options?.fehaCover;
      if (COVER_CUT[cover]) return cover;
    }
    return null;
  }

  function onPreCalculateDamage(actor,damages,options={}) {
    try {
      if (options?.only === "healing") return;
      const cover = rollCover(options);
      if (!cover) return;
      for (const d of damages ?? []) {
        if (!d || d.type in (CONFIG.DND5E.healingTypes ?? {})) continue;
        if (Number(d.value) > 0) d.value = Math.floor(Number(d.value) * COVER_CUT[cover]);
      }
    } catch (error) {
      console.warn("FEHA WEAPON HANDLING // cover damage failed", error);
    }
  }

  // The cover picker in dnd5e's damage roll window.
  function onRenderDamageDialog(app, element) {
    try {
      const root = element instanceof HTMLElement ? element : app.element;
      const form = root?.querySelector?.("form") ?? (root?.tagName === "FORM" ? root : root);
      if (!form || form.querySelector("[data-feha-cover]")) return;
      const current = app._fehaCover ?? "";
      const wrap = document.createElement("div");
      wrap.className = "form-group";
      wrap.dataset.fehaCover = "1";
      wrap.innerHTML =
        '<label>Target cover</label>' +
        '<div class="form-fields"><select data-feha-cover-select>' +
        '<option value="">None</option>' +
        '<option value="half">Half cover (-25% damage)</option>' +
        '<option value="threeQuarters">Three-quarters cover (-50% damage)</option>' +
        '</select></div>';
      const select = wrap.querySelector("select");
      select.value = current;
      select.addEventListener("change", event => {
        event.stopPropagation();
        app._fehaCover = select.value;
      });
      const anchor = form.querySelector("footer, .form-footer, [data-application-part='buttons']");
      if (anchor?.parentElement) anchor.parentElement.insertBefore(wrap, anchor);
      else form.append(wrap);
    } catch (error) {
      console.warn("FEHA WEAPON HANDLING // cover picker failed", error);
    }
  }

  let coverPatch = null;
  function patchDamageDialog() {
    const D = globalThis.dnd5e?.applications?.dice?.DamageRollConfigurationDialog;
    if (!D || coverPatch) return;
    const original = D.prototype._finalizeRolls;
    D.prototype._finalizeRolls = function(...args) {
      const rolls = original.apply(this, args);
      const cover = this._fehaCover;
      if (COVER_CUT[cover]) {
        for (const roll of rolls ?? []) {
          roll.options ??= {};
          roll.options.fehaCover = cover;
        }
        const data = this.message?.data;
        if (data) data.flavor = String(data.flavor ?? "") + " // TARGET IN " + COVER_LABEL[cover];
      }
      return rolls;
    };
    coverPatch = {D, original};
  }

  function unpatchDamageDialog() {
    if (!coverPatch) return;
    coverPatch.D.prototype._finalizeRolls = coverPatch.original;
    coverPatch = null;
  }

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

  // Cover AC: Half +3, Three-Quarters +6 (dnd5e: +2 / +5).
  const COVER_AC = {coverHalf:3, coverThreeQuarters:6};
  function raiseCoverAc() {
    for (const status of CONFIG.statusEffects ?? []) {
      if (COVER_AC[status?.id]) status.coverBonus = COVER_AC[status.id];
    }
    // dnd5e reads the bonus from its own status list.
    for (const [id,ac] of Object.entries(COVER_AC)) {
      const entry = CONFIG.DND5E?.statusEffects?.[id];
      if (entry) entry.coverBonus = ac;
    }
  }

  // Weapon load: carrying a heavy weapon slows you down. Only the heaviest
  // equipped weapon counts. The same chrome that removes the STR penalty
  // (Strong Arms, Power Grip, Reinforced Muscles, Gun Stabilizer, or any
  // item flagged handling.negateWeaponWeight) removes it.
  const WEAPON_LOAD = {
    "Assault Rifle":5, "Shotgun":5, "DMR":5, "Heavy Blunt":10,
    "Sniper Rifle":10, "Heavy Blade":10, "Heavy Axe":10, "LMG":15
  };
  const LOAD_FLAG = "weaponLoad";
  // Load-bearing chrome that also carries the weight (on top of the STR set).
  const LOAD_NEGATORS = new Set(["Titanium Infused Bones","ForgeLine Sigma"]);

  function loadClass(item) {
    if (item?.type !== "weapon" || item.system?.equipped !== true) return 0;
    const f = item.flags?.[FLAG] ?? {};
    const cls = definition(item)?.weaponClass ?? f.weaponClass ?? f.meleeClass ?? "";
    return WEAPON_LOAD[cls] ?? 0;
  }

  function weaponLoad(actor) {
    const items = [...(actor?.items ?? [])];
    const heaviest = items.reduce((best, item) => {
      const ft = loadClass(item);
      return ft > best.ft ? {ft, item} : best;
    }, {ft:0, item:null});
    if (!heaviest.ft) return {ft:0, item:null, negatedBy:[]};
    const loadChrome = items.filter(item => {
      const f = item?.flags?.[FLAG] ?? {};
      return (f.installed === true || f.isInstalled === true) && LOAD_NEGATORS.has(baseName(item.name));
    });
    const negatedBy = [...new Set([...negatingCyberware(actor), ...loadChrome, ...grants(actor, "negateWeaponWeight")])].map(i => i.name);
    return {...heaviest, negatedBy};
  }

  // The active GM keeps one "Weapon Load" effect on the actor in step. Syncs
  // for one actor run one after another: several item events in a row (equip
  // swaps, installs) used to delete the same effect twice.
  const loadQueue = new Map();
  function syncWeaponLoad(actor) {
    if (!actor || game.users?.activeGM?.isSelf !== true) return Promise.resolve(false);
    const run = (loadQueue.get(actor.id) ?? Promise.resolve())
      .catch(() => {})
      .then(() => syncWeaponLoadNow(actor));
    loadQueue.set(actor.id, run);
    return run;
  }

  async function syncWeaponLoadNow(actor) {
    const current = [...(actor.effects ?? [])].filter(e => e.flags?.[FLAG]?.[LOAD_FLAG] === true);
    const load = weaponLoad(actor);
    const ft = load.negatedBy.length ? 0 : load.ft;
    if (!ft) {
      if (current.length) await actor.deleteEmbeddedDocuments("ActiveEffect", current.map(e => e.id));
      return current.length > 0;
    }
    if (current.length === 1 && Number(current[0].flags?.[FLAG]?.ft) === ft) return false;
    if (current.length) await actor.deleteEmbeddedDocuments("ActiveEffect", current.map(e => e.id));
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name:"WEAPON LOAD // -" + ft + " FT",
      img:load.item?.img ?? null,
      type:"base",
      system:{changes:[{key:"system.attributes.movement.walk", value:String(-ft), type:"add", priority:null}]},
      disabled:false,
      duration:{value:null, units:"seconds", expiry:null, expired:false},
      description:"Carrying " + String(load.item?.name ?? "a heavy weapon") + ": -" + ft + " ft walking Speed. Strong Arms, Power Grip, Reinforced Muscles, Gun Stabilizer, Titanium Infused Bones or ForgeLine Sigma removes this.",
      origin:null,
      transfer:false,
      statuses:[],
      flags:{[FLAG]:{[LOAD_FLAG]:true, ft}}
    }]);
    return true;
  }

  let loadHookIds = [];
  function installWeaponLoad() {
    const onItem = item => {
      const actor = item?.parent?.documentName === "Actor" ? item.parent : null;
      if (actor) queueMicrotask(() => void syncWeaponLoad(actor).catch(() => {}));
    };
    loadHookIds = ["createItem","updateItem","deleteItem"].map(event => [event, Hooks.on(event, onItem)]);
    if (game.users?.activeGM?.isSelf === true) {
      for (const actor of game.actors ?? []) void syncWeaponLoad(actor).catch(() => {});
    }
  }

  function init() {
    destroy();
    hookId = Hooks.on("dnd5e.preRollAttackV2", onPreRollAttack);
    coverHookId = Hooks.on("dnd5e.preCalculateDamage", onPreCalculateDamage);
    coverRenderHookId = Hooks.on("renderDamageRollConfigurationDialog", onRenderDamageDialog);
    patchDamageDialog();
    raiseCoverAc();
    installWeaponLoad();

    const onTurn = (combat, changed) => {
      if (changed && !("turn" in changed) && !("round" in changed)) return;
      if (combat !== game.combat) return;
      rememberTurnStart(combat);
    };

    combatHookIds = [
      ["updateCombat", Hooks.on("updateCombat", onTurn)],
      ["combatStart", Hooks.on("combatStart", combat => onTurn(combat, null))],
      ["deleteCombat", Hooks.on("deleteCombat", () => { turnStart = null; })]
    ];

    // Loaded mid-turn: treat the current spot as the turn's start.
    rememberTurnStart();
  }

  function destroy() {
    if (hookId != null) {
      try { Hooks.off("dnd5e.preRollAttackV2", hookId); } catch {}
      hookId = null;
    }
    for (const [event, id] of loadHookIds.splice(0)) {
      try { Hooks.off(event, id); } catch {}
    }
    if (coverRenderHookId != null) {
      try { Hooks.off("renderDamageRollConfigurationDialog", coverRenderHookId); } catch {}
      coverRenderHookId = null;
    }
    unpatchDamageDialog();
    if (coverHookId != null) {
      try { Hooks.off("dnd5e.preCalculateDamage", coverHookId); } catch {}
      coverHookId = null;
    }
    for (const [event, id] of combatHookIds.splice(0)) {
      try { Hooks.off(event, id); } catch {}
    }
    turnStart = null;
  }

  const api = {
    version:VERSION,
    BONUS_RELOAD,
    FULL_RELOAD,
    WEAPON_LOAD,
    weaponLoad,
    syncWeaponLoad,
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
