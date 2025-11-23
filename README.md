# Project

This is a Vite + React + TypeScript project.

## Deploy to GitHub Pages using GitHub Actions

I added a GitHub Actions workflow at `.github/workflows/deploy.yml` that will:

- Install dependencies with `npm ci`
- Detect whether your repository is a user/site repo (`owner.github.io`) or a regular project repo and set `BASE_URL` accordingly
- Build the app with `npm run build` (output to `dist/`)



