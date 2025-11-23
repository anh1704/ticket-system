# Project

This is a Vite + React + TypeScript project.

## Deploy to GitHub Pages using GitHub Actions

I added a GitHub Actions workflow at `.github/workflows/deploy.yml` that will:

- Install dependencies with `npm ci`
- Detect whether your repository is a user/site repo (`owner.github.io`) or a regular project repo and set `BASE_URL` accordingly
- Build the app with `npm run build` (output to `dist/`)
- Deploy the `dist/` folder to the `gh-pages` branch using `peaceiris/actions-gh-pages`

How to use:

1. Push your code to the `main` (or `master`) branch — the workflow triggers on push.
2. If this is a project site (not `owner.github.io`), the workflow will set the base automatically to `/<repo-name>/`. If you prefer to set a custom base, edit `.github/workflows/deploy.yml` and set the `BASE_URL` environment value.
3. In your repository settings on GitHub: go to **Settings → Pages** and set the source to the `gh-pages` branch (root). The site will then be available at `https://<owner>.github.io/<repo>/` (unless using a user site).

Notes:

- `vite` needs the correct `base` setting so assets are loaded when the site is served from a sub-path. The project `vite.config.ts` was updated to use `process.env.BASE_URL || '/'`.
- The workflow uses the built-in `GITHUB_TOKEN` so you don't need to add extra secrets.
