// FEHA // JOB BOARD
//
// Fixer jobs for the crew. Players open the board from the hotbar (ADK //
// JOBS), read the offers and ask for one; the GM approves, runs it at the
// table and marks it done, which pays every crew member in credits and
// Street Cred. Street Cred gates the higher tiers.
//
// State lives in one world setting (SETTING). Only a GM writes it: player
// requests travel to the active GM as a User#query (CH), the same channel
// style as the rest of FEHA (the installed module has no socket). Street
// Cred is an actor flag (flags.fleshEnshrouded.streetCred); credits go
// through ADKWallet so the Market and wallet stay in step.
//
// Jobs come from FEHA_JOB_CATALOG: hand-written jobs (used once each until
// the GM resets them) and generated gigs rolled from its tables.

(() => {
  const VERSION = "1.0.0";
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_JOBS requires FEHA_CYBER_CORE.");
  }

  const FLAG = "fleshEnshrouded";
  const SETTING = "fehaJobBoardV1";
  const CH = "feha.jobs";
  const ROOT_ID = "feha-jobs";
  const STYLE_ID = "feha-jobs-css";
  const MACRO_NAME = "ADK // JOBS";
  const MACRO_IMG = "icons/sundries/documents/document-sealed-signatures-red.webp";
  const HOTBAR_SLOT = 4;
  const PLAYABLE = ["ponyboy","sasha","zach","derke"];
  const HISTORY_MAX = 80;
  const OPEN = ["offered","requested","active"];

  const hooks = [];
  let queryHandler = null;
  let keyHandler = null;
  let ui$ = {tab:"offers",selected:null,crew:null,rollTier:1,fixer:null,draft:null};

  // ------------------------------------------------------------- helpers

  const cat = () => globalThis.FEHA_JOB_CATALOG;
  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const norm = value => String(value ?? "").normalize("NFKD")
    .replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const rid = () => foundry.utils.randomID();
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const roll = (min,max,step=50) =>
    Math.round((min + Math.random() * (max - min)) / step) * step;
  const money = n => "€$ " + Math.round(Number(n) || 0).toLocaleString("en-US");
  const fill = (text,ctx) => String(text).replace(/\{(\w+)\}/g,(m,k) => ctx[k] ?? m);
  const tierInfo = tier => cat()?.TIERS?.[tier] ?? {label:"TIER "+tier,pay:[0,0],cred:0,need:0};
  const isActiveGM = () => Boolean(game.user?.isGM && (game.users.activeGM ?? game.user) === game.user);

  function credOf(actor) {
    return Math.max(0,Math.floor(Number(actor?.flags?.[FLAG]?.streetCred) || 0));
  }

  function rankOf(cred) {
    let label = "NOBODY";
    for (const [min,name] of cat()?.RANKS ?? []) if (cred >= min) label = name;
    return label;
  }

  function crewActors() {
    return PLAYABLE
      .map(name => game.actors.find(a => a.type === "character" && norm(a.name) === name))
      .filter(Boolean);
  }

  function myActor() {
    const sync = globalThis.FEHA_MULTIPLAYER_SYNC;
    const viaSync = sync?.localActor?.() ?? null;
    if (viaSync) return viaSync;
    const assigned = game.user?.character ?? null;
    if (assigned) return assigned;
    return crewActors().find(a => a.isOwner) ?? null;
  }

  function fixerOf(job) {
    return cat()?.FIXERS?.find(f => f.key === job?.fixer) ?? null;
  }

  // City map spot for a job (FEHA_CITY), and its label.
  const city = () => globalThis.FEHA_CITY ?? null;
  const spotOf = job => job?.spot ?? city()?.spotFor?.({district:job?.district,map:job?.map,fixer:job?.fixer,key:job?.key}) ?? null;
  const spotLabel = job => city()?.place?.(spotOf(job))?.label ?? null;
  async function marker(job,on) {
    try {
      if (on) await city()?.setJobMarker?.({...job,spot:spotOf(job)});
      else await city()?.clearJobMarker?.(job.id);
    } catch (err) { console.warn("FEHA JOBS // city marker failed",err); }
  }

  function sceneFor(name) {
    if (!name) return null;
    const exact = game.scenes.find(s => s.name === name);
    if (exact) return exact;
    const lower = norm(name);
    return game.scenes.find(s => norm(s.name).startsWith(lower)) ?? null;
  }

  // -------------------------------------------------------------- state

  function registerSetting() {
    if (game.settings.settings.has("world."+SETTING)) return;
    game.settings.register("world",SETTING,{
      scope:"world",
      config:false,
      type:Object,
      default:{},
      // Bound through the global so a hot reload's new code handles it.
      onChange:() => globalThis.FEHA_JOBS?.rerender?.()
    });
  }

  function read() {
    const raw = foundry.utils.deepClone(game.settings.get("world",SETTING) ?? {});
    raw.v ??= 1;
    raw.size ??= 8;
    raw.jobs ??= {};
    raw.used ??= [];
    return raw;
  }

  async function write(state) {
    if (!game.user?.isGM) throw new Error("Only a GM can change the job board.");
    const done = Object.values(state.jobs)
      .filter(j => !OPEN.includes(j.status))
      .sort((a,b) => (b.updated ?? 0) - (a.updated ?? 0));
    for (const old of done.slice(HISTORY_MAX)) delete state.jobs[old.id];
    await game.settings.set("world",SETTING,state);
  }

  const jobsWith = (state,...statuses) =>
    Object.values(state.jobs)
      .filter(j => statuses.includes(j.status))
      .sort((a,b) => (a.tier - b.tier) || ((a.created ?? 0) - (b.created ?? 0)));

  // -------------------------------------------------------- job creation

  function fromCatalog(def) {
    const now = Date.now();
    return placeJob({
      ...foundry.utils.deepClone(def),
      id:rid(),
      src:"catalog",
      cred:tierInfo(def.tier).cred,
      status:"offered",
      crew:[],
      created:now,
      updated:now
    });
  }

  function generate(tier=null) {
    const C = cat();
    const G = C.gen;
    const fixers = tier
      ? C.FIXERS.filter(f => tier >= f.tiers[0] && tier <= f.tiers[1])
      : C.FIXERS;
    const fixer = pick(fixers.length ? fixers : C.FIXERS);
    const t = tier ?? (fixer.tiers[0] + Math.floor(Math.random() * (fixer.tiers[1] - fixer.tiers[0] + 1)));
    const kindName = pick(Object.keys(G.KINDS));
    const kind = G.KINDS[kindName];
    const inTier = Object.entries(G.FACTIONS).filter(([,f]) => t >= f.tiers[0] && t <= f.tiers[1]);
    const fitting = inTier.filter(([name]) => !kind.factions || kind.factions.includes(name));
    const [faction,fdef] = pick(fitting.length ? fitting : inTier.length ? inTier : Object.entries(G.FACTIONS));
    const map = pick(G.PLACES[pick(kind.places)]);
    const bare = map.replace(/^the /i,"");
    const place = /(Street|Streets|Alley|Road)$/.test(bare) ? bare : "the " + bare;
    const factionText = fdef.label ?? faction;
    const whoPool = G.WHO.filter(w => !w.toLowerCase().includes(faction.toLowerCase()));
    const ctx = {item:pick(G.ITEMS),who:pick(whoPool.length ? whoPool : G.WHO),place,faction:factionText};
    const cap = text => text.charAt(0).toUpperCase() + text.slice(1);

    // Enemies: rank-and-file from below the job's tier (3-5 of them) and,
    // from tier II up, one leader at or just under the tier. Cyberpsycho
    // gigs are the psycho(s) instead.
    const counts = new Map();
    const add = name => counts.set(name,(counts.get(name) ?? 0) + 1);
    if (kindName === "Cyberpsycho") {
      counts.set("Chromehead",Math.max(1,t - 1));
      if (t >= 4) add("Marble Vigil Lancer");
    } else {
      const lowest = Math.min(...fdef.roster.map(([,rt]) => rt));
      const below = fdef.roster.filter(([,rt]) => rt <= Math.max(lowest,t - 2));
      const grunts = below.length ? below : fdef.roster.filter(([,rt]) => rt === lowest);
      for (let i = 0; i < ({1:3,2:4,3:4,4:5,5:5}[t] ?? 4); i++) add(pick(grunts)[0]);
      if (t >= 2) {
        const leaders = fdef.roster.filter(([,rt]) => rt <= t && rt >= t - 1).sort((x,y) => y[1] - x[1]);
        if (leaders.length) add(leaders[0][0]);
      }
    }

    const info = tierInfo(t);
    const now = Date.now();
    return {
      id:rid(),
      key:"gen-"+rid(),
      src:"generated",
      fixer:fixer.key,
      tier:t,
      kind:kindName,
      title:pick(kind.titles),
      district:Math.random() < 0.5 ? fixer.district : pick(G.DISTRICTS),
      map,
      enemies:[...counts.entries()],
      pay:roll(info.pay[0],info.pay[1]),
      cred:info.cred,
      brief:cap(fill(pick(kind.briefs),ctx)),
      objectives:kind.objectives.map(o => cap(fill(o,ctx))),
      twist:pick(G.TWISTS),
      status:"offered",
      crew:[],
      created:now,
      updated:now
    };
  }

  // Put a job on the city map. If its spot is in another district (the only
  // place with its battle map), the job moves there, so WHERE matches the pin.
  function placeJob(job) {
    job.spot = city()?.spotFor?.({district:job.district,map:job.map,fixer:job.fixer,key:job.key}) ?? null;
    const at = city()?.place?.(job.spot);
    if (at && city()?.DISTRICTS?.[job.district] && at.district !== job.district) job.district = at.district;
    return job;
  }

  // Highest tier any crew member can take, used to aim new offers.
  function partyTier() {
    const best = Math.max(0,...crewActors().map(credOf));
    let tier = 1;
    for (const [t,info] of Object.entries(cat().TIERS)) if (best >= info.need) tier = Math.max(tier,Number(t));
    return tier;
  }

  // Replace the open offers with a fresh set: mostly jobs the crew can take,
  // one or two a tier above to aim for. Requested and active jobs stay.
  function rollOffers(state) {
    for (const job of jobsWith(state,"offered")) delete state.jobs[job.id];
    const reach = partyTier();
    const used = new Set(state.used);
    const taken = new Set(jobsWith(state,"requested","active").map(j => j.key));
    const unused = cat().JOBS.filter(j => !used.has(j.key) && !taken.has(j.key));
    const fresh = unused.filter(j => !j.for);
    const size = Math.max(3,Math.min(16,Number(state.size) || 8));

    // At most one personal job per board (about three boards in five), for
    // a crew member who is in the world and within reach.
    const names = new Set(crewActors().map(a => norm(a.name)));
    const personal = unused.filter(j => j.for && names.has(norm(j.for)) && j.tier <= reach);
    let slots = size;
    if (personal.length && Math.random() < 0.6) {
      const job = fromCatalog(pick(personal));
      state.jobs[job.id] = job;
      slots -= 1;
    }

    const stretch = reach < 5 ? Math.min(2,Math.max(1,Math.floor(slots / 5))) : 0;
    const want = [];
    for (let i = 0; i < slots - stretch; i++) want.push(1 + Math.floor(Math.random() * reach));
    for (let i = 0; i < stretch; i++) want.push(Math.min(5,reach + 1));

    for (const tier of want) {
      const options = fresh.filter(j => j.tier === tier);
      // Hand-written jobs first (about four in five), generated gigs fill in.
      if (options.length && Math.random() < 0.8) {
        const def = pick(options);
        fresh.splice(fresh.indexOf(def),1);
        const job = fromCatalog(def);
        state.jobs[job.id] = job;
      } else {
        const job = placeJob(generate(tier));
        state.jobs[job.id] = job;
      }
    }
  }

  // ----------------------------------------------------- GM-side actions

  async function chat(content,{gmOnly=false}={}) {
    const data = {content,speaker:{alias:"FIXER NET"}};
    if (gmOnly) data.whisper = game.users.filter(u => u.isGM).map(u => u.id);
    try { await ChatMessage.create(data); } catch (err) { console.warn("FEHA JOBS // chat failed",err); }
  }

  const crewNames = ids => ids.map(id => game.actors.get(id)?.name).filter(Boolean).join(", ") || "nobody";

  // Chat card for a job event. tone: offer | request | go | done | fail.
  function chatCard(job,{kicker,tone,body}) {
    const fixer = job ? fixerOf(job) : null;
    return `<div class="feha-job-card fjc-${tone}"${fixer?.color ? ` style="--fjc-accent:${esc(fixer.color)}"` : ""}>
      <div class="fjc-k"><span>${esc(kicker)}</span>${fixer ? `<span>${esc(fixer.handle)}</span>` : ""}</div>
      ${job ? `<div class="fjc-t">${esc(job.title)}</div>
      <div class="fjc-m">${esc(tierInfo(job.tier).label)} · ${esc(job.kind)} · ${esc(job.district)}</div>` : ""}
      <div class="fjc-b">${body}</div>
    </div>`;
  }

  const actions = {
    async request({jobId,actorId,crew,userId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "offered") throw new Error("That job is no longer on the board.");
      const actor = game.actors.get(actorId);
      const user = game.users.get(userId);
      if (!actor || !user) throw new Error("Unknown character.");
      if (!user.isGM && !actor.testUserPermission(user,"OWNER")) throw new Error("You can only ask for a job as your own character.");
      const need = tierInfo(job.tier).need;
      if (!user.isGM && credOf(actor) < need) throw new Error(`${actor.name} needs ${need} Street Cred for this job.`);
      const ids = [...new Set([actorId,...(crew ?? [])])].filter(id => game.actors.get(id));
      Object.assign(job,{status:"requested",crew:ids,requestedBy:userId,requestedAs:actorId,updated:Date.now()});
      await write(state);
      await chat(chatCard(job,{kicker:"REQUEST",tone:"request",body:`<p><b>${esc(actor.name)}</b> wants this job.</p><p>Crew: ${esc(crewNames(ids))}</p><p class="fjc-hint">Open Jobs on the hotbar to approve or decline.</p>`}),{gmOnly:true});
      ui.notifications.info(`FIXER NET // ${actor.name} asked for "${job.title}".`);
      return {ok:true};
    },

    async withdraw({jobId,userId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "requested") throw new Error("That request is no longer open.");
      const user = game.users.get(userId);
      if (!user?.isGM && job.requestedBy !== userId) throw new Error("Only the player who asked can withdraw.");
      Object.assign(job,{status:"offered",crew:[],requestedBy:null,requestedAs:null,updated:Date.now()});
      await write(state);
      return {ok:true};
    },

    async approve({jobId,crew}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || !["offered","requested"].includes(job.status)) throw new Error("That job can't be started.");
      if (crew?.length) job.crew = crew.filter(id => game.actors.get(id));
      if (!job.crew.length) throw new Error("Pick at least one crew member.");
      Object.assign(job,{status:"active",started:Date.now(),updated:Date.now()});
      if (job.src === "catalog" && !state.used.includes(job.key)) state.used.push(job.key);
      await write(state);
      await marker(job,true);
      const fixer = fixerOf(job);
      await chat(chatCard(job,{kicker:"JOB ACCEPTED",tone:"go",body:`<p>Crew: <b>${esc(crewNames(job.crew))}</b></p>${fixer ? `<p class="fjc-q">“${esc(fixer.voice)}”</p>` : ""}`}));
      return {ok:true};
    },

    async decline({jobId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "requested") throw new Error("That request is no longer open.");
      const who = game.actors.get(job.requestedAs)?.name ?? "The crew";
      Object.assign(job,{status:"offered",crew:[],requestedBy:null,requestedAs:null,updated:Date.now()});
      await write(state);
      await chat(chatCard(job,{kicker:"TURNED DOWN",tone:"fail",body:`<p>The fixer turned ${esc(who)} down. Not this one.</p>`}));
      return {ok:true};
    },

    async complete({jobId,pay,cred}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "active") throw new Error("Only an active job can be paid out.");
      const each = Math.max(0,Math.round(Number(pay ?? job.pay) || 0));
      const credEach = Math.max(0,Math.round(Number(cred ?? job.cred) || 0));
      const wallet = globalThis.ADKWallet;
      const paid = [];
      for (const id of job.crew) {
        const actor = game.actors.get(id);
        if (!actor) continue;
        if (each) {
          if (wallet?.addCredits) await wallet.addCredits(actor,each);
          else throw new Error("The credits wallet isn't loaded; nothing was paid.");
        }
        if (credEach) await actor.update({[`flags.${FLAG}.streetCred`]:credOf(actor) + credEach});
        paid.push(actor.name);
      }
      Object.assign(job,{status:"done",paid:each,credPaid:credEach,finished:Date.now(),updated:Date.now()});
      await write(state);
      await marker(job,false);
      await chat(chatCard(job,{kicker:"JOB DONE",tone:"done",body:`<div class="fjc-pay"><span>${money(each)}</span><span>+${credEach} CRED</span></div><p>${esc(paid.join(", ") || "Nobody")} ${paid.length === 1 ? "gets" : "each get"} the payout.</p>`}));
      return {ok:true};
    },

    async fail({jobId,cred}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "active") throw new Error("Only an active job can fail.");
      const credEach = Math.round(Number(cred) || 0);
      if (credEach) {
        for (const id of job.crew) {
          const actor = game.actors.get(id);
          if (actor) await actor.update({[`flags.${FLAG}.streetCred`]:Math.max(0,credOf(actor) + credEach)});
        }
      }
      Object.assign(job,{status:"failed",credPaid:credEach,finished:Date.now(),updated:Date.now()});
      await write(state);
      await marker(job,false);
      await chat(chatCard(job,{kicker:"JOB FAILED",tone:"fail",body:`<p>${credEach ? `${credEach > 0 ? "+" : ""}${credEach} Street Cred for ${esc(crewNames(job.crew))}.` : "No pay. The fixer will remember."}</p>`}));
      return {ok:true};
    },

    async reopen({jobId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job) throw new Error("Unknown job.");
      Object.assign(job,{status:"offered",crew:[],requestedBy:null,requestedAs:null,updated:Date.now()});
      state.used = state.used.filter(k => k !== job.key);
      await write(state);
      await marker(job,false);
      return {ok:true};
    },

    async remove({jobId}) {
      const state = read();
      delete state.jobs[jobId];
      await write(state);
      await marker({id:jobId},false);
      return {ok:true};
    },

    // A GM-written job (story beats, one-offs). Posted straight to the board.
    async write({draft}) {
      const d = draft ?? {};
      const title = String(d.title ?? "").trim();
      if (!title) throw new Error("Give the job a title.");
      const tier = Math.max(1,Math.min(5,Number(d.tier) || 1));
      const fixer = cat().FIXERS.find(f => f.key === d.fixer) ? d.fixer : cat().FIXERS[0].key;
      const lines = value => String(value ?? "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const now = Date.now();
      const job = {
        id:rid(),
        key:"custom-"+rid(),
        src:"custom",
        fixer,
        tier,
        kind:String(d.kind ?? "").trim() || "Job",
        title,
        district:String(d.district ?? "").trim() || fixerOf({fixer})?.district || "Alabastra",
        map:String(d.map ?? "").trim(),
        enemies:[],
        pay:Math.max(0,Math.round(Number(d.pay) || tierInfo(tier).pay[0])),
        cred:Math.max(0,Math.round(Number(d.cred) || tierInfo(tier).cred)),
        brief:String(d.brief ?? "").trim(),
        objectives:lines(d.objectives),
        twist:String(d.twist ?? "").trim(),
        status:"offered",
        crew:[],
        created:now,
        updated:now
      };
      placeJob(job);
      const state = read();
      state.jobs[job.id] = job;
      await write(state);
      return {ok:true,id:job.id};
    },

    async newOffers() {
      const state = read();
      rollOffers(state);
      await write(state);
      await chat(chatCard(null,{kicker:"FIXER NET",tone:"offer",body:`<div class="fjc-t">New work on the board</div><p>${jobsWith(state,"offered").length} jobs posted. Open <b>Jobs</b> on the hotbar.</p>`}));
      return {ok:true};
    },

    async rollOne({tier}) {
      const state = read();
      const job = placeJob(generate(Math.max(1,Math.min(5,Number(tier) || 1))));
      state.jobs[job.id] = job;
      await write(state);
      return {ok:true,id:job.id};
    },

    async setSize({size}) {
      const state = read();
      state.size = Math.max(3,Math.min(16,Number(size) || 8));
      await write(state);
      return {ok:true};
    },

    async resetUsed() {
      const state = read();
      state.used = [];
      await write(state);
      return {ok:true};
    },

    async setCred({actorId,cred}) {
      const actor = game.actors.get(actorId);
      if (!actor) throw new Error("Unknown character.");
      await actor.update({[`flags.${FLAG}.streetCred`]:Math.max(0,Math.round(Number(cred) || 0))});
      return {ok:true};
    }
  };

  // Players may only ask and withdraw; everything else is GM-only.
  const PLAYER_ACTIONS = new Set(["request","withdraw"]);

  async function run(kind,payload={}) {
    if (!actions[kind]) throw new Error("Unknown job action: " + kind);
    payload.userId = game.user.id;
    if (game.user.isGM) return actions[kind](payload);
    if (!PLAYER_ACTIONS.has(kind)) throw new Error("Only the GM can do that.");
    const gm = game.users.activeGM;
    if (!gm) throw new Error("No GM is online to take the request.");
    const result = await gm.query(CH,{kind,payload},{timeout:15000});
    if (!result?.ok) throw new Error(result?.error ?? "The GM's game didn't answer.");
    return result;
  }

  async function onQuery(message) {
    if (!isActiveGM()) return {ok:false,error:"Not the active GM."};
    const {kind,payload} = message ?? {};
    if (!PLAYER_ACTIONS.has(kind)) return {ok:false,error:"Not allowed."};
    try {
      return await actions[kind](payload ?? {});
    } catch (err) {
      return {ok:false,error:String(err?.message ?? err)};
    }
  }

  // ------------------------------------------------------------------ UI

  const CSS = `
#${ROOT_ID}{
  --fj-bg:#0b0507;--fj-panel:#150a0d;--fj-panel-2:#1d0d12;--fj-panel-3:#251117;
  --fj-line:rgba(255,94,87,.28);--fj-line-soft:rgba(255,94,87,.14);
  --fj-red:#ff5e57;--fj-red-faint:rgba(255,94,87,.12);--fj-cyan:#5ef2ff;--fj-cyan-faint:rgba(94,242,255,.10);
  --fj-yellow:#f3e600;--fj-text:#f1e6e3;--fj-muted:#c39c98;--fj-dim:#8f706c;
  --fj-t1:#bdb7b5;--fj-t2:#37e07c;--fj-t3:#2f8dff;--fj-t4:#b45cff;--fj-t5:#ff9d2e;
  --fj-display:"Rajdhani","Roboto Condensed","Arial Narrow",sans-serif;
  --fj-mono:"Share Tech Mono",ui-monospace,monospace;
  --fj-accent:var(--fj-red);
  color-scheme:dark;position:fixed;inset:4vh 3vw;z-index:900000;display:flex;flex-direction:column;
  max-width:1320px;margin:0 auto;color:var(--fj-text);font-family:var(--fj-display);font-size:15px;line-height:1.35;
  background:
    repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0 1px,transparent 1px 3px),
    linear-gradient(90deg,transparent 0 calc(100% - 1px),rgba(255,94,87,.04) 0) 0 0/88px 88px,
    linear-gradient(0deg,transparent 0 calc(100% - 1px),rgba(255,94,87,.04) 0) 0 0/88px 88px,
    radial-gradient(ellipse at 18% 0%,rgba(255,94,87,.12),transparent 55%),
    radial-gradient(ellipse at 100% 100%,rgba(94,242,255,.05),transparent 50%),var(--fj-bg);
  border:1px solid var(--fj-line);
  box-shadow:0 0 0 1px #000,0 28px 70px rgba(0,0,0,.8);
  clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px));
  animation:fj-in .16s ease-out;
}
@keyframes fj-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
#${ROOT_ID} *{box-sizing:border-box;border-radius:0}
#${ROOT_ID} ::-webkit-scrollbar{width:8px;height:8px}
#${ROOT_ID} ::-webkit-scrollbar-thumb{background:rgba(255,94,87,.35)}
#${ROOT_ID} ::-webkit-scrollbar-track{background:transparent}
#${ROOT_ID} button{font-family:var(--fj-display);font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;
  background:transparent;color:var(--fj-text);border:1px solid var(--fj-line);padding:6px 12px;min-height:32px;height:auto;line-height:1;width:auto;margin:0;flex:0 0 auto;
  transition:background-color .12s,border-color .12s,color .12s}
#${ROOT_ID} button:hover{border-color:var(--fj-red);background:var(--fj-red-faint)}
#${ROOT_ID} button:active{transform:translateY(1px)}
#${ROOT_ID} button:focus-visible,#${ROOT_ID} input:focus-visible,#${ROOT_ID} select:focus-visible,#${ROOT_ID} textarea:focus-visible{outline:2px solid var(--fj-cyan);outline-offset:2px}
#${ROOT_ID} button.is-armed{background:var(--fj-yellow);color:#141200;border-color:var(--fj-yellow)}
#${ROOT_ID} button:disabled{opacity:.45;cursor:not-allowed;transform:none}
#${ROOT_ID} .fj-primary{background:var(--fj-red);color:#140405;border-color:var(--fj-red)}
#${ROOT_ID} .fj-primary:hover{background:#ff7a74;border-color:#ff7a74}
#${ROOT_ID} .fj-go{background:var(--fj-yellow);color:#141200;border-color:var(--fj-yellow)}
#${ROOT_ID} .fj-go:hover{background:#fff46a;border-color:#fff46a}
#${ROOT_ID} .fj-ghost{border-color:transparent;color:var(--fj-muted)}
#${ROOT_ID} input,#${ROOT_ID} select,#${ROOT_ID} textarea{background:#0a0405;color:var(--fj-text);border:1px solid var(--fj-line);font-family:var(--fj-mono);font-size:13px;
  height:32px;padding:0 8px;width:auto;flex:0 0 auto;margin:0}
#${ROOT_ID} textarea{height:auto;min-height:72px;padding:8px;width:100%;resize:vertical;line-height:1.4}

/* header */
#${ROOT_ID} .fj-head{display:flex;align-items:center;gap:18px;padding:14px 22px 12px;border-bottom:1px solid var(--fj-red);
  box-shadow:0 1px 0 rgba(255,94,87,.25),0 6px 18px -8px rgba(255,94,87,.55);flex-wrap:wrap;cursor:move;user-select:none;
  background:linear-gradient(180deg,rgba(255,94,87,.07),transparent)}
#${ROOT_ID} .fj-brand{display:flex;flex-direction:column;min-width:0}
#${ROOT_ID} .fj-eyebrow{font-family:var(--fj-mono);font-size:11px;letter-spacing:.24em;color:var(--fj-red);display:flex;gap:10px;align-items:center}
#${ROOT_ID} .fj-eyebrow i{width:7px;height:7px;background:var(--fj-cyan);box-shadow:0 0 8px var(--fj-cyan);display:inline-block;animation:fj-blink 2.4s steps(1) infinite}
@keyframes fj-blink{50%{opacity:.25}}
#${ROOT_ID} .fj-title{font-size:32px;font-weight:700;letter-spacing:.14em;line-height:1;color:var(--fj-text);margin:3px 0 0;border:0;text-shadow:0 0 18px rgba(255,94,87,.35)}
#${ROOT_ID} .fj-title b{color:var(--fj-red);font-weight:700}
#${ROOT_ID} .fj-crew{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}
#${ROOT_ID} .fj-chip{display:flex;flex-direction:column;gap:2px;padding:5px 10px 6px;border:1px solid var(--fj-line-soft);background:var(--fj-panel);min-width:104px;cursor:default}
#${ROOT_ID} .fj-chip.is-me{border-color:var(--fj-cyan);background:var(--fj-cyan-faint)}
#${ROOT_ID} .fj-chip b{font-size:13px;letter-spacing:.08em;text-transform:uppercase}
#${ROOT_ID} .fj-chip span{font-family:var(--fj-mono);font-size:11px;color:var(--fj-muted)}
#${ROOT_ID} .fj-chip span em{color:var(--fj-yellow);font-style:normal}
#${ROOT_ID} .fj-meter{height:3px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}
#${ROOT_ID} .fj-meter i{position:absolute;inset:0 auto 0 0;background:var(--fj-yellow);box-shadow:0 0 6px rgba(243,230,0,.6)}
#${ROOT_ID} .fj-close{min-width:36px;padding:6px 10px}

/* tab bar */
#${ROOT_ID} .fj-bar{display:flex;align-items:center;gap:4px;padding:10px 22px;border-bottom:1px solid var(--fj-line-soft);flex-wrap:wrap}
#${ROOT_ID} .fj-tab{border-color:transparent;color:var(--fj-muted)}
#${ROOT_ID} .fj-tab:hover{color:var(--fj-text)}
#${ROOT_ID} .fj-tab[aria-pressed="true"]{color:var(--fj-cyan);border-color:var(--fj-cyan);background:var(--fj-cyan-faint)}
#${ROOT_ID} .fj-tab .fj-count{font-family:var(--fj-mono);margin-left:6px;color:var(--fj-yellow)}
#${ROOT_ID} .fj-tab .fj-alert{display:inline-block;margin-left:6px;padding:2px 5px;background:var(--fj-yellow);color:#141200;font-family:var(--fj-mono);font-size:11px;letter-spacing:.06em}
#${ROOT_ID} .fj-tools{margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
#${ROOT_ID} .fj-tools .fj-sep{width:1px;height:22px;background:var(--fj-line-soft);margin:0 4px}

/* body */
#${ROOT_ID} .fj-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(310px,430px) 1fr}
#${ROOT_ID} .fj-listwrap{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--fj-line-soft)}
#${ROOT_ID} .fj-filter{display:flex;gap:6px;align-items:center;padding:10px 12px 0 22px;flex-wrap:wrap;font-family:var(--fj-mono);font-size:11px;letter-spacing:.12em;color:var(--fj-muted)}
#${ROOT_ID} .fj-filter button{min-height:26px;padding:4px 8px;font-size:12px}
#${ROOT_ID} .fj-filter button[aria-pressed="true"]{border-color:var(--fj-cyan);color:var(--fj-cyan);background:var(--fj-cyan-faint)}
#${ROOT_ID} .fj-list{flex:1;overflow:auto;overscroll-behavior:contain;padding:12px 12px 16px 22px;display:flex;flex-direction:column;gap:8px}
#${ROOT_ID} .fj-empty{color:var(--fj-muted);padding:28px 4px;font-size:16px;max-width:46ch}
#${ROOT_ID} .fj-empty b{display:block;font-family:var(--fj-mono);font-size:11px;letter-spacing:.2em;color:var(--fj-red);margin-bottom:6px;font-weight:400}

/* job cards */
#${ROOT_ID} .fj-card{position:relative;display:grid;grid-template-columns:38px 1fr auto;gap:2px 12px;text-align:left;width:100%;
  padding:10px 12px 10px 14px;flex:0 0 auto;background:var(--fj-panel);border:1px solid var(--fj-line-soft);
  text-transform:none;letter-spacing:0;font-weight:500;min-height:0;line-height:1.3}
#${ROOT_ID} .fj-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--fj-tc)}
#${ROOT_ID} .fj-card:hover{background:var(--fj-panel-2);border-color:var(--fj-line)}
#${ROOT_ID} .fj-card[aria-current="true"]{border-color:var(--fj-cyan);background:var(--fj-panel-3);box-shadow:inset 0 0 0 1px var(--fj-cyan-faint),0 0 18px -8px var(--fj-cyan)}
#${ROOT_ID} .fj-card.is-locked .fj-n,#${ROOT_ID} .fj-card.is-locked .fj-p{opacity:.55}
#${ROOT_ID} .fj-mono{grid-row:1/4;align-self:start;width:38px;height:38px;display:grid;place-items:center;font-family:var(--fj-mono);font-size:14px;
  color:#0b0507;background:var(--fj-accent);clip-path:polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)}
#${ROOT_ID} .fj-card .fj-k{grid-column:2/4;font-family:var(--fj-mono);font-size:11px;letter-spacing:.14em;color:var(--fj-muted);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${ROOT_ID} .fj-card .fj-k b{color:var(--fj-accent);font-weight:400}
#${ROOT_ID} .fj-card .fj-n{font-size:18px;font-weight:700;letter-spacing:.03em;color:var(--fj-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${ROOT_ID} .fj-card .fj-p{font-family:var(--fj-mono);font-size:13px;color:var(--fj-yellow);white-space:nowrap;align-self:center}
#${ROOT_ID} .fj-card .fj-s{grid-column:2/4;display:flex;gap:6px;flex-wrap:wrap;margin-top:3px}
#${ROOT_ID} .fj-tag{font-family:var(--fj-mono);font-size:11px;letter-spacing:.1em;padding:1px 6px;border:1px solid var(--fj-line);color:var(--fj-muted);text-transform:uppercase;white-space:nowrap}
#${ROOT_ID} .fj-tag.t{color:var(--fj-tc);border-color:var(--fj-tc)}
#${ROOT_ID} .fj-tag.me{color:var(--fj-cyan);border-color:var(--fj-cyan)}
#${ROOT_ID} .fj-tag.st-requested{color:#141200;background:var(--fj-yellow);border-color:var(--fj-yellow)}
#${ROOT_ID} .fj-tag.st-active{color:#031417;background:var(--fj-cyan);border-color:var(--fj-cyan)}
#${ROOT_ID} .fj-tag.st-done{color:var(--fj-t2);border-color:var(--fj-t2)}
#${ROOT_ID} .fj-tag.st-failed{color:var(--fj-red);border-color:var(--fj-red)}
#${ROOT_ID} .fj-tag.lock{color:var(--fj-red);border-color:var(--fj-red)}

/* detail */
#${ROOT_ID} .fj-detail{overflow:auto;overscroll-behavior:contain;padding:18px 28px 26px;position:relative}
#${ROOT_ID} .fj-fixer{display:grid;grid-template-columns:56px 1fr;gap:14px;align-items:start;padding:12px 14px;border:1px solid var(--fj-line-soft);
  background:linear-gradient(90deg,color-mix(in srgb,var(--fj-accent) 9%,transparent),transparent 60%),var(--fj-panel);margin-bottom:18px;border-left:3px solid var(--fj-accent)}
#${ROOT_ID} .fj-fixer .fj-mono{grid-row:auto;width:56px;height:56px;font-size:20px}
#${ROOT_ID} .fj-fixer .fj-h{font-size:12px;font-family:var(--fj-mono);letter-spacing:.2em;color:var(--fj-accent)}
#${ROOT_ID} .fj-fixer .fj-who{font-size:16px;font-weight:700;letter-spacing:.02em}
#${ROOT_ID} .fj-fixer q{display:block;color:var(--fj-text);font-style:italic;margin-top:4px;opacity:.85}
#${ROOT_ID} .fj-fixer p{margin:4px 0 0;color:var(--fj-muted);font-size:14px;max-width:78ch}
#${ROOT_ID} .fj-hero{position:relative}
#${ROOT_ID} .fj-hero .fj-wm{position:absolute;right:0;top:-10px;font-family:var(--fj-display);font-size:92px;font-weight:700;line-height:1;color:var(--fj-tc);opacity:.10;pointer-events:none;letter-spacing:-.02em}
#${ROOT_ID} h2.fj-jt{font-size:36px;font-weight:700;letter-spacing:.06em;line-height:1.02;margin:0 0 10px;border:0;color:var(--fj-text);text-transform:uppercase;max-width:22ch}
#${ROOT_ID} .fj-meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin-bottom:16px;font-family:var(--fj-mono);font-size:13px;color:var(--fj-muted);align-items:center}
#${ROOT_ID} .fj-meta b{color:var(--fj-text);font-weight:400}
#${ROOT_ID} .fj-meta .pay b{color:var(--fj-yellow)}
#${ROOT_ID} .fj-meta .tier b{color:var(--fj-tc)}
#${ROOT_ID} .fj-brief{font-size:17px;max-width:68ch;margin:0 0 6px}
#${ROOT_ID} h3.fj-sh{font-family:var(--fj-mono);font-size:12px;letter-spacing:.22em;color:var(--fj-red);margin:18px 0 8px;border:0;font-weight:400;text-transform:uppercase;display:flex;align-items:center;gap:10px}
#${ROOT_ID} h3.fj-sh::after{content:"";flex:1;height:1px;background:var(--fj-line-soft)}
#${ROOT_ID} ol.fj-obj{margin:0;padding:0;list-style:none;max-width:68ch;counter-reset:obj}
#${ROOT_ID} ol.fj-obj li{counter-increment:obj;display:grid;grid-template-columns:28px 1fr;gap:8px;padding:5px 0;border-bottom:1px dashed var(--fj-line-soft)}
#${ROOT_ID} ol.fj-obj li::before{content:counter(obj,decimal-leading-zero);font-family:var(--fj-mono);color:var(--fj-cyan);font-size:13px;padding-top:1px}
#${ROOT_ID} .fj-gm{margin-top:20px;padding:12px 14px;border:1px dashed rgba(243,230,0,.45);background:rgba(243,230,0,.035)}
#${ROOT_ID} .fj-gm h3.fj-sh{color:var(--fj-yellow);margin-top:4px}
#${ROOT_ID} .fj-gm h3.fj-sh::after{background:rgba(243,230,0,.2)}
#${ROOT_ID} .fj-gm p{margin:4px 0 10px;max-width:68ch}
#${ROOT_ID} .fj-gm-hidden{margin-top:20px;font-family:var(--fj-mono);font-size:12px;color:var(--fj-dim);letter-spacing:.12em}
#${ROOT_ID} .fj-enemies{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
#${ROOT_ID} .fj-enemies button{text-transform:none;letter-spacing:.02em;font-weight:600;min-height:28px;padding:4px 8px}
#${ROOT_ID} .fj-enemies span.fj-tag{font-size:12px;padding:4px 8px;text-transform:none;letter-spacing:.02em}
#${ROOT_ID} .fj-act{margin-top:22px;padding:14px 16px;border:1px solid var(--fj-line-soft);background:var(--fj-panel);display:flex;flex-direction:column;gap:10px}
#${ROOT_ID} .fj-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
#${ROOT_ID} .fj-crewpick{display:flex;gap:8px;flex-wrap:wrap}
#${ROOT_ID} .fj-crewpick label{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--fj-line);cursor:pointer;font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:13px;user-select:none}
#${ROOT_ID} .fj-crewpick label:has(input:checked){border-color:var(--fj-cyan);background:var(--fj-cyan-faint);color:var(--fj-cyan)}
#${ROOT_ID} .fj-crewpick label:has(input:disabled){opacity:.5;cursor:not-allowed}
#${ROOT_ID} .fj-crewpick input{height:auto;margin:0;accent-color:var(--fj-cyan)}
#${ROOT_ID} .fj-note{font-size:14px;color:var(--fj-muted)}
#${ROOT_ID} .fj-note.warn{color:var(--fj-red)}
#${ROOT_ID} .fj-pay label,#${ROOT_ID} .fj-form label{font-family:var(--fj-mono);font-size:11px;letter-spacing:.12em;color:var(--fj-muted);display:flex;gap:6px;align-items:center}
#${ROOT_ID} .fj-pay input{width:110px}
#${ROOT_ID} .fj-tc1{--fj-tc:var(--fj-t1)} #${ROOT_ID} .fj-tc2{--fj-tc:var(--fj-t2)} #${ROOT_ID} .fj-tc3{--fj-tc:var(--fj-t3)}
#${ROOT_ID} .fj-tc4{--fj-tc:var(--fj-t4)} #${ROOT_ID} .fj-tc5{--fj-tc:var(--fj-t5)}

/* fixers tab */
#${ROOT_ID} .fj-fixers{grid-column:1/-1;overflow:auto;overscroll-behavior:contain;padding:18px 22px 26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;align-content:start}
#${ROOT_ID} .fj-fx{display:flex;flex-direction:column;gap:8px;padding:14px;border:1px solid var(--fj-line-soft);border-top:3px solid var(--fj-accent);
  background:linear-gradient(180deg,color-mix(in srgb,var(--fj-accent) 8%,transparent),transparent 45%),var(--fj-panel)}
#${ROOT_ID} .fj-fx header{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center}
#${ROOT_ID} .fj-fx .fj-mono{grid-row:auto;width:48px;height:48px;font-size:17px}
#${ROOT_ID} .fj-fx .fj-h{font-family:var(--fj-mono);font-size:12px;letter-spacing:.2em;color:var(--fj-accent)}
#${ROOT_ID} .fj-fx .fj-who{font-size:17px;font-weight:700}
#${ROOT_ID} .fj-fx .fj-d{font-family:var(--fj-mono);font-size:11px;letter-spacing:.1em;color:var(--fj-muted);text-transform:uppercase}
#${ROOT_ID} .fj-fx q{font-style:italic;color:var(--fj-text);opacity:.85}
#${ROOT_ID} .fj-fx p{margin:0;color:var(--fj-muted);font-size:14px;flex:1}
#${ROOT_ID} .fj-fx .fj-stats{display:flex;gap:14px;font-family:var(--fj-mono);font-size:12px;color:var(--fj-muted)}
#${ROOT_ID} .fj-fx .fj-stats b{color:var(--fj-yellow);font-weight:400}
#${ROOT_ID} .fj-mini{min-height:22px;padding:2px 6px;font-size:11px;margin-left:6px}
#${ROOT_ID} .fj-fx footer{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}

/* write-a-job form + cred panel */
#${ROOT_ID} .fj-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;max-width:820px}
#${ROOT_ID} .fj-form label{flex-direction:column;align-items:stretch;gap:4px}
#${ROOT_ID} .fj-form label input,#${ROOT_ID} .fj-form label select{width:100%}
#${ROOT_ID} .fj-form .w2{grid-column:span 2} #${ROOT_ID} .fj-form .w4{grid-column:1/-1}
#${ROOT_ID} .fj-credtable{width:100%;max-width:640px;border-collapse:collapse;font-family:var(--fj-mono);font-size:13px;margin-bottom:6px;background:transparent;border:0}
#${ROOT_ID} .fj-credtable tr,#${ROOT_ID} .fj-credtable thead{background:transparent}
#${ROOT_ID} .fj-credtable tbody tr:nth-child(even){background:rgba(255,94,87,.035)}
#${ROOT_ID} .fj-credtable td,#${ROOT_ID} .fj-credtable th{border-bottom:1px solid var(--fj-line-soft);padding:7px 8px;text-align:left;font-weight:400}
#${ROOT_ID} .fj-credtable th{color:var(--fj-dim);font-size:11px;letter-spacing:.14em;text-transform:uppercase}
#${ROOT_ID} .fj-credtable input{width:90px}
#${ROOT_ID} .fj-credtable .fj-meter{width:120px;display:inline-block;vertical-align:middle}

@media (max-width:900px){
  #${ROOT_ID}{inset:0;clip-path:none}
  #${ROOT_ID} .fj-body{grid-template-columns:1fr;grid-template-rows:minmax(170px,40%) 1fr}
  #${ROOT_ID} .fj-listwrap{border-right:0;border-bottom:1px solid var(--fj-line-soft)}
  #${ROOT_ID} .fj-list{padding:10px 16px}
  #${ROOT_ID} .fj-filter{padding:10px 16px 0}
  #${ROOT_ID} .fj-detail{padding:14px 16px}
  #${ROOT_ID} .fj-head,#${ROOT_ID} .fj-bar{padding-left:16px;padding-right:16px}
  #${ROOT_ID} h2.fj-jt{font-size:27px}
  #${ROOT_ID} .fj-form{grid-template-columns:1fr 1fr}
  #${ROOT_ID} .fj-crew{display:none}
}
@media (prefers-reduced-motion:reduce){
  #${ROOT_ID},#${ROOT_ID} .fj-eyebrow i{animation:none}
  #${ROOT_ID} button:active{transform:none}
}

/* chat cards (all clients) */
.chat-message .feha-job-card{--fjc-accent:#ff5e57;border-left:3px solid var(--fjc-accent);padding:6px 8px 8px 10px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--fjc-accent) 10%,transparent),transparent 70%);font-family:"Rajdhani","Roboto Condensed",sans-serif}
.chat-message .feha-job-card .fjc-k{display:flex;justify-content:space-between;gap:8px;font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:.16em;color:var(--fjc-accent);text-transform:uppercase}
.chat-message .feha-job-card.fjc-done .fjc-k span:first-child{color:#37e07c}
.chat-message .feha-job-card.fjc-fail .fjc-k span:first-child{color:#ff5e57}
.chat-message .feha-job-card.fjc-request .fjc-k span:first-child{color:#f3e600}
.chat-message .feha-job-card.fjc-go .fjc-k span:first-child{color:#5ef2ff}
.chat-message .feha-job-card .fjc-t{font-size:19px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;line-height:1.1;margin-top:3px}
.chat-message .feha-job-card .fjc-m{font-family:"Share Tech Mono",monospace;font-size:11px;color:#c39c98;letter-spacing:.06em}
.chat-message .feha-job-card .fjc-b p{margin:5px 0 0}
.chat-message .feha-job-card .fjc-q{font-style:italic;opacity:.85}
.chat-message .feha-job-card .fjc-hint{font-size:12px;opacity:.7}
.chat-message .feha-job-card .fjc-pay{display:flex;gap:12px;margin-top:6px;font-family:"Share Tech Mono",monospace;font-size:15px}
.chat-message .feha-job-card .fjc-pay span:first-child{color:#f3e600}
.chat-message .feha-job-card .fjc-pay span:last-child{color:#5ef2ff}
`;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== CSS) style.textContent = CSS;
  }

  const sfx = kind => { try { globalThis.FEHA_SOUNDS?.play?.(kind,{cooldown:0}); } catch {} };

  const HIDE_KEY = "feha-jobs-hide-gm";
  function hideGM() {
    try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
  }
  function setHideGM(on) {
    try { localStorage.setItem(HIDE_KEY,on ? "1" : "0"); } catch {}
  }

  const initials = fixer => String(fixer?.handle ?? "??").replace(/[^A-Z0-9 ]/gi,"").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0,2).toUpperCase() || "??";
  const accent = fixer => fixer?.color ? ` style="--fj-accent:${esc(fixer.color)}"` : "";
  const monogram = fixer => `<span class="fj-mono" aria-hidden="true">${esc(initials(fixer))}</span>`;

  function nextRank(cred) {
    const ranks = cat()?.RANKS ?? [];
    let floor = 0, next = null;
    for (const [min] of ranks) {
      if (cred >= min) floor = min;
      else if (next === null) next = min;
    }
    return {floor,next,pct:next === null ? 100 : Math.round(100 * (cred - floor) / Math.max(1,next - floor))};
  }

  function statusTag(job) {
    const label = {offered:"",requested:"REQUESTED",active:"ACTIVE",done:"DONE",failed:"FAILED"}[job.status] ?? "";
    return label ? `<span class="fj-tag st-${job.status}">${label}</span>` : "";
  }

  function lockedFor(job,actor) {
    if (game.user.isGM || job.status !== "offered") return false;
    return credOf(actor) < tierInfo(job.tier).need;
  }

  function card(job,me) {
    const fixer = fixerOf(job);
    const locked = lockedFor(job,me);
    const forMe = job.for && me && norm(job.for) === norm(me.name);
    return `
      <button type="button" class="fj-card fj-tc${job.tier}${locked ? " is-locked" : ""}" data-job="${esc(job.id)}"
        aria-current="${ui$.selected === job.id}"${accent(fixer)}>
        ${monogram(fixer)}
        <span class="fj-k"><b>${esc(fixer?.handle ?? job.fixer)}</b> // ${esc(job.kind)} // ${esc(spotLabel(job) ? spotLabel(job).replace(/^\S+ · /,"") : job.district)}</span>
        <span class="fj-n">${esc(job.title)}</span>
        <span class="fj-p">${money(job.pay)}</span>
        <span class="fj-s">
          <span class="fj-tag t">${esc(tierInfo(job.tier).label)}</span>
          <span class="fj-tag">+${job.cred} CRED</span>
          ${job.for ? `<span class="fj-tag${forMe ? " me" : ""}">FOR ${esc(String(job.for).toUpperCase())}</span>` : ""}
          ${job.src === "custom" ? `<span class="fj-tag">STORY</span>` : ""}
          ${statusTag(job)}
          ${locked ? `<span class="fj-tag lock">NEEDS ${tierInfo(job.tier).need} CRED</span>` : ""}
        </span>
      </button>`;
  }

  function crewChips(me) {
    return crewActors().map(a => {
      const cred = credOf(a);
      const r = nextRank(cred);
      return `<div class="fj-chip${me?.id === a.id ? " is-me" : ""}" title="${esc(a.name)}: ${cred} Street Cred${r.next !== null ? ` (${r.next - cred} to next rank)` : ""}">
        <b>${esc(a.name)}</b><span><em>${cred}</em> CRED · ${esc(rankOf(cred))}</span>
        <span class="fj-meter" aria-hidden="true"><i style="width:${r.pct}%"></i></span></div>`;
    }).join("");
  }

  function crewPicker(selected,{disabled=false}={}) {
    return `<div class="fj-crewpick" role="group" aria-label="Crew">${crewActors().map(a => `
      <label><input type="checkbox" data-crew="${esc(a.id)}" ${selected.includes(a.id) ? "checked" : ""} ${disabled ? "disabled" : ""}> ${esc(a.name)}</label>`).join("")}</div>`;
  }

  function gmBlock(job) {
    if (hideGM()) return `<div class="fj-gm-hidden">GM NOTES HIDDEN. Use SHOW GM NOTES in the toolbar to see the twist, enemies and map.</div>`;
    const enemies = (job.enemies ?? []).map(([name,count]) => {
      const actor = game.actors.getName(name);
      return actor
        ? `<button type="button" data-act="sheet" data-actor="${esc(actor.id)}" title="Open ${esc(name)}">${esc(name)} ×${count}</button>`
        : `<span class="fj-tag" title="Not imported yet (Actors tab → NPC import)">${esc(name)} ×${count}</span>`;
    }).join("");
    const scene = sceneFor(job.map);
    return `
      <section class="fj-gm" aria-label="GM only">
        <h3 class="fj-sh">GM ONLY // TWIST</h3>
        <p>${esc(job.twist || "None.")}</p>
        <h3 class="fj-sh">ENEMIES</h3>
        <div class="fj-enemies">${enemies || `<span class="fj-note">None listed.</span>`}</div>
        <h3 class="fj-sh">SUGGESTED MAP</h3>
        <div class="fj-row">
          <span>${esc(job.map || "—")}</span>
          ${scene ? `<button type="button" data-act="viewmap" data-scene="${esc(scene.id)}" title="Preview on your screen only; players stay where they are">View map</button>` : (job.map ? `<span class="fj-note">No scene with that name.</span>` : "")}
        </div>
      </section>`;
  }

  function actionBlock(job,me) {
    const isGM = game.user.isGM;
    const need = tierInfo(job.tier).need;

    if (job.status === "offered") {
      if (isGM) {
        const crew = ui$.crew ?? crewActors().map(a => a.id);
        return `<div class="fj-act">
          <span class="fj-note">Start this job now for the crew you tick (no request needed).</span>
          ${crewPicker(crew)}
          <div class="fj-row"><button type="button" class="fj-go" data-act="approve">Start job</button>
          <button type="button" class="fj-ghost" data-act="remove">Take off board</button></div></div>`;
      }
      if (!me) return `<div class="fj-act"><span class="fj-note warn">You need a character to take jobs.</span></div>`;
      const locked = credOf(me) < need;
      const crew = ui$.crew ?? [me.id];
      return `<div class="fj-act">
        ${locked ? `<span class="fj-note warn">${esc(me.name)} needs ${need} Street Cred for ${esc(tierInfo(job.tier).label)} (has ${credOf(me)}). Finish lower-tier jobs to get there.</span>` : `<span class="fj-note">Pick who's coming. The GM approves the job before it starts.</span>`}
        ${crewPicker(crew,{disabled:locked})}
        <div class="fj-row"><button type="button" class="fj-primary" data-act="request" ${locked ? "disabled" : ""}>Ask for this job</button></div></div>`;
    }

    if (job.status === "requested") {
      const who = game.actors.get(job.requestedAs)?.name ?? "Someone";
      if (isGM) {
        return `<div class="fj-act">
          <span class="fj-note"><b>${esc(who)}</b> asked for this job. Adjust the crew if needed.</span>
          ${crewPicker(ui$.crew ?? job.crew)}
          <div class="fj-row"><button type="button" class="fj-go" data-act="approve">Approve</button>
          <button type="button" data-act="decline">Decline</button></div></div>`;
      }
      const mine = job.requestedBy === game.user.id;
      return `<div class="fj-act"><span class="fj-note">Waiting for the GM. Crew: ${esc(crewNames(job.crew))}.</span>
        ${mine ? `<div class="fj-row"><button type="button" data-act="withdraw">Withdraw request</button></div>` : ""}</div>`;
    }

    if (job.status === "active") {
      if (!isGM) return `<div class="fj-act"><span class="fj-note">In progress. Crew: ${esc(crewNames(job.crew))}. The GM pays out when it's done.</span></div>`;
      return `<div class="fj-act">
        <span class="fj-note">Crew: <b>${esc(crewNames(job.crew))}</b>. Pay is per crew member. Change it for a partial or bonus result${job.kind === "Cyberpsycho" ? " (non-lethal pays double)" : ""}.</span>
        <div class="fj-row fj-pay">
          <label>PAY EACH <input type="number" min="0" step="50" data-field="pay" value="${job.pay}"></label>
          <label>CRED EACH <input type="number" min="0" step="1" data-field="cred" value="${job.cred}"></label>
          ${job.kind === "Cyberpsycho" ? `<button type="button" data-act="double" title="Non-lethal takedown">×2 non-lethal</button>` : ""}
          <button type="button" class="fj-go" data-act="complete">Pay out</button>
        </div>
        <div class="fj-row fj-pay">
          <label>CRED ON FAIL <input type="number" step="1" data-field="failcred" value="0"></label>
          <button type="button" data-act="fail">Mark failed</button>
          <button type="button" class="fj-ghost" data-act="reopen">Back to board</button>
        </div></div>`;
    }

    const result = job.status === "done"
      ? `Paid ${money(job.paid)} and +${job.credPaid ?? 0} Street Cred each to ${esc(crewNames(job.crew))}.`
      : `Failed. Crew: ${esc(crewNames(job.crew))}.`;
    return `<div class="fj-act"><span class="fj-note">${result}</span>
      ${isGM ? `<div class="fj-row"><button type="button" data-act="reopen">Put back on board</button><button type="button" class="fj-ghost" data-act="remove">Delete record</button></div>` : ""}</div>`;
  }

  function detail(job,me) {
    if (!job) {
      return `<div class="fj-empty"><b>NO JOB SELECTED</b>${ui$.tab === "offers" ? "Pick a job on the left to read the brief." : "Pick an entry on the left."}</div>`;
    }
    const fixer = fixerOf(job);
    const info = tierInfo(job.tier);
    return `
      ${fixer ? `<div class="fj-fixer"${accent(fixer)}>${monogram(fixer)}<div><div class="fj-h">${esc(fixer.handle)}</div>
        <div class="fj-who">${esc(fixer.name)} · ${esc(fixer.district)}</div>
        <q>${esc(fixer.voice)}</q><p>${esc(fixer.blurb)}</p></div></div>` : ""}
      <div class="fj-hero fj-tc${job.tier}">
        <span class="fj-wm" aria-hidden="true">${esc(info.label.replace("TIER ",""))}</span>
        <h2 class="fj-jt">${esc(job.title)}</h2>
        <div class="fj-meta">
          <span class="tier">TIER <b>${esc(info.label.replace("TIER ",""))}</b></span>
          <span>TYPE <b>${esc(job.kind)}</b></span>
          <span>WHERE <b>${esc(job.district)}</b>${spotLabel(job) ? ` · <b>${esc(spotLabel(job))}</b>` : ""}</span>
          ${game.user.isGM && spotOf(job) && city()?.worldScene?.() ? `<button type="button" class="fj-ghost" data-act="citymap" data-spot="${esc(spotOf(job))}" title="Open the city map on your screen and point at this spot">Show on city map</button>` : ""}
          <span class="pay">PAY <b>${money(job.pay)}</b> each</span>
          <span>CRED <b>+${job.cred}</b></span>
          ${info.need ? `<span>NEEDS <b>${info.need}</b> cred</span>` : ""}
          ${job.for ? `<span class="fj-tag me">FOR ${esc(String(job.for).toUpperCase())}</span>` : ""}
          ${job.src === "generated" ? `<span class="fj-tag">GIG</span>` : job.src === "custom" ? `<span class="fj-tag">STORY</span>` : ""}
          ${statusTag(job)}
        </div>
      </div>
      <p class="fj-brief">${esc(job.brief || "No brief.")}</p>
      ${job.objectives?.length ? `<h3 class="fj-sh">OBJECTIVES</h3><ol class="fj-obj">${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}
      ${game.user.isGM ? gmBlock(job) : ""}
      ${actionBlock(job,me)}`;
  }

  function fixersPanel(state) {
    const all = Object.values(state.jobs);
    return `<div class="fj-fixers">${(cat()?.FIXERS ?? []).map(f => {
      const done = all.filter(j => j.fixer === f.key && j.status === "done").length;
      const open = all.filter(j => j.fixer === f.key && j.status === "offered").length;
      const [lo,hi] = f.tiers;
      return `<article class="fj-fx"${accent(f)}>
        <header>${monogram(f)}<div><div class="fj-h">${esc(f.handle)}</div><div class="fj-who">${esc(f.name)}</div>
          <div class="fj-d">${esc(f.district)} · ${esc(tierInfo(lo).label)}${hi !== lo ? `–${esc(tierInfo(hi).label.replace("TIER ",""))}` : ""}</div></div></header>
        <q>${esc(f.voice)}</q>
        <p>${esc(f.blurb)}</p>
        ${f.spot && city()?.place?.(f.spot) ? `<div class="fj-d">FIND THEM AT ${esc(city().place(f.spot).label)}${game.user.isGM && city()?.worldScene?.() ? ` <button type="button" class="fj-ghost fj-mini" data-act="citymap" data-spot="${esc(f.spot)}">Map</button>` : ""}</div>` : ""}
        <footer><div class="fj-stats"><span>DONE <b>${done}</b></span><span>ON BOARD <b>${open}</b></span></div>
          <button type="button" data-act="fixerjobs" data-fixer="${esc(f.key)}" ${open ? "" : "disabled"}>${open ? "See their jobs" : "Nothing posted"}</button></footer>
      </article>`;
    }).join("")}</div>`;
  }

  function writeForm() {
    const d = ui$.draft ?? {};
    const fixers = (cat()?.FIXERS ?? []).map(f => `<option value="${esc(f.key)}" ${d.fixer === f.key ? "selected" : ""}>${esc(f.handle)} (${esc(f.name)})</option>`).join("");
    const kinds = [...new Set([...(Object.keys(cat()?.gen?.KINDS ?? {})),"Extraction","Investigation","Story"])];
    return `
      <h3 class="fj-sh">WRITE A JOB</h3>
      <p class="fj-note">Post your own job to the board: a story beat, a favour, anything. Players see everything except the twist.</p>
      <div class="fj-form">
        <label class="w2">TITLE <input data-draft="title" autocomplete="off" value="${esc(d.title ?? "")}" maxlength="60" placeholder="e.g. The Long Night"></label>
        <label>FIXER <select data-draft="fixer">${fixers}</select></label>
        <label>TIER <select data-draft="tier">${[1,2,3,4,5].map(t => `<option value="${t}" ${Number(d.tier ?? 1) === t ? "selected" : ""}>${tierInfo(t).label}</option>`).join("")}</select></label>
        <label>TYPE <input data-draft="kind" autocomplete="off" list="fj-kinds" value="${esc(d.kind ?? "")}" placeholder="Recovery"><datalist id="fj-kinds">${kinds.map(k => `<option value="${esc(k)}">`).join("")}</datalist></label>
        <label>WHERE <input data-draft="district" autocomplete="off" list="fj-districts" value="${esc(d.district ?? "")}" placeholder="New Niemir"><datalist id="fj-districts">${(cat()?.gen?.DISTRICTS ?? []).map(k => `<option value="${esc(k)}">`).join("")}</datalist></label>
        <label>PAY EACH <input type="number" min="0" step="50" data-draft="pay" value="${esc(d.pay ?? "")}" placeholder="tier default"></label>
        <label>CRED <input type="number" min="0" step="1" data-draft="cred" value="${esc(d.cred ?? "")}" placeholder="tier default"></label>
        <label class="w4">MAP (scene name) <input data-draft="map" autocomplete="off" value="${esc(d.map ?? "")}" placeholder="optional, e.g. Rundown Hotel"></label>
        <label class="w4">BRIEF <textarea data-draft="brief" rows="3" placeholder="What the fixer tells the crew.">${esc(d.brief ?? "")}</textarea></label>
        <label class="w4">OBJECTIVES (one per line) <textarea data-draft="objectives" rows="3">${esc(d.objectives ?? "")}</textarea></label>
        <label class="w4">TWIST (GM only) <textarea data-draft="twist" rows="2">${esc(d.twist ?? "")}</textarea></label>
      </div>
      <div class="fj-row" style="margin-top:12px"><button type="button" class="fj-go" data-act="postdraft">Post to board</button>
        <button type="button" class="fj-ghost" data-act="cleardraft">Clear</button></div>`;
  }

  function credPanel() {
    const tiers = Object.entries(cat()?.TIERS ?? {}).map(([t,i]) => `<tr class="fj-tc${t}"><td style="color:var(--fj-tc)">${esc(i.label)}</td><td>${i.need}+</td><td>${money(i.pay[0])} – ${money(i.pay[1])}</td><td>+${i.cred}</td></tr>`).join("");
    const ranks = (cat()?.RANKS ?? []).map(([min,name]) => `<tr><td>${esc(name)}</td><td>${min}+</td></tr>`).join("");
    const rules = `
      <h3 class="fj-sh">HOW IT WORKS</h3>
      <p class="fj-brief">Every finished job pays each crew member and earns them Street Cred. Cred opens higher tiers with bigger pay. You ask for a job as your own character, the GM approves it, and you play it out at the table.</p>
      <table class="fj-credtable"><thead><tr><th>Tier</th><th>Cred needed</th><th>Pay each</th><th>Cred earned</th></tr></thead><tbody>${tiers}</tbody></table>
      <h3 class="fj-sh">RANKS</h3><table class="fj-credtable"><tbody>${ranks}</tbody></table>`;
    const crew = `
      <h3 class="fj-sh">THE CREW</h3>
      <table class="fj-credtable"><thead><tr><th>Character</th><th>Cred</th><th>Rank</th><th>Progress</th>${game.user.isGM ? "<th></th>" : ""}</tr></thead><tbody>
      ${crewActors().map(a => {
        const c = credOf(a), r = nextRank(c);
        return `<tr><td>${esc(a.name)}</td><td>${game.user.isGM
          ? `<input type="number" min="0" data-credfor="${esc(a.id)}" value="${c}" aria-label="${esc(a.name)} Street Cred">`
          : c}</td><td>${esc(rankOf(c))}</td><td><span class="fj-meter"><i style="width:${r.pct}%"></i></span> ${r.next !== null ? `${r.next - c} to go` : "MAX"}</td>
          ${game.user.isGM ? `<td><button type="button" data-act="setcred" data-actor="${esc(a.id)}">Save</button></td>` : ""}</tr>`;
      }).join("")}</tbody></table>`;
    if (!game.user.isGM) return crew + rules;
    const state = read();
    return crew + `
      <h3 class="fj-sh">BOARD SETTINGS</h3>
      <div class="fj-row fj-pay"><label>OFFERS PER BOARD <input type="number" min="3" max="16" data-field="size" value="${state.size}"></label>
        <button type="button" data-act="setsize">Save</button></div>
      <p class="fj-note">Hand-written jobs used: ${state.used.length} of ${cat()?.JOBS?.length ?? 0}. Used jobs aren't posted again.
        <button type="button" class="fj-ghost" data-act="resetused">Make them all available again</button></p>` + rules;
  }

  function emptyText(tab) {
    const gm = game.user.isGM;
    return {
      offers:gm ? ["BOARD EMPTY","Press NEW OFFERS to post a set of jobs, or ROLL GIG for a single one."] : ["NO WORK POSTED","The fixers haven't posted anything. Check back after the GM posts new offers."],
      active:["NOTHING RUNNING","Requested and in-progress jobs show up here."],
      history:["NO RECORD YET","Finished and failed jobs are kept here."]
    }[tab] ?? ["",""];
  }

  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const state = read();
    const isGM = game.user.isGM;
    const me = isGM ? null : myActor();
    const offersAll = jobsWith(state,"offered");
    const offers = ui$.fixer ? offersAll.filter(j => j.fixer === ui$.fixer) : offersAll;
    const active = jobsWith(state,"requested","active");
    const history = Object.values(state.jobs).filter(j => !OPEN.includes(j.status)).sort((a,b) => (b.updated ?? 0) - (a.updated ?? 0));
    const requests = active.filter(j => j.status === "requested").length;
    const lists = {offers,active,history};
    const listTab = ui$.tab in lists;
    const list = lists[ui$.tab] ?? [];
    if (listTab && !list.some(j => j.id === ui$.selected)) {
      ui$.selected = list[0]?.id ?? null;
      ui$.crew = null;
    }
    const job = listTab ? state.jobs[ui$.selected] ?? null : null;
    const scroll = root.querySelector(".fj-list")?.scrollTop ?? 0;
    const tab = (key,label,count,alert=0) =>
      `<button type="button" class="fj-tab" data-tab="${key}" aria-pressed="${ui$.tab === key}">${label}${count != null ? `<span class="fj-count">${count}</span>` : ""}${alert ? `<span class="fj-alert">${alert} NEW</span>` : ""}</button>`;
    const filterFixer = ui$.fixer ? fixerOf({fixer:ui$.fixer}) : null;
    const [emptyHead,emptyBody] = emptyText(ui$.tab);

    let body;
    if (ui$.tab === "fixers") body = fixersPanel(state);
    else if (ui$.tab === "cred") body = `<div class="fj-detail" style="grid-column:1/-1">${credPanel()}</div>`;
    else if (ui$.tab === "write" && isGM) body = `<div class="fj-detail" style="grid-column:1/-1">${writeForm()}</div>`;
    else body = `
      <div class="fj-listwrap">
        ${ui$.tab === "offers" && filterFixer ? `<div class="fj-filter">SHOWING <button type="button" data-act="clearfilter" aria-pressed="true" title="Show every fixer">${esc(filterFixer.handle)} ✕</button></div>` : ""}
        <div class="fj-list">${list.length ? list.map(j => card(j,me)).join("") : `<div class="fj-empty"><b>${emptyHead}</b>${emptyBody}</div>`}</div>
      </div>
      <div class="fj-detail" aria-live="polite">${detail(job,me)}</div>`;

    root.innerHTML = `
      <header class="fj-head" data-drag>
        <div class="fj-brand"><span class="fj-eyebrow"><i></i>FIXER NET // ALABASTRA // ${offersAll.length} OPEN · ${active.length} LIVE</span><h1 class="fj-title">JOBS<b>.</b></h1></div>
        <div class="fj-crew">${crewChips(me)}</div>
        <button type="button" class="fj-close" data-act="close" aria-label="Close jobs" title="Close (Esc)">✕</button>
      </header>
      <nav class="fj-bar" aria-label="Job board sections">
        ${tab("offers","Offers",offersAll.length)}
        ${tab("active","Active",active.length,isGM ? requests : 0)}
        ${tab("history","History",history.length)}
        ${tab("fixers","Fixers",null)}
        ${tab("cred","Street Cred",null)}
        ${isGM ? `<div class="fj-tools">
          <button type="button" class="fj-primary" data-act="newoffers" title="Replace the open offers with a new set">New offers</button>
          <select data-field="rolltier" aria-label="Tier for a new gig">${[1,2,3,4,5].map(t => `<option value="${t}" ${ui$.rollTier === t ? "selected" : ""}>${tierInfo(t).label}</option>`).join("")}</select>
          <button type="button" data-act="rollone" title="Add one generated gig of the chosen tier">Roll gig</button>
          <span class="fj-sep" aria-hidden="true"></span>
          <button type="button" data-tab="write" aria-pressed="${ui$.tab === "write"}" class="fj-tab">Write job</button>
          <button type="button" class="fj-ghost" data-act="togglegm" aria-pressed="${hideGM()}" title="Hide twists, enemies and maps while sharing your screen">${hideGM() ? "Show GM notes" : "Hide GM notes"}</button>
        </div>` : ""}
      </nav>
      <div class="fj-body">${body}</div>`;
    const listEl = root.querySelector(".fj-list");
    if (listEl) listEl.scrollTop = scroll;
  }

  // The board sits above Foundry's dialogs (like the Market), so risky
  // buttons confirm in place: the first click arms the button for 4 s.
  function confirmTwice(button,question) {
    if (button.dataset.armed === "1") return true;
    button.dataset.armed = "1";
    const label = button.textContent;
    button.textContent = question;
    button.classList.add("is-armed");
    sfx("select");
    setTimeout(() => {
      if (!button.isConnected) return;
      button.dataset.armed = "";
      button.textContent = label;
      button.classList.remove("is-armed");
    },4000);
    return false;
  }

  function selectedCrew(root) {
    return [...root.querySelectorAll("[data-crew]:checked")].map(el => el.dataset.crew);
  }

  function readDraft(root) {
    const d = {...(ui$.draft ?? {})};
    for (const el of root.querySelectorAll("[data-draft]")) d[el.dataset.draft] = el.value;
    return d;
  }

  async function onClick(event) {
    const root = document.getElementById(ROOT_ID);
    const target = event.target.closest("button,[data-crew]");
    if (!root || !target || !root.contains(target)) return;

    if (target.matches("[data-crew]")) {
      ui$.crew = selectedCrew(root);
      sfx("select");
      return;
    }
    if (root.querySelector("[data-draft]")) ui$.draft = readDraft(root);
    if (target.dataset.tab) {
      ui$.tab = target.dataset.tab;
      ui$.selected = null;
      ui$.crew = null;
      sfx("subsystem_select");
      render();
      return;
    }
    if (target.dataset.job) {
      ui$.selected = target.dataset.job;
      ui$.crew = null;
      sfx("select");
      render();
      root.querySelector(".fj-detail")?.scrollTo?.(0,0);
      return;
    }

    const act = target.dataset.act;
    if (!act) return;
    const jobId = ui$.selected;
    const field = name => root.querySelector(`[data-field="${name}"]`)?.value;

    try {
      switch (act) {
        case "close": return close();
        case "sheet": return game.actors.get(target.dataset.actor)?.sheet?.render(true);
        case "viewmap": return game.scenes.get(target.dataset.scene)?.view();
        case "citymap":
          close();
          return city()?.showOnMap?.(target.dataset.spot);
        case "double": {
          const input = root.querySelector('[data-field="pay"]');
          if (input) input.value = String((Number(input.value) || 0) * 2);
          sfx("select");
          return;
        }
        case "fixerjobs":
          ui$.fixer = target.dataset.fixer;
          ui$.tab = "offers";
          ui$.selected = null;
          sfx("subsystem_select");
          break;
        case "clearfilter": ui$.fixer = null; ui$.selected = null; break;
        case "togglegm": setHideGM(!hideGM()); break;
        case "request": {
          const me = myActor();
          if (!me) throw new Error("You need a character to take jobs.");
          target.disabled = true;
          await run("request",{jobId,actorId:me.id,crew:selectedCrew(root)});
          ui.notifications.info("FIXER NET // Request sent. The GM will approve or decline it.");
          sfx("confirm");
          ui$.tab = "active";
          break;
        }
        case "withdraw": await run("withdraw",{jobId}); sfx("remove"); break;
        case "approve": await run("approve",{jobId,crew:selectedCrew(root)}); sfx("confirm"); ui$.tab = "active"; break;
        case "decline": await run("decline",{jobId}); sfx("remove"); break;
        case "complete": {
          const pay = Number(field("pay")), cred = Number(field("cred"));
          if (!confirmTwice(target,`Pay ${money(pay)} + ${cred} cred each?`)) return;
          await run("complete",{jobId,pay,cred});
          sfx("install");
          break;
        }
        case "fail":
          if (!confirmTwice(target,"Really fail it?")) return;
          await run("fail",{jobId,cred:Number(field("failcred"))});
          sfx("error");
          break;
        case "reopen": await run("reopen",{jobId}); ui$.tab = "offers"; break;
        case "remove":
          if (!confirmTwice(target,"Really remove?")) return;
          await run("remove",{jobId});
          sfx("remove");
          break;
        case "newoffers": {
          if (!confirmTwice(target,"Replace open offers?")) return;
          await run("newOffers");
          sfx("scan");
          ui$.tab = "offers";
          ui$.fixer = null;
          break;
        }
        case "rollone": {
          ui$.rollTier = Number(field("rolltier")) || 1;
          const result = await run("rollOne",{tier:ui$.rollTier});
          sfx("scan");
          ui$.tab = "offers";
          ui$.fixer = null;
          ui$.selected = result.id;
          break;
        }
        case "postdraft": {
          const result = await run("write",{draft:ui$.draft ?? {}});
          sfx("install");
          ui$.draft = null;
          ui$.tab = "offers";
          ui$.fixer = null;
          ui$.selected = result.id;
          break;
        }
        case "cleardraft": ui$.draft = null; break;
        case "setcred": await run("setCred",{actorId:target.dataset.actor,cred:Number(root.querySelector(`[data-credfor="${target.dataset.actor}"]`)?.value)}); sfx("confirm"); break;
        case "setsize": await run("setSize",{size:Number(field("size"))}); sfx("confirm"); break;
        case "resetused":
          if (!confirmTwice(target,"Reset used jobs?")) return;
          await run("resetUsed");
          break;
      }
    } catch (err) {
      sfx("error");
      ui.notifications.error("FIXER NET // " + String(err?.message ?? err));
      target.disabled = false;
    }
    render();
  }

  // Drag the window by its header.
  function onPointerDown(event) {
    const root = document.getElementById(ROOT_ID);
    const handle = event.target.closest("[data-drag]");
    if (!root || !handle || event.target.closest("button") || event.button !== 0) return;
    if (window.matchMedia("(max-width:900px)").matches) return;
    const rect = root.getBoundingClientRect();
    const dx = event.clientX - rect.left, dy = event.clientY - rect.top;
    Object.assign(root.style,{inset:"auto",left:rect.left+"px",top:rect.top+"px",width:rect.width+"px",height:rect.height+"px",margin:"0"});
    const move = e => {
      root.style.left = Math.max(0,Math.min(window.innerWidth - 120,e.clientX - dx)) + "px";
      root.style.top = Math.max(0,Math.min(window.innerHeight - 60,e.clientY - dy)) + "px";
    };
    const up = () => { window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); };
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
  }

  function open() {
    if (!cat()) {
      ui.notifications.error("FIXER NET // The job catalog isn't loaded.");
      return null;
    }
    ensureStyle();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = ROOT_ID;
      root.setAttribute("role","dialog");
      root.setAttribute("aria-label","Jobs");
      root.addEventListener("click",onClick);
      root.addEventListener("pointerdown",onPointerDown);
      document.body.appendChild(root);
    }
    if (game.user.isGM && jobsWith(read(),"requested").length) ui$.tab = "active";
    render();
    root.querySelector(".fj-close")?.focus?.();
    sfx("drawer_open");
    return root;
  }

  function close() {
    if (!document.getElementById(ROOT_ID)) return;
    document.getElementById(ROOT_ID).remove();
    sfx("drawer_close");
  }

  function toggle() {
    return document.getElementById(ROOT_ID) ? close() : open();
  }

  let renderTimer = null;
  function rerender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      // Don't wipe a half-written job form under the GM's cursor.
      const root = document.getElementById(ROOT_ID);
      if (root && ui$.tab === "write" && root.contains(document.activeElement)) return;
      render();
    },50);
  }

  // ------------------------------------------------------------- hotbar

  // Active GM only: make the ADK // JOBS macro and put it in every user's
  // hotbar slot 4 (GMs too) when that slot is empty. A filled slot is left alone.
  async function installHotbar() {
    if (!isActiveGM()) return;
    let macro = game.macros.find(m => m.name === MACRO_NAME);
    if (!macro) {
      macro = await Macro.create({
        name:MACRO_NAME,
        type:"script",
        img:MACRO_IMG,
        command:"game.adk.openJobs();",
        ownership:{default:CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER}
      });
    }
    for (const user of game.users) {
      const current = user.hotbar?.[HOTBAR_SLOT];
      if (current === macro.id) continue;
      if (current && game.macros.get(current)) continue;
      await user.update({[`hotbar.${HOTBAR_SLOT}`]:macro.id});
    }
  }

  // ------------------------------------------------------------------ api

  const api = {
    VERSION,
    open,close,toggle,render,rerender,
    read,
    run,
    generate,
    credOf,
    installHotbar,

    async init() {
      await api.destroy();
      registerSetting();
      ensureStyle();
      CONFIG.queries[CH] = queryHandler = onQuery;
      keyHandler = event => {
        if (event.key === "Escape" && document.getElementById(ROOT_ID)) {
          event.stopPropagation();
          close();
        }
      };
      document.addEventListener("keydown",keyHandler,true);
      hooks.push(["updateActor",Hooks.on("updateActor",(actor,change) => {
        if (foundry.utils.hasProperty(change,`flags.${FLAG}`) || foundry.utils.hasProperty(change,"system.currency")) rerender();
      })]);
      game.adk ??= {};
      game.adk.openJobs = open;
      game.adk.jobs = api;
      globalThis.FEHA_JOBS = api;
      if (!globalThis.FEHA_JOBS_NO_HOTBAR) {
        try { await installHotbar(); } catch (err) { console.warn("FEHA JOBS // hotbar install failed",err); }
      }
      console.log("FEHA JOBS",VERSION,"ready");
    },

    async destroy() {
      for (const [event,id] of hooks.splice(0)) {
        try { Hooks.off(event,id); } catch {}
      }
      if (CONFIG.queries?.[CH] === queryHandler) delete CONFIG.queries[CH];
      queryHandler = null;
      if (keyHandler) document.removeEventListener("keydown",keyHandler,true);
      keyHandler = null;
      clearTimeout(renderTimer);
      close();
      document.getElementById(STYLE_ID)?.remove();
      if (game.adk?.openJobs === open) delete game.adk.openJobs;
      if (game.adk?.jobs === api) delete game.adk.jobs;
      if (globalThis.FEHA_JOBS === api) delete globalThis.FEHA_JOBS;
    }
  };

  core.registerModule("jobs",api);
})();
