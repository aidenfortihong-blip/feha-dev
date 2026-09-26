(() => {
  const BUILD = "0.6.1";
  let observer = null;
  let walletGuard = null;

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

  async function repairCacheMetadata(api) {
    const actor = api?.getActor?.();
    if (!actor) return;

    const cache = findCache(actor);
    if (!cache) return;

    const repairs = [...actor.items]
      .filter(item => item.id !== cache.id && isInCache(item, cache))
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
      console.info("FEHA DEV 0.2.6 // repaired cached chrome metadata", repairs.length);
    } catch (err) {
      console.warn("FEHA DEV 0.2.1 // cache metadata repair failed", err);
    }
  }

  function patchBackend() {
    const api = globalThis.ADKChromeBackend;
    if (!api) return false;
    installOwnedBridge(api);
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
    const paths = localPack ?? FALLBACK_MAP;
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
          console.warn("FEHA DEV 0.6.1 // preload failed", event, err);
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
        audio.volume = Math.max(
          0,
          Math.min(1, master * (LEVELS[event] ?? 0.75))
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
            console.warn("FEHA DEV 0.6.1 // sound playback failed", event, err);
            return false;
          });
      } catch (err) {
        console.warn("FEHA DEV 0.6.1 // sound clone failed", event, err);
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
        console.warn("FEHA DEV 0.6.1 // legacy sound routing failed", err);
      }

      return OriginalPlay.apply(this, args);
    };

    HTMLMediaElement.prototype.play = routedPlay;

    const clickHandler = event => {
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
          audio.volume = Math.max(0, Math.min(1, master));
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
        return Boolean(readLocalPack());
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
      `FEHA DEV 0.6.1 // sound source: ${source}`
    );

    if (!localPack) {
      console.info(
        "FEHA DEV 0.6.1 // Cyberpunk local pack not installed; using CC0 fallback."
      );
    }
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
    const select = root?.querySelector?.("#actor-select");
    if (!select) return false;

    const blocked = new Set(["nina", "florence", "cael", "xiao"]);

    for (const option of [...select.options]) {
      const label = norm(option.textContent || option.label || "");
      if (blocked.has(label)) option.remove();
    }

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
            "FEHA DEV 0.2.6 // backend switched actor but its inline render failed; forcing native render",
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
            globalThis.ADKChromeNative?.render?.();
            globalThis.ADKTheme?.refresh?.();
            document
              .getElementById("adk-chrome-manager-34")
              ?.classList.remove("is-subject-switching");
          }, 80);
        });

        console.info(
          "FEHA DEV 0.2.6 // subject switch complete:",
          desired.name,
          actorId
        );
      } catch (err) {
        console.error("FEHA DEV 0.2.6 // actor switch failed", err);
        ui?.notifications?.error?.(
          "FEHA subject switch failed — press F12 and send the red FEHA error."
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
          console.error("FEHA DEV 0.2.6 // actor switch fallback render failed", fallbackErr);
        }
      } finally {
        switching = false;
        setTimeout(() => {
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

  function tagLegacyWallets(scope = document.body) {
    if (!scope?.querySelectorAll) return 0;

    const labels = [];
    const all = scope.querySelectorAll("*");

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
    ui?.notifications?.info?.("FEHA // Cyberdeck DOM captured to F12 console");
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
    const f = fehaFlags(item);
    return (
      f.installed === true ||
      f.isInstalled === true ||
      item?.system?.equipped === true ||
      item?.system?.equipped?.value === true
    );
  }

  function isQuickhack(item) {
    if (!item) return false;
    const f = fehaFlags(item);
    const folder = String(item.folder?.name ?? "");
    const blob = [
      item.name,
      item.type,
      folder,
      f.itemType,
      f.kind,
      f.category,
      f.quickhack,
      f.isQuickhack,
      item.system?.type?.value,
      item.system?.identifier
    ].join(" ").toLowerCase();

    // In the ADK build, quickhacks are represented by spell documents.
    return item.type === "spell" || /quick\s*hack|quickhack/.test(blob);
  }

  function isCyberdeck(item) {
    if (!item || !installedChrome(item)) return false;
    const f = fehaFlags(item);
    const slot = String(f.cyberwareSlot ?? f.slot ?? "").toLowerCase();
    const blob = [
      item.name,
      item.folder?.name,
      f.kind,
      f.category,
      f.cyberdeck,
      f.isCyberdeck,
      slot
    ].join(" ").toLowerCase();

    return (
      f.cyberdeck === true ||
      f.isCyberdeck === true ||
      /cyberdeck|netdriver|nets*driver/.test(blob) ||
      /operating\s*system/.test(slot)
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
    if (!item || item === deck || !installedChrome(item) || isQuickhack(item)) return false;
    const f = fehaFlags(item);
    const blob = [
      item.name,
      item.folder?.name,
      f.kind,
      f.category,
      f.netrunnerSupport,
      f.netSupport,
      f.cyberwareSlot,
      itemDescription(item)
    ].join(" ").toLowerCase();

    return (
      f.netrunnerSupport === true ||
      f.netSupport === true ||
      /netrunner|quickhack|neural intrusion|self ice|black ice|ram\b|network/.test(blob)
    );
  }

  function quickhackPrepared(item) {
    const prep = item?.system?.preparation;
    if (prep && typeof prep === "object" && "prepared" in prep) return prep.prepared === true;
    const f = fehaFlags(item);
    return f.loaded === true || f.quickhackLoaded === true || f.installed === true;
  }

  function getCyberdeckModel(actor) {
    if (!actor) return null;
    const items = [...(actor.items ?? [])];
    const deck = items.find(isCyberdeck) ?? null;
    const quickhacks = items.filter(isQuickhack);
    const loaded = quickhacks.filter(quickhackPrepared);
    const library = quickhacks.filter(item => !quickhackPrepared(item));
    const support = items.filter(item => isSupportChrome(item, deck));

    const deckObj = itemData(deck);
    const actorObj = (() => {
      try { return actor.toObject?.() ?? actor; } catch { return actor; }
    })();

    const baseRam =
      deepNumber(deckObj, ["baseRam","ramMax","maxRam","ramCapacity"]) ??
      deepNumber(actorObj, ["ramMax","maxRam","ramCapacity"]) ??
      0;

    const currentRam =
      deepNumber(actorObj, ["currentRam","ramCurrent","activeRam"]) ??
      deepNumber(deckObj, ["currentRam","ramCurrent","activeRam"]) ??
      baseRam;

    const softwareSlots =
      deepNumber(deckObj, ["softwareSlots","quickhackSlots","programSlots","deckSlots"]) ??
      Math.max(loaded.length, 0);

    const quickhackDc =
      deepNumber(deckObj, ["quickhackDc","hackDc","quickhackDifficulty"]) ??
      deepNumber(actorObj, ["quickhackDc","hackDc"]) ??
      null;

    const heat = deepNumber(actorObj, ["currentHeat","heatCurrent","heat"]);
    const heatMax = deepNumber(actorObj, ["heatMax","maxHeat"]) ?? 100;
    const humanity = deepNumber(actorObj, ["currentHumanity","humanityCurrent","humanity"]);
    const humanityMax = deepNumber(actorObj, ["humanityMax","maxHumanity"]) ?? 100;

    const f = fehaFlags(deck);
    const manufacturer =
      f.manufacturer ??
      deepString(deckObj, ["manufacturer","maker","brand"]) ??
      deck?.folder?.name ??
      "UNKNOWN";

    const mk =
      f.mk ??
      deepString(deckObj, ["mk","mark","tier"]) ??
      "";

    return {
      actor,
      deck,
      loaded,
      library,
      support,
      baseRam,
      currentRam: Math.max(0, currentRam),
      softwareSlots: Math.max(0, softwareSlots),
      quickhackDc,
      heat,
      heatMax,
      humanity,
      humanityMax,
      manufacturer: String(manufacturer ?? "UNKNOWN").replace(/^-+/, ""),
      mk: String(mk ?? "")
    };
  }

  function cyberActors() {
    const allowed = new Map([
      ["ponyboy", 0],
      ["derke", 1],
      ["sasha", 2],
      ["zach", 3]
    ]);

    return [...(game?.actors ?? [])]
      .filter(actor => {
        const key = norm(actor?.name);
        return allowed.has(key) && (game.user?.isGM || actor.isOwner);
      })
      .sort((a,b) => (allowed.get(norm(a.name)) ?? 99) - (allowed.get(norm(b.name)) ?? 99));
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
    const ram =
      deepNumber(itemData(item), ["ramCost","ram","costRam","quickhackRam"]) ??
      deepNumber(f, ["ramCost","ram","costRam"]) ??
      null;
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
        ${loaded ? `<button type="button" class="cd2-run" data-cd-action="run" data-item-id="${esc(item.id)}">RUN</button>` : ""}
      </article>
    `;
  }

  function loadedSlots(model) {
    if (!model.deck) {
      return `
        <div class="cd2-no-deck">
          <div class="cd2-no-deck-glyph">×</div>
          <b>NO CYBERDECK INSTALLED</b>
          <span>Install an Operating System / Cyberdeck through Chrome Manager.</span>
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
          <button type="button" class="cd2-empty-slot" data-cd-action="tab" data-tab="memory">
            <span>+</span>
            <b>EMPTY SLOT</b>
            <small>LOAD SOFTWARE</small>
          </button>
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

    const ramMax = Math.max(1, model.baseRam || model.currentRam || 1);
    const ramText = model.deck ? `${model.currentRam} / ${ramMax}` : "OFFLINE";
    const heatText = model.heat == null ? "—" : `${model.heat} / ${model.heatMax}`;
    const humanityText = model.humanity == null ? "—" : `${model.humanity} / ${model.humanityMax}`;

    root.dataset.actorId = fallback.id;
    root.dataset.tab = tab;

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
            ${actors.map(actor => `<option value="${esc(actor.id)}" ${actor.id === fallback.id ? "selected" : ""}>${esc(actor.name)}</option>`).join("")}
          </select>
          <button type="button" class="cd2-close" data-cd-action="close">×</button>
        </div>
      </header>

      <aside class="cd2-operator">
        <div class="cd2-portrait">
          <img src="${esc(cyberPortrait(fallback))}" alt="${esc(fallback.name)}">
          <div class="cd2-portrait-grid"></div>
          <div class="cd2-operator-tag">OPERATOR // ${esc(fallback.name.toUpperCase())}</div>
        </div>

        <div class="cd2-operator-meta">
          <div><span>SUBJECT</span><b>${esc(fallback.name)}</b></div>
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
              <div><span>RAM</span><b>${esc(model.baseRam)}</b></div>
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
            ${segmentBar(model.currentRam, ramMax, 24, "is-ram")}
          </div>
          <div class="cd2-meter">
            <div class="cd2-meter-head"><span>HEAT // TRACE LOAD</span><b>${heatText}</b></div>
            ${segmentBar(model.heat, model.heatMax, 12, "is-heat")}
          </div>
          <div class="cd2-meter">
            <div class="cd2-meter-head"><span>HUMANITY // SIGNAL INTEGRITY</span><b>${humanityText}</b></div>
            ${segmentBar(model.humanity, model.humanityMax, 12, "is-humanity")}
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
            <div class="cd2-section-head">
              <div><small>NETWORK TOPOLOGY</small><h3>TARGET ACQUISITION</h3></div>
              <span>PASSIVE SCAN</span>
            </div>
            <div class="cd2-network-grid">
              <div class="cd2-crosshair"><i></i><i></i><i></i><i></i></div>
              <div class="cd2-node n1">01</div>
              <div class="cd2-node n2">02</div>
              <div class="cd2-node n3">03</div>
              <div class="cd2-node n4">04</div>
              <div class="cd2-network-copy">
                <b>NO TARGET LOCK</b>
                <span>Awaiting network target / token integration.</span>
              </div>
            </div>
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
        <section>
          <div class="cd2-subhead">SOFTWARE BUS</div>
          <div class="cd2-right-stat"><span>LOADED</span><b>${model.loaded.length}</b></div>
          <div class="cd2-right-stat"><span>LIBRARY</span><b>${model.library.length}</b></div>
          <div class="cd2-right-stat"><span>CAPACITY</span><b>${model.softwareSlots || "—"}</b></div>
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
    if (!item) return false;

    if (item.system?.preparation && typeof item.system.preparation === "object") {
      await item.update({"system.preparation.prepared": prepared});
      return true;
    }

    await item.update({"flags.fleshEnshrouded.quickhackLoaded": prepared});
    return true;
  }

  function bindCyberdeckV2(root, model) {
    root.querySelector("#cd2-actor")?.addEventListener("change", event => {
      const id = String(event.currentTarget.value ?? "");
      renderCyberdeckV2(id, root.dataset.tab || "quickhacks");
      globalThis.FEHA_SOUNDS?.play?.("actor_switch");
    });

    root.addEventListener("click", async event => {
      const button = event.target?.closest?.("[data-cd-action]");
      if (!button || !root.contains(button)) return;

      const action = button.dataset.cdAction;
      const actor = model.actor;

      if (action === "close") {
        root.remove();
        globalThis.FEHA_SOUNDS?.play?.("drawer_close");
        return;
      }

      if (action === "tab") {
        renderCyberdeckV2(actor.id, button.dataset.tab || "quickhacks");
        globalThis.FEHA_SOUNDS?.play?.("select");
        return;
      }

      if (action === "load" || action === "unload") {
        const prepared = action === "load";
        await setQuickhackPrepared(actor, button.dataset.itemId, prepared);
        renderCyberdeckV2(actor.id, prepared ? "quickhacks" : "memory");
        globalThis.FEHA_SOUNDS?.play?.(prepared ? "install" : "remove");
        return;
      }

      if (action === "run") {
        const item = actor?.items?.get?.(button.dataset.itemId) ?? actor?.items?.find?.(x => x.id === button.dataset.itemId);
        if (!item) return;
        globalThis.FEHA_SOUNDS?.play?.("confirm");
        if (typeof item.use === "function") {
          await item.use();
        } else if (typeof item.roll === "function") {
          await item.roll();
        } else {
          item.sheet?.render?.(true);
        }
        return;
      }

      if (action === "rest") {
        globalThis.FEHA_SOUNDS?.play?.("confirm");
        if (typeof actor?.shortRest === "function") {
          await actor.shortRest();
          setTimeout(() => renderCyberdeckV2(actor.id, root.dataset.tab || "quickhacks"), 250);
        } else {
          ui?.notifications?.warn?.("FEHA // Short Rest action is unavailable on this actor.");
        }
        return;
      }

      if (action === "jack") {
        root.classList.remove("is-jacking");
        void root.offsetWidth;
        root.classList.add("is-jacking");
        renderCyberdeckV2(actor.id, "network");
        setTimeout(() => document.getElementById(CYBERDECK_V2_ID)?.classList.add("is-jacking"), 0);
        globalThis.FEHA_SOUNDS?.play?.("scan");
        return;
      }
    });
  }

  function openCyberdeckV2(actorId = null) {
    // If the old native Cyberdeck is already on screen, remove it. We keep its
    // data model, not its presentation.
    findCyberdeckRoots(document.body).forEach(el => el.remove());
    return renderCyberdeckV2(actorId, "quickhacks");
  }

  function installCyberdeckV2() {
    const adk = globalThis.game?.adk;
    if (!adk || typeof adk.openCyberdeck !== "function") return false;

    if (!cyberdeckOriginalOpen) {
      cyberdeckOriginalOpen = adk.openCyberdeck.bind(adk);
    }

    if (!adk.__fehaOriginalOpenCyberdeck) {
      adk.__fehaOriginalOpenCyberdeck = cyberdeckOriginalOpen;
    }

    adk.openCyberdeck = openCyberdeckV2;
    globalThis.FEHA_CYBERDECK_V2 = {
      open: openCyberdeckV2,
      render: renderCyberdeckV2,
      model: getCyberdeckModel
    };

    // Replace an already-open native window immediately.
    const legacy = findCyberdeckRoots(document.body);
    const wasOpen = legacy.length > 0;
    legacy.forEach(el => el.remove());
    if (wasOpen) setTimeout(() => openCyberdeckV2(), 60);

    return true;
  }

  function removeCyberdeckV2() {
    document.getElementById(CYBERDECK_V2_ID)?.remove();
    const adk = globalThis.game?.adk;
    const original = adk?.__fehaOriginalOpenCyberdeck ?? cyberdeckOriginalOpen;
    if (adk && original) {
      adk.openCyberdeck = original;
      delete adk.__fehaOriginalOpenCyberdeck;
    }
    delete globalThis.FEHA_CYBERDECK_V2;
    cyberdeckOriginalOpen = null;
  }

  function startObserver() {
    observer?.disconnect?.();
    observer = new MutationObserver(() => {
      patchBackend();
      markRoot();
      normalizeDossierSchematics();
      tagLegacyWallets();
      suppressLegacyWalletChrome();
      installCyberdeckV2();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const state = {
    build: BUILD,
    inspectCyberdeckDOM,
    cleanup() {
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
            game.adk.openChrome();
            setTimeout(async () => {
              patchBackend();
              await repairCacheMetadata(globalThis.ADKChromeBackend);
              globalThis.ADKChromeBackend?.refresh?.();
              setTimeout(markRoot, 80);
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
  installTelemetryMotion();
  installCacheSelectionUX();
  installActorSwitchFix();
  installWalletGuard();
  startObserver();
  patchBackend();
  markRoot();
  tagLegacyWallets();
  suppressLegacyWalletChrome();
  installCyberdeckV2();

  console.log(
    "%cFEHA DEV PATCH %c" + BUILD,
    "color:#70f7e7;font-weight:900",
    "color:#fff"
  );

  ui?.notifications?.info?.(
    "FEHA DEV " + BUILD + " // Cyberdeck V2 replacement active"
  );

  state.reopenChrome();
})();