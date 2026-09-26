// FEHA Foundry VTT tabletop UI customization.
// Fictional cyberpunk game interface only.
// This code reads and updates Foundry actor/item/token documents in the current tabletop world.
// It does not access external systems, credentials, devices, or real computer networks.

(() => {
  try { globalThis.FEHA_TABLETOP_UI_V3?.destroy?.(); } catch {}
  globalThis.FEHA_CYBERDECK_V3_ACTIVE = true;
  try { globalThis.ADKDevPatch?.suspendCyberdeckV2?.(); } catch {}
  const VERSION = "0.8.4";
  let lifecycleActive = true;
  const ROOT_ID = "feha-cyberdeck-v2";
  const JACK_ID = "feha-jackin-overlay";
  const FLAG = "fleshEnshrouded";

  const actionLocks = new Set();

  function actionKey(kind,actorId) {
    return String(kind) + ":" + String(actorId ?? "");
  }

  function beginAction(kind,actorId) {
    const key = actionKey(kind,actorId);
    if (actionLocks.has(key)) return null;
    actionLocks.add(key);
    return key;
  }

  function endAction(key) {
    if (key) actionLocks.delete(key);
  }

  function actorActionBusy(actorId) {
    const suffix = ":" + String(actorId ?? "");
    return [...actionLocks].some(key => key.endsWith(suffix));
  }

  const norm = v => String(v ?? "").trim().toLowerCase();
  const esc = v => String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

  function flags(item) {
    return item?.flags?.[FLAG] ?? {};
  }

  function description(item) {
    const raw = String(item?.system?.description?.value ?? "");
    const div = document.createElement("div");
    div.innerHTML = raw;
    return String(div.textContent ?? "").replace(/\s+/g," ").trim();
  }

  function isQuickhack(item) {
    if (!item) return false;
    const f = flags(item);
    const category = String(f.sourceCategory ?? f.category ?? "").toLowerCase();
    return (
      category === "quickhacks" ||
      f.quickhack === true ||
      f.ownedQuickhack === true ||
      f.quickhackOwned === true ||
      /\/quickhacks\//i.test(String(f.sourcePath ?? "")) ||
      /category\s*:?\s*quickhacks/i.test(description(item))
    );
  }

  function isInstalledCyberware(item) {
    if (!item) return false;
    const f = flags(item);
    const category = String(f.sourceCategory ?? "").toLowerCase();
    const looksCyberware = category === "cyberware" || Boolean(f.cyberwareSlot);
    if (!looksCyberware || f.installed === false || f.isInstalled === false) return false;

    const containerId =
      item?.system?.container?.id ??
      item?.system?.container ??
      null;

    if (containerId) {
      const parent = item.parent;
      const container = parent?.items?.get?.(containerId) ?? null;
      const cf = flags(container);
      if (
        cf.cyberStorage === true ||
        norm(container?.name) === "cyberware cache"
      ) {
        return false;
      }
    }

    return true;
  }

  function isDeck(item) {
    if (!isInstalledCyberware(item)) return false;
    const n = norm(item.name);
    return (
      flags(item).cyberdeck === true ||
      flags(item).isCyberdeck === true ||
      ["cyberdeck","paraline","netdriver","tetratronic","raven micro"]
        .some(term => n.includes(term))
    );
  }

  function isSupport(item) {
    if (!isInstalledCyberware(item) || isDeck(item)) return false;
    const text = norm(item.name + " " + (flags(item).effectText || description(item)));
    return ["ram","quickhack","cyberdeck","neural","self ice","memory","cortex","netrunner","intrusion"]
      .some(term => text.includes(term));
  }

  function supportRamBonus(item) {
    const f = flags(item);
    const explicit = Number(f.ramBonus);
    if (Number.isFinite(explicit) && explicit) return explicit;
    const n = norm(item?.name);
    if (n.includes("ex disk") || n.includes("ram upgrade")) return 2;
    if (n.includes("neuro matrix")) return 1;
    return 0;
  }

  function hackCost(item) {
    const explicit = Number(flags(item).ramCost);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const match = description(item).match(/\bRAM\s+(\d+)/i);
    return match ? Number(match[1]) : 2;
  }

  function hackEffect(item) {
    const cost = hackCost(item);
    const raw = String(flags(item).effectText || description(item) || "Quickhack software.");
    return raw.replace(/\bRAM\s+\d+\b/i, "RAM " + cost);
  }

  function hackDC(actor) {
    const intMod = Number(actor?.system?.abilities?.int?.mod ?? 0);
    const prof = Number(actor?.system?.attributes?.prof ?? actor?.system?.details?.prof ?? 2);
    return 8 + prof + intMod;
  }

  function model(actor) {
    const items = [...(actor?.items ?? [])];

    const deckCandidates = items.filter(isDeck);
    const deck =
      deckCandidates.find(item =>
        flags(item).installed === true ||
        flags(item).isInstalled === true
      ) ??
      deckCandidates[0] ??
      null;

    const quickhacks = items.filter(isQuickhack)
      .sort((a,b) => String(a.name).localeCompare(String(b.name)));

    const df = flags(deck);
    const rating = Math.max(1,Math.min(5,Number(df.rating ?? df.tier ?? 2) || 2));
    const baseRam = deck
      ? (Number(df.ramMax) || (4 + 2 * rating))
      : 0;

    const support = items.filter(isSupport);
    const supportRam = support.reduce((sum,item) => sum + supportRamBonus(item),0);
    const maxRam = deck ? baseRam + supportRam : 0;

    const stored = actor?.flags?.[FLAG]?.ramCurrent;
    const currentRam = !deck
      ? 0
      : stored == null
        ? maxRam
        : Math.max(0,Math.min(maxRam,Number(stored) || 0));

    const slots = deck
      ? (Number(df.quickhackSlots) || (2 + rating))
      : 0;

    const loadedAll = quickhacks.filter(item => flags(item).loadedQuickhack === true);
    const loaded = deck ? loadedAll.slice(0,slots) : [];
    const overflow = deck ? loadedAll.slice(slots) : loadedAll;
    const library = quickhacks.filter(item => flags(item).loadedQuickhack !== true);

    return {
      actor,
      deck,
      deckCandidates,
      deckConflict:deckCandidates.length > 1,
      quickhacks,
      loadedAll,
      loaded,
      overflow,
      library,
      support,
      maxRam,
      currentRam,
      slots,
      dc:hackDC(actor),
      manufacturer:String(df.manufacturer ?? df.company ?? "UNKNOWN"),
      mk:String(df.mk ?? df.rating ?? df.tier ?? ""),
      deckEffect: deck ? String(df.effectText || description(deck) || "") : ""
    };
  }

  function roster() {
    const order = new Map([["ponyboy",0],["derke",1],["sasha",2],["zach",3]]);
    const key = actor => norm(actor?.flags?.[FLAG]?.adkCharacter || actor?.name);
    return [...(game.actors ?? [])]
      .filter(actor => order.has(key(actor)) && (game.user?.isGM || actor.isOwner))
      .sort((a,b) => (order.get(key(a)) ?? 99) - (order.get(key(b)) ?? 99));
  }

  function actorById(id) {
    return game.actors?.get?.(id) ?? null;
  }

  function portrait(actor) {
    const k = norm(actor?.flags?.[FLAG]?.adkCharacter || actor?.name);
    const fixed = {
      derke:"https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png",
      ponyboy:"https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/40e1fb5d-6265-4dfd-93d3-d6344dc14180.png"
    };
    return fixed[k] || actor?.flags?.[FLAG]?.characterChooserPortrait || actor?.img || "icons/svg/mystery-man.svg";
  }

  function readV3PrivateAssets() {
    if (globalThis.FEHA_CP2077_ASSETS?.ui) {
      return globalThis.FEHA_CP2077_ASSETS;
    }

    try {
      const parsed = JSON.parse(
        localStorage.getItem("fehaCP2077PrivateAssetsV1") || "null"
      );
      if (!parsed || typeof parsed !== "object") return null;

      const ok = value =>
        typeof value === "string" &&
        value.startsWith("https://assets.forge-vtt.com/");

      const ui = Object.fromEntries(
        Object.entries(parsed.ui ?? {}).filter(([,value]) => ok(value))
      );
      const audio = Object.fromEntries(
        Object.entries(parsed.audio ?? {}).filter(([,value]) => ok(value))
      );

      if (!Object.keys(ui).length && !Object.keys(audio).length) return null;

      const assets = {ui,audio};
      globalThis.FEHA_CP2077_ASSETS = assets;
      return assets;
    } catch {
      return null;
    }
  }

  function applyV3Assets(root) {
    if (!root) return;
    const ui = readV3PrivateAssets()?.ui ?? {};
    const map = {
      "--v3-frame":"ffe5273fdf_frame_bg",
      "--v3-hud":"6691702ad7_hud_patch_frame",
      "--v3-highlight":"2ae8c588ae_fluff_highlight",
      "--v3-lines":"ef56f53fa5_fluff_lines",
      "--v3-crossline":"d4e7518fde_crossLine",
      "--v3-outerline":"9674e9d0b8_outerLine",
      "--v3-button":"5c8f822dbf_gog_button_holder",
      "--v3-button2":"ac81a43116_gog_button_holder_02",
      "--v3-reward":"a13706adc6_gog_frame_reward",
      "--v3-buffer-empty":"697dae4bde_buffer_empty",
      "--v3-buffer-active":"4416a73d89_buffer_activated",
      "--v3-barcode1":"7c16fcece5_fluff_barcode1",
      "--v3-barcode3":"2bead2d3f6_fluff_barcode3",
      "--v3-code1":"1a0c3eb3ee_fluff_code1",
      "--v3-glow":"59feb7cd32_frame_glow",
      "--v3-glow-small":"8cd8de72f8_frame_glow_small"
    };
    let count = 0;
    for (const [cssName,key] of Object.entries(map)) {
      const url = ui[key];
      if (url) {
        root.style.setProperty(cssName,'url("'+url+'")');
        count++;
      } else {
        root.style.removeProperty(cssName);
      }
    }
    root.dataset.v3Assets = count ? "1" : "0";
  }

  function segments(value,max,count=24) {
    const filled = max > 0 ? Math.round(Math.max(0,Math.min(1,value/max))*count) : 0;
    return '<div class="cd2-segments is-ram">' +
      Array.from({length:count},(_,i) => '<i class="'+(i<filled?"is-filled":"")+'"></i>').join("") +
      '</div>';
  }

  function hackCard(item,loaded) {
    const cost = hackCost(item);
    return [
      '<article class="cd2-hack-card v3-hack-card">',
      '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">',
      '<div class="cd2-hack-copy">',
      '<b>'+esc(item.name)+'</b>',
      '<span>RAM '+cost+' // '+esc(flags(item).ratingLabel ?? ("MK."+String(flags(item).mk ?? flags(item).rating ?? "—")))+'</span>',
      '<small>'+esc(hackEffect(item))+'</small>',
      '</div>',
      '<button type="button" data-v3-action="'+(loaded?"unload":"load")+'" data-item-id="'+esc(item.id)+'">'+(loaded?"EJECT":"LOAD")+'</button>',
      '</article>'
    ].join("");
  }

  function loadedRack(m) {
    if (!m.deck) {
      return '<div class="cd2-no-deck"><small>HARDWARE LINK // OFFLINE</small><b>NO CYBERDECK INSTALLED</b><span>Install a Cyberdeck through Chrome Manager.</span></div>';
    }

    const cards = [];
    for (let i=0;i<m.slots;i++) {
      const item = m.loaded[i];
      if (item) cards.push(hackCard(item,true));
      else cards.push(
        '<div class="cd2-empty-slot" data-slot="'+(i+1)+'">'+
          '<em>SLOT '+String(i+1).padStart(2,"0")+'</em>'+
          '<span>+</span><b>EMPTY SLOT</b><small>ASSIGN FROM SOFTWARE LIBRARY</small>'+
        '</div>'
      );
    }
    return cards.join("");
  }

  function supportCards(m) {
    if (!m.support.length) return '<div class="cd2-empty-message">NO SUPPORT CHROME DETECTED</div>';
    return m.support.map(item =>
      '<article class="cd2-support-card">'+
        '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">'+
        '<div><b>'+esc(item.name)+'</b><span>'+esc(flags(item).ratingLabel ?? "")+'</span><small>'+esc(flags(item).effectText || description(item))+'</small></div>'+
      '</article>'
    ).join("");
  }

  function render(actorId=null) {
    const actors = roster();
    const saved = localStorage.getItem("fehaCyberdeckActorV3");
    const chosen =
      actors.find(actor => actor.id === actorId) ??
      actors.find(actor => actor.id === saved) ??
      actors[0] ??
      null;

    if (!chosen) {
      ui?.notifications?.warn?.("FEHA // No accessible Cyberdeck roster actor available.");
      return null;
    }

    localStorage.setItem("fehaCyberdeckActorV3",chosen.id);
    const m = model(chosen);

    document.getElementById(ROOT_ID)?.remove();
    const root = document.createElement("section");
    root.id = ROOT_ID;
    root.classList.add("feha-v3");
    root.dataset.fehaV3 = "1";
    root.dataset.actor = norm(chosen?.flags?.[FLAG]?.adkCharacter ?? chosen.name);
    root.dataset.actorId = chosen.id;
    applyV3Assets(root);

    root.innerHTML = `
      <header class="cd2-header">
        <div class="cd2-brand">
          <small>NOCTURNE // NETRUNNER LOADOUT</small>
          <h1>CYBERDECK <span>OS</span></h1>
          <div class="cd2-build">FEHA / ADK // ${VERSION}</div>
        </div>
        <div class="cd2-header-status">
          <div><span>RAM</span><b>${m.currentRam}/${m.maxRam}</b></div>
          <div><span>DECK</span><b>${m.deck?"ONLINE":"NONE"}</b></div>
          <div><span>SOFTWARE</span><b>${m.loaded.length}/${m.slots}</b></div>
        </div>
        <div class="cd2-header-actions">
          <select id="v3-actor">
            ${actors.map(a => '<option value="'+esc(a.id)+'" '+(a.id===chosen.id?"selected":"")+'>'+esc(a.name)+'</option>').join("")}
          </select>
          <button type="button" class="cd2-close" data-v3-action="close">×</button>
        </div>
      </header>

      <aside class="cd2-operator">
        <div class="cd2-portrait">
          <img src="${esc(portrait(chosen))}" alt="">
          <div class="cd2-portrait-grid"></div>
          <div class="cd2-operator-tag">OPERATOR // ${esc(chosen.name.toUpperCase())}</div>
        </div>
        <div class="cd2-operator-meta">
          <div><span>SUBJECT</span><b>${esc(chosen.name)}</b></div>
          <div><span>RAM</span><b>${m.currentRam} / ${m.maxRam}</b></div>
          <div><span>QH DC</span><b>${m.deck?m.dc:"—"}</b></div>
        </div>
        <div class="cd2-deck-summary ${m.deck?"":"is-offline"} ${m.deckConflict?"has-conflict":""}">
          <small>INSTALLED CYBERDECK</small>
          ${m.deck ? '<div class="cd2-deck-head"><img src="'+esc(m.deck.img || "icons/svg/cog.svg")+'" alt=""><div><h2>'+esc(m.deck.name)+'</h2><span>'+esc(m.manufacturer)+(m.mk?" // MK."+esc(m.mk):"")+'</span></div></div><div class="cd2-deck-specs"><div><span>RAM</span><b>'+m.maxRam+'</b></div><div><span>SLOTS</span><b>'+m.slots+'</b></div><div><span>QH DC</span><b>'+m.dc+'</b></div></div>' + (m.deckConflict?'<div class="v3-deck-conflict">MULTIPLE INSTALLED CYBERDECKS DETECTED // USING '+esc(m.deck.name)+'</div>':'') : '<div class="cd2-offline-copy">NO HARDWARE LINK</div>'}
        </div>
      </aside>

      <main class="cd2-main v3-main">
        <section class="v3-ram">
          <div>
            <small>ACTIVE MEMORY // SHORT REST ONLY</small>
            <strong>${m.currentRam}<em>/ ${m.maxRam}</em></strong>
            ${segments(m.currentRam,Math.max(1,m.maxRam))}
          </div>
          <button type="button" class="cd2-rest" data-v3-action="rest" ${m.deck?"":"disabled"}>SHORT REST // RESTORE RAM</button>
        </section>

        <div class="v3-scroll">
          <section class="v3-section">
            <div class="cd2-section-head">
              <div><small>DECK MEMORY</small><h3>LOADED QUICKHACKS</h3></div>
              <span>${m.loaded.length} / ${m.slots} SLOTS</span>
            </div>
            <div class="cd2-loaded-grid">${loadedRack(m)}</div>
          </section>

          <section class="v3-section v3-library">
            <div class="cd2-section-head">
              <div><small>OWNED SOFTWARE</small><h3>SOFTWARE LIBRARY</h3></div>
              <span>${m.library.length} AVAILABLE</span>
            </div>
            ${m.overflow.length ? `
              <div class="v3-overflow">
                <div class="v3-overflow-head">OVER CAPACITY // ${m.overflow.length} SOFTWARE PACKAGE${m.overflow.length===1?"":"S"} MUST BE EJECTED</div>
                <div class="cd2-library-list v3-overflow-list">
                  ${m.overflow.map(item => hackCard(item,true)).join("")}
                </div>
              </div>
            ` : ""}
            <div class="cd2-library-list">
              ${m.library.length ? m.library.map(item => hackCard(item,false)).join("") : (m.overflow.length ? "" : '<div class="cd2-empty-message">ALL OWNED QUICKHACKS ARE LOADED</div>')}
            </div>
          </section>
        </div>

      </main>

      <aside class="cd2-right">
        <section class="cd2-bus-panel">
          <div class="cd2-subhead">DECK STATUS</div>
          <div class="cd2-right-stat"><span>RAM</span><b>${m.currentRam}/${m.maxRam}</b></div>
          <div class="cd2-right-stat"><span>LOADED</span><b>${m.loaded.length}</b></div>
          <div class="cd2-right-stat"><span>CAPACITY</span><b>${m.slots||"—"}</b></div>
          <div class="cd2-right-stat"><span>QH DC</span><b>${m.deck?m.dc:"—"}</b></div>
        </section>
        <section>
          <div class="cd2-subhead">SUPPORT CHROME</div>
          <div class="cd2-mini-support">${supportCards(m)}</div>
        </section>
        <section class="cd2-session v3-deck-passive">
          <div class="cd2-subhead">DECK PASSIVE</div>
          <p>${m.deckEffect ? esc(m.deckEffect) : "No additional deck passive detected."}</p>
        </section>
      </aside>

      <footer class="v3-bottom">
        <button type="button" class="v3-jackbar" data-v3-action="jack" ${m.deck?"":"disabled"}>
          <span class="v3-jack-state">${m.deck?"SYSTEM READY":"HARDWARE OFFLINE"}</span>
          <span class="v3-jack-main"><small>NEURAL SCENE SWEEP</small><b>JACK IN</b></span>
          <span class="v3-jack-meta">${m.loaded.length} LOADED // ${m.currentRam} RAM // SCENE SCAN</span>
        </button>
      </footer>
    `;

    document.body.appendChild(root);
    bindBase(root,m);
    return root;
  }

  async function setLoaded(actor,itemId,value) {
    const item = actor?.items?.get?.(itemId);
    if (!item || !isQuickhack(item)) return false;
    const m = model(actor);
    if (value) {
      if (!m.deck) return ui?.notifications?.warn?.("Install a Cyberdeck first.");
      if (m.loaded.length >= m.slots) return ui?.notifications?.warn?.("Cyberdeck software slots are full.");
    }
    await item.update({[`flags.${FLAG}.loadedQuickhack`]:Boolean(value)});
    return true;
  }

  function sceneModel(actor) {
    const scene = canvas?.scene ?? null;
    if (!scene) return {scene:null,nodes:[],selected:null};

    const targeted = new Set(
      [...(game.user?.targets ?? [])]
        .map(t => t?.id ?? t?.document?.id)
        .filter(Boolean)
    );

    const rect =
      scene.dimensions?.sceneRect ??
      canvas?.dimensions?.sceneRect ??
      {x:0,y:0,width:1,height:1};

    const rw = Math.max(1,Number(rect.width)||1);
    const rh = Math.max(1,Number(rect.height)||1);
    const all = [...(scene.tokens?.contents ?? scene.tokens ?? [])]
      .filter(t => (game.user?.isGM || !t.hidden) && (t.actor || t.actorId));

    const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

    const rawNodes = all.map((token,index) => {
      const a = token.actor ?? game.actors?.get?.(token.actorId) ?? null;
      const disp = Number(token.disposition ?? 0);
      const relation = disp < 0 ? "hostile" : disp > 0 ? "friendly" : "neutral";
      const rawX = ((Number(token.x??0)-Number(rect.x??0))/rw)*100;
      const rawY = ((Number(token.y??0)-Number(rect.y??0))/rh)*100;

      return {
        id:token.id,
        name:token.name ?? a?.name ?? "UNKNOWN",
        img:token.texture?.src ?? a?.img ?? "icons/svg/mystery-man.svg",
        relation,
        self:a?.id === actor?.id,
        targeted:targeted.has(token.id),
        x:clamp(8+rawX*.84,8,92),
        y:clamp(12+rawY*.60,12,72),
        index
      };
    });

    // The screen uses large readable node cards, so literal token coordinates
    // can overlap. Pick the nearest collision-free candidate around each
    // original position while preserving the scene's general spatial layout.
    const placed = [];
    const operator = {x:50,y:54};

    const separationScore = (x,y) => {
      let min = Infinity;

      // Reserve the large operator diamond in the center.
      const opDx = (x-operator.x)/13;
      const opDy = (y-operator.y)/17;
      min = Math.min(min,Math.hypot(opDx,opDy));

      for (const node of placed) {
        const dx = (x-node.x)/12;
        const dy = (y-node.y)/15;
        min = Math.min(min,Math.hypot(dx,dy));
      }

      return min;
    };

    const candidatesFor = node => {
      const points = [{x:node.x,y:node.y,drift:0}];
      const seed = (node.index * 137.507764) * Math.PI / 180;

      for (let ring=1; ring<=4; ring++) {
        const rx = 6.5 * ring;
        const ry = 8.0 * ring;
        const samples = 10 + ring * 4;

        for (let step=0; step<samples; step++) {
          const angle = seed + (Math.PI*2*step/samples);
          const x = clamp(node.x + Math.cos(angle)*rx,8,92);
          const y = clamp(node.y + Math.sin(angle)*ry,12,72);
          const drift = Math.hypot(x-node.x,y-node.y);
          points.push({x,y,drift});
        }
      }

      // Dense-scene fallback: stable screen lanes. These are appended after
      // local candidates, so normal encounters still preserve scene geometry.
      const gridX = [8,20,32,44,56,68,80,92];
      const gridY = [12,28,44,60,72];

      for (const x of gridX) {
        for (const y of gridY) {
          // Keep the operator's central identity area visually sacred.
          const opDx = (x-operator.x)/14;
          const opDy = (y-operator.y)/18;
          if (Math.hypot(opDx,opDy) < 1.05) continue;

          const drift = Math.hypot(x-node.x,y-node.y);
          points.push({x,y,drift});
        }
      }

      return points;
    };

    const nodes = rawNodes.map(node => {
      const candidates = candidatesFor(node);

      let best = candidates[0];
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        const separation = separationScore(candidate.x,candidate.y);

        // A separation score >= 1 is visually clear. Prefer the nearest clear
        // candidate; if none are perfectly clear, maximize separation.
        const score =
          (separation >= 1 ? 1000 : separation * 100) -
          candidate.drift * 1.35;

        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      const laidOut = {
        ...node,
        x:best.x,
        y:best.y
      };

      placed.push(laidOut);
      return laidOut;
    });

    return {
      scene,
      nodes,
      selected:nodes.find(n => n.targeted) ?? null
    };
  }

  function codeRain() {
    const bits = ["01","10","0011","1010","1100","0110","010101","111000","001011"];
    return Array.from({length:34},(_,i) => {
      const text = Array.from({length:18},(_,j) => bits[(i+j*3)%bits.length]).join("<br>");
      return '<i style="--jack-col:'+i+'">'+text+'</i>';
    }).join("");
  }

  function jackMarkup(actor) {
    const net = sceneModel(actor);
    const m = model(actor);
    const selected = net.selected;

    const lines = net.nodes.map(n =>
      '<line class="jack-net-line is-'+n.relation+(n.targeted?' is-targeted':'')+'" x1="500" y1="390" x2="'+(n.x*10).toFixed(1)+'" y2="'+(n.y*7.2).toFixed(1)+'" />'
    ).join("");

    const nodes = net.nodes.map((n,i) =>
      '<button class="jack-node is-'+n.relation+(n.targeted?' is-targeted':'')+(n.self?' is-self':'')+'" style="--jack-x:'+n.x.toFixed(2)+'%;--jack-y:'+n.y.toFixed(2)+'%" data-jack-action="target" data-token-id="'+esc(n.id)+'">'+
        '<span class="jack-node-num">'+String(i+1).padStart(2,"0")+'</span>'+
        '<img src="'+esc(n.img)+'" alt="">'+
        '<span class="jack-node-copy"><b>'+esc(n.name)+'</b><small>'+(n.self?'SELF':n.relation.toUpperCase())+'</small></span>'+
        '<em>'+(n.targeted?'LOCKED':'ACQUIRE')+'</em>'+
      '</button>'
    ).join("");

    const hacks = m.loaded.length
      ? m.loaded.map(item => {
          const cost = hackCost(item);
          return '<button class="jack-hack" data-jack-action="run" data-item-id="'+esc(item.id)+'" '+(!selected || m.currentRam < cost?'disabled':'')+'>'+
            '<img src="'+esc(item.img || "icons/svg/item-bag.svg")+'" alt="">'+
            '<span><b>'+esc(item.name)+'</b><small>RAM '+cost+' // DC '+m.dc+'</small></span>'+
            '<em>EXECUTE</em>'+
          '</button>';
        }).join("")
      : '<div class="jack-no-hacks">NO QUICKHACKS LOADED</div>';

    return `
      <header class="jack-header">
        <div><small>NOCTURNE // LIVE NEURAL SPACE</small><h1>JACKED <span>IN</span></h1></div>
        <div class="jack-head-stat"><span>SCENE</span><b>${esc(net.scene?.name ?? "NO SCENE")}</b></div>
        <div class="jack-head-stat"><span>RAM</span><b>${m.currentRam} / ${m.maxRam}</b></div>
        <button data-jack-action="close" class="jack-close">×</button>
      </header>
      <main class="jack-space">
        <svg class="jack-links" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        <div class="jack-operator"><div></div><img src="${esc(portrait(actor))}" alt=""><span><small>OPERATOR</small><b>${esc(actor.name)}</b></span></div>
        ${nodes || '<div class="jack-empty-scene"><b>NO ACTOR SIGNATURES</b><span>No actor-backed tokens were found on the active scene.</span></div>'}
        <div class="jack-lock-readout"><small>TARGET LOCK</small><b>${selected?esc(selected.name):"NO TARGET"}</b><span>${net.nodes.length} SCENE SIGNATURES DETECTED</span></div>
      </main>
      <footer class="jack-actions">
        <div class="jack-actions-title"><small>LOADED SOFTWARE</small><b>QUICKHACK EXECUTION</b><span>${selected?"TARGET // "+esc(selected.name):"SELECT A TARGET NODE"}</span></div>
        <div class="jack-hacks">${hacks}</div>
      </footer>
    `;
  }

  function renderJack(actorId) {
    const root = document.getElementById(JACK_ID);
    const actor = actorById(actorId);

    if (!root) return;

    if (!actor) {
      root.remove();
      ui?.notifications?.warn?.("Cyberdeck operator is no longer available.");
      open();
      return;
    }
    root.dataset.phase = "live";
    root.dataset.actorId = actor.id;
    root.innerHTML = jackMarkup(actor);
    bindJack(root,actor);
  }

  function openJack(actor) {
    if (!lifecycleActive) return null;

    const live = model(actor);
    if (!live.deck) {
      ui?.notifications?.warn?.("Install a Cyberdeck before JACK IN.");
      return null;
    }

    document.getElementById(JACK_ID)?.remove();
    const root = document.createElement("section");
    root.id = JACK_ID;
    root.dataset.actorId = actor.id;
    root.dataset.phase = "boot";
    applyV3Assets(root);
    root.innerHTML = '<div class="jack-boot"><div class="jack-code-rain">'+codeRain()+'</div><div class="jack-boot-core"><small>NEURAL HANDSHAKE // ACTIVE SCENE SWEEP</small><h1>JACKING IN</h1><b>SCANNING ACTOR SIGNATURES...</b><span>BUILDING TABLETOP SCENE MATRIX</span></div><div class="jack-boot-scan"></div></div>';
    document.body.appendChild(root);
    globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});

    setTimeout(() => {
      if (!root.isConnected) return;
      root.classList.add("is-glitching");
      setTimeout(() => {
        if (!root.isConnected) return;
        renderJack(actor.id);
        root.classList.add("is-live");
        globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
      },180);
    },1050);
  }

  function bindBase(root,m) {
    root.onchange = event => {
      if (!event.target?.matches?.("#v3-actor")) return;
      render(String(event.target.value ?? ""));
      globalThis.FEHA_SOUNDS?.play?.("actor_switch",{cooldown:80});
    };

    root.onclick = async event => {
      const button = event.target?.closest?.("[data-v3-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.v3Action;
      const actor = m.actor;

      if (action === "close") {
        root.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        return;
      }

      if (action === "load" || action === "unload") {
        const lock = beginAction("software",actor.id);
        if (!lock) return;

        button.dataset.busy = "1";
        button.disabled = true;
        const value = action === "load";

        let changed = false;

        try {
          changed = (await setLoaded(actor,button.dataset.itemId,value)) === true;

          if (changed) {
            globalThis.FEHA_SOUNDS?.play?.(value?"install":"remove",{cooldown:0});
            if (root.isConnected) render(actor.id);
          }
        } catch (err) {
          console.error("FEHA V3 software slot update failed",err);
          ui?.notifications?.error?.("Cyberdeck software update failed.");
        } finally {
          endAction(lock);

          if (!changed && root.isConnected) {
            button.disabled = false;
            delete button.dataset.busy;
          }
        }
        return;
      }

      if (action === "rest") {
        const lock = beginAction("rest",actor.id);
        if (!lock) return;

        const live = model(actor);
        if (!live.deck) {
          endAction(lock);
          return ui?.notifications?.warn?.("No Cyberdeck installed.");
        }

        button.dataset.busy = "1";
        button.disabled = true;

        try {
          globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
          await actor.update({
            [`flags.${FLAG}.ramCurrent`]:live.maxRam
          });

          await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor}),
            content:
              "<p><strong>"+esc(actor.name)+
              "</strong> completed a Short Rest. RAM restored to <strong>"+
              live.maxRam+"</strong>.</p>"
          });

          if (root.isConnected) render(actor.id);
        } catch (err) {
          console.error("FEHA V3 Short Rest failed",err);
          ui?.notifications?.error?.("Cyberdeck Short Rest failed.");
          if (root.isConnected) {
            button.disabled = false;
            delete button.dataset.busy;
          }
        } finally {
          endAction(lock);
        }
        return;
      }

      if (action === "jack") {
        openJack(actor);
      }
    };
  }

  function bindJack(root,actor) {
    root.onclick = async event => {
      const button = event.target?.closest?.("[data-jack-action]");
      if (!button || !root.contains(button)) return;
      const action = button.dataset.jackAction;

      if (action === "close") {
        root.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        render(actor.id);
        return;
      }

      if (action === "target") {
        const token =
          canvas?.tokens?.get?.(button.dataset.tokenId) ??
          canvas?.tokens?.placeables?.find?.(t => t.id === button.dataset.tokenId) ??
          null;
        if (!token) return ui?.notifications?.warn?.("That scene token is no longer available.");
        try {
          await token.setTarget(true,{user:game.user,releaseOthers:true,groupSelection:true});
          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});
          setTimeout(() => globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0}),90);
        } catch (err) {
          console.warn("FEHA V3 target selection failed",err);
          globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
          ui?.notifications?.warn?.("Could not acquire that scene target.");
          return;
        }
        renderJack(actor.id);
        return;
      }

      if (action === "run") {
        const lock = beginAction("execute",actor.id);
        if (!lock) return;

        const item = actor.items?.get?.(button.dataset.itemId);
        const target = [...(game.user?.targets ?? [])][0] ?? null;
        const targetId = target?.id ?? target?.document?.id ?? null;
        const liveNet = sceneModel(actor);

        if (
          !item ||
          !model(actor).loaded.some(h => h.id === item.id) ||
          !target ||
          !liveNet.nodes.some(node => node.id === targetId)
        ) {
          endAction(lock);
          return ui?.notifications?.warn?.("Select a live scene target and load that Quickhack first.");
        }

        const m = model(actor);
        const cost = hackCost(item);
        if (m.currentRam < cost) {
          endAction(lock);
          return ui?.notifications?.warn?.("Not enough RAM. "+m.currentRam+"/"+cost+".");
        }

        root.dataset.executing = "1";
        button.disabled = true;

        try {
          await actor.update({[`flags.${FLAG}.ramCurrent`]:m.currentRam-cost});
          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});
          setTimeout(() => globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0}),100);

          await ChatMessage.create({
            speaker:ChatMessage.getSpeaker({actor}),
            content:'<div style="display:flex;gap:10px;align-items:center"><img src="'+esc(item.img)+'" style="width:54px;height:54px;object-fit:contain"><div><h3>'+esc(item.name)+'</h3><p><strong>RAM '+cost+'</strong> • DC '+m.dc+' • TARGET '+esc(target.name ?? target.document?.name ?? "UNKNOWN")+'</p><p>'+esc(hackEffect(item))+'</p></div></div>'
          });

          renderJack(actor.id);
        } catch (err) {
          console.error("FEHA V3 Quickhack execution failed",err);
          ui?.notifications?.error?.("Quickhack execution failed.");
          if (root.isConnected) {
            delete root.dataset.executing;
            button.disabled = false;
          }
        } finally {
          endAction(lock);
        }
      }
    };
  }

  function open(actorId=null) {
    const actors = roster();
    const saved = localStorage.getItem("fehaCyberdeckActorV3");
    const actor =
      actors.find(candidate => candidate.id === actorId) ??
      actors.find(candidate => candidate.id === saved) ??
      actors[0] ??
      null;

    if (!actor) {
      return ui?.notifications?.warn?.("No accessible Cyberdeck roster actor available.");
    }

    document.getElementById(JACK_ID)?.remove();
    return render(actor.id);
  }

  const v3Hooks = [];
  let refreshQueued = false;

  function queueV3Refresh(mode = "auto") {
    if (refreshQueued) return;
    refreshQueued = true;

    requestAnimationFrame(() => {
      refreshQueued = false;
      if (!lifecycleActive) return;

      const jack = document.getElementById(JACK_ID);
      if (jack?.dataset?.phase === "live") {
        renderJack(jack.dataset.actorId);
        return;
      }

      if (mode === "jack") return;

      const root = document.getElementById(ROOT_ID);
      if (root?.dataset?.fehaV3 === "1") {
        render(root.dataset.actorId);
      }
    });
  }

  function visibleActorId() {
    return (
      document.getElementById(JACK_ID)?.dataset?.actorId ??
      document.getElementById(ROOT_ID)?.dataset?.actorId ??
      null
    );
  }

  if (globalThis.Hooks?.on) {
    v3Hooks.push([
      "updateActor",
      Hooks.on("updateActor", actor => {
        if (
          actor?.id === visibleActorId() &&
          !actorActionBusy(actor.id)
        ) {
          queueV3Refresh("auto");
        }
      })
    ]);

    for (const event of ["createItem","updateItem","deleteItem"]) {
      v3Hooks.push([
        event,
        Hooks.on(event, item => {
          if (
            item?.parent?.id === visibleActorId() &&
            !actorActionBusy(item.parent.id)
          ) {
            queueV3Refresh("auto");
          }
        })
      ]);
    }

    for (const event of ["createActor","deleteActor"]) {
      v3Hooks.push([
        event,
        Hooks.on(event, actor => {
          const root = document.getElementById(ROOT_ID);
          const jack = document.getElementById(JACK_ID);
          const visible = jack?.dataset?.actorId ?? root?.dataset?.actorId ?? null;

          if (event === "deleteActor" && actor?.id === visible) {
            jack?.remove();
            root?.remove();
            open();
            return;
          }

          if (root?.dataset?.fehaV3 === "1") {
            render(root.dataset.actorId);
          }
        })
      ]);
    }

    for (const event of ["createToken","updateToken","deleteToken","targetToken","canvasReady"]) {
      v3Hooks.push([
        event,
        Hooks.on(event, () => {
          if (document.getElementById(JACK_ID)?.dataset?.phase === "live") {
            queueV3Refresh("jack");
          }
        })
      ]);
    }
  }

  const previous = game.adk?.openCyberdeck;
  if (game.adk) {
    // Always capture the opener that exists immediately before THIS V3 install.
    // Reusing a stale value from an earlier hot reload can restore old V2 code.
    game.adk.__fehaV3PreviousOpenCyberdeck = previous;
    game.adk.openCyberdeck = open;
  }

  const reclaimV3 = () => {
    if (!lifecycleActive) return;
    if (game.adk && game.adk.openCyberdeck !== open) {
      game.adk.openCyberdeck = open;
    }
  };

  const existing = document.getElementById(ROOT_ID);
  const existingActorId = existing?.dataset?.actorId ?? null;
  const wasOpen = Boolean(existing);
  existing?.remove();

  const v3Observer = null;

  globalThis.FEHA_TABLETOP_UI_V3 = {
    version:VERSION,
    open,
    render,
    openJack,
    model,
    destroy() {
      lifecycleActive = false;
      actionLocks.clear();
      v3Observer?.disconnect?.();
      for (const [event,id] of v3Hooks) {
        try { Hooks.off(event,id); } catch {}
      }
      document.getElementById(ROOT_ID)?.remove();
      document.getElementById(JACK_ID)?.remove();
      if (game.adk) {
        const prior = game.adk.__fehaV3PreviousOpenCyberdeck;
        if (game.adk.openCyberdeck === open && typeof prior === "function") {
          game.adk.openCyberdeck = prior;
        }
        delete game.adk.__fehaV3PreviousOpenCyberdeck;
      }
      delete globalThis.FEHA_CYBERDECK_V3_ACTIVE;
    }
  };

  if (wasOpen) {
    setTimeout(() => {
      if (lifecycleActive) render(existingActorId);
    },60);
  }

  setTimeout(() => {
    if (lifecycleActive) reclaimV3();
  },120);
  ui?.notifications?.info?.("FEHA Cyberdeck V3 "+VERSION+" ready.");
})();
