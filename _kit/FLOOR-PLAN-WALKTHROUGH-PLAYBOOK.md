# Floor Plan to 3D Walkthrough: Playbook

For an architect's practice with many clients. This file tells Claude Code how to turn any client's floor plans into an editable plan, a 3D walkthrough, a single HTML file, a shareable link and, optionally, video clips. It holds the folder layout, the prompt to give, the standing preferences, the build specification, the checks, the mistakes to avoid, and every instruction from the first project, word for word.

First written 13 November 2026 from the project in `D:\Arch` (one client, first floor only). Revised the same day for many clients, any number of floors, and a tour path planned afresh for each plan. Revised 17 November 2026 after the same client's ground floor was added: the kit now handles two floors, a time-of-day slider, a Start Tour with room labels and code-made music, and a stair that runs past the first floor to the roof.

---

## 1. Folder layout

One practice folder, one kit that is reused, one folder per client.

```
Raj Architect\
  _kit\                                   reused for every client; never holds client work
    FLOOR-PLAN-WALKTHROUGH-PLAYBOOK.md    this file
    walkthrough-template\                 the editor, 3D code, save server and build script
  <Client name>\
    plans\                                the floor plans as received: one file per floor,
                                          or one file with several floors
    walkthrough\                          a copy of the template, filled in for this client
    <client>-walkthrough.html             the single file to send or publish
  <Next client>\
    ...
```

Rules for Claude:
- **Never edit `_kit` while working on a client.** Copy `walkthrough-template` into the client's folder and work there.
- **Improvements that would help every client go back into `_kit`** at the end of the job (a better editor, multi-floor support, a new furniture piece), with the client's own plan data taken out. Say what was added.
- **Nothing of one client's goes into another client's folder.** The template carries the first project's layout only as a worked example; replace it, never ship it.
- If `_kit` is missing, rebuild from section 7 and create it.

How to start a job: put the plans in `<Client name>\plans\`, give Claude Code access to `Raj Architect`, and say: **"Read `_kit\FLOOR-PLAN-WALKTHROUGH-PLAYBOOK.md` and follow it for the client `<Client name>`."**

---

## 2. What you get for each client

1. **A reading of every floor**: each room with its size, every door, window, stair and pillar, the wall height used, and a list of anything unclear.
2. **A plan editor**: click any wall, window, door, pillar, wardrobe, terrace, balcony or double-height opening to move, resize, edit or delete it. Changes are saved into the client's plan file.
3. **A 3D walkthrough**: a guided tour planned for this home, first-person walking with W A S D and the mouse, room captions, a small map, a dollhouse view with the roof off, and a one-click switch between three interior styles.
4. **One HTML file** that contains all of it.
5. **A shareable link**.
6. **Optional video clips** made with Higgsfield from stills of the walkthrough.

---

## 3. Floors: basement, ground, first, or several

The first project had one floor. Others will not.

- **Read every floor supplied** and name each by its level: basement, ground, first, second, terrace. Record floor-to-floor heights; ask if the drawings don't give them.
- **Line the floors up.** Use stairs, lift shafts, columns and outer walls to place each floor exactly above the one below. Report any that don't line up.
- **One home, not separate models.** All floors sit in one 3D model at their real levels, joined by the stairs as drawn, so a viewer can walk up and down.
- **Double-height spaces** are a hole in the upper floor over a real room below. With both floors supplied, the room below is the real one, never a placeholder.
- **Editor**: one tab per floor, with the floor below shown faintly underneath for alignment.
- **Dollhouse view**: a button per floor that lifts off everything above it.
- **Captions and map** show the floor name along with the room.
- **If only some floors are supplied**, say which are missing, build what is there, and mark anything invented (for example a plain room under a void) as a placeholder.

State of the kit (17 Nov 2026): `walkthrough-template` handles **a ground floor and a first floor**.

- Each floor has its own plan file: `js/plan-data.js` (first floor, `window.PLAN_DATA`) and `js/plan-data-ground.js` (ground floor, `window.PLAN_DATA_GROUND`). Same format; ground-floor heights are measured from the ground-floor finish, and `"PORCH"` means the car-porch level 1'-6" below it. A home without a ground-floor drawing simply has no `plan-data-ground.js`, and a plain placeholder room is shown under the void.
- The editor has a tab per floor (`editor.html` and `editor.html?floor=ground`), each saving to its own file through `serve.py`, with the other floor's walls shown in pale blue on request and the client's drawing for that floor (`debug/plan.png`, `debug/plan-ground.png`) as an underlay.
- Ground-floor rooms are furnished in `js/furniture-ground.js` with the same kit as the first floor, so all three styles carry through.
- The dollhouse has Ground floor / First floor buttons; the ground-floor view lifts the whole first floor away.
- Pillars that run through both floors (porch columns, for example) must sit at the same X/Y in both plan files; if one is moved in the editor, move the other to match.
- A basement or a second floor is still to be added the same way: one more plan file, one more editor tab, one more dollhouse button.

---

## 4. The tour path is planned for each home

Never reuse a path from another project. The route in the template belongs to the first project only and must be replaced.

- **Start at the main door** whenever the plans show one. If no entrance is on the supplied floors, start where a visitor would arrive (top or foot of the main stair) and say so.
- **Order the rooms the way a buyer would be shown the home**: entrance and living spaces first, then dining and kitchen, then outdoor spaces off them, then private rooms (bedrooms, dressing, bathrooms), finishing on the best view. For several floors, finish one floor before taking the stair to the next.
- **Work the route out from the plan**: which rooms connect through which doors. Every room is visited or at least looked into; no room is skipped silently.
- **Choose each stop for the view**: stand where the room reads best, face its main feature (window, bed wall, counter), and avoid standing behind an open door, a railing or tall furniture.
- **Show the route for approval** as a numbered list of stops before building it, then confirm it with the collision check in section 8.
- **Replan after layout changes.** When walls or doors move in the editor, the route is rechecked and redrawn where needed.

---

## 5. The prompt to give

Paste this as the first message for a new client.

> You're an architectural visualizer who makes 3D home tours for my architecture practice. Read `_kit\FLOOR-PLAN-WALKTHROUGH-PLAYBOOK.md`, then the floor plans in `<Client name>\plans\`.
>
> First read every floor carefully: list every room with its size, every door, window, stair and pillar, and the wall heights you'll use. Point out anything unclear, then ask me only what the playbook has not already settled.
>
> Then build it in `<Client name>\walkthrough\` from the kit:
> - A floor plan editor where every wall, window, door, pillar, wardrobe, terrace, balcony and double-height area is clickable to edit, delete and resize, on every floor, and whose saved plan is what the 3D view uses.
> - One HTML file with Three.js that matches the plans exactly: walls, doors, windows and room sizes to scale, all floors joined by their stairs. Real-looking floors, walls and ceilings, furniture that fits each room, and soft daylight through the windows.
> - First-person walking with W A S D and the mouse, a guided tour planned for this home starting at the main door, and a dollhouse view with the roof off on one button.
> - Furnish every room the way a high-end interior designer would for a listing: rugs, art, plants, lamps, a set dining table, made beds, kitchen details. Wood grain, stone counters, soft fabric.
> - A style switch for Modern, Scandinavian and Warm luxury, one click each.
> - It must run smoothly on a laptop with Intel integrated graphics.
>
> When I change the plan in the editor, refit the furniture, wall paintings, wardrobes and tour to the new walls. Finish with a shareable link.

---

## 6. Which model and tools

### Track A: Claude Fable 5.2 with the Higgsfield connector
Claude Code does all of the work itself.
1. Give the prompt in section 5.
2. Claude builds the editor, walkthrough, single file and link, following sections 3, 4, 7 and 8.
3. **Video with Higgsfield**, after the walkthrough is approved:
   - Claude captures a still at each tour stop and uploads the stills to Higgsfield.
   - Claude generates a short clip per room from each still, showing the cost first and waiting for a yes, because clips use Higgsfield credits.
   - Check each clip against the plan. Higgsfield generates the footage, so it can change furniture, proportions or openings. The walkthrough stays the accurate record.
4. If the Higgsfield tools are missing at the start, say "check the Higgsfield connector"; it can take one turn to finish connecting.

Not yet done on any project: the first session connected Higgsfield but never generated a clip.

### Track B: Claude Opus in Claude Code, without Higgsfield
"Opus ultracode" in the original request is read as Claude Opus running in Claude Code. Give these one at a time and check each result before the next.
1. `Read _kit\FLOOR-PLAN-WALKTHROUGH-PLAYBOOK.md and the plans in <Client name>\plans\. List every room on every floor with its size, every door, window, stair and pillar, and the wall heights. Point out anything unclear. Don't write code yet.`
2. `Copy _kit\walkthrough-template to <Client name>\walkthrough. Put the plans into its plan data, one entry per floor. Show me a top view of each floor laid over its drawing so I can check it.`
3. `Start the plan editor and save server. Confirm that a change in the editor is written to the plan file.`
4. `Build the 3D shell from the plan: walls with openings, floors, ceilings, stairs between floors, railings. Check it against the drawings again.`
5. `Add materials, daylight, the three styles and the style switch.`
6. `Furnish every room for a listing, sized to the rooms. Add wardrobes from the plan.`
7. `Propose the tour route for this home as a numbered list, starting at the main door. After I approve it, build the tour, W A S D and mouse walking, captions, the map and the dollhouse buttons. Run the tour check until it reports no collisions.`
8. `Make it smooth on Intel integrated graphics using the three measures in the playbook.`
9. `Run build.py to make the single HTML file, then publish a shareable link.`
10. Optional: `/code-review ultra` for a deep review of the code. You start this yourself; it is billed.

No video step on this track. Record the guided tour with a screen recorder if a video is needed.

---

### Blender, for better furniture models (set up 17 Nov 2026)

There is no Blender connector in the Claude connector directory, so Claude Code drives Blender directly from the command line. Blender 5.3.0 (the official portable ZIP from download.blender.org, checksum verified) is unpacked at `D:\Apps\blender-5.3.0-windows-x64`. On another PC, download the same ZIP from blender.org (ask the architect first) and unpack it outside the client folders.

- `walkthrough/blender/make_furniture.py` builds the soft furnishings and fittings and writes `js/models-data.js`:

  ```
  "D:\Apps\blender-5.3.0-windows-x64\blender.exe" --background --factory-startup --python walkthrough\blender\make_furniture.py -- walkthrough\js\models-data.js
  ```

  It takes about 15 seconds.
- **What Blender makes:**
  - seat and back cushions with piping
  - throw pillows and bed pillows with pinched corners
  - a duvet and a runner, draped over the mattress by cloth simulation (one set for a double bed, one for a single)
  - two potted plants with real leaves
  - turned lamp shades, a table-lamp base and a pendant dome
  - interior pieces: track-arm and tuxedo sofas (3-seat, 2-seat, armchair), an armless lounge chair, four beds (channel-tufted, wingback, panel, arched single), an upholstered dining chair, a racetrack dining table on turned pedestals, round and rectangular coffee tables, a side table, a nightstand, a reeded sideboard, a bed bench, and decor (two vases, a bowl, a book stack, candles). Split by role (body, cushion, leg, head, base, top, front, pull...) so each room paints them in its own palette.
  - the name plate: `make_furniture.py -- <out models-data.js> "<Home name>"` sets the lettering.
  - curtains: a pleated drape (stretched to each panel and drop), a rod, a ball finial and a wall bracket.
- `walkthrough/blender/make_wallpaper.py` turns a wallpaper image into a print for one wall, written to `js/wallpaper-data.js` (built into the single file):

  ```
  blender.exe --background --factory-startup --python walkthrough\blender\make_wallpaper.py -- <image> walkthrough\js\wallpaper-data.js <name> <wall width / height> [rotate|repeat]
  ```

  `rotate` turns a landscape design upright and trims it equally to the wall's proportions (one print, nothing stretched); `repeat` runs it across the wall and repeats it down, every other repeat mirrored so no seam shows. Use full paths: Blender does not see paths relative to the shell. For Manglam Vila the source is `walkthrough/blender/wallpaper/void-south.jpg`, hung on the double-height south wall beside the main stair (`void-south`, ratio 0.5911, rotate), in place of the stone cladding there. The same script makes carpets: `rug-hall.jpg` (`rug-hall`, the image's own ratio 1.3953, repeat = one print) is the carpet under the ground-floor hall sofa, 8'-5" across and as deep as its proportions allow (`printMat` in `furniture.js`). Each run keeps the other prints in the file and replaces only its own.
  - fittings: railing parts (a chamfered post, a pyramid post cap, a round baluster bar, a handrail with a rounded top) and a 4" skirting with a rounded top edge. Each is one foot long (or high); the walkthrough stretches it along each railing run and each wall (`piece()` in `shell.js`), so a few dozen triangles serve the whole house.
- **Styles:** each model is split by role (fabric, piping, pot, leaf, shade...), and the walkthrough paints each role with the current style's material, so the same models serve all three styles.
- **Loading:** `js/models.js` loads the models. `furniture.js` uses them through `soft()`, `bedding()`, `plant()` and the lamp functions, and falls back to plain shapes if `models-data.js` is missing.
- **Fabric:** every fabric material also gets a fine woven texture.
- **The Blender connector:** the Claude extension "Blender" (Blender Lab) needs Blender running with its add-on. On a PC with Windows Smart App Control turned on, the extension cannot start (its own Python is unsigned and blocked, os error 4551), while Blender itself runs, being signed. Drive Blender from the command line as above; leave Smart App Control to the architect.
- **The Manglam Vila PC (17 Nov 2026):** Blender 5.3.0 installed at the same path, `D:\Apps\blender-5.3.0-windows-x64`; it is not on PATH, so call `blender.exe` by its full path.
- **Keep it light:** about 1,000 triangles per cushion and about 5,000 per bedding set. After any change to the models, measure a frame in the busiest views (street, hall, bedroom). On the practice PC the target is under about 10 ms at 1.25× resolution.

## 7. Preferences and decisions

**Apply to every client without asking:**

| Matter | Preference |
|---|---|
| Output | Browser walkthrough, not a rendered video |
| Process | Build straight after the reading is approved; no written spec first |
| Styles | All three: Modern, Scandinavian, Warm luxury. Each style changes the furniture shapes, light fittings, wall hangings, accessories and hardware, not only colours |
| Layout source | Always the plan editor's saved file |
| After the plan is edited | Refit furniture, wall paintings, wardrobes and tour |
| Sharing | Publish a shareable link; republish to the same link after changes |
| Extras | Don't add tall units, fridges or similar in front of counters without asking |

**Ask for every client; these were answers for the first client only:**

| Matter | First client's answer |
|---|---|
| Ceiling height | 11 feet |
| Where the tour starts when no main door is drawn | At the stairs |
| A stair that was removed and its space reassigned | That plan only |
| Fridge in the kitchen | None |
| Floor finish | The living room's tile through the whole house, bedrooms and toilets included |
| Skirting | 4" on every wall, in the floor's own material |
| Railing on balconies and terraces | Chosen per balcony and per parapet in the editor; jaali where not chosen |
| Doors and windows | One colour together; all furniture in other colours |
| Furniture | Calm, elegant palettes (no bright sofa or bed sets); every room its own design |
| Paintings | Every painting different |
| Name plate | "Manglam Vila" on the gate pier (`g-front-pier`) |

**Assumed when a drawing is silent**, stated in the reading for correction: 7' door and window heads, 3' window sills (2'-6" in living rooms and bedrooms), 3'-6" railings, 5" slabs, 9" outer and 4½" inner walls.

---

## 8. Build specification and checks

**Coordinates.** Feet. X to the right of the sheet, Y down the sheet, the same origin on every floor. Note the compass direction of each axis; the north arrow decides the sun direction.

**Plan data** (`walkthrough/js/plan-data.js`), the only place dimensions live:
- `walls`: footprint, direction, optional height range, and openings (window, door, glazed door, cased opening, ventilator) with position, width, sill, head, hinge side, swing, open or closed.
- `pillars`, `areas` (terrace, balcony, double-height void) and `wardrobes` (footprint, door side, height, mirror).
- Read positions from the PDF's vector lines where possible, not by eye.

**Worked out automatically from the plan**: railings on floor edges beside voids and stairwells, railings on open edges of terraces and balconies, railings on top of low parapets, 4" skirting on every wall face that meets a finished floor (stopping at doors and openings), and what a person cannot walk through.

**Railings** (`A.wallRail` and `rails` in `plan.js`, drawn in `shell.js`): kinds are jaali, glass, metal bars or none. A terrace or balcony has "Railing on open sides" and "Railing height" (`rail`, `railTop` on the area). A wall has "Railing on top" (`rail`, `railTop` on the wall): Automatic puts the area's railing on a low wall (under 3 ft) along a terrace or balcony; a wall can also be set to a kind or None. A parapet from the floor that is at least 1 ft high stops the open-edge railing, so the railing sits on the parapet, never through it. The editor draws a dotted white line down walls that carry a railing.

**Not automatic, so refit by hand after a layout change**: room floor finishes, room captions, furniture, wall art, lights and the tour path.

**Editor** (`editor.html`, `js/editor.js`, `serve.py`): click to select; drag to move; round handles to resize; exact sizes typed as 12'-6", 12.5 or 150"; add wall, pillar, wardrobe, window, door, opening; delete; undo; snap; ceiling height; original drawing as underlay. `serve.py` writes every change to disk and keeps the first version for Reset. A pill at the top shows "Saved to plan file" or a red warning.

**Walkthrough** (`index.html` and `js/`): `shell.js` builds the building; `materials.js` makes textures in code; `styles.js` holds the three styles; `furniture.js` furnishes rooms; `lighting.js` sets sky, sun and lamps; `tour.js` holds the tour, walking, mouse look, dollhouse view, captions and map.

**Doors shown open** must rest against a wall, never stand across a room or in front of a counter. Pick the hinge side accordingly and tell the architect if it differs from the plan.

**Single file** (`build.py`): one HTML file that reads the editor's plan on opening and keeps a built-in copy as fallback. `python build.py --share <file>` makes the self-contained copy that is published as the link.

**Smoothness on integrated graphics**: draw the sun's shadows once, not every frame; light only the four lamps nearest the viewer; lower the drawing resolution automatically when frames are slow; merge furniture and trees into one mesh per material (`A.kit.mergeStatic`), which took the street view from 751 draw calls to about 135; draw walls and floors before furniture so hidden furniture is skipped. Measure speed only with the browser pane visible: a hidden pane is throttled and its timings swing by 3× from run to run.

**Checks before saying it is done:**
- Top view of each floor over its drawing (`index.html?debug=plan`): walls, openings and stairs line up.
- `APP.checkTour()` in the page console returns an empty list.
- The tour plays to the end and every room on every floor appears in the captions.
- Every tour stop looked at once; no view blocked by a door, railing or furniture.
- A change in the editor reaches the plan file and shows in 3D after reload.
- All three styles apply; dollhouse goes up and comes back; W A S D moves and walls stop you.
- The single file runs next to its `walkthrough` folder and on its own; the link shows the same version.
- Say plainly what was not checked.

---

## 9. Mistakes made the first time

- **Edits lost.** The editor first saved only inside the browser, and the app's built-in browser did not keep them. The save server now writes to disk. Always open the editor from `http://localhost:8765/editor.html`, or start it with `Start plan editor.bat`.
- **Looked for edits in the wrong place.** Ask what the save pill says before searching.
- **Slideshow-like motion.** Redrawing shadows every frame halved the frame rate on Intel graphics.
- **Stale pages.** The browser kept old scripts; the server now sends no-cache headers.
- **Cleaning up after tests.** Never reset the plan file to remove a test item; delete only the test item.
- **Opening the single file inside the Claude app.** It shows a frozen snapshot that cannot read the editor's file. Open it in a normal browser.
- **Mirrors** reflected the sky until each was given a capture of its own room.
- **Misread dimension.** A line read as the balcony edge was the plot boundary; check that room sizes add up to the overall dimensions.
- **A fixed tour.** The route was written for one layout and had to be redrawn when walls moved. Plan it from the plan each time (section 4).
- **Unrequested furniture.** A fridge and pantry placed opposite the counter, and an open door standing in the kitchen, both read as clutter and were removed.
- **Link not refreshed.** After every change, republish the share copy to the same link without being asked.
- **A second link by accident.** Publishing the share copy without the existing link's URL makes a new, separate link. Always publish to the same URL.
- **Editor edits arriving mid-job.** The client's plans were edited again while the ground floor was being built. Before every rebuild, compare the plan files with the last version you fitted (a plan diff), and refit furniture, labels and the tour to what changed.
- **Stairs that go further than one floor.** The front stair runs ground floor → first-floor landing beside the balcony → roof. Read the stair lines on every floor's drawing, not only the lowest.
- **A parapet that vanished.** Leaving an opening in the roof parapet for the stair landing removed the wall along the whole edge, because the edge was not cut at the opening's sides. Pass the opening's ends as cut points to `boundary()`.
- **Two servers on one port.** On Windows a second `serve.py` can bind the same port as one already running. Check `netstat` first and use the one that is running.
- **Open doors meeting furniture.** A newly opened or widened door leaf ended up through a sofa or armchair. After every door edit, check the swing area of each open leaf.

---

## 10. Every instruction from the first project, in order

Copied as typed.

1. `You're an architectural visualizer who makes 3D home tours for builders. there is a 2D floor plan in folder . Read it carefully: list every room with its size, every door, window and stair, and the wall height you'll use. Point out anything unclear. Then plan a 3D walkthrough of this home: the style and materials for each room, the lighting, the furniture, and the path a buyer would walk from the front door. Don't write code yet.`
2. `Start at the stairs`
3. `Browser walkthrough`
4. `Yes, build it`
5. Reply to "10' ceiling": `11' ceiling`
6. Reply to the description of the service stair: `remove this stair and add the space that is towards south to the washroom and the west side space to kitchen to make it l shape`
7. `also create something for the floor plan in which all the walls and window door , pillar is clickable to edit, delete resize and we 'll use that for final html if there is any change`
8. `i have made changes in editor file make changes accordingly to the final view`
9. `also make terrace, balcony , dual height area resizable`
10. `walkthrough is not smooth, it looks like running through a series of pictures`
11. `use higgsfield connector for video editing`
12. `I edited in this app`
13. `i re did the changes in editor update the walkthrough add to add wardrobe in editor`
14. `Saved to plan file`
15. `Now build it as one HTML file with Three.js. Match the plan exactly: walls, doors, windows and room sizes to scale. Add real-looking floors, walls and ceilings, furniture that fits each room, and soft daylight coming through the windows. Let me walk through it in first person with WASD and the mouse. Add a top-down dollhouse view with the roof off that I can switch to with one button.`
16. `Furnish every room the way a high-end interior designer would for a listing, in [modern / Scandinavian / warm luxury] style. Add rugs, art, plants, lamps, a set dining table, made beds and kitchen details. Make the materials feel real: wood grain, stone counters, soft fabric. Then add a style switch so I can show the same home in 3 different styles with one click.`
17. `also read the layout walls and all from the editor`
18. `i have edited in the editor, make changes in the index html according to it walls and windows are added make changes in furniture or wall painting or wardrobe`
19. `create a shareable link also create a file in which everything is written suppose whenever i have a new floor plan and i need this type of video till this every prompt and instruction that i gave you to make changes, write everything in the file also mention that, if i'm using fable 5.2 and higssfield then claude code has to do this and if not then commands for opus ultracode next time i give access to a folder in which i save floor plan and the file that you will generate now`
20. `there is 1 almirah or i guess fridge is there in front of kitchen slab, remove that`
21. `No fridge`
22. `update in the artifact too`
23. `in the playbook file, make changes 1. i'm an architect, i'll have many clients, so i'll name the folder raj architect and then many customers/clients in it , so the files that you are asking which would be needing every time, keep it somewhere in the folder for reuse and every clients names' folder would be there with their floor plans 2. this time it is only first floor, next time there can be basement, ground or first or multi floors 3. walkthrough from main door to everywhere in house is not fixed, it will change according to plan... do not fix it`
24. `there are changes in site plan, added some and removed something 1. in kitchen, a wardrobe is added, and remove the cabinet which is already there in front of that wardrobe 2. this looks like 3d cartooned video 3. use higgsfield to make this kind of realistic video 3. also the three styles only changes the colour only, instead of this make it change the furniture style, wall hanging designs, accessories, lightings, hardware fittings 4. update and then also update the artifact`

25. `Add a time-of-day slider from morning to sunset to night. Move the sunlight through the windows as I drag, make it warm and golden at sunset, and at night turn on the lamps and ceiling lights with a soft glow. Add soft shadows and a light reflection on the floors and glass. Keep every change smooth and keep it running well on a normal laptop.`
26. `Add a Start Tour button. The camera walks slowly from the front door through every room in order, pausing in each one with a small label: the room name, its size in square feet and one selling point. Add soft background music made with code, no sound files, and a mute button. At the end, rise up to the dollhouse view of the whole home.`
27. `Im adding ground floor plan also check this also and make same as u do for first floor`
28. `the front stair goes from ground to balcony and then roof`
29. `also the site plan is updated with somewalls and wardrobe shifts`
30. `use blender connector to enhance the furniture design and clarity` (no connector exists; Blender was installed and driven from Claude Code, see section 6)
31. Reply to "Install Blender so I can model better furniture with it?": `Yes, install Blender`
32. `g-stair-front, g-stair-north,g-stair-south these walls' height is till roof`
33. `make it to walk on front road too, walkthrough on road`

34. `push on github` / `Yes, push it`
35. `g-stair-front, g-stair-north,g-stair-south these arent showing in first floor plan editor, remove the car from porch porch walls' height are not editable family loubge to terrace gate is double door`
36. `remove sofa from balcony`

Notes on 35: the first-floor editor now draws ground-floor walls that rise through it (hatched; click one to jump to the Ground floor tab with it selected). Every wall and pillar has a Height choice; "Set bottom and top" takes heights in feet from that floor's finish (porch level, ceiling and roof are listed). Doors have a Leaves choice: single or double.

**Editor rule learned:** with the local server running, the plan files are the only record. The editor must not keep a copy in the browser that the walkthrough or a reloaded editor would prefer over the file, and the server refuses a save from a page that loaded an older version of the file (it asks for a reload). Old copies kept in a browser had been quietly putting back walls that had since been changed.

Notes on 32–33: plan walls can now run through both floors (`"z": [0, "ROOF"]` in the ground floor file), and a wall can have openings one above the other (a door on each floor). The stair's north wall got an opening onto the front balcony at first-floor level, and its front wall a second window there. The road in front is walkable, the gate stands open, and the tour now starts on the road looking at the house.

How these were built, for reuse:

- **Time of day** (`js/lighting.js`): one value from 0 (7 am) to 1 (9:30 pm) sets the sun's direction and colour, the sky, the light from above, lamp brightness, glowing fittings and ceiling-light halos, stars, and lit windows across the road. The slider eases toward the chosen time; the reflected sky and the mirrors are redrawn only a few times while it moves and once when it settles, so dragging stays smooth. Morning, Sunset and Night buttons jump straight there. `?tod=0.72` in the address opens at sunset.
- **Start Tour** (`js/tour.js`): a large Start Tour button and the Start tour control on the bar. Each pause shows a label with the floor, room name, area in sq ft and one selling point. These are written per home in the tour's key points (`label: [name, size, selling point]`); take sizes from the drawing, and keep each selling point to one short factual line. At the end the camera rises through the roof to the dollhouse view and turns slowly.
- **Music** (`js/music.js`): a slow four-chord pad with soft bell notes, made in the browser with Web Audio. It starts with the tour (browsers only allow sound after a click) and has a Music on/off button.


Second session, 17 Nov 2026, on the Manglam Vila PC (`D:\Manglam Vila`):

37. `do not change anything as of now read the files in folder https://github.com/niksgpt/Manglam-Vila.git this is the repo link`
38. `is blender connected and ready to use?`
39. `Yes, install it` (Blender 5.3.0 portable ZIP from download.blender.org, SHA-256 checked, unpacked to `D:\Apps\blender-5.3.0-windows-x64`)
40. Pasted as a list:
    ```
    remove the almirah below the stair
    add option to add railing for balcony in editor
    the floor in full house would be of same tile which is used in living room
    add skirting of 4 inch to every wall
    site plan is updated,
    ```
41. `use blender for these tasks`

Notes on 40–41: the almirah was the store cupboard under the main stair landing (ground floor); the space is left open but kept off the walking route (about 5'-6" headroom). Railing options and skirting are described in section 8. Blender modelled the railing parts and the skirting profile (section 6); the editor option, the floor finish and the refit are code and plan changes. The plan edits that came with the list: windows resized on both floors (sills to 3'-1"), the first-floor kitchen door moved, the bedroom-to-gallery window widened, the terrace parapet lowered to 1'-6" and new 1'-6" and 3'-6" parapets on the front balcony, the ground-floor toilet passage door widened, the gate pier lowered, and (mid-job) the walkway shortened to the house front with the porch strip extended to meet it. Refitted: TV wall moved clear of the wider rear window, kitchen tiles round the resized window, lounge art narrowed beside the widened window, curtains to the new window edges, balcony plants clear of the parapets, and the walkway steps now follow the walkway's front end from the plan file.

42. Reply to "Publish a new share link for the walkthrough from this account?": `Yes, new link` (published as a private artifact; the link is kept in Claude's memory for this project, and every later change is republished to it)
43. Pasted as a list:
    ```
    front stairs have railing inside, not the wall that you created
    window on wall g-stair-front is in a single piece, started from ground floor to first floor, height and start sill is correct
    in doll house view, ground floor hides behind the control panel , make it more zoomed out
    editing in editor, make changes
    top height of doors on g-stair-north wall is 8'0"
    add roof boundary lower wall of height 3'

    use blender to interior decorate the room
    do not use the colourful sofa and bed set
    every room has different elegant room designs
    doors and windows are of same colour but other furniture must be of different colour from doors and windows
    add name plate with home name "Manglam Vila" on g-front-pier wall
    ```
44. `g-stair-north, g-stair-front these walls are 8ft above the roof`
45. `every wall hanged painting must be different`

Notes on 43–45:
- Front stair: the full-height wall between the flights is gone; glass railings with a timber handrail run up the inner side of both flights and round the turn, on both runs.
- `g-stair-front`: its two stacked windows became one, from the 3'-0" sill up to the 30'-5" top already entered. `g-stair-north`: both openings 8'-0" high from their own floor (the ground-floor door, and the first-floor opening onto the balcony). Both walls now rise 8 ft above the roof (30'-10" from the ground-floor finish): the stair's cover on the roof. The roof landing's glass railings are left out where these walls stand. `g-stair-south` was not named and stays at roof height.
- Roof parapet (3 ft): it had been missing along the whole road-side edge, because that edge was not cut at the stair landing's sides (see section 9).
- Dollhouse: the camera stands further back and the picture is shifted up by half the control bar's height (`frameAboveBar` in `tour.js`), so the floor shown sits in the clear space above the bar.
- Doors and windows: one material, `joinery` (dark timber in Modern and Warm luxury, white paint in Scandinavian); no furniture uses it. Furniture woods (`oak`, `ash`, `honey`) and stones (`travertine`, `marbleW`) are fixed and never the doors' colour. Wardrobes take their room's painted finish.
- Each room has its own design (`DESIGN` in `furniture.js`): a calm palette, a wood, a stone and its own sofa, chair and bed shapes from Blender. For this house: ground hall oat linen and cognac leather; first-floor living ivory and charcoal; lounge slate and linen; first-floor master greige channel-tufted bed; ground master mushroom wingback; guest dove grey panel bed; children's sage arched single beds; terrace stone and charcoal. The style switch still changes the architecture, joinery, lamps, frames, accessories and the living rooms' sofa shape.
- Name plate: dark polished stone, brass border and raised brass lettering in Garamond, on the road face of `g-front-pier` at eye level from the street. The home name is an argument to the Blender script.
- Paintings: every frame gets its own picture (8 compositions × 10 calm palettes, drawn to the frame's proportions); each style hangs a different set.
- The plan file was edited by script in the editor's own format (serve.render), with the editor's stamp check left in place: an editor page left open must be reloaded before its next save.

46. Reply to "Run a speed check with the browser pane showing?": `Yes, check speed` (not done yet: the app throttled the page to one frame a second while the Claude window was behind other windows; see section 8)
47. `g-lobby-kitchen and g-kitchen-west have windows at the end they are meeting at the corner these are combined corner window, adjust it because a wall is kind of visible from other side if reduce the wall size because it reduces the window length as well and all`
48. `also add curtains and curtain rods to outer wall windows and doors there are some walls on which curtains are there but they arent visible, use colour pallete and use contrasting colour for curtains...use blender for this`

Notes on 47–48:
- Corner windows are found from the plan (`cornerWindows` in `shell.js`): two windows that reach into the square where an x wall and a y wall overlap, at the same sill and head, become one. Each glass runs to the other's glass line, one slim corner post replaces the two end frames, the sills meet without overlapping, and the overlap square is open between sill and head. Keep both walls running into the corner in the editor; there is no need to shorten either.
- Curtains are found from the plan too (`curtainsFor` in `furniture.js`), so they follow the editor: every window, glazed door and door with a room on one side and the outdoors, a terrace, balcony or porch on the other gets a rod on two brackets with ball finials and two pleated drapes pulled back to its sides, on the room side. Drapes go to the floor, or to the sill where a window is above a counter. Toilets and washrooms keep frosted glass, clerestory windows stay bare, the front door (`g-entrance`) stays clear, and a corner window keeps its corner open (the two rods meet there). Colour: a deeper shade from the room's palette (`CURTAIN` in `furniture.js`), so it stands out from the walls; rooms without a design get warm taupe. The old pale sheer curtains were removed. Drape, rod, finial and bracket are Blender models; the rod and fittings follow the style's metal. Floor-length drapes give way to furniture standing where they hang (a nightstand beside a window), so curtains are placed after each floor's furniture.

49. Pasted as a list:
    ```
    remove curtain and curtain rods from both kitchens
    curtain and rod is not proper on g-entrance
    children's room door's and windows' curtains are missing
    lounge-north window curtain missing
    hall-north window curtain missing
    height of building across the road od manglam villa is high, blocking the doll house view
    ```
50. `also check editor`

Notes on 49–50:
- No curtains in kitchens, toilets, washrooms or the store.
- Openings side by side on one wall (less than 1 ft apart, like a door between two narrow windows) share one rod, with a drape at each outer end. Open doorways count as openings. Drapes keep off a door only when its leaves stand open on the room side; closed glazed doors and outward-opening doors can be partly covered.
- Furniture against the wall: each drape first moves to the nearest free stretch on its own side. If both cannot hang to the floor, both hang to the sill; if furniture still rises above the sill (bed heads either side of a window), they end just above it. Furniture blockers now carry their height for this.
- The buildings across the road are one storey (12–14 ft) so they never block the dollhouse view.
- Both editor tabs checked: connected to the plan files, every wall, opening and parapet railing drawn, no errors.

51. `push it to github` (pushed as branch `walkthrough-update-2026-11-17`; `main` is updated by merging it on GitHub)
52. `there is roof balcony above the front balcony, when i asked you to add lower wall boundary wall on roof, you didnt cover this balcony, this balcony roof of front balcony is part of room, make change in the boundary wall of roof`
53. `use Charcoal Grey wpc panels for outer wall of g-stair-front,g-stair-north,g-stair-south and pillars gp-porch-2 and gp-porch-1`
54. `also there is edit in editor`
55. `p-terrace-1, p-terrace-2 do the same above wpc panel for these pillars there is edit in editor`
56. Pasted the Blender connector's log (blocked by Smart App Control again on 25 Nov); reply to "How should I handle the Blender connector?": `Keep command line`
57. With a wallpaper image: `using blender, use this wallpaper on the inside side of south wall which is touched to main stair dont extend this wall paper to other rooms should only be visible from double height area`
58. `you can rotate the image`
59. `smart app control is off`
60. Reply to "Push the wallpaper changes to the GitHub branch?": `Not now`
61. With a carpet image: `use this as carpet under the sofa in living/ dining hall`
62. With a texture image: `outer side of g-lobby-kitchen,g-hall-north,g-entrance,lounge-north,bedroom-north,lounge-terrace`

63. With a quilted felt texture: `g-bed-hall`; reply to "Which side of wall g-bed-hall should get the pink quilted felt finish?": `Hall side`

64. `on g-kitchen-west, front wall till g-stair-north north wall i.e., in balcony` (more walls for the textured stone of 62)

65. With an onyx marble image: `use this for ground floor's floor except for toilets and bathrooms`
66. With a terrazzo image, sent while the onyx was being built: `use this for roof floor` (an image sent mid-task is not saved as a file; it has to be sent again as its own message)

67. `undo the marble we added`
68. With a terrazzo image (teal and white chips; this one, not the green one in 66): `this is for roof floor`

69. With a brick image: `g-north-porch,g-front-pier,gp-gate both side`

70. With a white statuario marble image: `for main stair all sides`

71. With a green and beige geometric wallpaper image, sent while the stair was being built: `wall behind the bed of guest room` / `remove the painting from this wall` / `also remove 4chairs and the round table from the terrave`

72. The same wallpaper image again, as its own message: `for guest room`

73. With an oak veneer image: `use this for doors`; replies to "Should the window frames get the veneer too?": `Windows too`, and to "What should the oak furniture become?": `Grey-washed oak (Recommended)`

74. With a pastel geometric print, sent while the doors were being built: `use this for tv panel on rear-thin wall` / `make the panel top height to 8'`

75. The same pastel print again, as its own message: `for tv panel on rear-thin wall`

76. `remove the painting on bedroom-east, gallery side`

77. With a pale grey-beige fabric image: `use this for curtains`

78. Reply quoting `for tv panel on rear-thin wall`, sent while the curtains were being built: `thickness of panel is 2 inches`

79. With a hexagon wood image: `use this for tv panel in master bedroom with thickness of panel 2inches and top height  7'`; reply to "Which master bedroom?": `First floor master`

80. With a blue and gold watercolour stone image: `use this for tv panel in ground floor master bedroom` / `panel is 2 inch thick and top height 8'`; then, while it was being built: `thickness should be of this material` / `not the black`

81. With a sage and grey geometric wallpaper image: `use this for wall behind the bed of children's room` / `remove the paintings on that wall` / `adjust the height of curtain too` / `then push it to git`; reply to "How should the curtain height change?": `Hem down to the sill`; then, while it was being built: `and then update the artifact too` / `also editor has some changes in the wardrobe of living and dining of first floor`

82. `ceiling and walls colour is same` / `make ceiling colour pure white` / `and according to it, make celing light colour (warm white) so that it dont get mix with the ceiling` / `also make thickness colour of both floor as walls because on some walls, thickness of wall is visible`

83. `changes in editor`; then: `then push it`

84. `standing on the door of rear-thin wall` / `back of the house is facing SE 132 degree` / `adjust east west northsouth of the house` / `lat is 026 59'20"N` / `lon 075 51'16"E` / `use blender`

85. `what are the sizes of bed in rooms?` / `ground floor master bedroom and guest room have 6ft by 6ft bed` / `1st floor bedroom has 6ft which is touched to wall and 6.5ft, basically 6ft by 6.5ft`; then: `then push it`

Notes on 85: before, every double bed had a 6'-0" × 6'-8½" mattress in a frame about 6'-11" wide and 7'-2" to 7'-3" long; the children's singles are 3'-5" × 6'-5" mattresses (3'-11" × 6'-11" frames), unchanged. Bed sizes as sold in India (6 × 6, 6 × 6½) name the mattress, so `bedR(R, twin, [width, length])` now sizes the mattress and scales the frame round it: guest room and ground-floor master 6' × 6', first-floor master 6' × 6'-6" with the 6' side on the wall. The headboard's back stays on its wall and the bed shortens at its foot; `userData.footIn` says by how much, and the benches at the foot of the master beds move in by it. Frames are now about 6'-11" wide and 6'-6" (ground) or 6'-11" (first floor) long, headboard included.

Notes on 84: the model had assumed the rear faced due east, the road due west, and plan X ran north to south. The rear faces 132° (SE), so the compass turned 42° clockwise: rear SE, road NW, the plan's low-X side NE and high-X side SW. `blender/sun_path.py` (run in Blender) holds the site (lat 26°59'20" N, lon 75°51'16" E, IST, rear bearing 132°) and writes `js/site-data.js` (`window.SITE`). It finds the sun with the NOAA method (Blender's Sun Position add-on uses the same method but is not bundled with Blender 5) for the September equinox, whose sunrise 6:16, noon 12:19 and sunset 6:23 pm fit the walkthrough's moments of the day. It also saves `blender/site-sun.blend` with a sun lamp per moment and N/E/S/W arrows, for checking. `lighting.js` takes each moment's sun direction from `SITE.keys`: morning from the E (9° up), midday from the S (63°), afternoon from the W (24°), sunset low in the W. A bearing b runs along the plan at (sin(b − rear), −cos(b − rear)). A compass rose modelled in Blender (`compass` in `make_furniture.py`: stone disc, gilt ring and points, red north point, N/E/S/W letters) lies on the ground off the NE side at plan (−9, 10), turned by `SITE.rearBearing`. The minimap and the editor carry a north arrow; the editor's direction labels (Road (NW), Rear (SE), NE/SW ends and sides) and the road's label come from `SITE`. To set up another site, change the constants at the top of `sun_path.py` and run it.

Notes on 83: the editor moved `bedroom-east` to start at 9'-3" and its door to 9'-3" to 12'-8½", ran `bedroom-north` on to 27'-11½" (closing the corner), and on the ground floor extended `g-hall-toilet` to 15'-10" and started `g-kitchen-south` at 28'-2". The master bedroom door now opens flat against the wall with the hexagon TV panel and still stops short of it (its edge at 31'-6", the panel from 31'-7"). Checked in 3D, then built, republished and pushed with the plan files as the editor left them.

Notes on 82: the ceiling is pure white (`0xffffff`) in every style. Paint colour alone did not do it: a ceiling only gets the warm light bounced up from the floor, and it rendered exactly as the wall (197,185,168 against 197,185,169, sampled from the canvas). So it has a faint neutral emissive lift, scaled with daylight in `lighting.js` (0.42 by day, 0.15 at night), and now reads white above the beige walls without glowing after dark. The recessed downlights have their own material, `downlight` (warm white, emissive kept below glare: 0.35 + 0.45 × glow), so they read warm against the white ceiling; pendants and lamps keep `glow`. The floor thickness is in the wall colour: the first-floor slab (with a thin marble top under the floors), the roof slab, and the fascia along the void and stairwell edges (was fluted timber). Outside finishes (`CLAD`) now run on over the slab edge above each wall, so a clad facade has no band between storeys; finishes on one side of an inside wall stop at the wall top. Both ceiling layers are pulled in 0.05 ft so their white edge no longer shows as a line along the facades, and the slab boxes are 0.005 ft in from the wall faces so their undersides don't show as a hairline.

Notes on 81: the print `kids-bed` covers the room side of `g-north-rear` behind the two beds (4'-9" to 14'-3", floor to ceiling), cut round the window. Bed-wall wallpapers now go through one helper in `shell.js`, `wallpaper(print, walls, id, side, a0, a1, z0, z1)`: it cuts the wall's windows and doors out of the paper. A ground-floor wall already carries its floor level in `base`, so sills count from that and must not have the floor added again (the first try papered over the window). The guest room's wallpaper uses it too. The two paintings over the beds are gone (`K.skipArt()` keeps the count, see 76). The arched headboards span the whole wall and stand 4 ft high over the window's lower corners, so the drapes had been raised to clear them. Now, when furniture is in the way of drapes hung to the sill, the drapes still hang to the sill, in front of it: the rod and bracket arms stand off the wall by what `standOff()` measures on the pieces below (rays toward the wall), here 6½". `A.curtainList` rows now end with the hem height and the stand-off. The editor change was `wardrobe-3` (first-floor living and dining) starting at 12'-11" instead of 13'-0"; plan files are the editor's record and go into the build and the push as they are.

Notes on 80: the ground-floor master's TV wall (on the room side of the wall at x 16'-3") is a panel 2" thick up to 8 ft in the print `tv-ground-master` (the design's height fills the panel, a slice of its width shows); the TV and console stand off its face. The hexagon panel's edges had been walnut, which reads as black, so every print panel is now one solid, `printPanel(print, ax, a0, a1, wall, dir, thick, z0, z1, fit)`: the print on the face runs on round the ends and over the top, so the 2" thickness is the same material. fit `'height'` fills the height and shows a centred slice of the width; a number tiles a seamless print at that many feet a repeat. All three TV panels use it (living room `tv-panel`, first-floor master `tex-hexwood`, ground-floor master `tv-ground-master`); it is passed to the ground floor in `K`.

Notes on 79: there are two master bedrooms, so which one was asked. The first-floor master's TV wall is now a panel 2" thick up to 7 ft, faced with the print `tex-hexwood` (seamless, so it tiles: 6 ft across a repeat, about 9" a hexagon), its edges in walnut; the TV and console stand off its face. The bedroom door opens flat against that wall, and its edge would have met the thicker panel, so the panel runs 31'-7" to 38'-2" (was 31'-3" to 38'-6"), still centred on the bed. Faced panels go through one helper (now `printPanel`, see 80). A thicker panel or board on a wall: check what swings against that wall (door leaves open flat to it).

Notes on 78: the TV panel is 2" deep (wall face to panel face); the print sits on its face, and the console, its plinth and the TV stand off the new face, so they all came forward by about 1". The drapes either side hang 2⅛" off the wall, so they still clear it.

Notes on 77: `curtainFab` (print `tex-curtain`, 3 ft per repeat, made at 512 px since a fabric repeats often) on every curtain in the house, in place of each room's deeper palette colour; the room colours come back only if the print is missing. The drape is one model, 1 ft square, stretched to each panel, so a print on it would stretch with the panel: each drape gets its own texture coordinates in feet (`fabricUV`), so the weave is the same size on a narrow window and a wide door. This replaces the contrast rule of the earlier curtain request (the architect chose the fabric).

Notes on 76: the narrow frame on the gallery face of `bedroom-east` (between the bedroom door and the window) is gone. Each painting's picture comes from its place in the hanging order, so a removed painting leaves `artN++` in its place and every other painting keeps its picture. (The guest room removal in 71 did not do this, so the ground-floor paintings after it moved on by one picture.)

Notes on 75: the print `tv-panel` (from `blender/wallpaper/tv-panel.jpg`, 900 x 750, one print at the image's own proportions) faces the panel: its height fills the 8 ft, and the middle third of its width shows across the 3'-2" panel, about two of the design's six strips. The TV, the console and the curtains stay in front.

Notes on 74: the TV panel on `rear-thin` (first-floor living, between the window and the glazed door) now stops at 8 ft instead of the ceiling. It takes the print `tv-panel` when that is there: the design's height fills the 8 ft and a centred slice of its width shows, so its shapes keep a true size instead of shrinking to the 3'-2" width; fluted otherwise. The image did not arrive as a file (see 66) and was sent again (75).

Notes on 73: `joinery` (print `tex-veneer`) is now the oak veneer on door leaves, frames and linings and on window frames, the same in every style (the style no longer switches it to walnut or white paint). It repeats every 5 ft across and once per storey height up, so the grain runs up a door without a joint. Two earlier rules decided the follow-ups: doors and windows the same colour (so the windows followed), and no furniture the colour of the doors (so the furniture `oak` became a grey-washed oak, `wood(36, 10, 60)`). When a new finish lands on one thing, check the standing rules for anything it now clashes with and ask.

Notes on 72: the print `guest-bed` (from `blender/wallpaper/guest-bed.jpg`, repeat mode, wall 13'-6" by 10'-11", aspect 1.2306) runs the design across the full width and repeats it down the height; the panel in `shell.js` shows it once the print is there, and a plain wall when it is not.

Notes on 71: the guest bed's headboard is against `g-south`, so the wallpaper goes on the guest room side of that wall only (y 0'-9" to 14'-3", floor to ceiling, the skirting in front), as its own panel in `shell.js` reading the print `guest-bed`; the painting that hung over the bed is gone. The terrace's outdoor dining set under the pergola (round table and four chairs) is removed; the small table beside the terrace sofa stays. The image again did not arrive as a file (see 66) and was sent again (72).

Notes on 70: `stairMarble` (print `tex-statuario`, 4 ft per repeat, polished, roughness 0.15) on every box of the main stair, treads, risers, sides and undersides of the steps and both landings, the same in every style. The front stair keeps `stair`, which follows each style's floor. A finish asked for one stair gets its own material key, because `stair` is shared by both stairs.

Notes on 69: `brick` (print `tex-brick`, 2'-9" per repeat, not mirrored because the bond already tiles) on both faces of `g-north-porch` and `g-front-pier` (`{ mk: 'brick', face: 'both' }`, ends wrapped) and all round the pillar `gp-gate`. The name plate moves out by the slips' thickness so it sits on the brick.

Notes on 68: `terrazzo` (print `tex-terrazzo`, 2'-6" per repeat, satin) is the roof floor, over the whole roof including the roof over the front balcony and the roof landing of the front stair.

Notes on 65 and 67: the onyx floor (a print `tex-onyx` on every ground-floor room but the toilets) was built and then undone: the print, its material and its source copy were removed, and the ground floor is back on the house tile (`marble`).

Notes on 64: `plaster` on the outer face of `g-kitchen-west`, and on the balcony side of the first-floor `front` wall from its north end up to `g-stair-north` (beyond that the wall faces the front stair). A finish can stop partway along a wall: `{ mk: 'plaster', range: [from, to] }` in `CLAD`, measured along the wall.

Notes on 63: `felt` (print `tex-felt`, 3 ft per repeat) on the hall side of `g-bed-hall`, behind the hall sofa, stopping at the children's room door; the painting hangs in front. An inside wall has rooms on both sides, so its finish names the side: `{ mk: 'felt', face: 1 }` in `CLAD` (face -1 = the side at the lower x or y, +1 = the higher). Ask which side when a finish is asked for on an inside wall.

Notes on 62: the texture became a print (`tex-plaster`, made at 512 px with the print script's size limit) and the `plaster` material, repeating every 2'-6" and mirrored so no seam shows. Outer finishes are now a map in `shell.js` (`CLAD`: wall or pillar -> `wpc` or `plaster`), or `"clad": "<material>"` on a wall or pillar in the plan file; the same outer-face rules apply to both.

Notes on 52–54:
- The roof over the front balcony is part of the roof: tiled, walkable, inside the 3 ft boundary wall. The boundary wall is left out where a wall of the floor below rises above the roof (the stair tower).
- WPC panels (`wpc` material: charcoal grey slats about 3" wide) cover the outer faces of the chosen walls, stopping at openings and wrapping round bare wall ends, and wrap chosen pillars from the floor up. A face counts as outer when no room, and not the stair, lies beyond it. Both floors (the terrace pillars `p-terrace-1`, `p-terrace-2` continue the porch pillars up to the roof). Chosen in `CLAD` in `shell.js`, or with `"clad": "wpc"` on a wall or pillar in the plan file.

---

## 11. What is in `_kit\walkthrough-template`

| File | Purpose |
|---|---|
| `index.html` | The walkthrough page |
| `editor.html`, `js/editor.js` | The plan editor |
| `serve.py`, `Start plan editor.bat` | Local server that saves editor changes to disk |
| `js/plan-data.js`, `js/plan-data-ground.js` | Plan data per floor; hold the first project's layout as an example of the format |
| `js/plan.js` | Turns the plan into floors, railings and walkable areas |
| `js/shell.js`, `js/materials.js`, `js/styles.js` | Building, textures and the three styles |
| `js/furniture.js`, `js/furniture-ground.js` | Furniture for the first and ground floors |
| `js/lighting.js` | Sky, sun and time of day, lamps, ceiling lights |
| `js/music.js` | Background music made in code, with mute |
| `js/models.js`, `js/models-data.js`, `blender/make_furniture.py` | Furniture models and fittings (railing parts, skirting) made in Blender, and their loader |
| `js/tour.js`, `js/main.js` | Tour, labels, walking, dollhouse and controls; start-up |
| `build.py` | Makes the single HTML file, or a share copy with `--share` |
| `debug/` | Put the client's drawings here as `plan.png` (first floor) and `plan-ground.png` (ground floor) for the editor underlay |

Replace for each client: the plan files, the fixed lists in `plan.js` (slabs, room floors, captions, stair positions, the ground floor's room list and steps), the furniture placements in both furniture files, the lamp and ceiling-light positions in `lighting.js`, and the tour route with its labels. The editor, save server, materials, styles, controls and build script carry over unchanged.
