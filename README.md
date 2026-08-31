# CFA Ortho Schedule

Daily staffing schedule for the Bethesda and Germantown offices. Built with
Next.js + Prisma + Postgres, deployable to Vercel.

## What it does (v1)

- Shows each day split into Morning / Afternoon x Bethesda / Germantown.
- Each doctor's recurring weekly schedule is defined under **Doctor templates**
  (only Dr. Christoforetti is filled in for now — add the rest there whenever
  you have their hours).
- Every doctor's dedicated scribe is auto-assigned to them whenever both are
  in. If the scribe is out, the app flags the slot as OPEN and any other free
  scribe (whose own doctor is off that half) can fill in.
- Staff self-place into open Sub-scribe / Support (rooming) / X-ray slots at
  either office from the schedule page.
- Anyone can mark themselves (or a doctor, on their behalf) absent for a date
  range under **Absences**.
- Patient counts are entered per doctor per half-day directly on the schedule
  page; the two office totals are shown up top, with the busier office
  flagged as needing more staffing.
- No login — pick your name once from the "I am:" dropdown in the top bar
  (remembered on that device). There's no password gate in v1, so treat the
  URL as internal-only.

## Local development

```
npm install
npx prisma migrate dev --name init   # creates tables in DATABASE_URL
npm run prisma:seed                  # loads the doctor/staff roster
npm run dev
```

## Deploying to Vercel with a real database

1. **Create the database.** In your Vercel dashboard: Storage → Create
   Database → Postgres (or Neon). Either works the same way from here.
2. **Get the connection string** it gives you (starts with `postgresql://`).
3. **Local `.env`**: copy `.env.example` to `.env` and paste that connection
   string in as `DATABASE_URL`.
4. **Create the tables**: `npx prisma migrate dev --name init`
5. **Load the roster**: `npm run prisma:seed`
6. **Push this project to a GitHub repo**, then in Vercel: New Project →
   import that repo. Vercel will detect Next.js automatically.
7. **Add the env var** in the Vercel project's Settings → Environment
   Variables: `DATABASE_URL` = the same connection string from step 2 (if you
   provisioned the DB through Vercel's own Storage tab, this is usually added
   for you automatically — double check it's there).
8. Deploy. Vercel runs `prisma generate && next build` automatically (see
   `package.json`'s `build` script).

To make schema changes later: edit `prisma/schema.prisma`, run
`npx prisma migrate dev --name <what changed>` locally (against the same
database Vercel uses, or a scratch one), commit the generated
`prisma/migrations/*` folder, and redeploy.

## Adding a doctor's schedule

Go to **Doctor templates**, pick the doctor, and set each weekday's
Morning/Afternoon to Bethesda, Germantown, or Off. That becomes their
recurring week; use **Absences** for one-off days off on top of it.

## Known v1 limitations / good next steps

- No password/login — anyone with the link can view and edit.
- No PA (physician assistant) support yet — doctors only.
- The "needs more staffing" flag just compares raw patient totals between the
  two offices; it doesn't yet weigh it against how many support staff are
  already there.
- Sub-scribe/rooming/x-ray placements aren't validated against the specific
  office a doctor is at (e.g. nothing stops someone helping Germantown while
  physically listed at Bethesda) — that's left as a judgment call for now.
