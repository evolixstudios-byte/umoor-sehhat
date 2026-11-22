# Deployment: Cloudflare Pages + Render + Neon

Run locally with Node 22.13+ (Node 24 LTS recommended):

```sh
npm ci
npm start
```

Open http://localhost:3000. Without DATABASE_URL, local development uses SQLite in data/umoor_sehat.db. Tests use isolated databases and never modify that file.

## Neon database

1. Create a Neon project and copy its PostgreSQL connection URI from **Connect**. Use the pooled endpoint for this backend and retain SSL verification.
2. Set the URI as `DATABASE_URL` in your private local `.env` when running the account transfer. Do not commit it or paste it into frontend files.
3. Before starting the Render service, run `npm run migrate:accounts` from this workspace. This copies the existing staff and Super Admin accounts, including their password/PIN hashes, permissions, account settings, and staff-management audit history. It requires an empty destination and an empty local participant table. It never uploads participant demo data or resets credentials.
4. Configure Render's `DATABASE_URL` with the same URI. Keep `ADMIN_EMAIL` equal to the existing app Super Admin email (`evolixstudio@gmail.com`) so startup does not create another administrator. Bootstrap passwords only apply to new accounts; transferred accounts keep their current passwords.

The portable schema lives in `supabase/schema.sql` (the existing filename is retained). It works with Neon PostgreSQL. Row level security prevents public-role access; only the backend owner connection and existing application permissions access records. The frontend receives no database credentials.

New registrations start at `001`. Account transfer is transactional and verifies every transferred row. Re-running it against a destination with existing accounts stops without changing those accounts.

## Render backend

Push the project to a Git repository, then create a Render Blueprint using `render.yaml`, or create a Node web service with:

- Build: `npm ci --omit=dev`
- Start: `npm start`
- Health check: `/healthz`
- Node: 24 LTS

Set these Render environment variables:

- `NODE_ENV=production`
- `DATABASE_URL`: Neon PostgreSQL URI above
- `SESSION_SECRET`: random secret of at least 32 characters (Blueprint generates it)
- `PROXY_SECRET`: another random secret of at least 32 characters
- `ADMIN_EMAIL`: administrator email
- `ADMIN_INITIAL_PASSWORD`: strong initial administrator password
- `STAFF_INITIAL_PIN`: initial 4-digit staff PIN

The first administrator login requires a password change. Change individual staff PINs from the admin dashboard. Bootstrap variables only affect new accounts. Keep one Render instance initially: login attempt rate limits currently live in process memory; shared rate limiting is needed before scaling to multiple instances.

## Cloudflare frontend

Create a **Cloudflare Pages** project from the same Git repository:

- Framework: None
- Build command: leave empty
- Output directory: `public`

Set these Pages environment variables for production (and separately for preview deployments if used):

- `API_ORIGIN`: the Render service origin, e.g. `https://umoor-sehat-api.onrender.com`
- `PROXY_SECRET`: exactly the same secret as Render

Redeploy Pages after changing its environment variables. `public/_worker.js` proxies `/api` to Render and serves static assets through Pages. Login cookies stay on the frontend origin, avoiding cross-site cookie restrictions. The Render API rejects requests without the proxy secret. Never place the database URI, session secret, or admin password in frontend files.

Verify staff login, administrator password change, registration of token `001`, all four counters, logout, and CSV export on the hosted frontend. Accounts and registrations are stored in Neon and survive Render restarts.

Optional Google Sheets backup remains available through `SHEETS_WEBAPP_URL` and `SHEETS_WEBHOOK_SECRET`. It is not needed for Neon storage.

## Local verification

```sh
npm test
```

Tests cover SQLite and embedded PostgreSQL API contracts, staff permissions, account administration, duplicate registration, concurrent token allocation, idempotency, counters, exports, and the Cloudflare proxy. Physical phone keyboard appearance and focus zoom require a real iOS/Android device; desktop emulation checks input attributes, sizes, and layout.

Provider references: [Neon Node.js connections](https://neon.com/docs/guides/node), [Cloudflare Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [Render Blueprint specification](https://render.com/docs/blueprint-spec).

## Medical history, doctor flags, and Janab dashboard

Registration now explicitly records reported BP history, diabetes / high sugar history, both, or no known history. No known history is exclusive. Older records retain a null history and display "History not recorded"; migrations do not infer a normal history or change token numbers. SQLite and PostgreSQL schema upgrades run automatically on backend startup.

Doctor screens separate reported history from current screening results. Red identifies BP, blue identifies sugar, and green identifies no known history or a reading within the stated screening range. These are observations for a clinician, not automated diagnoses.

Adult BP flags distinguish normal (below 120/80), elevated (systolic 120-129 with diastolic below 80), Stage 1 (systolic 130-139 or diastolic 80-89), and Stage 2 (systolic 140+ or diastolic 90+). Readings below 90 systolic or 60 diastolic receive a low-reading flag. Values above 180 systolic or 120 diastolic retain an urgent Stage 2 warning. Children receive age-specific review labels instead of adult categories.

Sugar below 54 mg/dL is flagged dangerously low; 54 to below 70 is low. The camp's requested adult random sugar bands are 70-140 inclusive as normal, above 140 to below 200 as elevated/borderline, and 200+ as high. The overlapping 140 boundary is assigned to normal. These camp screening labels are not diagnostic criteria. Fasting readings retain separate thresholds: 100-125 raised and 126+ high. Post-meal timing is not recorded, so those results require clinical review. Pregnancy, medication, symptoms, measurement technique, and individual targets require the doctor's judgment.

Threshold references: [AHA blood pressure categories](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings), [AHA low BP](https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/low-blood-pressure-when-blood-pressure-is-too-low), [NIDDK diabetes testing](https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis), [CDC low blood sugar](https://www.cdc.gov/diabetes/treatment/treatment-low-blood-sugar-hypoglycemia.html). Reviewed November 21, 2026.

Super Admin can delete a participant from **Participants → View details → Delete participant**, after confirmation. Deletion removes that participant's screening record, retains staff accounts and the audit trail, and never resets or reuses a token. A record changed since opening must be reopened before deletion; old registration retries return 410 instead of recreating the participant.

On the doctor screen, **Print Report for Doctor** opens the device print dialog before consultation without requiring or saving electronic advice. The single-page A4 report includes both Umoor Sehat and Toloba logos, registration details, history, all screening readings, a 60 mm blank area for a handwritten prescription and doctor signature/date fields. Electronic notes remain available on screen and in the database; this pre-consultation printout reserves the prescription section for handwriting. Missing measurements are labelled as not recorded. The existing registration token slip remains separate.

The GitHub Actions workflow `.github/workflows/keep-backend-awake.yml` requests the backend health endpoint every five minutes and supports manual runs. It does not log in or change patient records. It checks that the response is valid JSON with `ok: true`. GitHub schedules can be delayed; this is a best-effort warm-up, not an uptime guarantee.

ITS is optional on new registrations. Leave it blank when not applicable; if supplied it must contain eight digits and remain unique. Missing ITS is stored as SQL NULL; existing ITS values are preserved. Token, serial, name and phone support patient lookup. SQLite and PostgreSQL upgrades preserve existing patient and staff data. The optional Sheets connector uses the stable serial number for people without ITS, and still accepts legacy ITS-based sync messages.

At the doctor counter, **Edit BP / Sugar** corrects BP, pulse and sugar readings before printing. The backend permits only those fields for a doctor, validates the values and rejects stale edits. Each correction records the editor, time and before/after values in the audit log. Consultation notes are preserved while the reading editor is open; correcting readings does not mark a consultation completed. Admin and Janab read-only accounts cannot make corrections.

Use **Janab Login** with username `janab saab` and initial PIN `5253`. This account has read-only access to aggregate statistics, a history pie chart, and a daily registration line chart in India time. The pie counts each person once, with a separate group for both BP and diabetes. Flagged-reading counts remain separate from reported history. Refresh reloads current counts. Janab can view detailed participant records and prescriptions. Exports, staff management, and counter updates remain denied on the backend. The Super Admin can reset its PIN or deactivate it using existing staff controls.

CSV exports include reported medical history. If using the optional Google Sheets backup, redeploy `google-apps-script/Code.gs` to add the new history column; existing columns and rows are preserved.

## Participant directory and record corrections

Super Admin, read-only Admin accounts, and Janab can open **Participants** to search by token, ITS, name, or phone, browse pages, and view registration details, reported history, readings, and doctor advice. Only Super Admin sees **Edit information** and can save corrections. Tokens, serials, and the original registration time remain fixed. Completed readings cannot be erased through this editor. Changed height/weight recalculates BMI; changed clinical readings are attributed to Super Admin. Stale edits are rejected so newer desk readings are preserved.

To create an Admin, open Super Admin staff management, add/edit an account, and select **Admin - view all participant records (read only)**. Use its assigned username and PIN under **Staff / Admin Login**. This role does not grant registration, counter updates, exports, or staff management. Janab retains the overview charts and now also has detailed participant viewing access. Backend authorization enforces these restrictions independently of the UI.

If using optional Google Sheets sync, redeploy the updated Apps Script so ITS corrections locate the original row through `previousIts` and preserve its token and serial.
Default staff are seeded only when the staff table is empty. Renamed or deleted default accounts are not recreated on subsequent restarts.


## Current deployment

- Frontend: https://umoor-sehhat.pages.dev
- Backend: https://umoor-sehhat-api.onrender.com
- Render service: `srv-dc0tjhuc6qcc73fdnqi0`, in Evolix's workspace, Singapore, free plan.
- Neon project: `square-king-54133227`, production branch, Singapore. Existing staff and Super Admin accounts were transferred with their original hashes and permissions. No demo participants were transferred.
- Source: https://github.com/evolixstudios-byte/umoor-sehhat

Render starts with `node --env-file=/etc/secrets/umoor.env server.mjs`; the private file is configured through Render secret files. It is not stored in Git. Cloudflare stores `API_ORIGIN` and `PROXY_SECRET` as Pages secrets. Keep both proxy secrets identical when rotating credentials.

The Cloudflare project uses direct upload. Future frontend changes require `npx wrangler pages deploy public --project-name umoor-sehhat --branch main` under the same Cloudflare account. No frontend Git automation or custom domain is configured. Keep the database connection in Render, and use the hosted app for shared camp records; local SQLite is a separate development copy.

Verified after deployment: frontend loading, secure staff cookies, Super Admin login, registration of token `001`, BP/sugar/BMI saves, Janab detailed read-only access, and rejection of Janab edits. The temporary verification participant was removed and the next token reset to `001` with no other patients present.
