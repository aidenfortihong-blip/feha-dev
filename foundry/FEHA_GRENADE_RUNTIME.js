// FEHA // GRENADE RUNTIME
// Physical grenade placement, measured templates, silent GM authority,
// automatic saves/damage/statuses/ticks, persistent zones, and cleanup.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  const catalog = globalThis.FEHA_GRENADE_CATALOG;

  if (!core) throw new Error("FEHA_GRENADE_RUNTIME requires FEHA_CYBER_CORE.");
  if (!catalog) throw new Error("FEHA_GRENADE_RUNTIME requires FEHA_GRENADE_CATALOG.");

  const VERSION = "1.4.5";
  const FLAG = "fleshEnshrouded";
  // FEHA messages travel over Foundry's user-to-user queries. The installed
  // module does not declare a socket, so the server never relayed
  // "module.flesh-enshrouded-heart-ablaze" and nothing a player sent reached
  // the GM. CH is the query name; every other connected user receives it.
  const CH = "feha.grenadeRuntime";
  const MARK = "fehaGrenadeRuntimeV1";
  const TIMEOUT = 20000;
  const TURN_MS = 6000;
  const TRANSIENT_MS = 2200;

  const pending = new Map();
  const hooks = [];
  const inFlight = new Set();
  const bridges = [];
  const lastCombatantByCombat = new Map();

  let socketHandler = null;
  let cleanupTimer = null;
  let placementActive = false;

  const list = collection => {
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    try { return [...collection]; } catch { return []; }
  };

  function actorIdentity(actor) {
    return String(
      actor?.uuid ??
      actor?.id ??
      ""
    );
  }

  function runtimeActors() {
    const actors = new Map();

    for (const actor of list(game.actors)) {
      const key = actorIdentity(actor);
      if (key) actors.set(key,actor);
    }

    for (const scene of list(game.scenes)) {
      for (const token of list(scene?.tokens)) {
        const actor = token?.actor ?? null;
        const key = actorIdentity(actor);
        if (key) actors.set(key,actor);
      }
    }

    return [...actors.values()];
  }

  const norm = value => String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9]+/g," ")
    .trim()
    .toLowerCase();

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  const rid = () =>
    globalThis.foundry?.utils?.randomID?.() ??
    globalThis.crypto?.randomUUID?.() ??
    String(Date.now()) + Math.random().toString(36);

  const ownerLevel = () =>
    Number(globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3);

  function owns(user,document) {
    if (!user || !document) return false;
    if (user.isGM) return true;

    try {
      if (typeof document.testUserPermission === "function") {
        return document.testUserPermission(user,ownerLevel());
      }
    } catch {}

    const ownership = document.ownership ?? document.permission ?? {};
    return Number(
      ownership[user.id] ??
      ownership.default ??
      0
    ) >= ownerLevel();
  }

  function authorityGM() {
    return (
      game.users?.activeGM ??
      list(game.users)
        .filter(user => user?.isGM && user?.active)
        .sort((a,b) => String(a.id).localeCompare(String(b.id)))[0] ??
      null
    );
  }

  // Upkeep that writes to the world (ticks, expiry, zone markers) runs on one
  // client: the active GM. With several GMs connected, each of them used to
  // run it, so a tick rolled and applied its damage once per GM.
  const isAuthority = () =>
    game.user?.isGM === true &&
    authorityGM()?.id === game.user.id;

  function emit(kind,payload={}) {
    const message = {
      [MARK]:true,
      kind,
      payload
    };

    for (const user of list(game.users)) {
      if (!user?.active || user.isSelf) continue;

      Promise.resolve(user.query?.(CH,message,{timeout:10000}))
        .catch(() => {});
    }
  }

  function wait(requestId) {
    let timer = null;

    return new Promise((resolve,reject) => {
      const settle = payload => {
        clearTimeout(timer);

        if (pending.get(requestId) === settle) {
          pending.delete(requestId);
        }

        if (payload?.error) {
          reject(new Error(String(payload.error)));
        } else {
          resolve(payload?.result ?? null);
        }
      };

      settle.cancel = () =>
        settle({error:"Grenade runtime reloaded before the request completed."});

      pending.set(requestId,settle);

      timer = setTimeout(() => {
        if (pending.get(requestId) !== settle) return;
        pending.delete(requestId);
        reject(new Error("Grenade authority request timed out."));
      },TIMEOUT);
    });
  }

  function isGrenade(item) {
    if (!item) return false;

    const def = catalog.definition?.(item);
    if (!def) return false;

    const flags = item.flags?.[FLAG] ?? {};
    const category = norm(flags.sourceCategory ?? flags.category);

    return Boolean(
      category === "grenades" ||
      /\/grenades\//i.test(String(flags.sourcePath ?? "")) ||
      def
    );
  }

  function actorToken(scene,actor,preferredId=null) {
    if (!scene || !actor) return null;

    if (preferredId) {
      const preferred = scene.tokens?.get?.(preferredId) ?? null;
      if (
        preferred &&
        String(preferred.actorId ?? "") === String(actor.id)
      ) {
        return preferred;
      }
    }

    return list(scene.tokens).find(token =>
      String(token?.actorId ?? "") === String(actor.id)
    ) ?? null;
  }

  function tokenCenter(token,scene) {
    const gridSize = Number(scene?.grid?.size ?? 100) || 100;
    const width = Number(token?.width ?? 1) || 1;
    const height = Number(token?.height ?? 1) || 1;

    return {
      x:Number(token?.x ?? 0) + (width * gridSize / 2),
      y:Number(token?.y ?? 0) + (height * gridSize / 2)
    };
  }

  function combatForActor(actor) {
    const combat = game.combat;
    if (!combat?.started) return null;

    return list(combat.combatants)
      .find(entry =>
        String(entry?.actorId ?? entry?.actor?.id ?? "") ===
        String(actor?.id ?? "")
      )
      ? combat
      : null;
  }

  function bonusActionStamp(actor) {
    const combat = combatForActor(actor);
    if (!combat) return null;

    return [
      combat.id,
      Number(combat.round ?? 0),
      Number(combat.turn ?? -1)
    ].join(":");
  }

  function assertBonusActionAvailable(actor) {
    const stamp = bonusActionStamp(actor);
    if (!stamp) return true;

    const flags = actor?.flags?.[FLAG] ?? {};
    const shared =
      String(flags.bonusActionTurnStamp ?? "");
    const legacyQuickhack =
      String(flags.quickhackTurnStamp ?? "");

    if (shared === stamp || legacyQuickhack === stamp) {
      throw new Error(
        "You already used your Bonus Action this turn."
      );
    }

    return true;
  }

  async function markBonusActionUsed(actor,source="grenade") {
    const stamp = bonusActionStamp(actor);
    if (!stamp) return false;

    await actor.update({
      ["flags."+FLAG+".bonusActionTurnStamp"]:stamp,
      ["flags."+FLAG+".bonusActionSource"]:
        String(source ?? "grenade")
    });

    return true;
  }

  function feetBetween(scene,a,b) {
    const gridSize = Number(scene?.grid?.size ?? 100) || 100;
    const gridDistance = Number(scene?.grid?.distance ?? 5) || 5;

    const pixels = Math.hypot(
      Number(a?.x ?? 0) - Number(b?.x ?? 0),
      Number(a?.y ?? 0) - Number(b?.y ?? 0)
    );

    return pixels / gridSize * gridDistance;
  }

  function tokensWithin(scene,center,radiusFt) {
    return list(scene?.tokens)
      .filter(token => token?.actor)
      .filter(token =>
        feetBetween(
          scene,
          center,
          tokenCenter(token,scene)
        ) <= Number(radiusFt ?? 0) + 0.001
      );
  }

  function abilityModifier(actor,key) {
    const ability = actor?.system?.abilities?.[key] ?? {};
    const prepared = Number(ability.mod);
    if (Number.isFinite(prepared)) return prepared;

    const score = Number(ability.value);
    return Number.isFinite(score)
      ? Math.floor((score - 10) / 2)
      : 0;
  }

  function actorProficiency(actor) {
    const value = Number(
      actor?.system?.attributes?.prof ??
      actor?.system?.details?.prof ??
      2
    );

    return Number.isFinite(value) ? value : 2;
  }

  function grenadeDC(actor,item,def,{cookoff=false}={}) {
    const override = Number(item?.flags?.[FLAG]?.grenadeDC);
    if (Number.isFinite(override) && override > 0) {
      return Math.floor(override);
    }

    if (cookoff) {
      return 12 + Math.max(1,Number(def?.mk ?? 1) || 1);
    }

    return 8 + actorProficiency(actor) + abilityModifier(actor,"dex");
  }

  function saveModifier(actor,key) {
    const ability = actor?.system?.abilities?.[key] ?? {};

    for (const candidate of [
      ability?.save?.total,
      ability?.save?.value,
      ability?.saveModifier
    ]) {
      const value = Number(candidate);
      if (Number.isFinite(value)) return value;
    }

    const mod = abilityModifier(actor,key);
    const proficient = Number(ability.proficient ?? 0);
    const prof =
      actorProficiency(actor) *
      (Number.isFinite(proficient) ? proficient : 0);

    const localBonus = Number(ability?.bonuses?.save);
    const globalBonus = Number(actor?.system?.bonuses?.abilities?.save);

    return (
      mod +
      prof +
      (Number.isFinite(localBonus) ? localBonus : 0) +
      (Number.isFinite(globalBonus) ? globalBonus : 0)
    );
  }

  async function evaluateRoll(formula) {
    const roll = new Roll(String(formula));
    await roll.evaluate();
    return roll;
  }

  async function rollSave(
    actor,
    ability,
    {
      disadvantage=false,
      advantage=false
    }={}
  ) {
    const key = String(ability ?? "").toLowerCase();
    const modifier = saveModifier(actor,key);

    const netDisadvantage =
      Boolean(disadvantage) &&
      !Boolean(advantage);

    const netAdvantage =
      Boolean(advantage) &&
      !Boolean(disadvantage);

    const dice =
      netDisadvantage
        ? "2d20kl1"
        : (
            netAdvantage
              ? "2d20kh1"
              : "1d20"
          );

    const formula =
      dice +
      (modifier >= 0 ? "+" : "") +
      modifier;

    const roll = await evaluateRoll(formula);

    return {
      ability:key,
      modifier,
      total:Number(roll.total ?? 0),
      formula:roll.formula,
      disadvantage:netDisadvantage,
      advantage:netAdvantage
    };
  }

  function hp(actor) {
    const data = actor?.system?.attributes?.hp ?? {};

    return {
      value:Math.max(0,Number(data.value ?? 0)),
      max:Math.max(0,Number(data.max ?? 0)),
      temp:Math.max(0,Number(data.temp ?? 0))
    };
  }

  async function damageLocal(actor,amount,damageType="") {
    const adjusted =
      globalThis.FEHA_ARMOR_RUNTIME?.adjustDamage?.(
        actor,
        amount,
        damageType,
        {sourceKind:"grenade"}
      );

    const damage =
      Math.max(
        0,
        Math.floor(
          Number(adjusted ?? amount) || 0
        )
      );

    const before = hp(actor);

    let remaining = damage;
    let temp = before.temp;
    let value = before.value;

    const tempSpent = Math.min(temp,remaining);
    temp -= tempSpent;
    remaining -= tempSpent;
    value = Math.max(0,value - remaining);

    const update = {"system.attributes.hp.value":value};

    if (temp !== before.temp) {
      update["system.attributes.hp.temp"] = temp;
    }

    await actor.update(update);

    return {
      damage,
      before,
      after:{value,max:before.max,temp}
    };
  }

  function isCyberware(item) {
    const flags = item?.flags?.[FLAG] ?? {};
    const category = norm(flags.sourceCategory ?? flags.category);
    const path = norm(flags.cyberwareSlot ?? "");
    return Boolean(
      category === "cyberware" ||
      flags.cyberwareSlot ||
      flags.installed !== undefined ||
      flags.isInstalled !== undefined ||
      /cyberware|implant|cyber/.test(
        norm([item?.name,path].join(" "))
      )
    );
  }

  function installedCyberware(item) {
    if (!isCyberware(item)) return false;
    const flags = item?.flags?.[FLAG] ?? {};

    return Boolean(
      flags.installed === true ||
      flags.isInstalled === true ||
      item?.system?.equipped === true ||
      (
        flags.installed !== false &&
        flags.isInstalled !== false &&
        typeof item?.system?.equipped !== "boolean"
      )
    );
  }

  function targetProfile(actor) {
    const flags = actor?.flags?.[FLAG] ?? {};
    const actorText = norm([
      actor?.name,
      actor?.system?.details?.type?.value,
      actor?.system?.details?.race,
      flags.actorType
    ].filter(Boolean).join(" "));

    const hasCyberware =
      list(actor?.items).some(installedCyberware);

    const electronic =
      flags.electronic === true ||
      flags.robot === true ||
      flags.drone === true ||
      flags.turret === true ||
      /robot|drone|turret|android|synthetic|machine|mech|camera/.test(actorText);

    const senses = actor?.system?.attributes?.senses ?? {};
    const blindsight =
      Number(senses?.blindsight ?? 0) > 0 ||
      /blindsight|blind sense/.test(
        norm([
          senses?.special,
          senses?.value,
          actor?.system?.traits?.senses
        ].filter(Boolean).join(" "))
      );

    return {
      hasCyberware,
      electronic,
      cyberneticElectronic:hasCyberware || electronic,
      blindsight
    };
  }

  function currentCombatForScene(scene) {
    const combat = game.combat;

    if (
      !combat?.started ||
      String(combat.scene?.id ?? combat.sceneId ?? "") !== String(scene?.id ?? "")
    ) {
      return null;
    }

    return combat;
  }

  function timedExpiry(scene,token,turns=1) {
    const count = Math.max(1,Math.floor(Number(turns) || 1));
    const combat = currentCombatForScene(scene);

    if (combat) {
      const currentTokenId =
        combat.combatant?.tokenId ??
        combat.current?.tokenId ??
        null;

      return {
        mode:"combat",
        combatId:combat.id,
        targetTokenId:token?.id ?? null,
        remainingTurnEnds:
          count +
          (
            String(currentTokenId ?? "") ===
            String(token?.id ?? "")
              ? 1
              : 0
          )
      };
    }

    return {
      mode:"time",
      expiresAt:Date.now() + (count * TURN_MS)
    };
  }

  function tickState(scene,token,formula,damageType) {
    const combat = currentCombatForScene(scene);

    if (combat) {
      return {
        mode:"combat",
        combatId:combat.id,
        targetTokenId:token?.id ?? null,
        remainingTurnStarts:1,
        formula:String(formula),
        damageType:String(damageType ?? "untyped")
      };
    }

    return {
      mode:"time",
      tickAt:Date.now() + TURN_MS,
      formula:String(formula),
      damageType:String(damageType ?? "untyped")
    };
  }

  function statusId(name) {
    const wanted = norm(name);

    const found = list(globalThis.CONFIG?.statusEffects).find(status =>
      norm(status?.id) === wanted ||
      norm(status?.name) === wanted ||
      norm(status?.id).includes(wanted) ||
      norm(status?.name).includes(wanted)
    );

    return found?.id ?? String(name ?? "");
  }

  async function removeGrenadeEffect(actor,kind) {
    const effects = list(actor?.effects).filter(effect =>
      String(effect?.flags?.[FLAG]?.grenadeEffectKind ?? "") ===
      String(kind)
    );

    for (const effect of effects) {
      try { await effect.delete(); } catch {}
    }
  }

  async function createTimedEffect(
    actor,
    scene,
    token,
    {
      kind,
      name,
      statuses=[],
      turns=1,
      extraFlags={}
    }
  ) {
    await removeGrenadeEffect(actor,kind);

    const expiry = timedExpiry(scene,token,turns);

    const data = {
      name:String(name),
      img:"icons/svg/explosion.svg",
      statuses:statuses
        .map(statusId)
        .filter(Boolean),
      changes:[],
      flags:{
        [FLAG]:{
          grenadeTimed:true,
          grenadeEffectKind:String(kind),
          grenadeExpiry:expiry,
          ...extraFlags
        }
      }
    };

    const created =
      await actor.createEmbeddedDocuments(
        "ActiveEffect",
        [data]
      );

    return created?.[0] ?? null;
  }

  async function createTickEffect(
    actor,
    scene,
    token,
    {
      kind,
      formula,
      damageType
    }
  ) {
    await removeGrenadeEffect(actor,"tick:"+kind);

    const tick = tickState(
      scene,
      token,
      formula,
      damageType
    );

    const label =
      kind === "burn"
        ? "BURNING // GRENADE"
        : "BLEEDING // GRENADE";

    const created =
      await actor.createEmbeddedDocuments(
        "ActiveEffect",
        [{
          name:label,
          img:"icons/svg/blood.svg",
          changes:[],
          flags:{
            [FLAG]:{
              grenadeTimed:true,
              grenadeEffectKind:"tick:"+kind,
              grenadeTick:tick
            }
          }
        }]
      );

    return created?.[0] ?? null;
  }

  async function createProne(actor) {
    const wanted = statusId("prone");

    const exists = list(actor?.effects).some(effect =>
      list(effect?.statuses).some(status =>
        String(status) === String(wanted)
      )
    );

    if (exists) return null;

    const created =
      await actor.createEmbeddedDocuments(
        "ActiveEffect",
        [{
          name:"PRONE // BLAST",
          img:"icons/svg/falling.svg",
          statuses:[wanted],
          changes:[],
          flags:{
            [FLAG]:{
              grenadeEffectKind:"prone"
            }
          }
        }]
      );

    return created?.[0] ?? null;
  }

  async function disableOneCyberware(actor,scene,token,turns=1) {
    const item = list(actor?.items)
      .filter(item =>
        isCyberware(item) &&
        installedCyberware(item) &&
        item?.type !== "weapon" &&
        item?.flags?.[FLAG]?.grenadeEmpDisabled !== true
      )
      .sort((a,b) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""))
      )[0] ?? null;

    if (!item) return null;

    const flags = item.flags?.[FLAG] ?? {};
    const expiry = timedExpiry(scene,token,turns);

    const state = {
      expiry,
      originalInstalled:flags.installed,
      originalIsInstalled:flags.isInstalled,
      originalSystemEquipped:item.system?.equipped
    };

    const update = {
      ["flags."+FLAG+".installed"]:false,
      ["flags."+FLAG+".isInstalled"]:false,
      ["flags."+FLAG+".grenadeEmpDisabled"]:true,
      ["flags."+FLAG+".grenadeEmpState"]:state
    };

    if (typeof item.system?.equipped === "boolean") {
      update["system.equipped"] = false;
    }

    await item.update(update);

    return item;
  }

  async function restoreCyberware(item) {
    const state = item?.flags?.[FLAG]?.grenadeEmpState ?? null;
    if (!state) return false;

    const update = {
      ["flags."+FLAG+".installed"]:
        state.originalInstalled !== false,
      ["flags."+FLAG+".isInstalled"]:
        state.originalIsInstalled !== false,
      ["flags."+FLAG+".grenadeEmpDisabled"]:false
    };

    if (typeof state.originalSystemEquipped === "boolean") {
      update["system.equipped"] =
        state.originalSystemEquipped;
    }

    await item.update(update);

    try {
      await item.update({
        ["flags."+FLAG+".-=grenadeEmpState"]:null
      });
    } catch {}

    return true;
  }

  function advanceExpiry(expiry,{combatId=null,tokenId=null,now=Date.now()}={}) {
    if (!expiry) return {expired:false,next:expiry};

    if (expiry.mode === "time") {
      return {
        expired:Number(expiry.expiresAt ?? Infinity) <= now,
        next:expiry
      };
    }

    if (
      expiry.mode === "combat" &&
      combatId &&
      tokenId &&
      String(expiry.combatId ?? "") === String(combatId) &&
      String(expiry.targetTokenId ?? "") === String(tokenId)
    ) {
      const remaining =
        Math.max(
          0,
          Math.floor(Number(expiry.remainingTurnEnds ?? 0)) - 1
        );

      return {
        expired:remaining <= 0,
        next:{
          ...expiry,
          remainingTurnEnds:remaining
        }
      };
    }

    return {expired:false,next:expiry};
  }

  async function processTurnEnd(actor,combatId,tokenId) {
    if (!actor) return;

    for (const effect of list(actor.effects)) {
      const flags = effect?.flags?.[FLAG] ?? {};
      if (flags.grenadeTimed !== true || !flags.grenadeExpiry) continue;

      const state =
        advanceExpiry(
          flags.grenadeExpiry,
          {combatId,tokenId}
        );

      if (state.expired) {
        try { await effect.delete(); } catch {}
      } else if (
        state.next?.remainingTurnEnds !==
        flags.grenadeExpiry?.remainingTurnEnds
      ) {
        try {
          await effect.update({
            ["flags."+FLAG+".grenadeExpiry"]:state.next
          });
        } catch {}
      }
    }

    for (const item of list(actor.items)) {
      const state = item?.flags?.[FLAG]?.grenadeEmpState;
      if (!state?.expiry) continue;

      const next =
        advanceExpiry(
          state.expiry,
          {combatId,tokenId}
        );

      if (next.expired) {
        try { await restoreCyberware(item); } catch {}
      } else if (
        next.next?.remainingTurnEnds !==
        state.expiry?.remainingTurnEnds
      ) {
        try {
          await item.update({
            ["flags."+FLAG+".grenadeEmpState"]:{
              ...state,
              expiry:next.next
            }
          });
        } catch {}
      }
    }
  }

  async function resolveTickEffect(actor,effect) {
    const tick = effect?.flags?.[FLAG]?.grenadeTick ?? null;
    if (!tick?.formula) return false;

    const roll = await evaluateRoll(tick.formula);
    const amount =
      Math.max(0,Math.floor(Number(roll.total ?? 0)));

    // The card reports what the target actually took: armor can reduce or
    // cancel grenade damage.
    const applied =
      (
        await damageLocal(
          actor,
          amount,
          tick.damageType ?? ""
        )
      ).damage;

    try {
      await ChatMessage.create({
        speaker:ChatMessage.getSpeaker({actor}),
        content:
          '<div style="border:1px solid #71363b;background:#12090a;padding:8px">'+
          '<strong>'+esc(effect.name ?? "GRENADE EFFECT")+'</strong>'+
          '<div style="margin-top:4px">'+
          esc(tick.formula)+' '+esc(tick.damageType ?? "")+
          ' → <strong>'+applied+'</strong> damage</div>'+
          '</div>'
      });
    } catch {}

    try { await effect.delete(); } catch {}
    return true;
  }

  async function processTurnStart(actor,combatId,tokenId) {
    if (!actor) return;

    for (const effect of list(actor.effects)) {
      const tick = effect?.flags?.[FLAG]?.grenadeTick ?? null;
      if (!tick || tick.mode !== "combat") continue;

      if (
        String(tick.combatId ?? "") !== String(combatId ?? "") ||
        String(tick.targetTokenId ?? "") !== String(tokenId ?? "")
      ) {
        continue;
      }

      const remaining =
        Math.max(
          0,
          Math.floor(Number(tick.remainingTurnStarts ?? 0)) - 1
        );

      if (remaining <= 0) {
        await resolveTickEffect(actor,effect);
      } else {
        try {
          await effect.update({
            ["flags."+FLAG+".grenadeTick"]:{
              ...tick,
              remainingTurnStarts:remaining
            }
          });
        } catch {}
      }
    }
  }

  function currentCombatTokenId(combat) {
    return (
      combat?.combatant?.tokenId ??
      combat?.current?.tokenId ??
      null
    );
  }

  function combatantActor(combat,tokenId) {
    return list(combat?.combatants)
      .find(entry =>
        String(entry?.tokenId ?? "") === String(tokenId ?? "")
      )?.actor ?? null;
  }

  function zoneExpiry(scene,rounds) {
    const count = Math.max(1,Math.floor(Number(rounds) || 1));
    const combat = currentCombatForScene(scene);

    if (combat) {
      return {
        mode:"combat",
        combatId:combat.id,
        startRound:Number(combat.round ?? 0),
        startTurn:Number(combat.turn ?? 0),
        rounds:count,
        fallbackExpiresAt:Date.now() + (count * TURN_MS)
      };
    }

    return {
      mode:"time",
      expiresAt:Date.now() + (count * TURN_MS)
    };
  }

  function zoneExpired(expiry,scene,now=Date.now()) {
    if (!expiry) return false;

    if (expiry.mode === "time") {
      return Number(expiry.expiresAt ?? Infinity) <= now;
    }

    const combat = currentCombatForScene(scene);

    if (
      !combat ||
      String(combat.id ?? "") !== String(expiry.combatId ?? "")
    ) {
      return Number(expiry.fallbackExpiresAt ?? Infinity) <= now;
    }

    const roundDelta =
      Number(combat.round ?? 0) -
      Number(expiry.startRound ?? 0);

    if (roundDelta > Number(expiry.rounds ?? 1)) return true;
    if (roundDelta < Number(expiry.rounds ?? 1)) return false;

    return Number(combat.turn ?? 0) >= Number(expiry.startTurn ?? 0);
  }

  function grenadeTemplates(scene) {
    return list(scene?.templates).filter(template =>
      template?.flags?.[FLAG]?.grenadeTemplate === true
    );
  }

  async function createTemplate(
    scene,
    center,
    def,
    {
      ownerUserId,
      anchorTokenId=null,
      persistent=false
    }={}
  ) {
    const schema = def.schema ?? {};
    const radius = Math.max(1,Number(schema.radiusFt ?? 5) || 5);

    const zoneKind = String(schema.zoneKind ?? "");
    const zoneRounds =
      zoneKind
        ? Math.max(1,Number(schema.zoneRounds ?? 1) || 1)
        : 0;

    const transientMs =
      Number(schema.transientTemplateMs ?? TRANSIENT_MS) || TRANSIENT_MS;

    const grenadeZone =
      zoneKind
        ? {
            kind:zoneKind,
            anchorTokenId:anchorTokenId ?? null,
            ownerUserId:ownerUserId ?? null,
            expiry:zoneExpiry(scene,zoneRounds)
          }
        : null;

    const data = {
      t:"circle",
      x:Number(center.x),
      y:Number(center.y),
      distance:radius,
      direction:0,
      angle:360,
      user:ownerUserId ?? game.user?.id ?? null,
      flags:{
        [FLAG]:{
          grenadeTemplate:true,
          grenadeKey:def.key,
          grenadeTransient:!persistent && !zoneKind,
          grenadeDeleteAt:
            !persistent && !zoneKind
              ? Date.now() + transientMs
              : null,
          grenadeZone
        }
      }
    };

    const created =
      await scene.createEmbeddedDocuments(
        "MeasuredTemplate",
        [data]
      );

    return created?.[0] ?? null;
  }

  async function removeZoneMarkers(zoneId) {
    if (!zoneId) return;

    for (const actor of runtimeActors()) {
      for (const effect of list(actor.effects)) {
        if (
          String(effect?.flags?.[FLAG]?.grenadeZoneId ?? "") ===
          String(zoneId)
        ) {
          try { await effect.delete(); } catch {}
        }
      }
    }
  }

  async function ensureZoneMarker(actor,zoneId,name) {
    const existing = list(actor?.effects).find(effect =>
      String(effect?.flags?.[FLAG]?.grenadeZoneId ?? "") ===
      String(zoneId)
    );

    if (existing) return existing;

    const created =
      await actor.createEmbeddedDocuments(
        "ActiveEffect",
        [{
          name:String(name),
          img:"icons/svg/hazard.svg",
          changes:[],
          flags:{
            [FLAG]:{
              grenadeZoneId:String(zoneId),
              grenadeZoneMarker:true
            }
          }
        }]
      );

    return created?.[0] ?? null;
  }

  // Zone syncs are triggered from several hooks at once (template created,
  // detonation resolved, token moved). Run them one at a time per template:
  // two concurrent passes both saw "no marker yet" and created duplicates.
  const zoneSyncQueue = new Map();

  function syncZone(template) {
    const id = String(template?.id ?? "");
    if (!id) return Promise.resolve();

    const next =
      (zoneSyncQueue.get(id) ?? Promise.resolve())
        .catch(() => {})
        .then(() => syncZoneNow(template));

    zoneSyncQueue.set(id,next);

    return next.finally(() => {
      if (zoneSyncQueue.get(id) === next) zoneSyncQueue.delete(id);
    });
  }

  async function syncZoneNow(template) {
    // Zone markers have one writer, the active GM. When another GM throws
    // the grenade, the createMeasuredTemplate hook below does the marking;
    // two clients marking the same zone each added their own marker.
    if (!isAuthority() || !template) return;

    const scene = template.parent ?? null;
    const zone = template.flags?.[FLAG]?.grenadeZone ?? null;

    if (!scene || !zone?.kind) return;

    const center = {
      x:Number(template.x ?? 0),
      y:Number(template.y ?? 0)
    };

    const insideTokens =
      tokensWithin(
        scene,
        center,
        Number(template.distance ?? 0)
      );

    const insideActors =
      new Map();

    for (const token of insideTokens) {
      const actor = token?.actor ?? null;
      const key = actorIdentity(actor);
      if (actor && key) insideActors.set(key,actor);
    }

    const label =
      zone.kind === "smoke"
        ? "SMOKE // HEAVILY OBSCURED"
        : "RECON // REVEALED";

    for (const actor of insideActors.values()) {
      const grenadeImmune =
        Boolean(
          globalThis.FEHA_ARMOR_RUNTIME?.grenadeImmune?.(
            actor
          )
        );

      // Smoke remains an environmental visibility problem even for Vektor.
      // Other grenade zones cannot directly mark/reveal a Grenade Null wearer.
      if (grenadeImmune && zone.kind !== "smoke") {
        for (const effect of list(actor.effects)) {
          if (
            String(effect?.flags?.[FLAG]?.grenadeZoneId ?? "") ===
            String(template.id)
          ) {
            try { await effect.delete(); } catch {}
          }
        }
        continue;
      }

      try {
        await ensureZoneMarker(actor,template.id,label);
      } catch {}
    }

    for (const actor of runtimeActors()) {
      if (insideActors.has(actorIdentity(actor))) continue;

      for (const effect of list(actor.effects)) {
        if (
          String(effect?.flags?.[FLAG]?.grenadeZoneId ?? "") ===
          String(template.id)
        ) {
          try { await effect.delete(); } catch {}
        }
      }
    }
  }

  async function moveAnchoredZones(scene,token) {
    if (!isAuthority() || !scene || !token) return;

    const center = tokenCenter(token,scene);

    for (const template of grenadeTemplates(scene)) {
      const zone = template.flags?.[FLAG]?.grenadeZone ?? null;

      if (
        !zone?.anchorTokenId ||
        String(zone.anchorTokenId) !== String(token.id)
      ) {
        continue;
      }

      try {
        await template.update({
          x:center.x,
          y:center.y
        });
      } catch {}
    }
  }

  async function cleanupTemplates() {
    if (!isAuthority()) return;

    const now = Date.now();

    for (const scene of list(game.scenes)) {
      for (const template of grenadeTemplates(scene)) {
        const flags = template.flags?.[FLAG] ?? {};
        const zone = flags.grenadeZone ?? null;

        const transientExpired =
          flags.grenadeTransient === true &&
          Number(flags.grenadeDeleteAt ?? Infinity) <= now;

        const persistentExpired =
          zone?.expiry &&
          zoneExpired(zone.expiry,scene,now);

        if (!transientExpired && !persistentExpired) continue;

        try {
          await removeZoneMarkers(template.id);
          await template.delete();
        } catch {}
      }
    }
  }

  async function cleanupTimedByTime() {
    if (!isAuthority()) return;

    const now = Date.now();

    for (const actor of runtimeActors()) {
      for (const effect of list(actor.effects)) {
        const flags = effect?.flags?.[FLAG] ?? {};

        if (
          flags.grenadeTick?.mode === "time" &&
          Number(flags.grenadeTick.tickAt ?? Infinity) <= now
        ) {
          try { await resolveTickEffect(actor,effect); } catch {}
          continue;
        }

        if (
          flags.grenadeTimed === true &&
          flags.grenadeExpiry?.mode === "time" &&
          Number(flags.grenadeExpiry.expiresAt ?? Infinity) <= now
        ) {
          try { await effect.delete(); } catch {}
        }
      }

      for (const item of list(actor.items)) {
        const state = item?.flags?.[FLAG]?.grenadeEmpState;

        if (
          state?.expiry?.mode === "time" &&
          Number(state.expiry.expiresAt ?? Infinity) <= now
        ) {
          try { await restoreCyberware(item); } catch {}
        }
      }
    }

    await cleanupTemplates();
  }

  async function clearCombatBoundEffects(combatId) {
    if (!isAuthority() || !combatId) return;

    for (const actor of runtimeActors()) {
      for (const effect of list(actor.effects)) {
        const flags = effect?.flags?.[FLAG] ?? {};
        const expiry = flags.grenadeExpiry;
        const tick = flags.grenadeTick;

        if (
          String(expiry?.combatId ?? "") === String(combatId) ||
          String(tick?.combatId ?? "") === String(combatId)
        ) {
          try { await effect.delete(); } catch {}
        }
      }

      for (const item of list(actor.items)) {
        const state = item?.flags?.[FLAG]?.grenadeEmpState;

        if (
          String(state?.expiry?.combatId ?? "") ===
          String(combatId)
        ) {
          try { await restoreCyberware(item); } catch {}
        }
      }
    }
  }

  async function knockbackToken(scene,token,center,feet) {
    const distanceFt = Math.max(0,Number(feet ?? 0) || 0);
    if (!distanceFt || !scene || !token) return false;

    const from = tokenCenter(token,scene);
    const dx = from.x - Number(center.x ?? 0);
    const dy = from.y - Number(center.y ?? 0);
    const length = Math.hypot(dx,dy);

    if (length < 0.001) return false;

    const gridSize = Number(scene.grid?.size ?? 100) || 100;
    const gridDistance = Number(scene.grid?.distance ?? 5) || 5;
    const pixels = distanceFt / gridDistance * gridSize;

    const targetCenter = {
      x:from.x + (dx / length) * pixels,
      y:from.y + (dy / length) * pixels
    };

    const widthPx =
      (Number(token.width ?? 1) || 1) * gridSize;

    const heightPx =
      (Number(token.height ?? 1) || 1) * gridSize;

    let x = targetCenter.x - widthPx / 2;
    let y = targetCenter.y - heightPx / 2;

    x = Math.max(0,Math.min(
      Number(scene.width ?? x + widthPx) - widthPx,
      x
    ));

    y = Math.max(0,Math.min(
      Number(scene.height ?? y + heightPx) - heightPx,
      y
    ));

    try {
      if (String(canvas?.scene?.id ?? "") === String(scene.id)) {
        const placeable = canvas.tokens?.get?.(token.id) ?? null;
        const collision =
          placeable?.checkCollision?.(
            {x:targetCenter.x,y:targetCenter.y},
            {type:"move",mode:"any"}
          );

        if (collision === true) return false;
      }
    } catch {}

    await token.update({x,y});
    return true;
  }

  async function consumeGrenade(item) {
    if (!item) return;

    const quantity =
      Math.max(0,Number(item.system?.quantity ?? 1) || 0);

    if (quantity > 1) {
      await item.update({
        "system.quantity":quantity - 1
      });
      return;
    }

    if (quantity === 1 && item.parent) {
      try {
        await item.delete();
        return;
      } catch {}
    }

    if (item.system?.uses) {
      try {
        await item.update({
          "system.uses.spent":
            Math.max(
              1,
              Number(item.system?.uses?.max ?? 1) || 1
            )
        });
      } catch {}
    }
  }

  async function whisperScan(userId,def,scene,center,radius) {
    const tokens = tokensWithin(scene,center,radius);

    const creatures =
      tokens
        .filter(token =>
          !globalThis.FEHA_ARMOR_RUNTIME?.grenadeImmune?.(
            token?.actor ?? null
          )
        )
        .map(token => {
        const actor = token?.actor ?? null;
        const profile = targetProfile(actor);

        const chrome =
          list(actor?.items)
            .filter(installedCyberware)
            .map(item => String(item.name ?? "CYBERWARE"));

        const tags = [];

        if (profile.electronic) tags.push("ELECTRONIC");
        if (chrome.length) {
          tags.push(
            "CHROME: "+chrome.join(" / ")
          );
        }

        const name =
          String(token.name ?? actor?.name ?? "Unknown");

        return tags.length
          ? name+" ["+tags.join(" // ")+"]"
          : name;
      });

    const content =
      '<div style="border:1px solid #2c7b8b;background:#07151b;padding:10px">'+
      '<div style="font-size:10px;letter-spacing:.12em;color:#73d6e7;font-weight:900">RECON GRENADE // SCAN RESULT</div>'+
      '<h3 style="margin:5px 0">'+esc(def.name)+'</h3>'+
      '<div><strong>CREATURES:</strong> '+esc(creatures.join(", ") || "NONE")+'</div>'+
      '</div>';

    try {
      await ChatMessage.create({
        content,
        whisper:userId ? [userId] : [],
        speaker:ChatMessage.getSpeaker()
      });
    } catch {}

    return {
      creatures
    };
  }

  async function postResultChat(
    actor,
    def,
    dc,
    damageRoll,
    results,
    {cookoff=false}={}
  ) {
    const damageText =
      damageRoll
        ? esc(damageRoll.formula) +
          " = <strong>" +
          Number(damageRoll.total ?? 0) +
          "</strong>"
        : "UTILITY";

    const rows = results.map(result => {
      const saveText =
        result.autoFail
          ? "AUTO FAIL"
          : result.save
            ? (
                result.save.total +
                (result.save.disadvantage ? " (DIS)" : "") +
                (result.success ? " // SAVE" : " // FAIL")
              )
            : "—";

      const extras =
        result.effects?.length
          ? " // " + result.effects.join(", ")
          : "";

      return (
        '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:3px 0;border-top:1px solid #253e45">'+
          '<span>'+esc(result.name)+'</span>'+
          '<span>'+esc(saveText)+'</span>'+
          '<span><strong>'+Number(result.damage ?? 0)+'</strong>'+esc(extras)+'</span>'+
        '</div>'
      );
    }).join("");

    try {
      await ChatMessage.create({
        speaker:ChatMessage.getSpeaker({actor}),
        content:
          '<div style="border:1px solid #6e4f24;background:#110d07;padding:10px;color:#eefaff">'+
            '<div style="font-size:10px;letter-spacing:.12em;color:#f2d76f;font-weight:900">'+
              (cookoff ? "COOKOFF // GRENADE DETONATION" : "GRENADE // DETONATION")+
            '</div>'+
            '<h3 style="margin:5px 0;color:#fff">'+esc(def.name)+'</h3>'+
            '<div><strong>DC '+Number(dc)+'</strong> // '+damageText+'</div>'+
            '<div style="margin-top:6px">'+rows+'</div>'+
          '</div>'
      });
    } catch {}
  }

  async function resolveExplosion(base) {
    const {
      scene,
      actor,
      item,
      def,
      schema,
      center,
      primaryToken,
      userId,
      cookoff
    } = base;

    const radius =
      Math.max(1,Number(schema.radiusFt ?? 5) || 5);

    let attached = false;
    let attachSave = null;

    if (
      !cookoff &&
      schema.sticky === true &&
      primaryToken?.actor &&
      schema.attachSave
    ) {
      attachSave =
        await rollSave(
          primaryToken.actor,
          schema.attachSave,
          {disadvantage:false}
        );

      attached = attachSave.total < base.dc;
    }

    const persistent =
      Boolean(schema.zoneKind);

    const template =
      await createTemplate(
        scene,
        center,
        def,
        {
          ownerUserId:userId,
          anchorTokenId:
            persistent && attached
              ? primaryToken?.id ?? null
              : (
                  persistent &&
                  schema.sticky === true &&
                  primaryToken
                    ? primaryToken.id
                    : null
                ),
          persistent
        }
      );

    const results = [];
    let damageRoll = null;

    if (schema.damage) {
      damageRoll = await evaluateRoll(schema.damage);
    }

    const affected = tokensWithin(scene,center,radius);

    for (const token of affected) {
      const target = token.actor;
      if (!target) continue;

      const isPrimary =
        primaryToken &&
        String(primaryToken.id) === String(token.id);

      const profile = targetProfile(target);

      const armorRuntime = globalThis.FEHA_ARMOR_RUNTIME;
      const grenadeNull =
        Boolean(armorRuntime?.grenadeImmune?.(target));
      const empImmune =
        /^emp-/.test(String(def?.key ?? "")) &&
        Boolean(armorRuntime?.empImmune?.(target));

      if (grenadeNull || empImmune) {
        results.push({
          tokenId:token.id,
          actorId:target.id,
          name:String(token.name ?? target.name ?? "Target"),
          autoFail:false,
          save:null,
          success:true,
          damage:0,
          effects:[
            grenadeNull
              ? "GRENADE NULL // IMMUNE"
              : "EMP SHIELDING // IMMUNE"
          ]
        });
        continue;
      }

      const autoFail =
        Boolean(
          isPrimary &&
          (
            cookoff === true ||
            (
              attached &&
              schema.stuckAutoFail === true
            )
          )
        );

      const disadvantage =
        !autoFail &&
        Boolean(
          (isPrimary && schema.primaryDisadvantage === true) ||
          (
            profile.cyberneticElectronic &&
            schema.electronicsDisadvantage === true
          )
        );

      let save = null;
      let success = false;

      if (schema.save && !autoFail) {
        const empAdvantage =
          /^emp-/.test(String(def?.key ?? "")) &&
          Boolean(
            globalThis.FEHA_ARMOR_RUNTIME?.empSaveAdvantage?.(
              target
            )
          );

        // Vektor Grenade Null below Mk.V: advantage on the grenade save
        // (and half damage, applied in damageLocal via adjustDamage).
        const grenadeNullAdvantage =
          Boolean(
            globalThis.FEHA_ARMOR_RUNTIME?.grenadeResistant?.(
              target
            )
          );

        save = await rollSave(
          target,
          schema.save,
          {
            disadvantage,
            advantage:empAdvantage || grenadeNullAdvantage
          }
        );

        success = save.total >= base.dc;
      }

      const raw =
        Math.max(
          0,
          Math.floor(Number(damageRoll?.total ?? 0))
        );

      const rolledDamage =
        damageRoll
          ? (
              success && schema.halfOnSuccess
                ? Math.floor(raw / 2)
                : raw
            )
          : 0;

      // Report what the target actually took: armor (fire resistance,
      // Grenade Null) can reduce it inside damageLocal.
      let damage = rolledDamage;

      if (rolledDamage > 0) {
        const applied =
          await damageLocal(
            target,
            rolledDamage,
            schema.damageType ?? ""
          );

        if (Number.isFinite(Number(applied?.damage))) {
          damage = Number(applied.damage);
        }
      }

      const effects = [];

      if (!success) {
        if (schema.conditionOnFail === "poisoned") {
          await createTimedEffect(
            target,
            scene,
            token,
            {
              kind:"poisoned",
              name:"POISONED // BIOHAZARD",
              statuses:["poisoned"],
              turns:Number(schema.durationTurns ?? 1) || 1
            }
          );
          effects.push("POISONED");
        }

        if (schema.flashbang === true) {
          const statuses = ["deafened"];

          if (!profile.blindsight) {
            statuses.push("blinded");
          }

          await createTimedEffect(
            target,
            scene,
            token,
            {
              kind:"flashbang",
              name:"FLASHBANG // SENSORY OVERLOAD",
              statuses,
              turns:Number(schema.durationTurns ?? 1) || 1,
              extraFlags:{noReactions:true}
            }
          );

          effects.push(
            profile.blindsight
              ? "DEAFENED + NO REACTIONS"
              : "BLINDED + DEAFENED + NO REACTIONS"
          );
        } else if (
          schema.removeReactionsOnFail === true
        ) {
          await createTimedEffect(
            target,
            scene,
            token,
            {
              kind:"no-reactions",
              name:"NO REACTIONS // GRENADE",
              turns:Number(schema.durationTurns ?? 1) || 1,
              extraFlags:{noReactions:true}
            }
          );
          effects.push("NO REACTIONS");
        }

        if (
          schema.removeReactionsOnCyberFail === true &&
          profile.cyberneticElectronic
        ) {
          await createTimedEffect(
            target,
            scene,
            token,
            {
              kind:"emp-disrupted",
              name:"EMP DISRUPTED // NO REACTIONS",
              turns:Number(schema.durationTurns ?? 1) || 1,
              extraFlags:{noReactions:true,empDisrupted:true}
            }
          );
          effects.push("EMP DISRUPTED");
        }

        if (
          isPrimary &&
          schema.primaryDisableCyberware === true &&
          profile.cyberneticElectronic
        ) {
          const disabled =
            await disableOneCyberware(
              target,
              scene,
              token,
              Number(schema.durationTurns ?? 1) || 1
            );

          if (disabled) {
            effects.push("CYBERWARE OFF: "+String(disabled.name ?? "SYSTEM"));
          }
        }

        if (schema.tickOnFail?.formula) {
          await createTickEffect(
            target,
            scene,
            token,
            {
              kind:String(schema.tickOnFail.kind ?? "tick"),
              formula:String(schema.tickOnFail.formula),
              damageType:String(schema.tickOnFail.damageType ?? "untyped")
            }
          );

          effects.push(
            String(schema.tickOnFail.kind ?? "TICK").toUpperCase()+
            " "+String(schema.tickOnFail.formula)
          );
        }

        if (schema.proneOnFail === true) {
          await createProne(target);
          effects.push("PRONE");
        }

        if (Number(schema.knockbackFt ?? 0) > 0) {
          const moved =
            await knockbackToken(
              scene,
              token,
              center,
              schema.knockbackFt
            );

          if (moved) effects.push("KNOCKBACK "+schema.knockbackFt+" FT");
        }
      }

      results.push({
        tokenId:token.id,
        actorId:target.id,
        name:String(token.name ?? target.name ?? "Target"),
        autoFail,
        save,
        success,
        damage,
        effects
      });
    }

    let scan = null;

    if (schema.scan === true) {
      scan =
        await whisperScan(
          userId,
          def,
          scene,
          center,
          radius
        );
    }

    if (template && persistent) {
      await syncZone(template);
    }

    await postResultChat(
      actor,
      def,
      base.dc,
      damageRoll,
      results,
      {cookoff}
    );

    await consumeGrenade(item);

    return {
      grenade:def.key,
      dc:base.dc,
      templateId:template?.id ?? null,
      attached,
      attachSave,
      damage:{
        formula:damageRoll?.formula ?? null,
        total:Number(damageRoll?.total ?? 0)
      },
      results,
      scan
    };
  }

  function validateUse(payload,userId,{cookoff=false}={}) {
    const user = game.users?.get?.(userId) ?? null;
    const actor = game.actors?.get?.(payload.actorId) ?? null;
    const scene = game.scenes?.get?.(payload.sceneId) ?? null;

    if (!user?.active && !cookoff) {
      throw new Error("Grenade user is not active.");
    }

    if (!actor || !scene) {
      throw new Error("Grenade source actor or scene no longer exists.");
    }

    if (!cookoff && !owns(user,actor)) {
      throw new Error("You do not own that grenade actor.");
    }

    const item = actor.items?.get?.(payload.itemId) ?? null;

    if (!item || !isGrenade(item)) {
      throw new Error("Selected item is not a FEHA grenade.");
    }

    const quantity =
      Math.max(0,Number(item.system?.quantity ?? 1) || 0);

    if (quantity < 1) {
      throw new Error("That grenade has no remaining quantity.");
    }

    const def = catalog.definition(item);
    const schema = def?.schema ?? null;

    if (!def || !schema) {
      throw new Error("Grenade has no canonical runtime definition.");
    }

    const sourceToken =
      actorToken(
        scene,
        actor,
        payload.sourceTokenId
      );

    if (!sourceToken) {
      throw new Error("Grenade actor has no token on this scene.");
    }

    const primaryToken =
      payload.targetTokenId
        ? scene.tokens?.get?.(payload.targetTokenId) ?? null
        : null;

    let center = {
      x:Number(payload.center?.x),
      y:Number(payload.center?.y)
    };

    if (primaryToken) {
      center = tokenCenter(primaryToken,scene);
    }

    if (
      !Number.isFinite(center.x) ||
      !Number.isFinite(center.y)
    ) {
      throw new Error("Grenade placement is invalid.");
    }

    if (!cookoff) {
      const sourceCenter = tokenCenter(sourceToken,scene);
      const distance = feetBetween(scene,sourceCenter,center);
      const range = Math.max(1,Number(schema.rangeFt ?? 60) || 60);

      if (distance > range + 0.01) {
        throw new Error(
          "Grenade placement is outside its "+range+" ft throw range."
        );
      }

      if (def.delivery === "homing" && !primaryToken) {
        throw new Error("Homing grenades require one targeted creature.");
      }
    }

    return {
      user,
      userId,
      actor,
      item,
      scene,
      sourceToken,
      primaryToken,
      center,
      def,
      schema,
      cookoff,
      dc:grenadeDC(actor,item,def,{cookoff})
    };
  }

  async function executeLocal(payload,userId,{cookoff=false}={}) {
    const base = validateUse(payload,userId,{cookoff});
    return resolveExplosion(base);
  }

  async function requestUse(payload) {
    if (game.user?.isGM) {
      return executeLocal(
        payload,
        game.user.id,
        {cookoff:false}
      );
    }

    const gm = authorityGM();

    if (!gm) {
      throw new Error("No online GM authority is available for grenades.");
    }

    const requestId = rid();
    const promise = wait(requestId);

    emit("request",{
      requestId,
      userId:game.user.id,
      gmId:gm.id,
      payload
    });

    return promise;
  }

  async function receive(message) {
    if (!message?.[MARK]) return;

    const kind = message.kind;
    const data = message.payload ?? {};

    if (kind === "response") {
      if (
        String(data.userId ?? "") !==
        String(game.user?.id ?? "")
      ) {
        return;
      }

      pending.get(data.requestId)?.(data);
      return;
    }

    if (kind !== "request" || !game.user?.isGM) return;

    const preferred = authorityGM();

    if (
      data.gmId &&
      String(data.gmId) !== String(game.user.id)
    ) {
      return;
    }

    if (
      !data.gmId &&
      preferred &&
      String(preferred.id) !== String(game.user.id)
    ) {
      return;
    }

    try {
      const result =
        await executeLocal(
          data.payload ?? {},
          data.userId,
          {cookoff:false}
        );

      emit("response",{
        requestId:data.requestId,
        userId:data.userId,
        result
      });
    } catch (error) {
      emit("response",{
        requestId:data.requestId,
        userId:data.userId,
        error:String(error?.message ?? error)
      });
    }
  }

  function stagePoint(event) {
    try {
      if (typeof event?.getLocalPosition === "function") {
        const point = event.getLocalPosition(canvas.stage);
        return {x:Number(point.x),y:Number(point.y)};
      }
    } catch {}

    try {
      if (typeof event?.data?.getLocalPosition === "function") {
        const point = event.data.getLocalPosition(canvas.stage);
        return {x:Number(point.x),y:Number(point.y)};
      }
    } catch {}

    try {
      const global = event?.global ?? event?.data?.global;
      if (global && typeof canvas.stage?.toLocal === "function") {
        const point = canvas.stage.toLocal(global);
        return {x:Number(point.x),y:Number(point.y)};
      }
    } catch {}

    const fallback = canvas?.mousePosition ?? null;

    if (fallback) {
      return {
        x:Number(fallback.x),
        y:Number(fallback.y)
      };
    }

    return null;
  }

  function makePlacementGhost(scene,radiusFt) {
    const PIXI = globalThis.PIXI;
    if (!PIXI?.Graphics || !canvas?.stage) return null;

    const gridSize = Number(scene?.grid?.size ?? 100) || 100;
    const gridDistance = Number(scene?.grid?.distance ?? 5) || 5;
    const radiusPx = radiusFt / gridDistance * gridSize;

    try {
      const ghost = new PIXI.Graphics();

      if (
        typeof ghost.circle === "function" &&
        typeof ghost.fill === "function" &&
        typeof ghost.stroke === "function"
      ) {
        ghost
          .circle(0,0,radiusPx)
          .fill({color:0xffd24a,alpha:0.10})
          .stroke({color:0xffd24a,width:3,alpha:0.9});
      } else {
        ghost.lineStyle(3,0xffd24a,0.9);
        ghost.beginFill(0xffd24a,0.10);
        ghost.drawCircle(0,0,radiusPx);
        ghost.endFill();
      }

      ghost.eventMode = "none";
      canvas.stage.addChild(ghost);
      return ghost;
    } catch {
      return null;
    }
  }

  async function pickPoint(scene,sourceCenter,rangeFt,radiusFt,name) {
    if (placementActive) {
      throw new Error("Finish the current grenade placement first.");
    }

    if (
      String(canvas?.scene?.id ?? "") !==
      String(scene?.id ?? "")
    ) {
      throw new Error("Open the grenade actor's scene before throwing.");
    }

    const stage = canvas?.stage;

    if (!stage?.on || !stage?.off) {
      throw new Error("Canvas placement is unavailable.");
    }

    placementActive = true;

    ui.notifications?.info?.(
      "GRENADE // "+name+
      " // click the map to place the "+radiusFt+
      " ft template. Right-click or Esc cancels."
    );

    const ghost = makePlacementGhost(scene,radiusFt);

    return new Promise((resolve,reject) => {
      let settled = false;

      const cleanup = () => {
        placementActive = false;

        try { stage.off("pointermove",onMove); } catch {}
        try { stage.off("pointerdown",onDown); } catch {}
        try { window.removeEventListener("keydown",onKey,true); } catch {}

        try {
          if (ghost?.parent) ghost.parent.removeChild(ghost);
          ghost?.destroy?.();
        } catch {}
      };

      const finish = value => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const onMove = event => {
        if (!ghost) return;
        const point = stagePoint(event);
        if (!point) return;
        ghost.position.set(point.x,point.y);
      };

      const onDown = event => {
        const button =
          Number(
            event?.button ??
            event?.data?.button ??
            event?.nativeEvent?.button ??
            0
          );

        if (button === 2) {
          finish(null);
          return;
        }

        if (button !== 0) return;

        const point = stagePoint(event);
        if (!point) return;

        const distance =
          feetBetween(scene,sourceCenter,point);

        if (distance > rangeFt + 0.01) {
          ui.notifications?.warn?.(
            "Grenade is out of range ("+
            Math.ceil(distance)+" ft / "+rangeFt+" ft)."
          );
          return;
        }

        finish(point);
      };

      const onKey = event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish(null);
        }
      };

      stage.on("pointermove",onMove);
      stage.on("pointerdown",onDown);
      window.addEventListener("keydown",onKey,true);
    });
  }

  function selectedTargets() {
    return list(game.user?.targets)
      .map(target => target?.document ?? target)
      .filter(token => token?.documentName === "Token" || token?.actor);
  }

  async function useItem(item) {
    if (!isGrenade(item)) {
      throw new Error("That item is not a FEHA grenade.");
    }

    const actor = item.parent;

    if (!actor || actor.documentName !== "Actor") {
      throw new Error("Put the grenade on an Actor before using it.");
    }

    assertBonusActionAvailable(actor);

    const scene = canvas?.scene ?? null;

    if (!scene) {
      throw new Error("No active scene is available for grenade placement.");
    }

    const controlledToken =
      list(canvas?.tokens?.controlled)
        .map(token => token?.document ?? token)
        .find(token =>
          String(token?.actorId ?? token?.actor?.id ?? "") ===
          String(actor.id)
        ) ??
      null;

    const sourceToken =
      actorToken(
        scene,
        actor,
        controlledToken?.id ?? null
      );

    if (!sourceToken) {
      throw new Error("The grenade user needs a token on the active scene.");
    }

    const def = catalog.definition(item);
    const schema = def?.schema ?? {};
    const targets = selectedTargets();

    let primaryToken = null;

    if (def.delivery === "homing") {
      if (targets.length !== 1) {
        ui.notifications?.warn?.(
          "Homing grenade: target exactly one creature, then use the grenade again."
        );
        return null;
      }

      primaryToken = targets[0];
    }

    if (def.delivery === "sticky" && targets.length === 1) {
      primaryToken = targets[0];
    } else if (def.delivery === "sticky" && targets.length > 1) {
      ui.notifications?.warn?.(
        "Sticky grenade: target at most one creature."
      );
      return null;
    }

    let center = primaryToken
      ? tokenCenter(primaryToken,scene)
      : null;

    if (!center) {
      const sourceCenter = tokenCenter(sourceToken,scene);

      center =
        await pickPoint(
          scene,
          sourceCenter,
          Math.max(1,Number(schema.rangeFt ?? 60) || 60),
          Math.max(1,Number(schema.radiusFt ?? 5) || 5),
          def.name
        );

      if (!center) {
        ui.notifications?.info?.("Grenade throw cancelled.");
        return null;
      }
    }

    const flightKey =
      String(actor.id)+":"+String(item.id);

    if (inFlight.has(flightKey)) {
      throw new Error(
        "That grenade is already being resolved."
      );
    }

    inFlight.add(flightKey);

    try {
      const result =
        await requestUse({
          actorId:actor.id,
          itemId:item.id,
          sceneId:scene.id,
          sourceTokenId:sourceToken.id,
          targetTokenId:primaryToken?.id ?? null,
          center
        });

      await markBonusActionUsed(
        actor,
        "grenade"
      );

      ui.notifications?.info?.(
        "GRENADE // "+def.name+" // DETONATED // BONUS ACTION SPENT"
      );

      return result;
    } finally {
      inFlight.delete(flightKey);
    }
  }

  async function detonateCookoff({actor,item,scene,token,userId=null}={}) {
    if (!game.user?.isGM) {
      throw new Error("Cookoff grenade detonation requires GM authority.");
    }

    if (!actor || !item || !scene || !token) {
      throw new Error("Cookoff grenade context is incomplete.");
    }

    const center = tokenCenter(token,scene);

    return executeLocal(
      {
        actorId:actor.id,
        itemId:item.id,
        sceneId:scene.id,
        sourceTokenId:token.id,
        targetTokenId:token.id,
        center
      },
      userId ?? game.user.id,
      {cookoff:true}
    );
  }

  function installItemUseBridge() {
    const protos = new Set([
      globalThis.CONFIG?.Item?.documentClass?.prototype,
      globalThis.dnd5e?.documents?.Item5e?.prototype,
      globalThis.Item?.prototype
    ].filter(Boolean));

    for (const proto of protos) {
      if (
        typeof proto.use !== "function" ||
        proto.use?.__fehaGrenadeBridge
      ) {
        continue;
      }

      const original = proto.use;

      const wrapper = async function(...args) {
        try {
          if (isGrenade(this)) {
            return api.use(this);
          }
        } catch (error) {
          ui.notifications?.error?.(
            "Grenade use failed: "+String(error?.message ?? error)
          );
          throw error;
        }

        // Catalog consumables and active cyberware share this one
        // item-use bridge.
        for (const name of ["consumableRuntime","cyberwareRuntime"]) {
          const runtime = core.module?.(name) ?? null;
          if (!runtime?.handles?.(this)) continue;

          try {
            return await runtime.use(this);
          } catch (error) {
            ui.notifications?.error?.(
              "Item use failed: "+String(error?.message ?? error)
            );
            throw error;
          }
        }

        return original.apply(this,args);
      };

      wrapper.__fehaGrenadeBridge = true;
      wrapper.__fehaGrenadeOriginal = original;

      proto.use = wrapper;
      bridges.push({proto,original,wrapper});
    }
  }

  function removeItemUseBridge() {
    for (const bridge of bridges.splice(0)) {
      try {
        if (bridge.proto.use === bridge.wrapper) {
          bridge.proto.use = bridge.original;
        }
      } catch {}
    }
  }

  async function onCombatUpdate(combat,changed) {
    if (!game.user?.isGM) return;

    // Other GMs only keep track of whose turn it is, in case they take over.
    if (!isAuthority()) {
      lastCombatantByCombat.set(
        combat.id,
        currentCombatTokenId(combat) ?? null
      );
      return;
    }

    const advanced =
      Object.prototype.hasOwnProperty.call(changed ?? {},"turn") ||
      Object.prototype.hasOwnProperty.call(changed ?? {},"round");

    if (advanced) {
      const current = currentCombatTokenId(combat);

      const previous =
        lastCombatantByCombat.get(combat.id) ??
        combat?.previous?.tokenId ??
        (
          combat?.previous?.combatantId
            ? combat.combatants?.get?.(
                combat.previous.combatantId
              )?.tokenId
            : null
        ) ??
        null;

      if (previous) {
        const actor = combatantActor(combat,previous);
        await processTurnEnd(actor,combat.id,previous);
      }

      if (current) {
        const actor = combatantActor(combat,current);
        await processTurnStart(actor,combat.id,current);
      }

      lastCombatantByCombat.set(combat.id,current ?? null);
    }

    await cleanupTemplates();
  }

  function domRoot(html) {
    return (
      html instanceof HTMLElement
        ? html
        : html?.[0] ?? null
    );
  }

  function hideLegacyGrenadeChrome(root) {
    if (!root?.querySelectorAll) return;

    const targets = [
      root,
      ...root.querySelectorAll("*")
    ];

    for (const element of targets) {
      if (!(element instanceof HTMLElement)) continue;

      const text = String(
        element.innerText ??
        element.textContent ??
        ""
      )
        .replace(/\s+/g," ")
        .trim();

      const legacyCharge =
        /^\d+\s*\/\s*\d+\s*charges?$/i.test(text);

      const equipState =
        /^(not\s+equipped|equipped)$/i.test(text);

      if (!legacyCharge && !equipState) continue;

      element.style.setProperty("display","none","important");
      element.dataset.fehaGrenadeChromeHidden = "1";
    }
  }

  function actorGrenadeRows(app,html) {
    const actor =
      app?.document ??
      app?.actor ??
      app?.object ??
      null;

    if (actor?.documentName !== "Actor") return;

    const root = domRoot(html);
    if (!root?.querySelectorAll) return;

    const grenades =
      list(actor.items).filter(isGrenade);

    for (const item of grenades) {
      const id = String(item.id ?? "");
      if (!id) continue;

      const escaped =
        globalThis.CSS?.escape
          ? globalThis.CSS.escape(id)
          : id.replace(/"/g,'\\\"');

      const selectors = [
        '[data-item-id="'+escaped+'"]',
        '[data-entry-id="'+escaped+'"]',
        '[data-document-id="'+escaped+'"]',
        '[data-id="'+escaped+'"]'
      ];

      let row = null;

      for (const selector of selectors) {
        try {
          row = root.querySelector(selector);
        } catch {}

        if (row) break;
      }

      if (!row) continue;
      hideLegacyGrenadeChrome(row);
    }
  }

  function injectGrenadeSheetButton(app,html) {
    const item =
      app?.document ??
      app?.item ??
      app?.object ??
      null;

    if (!isGrenade(item)) return;

    const root = domRoot(html);

    if (!root?.querySelector) return;

    hideLegacyGrenadeChrome(root);

    if (root.querySelector("[data-feha-grenade-use]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.fehaGrenadeUse = "1";
    button.innerHTML =
      '<i class="fa-solid fa-bomb"></i> THROW GRENADE';
    button.style.cssText =
      "width:100%;margin:4px 0 8px;padding:8px 10px;"+
      "font-weight:900;letter-spacing:.08em;"+
      "border:1px solid #d7a932;background:#19140a;color:#ffd95a;";

    button.addEventListener("click",event => {
      event.preventDefault();
      event.stopPropagation();

      void api.use(item).catch(error => {
        console.error("FEHA GRENADE // sheet use failed",error);
        ui.notifications?.error?.(
          "Grenade use failed: "+String(error?.message ?? error)
        );
      });
    });

    const target =
      root.querySelector("form") ??
      root.querySelector(".window-content") ??
      root;

    try {
      target.prepend(button);
    } catch {}
  }

  function installHooks() {
    if (!globalThis.Hooks?.on) return;

    hooks.push([
      "renderActorSheet",
      globalThis.Hooks.on(
        "renderActorSheet",
        (app,html) => actorGrenadeRows(app,html)
      )
    ]);

    hooks.push([
      "renderActorSheetV2",
      globalThis.Hooks.on(
        "renderActorSheetV2",
        (app,html) => actorGrenadeRows(app,html)
      )
    ]);

    hooks.push([
      "renderItemSheet",
      globalThis.Hooks.on(
        "renderItemSheet",
        (app,html) => injectGrenadeSheetButton(app,html)
      )
    ]);

    hooks.push([
      "renderItemSheetV2",
      globalThis.Hooks.on(
        "renderItemSheetV2",
        (app,html) => injectGrenadeSheetButton(app,html)
      )
    ]);

    hooks.push([
      "dnd5e.preUseActivity",
      globalThis.Hooks.on(
        "dnd5e.preUseActivity",
        activity => {
          const item =
            activity?.item ??
            activity?.parent ??
            null;

          if (!isGrenade(item)) return true;

          void api.use(item).catch(error => {
            console.error("FEHA GRENADE // activity use failed",error);
            ui.notifications?.error?.(
              "Grenade use failed: "+String(error?.message ?? error)
            );
          });

          return false;
        }
      )
    ]);

    hooks.push([
      "dnd5e.preUseItem",
      globalThis.Hooks.on(
        "dnd5e.preUseItem",
        item => {
          if (!isGrenade(item)) return true;

          void api.use(item).catch(error => {
            console.error("FEHA GRENADE // use failed",error);
            ui.notifications?.error?.(
              "Grenade use failed: "+String(error?.message ?? error)
            );
          });

          return false;
        }
      )
    ]);

    hooks.push([
      "updateCombat",
      globalThis.Hooks.on(
        "updateCombat",
        (combat,changed) => void onCombatUpdate(combat,changed)
      )
    ]);

    hooks.push([
      "deleteCombat",
      globalThis.Hooks.on(
        "deleteCombat",
        combat => {
          lastCombatantByCombat.delete(combat?.id);
          void clearCombatBoundEffects(combat?.id);
          void cleanupTemplates();
        }
      )
    ]);

    hooks.push([
      "updateToken",
      globalThis.Hooks.on(
        "updateToken",
        token => {
          if (!isAuthority()) return;

          const scene = token?.parent ?? null;
          if (!scene) return;

          void (async () => {
            await moveAnchoredZones(scene,token);

            for (const template of grenadeTemplates(scene)) {
              if (template.flags?.[FLAG]?.grenadeZone?.kind) {
                await syncZone(template);
              }
            }
          })();
        }
      )
    ]);

    hooks.push([
      "createMeasuredTemplate",
      globalThis.Hooks.on(
        "createMeasuredTemplate",
        template => {
          if (!isAuthority()) return;
          if (!template?.flags?.[FLAG]?.grenadeZone?.kind) return;
          void syncZone(template);
        }
      )
    ]);

    hooks.push([
      "deleteMeasuredTemplate",
      globalThis.Hooks.on(
        "deleteMeasuredTemplate",
        template => {
          if (!isAuthority()) return;
          if (template?.flags?.[FLAG]?.grenadeTemplate !== true) return;
          void removeZoneMarkers(template.id);
        }
      )
    ]);
  }

  function removeHooks() {
    for (const [name,id] of hooks.splice(0)) {
      try { globalThis.Hooks.off(name,id); } catch {}
    }
  }

  const api = {
    version:VERSION,
    isGrenade,
    use:useItem,
    detonateCookoff,
    authorityGM,
    assertBonusActionAvailable,
    markBonusActionUsed,

    async init() {
      if (socketHandler) {
        try { if (CONFIG.queries) delete CONFIG.queries[CH]; } catch {}
      }

      socketHandler = receive;
      CONFIG.queries[CH] = message => {
        void socketHandler?.(message);
        return true;
      };

      installHooks();
      installItemUseBridge();

      if (game.user?.isGM) {
        const combat = game.combat;

        if (combat?.id) {
          lastCombatantByCombat.set(
            combat.id,
            currentCombatTokenId(combat)
          );
        }

        cleanupTimer =
          setInterval(
            () => void cleanupTimedByTime(),
            1000
          );

        void cleanupTimedByTime();

        for (const scene of list(game.scenes)) {
          for (const template of grenadeTemplates(scene)) {
            if (template.flags?.[FLAG]?.grenadeZone?.kind) {
              void syncZone(template);
            }
          }
        }
      }

      globalThis.FEHA_GRENADE_RUNTIME = api;
      game.adk ??= {};
      game.adk.grenadeRuntime = api;

      console.log(
        "FEHA GRENADE RUNTIME",
        VERSION,
        "ready // measured templates + silent authority online"
      );
    },

    async destroy() {
      if (socketHandler) {
        try { if (CONFIG.queries) delete CONFIG.queries[CH]; } catch {}
      }

      socketHandler = null;

      for (const settle of [...pending.values()]) {
        try { settle.cancel?.(); } catch {}
      }

      pending.clear();
      inFlight.clear();
      removeHooks();
      removeItemUseBridge();

      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }

      lastCombatantByCombat.clear();
      placementActive = false;

      if (game?.adk?.grenadeRuntime === api) {
        delete game.adk.grenadeRuntime;
      }

      if (globalThis.FEHA_GRENADE_RUNTIME === api) {
        delete globalThis.FEHA_GRENADE_RUNTIME;
      }
    }
  };

  core.registerModule("grenadeRuntime",api);
  globalThis.FEHA_GRENADE_RUNTIME = api;
})();
