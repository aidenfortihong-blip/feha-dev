# Text pass 0.11.91: what changed and why

Rules used: no tabletop words on screen (scene, actor, token); no developer names; one name per thing (quickhack, signature, local net, credits, operator); a label must describe what it sits on.

| Screen | Before | After |
|---|---|---|
| Cyberdeck | FEHA / ADK // 0.11.90 | ADK // BUILD 0.11.91 |
| Cyberdeck | SUBJECT | HANDLE |
| Cyberdeck | ACTIVE MEMORY | RAM AVAILABLE |
| Cyberdeck | N AVAILABLE | N NOT LOADED |
| Cyberdeck | OVER CAPACITY // N SOFTWARE PACKAGES MUST BE EJECTED | OVER CAPACITY // EJECT N QUICKHACKS |
| Cyberdeck | ASSIGN FROM SOFTWARE LIBRARY | LOAD FROM SOFTWARE LIBRARY |
| Cyberdeck | NO SUPPORT CHROME DETECTED | NO SUPPORT CHROME INSTALLED |
| Cyberdeck | NETWORK TELEMETRY / NEURAL BUS // LIVE ROUTING | SIGNAL PATH / OPERATOR TO LOCAL NET |
| Cyberdeck | SCENE LINK | LOCAL NET |
| Cyberdeck | SYSTEM READY / HARDWARE OFFLINE | DECK READY / NO DECK INSTALLED |
| Cyberdeck | NEURAL SCENE SWEEP | SCAN THE LOCAL NET |
| Cyberdeck | N LOADED // N RAM // SCENE SCAN | N QUICKHACKS LOADED // N RAM |
| JACKED IN | NOCTURNE // LIVE NEURAL SPACE | NOCTURNE // LOCAL NET // LIVE |
| JACKED IN | SCENE | LOCATION |
| JACKED IN | OPERATOR CORE | OPERATOR |
| JACKED IN | NO ACTOR SIGNATURES / No actor-backed tokens were found on the active scene. | NO SIGNATURES / Nothing on the local net is answering. |
| JACKED IN | DIRECT TRACE // WHEEL = ZOOM // RMB DRAG = PAN | NET MAP // SCROLL = ZOOM // RIGHT-DRAG = PAN |
| JACKED IN | N ACTORS // N CAMERAS | N SIGNATURES // N CAMERA FEEDS |
| JACKED IN | SELECT ACTOR | SELECT A SIGNATURE |
| JACKED IN | SELECT A TARGET NODE | NO TARGET LOCKED |
| JACKED IN | LOADED SOFTWARE / QUICKHACK EXECUTION | LOADED QUICKHACKS / READY TO UPLOAD |
| JACKED IN | EXECUTE / RUN | UPLOAD / RUN |
| Jack-in intro | ACTIVE SCENE SWEEP / SCANNING ACTOR SIGNATURES / BUILDING TABLETOP SCENE MATRIX | LOCAL NET SWEEP / SCANNING SIGNATURES / MAPPING THE LOCAL NET |
| Quickhack result | NO ACTOR DATA | NO TARGET DATA |
| Quickhack result | SECONDARY / SPLASH TARGETS REQUIRE SEPARATE GM ADJUDICATION. | SECONDARY TARGETS ARE RESOLVED BY THE GM. |
| Weapon sheet | ACTIVE ACTOR // NAME / NO ACTIVE ACTOR | SELECTED // NAME / NO ONE SELECTED |
| Weapon sheet | COMBAT LINK UNAVAILABLE | WEAPON NOT IN HAND |
| Weapon sheet | SELECTED ACTOR DOES NOT OWN THIS WEAPON | THIS WEAPON IS NOT YOURS |
| Weapon sheet | SELECT A TOKEN OR ASSIGN A CHARACTER | NO ONE IS HOLDING THIS WEAPON |
| Weapon sheet | Open an Actor-owned copy or select a token carrying this weapon. | Open this weapon from the inventory of whoever carries it. |
| Entry gateway | 04 RECORDS (fixed number) | real count of ID candidates |
| Market | Choose vendor clearance here... Trusted Players can browse the curated catalog at Observer access... | Set your vendor clearance, then pick a storefront. Higher clearance means the vendor will show you higher-grade stock. |
| Market | Body-slot chrome with direct installation and capacity checks. | Cyberware for every body slot, fitted by a licensed ripperdoc. |
| Market | Focused professional stock with manufacturer filtering. | Corporate-grade stock, sold direct by the manufacturers. |
| Market | Insufficient Eurodollars. / does not have enough Eurodollars. | Not enough credits. / does not have enough credits. |
| Chrome Manager | FEHA // AUGMENTATION CONTROL | ADK // AUGMENTATION CONTROL |

Market and Chrome Manager wording lives in the installed module, so `foundry/FEHA_UI_TEXT.js` swaps those labels on screen (exact-match map, display only). Add rows to its `EXACT` map to change more.

Left alone on purpose: the ADK and NOCTURNE brand names, Chrome Manager slot descriptions and telemetry (already coherent), quickhack and cyberware rules text, the old v2 cyberdeck markup in latest-dev.js (not shown any more), dead device CSS labels.
