// FEHA // WEAPON TRACKER
// Automatic local combat HUD for canonical firearms.
// Tracks attacks used before reload and manual reload progress.
// Does NOT spend actions, block attacks, or mutate real ammunition.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_TRACKER requires FEHA_CYBER_CORE.");

  const VERSION = "2.0.0";
  const FLAG = "fleshEnshrouded";
  const HUD_ID = "feha-weapon-tracker-hud";
  const hooks = [];
  const recentUses = new Map();
  let hideTimer = null;

  function definition(item) {
    return globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.weapons?.definition?.(item) ??
      null;
  }

  function actorFor(item) {
    return item?.parent?.documentName === "Actor" ? item.parent : null;
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
    if (input?.documentName === "Actor") {
      const items = equippedFirearms(input);
      return items[0] ?? null;
    }

    const actor = selectedActor();
    const items = equippedFirearms(actor);
    return items[0] ?? null;
  }

  function ensureHud() {
    let root = document.getElementById(HUD_ID);
    if (root) return root;

    root = document.createElement("section");
    root.id = HUD_ID;
    root.style.cssText = [
      "position:fixed",
      "right:24px",
      "bottom:24px",
      "z-index:100000",
      "width:min(390px,calc(100vw - 48px))",
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

    const reloadControls = current.reloadMax > 0
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
      const liveItem = liveActor?.items?.get?.(root.dataset.itemId);
      if (!liveItem) {
        root.remove();
        return;
      }

      button.disabled = true;
      try {
        if (action === "action") await addReload(liveItem,2,"ACTION");
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
    },12000);

    return root;
  }

  function useKey(activity,item) {
    const actor = actorFor(item);
    return [
      String(actor?.id ?? ""),
      String(item?.id ?? ""),
      String(activity?.id ?? activity?._id ?? "")
    ].join(":");
  }

  function onPostUseActivity(activity) {
    const item = activityItem(activity);
    if (!isTrackable(item)) return;

    const actor = actorFor(item);
    if (!actor || actor.isOwner === false) return;

    const activityType = String(activity?.type ?? "").toLowerCase();
    if (activityType && activityType !== "attack") return;

    const key = useKey(activity,item);
    const now = Date.now();
    const last = Number(recentUses.get(key) ?? 0);

    if (now-last < 400) return;
    recentUses.set(key,now);

    for (const [entry,time] of recentUses) {
      if (now-time > 5000) recentUses.delete(entry);
    }

    void recordShot(item).catch(error => {
      console.warn("FEHA WEAPON TRACKER // shot tracking failed",item?.name,error);
    });
  }

  function installHooks() {
    hooks.push([
      "dnd5e.postUseActivity",
      Hooks.on("dnd5e.postUseActivity",onPostUseActivity)
    ]);
  }

  const api = {
    version:VERSION,
    definition,
    capacity,
    reloadPoints,
    state,
    recordShot,
    undoShot,
    addReload,
    reset:resetWeapon,
    equippedFirearms,
    open:show,

    async init() {
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

      recentUses.clear();
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
