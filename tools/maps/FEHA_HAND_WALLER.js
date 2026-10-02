// FEHA hand waller: GM-side helpers for walling a map by eye.
// Paste into the Foundry console after FEHA_MAP_WALLER.js. Not loaded by the game.
//
// Rule (GM, 2026-10-02): outline every room, including the walls between
// rooms; put a door on each doorway; add lights; put nothing inside rooms.
//
//   await HW.open(sceneId)                 load the full-size picture
//   HW.view(sceneId,[x0,y0,x1,y1])         show a crop with a percent grid and the proposal
//   HW.prop[sceneId] = {walls,doors,lights}  all in percent of the map
//        walls:  [[x,y,x,y,...], ...]      polylines
//        doors:  [[x,y,x,y], ...]
//        lights: [[x,y,"#colour",squares], ...]
//   await HW.commit(sceneId)               write it (replaces this tool's earlier work)
(() => {
  const NS = "fleshEnshrouded";
  const prop = {};
  const images = {};

  async function open(id) {
    const scene = game.scenes.get(id);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = scene.background.src;
    await img.decode();
    images[id] = img;

    const d = scene.dimensions;
    return {id,name:scene.name,px:d.sceneWidth + "x" + d.sceneHeight,grid:scene.grid.size,walls:scene.walls.size,lights:scene.lights.size};
  }

  function view(id,crop = [0,0,100,100]) {
    document.getElementById("__sheet")?.remove();

    const img = images[id];
    const [x0,y0,x1,y1] = crop;
    const sx = img.naturalWidth * x0 / 100, sy = img.naturalHeight * y0 / 100;
    const sw = img.naturalWidth * (x1 - x0) / 100, sh = img.naturalHeight * (y1 - y0) / 100;
    const root = document.createElement("div");
    root.id = "__sheet";
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#111;display:flex;align-items:center;justify-content:center";

    const cv = document.createElement("canvas");
    const scale = Math.min(window.innerWidth / sw,window.innerHeight / sh);
    cv.width = Math.round(sw * scale);
    cv.height = Math.round(sh * scale);
    const g = cv.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(img,sx,sy,sw,sh,0,0,cv.width,cv.height);

    const X = p => (p - x0) / (x1 - x0) * cv.width;
    const Y = p => (p - y0) / (y1 - y0) * cv.height;
    const span = Math.max(x1 - x0,y1 - y0);
    const step = span > 60 ? 5 : span > 30 ? 2.5 : 1;
    const label = span > 30 ? 5 : 2;
    const major = p => Math.abs(p / label - Math.round(p / label)) < 1e-6;

    g.font = "13px monospace";
    for (let p = Math.ceil(x0 / step) * step; p <= x1 + 1e-6; p += step) {
      g.strokeStyle = major(p) ? "#ffffff66" : "#ffffff22";
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(X(p),0); g.lineTo(X(p),cv.height); g.stroke();
      if (major(p)) { g.fillStyle = "#000"; g.fillRect(X(p) + 1,0,26,15); g.fillStyle = "#ff0"; g.fillText(String(p),X(p) + 2,12); }
    }
    for (let p = Math.ceil(y0 / step) * step; p <= y1 + 1e-6; p += step) {
      g.strokeStyle = major(p) ? "#ffffff66" : "#ffffff22";
      g.beginPath(); g.moveTo(0,Y(p)); g.lineTo(cv.width,Y(p)); g.stroke();
      if (major(p)) { g.fillStyle = "#000"; g.fillRect(0,Y(p) + 1,26,15); g.fillStyle = "#ff0"; g.fillText(String(p),2,Y(p) + 13); }
    }

    const P = prop[id];
    if (P) {
      g.lineWidth = 3;
      g.strokeStyle = "#ff2bd6";
      for (const line of P.walls ?? []) {
        g.beginPath();
        for (let i = 0; i < line.length; i += 2) i ? g.lineTo(X(line[i]),Y(line[i + 1])) : g.moveTo(X(line[i]),Y(line[i + 1]));
        g.stroke();
      }
      g.lineWidth = 5;
      g.strokeStyle = "#00ff66";
      for (const d of P.doors ?? []) { g.beginPath(); g.moveTo(X(d[0]),Y(d[1])); g.lineTo(X(d[2]),Y(d[3])); g.stroke(); }
      for (const [x,y,color] of P.lights ?? []) {
        g.beginPath(); g.arc(X(x),Y(y),8,0,7); g.fillStyle = color; g.fill();
        g.lineWidth = 2; g.strokeStyle = "#000"; g.stroke();
      }
    }

    root.append(cv);
    document.documentElement.append(root);
    return game.scenes.get(id).name + " " + crop.join(",");
  }

  function hsv(hex) {
    const m = hex.match(/\w\w/g).map(x => parseInt(x,16) / 255);
    const max = Math.max(...m), min = Math.min(...m), d = max - min;
    let h = 0;
    if (d) { h = max === m[0] ? ((m[1] - m[2]) / d) % 6 : max === m[1] ? (m[2] - m[0]) / d + 2 : (m[0] - m[1]) / d + 4; h *= 60; if (h < 0) h += 360; }
    return {h,s:max ? d / max : 0};
  }

  async function commit(id) {
    const scene = game.scenes.get(id);
    const d = scene.dimensions;
    const P = prop[id];
    const TAG = {[NS]:{walledBy:"claude",walledOn:"2026-10-02",hand:true}};
    const pt = (x,y) => [Math.round(d.sceneX + x / 100 * d.sceneWidth),Math.round(d.sceneY + y / 100 * d.sceneHeight)];
    const full = {move:20,sight:20,light:20,sound:20};
    const walls = [];

    for (const line of P.walls ?? []) {
      for (let i = 0; i + 3 < line.length; i += 2) walls.push({c:[...pt(line[i],line[i + 1]),...pt(line[i + 2],line[i + 3])],...full,door:0,flags:TAG});
    }
    for (const q of P.doors ?? []) walls.push({c:[...pt(q[0],q[1]),...pt(q[2],q[3])],...full,door:1,ds:0,flags:TAG});

    // Neon colours pulse slowly, warm orange flickers faintly, the rest is static.
    const lights = (P.lights ?? []).map(([x,y,color,squares = 4]) => {
      const {h,s} = hsv(color);
      const animation = (s >= 0.5 && !(h >= 20 && h <= 65)) ? {type:"pulse",speed:2,intensity:2}
        : (s >= 0.45 && h >= 20 && h <= 45) ? {type:"torch",speed:2,intensity:1} : {type:null};
      const [X,Y] = pt(x,y);
      return {x:X,y:Y,walls:true,vision:false,flags:TAG,config:{dim:Math.min(squares,6) * scene.grid.distance,bright:0,color,alpha:0.08,angle:360,luminosity:0,attenuation:0.85,coloration:1,animation}};
    });

    const mine = doc => doc.flags?.[NS]?.walledBy === "claude";
    const oldWalls = scene.walls.filter(mine).map(w => w.id);
    const oldLights = scene.lights.filter(mine).map(l => l.id);
    if (oldWalls.length) await scene.deleteEmbeddedDocuments("Wall",oldWalls);
    if (walls.length) await scene.createEmbeddedDocuments("Wall",walls);
    if (oldLights.length) await scene.deleteEmbeddedDocuments("AmbientLight",oldLights);
    if (lights.length) await scene.createEmbeddedDocuments("AmbientLight",lights);

    await scene.update({[`flags.${NS}.mapPass`]:{by:"claude",on:"2026-10-02",walls:walls.length,doors:(P.doors ?? []).length,lights:lights.length,hand:true,rule:2},[`flags.${NS}.proposal`]:P});
    return `${scene.name}: ${walls.length} walls (${(P.doors ?? []).length} doors), ${lights.length} lights`;
  }

  // Outline from the automatic waller, as percent segments. Only good on maps
  // drawn on a flat black surround; always check it by eye before committing.
  // Start with dark:3 (pure black only); raise it if the outline has gaps.
  async function auto(id,options = {}) {
    Object.assign(FEHAMapWaller.opts,{gw:960,dark:3,open:3,close:0,tol:2.2,minArea:0.002,islands:true,doors:false,whiteLights:true},options);
    delete FEHAMapWaller.results[id];
    const out = await FEHAMapWaller.analyze([id]);
    const scene = game.scenes.get(id);
    const d = scene.dimensions;
    const pc = (x,y) => [Math.round((x - d.sceneX) / d.sceneWidth * 1000) / 10,Math.round((y - d.sceneY) / d.sceneHeight * 1000) / 10];
    const walls = FEHAMapWaller.results[id].walls.filter(w => !w.door).map(w => [...pc(w.c[0],w.c[1]),...pc(w.c[2],w.c[3])]);
    prop[id] = {walls,doors:[],lights:[]};
    return out;
  }

  // Cut a doorway out of the proposal: the part of any wall segment lying
  // along the door line is removed and a door is put in its place.
  function door(id,line,tolerance = 1.2) {
    const P = prop[id];
    const [x0,y0,x1,y1] = line;
    const horizontal = Math.abs(y1 - y0) < Math.abs(x1 - x0);
    const a = horizontal ? Math.min(x0,x1) : Math.min(y0,y1);
    const b = horizontal ? Math.max(x0,x1) : Math.max(y0,y1);
    const c = horizontal ? (y0 + y1) / 2 : (x0 + x1) / 2;
    const out = [];
    let cut = 0;

    for (const w of P.walls) {
      for (let i = 0; i + 3 < w.length; i += 2) {
        const s = [w[i],w[i + 1],w[i + 2],w[i + 3]];
        const c0 = horizontal ? s[1] : s[0], c1 = horizontal ? s[3] : s[2];
        const t0 = horizontal ? s[0] : s[1], t1 = horizontal ? s[2] : s[3];
        const lo = Math.min(t0,t1), hi = Math.max(t0,t1);

        if (Math.abs(c0 - c) <= tolerance && Math.abs(c1 - c) <= tolerance && hi > a && lo < b) {
          cut++;
          if (lo < a) out.push(horizontal ? [lo,c,a,c] : [c,lo,c,a]);
          if (hi > b) out.push(horizontal ? [b,c,hi,c] : [c,b,c,hi]);
        } else out.push(s);
      }
    }

    P.walls = out;
    (P.doors ??= []).push(horizontal ? [a,c,b,c] : [c,a,c,b]);
    return cut;
  }

  // Scenes still waiting for the rule-2 hand pass, Nebula maps first.
  const queue = () => game.scenes
    .filter(s => s.flags?.[NS]?.mapPass?.rule !== 2 && s.background?.src)
    .sort((a,b) => (b.flags?.[NS]?.nebula ? 1 : 0) - (a.flags?.[NS]?.nebula ? 1 : 0) || a.name.localeCompare(b.name));

  globalThis.HW = {open,view,commit,prop,queue,auto,door,close:() => document.getElementById("__sheet")?.remove()};
})();
