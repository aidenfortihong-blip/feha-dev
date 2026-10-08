// FEHA map audit helpers (GM console, after FEHA_HAND_WALLER.js). Not loaded by the game.
//
//   MA.sheet(names)               contact sheet: map, walls (magenta, cyan = see-through,
//                                 green = door), sealed floor areas red, main area green
//   MA.zoom(name, crop)           one map (crop in percent) with the same overlay + percent grid
//   MA.sealed(scene)              list of sealed floor areas [{x,y,pct}]
//   await MA.cutDoor(name, line)  cut a door through the scene's walls (any walls) along
//                                 line [x0,y0,x1,y1] in percent; returns walls split
//   await MA.addWalls(name, polylines, {bars}) add walls (percent polylines)
//   await MA.delWallsIn(name, box) delete non-door walls fully inside box [x0,y0,x1,y1]
//   MA.done(name, note)           mark checked (wallStatus.checked = date)
(() => {
  const NS = "fleshEnshrouded";
  const inter = (a,b,c,d) => {
    const o = (p,q,r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = o(c,d,a), d2 = o(c,d,b), d3 = o(a,b,c), d4 = o(a,b,d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const scene = n => typeof n === "string" ? (game.scenes.get(n) ?? game.scenes.getName(n)) : n;
  const imgs = {};
  async function image(s) {
    if (imgs[s.id]) return imgs[s.id];
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = s.background.src;
    await img.decode();
    return imgs[s.id] = img;
  }

  async function analyse(s, N = 48) {
    const d = s.dimensions;
    const img = await image(s);
    const c0 = document.createElement("canvas");
    c0.width = N; c0.height = N;
    const g0 = c0.getContext("2d");
    g0.drawImage(img,0,0,N,N);
    const px = g0.getImageData(0,0,N,N).data;
    const floor = k => Math.max(px[k * 4],px[k * 4 + 1],px[k * 4 + 2]) > 28;
    const W = s.walls.filter(w => w.move > 0 && !w.door).map(w => [{x:w.c[0],y:w.c[1]},{x:w.c[2],y:w.c[3]}]);
    const cx = i => d.sceneX + (i + 0.5) / N * d.sceneWidth, cy = j => d.sceneY + (j + 0.5) / N * d.sceneHeight;
    const comp = new Int32Array(N * N).fill(-1);
    const info = [];
    for (let s0 = 0; s0 < N * N; s0++) {
      if (comp[s0] >= 0) continue;
      const c = info.length, q = [s0];
      comp[s0] = c;
      let size = 0, fl = 0, sx = 0, sy = 0;
      while (q.length) {
        const k = q.pop();
        size++; fl += floor(k);
        const i = k % N, j = (k / N) | 0;
        sx += i; sy += j;
        for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= N || b >= N) continue;
          const kk = b * N + a;
          if (comp[kk] >= 0) continue;
          if (W.some(([p,qq]) => inter({x:cx(i),y:cy(j)},{x:cx(a),y:cy(b)},p,qq))) continue;
          comp[kk] = c;
          q.push(kk);
        }
      }
      info.push({size,fl,x:Math.round(sx / size / N * 100),y:Math.round(sy / size / N * 100)});
    }
    let main = -1, best = 0;
    info.forEach((c,i) => { if (c.fl / c.size > 0.6 && c.fl > best) { best = c.fl; main = i; } });
    return {N,comp,info,main};
  }

  async function sealed(n) {
    const s = scene(n);
    const {N,info,main} = await analyse(s);
    return info.map((c,i) => ({...c,i})).filter(c => c.i !== main && c.fl / c.size > 0.6 && c.fl >= N * N * 0.02)
      .map(c => ({x:c.x,y:c.y,pct:Math.round(c.fl / N / N * 100)}));
  }

  function overlay(g,s,a,ox,oy,iw,ih,crop = [0,0,100,100]) {
    const {N,comp,info,main} = a;
    const [x0,y0,x1,y1] = crop;
    const X = p => ox + (p - x0) / (x1 - x0) * iw, Y = p => oy + (p - y0) / (y1 - y0) * ih;
    for (let k = 0; k < N * N; k++) {
      const inf = info[comp[k]];
      if (!(inf.fl / inf.size > 0.6 && inf.fl >= N * N * 0.02)) continue;
      g.fillStyle = comp[k] === main ? "rgba(0,255,0,0.13)" : "rgba(255,0,0,0.35)";
      const px = (k % N) / N * 100, py = ((k / N) | 0) / N * 100;
      g.fillRect(X(px),Y(py),X(px + 100 / N) - X(px) + 1,Y(py + 100 / N) - Y(py) + 1);
    }
    const d = s.dimensions;
    const pc = (x,y) => [(x - d.sceneX) / d.sceneWidth * 100,(y - d.sceneY) / d.sceneHeight * 100];
    g.lineWidth = 2;
    for (const w of s.walls) {
      if (w.flags?.[NS]?.edgeBox) continue;
      g.strokeStyle = w.door ? "#00ff66" : (w.sight ? "#ff2bd6" : "#00e5ff");
      const [a,b] = pc(w.c[0],w.c[1]), [c,e] = pc(w.c[2],w.c[3]);
      g.beginPath(); g.moveTo(X(a),Y(b)); g.lineTo(X(c),Y(e)); g.stroke();
    }
  }

  function root() {
    document.getElementById("__sheet")?.remove();
    const r = document.createElement("div");
    r.id = "__sheet";
    r.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#111";
    const cv = document.createElement("canvas");
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    r.append(cv);
    document.documentElement.append(r);
    return cv;
  }

  async function sheet(names,cols = 3) {
    const cv = root(), g = cv.getContext("2d");
    const rows = Math.ceil(names.length / cols), cw = cv.width / cols, ch = cv.height / rows;
    for (const [i,n] of names.entries()) {
      const s = scene(n);
      let img;
      try { img = await image(s); } catch { continue; }
      const a = await analyse(s);
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const k = Math.min((cw - 4) / img.width,(ch - 16) / img.height);
      const iw = img.width * k, ih = img.height * k;
      g.drawImage(img,x + 2,y + 14,iw,ih);
      overlay(g,s,a,x + 2,y + 14,iw,ih);
      g.fillStyle = "#ff0"; g.font = "11px monospace";
      g.fillText(i + " " + s.name.slice(0,42),x + 2,y + 11);
    }
    return names.length;
  }

  async function zoom(n,crop = [0,0,100,100]) {
    const s = scene(n);
    const img = await image(s);
    const a = await analyse(s);
    const cv = root(), g = cv.getContext("2d");
    const [x0,y0,x1,y1] = crop;
    const sw = img.naturalWidth * (x1 - x0) / 100, sh = img.naturalHeight * (y1 - y0) / 100;
    const k = Math.min(cv.width / sw,(cv.height - 4) / sh);
    const iw = sw * k, ih = sh * k;
    g.drawImage(img,img.naturalWidth * x0 / 100,img.naturalHeight * y0 / 100,sw,sh,0,0,iw,ih);
    overlay(g,s,a,0,0,iw,ih,crop);
    const span = Math.max(x1 - x0,y1 - y0), step = span > 60 ? 5 : span > 30 ? 2.5 : 1, lab = span > 30 ? 5 : 2;
    const X = p => (p - x0) / (x1 - x0) * iw, Y = p => (p - y0) / (y1 - y0) * ih;
    g.font = "12px monospace";
    for (let p = Math.ceil(x0 / step) * step; p <= x1; p += step) {
      const m = Math.abs(p / lab - Math.round(p / lab)) < 1e-6;
      g.strokeStyle = m ? "#ffffff55" : "#ffffff1a"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X(p),0); g.lineTo(X(p),ih); g.stroke();
      if (m) { g.fillStyle = "#000"; g.fillRect(X(p) + 1,0,24,14); g.fillStyle = "#ff0"; g.fillText(String(p),X(p) + 2,11); }
    }
    for (let p = Math.ceil(y0 / step) * step; p <= y1; p += step) {
      const m = Math.abs(p / lab - Math.round(p / lab)) < 1e-6;
      g.strokeStyle = m ? "#ffffff55" : "#ffffff1a";
      g.beginPath(); g.moveTo(0,Y(p)); g.lineTo(iw,Y(p)); g.stroke();
      if (m) { g.fillStyle = "#000"; g.fillRect(0,Y(p) + 1,24,14); g.fillStyle = "#ff0"; g.fillText(String(p),2,Y(p) + 12); }
    }
    return s.name;
  }

  const px = (s,x,y) => { const d = s.dimensions; return [d.sceneX + x / 100 * d.sceneWidth,d.sceneY + y / 100 * d.sceneHeight]; };
  const TAG = {[NS]:{walledBy:"claude",audit:"2026-10-08"}};

  async function cutDoor(n,line,tol = 1.2) {
    const s = scene(n);
    const d = s.dimensions;
    const [ax,ay] = px(s,line[0],line[1]), [bx,by] = px(s,line[2],line[3]);
    const L = Math.hypot(bx - ax,by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
    const T = tol / 100 * Math.max(d.sceneWidth,d.sceneHeight);
    const proj = (x,y) => [(x - ax) * ux + (y - ay) * uy,Math.abs(-(x - ax) * uy + (y - ay) * ux)];
    const del = [], add = [];
    for (const w of s.walls) {
      if (w.door || w.flags?.[NS]?.edgeBox) continue;
      const [x0,y0,x1,y1] = w.c;
      const [t0,p0] = proj(x0,y0), [t1,p1] = proj(x1,y1);
      if (p0 > T || p1 > T) continue;
      const lo = Math.min(t0,t1), hi = Math.max(t0,t1);
      if (hi <= 0 || lo >= L) continue;
      del.push(w.id);
      const base = w.toObject(); delete base._id;
      const pt = t => { const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0); return [x0 + (x1 - x0) * f,y0 + (y1 - y0) * f]; };
      for (const [a,b] of [[lo,0],[L,hi]]) {
        if (b - a < 2) continue;
        const A = pt(a), B = pt(b);
        add.push({...base,c:[...A,...B].map(Math.round)});
      }
    }
    if (del.length) await s.deleteEmbeddedDocuments("Wall",del);
    add.push({c:[ax,ay,bx,by].map(Math.round),move:20,sight:20,light:20,sound:20,door:1,ds:0,flags:TAG});
    await s.createEmbeddedDocuments("Wall",add);
    return del.length;
  }

  async function addWalls(n,lines,{bars = false,door = false} = {}) {
    const s = scene(n);
    const out = [];
    for (const l of lines) for (let i = 0; i + 3 < l.length; i += 2) {
      out.push({c:[...px(s,l[i],l[i + 1]),...px(s,l[i + 2],l[i + 3])].map(Math.round),move:20,sight:bars ? 0 : 20,light:bars ? 0 : 20,sound:bars ? 0 : 20,door:door ? 1 : 0,flags:TAG});
    }
    if (out.length) await s.createEmbeddedDocuments("Wall",out);
    return out.length;
  }

  async function delWallsIn(n,box,{doors = false} = {}) {
    const s = scene(n);
    const [a,b] = px(s,box[0],box[1]), [c,e] = px(s,box[2],box[3]);
    const inb = (x,y) => x >= a && x <= c && y >= b && y <= e;
    const ids = s.walls.filter(w => (doors || !w.door) && !w.flags?.[NS]?.edgeBox && inb(w.c[0],w.c[1]) && inb(w.c[2],w.c[3])).map(w => w.id);
    if (ids.length) await s.deleteEmbeddedDocuments("Wall",ids);
    return ids.length;
  }

  async function done(n,note) {
    const s = scene(n);
    return s.update({[`flags.${NS}.wallStatus.checked`]:"2026-10-08",[`flags.${NS}.wallStatus.auditNote`]:note ?? ""});
  }

  globalThis.MA = {sheet,zoom,sealed,analyse,cutDoor,addWalls,delWallsIn,done,close:() => document.getElementById("__sheet")?.remove()};
})();
