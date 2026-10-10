// FEHA // ALABASTRA CITY
//
// The city of Alabastra laid over the "world map" scene (the NCART map the
// GM uploaded): districts with their gangs, and every numbered spot renamed
// for Alabastra. The job board uses it to put each job somewhere
// (spotFor), to point at it (showOnMap) and to pin active jobs on the map
// (setJobMarker / clearJobMarker). game.adk.city.build() (GM, by hand)
// writes the journal "ALABASTRA — CITY GUIDE", one map pin per spot and
// the district labels; nothing is written on load.
//
// Coordinates are the centres of the numbered tags on that image
// (4824 x 5187). Numbers follow the original legend so the tags under the
// pins still match; 10 is not on this map. X1-X6 are places from the
// campaign doc that have no tag.
//
// Names from the campaign doc: Alabastra, New Niemir, the seven corps,
// CivCorp, the Corporate Council, the Marble Vigil, the Kurohane academy,
// Len's Discount Tech Emporium, the 365, Admiral Rosa and the Navy. Every
// other name here is a proposal and can be changed in PLACES.

(() => {
  const VERSION = "1.0.0";
  const FLAG = "fleshEnshrouded";
  const SCENE_NAME = "world map";
  const JOURNAL_NAME = "ALABASTRA — CITY GUIDE";

  // Night City district -> Alabastra district. gang: who runs the street
  // there (lore only; their fighters use the NPC catalog's Street roster).
  const DISTRICTS = {
    "New Niemir":     {was:"Watson",            at:[2560,1200], blurb:"Refugee district: Sloviti families and other climate refugees in old megablocks. Curfews, CivCorp patrols and the 'drug epidemic' raids. Home of the crew.",
      gang:["The Niemir Wolves","Sloviti street crew that grew out of a neighbourhood watch. Protective of their own, brutal to informants."]},
    "The Docks":      {was:"Northside / Arasaka Waterfront", at:[1640,1130], blurb:"Container yards, Kurohane's waterfront terminal and the warehouses where customs never looks. Carp-Line's turf.",
      gang:["Rustwater Boys","Dock smugglers and cargo thieves who rent themselves to whoever pays the night shift."]},
    "Orient Quarter": {was:"Japantown",         at:[2620,1980], blurb:"Neon markets, pachinko and the Yakuza family that runs out of the HQ tower.",
      gang:["Tsurugi-gumi","The Yakuza family that runs the Orient Quarter from its HQ tower. Kiyama speaks for them."]},
    "The Hills":      {was:"North Oak / Charter Hill", at:[3120,1650], blurb:"Gated estates, a casino and the Kurohane family estate, above the smog line.",
      gang:["Private security","No gangs: Kurohane and Bastion contractors patrol every street."]},
    "Corporate Plaza":{was:"City Center (Corpo Plaza)", at:[1980,2380], blurb:"The corporate towers and the Corporate Council Spire. CivCorp's general court and the Marble Vigil sit here.",
      gang:["Glasshouse","Corp kids with chrome and too much money, running drugs to the towers."]},
    "Downtown":       {was:"City Center (Downtown)", at:[2420,2560], blurb:"Old business district: clubs, broadcasters and money that hasn't made it to the towers yet.",
      gang:["Glasshouse","The corp-kid crew spills down here at night."]},
    "Old Capital":    {was:"Heywood",           at:[2230,3010], blurb:"Built on the ruins of the old capital. Government blocks turned slums, old money in the walled streets, CivCorp everywhere.",
      gang:["Los Viejos","Old barrio crew from before Vargas. Family first, protection rackets second, CivCorp never."]},
    "Cinderline":     {was:"Santo Domingo",     at:[3060,2940], blurb:"The industrial belt that turns Cinder into power. Plants, rail yards and the workers' blocks that run them.",
      gang:["The Sparkers","Chrome-crazed ex-plant workers who strip machines and people for parts."]},
    "Costa Morta":    {was:"Pacifica",          at:[1640,3830], blurb:"An abandoned resort coast the investors walked away from. Squats, gangs and a church that still feeds people.",
      gang:["The Drowned","Netrunner collective in the dead hotels. Say they hear voices in the old net."]},
    "The Kennel":     {was:"Dogtown",           at:[1960,3600], blurb:"A walled-off zone inside Costa Morta run by its own boss. No CivCorp, no Council, no rules but his.",
      gang:["The Kennel Dogs","Ex-Bastion soldiers who guard the walls and answer only to the Kennel's boss."]},
    "The Barrens":    {was:"Badlands",          at:[3950,2150], blurb:"Desert outside the walls: nomad clans, trailer parks, oil and the Cinder wells.",
      gang:["The Scorpions","Raiders who hit convoys between the clans and the city."]},
    "Naval Station":  {was:"NCX Spaceport",     at:[ 760,1880], blurb:"The Navy's island base. Fleet Admiral Fúlvio Rosa's power base, and a Vargas loyalist stronghold.",
      gang:["The Navy","Marines loyal to Admiral Rosa first and the Council second."]}
  };

  const CATS = {
    mega:    {label:"MEGABUILDINGS",          color:"#f3c623", icon:"icons/svg/tower.svg"},
    living:  {label:"HOTELS, CAMPS & LIVING", color:"#ff8a3d", icon:"icons/svg/house.svg"},
    bar:     {label:"BARS, PUBS & CLUBS",     color:"#3fa9f5", icon:"icons/svg/tankard.svg"},
    shop:    {label:"SHOPS & MARKETS",        color:"#3ddc84", icon:"icons/svg/coins.svg"},
    ripper:  {label:"RIPPERDOCS",             color:"#2f6bff", icon:"icons/svg/heal.svg"},
    land:    {label:"LANDMARKS",              color:"#b45cff", icon:"icons/svg/eye.svg"},
    corp:    {label:"CORPORATE & COUNCIL",    color:"#ff3b3b", icon:"icons/svg/castle.svg"},
    crew:    {label:"THE CREW'S ALABASTRA",   color:"#5ef2ff", icon:"icons/svg/village.svg"}
  };

  // [id, x, y, category, name, district, blurb, battle map (scene name or prefix)]
  const PLACES = [
    // ---------------------------------------------------- megabuildings
    ["H1", 1992,2552,"mega","Council Residences","Corporate Plaza","Luxury stack for Council staff and mid-level corpos, with private security on every floor.","Highrise Apartment"],
    ["H2", 1724,2866,"mega","Seawall Stack","Old Capital","Overcrowded block on the old harbour wall. Its lifts haven't worked in years.","Cyber Slums (District 8)"],
    ["H3", 2372,2742,"mega","Old Senate Block","Old Capital","The old capital's senate offices, cut up into flats after the government ran out of money.","Hotel Corridor"],
    ["H4", 2372,3159,"mega","Praça Block","Old Capital","Market square at the bottom, families stacked forty floors above it.","Apartment Complex"],
    ["H5", 2397,2444,"mega","Liberdade Stack","Downtown","Built in Vargas's time as 'housing for every worker'. Now a rent trap.","Res Cube"],
    ["H6", 2758,2717,"mega","Cinderline Block 6","Cinderline","Company housing for Cinder plant shifts. Rent comes out of wages before payday.","Basement Dwelling"],
    ["H7", 2882,2813,"mega","Cinderline Block 7","Cinderline","Block 6's twin. Its basement is where the plant's illegal union meets.","Basement — Map 1"],
    ["H8", 2493,1820,"mega","Sakura Heights","Orient Quarter","Tower with Yakuza-run shops on its lower floors and a rooftop shrine.","Apartment (Arcology Series)"],
    ["H9", 2167,2050,"mega","Meridian Stack","Corporate Plaza","Apartments for corp contractors who can't afford the towers.","Condo"],
    ["H10",2096,1547,"mega","Zarya Block","New Niemir","Sloviti megablock with its own market, school and community kitchen.","The Apartment"],
    ["H11",2096,1167,"mega","Volna Block","New Niemir","Half-finished block taken over by refugee families after the developer left.","Squatters Court"],
    ["H12",1808, 860,"mega","Pristan Block","The Docks","Dockworkers' block in the shadow of the container cranes.","Apartment — Map 1"],

    // ------------------------------------------- hotels, camps, living
    ["01",3836,1018,"living","Wanderer Clan Camp","The Barrens","Nomad clan camp in the hills. Trades parts, fuel and favours.","The Nomad Camp"],
    ["02",1896,3164,"living","Batista's Rooms","Old Capital","Cheap rooms over a market. Batista asks no questions and remembers every face.","Rundown Hotel"],
    ["03",1446,3589,"living","Hotel Santa Sofia","Costa Morta","Half-built resort hotel on the dead coast, squatted floor by floor.","Small Hotel"],
    ["04",1674,1290,"living","Kurohane Plaza Hotel","The Docks","Kurohane-owned luxury hotel on the waterfront. Executive suites, perfect security.","The Koi Hotel"],
    ["05",2726,4900,"living","Las Palmeras Motel","The Barrens","Motel on the airport road. Truckers, smugglers and nobody else.","Wasteland Motel — Map 1"],
    ["06",2224,1522,"living","No Questions Motel","New Niemir","Rooms by the hour in the middle of New Niemir.","Motel Room"],
    ["07",4730,2456,"living","Dustline Camp","The Barrens","The biggest nomad camp, on the far edge of the Barrens.","Nomad Houndkeeper"],
    ["08",3494,2512,"living","Red Ridge Trailer Park","The Barrens","Trailer park where evicted Cinderline workers end up.","Trailer Park — Map 1"],
    ["09",3756,2686,"living","Last Light Motel","The Barrens","Motel at the city limits. The last place before the desert.","Wasteland Motel — Map 2"],
    ["11",2108,4226,"living","Tango Motel","The Barrens","Roadside motel south of the city, on the smugglers' route.","Wasteland Motel — Map 3"],
    ["12",2348,2391,"living","Hotel Kasumi","Downtown","Discreet business hotel where deals get signed off the record.","Discreet Hotel Lobby"],

    // --------------------------------------------- bars, pubs and clubs
    ["13",1824,2276,"bar","The Ninth Circle","Corporate Plaza","Corpo club where junior execs burn their bonuses.","The Nightclub"],
    ["14",2454,2276,"bar","Dicey's","Downtown","Dance bar with rigged dice tables in the back room.","Small Dance Bar"],
    ["15",2194,2796,"bar","El Lobo Cojo","Old Capital","Old neighbourhood bar. Everyone knows everyone, and everyone owes someone.","Dive Bar"],
    ["16",2054,2854,"bar","El Gallo Flaco","Old Capital","Taco bar and message drop for the Old Capital's street crews.","Food Shack"],
    ["17",1806,2046,"bar","Voltage","Corporate Plaza","Neon club where corp kids buy what their parents banned.","Synth Club — Main Map (No Grid)"],
    ["18",1904,2516,"bar","Cinders","Corporate Plaza","Upscale bar in a Council tower. Ms. Hale takes meetings here.","Cocktail Lounge"],
    ["19",1968,2074,"bar","Sympathy","Corporate Plaza","Quiet lounge with booths that block every signal. Dial Tone's drop point.","The VIP Lounge"],
    ["20",2010,3525,"bar","Iron Hearts Club","The Kennel","The Kennel's biggest club, where the boss's people spend his money.","Industrial Club"],
    ["21",2318,1516,"bar","The Red Crane","New Niemir","Yakuza-owned club on New Niemir's edge.","Viper Club"],
    ["22",2243,1394,"bar","Mila's","New Niemir","Sloviti bar with a back room for union meetings. Babka holds court here.","Basement Bar"],
    ["23",2038,3104,"bar","Steelrain","Old Capital","Metal bar for chromeheads and the people who fight them.","Dead Space Cyberpunk Bar"],
    ["24",2482,2790,"bar","Red Clay","Old Capital","Dockside dive where Clerk Seven sells warrants out of a corner booth.","Pool Bar — Map 1"],
    ["25",1988,1700,"bar","The Picket Line","New Niemir","Workers' bar. Strike posters on the walls, a CivCorp informant at the bar.","Cyber Bar"],
    ["26",2184,1684,"bar","The Wake","New Niemir","Mercs' bar built into an old funeral hall. Every fixer in the city drinks here.","Cocktail Bar"],
    ["27",2522,2690,"bar","The Last Stand","Downtown","Veterans' bar. Navy loyalists, old soldiers and Vargas portraits.","Pool Bar — Map 2"],
    ["28",1566,3703,"bar","The Lantern","Costa Morta","Beach bar in a dead resort, lit by stolen Cinder.","Hookah Lounge"],
    ["29",1938,1052,"bar","Totenhaus","The Docks","Gang bar by the docks. Don't go in without an invitation.","Booster Basement"],

    // -------------------------------------------------- shops & markets
    ["30",2384,2628,"shop","Vektor Outlet","Downtown","Vektor Dynamics' official gun store. Medium everything, warranty included.","Gunstore — Map 1"],
    ["31",1856,2804,"shop","Vektor Outlet","Old Capital","Vektor Dynamics store behind steel shutters.","Gunstore — Map 2"],
    ["32",1560,3558,"shop","Vektor Outlet","Costa Morta","Vektor's last store on the dead coast, guarded day and night.","Gunstore — Map 3"],
    ["33",2213,1572,"shop","Vektor Outlet","New Niemir","Vektor store whose prices are a week's wages for a New Niemir family.","Shopfront"],
    ["34",1910,3218,"shop","Batista's Market","Old Capital","Market under Batista's Rooms. Anything for sale, eventually.","City Store"],
    ["35",2504,1740,"shop","Sakura Night Market","Orient Quarter","Night market under the Yakuza's protection. Kiyama has a table at the back.","Market Street"],
    ["36",1946, 892,"shop","Dead Ringer Clothing","The Docks","Second-hand clothes, some of them still warm.","Cyberpunk Old Pawn Shop"],
    ["37",2072,3423,"shop","Kennel Market","The Kennel","Black market inside the Kennel walls. Military surplus and worse.","Guns Marketplace"],
    ["38",2338,1134,"shop","True Aim Firearms","New Niemir","Gun shop with a basement range and no paperwork.","Sports Store"],
    ["39",1831, 760,"shop","Pier 9 Market","The Docks","Dockside market for things that fell off ships. Carp-Line's office is above it.","Dock"],
    ["40",1860,2216,"shop","Shirogane Tailors","Corporate Plaza","Corp tailoring. Armour woven into the lining.","Bespoke Tailor Shop"],
    ["41",2234,1134,"shop","Niemir Bazaar","New Niemir","The district's main market: food, parts, pickles and gossip.","Market Stalls"],
    ["42",1676,3713,"shop","Stacks Market","Costa Morta","Market in shipping containers stacked on the beach.","Cyber Market"],
    ["43",1908,2152,"shop","Iron Psalm Records","Corporate Plaza","Record shop that sells banned music to people with money.","Music Store"],
    ["44",3198,3437,"shop","Dam Market","Cinderline","Market at the dam road, for plant workers coming off shift.","Junkstore — Map 1"],
    ["45",2640,1460,"shop","Jade Arc Showroom","Orient Quarter","Jade Arc Systems' energy weapons, behind bulletproof glass.","Showroom — Main Map"],
    ["46",2336,3103,"shop","Cinderline Market","Old Capital","Market on the line between the Old Capital and Cinderline.","Ghetto Markets"],
    ["47",3018,3044,"shop","Sleek Threads","Cinderline","Clothes shop for workers who want to look like corpos for one night.","Street Clothier"],
    ["48",2051,1330,"shop","Sleek Threads","New Niemir","Sleek Threads' New Niemir branch.","Esoteric Curio Shop"],
    ["48b",1586,2590,"shop","Sleek Threads","Corporate Plaza","Sleek Threads' flagship on the plaza.","Corpo Attire"],
    ["49",1876,2572,"shop","Rewind Records","Corporate Plaza","Music and braindance shop. Old recordings in the back, new ones by request.","Electronics Store — Map 1"],

    // ------------------------------------------------------- ripperdocs
    ["50",2290,1078,"ripper","Kowal Clinic","New Niemir","Sloviti ripperdoc who fixes refugees for free on Sundays.","Ripperdoc Clinic"],
    ["51",1570,2034,"ripper","Council Implants","Corporate Plaza","Corp clinic: clean, licensed and tracked by CivCorp.","Cybernetics Boutique Clinic & Spa"],
    ["52",1566,3754,"ripper","Costa Clinic","Costa Morta","Beach shack ripperdoc. Cheap, fast, unsterile.","Patch & Go - Minute Clinic"],
    ["53",1969, 952,"ripper","Doc Rydel","The Docks","Dockside ripperdoc who patches up anyone who pays.","Medical Ward"],
    ["54",2301,1194,"ripper","Dr. Nickel","New Niemir","Chrome dealer and ripperdoc in a back alley off the bazaar.","Ripperdoc - Back-Alley Bazaar [Dr.Chrome]"],
    ["55",2676,1812,"ripper","Thumbs' Clinic","Orient Quarter","Yakuza ripperdoc. Discreet, and he reports to Kiyama.","Massage Spa - Red Dragon - Part 1"],
    ["56",2318,1460,"ripper","Insta-Chrome","New Niemir","Walk-in implant chain. Payment plans, remote repossession.","Body Augments"],
    ["57",2858,2276,"ripper","Novak's Clinic","The Hills","Private clinic for people who can afford discretion.","Hospital Ward"],
    ["58",3302,3437,"ripper","Otávio's Clinic","Cinderline","Treats plant injuries the company insurance won't cover.","Emergency Room"],
    ["59",2052,1600,"ripper","Bogdan's Clinic","New Niemir","Old ripperdoc everyone in New Niemir trusts. Knows the crew's families.","Barber"],
    ["60",1594,2752,"ripper","Springside Doc","Old Capital","Ripperdoc in a flooded basement. Waders recommended.","Sewer Slums"],
    ["61",1560,3611,"ripper","Seawind Ripper","Costa Morta","Coastal ripperdoc who buys chrome off corpses and doesn't ask whose.","Junkstore — Map 2"],
    ["62",1992,3619,"ripper","Refuge Clinic","The Kennel","The Kennel's only clinic, under the boss's protection.","Donor Clinic — Map 1"],

    // -------------------------------------------------------- landmarks
    ["63",3142,1522,"land","Kurohane Estate","The Hills","The Kurohane family estate. Gardens, guards and old money.","Sky Mansion Gardens"],
    ["64",1452, 926,"land","Kurohane Waterfront Terminal","The Docks","Kurohane's private port. Its cargo goes through no customs.","The Container Port"],
    ["65",1366,4388,"land","Helix Vitae Protein Flats","The Barrens","Miles of protein farms that feed the city. Striking here is illegal.","Protein Farms"],
    ["66",2966,1926,"land","Hall of Ashes","The Hills","Columbarium for the city's dead. The poor rent their niches by the year.","Cyberpunk Church"],
    ["67",1632,3389,"land","Vargas Grand Mall","Costa Morta","Sancho Vargas's showcase mall, abandoned when he fell.","Horizon Shopping Mall"],
    ["68",2642,1760,"land","Lantern Row","Orient Quarter","Red-light street under Yakuza protection.","Red Light District — Map 1"],
    ["69",3474,3941,"land","Ninfa Reservoir","The Barrens","The city's water. Whoever controls the dam controls New Niemir's taps.","Water Dam"],
    ["70",1100,2042,"land","Alabastra Naval Station","Naval Station","Navy base on its own island. Admiral Rosa's fleet answers to him first.","Flight Deck"],
    ["71",3720,3321,"land","The Heap","The Barrens","The city landfill. Scavengers, chrome strippers and bodies.","Garbage Dump"],
    ["72",4510,3252,"land","Dustline Rail Station","The Barrens","Freight rail stop the nomads use to move cargo in and out.","Train Repair Yard"],
    ["73",3414,1408,"land","Hillcrest Casino","The Hills","Council members' casino in the hills.","Casino — Main Map"],
    ["74",1945, 100,"land","Jade Arc Proving Grounds","The Barrens","Jade Arc Systems' weapons range in the northern wastes. Keep out.","Assault Base Alpha"],
    ["75",2047,5016,"land","Alabastra Regional Airport","The Barrens","The city's airport. Every flight checked by CivCorp.","Airdock 6 - Landing platform"],
    ["76",2766,3706,"land","Cinder Collector Array","Cinderline","The dishes that pull the Cinder in. Everything in the city runs on it.","Pump Control"],
    ["77",1653,3901,"land","CivCorp Correctional Facility 4","Costa Morta","Private prison in a dead resort. Its 'drug epidemic' arrests make CivCorp record profits.","Prison Facility"],
    ["78",1850,3510,"land","The Black Pearl","The Kennel","The Kennel boss's tower-top club. Invitation only.","VIP Room"],
    ["79",2968,1752,"land","Alabastra Sign","The Hills","The city's name in giant letters over the hills.","Rooftop"],

    // ----------------------------------------- corporate & council HQs
    ["80",2079,2160,"corp","Kurohane Tower","Corporate Plaza","Kurohane Group's headquarters, the tallest tower in Alabastra.","Corporate Lobby"],
    ["81",2135,1274,"corp","Helix Vitae Medical Center","New Niemir","Helix Vitae's hospital. Excellent care, billed by the minute.","The Hospital Trauma Ward"],
    ["82",2096,2442,"corp","Bastion Strategic Tower","Corporate Plaza","Bastion Strategic's headquarters and arms sales floor.","Lumina Corporate Lobby Atrium"],
    ["83",2482,1913,"corp","Corvus Neural Campus","Orient Quarter","Corvus Neural's research campus: implants, interfaces and the net.","Offices - Nexus Robotics"],
    ["84",2801,2546,"corp","ForgeLine Works","Cinderline","ForgeLine Industries' foundries and offices. The heaviest guns in the city come from here.","Foundry"],
    ["85",1908,2861,"corp","Corporate Council Spire","Old Capital","Seat of the Corporate Council, where the twelve corporations rule under the state of emergency.","Corporate Assembly"],

    // ---------------------------------- places from the campaign doc
    ["X1",2196,1236,"crew","Len's Discount Tech Emporium","New Niemir","Sasha's workplace. Len's repair counter and his longer list of favours.","Electronics Repair Workshop"],
    ["X2",2120,1420,"crew","The 365","New Niemir","The 24/7 convenience store where Ponyboy works double shifts.","The Convenience Store"],
    ["X3",2050,1460,"crew","The Studio Apartment","New Niemir","Where Ponyboy, Sasha and Zach live together.","The Studio Apartment"],
    ["X4",2290,1300,"crew","Union Hall","New Niemir","The basement where the approved union meets, and the unapproved one after it.","Basement Utilities Room"],
    ["X5",2180,2250,"crew","Kurohane Academy","Corporate Plaza","Kurohane's academy for gifted youth. Zach's old school.","Corporate Atrium — Map 1"],
    ["X6",1760,2420,"crew","CivCorp Plaza & General Court","Corporate Plaza","CivCorp's headquarters and the general court it sponsors. Marble Vigil command is on the top floors.","Court"]
  ];

  // Flags are read directly: "fleshEnshrouded" is not a registered flag scope,
  // so getFlag() throws on it (FEHA writes it through update/create only).
  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const num = id => id.startsWith("X") ? "" : id.replace(/^0/,"").replace(/b$/,"");
  const label = p => (num(p[0]) ? num(p[0]) + " · " : "") + p[4];
  const fixers = () => globalThis.FEHA_JOB_CATALOG?.FIXERS ?? [];

  // ------------------------------------------------------------ lookups

  const byId = new Map(PLACES.map(p => [p[0],p]));
  const asObj = p => p && {id:p[0],x:p[1],y:p[2],cat:p[3],name:p[4],district:p[5],blurb:p[6],map:p[7],label:label(p)};

  function place(id) {
    return asObj(byId.get(id));
  }

  function placesIn(district) {
    return PLACES.filter(p => p[5] === district).map(asObj);
  }

  function worldScene() {
    return game.scenes.find(s => s.flags?.[FLAG]?.cityMap) ??
      game.scenes.find(s => s.name.toLowerCase() === SCENE_NAME) ?? null;
  }

  // Best spot for a job: a place with the same battle map (in the job's
  // district if one is there, else the only place in the city that uses
  // it), else the fixer's hangout if it is in that district, else a place in
  // the district (stable per job key), else the fixer's hangout.
  function spotFor({district,map,fixer,key} = {}) {
    const hang = fixers().find(f => f.key === fixer)?.spot ?? null;
    const local = PLACES.filter(p => p[5] === district);
    const lower = String(map ?? "").toLowerCase();
    const fits = p => {
      const own = p[7].toLowerCase();
      return Boolean(lower) && (own === lower || own.startsWith(lower) || lower.startsWith(own));
    };
    const sameMap = local.find(fits);
    if (sameMap) return sameMap[0];
    const anywhere = PLACES.filter(fits);
    if (anywhere.length === 1) return anywhere[0][0];
    if (hang && byId.get(hang)?.[5] === district) return hang;
    if (local.length) {
      let h = 0;
      for (const ch of String(key ?? district)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      return local[h % local.length][0];
    }
    return hang;
  }

  // GM only: open the city map on this screen and point at a spot.
  async function showOnMap(id) {
    const p = byId.get(id);
    const scene = worldScene();
    if (!p || !scene) {
      ui.notifications.warn("FIXER NET // The city map or that spot isn't set up.");
      return false;
    }
    if (canvas.scene?.id !== scene.id) {
      await scene.view();
      await new Promise(r => setTimeout(r,600));
    }
    const {sceneX:ox,sceneY:oy} = canvas.dimensions;
    const point = {x:p[1] + ox,y:p[2] + oy};
    await canvas.animatePan({...point,scale:0.9,duration:400});
    try { canvas.ping(point,{color:"#f3e600"}); } catch {}
    return true;
  }

  // Job markers: a pin on the city map for every active job (GM writes).
  async function setJobMarker(job) {
    const scene = worldScene();
    const p = byId.get(job?.spot);
    if (!game.user.isGM || !scene || !p) return;
    await clearJobMarker(job.id);
    const {sceneX:ox,sceneY:oy} = scene.dimensions;
    await scene.createEmbeddedDocuments("Note",[{
      x:p[1] + ox + 46,y:p[2] + oy - 40,
      text:"JOB · " + job.title,
      texture:{src:"icons/svg/target.svg",tint:"#f3e600"},
      iconSize:46,
      fontSize:24,
      textColor:"#f3e600",
      textAnchor:CONST.TEXT_ANCHOR_POINTS.TOP,
      global:true,
      flags:{[FLAG]:{cityJob:job.id}}
    }]);
  }

  async function clearJobMarker(jobId) {
    const scene = worldScene();
    if (!game.user.isGM || !scene) return;
    const ids = scene.notes.filter(n => n.flags?.[FLAG]?.cityJob === jobId).map(n => n.id);
    if (ids.length) await scene.deleteEmbeddedDocuments("Note",ids);
  }

  // ---------------------------------------------------------- the guide

  function sceneLink(name) {
    if (!name) return "";
    const lower = name.toLowerCase();
    const scene = game.scenes.find(s => s.name === name) ?? game.scenes.find(s => s.name.toLowerCase().startsWith(lower));
    return scene ? `@UUID[${scene.uuid}]{${esc(scene.name)}}` : esc(name);
  }

  function pageHtml(p) {
    const [id, , , cat, , district, blurb, map] = p;
    const d = DISTRICTS[district];
    const here = fixers().filter(f => f.spot === id);
    return `<p class="feha-city-go"><strong>▶ BATTLE MAP:</strong> ${sceneLink(map)}</p>
<p><strong>${esc(CATS[cat].label)}</strong> · ${esc(district)}${d ? ` <em>(${esc(d.was)})</em>` : ""}</p>
<p>${esc(blurb)}</p>
${here.map(f => `<p><strong>Fixer:</strong> ${esc(f.handle)} (${esc(f.name)}) works out of here. <em>"${esc(f.voice)}"</em></p>`).join("")}
${d?.gang ? `<p><strong>Local gang:</strong> ${esc(d.gang[0])}. ${esc(d.gang[1])}</p>` : ""}`;
  }

  function legendHtml() {
    const groups = Object.entries(CATS).map(([key,c]) => {
      const rows = PLACES.filter(p => p[3] === key).map(p => `<li><strong>${esc(num(p[0]) || "•")}</strong> ${esc(p[4])} <em>(${esc(p[5])})</em></li>`).join("");
      return `<h3 style="color:${c.color}">${esc(c.label)}</h3><ul>${rows}</ul>`;
    }).join("");
    const districts = Object.entries(DISTRICTS).map(([name,d]) => {
      const fx = fixers().filter(f => f.district === name).map(f => f.handle).join(", ");
      return `<li><strong>${esc(name)}</strong> <em>(${esc(d.was)})</em>: ${esc(d.blurb)}${d.gang ? `<br>Gang: <strong>${esc(d.gang[0])}</strong>. ${esc(d.gang[1])}` : ""}${fx ? `<br>Fixers: <strong>${esc(fx)}</strong>` : ""}</li>`;
    }).join("");
    return `<h2>Districts</h2><ul>${districts}</ul><h2>Legend</h2>${groups}`;
  }

  async function ensureJournal() {
    let journal = game.journal.find(j => j.flags?.[FLAG]?.cityGuide);
    if (!journal) {
      journal = await JournalEntry.create({
        name:JOURNAL_NAME,
        ownership:{default:CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER},
        flags:{[FLAG]:{cityGuide:VERSION}}
      });
    }
    const pages = [];
    pages.push({name:"Legend & Districts",type:"text",text:{content:legendHtml()},sort:0,flags:{[FLAG]:{cityId:"_legend"}}});
    PLACES.forEach((p,i) => pages.push({name:label(p),type:"text",text:{content:pageHtml(p)},sort:(i + 1) * 100,flags:{[FLAG]:{cityId:p[0]}}}));

    const have = new Map(journal.pages.map(pg => [pg.flags?.[FLAG]?.cityId,pg]));
    const create = [], update = [];
    for (const data of pages) {
      const existing = have.get(data.flags[FLAG].cityId);
      if (existing) update.push({_id:existing.id,name:data.name,"text.content":data.text.content,sort:data.sort});
      else create.push(data);
    }
    if (create.length) await journal.createEmbeddedDocuments("JournalEntryPage",create);
    if (update.length) await journal.updateEmbeddedDocuments("JournalEntryPage",update);
    return journal;
  }

  // ------------------------------------------------------------- the key

  // Pins are drawn this far right of their tag's centre (tags are ~70 px).
  const PIN_DX = 58;
  const KEY_PATH = "feha-city";
  const KEY_FILE = "alabastra-key.png";
  const KEY_W = 1800;
  const KEY_GAP = 40;
  // The city image (Map_withNcart_Full.png). The scene is widened so the key
  // sits inside it, right of the image, where players can see it too.
  const IMG_W = 4824, IMG_H = 5187;

  // Legend rows by section: [number, name, scene name, place id to jump to].
  // Repeated chains (30-33) collapse to one row and jump to the first.
  function keySections() {
    const rows = cat => {
      const out = [];
      for (const p of PLACES.filter(q => q[3] === cat)) {
        const n = num(p[0]);
        const last = out[out.length - 1];
        if (last && last.name === p[4] && n && last.to && /^\d+$/.test(n) && Number(n) === Number(last.to) + 1) {
          last.to = n;
          last.scenes.push(p[7]);
          continue;
        }
        out.push({from:n,to:n,name:p[4],scenes:[p[7]],id:p[0]});
      }
      const pad = n => /^H/.test(n) ? n : n.padStart(2,"0");
      return out.map(r => [
        r.from ? (r.to !== r.from ? pad(r.from) + "-" + pad(r.to) : pad(r.from)) : "•",
        r.name,
        r.scenes.length > 1 ? r.scenes.length + " maps" : r.scenes[0],
        r.id
      ]);
    };
    const fx = fixers().map(f => [f.spot ? num(f.spot).padStart(2,"0") : "•",f.handle,f.district,f.spot ?? null]);
    const dist = Object.entries(DISTRICTS).map(([name,d]) => ["",name,d.gang?.[0] ?? "","district:" + name]);
    return {
      left:[["mega",rows("mega")],["living",rows("living")],["bar",rows("bar")],["shop",rows("shop")]],
      right:[["ripper",rows("ripper")],["land",rows("land")],["corp",rows("corp")],["crew",rows("crew")],
        ["fixers",fx,{label:"FIXERS",color:"#ff5e57"}],["districts",dist,{label:"DISTRICTS & GANGS",color:"#f3e600"}]]
    };
  }

  // Draws the key as an image the height of the map, in the style of the
  // map's own legend panel. Returns the image and the clickable rows (key
  // units, from the key's top-left).
  async function renderKey(heightUnits) {
    const S = 2;
    const W = KEY_W * S, H = heightUnits * S;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const display = "Rajdhani", mono = "Share Tech Mono";
    try {
      await Promise.all([
        document.fonts.load("700 40px " + display),
        document.fonts.load("600 40px " + display),
        document.fonts.load("40px \"" + mono + "\"")
      ]);
    } catch {}
    const font = (weight,size,family) => (weight ? weight + " " : "") + Math.round(size) + "px " + (family === mono ? "\"" + mono + "\"" : family);

    g.fillStyle = "#0c0d14"; g.fillRect(0,0,W,H);
    g.strokeStyle = "#f3e600"; g.lineWidth = 6 * S;
    g.beginPath(); g.moveTo(30*S,120*S); g.lineTo(30*S,30*S); g.lineTo(220*S,30*S); g.stroke();
    g.beginPath(); g.moveTo(W - 30*S,H - 120*S); g.lineTo(W - 30*S,H - 30*S); g.lineTo(W - 220*S,H - 30*S); g.stroke();
    g.lineWidth = 2 * S; g.strokeStyle = "rgba(243,230,0,.35)";
    g.strokeRect(14*S,14*S,W - 28*S,H - 28*S);

    const pad = 70 * S;
    let y = 160 * S;
    g.textBaseline = "alphabetic";
    const spaced = (text,x,yy,gap) => { let cx = x; for (const ch of text) { g.fillText(ch,cx,yy); cx += g.measureText(ch).width + gap; } };
    g.fillStyle = "#f1e6e3"; g.font = font(700,140*S,display);
    spaced("ALABASTRA",pad,y,32*S);
    y += 76 * S;
    g.fillStyle = "#f3e600"; g.font = font(600,50*S,display);
    spaced("CITY OF THE CORPORATE COUNCIL",pad,y,8*S);
    y += 50 * S;
    g.fillStyle = "#8f8a9a"; g.font = font("",24*S,mono);
    g.fillText("Map render: CD Projekt RED · Piggyback Interactive · Kama. Names and legend: FEHA.",pad,y);
    y += 40 * S;
    g.fillText("Click a line to find it on the map. Click a pin to open its page and battle map.",pad,y);
    y += 80 * S;
    g.fillStyle = "#f1e6e3"; g.font = font(700,70*S,display);
    g.fillText("LEGEND",pad,y);
    y += 30 * S;

    const {left,right} = keySections();
    const gap = 50 * S;
    const colW = (W - pad * 2 - gap) / 2;
    const count = col => col.reduce((n,[,rows]) => n + rows.length + 2,0);
    const rowsMax = Math.max(count(left),count(right));
    const lh = Math.min(60 * S,Math.floor((H - y - 90 * S) / rowsMax));
    const fs = Math.floor(lh * 0.6);
    const hits = [];

    const fit = (text,weight,family,size,maxW,minScale) => {
      let s = size;
      g.font = font(weight,s,family);
      while (g.measureText(text).width > maxW && s > size * minScale) { s -= 1; g.font = font(weight,s,family); }
      let t = text;
      while (g.measureText(t).width > maxW && t.length > 4) t = t.slice(0,-2) + "…";
      return t;
    };

    const drawCol = (col,x0) => {
      let yy = y + lh;
      for (const [key,rows,meta] of col) {
        const head = meta ?? CATS[key];
        yy += Math.round(lh * 0.6);
        g.fillStyle = head.color;
        g.beginPath(); g.moveTo(x0,yy - fs * 0.75); g.lineTo(x0 + fs * 0.55,yy - fs * 0.4); g.lineTo(x0,yy - fs * 0.05); g.fill();
        g.font = font(700,fs * 1.1,display);
        g.fillText(head.label,x0 + fs * 0.85,yy);
        yy += lh;
        for (const [n,name,sub,id] of rows) {
          const textX = x0 + fs * 3.1;
          const room = x0 + colW - textX;
          g.fillStyle = head.color; g.font = font("",fs,mono);
          g.fillText(n,x0,yy);
          g.fillStyle = "#ece7f1";
          const nameText = fit(name.toUpperCase(),600,display,fs,room * 0.56,0.8);
          g.fillText(nameText,textX,yy);
          const nameW = g.measureText(nameText).width;
          if (sub) {
            g.fillStyle = "#8f8a9a";
            const subText = fit(sub,"",mono,fs * 0.72,room - nameW - fs * 0.8,0.75);
            g.fillText(subText,textX + nameW + fs * 0.6,yy);
          }
          if (id) hits.push({id,x0:x0 / S,y0:(yy - lh * 0.78) / S,x1:(x0 + colW) / S,y1:(yy + lh * 0.22) / S});
          yy += lh;
        }
        yy += Math.round(lh * 0.4);
      }
    };
    drawCol(left,pad);
    drawCol(right,pad + colW + gap);

    const blob = await new Promise(res => c.toBlob(res,"image/png"));
    return {blob,hits:hits.map(h => [h.id,Math.round(h.x0),Math.round(h.y0),Math.round(h.x1),Math.round(h.y1)])};
  }

  async function uploadKey(blob) {
    const FP = foundry.applications.apps.FilePicker.implementation;
    const source = typeof ForgeVTT !== "undefined" && ForgeVTT.usingTheForge ? "forgevtt" : "data";
    try { await FP.createDirectory(source,KEY_PATH,{}); } catch {}
    const file = new File([blob],KEY_FILE,{type:"image/png"});
    const res = await FP.upload(source,KEY_PATH,file,{},{notify:false});
    const path = res?.path ?? (KEY_PATH + "/" + KEY_FILE);
    return path + (path.includes("?") ? "&" : "?") + "v=" + Date.now();
  }

  // Widen the scene so the key fits inside it, right of the city image.
  // A v14 level background always stretches to the scene, so the image moves
  // to a locked tile at its own size on the left (every image coordinate
  // stays sceneX + x) and the level background becomes a plain dark colour.
  // Token vision and fog are off: it's a map to look at, not to explore.
  async function layoutScene(scene) {
    const width = IMG_W + KEY_GAP + KEY_W;
    const level = scene.levels?.contents?.[0] ?? null;
    const imageTile = scene.tiles.find(t => t.flags?.[FLAG]?.cityImage);
    const src = imageTile?.texture?.src ?? level?.background?.src ?? scene.background?.src;
    if (!src) throw new Error("The world map has no image.");
    if (scene.width !== width || scene.height !== IMG_H || scene.tokenVision || scene.fog?.exploration) {
      await scene.update({width,height:IMG_H,tokenVision:false,"fog.exploration":false});
    }
    const {sceneX:ox,sceneY:oy} = scene.dimensions;
    const data = {texture:{src},x:ox + IMG_W / 2,y:oy + IMG_H / 2,width:IMG_W,height:IMG_H,sort:-1000,locked:true,flags:{[FLAG]:{cityImage:true}}};
    if (imageTile) await imageTile.update(data);
    else await scene.createEmbeddedDocuments("Tile",[data]);
    if (level?.background?.src) await level.update({"background.src":null,"background.color":"#0b0b10"});
    return true;
  }

  // Key tile inside the scene, right of the image, the map's height.
  async function buildKey(scene) {
    const {sceneX:ox,sceneY:oy,sceneHeight:sh} = scene.dimensions;
    const {blob,hits} = await renderKey(sh);
    const src = await uploadKey(blob);
    // Tile x/y is the tile centre in v14.
    const data = {
      texture:{src},
      x:ox + IMG_W + KEY_GAP + KEY_W / 2,y:oy + sh / 2,width:KEY_W,height:sh,
      locked:true,
      flags:{[FLAG]:{cityKey:true,keyRows:hits}}
    };
    const old = scene.tiles.find(t => t.flags?.[FLAG]?.cityKey);
    if (old) await old.update(data);
    else await scene.createEmbeddedDocuments("Tile",[data]);
    return src;
  }

  // GM, run by hand: (re)build the guide journal, the pins, the district
  // labels and the key on the world map. Only this tool's own notes,
  // drawings and tile are replaced; job markers are left alone.
  async function build({scene=null,withKey=true}={}) {
    if (!game.user.isGM) throw new Error("GM only.");
    scene ??= worldScene();
    if (!scene) throw new Error(`No scene called "${SCENE_NAME}".`);
    if (!scene.flags?.[FLAG]?.cityMap) await scene.update({[`flags.${FLAG}.cityMap`]:true});
    await layoutScene(scene);
    const journal = await ensureJournal();
    // Image coordinates -> canvas coordinates (the scene pads the image).
    const {sceneX:ox,sceneY:oy} = scene.dimensions;
    const pageFor = new Map(journal.pages.map(pg => [pg.flags?.[FLAG]?.cityId,pg]));

    const mine = scene.notes.filter(n => n.flags?.[FLAG]?.cityId).map(n => n.id);
    if (mine.length) await scene.deleteEmbeddedDocuments("Note",mine);
    const notes = PLACES.map(p => {
      const c = CATS[p[3]];
      return {
        x:p[1] + ox + (p[0].startsWith("X") ? 0 : PIN_DX),y:p[2] + oy,
        entryId:journal.id,
        pageId:pageFor.get(p[0])?.id ?? null,
        text:label(p),
        texture:{src:c.icon,tint:c.color},
        iconSize:p[3] === "mega" ? 36 : 32,
        fontSize:22,
        textAnchor:CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        textColor:c.color,
        global:true,
        flags:{[FLAG]:{cityId:p[0]}}
      };
    });
    await scene.createEmbeddedDocuments("Note",notes);

    const oldDraw = scene.drawings.filter(d => d.flags?.[FLAG]?.cityDistrict).map(d => d.id);
    if (oldDraw.length) await scene.deleteEmbeddedDocuments("Drawing",oldDraw);
    const drawings = Object.entries(DISTRICTS).map(([name,d]) => ({
      x:d.at[0] - 300 + ox,y:d.at[1] - 40 + oy,
      shape:{type:"r",width:600,height:80},
      text:name.toUpperCase(),
      fontFamily:"Signika",
      fontSize:64,
      textColor:"#f3e600",
      textAlpha:0.9,
      fillType:CONST.DRAWING_FILL_TYPES.NONE,
      strokeWidth:0,
      strokeAlpha:0,
      flags:{[FLAG]:{cityDistrict:name}}
    }));
    await scene.createEmbeddedDocuments("Drawing",drawings);

    // Job markers move with the image if the scene was widened.
    for (const n of scene.notes.filter(n => n.flags?.[FLAG]?.cityJob)) {
      const job = globalThis.FEHA_JOBS?.read?.()?.jobs?.[n.flags[FLAG].cityJob];
      if (job) await setJobMarker(job);
    }

    let key = null;
    if (withKey) {
      try { key = await buildKey(scene); }
      catch (err) { console.warn("FEHA CITY // key failed",err); key = "failed: " + (err?.message ?? err); }
    }

    return {journal:journal.name,pages:journal.pages.size,notes:notes.length,districts:drawings.length,key};
  }

  // ------------------------------------------------------------ clicks

  // Clicking a line on the key jumps to that spot (everyone). The battle map
  // link at the top of a City Guide page opens the scene (GM) instead of the
  // scene's settings.
  function keyHit(point) {
    const scene = canvas?.scene;
    if (!scene?.flags?.[FLAG]?.cityMap) return null;
    const tile = scene.tiles.find(t => t.flags?.[FLAG]?.cityKey);
    const rows = tile?.flags?.[FLAG]?.keyRows;
    if (!tile || !rows?.length) return null;
    const left = tile.x - tile.width / 2, top = tile.y - tile.height / 2;
    const kx = (point.x - left) * (KEY_W / tile.width);
    const ky = (point.y - top) * (scene.dimensions.sceneHeight / tile.height);
    const row = rows.find(([,x0,y0,x1,y1]) => kx >= x0 && kx <= x1 && ky >= y0 && ky <= y1);
    return row?.[0] ?? null;
  }

  async function jumpTo(target) {
    const {sceneX:ox,sceneY:oy} = canvas.dimensions;
    let point;
    if (String(target).startsWith("district:")) {
      const d = DISTRICTS[String(target).slice(9)];
      if (!d) return;
      point = {x:d.at[0] + ox,y:d.at[1] + oy};
    } else {
      const p = byId.get(target);
      if (!p) return;
      point = {x:p[1] + ox + (p[0].startsWith("X") ? 0 : PIN_DX),y:p[2] + oy};
    }
    await canvas.animatePan({...point,scale:Math.max(canvas.stage.scale.x,0.8),duration:500});
    try { canvas.ping(point,{color:"#f3e600"}); } catch {}
  }

  const handlers = globalThis.__fehaCityHandlers ??= {};
  for (const [type,fn] of Object.entries(handlers)) document.removeEventListener(type,fn,true);
  // A press that moves more than a few pixels before the click is a drag
  // (panning or selecting), not a click on the key.
  let down = null;
  delete handlers.pointerdown;
  delete handlers.pointerup;
  handlers.mousedown = event => {
    down = event.button === 0 ? {x:event.clientX,y:event.clientY} : null;
  };
  handlers.click = async event => {
    const link = event.target?.closest?.(".feha-city-go a[data-uuid]");
    if (link) {
      event.preventDefault();
      event.stopPropagation();
      const scene = await fromUuid(link.dataset.uuid);
      if (scene?.documentName !== "Scene") return;
      if (game.user.isGM) return scene.view();
      ui.notifications.info("FIXER NET // Ask the GM to take you to " + scene.name + ".");
      return;
    }
    if (event.target?.id !== "board" || event.button !== 0) return;
    if (down && Math.hypot(event.clientX - down.x,event.clientY - down.y) > 6) return;
    try {
      const id = keyHit(canvas.canvasCoordinatesFromClient({x:event.clientX,y:event.clientY}));
      if (id) jumpTo(id);
    } catch (err) { console.warn("FEHA CITY // key click failed",err); }
  };
  for (const [type,fn] of Object.entries(handlers)) document.addEventListener(type,fn,true);

  const api = {VERSION,DISTRICTS,CATS,PLACES,place,placesIn,spotFor,worldScene,showOnMap,setJobMarker,clearJobMarker,build,renderKey,buildKey,layoutScene,jumpTo};
  globalThis.FEHA_CITY = api;
  try {
    game.adk ??= {};
    game.adk.city = api;
  } catch {}
})();
