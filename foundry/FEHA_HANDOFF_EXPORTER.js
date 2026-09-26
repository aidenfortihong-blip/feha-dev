// FEHA / ADK HANDOFF EXPORTER v1.0
// Run as a Foundry Script Macro while logged in as GM.
// Downloads one JSON package for the next FEHA development chat.
// It intentionally does NOT collect passwords, tokens, credentials,
// cookies, OAuth secrets, authorization headers, or API keys.

(async () => {
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
})();