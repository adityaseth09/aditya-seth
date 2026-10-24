# ira.seth.ltd

Ira's game arcade. An independent Astro project that lives in this repo next to `aditya.seth.ltd` (repo root) and `neha/`, sharing nothing with them: separate `package.json`, styles, components and Cloudflare Pages project.

Games are designed on paper by Ira (age 8) and then typed up into code here.

## Games

- **Tag Time!** (`/games/tag-time/`) — the lava obstacle course from Ira's sketch:
  jump over lava and spikes, collect coins, find **key 1** and **key 2**, push the
  lever to raise a bridge, then walk through **both doors** to finish the level.
  Fall in the lava and you restart the level from the top.
  5 levels now; Ira's master plan calls for 50.
- Works with keyboard (← → move, space jump) and on-screen touch buttons.
- Pick between 4 crayon-drawn characters: Mia, Ziggy, Whiskers and Robo.
- Progress (furthest level) and chosen character are saved in `localStorage`.

## Ira's future plans (v2 wishlist)

Two-player team mode, clothes and dance customization, character name changes,
and levels 6–50.

## Run locally

```sh
cd ira
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in ira/dist
```

## Adding a level

All levels are data in [`src/data/levels.json`](src/data/levels.json): platforms,
lava, spikes, keys, coins, the lever, its bridge, the two doors and the exit
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
