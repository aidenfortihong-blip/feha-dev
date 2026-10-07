// FEHA // SCENE WALL STATUS
// GM-only labels in the Scenes tab that say how far each map's walls are:
//
//   WALLED    rooms, walls between rooms and doors done and checked
//   PACK      the map pack's own walls (restored, not checked by us)
//   BORDER    only the outer edge, traced automatically
//   OPEN      needs no walls (outdoor, backdrop); lights only
//   GM EDIT   a GM changed the walls by hand
//   NO WALLS  nothing yet
//
// The state is kept on the scene in flags.fleshEnshrouded.wallStatus. Scenes
// without it are read from their walls. The chips above the list count each
// state and filter the list; right-click a scene to mark it WALLED, OPEN or NO WALLS.
// The hand-walling tool (tools/maps/FEHA_HAND_WALLER.js) writes WALLED / OPEN.
// Players never see any of this.

(() => {
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_SCENE_WALL_STATUS requires FEHA_CYBER_CORE.");
  }

  const VERSION = "1.0.0";
  const NS = "fleshEnshrouded";
  const KEY = "wallStatus";
  const BAR = "feha-wall-bar";
  const hooks = [];
  let filter = "";

  const STATES = {
    done:{label:"WALLED",hint:"Rooms, inner walls and doors done"},
    pack:{label:"PACK",hint:"The map pack's own walls, not checked"},
    border:{label:"BORDER",hint:"Outer edge only, traced automatically"},
    open:{label:"OPEN",hint:"Needs no walls (outdoor or backdrop)"},
    gm:{label:"GM EDIT",hint:"Walls changed by a GM by hand"},
    none:{label:"NO WALLS",hint:"Not walled yet"}
  };

  const isClaude = doc => doc.flags?.[NS]?.walledBy === "claude";

  // What the walls say when the scene has no saved state.
  function detect(scene) {
    const walls = scene.walls?.contents ?? [];
    const pass = scene.flags?.[NS]?.mapPass;

    if (pass?.rule === 2) return walls.length ? "done" : "open";
    if (!walls.length) return "none";
    if (walls.every(isClaude)) return "border";
    if (walls.some(w => w.flags?.[NS]?.restored)) return "pack";
    return "gm";
  }

  function state(scene) {
    const saved = scene?.flags?.[NS]?.[KEY]?.state;
    return STATES[saved] ? saved : detect(scene);
  }

  async function set(scene,next,note = "") {
    if (!game.user?.isGM || !STATES[next]) return null;

    const doc = typeof scene === "string" ? game.scenes.get(scene) : scene;
    if (!doc) return null;

    return doc.update({["flags."+NS+"."+KEY]:{
      state:next,
      by:game.user.name,
      on:new Date().toISOString().slice(0,10),
      walls:doc.walls.size,
      doors:doc.walls.filter(w => w.door).length,
      lights:doc.lights.size,
      note:String(note ?? "")
    }});
  }

  function counts() {
    const out = Object.fromEntries(Object.keys(STATES).map(key => [key,0]));
    for (const scene of game.scenes) out[state(scene)]++;
    return out;
  }

  function paint() {
    if (!game.user?.isGM) return;

    const root = ui.scenes?.element;
    if (!root?.querySelector) return;

    for (const li of root.querySelectorAll(".directory-item.scene[data-entry-id]")) {
      const scene = game.scenes.get(li.dataset.entryId);
      if (!scene) continue;

      const key = state(scene);
      const saved = scene.flags?.[NS]?.[KEY];
      li.dataset.fehaWall = key;

      let tag = li.querySelector(":scope > .feha-wall-tag");
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "feha-wall-tag";
        li.append(tag);
      }

      tag.textContent = STATES[key].label;
      tag.dataset.tooltip = STATES[key].hint + (saved?.note ? " // " + saved.note : "");
    }

    const header = root.querySelector(".directory-header");
    if (!header) return;

    header.querySelector("."+BAR)?.remove();
    const total = counts();
    const bar = document.createElement("div");
    bar.className = BAR;
    bar.setAttribute("role","group");
    bar.setAttribute("aria-label","Filter maps by wall status");
    bar.innerHTML = '<span class="feha-wall-bar-title">WALLS</span>' +
      Object.entries(STATES).map(([key,info]) =>
        '<button type="button" data-feha-wall-filter="'+key+'" data-tooltip="'+info.hint+'"'+
        ' aria-pressed="'+(filter === key)+'">'+info.label+' <b>'+total[key]+'</b></button>'
      ).join("");

    bar.addEventListener("click",event => {
      const button = event.target.closest("[data-feha-wall-filter]");
      if (!button) return;
      filter = filter === button.dataset.fehaWallFilter ? "" : button.dataset.fehaWallFilter;
      applyFilter(root);
      for (const node of bar.querySelectorAll("[data-feha-wall-filter]")) {
        node.setAttribute("aria-pressed",String(filter === node.dataset.fehaWallFilter));
      }
    });

    header.append(bar);
    applyFilter(root);
  }

  function applyFilter(root) {
    for (const key of Object.keys(STATES)) root.classList.toggle("feha-wall-only-"+key,filter === key);
  }

  function menu(app,entries) {
    const sceneOf = li => game.scenes.get(li.closest("[data-entry-id]")?.dataset.entryId);

    // Only the states a GM decides; the others come from the walls.
    for (const key of ["done","open","none"]) {
      const info = STATES[key];
      entries.push({
        label:"Walls: " + info.label,
        icon:"fa-solid fa-border-all",
        group:"feha-walls",
        visible:li => game.user?.isGM === true && state(sceneOf(li)) !== key,
        onClick:async (event,li) => { await set(sceneOf(li),key); }
      });
    }
  }

  // A GM drawing walls by hand on an unfinished map marks it GM EDIT.
  function onWallChange(wall,options,userId) {
    if (userId !== game.user?.id || isClaude(wall)) return;

    const scene = wall.parent;
    if (!scene || !["none","border","pack"].includes(state(scene))) return;
    void set(scene,"gm");
  }

  let timer = null;
  const repaint = () => {
    clearTimeout(timer);
    timer = setTimeout(paint,150);
  };

  function onSceneUpdate(scene,change) {
    if (foundry.utils.hasProperty(change,"flags."+NS)) repaint();
  }

  const api = {
    version:VERSION,
    STATES,
    state,
    detect,
    set,
    counts,
    paint,

    async init() {
      await api.destroy();

      if (!game.user?.isGM) {
        console.log("FEHA SCENE WALL STATUS",VERSION,"idle (player)");
        return;
      }

      hooks.push(["renderSceneDirectory",Hooks.on("renderSceneDirectory",repaint)]);
      hooks.push(["getSceneContextOptions",Hooks.on("getSceneContextOptions",menu)]);
      hooks.push(["updateScene",Hooks.on("updateScene",onSceneUpdate)]);
      hooks.push(["createWall",Hooks.on("createWall",onWallChange)]);
      for (const event of ["createWall","deleteWall","createScene","deleteScene"]) {
        hooks.push([event,Hooks.on(event,repaint)]);
      }

      globalThis.FEHA_SCENE_WALL_STATUS = api;
      // Rebuild the directory so the context menu picks up the new entries.
      ui.scenes?.render?.();
      console.log("FEHA SCENE WALL STATUS",VERSION,"ready",counts());
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }

      clearTimeout(timer);
      const root = ui.scenes?.element;
      root?.querySelector?.("."+BAR)?.remove();
      for (const tag of root?.querySelectorAll?.(".feha-wall-tag") ?? []) tag.remove();

      if (globalThis.FEHA_SCENE_WALL_STATUS === api) delete globalThis.FEHA_SCENE_WALL_STATUS;
    }
  };

  core.registerModule("sceneWallStatus",api);
})();
