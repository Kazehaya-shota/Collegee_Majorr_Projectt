# Varen

Varen is an AI-powered, source-aware learning-path application built as a college major project.

## Local setup

1. Install Node.js 20.9 or newer. This project includes `.nvmrc` for Node 24.18.0.
2. Copy `.env.example` to `.env.local` and add your own credentials. Never commit `.env.local`.
3. Install packages with `npm install`.
4. Start the development server with `npm run dev`.

## Supabase setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In its SQL Editor, run [0001_course_master_schema.sql](./supabase/migrations/0001_course_master_schema.sql).
3. In the project’s **Connect** dialog, copy the Project URL and the server-only secret key into `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

4. Restart `npm run dev`. Never place the secret key in a `NEXT_PUBLIC_` variable or commit `.env.local`.

## Technology

- Next.js App Router and TypeScript
- Clerk for authentication and protected learning routes
- Supabase for PostgreSQL course data, progress, and source uploads
- Anthropic Claude for secure server-side course generation

## Current progress

The approved landing page and live Clerk sign-in/sign-up flow have been migrated into reusable Next.js components. The interactive path planner calls Claude through a server-only API route and returns a reviewable course outline. With Supabase configured, signed-in learners can save that draft and see it on their protected dashboard. Source uploads and lesson-level progress are the next milestones.
