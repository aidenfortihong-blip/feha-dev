// FEHA // MANUAL RELOAD TRACKER
// Small actor-side progress counter for canonical firearms.
// Players decide when Actions / Bonus Actions are actually spent; this module
// only records reload progress and never refills ammo or mutates action economy.
(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_RELOAD_TRACKER requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const hooks = [];

  function itemFromApp(app) {
    const candidates = [app?.item,app?.document,app?.object];
    return candidates.find(doc => doc?.documentName === "Item") ?? null;
  }

  function actorFor(item) {
    return item?.parent?.documentName === "Actor" ? item.parent : null;
  }

  function definition(item) {
    return globalThis.FEHA_WEAPON_CATALOG?.definition?.(item) ??
      game.adk?.weapons?.definition?.(item) ??
      null;
  }

  function required(item) {
    const def = definition(item);
    if (!def || def.weaponClass === "Bow") return 0;
    return Math.max(
      0,
      Math.floor(
        Number(def.reloadPoints ?? def.reloadActions ?? 0) || 0
      )
    );
  }

  function progress(item) {
    const actor = actorFor(item);
    if (!actor) return 0;
    const value =
      actor.flags?.[FLAG]?.reloadTracker?.[String(item.id)] ?? 0;
    return Math.max(0,Math.floor(Number(value) || 0));
  }

  async function set(item,value) {
    const actor = actorFor(item);
    const max = required(item);
    if (!actor || !max) {
      return {ok:false,reason:"not-trackable",value:0,max};
    }
    if (actor.isOwner === false) {
      return {ok:false,reason:"not-owner",value:progress(item),max};
    }

    const next = Math.max(
      0,
      Math.min(max,Math.floor(Number(value) || 0))
    );

    await actor.update({
      ["flags."+FLAG+".reloadTracker."+String(item.id)]:next
    });

    return {ok:true,value:next,max,ready:next >= max};
  }

  const addAction = item => set(item,progress(item)+2);
  const addBonus = item => set(item,progress(item)+1);
  const subtractOne = item => set(item,progress(item)-1);
  const reset = item => set(item,0);

  function rootNode(html,app) {
    if (globalThis.HTMLElement && html instanceof HTMLElement) return html;
    if (globalThis.HTMLElement && html?.[0] instanceof HTMLElement) return html[0];
    if (globalThis.HTMLElement && app?.element instanceof HTMLElement) return app.element;
    if (globalThis.HTMLElement && app?.element?.[0] instanceof HTMLElement) return app.element[0];
    return null;
  }

  function render(app,html) {
    const item = itemFromApp(app);
    const actor = actorFor(item);
    const max = required(item);
    if (!item || !actor || !max) return;

    const root = rootNode(html,app);
    if (!root) return;

    const panelId = "feha-reload-tracker-"+String(item.id);
    if (root.querySelector?.("#"+CSS.escape(panelId))) return;

    const panel = document.createElement("section");
    panel.id = panelId;
    panel.dataset.fehaReloadTracker = String(item.id);
    panel.style.cssText = [
      "margin:8px 10px",
      "padding:9px 10px",
      "border:1px solid #2b5662",
      "background:#071116",
      "color:#dce8ec",
      "font-family:var(--font-primary)"
    ].join(";");

    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px">' +
        '<strong style="color:#72dff2;font-size:11px;letter-spacing:.1em">FEHA // RELOAD TRACKER</strong>' +
        '<strong data-feha-reload-value style="color:#fff;font-size:13px"></strong>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        '<button type="button" data-feha-reload-action="action">+ ACTION <small>(+2)</small></button>' +
        '<button type="button" data-feha-reload-action="bonus">+ BONUS <small>(+1)</small></button>' +
        '<button type="button" data-feha-reload-action="minus">−1</button>' +
        '<button type="button" data-feha-reload-action="reset">RESET</button>' +
      '</div>' +
      '<small style="display:block;margin-top:6px;color:#8ca2ac">Manual tracker only — it does not spend actions or refill ammunition.</small>';

    const valueEl = panel.querySelector("[data-feha-reload-value]");

    const repaint = () => {
      const now = progress(item);
      valueEl.textContent =
        now >= max ? "READY // "+now+" / "+max : now+" / "+max;
      valueEl.style.color = now >= max ? "#f0c85a" : "#ffffff";
    };

    panel.addEventListener("click",async event => {
      const button = event.target?.closest?.("[data-feha-reload-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.fehaReloadAction;
      button.disabled = true;
      try {
        if (action === "action") await addAction(item);
        else if (action === "bonus") await addBonus(item);
        else if (action === "minus") await subtractOne(item);
        else if (action === "reset") await reset(item);
        repaint();
      } catch (error) {
        console.warn("FEHA RELOAD TRACKER // update failed",item?.name,error);
        ui.notifications?.warn?.("FEHA Reload Tracker could not update. Check console.");
      } finally {
        button.disabled = false;
      }
    });

    const target =
      root.querySelector?.("form") ??
      root.querySelector?.(".window-content") ??
      root;
    target.prepend(panel);
    repaint();
  }

  function installHooks() {
    for (const event of [
      "renderItemSheet",
      "renderItemSheet5e",
      "renderApplicationV2"
    ]) {
      hooks.push([event,Hooks.on(event,render)]);
    }
  }

  const api = {
    version:VERSION,
    required,
    progress,
    set,
    addAction,
    addBonus,
    subtractOne,
    reset,

    async init() {
      installHooks();
      game.adk ??= {};
      game.adk.reloadTracker = api;
      globalThis.FEHA_RELOAD_TRACKER = api;
      console.log("FEHA RELOAD TRACKER",VERSION,"online");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
      if (game?.adk?.reloadTracker === api) delete game.adk.reloadTracker;
      if (globalThis.FEHA_RELOAD_TRACKER === api) delete globalThis.FEHA_RELOAD_TRACKER;
    }
  };

  core.registerModule("reloadTracker",api);
  globalThis.FEHA_RELOAD_TRACKER = api;
})();
