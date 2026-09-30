// FEHA // CANONICAL WEAPON SHEET
// Full player-facing canonical firearm sheet.
// Raw dnd5e activities remain internal, while the FEHA Weapon Tracker provides
// attack, damage, reload, correction, and state tracking through this page.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_SHEET requires FEHA_CYBER_CORE.");

  const VERSION = "1.3.0";
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

  function weaponTracker() {
    return globalThis.FEHA_WEAPON_TRACKER ??
      game.adk?.weaponTracker ??
      globalThis.FEHA_RELOAD_TRACKER ??
      game.adk?.reloadTracker ??
      null;
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

  function actorFor(item) {
    return item?.parent?.documentName === "Actor" ? item.parent : null;
  }

  function selectedActor() {
    return canvas?.tokens?.controlled?.[0]?.actor ??
      game.user?.character ??
      null;
  }

  function actorItems(actor) {
    if (!actor) return [];
    if (Array.isArray(actor.items?.contents)) return actor.items.contents;
    try { return [...(actor.items ?? [])]; } catch { return []; }
  }

  function resolveCombatItem(displayItem,def=null) {
    if (!displayItem) return null;

    const ownedActor = actorFor(displayItem);
    if (ownedActor) return displayItem;

    const targetDef = def ?? definition(displayItem);
    if (!targetDef) return null;

    const actor = selectedActor();
    if (!actor) return null;

    const matches = actorItems(actor).filter(candidate => {
      const candidateDef = definition(candidate);
      return candidateDef?.key === targetDef.key;
    });

    return matches.find(candidate => candidate?.system?.equipped === true) ??
      matches[0] ??
      null;
  }

  function desiredWindowSize() {
    const vw = Math.max(0,Number(globalThis.innerWidth ?? 0));
    const vh = Math.max(0,Number(globalThis.innerHeight ?? 0));

    return {
      width:vw ? Math.min(1040,Math.max(760,vw-80)) : 960,
      height:vh ? Math.min(860,Math.max(680,vh-90)) : 800
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

    if (
      currentWidth >= target.width * 0.92 &&
      currentHeight >= Math.min(target.height,720) * 0.90
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
      queueMicrotask(() => {
        try { delete app._fehaWeaponSizing; }
        catch { app._fehaWeaponSizing = false; }
      });
    }
  }

  function segmentBar(remaining,max) {
    const cap = Math.max(0,Number(max) || 0);
    if (!cap) return "";

    const visible = Math.max(1,Math.min(cap,18));
    const filled = cap <= visible
      ? Math.max(0,Math.min(visible,Number(remaining) || 0))
      : Math.round((Math.max(0,Number(remaining) || 0)/cap)*visible);

    return Array.from({length:visible},(_,index) => {
      const active = index < filled;
      return '<i class="feha-ws-seg'+(active ? ' is-on' : '')+'"></i>';
    }).join("");
  }

  function combatContext(displayItem,def) {
    const tracker = weaponTracker();
    const item = resolveCombatItem(displayItem,def);
    const actor = actorFor(item);

    if (!tracker) {
      return {
        tracker:null,
        item:null,
        actor:null,
        state:null,
        attack:false,
        damage:false,
        reason:"WEAPON TRACKER OFFLINE"
      };
    }

    if (!item || !actor) {
      return {
        tracker,
        item:null,
        actor:selectedActor(),
        state:null,
        attack:false,
        damage:false,
        reason:selectedActor()
          ? "SELECTED ACTOR DOES NOT OWN THIS WEAPON"
          : "SELECT A TOKEN OR ASSIGN A CHARACTER"
      };
    }

    const state = tracker.state?.(item) ?? null;
    const activity = tracker.primaryAttack?.(item) ?? null;

    return {
      tracker,
      item,
      actor,
      state,
      attack:Boolean(activity?.use),
      damage:Boolean(activity?.rollDamage),
      reason:"",
      equipped:item?.system?.equipped === true
    };
  }

  function buildCombatPanel(displayItem,def) {
    const ctx = combatContext(displayItem,def);
    const state = ctx.state;

    if (!ctx.item || !state) {
      const actorLabel = ctx.actor?.name
        ? "ACTIVE ACTOR // "+String(ctx.actor.name).toUpperCase()
        : "NO ACTIVE ACTOR";

      return `
        <section class="feha-ws-combat is-unavailable">
          <div class="feha-ws-combat-head">
            <div>
              <small>FEHA // LIVE WEAPON CONTROL</small>
              <strong>COMBAT LINK UNAVAILABLE</strong>
            </div>
            <span>${esc(actorLabel)}</span>
          </div>
          <div class="feha-ws-combat-empty">
            <strong>${esc(ctx.reason)}</strong>
            <span>Open this weapon from an Actor that owns it, or select a token carrying the same canonical weapon.</span>
          </div>
        </section>
      `;
    }

    const status =
      state.empty ? "RELOAD REQUIRED" :
      state.reload > 0 ? "RELOADING" :
      "WEAPON READY";

    const statusClass =
      state.empty ? "is-empty" :
      state.reload > 0 ? "is-reloading" :
      "is-ready";

    const physical =
      def?.physicalCapacity == null
        ? "—"
        : String(def.physicalCapacity)+" "+String(def.capacityType ?? "").toUpperCase();

    const reloadControls = state.reloadMax > 0
      ? `
          <div class="feha-ws-reload-grid">
            <button type="button" data-feha-ws-action="reload-action">
              <span>RELOAD // ACTION</span>
              <strong>+2 PTS</strong>
            </button>
            <button type="button" data-feha-ws-action="reload-bonus">
              <span>RELOAD // BONUS</span>
              <strong>+1 PT</strong>
            </button>
          </div>
          <div class="feha-ws-reload-progress">
            <span>RELOAD PROGRESS</span>
            <strong>${esc(state.reload)} / ${esc(state.reloadMax)} PTS</strong>
          </div>
        `
      : `
          <button type="button" class="feha-ws-full-reset" data-feha-ws-action="reset">
            RESET / RECHARGE WEAPON
          </button>
        `;

    return `
      <section class="feha-ws-combat" data-combat-item-id="${esc(ctx.item.id)}">
        <div class="feha-ws-combat-head">
          <div>
            <small>FEHA // LIVE WEAPON CONTROL</small>
            <strong>${esc(ctx.actor.name)} // ${ctx.equipped ? "EQUIPPED" : "OWNED"}</strong>
          </div>
          <span class="${statusClass}">${esc(status)}</span>
        </div>

        <div class="feha-ws-ammo">
          <div class="feha-ws-ammo-line">
            <span>ATTACKS REMAINING</span>
            <strong>${esc(state.remaining)} / ${esc(state.capacity)}</strong>
          </div>
          <div class="feha-ws-segments">${segmentBar(state.remaining,state.capacity)}</div>
          <div class="feha-ws-ammo-meta">
            <span>FIRED <strong>${esc(state.used)} / ${esc(state.capacity)}</strong></span>
            <span>PHYSICAL <strong>${esc(physical)}</strong></span>
            <span>DAMAGE <strong>${esc(def?.damage ?? "—")}</strong></span>
            <span>RANGE <strong>${esc(def?.longRange ? def.range+" / "+def.longRange+" FT" : def?.range+" FT")}</strong></span>
          </div>
        </div>

        <div class="feha-ws-primary-actions">
          <button
            type="button"
            class="feha-ws-attack"
            data-feha-ws-action="attack"
            ${ctx.attack ? "" : "disabled"}
          >
            ATTACK
          </button>
          <button
            type="button"
            class="feha-ws-damage"
            data-feha-ws-action="damage"
            ${ctx.damage ? "" : "disabled"}
          >
            DAMAGE
          </button>
        </div>

        ${reloadControls}

        <div class="feha-ws-corrections">
          <button type="button" data-feha-ws-action="undo">UNDO SHOT</button>
          <button type="button" data-feha-ws-action="reset">RESET TRACKER</button>
        </div>
      </section>
    `;
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
    const combat = buildCombatPanel(item,def);

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

        [data-feha-canonical-weapon-sheet] button {
          font:inherit;
          cursor:pointer;
        }

        [data-feha-canonical-weapon-sheet] button:disabled {
          cursor:not-allowed;
          opacity:.38;
          filter:saturate(.35);
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
          background:linear-gradient(180deg,#020607,#03090c);
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

        [data-feha-canonical-weapon-sheet]
        .feha-ws-card
        > section[data-feha-ui="item-card-v1"]
        > div:nth-of-type(2) {
          grid-template-columns:repeat(3,minmax(115px,1fr)) !important;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat {
          margin-top:12px;
          padding:12px;
          border:1px solid #2b6472;
          background:
            linear-gradient(180deg,rgba(10,29,36,.98),rgba(4,13,17,.98));
          box-shadow:inset 0 0 30px #1cc9ed0a;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat.is-unavailable {
          border-color:#3a4a50;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding-bottom:9px;
          border-bottom:1px solid #1d3d46;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head div {
          min-width:0;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head small {
          display:block;
          color:#69def5;
          font-size:9px;
          font-weight:1000;
          letter-spacing:.13em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head strong {
          display:block;
          margin-top:3px;
          color:#f5fcff;
          font-size:11px;
          letter-spacing:.03em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head > span {
          flex:0 0 auto;
          padding:5px 8px;
          border:1px solid #35515a;
          background:#071116;
          color:#99aeb5;
          font-size:9px;
          font-weight:1000;
          letter-spacing:.08em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head > span.is-ready {
          border-color:#2c8395;
          color:#70e7ff;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head > span.is-reloading {
          border-color:#80692e;
          color:#f2cf65;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-head > span.is-empty {
          border-color:#7f343f;
          color:#ff7d8b;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo {
          margin-top:10px;
          padding:10px;
          border:1px solid #1d414b;
          background:#050e12;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-line {
          display:flex;
          justify-content:space-between;
          align-items:baseline;
          gap:10px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-line span {
          color:#879da5;
          font-size:9px;
          font-weight:900;
          letter-spacing:.08em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-line strong {
          color:#fff;
          font-size:18px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-segments {
          display:flex;
          gap:3px;
          margin-top:7px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-seg {
          display:block;
          flex:1;
          min-width:4px;
          height:9px;
          background:#1d2e34;
          border:1px solid #263c44;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-seg.is-on {
          background:#5fe2fb;
          border-color:#74e8ff;
          box-shadow:0 0 8px #39dfff55;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-meta {
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:7px;
          margin-top:8px;
          color:#718991;
          font-size:8px;
          letter-spacing:.05em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-meta strong {
          color:#eaf8fc;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions {
          display:grid;
          grid-template-columns:1.55fr 1fr;
          gap:8px;
          margin-top:10px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions button {
          min-height:48px;
          border-radius:0;
          font-weight:1000;
          letter-spacing:.1em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-attack {
          border:1px solid #58e2ff;
          background:#0c3541;
          color:#f5fdff;
          box-shadow:inset 0 0 20px #25dfff18,0 0 12px #20dfff12;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-damage {
          border:1px solid #c79e48;
          background:#312410;
          color:#fff5dc;
          box-shadow:inset 0 0 18px #f1b73b12;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-grid {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:7px;
          margin-top:8px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-grid button {
          display:flex;
          justify-content:space-between;
          gap:8px;
          padding:9px 10px;
          border:1px solid #35525a;
          border-radius:0;
          background:#0c1b20;
          color:#d8e8ed;
          font-size:9px;
          font-weight:900;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-grid strong {
          color:#f3d06a;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-progress {
          display:flex;
          justify-content:space-between;
          gap:10px;
          margin-top:6px;
          padding:6px 8px;
          border:1px solid #1d343b;
          color:#71878f;
          font-size:8px;
          font-weight:900;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-progress strong {
          color:#eff8fa;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-full-reset {
          width:100%;
          margin-top:8px;
          padding:9px;
          border:1px solid #35525a;
          border-radius:0;
          background:#0c1b20;
          color:#d8e8ed;
          font-size:9px;
          font-weight:900;
          letter-spacing:.06em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-corrections {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:6px;
          margin-top:7px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-corrections button {
          padding:7px 8px;
          border:1px solid #293f46;
          border-radius:0;
          background:#091216;
          color:#90a5ac;
          font-size:8px;
          font-weight:900;
          letter-spacing:.04em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-empty {
          display:flex;
          flex-direction:column;
          gap:5px;
          padding:14px 10px 7px;
          text-align:center;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-empty strong {
          color:#f0c965;
          font-size:11px;
          letter-spacing:.06em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-empty span {
          color:#81969d;
          font-size:9px;
          line-height:1.5;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-note {
          width:100%;
          max-width:1100px;
          margin:12px auto 0;
          padding:7px 10px;
          border:1px solid #1f3239;
          background:#060d10;
          color:#657b83;
          font-size:8px;
          font-weight:800;
          letter-spacing:.08em;
          line-height:1.45;
          text-transform:uppercase;
        }

        @container fehaWeapon (max-width:800px) {
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

        @container fehaWeapon (max-width:560px) {
          [data-feha-canonical-weapon-sheet] .feha-ws-ammo-meta {
            grid-template-columns:repeat(2,minmax(0,1fr));
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions,
          [data-feha-canonical-weapon-sheet] .feha-ws-reload-grid {
            grid-template-columns:1fr;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-corrections {
            grid-template-columns:1fr;
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

          <main class="feha-ws-card">
            ${card}
            ${combat}
          </main>
        </div>

        <div class="feha-ws-note">
          Raw dnd5e activity rows remain internal. These controls use the same configured attack and tracking state as the FEHA Weapon Tracker.
        </div>
      </section>
    `;
  }

  function refresh(app) {
    const root = renderedRoot(null,app);
    if (!root) return false;
    return render(app,root);
  }

  function bindCombatControls(app,host,displayItem,def) {
    const page = host?.querySelector?.("[data-feha-canonical-weapon-sheet]");
    if (!page) return;

    page.onclick = async event => {
      const button = event.target?.closest?.("[data-feha-ws-action]");
      if (!button || !page.contains(button)) return;

      event.preventDefault();
      event.stopPropagation();

      const action = String(button.dataset.fehaWsAction ?? "");
      const tracker = weaponTracker();
      const item = resolveCombatItem(displayItem,def);

      if (!tracker || !item) {
        ui.notifications?.warn?.(
          "FEHA Weapon Sheet // select an Actor that owns this weapon."
        );
        refresh(app);
        return;
      }

      button.disabled = true;

      try {
        if (action === "attack") {
          if (tracker.state?.(item)?.empty) {
            ui.notifications?.warn?.(
              "FEHA Weapon Tracker // "+String(item.name)+
              " is tracked empty. Attack is still allowed; reload/reset if this is intentional."
            );
          }
          await tracker.useAttack?.(item,event);
        }
        else if (action === "damage") {
          await tracker.rollDamage?.(item,event);
        }
        else if (action === "reload-action") {
          await tracker.addReload?.(item,2,"ACTION");
        }
        else if (action === "reload-bonus") {
          await tracker.addReload?.(item,1,"BONUS");
        }
        else if (action === "undo") {
          await tracker.undoShot?.(item);
        }
        else if (action === "reset") {
          await tracker.reset?.(item);
        }
      } catch (error) {
        console.warn(
          "FEHA WEAPON SHEET // combat action failed",
          action,
          item?.name,
          error
        );
        ui.notifications?.warn?.(
          "FEHA Weapon Sheet // "+action+" failed. Check console."
        );
      } finally {
        button.disabled = false;
      }

      await new Promise(resolve => setTimeout(resolve,100));
      refresh(app);

      // dnd5e postRollAttack can finish its tracking mutation just after
      // activity.use resolves. A second tiny refresh keeps remaining shots
      // visually exact without requiring the user to close/reopen the sheet.
      if (action === "attack") {
        setTimeout(() => refresh(app),350);
      }
    };
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

    bindCombatControls(app,host,item,def);
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
    resolveCombatItem,

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
