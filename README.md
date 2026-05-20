# Simple Work Log (MVP)

Minimal personal work/time logging app.

## Stack
- React + Vite
- Supabase JS client

## Run
```bash
npm install
npm run dev
```

## Supabase setup
1. Open your Supabase SQL editor.
2. Run [supabase_schema.sql](/Users/abhishekkumar/Desktop/untitled folder/supabase_schema.sql).
3. Open the app and go to `Settings`.
4. Paste Supabase URL and anon key.
5. Save and test connection.

## Supabase keep-alive
This repo includes a daily GitHub Actions workflow at [.github/workflows/keep_alive.yml](/Users/abhishekkumar/Downloads/VS%20Code/Worklog/.github/workflows/keep_alive.yml) that queries the existing `public.tasks` REST endpoint using the `anon` key.

Setup:
1. In GitHub, open `Settings` -> `Secrets and variables` -> `Actions`.
2. Add `SUPABASE_URL` with your project URL, for example `https://<project-ref>.supabase.co`.
3. Add `SUPABASE_ANON_KEY` with your project's anon key.
4. Open the `Actions` tab and run `Keep Supabase Active` once manually to confirm it succeeds.

Notes:
- The workflow runs daily at `17:23 UTC`, intentionally away from the top of the hour.
- The keep-alive request is `GET /rest/v1/tasks?select=id&limit=1`.
- Use the `anon` key only. Do not store the `service_role` key in GitHub Actions for this workflow.

## MVP features
- Settings page with manual Supabase URL/key (stored in localStorage)
- Reusable task search + create
- Daily logging with `date + task + minutes`
- Edit/delete logs
- Daily total and grouped totals by task
- Task history by date with total and average minutes per active day
- Rename and archive tasks
