// FEHA // CANONICAL WEAPON SHEET
// Player-facing tactical firearm interface for canonical FEHA guns.
// Raw dnd5e activities stay hidden; the headless Weapon Tracker backend owns
// attack execution, damage, shot counting, and reload state.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;
  if (!core) throw new Error("FEHA_WEAPON_SHEET requires FEHA_CYBER_CORE.");

  const VERSION = "1.7.0";
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
    if (!item || item?.type !== "weapon") return null;

    const catalog = weaponCatalog();
    if (!catalog) return null;

    const direct = catalog.definition?.(item) ?? null;
    if (direct) return direct;

    const name = String(item?.name ?? "").trim();
    if (!name) return null;

    return catalog.definition?.(name) ?? null;
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
    const candidates = [
      app?.document,
      app?.item,
      app?.object,
      app?.options?.document,
      app?.options?.item,
      app?.context?.document,
      app?.context?.item
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (candidate?.documentName === "Item") return candidate;
      if (
        candidate?.type === "weapon" &&
        candidate?.id &&
        definition(candidate)
      ) {
        return candidate;
      }
    }

    return null;
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

    return {
      width:vw ? Math.min(1060,Math.max(820,vw-90)) : 980
    };
  }

  function ensureWindowSize(app,root) {
    if (!app || app._fehaWeaponSizing) return;

    const target = desiredWindowSize();
    const currentWidth =
      Number(app?.position?.width ?? 0) ||
      Number(root?.getBoundingClientRect?.().width ?? 0) ||
      0;

    if (currentWidth >= target.width * 0.92) return;

    app._fehaWeaponSizing = true;

    try {
      if (typeof app.setPosition === "function") {
        app.setPosition({
          width:Math.max(currentWidth,target.width)
        });
      } else {
        const windowEl =
          root?.closest?.(".application") ??
          root?.closest?.(".window-app") ??
          root;

        if (windowEl?.style) {
          windowEl.style.width = Math.max(currentWidth,target.width)+"px";
          windowEl.style.maxWidth = "calc(100vw - 24px)";
        }
      }
    } catch (error) {
      console.debug("FEHA WEAPON SHEET // width sizing fallback",error);
    } finally {
      queueMicrotask(() => {
        try { delete app._fehaWeaponSizing; }
        catch { app._fehaWeaponSizing = false; }
      });
    }
  }

  function fitWindowToContent(app,root,host) {
    if (!app || !root || !host || app._fehaWeaponHeightFit) return;

    const page =
      host.querySelector?.("[data-feha-canonical-weapon-sheet]") ??
      null;

    if (!page) return;

    const run = () => {
      if (!page.isConnected) return;

      const windowEl =
        root.closest?.(".application") ??
        root.closest?.(".window-app") ??
        root;

      const windowRect =
        windowEl?.getBoundingClientRect?.() ??
        null;

      const pageRect =
        page.getBoundingClientRect?.() ??
        null;

      if (!windowRect || !pageRect) return;

      const currentHeight =
        Number(app?.position?.height ?? 0) ||
        Number(windowRect.height ?? 0) ||
        0;

      if (!currentHeight) return;

      // Trim the outer Foundry window against the actual FEHA page bottom
      // instead of guessing from scrollHeight/header math. Keep only a tiny
      // 2px safety gap so there is no visible black footer strip.
      const bottomGap =
        Number(windowRect.bottom) -
        Number(pageRect.bottom);

      const desiredGap = 2;
      let desiredHeight =
        Math.round(
          currentHeight -
          Math.max(0,bottomGap-desiredGap)
        );

      const viewport =
        Math.max(500,Number(globalThis.innerHeight ?? 900)-24);

      desiredHeight =
        Math.max(
          480,
          Math.min(viewport,desiredHeight)
        );

      if (Math.abs(currentHeight-desiredHeight) < 3) return;

      app._fehaWeaponHeightFit = true;

      try {
        if (typeof app.setPosition === "function") {
          app.setPosition({height:desiredHeight});
        } else if (windowEl?.style) {
          windowEl.style.height = desiredHeight+"px";
          windowEl.style.maxHeight = "calc(100vh - 24px)";
        }
      } catch (error) {
        console.debug(
          "FEHA WEAPON SHEET // content height trim failed",
          error
        );
      } finally {
        setTimeout(() => {
          try { delete app._fehaWeaponHeightFit; }
          catch { app._fehaWeaponHeightFit = false; }
        },50);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(run));
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
          ? "THIS WEAPON IS NOT YOURS"
          : "NO ONE IS HOLDING THIS WEAPON"
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
        ? "WIELDER // "+String(ctx.actor.name).toUpperCase()
        : "NO WIELDER";

      return `
        <section class="feha-ws-combat is-unavailable">
          <div class="feha-ws-combat-top">
            <div>
              <small>LIVE FIRE CONTROL</small>
              <strong>WEAPON NOT IN HAND</strong>
            </div>
            <span>${esc(actorLabel)}</span>
          </div>
          <div class="feha-ws-combat-empty">
            <strong>${esc(ctx.reason)}</strong>
            <span>Open this weapon from the inventory of whoever carries it.</span>
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

    const progressMax = Math.max(1,Number(state.reloadMax) || 1);
    const progressPct = Math.max(
      0,
      Math.min(100,(Number(state.reload) || 0)/progressMax*100)
    );

    const handlingApi = globalThis.FEHA_WEAPON_HANDLING;
    const handlingProfile = handlingApi?.profile?.(ctx.item) ?? null;
    const strInfo = handlingApi?.strPenalty?.(ctx.actor,ctx.item) ?? null;
    const strWarning = strInfo?.under
      ? (strInfo.negated
          ? `<div class="feha-ws-handling-warning is-ok">STR ${esc(strInfo.str)} &lt; ${esc(strInfo.req)} // NEGATED BY ${esc(strInfo.by.join(", ").toUpperCase())}</div>`
          : `<div class="feha-ws-handling-warning">STR ${esc(strInfo.str)} &lt; ${esc(strInfo.req)} // DISADVANTAGE + MAX 10 FT MOVE</div>`)
      : "";

    const reloadControls = handlingProfile && handlingProfile.reload !== "none"
      ? `
          <div class="feha-ws-reload-cluster">
            <button type="button" class="feha-ws-reload-one" data-feha-ws-action="reload">
              <span>RELOAD</span>
              <strong>${esc(handlingProfile.reloadLabel)}${handlingProfile.reloadCheck ? " // "+esc(handlingProfile.reloadCheck.label)+" DC "+esc(handlingProfile.reloadCheck.dc) : ""}</strong>
            </button>
          </div>
        `
      : state.reloadMax > 0
      ? `
          <div class="feha-ws-reload-cluster">
            <div class="feha-ws-reload-buttons">
              <button type="button" data-feha-ws-action="reload-action">
                <span>ACTION</span>
                <strong>+2</strong>
              </button>
              <button type="button" data-feha-ws-action="reload-bonus">
                <span>BONUS</span>
                <strong>+1</strong>
              </button>
            </div>
            <div class="feha-ws-reload-meter">
              <div>
                <span>RELOAD</span>
                <strong>${esc(state.reload)} / ${esc(state.reloadMax)} PTS</strong>
              </div>
              <i><b style="width:${progressPct}%"></b></i>
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

        ${strWarning}
        <div class="feha-ws-console">
          <div class="feha-ws-readiness">
            <div class="feha-ws-readiness-count">
              <small>ATTACKS READY</small>
              <strong>${esc(state.remaining)}<em>/${esc(state.capacity)}</em></strong>
            </div>

            <div class="feha-ws-segments">${segmentBar(state.remaining,state.capacity)}</div>

            <div class="feha-ws-readiness-meta">
              <span>FIRED <b>${esc(state.used)}</b></span>
              <span>DAMAGE <b>${esc(def?.damage ?? "—")}</b></span>
              <span>RANGE <b>${esc(rangeLabel(def))}</b></span>
            </div>
          </div>

          <div class="feha-ws-controls">
            <div class="feha-ws-primary-actions">
              <button
                type="button"
                class="feha-ws-attack"
                data-feha-ws-action="attack"
                ${ctx.attack ? "" : "disabled"}
              >
                <span>ATTACK</span>
                <small>DEX // ROLL TO HIT</small>
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
          </div>
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

    const handlingLines =
      globalThis.FEHA_WEAPON_HANDLING?.rulesText?.(def ?? item) ?? [];
    const handling = handlingLines.length
      ? buildRuleCard(
          "HANDLING",
          String(def?.weaponClass ?? "WEAPON").toUpperCase(),
          handlingLines.join(" "),
          "gold"
        )
      : "";

    const rules = trait || special || handling
      ? '<div class="feha-ws-rules">'+trait+special+handling+'</div>'
      : "";

    return `
      <style>
        [data-feha-canonical-weapon-sheet] {
          box-sizing:border-box;
          container-name:fehaWeapon;
          container-type:inline-size;
          min-height:0;
          height:auto;
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

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-one {
          width:100%;
          min-height:42px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:8px 12px;
          border:1px solid #f3e600;
          background:rgba(243,230,0,.10);
          color:#f3e600;
          font-weight:800;
          letter-spacing:.1em;
          cursor:pointer;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-one:hover:not(:disabled) {
          background:#f3e600;
          color:#000;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-handling-warning {
          margin:0 0 8px;
          padding:6px 10px;
          border:1px solid rgba(255,94,87,.55);
          border-left:3px solid #ff5e57;
          background:rgba(255,94,87,.10);
          color:#ff8f86;
          font-size:11px;
          font-weight:800;
          letter-spacing:.1em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-handling-warning.is-ok {
          border-color:rgba(63,214,198,.5);
          border-left-color:#3fd6c6;
          background:rgba(63,214,198,.08);
          color:#3fd6c6;
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
          font-size:11px;
          font-weight:1000;
          letter-spacing:.10em;
          text-transform:uppercase;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-art-meta span {
          color:#728991;
          font-size:11px;
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
          font-size:11px;
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
          font-size:11px;
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
          font-size:10px;
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
          font-size:10px;
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
          font-size:11px;
          letter-spacing:.05em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-rule p {
          margin:5px 0 0;
          color:#d6e2e6;
          font-size:11px;
          line-height:1.48;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat {
          margin-top:12px;
          padding:12px;
          border:1px solid #285864;
          background:
            radial-gradient(circle at 12% 0%,rgba(70,224,255,.07),transparent 34%),
            linear-gradient(180deg,#07171c,#040c0f);
          box-shadow:inset 0 0 30px #27dfff08,0 10px 24px #0005;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat.is-unavailable {
          border-color:#394b50;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:0 1px 9px;
          border-bottom:1px solid #17353d;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-combat-top small {
          display:block;
          color:#68e0f7;
          font-size:10px;
          font-weight:1000;
          letter-spacing:.14em;
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
          background:#061014;
          color:#99aeb5;
          font-size:10px;
          font-weight:1000;
          letter-spacing:.09em;
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

        [data-feha-canonical-weapon-sheet] .feha-ws-console {
          display:grid;
          grid-template-columns:minmax(205px,.72fr) minmax(0,1.8fr);
          gap:10px;
          margin-top:10px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness {
          display:flex;
          flex-direction:column;
          justify-content:space-between;
          min-width:0;
          padding:11px;
          border:1px solid #1b414a;
          background:#030b0e;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-count {
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap:10px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-count small {
          color:#728890;
          font-size:10px;
          font-weight:1000;
          letter-spacing:.08em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-count strong {
          color:#f8fdff;
          font-size:29px;
          line-height:.9;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-count em {
          margin-left:2px;
          color:#6f858d;
          font-size:13px;
          font-style:normal;
          font-weight:900;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-segments {
          display:flex;
          gap:4px;
          margin:12px 0 9px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-seg {
          display:block;
          flex:1;
          min-width:4px;
          height:13px;
          background:#16282e;
          border:1px solid #213a42;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-seg.is-on {
          background:linear-gradient(180deg,#74ecff,#48bfd4);
          border-color:#84efff;
          box-shadow:0 0 9px #3fe1ff44;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-meta {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:5px;
          color:#667d85;
          font-size:10px;
          letter-spacing:.04em;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-meta span {
          min-width:0;
          white-space:nowrap;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-readiness-meta b {
          color:#eaf5f8;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-controls {
          min-width:0;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions {
          display:grid;
          grid-template-columns:1.7fr 1fr;
          gap:7px;
          margin:0;
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
          font-size:10px;
          opacity:.74;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-attack {
          border:1px solid #57e3ff;
          background:linear-gradient(180deg,#0d3c48,#09262f);
          color:#f7feff;
          box-shadow:inset 0 0 22px #25dfff18;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-damage {
          border:1px solid #c9a04a;
          background:linear-gradient(180deg,#392a13,#281e0e);
          color:#fff5dd;
          box-shadow:inset 0 0 18px #f1b73b12;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-cluster {
          display:grid;
          grid-template-columns:1.25fr .9fr;
          gap:7px;
          margin-top:7px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-buttons {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:6px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-buttons button {
          display:flex;
          align-items:center;
          justify-content:space-between;
          min-height:34px;
          padding:6px 8px;
          border:1px solid #2e4d56;
          background:#08171b;
          color:#dce9ed;
          font-size:10px;
          font-weight:900;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-buttons strong {
          color:#f1cd61;
          font-size:11px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-meter {
          display:flex;
          flex-direction:column;
          justify-content:center;
          gap:5px;
          padding:6px 8px;
          border:1px solid #263d44;
          background:#061115;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-meter > div {
          display:flex;
          justify-content:space-between;
          gap:8px;
          color:#70858c;
          font-size:10px;
          font-weight:900;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-meter strong {
          color:#e8f4f7;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-meter i {
          display:block;
          height:4px;
          overflow:hidden;
          background:#16262c;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-reload-meter b {
          display:block;
          height:100%;
          background:#e0b84f;
          box-shadow:0 0 7px #e0b84f55;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-corrections {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:6px;
          margin-top:6px;
        }

        [data-feha-canonical-weapon-sheet] .feha-ws-corrections button,
        [data-feha-canonical-weapon-sheet] .feha-ws-full-reset {
          min-height:27px;
          padding:5px 8px;
          border:1px solid #213940;
          background:#050e11;
          color:#71878f;
          font-size:10px;
          font-weight:900;
          letter-spacing:.06em;
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
          font-size:11px;
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

        @container fehaWeapon (max-width:760px) {
          [data-feha-canonical-weapon-sheet] .feha-ws-console {
            grid-template-columns:1fr;
          }
        }

        @container fehaWeapon (max-width:620px) {
          [data-feha-canonical-weapon-sheet] .feha-ws-rules,
          [data-feha-canonical-weapon-sheet] .feha-ws-primary-actions,
          [data-feha-canonical-weapon-sheet] .feha-ws-reload-cluster {
            grid-template-columns:1fr;
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
                  <small>RELOAD</small>
                  <strong>${esc(globalThis.FEHA_WEAPON_HANDLING?.profile?.(def ?? item)?.reloadLabel ?? def?.reloadPoints ?? def?.reloadActions ?? "—")}</strong>
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
        else if (action === "reload") {
          await tracker.reload?.(item);
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
    fitWindowToContent(app,root,host);

    for (const delay of [80,220]) {
      setTimeout(() => {
        const liveRoot = renderedRoot(null,app);
        if (!liveRoot?.isConnected) return;
        const liveHost = contentHost(liveRoot);
        if (liveHost) fitWindowToContent(app,liveRoot,liveHost);
      },delay);
    }

    return true;
  }

  const observedApps = new WeakMap();
  let inventoryClickHandler = null;

  function appElement(app) {
    if (globalThis.HTMLElement && app?.element instanceof HTMLElement) return app.element;
    if (globalThis.HTMLElement && app?.element?.[0] instanceof HTMLElement) return app.element[0];
    return null;
  }

  function actorAppForNode(node) {
    const apps = new Set();

    try {
      for (const app of Object.values(ui?.windows ?? {})) {
        if (app) apps.add(app);
      }
    } catch {}

    try {
      for (const app of globalThis.foundry?.applications?.instances ?? []) {
        if (app) apps.add(app);
      }
    } catch {}

    for (const app of apps) {
      const actor =
        app?.document?.documentName === "Actor"
          ? app.document
          : app?.actor?.documentName === "Actor"
            ? app.actor
            : null;

      if (!actor) continue;

      const element = appElement(app);
      if (element?.contains?.(node)) {
        return {app,actor};
      }
    }

    return null;
  }

  function canonicalItemFromInventoryClick(event) {
    const target = event?.target;
    if (!(target instanceof Element)) return null;

    const row =
      target.closest?.(
        '[data-item-id], [data-entry-id], .item[data-id], .item[data-document-id]'
      ) ??
      null;

    if (!row) return null;

    const actorContext = actorAppForNode(row);
    if (!actorContext?.actor) return null;

    const itemId = String(
      row?.dataset?.itemId ??
      row?.dataset?.entryId ??
      row?.dataset?.id ??
      row?.dataset?.documentId ??
      ""
    );

    if (!itemId) return null;

    const item =
      actorContext.actor.items?.get?.(itemId) ??
      null;

    if (!item || !definition(item)) return null;

    return {
      item,
      row,
      actor:actorContext.actor,
      app:actorContext.app
    };
  }

  function clickShouldOpenWeaponSheet(event,context) {
    const target = event?.target;
    if (!(target instanceof Element)) return false;

    // Never steal clicks from explicit inventory management controls.
    if (
      target.closest?.(
        '[data-action="edit"],[data-action="delete"],[data-action="equip"],'+
        '[data-action="quantity"],input,select,textarea,.item-controls,.controls'
      )
    ) {
      return false;
    }

    // Dnd5e weapon rows commonly bind "use"/"roll" to the name or image.
    // Those are exactly the clicks FEHA wants to reinterpret as "open weapon UI".
    if (
      target.closest?.(
        '[data-action="use"],[data-action="roll"],[data-action="activate"],'+
        '.item-name,.item-image,.name,.item-name-row'
      )
    ) {
      return true;
    }

    // Some of the old/problem-patch rows bind the whole visible label area.
    // Treat a plain left click on the row background/text as open-sheet too.
    return event.button == null || event.button === 0;
  }

  function installInventoryOpenBridge() {
    if (inventoryClickHandler) return;

    inventoryClickHandler = event => {
      const context = canonicalItemFromInventoryClick(event);
      if (!context) return;
      if (!clickShouldOpenWeaponSheet(event,context)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      try {
        context.item.sheet?.render?.(true);
      } catch (error) {
        console.warn(
          "FEHA WEAPON SHEET // inventory open bridge failed",
          context.item?.name,
          error
        );
      }
    };

    document.addEventListener("click",inventoryClickHandler,true);
  }

  function removeInventoryOpenBridge() {
    if (!inventoryClickHandler) return;
    document.removeEventListener("click",inventoryClickHandler,true);
    inventoryClickHandler = null;
  }

  function ensurePersistentRender(app,html) {
    const item = resolveItem(app);
    if (!item || !definition(item)) return;

    const run = () => {
      try { render(app,html); }
      catch (error) {
        console.warn("FEHA WEAPON SHEET // render failed",error);
      }
    };

    run();

    // Some legacy/problem-patch Item windows finish their own dnd5e render
    // after the generic hook. Re-assert the FEHA surface on the next turns.
    for (const delay of [0,40,120,300]) {
      setTimeout(() => {
        const liveRoot = renderedRoot(null,app);
        if (!liveRoot?.isConnected) return;
        const host = contentHost(liveRoot);
        if (!host?.querySelector?.("[data-feha-canonical-weapon-sheet]")) {
          try { render(app,liveRoot); } catch {}
        }
      },delay);
    }

    const root = renderedRoot(html,app);
    if (!root || observedApps.has(app)) return;

    const observer = new MutationObserver(() => {
      const liveRoot = renderedRoot(null,app);
      if (!liveRoot?.isConnected) return;

      const host = contentHost(liveRoot);
      if (
        host &&
        !host.querySelector?.("[data-feha-canonical-weapon-sheet]") &&
        resolveItem(app) &&
        definition(resolveItem(app))
      ) {
        try { render(app,liveRoot); } catch {}
      }
    });

    observer.observe(root,{childList:true,subtree:true});
    observedApps.set(app,observer);
  }

  function installHooks() {
    if (!globalThis.Hooks?.on || hooks.length) return;

    installInventoryOpenBridge();

    for (const event of [
      "renderItemSheet",
      "renderItemSheetV2",
      "renderApplicationV2",
      "renderDocumentSheet"
    ]) {
      hooks.push([
        event,
        Hooks.on(event,(app,html) => {
          ensurePersistentRender(app,html);
        })
      ]);
    }

    hooks.push([
      "closeApplication",
      Hooks.on("closeApplication",app => {
        try { observedApps.get(app)?.disconnect?.(); } catch {}
        observedApps.delete(app);
      })
    ]);
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
      removeInventoryOpenBridge();
      for (const app of [
        ...Object.values(ui?.windows ?? {}),
        ...(globalThis.foundry?.applications?.instances ?? [])
      ]) {
        try { observedApps.get(app)?.disconnect?.(); } catch {}
        try { observedApps.delete(app); } catch {}
      }
      if (game?.adk?.weaponSheet === api) delete game.adk.weaponSheet;
      if (globalThis.FEHA_WEAPON_SHEET === api) delete globalThis.FEHA_WEAPON_SHEET;
    }
  };

  core.registerModule("weaponSheet",api);
  globalThis.FEHA_WEAPON_SHEET = api;
})();
