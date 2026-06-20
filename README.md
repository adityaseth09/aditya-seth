# Aditya Kumar Seth — Portfolio

A high-performance, single-page portfolio and resume site built with [Astro](https://astro.build) and [Tailwind CSS v4](https://tailwindcss.com). All content lives in `src/data/resume.json` so updates never require touching components.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

## Production build

```bash
npm run build
npm run preview
```

Static output is written to `dist/`.

## Content updates

Edit [`src/data/resume.json`](src/data/resume.json) to change profile info, metrics, experience, education, certifications, skills, or navigation links.

Drop your headshot at [`public/aditya.jpg`](public/aditya.jpg). If the image is missing, the hero falls back to an initials avatar.

## Deploy to Cloudflare Pages (free)

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository and configure:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** 22 (or match `engines` in `package.json`)
4. Deploy. Cloudflare serves the static site from its global CDN at no cost on the free tier.

Optional: set a custom domain under **Pages → Custom domains**.

Update `site` in [`astro.config.mjs`](astro.config.mjs) to your production URL for correct canonical and Open Graph URLs.

## Performance & accessibility

- Zero client-side framework; only theme toggle and scroll/count animations use small inline scripts.
- Self-hosted variable fonts (Inter, Space Grotesk) — no Google Fonts request.
- Dark mode by default with seamless light/dark toggle (persisted in `localStorage`).
- Skip link, semantic landmarks, focus-visible rings, and `prefers-reduced-motion` support.

## Project structure

```text
src/
├── data/resume.json       # Single source of truth
├── components/            # UI sections
├── layouts/BaseLayout.astro
├── pages/index.astro
└── styles/global.css      # Tailwind @theme tokens
public/
├── favicon.svg
├── og-image.svg
└── aditya.jpg             # Your photo (add this)
```
