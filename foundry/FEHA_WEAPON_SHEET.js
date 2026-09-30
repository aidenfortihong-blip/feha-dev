// FEHA // CANONICAL WEAPON SHEET
// Presentation-only replacement for canonical FEHA weapon Item sheets.
// Stored dnd5e activities remain internal so the Weapon Tracker can roll them,
// but players never interact with raw dnd5e Attack/activity controls here.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_SHEET requires FEHA_CYBER_CORE.");

  const VERSION = "1.1.0";
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

  function desiredWindowSize() {
    const vw = Math.max(0,Number(globalThis.innerWidth ?? 0));
    const vh = Math.max(0,Number(globalThis.innerHeight ?? 0));

    return {
      width:vw ? Math.min(980,Math.max(720,vw-80)) : 900,
      height:vh ? Math.min(820,Math.max(620,vh-90)) : 760
    };
  }

  function ensureWindowSize(app,root) {
    if (!app || app._fehaWeaponSizing) return;

    const target = desiredWindowSize();
    const currentWidth =
      Number(app?.position?.width ?? 0) ||
      Number(root?.getBoundingClientRect?.().width ?? 0) ||
      0;
    const currentHeight =
      Number(app?.position?.height ?? 0) ||
      Number(root?.getBoundingClientRect?.().height ?? 0) ||
      0;

    // Canonical gun sheets should never inherit an old tiny dnd5e Item-sheet
    // footprint. Grow undersized windows, but never shrink a user-expanded one.
    if (
      currentWidth >= target.width * 0.92 &&
      currentHeight >= Math.min(target.height,700) * 0.90
    ) return;

    app._fehaWeaponSizing = true;

    const next = {
      width:Math.max(currentWidth,target.width),
      height:Math.max(currentHeight,target.height)
    };

    try {
      if (typeof app.setPosition === "function") {
        app.setPosition(next);
      } else {
        const windowEl =
          root?.closest?.(".application") ??
          root?.closest?.(".window-app") ??
          root;

        if (windowEl?.style) {
          windowEl.style.width = next.width+"px";
          windowEl.style.height = next.height+"px";
          windowEl.style.maxWidth = "calc(100vw - 24px)";
          windowEl.style.maxHeight = "calc(100vh - 24px)";
        }
      }
    } catch (error) {
      console.debug("FEHA WEAPON SHEET // window sizing fallback",error);
    } finally {
      // Keep the guard only for this render turn. If a user later manually
      // shrinks the window, the container-query layout below handles it.
      queueMicrotask(() => {
        try { delete app._fehaWeaponSizing; }
        catch { app._fehaWeaponSizing = false; }
      });
    }
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
          container-name:fehaWeapon;
          container-type:inline-size;
          min-height:100%;
          height:100%;
          padding:18px;
          overflow:auto;
          background:
            radial-gradient(circle at 12% 10%,rgba(65,216,255,.09),transparent 30%),
            linear-gradient(145deg,#040a0d 0%,#071116 52%,#05090b 100%);
          color:#dce8ec;
          scrollbar-gutter:stable;
        }

        [data-feha-canonical-weapon-sheet] * {
          box-sizing:border-box;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-grid {
          display:grid;
          grid-template-columns:minmax(250px,300px) minmax(0,1fr);
          gap:18px;
          align-items:start;
          width:100%;
          max-width:1100px;
          margin:0 auto;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-art {
          position:sticky;
          top:0;
          min-width:0;
          padding:11px;
          border:1px solid #284e59;
          background:#071116;
          box-shadow:0 12px 36px #0009,0 0 20px #27cfea12 inset;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-image-frame {
          display:flex;
          align-items:center;
          justify-content:center;
          width:100%;
          min-height:230px;
          height:clamp(230px,30vh,300px);
          padding:8px;
          overflow:hidden;
          border:1px solid #203a43;
          background:
            linear-gradient(180deg,#020607,#03090c);
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-art img {
          display:block;
          width:100%;
          height:100%;
          max-width:100%;
          max-height:100%;
          object-fit:contain;
          object-position:center;
          border:0;
          background:transparent;
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
          width:100%;
          overflow:hidden;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-card > section[data-feha-ui="item-card-v1"] {
          width:100%;
          min-width:0;
          margin:0;
        }

        /* The catalog card ships with inline 3-column stats. Keep that on a
           normal weapon window, but guarantee sane minimum cell widths. */
        [data-feha-canonical-weapon-sheet]
        .feha-ws-card
        > section[data-feha-ui="item-card-v1"]
        > div:nth-of-type(2) {
          grid-template-columns:repeat(3,minmax(115px,1fr)) !important;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-note {
          width:100%;
          max-width:1100px;
          margin:12px auto 0;
          padding:8px 10px;
          border:1px solid #1f3239;
          background:#060d10;
          color:#78919a;
          font-size:9px;
          font-weight:800;
          letter-spacing:.08em;
          line-height:1.45;
          text-transform:uppercase;
        }

        /* Respond to the actual Foundry sheet width, not the browser viewport.
           This prevents the right-side card from being crushed when a saved
           Item window is narrow. */
        @container fehaWeapon (max-width:760px) {
          [data-feha-canonical-weapon-sheet] {
            padding:14px;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-grid {
            grid-template-columns:1fr;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-art {
            position:relative;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-image-frame {
            height:240px;
            min-height:200px;
          }

          [data-feha-canonical-weapon-sheet]
          .feha-ws-card
          > section[data-feha-ui="item-card-v1"]
          > div:nth-of-type(2) {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
            gap:8px 12px !important;
          }
        }

        @container fehaWeapon (max-width:460px) {
          [data-feha-canonical-weapon-sheet] {
            padding:10px;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-image-frame {
            height:190px;
            min-height:170px;
          }

          [data-feha-canonical-weapon-sheet]
          .feha-ws-card
          > section[data-feha-ui="item-card-v1"]
          > div:nth-of-type(2) {
            grid-template-columns:1fr !important;
          }
        }
      </style>

      <section data-feha-canonical-weapon-sheet="1" data-item-id="${esc(item?.id)}">
        <div class="feha-ws-grid">
          <aside class="feha-ws-art">
            <div class="feha-ws-image-frame">
              <img
                src="${esc(art)}"
                alt="${esc(item?.name ?? def?.name ?? "Weapon")}"
                draggable="false"
              >
            </div>
            <div class="feha-ws-kicker">${esc(manufacturer)}</div>
            <div class="feha-ws-meta">${esc(weaponClass)} // ${esc(technology)}</div>
          </aside>

          <main class="feha-ws-card">${card}</main>
        </div>

        <div class="feha-ws-note">
          Combat controls are handled by the FEHA Weapon Tracker. Raw dnd5e activities remain internal and are intentionally hidden from this page.
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

    ensureWindowSize(app,root);

    host.innerHTML = buildPage(item,def);
    host.classList?.add?.("feha-canonical-weapon-sheet-host");

    Object.assign(host.style,{
      padding:"0",
      overflow:"hidden",
      minWidth:"0",
      minHeight:"0"
    });

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
    desiredWindowSize,

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
