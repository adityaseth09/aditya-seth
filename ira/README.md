# ira.seth.ltd

Ira's game arcade. An independent Astro project that lives in this repo next to `aditya.seth.ltd` (repo root) and `neha/`, sharing nothing with them: separate `package.json`, styles, components and Cloudflare Pages project.

Games are designed on paper by Ira (age 8) and then typed up into code here.

## Site map (kid-friendly)

- `/` — **the arcade hub**: one big card per game with a giant PLAY button,
  "you're on level N!" progress, quick-jump buttons into each world, a
  "my coins" badge, the "Meet the characters!" parade and Ira's design notebook.
- `/games/<game>/` — each game page has the same top bar (`GameNav`):
  a big **🏠 All Games** button plus buttons to hop straight to the other games.

## Adding a new game

1. Scan Ira's sketch into `public/ira-sketch-<game>.jpg`.
2. Build the page at `src/pages/games/<game>.astro` and put
   `<GameNav current="<game>" title="..." />` at the top.
3. Add one entry to the `GAMES` list in
   [`src/data/games.ts`](src/data/games.ts) (title, emoji, colour, blurb,
   badges, sketch, optional world jump buttons, `isNew`). The homepage card and
   the switch-game buttons in every game's nav are generated from it — no other
   edits needed.
4. Reuse the shared bits in `src/scripts/tag-time/`: `characters.ts` (the 5
   crayon characters), `draw.ts` (crayon lines/text), `sounds.ts`, `input.ts`
   (keyboard + touch buttons), `picker.ts` and `shop.ts`.

Shared `localStorage`: the coin wallet (`tagTime:coins`) and shop purchases
work across every game. Each game keeps its own level/character keys.

## Games

- **Food Run!** (`/games/food-run/`) — from Ira's "Food Run" sketch: run and
  jump on platforms to **eat all the food** in each level, then grab the
  **best food in the world** (it stays locked 🔒 until every food is eaten).
  - **20 levels across 4 food worlds**: Picnic Park (1–5, best food: burger),
    Pizza Palace (6–10, pizza), Candy Kingdom (11–15, cake) and Ice Cream
    Island (16–19, sundae), ending with **The Grand Rainbow Feast** (20).
  - **Energy Bar** ⚡ = super fast for 10 seconds.
  - **Sack of sugar** 🍬 pops up Ira's question: *"you want suger? [yes] or
    [no]"*. Yes = sugar rush (super fast + higher jumps for 5s)… then a sugar
    crash (slooow for 3s). **Robo is allergic to sugar** — if Robo says yes he
    gets X_X eyes and is dizzy/frozen for a few seconds. No answer in 10s = no.
  - Hazards: falling in (juice / tomato sauce / chocolate river / melted
    milkshake), 🤢 moldy food, 🌶️ hot chilis, 👾 hungry food-monsters and
    sticky syrup puddles that slow you down. Kid-friendly deaths: you go back
    to the last **checkpoint flag** and food you've already eaten stays eaten.
  - 1 player or **2-player team mode** — both players must reach the best food.
  - Characters: Mia, Ziggy, **Stella** (Ira's dog), Robo and **Ira** herself.
  - Every food eaten = 1 coin for the shared shop.
  - Test helpers: `?level=N` in the URL, and `window.__foodrun` in the console.

- **Tag Time!** (`/games/tag-time/`) — the lava obstacle course from Ira's sketch:
  jump over lava and spikes, collect coins, find **key 1** and **key 2**, push the
  lever to raise a bridge, then walk through **both doors** to finish the level.
  Watch out for **beasts** stomping on the ground and **birds** swooping through
  the air — touching them means restart, but jumping on their heads squashes them!
  Fall in the lava and you restart the level from the top.

- **60 levels across 6 worlds** (Ira's master plan, delivered):
  - **Home** (levels 1–10) — the original levels with the beasts and birds.
  - **Wind Planet** (11–20) — **Windy** the gust cloud blows you around; duck
    under the low gusts and jump the gaps, up to boss **Galezilla**.
  - **Rain Planet** (21–30) — **Drizzle** the rain cloud drips deadly raindrops;
    stomp her to stop the rain, up to boss **Thunderhead**.
  - **Fire Planet** (31–40) — **Ember** the flame sprite runs fast along the
    ground; stomp or dodge the flames, up to boss **Infernita**.
  - **Storm Planet** (41–50) — wind + rain together, with lightning in the sky,
    up to boss **The Great Tempest**.
  - **Volcano Planet** (51–60) — every villain at once, lava waterfalls to jump
    over, ending with the **Final Boss: Planet Showdown**.
  Every world gets its own crayon-doodled notebook background.

- **Two-player team mode** (from Ira's sketch: "two people going in a team-work
  obstacle course… and you both win"): pick "2 players!" at the start, then each
  player picks their own character. P1 plays on **W A D + space**, P2 on the
  **arrow keys** — or on a tablet each player gets their own touch buttons
  (P1's on the left, P2's on the right). The camera zooms out to keep both
  players on screen. One player dies → both restart; and you only win when
  **both** players walk through the doors together!

- **Background music** — a gentle looping tune (WebAudio, no audio files) that
  starts with the first tap and plays throughout. The 🔊/🔇 button in the
  corner mutes it; the choice is remembered.

- **Ira's Shop** 🛍️ — coins earned in-game are saved between visits (dying only
  loses the coins from that attempt). Spend them on:
  - **Outfits**: Party Hat, Fancy Bowtie, Super Cape, Golden Crown, Flutter
    Wings, Space Helmet, Cool Sunglasses, Rainbow Socks.
  - **Celebration dances**: Wiggle Wiggle, Super Twirl, Star Jumps, Moonwalk,
    Robot Dance, Backflip.
  - **Songs** for the background music: Ira's Tune (free), Bouncy, Sleepy,
    Space, Rainy Day, Race, Monster Parade, Gusty, Volcano.
  - **Pet sidekicks**: **Twinkle the Star** and **Zorp the Alien** follow you
    through every level and dance beside you when you win!
  Purchases and selections persist.

- **Celebration dance** — when a level is cleared, the character(s) do the
  selected dance from the shop behind the "You win!" screen.
- Works with keyboard (← → move, space jump) and on-screen touch buttons.
- Pick between 5 crayon-drawn characters: Mia, Ziggy, Stella, Robo and Ira
  (an old saved "Whiskers" pick turns into Stella automatically).
- Progress (furthest level) and chosen character are saved in `localStorage`.

## Ira's future plans (v2 wishlist)

Character name changes, more pets, and whatever she sketches next.

## Run locally

```sh
cd ira
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in ira/dist
```

## Adding a level

All levels are data in [`src/data/levels.json`](src/data/levels.json): platforms,
lava (including standing lava "waterfall" columns), spikes, enemies
(ground `beast`s/`fire` flames and flying `bird`s/`wind` gusts/`rain` clouds
with patrol ranges), keys, coins, the lever, its bridge, the two doors and the
exit zone. Every level also has a `theme` (`home`, `wind`, `rain`, `fire`,
`storm`, `volcano`) that picks the doodled background. Add a new object to the
`levels` array — no code changes needed.
Keep jumps fair: rise ≤ ~90px, gaps ≤ ~170px, and don't hover flying villains
at standing-head height over platforms.

### Food Run levels

Food Run levels live in
[`src/data/food-run-levels.json`](src/data/food-run-levels.json) (platforms,
pits, syrup, foods, energy bars, sugar sacks, enemies with patrol ranges and
the best-food pedestal). They're generated by a seeded script so the jumps stay
fair (platform rises ≤ 70px and pit gaps ≤ 140px, so jumps still work even
during a sugar crash):

```sh
node scripts/generate-food-run-levels.mjs   # rewrites food-run-levels.json
```

Tweak worlds, names, food pools or segment mixes in the script and re-run it,
or hand-edit the JSON (re-running the script overwrites hand edits).

## Deploy to Cloudflare Pages (free plan)

Create a third Pages project on the same Git repo:

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repository.
2. Configure:
   - **Project name:** `ira-games`
   - **Production branch:** `main`
   - **Framework preset:** Astro
   - **Root directory (advanced):** `ira`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22` (also pinned in `.node-version`)
3. Deploy, then **Custom domains → Set up a custom domain → `ira.seth.ltd`**. Because `seth.ltd` is on Cloudflare, the CNAME is created automatically.

Everything is static — no Workers, no server, zero cost on the free Pages tier.
