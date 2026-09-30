// FEHA // WEAPON TRACKER
// Automatic local combat HUD for canonical firearms.
// Tracks attacks used before reload and manual reload progress.
// Does NOT spend actions, block attacks, or mutate real ammunition.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_TRACKER requires FEHA_CYBER_CORE.");

  const VERSION = "2.2.0";
  const FLAG = "fleshEnshrouded";
  const HUD_ID = "feha-weapon-tracker-hud";
  const hooks = [];
  const recentRolls = new Map();
  const lastAttackByWeapon = new Map();
  const lastWeaponByActor = new Map();
  let hideTimer = null;

  function definition(item) {
    return globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.weapons?.definition?.(item) ??
      globalThis.FEHA_UNIQUE_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.uniqueWeapons?.definition?.(item) ??
      null;
  }

  function actorFor(item) {
    return item?.parent?.documentName === "Actor" ? item.parent : null;
  }

  function weaponKey(item) {
    const actor = actorFor(item);
    return String(actor?.id ?? "")+":"+String(item?.id ?? "");
  }

  function activityItem(activity) {
    if (activity?.item) return activity.item;
    if (activity?.parent?.documentName === "Item") return activity.parent;
    return null;
  }

  function isTrackable(item) {
    const def = definition(item);
    return Boolean(
      item?.type === "weapon" &&
      def &&
      def.weaponClass !== "Bow" &&
      Number(def.functionalAttacks ?? 0) > 0
    );
  }

  function capacity(item) {
    const def = definition(item);
    return Math.max(0,Math.floor(Number(def?.functionalAttacks ?? 0) || 0));
  }

  function reloadPoints(item) {
    const def = definition(item);
    return Math.max(
      0,
      Math.floor(Number(def?.reloadPoints ?? def?.reloadActions ?? 0) || 0)
    );
  }

  function statePath(item,key) {
    return "flags."+FLAG+".weaponTracker."+String(item.id)+"."+key;
  }

  function state(item) {
    const actor = actorFor(item);
    const max = capacity(item);
    const reloadMax = reloadPoints(item);
    const raw =
      actor?.flags?.[FLAG]?.weaponTracker?.[String(item.id)] ?? {};

    const used = Math.max(
      0,
      Math.min(max,Math.floor(Number(raw.used ?? 0) || 0))
    );

    const reload = Math.max(
      0,
      Math.min(reloadMax,Math.floor(Number(raw.reload ?? 0) || 0))
    );

    return {
      used,
      remaining:Math.max(0,max-used),
      capacity:max,
      reload,
      reloadMax,
      empty:max > 0 && used >= max
    };
  }

  async function writeState(item,{used,reload}) {
    const actor = actorFor(item);
    if (!actor || actor.isOwner === false) {
      return {ok:false,reason:"not-owner",state:state(item)};
    }

    const max = capacity(item);
    const reloadMax = reloadPoints(item);

    const nextUsed = Math.max(
      0,
      Math.min(max,Math.floor(Number(used ?? 0) || 0))
    );

    const nextReload = Math.max(
      0,
      Math.min(reloadMax,Math.floor(Number(reload ?? 0) || 0))
    );

    await actor.update({
      [statePath(item,"used")]:nextUsed,
      [statePath(item,"reload")]:nextReload,
      [statePath(item,"updatedAt")]:Date.now()
    });

    return {ok:true,state:state(item)};
  }

  async function recordShot(item) {
    if (!isTrackable(item)) {
      return {ok:false,reason:"not-trackable",state:state(item)};
    }

    const before = state(item);

    if (before.empty) {
      show(item,{flash:"RELOAD REQUIRED"});
      return {ok:false,reason:"empty",state:before};
    }

    const result = await writeState(item,{
      used:before.used+1,
      reload:0
    });

    show(item,{
      flash:result.state?.empty ? "MAG EMPTY // RELOAD" : "SHOT REGISTERED"
    });

    return result;
  }

  async function undoShot(item) {
    const before = state(item);
    const result = await writeState(item,{
      used:Math.max(0,before.used-1),
      reload:before.reload
    });
    show(item,{flash:"SHOT UNDONE"});
    return result;
  }

  async function resetWeapon(item,{flash="TRACKER RESET"}={}) {
    const result = await writeState(item,{used:0,reload:0});
    show(item,{flash});
    return result;
  }

  async function addReload(item,points,label) {
    const before = state(item);

    if (!before.reloadMax) {
      return resetWeapon(item,{flash:"CHARGE / RELOAD RESET"});
    }

    const next = before.reload + Math.max(0,Number(points) || 0);

    if (next >= before.reloadMax) {
      const result = await writeState(item,{used:0,reload:0});
      show(item,{flash:"RELOAD COMPLETE"});
      return result;
    }

    const result = await writeState(item,{
      used:before.used,
      reload:next
    });

    show(item,{flash:(label ?? "RELOAD")+" +"+points});
    return result;
  }

  function equippedFirearms(actor) {
    if (!actor) return [];
    return [...(actor.items?.contents ?? actor.items ?? [])]
      .filter(item => item?.system?.equipped === true)
      .filter(isTrackable);
  }

  function selectedActor() {
    return canvas?.tokens?.controlled?.[0]?.actor ??
      game.user?.character ??
      null;
  }

  function resolveOpenTarget(input=null) {
    if (input?.documentName === "Item") return input;

    const actor =
      input?.documentName === "Actor"
        ? input
        : selectedActor();

    const items = equippedFirearms(actor);
    if (!items.length) return null;

    const lastId =
      String(lastWeaponByActor.get(String(actor?.id ?? "")) ?? "");

    return items.find(item => String(item.id) === lastId) ??
      items[0] ??
      null;
  }
  function activities(item) {
    const collection = item?.system?.activities;
    if (!collection) return [];
    if (Array.isArray(collection)) return collection;
    if (Array.isArray(collection.contents)) return collection.contents;
    if (typeof collection.values === "function") {
      try { return [...collection.values()]; } catch {}
    }
    if (typeof collection === "object") return Object.values(collection);
    return [];
  }

  function legacyAttackStub(activity) {
    const source = activity?._source ?? activity ?? {};
    if (String(source?.type ?? activity?.type ?? "").toLowerCase() !== "attack") return false;

    const name = String(source?.name ?? "").trim();
    const sort = Number(source?.sort ?? activity?.sort ?? 0) || 0;
    const range = source?.range ?? {};
    const damage = source?.damage ?? {};
    const parts = Array.isArray(damage?.parts)
      ? damage.parts
      : Array.isArray(damage?.parts?.contents)
        ? damage.parts.contents
        : [];
    const effects = Array.isArray(source?.effects) ? source.effects : [];

    const rangeValue = range?.value;
    const noRange =
      rangeValue == null ||
      rangeValue === "" ||
      Number(rangeValue) === 0;

    return (
      (!name || name.toLowerCase() === "attack") &&
      sort === 0 &&
      String(range?.units ?? "") === "self" &&
      noRange &&
      damage?.includeBase === true &&
      parts.length === 0 &&
      effects.length === 0
    );
  }

  function primaryAttack(item) {
    const attacks = activities(item).filter(activity =>
      String(activity?.type ?? activity?._source?.type ?? "").toLowerCase() === "attack"
    );

    if (!attacks.length) return null;

    const usable = attacks.filter(activity => !legacyAttackStub(activity));
    const pool = usable.length ? usable : attacks;

    const score = activity => {
      const source = activity?._source ?? activity ?? {};
      const range = source?.range ?? activity?.range ?? {};
      const attack = source?.attack ?? activity?.attack ?? {};
      let value = 0;

      if (String(source?.name ?? activity?.name ?? "").trim()) value += 2;
      if ((Number(source?.sort ?? activity?.sort ?? 0) || 0) > 0) value += 3;
      if ((Number(range?.value ?? 0) || 0) > 0) value += 4;
      if (String(range?.units ?? "") === "ft") value += 1;
      if (String(attack?.ability ?? "").trim()) value += 2;
      if (activity?.img || source?.img) value += 1;

      return value;
    };

    return [...pool].sort((a,b) => score(b)-score(a))[0] ?? null;
  }

  async function useAttack(item,event=null) {
    const activity = primaryAttack(item);
    if (!activity || typeof activity.use !== "function") {
      ui.notifications?.warn?.("FEHA Weapon Tracker // no usable attack activity found for "+String(item?.name ?? "weapon")+".");
      return {ok:false,reason:"no-attack-activity"};
    }

    try {
      const result = await activity.use({event,legacy:false});
      return {ok:true,result,activity};
    } catch (error) {
      console.warn("FEHA WEAPON TRACKER // attack use failed",item?.name,error);
      ui.notifications?.warn?.("FEHA Weapon Tracker // attack failed. Check console.");
      return {ok:false,reason:"attack-failed",error};
    }
  }

  async function rollDamage(item,event=null) {
    const activity = primaryAttack(item);
    if (!activity || typeof activity.rollDamage !== "function") {
      ui.notifications?.warn?.(
        "FEHA Weapon Tracker // no damage action found for "+
        String(item?.name ?? "weapon")+"."
      );
      return {ok:false,reason:"no-damage-action"};
    }

    const context =
      lastAttackByWeapon.get(weaponKey(item)) ??
      null;

    const config = {event};
    if (context?.attackMode) config.attackMode = context.attackMode;
    if (context?.isCritical === true) config.isCritical = true;
    if (context?.ammunition) config.ammunition = context.ammunition;

    try {
      const result = await activity.rollDamage(config);
      return {ok:true,result,activity,context};
    } catch (error) {
      console.warn(
        "FEHA WEAPON TRACKER // damage roll failed",
        item?.name,
        error
      );
      ui.notifications?.warn?.(
        "FEHA Weapon Tracker // damage roll failed. Check console."
      );
      return {ok:false,reason:"damage-failed",error};
    }
  }

  function rememberAttackContext(item,rolls=[]) {
    const first =
      Array.isArray(rolls)
        ? rolls[0]
        : rolls?.[0] ?? null;

    const options = first?.options ?? {};
    const actor = actorFor(item);

    let ammunition = null;
    const ammoId =
      String(options?.ammunition ?? "").trim();

    if (ammoId && actor?.items?.get) {
      ammunition = actor.items.get(ammoId) ?? null;
    }

    const context = {
      at:Date.now(),
      attackMode:String(options?.attackMode ?? "") || null,
      isCritical:Boolean(first?.isCritical),
      ammunition,
      rollId:String(first?.id ?? first?._id ?? "")
    };

    lastAttackByWeapon.set(weaponKey(item),context);

    if (actor?.id) {
      lastWeaponByActor.set(
        String(actor.id),
        String(item.id)
      );
    }

    return context;
  }


  function purgeLegacyPanels() {
    try {
      for (const node of document.querySelectorAll(
        '[data-feha-reload-tracker], [id^="feha-reload-tracker-"]'
      )) {
        node.remove();
      }
    } catch {}
  }

  function ensureHud() {
    let root = document.getElementById(HUD_ID);
    if (root) return root;

    root = document.createElement("section");
    root.id = HUD_ID;
    root.style.cssText = [
      "position:fixed",
      "left:50%",
      "top:50%",
      "transform:translate(-50%,-50%)",
      "z-index:100000",
      "width:min(560px,calc(100vw - 48px))",
      "background:linear-gradient(145deg,#061116 0%,#0a171d 75%,#10191c 100%)",
      "border:1px solid #316b79",
      "box-shadow:0 18px 60px #000b,0 0 22px #21d4ff22",
      "color:#dce8ec",
      "font-family:var(--font-primary)",
      "clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,12px 100%,0 calc(100% - 12px))"
    ].join(";");

    document.body.appendChild(root);
    return root;
  }

  function segmentBar(remaining,max) {
    const visible = Math.max(1,Math.min(max,16));
    const filled = max <= 16
      ? remaining
      : Math.round((remaining/max)*visible);

    return Array.from({length:visible},(_,index) => {
      const on = index < filled;
      return '<i style="' +
        'display:block;height:10px;flex:1;min-width:5px;' +
        'background:'+(on ? '#66e4ff' : '#26343a')+';' +
        'box-shadow:'+(on ? '0 0 8px #39dfff66' : 'none')+'"></i>';
    }).join("");
  }

  function show(input=null,{flash=""}={}) {
    const item = resolveOpenTarget(input);
    if (!item || !isTrackable(item)) {
      ui.notifications?.warn?.("FEHA Weapon Tracker // no equipped canonical firearm found.");
      return null;
    }

    const actor = actorFor(item);
    const def = definition(item);
    const current = state(item);
    const root = ensureHud();

    root.dataset.actorId = String(actor?.id ?? "");
    root.dataset.itemId = String(item.id ?? "");

    if (actor?.id) {
      lastWeaponByActor.set(String(actor.id),String(item.id));
    }

    const equipped = equippedFirearms(actor);
    const weaponTabs = equipped.length > 1
      ? (
        '<div style="display:flex;gap:5px;flex-wrap:wrap;margin:0 0 9px">' +
        equipped.map(weapon => {
          const active = String(weapon.id) === String(item.id);
          const safeName = String(weapon.name ?? "Weapon")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;");
          return '<button type="button" data-feha-wt="weapon" data-weapon-id="'+
            String(weapon.id).replace(/"/g,"&quot;")+
            '" style="padding:5px 8px;background:'+
            (active ? '#163844' : '#091317')+
            ';border:1px solid '+(active ? '#5ee7ff' : '#2b4249')+
            ';color:'+(active ? '#fff' : '#9ab0b8')+
            ';font-size:10px;font-weight:800">'+
            safeName+
            '</button>';
        }).join("")+
        '</div>'
      )
      : "";

    const status =
      current.empty ? "RELOAD REQUIRED" :
      current.reload > 0 ? "RELOADING" :
      "WEAPON READY";

    const statusColor =
      current.empty ? "#ff6574" :
      current.reload > 0 ? "#f3ce63" :
      "#72e8ff";

    const physical =
      def?.physicalCapacity == null ? "" :
      '<span>PHYSICAL '+String(def.physicalCapacity)+' '+String(def.capacityType ?? "").toUpperCase()+'</span>';

    const attackActivity = primaryAttack(item);
    const attackAvailable = Boolean(attackActivity?.use);
    const damageAvailable = Boolean(attackActivity?.rollDamage);
    const damageFormula = String(def?.damage ?? item?.flags?.[FLAG]?.damageFormula ?? "—");
    const rangeLabel =
      def?.longRange
        ? String(def.range)+" / "+String(def.longRange)+" FT"
        : String(def?.range ?? "—")+" FT";

    const sealedDisposable =
      Boolean(def?.effect?.sealedDisposable);

    const reloadControls = sealedDisposable
      ? (
        '<div style="margin-top:8px;padding:8px 10px;border:1px solid #5b342f;background:#1a0d0c;color:#ff9f92;font-size:10px;font-weight:900;letter-spacing:.08em">SEALED DISPOSABLE // NO RELOAD</div>'
      )
      : current.reloadMax > 0
        ? (
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">' +
            '<button type="button" data-feha-wt="action" style="padding:7px;background:#13242a;border:1px solid #36545e;color:#eef8fb;font-weight:800">ACTION <small style="color:#8fb8c2">+2</small></button>' +
            '<button type="button" data-feha-wt="bonus" style="padding:7px;background:#13242a;border:1px solid #36545e;color:#eef8fb;font-weight:800">BONUS <small style="color:#8fb8c2">+1</small></button>' +
          '</div>' +
          '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;color:#9eb3ba;font-size:10px">' +
            '<span>RELOAD</span><strong style="color:#fff">'+current.reload+' / '+current.reloadMax+' PTS</strong>' +
            '<span style="margin-left:auto">ACTION=2 // BONUS=1</span>' +
          '</div>'
        )
        : (
          '<button type="button" data-feha-wt="reset" style="width:100%;margin-top:8px;padding:7px;background:#13242a;border:1px solid #36545e;color:#eef8fb;font-weight:800">RESET / CHARGE</button>'
        );

    root.innerHTML =
      '<div style="padding:10px 12px 11px">' +
        weaponTabs +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<img src="'+String(item.img ?? "icons/svg/item-bag.svg").replace(/"/g,"&quot;")+'" style="width:48px;height:48px;object-fit:cover;border:1px solid #356473;background:#02090c">' +
          '<div style="min-width:0;flex:1">' +
            '<small style="display:block;color:#67dff4;letter-spacing:.12em;font-weight:900">FEHA // WEAPON TRACKER</small>' +
            '<strong style="display:block;color:#fff;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+String(item.name ?? "WEAPON")+'</strong>' +
            '<span style="display:block;color:#8fa8b1;font-size:10px">'+String(def?.company ?? "")+' // '+String(def?.weaponClass ?? "")+'</span>' +
          '</div>' +
          '<button type="button" data-feha-wt="close" style="align-self:flex-start;background:transparent;border:0;color:#9cb3bb;font-size:18px">×</button>' +
        '</div>' +

        '<div style="margin-top:10px;padding:9px;border:1px solid #1f4650;background:#071015">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">' +
            '<span style="font-size:10px;color:#8fa8b1;letter-spacing:.08em">ATTACKS REMAINING</span>' +
            '<strong style="font-size:18px;color:'+statusColor+'">'+current.remaining+' / '+current.capacity+'</strong>' +
          '</div>' +
          '<div style="display:flex;gap:3px;margin-top:6px">'+segmentBar(current.remaining,current.capacity)+'</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;color:#849ca4;font-size:9px">' +
            '<span>FIRED '+current.used+' / '+current.capacity+'</span>' +
            physical +
          '</div>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px;align-items:center">' +
          '<strong style="font-size:11px;color:'+statusColor+'">'+status+'</strong>' +
          (flash ? '<span style="font-size:10px;color:#f3ce63">'+flash+'</span>' : '') +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1.45fr 1fr;gap:8px;margin-top:10px">' +
          '<button type="button" data-feha-wt="attack" '+(attackAvailable ? '' : 'disabled')+' style="padding:14px 12px;background:#0d3440;border:1px solid #57dff8;color:#f4fdff;font-weight:1000;font-size:14px;letter-spacing:.08em;box-shadow:inset 0 0 18px #20dbff18">ATTACK</button>' +
          '<button type="button" data-feha-wt="damage" '+(damageAvailable ? '' : 'disabled')+' style="padding:14px 12px;background:#332513;border:1px solid #d9af55;color:#fff8e8;font-weight:1000;font-size:14px;letter-spacing:.08em;box-shadow:inset 0 0 18px #ffc54b12">DAMAGE</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;padding:7px 9px;border:1px solid #18333c;background:#050d10;color:#829aa3;font-size:10px">' +
          '<span>DAMAGE <strong style="color:#fff">'+damageFormula+'</strong></span>' +
          '<span style="text-align:right">RANGE <strong style="color:#fff">'+rangeLabel+'</strong></span>' +
        '</div>' +

        reloadControls +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">' +
          '<button type="button" data-feha-wt="undo" style="padding:6px;background:#0b1519;border:1px solid #283a40;color:#9fb4bb">UNDO SHOT</button>' +
          '<button type="button" data-feha-wt="reset" style="padding:6px;background:#0b1519;border:1px solid #283a40;color:#9fb4bb">RESET TRACKER</button>' +
        '</div>' +
      '</div>';

    root.onclick = async event => {
      const button = event.target?.closest?.("[data-feha-wt]");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.fehaWt;
      if (action === "close") {
        root.remove();
        return;
      }

      const liveActor = game.actors?.get?.(root.dataset.actorId);

      if (action === "weapon") {
        const next =
          liveActor?.items?.get?.(button.dataset.weaponId);

        if (next && isTrackable(next)) {
          show(next,{flash:"WEAPON SELECTED"});
        }
        return;
      }

      const liveItem = liveActor?.items?.get?.(root.dataset.itemId);
      if (!liveItem) {
        root.remove();
        return;
      }

      button.disabled = true;
      try {
        if (action === "attack") {
          if (state(liveItem).empty) {
            ui.notifications?.warn?.("FEHA Weapon Tracker // "+String(liveItem.name)+" is tracked empty. Attack is still allowed; reload/reset if this is intentional.");
          }
          await useAttack(liveItem,event);
        }
        else if (action === "damage") await rollDamage(liveItem,event);
        else if (action === "action") await addReload(liveItem,2,"ACTION");
        else if (action === "bonus") await addReload(liveItem,1,"BONUS");
        else if (action === "undo") await undoShot(liveItem);
        else if (action === "reset") await resetWeapon(liveItem);
      } finally {
        button.disabled = false;
      }
    };

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      document.getElementById(HUD_ID)?.remove?.();
    },30000);

    return root;
  }

  function rollKey(item,rolls=[]) {
    const first =
      Array.isArray(rolls)
        ? rolls[0]
        : rolls?.[0] ?? null;

    const stamp =
      String(first?.id ?? first?._id ?? "") ||
      String(first?.options?.dialogOptions?.id ?? "") ||
      String(Date.now());

    return weaponKey(item)+":"+stamp;
  }

  function onPostRollAttack(rolls,data={}) {
    const activity = data?.subject ?? null;
    const item = activityItem(activity);
    if (!isTrackable(item)) return;

    const actor = actorFor(item);
    if (!actor || actor.isOwner === false) return;

    const key = rollKey(item,rolls);
    const now = Date.now();
    const last = Number(recentRolls.get(key) ?? 0);

    if (now-last < 1000) return;
    recentRolls.set(key,now);

    for (const [entry,time] of recentRolls) {
      if (now-time > 10000) recentRolls.delete(entry);
    }

    rememberAttackContext(item,rolls);

    void recordShot(item).catch(error => {
      console.warn(
        "FEHA WEAPON TRACKER // shot tracking failed",
        item?.name,
        error
      );
    });
  }

  async function cleanupLegacyState() {
    if (!game.user?.isGM) return {actors:0};

    let actors = 0;

    for (const actor of game.actors?.contents ?? []) {
      if (
        !Object.prototype.hasOwnProperty.call(
          actor.flags?.[FLAG] ?? {},
          "reloadTracker"
        )
      ) {
        continue;
      }

      try {
        await actor.update({
          ["flags."+FLAG+".-=reloadTracker"]:null
        });
        actors++;
      } catch (error) {
        console.warn(
          "FEHA WEAPON TRACKER // legacy reload state cleanup failed",
          actor?.name,
          error
        );
      }
    }

    return {actors};
  }

  function installHooks() {
    hooks.push([
      "dnd5e.postRollAttack",
      Hooks.on("dnd5e.postRollAttack",onPostRollAttack)
    ]);
  }

  const api = {
    version:VERSION,
    definition,
    capacity,
    reloadPoints,
    state,
    primaryAttack,
    useAttack,
    rollDamage,
    rememberAttackContext,
    cleanupLegacyState,
    recordShot,
    undoShot,
    addReload,
    reset:resetWeapon,
    equippedFirearms,
    open:show,

    async init() {
      purgeLegacyPanels();
      await cleanupLegacyState();
      installHooks();
      game.adk ??= {};
      game.adk.weaponTracker = api;

      // Transitional alias so any old macro calling reloadTracker still opens
      // the new tracker instead of breaking.
      game.adk.reloadTracker = api;

      globalThis.FEHA_WEAPON_TRACKER = api;
      globalThis.FEHA_RELOAD_TRACKER = api;

      console.log("FEHA WEAPON TRACKER",VERSION,"online");
    },

    async destroy() {
      clearTimeout(hideTimer);
      hideTimer = null;

      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }

      recentRolls.clear();
      lastAttackByWeapon.clear();
      lastWeaponByActor.clear();
      purgeLegacyPanels();
      document.getElementById(HUD_ID)?.remove?.();

      if (game?.adk?.weaponTracker === api) delete game.adk.weaponTracker;
      if (game?.adk?.reloadTracker === api) delete game.adk.reloadTracker;
      if (globalThis.FEHA_WEAPON_TRACKER === api) delete globalThis.FEHA_WEAPON_TRACKER;
      if (globalThis.FEHA_RELOAD_TRACKER === api) delete globalThis.FEHA_RELOAD_TRACKER;
    }
  };

  core.registerModule("weaponTracker",api);
  globalThis.FEHA_WEAPON_TRACKER = api;
  globalThis.FEHA_RELOAD_TRACKER = api;
})();
