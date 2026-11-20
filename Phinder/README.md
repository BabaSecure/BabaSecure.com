# Phinder

Phinder is a BabaSecure-styled dashboard with a server-side Paystack account-resolution adapter. It supports local development with Node.js or Cloudflare Workers and deploys through the repository-root `worker.js` file.

## Run locally with Node.js

1. Install [Node.js 18 or later](https://nodejs.org/). Use the LTS release.
2. Copy `.env.example` to `.env`.
3. Set `PAYSTACK_SECRET_KEY` in `.env` to a newly generated Paystack test key. Never place the secret in `index.html`, client JavaScript, source control, or a public chat.
4. Run `node server.js` from this folder and open `http://localhost:4173`.

## Important

- Open `http://localhost:4173` to test live lookup functionality. Opening `Phinder.html` directly will show the design, but the lookup and provider download features require the Node.js server.
- The application shares the homepage stylesheet, logo, and scripts from the parent folder so Phinder remains visually aligned with the BabaSecure homepage.

## Run locally with Cloudflare Workers

This option tests the same runtime used in the deployed site.

1. Install Node.js LTS, then run `npx wrangler dev` from the repository root.
2. Copy `../.dev.vars.example` to `../.dev.vars` and replace its placeholder with a Paystack **test** secret key.
3. Open the local address Wrangler prints, then visit `/Phinder/`.

Do not commit `.dev.vars`.

## Deploy to Cloudflare Workers

1. Configure the Cloudflare Worker from the repository root. The included `wrangler.jsonc` declares `worker.js`, static assets, and the `/api/*` routes.
2. In Cloudflare Dashboard, open the Worker (not a static-assets-only upload), then go to **Settings → Variables and Secrets**.
4. Add `PAYSTACK_SECRET_KEY` as an encrypted secret for Production. Add it for Preview too if preview deployments should use live lookup.
5. Push to GitHub to deploy, then visit `/Phinder/`.

The `Phinder/server.js` file remains only for the Node.js local-development option. Cloudflare does not run it in production. The Worker runs first only for `/api/*` and serves the rest of the site from its static-asset binding. Never include the Paystack secret in browser code, repository files, or deployment logs.

