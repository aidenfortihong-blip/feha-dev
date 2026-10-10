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
//                   a copy of each beat's battle map (enemies placed, hidden),
//                   the NPC actors it needs, and a journal with the run sheet
//                   and a player handout. cleanup(prep) removes it again.
//   giveReward(...) GM: hands reward items to crew members.
//
// Nothing here runs on load; it is called by the board.

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

  // A beat's "at": a city spot id ("22"), or "scene:<scene name or prefix>".
  function resolveAt(at) {
    if (!at) return {label:null,scene:null,spot:null};
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
    beats.push({at:job.spot ?? (job.map ? "scene:" + job.map : null),title:"The job",
      text:(job.objectives ?? []).join(". ") + ".",checks:KIND_CHECKS[job.kind] ?? [],enemies});
    if (job.twist) beats.push({at:job.spot ?? null,title:"The turn",text:job.twist});
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

  // Import the catalog NPCs a gig needs and return name -> actor.
  async function ensureNpcs(names) {
    const defs = npcDefs();
    const want = [...new Set(names)].map(n => defs.find(d => d.name === n || d.key === n)).filter(Boolean);
    const have = d => game.actors.find(a => a.flags?.[FLAG]?.npcKey === d.key) ?? null;
    const missing = want.filter(d => !have(d)).map(d => d.key);
    if (missing.length && npcApi()?.import) {
      try { await npcApi().import({keys:missing}); } catch (err) { console.warn("FEHA GIG KIT // NPC import failed",err); }
    }
    const out = new Map();
    for (const d of want) { const a = have(d); if (a) { out.set(d.name,a); out.set(d.key,a); } }
    return out;
  }

  // Hidden enemy tokens in a block near the middle of the scene, for the GM
  // to drag into place.
  async function placeTokens(scene,list,actors) {
    const d = scene.dimensions;
    const g = d.size;
    const cx = d.sceneX + d.sceneWidth / 2, cy = d.sceneY + d.sceneHeight / 2;
    const tokens = [];
    let i = 0;
    for (const [name,count] of list) {
      const actor = actors.get(name);
      if (!actor) continue;
      for (let k = 0; k < count; k++, i++) {
        const col = i % 5, row = Math.floor(i / 5);
        const td = await actor.getTokenDocument({x:Math.round(cx + (col - 2) * g),y:Math.round(cy + row * g),hidden:true,actorLink:false});
        tokens.push(td.toObject());
      }
    }
    if (tokens.length) await scene.createEmbeddedDocuments("Token",tokens);
    return tokens.length;
  }

  function sheetHtml(job,sheet,links) {
    const f = fixerOf(job);
    const r = rewardFor(job);
    const beat = b => {
      const sceneLink = links.scenes[b.n] ? `@UUID[${links.scenes[b.n]}]{${esc(b.label ?? "map")}}` : esc(b.label ?? "—");
      const enemies = b.enemies.map(([n,c]) => (links.actors[n] ? `@UUID[${links.actors[n]}]{${esc(n)}}` : esc(n)) + ` ×${c}`).join(", ");
      return `<h3>${b.n}. ${esc(b.title)}</h3><p><strong>Where:</strong> ${sceneLink}</p><p>${esc(b.text)}</p>
        ${b.checks.length ? `<ul>${b.checks.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
        ${enemies ? `<p><strong>Enemies:</strong> ${enemies} <em>(tokens placed hidden on the map copy)</em></p>` : ""}`;
    };
    const npcs = sheet.npcs.map(n => `<li><strong>${links.actors[n.name] ? `@UUID[${links.actors[n.name]}]{${esc(n.name)}}` : esc(n.name)}</strong> — ${esc(n.note ?? "")}</li>`).join("");
    return `<p><strong>${esc(f?.handle ?? "")}</strong> · ${esc(cat()?.TIERS?.[job.tier]?.label ?? "")} · ${esc(job.kind)} · pay ${Number(job.pay ?? 0).toLocaleString("en-US")} each · +${job.cred ?? 0} crew cred</p>
${sheet.hook ? `<blockquote>${esc(sheet.hook)}</blockquote>` : ""}
<h2>The job</h2><p>${esc(job.brief)}</p>
${(job.objectives ?? []).length ? `<ol>${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}
<h2>How to run it</h2>${sheet.beats.map(beat).join("")}
${npcs ? `<h2>People</h2><ul>${npcs}</ul>` : ""}
<h2>The twist (GM only)</h2><p>${esc(sheet.twist || "None.")}</p>
${sheet.wrap ? `<h2>Wrapping up</h2><p>${esc(sheet.wrap)}</p>` : ""}
<h2>Reward</h2><p>${Number(job.pay ?? 0).toLocaleString("en-US")} credits each${r.items.length ? " · " + r.items.map(i => (i.qty > 1 ? i.qty + "× " : "") + esc(i.name)).join(", ") : ""}${r.favor ? " · " + esc(r.favor) : ""}</p>
<p><em>Pay out from the Jobs board (GM desk → the job → Pay out). Reward items go to the crew from there.</em></p>`;
  }

  function handoutHtml(job) {
    const f = fixerOf(job);
    return `<p><strong>${esc(f?.handle ?? "")}</strong>: “${esc(f?.voice ?? "")}”</p><h2>${esc(job.title)}</h2><p>${esc(job.brief)}</p>
${(job.objectives ?? []).length ? `<ol>${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}
<p><strong>Pay:</strong> ${Number(job.pay ?? 0).toLocaleString("en-US")} credits each.</p>`;
  }

  // GM: build the gig's kit. Returns ids to store on the job for cleanup.
  async function prep(job) {
    if (!game.user.isGM) throw new Error("GM only.");
    const sheet = runSheet(job);
    const title = String(job.title).slice(0,48);
    const sceneRoot = await folderFor("Scene",ROOT);
    const sceneFolder = await folderFor("Scene",title,sceneRoot);
    const actorRoot = await folderFor("Actor",ROOT);
    const journalRoot = await folderFor("JournalEntry",ROOT);

    const enemyNames = sheet.beats.flatMap(b => b.enemies.map(([n]) => n));
    const npcBases = sheet.npcs.map(n => n.base).filter(Boolean);
    const catalogActors = await ensureNpcs([...enemyNames,...npcBases]);
    const links = {scenes:{},actors:{}};
    for (const [name,actor] of catalogActors) links.actors[name] = actor.uuid;

    // Named people: a copy of their base NPC, renamed, in the gig's folder.
    const made = {actors:[],scenes:[]};
    let actorFolder = null;
    if (sheet.npcs.length) {
      actorFolder = await folderFor("Actor",title,actorRoot);
      for (const n of sheet.npcs) {
        // catalogActors is keyed by both catalog key and name.
        const base = catalogActors.get(n.base) ?? null;
        const data = base ? base.toObject() : {name:n.name,type:"npc"};
        delete data._id;
        data.name = n.name;
        data.folder = actorFolder.id;
        foundry.utils.setProperty(data,"prototypeToken.name",n.name);
        foundry.utils.setProperty(data,`flags.${FLAG}.gigNpc`,job.id);
        if (data.system?.details?.biography) data.system.details.biography.value = `<p>${esc(n.note ?? "")}</p>` + (data.system.details.biography.value ?? "");
        const actor = await Actor.create(data);
        made.actors.push(actor.id);
        links.actors[n.name] = actor.uuid;
      }
    }

    // A copy of each beat's battle map (once per map), enemies placed hidden.
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
      if (b.enemies.length) await placeTokens(copy,b.enemies,catalogActors);
    }

    const journal = await JournalEntry.create({
      name:`GIG · ${title}`,
      folder:journalRoot.id,
      ownership:{default:0},
      flags:{[FLAG]:{gigJournal:job.id}},
      pages:[
        {name:"Run sheet (GM)",type:"text",text:{content:sheetHtml(job,sheet,links)},sort:0},
        {name:"Handout (show players)",type:"text",text:{content:handoutHtml(job)},sort:100}
      ]
    });

    return {sceneFolder:sceneFolder.id,actorFolder:actorFolder?.id ?? null,journal:journal.id,scenes:made.scenes,actors:made.actors,beatScenes:Object.fromEntries(Object.entries(links.scenes).map(([n,u]) => [n,u.split(".").pop()]))};
  }

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

  const api = {VERSION,runSheet,enemiesOf,rewardFor,rewardText,giveItem,prep,cleanup,resolveAt,KIND_CHECKS,
    resetPools() { pools = null; }};
  globalThis.FEHA_GIG_KIT = api;
  try {
    game.adk ??= {};
    game.adk.gigKit = api;
  } catch {}
})();
