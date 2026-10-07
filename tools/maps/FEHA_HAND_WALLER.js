// FEHA hand waller: GM-side helpers for walling a map by eye.
// Paste into the Foundry console (FEHA_MAP_WALLER.js first if you want HW.auto).
// Not loaded by the game. The full method is in tools/maps/WALLING.md.
//
// Rule (GM, 2026-10-02): outline every room, including the walls between
// rooms; put a door on each doorway; add lights; put nothing inside rooms.
//
//   HW.report()                            how many maps are in each wall state
//   await HW.next()                        open the next map in the queue
//   await HW.open(sceneId)                 load the full-size picture
//   HW.tiles(sceneId)                      the reading crops for this map
//   HW.view(sceneId,[x0,y0,x1,y1])         show a crop with a percent grid and the proposal
//   HW.prop[sceneId] = {walls,doors,lights,open,note}  all in percent of the map
//        walls:  [[x,y,x,y,...], ...]      polylines
//        doors:  [[x,y,x,y], ...]
//        lights: [[x,y,"#colour",squares], ...]   (leave out to keep the lights as they are)
//        bars:   [[x,y,x,y], ...]          bars, fences, glass: block movement, not sight
//        open:   [[x,y], ...]              wall ends left open on purpose (checked)
//   HW.simplify(sceneId)                   after HW.auto: join and straighten the traced outline
//   HW.tidy(sceneId)                       straighten lines, join near-miss corners
//   HW.check(sceneId)                      loose ends and other mistakes
//   await HW.commit(sceneId,{state})       write it; state "done" or "open"
//   HW.verify(sceneId,crop)                show what is really on the scene now
//   await HW.undo(sceneId)                 back to the walls before the last commit
(() => {
  const NS = "fleshEnshrouded";
  const prop = {};
  const images = {};
  const today = () => new Date().toISOString().slice(0,10);

  async function open(id) {
    const scene = game.scenes.get(id);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = scene.background.src;
    await img.decode();
    images[id] = img;

    const d = scene.dimensions;
    return {
      id,name:scene.name,px:d.sceneWidth + "x" + d.sceneHeight,grid:scene.grid.size,
      squares:Math.round(d.sceneWidth / scene.grid.size) + "x" + Math.round(d.sceneHeight / scene.grid.size),
      walls:scene.walls.size,lights:scene.lights.size,state:stateOf(scene),
      folder:scene.folder?.name ?? "",tiles:tiles(id)
    };
  }

  // Reading crops: about 10 grid squares a side, overlapping by 2%, so wall
  // lines are thick enough to place within half a percent.
  function tiles(id,squares = 10) {
    const scene = game.scenes.get(id);
    const d = scene.dimensions;
    const nx = Math.max(1,Math.ceil(d.sceneWidth / scene.grid.size / squares));
    const ny = Math.max(1,Math.ceil(d.sceneHeight / scene.grid.size / squares));
    const span = (n,i) => [Math.max(0,Math.round(i * 100 / n - 2)),Math.min(100,Math.round((i + 1) * 100 / n + 2))];
    const out = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const [x0,x1] = span(nx,i), [y0,y1] = span(ny,j);
      out.push([x0,y0,x1,y1]);
    }
    return out;
  }

  function sheet(id,crop) {
    document.getElementById("__sheet")?.remove();

    const img = images[id];
    if (!img) throw new Error("Run await HW.open(id) first.");
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

    root.append(cv);
    document.documentElement.append(root);
    return {g,X,Y};
  }

  function draw({g,X,Y},P,loose = []) {
    g.lineWidth = 3;
    g.strokeStyle = "#ff2bd6";
    for (const line of P.walls ?? []) {
      g.beginPath();
      for (let i = 0; i < line.length; i += 2) i ? g.lineTo(X(line[i]),Y(line[i + 1])) : g.moveTo(X(line[i]),Y(line[i + 1]));
      g.stroke();
    }
    g.lineWidth = 3;
    g.strokeStyle = "#00e5ff";
    g.setLineDash([6,4]);
    for (const d of P.bars ?? []) { g.beginPath(); g.moveTo(X(d[0]),Y(d[1])); g.lineTo(X(d[2]),Y(d[3])); g.stroke(); }
    g.setLineDash([]);
    g.lineWidth = 5;
    g.strokeStyle = "#00ff66";
    for (const d of P.doors ?? []) { g.beginPath(); g.moveTo(X(d[0]),Y(d[1])); g.lineTo(X(d[2]),Y(d[3])); g.stroke(); }
    for (const [x,y,color] of P.lights ?? []) {
      g.beginPath(); g.arc(X(x),Y(y),8,0,7); g.fillStyle = color; g.fill();
      g.lineWidth = 2; g.strokeStyle = "#000"; g.stroke();
    }
    // Loose ends from HW.check: white rings.
    g.lineWidth = 2;
    g.strokeStyle = "#ffffff";
    for (const [x,y] of loose) { g.beginPath(); g.arc(X(x),Y(y),10,0,7); g.stroke(); }
  }

  // The proposal over the picture.
  function view(id,crop = [0,0,100,100]) {
    const P = prop[id] ?? {};
    draw(sheet(id,crop),P,P.walls ? check(id).loose : []);
    return game.scenes.get(id).name + " " + crop.join(",");
  }

  // What is really on the scene now (walls magenta, doors green, lights dots).
  function verify(id,crop = [0,0,100,100]) {
    const scene = game.scenes.get(id);
    const d = scene.dimensions;
    const pc = (x,y) => [(x - d.sceneX) / d.sceneWidth * 100,(y - d.sceneY) / d.sceneHeight * 100];
    const P = {walls:[],doors:[],lights:[]};
    for (const w of scene.walls) (w.door ? P.doors : P.walls).push([...pc(w.c[0],w.c[1]),...pc(w.c[2],w.c[3])]);
    for (const l of scene.lights) P.lights.push([...pc(l.x,l.y),l.config.color ?? "#ffffff"]);
    draw(sheet(id,crop),P);
    return scene.name + " (on the scene) " + crop.join(",") + ": " + P.walls.length + " walls, " + P.doors.length + " doors, " + P.lights.length + " lights";
  }

  // Segments as [x0,y0,x1,y1] in percent.
  const segments = P => (P.walls ?? []).flatMap(line => {
    const out = [];
    for (let i = 0; i + 3 < line.length; i += 2) out.push([line[i],line[i + 1],line[i + 2],line[i + 3]]);
    return out;
  });

  // Straighten nearly level / upright lines and pull corners that almost
  // meet onto one point, so rooms close and lines stay square.
  function tidy(id,{straight = 0.6,join = 0.8} = {}) {
    const P = prop[id];
    const points = [];
    const snap = (x,y) => {
      for (const p of points) if (Math.hypot(p[0] - x,p[1] - y) <= join) return p;
      const p = [x,y];
      points.push(p);
      return p;
    };
    const round = v => Math.round(v * 10) / 10;
    let straightened = 0;

    for (const line of P.walls ?? []) {
      for (let i = 0; i + 3 < line.length; i += 2) {
        if (Math.abs(line[i + 1] - line[i + 3]) <= straight && Math.abs(line[i] - line[i + 2]) > straight) {
          const y = round((line[i + 1] + line[i + 3]) / 2);
          if (line[i + 1] !== y || line[i + 3] !== y) straightened++;
          line[i + 1] = line[i + 3] = y;
        } else if (Math.abs(line[i] - line[i + 2]) <= straight && Math.abs(line[i + 1] - line[i + 3]) > straight) {
          const x = round((line[i] + line[i + 2]) / 2);
          if (line[i] !== x || line[i + 2] !== x) straightened++;
          line[i] = line[i + 2] = x;
        }
      }
    }
    const all = [...(P.walls ?? []),...(P.doors ?? [])];
    for (const line of all) {
      for (let i = 0; i + 1 < line.length; i += 2) {
        const p = snap(line[i],line[i + 1]);
        line[i] = p[0];
        line[i + 1] = p[1];
      }
    }
    return {straightened,points:points.length};
  }

  // Loose ends: a wall or door end that touches nothing else and is not on
  // the map edge. Most are gaps players could see or walk through. Ends of a
  // deliberate opening go in P.open ([[x,y],...]) once checked by eye.
  function check(id) {
    const P = prop[id] ?? {};
    const ends = [];
    const segs = segments(P);
    const doors = P.doors ?? [];
    const near = 0.35;
    const onSeg = (x,y,s) => {
      const [a,b,c,d] = s, dx = c - a, dy = d - b, len = dx * dx + dy * dy;
      if (!len) return false;
      const t = Math.max(0,Math.min(1,((x - a) * dx + (y - b) * dy) / len));
      return Math.hypot(a + t * dx - x,b + t * dy - y) <= near;
    };
    const all = [...segs.map(s => ({s,door:false})),...doors.map(s => ({s,door:true})),...(P.bars ?? []).map(s => ({s,door:false}))];
    for (const [i,{s}] of all.entries()) ends.push([s[0],s[1],i],[s[2],s[3],i]);

    const loose = [];
    for (const [x,y,i] of ends) {
      if (x <= 0.5 || y <= 0.5 || x >= 99.5 || y >= 99.5) continue;
      if ((P.open ?? []).some(([ox,oy]) => Math.hypot(ox - x,oy - y) <= 0.8)) continue;
      const touches = all.some(({s},j) => j !== i && onSeg(x,y,s));
      if (!touches) loose.push([Math.round(x * 10) / 10,Math.round(y * 10) / 10]);
    }

    const tiny = all.filter(({s}) => Math.hypot(s[2] - s[0],s[3] - s[1]) < 0.3).length;
    const outside = (P.lights ?? []).filter(([x,y]) => x < 0 || y < 0 || x > 100 || y > 100).length;
    const doorsHanging = doors.filter(s => ![[s[0],s[1]],[s[2],s[3]]].every(([x,y]) => segs.some(w => onSeg(x,y,w)))).length;
    return {walls:segs.length,doors:doors.length,lights:(P.lights ?? []).length,loose,tiny,lightsOutside:outside,doorsHanging};
  }

  function hsv(hex) {
    const m = hex.match(/\w\w/g).map(x => parseInt(x,16) / 255);
    const max = Math.max(...m), min = Math.min(...m), d = max - min;
    let h = 0;
    if (d) { h = max === m[0] ? ((m[1] - m[2]) / d) % 6 : max === m[1] ? (m[2] - m[0]) / d + 2 : (m[0] - m[1]) / d + 4; h *= 60; if (h < 0) h += 360; }
    return {h,s:max ? d / max : 0};
  }

  const wallData = w => ({c:[...w.c],move:w.move,sight:w.sight,light:w.light,sound:w.sound,door:w.door,ds:w.ds,dir:w.dir,flags:foundry.utils.deepClone(w.flags ?? {})});

  // state: "done" (rooms walled) or "open" (no walls needed, lights only).
  // replace: also remove walls this tool did not make (the pack's or the
  // automatic border); they are saved on the scene first for HW.undo.
  async function commit(id,{state,replace = false,note} = {}) {
    const scene = game.scenes.get(id);
    const d = scene.dimensions;
    const P = prop[id];
    if (!P) throw new Error("No proposal for " + id);
    state ??= (P.walls ?? []).length ? "done" : "open";
    const TAG = {[NS]:{walledBy:"claude",walledOn:today(),hand:true}};
    const pt = (x,y) => [Math.round(d.sceneX + x / 100 * d.sceneWidth),Math.round(d.sceneY + y / 100 * d.sceneHeight)];
    const full = {move:20,sight:20,light:20,sound:20};
    const walls = [];

    for (const [x0,y0,x1,y1] of segments(P)) walls.push({c:[...pt(x0,y0),...pt(x1,y1)],...full,door:0,flags:TAG});
    for (const q of P.doors ?? []) walls.push({c:[...pt(q[0],q[1]),...pt(q[2],q[3])],...full,door:1,ds:0,flags:TAG});
    // Bars, fences, glass: block movement only.
    for (const q of P.bars ?? []) walls.push({c:[...pt(q[0],q[1]),...pt(q[2],q[3])],move:20,sight:0,light:0,sound:0,door:0,flags:TAG});

    // Neon colours pulse slowly, warm orange flickers faintly, the rest is static.
    const lights = (P.lights ?? []).map(([x,y,color,squares = 4]) => {
      const {h,s} = hsv(color);
      const animation = (s >= 0.5 && !(h >= 20 && h <= 65)) ? {type:"pulse",speed:2,intensity:2}
        : (s >= 0.45 && h >= 20 && h <= 45) ? {type:"torch",speed:2,intensity:1} : {type:null};
      const [X,Y] = pt(x,y);
      return {x:X,y:Y,walls:true,vision:false,flags:TAG,config:{dim:Math.min(squares,6) * scene.grid.distance,bright:0,color,alpha:0.08,angle:360,luminosity:0,attenuation:0.85,coloration:1,animation}};
    });

    // A proposal without a lights list leaves the lights alone.
    const touchLights = Array.isArray(P.lights);

    // Snapshot for undo: every wall and every light of ours, as they are now.
    const mine = doc => doc.flags?.[NS]?.walledBy === "claude";
    const before = {
      on:today(),
      walls:scene.walls.map(wallData),
      lights:scene.lights.filter(mine).map(l => l.toObject())
    };

    const removeWalls = scene.walls.filter(w => replace || mine(w)).map(w => w.id);
    const removeLights = touchLights ? scene.lights.filter(mine).map(l => l.id) : [];
    if (removeWalls.length) await scene.deleteEmbeddedDocuments("Wall",removeWalls);
    if (walls.length) await scene.createEmbeddedDocuments("Wall",walls);
    if (removeLights.length) await scene.deleteEmbeddedDocuments("AmbientLight",removeLights);
    if (lights.length) await scene.createEmbeddedDocuments("AmbientLight",lights);

    const doors = (P.doors ?? []).length;
    await scene.update({
      [`flags.${NS}.mapPass`]:{by:"claude",on:today(),walls:walls.length,doors,lights:touchLights ? lights.length : "kept",hand:true,rule:2},
      [`flags.${NS}.proposal`]:P,
      [`flags.${NS}.undo`]:before,
      [`flags.${NS}.wallStatus`]:{state,by:"claude",on:today(),walls:scene.walls.size,doors:scene.walls.filter(w => w.door).length,lights:scene.lights.size,note:note ?? P.note ?? ""}
    });
    return `${scene.name}: ${walls.length} walls (${doors} doors), ${touchLights ? lights.length + " lights" : "lights kept"}, marked ${state}`;
  }

  // Put back the walls and our lights from before the last commit.
  async function undo(id) {
    const scene = game.scenes.get(id);
    const before = scene.flags?.[NS]?.undo;
    if (!before) return "Nothing to undo on " + scene.name;
    const mine = doc => doc.flags?.[NS]?.walledBy === "claude";

    await scene.deleteEmbeddedDocuments("Wall",scene.walls.map(w => w.id));
    if (before.walls.length) await scene.createEmbeddedDocuments("Wall",before.walls);
    const ours = scene.lights.filter(mine).map(l => l.id);
    if (ours.length) await scene.deleteEmbeddedDocuments("AmbientLight",ours);
    if (before.lights.length) await scene.createEmbeddedDocuments("AmbientLight",before.lights.map(l => { delete l._id; return l; }));
    await scene.update({[`flags.${NS}.-=undo`]:null,[`flags.${NS}.-=wallStatus`]:null,[`flags.${NS}.-=mapPass`]:null});
    return `${scene.name}: back to ${before.walls.length} walls from ${before.on}`;
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
    prop[id] = {walls,doors:[]};
    return out;
  }

  // Join the proposal's segments into chains and straighten them: points
  // closer than tol (percent) to the line are dropped, chains shorter than
  // minLength are thrown away (specks the tracer picked up). Use after HW.auto.
  function simplify(id,{tol = 0.5,minLength = 2} = {}) {
    const P = prop[id];
    const key = (x,y) => Math.round(x * 10) + "_" + Math.round(y * 10);
    const ends = new Map();
    const segs = segments(P).map((s,i) => ({s,i,used:false}));
    for (const g of segs) for (const k of [key(g.s[0],g.s[1]),key(g.s[2],g.s[3])]) (ends.get(k) ?? ends.set(k,[]).get(k)).push(g);

    const chains = [];
    for (const start of segs) {
      if (start.used) continue;
      start.used = true;
      const pts = [[start.s[0],start.s[1]],[start.s[2],start.s[3]]];
      for (const forward of [true,false]) {
        for (;;) {
          const tip = forward ? pts[pts.length - 1] : pts[0];
          const next = (ends.get(key(...tip)) ?? []).find(g => !g.used);
          if (!next) break;
          next.used = true;
          const a = [next.s[0],next.s[1]], b = [next.s[2],next.s[3]];
          const far = key(...a) === key(...tip) ? b : a;
          forward ? pts.push(far) : pts.unshift(far);
        }
      }
      chains.push(pts);
    }

    const rdp = (pts) => {
      if (pts.length < 3) return pts;
      const [a,b] = [pts[0],pts[pts.length - 1]];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx,dy);
      let worst = 0, at = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = len ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len : Math.hypot(pts[i][0] - a[0],pts[i][1] - a[1]);
        if (d > worst) { worst = d; at = i; }
      }
      return worst > tol ? [...rdp(pts.slice(0,at + 1)).slice(0,-1),...rdp(pts.slice(at))] : [a,b];
    };
    const length = pts => pts.slice(1).reduce((sum,p,i) => sum + Math.hypot(p[0] - pts[i][0],p[1] - pts[i][1]),0);
    const r = v => Math.round(v * 10) / 10;

    P.walls = chains.filter(c => length(c) >= minLength).map(c => rdp(c).flatMap(([x,y]) => [r(x),r(y)]));
    return {chains:chains.length,kept:P.walls.length,segments:segments(P).length};
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

    for (const s of segments(P)) {
      const c0 = horizontal ? s[1] : s[0], c1 = horizontal ? s[3] : s[2];
      const t0 = horizontal ? s[0] : s[1], t1 = horizontal ? s[2] : s[3];
      const lo = Math.min(t0,t1), hi = Math.max(t0,t1);

      if (Math.abs(c0 - c) <= tolerance && Math.abs(c1 - c) <= tolerance && hi > a && lo < b) {
        cut++;
        if (lo < a) out.push(horizontal ? [lo,c,a,c] : [c,lo,c,a]);
        if (hi > b) out.push(horizontal ? [b,c,hi,c] : [c,b,c,hi]);
      } else out.push(s);
    }

    P.walls = out;
    (P.doors ??= []).push(horizontal ? [a,c,b,c] : [c,a,c,b]);
    return cut;
  }

  // Wall state, from the game's labels when they are loaded.
  function stateOf(scene) {
    const status = globalThis.FEHA_SCENE_WALL_STATUS;
    if (status) return status.state(scene);
    const saved = scene.flags?.[NS]?.wallStatus?.state;
    if (saved) return saved;
    if (scene.flags?.[NS]?.mapPass?.rule === 2) return scene.walls.size ? "done" : "open";
    return scene.walls.size ? "unchecked" : "none";
  }

  // Maps still to do: Nebula first, then the campaign, then the rest;
  // within each, no walls before border-only before pack walls.
  const ORDER = {none:0,border:1,gm:2,pack:3,unchecked:3};
  const queue = () => game.scenes
    .filter(s => s.background?.src && !["done","open"].includes(stateOf(s)))
    .sort((a,b) => {
      const group = s => s.flags?.[NS]?.nebula ? 0 : (s.folder?.name === "CAMPAIGN" || s.folder?.folder?.name === "CAMPAIGN") ? 1 : 2;
      return group(a) - group(b) || (ORDER[stateOf(a)] ?? 4) - (ORDER[stateOf(b)] ?? 4) || a.name.localeCompare(b.name);
    });

  async function next() {
    const scene = queue()[0];
    if (!scene) return "Every map is walled or marked open.";
    return open(scene.id);
  }

  function report() {
    const out = {};
    for (const s of game.scenes) out[stateOf(s)] = (out[stateOf(s)] ?? 0) + 1;
    const nebula = game.scenes.filter(s => s.flags?.[NS]?.nebula);
    out.nebulaLeft = nebula.filter(s => !["done","open"].includes(stateOf(s))).length + " of " + nebula.length;
    out.queue = queue().length;
    return out;
  }

  globalThis.HW = {open,tiles,view,verify,tidy,simplify,check,commit,undo,prop,queue,next,report,auto,door,close:() => document.getElementById("__sheet")?.remove()};
})();
