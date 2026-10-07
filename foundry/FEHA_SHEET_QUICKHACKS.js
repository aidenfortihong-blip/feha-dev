// FEHA // SHEET QUICKHACKS
// FEHA has no spells. On actor sheets the dnd5e Spells tab becomes the
// Quickhacks tab: it lists the actor's quickhack software (Mk, RAM, loaded in
// the deck or not) and opens the Cyberdeck, and the quickhacks stop showing
// up as feats in the Features tab. Display only: loading, running and RAM stay
// in the Cyberdeck.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_SHEET_QUICKHACKS requires FEHA_CYBER_CORE.");
  }

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const TAB = "spells";
  const hooks = [];

  const esc = value => String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");

  const romans = ["","I","II","III","IV","V"];

  function quickhacks(actor) {
    const runtime = globalThis.FEHA_QUICKHACK_RUNTIME;
    return [...(actor?.items ?? [])]
      .filter(item => runtime?.handles?.(item))
      .sort((a,b) => String(a.name).localeCompare(String(b.name)));
  }

  function row(item) {
    const catalog = globalThis.FEHA_QUICKHACK_CATALOG;
    const mk = catalog?.mk?.(item);
    const ram = catalog?.ramCost?.(item);
    const loaded = item.flags?.[FLAG]?.loadedQuickhack === true;
    const effect = catalog?.effectText?.(item) ?? "";

    return (
      '<li class="feha-qh-row'+(loaded ? " is-loaded" : "")+'" data-feha-qh-item="'+esc(item.id)+'" '+
        'role="button" tabindex="0" aria-label="'+esc(item.name)+'">'+
        '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">'+
        '<span class="feha-qh-copy">'+
          '<b>'+esc(item.name)+'</b>'+
          '<small>'+esc(effect)+'</small>'+
        '</span>'+
        '<span class="feha-qh-stat">'+(mk ? "MK."+romans[mk] : "—")+'</span>'+
        '<span class="feha-qh-stat">'+(ram != null ? ram+" RAM" : "—")+'</span>'+
        '<span class="feha-qh-state">'+(loaded ? "LOADED" : "STORED")+'</span>'+
      '</li>'
    );
  }

  function panel(actor) {
    const list = quickhacks(actor);
    const loaded = list.filter(item => item.flags?.[FLAG]?.loadedQuickhack === true).length;

    return (
      '<section class="feha-qh-sheet">'+
        '<header>'+
          '<div><small>NETRUNNING // SOFTWARE</small><h3>QUICKHACKS</h3></div>'+
          '<span class="feha-qh-count">'+loaded+' LOADED // '+list.length+' OWNED</span>'+
          '<button type="button" data-feha-qh-open-deck>OPEN CYBERDECK</button>'+
        '</header>'+
        (list.length
          ? '<ul class="feha-qh-list">'+list.map(row).join("")+'</ul>'
          : '<p class="feha-qh-empty">No quickhacks. The Netrunner Shop in the Market sells them.</p>')+
      '</section>'
    );
  }

  function rootOf(html,app) {
    const node = html instanceof HTMLElement ? html : html?.[0] ?? app?.element ?? null;
    return node?.querySelector ? node : null;
  }

  function decorate(app,html) {
    const actor = app?.document ?? app?.actor ?? null;
    if (actor?.documentName !== "Actor") return;

    const root = rootOf(html,app);
    const tab = root?.querySelector?.('.tab[data-tab="'+TAB+'"]');
    if (!tab) return;

    const nav = root.querySelector('nav.tabs [data-tab="'+TAB+'"]');
    if (nav) {
      nav.setAttribute("data-tooltip","Quickhacks");
      nav.setAttribute("aria-label","Quickhacks");
      const icon = nav.querySelector("i");
      if (icon) icon.className = "fas fa-microchip";
    }

    tab.classList.add("feha-qh-tab");
    tab.querySelector(":scope > .feha-qh-sheet")?.remove();
    tab.insertAdjacentHTML("beforeend",panel(actor));

    // Quickhacks are listed here, not as feats.
    const ids = new Set(quickhacks(actor).map(item => item.id));
    for (const node of root.querySelectorAll('.tab[data-tab="features"] [data-item-id]')) {
      if (ids.has(node.dataset.itemId)) node.style.display = "none";
    }

    const sheet = tab.querySelector(":scope > .feha-qh-sheet");

    sheet.addEventListener("click",event => {
      if (event.target.closest("[data-feha-qh-open-deck]")) {
        event.preventDefault();
        game.adk?.openCyberdeck?.(actor);
        return;
      }

      const rowNode = event.target.closest("[data-feha-qh-item]");
      if (rowNode) actor.items.get(rowNode.dataset.fehaQhItem)?.sheet?.render(true);
    });

    sheet.addEventListener("keydown",event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const rowNode = event.target.closest("[data-feha-qh-item]");
      if (!rowNode) return;
      event.preventDefault();
      actor.items.get(rowNode.dataset.fehaQhItem)?.sheet?.render(true);
    });
  }

  function onRender(app,html) {
    try { decorate(app,html); } catch (error) {
      console.warn("FEHA SHEET QUICKHACKS // decorate failed",error);
    }
  }

  const api = {
    version:VERSION,
    quickhacks,

    async init() {
      for (const event of ["renderActorSheetV2","renderActorSheet"]) {
        hooks.push([event,Hooks.on(event,onRender)]);
      }

      // Sheets already open when this loads.
      for (const app of foundry.applications.instances.values()) {
        if (app?.document?.documentName === "Actor" && app.rendered) onRender(app,app.element);
      }

      console.log("FEHA SHEET QUICKHACKS",VERSION,"ready");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
    }
  };

  core.registerModule("sheetQuickhacks",api);
})();
