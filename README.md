# Drowned Clutch

A Lovecraftian deep-sea egg-harpooning game for phones. It plays fully offline once loaded, and it's an installable web app: in Safari, tap Share → Add to Home Screen.

**Play:** https://skylerrego15.github.io/offlinegame/

## Loop
1. **Aim and fire** the harpoon cannon from your ship (hold the button, slide to aim, release).
2. **Steer the dive** by dragging anywhere on screen. The harpoon follows your finger and sinks at a steady speed. Chain eggs within 40m of each other: a chain of *N* multiplies your line range by *N²*, so 2 eggs = 4× range, 3 = 9×, and so on. Each combo level gets louder visuals.
   Every egg you hit drops into your cage. There's no limit, and eggs are only collected on the way down.
3. **Reel in** with the 0–100% power bar. Past the gold SAFE mark the line strains and snaps barbs, which loses eggs. Reel too slowly and something rises out of the dark to take an egg. Holding just under SAFE builds bonus hatch luck.
4. **Hatch your haul.** There are 8 egg tiers, 24 reveal animations that escalate with rarity (10 of them rendered with WebGL shaders: ink, storms, caustics, vents, plankton, a black hole, a living eye, a monster from below, aurora, shattering reality), 8 rarities, and 7 mutations. Sell a creature for cash now or keep it in your aquarium for money per second.
5. **Grow the ship.** Every room you build appears in the hull cutaway, with your hired crew working in it.

## Systems
- **20 zones**, about 4.2 km deep in total, each with its own scenery and hazards: urchins, jellies, bloaters, tentacles, watching eyes.
- **Upgrades:** line range, dive speed, steering, winch, lantern luck, sonar, iron plating.
- **Cages:** 8 tiers, from the Rusted Cage up to the $1T Eldritch Cage. They're expensive and kept forever. The equipped cage's boosts (aquarium cash, sell value, luck, mutation chance) apply while it's in use.
- **Unlimited crew:** Deckhand, Harpooner, Lookout, Aquarist, Chaplain, Occultist.
- **Unlimited ship rooms:** Tank, Bunks, Winch Room, Shrine, Refinery, Trophy Hall. Costs scale up with each one.
- **Dread:** rare hatches raise it, giving more luck but weaker crew. At high Dread, tentacles climb the hull to steal from your tanks.
- **Omens:** timed world events.
- **Contracts, Bestiary bonuses, offline earnings**, and the **Offering**, a prestige reset for permanent Abyssal Sigils.

## Dev
Plain ES modules. No build step and no dependencies.
- Run locally: `python3 -m http.server` then open http://localhost:8000
- After changing files, run `python3 tools/build_sw.py` (offline cache list) and `python3 tools/build_single.py` (one-file build `DrownedClutch.html`).
- Creature art goes in `assets/creatures/<id>.webp`. Register it in `CREATURES` in `js/data.js`.
