// FEHA // JOB BOARD 2
//
// Fixer work for the crew, set up like a phone's contact list. Fixers sit in
// rings (Street, District, City, Elite); the crew's shared Street Cred opens
// each ring, and the GM can open any fixer early. Every open fixer keeps a
// couple of jobs on offer at their own level and posts a new one when a job
// is finished, so the board fills itself.
//
// A player picks a job and their crew and asks for it; the GM confirms; the
// crew plays it out; the GM pays out. Every crew member gets the credits
// (through ADKWallet, so the Market and wallet stay in step) and the crew's
// Street Cred goes up.
//
// State lives in one world setting (SETTING). Only a GM writes it: player
// requests reach the active GM as a User#query (CH), like the rest of FEHA
// (the installed module has no socket). Jobs come from FEHA_JOB_CATALOG
// (written jobs, used once each until the GM resets them, plus generated
// gigs) and sit at a spot on the FEHA_CITY map.

(() => {
  const VERSION = "2.0.0";
  const core = globalThis.FEHA_CYBER_CORE;

  if (!core) {
    throw new Error("FEHA_JOBS requires FEHA_CYBER_CORE.");
  }

  const FLAG = "fleshEnshrouded";
  const SETTING = "fehaJobBoardV1";
  const STATE_V = 2;
  const CH = "feha.jobs";
  const ROOT_ID = "feha-jobs";
  const STYLE_ID = "feha-jobs-css";
  const MACRO_NAME = "ADK // JOBS";
  const MACRO_IMG = "icons/sundries/documents/document-sealed-signatures-red.webp";
  const HOTBAR_SLOT = 4;
  const PLAYABLE = ["ponyboy","sasha","zach","derke"];
  const HISTORY_MAX = 80;
  const OPEN = ["offered","requested","active"];
  const PERSONAL = "_personal";

  const hooks = [];
  let queryHandler = null;
  let keyHandler = null;
  // view: contacts | mine | done | gm.  fixer: selected contact.  job: open job.
  let ui$ = {view:"contacts",fixer:null,job:null,crew:null,rollTier:1,draft:null};

  // ------------------------------------------------------------- helpers

  const cat = () => globalThis.FEHA_JOB_CATALOG;
  const kit = () => globalThis.FEHA_GIG_KIT ?? null;
  const city = () => globalThis.FEHA_CITY ?? null;
  const esc = value => String(value ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const norm = value => String(value ?? "").normalize("NFKD")
    .replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const rid = () => foundry.utils.randomID();
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const roll = (min,max,step=50) => Math.round((min + Math.random() * (max - min)) / step) * step;
  const money = n => "€$ " + Math.round(Number(n) || 0).toLocaleString("en-US");
  const fill = (text,ctx) => String(text).replace(/\{(\w+)\}/g,(m,k) => ctx[k] ?? m);
  const tierInfo = tier => cat()?.TIERS?.[tier] ?? {label:"RISK " + tier,risk:String(tier),pay:[0,0],cred:0};
  const isActiveGM = () => Boolean(game.user?.isGM && (game.users.activeGM ?? game.user) === game.user);
  const fixers = () => cat()?.FIXERS ?? [];
  const rings = () => cat()?.RINGS ?? [];
  const fixerOf = key => fixers().find(f => f.key === (typeof key === "string" ? key : key?.fixer)) ?? null;
  const ringOf = fixer => rings().find(r => r.ring === fixer?.ring) ?? null;

  function rankOf(cred) {
    let label = "NOBODIES";
    for (const [min,name] of cat()?.RANKS ?? []) if (cred >= min) label = name;
    return label;
  }

  function crewActors() {
    return PLAYABLE
      .map(name => game.actors.find(a => a.type === "character" && norm(a.name) === name))
      .filter(Boolean);
  }

  function myActor() {
    const viaSync = globalThis.FEHA_MULTIPLAYER_SYNC?.localActor?.() ?? null;
    if (viaSync) return viaSync;
    const assigned = game.user?.character ?? null;
    if (assigned) return assigned;
    return crewActors().find(a => a.isOwner) ?? null;
  }

  const crewNames = ids => (ids ?? []).map(id => game.actors.get(id)?.name).filter(Boolean).join(", ") || "nobody";
  const spotLabel = job => city()?.place?.(job?.spot)?.label ?? null;

  async function marker(job,on) {
    try {
      if (on) await city()?.setJobMarker?.(job);
      else await city()?.clearJobMarker?.(job.id);
    } catch (err) { console.warn("FEHA JOBS // city marker failed",err); }
  }

  function sceneFor(name) {
    if (!name) return null;
    const lower = norm(name);
    return game.scenes.find(s => s.name === name) ?? game.scenes.find(s => norm(s.name).startsWith(lower)) ?? null;
  }

  // -------------------------------------------------------------- state

  function registerSetting() {
    if (game.settings.settings.has("world." + SETTING)) return;
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
    raw.cred = Math.max(0,Math.floor(Number(raw.cred) || 0));
    raw.unlocked ??= [];
    raw.perFixer ??= 2;
    raw.jobs ??= {};
    raw.used ??= [];
    raw.favors ??= [];
    raw.autoPrep ??= true;
    return raw;
  }

  async function write(state) {
    if (!game.user?.isGM) throw new Error("Only a GM can change the job board.");
    const done = Object.values(state.jobs)
      .filter(j => !OPEN.includes(j.status))
      .sort((a,b) => (b.updated ?? 0) - (a.updated ?? 0));
    for (const old of done.slice(HISTORY_MAX)) delete state.jobs[old.id];
    state.v = STATE_V;
    await game.settings.set("world",SETTING,state);
  }

  const jobsWith = (state,...statuses) =>
    Object.values(state.jobs)
      .filter(j => statuses.includes(j.status))
      .sort((a,b) => (a.tier - b.tier) || ((a.created ?? 0) - (b.created ?? 0)));

  // A fixer works with the crew once its ring's cred is reached, or when the
  // GM has opened them early.
  function isOpen(fixer,state) {
    if (!fixer) return false;
    if (state.unlocked.includes(fixer.key)) return true;
    return state.cred >= (ringOf(fixer)?.need ?? 0);
  }

  function nextRing(state) {
    return rings().find(r => state.cred < r.need) ?? null;
  }

  // -------------------------------------------------------- job creation

  // Put a job on the city map. If its spot is in another district (the only
  // place with its battle map), the job moves there, so WHERE matches the pin.
  function placeJob(job) {
    // Written gigs keep the spot they were written for.
    if (!(job.book && job.spot && city()?.place?.(job.spot))) job.spot = city()?.spotFor?.({district:job.district,map:job.map,fixer:job.fixer,key:job.key}) ?? null;
    const at = city()?.place?.(job.spot);
    if (at && city()?.DISTRICTS?.[job.district] && at.district !== job.district) job.district = at.district;
    return job;
  }

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

  // A generated gig from one fixer at one of their ring's levels.
  function generate(fixer,tier=null) {
    const C = cat();
    const G = C.gen;
    fixer ??= pick(C.FIXERS);
    const t = tier ?? pick(fixer.tiers ?? [1]);
    const kindName = pick(Object.keys(G.KINDS));
    const kind = G.KINDS[kindName];
    const inTier = Object.entries(G.FACTIONS).filter(([,f]) => t >= f.tiers[0] && t <= f.tiers[1]);
    const fitting = inTier.filter(([name]) => !kind.factions || kind.factions.includes(name));
    let [faction,fdef] = pick(fitting.length ? fitting : inTier.length ? inTier : Object.entries(G.FACTIONS));
    // Where: a real spot on the city map, in the fixer's district most of
    // the time, of a kind that suits the job. Its name goes in the brief and
    // its own battle map comes with it.
    const district = Math.random() < 0.6 ? fixer.district : pick(G.DISTRICTS);
    const spot = pickSpot(kindName,district,t);
    const map = spot?.map ?? pick(G.PLACES[pick(kind.places)]);
    const bare = (spot?.name ?? map).replace(/^the /i,"");
    const place = /(Street|Streets|Alley|Road|'s)$/.test(bare) || /'s/.test(bare) ? bare : "the " + bare;
    // Street work in a gang district fights that district's gang.
    const gang = faction === "Street" ? G.GANGS?.[spot?.district ?? district] : null;
    if (gang) fdef = {label:gang[0],tiers:fdef.tiers,roster:gang[1]};
    const whoPool = G.WHO.filter(w => !w.toLowerCase().includes(faction.toLowerCase()));
    const ctx = {item:pick(G.ITEMS),who:pick(whoPool.length ? whoPool : G.WHO),place,faction:fdef.label ?? faction};
    const cap = text => text.charAt(0).toUpperCase() + text.slice(1);

    // Enemies: rank-and-file from below the level (3-5 of them) and, from
    // moderate risk up, one leader at or just under it. Cyberpsycho gigs
    // are the psycho(s) instead.
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
    const job = {
      id:rid(),
      key:"gen-" + rid(),
      src:"generated",
      fixer:fixer.key,
      tier:t,
      kind:kindName,
      title:pick(kind.titles),
      district:spot?.district ?? district,
      map,
      spot:spot?.id ?? null,
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
    return job.spot ? job : placeJob(job);
  }

  // City spot categories that suit each kind of gig.
  const KIND_SPOTS = {
    "Recovery":["mega","living","land","shop"], "Delivery":["shop","bar","ripper","living"],
    "Theft":["shop","corp","land","bar"], "Sabotage":["land","corp","shop"],
    "Bounty":["bar","living","mega"], "Cyberpsycho":["shop","bar","land","mega"],
    "Protection":["bar","shop","living","ripper"], "Rescue":["mega","living","ripper","land"],
    "Data Heist":["corp","ripper","bar"], "Collection":["bar","shop"],
    "Smuggling":["land","shop","living"]
  };

  // Corporate HQs are only for City and Elite work.
  function pickSpot(kindName,district,tier=1) {
    const c = city();
    if (!c?.placesIn) return null;
    const cats = KIND_SPOTS[kindName] ?? [];
    const ok = p => p.cat !== "crew" && (tier >= 3 || p.cat !== "corp");
    const here = c.placesIn(district).filter(ok);
    const fits = here.filter(p => cats.includes(p.cat));
    const pool = fits.length ? fits : here.length ? here : c.PLACES.map(p => c.place(p[0])).filter(p => ok(p) && cats.includes(p.cat));
    return pool.length ? pick(pool) : null;
  }

  // Keep every open fixer at perFixer offers (written jobs first, gigs to
  // fill), and one personal job on offer while there are any left. Returns
  // how many jobs were posted.
  function topUp(state,{only=null}={}) {
    let posted = 0;
    const used = new Set(state.used);
    const live = new Set(jobsWith(state,...OPEN).map(j => j.key));
    const per = Math.max(1,Math.min(4,Number(state.perFixer) || 2));
    for (const fixer of fixers()) {
      if (only && fixer.key !== only) continue;
      if (!isOpen(fixer,state)) continue;
      const mine = jobsWith(state,"offered").filter(j => j.fixer === fixer.key && !j.for);
      const fresh = cat().JOBS.filter(j => j.fixer === fixer.key && !j.for && !used.has(j.key) && !live.has(j.key));
      for (let i = mine.length; i < per; i++) {
        // Written gigs first (mostly the ones with full run sheets); generated
        // gigs only once a fixer's written ones are all done.
        const rich = fresh.filter(j => j.book);
        const from = rich.length && (Math.random() < 0.75 || rich.length === fresh.length) ? rich : fresh;
        const def = from.length ? from[Math.floor(Math.random() * from.length)] : null;
        if (def) fresh.splice(fresh.indexOf(def),1);
        const job = def ? fromCatalog(def) : generate(fixer);
        state.jobs[job.id] = job;
        live.add(job.key);
        posted++;
      }
    }
    if (!only && !jobsWith(state,"offered").some(j => j.for)) {
      const names = new Set(crewActors().map(a => norm(a.name)));
      const personal = cat().JOBS.filter(j => j.for && names.has(norm(j.for)) && !used.has(j.key) && !live.has(j.key));
      if (personal.length) {
        const job = fromCatalog(pick(personal));
        state.jobs[job.id] = job;
        posted++;
      }
    }
    return posted;
  }

  // Version 1 kept Street Cred per character and offers in one big pile:
  // carry the highest character cred over to the crew and re-post offers.
  function migrate(state) {
    if (state.v >= STATE_V) return false;
    const best = Math.max(0,...crewActors().map(a => Math.floor(Number(a.flags?.[FLAG]?.streetCred) || 0)));
    state.cred = Math.max(state.cred,best);
    for (const job of jobsWith(state,"offered")) delete state.jobs[job.id];
    topUp(state);
    return true;
  }

  // ----------------------------------------------------------- chat cards

  async function chat(content,{gmOnly=false}={}) {
    const data = {content,speaker:{alias:"FIXER NET"}};
    if (gmOnly) data.whisper = game.users.filter(u => u.isGM).map(u => u.id);
    try { await ChatMessage.create(data); } catch (err) { console.warn("FEHA JOBS // chat failed",err); }
  }

  // tone: offer | request | go | done | fail
  function chatCard(job,{kicker,tone,body,fixer=null}) {
    fixer ??= job ? fixerOf(job) : null;
    return `<div class="feha-job-card fjc-${tone}"${fixer?.color ? ` style="--fjc-accent:${esc(fixer.color)}"` : ""}>
      <div class="fjc-k"><span>${esc(kicker)}</span>${fixer ? `<span>${esc(fixer.handle)}</span>` : ""}</div>
      ${job ? `<div class="fjc-t">${esc(job.title)}</div>
      <div class="fjc-m">${esc(tierInfo(job.tier).label)} · ${esc(job.kind)} · ${esc(spotLabel(job) ?? job.district)}</div>` : ""}
      <div class="fjc-b">${body}</div>
    </div>`;
  }

  // New fixers the crew's cred just opened up.
  async function announceUnlocks(before,after,state) {
    for (const fixer of fixers()) {
      const need = ringOf(fixer)?.need ?? 0;
      if (state.unlocked.includes(fixer.key)) continue;
      if (before < need && after >= need) {
        await chat(chatCard(null,{fixer,kicker:"NEW CONTACT",tone:"go",
          body:`<div class="fjc-t">${esc(fixer.handle)} wants to talk</div><p>${esc(fixer.name)} · ${esc(fixer.district)}</p><p class="fjc-q">“${esc(fixer.voice)}”</p>`}));
      }
    }
  }

  // ----------------------------------------------------- GM-side actions

  const actions = {
    async request({jobId,actorId,crew,userId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "offered") throw new Error("That job is no longer on offer.");
      const actor = game.actors.get(actorId);
      const user = game.users.get(userId);
      if (!actor || !user) throw new Error("Unknown character.");
      if (!user.isGM && !actor.testUserPermission(user,"OWNER")) throw new Error("You can only take a job as your own character.");
      if (!user.isGM && !job.for && !isOpen(fixerOf(job),state)) throw new Error("That fixer won't work with the crew yet.");
      const ids = [...new Set([actorId,...(crew ?? [])])].filter(id => game.actors.get(id));
      Object.assign(job,{status:"requested",crew:ids,requestedBy:userId,requestedAs:actorId,updated:Date.now()});
      await write(state);
      await chat(chatCard(job,{kicker:"WAITING FOR GM",tone:"request",
        body:`<p><b>${esc(actor.name)}</b> wants to take this job.</p><p>Crew: ${esc(crewNames(ids))}</p><p class="fjc-hint">Open Jobs → GM DESK to confirm or decline.</p>`}),{gmOnly:true});
      ui.notifications.info(`FIXER NET // ${actor.name} wants "${job.title}". Confirm it on the GM desk.`);
      return {ok:true};
    },

    async withdraw({jobId,userId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "requested") throw new Error("That request is no longer open.");
      const user = game.users.get(userId);
      if (!user?.isGM && job.requestedBy !== userId) throw new Error("Only the player who asked can cancel.");
      Object.assign(job,{status:"offered",crew:[],requestedBy:null,requestedAs:null,updated:Date.now()});
      await write(state);
      return {ok:true};
    },

    async approve({jobId,crew}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || !["offered","requested"].includes(job.status)) throw new Error("That job can't be started.");
      if (crew?.length) job.crew = crew.filter(id => game.actors.get(id));
      if (!job.crew?.length) throw new Error("Pick at least one crew member.");
      Object.assign(job,{status:"active",started:Date.now(),updated:Date.now()});
      if (job.src === "catalog" && !state.used.includes(job.key)) state.used.push(job.key);
      await write(state);
      await marker(job,true);
      if (state.autoPrep && !job.prep && kit()) {
        try {
          job.prep = await kit().prep(job);
          const fresh = read();
          if (fresh.jobs[job.id]) { fresh.jobs[job.id].prep = job.prep; await write(fresh); }
          ui.notifications.info(`FIXER NET // Gig files ready for "${job.title}": journal and maps in the GIGS folders.`);
        } catch (err) {
          console.warn("FEHA JOBS // prep failed",err);
          ui.notifications.warn("FIXER NET // Couldn't build the gig files: " + (err?.message ?? err));
        }
      }
      const fixer = fixerOf(job);
      await chat(chatCard(job,{kicker:"JOB ON",tone:"go",
        body:`<p>Crew: <b>${esc(crewNames(job.crew))}</b></p>${fixer ? `<p class="fjc-q">“${esc(fixer.voice)}”</p>` : ""}`}));
      return {ok:true};
    },

    async decline({jobId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "requested") throw new Error("That request is no longer open.");
      const who = game.actors.get(job.requestedAs)?.name ?? "the crew";
      Object.assign(job,{status:"offered",crew:[],requestedBy:null,requestedAs:null,updated:Date.now()});
      await write(state);
      await chat(chatCard(job,{kicker:"NOT THIS ONE",tone:"fail",body:`<p>The fixer passed on ${esc(who)} for this one.</p>`}));
      return {ok:true};
    },

    async complete({jobId,pay,cred,rewards,favor}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "active") throw new Error("Only a job in progress can be paid out.");
      const each = Math.max(0,Math.round(Number(pay ?? job.pay) || 0));
      const credUp = Math.max(0,Math.round(Number(cred ?? job.cred) || 0));
      const wallet = globalThis.ADKWallet;
      if (each && !wallet?.addCredits) throw new Error("The credits wallet isn't loaded; nothing was paid.");
      const paid = [];
      for (const id of job.crew) {
        const actor = game.actors.get(id);
        if (!actor) continue;
        if (each) await wallet.addCredits(actor,each);
        paid.push(actor.name);
      }
      const given = [];
      for (const r of rewards ?? []) {
        const actor = game.actors.get(r.actorId);
        if (!actor || !r.name) continue;
        try {
          if (await kit()?.giveItem?.(actor,r.name,Math.max(1,Number(r.qty) || 1))) given.push(`${r.qty > 1 ? r.qty + "× " : ""}${r.name} → ${actor.name}`);
        } catch (err) { console.warn("FEHA JOBS // reward item failed",r,err); }
      }
      if (favor) state.favors.push({id:rid(),text:String(favor),fixer:job.fixer,job:job.title,used:false,at:Date.now()});
      const before = state.cred;
      state.cred += credUp;
      Object.assign(job,{status:"done",paid:each,credPaid:credUp,given,favor:favor ?? null,finished:Date.now(),updated:Date.now()});
      topUp(state);
      await write(state);
      await marker(job,false);
      await chat(chatCard(job,{kicker:"PAID",tone:"done",
        body:`<div class="fjc-pay"><span>${money(each)} each</span><span>+${credUp} CREW CRED</span></div><p>${esc(paid.join(", ") || "Nobody")} got paid. Crew cred is now ${state.cred}.</p>${given.length ? `<p>Loot: ${esc(given.join(", "))}</p>` : ""}${favor ? `<p>Favour: ${esc(favor)}</p>` : ""}`}));
      await announceUnlocks(before,state.cred,state);
      return {ok:true};
    },

    async fail({jobId,cred}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job || job.status !== "active") throw new Error("Only a job in progress can fail.");
      const delta = Math.round(Number(cred) || 0);
      state.cred = Math.max(0,state.cred + delta);
      Object.assign(job,{status:"failed",credPaid:delta,finished:Date.now(),updated:Date.now()});
      topUp(state);
      await write(state);
      await marker(job,false);
      await chat(chatCard(job,{kicker:"JOB FAILED",tone:"fail",
        body:`<p>${delta ? `${delta > 0 ? "+" : ""}${delta} crew cred.` : "No pay. The fixer will remember."}</p>`}));
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
      topUp(state);
      await write(state);
      await marker({id:jobId},false);
      return {ok:true};
    },

    // Swap a fixer's open offers for new ones (or every open fixer's).
    async refresh({fixer}) {
      const state = read();
      for (const job of jobsWith(state,"offered")) if (!job.for && (!fixer || job.fixer === fixer)) delete state.jobs[job.id];
      topUp(state,{only:fixer ?? null});
      await write(state);
      return {ok:true};
    },

    async rollOne({fixer,tier}) {
      const state = read();
      const f = fixerOf(fixer) ?? pick(fixers());
      const job = generate(f,tier ? Number(tier) : null);
      state.jobs[job.id] = job;
      await write(state);
      return {ok:true,id:job.id};
    },

    // A GM-written job (story beats, one-offs), posted under a fixer.
    async write({draft}) {
      const d = draft ?? {};
      const title = String(d.title ?? "").trim();
      if (!title) throw new Error("Give the job a title.");
      const fixer = fixerOf(d.fixer) ?? fixers()[0];
      const tier = Math.max(1,Math.min(5,Number(d.tier) || fixer.tiers?.[0] || 1));
      const lines = value => String(value ?? "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const now = Date.now();
      const job = placeJob({
        id:rid(),
        key:"custom-" + rid(),
        src:"custom",
        fixer:fixer.key,
        tier,
        kind:String(d.kind ?? "").trim() || "Job",
        title,
        district:String(d.district ?? "").trim() || fixer.district,
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
      });
      const state = read();
      state.jobs[job.id] = job;
      await write(state);
      return {ok:true,id:job.id};
    },

    async setCred({cred}) {
      const state = read();
      const before = state.cred;
      state.cred = Math.max(0,Math.round(Number(cred) || 0));
      topUp(state);
      await write(state);
      await announceUnlocks(before,state.cred,state);
      return {ok:true};
    },

    async setUnlocked({fixer,open}) {
      const state = read();
      state.unlocked = state.unlocked.filter(k => k !== fixer);
      if (open) state.unlocked.push(fixer);
      else for (const job of jobsWith(state,"offered")) if (job.fixer === fixer && !job.for) delete state.jobs[job.id];
      topUp(state);
      await write(state);
      const f = fixerOf(fixer);
      if (open && f) await chat(chatCard(null,{fixer:f,kicker:"NEW CONTACT",tone:"go",
        body:`<div class="fjc-t">${esc(f.handle)} wants to talk</div><p>${esc(f.name)} · ${esc(f.district)}</p><p class="fjc-q">“${esc(f.voice)}”</p>`}));
      return {ok:true};
    },

    async setPerFixer({per}) {
      const state = read();
      state.perFixer = Math.max(1,Math.min(4,Number(per) || 2));
      topUp(state);
      await write(state);
      return {ok:true};
    },

    async resetUsed() {
      const state = read();
      state.used = [];
      await write(state);
      return {ok:true};
    },

    async prep({jobId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job) throw new Error("Unknown job.");
      if (!kit()) throw new Error("The gig kit isn't loaded.");
      if (job.prep) await kit().cleanup(job.prep);
      job.prep = await kit().prep(job);
      const fresh = read();
      if (fresh.jobs[jobId]) { fresh.jobs[jobId].prep = job.prep; await write(fresh); }
      return {ok:true};
    },

    async cleanup({jobId}) {
      const state = read();
      const job = state.jobs[jobId];
      if (!job?.prep) return {ok:true};
      await kit()?.cleanup?.(job.prep);
      job.prep = null;
      await write(state);
      return {ok:true};
    },

    async setAutoPrep({on}) {
      const state = read();
      state.autoPrep = Boolean(on);
      await write(state);
      return {ok:true};
    },

    async favor({id,used,remove}) {
      const state = read();
      if (remove) state.favors = state.favors.filter(f => f.id !== id);
      else for (const f of state.favors) if (f.id === id) f.used = Boolean(used);
      await write(state);
      return {ok:true};
    },

    async topUp() {
      const state = read();
      const migrated = migrate(state);
      const posted = topUp(state);
      if (migrated || posted) await write(state);
      return {ok:true,posted};
    }
  };

  // Players may only ask and cancel; everything else is GM-only.
  const PLAYER_ACTIONS = new Set(["request","withdraw"]);

  async function run(kind,payload={}) {
    if (!actions[kind]) throw new Error("Unknown job action: " + kind);
    payload.userId = game.user.id;
    if (game.user.isGM) return actions[kind](payload);
    if (!PLAYER_ACTIONS.has(kind)) throw new Error("Only the GM can do that.");
    const gm = game.users.activeGM;
    if (!gm) throw new Error("No GM is online to confirm the job.");
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
  --fj-yellow:#f3e600;--fj-green:#37e07c;--fj-text:#f1e6e3;--fj-muted:#c39c98;--fj-dim:#8f706c;
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
#${ROOT_ID} .fj-mini{min-height:24px;padding:3px 8px;font-size:12px}
#${ROOT_ID} input,#${ROOT_ID} select,#${ROOT_ID} textarea{background:#0a0405;color:var(--fj-text);border:1px solid var(--fj-line);font-family:var(--fj-mono);font-size:13px;
  height:32px;padding:0 8px;width:auto;flex:0 0 auto;margin:0}
#${ROOT_ID} textarea{height:auto;min-height:72px;padding:8px;width:100%;resize:vertical;line-height:1.4}

/* header */
#${ROOT_ID} .fj-head{display:flex;align-items:center;gap:22px;padding:14px 22px 12px;border-bottom:1px solid var(--fj-red);
  box-shadow:0 1px 0 rgba(255,94,87,.25),0 6px 18px -8px rgba(255,94,87,.55);flex-wrap:wrap;cursor:move;user-select:none;
  background:linear-gradient(180deg,rgba(255,94,87,.07),transparent)}
#${ROOT_ID} .fj-brand{display:flex;flex-direction:column;min-width:0}
#${ROOT_ID} .fj-eyebrow{font-family:var(--fj-mono);font-size:11px;letter-spacing:.24em;color:var(--fj-red);display:flex;gap:10px;align-items:center}
#${ROOT_ID} .fj-eyebrow i{width:7px;height:7px;background:var(--fj-cyan);box-shadow:0 0 8px var(--fj-cyan);display:inline-block;animation:fj-blink 2.4s steps(1) infinite}
@keyframes fj-blink{50%{opacity:.25}}
#${ROOT_ID} .fj-title{font-size:32px;font-weight:700;letter-spacing:.14em;line-height:1;color:var(--fj-text);margin:3px 0 0;border:0;text-shadow:0 0 18px rgba(255,94,87,.35)}
#${ROOT_ID} .fj-title b{color:var(--fj-red);font-weight:700}
#${ROOT_ID} .fj-cred{margin-left:auto;display:grid;grid-template-columns:auto 1fr;gap:2px 14px;align-items:center;min-width:300px;max-width:420px;padding:6px 12px;border:1px solid var(--fj-line-soft);background:var(--fj-panel)}
#${ROOT_ID} .fj-cred .n{grid-row:1/4;font-family:var(--fj-display);font-size:40px;font-weight:700;color:var(--fj-yellow);line-height:1;text-shadow:0 0 14px rgba(243,230,0,.35)}
#${ROOT_ID} .fj-cred .l{font-family:var(--fj-mono);font-size:11px;letter-spacing:.18em;color:var(--fj-muted)}
#${ROOT_ID} .fj-cred .r{font-size:15px;font-weight:700;letter-spacing:.1em}
#${ROOT_ID} .fj-cred .nx{font-family:var(--fj-mono);font-size:11px;color:var(--fj-muted)}
#${ROOT_ID} .fj-meter{height:4px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}
#${ROOT_ID} .fj-meter i{position:absolute;inset:0 auto 0 0;background:var(--fj-yellow);box-shadow:0 0 6px rgba(243,230,0,.6)}
#${ROOT_ID} .fj-close{min-width:36px;padding:6px 10px}

/* nav */
#${ROOT_ID} .fj-bar{display:flex;align-items:center;gap:4px;padding:10px 22px;border-bottom:1px solid var(--fj-line-soft);flex-wrap:wrap}
#${ROOT_ID} .fj-tab{border-color:transparent;color:var(--fj-muted)}
#${ROOT_ID} .fj-tab:hover{color:var(--fj-text)}
#${ROOT_ID} .fj-tab[aria-pressed="true"]{color:var(--fj-cyan);border-color:var(--fj-cyan);background:var(--fj-cyan-faint)}
#${ROOT_ID} .fj-count{font-family:var(--fj-mono);margin-left:6px;color:var(--fj-yellow)}
#${ROOT_ID} .fj-alert{display:inline-block;margin-left:6px;padding:2px 5px;background:var(--fj-yellow);color:#141200;font-family:var(--fj-mono);font-size:11px;letter-spacing:.06em}
#${ROOT_ID} .fj-how{margin-left:auto;font-family:var(--fj-mono);font-size:12px;color:var(--fj-muted);letter-spacing:.04em}
#${ROOT_ID} .fj-how b{color:var(--fj-text);font-weight:400}

/* body */
#${ROOT_ID} .fj-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(290px,360px) 1fr}
#${ROOT_ID} .fj-side{overflow:auto;overscroll-behavior:contain;padding:12px 12px 18px 22px;border-right:1px solid var(--fj-line-soft);display:flex;flex-direction:column;gap:6px}
#${ROOT_ID} .fj-main{overflow:auto;overscroll-behavior:contain;padding:18px 28px 26px;position:relative}
#${ROOT_ID} .fj-full{grid-column:1/-1}
#${ROOT_ID} .fj-ring{display:flex;justify-content:space-between;align-items:baseline;margin:12px 0 4px;font-family:var(--fj-mono);font-size:11px;letter-spacing:.2em;color:var(--fj-red)}
#${ROOT_ID} .fj-ring:first-child{margin-top:0}
#${ROOT_ID} .fj-ring span{color:var(--fj-dim);letter-spacing:.1em}
#${ROOT_ID} .fj-ring.is-open span{color:var(--fj-green)}
#${ROOT_ID} .fj-contact{display:grid;grid-template-columns:42px 1fr auto;gap:2px 12px;align-items:center;text-align:left;width:100%;padding:8px 10px;
  background:var(--fj-panel);border:1px solid var(--fj-line-soft);text-transform:none;letter-spacing:0;font-weight:500;min-height:0;line-height:1.25}
#${ROOT_ID} .fj-contact:hover{background:var(--fj-panel-2);border-color:var(--fj-line)}
#${ROOT_ID} .fj-contact[aria-current="true"]{border-color:var(--fj-cyan);background:var(--fj-panel-3);box-shadow:inset 3px 0 0 var(--fj-accent)}
#${ROOT_ID} .fj-contact .who{font-size:17px;font-weight:700;letter-spacing:.04em}
#${ROOT_ID} .fj-contact .sub{grid-column:2;font-family:var(--fj-mono);font-size:11px;letter-spacing:.08em;color:var(--fj-muted);text-transform:uppercase}
#${ROOT_ID} .fj-contact .badge{grid-row:1/3;grid-column:3;font-family:var(--fj-mono);font-size:12px;padding:2px 7px;border:1px solid var(--fj-line);color:var(--fj-yellow)}
#${ROOT_ID} .fj-contact .badge.zero{color:var(--fj-dim)}
#${ROOT_ID} .fj-contact.is-locked{opacity:.55}
#${ROOT_ID} .fj-contact.is-locked .fj-mono{background:#2a1a1e;color:var(--fj-dim)}
#${ROOT_ID} .fj-mono{grid-row:1/3;width:42px;height:42px;display:grid;place-items:center;font-family:var(--fj-mono);font-size:15px;
  color:#0b0507;background:var(--fj-accent);clip-path:polygon(0 0,100% 0,100% 72%,72% 100%,0 100%)}
#${ROOT_ID} .fj-empty{color:var(--fj-muted);padding:24px 4px;font-size:16px;max-width:52ch}
#${ROOT_ID} .fj-empty b{display:block;font-family:var(--fj-mono);font-size:11px;letter-spacing:.2em;color:var(--fj-red);margin-bottom:6px;font-weight:400}

/* fixer page */
#${ROOT_ID} .fj-fixer{display:grid;grid-template-columns:64px 1fr;gap:16px;align-items:start;padding:14px 16px;border:1px solid var(--fj-line-soft);
  background:linear-gradient(90deg,color-mix(in srgb,var(--fj-accent) 10%,transparent),transparent 60%),var(--fj-panel);margin-bottom:16px;border-left:3px solid var(--fj-accent)}
#${ROOT_ID} .fj-fixer .fj-mono{grid-row:auto;width:64px;height:64px;font-size:22px}
#${ROOT_ID} .fj-fixer .h{font-family:var(--fj-mono);font-size:12px;letter-spacing:.2em;color:var(--fj-accent)}
#${ROOT_ID} .fj-fixer .who{font-size:22px;font-weight:700;letter-spacing:.04em;line-height:1.1}
#${ROOT_ID} .fj-fixer q{display:block;color:var(--fj-text);font-style:italic;margin-top:6px;opacity:.9}
#${ROOT_ID} .fj-fixer p{margin:6px 0 0;color:var(--fj-muted);font-size:14px;max-width:78ch}
#${ROOT_ID} .fj-fixer .meta{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-family:var(--fj-mono);font-size:12px;color:var(--fj-muted);align-items:center}
#${ROOT_ID} .fj-fixer .meta b{color:var(--fj-text);font-weight:400}

/* job cards */
#${ROOT_ID} .fj-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
#${ROOT_ID} .fj-card{position:relative;display:flex;flex-direction:column;gap:6px;text-align:left;width:100%;padding:12px 14px 12px 16px;
  background:var(--fj-panel);border:1px solid var(--fj-line-soft);text-transform:none;letter-spacing:0;font-weight:500;min-height:0;line-height:1.3}
#${ROOT_ID} .fj-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--fj-tc)}
#${ROOT_ID} .fj-card:hover{background:var(--fj-panel-2);border-color:var(--fj-line)}
#${ROOT_ID} .fj-card .k{font-family:var(--fj-mono);font-size:11px;letter-spacing:.14em;color:var(--fj-muted);text-transform:uppercase}
#${ROOT_ID} .fj-card .k b{color:var(--fj-accent);font-weight:400}
#${ROOT_ID} .fj-card .ttl{font-size:20px;font-weight:700;letter-spacing:.03em;line-height:1.1}
#${ROOT_ID} .fj-card .b{color:var(--fj-muted);font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#${ROOT_ID} .fj-card .f{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:2px}
#${ROOT_ID} .fj-card .pay{margin-left:auto;font-family:var(--fj-mono);font-size:14px;color:var(--fj-yellow)}
#${ROOT_ID} .fj-tag{font-family:var(--fj-mono);font-size:11px;letter-spacing:.1em;padding:1px 6px;border:1px solid var(--fj-line);color:var(--fj-muted);text-transform:uppercase;white-space:nowrap}
#${ROOT_ID} .fj-tag.t{color:var(--fj-tc);border-color:var(--fj-tc)}
#${ROOT_ID} .fj-tag.me{color:var(--fj-cyan);border-color:var(--fj-cyan)}
#${ROOT_ID} .fj-tag.st-requested{color:#141200;background:var(--fj-yellow);border-color:var(--fj-yellow)}
#${ROOT_ID} .fj-tag.st-active{color:#031417;background:var(--fj-cyan);border-color:var(--fj-cyan)}
#${ROOT_ID} .fj-tag.st-done{color:var(--fj-green);border-color:var(--fj-green)}
#${ROOT_ID} .fj-tag.st-failed{color:var(--fj-red);border-color:var(--fj-red)}

/* job page */
#${ROOT_ID} .fj-back{margin-bottom:12px}
#${ROOT_ID} .fj-job{border-top:3px solid var(--fj-tc)}
#${ROOT_ID} .fj-job h2{font-size:36px;font-weight:700;letter-spacing:.05em;line-height:1.02;margin:14px 0 6px;border:0;color:var(--fj-text);text-transform:uppercase}
#${ROOT_ID} .fj-job .by{font-family:var(--fj-mono);font-size:12px;letter-spacing:.14em;color:var(--fj-muted);text-transform:uppercase}
#${ROOT_ID} .fj-job .by b{color:var(--fj-accent);font-weight:400}
#${ROOT_ID} .fj-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0 16px}
#${ROOT_ID} .fj-fact{padding:8px 10px;border:1px solid var(--fj-line-soft);background:var(--fj-panel)}
#${ROOT_ID} .fj-fact .l{font-family:var(--fj-mono);font-size:10px;letter-spacing:.2em;color:var(--fj-dim)}
#${ROOT_ID} .fj-fact .v{font-size:17px;font-weight:700;letter-spacing:.03em;line-height:1.15;margin-top:2px}
#${ROOT_ID} .fj-fact.risk .v{color:var(--fj-tc)}
#${ROOT_ID} .fj-fact.pay .v{color:var(--fj-yellow);font-family:var(--fj-mono);font-weight:400}
#${ROOT_ID} .fj-fact.cred .v{color:var(--fj-cyan);font-family:var(--fj-mono);font-weight:400}
#${ROOT_ID} .fj-fact .s{font-family:var(--fj-mono);font-size:11px;color:var(--fj-muted)}
#${ROOT_ID} .fj-status{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;margin:0 0 16px;border:1px solid var(--fj-line);background:var(--fj-panel-2)}
#${ROOT_ID} .fj-status .dot{width:10px;height:10px;margin-top:5px;flex:0 0 auto;background:var(--fj-muted)}
#${ROOT_ID} .fj-status.offered .dot{background:var(--fj-green)} #${ROOT_ID} .fj-status.requested .dot{background:var(--fj-yellow)}
#${ROOT_ID} .fj-status.active .dot{background:var(--fj-cyan)} #${ROOT_ID} .fj-status.failed .dot{background:var(--fj-red)}
#${ROOT_ID} .fj-status b{display:block;font-size:16px;letter-spacing:.06em;text-transform:uppercase}
#${ROOT_ID} .fj-status span{color:var(--fj-muted);font-size:14px}
#${ROOT_ID} .fj-brief{font-size:17px;max-width:70ch;margin:0 0 6px}
#${ROOT_ID} h3.fj-sh{font-family:var(--fj-mono);font-size:12px;letter-spacing:.22em;color:var(--fj-red);margin:18px 0 8px;border:0;font-weight:400;text-transform:uppercase;display:flex;align-items:center;gap:10px}
#${ROOT_ID} h3.fj-sh::after{content:"";flex:1;height:1px;background:var(--fj-line-soft)}
#${ROOT_ID} ol.fj-obj{margin:0;padding:0;list-style:none;max-width:70ch;counter-reset:obj}
#${ROOT_ID} ol.fj-obj li{counter-increment:obj;display:grid;grid-template-columns:28px 1fr;gap:8px;padding:5px 0;border-bottom:1px dashed var(--fj-line-soft)}
#${ROOT_ID} ol.fj-obj li::before{content:counter(obj,decimal-leading-zero);font-family:var(--fj-mono);color:var(--fj-cyan);font-size:13px;padding-top:1px}
#${ROOT_ID} .fj-gm{margin-top:20px;padding:12px 14px;border:1px dashed rgba(243,230,0,.45);background:rgba(243,230,0,.035)}
#${ROOT_ID} .fj-gm h3.fj-sh{color:var(--fj-yellow);margin-top:4px}
#${ROOT_ID} .fj-gm h3.fj-sh::after{background:rgba(243,230,0,.2)}
#${ROOT_ID} .fj-gm p{margin:4px 0 10px;max-width:70ch}
#${ROOT_ID} .fj-enemies{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
#${ROOT_ID} .fj-enemies button{text-transform:none;letter-spacing:.02em;font-weight:600;min-height:28px;padding:4px 8px}
#${ROOT_ID} .fj-enemies span.fj-tag{font-size:12px;padding:4px 8px;text-transform:none;letter-spacing:.02em}
#${ROOT_ID} .fj-act{margin-top:22px;padding:14px 16px;border:1px solid var(--fj-line);background:var(--fj-panel);display:flex;flex-direction:column;gap:10px}
#${ROOT_ID} .fj-act .step{font-family:var(--fj-mono);font-size:11px;letter-spacing:.18em;color:var(--fj-dim)}
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

/* run sheet, rewards */
#${ROOT_ID} .fj-hook{font-style:italic;color:var(--fj-text);opacity:.9;margin:2px 0 10px}
#${ROOT_ID} .fj-beat{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(243,230,0,.2)}
#${ROOT_ID} .fj-beat:last-of-type{border-bottom:0}
#${ROOT_ID} .fj-beat .bn{font-family:var(--fj-mono);font-size:20px;color:var(--fj-yellow);line-height:1}
#${ROOT_ID} .fj-beat .bt{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
#${ROOT_ID} .fj-beat .bt b{font-size:17px;letter-spacing:.04em;text-transform:uppercase}
#${ROOT_ID} .fj-beat .bt span{font-family:var(--fj-mono);font-size:12px;color:var(--fj-muted)}
#${ROOT_ID} .fj-beat p{margin:6px 0}
#${ROOT_ID} .fj-checks{margin:4px 0 6px;padding-left:18px;color:var(--fj-muted);font-size:14px}
#${ROOT_ID} .fj-checks li{margin:2px 0}
#${ROOT_ID} .fj-reward{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#${ROOT_ID} .fj-reward .money{font-family:var(--fj-mono);font-size:15px;color:var(--fj-yellow);margin-right:6px}
#${ROOT_ID} .fj-reward .fj-tag{white-space:normal;line-height:1.35}
#${ROOT_ID} .fj-tag.loot{color:var(--fj-text);border-color:var(--fj-t4);font-size:12px;text-transform:none;letter-spacing:.02em}
#${ROOT_ID} .fj-pay select{min-width:120px}

/* GM desk */
#${ROOT_ID} .fj-desk{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px;align-content:start}
#${ROOT_ID} .fj-box{border:1px solid var(--fj-line-soft);background:var(--fj-panel);padding:12px 14px}
#${ROOT_ID} .fj-box h3.fj-sh{margin-top:0}
#${ROOT_ID} .fj-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;border-bottom:1px dashed var(--fj-line-soft)}
#${ROOT_ID} .fj-line:last-child{border-bottom:0}
#${ROOT_ID} .fj-line .grow{flex:1;min-width:160px}
#${ROOT_ID} .fj-line .grow b{display:block;font-size:16px;letter-spacing:.03em}
#${ROOT_ID} .fj-line .grow span{font-family:var(--fj-mono);font-size:11px;color:var(--fj-muted);letter-spacing:.06em}
#${ROOT_ID} .fj-switch[aria-pressed="true"]{border-color:var(--fj-green);color:var(--fj-green)}
#${ROOT_ID} .fj-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
#${ROOT_ID} .fj-form label{flex-direction:column;align-items:stretch;gap:4px}
#${ROOT_ID} .fj-form label input,#${ROOT_ID} .fj-form label select{width:100%}
#${ROOT_ID} .fj-form .w2{grid-column:span 2} #${ROOT_ID} .fj-form .w4{grid-column:1/-1}

@media (max-width:900px){
  #${ROOT_ID}{inset:0;clip-path:none}
  #${ROOT_ID} .fj-body{grid-template-columns:1fr;grid-template-rows:minmax(170px,38%) 1fr}
  #${ROOT_ID} .fj-side{border-right:0;border-bottom:1px solid var(--fj-line-soft);padding:10px 16px}
  #${ROOT_ID} .fj-main{padding:14px 16px}
  #${ROOT_ID} .fj-head,#${ROOT_ID} .fj-bar{padding-left:16px;padding-right:16px}
  #${ROOT_ID} .fj-job h2{font-size:27px}
  #${ROOT_ID} .fj-facts{grid-template-columns:1fr 1fr}
  #${ROOT_ID} .fj-form{grid-template-columns:1fr 1fr}
  #${ROOT_ID} .fj-how{display:none}
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
.chat-message .feha-job-card .fjc-pay{display:flex;gap:12px;margin-top:6px;font-family:"Share Tech Mono",monospace;font-size:15px;flex-wrap:wrap}
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

  // The board shares the game sound engine; its clicks sit well under the
  // Market/Cyberdeck levels; opening and closing the board is barely audible
  // (the user found the door sound painfully loud on open).
  const SFX_GAIN = {select:.25,subsystem_select:.25,confirm:.25,error:.25,drawer_open:.1,drawer_close:.1,install:.15,remove:.15,scan:.15};
  const sfx = kind => { try { globalThis.FEHA_SOUNDS?.play?.(kind,{cooldown:0,gain:SFX_GAIN[kind] ?? .2}); } catch {} };

  const HIDE_KEY = "feha-jobs-hide-gm";
  const hideGM = () => { try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; } };
  const setHideGM = on => { try { localStorage.setItem(HIDE_KEY,on ? "1" : "0"); } catch {} };

  const initials = f => String(f?.handle ?? "??").replace(/[^A-Z0-9 ]/gi,"").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0,2).toUpperCase() || "??";
  const accent = f => f?.color ? ` style="--fj-accent:${esc(f.color)}"` : "";
  const monogram = (f,locked=false) => `<span class="fj-mono" aria-hidden="true">${locked ? "?" : esc(initials(f))}</span>`;

  const STATUS = {
    offered:  ["AVAILABLE","Pick your crew and take it. The GM confirms before it starts."],
    requested:["WAITING FOR THE GM","The GM has to confirm this job before it starts."],
    active:   ["IN PROGRESS","Play it out. The GM pays out when it's done."],
    done:     ["PAID",""],
    failed:   ["FAILED",""]
  };

  function statusTag(job) {
    if (job.status === "offered") return "";
    return `<span class="fj-tag st-${job.status}">${esc(STATUS[job.status]?.[0] ?? job.status)}</span>`;
  }

  function credBlock(state) {
    const next = nextRing(state);
    const prev = [...rings()].reverse().find(r => state.cred >= r.need) ?? rings()[0];
    const pct = next ? Math.round(100 * (state.cred - (prev?.need ?? 0)) / Math.max(1,next.need - (prev?.need ?? 0))) : 100;
    return `<div class="fj-cred" title="Crew Street Cred: every finished job raises it, and more cred opens bigger fixers.">
      <span class="n">${state.cred}</span>
      <span class="l">CREW STREET CRED · <b class="r">${esc(rankOf(state.cred))}</b></span>
      <span class="fj-meter" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <span class="nx">${next ? `${next.need - state.cred} more to open ${esc(next.label)} fixers` : "Every fixer in the city knows you"}</span>
    </div>`;
  }

  function crewPicker(selected,{disabled=false}={}) {
    return `<div class="fj-crewpick" role="group" aria-label="Crew">${crewActors().map(a => `
      <label><input type="checkbox" data-crew="${esc(a.id)}" ${selected.includes(a.id) ? "checked" : ""} ${disabled ? "disabled" : ""}> ${esc(a.name)}</label>`).join("")}</div>`;
  }

  // ---- contacts list

  function contactList(state,me) {
    const isGM = game.user.isGM;
    const offered = jobsWith(state,"offered");
    const personal = offered.filter(j => j.for);
    const parts = [];
    if (personal.length) {
      parts.push(`<div class="fj-ring is-open">PERSONAL <span>FOR THE CREW</span></div>`);
      parts.push(`<button type="button" class="fj-contact" data-fixer="${PERSONAL}" aria-current="${ui$.fixer === PERSONAL}" style="--fj-accent:var(--fj-cyan)">
        <span class="fj-mono" aria-hidden="true">★</span><span class="who">Personal</span>
        <span class="badge">${personal.length}</span><span class="sub">Jobs about the crew themselves</span></button>`);
    }
    for (const ring of rings()) {
      const list = fixers().filter(f => f.ring === ring.ring);
      if (!list.length) continue;
      const open = state.cred >= ring.need;
      parts.push(`<div class="fj-ring${open ? " is-open" : ""}">${esc(ring.label)} <span>${open ? "OPEN" : `${ring.need} CRED`}</span></div>`);
      for (const f of list) {
        const unlocked = isOpen(f,state);
        const count = offered.filter(j => j.fixer === f.key && !j.for).length;
        const hidden = !unlocked && !isGM;
        parts.push(`<button type="button" class="fj-contact${unlocked ? "" : " is-locked"}" data-fixer="${esc(f.key)}" aria-current="${ui$.fixer === f.key}"${accent(f)}>
          ${monogram(f,hidden)}<span class="who">${hidden ? "???" : esc(f.handle)}</span>
          <span class="badge${count ? "" : " zero"}">${unlocked ? count : "LOCKED"}</span>
          <span class="sub">${hidden ? `Opens at ${ring.need} crew cred` : `${esc(f.district)}${unlocked ? "" : " · locked"}`}</span></button>`);
      }
    }
    return parts.join("");
  }

  function jobCard(job) {
    const f = fixerOf(job);
    return `<button type="button" class="fj-card fj-tc${job.tier}" data-job="${esc(job.id)}"${accent(f)}>
      <span class="k"><b>${esc(f?.handle ?? job.fixer)}</b> // ${esc(job.kind)} // ${esc(spotLabel(job) ?? job.district)}</span>
      <span class="ttl">${esc(job.title)}</span>
      <span class="b">${esc(job.brief)}</span>
      <span class="f"><span class="fj-tag t">${esc(tierInfo(job.tier).label)}</span>
        ${job.for ? `<span class="fj-tag me">FOR ${esc(String(job.for).toUpperCase())}</span>` : ""}
        ${job.src === "custom" ? `<span class="fj-tag">STORY</span>` : ""}
        ${statusTag(job)}<span class="pay">${money(job.pay)}</span></span>
    </button>`;
  }

  function fixerPage(state) {
    const isGM = game.user.isGM;
    const offered = jobsWith(state,"offered");
    if (ui$.fixer === PERSONAL) {
      const list = offered.filter(j => j.for);
      return `<div class="fj-fixer" style="--fj-accent:var(--fj-cyan)"><span class="fj-mono" aria-hidden="true">★</span><div>
        <div class="h">PERSONAL</div><div class="who">Jobs about the crew</div>
        <p>Work tied to Ponyboy, Sasha, Zach and Derke's own lives. These are always open, whoever the crew can reach.</p></div></div>
        <div class="fj-cards">${list.map(jobCard).join("") || `<div class="fj-empty">Nothing personal right now.</div>`}</div>`;
    }
    const f = fixerOf(ui$.fixer);
    if (!f) return `<div class="fj-empty"><b>FIXER NET</b>Pick a contact on the left to see their work.</div>`;
    const ring = ringOf(f);
    const unlocked = isOpen(f,state);
    if (!unlocked && !isGM) {
      return `<div class="fj-fixer" style="--fj-accent:#3a2a2e">${monogram(f,true)}<div><div class="h">${esc(ring?.label ?? "")} FIXER</div>
        <div class="who">???</div><p>This fixer won't talk to the crew yet. Reach <b>${ring?.need ?? 0} crew Street Cred</b> and they'll get in touch.</p></div></div>`;
    }
    const list = offered.filter(j => j.fixer === f.key && !j.for);
    const where = f.spot ? city()?.place?.(f.spot)?.label : null;
    return `<div class="fj-fixer"${accent(f)}>${monogram(f)}<div>
      <div class="h">${esc(f.handle)} · ${esc(ring?.label ?? "")} FIXER</div><div class="who">${esc(f.name)}</div>
      <q>${esc(f.voice)}</q><p>${esc(f.blurb)}</p>
      <div class="meta"><span>DISTRICT <b>${esc(f.district)}</b></span>${where ? `<span>FIND THEM AT <b>${esc(where)}</b></span>` : ""}
        <span>WORK <b>${esc(f.tiers.map(t => tierInfo(t).risk).join(" / "))} RISK</b></span>
        ${isGM && where && city()?.worldScene?.() ? `<button type="button" class="fj-ghost fj-mini" data-act="citymap" data-spot="${esc(f.spot)}">Show on city map</button>` : ""}
        ${isGM ? `<button type="button" class="fj-ghost fj-mini" data-act="refresh" data-fixer="${esc(f.key)}" title="Swap this fixer's offers for new ones">New jobs</button>` : ""}
        ${isGM && !unlocked ? `<span class="fj-tag">LOCKED FOR PLAYERS</span>` : ""}</div></div></div>
      <h3 class="fj-sh">JOBS ON OFFER</h3>
      <div class="fj-cards">${list.map(jobCard).join("") || `<div class="fj-empty">${unlocked ? "Nothing on offer right now." : "Locked: no offers until the crew can reach this fixer (open them early on the GM desk)."}</div>`}</div>`;
  }

  // ---- job page

  function enemyChips(list) {
    return (list ?? []).map(([name,count]) => {
      const actor = game.actors.getName(name);
      return actor
        ? `<button type="button" data-act="sheet" data-actor="${esc(actor.id)}" title="Open ${esc(name)}">${esc(name)} ×${count}</button>`
        : `<span class="fj-tag" title="Imported when the gig is prepped">${esc(name)} ×${count}</span>`;
    }).join("");
  }

  // GM: how to run the gig, beat by beat, with maps, checks and enemies.
  function gmBlock(job) {
    if (hideGM()) return `<div class="fj-note" style="margin-top:20px">GM notes hidden (GM desk → Show GM notes).</div>`;
    const sheet = kit()?.runSheet?.(job);
    if (!sheet) return "";
    const prepped = job.prep && game.journal.get(job.prep.journal);
    const beats = sheet.beats.map(b => {
      const copy = job.prep?.beatScenes?.[b.n] ? game.scenes.get(job.prep.beatScenes[b.n]) : null;
      return `<div class="fj-beat"><div class="bn">${String(b.n).padStart(2,"0")}</div><div>
        <div class="bt"><b>${esc(b.title)}</b>${b.label ? ` · <span>${esc(b.label)}</span>` : ""}
          ${copy ? `<button type="button" class="fj-mini fj-go" data-act="viewmap" data-scene="${esc(copy.id)}" title="The gig's copy, enemies placed (hidden)">Open gig map</button>` : ""}
          ${b.scene ? `<button type="button" class="fj-mini fj-ghost" data-act="viewmap" data-scene="${esc(b.scene.id)}">Original map</button>` : ""}
          ${b.spot && city()?.worldScene?.() ? `<button type="button" class="fj-mini fj-ghost" data-act="citymap" data-spot="${esc(b.spot)}">City map</button>` : ""}</div>
        <p>${esc(b.text)}</p>
        ${b.checks.length ? `<ul class="fj-checks">${b.checks.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
        ${b.enemies.length ? `<div class="fj-enemies">${enemyChips(b.enemies)}</div>` : ""}
      </div></div>`;
    }).join("");
    return `<section class="fj-gm" aria-label="GM only">
      <h3 class="fj-sh">GM · HOW TO RUN IT${sheet.written ? "" : " (QUICK SHEET)"}</h3>
      ${sheet.hook ? `<p class="fj-hook">${esc(sheet.hook)}</p>` : ""}
      ${beats}
      ${sheet.npcs.length ? `<h3 class="fj-sh">PEOPLE</h3><ul class="fj-checks">${sheet.npcs.map(n => `<li><b>${esc(n.name)}</b> — ${esc(n.note ?? "")}</li>`).join("")}</ul>` : ""}
      <h3 class="fj-sh">THE TWIST</h3><p>${esc(sheet.twist || "None.")}</p>
      ${sheet.wrap ? `<h3 class="fj-sh">WRAPPING UP</h3><p>${esc(sheet.wrap)}</p>` : ""}
      <h3 class="fj-sh">GIG FILES</h3>
      <div class="fj-row">${prepped
        ? `<span class="fj-note">Ready: journal, ${(job.prep.scenes ?? []).length} map cop${(job.prep.scenes ?? []).length === 1 ? "y" : "ies"} with enemies placed hidden${(job.prep.actors ?? []).length ? `, ${job.prep.actors.length} named NPC${job.prep.actors.length === 1 ? "" : "s"}` : ""}.</span>
           <button type="button" class="fj-mini fj-go" data-act="openjournal" data-journal="${esc(job.prep.journal)}">Open gig journal</button>
           <button type="button" class="fj-mini" data-act="prep">Rebuild</button>
           <button type="button" class="fj-mini fj-ghost" data-act="cleanup">Delete gig files</button>`
        : `<span class="fj-note">One click builds a GIGS folder: a copy of each map with the enemies placed (hidden), the NPCs, and a journal with this run sheet and a player handout.${read().autoPrep ? " Confirming a job does this automatically." : ""}</span>
           <button type="button" class="fj-mini fj-go" data-act="prep">Prep gig files</button>`}</div>
    </section>`;
  }

  // Reward line for everyone: items and any favour.
  function rewardBlock(job) {
    const r = kit()?.rewardFor?.(job);
    if (!r || (!r.items.length && !r.favor)) return "";
    return `<h3 class="fj-sh">REWARD</h3><div class="fj-reward">
      <span class="money">${money(job.pay)} each</span>
      ${r.items.map(i => `<span class="fj-tag loot" title="${i.item ? "" : "Not in this world's items"}">${i.qty > 1 ? i.qty + "× " : ""}${esc(i.name)}</span>`).join("")}
      ${r.favor ? `<span class="fj-tag me">FAVOUR: ${esc(r.favor)}</span>` : ""}</div>`;
  }

  // GM payout: who gets each reward item.
  function rewardPicker(job) {
    const r = kit()?.rewardFor?.(job);
    if (!r || (!r.items.length && !r.favor)) return "";
    const crew = (job.crew ?? []).map(id => game.actors.get(id)).filter(Boolean);
    const rows = r.items.map((i,n) => `<label>${esc((i.qty > 1 ? i.qty + "× " : "") + i.name)}
      <select data-reward="${n}" data-name="${esc(i.name)}" data-qty="${i.qty}"${i.item ? "" : " disabled"}>
        ${crew.map((a,k) => `<option value="${esc(a.id)}" ${k === n % Math.max(1,crew.length) ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
        <option value="">nobody</option></select></label>`).join("");
    return `<span class="step">REWARD ITEMS</span><div class="fj-row fj-pay">${rows || `<span class="fj-note">No items.</span>`}</div>
      ${r.favor ? `<label class="fj-note"><input type="checkbox" data-field="favor" checked> Record the favour: ${esc(r.favor)}</label>` : ""}`;
  }

  function actionBlock(job,state,me) {
    const isGM = game.user.isGM;
    if (job.status === "offered") {
      if (isGM) {
        return `<div class="fj-act"><span class="step">GM · START IT DIRECTLY</span>
          <span class="fj-note">Tick the crew and start the job. No player request needed.</span>
          ${crewPicker(ui$.crew ?? crewActors().map(a => a.id))}
          <div class="fj-row"><button type="button" class="fj-go" data-act="approve">Start job</button>
          <button type="button" class="fj-ghost" data-act="remove">Take off board</button></div></div>`;
      }
      if (!me) return `<div class="fj-act"><span class="fj-note warn">You need a character to take jobs.</span></div>`;
      const locked = !job.for && !isOpen(fixerOf(job),state);
      return `<div class="fj-act"><span class="step">STEP 1 · WHO'S GOING?</span>
        ${crewPicker(ui$.crew ?? [me.id],{disabled:locked})}
        <span class="step">STEP 2 · TAKE IT</span>
        ${locked ? `<span class="fj-note warn">This fixer won't work with the crew yet.</span>` : `<span class="fj-note">The GM gets a message and confirms the job.</span>`}
        <div class="fj-row"><button type="button" class="fj-primary" data-act="request" ${locked ? "disabled" : ""}>Take this job</button></div></div>`;
    }
    if (job.status === "requested") {
      const who = game.actors.get(job.requestedAs)?.name ?? "Someone";
      if (isGM) {
        return `<div class="fj-act"><span class="step">GM · CONFIRM</span>
          <span class="fj-note"><b>${esc(who)}</b> wants this job. Change the crew if needed.</span>
          ${crewPicker(ui$.crew ?? job.crew)}
          <div class="fj-row"><button type="button" class="fj-go" data-act="approve">Confirm job</button>
          <button type="button" data-act="decline">Decline</button></div></div>`;
      }
      return `<div class="fj-act"><span class="fj-note">Crew: ${esc(crewNames(job.crew))}.</span>
        ${job.requestedBy === game.user.id ? `<div class="fj-row"><button type="button" data-act="withdraw">Cancel request</button></div>` : ""}</div>`;
    }
    if (job.status === "active") {
      if (!isGM) return `<div class="fj-act"><span class="fj-note">Crew: ${esc(crewNames(job.crew))}.</span></div>`;
      return `<div class="fj-act"><span class="step">GM · WHEN IT'S OVER</span>
        <span class="fj-note">Crew: <b>${esc(crewNames(job.crew))}</b>. Pay is per crew member; change it for a partial or bonus result${job.kind === "Cyberpsycho" ? " (non-lethal pays double)" : ""}.</span>
        <div class="fj-row fj-pay">
          <label>PAY EACH <input type="number" min="0" step="50" data-field="pay" value="${job.pay}"></label>
          <label>CREW CRED <input type="number" min="0" step="1" data-field="cred" value="${job.cred}"></label>
          ${job.kind === "Cyberpsycho" ? `<button type="button" data-act="double" title="Non-lethal takedown">×2 non-lethal</button>` : ""}
          <button type="button" class="fj-go" data-act="complete">Pay out</button></div>
        ${rewardPicker(job)}
        <div class="fj-row fj-pay">
          <label>CRED ON FAIL <input type="number" step="1" data-field="failcred" value="0"></label>
          <button type="button" data-act="fail">Mark failed</button>
          <button type="button" class="fj-ghost" data-act="reopen">Back on offer</button></div></div>`;
    }
    const loot = job.given?.length ? `<span class="fj-note">Loot: ${esc(job.given.join(", "))}</span>` : "";
    if (!isGM) return loot ? `<div class="fj-act">${loot}</div>` : "";
    return `<div class="fj-act">${loot}<div class="fj-row">
      ${job.prep ? `<button type="button" class="fj-go" data-act="cleanup" title="Deletes the map copies, NPCs and journal this gig made">Delete gig files</button>` : ""}
      <button type="button" data-act="reopen">Offer it again</button>
      <button type="button" class="fj-ghost" data-act="remove">Delete record</button></div></div>`;
  }

  function jobPage(job,state,me) {
    const f = fixerOf(job);
    const info = tierInfo(job.tier);
    const where = spotLabel(job);
    const [head,line] = STATUS[job.status] ?? [job.status,""];
    const result = job.status === "done"
      ? `Paid ${money(job.paid)} each to ${crewNames(job.crew)}; +${job.credPaid ?? 0} crew cred.`
      : job.status === "failed" ? `Crew: ${crewNames(job.crew)}.` : line;
    const statusLine = game.user.isGM && job.status === "requested" ? "A player asked for this job. Confirm or decline it below." : result;
    return `<button type="button" class="fj-ghost fj-mini fj-back" data-act="back">← ${esc(ui$.view === "contacts" ? (ui$.fixer === PERSONAL ? "Personal" : f?.handle ?? "Back") : "Back")}</button>
      <article class="fj-job fj-tc${job.tier}"${accent(f)}>
        <div class="by"><b>${esc(f?.handle ?? job.fixer)}</b> · ${esc(f?.name ?? "")}${job.for ? ` · <span class="fj-tag me">FOR ${esc(String(job.for).toUpperCase())}</span>` : ""}</div>
        <h2>${esc(job.title)}</h2>
        <div class="fj-facts">
          <div class="fj-fact risk"><div class="l">RISK</div><div class="v">${esc(info.risk)}</div><div class="s">${esc(job.kind)}</div></div>
          <div class="fj-fact"><div class="l">WHERE</div><div class="v">${esc(where ?? job.district)}</div><div class="s">${esc(job.district)}
            ${game.user.isGM && job.spot && city()?.worldScene?.() ? ` · <button type="button" class="fj-ghost fj-mini" data-act="citymap" data-spot="${esc(job.spot)}">Map</button>` : ""}</div></div>
          <div class="fj-fact pay"><div class="l">PAY</div><div class="v">${money(job.pay)}</div><div class="s">each crew member</div></div>
          <div class="fj-fact cred"><div class="l">STREET CRED</div><div class="v">+${job.cred}</div><div class="s">for the crew</div></div>
        </div>
        <div class="fj-status ${esc(job.status)}"><span class="dot"></span><div><b>${esc(head)}</b><span>${esc(statusLine)}</span></div></div>
        <h3 class="fj-sh">THE JOB</h3>
        <p class="fj-brief">${esc(job.brief || "No brief.")}</p>
        ${job.objectives?.length ? `<h3 class="fj-sh">OBJECTIVES</h3><ol class="fj-obj">${job.objectives.map(o => `<li>${esc(o)}</li>`).join("")}</ol>` : ""}
        ${rewardBlock(job)}
        ${game.user.isGM ? gmBlock(job) : ""}
        ${actionBlock(job,state,me)}
      </article>`;
  }

  // ---- lists: my jobs / done

  function listView(list,emptyHead,emptyBody) {
    if (!list.length) return `<div class="fj-empty"><b>${esc(emptyHead)}</b>${esc(emptyBody)}</div>`;
    return `<div class="fj-cards">${list.map(jobCard).join("")}</div>`;
  }

  function favorsBlock(state) {
    if (!state.favors.length) return "";
    const isGM = game.user.isGM;
    return `<h3 class="fj-sh">FAVOURS THE CREW IS OWED</h3><div class="fj-box" style="margin-bottom:14px">${state.favors.map(f => `<div class="fj-line"><div class="grow"><b${f.used ? ` style="text-decoration:line-through;opacity:.6"` : ""}>${esc(f.text)}</b>
      <span>${esc(fixerOf(f.fixer)?.handle ?? "")} · from "${esc(f.job)}"${f.used ? " · used" : ""}</span></div>
      ${isGM ? `<button type="button" class="fj-mini" data-act="favoruse" data-id="${esc(f.id)}" data-used="${f.used ? "0" : "1"}">${f.used ? "Not used" : "Mark used"}</button>
      <button type="button" class="fj-mini fj-ghost" data-act="favordel" data-id="${esc(f.id)}">Remove</button>` : ""}</div>`).join("")}</div>`;
  }

  // ---- GM desk

  function writeForm() {
    const d = ui$.draft ?? {};
    const fx = fixers().map(f => `<option value="${esc(f.key)}" ${d.fixer === f.key ? "selected" : ""}>${esc(f.handle)} (${esc(ringOf(f)?.label ?? "")})</option>`).join("");
    const kinds = [...new Set([...(Object.keys(cat()?.gen?.KINDS ?? {})),"Extraction","Investigation","Story"])];
    return `<div class="fj-form">
      <label class="w2">TITLE <input data-draft="title" autocomplete="off" value="${esc(d.title ?? "")}" maxlength="60" placeholder="e.g. The Long Night"></label>
      <label>FIXER <select data-draft="fixer">${fx}</select></label>
      <label>RISK <select data-draft="tier"><option value="">Fixer's level</option>${[1,2,3,4,5].map(t => `<option value="${t}" ${Number(d.tier) === t ? "selected" : ""}>${esc(tierInfo(t).risk)}</option>`).join("")}</select></label>
      <label>TYPE <input data-draft="kind" autocomplete="off" list="fj-kinds" value="${esc(d.kind ?? "")}" placeholder="Recovery"><datalist id="fj-kinds">${kinds.map(k => `<option value="${esc(k)}">`).join("")}</datalist></label>
      <label>DISTRICT <input data-draft="district" autocomplete="off" list="fj-districts" value="${esc(d.district ?? "")}" placeholder="fixer's district"><datalist id="fj-districts">${(cat()?.gen?.DISTRICTS ?? []).map(k => `<option value="${esc(k)}">`).join("")}</datalist></label>
      <label>PAY EACH <input type="number" min="0" step="50" data-draft="pay" value="${esc(d.pay ?? "")}" placeholder="default"></label>
      <label>CREW CRED <input type="number" min="0" step="1" data-draft="cred" value="${esc(d.cred ?? "")}" placeholder="default"></label>
      <label class="w4">BATTLE MAP (scene name) <input data-draft="map" autocomplete="off" value="${esc(d.map ?? "")}" placeholder="optional, e.g. Rundown Hotel"></label>
      <label class="w4">THE JOB <textarea data-draft="brief" rows="3" placeholder="What the fixer tells the crew.">${esc(d.brief ?? "")}</textarea></label>
      <label class="w4">OBJECTIVES (one per line) <textarea data-draft="objectives" rows="3">${esc(d.objectives ?? "")}</textarea></label>
      <label class="w4">TWIST (GM only) <textarea data-draft="twist" rows="2">${esc(d.twist ?? "")}</textarea></label>
    </div>
    <div class="fj-row" style="margin-top:12px"><button type="button" class="fj-go" data-act="postdraft">Post it</button>
      <button type="button" class="fj-ghost" data-act="cleardraft">Clear</button></div>`;
  }

  function deskView(state) {
    const requests = jobsWith(state,"requested");
    const active = jobsWith(state,"active");
    const line = job => `<div class="fj-line"><div class="grow"><b>${esc(job.title)}</b>
      <span>${esc(fixerOf(job)?.handle ?? "")} · ${esc(tierInfo(job.tier).risk)} · ${esc(crewNames(job.crew))}</span></div>
      <button type="button" class="fj-mini" data-job="${esc(job.id)}">Open</button></div>`;
    const reqLine = job => `<div class="fj-line"><div class="grow"><b>${esc(job.title)}</b>
      <span>${esc(game.actors.get(job.requestedAs)?.name ?? "?")} asks · crew ${esc(crewNames(job.crew))}</span></div>
      <button type="button" class="fj-go fj-mini" data-act="approve" data-id="${esc(job.id)}">Confirm</button>
      <button type="button" class="fj-mini" data-act="decline" data-id="${esc(job.id)}">Decline</button>
      <button type="button" class="fj-ghost fj-mini" data-job="${esc(job.id)}">Open</button></div>`;
    const fx = rings().map(r => `<div class="fj-ring is-open">${esc(r.label)} <span>${r.need} CRED</span></div>` + fixers().filter(f => f.ring === r.ring).map(f => {
      const byCred = state.cred >= r.need;
      const early = state.unlocked.includes(f.key);
      return `<div class="fj-line"><div class="grow"><b>${esc(f.handle)}</b><span>${esc(f.district)} · ${byCred ? "open by cred" : early ? "opened early" : "locked"}</span></div>
        ${byCred ? "" : `<button type="button" class="fj-switch fj-mini" aria-pressed="${early}" data-act="unlock" data-fixer="${esc(f.key)}" data-open="${early ? "0" : "1"}">${early ? "Close" : "Open early"}</button>`}</div>`;
    }).join("")).join("");
    return `<div class="fj-desk">
      <section class="fj-box"><h3 class="fj-sh">REQUESTS TO CONFIRM</h3>${requests.map(reqLine).join("") || `<div class="fj-note">No requests.</div>`}</section>
      <section class="fj-box"><h3 class="fj-sh">JOBS IN PROGRESS</h3>${active.map(line).join("") || `<div class="fj-note">Nothing running.</div>`}</section>
      <section class="fj-box"><h3 class="fj-sh">CREW STREET CRED</h3>
        <div class="fj-row fj-pay"><label>CRED <input type="number" min="0" data-field="crewcred" value="${state.cred}"></label>
          <button type="button" class="fj-mini" data-act="credstep" data-step="-5">−5</button>
          <button type="button" class="fj-mini" data-act="credstep" data-step="5">+5</button>
          <button type="button" data-act="setcred">Save</button></div>
        <p class="fj-note">Rings open at ${rings().map(r => `${esc(r.label)} ${r.need}`).join(" · ")}.</p>
        <h3 class="fj-sh">BOARD</h3>
        <div class="fj-row fj-pay"><label>JOBS PER FIXER <input type="number" min="1" max="4" data-field="per" value="${state.perFixer}"></label>
          <button type="button" data-act="setper">Save</button>
          <button type="button" class="fj-primary" data-act="refreshall" title="Swap every open fixer's offers">New jobs for everyone</button></div>
        <div class="fj-row" style="margin-top:8px">
          <select data-field="rollfixer" aria-label="Fixer for a new gig">${fixers().map(f => `<option value="${esc(f.key)}">${esc(f.handle)}</option>`).join("")}</select>
          <button type="button" data-act="rollone">Add a random gig</button>
          <button type="button" class="fj-ghost" data-act="togglegm" aria-pressed="${hideGM()}">${hideGM() ? "Show GM notes" : "Hide GM notes"}</button></div>
        <div class="fj-row" style="margin-top:8px"><button type="button" class="fj-switch fj-mini" aria-pressed="${state.autoPrep}" data-act="autoprep" data-on="${state.autoPrep ? "0" : "1"}">Auto-prep gig files on confirm: ${state.autoPrep ? "ON" : "OFF"}</button></div>
        <p class="fj-note">Written gigs done: ${state.used.length} of ${cat()?.JOBS?.length ?? 0}. A finished gig is never offered again. <button type="button" class="fj-ghost fj-mini" data-act="resetused">Allow repeats</button></p>
      </section>
      <section class="fj-box"><h3 class="fj-sh">FIXERS</h3>${fx}</section>
      <section class="fj-box" style="grid-column:1/-1"><h3 class="fj-sh">WRITE A JOB</h3>${writeForm()}</section>
    </div>`;
  }

  // ---- render

  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const state = read();
    const isGM = game.user.isGM;
    const me = isGM ? null : myActor();
    const mine = jobsWith(state,"requested","active");
    const done = Object.values(state.jobs).filter(j => !OPEN.includes(j.status)).sort((a,b) => (b.updated ?? 0) - (a.updated ?? 0));
    const requests = mine.filter(j => j.status === "requested").length;
    if (ui$.view === "gm" && !isGM) ui$.view = "contacts";
    const job = ui$.job ? state.jobs[ui$.job] ?? null : null;
    if (ui$.job && !job) ui$.job = null;
    if (ui$.view === "contacts" && !ui$.fixer) {
      const first = fixers().find(f => isOpen(f,state));
      ui$.fixer = first?.key ?? null;
    }
    const tab = (key,label,count=null,alert=0) =>
      `<button type="button" class="fj-tab" data-view="${key}" aria-pressed="${ui$.view === key}">${label}${count != null ? `<span class="fj-count">${count}</span>` : ""}${alert ? `<span class="fj-alert">${alert} TO CONFIRM</span>` : ""}</button>`;

    let body;
    const main = inner => `<div class="fj-main fj-full" aria-live="polite">${inner}</div>`;
    if (job) {
      body = ui$.view === "contacts"
        ? `<div class="fj-side">${contactList(state,me)}</div><div class="fj-main" aria-live="polite">${jobPage(job,state,me)}</div>`
        : main(jobPage(job,state,me));
    } else if (ui$.view === "contacts") {
      body = `<div class="fj-side">${contactList(state,me)}</div><div class="fj-main" aria-live="polite">${fixerPage(state)}</div>`;
    } else if (ui$.view === "mine") {
      body = main(`<h3 class="fj-sh">TAKEN JOBS</h3>${listView(mine,"NOTHING TAKEN","Jobs you've asked for or are working show up here.")}`);
    } else if (ui$.view === "done") {
      body = main(favorsBlock(read()) + `<h3 class="fj-sh">FINISHED JOBS</h3>${listView(done,"NO RECORD YET","Paid and failed jobs are kept here.")}`);
    } else {
      body = main(deskView(state));
    }

    root.innerHTML = `
      <header class="fj-head" data-drag>
        <div class="fj-brand"><span class="fj-eyebrow"><i></i>FIXER NET // ALABASTRA</span><h1 class="fj-title">JOBS<b>.</b></h1></div>
        ${credBlock(state)}
        <button type="button" class="fj-close" data-act="close" aria-label="Close jobs" title="Close (Esc)">✕</button>
      </header>
      <nav class="fj-bar" aria-label="Job board sections">
        ${tab("contacts","Contacts")}
        ${tab("mine","Taken jobs",mine.length)}
        ${tab("done","Finished",done.length)}
        ${isGM ? tab("gm","GM desk",null,requests) : ""}
        <span class="fj-how"><b>Pick a fixer</b> → <b>pick a job</b> → <b>take it</b> → GM confirms → play → GM pays</span>
      </nav>
      <div class="fj-body">${body}</div>`;
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

  const selectedCrew = root => [...root.querySelectorAll("[data-crew]:checked")].map(el => el.dataset.crew);

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
    if (target.dataset.view) {
      ui$.view = target.dataset.view;
      ui$.job = null;
      ui$.crew = null;
      sfx("subsystem_select");
      render();
      return;
    }
    if (target.dataset.fixer && !target.dataset.act) {
      ui$.fixer = target.dataset.fixer;
      ui$.job = null;
      ui$.crew = null;
      sfx("select");
      render();
      return;
    }
    if (target.dataset.job) {
      ui$.job = target.dataset.job;
      ui$.crew = null;
      sfx("select");
      render();
      root.querySelector(".fj-main")?.scrollTo?.(0,0);
      return;
    }

    const act = target.dataset.act;
    if (!act) return;
    const jobId = target.dataset.id ?? ui$.job;
    const field = name => root.querySelector(`[data-field="${name}"]`)?.value;

    try {
      switch (act) {
        case "close": return close();
        case "back": ui$.job = null; ui$.crew = null; break;
        case "sheet": return game.actors.get(target.dataset.actor)?.sheet?.render(true);
        case "viewmap": return game.scenes.get(target.dataset.scene)?.view();
        case "citymap": close(); return city()?.showOnMap?.(target.dataset.spot);
        case "double": {
          const input = root.querySelector('[data-field="pay"]');
          if (input) input.value = String((Number(input.value) || 0) * 2);
          sfx("select");
          return;
        }
        case "togglegm": setHideGM(!hideGM()); break;
        case "prep":
          target.disabled = true;
          target.textContent = "Building…";
          await run("prep",{jobId});
          ui.notifications.info("FIXER NET // Gig files ready in the GIGS folders.");
          sfx("install");
          break;
        case "cleanup":
          if (!confirmTwice(target,"Delete the gig's maps, NPCs and journal?")) return;
          await run("cleanup",{jobId});
          sfx("remove");
          break;
        case "openjournal": return game.journal.get(target.dataset.journal)?.sheet?.render(true);
        case "autoprep": await run("setAutoPrep",{on:target.dataset.on === "1"}); break;
        case "favoruse": await run("favor",{id:target.dataset.id,used:target.dataset.used === "1"}); break;
        case "favordel":
          if (!confirmTwice(target,"Remove?")) return;
          await run("favor",{id:target.dataset.id,remove:true});
          break;
        case "request": {
          const me = myActor();
          if (!me) throw new Error("You need a character to take jobs.");
          target.disabled = true;
          await run("request",{jobId,actorId:me.id,crew:selectedCrew(root)});
          ui.notifications.info("FIXER NET // Sent. The GM will confirm the job.");
          sfx("confirm");
          break;
        }
        case "withdraw": await run("withdraw",{jobId}); sfx("remove"); break;
        case "approve": {
          const crew = target.dataset.id ? (read().jobs[jobId]?.crew ?? []) : selectedCrew(root);
          await run("approve",{jobId,crew});
          sfx("confirm");
          break;
        }
        case "decline": await run("decline",{jobId}); sfx("remove"); break;
        case "complete": {
          const pay = Number(field("pay")), cred = Number(field("cred"));
          if (!confirmTwice(target,`Pay ${money(pay)} each + ${cred} cred?`)) return;
          const rewards = [...root.querySelectorAll("[data-reward]")].filter(el => !el.disabled && el.value).map(el => ({name:el.dataset.name,qty:Number(el.dataset.qty) || 1,actorId:el.value}));
          const favorBox = root.querySelector('[data-field="favor"]');
          const favor = favorBox?.checked ? kit()?.rewardFor?.(read().jobs[jobId])?.favor ?? null : null;
          await run("complete",{jobId,pay,cred,rewards,favor});
          sfx("install");
          break;
        }
        case "fail":
          if (!confirmTwice(target,"Really fail it?")) return;
          await run("fail",{jobId,cred:Number(field("failcred"))});
          sfx("error");
          break;
        case "reopen": await run("reopen",{jobId}); break;
        case "remove":
          if (!confirmTwice(target,"Really remove?")) return;
          await run("remove",{jobId});
          ui$.job = null;
          sfx("remove");
          break;
        case "refresh": await run("refresh",{fixer:target.dataset.fixer}); sfx("scan"); break;
        case "refreshall":
          if (!confirmTwice(target,"Swap every offer?")) return;
          await run("refresh",{fixer:null});
          sfx("scan");
          break;
        case "rollone": {
          const result = await run("rollOne",{fixer:field("rollfixer")});
          sfx("scan");
          ui$.view = "contacts";
          ui$.fixer = field("rollfixer");
          ui$.job = result.id;
          break;
        }
        case "unlock": await run("setUnlocked",{fixer:target.dataset.fixer,open:target.dataset.open === "1"}); sfx("confirm"); break;
        case "credstep": {
          const input = root.querySelector('[data-field="crewcred"]');
          if (input) input.value = String(Math.max(0,(Number(input.value) || 0) + Number(target.dataset.step)));
          return;
        }
        case "setcred": await run("setCred",{cred:Number(field("crewcred"))}); sfx("confirm"); break;
        case "setper": await run("setPerFixer",{per:Number(field("per"))}); sfx("confirm"); break;
        case "postdraft": {
          const result = await run("write",{draft:ui$.draft ?? {}});
          sfx("install");
          ui$.draft = null;
          ui$.view = "contacts";
          ui$.fixer = read().jobs[result.id]?.fixer ?? ui$.fixer;
          ui$.job = result.id;
          break;
        }
        case "cleardraft": ui$.draft = null; break;
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
    Object.assign(root.style,{inset:"auto",left:rect.left + "px",top:rect.top + "px",width:rect.width + "px",height:rect.height + "px",margin:"0"});
    const move = e => {
      root.style.left = Math.max(0,Math.min(window.innerWidth - 120,e.clientX - dx)) + "px";
      root.style.top = Math.max(0,Math.min(window.innerHeight - 60,e.clientY - dy)) + "px";
    };
    const up = () => { window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up); };
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
  }

  async function open() {
    if (!cat()) {
      ui.notifications.error("FIXER NET // The job catalog isn't loaded.");
      return null;
    }
    ensureStyle();
    // The GM's board fills itself: first open (or after an update) posts the
    // offers every open fixer should have.
    if (game.user.isGM) {
      try { await actions.topUp(); } catch (err) { console.warn("FEHA JOBS // top up failed",err); }
    }
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
    if (game.user.isGM && jobsWith(read(),"requested").length) { ui$.view = "gm"; ui$.job = null; }
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
      // Don't wipe a half-written job or a cred edit under the GM's cursor.
      const root = document.getElementById(ROOT_ID);
      if (root && root.contains(document.activeElement) && document.activeElement.matches("input,textarea,select")) return;
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
        if (foundry.utils.hasProperty(change,"system.currency")) rerender();
      })]);
      game.adk ??= {};
      game.adk.openJobs = open;
      game.adk.jobs = api;
      globalThis.FEHA_JOBS = api;
      if (!globalThis.FEHA_JOBS_NO_HOTBAR) {
        try { await installHotbar(); } catch (err) { console.warn("FEHA JOBS // hotbar install failed",err); }
      }
      // Bring an old board up to date and keep offers filled (active GM).
      if (isActiveGM() && !globalThis.FEHA_JOBS_NO_HOTBAR) {
        try { await actions.topUp(); } catch (err) { console.warn("FEHA JOBS // top up failed",err); }
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
