# ira.seth.ltd

Ira's game arcade. An independent Astro project that lives in this repo next to `aditya.seth.ltd` (repo root) and `neha/`, sharing nothing with them: separate `package.json`, styles, components and Cloudflare Pages project.

Games are designed on paper by Ira (age 8) and then typed up into code here.

## Games

- **Tag Time!** (`/games/tag-time/`) — the lava obstacle course from Ira's sketch:
  jump over lava and spikes, collect coins, find **key 1** and **key 2**, push the
  lever to raise a bridge, then walk through **both doors** to finish the level.
  Watch out for **beasts** stomping on the ground and **birds** swooping through
  the air — touching them means restart, but jumping on their heads squashes them!
  Fall in the lava and you restart the level from the top.
  10 levels now (levels 6–10 have the beasts and get tricky); Ira's master plan calls for 50.

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
  loses the coins from that attempt). Spend them on outfits (Party Hat,
  Fancy Bowtie, Super Cape, Golden Crown) and celebration dances (Wiggle
  Wiggle, Super Twirl, Star Jumps). Purchases and selections persist.

- **Celebration dance** — when a level is cleared, the character(s) do the
  selected dance from the shop (twirl, wiggle or star jumps) behind the
  "You win!" screen.
- Works with keyboard (← → move, space jump) and on-screen touch buttons.
- Pick between 4 crayon-drawn characters: Mia, Ziggy, Whiskers and Robo.
- Progress (furthest level) and chosen character are saved in `localStorage`.

## Ira's future plans (v2 wishlist)

Clothes and dance customization, character name changes,
and levels 11–50.

## Run locally

```sh
cd ira
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in ira/dist
```

## Adding a level

All levels are data in [`src/data/levels.json`](src/data/levels.json): platforms,
lava, spikes, enemies (ground `beast`s and flying `bird`s with patrol ranges),
keys, coins, the lever, its bridge, the two doors and the exit
zone. Add a new object to the `levels` array — no code changes needed.
Keep jumps fair: rise ≤ ~100px, gaps ≤ ~140px.

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
