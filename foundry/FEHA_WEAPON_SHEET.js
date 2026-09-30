// FEHA // CANONICAL WEAPON SHEET
// Player-facing tactical firearm interface for canonical FEHA guns.
// Raw dnd5e activities stay hidden; the headless Weapon Tracker backend owns
// attack execution, damage, shot counting, and reload state.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_SHEET requires FEHA_CYBER_CORE.");

  const VERSION = "1.4.0";
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
      width:vw ? Math.min(1060,Math.max(820,vw-90)) : 980,
      height:vh ? Math.min(880,Math.max(700,vh-90)) : 820
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
      currentHeight >= Math.min(target.height,740) * 0.90
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

  function classDie(def) {
    return String(def?.damage ?? "").match(/d\d+/i)?.[0]?.toUpperCase?.() ?? "—";
  }

  function rangeLabel(def) {
    return def?.longRange
      ? String(def.range)+" / "+String(def.longRange)+" FT"
      : String(def?.range ?? "—")+" FT";
  }

  function capacityLabel(def) {
    if (def?.capacityType === "charge") return "ENERGY";
    if (def?.capacityType === "heat") return "HEAT";
    if (def?.capacityType === "bursts") return "BURSTS";
    if (def?.capacityType === "shells") return "SHELLS";
    if (def?.capacityType === "arrows") return "AMMO";
    return "MAGAZINE";
  }

  function physicalCapacity(def) {
    if (
      def?.capacityType === "charge" ||
      def?.capacityType === "heat" ||
      def?.capacityType === "bursts"
    ) {
      return def?.functionalAttacks ?? "—";
    }

    return def?.physicalCapacity ?? "—";
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

  function buildRuleCard(label,name,text,tone="cyan") {
    if (!text) return "";
    return `
      <article class="feha-ws-rule is-${esc(tone)}">
        <small>${esc(label)}</small>
        <strong>${esc(name || "SYSTEM")}</strong>
        <p>${esc(text)}</p>
      </article>
    `;
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
          <div class="feha-ws-combat-top">
            <div>
              <small>LIVE FIRE CONTROL</small>
              <strong>COMBAT LINK UNAVAILABLE</strong>
            </div>
            <span>${esc(actorLabel)}</span>
          </div>
          <div class="feha-ws-combat-empty">
            <strong>${esc(ctx.reason)}</strong>
            <span>Open an Actor-owned copy or select a token carrying this weapon.</span>
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

    const reloadControls = state.reloadMax > 0
      ? `
          <div class="feha-ws-reload-row">
            <button type="button" data-feha-ws-action="reload-action">
              <span>RELOAD // ACTION</span>
              <strong>+2</strong>
            </button>
            <button type="button" data-feha-ws-action="reload-bonus">
              <span>RELOAD // BONUS</span>
              <strong>+1</strong>
            </button>
            <div class="feha-ws-reload-state">
              <span>PROGRESS</span>
              <strong>${esc(state.reload)} / ${esc(state.reloadMax)} PTS</strong>
            </div>
          </div>
        `
      : `
          <button type="button" class="feha-ws-full-reset" data-feha-ws-action="reset">
            RESET / RECHARGE
          </button>
        `;

    return `
      <section class="feha-ws-combat" data-combat-item-id="${esc(ctx.item.id)}">
        <div class="feha-ws-combat-top">
          <div>
            <small>LIVE FIRE CONTROL</small>
            <strong>${esc(ctx.actor.name)} // ${ctx.equipped ? "EQUIPPED" : "OWNED"}</strong>
          </div>
          <span class="${statusClass}">${esc(status)}</span>
        </div>

        <div class="feha-ws-ammo">
          <div class="feha-ws-ammo-heading">
            <div>
              <small>ATTACKS REMAINING</small>
              <strong>${esc(state.remaining)} / ${esc(state.capacity)}</strong>
            </div>
            <div class="feha-ws-ammo-meta">
              <span>FIRED <b>${esc(state.used)} / ${esc(state.capacity)}</b></span>
              <span>DAMAGE <b>${esc(def?.damage ?? "—")}</b></span>
              <span>RANGE <b>${esc(rangeLabel(def))}</b></span>
            </div>
          </div>
          <div class="feha-ws-segments">${segmentBar(state.remaining,state.capacity)}</div>
        </div>

        <div class="feha-ws-primary-actions">
          <button
            type="button"
            class="feha-ws-attack"
            data-feha-ws-action="attack"
            ${ctx.attack ? "" : "disabled"}
          >
            <span>ATTACK</span>
            <small>ROLL TO HIT</small>
          </button>
          <button
            type="button"
            class="feha-ws-damage"
            data-feha-ws-action="damage"
            ${ctx.damage ? "" : "disabled"}
          >
            <span>DAMAGE</span>
            <small>${esc(def?.damage ?? "—")}</small>
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
    const art = String(item?.img ?? "icons/svg/item-bag.svg");
    const technology = String(def?.technology ?? "Weapon");
    const manufacturer = String(
      def?.company ??
      item?.flags?.[FLAG]?.manufacturer ??
      "FEHA"
    );
    const weaponClass = String(def?.weaponClass ?? "Weapon");
    const doctrine = String(def?.doctrine ?? "");
    const combat = buildCombatPanel(item,def);

    const trait = buildRuleCard(
      "MANUFACTURER TRAIT",
      def?.familyTraitName,
      def?.familyTraitText,
      "cyan"
    );

    const special = buildRuleCard(
      "SPECIAL SYSTEM",
      def?.special?.name,
      def?.special?.text,
      "gold"
    );

    const rules = trait || special
      ? '<div class="feha-ws-rules">'+trait+special+'</div>'
      : "";

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
          scrollbar-gutter:stable;
          color:#dce8ec;
          background:
            radial-gradient(circle at 78% -20%,rgba(72,224,255,.10),transparent 38%),
            radial-gradient(circle at 0% 100%,rgba(44,120,150,.08),transparent 34%),
            linear-gradient(145deg,#03080a 0%,#061014 48%,#04090c 100%);
        }

        [data-feha-canonical-weapon-sheet] * {
          box-sizing:border-box;
        }

        [data-feha-canonical-weapon-sheet] button {
          font:inherit;
          cursor:pointer;
          border-radius:0;
        }

        [data-feha-canonical-weapon-sheet] button:disabled {
          cursor:not-allowed;
          opacity:.34;
          filter:saturate(.35);
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-shell {
          width:100%;
          max-width:1120px;
          margin:0 auto;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-hero {
          display:grid;
          grid-template-columns:minmax(250px,300px) minmax(0,1fr);
          gap:16px;
          align-items:stretch;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-art {
          display:flex;
          flex-direction:column;
          min-width:0;
          min-height:330px;
          padding:12px;
          border:1px solid #244d58;
          background:
            linear-gradient(180deg,rgba(9,24,29,.98),rgba(5,13,17,.98));
          box-shadow:inset 0 0 32px #20cfea08;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-image-frame {
          display:flex;
          align-items:center;
          justify-content:center;
          flex:1;
          min-height:235px;
          padding:10px;
          overflow:hidden;
          border:1px solid #1d3c45;
          background:
            radial-gradient(circle at 50% 50%,rgba(72,224,255,.05),transparent 42%),
            #020607;
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

        [data-feha-canonical-weapon-sheet] .feha-ws-art-meta {
          display:grid;
          grid-template-columns:1fr auto;
          gap:8px;
          align-items:end;
          margin-top:10px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-art-meta strong {
          color:#70e6fb;
          font-size:10px;
          font-weight:1000;
          letter-spacing:.10em;
          text-transform:uppercase;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-art-meta span {
          color:#728991;
          font-size:9px;
          font-weight:900;
          letter-spacing:.06em;
          text-transform:uppercase;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-overview {
          min-width:0;
          padding:16px 17px 14px;
          border:1px solid #244d58;
          background:
            linear-gradient(180deg,rgba(7,19,24,.98),rgba(4,12,15,.98));
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-eyebrow {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding-bottom:10px;
          border-bottom:1px solid #17343c;
          color:#6bdff3;
          font-size:9px;
          font-weight:1000;
          letter-spacing:.12em;
          text-transform:uppercase;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-eyebrow span:last-child {
          color:#d7e4e8;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-title {
          margin:12px 0 3px;
          color:#fff;
          font-family:var(--font-h1,var(--font-primary));
          font-size:24px;
          line-height:1;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-doctrine {
          margin:0;
          max-width:760px;
          color:#91a5ac;
          font-size:10px;
          line-height:1.5;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-stats {
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:7px;
          margin-top:14px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-stat {
          min-width:0;
          padding:9px 10px;
          border:1px solid #183a43;
          background:#061116;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-stat small {
          display:block;
          color:#6f868e;
          font-size:8px;
          font-weight:900;
          letter-spacing:.07em;
          text-transform:uppercase;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-stat strong {
          display:block;
          margin-top:3px;
          color:#f5fbfd;
          font-size:13px;
          line-height:1.1;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rules {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:8px;
          margin-top:9px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule {
          min-width:0;
          padding:10px 11px;
          border:1px solid #24434b;
          background:#071116;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule.is-cyan {
          border-color:#275864;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule.is-gold {
          border-color:#5d4a23;
          background:#130f07;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule small {
          display:block;
          color:#718a92;
          font-size:8px;
          font-weight:1000;
          letter-spacing:.10em;
          text-transform:uppercase;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule.is-cyan strong {
          color:#6fe3f7;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule.is-gold strong {
          color:#f0c65e;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule strong {
          display:block;
          margin-top:3px;
          font-size:10px;
          letter-spacing:.05em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule p {
          margin:5px 0 0;
          color:#d6e2e6;
          font-size:9px;
          line-height:1.48;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat {
          margin-top:12px;
          padding:12px;
          border:1px solid #2c6978;
          background:
            linear-gradient(180deg,rgba(8,26,32,.98),rgba(4,12,16,.98));
          box-shadow:
            inset 0 0 34px #27dfff0a,
            0 10px 24px #0005;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat.is-unavailable {
          border-color:#394b50;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding-bottom:9px;
          border-bottom:1px solid #1d414a;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top div {
          min-width:0;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top small {
          display:block;
          color:#68e0f7;
          font-size:9px;
          font-weight:1000;
          letter-spacing:.13em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top strong {
          display:block;
          margin-top:3px;
          color:#f7fdff;
          font-size:11px;
          letter-spacing:.03em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top > span {
          flex:0 0 auto;
          padding:5px 8px;
          border:1px solid #35515a;
          background:#071116;
          color:#99aeb5;
          font-size:9px;
          font-weight:1000;
          letter-spacing:.08em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top > span.is-ready {
          border-color:#2c8395;
          color:#70e7ff;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top > span.is-reloading {
          border-color:#80692e;
          color:#f2cf65;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top > span.is-empty {
          border-color:#7f343f;
          color:#ff7d8b;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo {
          margin-top:9px;
          padding:10px;
          border:1px solid #1d424c;
          background:#040d11;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-heading {
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:16px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-heading small {
          display:block;
          color:#738991;
          font-size:8px;
          font-weight:1000;
          letter-spacing:.08em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-heading > div:first-child strong {
          display:block;
          margin-top:2px;
          color:#f7fcfe;
          font-size:20px;
          line-height:1;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-meta {
          display:flex;
          gap:12px;
          flex-wrap:wrap;
          justify-content:flex-end;
          color:#728890;
          font-size:8px;
          letter-spacing:.04em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-ammo-meta b {
          color:#eef8fb;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-segments {
          display:flex;
          gap:3px;
          margin-top:8px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-seg {
          display:block;
          flex:1;
          min-width:4px;
          height:9px;
          background:#1b2e34;
          border:1px solid #243c44;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-seg.is-on {
          background:#61e6ff;
          border-color:#7beaff;
          box-shadow:0 0 9px #3fe1ff55;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions {
          display:grid;
          grid-template-columns:1.7fr 1fr;
          gap:8px;
          margin-top:9px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions button {
          display:flex;
          align-items:center;
          justify-content:space-between;
          min-height:52px;
          padding:10px 13px;
          font-weight:1000;
          letter-spacing:.08em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions span {
          font-size:15px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions small {
          font-size:8px;
          opacity:.78;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-attack {
          border:1px solid #57e3ff;
          background:
            linear-gradient(180deg,#0d3c48,#0a2a33);
          color:#f7feff;
          box-shadow:inset 0 0 22px #25dfff18;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-damage {
          border:1px solid #c9a04a;
          background:
            linear-gradient(180deg,#3b2b13,#2c210f);
          color:#fff5dd;
          box-shadow:inset 0 0 18px #f1b73b12;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-row {
          display:grid;
          grid-template-columns:1fr 1fr minmax(160px,.8fr);
          gap:6px;
          margin-top:7px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-row button,
        [data-feha-canonical-weapon-sheet] .feha-ws-reload-state {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          min-height:34px;
          padding:7px 9px;
          border:1px solid #304d56;
          background:#08161b;
          color:#dce9ed;
          font-size:8px;
          font-weight:900;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-row button strong {
          color:#f1cd61;
          font-size:11px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-state {
          border-color:#243a41;
          color:#71868d;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-state strong {
          color:#eef8fb;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-corrections {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:6px;
          margin-top:6px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-corrections button,
        [data-feha-canonical-weapon-sheet] .feha-ws-full-reset {
          min-height:30px;
          padding:6px 8px;
          border:1px solid #263f46;
          background:#071115;
          color:#82979e;
          font-size:8px;
          font-weight:900;
          letter-spacing:.05em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-full-reset {
          width:100%;
          margin-top:7px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-empty {
          display:flex;
          flex-direction:column;
          gap:5px;
          padding:14px 10px 5px;
          text-align:center;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-empty strong {
          color:#f0c965;
          font-size:11px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-empty span {
          color:#81969d;
          font-size:9px;
          line-height:1.5;
        }

        @container fehaWeapon (max-width:840px) {
          [data-feha-canonical-weapon-sheet] {
            padding:13px;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-hero {
            grid-template-columns:1fr;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-art {
            min-height:270px;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-image-frame {
            min-height:210px;
            height:235px;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-stats {
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
        }

        @container fehaWeapon (max-width:620px) {
          [data-feha-canonical-weapon-sheet] .feha-ws-rules,
          [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions,
          [data-feha-canonical-weapon-sheet] .feha-ws-reload-row {
            grid-template-columns:1fr;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-ammo-heading {
            align-items:flex-start;
            flex-direction:column;
          }

          [data-feha-canonical-weapon-sheet] .feha-ws-ammo-meta {
            justify-content:flex-start;
          }
        }
      </style>

      <section data-feha-canonical-weapon-sheet="1" data-item-id="${esc(item?.id)}">
        <div class="feha-ws-shell">
          <div class="feha-ws-hero">
            <aside class="feha-ws-art">
              <div class="feha-ws-image-frame">
                <img
                  src="${esc(art)}"
                  alt="${esc(item?.name ?? def?.name ?? "Weapon")}"
                  draggable="false"
                >
              </div>
              <div class="feha-ws-art-meta">
                <strong>${esc(manufacturer)}</strong>
                <span>${esc(technology)}</span>
                <span>${esc(weaponClass)}</span>
                <span>${esc(capacityLabel(def))} // ${esc(physicalCapacity(def))}</span>
              </div>
            </aside>

            <main class="feha-ws-overview">
              <div class="feha-ws-eyebrow">
                <span>FEHA // ${esc(manufacturer.toUpperCase())}</span>
                <span>${esc(weaponClass.toUpperCase())}</span>
              </div>

              <h1 class="feha-ws-title">${esc(def?.name ?? item?.name ?? "WEAPON")}</h1>
              <p class="feha-ws-doctrine">${esc(doctrine)}</p>

              <div class="feha-ws-stats">
                <div class="feha-ws-stat">
                  <small>DAMAGE</small>
                  <strong>${esc(def?.damage ?? "—")}</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>RANGE</small>
                  <strong>${esc(rangeLabel(def))}</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>ATTACKS / RELOAD</small>
                  <strong>${esc(def?.functionalAttacks ?? "—")}</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>RELOAD POINTS</small>
                  <strong>${esc(def?.reloadPoints ?? def?.reloadActions ?? "—")}</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>${esc(capacityLabel(def))}</small>
                  <strong>${esc(physicalCapacity(def))}</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>TO HIT</small>
                  <strong>DEX</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>STR REQUIREMENT</small>
                  <strong>${esc(def?.strengthRequirement ?? "—")}</strong>
                </div>
                <div class="feha-ws-stat">
                  <small>CLASS DIE</small>
                  <strong>${esc(classDie(def))}</strong>
                </div>
              </div>

              ${rules}
            </main>
          </div>

          ${combat}
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
              " is tracked empty. Reload or reset before firing again."
            );
          }

          const result = await tracker.useAttack?.(item,event);

          if (result?.ok === false && result?.reason !== "attack-cancelled") {
            ui.notifications?.warn?.(
              "FEHA Weapon Sheet // attack did not complete."
            );
          }
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

      await new Promise(resolve => setTimeout(resolve,120));
      refresh(app);

      if (action === "attack") {
        setTimeout(() => refresh(app),450);
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
