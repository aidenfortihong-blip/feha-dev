# Walling FEHA maps

How Claude walls a map, every time the same way. The GM can also wall by hand in
Foundry; the labels below keep track of both.

## Labels (Scenes tab, GM only)

`foundry/FEHA_SCENE_WALL_STATUS.js` puts a tag on every map and a row of filter
buttons above the list. The state lives on the scene in
`flags.fleshEnshrouded.wallStatus`; scenes without one are read from their walls.

| Tag | Meaning | Next step |
| --- | --- | --- |
| WALLED | Rooms, walls between rooms and doors done and checked | nothing |
| OPEN | Needs no walls (outdoor, rooftop, backdrop, Net) | nothing |
| PACK | The map pack's own walls, restored, never checked | check, redo if wrong |
| BORDER | Only the outer edge, traced automatically | wall the rooms |
| GM EDIT | The GM drew walls by hand | leave to the GM unless asked |
| NO WALLS | Nothing yet | wall it |

Click a tag to set WALLED, OPEN or NO WALLS by hand, or AUTO to let the walls
decide again. Drawing a wall by hand on a NO WALLS / BORDER / PACK map turns it
into GM EDIT.

## The rule

- Outline every room, including the walls between rooms.
- Outer walls sit on the outer edge of the drawn wall so players see the wall
  art; walls between rooms run down the middle of the drawn wall.
- A door on every drawn door (Nebula: a small "][" glyph, a green or teal panel,
  a gate box across the wall). A building entrance at the map edge gets a door.
- A wide opening with no door drawn (loading bay, archway) stays open.
- Nothing inside rooms: no furniture, pillars, crates, stalls, stray lines.
- Outdoor maps with no rooms (streets, plazas, rooftops, parks, docks) are OPEN.
  Daylight maps get no lights.
- Lights only on real fixtures, coloured like the fixture (alpha 0.08, at most
  6 squares). A proposal without `lights` keeps the lights already there.

## Method (one map at a time, GM tab)

1. Load the tool: fetch and eval `tools/maps/FEHA_HAND_WALLER.js` from the
   branch or commit on raw.githubusercontent.com. It defines `HW`.
2. `HW.report()` for the counts, `await HW.next()` for the next map (Nebula
   first, then CAMPAIGN, then the rest; NO WALLS before BORDER before PACK).
3. `HW.view(id)` for the whole map: decide OPEN or rooms.
   - OPEN: `HW.prop[id] = {walls:[],doors:[],note:"why"}` then
     `await HW.commit(id,{state:"open"})`. Done.
4. Read the walls in crops of about 10 squares a side (`HW.tiles(id)` lists
   them). Read coordinates off the yellow percent labels: take two labels on
   each axis and interpolate. In a browser batch put a tiny `zoom` before each
   `screenshot`, or the frame is stale.
5. Write `HW.prop[id] = {walls,doors,note}` in percent:
   - one polyline per run of wall, breaking it where a door or an opening is;
   - doors as `[x0,y0,x1,y1]` across the gap.
6. `HW.tidy(id)` (squares lines, joins corners), then `HW.check(id)`:
   - every `loose` end must be an opening you meant; put those in
     `HW.prop[id].open` so the check comes back clean;
   - `doorsHanging` and `tiny` must be 0.
7. `HW.view(id,[...])` on the whole map: magenta walls must sit on the drawn
   walls, green doors on the doors, white rings only at real openings.
8. `await HW.commit(id,{state:"done"})`, then `HW.verify(id)` to see what is
   really on the scene. Wrong? `await HW.undo(id)` puts the old walls back.
9. Pack walls: `commit(id,{state:"done",replace:true})` removes the old walls
   (they are kept on the scene for `undo`, and in the journal
   "FEHA Wall Backup 2026-10-02").

## Tracing (HW.auto)

`HW.auto(id,opts)` (needs `FEHA_MAP_WALLER.js`) traces the outside of the map;
then `HW.simplify(id)` joins and straightens it. Always check it by eye.

- Black surround: `{dark:8}`. Dark grey wall masses: `{dark:24,open:2,minArea:0.001}`.
  Thin black wall lines on a grey street: `{dark:22,open:1,minArea:0.0008}`.
- Outside by colour with `opts.test(r,g,b)`: space `sat>0.45 && b>g*1.35`
  (or max<22); earth `r>g*1.15 && g>b*1.1 && r>60`.
- It traces dark furniture and pits too: drop those chains (small boxes inside
  rooms) and anything off the building. Thin coloured room walls are not traced:
  add them by hand.
- A doorway the tracer closed: `HW.door(id,line)` cuts it when the traced wall
  lies along the line; otherwise add the wall pieces and the door by hand.

## Calls made on the Nebula pass (2026-10-07)

- Open-air maps (streets, plazas, platforms on water, landing pads, tower tops,
  catwalk factories) are OPEN: edges are drops, not walls.
- One-hall maps (engine room, prison ward, server hall, cargo corridor) get the
  outer walls only; machines, racks, crates and railings are not walls.
- Glass window walls and cell fronts are bars (`bars`: block movement only).
- Coloured ticks on Nebula walls are lights, not doors. Where a room has no drawn
  door, one door goes where it meets the main room so it can be reached.
- Screenshots in the browser pane can lag a step: take a second one before judging.
