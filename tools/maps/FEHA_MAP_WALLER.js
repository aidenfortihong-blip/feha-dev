// FEHA map waller: a GM-side helper pasted into the Foundry console.
// It is not loaded by the game loader.
//
// Recipe (set by the GM on 2026-10-01):
//   - walls go on the edge of the black area around the artwork, so the
//     drawn walls stay visible to players
//   - no furniture walls, no doors
//   - one faint light per lit fixture, in the colour of that fixture
//   - global light on
//
// Use:
//   await FEHAMapWaller.analyze(sceneIds)   work out walls and lights, keep them in memory
//   FEHAMapWaller.sheet(sceneIds)           show a contact sheet of the proposals
//   await FEHAMapWaller.apply(sceneIds)     write them to the scenes
//   await FEHAMapWaller.undo(sceneIds)      remove everything this tool wrote
(() => {
  const NS = "fleshEnshrouded";
  const TAG = {[NS]:{walledBy:"claude",walledOn:"2026-10-01",auto:true}};
  // dark: a cell is "black" when its brightest channel is below this
  // open: how many cells of thin dark detail to ignore
  // tol:  how far (in cells) a wall may cut a corner when straightening
  // close: bridge thin bright lines (a grid drawn over the black) before anything else
  // gw: analysis grid width in cells
  // islands: keep black areas that do not reach the map edge (pillars, pits)
  // doors: bridge door-sized gaps in a black wall line with a door
  const opts = {gw:640,dark:8,open:3,close:0,tol:2.2,minArea:0.004,islands:true,doors:false};
  const LIGHT_ALPHA = 0.08;
  const MAX_LIGHTS = 10;

  const results = {};

  async function loadGrid(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();

    const gw = opts.gw;
    const gh = Math.max(1,Math.round(opts.gw * img.naturalHeight / img.naturalWidth));
    const cv = document.createElement("canvas");
    cv.width = gw;
    cv.height = gh;
    const g = cv.getContext("2d",{willReadFrequently:true});
    g.drawImage(img,0,0,gw,gh);

    return {gw,gh,cv,data:g.getImageData(0,0,gw,gh).data};
  }

  // Connected areas of a mask. Returns a label per cell and the size of each label.
  function components(mask,gw,gh) {
    const label = new Int32Array(gw * gh);
    const sizes = [0];
    const stack = [];

    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || label[start]) continue;

      const id = sizes.length;
      let size = 0;
      label[start] = id;
      stack.push(start);

      while (stack.length) {
        const cell = stack.pop();
        const x = cell % gw;
        size++;

        if (x > 0 && mask[cell - 1] && !label[cell - 1]) { label[cell - 1] = id; stack.push(cell - 1); }
        if (x < gw - 1 && mask[cell + 1] && !label[cell + 1]) { label[cell + 1] = id; stack.push(cell + 1); }
        if (cell >= gw && mask[cell - gw] && !label[cell - gw]) { label[cell - gw] = id; stack.push(cell - gw); }
        if (cell < mask.length - gw && mask[cell + gw] && !label[cell + gw]) { label[cell + gw] = id; stack.push(cell + gw); }
      }

      sizes.push(size);
    }

    return {label,sizes};
  }

  function erode(mask,gw,gh) {
    const out = new Uint8Array(mask.length);

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        if (!mask[i]) continue;

        // The image edge counts as black, so a border touching the edge survives.
        const left = x === 0 || mask[i - 1];
        const right = x === gw - 1 || mask[i + 1];
        const up = y === 0 || mask[i - gw];
        const down = y === gh - 1 || mask[i + gw];
        out[i] = left && right && up && down ? 1 : 0;
      }
    }

    return out;
  }

  function dilate(mask,gw,gh) {
    const out = new Uint8Array(mask.length);

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        out[i] = mask[i]
          || (x > 0 && mask[i - 1])
          || (x < gw - 1 && mask[i + 1])
          || (y > 0 && mask[i - gw])
          || (y < gh - 1 && mask[i + gw]) ? 1 : 0;
      }
    }

    return out;
  }

  // The black area outside (and between) the rooms.
  function blackMask(data,gw,gh,flat = null) {
    const total = gw * gh;
    let mask = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      const o = i * 4;
      mask[i] = flat
        ? (Math.abs(data[o] - flat[0]) <= 7 && Math.abs(data[o + 1] - flat[1]) <= 7 && Math.abs(data[o + 2] - flat[2]) <= 7 ? 1 : 0)
        : (Math.max(data[o],data[o + 1],data[o + 2]) < opts.dark ? 1 : 0);
    }

    // Drop thin dark lines and specks, then grow back.
    for (let i = 0; i < opts.close; i++) mask = dilate(mask,gw,gh);
    for (let i = 0; i < opts.close; i++) mask = erode(mask,gw,gh);
    for (let i = 0; i < opts.open; i++) mask = erode(mask,gw,gh);
    for (let i = 0; i < opts.open; i++) mask = dilate(mask,gw,gh);

    // Keep only large black areas.
    const dark = components(mask,gw,gh);
    const keep = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      if (dark.label[i] && dark.sizes[dark.label[i]] >= total * opts.minArea) keep[i] = 1;
    }

    if (!opts.islands) {
      // Only black that reaches the map edge counts: the outside, and the
      // wall lines growing in from it. Black furniture in a room is dropped.
      const edge = new Set();
      for (let x = 0; x < gw; x++) { edge.add(dark.label[x]); edge.add(dark.label[(gh - 1) * gw + x]); }
      for (let y = 0; y < gh; y++) { edge.add(dark.label[y * gw]); edge.add(dark.label[y * gw + gw - 1]); }
      for (let i = 0; i < total; i++) if (keep[i] && !edge.has(dark.label[i])) keep[i] = 0;
    }

    // Fill small bright islands inside the black.
    const inverse = new Uint8Array(total);
    for (let i = 0; i < total; i++) inverse[i] = keep[i] ? 0 : 1;
    const open = components(inverse,gw,gh);

    for (let i = 0; i < total; i++) {
      if (open.label[i] && open.sizes[open.label[i]] < total * 0.0008) keep[i] = 1;
    }

    return keep;
  }

  function simplify(points,tolerance) {
    if (points.length < 3) return points;

    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0,points.length - 1]];

    while (stack.length) {
      const [a,b] = stack.pop();
      const [ax,ay] = points[a];
      const [bx,by] = points[b];
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx,dy) || 1;
      let worst = -1;
      let distance = 0;

      for (let i = a + 1; i < b; i++) {
        const d = dx === 0 && dy === 0
          ? Math.hypot(points[i][0] - ax,points[i][1] - ay)
          : Math.abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / length;

        if (d > distance) { distance = d; worst = i; }
      }

      if (distance > tolerance) {
        keep[worst] = 1;
        stack.push([a,worst],[worst,b]);
      }
    }

    return points.filter((_,i) => keep[i]);
  }

  // Walk the edge between black and not-black and return it as polylines
  // in grid-corner coordinates. The image edge itself is never a wall.
  function trace(mask,gw,gh) {
    const vw = gw + 1;
    const next = new Map();          // start corner -> [end corners]
    const incoming = new Map();
    const add = (ax,ay,bx,by) => {
      const a = ay * vw + ax;
      const b = by * vw + bx;
      if (!next.has(a)) next.set(a,[]);
      next.get(a).push(b);
      incoming.set(b,(incoming.get(b) ?? 0) + 1);
    };

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (!mask[y * gw + x]) continue;

        if (y > 0 && !mask[(y - 1) * gw + x]) add(x,y,x + 1,y);
        if (x < gw - 1 && !mask[y * gw + x + 1]) add(x + 1,y,x + 1,y + 1);
        if (y < gh - 1 && !mask[(y + 1) * gw + x]) add(x + 1,y + 1,x,y + 1);
        if (x > 0 && !mask[y * gw + x - 1]) add(x,y + 1,x,y);
      }
    }

    const lines = [];
    const walk = start => {
      const line = [start];
      let at = start;

      while (next.get(at)?.length) {
        at = next.get(at).pop();
        line.push(at);
        if (at === start) break;
      }

      return line;
    };

    // Open runs first (they start where nothing leads in), then closed loops.
    for (const start of [...next.keys()]) {
      while ((next.get(start)?.length ?? 0) > (incoming.get(start) ?? 0)) {
        incoming.set(start,(incoming.get(start) ?? 0) + 1);
        lines.push(walk(start));
      }
    }

    for (const start of [...next.keys()]) {
      while (next.get(start)?.length) lines.push(walk(start));
    }

    return lines
      .map(line => line.map(v => [v % vw,Math.floor(v / vw)]))
      .filter(line => line.length > 24)
      .map(line => {
        const closed = line[0][0] === line.at(-1)[0] && line[0][1] === line.at(-1)[1];
        if (!closed) return simplify(line,opts.tol);

        // Split a loop at its farthest point so both halves simplify cleanly.
        let far = 0;
        let best = 0;

        for (let i = 1; i < line.length - 1; i++) {
          const d = Math.hypot(line[i][0] - line[0][0],line[i][1] - line[0][1]);
          if (d > best) { best = d; far = i; }
        }

        return [
          ...simplify(line.slice(0,far + 1),opts.tol),
          ...simplify(line.slice(far),opts.tol).slice(1)
        ];
      });
  }

  function vivid(r,g,b) {
    const max = Math.max(r,g,b);
    const min = Math.min(r,g,b);
    const delta = max - min;
    let hue = 0;

    if (delta > 0) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }

    const saturation = Math.min(0.85,Math.max(0.3,max ? delta / max * 1.6 : 0));
    const c = saturation;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = 1 - c;
    const [r1,g1,b1] =
      hue < 60 ? [c,x,0] : hue < 120 ? [x,c,0] : hue < 180 ? [0,c,x] :
      hue < 240 ? [0,x,c] : hue < 300 ? [x,0,c] : [c,0,x];
    const hex = v => Math.round((v + m) * 255).toString(16).padStart(2,"0");

    return "#" + hex(r1) + hex(g1) + hex(b1);
  }

  // Lit fixtures: small, very bright or very saturated patches.
  function findLights(data,gw,gh,black) {
    const total = gw * gh;
    const mask = new Uint8Array(total);
    let lit = 0;

    for (let i = 0; i < total; i++) {
      const o = i * 4;
      const max = Math.max(data[o],data[o + 1],data[o + 2]);
      const min = Math.min(data[o],data[o + 1],data[o + 2]);

      if (!black[i] && ((max >= 238 && min >= 205) || (max >= 225 && max - min >= 110))) {
        mask[i] = 1;
        lit++;
      }
    }

    if (lit > total * 0.06) return {lights:[],note:"bright map, no lights added"};

    const found = components(dilate(mask,gw,gh),gw,gh);
    const blobs = found.sizes.map(() => ({n:0,x:0,y:0}));

    for (let i = 0; i < total; i++) {
      const id = found.label[i];
      if (!id) continue;
      blobs[id].n++;
      blobs[id].x += i % gw;
      blobs[id].y += Math.floor(i / gw);
    }

    const picked = [];

    for (const blob of blobs.filter(b => b.n >= 10 && b.n <= total * 0.015).sort((a,b) => b.n - a.n)) {
      const x = blob.x / blob.n;
      const y = blob.y / blob.n;

      if (picked.some(p => Math.hypot(p.x - x,p.y - y) < gw * 0.09)) continue;

      // Colour: the most saturated lit cells around the fixture.
      const reach = Math.round(Math.sqrt(blob.n)) + 6;
      const cells = [];

      for (let yy = Math.max(0,Math.round(y) - reach); yy < Math.min(gh,Math.round(y) + reach); yy++) {
        for (let xx = Math.max(0,Math.round(x) - reach); xx < Math.min(gw,Math.round(x) + reach); xx++) {
          const o = (yy * gw + xx) * 4;
          const max = Math.max(data[o],data[o + 1],data[o + 2]);
          if (max > 110) cells.push([data[o],data[o + 1],data[o + 2],max - Math.min(data[o],data[o + 1],data[o + 2])]);
        }
      }

      cells.sort((a,b) => b[3] - a[3]);
      const top = cells.slice(0,Math.max(12,cells.length >> 2));
      const mean = k => top.reduce((sum,cell) => sum + cell[k],0) / (top.length || 1);

      picked.push({x,y,n:blob.n,color:vivid(mean(0),mean(1),mean(2))});
      if (picked.length >= MAX_LIGHTS) break;
    }

    return {lights:picked,note:""};
  }

  // Door-sized gaps in a black wall line. Closing the mask fills such a gap;
  // a filled patch counts as a doorway when it has wall at both ends and
  // floor on both sides.
  function findDoors(black,gw,gh,square) {
    const r = Math.max(2,Math.round(square * 0.7));
    let closed = black;
    for (let i = 0; i < r; i++) closed = dilate(closed,gw,gh);
    for (let i = 0; i < r; i++) closed = erode(closed,gw,gh);

    const gap = new Uint8Array(black.length);
    for (let i = 0; i < gap.length; i++) gap[i] = closed[i] && !black[i] ? 1 : 0;

    const found = components(gap,gw,gh);
    const stats = found.sizes.map(() => ({n:0,x:0,y:0,xx:0,yy:0,xy:0}));

    for (let i = 0; i < gap.length; i++) {
      const id = found.label[i];
      if (!id) continue;
      const x = i % gw, y = Math.floor(i / gw), s = stats[id];
      s.n++; s.x += x; s.y += y; s.xx += x * x; s.yy += y * y; s.xy += x * y;
    }

    const at = (x,y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= gw || y >= gh ? 1 : black[y * gw + x]; };
    const doors = [];

    for (const s of stats) {
      if (s.n < 6) continue;
      const cx = s.x / s.n, cy = s.y / s.n;
      const a = s.xx / s.n - cx * cx, c = s.yy / s.n - cy * cy, b = s.xy / s.n - cx * cy;
      const angle = 0.5 * Math.atan2(2 * b,a - c);
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const mean = (a + c) / 2, diff = Math.sqrt(Math.max(0,((a - c) / 2) ** 2 + b * b));
      const length = Math.sqrt(12 * (mean + diff)), thick = Math.sqrt(12 * Math.max(0.08,mean - diff));

      if (length < square * 0.45 || length > square * 2.3) continue;
      if (thick > square * 0.75 || length < thick * 1.2) continue;

      const end = length / 2 + 2, side = thick / 2 + 3;
      const wallAtEnds = at(cx + ux * end,cy + uy * end) && at(cx - ux * end,cy - uy * end);
      const floorAtSides = !at(cx - uy * side,cy + ux * side) && !at(cx + uy * side,cy - ux * side);
      if (!wallAtEnds || !floorAtSides) continue;

      doors.push([cx - ux * (length / 2 + 1),cy - uy * (length / 2 + 1),cx + ux * (length / 2 + 1),cy + uy * (length / 2 + 1)]);
    }

    return doors;
  }

  async function analyzeOne(scene) {
    const src = scene.background?.src;
    if (!src) return results[scene.id] = {skip:"no background image"};
    if (/\.(webm|mp4|m4v|ogv)(\?|$)/i.test(src)) return results[scene.id] = {skip:"video background"};

    const {gw,gh,cv,data} = await loadGrid(src);
    const dims = scene.dimensions;
    const sx = dims.sceneWidth / gw;
    const sy = dims.sceneHeight / gh;
    const toScene = ([x,y]) => [Math.round(dims.sceneX + x * sx),Math.round(dims.sceneY + y * sy)];

    let black = blackMask(data,gw,gh);
    let blackShare = black.reduce((sum,v) => sum + v,0) / black.length;

    // Some maps sit on a flat dark grey instead of black. When all four
    // corners share one dark colour, treat that colour as the border.
    if (blackShare < 0.01) {
      const corner = (x,y) => { const o = (y * gw + x) * 4; return [data[o],data[o + 1],data[o + 2]]; };
      const corners = [corner(2,2),corner(gw - 3,2),corner(2,gh - 3),corner(gw - 3,gh - 3)];
      const same = corners.every(c => c.every((v,k) => Math.abs(v - corners[0][k]) <= 6));

      if (same && Math.max(...corners[0]) < 70) {
        const grey = blackMask(data,gw,gh,corners[0]);
        const share = grey.reduce((sum,v) => sum + v,0) / grey.length;

        if (share >= 0.03) { black = grey; blackShare = share; }
      }
    }
    const lines = blackShare < 0.01 ? [] : trace(black,gw,gh);
    const walls = [];

    for (const line of lines) {
      const points = line.map(toScene);

      for (let i = 1; i < points.length; i++) {
        const c = [...points[i - 1],...points[i]];
        if (c[0] === c[2] && c[1] === c[3]) continue;
        walls.push({c,move:20,sight:20,light:20,sound:20,door:0,flags:TAG});
      }
    }

    if (opts.doors && blackShare >= 0.01) {
      for (const d of findDoors(black,gw,gh,dims.size / sx)) {
        const a = toScene([d[0],d[1]]), b = toScene([d[2],d[3]]);
        walls.push({c:[...a,...b],move:20,sight:20,light:20,sound:20,door:1,ds:0,flags:TAG});
      }
    }

    const found = findLights(data,gw,gh,black);
    const squares = n => Math.min(9,Math.max(4,4 + Math.sqrt(n) * sx / dims.size));
    const lights = found.lights.map(light => ({
      x:toScene([light.x,light.y])[0],
      y:toScene([light.x,light.y])[1],
      walls:true,
      vision:false,
      flags:TAG,
      config:{
        dim:Math.round(squares(light.n) * scene.grid.distance),
        bright:0,
        color:light.color,
        alpha:LIGHT_ALPHA,
        angle:360,
        luminosity:0,
        attenuation:0.85,
        coloration:1,
        animation:{type:null}
      }
    }));

    const notes = [];
    if (blackShare < 0.01) notes.push("no black border");
    if (blackShare > 0.55) notes.push("mostly black");
    if (walls.length > 400) notes.push("very jagged");
    if (found.note) notes.push(found.note);

    return results[scene.id] = {
      walls,
      lights,
      blackShare:Math.round(blackShare * 100),
      notes,
      thumb:cv,
      dims:{x:dims.sceneX,y:dims.sceneY,w:dims.sceneWidth,h:dims.sceneHeight}
    };
  }

  async function analyze(ids) {
    const out = [];

    for (const id of ids) {
      const scene = game.scenes.get(id);
      if (!scene) continue;

      try {
        const r = await analyzeOne(scene);
        out.push([scene.name,r.skip ?? `walls ${r.walls.length}, lights ${r.lights.length}, black ${r.blackShare}%${r.notes.length ? " — " + r.notes.join(", ") : ""}`].join(": "));
      } catch (error) {
        results[id] = {skip:"failed: " + error.message};
        out.push(scene.name + ": FAILED " + error.message);
      }
    }

    return out;
  }

  function sheet(ids,columns = 3) {
    document.getElementById("__sheet")?.remove();
    if (!ids?.length) return;

    const root = document.createElement("div");
    root.id = "__sheet";
    root.style.cssText = `position:fixed;inset:0;z-index:99999;background:#111;display:grid;gap:4px;padding:4px;grid-template-columns:repeat(${columns},1fr);align-content:start;overflow:auto`;

    ids.forEach((id,index) => {
      const scene = game.scenes.get(id);
      const r = results[id];
      const box = document.createElement("div");
      box.style.cssText = "position:relative;color:#fff;font:12px monospace";

      if (r?.thumb) {
        const cv = document.createElement("canvas");
        cv.width = r.thumb.width;
        cv.height = r.thumb.height;
        cv.style.cssText = "width:100%;display:block";
        const g = cv.getContext("2d");
        g.drawImage(r.thumb,0,0);
        const px = x => (x - r.dims.x) / r.dims.w * cv.width;
        const py = y => (y - r.dims.y) / r.dims.h * cv.height;

        g.lineWidth = 2.5;
        g.strokeStyle = "#ff2bd6";
        g.beginPath();
        for (const wall of r.walls) { g.moveTo(px(wall.c[0]),py(wall.c[1])); g.lineTo(px(wall.c[2]),py(wall.c[3])); }
        g.stroke();

        for (const light of r.lights) {
          g.beginPath();
          g.arc(px(light.x),py(light.y),9,0,Math.PI * 2);
          g.fillStyle = light.config.color;
          g.fill();
          g.lineWidth = 2;
          g.strokeStyle = "#000";
          g.stroke();
        }

        box.append(cv);
      }

      const label = document.createElement("div");
      label.style.cssText = "position:absolute;left:0;top:0;background:#000c;padding:1px 4px";
      label.textContent = `${index + 1}. ${scene?.name ?? id} ${r?.skip ?? `W${r?.walls.length} L${r?.lights.length}`}`;
      box.append(label);
      root.append(box);
    });

    document.body.append(root);
  }

  async function apply(ids,{walls = true,lights = true,replace = false} = {}) {
    const out = [];

    for (const id of ids) {
      const scene = game.scenes.get(id);
      const r = results[id];
      if (!scene || !r || r.skip) continue;

      let w = 0;
      let l = 0;

      // replace: swap this tool's earlier automatic walls for the new set.
      if (replace && walls && r.walls.length) {
        const old = scene.walls.filter(w => w.flags?.[NS]?.auto).map(w => w.id);
        if (old.length === scene.walls.size) await scene.deleteEmbeddedDocuments("Wall",old);
      }

      if (walls && r.walls.length && !scene.walls.size) {
        w = (await scene.createEmbeddedDocuments("Wall",r.walls)).length;
      }

      // Scenes that already have lights keep their own lighting untouched.
      if (lights && !scene.lights.size) {
        if (r.lights.length) l = (await scene.createEmbeddedDocuments("AmbientLight",r.lights)).length;
        if (!scene.environment.globalLight.enabled) await scene.update({"environment.globalLight.enabled":true});
      }

      await scene.update({[`flags.${NS}.mapPass`]:{by:"claude",on:"2026-10-01",walls:w,lights:l}});
      out.push(`${scene.name}: +${w} walls, +${l} lights`);
    }

    return out;
  }

  async function undo(ids) {
    const mine = doc => doc.flags?.[NS]?.walledBy === "claude";

    for (const id of ids) {
      const scene = game.scenes.get(id);
      if (!scene) continue;

      await scene.deleteEmbeddedDocuments("Wall",scene.walls.filter(mine).map(w => w.id));
      await scene.deleteEmbeddedDocuments("AmbientLight",scene.lights.filter(mine).map(l => l.id));
      await scene.update({[`flags.${NS}.-=mapPass`]:null});
    }
  }

  globalThis.FEHAMapWaller = {analyze,sheet,apply,undo,results,opts};
})();
