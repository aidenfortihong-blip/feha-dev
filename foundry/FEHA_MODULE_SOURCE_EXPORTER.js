// FEHA / ADK MODULE SOURCE EXPORTER v1.0
// Run as a Foundry Script Macro as GM.
// Purpose: capture the installed FEHA/ADK module's text source so the next
// development chat can reconstruct it into GitHub and edit the real module.
// No credentials or authentication data are collected.

(async () => {
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
})();