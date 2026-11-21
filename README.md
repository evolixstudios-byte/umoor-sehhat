# Umoor Sehat

Live app: [umoor-sehhat.pages.dev](https://umoor-sehhat.pages.dev)

Health camp registration and four screening counters, with staff permissions and an administrator dashboard.

```sh
npm ci
npm start
```

Open http://localhost:3000. Requires Node 22.13+; Node 24 LTS recommended.

Deployment: **Cloudflare Pages frontend → Render Node backend → Neon PostgreSQL**. See [SETUP.md](SETUP.md) for environment variables and setup. No database credentials are shipped to the browser. Local development defaults to SQLite; new databases issue token `001` first.

Run `npm test` for SQLite and PostgreSQL API checks.
