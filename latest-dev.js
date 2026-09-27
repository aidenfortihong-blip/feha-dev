(() => {
  const BUILD = "0.8.4";
  let lifecycleActive = true;
  let observer = null;
  let walletGuard = null;
  let marketSoundUX = null;
  let creditsSystem = null;
  let cyberdeckCombatHooks = [];

  const norm = value => String(value ?? "").trim().toLowerCase();

  const PRIVATE_ASSET_KEY = "fehaCP2077PrivateAssetsV1";

  function readPrivateAssets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRIVATE_ASSET_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      const ok = v => typeof v === "string" && v.startsWith("https://assets.forge-vtt.com/");
      const audio = Object.fromEntries(Object.entries(parsed.audio ?? {}).filter(([,v]) => ok(v)));
      const ui = Object.fromEntries(Object.entries(parsed.ui ?? {}).filter(([,v]) => ok(v)));
      return (Object.keys(audio).length || Object.keys(ui).length) ? {audio, ui} : null;
    } catch {
      return null;
    }
  }

  function applyPrivateAssets(root = document.getElementById("adk-chrome-manager-34")) {
    if (!root) return false;
    const assets = readPrivateAssets();
    if (!assets) {
      delete root.dataset.fehaCp2077Assets;
      delete globalThis.FEHA_CP2077_ASSETS;
      return false;
    }
    const ui = assets.ui ?? {};
    const names = {
      "--feha-cp-armor-barbg": "5a1f20d7c3_armor_barbg",
      "--feha-cp-bar": "a2ad0aec28_bar",
      "--feha-cp-bar-long": "38888b05f0_bar_long2",
      "--feha-cp-counter": "3ec9bd29f0_counterLabel",
      "--feha-cp-counter-stroke": "83986e3d27_counterLabel_stroke",
      "--feha-cp-cw-barbg": "4113949e24_cw_barbg",
      "--feha-cp-cw-mask": "aa246e3117_cw_mask",
      "--feha-cp-buffer-empty": "697dae4bde_buffer_empty",
      "--feha-cp-buffer-active": "4416a73d89_buffer_activated",
      "--feha-cp-frame-glow": "59feb7cd32_frame_glow",
      "--feha-cp-frame-glow-small": "8cd8de72f8_frame_glow_small",
      "--feha-cp-barcode1": "7c16fcece5_fluff_barcode1",
      "--feha-cp-barcode3": "2bead2d3f6_fluff_barcode3",
      "--feha-cp-barcode4": "88ab2fcdee_fluff_barcode4",
      "--feha-cp-code1": "1a0c3eb3ee_fluff_code1",
      "--feha-cp-highlight": "2ae8c588ae_fluff_highlight",
      "--feha-cp-lines": "ef56f53fa5_fluff_lines",
      "--feha-cp-crossline": "d4e7518fde_crossLine",
      "--feha-cp-outerline": "9674e9d0b8_outerLine",
      "--feha-cp-button-holder": "5c8f822dbf_gog_button_holder",
      "--feha-cp-button-holder-2": "ac81a43116_gog_button_holder_02",
      "--feha-cp-reward-frame": "a13706adc6_gog_frame_reward",
      "--feha-cp-hud-patch": "6691702ad7_hud_patch_frame",
      "--feha-cp-frame-bg": "ffe5273fdf_frame_bg"
    };
    for (const [cssName,key] of Object.entries(names)) {
      const url = ui[key];
      if (url) root.style.setProperty(cssName, `url("${url}")`);
      else root.style.removeProperty(cssName);
    }
    root.dataset.fehaCp2077Assets = "1";
    root.dataset.fehaRerun = "040";
    globalThis.FEHA_CP2077_ASSETS = assets;
    return true;
  }

  function findCache(actor) {
    return actor?.items?.find?.(item =>
      item.flags?.fleshEnshrouded?.cyberStorage === true
    ) ?? actor?.items?.find?.(item =>
      ["backpack", "container"].includes(item.type) &&
      norm(item.name) === "cyberware cache"
    ) ?? null;
  }

  function isInCache(item, cache) {
    if (!item || !cache) return false;
    const container = item.system?.container;
    return container === cache.id || container?.id === cache.id;
  }

  function looksLikeCyberwareItem(item) {
    if (!item) return false;

    const f = item.flags?.fleshEnshrouded ?? {};
    const category = String(f.sourceCategory ?? "").trim().toLowerCase();
    const shopType = String(f.shopType ?? "").trim().toLowerCase();
    const rawDescription = String(item?.system?.description?.value ?? "");

    return (
      category === "cyberware" ||
      Boolean(f.cyberwareSlot) ||
      shopType === "chrome" ||
      /category\s*:?\s*(?:<[^>]*>\s*)*cyberware/i.test(rawDescription)
    );
  }

  function installOwnedBridge(api) {
    if (!api || api.__fehaOwnedBridge021) return;
    api.__fehaOwnedBridge021 = true;

    const originalGetOwned = api.getOwned?.bind(api);

    api.getOwned = (slotName = null) => {
      const actor = api.getActor?.();
      const cache = findCache(actor);

      const actorOwned = [...(actor?.items ?? [])].filter(item => {
        const stashed = isInCache(item, cache);
        const explicitlyUninstalled =
          item.flags?.fleshEnshrouded?.installed === false ||
          item.flags?.fleshEnshrouded?.isInstalled === false;

        // The Cyberware Cache itself is never hardware.
        if (item.id === cache?.id) return false;

        // Never leak ordinary inventory into Chrome Manager just because it
        // was accidentally placed in the cache. Slot inference is NOT proof:
        // the legacy inferSlot helper has a default fallback slot.
        if (!looksLikeCyberwareItem(item)) return false;

        // Anything physically inside the dedicated cache is owned chrome.
        // Explicitly-uninstalled chrome is also considered owned even when
        // older data lost its container link.
        return stashed || explicitlyUninstalled;
      });

      // Deduplicate by embedded item id.
      const deduped = [...new Map(actorOwned.map(item => [item.id, item])).values()];

      const filtered = slotName
        ? deduped.filter(item => api.slotOf?.(item) === slotName)
        : deduped;

      if (globalThis.FEHA_DEV_DIAGNOSTICS) {
        console.table(filtered.map(item => ({
          item: item.name,
          slot: api.slotOf?.(item),
          container: item.system?.container?.id ?? item.system?.container ?? null,
          purchased: item.flags?.fleshEnshrouded?.marketPurchased,
          installed: item.flags?.fleshEnshrouded?.installed
        })));
      }

      return filtered;
    };

    api.__fehaOriginalGetOwned021 = originalGetOwned;
  }

  let cacheRepairBusy = false;

  async function repairCacheMetadata(api) {
    const actor = api?.getActor?.();
    if (!actor) return;

    const cache = findCache(actor);
    if (!cache) return;

    const repairs = [...actor.items]
      .filter(item => {
        if (item.id === cache.id || !isInCache(item, cache)) return false;
        return looksLikeCyberwareItem(item);
      })
      .map(item => {
        const f = item.flags?.fleshEnshrouded ?? {};
        const update = { _id: item.id };
        let dirty = false;

        // Legacy installer requires marketPurchased=true. Physical presence
        // in this actor's dedicated Cyberware Cache is sufficient proof of
        // ownership, so normalize old data once.
        if (f.marketPurchased !== true) {
          update["flags.fleshEnshrouded.marketPurchased"] = true;
          dirty = true;
        }

        if (f.installed !== false) {
          update["flags.fleshEnshrouded.installed"] = false;
          dirty = true;
        }

        if (f.isInstalled !== false) {
          update["flags.fleshEnshrouded.isInstalled"] = false;
          dirty = true;
        }

        const slot = api.slotOf?.(item);
        if (slot && f.cyberwareSlot !== slot) {
          update["flags.fleshEnshrouded.cyberwareSlot"] = slot;
          dirty = true;
        }

        return dirty ? update : null;
      })
      .filter(Boolean);

    if (!repairs.length) return;

    try {
      await actor.updateEmbeddedDocuments("Item", repairs);
      console.info("FEHA DEV " + BUILD + " // repaired cached chrome metadata", repairs.length);
    } catch (err) {
      console.warn("FEHA DEV " + BUILD + " // cache metadata repair failed", err);
    }
  }

  function patchBackend() {
    const api = globalThis.ADKChromeBackend;
    if (!api) return false;

    installOwnedBridge(api);

    if (!cacheRepairBusy) {
      cacheRepairBusy = true;
      Promise.resolve(repairCacheMetadata(api))
        .catch(err => {
          console.warn("FEHA DEV 0.8.4 // cache repair attach failed", err);
        })
        .finally(() => {
          cacheRepairBusy = false;
        });
    }

    return true;
  }


  function normalizeDossierSchematics() {
    const root = document.getElementById("adk-chrome-manager-34");
    if (!root) return;

    // These viewBoxes frame the actual authored system artwork, not the huge
    // generic 1000x800 canvas. Each keeps the full system drawing visible while
    // removing the dead margin that made the art look microscopic.
    const frames = {
      cortex:      "230 80 540 420",
      face:        "255 95 490 530",
      os:          "255 75 490 540",
      arms:        "95 145 810 485",
      hands:       "175 195 650 370",
      structure:   "125 55 750 690",
      neural:      "195 65 610 665",
      circulatory: "175 145 650 510",
      dermal:      "195 125 610 550",
      legs:        "205 145 590 565"
    };

    root
      .querySelectorAll(".dossier-visual .adk-v6-system-viz")
      .forEach(svg => {
        const modeClass = [...svg.classList].find(name => name.startsWith("mode-"));
        const mode = modeClass?.slice(5) ?? "";
        const frame = frames[mode];

        if (frame) {
          svg.setAttribute("viewBox", frame);
        }

        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      });
  }

  function normalizeChromeManagerTerminology(root = document.getElementById("adk-chrome-manager-34")) {
    if (!root) return false;

    const replaceName = value => String(value ?? "")
      .replace(/augmentation\s+theatre/gi, "Chrome Manager")
      .replace(/augmentation\s+theater/gi, "Chrome Manager");

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const value = node.nodeValue ?? "";
          return /augmentation\s+theat(?:re|er)/i.test(value)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      node.nodeValue = replaceName(node.nodeValue);
    }

    root.querySelectorAll("[title],[aria-label],[data-tooltip],[placeholder]").forEach(el => {
      for (const attr of ["title", "aria-label", "data-tooltip", "placeholder"]) {
        if (!el.hasAttribute(attr)) continue;
        const before = el.getAttribute(attr);
        const after = replaceName(before);
        if (after !== before) el.setAttribute(attr, after);
      }
    });

    return true;
  }

  function markRoot() {
    const root = document.getElementById("adk-chrome-manager-34");
    if (!root) return false;
    root.classList.add("adk-live-dev");
    root.dataset.fehaDevBuild = BUILD;
    const subject = globalThis.ADKChromeBackend?.getActor?.();
    root.dataset.fehaSubject = norm(subject?.name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    patchBackend();
    normalizeDossierSchematics();
    applyPrivateAssets(root);
    filterActorRoster(root);
    applyActorPortraitOverride(root);
    normalizeChromeManagerTerminology(root);
    return true;
  }

  function installCacheSelectionUX() {
    if (globalThis.__FEHA_CACHE_SELECTION_UX_025) return;

    const handler = event => {
      const root = event.target?.closest?.("#adk-chrome-manager-34");
      if (!root) return;

      const cacheItem = event.target.closest?.("[data-cache-item]");
      if (cacheItem) {
        // Let the native handler set selectedItemId and rerender the hardware
        // dossier, then retract the cache visually so the result is obvious.
        setTimeout(() => {
          if (!lifecycleActive) return;
          document
            .getElementById("adk-chrome-manager-34")
            ?.classList.add("feha-cache-selection-focus");
        }, 0);
        return;
      }

      const openCache = event.target.closest?.("[data-open-cache]");
      if (openCache) {
        root.classList.remove("feha-cache-selection-focus");
        return;
      }

      const closeCache = event.target.closest?.("[data-close-cache]");
      if (closeCache) {
        root.classList.remove("feha-cache-selection-focus");
      }
    };

    document.addEventListener("click", handler, true);
    globalThis.__FEHA_CACHE_SELECTION_UX_025 = { handler };
  }

  function removeCacheSelectionUX() {
    const ux = globalThis.__FEHA_CACHE_SELECTION_UX_025;
    if (!ux) return;
    document.removeEventListener("click", ux.handler, true);
    delete globalThis.__FEHA_CACHE_SELECTION_UX_025;
  }

  function installTelemetryMotion() {
    if (globalThis.__FEHA_TELEMETRY_040) return;

    let raf = 0;
    let lastFrame = 0;
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const hash = value => {
      const text = String(value ?? "");
      let h = 2166136261 >>> 0;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    const pointsFor = (seed, time, count = 42) => {
      const h = hash(seed);
      const phaseA = ((h % 19) + 5) * 0.061;
      const phaseB = ((h % 11) + 3) * 0.043;
      const ampA = 6 + ((h >>> 4) % 8);
      const ampB = 2 + ((h >>> 9) % 5);
      const pts = [];

      for (let i = 0; i < count; i++) {
        const x = (i / (count - 1)) * 100;
        const y =
          50 +
          Math.sin(i * phaseA + time * 1.55) * ampA +
          Math.sin(i * .83 - time * 2.10) * 4.25 +
          Math.sin(i * phaseB + time * 3.05) * ampB;
        pts.push(`${x.toFixed(1)},${Math.max(9, Math.min(91, y)).toFixed(1)}`);
      }

      return pts.join(" ");
    };

    const tick = now => {
      raf = requestAnimationFrame(tick);
      if (reduceMotion || now - lastFrame < 33) return;
      lastFrame = now;

      const root = document.getElementById("adk-chrome-manager-34");
      if (!root) return;

      const actor = globalThis.ADKChromeBackend?.getActor?.();
      const actorSeed = actor?.id ?? actor?.name ?? "subject";
      const time = now / 1000;

      root.querySelectorAll(".adk-v6-tech-readout").forEach((readout, index) => {
        const wave = readout.querySelector(".tech-wave polyline");
        if (wave) {
          const head = readout.querySelector(".tech-head span")?.textContent ?? "signal";
          wave.setAttribute("points", pointsFor(`${actorSeed}:${head}:${index}`, time + index * .33));
        }

        readout.querySelectorAll(".tech-barcode i").forEach((bar, barIndex) => {
          const a = (Math.sin(time * 4.6 + barIndex * .57 + index) + 1) * .5;
          const b = (Math.sin(time * 2.2 + barIndex * .83 + index * .7) + 1) * .5;
          bar.style.opacity = String((.26 + a * .56).toFixed(3));
          bar.style.transform = `scaleY(${(.68 + b * .62).toFixed(3)})`;
        });
      });
    };

    raf = requestAnimationFrame(tick);

    globalThis.__FEHA_TELEMETRY_040 = {
      stop() {
        cancelAnimationFrame(raf);
        delete globalThis.__FEHA_TELEMETRY_040;
      }
    };
  }

  function removeTelemetryMotion() {
    globalThis.__FEHA_TELEMETRY_040?.stop?.();
    delete globalThis.__FEHA_TELEMETRY_040;
  }

  function installSoundEngine() {
    if (globalThis.__FEHA_SOUND_ENGINE_040) return;

    const OriginalPlay = HTMLMediaElement.prototype.play;
    const LOCAL_KEY = "fehaCP2077LocalSfxV1";
    const FALLBACK_BASE = "https://raw.githubusercontent.com/aidenfortihong-blip/feha-dev/main/audio/kenney";

    const REQUIRED = [
      "hover","select","subsystem_select","actor_switch",
      "drawer_open","drawer_close","cyberware_select","scan",
      "install","remove","error","confirm"
    ];

    const OPTIONAL = [
      "cache_open","cache_close","compatibility_ok","compatibility_fail"
    ];

    const FALLBACK_MAP = {
      hover: `${FALLBACK_BASE}/tick_002.wav`,
      select: `${FALLBACK_BASE}/select_005.wav`,
      subsystem_select: `${FALLBACK_BASE}/select_005.wav`,
      actor_switch: `${FALLBACK_BASE}/select_005.wav`,
      drawer_open: `${FALLBACK_BASE}/doorOpen_000.ogg`,
      drawer_close: `${FALLBACK_BASE}/doorClose_000.ogg`,
      cyberware_select: `${FALLBACK_BASE}/select_005.wav`,
      scan: `${FALLBACK_BASE}/laserSmall_002.ogg`,
      install: `${FALLBACK_BASE}/impactMetal_001.ogg`,
      remove: `${FALLBACK_BASE}/doorClose_000.ogg`,
      error: `${FALLBACK_BASE}/error_003.wav`,
      confirm: `${FALLBACK_BASE}/confirmation_003.wav`,
      cache_open: `${FALLBACK_BASE}/doorOpen_000.ogg`,
      cache_close: `${FALLBACK_BASE}/doorClose_000.ogg`,
      compatibility_ok: `${FALLBACK_BASE}/confirmation_003.wav`,
      compatibility_fail: `${FALLBACK_BASE}/error_003.wav`
    };

    function readLocalPack() {
      try {
        const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        if (!parsed || typeof parsed !== "object") return null;

        const sounds = parsed.sounds ?? parsed;
        const complete = REQUIRED.every(key =>
          typeof sounds?.[key] === "string" &&
          (sounds[key].startsWith("data:audio/") || sounds[key].startsWith("https://assets.forge-vtt.com/"))
        );

        return complete ? sounds : null;
      } catch {
        return null;
      }
    }

    const localPack = readLocalPack() ?? readPrivateAssets()?.audio ?? null;
    const paths = {
      ...FALLBACK_MAP,
      ...(localPack ?? {})
    };
    const forgeBacked = localPack && Object.values(localPack).some(path => String(path).startsWith("https://assets.forge-vtt.com/"));
    const source = localPack ? (forgeBacked ? "CYBERPUNK 2077 // FORGE PRIVATE" : "CYBERPUNK 2077 // LOCAL") : "KENNEY // FALLBACK";

    const LEVELS = {
      hover: 0.34,
      select: 0.72,
      subsystem_select: 0.68,
      actor_switch: 0.76,
      drawer_open: 0.74,
      drawer_close: 0.72,
      cyberware_select: 0.74,
      scan: 0.72,
      install: 0.86,
      remove: 0.82,
      error: 0.76,
      confirm: 0.78,
      cache_open: 0.74,
      cache_close: 0.72,
      compatibility_ok: 0.78,
      compatibility_fail: 0.76
    };

    let master = Number(localStorage.getItem("fehaRealSfxVolume") ?? 0.82);
    if (!Number.isFinite(master)) master = 0.82;
    master = Math.max(0, Math.min(1, master));

    const templates = new Map();
    const active = new Set();
    const lastPlay = new Map();
    let disposed = false;

    function prime() {
      for (const [event, path] of Object.entries(paths)) {
        try {
          const audio = new Audio(path);
          audio.preload = "auto";
          templates.set(event, audio);
        } catch (err) {
          console.warn("FEHA DEV 0.8.4 // preload failed", event, err);
        }
      }
    }

    function normalize(kind) {
      const aliases = {
        drawer: "drawer_open",
        subsystemSelect: "subsystem_select",
        actorSwitch: "actor_switch",
        drawerOpen: "drawer_open",
        drawerClose: "drawer_close",
        cyberwareSelect: "cyberware_select",
        cacheOpen: "cache_open",
        cacheClose: "cache_close",
        compatibilityOk: "compatibility_ok",
        compatibilityFail: "compatibility_fail"
      };

      return aliases[kind] ?? kind;
    }

    function play(kind = "select", {cooldown = 32} = {}) {
      const event = normalize(kind);
      if (disposed || !paths[event] || master <= 0) return Promise.resolve(false);

      const now = performance.now();
      const last = lastPlay.get(event) ?? -Infinity;
      if (now - last < cooldown) return Promise.resolve(false);
      lastPlay.set(event, now);

      const template = templates.get(event);
      if (!template) return Promise.resolve(false);

      try {
        while (active.size >= 10) {
          const oldest = active.values().next().value;
          oldest.pause();
          active.delete(oldest);
        }

        const audio = template.cloneNode(true);
        audio.__fehaLevel = LEVELS[event] ?? 0.75;
        audio.volume = Math.max(
          0,
          Math.min(1, master * audio.__fehaLevel)
        );
        audio.playbackRate = 1;

        const release = () => active.delete(audio);
        audio.addEventListener("ended", release, {once:true});
        audio.addEventListener("error", release, {once:true});

        active.add(audio);

        return Promise.resolve(OriginalPlay.call(audio))
          .then(() => true)
          .catch(err => {
            release();
            console.warn("FEHA DEV 0.8.4 // sound playback failed", event, err);
            return false;
          });
      } catch (err) {
        console.warn("FEHA DEV 0.8.4 // sound clone failed", event, err);
        return Promise.resolve(false);
      }
    }

    const routedPlay = function(...args) {
      try {
        const src = String(
          this.currentSrc ||
          this.src ||
          this.getAttribute?.("src") ||
          ""
        );

        const match = src.match(
          /\/assets\/audio\/chrome\/(hover|select|drawer|scan|install|remove|error|confirm)\.wav(?:[?#].*)?$/i
        );

        if (match) {
          void play(match[1].toLowerCase());
          return Promise.resolve();
        }
      } catch (err) {
        console.warn("FEHA DEV 0.8.4 // legacy sound routing failed", err);
      }

      return OriginalPlay.apply(this, args);
    };

    HTMLMediaElement.prototype.play = routedPlay;

    const clickHandler = event => {
      const market = event.target?.closest?.("#adk-market-15");

      if (market) {
        const button =
          event.target?.closest?.("button,[role='button']") ??
          null;

        if (!button || button.disabled) return;

        if (button.matches(".close-market")) {
          void play("drawer_close", {cooldown:0});
          return;
        }

        if (button.matches("#top-directory,#back-directory")) {
          void play("drawer_close", {cooldown:0});
          return;
        }

        if (button.matches("#adk-market-wallet")) {
          void play("drawer_open", {cooldown:0});
          return;
        }

        if (button.matches("[data-shop]")) {
          void play("drawer_open", {cooldown:0});
          return;
        }

        if (button.matches("[data-shop-tier]")) {
          void play("subsystem_select", {cooldown:0});
          return;
        }

        if (button.matches("#reroll-stock")) {
          void play("scan", {cooldown:0});
          return;
        }

        if (button.matches(".detail-btn[data-open-item]")) {
          void play("scan", {cooldown:0});
          return;
        }

        if (button.matches(".item-art-wrap[data-open-item]")) {
          void play("cyberware_select", {cooldown:0});
          return;
        }

        if (button.matches(".item-name[data-open-item]")) {
          void play("drawer_open", {cooldown:0});
          return;
        }

        if (button.matches("[data-buy-item]")) {
          void play("install", {cooldown:0});
          return;
        }

        if (button.matches("[data-item-tier]")) {
          void play("cyberware_select", {cooldown:0});
          return;
        }

        if (button.matches("[data-category]")) {
          void play("select", {cooldown:0});
          return;
        }

        if (button.matches("#reset-filters")) {
          void play("remove", {cooldown:0});
          return;
        }

        if (button.matches("[data-page]")) {
          void play("select", {cooldown:0});
          return;
        }

        void play("select", {cooldown:0});
        return;
      }

      const root = event.target?.closest?.("#adk-chrome-manager-34");
      if (!root) return;

      if (event.target.closest?.(".adk-v6-system")) {
        void play("subsystem_select", {cooldown:70});
        return;
      }

      if (event.target.closest?.("[data-open-cache]")) {
        void play("cache_open", {cooldown:90});
        return;
      }

      if (event.target.closest?.("[data-close-cache]")) {
        void play("cache_close", {cooldown:90});
        return;
      }

      if (event.target.closest?.("[data-cache-item]")) {
        void play("cyberware_select", {cooldown:70});
        return;
      }

      const button = event.target.closest?.("button,[role='button']");
      if (!button) return;

      const words = String(
        button.dataset?.action ??
        button.dataset?.mode ??
        button.textContent ??
        ""
      ).trim().toLowerCase();

      if (/\b(install|implant|authorize)\b/.test(words)) {
        void play("install", {cooldown:120});
      } else if (/\b(remove|eject|uninstall|detach)\b/.test(words)) {
        void play("remove", {cooldown:120});
      }
    };

    const changeHandler = event => {
      if (event.target?.matches?.("#adk-market-15 #adk-market-actor")) {
        void play("actor_switch", {cooldown:0});
        return;
      }

      if (event.target?.matches?.("#adk-market-15 #market-maker,#adk-market-15 #market-slot")) {
        void play("subsystem_select", {cooldown:0});
        return;
      }

      if (event.target?.matches?.("#adk-chrome-manager-34 #actor-select")) {
        void play("actor_switch", {cooldown:110});
      }
    };

    document.addEventListener("click", clickHandler, true);
    document.addEventListener("change", changeHandler, true);

    prime();

    const api = {
      play,
      source,
      paths,
      get volume() { return master; },
      setVolume(value) {
        master = Math.max(0, Math.min(1, Number(value) || 0));
        localStorage.setItem("fehaRealSfxVolume", String(master));
        for (const audio of active) {
          audio.volume = Math.max(
            0,
            Math.min(1, master * (audio.__fehaLevel ?? 0.75))
          );
        }
        return master;
      },
      demo() {
        const order = [
          "hover","select","subsystem_select","actor_switch",
          "drawer_open","drawer_close","cyberware_select","scan",
          "install","remove","error","confirm",
          "cache_open","cache_close","compatibility_ok","compatibility_fail"
        ];

        order.forEach(
          (event, i) => setTimeout(() => void play(event, {cooldown:0}), i * 1150)
        );
      },
      hasCyberpunkPack() {
        return Boolean(readLocalPack() ?? readPrivateAssets()?.audio);
      }
    };

    const engine = {
      originalPlay: OriginalPlay,
      dispose() {
        if (disposed) return;
        disposed = true;

        document.removeEventListener("click", clickHandler, true);
        document.removeEventListener("change", changeHandler, true);

        for (const audio of active) audio.pause();
        active.clear();

        for (const template of templates.values()) {
          template.pause();
          template.removeAttribute("src");
          template.load();
        }
        templates.clear();

        if (HTMLMediaElement.prototype.play === routedPlay) {
          HTMLMediaElement.prototype.play = OriginalPlay;
        }

        if (globalThis.FEHA_SOUNDS === api) delete globalThis.FEHA_SOUNDS;
        if (globalThis.__FEHA_SOUND_ENGINE_040 === engine) {
          delete globalThis.__FEHA_SOUND_ENGINE_040;
        }
      }
    };

    globalThis.FEHA_SOUNDS = api;
    globalThis.__FEHA_SOUND_ENGINE_040 = engine;

    console.info(
      `FEHA DEV 0.8.4 // sound source: ${source}`
    );

    if (!localPack) {
      console.info(
        "FEHA DEV 0.8.4 // Cyberpunk local pack not installed; using CC0 fallback."
      );
    }
  }

  function installMarketSoundUX() {
    removeMarketSoundUX();

    const play = (kind, cooldown = 0) => {
      const sounds = globalThis.FEHA_SOUNDS;
      if (sounds?.play) {
        void sounds.play(kind,{cooldown});
        return true;
      }

      const src =
        sounds?.paths?.[kind] ??
        null;

      if (!src) return false;

      try {
        const audio = new Audio(src);
        audio.volume = .75;
        void audio.play();
        return true;
      } catch {
        return false;
      }
    };

    const soundForButton = button => {
      if (button.matches(".close-market")) return ["drawer_close",0];
      if (button.matches("#top-directory,#back-directory")) return ["drawer_close",0];
      if (button.matches("#adk-market-wallet")) return ["drawer_open",0];

      if (button.matches("[data-shop-tier]")) return ["subsystem_select",0];
      if (button.matches("[data-shop]")) return ["drawer_open",0];

      if (button.matches("#reroll-stock")) return ["scan",0];

      // Item interactions intentionally do NOT all sound alike.
      if (button.matches(".detail-btn[data-open-item]")) return ["scan",0];
      if (button.matches(".item-art-wrap[data-open-item]")) return ["cyberware_select",0];
      if (button.matches(".item-name[data-open-item]")) return ["drawer_open",0];
      if (button.matches("[data-open-item]")) return ["drawer_open",0];

      if (button.matches("[data-buy-item]")) return ["install",0];

      if (button.matches("[data-category]")) return ["select",0];
      if (button.matches("[data-item-tier]")) return ["cyberware_select",0];
      if (button.matches("#reset-filters")) return ["remove",0];
      if (button.matches("[data-page]")) return ["select",0];

      if (button.matches(".icon-btn")) return ["select",0];
      if (button.matches(".filter-chip")) return ["select",0];
      if (button.matches("button,[role='button']")) return ["select",0];

      return null;
    };

    const bindButton = button => {
      if (!(button instanceof HTMLElement)) return;
      if (button.dataset.fehaMarketSoundButton === "1") return;

      const sound = soundForButton(button);
      if (!sound) return;

      const pointerHandler = event => {
        if (event.button != null && event.button !== 0) return;
        if (button.disabled) return;
        play(sound[0],sound[1]);
      };

      button.addEventListener("pointerdown",pointerHandler,true);
      button.dataset.fehaMarketSoundButton = "1";
      marketSoundUX.buttons.set(button,pointerHandler);
    };

    const bindSelect = select => {
      if (!(select instanceof HTMLElement)) return;
      if (select.dataset.fehaMarketSoundSelect === "1") return;

      const changeHandler = () => {
        if (select.id === "adk-market-actor") {
          play("actor_switch",0);
        } else {
          play("subsystem_select",0);
        }
      };

      select.addEventListener("change",changeHandler,true);
      select.dataset.fehaMarketSoundSelect = "1";
      marketSoundUX.selects.set(select,changeHandler);
    };

    const bindRoot = root => {
      if (!root) return;

      root
        .querySelectorAll("button,[role='button']")
        .forEach(bindButton);

      root
        .querySelectorAll("#adk-market-actor,#market-maker,#market-slot")
        .forEach(bindSelect);
    };

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes ?? []) {
          if (!(node instanceof Element)) continue;

          if (node.matches?.("#adk-market-15")) {
            bindRoot(node);
            continue;
          }

          const root =
            node.closest?.("#adk-market-15") ??
            node.querySelector?.("#adk-market-15") ??
            document.getElementById("adk-market-15");

          if (root) bindRoot(root);
        }
      }
    });

    marketSoundUX = {
      observer,
      buttons:new Map(),
      selects:new Map(),
      bindRoot
    };

    observer.observe(document.body,{
      childList:true,
      subtree:true
    });

    bindRoot(document.getElementById("adk-market-15"));
  }

  function removeMarketSoundUX() {
    if (!marketSoundUX) return;

    marketSoundUX.observer?.disconnect?.();

    for (const [button,handler] of marketSoundUX.buttons ?? []) {
      button.removeEventListener("pointerdown",handler,true);
      if (button.dataset) {
        delete button.dataset.fehaMarketSoundButton;
      }
    }

    for (const [select,handler] of marketSoundUX.selects ?? []) {
      select.removeEventListener("change",handler,true);
      if (select.dataset) {
        delete select.dataset.fehaMarketSoundSelect;
      }
    }

    marketSoundUX = null;
  }

  function removeSoundEngine() {
    const engine =
      globalThis.__FEHA_SOUND_ENGINE_040 ??
      globalThis.__FEHA_SOUND_ENGINE_034 ??
      globalThis.__FEHA_SOUND_ENGINE_033 ??
      globalThis.__FEHA_SOUND_ENGINE_032 ??
      globalThis.__FEHA_SOUND_ENGINE_029 ??
      globalThis.__FEHA_SOUND_ENGINE_028;

    if (!engine) return;

    engine.dispose?.();

    if (HTMLMediaElement.prototype.play !== engine.originalPlay) {
      HTMLMediaElement.prototype.play = engine.originalPlay;
    }

    delete globalThis.FEHA_SOUNDS;
    delete globalThis.__FEHA_SOUND_ENGINE_040;
    delete globalThis.__FEHA_SOUND_ENGINE_034;
    delete globalThis.__FEHA_SOUND_ENGINE_033;
    delete globalThis.__FEHA_SOUND_ENGINE_032;
    delete globalThis.__FEHA_SOUND_ENGINE_029;
    delete globalThis.__FEHA_SOUND_ENGINE_028;
  }

  const FEHA_PLAYABLE_ROSTER = Object.freeze([
    "ponyboy",
    "derke",
    "sasha",
    "zach"
  ]);

  const FEHA_PLAYABLE_ROSTER_SET = new Set(FEHA_PLAYABLE_ROSTER);

  function playableActorKey(actorOrName) {
    const raw =
      typeof actorOrName === "string"
        ? actorOrName
        : (
            actorOrName?.flags?.fleshEnshrouded?.adkCharacter ??
            actorOrName?.name ??
            ""
          );

    const key = norm(raw);

    if (key === "sasha bogdanov" || key.startsWith("sasha ")) {
      return "sasha";
    }

    return key;
  }

  function playableDisplayName(actorOrName) {
    const key = playableActorKey(actorOrName);

    if (key === "ponyboy") return "Ponyboy";
    if (key === "derke") return "Derke";
    if (key === "sasha") return "Sasha";
    if (key === "zach") return "Zach";

    return String(
      typeof actorOrName === "string"
        ? actorOrName
        : actorOrName?.name ?? ""
    );
  }

  function normalizePlayableRoster(scope = document.body) {
    if (!scope?.querySelectorAll) return 0;

    const selectors = [
      "#adk-market-15 #adk-market-actor",
      "#adk-chrome-manager-34 #actor-select",
      "#adk-cyberdeck-terminal #cd2-actor",
      "#feha-cyberdeck-v2 #cd2-actor"
    ];

    const selects = new Set();

    if (scope instanceof Element && scope.matches?.(selectors.join(","))) {
      selects.add(scope);
    }

    for (const select of scope.querySelectorAll(selectors.join(","))) {
      selects.add(select);
    }

    let changed = 0;

    for (const select of selects) {
      for (const option of [...select.options]) {
        const actor =
          game?.actors?.get?.(String(option.value ?? "")) ??
          null;

        const key = playableActorKey(
          actor ?? option.textContent ?? option.label ?? ""
        );

        if (!FEHA_PLAYABLE_ROSTER_SET.has(key)) {
          option.remove();
          changed++;
          continue;
        }

        const display = playableDisplayName(actor ?? key);

        if (option.textContent !== display) {
          option.textContent = display;
          option.label = display;
          changed++;
        }
      }
    }

    const adkRoots = [];

    if (
      scope instanceof Element &&
      scope.matches?.(
        "#adk-market-15,#adk-chrome-manager-34,#adk-cyberdeck-terminal,#feha-cyberdeck-v2,#feha-credits-wallet"
      )
    ) {
      adkRoots.push(scope);
    }

    adkRoots.push(
      ...scope.querySelectorAll(
        "#adk-market-15,#adk-chrome-manager-34,#adk-cyberdeck-terminal,#feha-cyberdeck-v2,#feha-credits-wallet"
      )
    );

    for (const root of new Set(adkRoots)) {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT
      );

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      for (const node of nodes) {
        const before = node.nodeValue ?? "";
        const after = before.replace(/\bSasha\s+Bogdanov\b/gi,"Sasha");

        if (after !== before) {
          node.nodeValue = after;
          changed++;
        }
      }

      root
        .querySelectorAll("[title],[aria-label],[data-tooltip],[placeholder],[alt]")
        .forEach(el => {
          for (const attr of ["title","aria-label","data-tooltip","placeholder","alt"]) {
            if (!el.hasAttribute(attr)) continue;

            const before = el.getAttribute(attr) ?? "";
            const after = before.replace(/\bSasha\s+Bogdanov\b/gi,"Sasha");

            if (after !== before) {
              el.setAttribute(attr,after);
              changed++;
            }
          }
        });
    }

    return changed;
  }

  const FEHA_PORTRAIT_OVERRIDES = Object.freeze({
    derke:
      "https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/1%20Cyberpunk/74981913-bd87-4289-a524-7d987e699cfd.png",
    ponyboy:
      "https://assets.forge-vtt.com/600d963af3cd821ef5bfb19a/-yeah/40e1fb5d-6265-4dfd-93d3-d6344dc14180.png"
  });

  function applyActorPortraitOverride(root = document.getElementById("adk-chrome-manager-34")) {
    const actor = globalThis.ADKChromeBackend?.getActor?.();
    const actorName = norm(actor?.name);
    const url = FEHA_PORTRAIT_OVERRIDES[actorName];

    if (!url) {
      if (root?.dataset) delete root.dataset.fehaPortraitOverride;
      return false;
    }

    const portrait = root?.querySelector?.(".subject-art img");
    if (!portrait) return false;

    root.dataset.fehaPortraitOverride = actorName;

    if (portrait.src !== url) {
      portrait.src = url;
    }

    portrait.alt = actor?.name ?? actorName;
    portrait.dataset.fehaPortrait = actorName;
    return true;
  }

  function filterActorRoster(root = document.getElementById("adk-chrome-manager-34")) {
    if (!root) return false;
    normalizePlayableRoster(root);
    return true;
  }

  function installActorSwitchFix() {
    if (globalThis.__FEHA_ACTOR_SWITCH_FIX_026) return;

    let switching = false;

    const handler = async event => {
      const select = event.target?.closest?.("#adk-chrome-manager-34 #actor-select");
      if (!select) return;

      // Own the subject-switch transaction so the native delayed handler and
      // the theme service cannot race one another.
      event.stopImmediatePropagation();

      const actorId = String(select.value ?? "");
      const api = globalThis.ADKChromeBackend;
      const root = document.getElementById("adk-chrome-manager-34");

      if (!actorId || !api || switching) return;
      if (api.getActor?.()?.id === actorId) {
        globalThis.ADKTheme?.refresh?.();
        return;
      }

      switching = true;
      root?.classList.add("is-subject-switching");

      try {
        const desired = game.actors.get(actorId);
        if (!desired) throw new Error("Actor not found: " + actorId);

        // setActor updates the private legacy backend state. Its internal render
        // is allowed to fail without leaving us stuck; we force the native pass
        // immediately afterward from the now-correct backend state.
        try {
          api.setActor(actorId);
        } catch (renderErr) {
          console.warn(
            "FEHA DEV " + BUILD + " // backend switched actor but its inline render failed; forcing native render",
            renderErr
          );
        }

        if (api.getActor?.()?.id !== actorId) {
          throw new Error(
            "Backend actor mismatch after switch. Expected " +
            actorId +
            ", got " +
            (api.getActor?.()?.id ?? "null")
          );
        }

        await repairCacheMetadata(api);

        // Clear any cache/item selection state visually before the new subject
        // frame resolves.
        document
          .getElementById("adk-chrome-manager-34")
          ?.classList.remove("feha-cache-selection-focus");

        globalThis.ADKChromeNative?.render?.();

        requestAnimationFrame(() => {
          const liveRoot = document.getElementById("adk-chrome-manager-34");
          filterActorRoster(liveRoot);
          const liveSelect = liveRoot?.querySelector("#actor-select");
          if (liveSelect && liveSelect.value !== actorId) liveSelect.value = actorId;

          globalThis.ADKTheme?.refresh?.();

          setTimeout(() => {
            if (!lifecycleActive) return;
            globalThis.ADKChromeNative?.render?.();
            globalThis.ADKTheme?.refresh?.();
            document
              .getElementById("adk-chrome-manager-34")
              ?.classList.remove("is-subject-switching");
          }, 80);
        });

        console.info(
          "FEHA DEV " + BUILD + " // subject switch complete:",
          desired.name,
          actorId
        );
      } catch (err) {
        console.error("FEHA DEV " + BUILD + " // actor switch failed", err);
        ui?.notifications?.error?.(
          "FEHA subject switch failed — send me a screenshot of the visible error."
        );

        // Put the selector back on the backend's actual actor so the UI can no
        // longer show Florence while the backend still thinks Ponyboy.
        const actualId = api?.getActor?.()?.id;
        const liveSelect = document
          .getElementById("adk-chrome-manager-34")
          ?.querySelector("#actor-select");
        if (liveSelect && actualId) liveSelect.value = actualId;

        try {
          globalThis.ADKChromeNative?.render?.();
          globalThis.ADKTheme?.refresh?.();
        } catch (fallbackErr) {
          console.error("FEHA DEV " + BUILD + " // actor switch fallback render failed", fallbackErr);
        }
      } finally {
        switching = false;
        setTimeout(() => {
          if (!lifecycleActive) return;
          document
            .getElementById("adk-chrome-manager-34")
            ?.classList.remove("is-subject-switching");
        }, 260);
      }
    };

    document.addEventListener("change", handler, true);
    globalThis.__FEHA_ACTOR_SWITCH_FIX_026 = { handler };
  }

  function removeActorSwitchFix() {
    const fix = globalThis.__FEHA_ACTOR_SWITCH_FIX_026;
    if (!fix) return;
    document.removeEventListener("change", fix.handler, true);
    delete globalThis.__FEHA_ACTOR_SWITCH_FIX_026;
  }

  function installCreditsSystem() {
    removeCreditsSystem();

    const wallet = globalThis.ADKWallet;
    if (!wallet) {
      console.warn("FEHA DEV // Credits wallet skipped: ADKWallet unavailable.");
      return false;
    }

    const FLAG = "fleshEnshrouded";
    const ROOT_ID = "feha-credits-wallet";

    const original = {
      get:wallet.get,
      getEuro:wallet.getEuro,
      setEuro:wallet.setEuro,
      add:wallet.add,
      spend:wallet.spend,
      update:wallet.update,
      format:wallet.format,
      open:wallet.open,
      refresh:wallet.refresh
    };

    const finiteMoney = value => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.max(0,Math.floor(n)) : null;
    };

    const rawGpValue = actor => {
      const raw = actor?._source?.system?.currency?.gp;

      if (typeof raw === "number") return finiteMoney(raw);
      if (raw && typeof raw.value === "number") return finiteMoney(raw.value);

      const current = actor?.system?.currency?.gp;
      if (typeof current === "number") return finiteMoney(current);
      if (current && typeof current.value === "number") {
        return finiteMoney(current.value);
      }

      return null;
    };

    const legacyBalance = actor => {
      if (!actor) return 0;

      const flags = actor.flags?.[FLAG] ?? {};
      const nested = flags.wallet ?? {};

      const canonical = finiteMoney(flags.credits);
      if (canonical !== null) return canonical;

      // The old ADK Core explicitly treated D&D GP as canonical, so preserve
      // that value first. Only fall back to older mirrors when GP is absent.
      const gp = rawGpValue(actor);
      if (gp !== null) return gp;

      const candidates = [
        flags.eurodollars,
        nested.credits,
        nested.eurodollars,
        nested.euro,
        flags.money,
        nested.money
      ];

      for (const value of candidates) {
        const parsed = finiteMoney(value);
        if (parsed !== null) return parsed;
      }

      return 0;
    };

    const getCredits = actor => {
      if (!actor) return 0;
      const direct = finiteMoney(actor.flags?.[FLAG]?.credits);
      return direct !== null ? direct : legacyBalance(actor);
    };

    const formatCredits = value =>
      "CR " + (finiteMoney(value) ?? 0).toLocaleString();

    const canEdit = actor =>
      Boolean(
        actor &&
        (
          game.user?.isGM ||
          actor.isOwner
        )
      );

    const refreshCreditLabels = scope => {
      if (!scope) return;

      const roots = [];

      if (scope instanceof Element) {
        if (
          scope.matches?.(
            "#adk-market-15,#adk-chrome-manager-34,#adk-cyberdeck-terminal,#feha-cyberdeck-v2,#feha-credits-wallet"
          )
        ) {
          roots.push(scope);
        }

        roots.push(
          ...scope.querySelectorAll?.(
            "#adk-market-15,#adk-chrome-manager-34,#adk-cyberdeck-terminal,#feha-cyberdeck-v2,#feha-credits-wallet"
          ) ?? []
        );
      } else if (scope === document || scope === document.body) {
        roots.push(
          ...document.querySelectorAll(
            "#adk-market-15,#adk-chrome-manager-34,#adk-cyberdeck-terminal,#feha-cyberdeck-v2,#feha-credits-wallet"
          )
        );
      }

      const unique = [...new Set(roots)];

      for (const root of unique) {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT
        );

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        for (const node of nodes) {
          const old = node.nodeValue;
          if (!old) continue;

          const next = old
            .replace(/€\$/g,"CR")
            .replace(/\bEURODOLLARS\b/gi,"CREDITS")
            .replace(/\bEURODOLLAR\b/gi,"CREDIT")
            .replace(/\bEDDIES\b/gi,"CREDITS")
            .replace(/\bEDDIE\b/gi,"CREDIT");

          if (next !== old) node.nodeValue = next;
        }
      }
    };

    const refreshSurfaces = actor => {
      try {
        if (document.getElementById("adk-market-15")) {
          globalThis.ADKMarket?.refresh?.();
        }
      } catch {}

      try {
        globalThis.ADKChromeBackend?.refresh?.();
      } catch {}

      try {
        const root = document.getElementById(ROOT_ID);
        if (root?.dataset?.actorId === actor?.id) {
          const input = root.querySelector("[data-credits-input]");
          const readout = root.querySelector("[data-credits-readout]");
          const amount = getCredits(actor);

          if (input && document.activeElement !== input) {
            input.value = String(amount);
          }

          if (readout) {
            readout.textContent = formatCredits(amount);
          }
        }
      } catch {}

      requestAnimationFrame(() => refreshCreditLabels(document.body));
    };

    const setCredits = async (actor, amount) => {
      if (!actor || !canEdit(actor)) return false;

      const credits = finiteMoney(amount) ?? 0;
      const update = {
        [`flags.${FLAG}.credits`]:credits,

        // Compatibility mirror only. Credits is authoritative from this build.
        [`flags.${FLAG}.eurodollars`]:credits
      };

      const raw = actor?._source?.system?.currency?.gp;
      if (
        raw &&
        typeof raw === "object" &&
        "value" in raw
      ) {
        update["system.currency.gp.value"] = credits;
      } else if (
        foundry.utils.hasProperty(
          actor.toObject(),
          "system.currency.gp"
        )
      ) {
        update["system.currency.gp"] = credits;
      }

      const nested = actor.flags?.[FLAG]?.wallet ?? {};

      for (const key of ["eurodollars","euro","money"]) {
        if (Object.prototype.hasOwnProperty.call(nested,key)) {
          update[`flags.${FLAG}.wallet.-=${key}`] = null;
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(
          actor.flags?.[FLAG] ?? {},
          "money"
        )
      ) {
        update[`flags.${FLAG}.-=money`] = null;
      }

      await actor.update(update);
      refreshSurfaces(actor);
      return true;
    };

    const addCredits = async (actor, amount) =>
      setCredits(actor,getCredits(actor) + Number(amount || 0));

    const spendCredits = async (actor, amount, reason = "") => {
      if (!actor) return false;

      const cost = finiteMoney(amount) ?? 0;
      const balance = getCredits(actor);

      if (balance < cost) {
        ui.notifications.warn(
          actor.name +
          " only has " +
          formatCredits(balance) +
          "."
        );
        globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
        return false;
      }

      await setCredits(actor,balance - cost);

      if (reason) {
        console.log(
          "FEHA CREDITS | " +
          actor.name +
          " spent " +
          formatCredits(cost) +
          " on " +
          reason +
          "."
        );
      }

      return true;
    };

    const getWalletData = actor => {
      let base = {};

      try {
        const result = original.get?.call(wallet,actor);
        if (result && typeof result === "object") base = result;
      } catch {}

      const credits = getCredits(actor);

      return {
        ...base,
        credits,
        // Compatibility alias for legacy callers only.
        eurodollars:credits
      };
    };

    const updateWalletData = async (actor, data = {}) => {
      if (!actor) return false;

      if (data.credits !== undefined) {
        await setCredits(actor,data.credits);
      } else if (data.eurodollars !== undefined) {
        await setCredits(actor,data.eurodollars);
      }

      const legacyData = {...data};
      delete legacyData.credits;
      delete legacyData.eurodollars;

      if (Object.keys(legacyData).length && original.update) {
        try {
          await original.update.call(wallet,actor,legacyData);
        } catch {}
      }

      refreshSurfaces(actor);
      return true;
    };

    const resolveActor = actor =>
      actor ??
      canvas?.tokens?.controlled?.[0]?.actor ??
      game.user?.character ??
      game.actors?.find?.(a => a.type === "character") ??
      null;

    const openWallet = actorArg => {
      const actor = resolveActor(actorArg);
      if (!actor) {
        ui.notifications.warn("No character available for Credits Wallet.");
        return null;
      }

      document.getElementById(ROOT_ID)?.remove();

      const root = document.createElement("section");
      root.id = ROOT_ID;
      root.dataset.actorId = actor.id;
      root.dataset.editable = canEdit(actor) ? "1" : "0";

      root.innerHTML = `
        <header class="credits-command">
          <div class="credits-brand">
            <span>ADK //</span>
            <b>WALLET</b>
            <small>CREDITS LEDGER</small>
          </div>

          <div class="credits-command-actions">
            <span class="credits-live">
              <i></i>
              SYNCED
            </span>

            <button
              type="button"
              data-credit-action="close"
              aria-label="Close wallet"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        <div class="credits-shell">
          <section class="credits-identity">
            <div class="credits-eyebrow">
              AUTHORIZED HOLDER
            </div>

            <h1>${String(actor.name ?? "UNKNOWN").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}</h1>

            <div class="credits-idline">
              <span>ACCOUNT</span>
              <b>${String(actor.id ?? "").slice(-8).toUpperCase()}</b>
            </div>
          </section>

          <section class="credits-balance">
            <div class="credits-balance-top">
              <span>AVAILABLE CREDITS</span>
              <small>LIVE BALANCE</small>
            </div>

            <div class="credits-balance-readout" data-credits-readout>
              ${formatCredits(getCredits(actor))}
            </div>

            <label class="credits-editor">
              <span>EDIT BALANCE</span>
              <div class="credits-input-wrap">
                <b>CR</b>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value="${getCredits(actor)}"
                  data-credits-input
                  ${canEdit(actor) ? "" : "disabled"}
                >
              </div>
            </label>
          </section>

          <footer class="credits-footer">
            <button
              type="button"
              class="credits-save"
              data-credit-action="save"
              ${canEdit(actor) ? "" : "disabled"}
            >
              SAVE CREDITS
            </button>
          </footer>
        </div>
      `;

      document.body.appendChild(root);

      const close = () => {
        globalThis.FEHA_SOUNDS?.play?.("drawer_close",{cooldown:0});
        root.remove();
      };

      root
        .querySelector('[data-credit-action="close"]')
        ?.addEventListener("click",close);

      const save = async () => {
        const input = root.querySelector("[data-credits-input]");
        if (!input || input.disabled) return;

        const amount = finiteMoney(input.value) ?? 0;
        const button = root.querySelector('[data-credit-action="save"]');

        if (button) button.disabled = true;

        try {
          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});
          await setCredits(actor,amount);
          input.value = String(getCredits(actor));
          root.querySelector("[data-credits-readout]").textContent =
            formatCredits(getCredits(actor));
          globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0});
        } catch (error) {
          console.error("FEHA CREDITS | save failed",error);
          ui.notifications.error("Credits update failed.");
          globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
        } finally {
          if (button) button.disabled = !canEdit(actor);
        }
      };

      root
        .querySelector('[data-credit-action="save"]')
        ?.addEventListener("click",save);

      root
        .querySelector("[data-credits-input]")
        ?.addEventListener("keydown",event => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void save();
        });

      // Drag from command bar, consistent with other FEHA applications.
      const bar = root.querySelector(".credits-command");
      let drag = null;

      bar?.addEventListener("pointerdown",event => {
        if (event.button !== 0 || event.target.closest("button,input")) return;

        const rect = root.getBoundingClientRect();
        root.style.transform = "none";
        root.style.left = rect.left + "px";
        root.style.top = rect.top + "px";

        drag = {
          id:event.pointerId,
          dx:event.clientX - rect.left,
          dy:event.clientY - rect.top
        };

        bar.setPointerCapture?.(event.pointerId);
      });

      bar?.addEventListener("pointermove",event => {
        if (!drag || drag.id !== event.pointerId) return;

        root.style.left =
          Math.max(
            0,
            Math.min(
              window.innerWidth - root.offsetWidth,
              event.clientX - drag.dx
            )
          ) +
          "px";

        root.style.top =
          Math.max(
            0,
            Math.min(
              window.innerHeight - 60,
              event.clientY - drag.dy
            )
          ) +
          "px";
      });

      const stop = event => {
        if (drag?.id === event.pointerId) drag = null;
      };

      bar?.addEventListener("pointerup",stop);
      bar?.addEventListener("pointercancel",stop);

      globalThis.FEHA_SOUNDS?.play?.("drawer_open",{cooldown:0});
      refreshCreditLabels(root);
      return root;
    };

    // Replace currency semantics while preserving all old call signatures.
    wallet.getCredits = getCredits;
    wallet.setCredits = setCredits;
    wallet.addCredits = addCredits;
    wallet.spendCredits = spendCredits;

    wallet.get = getWalletData;
    wallet.getEuro = getCredits;
    wallet.setEuro = setCredits;
    wallet.add = addCredits;
    wallet.spend = spendCredits;
    wallet.update = updateWalletData;
    wallet.format = formatCredits;
    wallet.open = openWallet;

    if (globalThis.ADKCore) {
      globalThis.ADKCore.wallet = wallet;
    }

    const mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes ?? []) {
          if (node instanceof Element) refreshCreditLabels(node);
        }
      }
    });

    mutationObserver.observe(document.body,{
      childList:true,
      subtree:true
    });

    const actorHook = Hooks.on("updateActor",(actor,changes) => {
      const flat = foundry.utils.flattenObject(changes ?? {});
      const keys = Object.keys(flat);

      if (
        keys.some(key =>
          key.includes(`flags.${FLAG}.credits`) ||
          key.includes(`flags.${FLAG}.eurodollars`) ||
          key.includes("system.currency.gp")
        )
      ) {
        refreshSurfaces(actor);
      }
    });

    creditsSystem = {
      wallet,
      original,
      mutationObserver,
      actorHook,
      refreshCreditLabels
    };

    // One-time conversion for every editable character. Credits wins if already
    // present; otherwise the old GP canonical value is preserved.
    void (async () => {
      let migrated = 0;

      for (const actor of game.actors.filter(a => a.type === "character")) {
        if (!canEdit(actor)) continue;

        const hadCredits =
          finiteMoney(actor.flags?.[FLAG]?.credits) !== null;

        const balance = getCredits(actor);

        try {
          await setCredits(actor,balance);
          if (!hadCredits) migrated++;
        } catch (error) {
          console.warn(
            "FEHA CREDITS | migration failed for",
            actor.name,
            error
          );
        }
      }

      refreshCreditLabels(document.body);

      console.info(
        "FEHA CREDITS // canonical migration ready; new actor balances:",
        migrated
      );
    })();

    return true;
  }

  function removeCreditsSystem() {
    if (!creditsSystem) return;

    try {
      creditsSystem.mutationObserver?.disconnect?.();
    } catch {}

    try {
      if (creditsSystem.actorHook != null) {
        Hooks.off("updateActor",creditsSystem.actorHook);
      }
    } catch {}

    const wallet = creditsSystem.wallet;
    const original = creditsSystem.original;

    if (wallet && original) {
      for (const [key,value] of Object.entries(original)) {
        if (value === undefined) {
          delete wallet[key];
        } else {
          wallet[key] = value;
        }
      }

      delete wallet.getCredits;
      delete wallet.setCredits;
      delete wallet.addCredits;
      delete wallet.spendCredits;

      if (globalThis.ADKCore) {
        globalThis.ADKCore.wallet = wallet;
      }
    }

    document.getElementById("feha-credits-wallet")?.remove();
    creditsSystem = null;
  }

  function tagLegacyWallets(scope = document.body) {
    if (!scope?.querySelectorAll) return 0;

    const labels = [];
    const all = [
      ...(scope instanceof Element ? [scope] : []),
      ...scope.querySelectorAll("*")
    ];

    for (const el of all) {
      if (el.children.length > 0) continue;
      const text = String(el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      if (text === "adk // wallet" || text === "adk wallet") {
        labels.push(el);
      }
    }

    let tagged = 0;

    for (const label of labels) {
      let shell = label;
      let cursor = label.parentElement;

      // Pick the smallest nearby wrapper that contains both the wallet label
      // and the visible €$ balance. This keeps the rest of the sheet untouched.
      for (let depth = 0; cursor && depth < 7; depth++, cursor = cursor.parentElement) {
        const text = String(cursor.innerText ?? cursor.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();

        if (/ADK\s*\/\/\s*WALLET/i.test(text) && /€\$\s*[-+]?\d/i.test(text)) {
          shell = cursor;
          break;
        }
      }

      if (shell === label) shell = label.parentElement ?? label;

      shell.dataset.fehaWalletShell = "legacy";
      shell.classList.add("feha-wallet-legacy-shell");

      if (!shell.id) {
        const token =
          shell.closest?.("[data-document-id]")?.dataset?.documentId ??
          shell.closest?.("[data-actor-id]")?.dataset?.actorId ??
          shell.closest?.(".application,.app,.window-app")?.id ??
          String(tagged + 1);
        shell.id = "feha-wallet-legacy-" + String(token).replace(/[^a-z0-9_-]+/gi, "-");
        shell.dataset.fehaWalletAssignedId = "1";
      }

      const descendants = [...shell.querySelectorAll("*")];
      const balance = descendants.find(el => {
        if (el.children.length > 0) return false;
        return /€\$\s*[-+]?\d/i.test(String(el.textContent ?? "").replace(/\s+/g, " ").trim());
      });

      if (balance) {
        balance.dataset.fehaWalletBalance = "1";
        if (!balance.id) {
          balance.id = shell.id + "-balance";
          balance.dataset.fehaWalletAssignedId = "1";
        }
      }

      tagged++;
    }

    return tagged;
  }

  function euroBalanceText(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return /^€\$\s*[-+]?\d[\d,.]*$/i.test(text);
  }

  function suppressLegacyWalletChrome(root = document.getElementById("adk-chrome-manager-34")) {
    if (!root?.querySelectorAll) return 0;

    let suppressed = 0;

    // The Chrome Manager's old top-bar balance control survived the sheet-wallet
    // removal. Tag any interactive €$ balance launcher so CSS can remove it.
    root.querySelectorAll("button, a, [role='button']").forEach(el => {
      const text = String(el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!euroBalanceText(text)) return;

      el.dataset.fehaWalletLauncher = "legacy";
      el.classList.add("feha-wallet-legacy-launcher");
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("tabindex", "-1");
      suppressed++;
    });

    // Fallback for non-semantic clickable shells: find an exact €$ leaf and climb
    // only until the first compact ancestor that still contains only that balance.
    [...root.querySelectorAll("*")].forEach(leaf => {
      if (leaf.children.length > 0 || !euroBalanceText(leaf.textContent)) return;

      let cursor = leaf.parentElement;
      for (let depth = 0; cursor && cursor !== root && depth < 4; depth++, cursor = cursor.parentElement) {
        const text = String(cursor.innerText ?? cursor.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!euroBalanceText(text)) break;

        const interactive =
          cursor.matches?.("button, a, [role='button']") ||
          typeof cursor.onclick === "function" ||
          cursor.hasAttribute?.("data-action");

        if (interactive || depth === 0) {
          cursor.dataset.fehaWalletLauncher = "legacy";
          cursor.classList.add("feha-wallet-legacy-launcher");
          cursor.setAttribute("aria-hidden", "true");
          cursor.setAttribute("tabindex", "-1");
          suppressed++;
          break;
        }
      }
    });

    // The legacy wallet click can spawn a giant raw textarea over the portrait.
    // Chrome Manager has no legitimate textarea UI, so remove only large visible
    // textareas inside this app; small/hidden controls elsewhere are untouched.
    root.querySelectorAll("textarea").forEach(area => {
      const rect = area.getBoundingClientRect?.();
      if (!rect) return;
      const style = getComputedStyle(area);
      const visible = style.display !== "none" && style.visibility !== "hidden";
      const legacySized = rect.width >= 240 && rect.height >= 120;
      if (!visible || !legacySized) return;

      area.dataset.fehaWalletEditor = "legacy";
      area.classList.add("feha-wallet-legacy-editor");
      area.remove();
      suppressed++;
    });

    return suppressed;
  }

  function installWalletGuard() {
    if (walletGuard) {
      document.removeEventListener("click", walletGuard, true);
      walletGuard = null;
    }

    walletGuard = event => {
      const root = document.getElementById("adk-chrome-manager-34");
      if (!root || !event.target?.closest) return;

      const target = event.target.closest(
        '[data-feha-wallet-launcher="legacy"], .feha-wallet-legacy-launcher, button, a, [role="button"]'
      );
      if (!target || !root.contains(target)) return;

      const text = String(target.innerText ?? target.textContent ?? "").replace(/\s+/g, " ").trim();
      if (
        target.matches?.('[data-feha-wallet-launcher="legacy"], .feha-wallet-legacy-launcher') ||
        euroBalanceText(text)
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        suppressLegacyWalletChrome(root);
      }
    };

    document.addEventListener("click", walletGuard, true);
  }

  function removeWalletGuard() {
    if (walletGuard) {
      document.removeEventListener("click", walletGuard, true);
      walletGuard = null;
    }

    document
      .querySelectorAll('[data-feha-wallet-launcher="legacy"], .feha-wallet-legacy-launcher')
      .forEach(el => {
        delete el.dataset.fehaWalletLauncher;
        el.classList.remove("feha-wallet-legacy-launcher");
        el.removeAttribute("aria-hidden");
        el.removeAttribute("tabindex");
      });
  }

  function clearLegacyWalletTags() {
    document.querySelectorAll('[data-feha-wallet-shell="legacy"], [data-feha-wallet-balance="1"]').forEach(el => {
      el.classList?.remove?.("feha-wallet-legacy-shell");
      delete el.dataset.fehaWalletShell;
      delete el.dataset.fehaWalletBalance;

      if (el.dataset.fehaWalletAssignedId === "1") {
        el.removeAttribute("id");
        delete el.dataset.fehaWalletAssignedId;
      }
    });
  }

  function textNorm(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function findCyberdeckRoots(scope = document.body) {
    if (!scope?.querySelectorAll) return [];

    const candidates = [
      ...scope.querySelectorAll(".application, .app, .window-app, [role='dialog']")
    ].filter(el => {
      const text = textNorm(el.innerText ?? el.textContent);
      return (
        /ADK\s*\/\/\s*CYBERDECK TERMINAL/i.test(text) &&
        /SOFTWARE LIBRARY/i.test(text)
      );
    });

    // Prefer the smallest matching application shell so parent wrappers do not
    // receive the Cyberdeck skin as well.
    return candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
  }

  function findLeafByText(root, matcher) {
    if (!root?.querySelectorAll) return null;
    for (const el of root.querySelectorAll("*")) {
      if (el.children.length > 0) continue;
      const text = textNorm(el.textContent);
      if (typeof matcher === "string" ? text === matcher : matcher.test(text)) return el;
    }
    return null;
  }

  function smallestTextShell(leaf, required, maxDepth = 7, maxLength = 1400) {
    if (!leaf) return null;
    let cursor = leaf.parentElement;
    let best = leaf.parentElement;

    for (let depth = 0; cursor && depth < maxDepth; depth++, cursor = cursor.parentElement) {
      const text = textNorm(cursor.innerText ?? cursor.textContent);
      const ok = required.every(rx => rx.test(text));
      if (!ok) continue;
      if (text.length <= maxLength) best = cursor;
      else break;
    }

    return best;
  }

  function tagCyberdeckPortrait(root) {
    const images = [...root.querySelectorAll("img")].filter(img => {
      const r = img.getBoundingClientRect?.();
      return r && r.width >= 110 && r.height >= 140;
    });
    if (!images.length) return;

    const img = images.sort((a,b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    })[0];

    img.classList.add("feha-cd-portrait-img");

    let cursor = img.parentElement;
    let chosen = cursor;
    for (let depth = 0; cursor && cursor !== root && depth < 6; depth++, cursor = cursor.parentElement) {
      const r = cursor.getBoundingClientRect?.();
      if (!r) continue;
      if (r.width >= 220 && r.width <= 520 && r.height >= 250 && r.height <= 620) {
        chosen = cursor;
      }
    }
    chosen?.classList?.add("feha-cd-portrait-card");
  }

  function markCyberdeck(root) {
    if (!root) return false;

    root.dataset.fehaCyberdeck = "1";
    root.classList.add("feha-cyberdeck");

    const kicker = findLeafByText(root, /NOCTURNE\s*\/\/\s*NETRUNNER SUITE/i);
    kicker?.classList.add("feha-cd-kicker");

    const title = findLeafByText(root, /ADK\s*\/\/\s*CYBERDECK TERMINAL/i);
    title?.classList.add("feha-cd-title");

    const deckEmpty = findLeafByText(root, /^NO CYBERDECK INSTALLED$/i);
    const deckShell = smallestTextShell(
      deckEmpty,
      [/NO CYBERDECK INSTALLED/i, /Install one through the Chrome Manager/i],
      7,
      700
    );
    deckShell?.classList.add("feha-cd-deck-panel");

    const loadedHead = findLeafByText(root, /^LOADED QUICKHACKS\s*—\s*\d+\/\d+$/i);
    loadedHead?.classList.add("feha-cd-loaded-title");
    const loadedShell = smallestTextShell(
      loadedHead,
      [/LOADED QUICKHACKS/i],
      6,
      2200
    );
    loadedShell?.classList.add("feha-cd-loaded-section");

    const softwareHead = findLeafByText(root, /^SOFTWARE LIBRARY$/i);
    softwareHead?.classList.add("feha-cd-section-title");
    const softwareShell = smallestTextShell(
      softwareHead,
      [/SOFTWARE LIBRARY/i, /Purchased Quickhacks stay here permanently/i],
      7,
      1200
    );
    softwareShell?.classList.add("feha-cd-library");

    const supportHead = findLeafByText(root, /^NETRUNNER SUPPORT CHROME$/i);
    supportHead?.classList.add("feha-cd-section-title");
    const supportShell = smallestTextShell(
      supportHead,
      [/NETRUNNER SUPPORT CHROME/i, /installed netrunning support chrome/i],
      7,
      1000
    );
    supportShell?.classList.add("feha-cd-support");

    findLeafByText(root, /^No software owned\.?$/i)
      ?.classList.add("feha-cd-empty-copy");
    findLeafByText(root, /^No installed netrunning support chrome\.?$/i)
      ?.classList.add("feha-cd-empty-copy");
    deckEmpty?.classList.add("feha-cd-empty-title");
    findLeafByText(root, /^Install one through the Chrome Manager\.?$/i)
      ?.classList.add("feha-cd-empty-copy");

    // Loaded quickhack slots are the repeated '+' controls. Tag them anywhere
    // inside the Cyberdeck root because the stable template's DOM wrapper for
    // the slot rack differs from the heading wrapper.
    root.querySelectorAll("button, [role='button'], .clickable, [data-action]").forEach(el => {
      const text = textNorm(el.innerText ?? el.textContent);
      if (text === "+") el.classList.add("feha-cd-quickhack-slot");
    });

    // Kill the legacy €$ launcher in Cyberdeck even when its visible text lives
    // inside nested spans/icons. Walk outward to the first compact control shell.
    [...root.querySelectorAll("*")].forEach(el => {
      const text = textNorm(el.innerText ?? el.textContent);
      if (!/^€\$\s*[-+]?\d[\d,.]*$/i.test(text)) return;

      let shell = el;
      for (let depth = 0, cur = el.parentElement; cur && cur !== root && depth < 6; depth++, cur = cur.parentElement) {
        const r = cur.getBoundingClientRect?.();
        const t = textNorm(cur.innerText ?? cur.textContent);
        const compact = r && r.width <= 180 && r.height <= 90;
        const controlish =
          cur.matches?.("button, a, [role='button'], .clickable, [data-action]") ||
          typeof cur.onclick === "function";

        if (compact && (controlish || /^€\$\s*[-+]?\d[\d,.]*$/i.test(t))) {
          shell = cur;
        } else if (!/^€\$\s*[-+]?\d[\d,.]*$/i.test(t)) {
          break;
        }
      }

      shell.classList.add("feha-cd-wallet");
      shell.dataset.fehaWalletLauncher = "legacy";
      shell.setAttribute?.("aria-hidden","true");
      shell.setAttribute?.("tabindex","-1");
    });

    root.querySelectorAll("select").forEach(el => el.classList.add("feha-cd-select"));
    root.querySelectorAll("button, [role='button']").forEach(el => {
      const text = textNorm(el.innerText ?? el.textContent);
      if (/^CHECK$/i.test(text)) el.classList.add("feha-cd-check");
      if (/^[×✕✖x]$/i.test(text)) el.classList.add("feha-cd-close");
    });

    tagCyberdeckPortrait(root);

    // The old wallet launcher is not part of the Cyberdeck design.
    suppressLegacyWalletChrome(root);

    return true;
  }

  function markCyberdecks(scope = document.body) {
    const roots = findCyberdeckRoots(scope);
    roots.forEach(markCyberdeck);
    return roots.length;
  }

  function inspectCyberdeckDOM() {
    const root = findCyberdeckRoots(document.body)[0];
    if (!root) {
      ui?.notifications?.warn?.("FEHA // Cyberdeck window not found");
      return null;
    }

    const rows = [...root.querySelectorAll("*")].map((el, index) => {
      const r = el.getBoundingClientRect?.();
      if (!r || r.width < 20 || r.height < 14) return null;
      const text = textNorm(el.innerText ?? el.textContent).slice(0, 140);
      if (!text && !["BUTTON","SELECT","IMG"].includes(el.tagName)) return null;

      return {
        index,
        tag: el.tagName,
        id: el.id || "",
        classes: [...el.classList].join("."),
        role: el.getAttribute?.("role") || "",
        action: el.getAttribute?.("data-action") || "",
        text,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height)
      };
    }).filter(Boolean);

    const snapshot = {
      build: BUILD,
      actor: textNorm(root.querySelector("select option:checked")?.textContent || ""),
      root: {
        tag: root.tagName,
        id: root.id || "",
        classes: [...root.classList].join(".")
      },
      rows
    };

    console.group("FEHA CYBERDECK DOM " + BUILD);
    console.table(rows);
    console.log(snapshot);
    console.groupEnd();

    globalThis.FEHA_CYBERDECK_DOM = snapshot;
    ui?.notifications?.info?.("FEHA // Cyberdeck DOM snapshot captured.");
    return snapshot;
  }

  function clearCyberdeckMarks() {
    document.querySelectorAll('[data-feha-cyberdeck="1"]').forEach(root => {
      delete root.dataset.fehaCyberdeck;
      root.classList.remove("feha-cyberdeck");
    });
    document.querySelectorAll(
      ".feha-cd-kicker,.feha-cd-title,.feha-cd-deck-panel,.feha-cd-library,.feha-cd-support," +
      ".feha-cd-section-title,.feha-cd-empty-copy,.feha-cd-empty-title,.feha-cd-select," +
      ".feha-cd-check,.feha-cd-close,.feha-cd-portrait-img,.feha-cd-portrait-card," +
      ".feha-cd-loaded-title,.feha-cd-loaded-section,.feha-cd-quickhack-slot,.feha-cd-wallet"
    ).forEach(el => {
      for (const cls of [...el.classList]) {
        if (cls.startsWith("feha-cd-")) el.classList.remove(cls);
      }
    });
  }

  /* ------------------------------------------------------------------------
     CYBERDECK V2 // full FEHA-owned replacement
     ------------------------------------------------------------------------ */

  const CYBERDECK_V2_ID = "feha-cyberdeck-v2";
  let cyberdeckOriginalOpen = null;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function itemData(item) {
    try {
      return item?.toObject?.() ?? item ?? {};
    } catch {
      return item ?? {};
    }
  }

  function deepNumber(source, names) {
    if (!source || typeof source !== "object") return null;
    const wanted = new Set(names.map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, "")));
    const seen = new Set();
    const queue = [{value: source, depth: 0}];

    while (queue.length) {
      const {value, depth} = queue.shift();
      if (!value || typeof value !== "object" || seen.has(value) || depth > 6) continue;
      seen.add(value);

      for (const [key, raw] of Object.entries(value)) {
        const clean = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (wanted.has(clean)) {
          const n = Number(raw?.value ?? raw);
          if (Number.isFinite(n)) return n;
        }
        if (raw && typeof raw === "object") queue.push({value: raw, depth: depth + 1});
      }
    }
    return null;
  }

  function deepString(source, names) {
    if (!source || typeof source !== "object") return null;
    const wanted = new Set(names.map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, "")));
    const seen = new Set();
    const queue = [{value: source, depth: 0}];

    while (queue.length) {
      const {value, depth} = queue.shift();
      if (!value || typeof value !== "object" || seen.has(value) || depth > 6) continue;
      seen.add(value);

      for (const [key, raw] of Object.entries(value)) {
        const clean = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (wanted.has(clean) && (typeof raw === "string" || typeof raw === "number")) {
          return String(raw);
        }
        if (raw && typeof raw === "object") queue.push({value: raw, depth: depth + 1});
      }
    }
    return null;
  }

  function fehaFlags(item) {
    return item?.flags?.fleshEnshrouded ?? item?.flags?.feha ?? {};
  }

  function installedChrome(item) {
    if (!item) return false;
    const f = fehaFlags(item);
    const isCyberware =
      String(f.sourceCategory ?? "") === "Cyberware" ||
      Boolean(f.cyberwareSlot);

    // This is the canonical legacy-module rule: cyberware is installed unless
    // the explicit installed flag is false.
    return isCyberware && f.installed !== false;
  }

  function isQuickhack(item) {
    if (!item) return false;
    const f = fehaFlags(item);
    const description = String(item?.system?.description?.value ?? "");
    const sourcePath = String(f.sourcePath ?? "");
    const category = String(f.sourceCategory ?? f.category ?? "").toLowerCase();
    return (
      category === "quickhacks" ||
      f.quickhack === true ||
      f.ownedQuickhack === true ||
      f.quickhackOwned === true ||
      /\/quickhacks\//i.test(sourcePath) ||
      /category\s*:?\s*quickhacks/i.test(description.replace(/<[^>]+>/g," "))
    );
  }

  function isOwnedQuickhack(item) {
    return isQuickhack(item);
  }

  function isCyberdeck(item) {
    if (!item || !installedChrome(item)) return false;
    const f = fehaFlags(item);
    const name = norm(item.name);

    return (
      f.cyberdeck === true ||
      f.isCyberdeck === true ||
      ["cyberdeck","paraline","netdriver","tetratronic","raven micro"]
        .some(term => name.includes(term))
    );
  }

  function itemDescription(item) {
    const raw =
      item?.system?.description?.value ??
      item?.system?.description ??
      item?.system?.chatFlavor ??
      "";
    const div = document.createElement("div");
    div.innerHTML = String(raw ?? "");
    return textNorm(div.textContent ?? "").slice(0, 220);
  }

  function isSupportChrome(item, deck) {
    if (!item || item === deck || !installedChrome(item) || isQuickhack(item) || isCyberdeck(item)) return false;

    const text = norm(
      [
        item.name,
        itemDescription(item),
        fehaFlags(item).cyberwareSlot
      ].filter(Boolean).join(" ")
    );

    return [
      "ram",
      "quickhack",
      "cyberdeck",
      "neural",
      "self ice",
      "memory",
      "cortex",
      "netrunner",
      "intrusion"
    ].some(term => text.includes(term));
  }

  function supportRamBonus(item) {
    const f = fehaFlags(item);
    const explicit = Number(f.ramBonus);
    if (Number.isFinite(explicit) && explicit) return explicit;

    const n = norm(item?.name);
    if (n.includes("ex disk")) return 2;
    if (n.includes("ram upgrade")) return 2;
    if (n.includes("neuro matrix")) return 1;
    return 0;
  }

  function quickhackLoaded(item) {
    return fehaFlags(item).loadedQuickhack === true;
  }

  function quickhackRamCost(item) {
    const f = fehaFlags(item);
    const explicit = Number(f.ramCost);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    const match = itemDescription(item).match(/\bRAM\s+(\d+)/i);
    return match ? Number(match[1]) : 2;
  }

  function quickhackDcForActor(actor) {
    const intMod = Number(actor?.system?.abilities?.int?.mod ?? 0);
    const prof = Number(
      actor?.system?.attributes?.prof ??
      actor?.system?.details?.prof ??
      2
    );
    return 8 + prof + intMod;
  }

  function getCyberdeckModel(actor) {
    if (!actor) return null;

    const items = [...(actor.items ?? [])];
    const deck = items.find(isCyberdeck) ?? null;

    // Canonical legacy Cyberdeck ownership model:
    // purchased Quickhacks live permanently on the actor and loading is a flag.
    const quickhacks = items
      .filter(isOwnedQuickhack)
      .sort((a,b) => String(a.name).localeCompare(String(b.name)));

    const loaded = quickhacks.filter(quickhackLoaded);
    const library = quickhacks.filter(item => !quickhackLoaded(item));
    const support = items.filter(item => isSupportChrome(item, deck));

    const deckFlags = fehaFlags(deck);
    const rating = Math.max(
      1,
      Math.min(5, Number(deckFlags.rating ?? deckFlags.tier ?? 2) || 2)
    );

    const explicitBase = Number(deckFlags.ramMax);
    const baseRam =
      Number.isFinite(explicitBase) && explicitBase > 0
        ? explicitBase
        : deck
          ? 4 + (2 * rating)
          : 0;

    const supportRam = support.reduce((sum,item) => sum + supportRamBonus(item),0);
    const maxRam = deck ? baseRam + supportRam : 0;

    const storedRam = actor?.flags?.fleshEnshrouded?.ramCurrent;
    const currentRam =
      !deck
        ? 0
        : storedRam === undefined || storedRam === null
          ? maxRam
          : Math.max(0, Math.min(maxRam, Number(storedRam) || 0));

    const explicitSlots = Number(deckFlags.quickhackSlots);
    const softwareSlots =
      deck
        ? Number.isFinite(explicitSlots) && explicitSlots > 0
          ? explicitSlots
          : 2 + rating
        : 0;

    const manufacturer =
      deckFlags.manufacturer ??
      deckFlags.company ??
      "UNKNOWN";

    const mk =
      deckFlags.mk ??
      deckFlags.rating ??
      deckFlags.tier ??
      "";

    return {
      actor,
      deck,
      loaded,
      library,
      support,
      baseRam,
      supportRam,
      maxRam,
      currentRam,
      softwareSlots,
      quickhackDc: quickhackDcForActor(actor),
      manufacturer: String(manufacturer ?? "UNKNOWN").replace(/^-+/, ""),
      mk: String(mk ?? "")
    };
  }

  function applyCyberdeckPrivateAssets(root) {
    if (!root) return false;
    const ui = readPrivateAssets()?.ui ?? {};
    const map = {
      "--cd2-cp-frame": "ffe5273fdf_frame_bg",
      "--cd2-cp-hud": "6691702ad7_hud_patch_frame",
      "--cd2-cp-highlight": "2ae8c588ae_fluff_highlight",
      "--cd2-cp-lines": "ef56f53fa5_fluff_lines",
      "--cd2-cp-crossline": "d4e7518fde_crossLine",
      "--cd2-cp-outerline": "9674e9d0b8_outerLine",
      "--cd2-cp-button": "5c8f822dbf_gog_button_holder",
      "--cd2-cp-button-2": "ac81a43116_gog_button_holder_02",
      "--cd2-cp-reward": "a13706adc6_gog_frame_reward",
      "--cd2-cp-buffer-empty": "697dae4bde_buffer_empty",
      "--cd2-cp-buffer-active": "4416a73d89_buffer_activated",
      "--cd2-cp-barcode1": "7c16fcece5_fluff_barcode1",
      "--cd2-cp-barcode3": "2bead2d3f6_fluff_barcode3",
      "--cd2-cp-barcode4": "88ab2fcdee_fluff_barcode4",
      "--cd2-cp-code1": "1a0c3eb3ee_fluff_code1",
      "--cd2-cp-glow": "59feb7cd32_frame_glow",
      "--cd2-cp-glow-small": "8cd8de72f8_frame_glow_small"
    };

    let applied = 0;
    for (const [cssName,key] of Object.entries(map)) {
      const url = ui[key];
      if (url) {
        root.style.setProperty(cssName, 'url("'+url+'")');
        applied++;
      } else {
        root.style.removeProperty(cssName);
      }
    }

    if (applied) root.dataset.cpAssets = "1";
    else delete root.dataset.cpAssets;
    return applied > 0;
  }

  function cyberActors() {
    const allowed = new Map(
      FEHA_PLAYABLE_ROSTER.map((key,index) => [key,index])
    );

    return [...(game?.actors ?? [])]
      .filter(actor => {
        const key = playableActorKey(actor);
        return allowed.has(key) && (game.user?.isGM || actor.isOwner);
      })
      .sort(
        (a,b) =>
          (allowed.get(playableActorKey(a)) ?? 99) -
          (allowed.get(playableActorKey(b)) ?? 99)
      );
  }

  function cyberActorById(id) {
    return game?.actors?.get?.(id) ?? null;
  }

  function cyberPortrait(actor) {
    const override = FEHA_PORTRAIT_OVERRIDES?.[norm(actor?.name)];
    return override || actor?.img || "icons/svg/mystery-man.svg";
  }

  function cyberPct(value, max) {
    const v = Number(value);
    const m = Number(max);
    if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return null;
    return Math.max(0, Math.min(100, (v / m) * 100));
  }

  function segmentBar(value, max, segments = 20, cls = "") {
    const pct = cyberPct(value, max);
    const filled = pct == null ? 0 : Math.round((pct / 100) * segments);
    return `<div class="cd2-segments ${cls}" aria-hidden="true">${Array.from(
      {length: segments},
      (_,i) => `<i class="${i < filled ? "is-filled" : ""}"></i>`
    ).join("")}</div>`;
  }

  function quickhackCard(item, loaded = false) {
    if (!item) return "";
    const f = fehaFlags(item);
    const ram = quickhackRamCost(item);
    const dc =
      deepNumber(itemData(item), ["dc","quickhackDc","hackDc"]) ??
      null;
    const action = loaded ? "EJECT" : "LOAD";
    return `
      <article class="cd2-hack-card" data-item-id="${esc(item.id)}">
        <div class="cd2-hack-code">QH.${esc(String(item.id ?? "").slice(-4).toUpperCase())}</div>
        <img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt="">
        <div class="cd2-hack-copy">
          <b>${esc(item.name)}</b>
          <span>${ram == null ? "RAM —" : "RAM " + ram}${dc == null ? "" : " // DC " + dc}</span>
          <small>${esc(itemDescription(item) || "Quickhack software package.")}</small>
        </div>
        <button type="button" data-cd-action="${loaded ? "unload" : "load"}" data-item-id="${esc(item.id)}">${action}</button>

      </article>
    `;
  }

  function loadedSlots(model) {
    if (!model.deck) {
      return `
        <div class="cd2-no-deck">
          <div class="cd2-no-deck-reticle"><i></i><i></i><span>×</span></div>
          <small>HARDWARE LINK // UNRESOLVED</small>
          <b>NO CYBERDECK INSTALLED</b>
          <span>Install an Operating System / Cyberdeck through Chrome Manager.</span>
          <em>RAM OFFLINE // SOFTWARE BUS LOCKED</em>
        </div>
      `;
    }

    const capacity = Math.max(model.softwareSlots || model.loaded.length || 1, model.loaded.length);
    const cards = [];
    for (let i = 0; i < capacity; i++) {
      const item = model.loaded[i];
      if (item) {
        cards.push(quickhackCard(item, true));
      } else {
        cards.push(`
          <div class="cd2-empty-slot" data-slot="${i + 1}">
            <em>SLOT ${String(i + 1).padStart(2, "0")}</em>
            <span>+</span>
            <b>EMPTY SLOT</b>
            <small>ASSIGN FROM SOFTWARE LIBRARY</small>
          </div>
        `);
      }
    }
    return cards.join("");
  }

  function supportCards(model) {
    if (!model.support.length) {
      return `<div class="cd2-empty-message">NO SUPPORT CHROME DETECTED</div>`;
    }
    return model.support.map(item => `
      <article class="cd2-support-card">
        <img src="${esc(item.img || "icons/svg/item-bag.svg")}" alt="">
        <div>
          <b>${esc(item.name)}</b>
          <span>${esc(fehaFlags(item).mk ?? "")}</span>
          <small>${esc(itemDescription(item) || "Netrunner support hardware.")}</small>
        </div>
      </article>
    `).join("");
  }

  function combatNetworkModel(actor) {
    const combat = game?.combat ?? null;
    if (!combat) return {combat:null, active:false, nodes:[], targetName:null, round:null, turn:null};

    const targetedIds = new Set(
      [...(game.user?.targets ?? [])].map(t => t?.id ?? t?.document?.id).filter(Boolean)
    );
    const combatants = [...(combat.combatants ?? [])].filter(c => c && (c.tokenId || c.token?.id));
    const count = combatants.length;

    const nodes = combatants.map((combatant,index) => {
      const tokenId = combatant.tokenId ?? combatant.token?.id ?? "";
      const tokenDoc = combatant.token ?? null;
      const tokenObj = globalThis.canvas?.tokens?.get?.(tokenId) ?? null;
      const actorDoc = combatant.actor ?? tokenObj?.actor ?? null;
      const disposition = Number(tokenDoc?.disposition ?? tokenObj?.document?.disposition ?? 0);
      const outer = index >= 8;
      const ringIndex = outer ? index - 8 : index;
      const ringCount = outer ? Math.max(1,count - 8) : Math.min(count,8);
      const angle = (-Math.PI/2) + ((Math.PI*2*ringIndex)/Math.max(1,ringCount)) + (outer ? Math.PI/Math.max(4,ringCount) : 0);
      const radiusX = outer ? 43 : 34;
      const radiusY = outer ? 39 : 31;
      const x = 50 + Math.cos(angle) * radiusX;
      const y = 50 + Math.sin(angle) * radiusY;
      const relation = disposition < 0 ? "hostile" : disposition > 0 ? "friendly" : "neutral";
      return {
        id: combatant.id,
        tokenId,
        sceneId: tokenDoc?.parent?.id ?? combat.scene?.id ?? combat.sceneId ?? "",
        actorId: actorDoc?.id ?? "",
        name: combatant.name ?? actorDoc?.name ?? tokenDoc?.name ?? "UNKNOWN",
        img: tokenDoc?.texture?.src ?? tokenObj?.document?.texture?.src ?? actorDoc?.img ?? "icons/svg/mystery-man.svg",
        initiative: Number.isFinite(Number(combatant.initiative)) ? Number(combatant.initiative) : null,
        defeated: combatant.defeated === true,
        relation,
        self: actorDoc?.id === actor?.id,
        targeted: targetedIds.has(tokenId),
        x, y
      };
    });

    const targeted = nodes.find(n => n.targeted) ?? null;
    return {
      combat, active:true, nodes,
      targetName: targeted?.name ?? null,
      targetId: targeted?.tokenId ?? null,
      round: combat.round ?? null,
      turn: combat.turn ?? null
    };
  }

  function combatNetworkMarkup(actor) {
    const network = combatNetworkModel(actor);
    if (!network.active || !network.nodes.length) {
      return [
        '<div class="cd2-network-grid is-idle">',
        '<div class="cd2-network-idle-core">',
        '<div class="cd2-network-idle-reticle"><span>×</span></div>',
        '<small>ENCOUNTER BUS // IDLE</small>',
        '<b>NO ACTIVE COMBAT NODES</b>',
        '<span>Start a Foundry combat encounter to populate the neural topology.</span>',
        '</div></div>'
      ].join("");
    }

    const lines = network.nodes.map(node => {
      const x2 = (node.x * 10).toFixed(2);
      const y2 = (node.y * 6).toFixed(2);
      const cls = ["cd2-net-line","is-"+node.relation,node.targeted?"is-targeted":"",node.defeated?"is-defeated":""].filter(Boolean).join(" ");
      return '<line class="'+cls+'" x1="500" y1="300" x2="'+x2+'" y2="'+y2+'" />';
    }).join("");

    const nodes = network.nodes.map((node,index) => {
      const cls = ["cd2-combat-node","is-"+node.relation,node.targeted?"is-targeted":"",node.self?"is-self":"",node.defeated?"is-defeated":""].filter(Boolean).join(" ");
      const init = node.initiative == null ? "" : " // INIT " + esc(node.initiative);
      return [
        '<button type="button" class="'+cls+'" style="--node-x:'+node.x.toFixed(2)+'%;--node-y:'+node.y.toFixed(2)+'%" data-cd-action="target-combatant" data-combatant-id="'+esc(node.id)+'" data-token-id="'+esc(node.tokenId)+'" data-scene-id="'+esc(node.sceneId)+'" title="Target '+esc(node.name)+'">',
        '<span class="cd2-node-index">'+String(index+1).padStart(2,"0")+'</span>',
        '<img src="'+esc(node.img)+'" alt="">',
        '<span class="cd2-node-copy"><b>'+esc(node.name)+'</b><small>'+(node.self?"SELF":node.relation.toUpperCase())+init+'</small></span>',
        '<i>'+(node.targeted?"LOCKED":"TARGET")+'</i>',
        '</button>'
      ].join("");
    }).join("");

    const status = network.targetName ? "TARGET LOCK // " + esc(network.targetName.toUpperCase()) : "SELECT ANY COMBAT NODE";
    const operatorImg = cyberPortrait(actor);
    return [
      '<div class="cd2-network-grid is-live">',
      '<svg class="cd2-net-links" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">',
      '<defs><filter id="cd2-net-glow"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>',
      lines,
      '</svg>',
      '<div class="cd2-net-operator"><div class="cd2-net-operator-ring"></div><img src="'+esc(operatorImg)+'" alt=""><div><small>OPERATOR</small><b>'+esc(actor.name)+'</b></div></div>',
      nodes,
      '<div class="cd2-network-hud">',
      '<div><span>ENCOUNTER</span><b>'+network.nodes.length+' NODES</b></div>',
      '<div><span>ROUND</span><b>'+(network.round ?? "—")+'</b></div>',
      '<div><span>TURN</span><b>'+(network.turn == null ? "—" : Number(network.turn)+1)+'</b></div>',
      '<div class="cd2-network-lock '+(network.targetName?"has-lock":"")+'"><span>LOCK</span><b>'+status+'</b></div>',
      '</div></div>'
    ].join("");
  }

  function installCyberdeckCombatHooks() {
    if (cyberdeckCombatHooks.length || !globalThis.Hooks?.on) return;
    const refresh = () => {
      const root = document.getElementById(CYBERDECK_V2_ID);
      if (!root || root.dataset.tab !== "network") return;
      const actorId = root.dataset.actorId;
      setTimeout(() => {
        if (!lifecycleActive || globalThis.FEHA_CYBERDECK_V3_ACTIVE === true) return;
        const live = document.getElementById(CYBERDECK_V2_ID);
        if (live?.dataset.tab === "network" && live?.dataset?.fehaV3 !== "1") {
          renderCyberdeckV2(actorId,"network");
        }
      },40);
    };
    for (const event of ["updateCombat","createCombat","deleteCombat","createCombatant","updateCombatant","deleteCombatant","targetToken"]) {
      cyberdeckCombatHooks.push([event,Hooks.on(event,refresh)]);
    }
  }

  function removeCyberdeckCombatHooks() {
    if (!globalThis.Hooks?.off) { cyberdeckCombatHooks = []; return; }
    for (const [event,id] of cyberdeckCombatHooks) { try { Hooks.off(event,id); } catch {} }
    cyberdeckCombatHooks = [];
  }

  function renderCyberdeckV2(actorId = null, tab = "quickhacks") {
    const actors = cyberActors();
    const saved = localStorage.getItem("fehaCyberdeckActorV2");
    const requested = cyberActorById(actorId);
    const savedActor = cyberActorById(saved);
    const chromeActor = globalThis.ADKChromeBackend?.getActor?.();
    const userActor = game.user?.character;
    const rosterIds = new Set(actors.map(a => a.id));

    const fallback =
      (requested && rosterIds.has(requested.id) ? requested : null) ??
      (savedActor && rosterIds.has(savedActor.id) ? savedActor : null) ??
      (chromeActor && rosterIds.has(chromeActor.id) ? chromeActor : null) ??
      (userActor && rosterIds.has(userActor.id) ? userActor : null) ??
      actors[0] ??
      null;

    if (!fallback) {
      ui?.notifications?.warn?.("FEHA // No accessible actors for Cyberdeck.");
      return null;
    }

    localStorage.setItem("fehaCyberdeckActorV2", fallback.id);

    const model = getCyberdeckModel(fallback);
    let root = document.getElementById(CYBERDECK_V2_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = CYBERDECK_V2_ID;
      document.body.appendChild(root);
    }

    const ramMax = Math.max(1, model.maxRam || model.currentRam || 1);
    const ramText = model.deck ? `${model.currentRam} / ${ramMax}` : "OFFLINE";

    root.dataset.actorId = fallback.id;
    root.dataset.actor = norm(
      fallback?.flags?.fleshEnshrouded?.adkCharacter ?? fallback.name
    );
    root.dataset.tab = tab;
    applyCyberdeckPrivateAssets(root);

    root.innerHTML = `
      <div class="cd2-scanlines"></div>

      <header class="cd2-header">
        <div class="cd2-brand">
          <small>NOCTURNE // NETRUNNER OPERATING ENVIRONMENT</small>
          <h1>CYBERDECK <span>OS</span></h1>
          <div class="cd2-build">FEHA / ADK // ${esc(BUILD)}</div>
        </div>

        <div class="cd2-header-status">
          <div><span>LINK</span><b>${model.deck ? "STANDBY" : "OFFLINE"}</b></div>
          <div><span>DECK</span><b>${model.deck ? "ONLINE" : "NONE"}</b></div>
          <div><span>SOFTWARE</span><b>${model.loaded.length}/${model.softwareSlots || 0}</b></div>
        </div>

        <div class="cd2-header-actions">
          <select id="cd2-actor">
            ${actors.map(actor => `<option value="${esc(actor.id)}" ${actor.id === fallback.id ? "selected" : ""}>${esc(playableDisplayName(actor))}</option>`).join("")}
          </select>
          <button type="button" class="cd2-close" data-cd-action="close">×</button>
        </div>
      </header>

      <aside class="cd2-operator">
        <div class="cd2-portrait">
          <img src="${esc(cyberPortrait(fallback))}" alt="${esc(fallback.name)}">
          <div class="cd2-portrait-grid"></div>
          <div class="cd2-operator-tag">OPERATOR // ${esc(playableDisplayName(fallback).toUpperCase())}</div>
        </div>

        <div class="cd2-operator-meta">
          <div><span>SUBJECT</span><b>${esc(playableDisplayName(fallback))}</b></div>
          <div><span>NODE</span><b>${esc(String(fallback.id).slice(-6).toUpperCase())}</b></div>
          <div><span>PROFILE</span><b>NETRUNNER</b></div>
        </div>

        <div class="cd2-deck-summary ${model.deck ? "" : "is-offline"}">
          <small>INSTALLED CYBERDECK</small>
          ${model.deck ? `
            <div class="cd2-deck-head">
              <img src="${esc(model.deck.img || "icons/svg/cog.svg")}" alt="">
              <div>
                <h2>${esc(model.deck.name)}</h2>
                <span>${esc(model.manufacturer)}${model.mk ? " // MK." + esc(model.mk) : ""}</span>
              </div>
            </div>
            <div class="cd2-deck-specs">
              <div><span>RAM</span><b>${esc(model.maxRam)}</b></div>
              <div><span>SLOTS</span><b>${esc(model.softwareSlots)}</b></div>
              <div><span>QH DC</span><b>${model.quickhackDc ?? "—"}</b></div>
            </div>
          ` : `
            <div class="cd2-offline-copy">NO HARDWARE LINK<br><span>INSTALL THROUGH CHROME MANAGER</span></div>
          `}
        </div>
      </aside>

      <main class="cd2-main">
        <section class="cd2-telemetry">
          <div class="cd2-meter cd2-meter-ram">
            <div class="cd2-meter-head"><span>RAM // ACTIVE MEMORY</span><b>${ramText}</b></div>
            <div class="cd2-ram-number">${model.deck ? `${model.currentRam}<small>/ ${ramMax}</small>` : "OFFLINE"}</div>
            ${segmentBar(model.currentRam, ramMax, 24, "is-ram")}
          </div>

          <div class="cd2-telemetry-card cd2-telemetry-deck ${model.deck ? "" : "is-offline"}">
            <div class="cd2-meter-head"><span>DECK // HARDWARE LINK</span><b>${model.deck ? "ONLINE" : "OFFLINE"}</b></div>
            <div class="cd2-telemetry-core">
              ${model.deck ? `
                <img src="${esc(model.deck.img || "icons/svg/cog.svg")}" alt="">
                <div>
                  <strong>${esc(model.deck.name)}</strong>
                  <small>${esc(model.manufacturer)}${model.mk ? " // MK." + esc(model.mk) : ""}</small>
                </div>
              ` : `
                <div class="cd2-telemetry-offline">NO DECK</div>
              `}
            </div>
          </div>

          <div class="cd2-telemetry-card cd2-telemetry-software">
            <div class="cd2-meter-head"><span>SOFTWARE // LOAD MATRIX</span><b>${model.loaded.length} / ${model.softwareSlots || 0}</b></div>
            <div class="cd2-software-number">
              <strong>${model.loaded.length}</strong>
              <span>LOADED</span>
              <i></i>
              <strong>${model.library.length}</strong>
              <span>LIBRARY</span>
            </div>
            ${segmentBar(model.loaded.length, Math.max(1,model.softwareSlots || 1), 12, "is-software")}
          </div>
        </section>

        <nav class="cd2-tabs">
          ${[
            ["quickhacks","QUICKHACKS"],
            ["network","NETWORK"],
            ["memory","MEMORY"],
            ["diagnostics","DIAGNOSTICS"]
          ].map(([id,label]) => `<button type="button" data-cd-action="tab" data-tab="${id}" class="${tab === id ? "is-active" : ""}">${label}</button>`).join("")}
        </nav>

        <section class="cd2-tabbody">
          <div class="cd2-view ${tab === "quickhacks" ? "is-active" : ""}" data-view="quickhacks">
            <div class="cd2-section-head">
              <div><small>EXECUTION ARRAY</small><h3>LOADED QUICKHACKS</h3></div>
              <span>${model.loaded.length} / ${model.softwareSlots || 0} SLOTS</span>
            </div>
            <div class="cd2-loaded-grid">${loadedSlots(model)}</div>
          </div>

          <div class="cd2-view ${tab === "network" ? "is-active" : ""}" data-view="network">
            <div class="cd2-section-head cd2-network-head">
              <div><small>LIVE ENCOUNTER BUS</small><h3>TARGET ACQUISITION</h3></div>
              <span>${game.combat ? `${[...(game.combat.combatants ?? [])].length} COMBAT NODES` : "NO ACTIVE COMBAT"}</span>
            </div>
            ${combatNetworkMarkup(fallback)}
          </div>

          <div class="cd2-view ${tab === "memory" ? "is-active" : ""}" data-view="memory">
            <div class="cd2-section-head">
              <div><small>PERSISTENT STORAGE</small><h3>SOFTWARE LIBRARY</h3></div>
              <span>${model.library.length} PACKAGES</span>
            </div>
            <div class="cd2-library-list">
              ${model.library.length ? model.library.map(item => quickhackCard(item, false)).join("") : `<div class="cd2-empty-message">NO UNLOADED QUICKHACK SOFTWARE</div>`}
            </div>
          </div>

          <div class="cd2-view ${tab === "diagnostics" ? "is-active" : ""}" data-view="diagnostics">
            <div class="cd2-section-head">
              <div><small>LOCAL HARDWARE BUS</small><h3>DIAGNOSTICS</h3></div>
              <span>READ ONLY</span>
            </div>
            <div class="cd2-diagnostics-grid">
              <div><span>CYBERDECK</span><b>${model.deck ? esc(model.deck.name) : "NOT INSTALLED"}</b></div>
              <div><span>MANUFACTURER</span><b>${model.deck ? esc(model.manufacturer) : "—"}</b></div>
              <div><span>SOFTWARE BUS</span><b>${model.deck ? model.softwareSlots + " SLOTS" : "OFFLINE"}</b></div>
              <div><span>QUICKHACK DC</span><b>${model.quickhackDc ?? "—"}</b></div>
            </div>
            <div class="cd2-support-list">
              <div class="cd2-subhead">NETRUNNER SUPPORT CHROME</div>
              ${supportCards(model)}
            </div>
          </div>
        </section>

        <footer class="cd2-footer">
          <div class="cd2-log">
            <span>SYS&gt;</span>
            <b>${model.deck ? "CYBERDECK READY // AWAITING COMMAND" : "CYBERDECK OFFLINE // HARDWARE REQUIRED"}</b>
          </div>
          <button type="button" class="cd2-rest" data-cd-action="rest" ${model.deck ? "" : "disabled"}>SHORT REST // RECOVER RAM</button>
          <button type="button" class="cd2-jack" data-cd-action="jack" ${model.deck ? "" : "disabled"}>
            <span>LINK PROTOCOL</span>
            <b>JACK IN</b>
          </button>
        </footer>
      </main>

      <aside class="cd2-right">
        <section class="cd2-bus-panel">
          <div class="cd2-subhead">SOFTWARE BUS</div>
          <div class="cd2-bus-hero">
            ${model.deck ? `<img src="${esc(model.deck.img || "icons/svg/cog.svg")}" alt="">` : `<div class="cd2-bus-offline">×</div>`}
            <div>
              <b>${model.deck ? esc(model.deck.name) : "NO CYBERDECK"}</b>
              <span>${model.deck ? esc(model.manufacturer) : "HARDWARE OFFLINE"}</span>
            </div>
          </div>
          <div class="cd2-right-stat"><span>LOADED</span><b>${model.loaded.length}</b></div>
          <div class="cd2-right-stat"><span>LIBRARY</span><b>${model.library.length}</b></div>
          <div class="cd2-right-stat"><span>CAPACITY</span><b>${model.softwareSlots || "—"}</b></div>
          <div class="cd2-right-stat"><span>QH DC</span><b>${model.deck ? (model.quickhackDc ?? "—") : "—"}</b></div>
        </section>

        <section>
          <div class="cd2-subhead">SUPPORT CHROME</div>
          <div class="cd2-mini-support">${supportCards(model)}</div>
        </section>


        <section class="cd2-session">
          <div class="cd2-subhead">SESSION</div>
          <p>RAM recovers on <b>Short Rest</b>. Quickhacks are persistent software and loaded into the installed deck's software slots.</p>
        </section>
      </aside>
    `;

    bindCyberdeckV2(root, model);
    return root;
  }

  async function setQuickhackPrepared(actor, itemId, prepared) {
    const item = actor?.items?.get?.(itemId) ?? actor?.items?.find?.(x => x.id === itemId);
    if (!item || !isOwnedQuickhack(item)) return false;

    if (prepared) {
      const model = getCyberdeckModel(actor);
      if (!model?.deck) {
        ui?.notifications?.warn?.("Install a Cyberdeck first.");
        return false;
      }
      if (
        !quickhackLoaded(item) &&
        model.loaded.length >= model.softwareSlots
      ) {
        ui?.notifications?.warn?.("Cyberdeck software slots are full.");
        return false;
      }
    }

    await item.update({
      "flags.fleshEnshrouded.loadedQuickhack": Boolean(prepared)
    });
    return true;
  }


  async function exportFehaHandoff() {
if (!game.user?.isGM) {
    return ui.notifications.error("FEHA HANDOFF EXPORTER is GM only.");
  }

  const ACTORS = ["Ponyboy", "Derke", "Sasha", "Zach"];
  const norm = v => String(v ?? "").trim().toLowerCase();

  function parseJson(value) {
    try { return JSON.parse(value); }
    catch { return null; }
  }

  function folderPath(folder) {
    const parts = [];
    let cur = folder;
    let guard = 0;
    while (cur && guard++ < 30) {
      parts.unshift(cur.name);
      cur = cur.folder ?? cur.parent ?? null;
    }
    return parts.join("/");
  }

  function save(filename, text) {
    if (typeof saveDataToFile === "function") {
      saveDataToFile(text, "application/json", filename);
      return;
    }

    const blob = new Blob([text], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function findModule() {
    const mods = [...game.modules.values()];
    const matches = mods.filter(m =>
      /\b(adk|feha)\b|flesh.*enshrouded|heart.*ablaze/i.test(
        [m.id, m.title, m.description].filter(Boolean).join(" ")
      )
    );

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return matches.find(m => m.active) ?? matches[0];
    }

    return mods.find(m => m.active && /cyber|adk/i.test(m.title ?? "")) ?? null;
  }

  async function fetchText(path) {
    try {
      const res = await fetch(path, {cache:"no-store"});
      if (!res.ok) return {ok:false, status:res.status, path};
      return {ok:true, path, text:await res.text()};
    } catch (err) {
      return {ok:false, path, error:String(err?.message ?? err)};
    }
  }

  const mod = findModule();
  const moduleSource = {
    selectedModule: mod ? {
      id: mod.id,
      title: mod.title,
      version: mod.version,
      active: mod.active,
      manifest: mod.manifest,
      scripts: [...(mod.scripts ?? [])],
      esmodules: [...(mod.esmodules ?? [])],
      styles: [...(mod.styles ?? [])],
      languages: [...(mod.languages ?? [])],
      packs: [...(mod.packs ?? [])]
    } : null,
    files: {}
  };

  if (mod) {
    const base = `/modules/${mod.id}/`;
    const files = new Set(["module.json"]);

    for (const p of mod.scripts ?? []) files.add(String(p));
    for (const p of mod.esmodules ?? []) files.add(String(p));
    for (const p of mod.styles ?? []) files.add(String(p));
    for (const lang of mod.languages ?? []) {
      if (lang?.path) files.add(String(lang.path));
    }

    for (const file of files) {
      moduleSource.files[file] = await fetchText(base + file);
    }
  }

  const actors = {};
  for (const name of ACTORS) {
    const actor = game.actors.find(a => norm(a.name) === norm(name));
    actors[name] = actor ? {
      id: actor.id,
      uuid: actor.uuid,
      folder: actor.folder ? folderPath(actor.folder) : "",
      data: actor.toObject()
    } : null;
  }

  const worldItems = game.items.contents.map(item => ({
    id: item.id,
    uuid: item.uuid,
    name: item.name,
    type: item.type,
    folder: item.folder ? folderPath(item.folder) : "",
    data: item.toObject()
  }));

  const folders = game.folders.contents.map(folder => ({
    id: folder.id,
    name: folder.name,
    type: folder.type,
    parentId: folder.folder?.id ?? null,
    path: folderPath(folder),
    data: folder.toObject()
  }));

  const privateAssets = {
    fehaCP2077PrivateAssetsV1:
      parseJson(localStorage.getItem("fehaCP2077PrivateAssetsV1") || "null"),
    fehaCP2077LocalSfxV1:
      parseJson(localStorage.getItem("fehaCP2077LocalSfxV1") || "null"),
    runtimeAssets:
      globalThis.FEHA_CP2077_ASSETS
        ? JSON.parse(JSON.stringify(globalThis.FEHA_CP2077_ASSETS))
        : null
  };

  const runtime = {};
  for (const name of [
    "ADKWallet",
    "ADKCore",
    "ADKChromeBackend",
    "ADKChromeNative",
    "ADKTheme",
    "ADKDevPatch"
  ]) {
    const value = globalThis[name];
    runtime[name] = value
      ? Object.getOwnPropertyNames(value).filter(k => k !== "constructor")
      : null;
  }

  const payload = {
    exportType: "FEHA_ADK_HANDOFF",
    exporterVersion: "1.0",
    generatedAt: new Date().toISOString(),
    environment: {
      foundryVersion: game.version,
      systemId: game.system?.id,
      systemVersion: game.system?.version,
      worldId: game.world?.id,
      worldTitle: game.world?.title
    },
    moduleSource,
    privateAssets,
    actors,
    worldItems,
    folders,
    runtime,
    note:
      "No passwords, API keys, Forge credentials, GitHub tokens, OAuth secrets, cookies, or auth headers are intentionally collected."
  };

  const filename =
    "FEHA_ADK_HANDOFF_" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".json";

  save(filename, JSON.stringify(payload, null, 2));
  console.log("FEHA HANDOFF EXPORT", payload);
  ui.notifications.info("FEHA HANDOFF EXPORTER // downloaded " + filename);
  }

  async function exportFehaModuleSource() {
if (!game.user?.isGM) {
    return ui.notifications.error("FEHA MODULE SOURCE EXPORTER is GM only.");
  }

  const MAX_FILES = 800;
  const MAX_CHARS_PER_FILE = 5_000_000;

  function save(filename, text) {
    if (typeof saveDataToFile === "function") {
      saveDataToFile(text, "application/json", filename);
      return;
    }
    const blob = new Blob([text], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function candidateModules() {
    const all = [...game.modules.values()];
    const matches = all.filter(m =>
      /\b(adk|feha)\b|flesh.*enshrouded|heart.*ablaze/i.test(
        [m.id, m.title, m.description].filter(Boolean).join(" ")
      )
    );
    return matches.length ? matches : all.filter(m => m.active);
  }

  function chooseModule() {
    const list = candidateModules();
    if (!list.length) return null;
    if (list.length === 1) return list[0];

    const suggested =
      list.find(m => m.id === "flesh-enshrouded-heart-ablaze") ??
      list.find(m =>
        /flesh.*enshrouded|heart.*ablaze/i.test(`${m.id} ${m.title}`) &&
        !/gateway/i.test(`${m.id} ${m.title}`)
      ) ??
      list.find(m =>
        /\b(adk|feha)\b/i.test(`${m.id} ${m.title}`) &&
        !/gateway/i.test(`${m.id} ${m.title}`)
      ) ??
      list.find(m => m.active && !/gateway/i.test(`${m.id} ${m.title}`)) ??
      list[0];

    const menu = list
      .map((m, i) => `${i + 1}. ${m.title} [${m.id}] ${m.active ? "(active)" : ""}`)
      .join("\n");

    const input = window.prompt(
      "FEHA MODULE SOURCE EXPORTER\n\nChoose the installed ADK/FEHA module.\n\n" +
      menu +
      "\n\nEnter module ID or list number:",
      suggested.id
    );

    if (!input) return null;
    const raw = input.trim();

    const byId = list.find(m => m.id === raw) ?? game.modules.get(raw);
    if (byId) return byId;

    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= list.length) {
      return list[n - 1];
    }
    return null;
  }

  const TEXT_EXT = /\.(?:js|mjs|cjs|css|hbs|html|htm|json|txt|md)$/i;
  const BINARY_EXT = /\.(?:png|webp|jpe?g|gif|svg|wav|ogg|mp3|flac|woff2?|ttf|otf)(?:[?#].*)?$/i;

  function stripQuery(value) {
    return String(value ?? "").trim().replace(/[?#].*$/, "");
  }

  function normalizeModuleEntry(moduleId, entry) {
    let raw =
      typeof entry === "string"
        ? entry
        : entry?.src ?? entry?.path ?? entry?.url ?? "";

    raw = stripQuery(raw);
    if (!raw) return "";

    const prefix = `/modules/${moduleId}/`;
    const prefixNoSlash = `modules/${moduleId}/`;

    if (raw.startsWith(prefix)) raw = raw.slice(prefix.length);
    else if (raw.startsWith(prefixNoSlash)) raw = raw.slice(prefixNoSlash.length);

    try { raw = decodeURIComponent(raw); } catch {}
    return raw.replace(/^\/+/, "");
  }

  function resolvePath(moduleId, currentPath, ref) {
    ref = stripQuery(ref);
    if (!ref) return null;
    if (/^(?:https?:|data:|blob:|#)/i.test(ref)) return null;

    const prefix = `/modules/${moduleId}/`;
    const prefixNoSlash = `modules/${moduleId}/`;

    let path = null;

    if (ref.startsWith(prefix)) {
      path = ref.slice(prefix.length);
    } else if (ref.startsWith(prefixNoSlash)) {
      path = ref.slice(prefixNoSlash.length);
    } else if (ref.startsWith("./") || ref.startsWith("../")) {
      const base = new URL(prefix + currentPath, location.origin);
      const resolved = new URL(ref, base).pathname;
      if (!resolved.startsWith(prefix)) return null;
      path = resolved.slice(prefix.length);
    } else {
      return null;
    }

    try { path = decodeURIComponent(path); } catch {}
    path = path.replace(/^\/+/, "");
    if (!path || path.split("/").includes("..")) return null;
    return path;
  }

  function scanReferences(moduleId, currentPath, text) {
    const source = new Set();
    const binary = new Set();

    const add = ref => {
      const path = resolvePath(moduleId, currentPath, ref);
      if (!path) return;
      if (TEXT_EXT.test(path)) source.add(path);
      else if (BINARY_EXT.test(path)) binary.add(path);
    };

    const patterns = [
      /(?:import\s*(?:[^"'()]*?\sfrom\s*)?|export\s+[^"']*?\sfrom\s*|import\s*\()\s*["']([^"']+)["']/g,
      /(?:fetch|getTemplate|loadTemplate|loadTemplates)\s*\(\s*["']([^"']+)["']/g,
      /["']((?:\.\.?\/|\/modules\/|modules\/)[^"']+\.(?:js|mjs|cjs|css|hbs|html|htm|json|txt|md|png|webp|jpe?g|gif|svg|wav|ogg|mp3|flac|woff2?|ttf|otf)(?:[?#][^"']*)?)["']/gi
    ];

    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(text))) add(match[1]);
    }

    const cssUrls = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
    let match;
    while ((match = cssUrls.exec(text))) add(match[1]);

    return {
      source: [...source],
      binary: [...binary]
    };
  }

  async function fetchText(url) {
    const response = await fetch(url, {cache:"no-store"});
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    if (text.length > MAX_CHARS_PER_FILE) {
      throw new Error("file too large for text export");
    }
    return text;
  }

  const mod = chooseModule();
  if (!mod) {
    return ui.notifications.error("FEHA MODULE SOURCE EXPORTER // no module selected.");
  }

  const moduleId = mod.id;
  const base = `/modules/${moduleId}/`;

  const queue = [];
  const queued = new Set();
  const files = {};
  const binaryAssets = new Set();
  const failures = [];

  const enqueue = path => {
    path = stripQuery(path).replace(/^\/+/, "");
    if (!path || queued.has(path) || queued.size >= MAX_FILES) return;
    queued.add(path);
    queue.push(path);
  };

  enqueue("module.json");
  for (const p of mod.scripts ?? []) enqueue(normalizeModuleEntry(moduleId, p));
  for (const p of mod.esmodules ?? []) enqueue(normalizeModuleEntry(moduleId, p));
  for (const p of mod.styles ?? []) enqueue(normalizeModuleEntry(moduleId, p));
  for (const lang of mod.languages ?? []) {
    enqueue(normalizeModuleEntry(moduleId, lang));
  }

  ui.notifications.info(
    `FEHA MODULE SOURCE // scanning ${mod.title} [${moduleId}]...`
  );

  while (queue.length && Object.keys(files).length < MAX_FILES) {
    const path = queue.shift();

    try {
      const text = await fetchText(base + path);
      files[path] = text;

      // module.json is authoritative and often contains cleaner relative paths
      // than Foundry's runtime Module object (which may expose full module paths
      // or style descriptors as objects).
      if (path === "module.json") {
        try {
          const manifest = JSON.parse(text);
          for (const p of manifest.scripts ?? []) enqueue(normalizeModuleEntry(moduleId, p));
          for (const p of manifest.esmodules ?? []) enqueue(normalizeModuleEntry(moduleId, p));
          for (const p of manifest.styles ?? []) enqueue(normalizeModuleEntry(moduleId, p));
          for (const lang of manifest.languages ?? []) enqueue(normalizeModuleEntry(moduleId, lang));
        } catch (manifestErr) {
          failures.push({
            path: "module.json#parse",
            url: base + "module.json",
            error: String(manifestErr?.message ?? manifestErr)
          });
        }
      }

      const refs = scanReferences(moduleId, path, text);
      for (const next of refs.source) enqueue(next);
      for (const asset of refs.binary) binaryAssets.add(asset);
    } catch (err) {
      failures.push({
        path,
        url: base + path,
        error: String(err?.message ?? err)
      });
    }

    const count = Object.keys(files).length;
    if (count && count % 25 === 0) {
      ui.notifications.info(`FEHA MODULE SOURCE // ${count} text files captured...`);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const payload = {
    exportType: "FEHA_ADK_MODULE_SOURCE",
    exporterVersion: "1.1",
    generatedAt: new Date().toISOString(),
    environment: {
      foundryVersion: game.version,
      systemId: game.system?.id,
      systemVersion: game.system?.version
    },
    module: {
      id: mod.id,
      title: mod.title,
      version: mod.version,
      active: mod.active,
      manifest: mod.manifest,
      scripts: [...(mod.scripts ?? [])],
      esmodules: [...(mod.esmodules ?? [])],
      styles: [...(mod.styles ?? [])],
      languages: [...(mod.languages ?? [])],
      packs: [...(mod.packs ?? [])]
    },
    textFiles: files,
    referencedBinaryAssets: [...binaryAssets].sort(),
    unresolvedOrFailed: failures,
    limits: {
      maxFiles: MAX_FILES,
      maxCharsPerFile: MAX_CHARS_PER_FILE
    },
    note:
      "This export contains module text source and referenced asset paths only. It does not intentionally collect credentials, tokens, cookies, API keys, OAuth secrets, or authorization headers."
  };

  const filename =
    `FEHA_ADK_MODULE_SOURCE_${moduleId}_` +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".json";

  save(filename, JSON.stringify(payload, null, 2));
  console.log("FEHA MODULE SOURCE EXPORT COMPLETE", payload);
  ui.notifications.info(
    `FEHA MODULE SOURCE // complete: ${Object.keys(files).length} files -> ${filename}`
  );
  }

  function bindCyberdeckV2(root, model) {
    root.onpointerover = event => {
      const interactive = event.target?.closest?.("button, select, .cd2-hack-card, .cd2-support-card, .cd2-deck-summary, .cd2-telemetry-card");
      if (!interactive || !root.contains(interactive)) return;
      globalThis.FEHA_SOUNDS?.play?.("hover", {cooldown:75});
    };

    root.onchange = event => {
      if (!event.target?.matches?.("#cd2-actor")) return;
      const id = String(event.target.value ?? "");
      globalThis.FEHA_SOUNDS?.play?.("actor_switch", {cooldown:90});
      renderCyberdeckV2(id, "quickhacks");
    };

    root.onclick = async event => {
      const button = event.target?.closest?.("[data-cd-action]");
      if (!button || !root.contains(button)) return;

      const action = button.dataset.cdAction;
      const actor = model.actor;

      if (action === "close") {
        globalThis.FEHA_SOUNDS?.play?.("drawer_close", {cooldown:0});
        root.remove();
        return;
      }

      if (action === "load" || action === "unload") {
        const prepared = action === "load";
        globalThis.FEHA_SOUNDS?.play?.(prepared ? "install" : "remove", {cooldown:0});
        await setQuickhackPrepared(actor, button.dataset.itemId, prepared);
        renderCyberdeckV2(actor.id, "quickhacks");
        return;
      }


      if (action === "export-handoff") {
        await exportFehaHandoff();
        return;
      }

      if (action === "export-source") {
        await exportFehaModuleSource();
        return;
      }

      if (action === "target-combatant") {
        const combatantId = button.dataset.combatantId;
        const tokenId = button.dataset.tokenId;
        const sceneId = button.dataset.sceneId;
        const combatant = game.combat?.combatants?.get?.(combatantId);
        if (!combatant || !tokenId) {
          globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
          ui?.notifications?.warn?.("Combat target is no longer available.");
          renderCyberdeckV2(actor.id,"network");
          return;
        }
        let targeted = false;
        const tokenObj = (globalThis.canvas?.scene?.id === sceneId || !sceneId) ? globalThis.canvas?.tokens?.get?.(tokenId) : null;
        try {
          if (tokenObj?.setTarget) {
            await tokenObj.setTarget(true,{user:game.user,releaseOthers:true,groupSelection:true});
            targeted = true;
          } else if (game.user?.updateTokenTargets) {
            await game.user.updateTokenTargets([tokenId]);
            targeted = true;
          }
        } catch (err) { console.warn("FEHA Cyberdeck target lock failed",err); }
        if (targeted) {
          globalThis.FEHA_SOUNDS?.play?.("scan",{cooldown:0});
          setTimeout(() => globalThis.FEHA_SOUNDS?.play?.("confirm",{cooldown:0}),90);
        } else {
          globalThis.FEHA_SOUNDS?.play?.("error",{cooldown:0});
          ui?.notifications?.warn?.(sceneId && globalThis.canvas?.scene?.id !== sceneId ? "That combatant is on a different scene." : "Could not acquire that combat token.");
        }
        renderCyberdeckV2(actor.id,"network");
        return;
      }

      if (action === "rest") {
        globalThis.FEHA_SOUNDS?.play?.("confirm", {cooldown:0});
        if (typeof actor?.shortRest === "function") {
          await actor.shortRest();
          setTimeout(() => {
            if (!lifecycleActive || globalThis.FEHA_CYBERDECK_V3_ACTIVE === true) return;
            globalThis.FEHA_SOUNDS?.play?.("compatibility_ok", {cooldown:0});
            const live = document.getElementById(CYBERDECK_V2_ID);
            if (live?.dataset?.fehaV3 !== "1") {
              renderCyberdeckV2(actor.id, root.dataset.tab || "quickhacks");
            }
          }, 250);
        } else {
          globalThis.FEHA_SOUNDS?.play?.("error", {cooldown:0});
          ui?.notifications?.warn?.("FEHA // Short Rest action is unavailable on this actor.");
        }
        return;
      }

      if (action === "jack") {
        globalThis.FEHA_SOUNDS?.play?.("scan", {cooldown:0});
        setTimeout(() => {
          if (lifecycleActive) globalThis.FEHA_SOUNDS?.play?.("confirm", {cooldown:0});
        }, 150);
        root.classList.remove("is-jacking");
        void root.offsetWidth;
        root.classList.add("is-jacking");
        renderCyberdeckV2(actor.id, "network");
        setTimeout(() => {
          if (!lifecycleActive || globalThis.FEHA_CYBERDECK_V3_ACTIVE === true) return;
          const live = document.getElementById(CYBERDECK_V2_ID);
          if (live?.dataset?.fehaV3 !== "1") live?.classList.add("is-jacking");
        }, 0);
        return;
      }
    };
  }

  function openCyberdeckV2(actorId = null) {
    // If the old native Cyberdeck is already on screen, remove it. We keep its
    // data model, not its presentation.
    findCyberdeckRoots(document.body).forEach(el => el.remove());
    const root = renderCyberdeckV2(actorId, "quickhacks");
    globalThis.FEHA_SOUNDS?.play?.("drawer_open", {cooldown:0});
    return root;
  }

  function installCyberdeckV2() {
    const adk = globalThis.game?.adk;
    if (!adk) return false;

    // Export utilities are base services, not V2 presentation features.
    // Keep them available even while V3 owns the Cyberdeck launcher.
    adk.exportHandoff = exportFehaHandoff;
    adk.exportModuleSource = exportFehaModuleSource;

    if (
      globalThis.FEHA_CYBERDECK_V3_ACTIVE === true ||
      globalThis.FEHA_TABLETOP_UI_V3?.version
    ) {
      removeCyberdeckCombatHooks();
      return false;
    }

    if (typeof adk.openCyberdeck !== "function") return false;

    if (!cyberdeckOriginalOpen) {
      cyberdeckOriginalOpen = adk.openCyberdeck.bind(adk);
    }

    if (!adk.__fehaOriginalOpenCyberdeck) {
      adk.__fehaOriginalOpenCyberdeck = cyberdeckOriginalOpen;
    }

    adk.openCyberdeck = openCyberdeckV2;
    installCyberdeckCombatHooks();
    globalThis.FEHA_CYBERDECK_V2 = {
      open: openCyberdeckV2,
      render: renderCyberdeckV2,
      model: getCyberdeckModel
    };

    // Replace an already-open native window immediately.
    const legacy = findCyberdeckRoots(document.body);
    const wasOpen = legacy.length > 0;
    legacy.forEach(el => el.remove());
    if (wasOpen) {
      setTimeout(() => {
        if (!lifecycleActive || globalThis.FEHA_CYBERDECK_V3_ACTIVE === true) return;
        openCyberdeckV2();
      }, 60);
    }

    return true;
  }

  function removeCyberdeckV2() {
    document.getElementById(CYBERDECK_V2_ID)?.remove();
    const adk = globalThis.game?.adk;
    const original = adk?.__fehaOriginalOpenCyberdeck ?? cyberdeckOriginalOpen;
    if (adk && original) {
      adk.openCyberdeck = original;
      delete adk.__fehaOriginalOpenCyberdeck;
      delete adk.exportHandoff;
      delete adk.exportModuleSource;
    }
    removeCyberdeckCombatHooks();
    delete globalThis.FEHA_CYBERDECK_V2;
    cyberdeckOriginalOpen = null;
  }

  function startObserver() {
    observer?.disconnect?.();

    let scheduled = false;
    const addedScopes = new Set();

    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes ?? []) {
          if (node instanceof Element) addedScopes.add(node);
        }
      }

      if (scheduled) return;
      scheduled = true;

      requestAnimationFrame(() => {
        scheduled = false;

        patchBackend();
        markRoot();
        normalizeDossierSchematics();
        normalizePlayableRoster(document.body);

        for (const scope of addedScopes) {
          if (scope.isConnected) tagLegacyWallets(scope);
        }
        addedScopes.clear();

        suppressLegacyWalletChrome();
        installCyberdeckV2();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  const state = {
    build: BUILD,
    inspectCyberdeckDOM,
    suspendCyberdeckV2() {
      globalThis.FEHA_CYBERDECK_V3_ACTIVE = true;
      removeCyberdeckCombatHooks();

      const adk = globalThis.game?.adk;
      const original =
        adk?.__fehaOriginalOpenCyberdeck ??
        cyberdeckOriginalOpen;

      if (adk?.openCyberdeck === openCyberdeckV2 && original) {
        adk.openCyberdeck = original;
      }

      const root = document.getElementById(CYBERDECK_V2_ID);
      if (root && root.dataset?.fehaV3 !== "1") root.remove();

      return true;
    },
    resumeCyberdeckV2() {
      delete globalThis.FEHA_CYBERDECK_V3_ACTIVE;
      return installCyberdeckV2();
    },
    cleanup() {
      lifecycleActive = false;
      observer?.disconnect?.();
      observer = null;
      const root = document.getElementById("adk-chrome-manager-34");
      root?.classList?.remove("adk-live-dev");
      if (root?.dataset) {
        delete root.dataset.fehaDevBuild;
        delete root.dataset.fehaCp2077Assets;
        delete root.dataset.fehaRerun;
      }
      delete globalThis.FEHA_CP2077_ASSETS;

      const api = globalThis.ADKChromeBackend;
      if (api?.__fehaOriginalGetOwned021) {
        api.getOwned = api.__fehaOriginalGetOwned021;
        delete api.__fehaOriginalGetOwned021;
        delete api.__fehaOwnedBridge021;
      }

      removeCacheSelectionUX();
      removeActorSwitchFix();
      removeTelemetryMotion();
      removeMarketSoundUX();
      removeCreditsSystem();
      removeSoundEngine();
      removeWalletGuard();
      clearLegacyWalletTags();
      clearCyberdeckMarks();
      removeCyberdeckV2();
      document
        .getElementById("adk-chrome-manager-34")
        ?.classList.remove("feha-cache-selection-focus");
      delete globalThis.ADKDevPatch;
    },
    reopenChrome() {
      try {
        document.getElementById("adk-chrome-manager-34")?.remove();
        if (globalThis.game?.adk?.openChrome) {
          setTimeout(async () => {
            if (!lifecycleActive) return;
            game.adk.openChrome();
            setTimeout(async () => {
              if (!lifecycleActive) return;
              patchBackend();
              await repairCacheMetadata(globalThis.ADKChromeBackend);
              globalThis.ADKChromeBackend?.refresh?.();
              setTimeout(() => {
                if (lifecycleActive) markRoot();
              }, 80);
            }, 180);
          }, 80);
        }
      } catch (err) {
        console.error("FEHA dev reopen failed", err);
      }
    }
  };

  globalThis.ADKDevPatch = state;
  globalThis.FEHA_DEV_DIAGNOSTICS = globalThis.FEHA_DEV_DIAGNOSTICS ?? false;

  installSoundEngine();
  installCreditsSystem();
  installTelemetryMotion();
  installCacheSelectionUX();
  installActorSwitchFix();
  installWalletGuard();
  startObserver();
  patchBackend();
  markRoot();
  normalizePlayableRoster(document.body);
  tagLegacyWallets();
  suppressLegacyWalletChrome();
  installCyberdeckV2();

  console.log(
    "%cFEHA DEV PATCH %c" + BUILD,
    "color:#70f7e7;font-weight:900",
    "color:#fff"
  );

  if (!globalThis.FEHA_CYBERDECK_V3_ACTIVE) {
    ui?.notifications?.info?.(
      "FEHA DEV " + BUILD + " // base services ready"
    );
  }

  if (document.getElementById("adk-chrome-manager-34")) {
    state.reopenChrome();
  }
})();