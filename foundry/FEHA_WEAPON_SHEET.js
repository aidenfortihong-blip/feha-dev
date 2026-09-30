// FEHA // CANONICAL WEAPON SHEET
// Presentation-only replacement for canonical FEHA weapon Item sheets.
// Stored dnd5e activities remain internal so the Weapon Tracker can roll them,
// but players never interact with raw dnd5e Attack/activity controls here.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_SHEET requires FEHA_CYBER_CORE.");

  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const hooks = [];

  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  function weaponCatalog() {
    return globalThis.FEHA_WEAPON_CATALOG ?? game.adk?.weapons ?? null;
  }

  function definition(item) {
    if (item?.documentName !== "Item" || item?.type !== "weapon") return null;
    return weaponCatalog()?.definition?.(item) ?? null;
  }

  function handles(item) {
    return Boolean(definition(item));
  }

  function renderedRoot(html,app) {
    if (globalThis.HTMLElement && html instanceof HTMLElement) return html;
    if (globalThis.HTMLElement && html?.[0] instanceof HTMLElement) return html[0];
    if (globalThis.HTMLElement && app?.element instanceof HTMLElement) return app.element;
    if (globalThis.HTMLElement && app?.element?.[0] instanceof HTMLElement) return app.element[0];
    return null;
  }

  function resolveItem(app) {
    const document =
      app?.document ??
      app?.item ??
      app?.object ??
      null;

    return document?.documentName === "Item" ? document : null;
  }

  function contentHost(root) {
    if (!root?.querySelector) return root;
    if (root.matches?.(".window-content")) return root;
    return root.querySelector(".window-content") ?? root;
  }

  function buildPage(item,def) {
    const catalog = weaponCatalog();
    const card =
      catalog?.rewriteDescription?.(def) ??
      String(item?.system?.description?.value ?? "");

    const art = String(item?.img ?? "icons/svg/item-bag.svg");
    const technology = String(def?.technology ?? "Weapon");
    const manufacturer = String(def?.company ?? item?.flags?.[FLAG]?.manufacturer ?? "FEHA");
    const weaponClass = String(def?.weaponClass ?? "Weapon");

    return `
      <style>
        [data-feha-canonical-weapon-sheet] {
          box-sizing:border-box;
          min-height:100%;
          padding:18px;
          overflow:auto;
          background:
            radial-gradient(circle at 12% 10%,rgba(65,216,255,.09),transparent 30%),
            linear-gradient(145deg,#040a0d 0%,#071116 52%,#05090b 100%);
          color:#dce8ec;
        }
        [data-feha-canonical-weapon-sheet] * { box-sizing:border-box; }
        [data-feha-canonical-weapon-sheet] .feha-ws-grid {
          display:grid;
          grid-template-columns:minmax(170px,220px) minmax(0,1fr);
          gap:16px;
          align-items:start;
          max-width:940px;
          margin:0 auto;
        }
        [data-feha-canonical-weapon-sheet] .feha-ws-art {
          position:sticky;
          top:0;
          padding:10px;
          border:1px solid #284e59;
          background:#071116;
          box-shadow:0 12px 36px #0009;
        }
        [data-feha-canonical-weapon-sheet] .feha-ws-art img {
          display:block;
          width:100%;
          aspect-ratio:1/1;
          object-fit:cover;
          border:1px solid #203a43;
          background:#020607;
        }
        [data-feha-canonical-weapon-sheet] .feha-ws-kicker {
          margin-top:10px;
          color:#72dff2;
          font-size:10px;
          font-weight:900;
          letter-spacing:.12em;
          line-height:1.45;
          text-transform:uppercase;
        }
        [data-feha-canonical-weapon-sheet] .feha-ws-meta {
          margin-top:5px;
          color:#839aa3;
          font-size:10px;
          line-height:1.45;
          text-transform:uppercase;
        }
        [data-feha-canonical-weapon-sheet] .feha-ws-card {
          min-width:0;
        }
        [data-feha-canonical-weapon-sheet] .feha-ws-note {
          max-width:940px;
          margin:12px auto 0;
          padding:8px 10px;
          border:1px solid #1f3239;
          background:#060d10;
          color:#78919a;
          font-size:9px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
        }
        @media (max-width:720px) {
          [data-feha-canonical-weapon-sheet] .feha-ws-grid {
            grid-template-columns:1fr;
          }
          [data-feha-canonical-weapon-sheet] .feha-ws-art {
            position:relative;
          }
          [data-feha-canonical-weapon-sheet] .feha-ws-art img {
            max-width:220px;
            margin:0 auto;
          }
        }
      </style>
      <section data-feha-canonical-weapon-sheet="1" data-item-id="${esc(item?.id)}">
        <div class="feha-ws-grid">
          <aside class="feha-ws-art">
            <img src="${esc(art)}" alt="${esc(item?.name ?? def?.name ?? "Weapon")}">
            <div class="feha-ws-kicker">${esc(manufacturer)}</div>
            <div class="feha-ws-meta">${esc(weaponClass)} // ${esc(technology)}</div>
          </aside>
          <main class="feha-ws-card">${card}</main>
        </div>
        <div class="feha-ws-note">
          Combat controls are handled by the FEHA Weapon Tracker. Raw dnd5e activities are intentionally hidden from this page.
        </div>
      </section>
    `;
  }

  function render(app,html) {
    const item = resolveItem(app);
    const def = definition(item);
    if (!item || !def) return false;

    const root = renderedRoot(html,app);
    if (!root) return false;

    const host = contentHost(root);
    if (!host) return false;

    host.innerHTML = buildPage(item,def);
    host.classList?.add?.("feha-canonical-weapon-sheet-host");
    host.style.padding = "0";
    host.style.overflow = "hidden";

    return true;
  }

  function installHooks() {
    if (!globalThis.Hooks?.on || hooks.length) return;

    for (const event of [
      "renderItemSheet",
      "renderItemSheetV2",
      "renderApplicationV2"
    ]) {
      hooks.push([
        event,
        Hooks.on(event,(app,html) => {
          try { render(app,html); }
          catch (error) {
            console.warn("FEHA WEAPON SHEET // render failed",error);
          }
        })
      ]);
    }
  }

  function removeHooks() {
    for (const [event,id] of hooks.splice(0)) {
      try { Hooks.off(event,id); } catch {}
    }
  }

  const api = {
    version:VERSION,
    handles,
    render,
    buildPage,

    async init() {
      installHooks();
      game.adk ??= {};
      game.adk.weaponSheet = api;
      globalThis.FEHA_WEAPON_SHEET = api;
      console.log("FEHA WEAPON SHEET",VERSION,"online");
    },

    async destroy() {
      removeHooks();
      if (game?.adk?.weaponSheet === api) delete game.adk.weaponSheet;
      if (globalThis.FEHA_WEAPON_SHEET === api) delete globalThis.FEHA_WEAPON_SHEET;
    }
  };

  core.registerModule("weaponSheet",api);
  globalThis.FEHA_WEAPON_SHEET = api;
})();
