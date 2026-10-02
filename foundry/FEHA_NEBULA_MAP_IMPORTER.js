// FEHA // NEBULA MAPS BULK IMPORTER
// Imports every Scene from active Nebula Maps compendiums into the world.
// Designed for Nebula's official Foundry modules: install/enable the packs,
// then press "Import Nebula Maps" in the Scenes directory.
//
// Safe to run repeatedly. Imported scenes are tracked by their Compendium UUID
// and by a FEHA source flag so updates do not create duplicate copies.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_NEBULA_MAP_IMPORTER requires FEHA_CYBER_CORE.");
  }

  const VERSION = "1.0.0";
  const FLAG_SCOPE = "fleshEnshrouded";
  const SOURCE_FLAG = "nebulaSource";
  const PACK_FLAG = "nebulaPack";
  const ROOT_FOLDER = "Nebula Maps";
  const BUTTON_CLASS = "feha-nebula-import";
  const hooks = [];

  const esc = value => String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  const asArray = value => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try { return Array.from(value); } catch { return []; }
  };

  function packageFor(pack) {
    const packageName = pack?.metadata?.packageName;
    return packageName ? game.modules?.get(packageName) ?? null : null;
  }

  function packageText(pack) {
    const pkg = packageFor(pack);
    const authors = asArray(pkg?.authors)
      .map(author => author?.name ?? author?.id ?? author)
      .filter(Boolean)
      .join(" ");

    return [
      pack?.collection,
      pack?.title,
      pack?.metadata?.label,
      pack?.metadata?.name,
      pack?.metadata?.packageName,
      pkg?.id,
      pkg?.title,
      pkg?.description,
      authors
    ].filter(Boolean).join(" ");
  }

  function isScenePack(pack) {
    return String(pack?.documentName ?? pack?.metadata?.type ?? "") === "Scene";
  }

  function isNebulaPack(pack) {
    if (!isScenePack(pack)) return false;
    const haystack = packageText(pack);
    return /nebula\s*maps?/i.test(haystack) || /nebulamaps/i.test(haystack);
  }

  function activeNebulaPacks() {
    return asArray(game.packs?.values?.() ?? game.packs)
      .filter(isNebulaPack)
      .sort((a,b) => String(a.title).localeCompare(String(b.title)));
  }

  function installedNebulaModules() {
    return asArray(game.modules?.values?.() ?? game.modules)
      .filter(pkg => {
        const authors = asArray(pkg?.authors)
          .map(author => author?.name ?? author?.id ?? author)
          .join(" ");
        const haystack = [pkg?.id,pkg?.title,pkg?.description,authors]
          .filter(Boolean)
          .join(" ");
        return /nebula\s*maps?/i.test(haystack) || /nebulamaps/i.test(haystack);
      });
  }

  function parentId(folder) {
    return folder?.folder?.id ?? folder?.folder ?? null;
  }

  async function ensureFolder(name,parent=null) {
    let folder = game.folders?.find?.(entry =>
      entry.type === "Scene" &&
      entry.name === name &&
      (parentId(entry) ?? null) === (parent ?? null)
    );

    if (folder) return folder;

    folder = await Folder.create({
      name,
      type:"Scene",
      folder:parent,
      sorting:"a"
    });

    return folder;
  }

  function sourceUuid(pack,id) {
    try {
      return pack.getUuid(id);
    } catch {
      return "Compendium." + pack.collection + "." + id;
    }
  }

  function existingScene(pack,id) {
    const uuid = sourceUuid(pack,id);
    const key = pack.collection + ":" + id;

    return game.scenes?.find?.(scene =>
      scene?._stats?.compendiumSource === uuid ||
      scene?.getFlag?.(FLAG_SCOPE,SOURCE_FLAG) === key
    ) ?? null;
  }

  async function packIndex(pack) {
    const index = await pack.getIndex();
    return asArray(index?.values?.() ?? index);
  }

  async function scan() {
    const packs = activeNebulaPacks();
    const details = [];

    for (const pack of packs) {
      let entries = [];
      let error = null;

      try {
        entries = await packIndex(pack);
      } catch (err) {
        error = String(err?.message ?? err);
      }

      details.push({
        pack,
        collection:pack.collection,
        title:pack.title,
        count:entries.length,
        entries,
        error
      });
    }

    return {
      packs:details,
      total:details.reduce((sum,row) => sum + row.count,0),
      installedModules:installedNebulaModules()
    };
  }

  function createProgress(total) {
    document.getElementById("feha-nebula-import-progress")?.remove();

    const element = document.createElement("div");
    element.id = "feha-nebula-import-progress";
    Object.assign(element.style,{
      position:"fixed",
      left:"50%",
      top:"18px",
      transform:"translateX(-50%)",
      zIndex:"100000",
      width:"min(560px, calc(100vw - 32px))",
      padding:"12px 14px",
      border:"1px solid #39d7ff",
      background:"rgba(4,8,13,.96)",
      boxShadow:"0 0 24px rgba(57,215,255,.22)",
      color:"#e9fbff",
      fontFamily:"monospace",
      fontSize:"13px",
      pointerEvents:"none"
    });

    element.innerHTML =
      '<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px">' +
        '<strong style="color:#39d7ff">NEBULA MAPS // IMPORT</strong>' +
        '<span data-feha-nebula-count>0 / '+Number(total || 0)+'</span>' +
      '</div>' +
      '<div style="height:5px;background:#17222d;overflow:hidden">' +
        '<div data-feha-nebula-bar style="height:100%;width:0;background:#39d7ff"></div>' +
      '</div>' +
      '<div data-feha-nebula-label style="margin-top:7px;color:#9fb4c3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Starting…</div>';

    document.body.appendChild(element);

    return {
      update(done,label) {
        const safeDone = Math.max(0,Number(done || 0));
        const pct = total ? Math.min(100,(safeDone / total) * 100) : 100;
        const count = element.querySelector("[data-feha-nebula-count]");
        const bar = element.querySelector("[data-feha-nebula-bar]");
        const text = element.querySelector("[data-feha-nebula-label]");
        if (count) count.textContent = safeDone+" / "+total;
        if (bar) bar.style.width = pct+"%";
        if (text) text.textContent = String(label ?? "");
      },
      close(delay=800) {
        setTimeout(() => element.remove(),delay);
      },
      remove() {
        element.remove();
      }
    };
  }

  async function importAll({collections=null}={}) {
    if (!game.user?.isGM) {
      throw new Error("Only the GM can import Nebula Maps.");
    }

    const scanResult = await scan();
    let selected = scanResult.packs;

    if (Array.isArray(collections) && collections.length) {
      const wanted = new Set(collections.map(String));
      selected = selected.filter(row => wanted.has(row.collection));
    }

    if (!selected.length) {
      throw new Error(
        "No active Nebula Maps Scene compendiums were detected. " +
        "Install the official Nebula Foundry modules and enable them in this world first."
      );
    }

    const root = await ensureFolder(ROOT_FOLDER,null);
    const total = selected.reduce((sum,row) => sum + row.count,0);
    const progress = createProgress(total);

    const result = {
      version:VERSION,
      packs:selected.length,
      total,
      imported:[],
      skipped:[],
      failed:[]
    };

    let done = 0;

    try {
      for (const row of selected) {
        const pack = row.pack;
        const folder = await ensureFolder(pack.title,root.id);

        let entries = row.entries;
        if (!entries?.length && !row.error) entries = await packIndex(pack);

        if (row.error) {
          result.failed.push({
            pack:pack.collection,
            name:pack.title,
            error:row.error
          });
          continue;
        }

        for (const entry of entries) {
          const id = entry?._id ?? entry?.id;
          const name = entry?.name ?? id ?? "Unknown Scene";

          try {
            if (!id) throw new Error("Compendium entry has no id.");

            const prior = existingScene(pack,id);
            if (prior) {
              result.skipped.push({
                pack:pack.collection,
                id,
                name,
                sceneId:prior.id
              });
            } else {
              const key = pack.collection + ":" + id;
              const imported = await game.scenes.importFromCompendium(
                pack,
                id,
                {
                  folder:folder.id,
                  flags:{
                    [FLAG_SCOPE]:{
                      [SOURCE_FLAG]:key,
                      [PACK_FLAG]:pack.collection,
                      nebulaImportedAt:new Date().toISOString()
                    }
                  }
                },
                {renderSheet:false}
              );

              result.imported.push({
                pack:pack.collection,
                id,
                name:imported?.name ?? name,
                sceneId:imported?.id ?? null
              });
            }
          } catch (error) {
            result.failed.push({
              pack:pack.collection,
              id:id ?? null,
              name,
              error:String(error?.message ?? error)
            });
            console.error(
              "FEHA NEBULA MAPS // failed",
              pack.collection,
              name,
              error
            );
          } finally {
            done++;
            progress.update(done,pack.title+" // "+name);
          }

          // Yield between documents so a huge library does not lock the UI.
          await new Promise(resolve => setTimeout(resolve,0));
        }
      }

      progress.update(total,"Finished.");
      progress.close();

      console.log("FEHA NEBULA MAPS // import result",result);

      ui.notifications?.info?.(
        "Nebula Maps: imported "+result.imported.length+
        ", already present "+result.skipped.length+
        (result.failed.length ? ", failed "+result.failed.length+" (see console)." : ".")
      );

      return result;
    } catch (error) {
      progress.remove();
      console.error("FEHA NEBULA MAPS // bulk import failed",error);
      throw error;
    }
  }

  async function openImportDialog() {
    if (!game.user?.isGM) return null;

    const state = await scan();
    const active = state.packs;
    const inactive = state.installedModules.filter(pkg => !pkg.active);

    if (!active.length) {
      const extra = inactive.length
        ? " I found "+inactive.length+" installed Nebula module(s), but they are not enabled in this world."
        : "";

      ui.notifications?.warn?.(
        "No active Nebula Maps Scene compendiums found."+extra
      );

      return null;
    }

    const rows = active.map(row =>
      "<tr>" +
        "<td style='padding:4px 12px 4px 0'>"+esc(row.title)+"</td>" +
        "<td style='padding:4px 0;text-align:right'>"+row.count+"</td>" +
      "</tr>"
    ).join("");

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window:{title:"Import Nebula Maps"},
      content:
        "<p>Import <strong>"+state.total+"</strong> scenes from <strong>"+
        active.length+"</strong> active Nebula Maps compendium"+
        (active.length === 1 ? "" : "s")+"?</p>" +
        "<p>They will be organized under <strong>"+esc(ROOT_FOLDER)+
        "</strong>. Existing imports are skipped automatically.</p>" +
        "<table style='width:100%;margin:10px 0'>"+rows+"</table>" +
        "<p style='opacity:.75'>This uses the creator's Foundry-ready scene data, so walls, lights, doors, tiles, and scene settings come across with the map.</p>",
      rejectClose:false
    });

    if (!confirmed) return null;

    try {
      return await importAll();
    } catch (error) {
      console.error("FEHA NEBULA MAPS // import failed",error);
      ui.notifications?.error?.(
        "Nebula Maps import failed. Check the console for the exact pack/scene."
      );
      return null;
    }
  }

  function addImportButton() {
    if (!game.user?.isGM) return;

    const actions = document.querySelector("#scenes .directory-header .header-actions");
    if (!actions || actions.querySelector("."+BUTTON_CLASS)) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.innerHTML =
      '<i class="fa-solid fa-map-location-dot" inert></i> <span>Import Nebula Maps</span>';
    button.addEventListener("click",() => openImportDialog());
    actions.appendChild(button);
  }

  const api = {
    version:VERSION,
    scan,
    importAll,
    openImportDialog,
    activeNebulaPacks,

    async init() {
      await api.destroy();

      hooks.push([
        "renderSceneDirectory",
        Hooks.on("renderSceneDirectory",addImportButton)
      ]);

      addImportButton();

      if (game.adk) game.adk.nebulaMaps = api;
      globalThis.FEHA_NEBULA_MAPS = api;

      console.log(
        "FEHA NEBULA MAPS",
        VERSION,
        "ready",
        activeNebulaPacks().length,
        "active scene packs"
      );
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }

      document.querySelector("#scenes ."+BUTTON_CLASS)?.remove();

      if (globalThis.FEHA_NEBULA_MAPS === api) {
        delete globalThis.FEHA_NEBULA_MAPS;
      }
    }
  };

  core.registerModule("nebulaMaps",api);
})();
