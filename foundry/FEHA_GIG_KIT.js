// FEHA // GIG KIT
//
// Everything a GM needs to run a job from the board (FEHA_JOBS):
//
//   runSheet(job)   how to run it: the hook, beats (where, what happens,
//                   checks, enemies), named NPCs, the twist and the wrap-up.
//                   Written gigs carry their own (job.run); every other job
//                   gets one built from its fixer, spot, enemies and kind.
//   rewardFor(job)  what it pays besides credits: items from this world's
//                   catalogs and sometimes a favour. Written gigs name theirs
//                   (job.reward); others get items matched to level and kind.
//   prep(job)       GM: builds the gig's kit in the world: a Scene folder with
//                   a clean copy of each beat's battle map and a compact
//                   journal (run sheet with recommended enemies, plus a player
//                   handout). cleanup(prep) removes it again.
//   giveReward(...) GM: hands reward items to crew members.
//
// On load it only hooks gig journals so they open compact; the rest is
// called by the board.

(() => {
  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const ROOT = "GIGS";
  const CATS = ["01 — WEAPONS","02 — CYBERWARE","03 — ARMOR","04 — GRENADES","05 — QUICKHACKS","06 — CONSUMABLES","FIREARMS"];

  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const norm = v => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const city = () => globalThis.FEHA_CITY ?? null;
  const cat = () => globalThis.FEHA_JOB_CATALOG ?? null;
  const fixerOf = job => cat()?.FIXERS?.find(f => f.key === job?.fixer) ?? null;
  const npcApi = () => globalThis.FEHA_CYBER_CORE?.module?.("npcCatalog") ?? game.adk?.npcs ?? null;
  const npcDefs = () => npcApi()?.definitions ?? [];

  // Seeded random from a string, so a job's reward and auto beats stay the
  // same every time they are looked at.
  function seeded(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0),16777619);
    return () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15),t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7),t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sceneFor(name) {
    if (!name) return null;
    const lower = norm(name);
    return game.scenes.find(s => s.name === name) ?? game.scenes.find(s => norm(s.name) === lower) ??
      game.scenes.find(s => norm(s.name).startsWith(lower)) ?? null;
  }

  // A beat's "at": a city spot id ("22"), "scene:<scene name or prefix>", or
  // "<spot>@<scene name>" for a pin whose own battle map doesn't fit the beat
  // (the stairwell or the roof of a block rather than its usual map).
  function resolveAt(at) {
    if (!at) return {label:null,scene:null,spot:null};
    const split = String(at).match(/^([^@:]+)@(.+)$/);
    if (split) {
      const place = city()?.place?.(split[1]);
      return {label:place?.label ?? split[1],scene:sceneFor(split[2]),spot:place?.id ?? null};
    }
    if (String(at).startsWith("scene:")) {
      const name = String(at).slice(6);
      const scene = sceneFor(name);
      return {label:scene?.name ?? name,scene,spot:null};
    }
    const place = city()?.place?.(String(at));
    return {label:place?.label ?? String(at),scene:sceneFor(place?.map),spot:place?.id ?? null};
  }

  // ---------------------------------------------------------- run sheets

  const KIND_CHECKS = {
    "Recovery":["Investigation or Streetwise DC 12 to find where it's kept","Stealth DC 13 to reach it unseen, or Intimidation DC 14 to make them hand it over"],
    "Delivery":["Perception DC 12 to spot the tail","Deception DC 13 at the checkpoint, or Athletics DC 13 to take the long way over the rooftops"],
    "Theft":["Stealth DC 14 to get in unseen","Sleight of Hand or Tech DC 14 for the lock or safe","Each failure raises the alarm one step"],
    "Sabotage":["Tech DC 14 to break it so it looks like an accident (DC 10 if they don't care)","Stealth DC 13 to get out before anyone checks"],
    "Bounty":["Streetwise DC 13 to track the target","Insight DC 12 to read whether they'll run, bargain or fight"],
    "Cyberpsycho":["Medicine or Tech DC 14 on a downed psycho to shut the chrome off safely (non-lethal)","Persuasion DC 16 can buy one round of hesitation"],
    "Protection":["Perception DC 13 each hour of the watch to spot trouble early","Insight DC 13 to spot the inside man"],
    "Rescue":["Stealth DC 13 to reach the captive","Medicine DC 12 to move them without making it worse","Athletics DC 12 to carry them out under fire"],
    "Data Heist":["Tech or Netrunning DC 14 to break the ICE","Each failed check gives the defenders a trace (3 traces = they know who you are)"],
    "Collection":["Intimidation or Persuasion DC 13 to get paid without a fight","Insight DC 12 to see why they can't pay"],
    "Smuggling":["Deception DC 13 at each checkpoint","Driving or Athletics DC 12 if it turns into a chase"],
    "Investigation":["Investigation DC 13 for each solid lead (three solves it)","Persuasion DC 12 to get a witness talking"],
    "Extraction":["Stealth DC 14 to reach the package","Persuasion DC 13 if the package doesn't want to come"]
  };

  // Built for jobs without a written run sheet: meet the fixer, do the job,
  // get paid.
  function autoRun(job) {
    const f = fixerOf(job);
    const enemies = job.enemies ?? [];
    const beats = [];
    if (f?.spot) beats.push({at:f.spot,title:"The meet",text:`${f.handle} lays out the job. Pay is ${(job.pay ?? 0).toLocaleString("en-US")} each, half up front if the crew asks nicely. ${job.brief ?? ""}`});
    // The job's own battle map, labelled with its city pin when it has one.
    const jobAt = job.spot && job.map ? job.spot + "@" + job.map : job.spot ?? (job.map ? "scene:" + job.map : null);
    beats.push({at:jobAt,title:"The job",
      text:(job.objectives ?? []).join(". ") + ".",checks:KIND_CHECKS[job.kind] ?? [],enemies});
    if (job.twist) beats.push({at:jobAt,title:"The turn",text:job.twist});
    if (f?.spot) beats.push({at:f.spot,title:"Payday",text:`Back to ${f.handle} to get paid.`});
    return {hook:f ? `“${f.voice}” — ${f.handle}` : "",beats,npcs:[],wrap:"Pay out on the board. Partial results: pay less, or keep the cred."};
  }

  function runSheet(job) {
    const raw = job.run ?? autoRun(job);
    const beats = (raw.beats ?? []).map((b,i) => {
      const where = resolveAt(b.at);
      return {n:i + 1,title:b.title ?? "Beat " + (i + 1),text:b.text ?? "",checks:b.checks ?? [],enemies:b.enemies ?? [],
        at:b.at ?? null,label:where.label,scene:where.scene,spot:where.spot};
    });
    return {hook:raw.hook ?? "",beats,npcs:(raw.npcs ?? []).map(([name,base,note]) => ({name,base,note})),
      wrap:raw.wrap ?? "",twist:job.twist ?? "",written:Boolean(job.run)};
  }

  // Every enemy across the beats (or the job's list), merged.
  function enemiesOf(job) {
    const out = new Map();
    const beats = job.run?.beats ?? [];
    const lists = beats.some(b => b.enemies?.length) ? beats.map(b => b.enemies ?? []) : [job.enemies ?? []];
    for (const list of lists) for (const [name,count] of list) out.set(name,(out.get(name) ?? 0) + count);
    return [...out.entries()];
  }

  // -------------------------------------------------------------- rewards

  function itemBand(item) {
    const f = item.flags?.[FLAG] ?? {};
    return Number(f.mk ?? f.tier ?? f.cyberwareTier ?? f.band ?? f.marketBand) || null;
  }

  function itemCat(item) {
    const top = item.folder?.folder?.name ?? item.folder?.name ?? "";
    return CATS.find(c => top === c) ?? null;
  }

  let pools = null;
  function rewardPools() {
    if (pools) return pools;
    pools = {};
    for (const item of game.items) {
      const c = itemCat(item);
      if (!c || c === "05 — QUICKHACKS") continue;
      if (/UNIQUE/i.test(item.folder?.name ?? "")) continue;
      const band = c === "06 — CONSUMABLES" ? 0 : itemBand(item);
      if (band == null) continue;
      ((pools[c] ??= {})[band] ??= []).push(item.name);
    }
    return pools;
  }

  const KIND_LOOT = {
    "Theft":["02 — CYBERWARE","FIREARMS"],"Data Heist":["02 — CYBERWARE","06 — CONSUMABLES"],
    "Bounty":["FIREARMS","03 — ARMOR"],"Protection":["03 — ARMOR","FIREARMS"],
    "Delivery":["06 — CONSUMABLES","04 — GRENADES"],"Smuggling":["04 — GRENADES","FIREARMS"],
    "Rescue":["06 — CONSUMABLES","03 — ARMOR"],"Recovery":["FIREARMS","02 — CYBERWARE"],
    "Sabotage":["04 — GRENADES","03 — ARMOR"],"Collection":["FIREARMS","06 — CONSUMABLES"],
    "Cyberpsycho":["02 — CYBERWARE","04 — GRENADES"],"Investigation":["02 — CYBERWARE","06 — CONSUMABLES"],
    "Extraction":["03 — ARMOR","02 — CYBERWARE"]
  };

  // Item reward for a job without a written one: one piece of kit at the
  // job's level that fits the kind of work, and a consumable on the low end.
  function autoReward(job) {
    const rnd = seeded(job.key ?? job.id);
    const pick = list => list?.length ? list[Math.floor(rnd() * list.length)] : null;
    const P = rewardPools();
    const tier = Math.max(1,Math.min(5,job.tier ?? 1));
    const prefs = KIND_LOOT[job.kind] ?? ["FIREARMS","06 — CONSUMABLES"];
    const items = [];
    const c = prefs[Math.floor(rnd() * prefs.length)];
    const band = c === "06 — CONSUMABLES" ? 0 : tier;
    const main = pick(P[c]?.[band]) ?? pick(P[c]?.[Math.max(1,band - 1)]) ?? pick(P["06 — CONSUMABLES"]?.[0]);
    if (main) items.push(c === "06 — CONSUMABLES" || c === "04 — GRENADES" ? main + " x2" : main);
    if (tier <= 2) {
      const extra = pick(P["06 — CONSUMABLES"]?.[0]);
      if (extra && !items.some(i => i.startsWith(extra))) items.push(extra);
    }
    const f = fixerOf(job);
    const favor = f && rnd() < 0.25 ? `${f.handle} owes the crew a favour (one free tip, ride or contact).` : null;
    return {items,favor};
  }

  // [{name, qty, item}] plus the favour.
  function rewardFor(job) {
    const raw = job.reward ?? autoReward(job);
    const items = (raw.items ?? []).map(entry => {
      const m = String(entry).match(/^(.*?)(?:\s+x(\d+))?$/);
      const name = m[1].trim();
      return {name,qty:Number(m[2] ?? 1),item:game.items.getName(name) ?? null};
    });
    return {items,favor:raw.favor ?? null,written:Boolean(job.reward)};
  }

  function rewardText(job) {
    const r = rewardFor(job);
    const parts = r.items.map(i => (i.qty > 1 ? i.qty + "× " : "") + i.name);
    if (r.favor) parts.push(r.favor);
    return parts.join(" · ");
  }

  // GM: put a reward item on a crew member's sheet.
  async function giveItem(actor,name,qty = 1) {
    const source = game.items.getName(name);
    if (!actor || !source) return false;
    const data = source.toObject();
    delete data._id;
    delete data.folder;
    if (qty > 1 && data.system && "quantity" in data.system) data.system.quantity = qty;
    const docs = qty > 1 && !(data.system && "quantity" in data.system) ? Array.from({length:qty},() => foundry.utils.deepClone(data)) : [data];
    await actor.createEmbeddedDocuments("Item",docs);
    return true;
  }

  // ---------------------------------------------------------------- prep

  async function folderFor(type,name,parent = null) {
    const found = game.folders.find(f => f.type === type && f.name === name && (f.folder?.id ?? null) === (parent?.id ?? null));
    return found ?? Folder.create({name,type,folder:parent?.id ?? null,sorting:"a"});
  }

  // The board's own NPCs: one of every catalog NPC in the Actors folder
  // "GIG NPCs", sorted by faction, ready to drag onto a gig map. Kept apart
  // from the campaign's imported NPCs so gigs never touch those.
  const NPC_ROOT = "GIG NPCs";
  const poolActor = d => game.actors.find(a => a.flags?.[FLAG]?.npcKey === d.key && a.flags?.[FLAG]?.gigPool) ?? null;

  // GM: create whichever GIG NPCs are missing (all of them the first time).
  async function stockNpcs(keys = null) {
    if (!game.user.isGM || !npcApi()?.import) return null;
    const todo = npcDefs().filter(d => (!keys || keys.includes(d.key)) && !poolActor(d)).map(d => d.key);
    if (!todo.length) return {created:[],missing:{}};
    return npcApi().import({keys:todo,root:NPC_ROOT,pool:true});
  }

  // The GIG NPCs a gig needs (stocked if missing), as name -> actor.
  async function ensureNpcs(names) {
    const defs = npcDefs();
    const want = [...new Set(names)].map(n => defs.find(d => d.name === n || d.key === n)).filter(Boolean);
    const have = poolActor;
    const missing = want.filter(d => !have(d)).map(d => d.key);
    if (missing.length) {
      try { await stockNpcs(missing); } catch (err) { console.warn("FEHA GIG KIT // NPC import failed",err); }
    }
    const out = new Map();
    for (const d of want) { const a = have(d); if (a) { out.set(d.name,a); out.set(d.key,a); } }
    return out;
  }

  // Enemy suggestions for the whole gig: name -> {actor, count, where}.
  function opposition(sheet,actors) {
    const out = new Map();
    for (const b of sheet.beats) for (const [name,count] of b.enemies) {
      const e = out.get(name) ?? {name,actor:actors.get(name) ?? null,count:0,where:[]};
      e.count += count;
      e.where.push(b.n);
      out.set(name,e);
    }
    return [...out.values()];
  }

  // The run sheet as building blocks: short, scannable, nothing the GM
  // has to follow word for word.
  function sheetHtml(job,sheet,links,actors) {
    const f = fixerOf(job);
    const r = rewardFor(job);
    const risk = cat()?.TIERS?.[job.tier]?.label ?? "";
    const beat = b => {
      const mapName = b.scene?.name ?? b.label ?? "—";
      const map = links.scenes[b.n] ? `@UUID[${links.scenes[b.n]}]{${esc(mapName)}}` : esc(mapName);
      const place = b.label && b.label !== mapName ? ` <span class="gk-dim">· ${esc(b.label)}</span>` : "";
      const foes = b.enemies.map(([n,c]) => `${esc(n)}${c > 1 ? " ×" + c : ""}`).join(", ");
      return `<div class="gk-beat"><p class="gk-bh"><b>${b.n}</b> ${esc(b.title)}</p>
<p class="gk-map">Map: ${map}${place}</p>
<p>${esc(b.text)}</p>
${b.checks.length ? `<p class="gk-small"><b>Checks</b> ${b.checks.map(esc).join(" · ")}</p>` : ""}
${foes ? `<p class="gk-small"><b>Opposition</b> ${foes}</p>` : ""}</div>`;
    };
    const foes = opposition(sheet,actors).map(e =>
      `<li>${e.actor ? `@UUID[${e.actor.uuid}]{${esc(e.name)}}` : esc(e.name)} <span class="gk-dim">×${e.count} · scene ${e.where.join(", ")}</span></li>`).join("");
    const people = sheet.npcs.map(n => `<li><b>${esc(n.name)}</b>${n.note ? ` — ${esc(n.note)}` : ""}</li>`).join("");
    return `<div class="feha-gig">
<p class="gk-meta"><b>${esc(f?.handle ?? "")}</b> · ${esc(risk)} · ${esc(job.kind)} · €$ ${Number(job.pay ?? 0).toLocaleString("en-US")} each · +${job.cred ?? 0} cred</p>
<p class="gk-tip">Building blocks, not a script. Rename, cut, swap or stretch anything.</p>
${sheet.hook ? `<h3>Hook</h3><p><em>${esc(sheet.hook)}</em></p>` : ""}
<h3>The job</h3><p>${esc(job.brief)}</p>
${(job.objectives ?? []).length ? `<ul>${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
<h3>Scenes</h3>${sheet.beats.map(beat).join("")}
${foes ? `<h3>Recommended enemies</h3><ul class="gk-list">${foes}</ul><p class="gk-small gk-dim">Drag them in as you need them. Scale the numbers to your table.</p>` : ""}
${people ? `<h3>People</h3><ul class="gk-list">${people}</ul><p class="gk-small gk-dim">Name them yourself.</p>` : ""}
${sheet.twist ? `<h3>Twist (optional)</h3><p>${esc(sheet.twist)}</p>` : ""}
${sheet.wrap ? `<h3>Endings</h3><p>${esc(sheet.wrap)}</p>` : ""}
<h3>Reward</h3><p>€$ ${Number(job.pay ?? 0).toLocaleString("en-US")} each${r.items.length ? " · " + r.items.map(i => (i.qty > 1 ? i.qty + "× " : "") + esc(i.name)).join(", ") : ""}${r.favor ? `<br><span class="gk-dim">Favour: ${esc(r.favor)}</span>` : ""}</p>
<p class="gk-small gk-dim">Pay out from the Jobs board: GM desk → the job → Pay out.</p>
</div>`;
  }

  function handoutHtml(job) {
    const f = fixerOf(job);
    return `<p><strong>${esc(f?.handle ?? "")}</strong>: “${esc(f?.voice ?? "")}”</p><h2>${esc(job.title)}</h2><p>${esc(job.brief)}</p>
${(job.objectives ?? []).length ? `<ol>${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}
<p><strong>Pay:</strong> ${Number(job.pay ?? 0).toLocaleString("en-US")} credits each.</p>`;
  }

  // GM: build the gig's kit: a clean copy of each beat's battle map and a
  // compact journal. Enemies are only recommended (catalog NPCs linked in
  // the journal, imported if missing); nothing is placed on the maps.
  async function prep(job) {
    if (!game.user.isGM) throw new Error("GM only.");
    const sheet = runSheet(job);
    const title = String(job.title).slice(0,48);
    const sceneRoot = await folderFor("Scene",ROOT);
    const sceneFolder = await folderFor("Scene",title,sceneRoot);
    const journalRoot = await folderFor("JournalEntry",ROOT);

    const actors = await ensureNpcs(sheet.beats.flatMap(b => b.enemies.map(([n]) => n)));
    const links = {scenes:{}};
    const made = {scenes:[]};

    // A copy of each beat's map (once per map) so the GM can drop tokens and
    // draw on it without touching the original.
    const copies = new Map();
    for (const b of sheet.beats) {
      if (!b.scene) continue;
      let copy = copies.get(b.scene.id);
      if (!copy) {
        const data = b.scene.toObject();
        delete data._id;
        data.name = `GIG · ${title} · ${b.n}. ${b.title}`;
        data.folder = sceneFolder.id;
        data.navigation = false;
        data.active = false;
        data.ownership = {default:0};
        data.tokens = [];
        foundry.utils.setProperty(data,`flags.${FLAG}.gigScene`,job.id);
        copy = await Scene.create(data);
        copies.set(b.scene.id,copy);
        made.scenes.push(copy.id);
      }
      links.scenes[b.n] = copy.uuid;
    }

    const journal = await JournalEntry.create({
      name:`GIG · ${title}`,
      folder:journalRoot.id,
      ownership:{default:0},
      flags:{[FLAG]:{gigJournal:job.id}},
      pages:[
        {name:"Run sheet (GM)",type:"text",text:{content:sheetHtml(job,sheet,links,actors)},sort:0},
        {name:"Handout (show players)",type:"text",text:{content:handoutHtml(job)},sort:100}
      ]
    });

    return {sceneFolder:sceneFolder.id,actorFolder:null,journal:journal.id,scenes:made.scenes,actors:[],beatScenes:Object.fromEntries(Object.entries(links.scenes).map(([n,u]) => [n,u.split(".").pop()]))};
  }

  // ------------------------------------------------- compact gig journal
  // A gig journal opens as a narrow window docked on the left, page list
  // folded away, so it can stay open beside the map while the GM runs the
  // gig. Where the GM last left it is remembered on this computer.
  const POS_KEY = "fehaGigSheetPos";
  const SHEET_CSS = `
.feha-gig-sheet{min-width:0 !important}
.feha-gig-sheet .journal-header{display:none}
.feha-gig-sheet .journal-page-content{font-size:13px;line-height:1.4}
.feha-gig-sheet .journal-entry-page h1{font-size:18px;margin:0 0 4px}
.feha-gig-sheet .journal-page-header{margin-bottom:2px}
.feha-gig h3{font-size:13px;letter-spacing:.12em;text-transform:uppercase;margin:12px 0 4px;padding-bottom:2px;border-bottom:1px solid currentColor;opacity:.85}
.feha-gig p{margin:0 0 5px}
.feha-gig ul{margin:0 0 6px;padding-left:18px}
.feha-gig li{margin:0 0 2px}
.feha-gig .gk-meta{font-size:12px;opacity:.85}
.feha-gig .gk-tip{font-size:12px;font-style:italic;opacity:.7}
.feha-gig .gk-beat{margin:0 0 10px;padding-left:8px;border-left:2px solid currentColor}
.feha-gig .gk-bh{margin:0 0 2px;font-weight:600}
.feha-gig .gk-bh b{display:inline-block;min-width:16px;opacity:.7}
.feha-gig .gk-map{font-size:12px;margin:0 0 3px}
.feha-gig .gk-small{font-size:12px}
.feha-gig .gk-dim{opacity:.65}
.feha-gig .gk-list{list-style:none;padding-left:0}`;

  function savedPos() {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch { return null; }
  }

  function compactSheet(app,options) {
    const doc = app.document;
    if (!doc?.flags?.[FLAG]?.gigJournal || !game.user.isGM) return;
    app.element?.classList.add("feha-gig-sheet");
    if (!document.getElementById("feha-gig-sheet-css")) {
      const style = document.createElement("style");
      style.id = "feha-gig-sheet-css";
      style.textContent = SHEET_CSS;
      document.head.append(style);
    }
    // Only when the window opens, so the GM can still move it while it's up.
    if (!options?.isFirstRender) return;
    const pos = savedPos() ?? {left:72,top:90,width:380,height:Math.max(360,Math.min(720,window.innerHeight - 200))};
    // The sheet sets its own size and place on first render; move it after.
    requestAnimationFrame(() => { try { app.setPosition(pos); } catch {} });
    try { if (app.element?.classList.contains("expanded") || app.sidebarState?.expanded) app.toggleSidebar?.(); } catch {}
  }

  function rememberPos(app) {
    if (!app.document?.flags?.[FLAG]?.gigJournal) return;
    const {left,top,width,height} = app.position ?? {};
    if ([left,top,width,height].every(Number.isFinite)) {
      try { localStorage.setItem(POS_KEY,JSON.stringify({left,top,width,height})); } catch {}
    }
  }

  const prior = globalThis.__fehaGigSheetHooks;
  if (prior) for (const [name,id] of prior) Hooks.off(name,id);
  globalThis.__fehaGigSheetHooks = [
    ["renderJournalEntrySheet",Hooks.on("renderJournalEntrySheet",(app,element,context,options) => compactSheet(app,options))],
    ["closeJournalEntrySheet",Hooks.on("closeJournalEntrySheet",app => rememberPos(app))]
  ];

  // A map link in a gig journal takes the GM to that map (Foundry's default
  // for a Scene link is its settings window).
  if (globalThis.__fehaGigMapClick) document.removeEventListener("click",globalThis.__fehaGigMapClick,true);
  globalThis.__fehaGigMapClick = async event => {
    const link = event.target?.closest?.(".feha-gig a[data-uuid^=\"Scene.\"]");
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    const scene = await fromUuid(link.dataset.uuid);
    if (scene?.documentName === "Scene" && game.user.isGM) scene.view();
  };
  document.addEventListener("click",globalThis.__fehaGigMapClick,true);

  // GM: remove what prep() made (only those documents).
  async function cleanup(p) {
    if (!p || !game.user.isGM) return;
    const scenes = (p.scenes ?? []).filter(id => game.scenes.get(id));
    if (scenes.length) await Scene.deleteDocuments(scenes);
    const actors = (p.actors ?? []).filter(id => game.actors.get(id));
    if (actors.length) await Actor.deleteDocuments(actors);
    if (p.journal && game.journal.get(p.journal)) await JournalEntry.deleteDocuments([p.journal]);
    for (const id of [p.sceneFolder,p.actorFolder]) {
      const f = id ? game.folders.get(id) : null;
      if (f && !f.contents.length && !f.children?.length) await f.delete();
    }
  }

  const api = {VERSION,runSheet,enemiesOf,rewardFor,rewardText,giveItem,prep,cleanup,resolveAt,stockNpcs,NPC_ROOT,KIND_CHECKS,
    resetPools() { pools = null; }};
  globalThis.FEHA_GIG_KIT = api;
  try {
    game.adk ??= {};
    game.adk.gigKit = api;
  } catch {}
})();
