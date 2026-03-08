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

## MVP features
- Settings page with manual Supabase URL/key (stored in localStorage)
- Reusable task search + create
- Daily logging with `date + task + minutes`
- Edit/delete logs
- Daily total and grouped totals by task
- Task history by date with total and average minutes per active day
- Rename and archive tasks
