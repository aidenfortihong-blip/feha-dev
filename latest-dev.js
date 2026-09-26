(() => {
  const BUILD = "0.5.3";
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
          console.warn("FEHA DEV 0.5.3 // preload failed", event, err);
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
            console.warn("FEHA DEV 0.5.3 // sound playback failed", event, err);
            return false;
          });
      } catch (err) {
        console.warn("FEHA DEV 0.5.3 // sound clone failed", event, err);
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
        console.warn("FEHA DEV 0.5.3 // legacy sound routing failed", err);
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
      `FEHA DEV 0.5.3 // sound source: ${source}`
    );

    if (!localPack) {
      console.info(
        "FEHA DEV 0.5.3 // Cyberpunk local pack not installed; using CC0 fallback."
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

  function startObserver() {
    observer?.disconnect?.();
    observer = new MutationObserver(() => {
      patchBackend();
      markRoot();
      normalizeDossierSchematics();
      tagLegacyWallets();
      suppressLegacyWalletChrome();
      markCyberdecks();
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
  markCyberdecks();

  console.log(
    "%cFEHA DEV PATCH %c" + BUILD,
    "color:#70f7e7;font-weight:900",
    "color:#fff"
  );

  ui?.notifications?.info?.(
    "FEHA DEV " + BUILD + " // Cyberdeck foundation active"
  );

  state.reopenChrome();
})();