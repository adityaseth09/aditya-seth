# neha.seth.ltd

Neha Seth's résumé site. An independent Astro project that lives in this repo next to `aditya.seth.ltd` (repo root) but shares nothing with it: separate `package.json`, styles, components, data and Cloudflare Pages project.

Two views of the same data:

- `/` — classic résumé (hero, impact metrics, timeline, skills, education).
- `/devtools` — the résumé as browser DevTools around a live checkout page: Elements (career as a DOM tree), Console (type `help()`), Network (payment waterfall), Sources (editable playground), Components (Storybook-style controls), Lighthouse (gamified scores) and Performance (career flamegraph).

## Run locally

```sh
cd neha
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in neha/dist
```

## Edit content

Everything comes from [`src/data/resume.json`](src/data/resume.json): profile, availability, metrics, experience, skills, education, and the DevTools data (markets, payment methods, console facts, Lighthouse audits).

Drop a headshot at `public/neha.jpg`. If it is missing, the hero falls back to an initials card.

The PDF served from the "Download résumé" button is `public/neha-seth-resume.pdf`; replace the file to update it.

## Deploy to Cloudflare Pages

Create a second Pages project on the same Git repo:

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repository.
2. Configure:
   - **Project name:** `neha-seth`
   - **Production branch:** `main`
   - **Framework preset:** Astro
   - **Root directory (advanced):** `neha`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Environment variable:** `NODE_VERSION` = `22` (also pinned in `.node-version`)
3. Deploy, then **Custom domains → Set up a custom domain → `neha.seth.ltd`**. Because `seth.ltd` is on Cloudflare, the CNAME is created automatically.

Optional, to avoid redundant builds: in **Settings → Builds → Build watch paths**, set *Include* to `neha/*` on this project, and *Exclude* `neha/*` on Aditya's project. Either way both sites keep working; this only saves build minutes.
