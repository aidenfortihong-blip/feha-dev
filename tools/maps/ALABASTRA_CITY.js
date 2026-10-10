// FEHA // ALABASTRA CITY GUIDE
//
// Builds the city map legend on the "world map" scene (the NCART map the
// GM uploaded): one map pin per numbered spot, renamed for Alabastra, each
// opening a page in the journal "ALABASTRA — CITY GUIDE", plus district
// labels. Not loaded by the game: fetch + eval in the GM tab, then
// await ALABASTRA_CITY.build().
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

  // Night City district -> Alabastra district.
  const DISTRICTS = {
    "New Niemir":     {was:"Watson",            at:[2150,1290], blurb:"Refugee district: Sloviti families and other climate refugees in old megablocks. Curfews, CivCorp patrols and the 'drug epidemic' raids. Home of the crew."},
    "The Docks":      {was:"Northside / Arasaka Waterfront", at:[1640,1130], blurb:"Container yards, Kurohane's waterfront terminal and the warehouses where customs never looks. Carp-Line's turf."},
    "Orient Quarter": {was:"Japantown",         at:[2620,1980], blurb:"Neon markets, pachinko and the Yakuza family that runs out of the HQ tower."},
    "The Hills":      {was:"North Oak / Charter Hill", at:[3120,1650], blurb:"Gated estates, a casino and the Kurohane family estate, above the smog line."},
    "Corporate Plaza":{was:"City Center (Corpo Plaza)", at:[1980,2380], blurb:"The corporate towers and the Corporate Council Spire. CivCorp's general court and the Marble Vigil sit here."},
    "Downtown":       {was:"City Center (Downtown)", at:[2420,2560], blurb:"Old business district: clubs, broadcasters and money that hasn't made it to the towers yet."},
    "Old Capital":    {was:"Heywood",           at:[2230,3010], blurb:"Built on the ruins of the old capital. Government blocks turned slums, old money in the walled streets, CivCorp everywhere."},
    "Cinderline":     {was:"Santo Domingo",     at:[3060,2940], blurb:"The industrial belt that turns Cinder into power. Plants, rail yards and the workers' blocks that run them."},
    "Costa Morta":    {was:"Pacifica",          at:[1640,3830], blurb:"An abandoned resort coast the investors walked away from. Squats, gangs and a church that still feeds people."},
    "The Kennel":     {was:"Dogtown",           at:[1960,3600], blurb:"A walled-off zone inside Costa Morta run by its own boss. No CivCorp, no Council, no rules but his."},
    "The Barrens":    {was:"Badlands",          at:[3950,2150], blurb:"Desert outside the walls: nomad clans, trailer parks, oil and the Cinder wells."},
    "Naval Station":  {was:"NCX Spaceport",     at:[ 760,1880], blurb:"The Navy's island base. Fleet Admiral Fúlvio Rosa's power base, and a Vargas loyalist stronghold."}
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
    ["H2", 1724,2866,"mega","Seawall Stack","Old Capital","Overcrowded block on the old harbour wall. Its lifts haven't worked in years.","Apartment Complex"],
    ["H3", 2372,2742,"mega","Old Senate Block","Old Capital","The old capital's senate offices, cut up into flats after the government ran out of money.","Hotel Corridor"],
    ["H4", 2372,3159,"mega","Praça Block","Old Capital","Market square at the bottom, families stacked forty floors above it.","Apartment Complex"],
    ["H5", 2397,2444,"mega","Liberdade Stack","Downtown","Built in Vargas's time as 'housing for every worker'. Now a rent trap.","Apartment Complex"],
    ["H6", 2758,2717,"mega","Cinderline Block 6","Cinderline","Company housing for Cinder plant shifts. Rent comes out of wages before payday.","Basement Dwelling"],
    ["H7", 2882,2813,"mega","Cinderline Block 7","Cinderline","Block 6's twin. Its basement is where the plant's illegal union meets.","Basement"],
    ["H8", 2493,1820,"mega","Sakura Heights","Orient Quarter","Tower with Yakuza-run shops on its lower floors and a rooftop shrine.","Highrise Apartment"],
    ["H9", 2167,2050,"mega","Meridian Stack","Corporate Plaza","Apartments for corp contractors who can't afford the towers.","Condo"],
    ["H10",2096,1547,"mega","Zarya Block","New Niemir","Sloviti megablock with its own market, school and community kitchen.","Apartment Complex"],
    ["H11",2096,1167,"mega","Volna Block","New Niemir","Half-finished block taken over by refugee families after the developer left.","Squatters Court"],
    ["H12",1808, 860,"mega","Pristan Block","The Docks","Dockworkers' block in the shadow of the container cranes.","Apartment Complex"],

    // ------------------------------------------- hotels, camps, living
    ["01",3836,1018,"living","Wanderer Clan Camp","The Barrens","Nomad clan camp in the hills. Trades parts, fuel and favours.","The Nomad Camp"],
    ["02",1896,3164,"living","Batista's Rooms","Old Capital","Cheap rooms over a market. Batista asks no questions and remembers every face.","Rundown Hotel"],
    ["03",1446,3589,"living","Hotel Santa Sofia","Costa Morta","Half-built resort hotel on the dead coast, squatted floor by floor.","Rundown Hotel"],
    ["04",1674,1290,"living","Kurohane Plaza Hotel","The Docks","Kurohane-owned luxury hotel on the waterfront. Executive suites, perfect security.","The Koi Hotel"],
    ["05",2726,4900,"living","Las Palmeras Motel","The Barrens","Motel on the airport road. Truckers, smugglers and nobody else.","Wasteland Motel"],
    ["06",2224,1522,"living","No Questions Motel","New Niemir","Rooms by the hour in the middle of New Niemir.","Motel Room"],
    ["07",4730,2456,"living","Dustline Camp","The Barrens","The biggest nomad camp, on the far edge of the Barrens.","The Nomad Camp"],
    ["08",3494,2512,"living","Red Ridge Trailer Park","The Barrens","Trailer park where evicted Cinderline workers end up.","Trailer Park"],
    ["09",3756,2686,"living","Last Light Motel","The Barrens","Motel at the city limits. The last place before the desert.","Wasteland Motel"],
    ["11",2108,4226,"living","Tango Motel","The Barrens","Roadside motel south of the city, on the smugglers' route.","Wasteland Motel"],
    ["12",2348,2391,"living","Hotel Kasumi","Downtown","Discreet business hotel where deals get signed off the record.","Discreet Hotel Lobby"],

    // --------------------------------------------- bars, pubs and clubs
    ["13",1824,2276,"bar","The Ninth Circle","Corporate Plaza","Corpo club where junior execs burn their bonuses.","The Nightclub"],
    ["14",2454,2276,"bar","Dicey's","Downtown","Dance bar with rigged dice tables in the back room.","Small Dance Bar"],
    ["15",2194,2796,"bar","El Lobo Cojo","Old Capital","Old neighbourhood bar. Everyone knows everyone, and everyone owes someone.","Dive Bar"],
    ["16",2054,2854,"bar","El Gallo Flaco","Old Capital","Taco bar and message drop for the Old Capital's street crews.","Food Shack"],
    ["17",1806,2046,"bar","Voltage","Corporate Plaza","Neon club where corp kids buy what their parents banned.","Synth Club"],
    ["18",1904,2516,"bar","Cinders","Corporate Plaza","Upscale bar in a Council tower. Ms. Hale takes meetings here.","Cocktail Lounge"],
    ["19",1968,2074,"bar","Sympathy","Corporate Plaza","Quiet lounge with booths that block every signal. Dial Tone's drop point.","The VIP Lounge"],
    ["20",2010,3525,"bar","Iron Hearts Club","The Kennel","The Kennel's biggest club, where the boss's people spend his money.","Industrial Club"],
    ["21",2318,1516,"bar","The Red Crane","New Niemir","Yakuza-owned club on New Niemir's edge.","Viper Club"],
    ["22",2243,1394,"bar","Mila's","New Niemir","Sloviti bar with a back room for union meetings. Babka holds court here.","Basement Bar"],
    ["23",2038,3104,"bar","Steelrain","Old Capital","Metal bar for chromeheads and the people who fight them.","Dead Space Cyberpunk Bar"],
    ["24",2482,2790,"bar","Red Clay","Old Capital","Dockside dive where Clerk Seven sells warrants out of a corner booth.","Dive Bar"],
    ["25",1988,1700,"bar","The Picket Line","New Niemir","Workers' bar. Strike posters on the walls, a CivCorp informant at the bar.","Cyber Bar"],
    ["26",2184,1684,"bar","The Wake","New Niemir","Mercs' bar built into an old funeral hall. Every fixer in the city drinks here.","Cocktail Bar"],
    ["27",2522,2690,"bar","The Last Stand","Downtown","Veterans' bar. Navy loyalists, old soldiers and Vargas portraits.","Pool Bar"],
    ["28",1566,3703,"bar","The Lantern","Costa Morta","Beach bar in a dead resort, lit by stolen Cinder.","Food Shack"],
    ["29",1938,1052,"bar","Totenhaus","The Docks","Gang bar by the docks. Don't go in without an invitation.","Booster Basement"],

    // -------------------------------------------------- shops & markets
    ["30",2384,2628,"shop","Vektor Outlet","Downtown","Vektor Dynamics' official gun store. Medium everything, warranty included.","Gunstore"],
    ["31",1856,2804,"shop","Vektor Outlet","Old Capital","Vektor Dynamics store behind steel shutters.","Gunstore"],
    ["32",1560,3558,"shop","Vektor Outlet","Costa Morta","Vektor's last store on the dead coast, guarded day and night.","Gunstore"],
    ["33",2213,1572,"shop","Vektor Outlet","New Niemir","Vektor store whose prices are a week's wages for a New Niemir family.","Gunstore"],
    ["34",1910,3218,"shop","Batista's Market","Old Capital","Market under Batista's Rooms. Anything for sale, eventually.","Market Stalls"],
    ["35",2504,1740,"shop","Sakura Night Market","Orient Quarter","Night market under the Yakuza's protection. Kiyama has a table at the back.","Market Stalls"],
    ["36",1946, 892,"shop","Dead Ringer Clothing","The Docks","Second-hand clothes, some of them still warm.","Street Clothier"],
    ["37",2072,3423,"shop","Kennel Market","The Kennel","Black market inside the Kennel walls. Military surplus and worse.","Guns Marketplace"],
    ["38",2338,1134,"shop","True Aim Firearms","New Niemir","Gun shop with a basement range and no paperwork.","Gunstore"],
    ["39",1831, 760,"shop","Pier 9 Market","The Docks","Dockside market for things that fell off ships. Carp-Line's office is above it.","Market Stalls"],
    ["40",1860,2216,"shop","Shirogane Tailors","Corporate Plaza","Corp tailoring. Armour woven into the lining.","Bespoke Tailor Shop"],
    ["41",2234,1134,"shop","Niemir Bazaar","New Niemir","The district's main market: food, parts, pickles and gossip.","Market Stalls"],
    ["42",1676,3713,"shop","Stacks Market","Costa Morta","Market in shipping containers stacked on the beach.","Cyber Market"],
    ["43",1908,2152,"shop","Iron Psalm Records","Corporate Plaza","Record shop that sells banned music to people with money.","Music Store"],
    ["44",3198,3437,"shop","Dam Market","Cinderline","Market at the dam road, for plant workers coming off shift.","Market Stalls"],
    ["45",2640,1460,"shop","Jade Arc Showroom","Orient Quarter","Jade Arc Systems' energy weapons, behind bulletproof glass.","Guns Marketplace"],
    ["46",2336,3103,"shop","Cinderline Market","Old Capital","Market on the line between the Old Capital and Cinderline.","Ghetto Markets"],
    ["47",3018,3044,"shop","Sleek Threads","Cinderline","Clothes shop for workers who want to look like corpos for one night.","Street Clothier"],
    ["48",2051,1330,"shop","Sleek Threads","New Niemir","Sleek Threads' New Niemir branch.","Street Clothier"],
    ["48b",1586,2590,"shop","Sleek Threads","Corporate Plaza","Sleek Threads' flagship on the plaza.","Corpo Attire"],
    ["49",1876,2572,"shop","Rewind Records","Corporate Plaza","Music and braindance shop. Old recordings in the back, new ones by request.","Music Store"],

    // ------------------------------------------------------- ripperdocs
    ["50",2290,1078,"ripper","Kowal Clinic","New Niemir","Sloviti ripperdoc who fixes refugees for free on Sundays.","Ripperdoc Clinic"],
    ["51",1570,2034,"ripper","Council Implants","Corporate Plaza","Corp clinic: clean, licensed and tracked by CivCorp.","Cybernetics Boutique Clinic & Spa"],
    ["52",1566,3754,"ripper","Costa Clinic","Costa Morta","Beach shack ripperdoc. Cheap, fast, unsterile.","Ripperdoc - Back-Alley Bazaar"],
    ["53",1969, 952,"ripper","Doc Rydel","The Docks","Dockside ripperdoc who patches up anyone who pays.","Ripperdoc Clinic"],
    ["54",2301,1194,"ripper","Dr. Nickel","New Niemir","Chrome dealer and ripperdoc in a back alley off the bazaar.","Ripperdoc - Back-Alley Bazaar"],
    ["55",2676,1812,"ripper","Thumbs' Clinic","Orient Quarter","Yakuza ripperdoc. Discreet, and he reports to Kiyama.","Ripperdoc Clinic"],
    ["56",2318,1460,"ripper","Insta-Chrome","New Niemir","Walk-in implant chain. Payment plans, remote repossession.","Body Augments"],
    ["57",2858,2276,"ripper","Novak's Clinic","The Hills","Private clinic for people who can afford discretion.","Cybernetics Boutique Clinic & Spa"],
    ["58",3302,3437,"ripper","Otávio's Clinic","Cinderline","Treats plant injuries the company insurance won't cover.","Ripperdoc Clinic"],
    ["59",2052,1600,"ripper","Bogdan's Clinic","New Niemir","Old ripperdoc everyone in New Niemir trusts. Knows the crew's families.","Ripperdoc Clinic"],
    ["60",1594,2752,"ripper","Springside Doc","Old Capital","Ripperdoc in a flooded basement. Waders recommended.","Ripperdoc Clinic"],
    ["61",1560,3611,"ripper","Seawind Ripper","Costa Morta","Coastal ripperdoc who buys chrome off corpses and doesn't ask whose.","Ripperdoc - Back-Alley Bazaar"],
    ["62",1992,3619,"ripper","Refuge Clinic","The Kennel","The Kennel's only clinic, under the boss's protection.","Medical Ward"],

    // -------------------------------------------------------- landmarks
    ["63",3142,1522,"land","Kurohane Estate","The Hills","The Kurohane family estate. Gardens, guards and old money.","Sky Mansion Gardens"],
    ["64",1452, 926,"land","Kurohane Waterfront Terminal","The Docks","Kurohane's private port. Its cargo goes through no customs.","The Container Port"],
    ["65",1366,4388,"land","Helix Vitae Protein Flats","The Barrens","Miles of protein farms that feed the city. Striking here is illegal.","Protein Farms"],
    ["66",2966,1926,"land","Hall of Ashes","The Hills","Columbarium for the city's dead. The poor rent their niches by the year.","Cyberpunk Church"],
    ["67",1632,3389,"land","Vargas Grand Mall","Costa Morta","Sancho Vargas's showcase mall, abandoned when he fell.","Horizon Shopping Mall"],
    ["68",2642,1760,"land","Lantern Row","Orient Quarter","Red-light street under Yakuza protection.","Red Light District"],
    ["69",3474,3941,"land","Ninfa Reservoir","The Barrens","The city's water. Whoever controls the dam controls New Niemir's taps.","Water Dam"],
    ["70",1100,2042,"land","Alabastra Naval Station","Naval Station","Navy base on its own island. Admiral Rosa's fleet answers to him first.","Flight Deck"],
    ["71",3720,3321,"land","The Heap","The Barrens","The city landfill. Scavengers, chrome strippers and bodies.","Garbage Dump"],
    ["72",4510,3252,"land","Dustline Rail Station","The Barrens","Freight rail stop the nomads use to move cargo in and out.","Train Repair Yard"],
    ["73",3414,1408,"land","Hillcrest Casino","The Hills","Council members' casino in the hills.","Casino"],
    ["74",1945, 100,"land","Jade Arc Proving Grounds","The Barrens","Jade Arc Systems' weapons range in the northern wastes. Keep out.","Assault Base Alpha"],
    ["75",2047,5016,"land","Alabastra Regional Airport","The Barrens","The city's airport. Every flight checked by CivCorp.","Airdock 6 - Landing platform"],
    ["76",2766,3706,"land","Cinder Collector Array","Cinderline","The dishes that pull the Cinder in. Everything in the city runs on it.","Pump Control"],
    ["77",1653,3901,"land","CivCorp Correctional Facility 4","Costa Morta","Private prison in a dead resort. Its 'drug epidemic' arrests make CivCorp record profits.","Prison Facility"],
    ["78",1850,3510,"land","The Black Pearl","The Kennel","The Kennel boss's tower-top club. Invitation only.","The VIP Lounge"],
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
    ["X5",2180,2250,"crew","Kurohane Academy","Corporate Plaza","Kurohane's academy for gifted youth. Zach's old school.","Corporate Atrium"],
    ["X6",1760,2420,"crew","CivCorp Plaza & General Court","Corporate Plaza","CivCorp's headquarters and the general court it sponsors. Marble Vigil command is on the top floors.","Court"]
  ];

  // Flags are read directly: "fleshEnshrouded" is not a registered flag scope,
  // so getFlag() throws on it (FEHA writes it through update/create only).
  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const label = p => (p[0].startsWith("X") ? "" : p[0].replace(/^0/,"").replace(/b$/,"") + " · ") + p[4];

  function sceneLink(name) {
    if (!name) return "";
    const lower = name.toLowerCase();
    const scene = game.scenes.find(s => s.name === name) ?? game.scenes.find(s => s.name.toLowerCase().startsWith(lower));
    return scene ? `@UUID[${scene.uuid}]{${esc(scene.name)}}` : esc(name);
  }

  function pageHtml(p) {
    const [, , , cat, name, district, blurb, map] = p;
    const d = DISTRICTS[district];
    return `<p><strong>${esc(CATS[cat].label)}</strong> · ${esc(district)}${d ? ` <em>(${esc(d.was)})</em>` : ""}</p>
<p>${esc(blurb)}</p>
<p><strong>Battle map:</strong> ${sceneLink(map)}</p>`;
  }

  function legendHtml() {
    const groups = Object.entries(CATS).map(([key,c]) => {
      const rows = PLACES.filter(p => p[3] === key).map(p => `<li><strong>${esc(p[0].replace(/b$/,""))}</strong> ${esc(p[4])} <em>(${esc(p[5])})</em></li>`).join("");
      return `<h3 style="color:${c.color}">${esc(c.label)}</h3><ul>${rows}</ul>`;
    }).join("");
    const districts = Object.entries(DISTRICTS).map(([name,d]) => `<li><strong>${esc(name)}</strong> <em>(${esc(d.was)})</em>: ${esc(d.blurb)}</li>`).join("");
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

    const byId = new Map(journal.pages.map(pg => [pg.flags?.[FLAG]?.cityId,pg]));
    const create = [], update = [];
    for (const data of pages) {
      const existing = byId.get(data.flags[FLAG].cityId);
      if (existing) update.push({_id:existing.id,name:data.name,"text.content":data.text.content,sort:data.sort});
      else create.push(data);
    }
    if (create.length) await journal.createEmbeddedDocuments("JournalEntryPage",create);
    if (update.length) await journal.updateEmbeddedDocuments("JournalEntryPage",update);
    return journal;
  }

  async function build({scene=null}={}) {
    if (!game.user.isGM) throw new Error("GM only.");
    scene ??= game.scenes.find(s => s.name.toLowerCase() === SCENE_NAME);
    if (!scene) throw new Error(`No scene called "${SCENE_NAME}".`);
    const journal = await ensureJournal();
    const pageFor = new Map(journal.pages.map(pg => [pg.flags?.[FLAG]?.cityId,pg]));

    // Notes: one per place, replacing this tool's own notes only.
    const mine = scene.notes.filter(n => n.flags?.[FLAG]?.cityId).map(n => n.id);
    if (mine.length) await scene.deleteEmbeddedDocuments("Note",mine);
    const notes = PLACES.map(p => {
      const c = CATS[p[3]];
      return {
        x:p[1],y:p[2],
        entryId:journal.id,
        pageId:pageFor.get(p[0])?.id ?? null,
        text:label(p),
        texture:{src:c.icon,tint:c.color},
        iconSize:p[3] === "mega" ? 44 : 40,
        fontSize:22,
        textAnchor:CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        textColor:c.color,
        global:true,
        flags:{[FLAG]:{cityId:p[0]}}
      };
    });
    await scene.createEmbeddedDocuments("Note",notes);

    // District names as text drawings, replacing this tool's own.
    const oldDraw = scene.drawings.filter(d => d.flags?.[FLAG]?.cityDistrict).map(d => d.id);
    if (oldDraw.length) await scene.deleteEmbeddedDocuments("Drawing",oldDraw);
    const drawings = Object.entries(DISTRICTS).map(([name,d]) => ({
      x:d.at[0] - 300,y:d.at[1] - 40,
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

    return {journal:journal.name,pages:journal.pages.size,notes:notes.length,districts:drawings.length};
  }

  globalThis.ALABASTRA_CITY = {VERSION,DISTRICTS,CATS,PLACES,build};
})();
