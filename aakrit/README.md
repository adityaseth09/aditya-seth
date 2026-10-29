# aakrit.seth.ltd

Aakrit Seth's chess coaching site. An independent Astro project that lives in this repo next to `aditya.seth.ltd` (repo root), `neha.seth.ltd` and `ira` — separate `package.json`, styles, components, data and Cloudflare Pages project.

A single-page coaching site: hero, rating stats, the rating-journey chart, verified achievements (each linked to its official source), the tournament log across Germany / Netherlands / India, coaching method, pricing, FAQ and contact — with booking wired for a free 20-minute trial lesson.

## Run locally

```sh
cd aakrit
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in aakrit/dist
```

## Edit content — no coding required

Everything comes from [`src/data/site.json`](src/data/site.json):

| What | Where in `site.json` |
| --- | --- |
| Name, email, WhatsApp, clubs, languages | `profile` |
| Current + peak ratings (FIDE / KNSB / DWZ) | `ratings` |
| The rating-journey chart points | `ratingHistory` |
| Big three achievement cards | `headlineAchievements` |
| All other achievement cards (with source links) | `achievements` |
| **Local trophies not online yet** — add `{ "title": "...", "year": "...", "detail": "..." }` entries here | `trophies` (currently empty, the section renders them automatically) |
| Tournament log per country | `tournaments` |
| What he teaches and how | `coach` |
| Prices — defaults: €20/h, 4-lesson bundle €70, free trial | `pricing` |
| **Booking link (Calendly) and payment links (Tikkie / PayPal)** | `booking` |
| Parent/pupil quotes — add `{ "quote": "...", "author": "...", "role": "...", "initials": "XY" }` | `testimonials` (currently empty) |
| FAQ entries | `faq` |
| Gallery photos + captions + credits | `gallery` |

### Replace the booking placeholder

1. Create a free [Calendly](https://calendly.com) account and add a 20-minute "Free trial lesson" event type (and 60-minute lesson types).
2. Put the link into `booking.calendly` — every button on the site ("Book a free 20-min trial", pricing CTAs, contact CTA) updates automatically.
3. Optional: add a Tikkie payment link in `booking.payment.tikkie` or PayPal in `booking.payment.paypal`.

### Photos

- Drop a portrait at [`public/images/aakrit.jpg`](public/images/) — the hero card switches from the "AS" initials fallback to the photo automatically.
- The two tournament photos in the gallery were sourced online (Amstelveens Nieuwsblad; Deutsche Schachjugend — credited in the footer). Add more photos to `public/images/` and list them in `gallery` in `site.json`.

## Deploy to Cloudflare Pages (free tier)

Create a separate Pages project on the same Git repo (like the other family sites):

1. In the [Cloudflare dashboard](https://dash.cloudflare.com), go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repository and configure:
   - **Project name:** `aakrit` (any name works)
   - **Root directory:** `aakrit`
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** 22 (or match `engines` in `package.json`)
3. Deploy. The static site is served from Cloudflare's global CDN at no cost.
4. **Custom domain:** under **Pages → Custom domains**, add `aakrit.seth.ltd` (the `seth.ltd` zone must already be on this Cloudflare account — the other family domains follow the same setup). Cloudflare provisions the SSL certificate automatically.

`site` is already set to `https://aakrit.seth.ltd` in [`astro.config.mjs`](astro.config.mjs) for correct canonical and Open Graph URLs.

## Performance & accessibility

- Zero client-side framework; only the theme toggle, reveal-on-scroll and count-up animations use small inline scripts.
- Self-hosted variable fonts (Manrope, Sora, JetBrains Mono) — no Google Fonts request.
- Dark mode by default with a light/dark toggle (persisted in `localStorage`).
- Skip link, semantic landmarks, focus-visible rings, and `prefers-reduced-motion` support.
- Every factual claim links to its official source (FIDE, KNSB, Berlin youth chess federation, news coverage) — parents verify before they buy, so keep it that way when editing.

## Project structure

```text
aakrit/
├── astro.config.mjs           # site URL + Tailwind plugin
├── public/
│   ├── favicon.svg            # gold knight on dark square
│   ├── og-image.svg          # social sharing card
│   └── images/               # gallery photos + aakrit.jpg drop zone
└── src/
    ├── data/site.json        # single source of truth — edit this
    ├── components/           # Nav, Hero, StatsBar, RatingChart, About,
    │                         # Achievements, TournamentTimeline, Coaching,
    │                         # Pricing, Testimonials, FAQ, Contact, Footer
    ├── layouts/BaseLayout.astro  # SEO meta + JSON-LD (Person + Offer)
    ├── pages/index.astro     # the single page
    └── styles/global.css     # Tailwind v4 theme tokens
```
