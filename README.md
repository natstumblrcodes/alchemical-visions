# Alchemical Visions

Custom mobile-first psychic consultation portal built from the supplied visual references.

## Current architecture

- Next.js 15 + React 19
- Supabase Auth with SSR cookie/session handling
- Supabase Postgres + Row Level Security
- Supabase Realtime for consultation state and chat
- Billable chat, audio, and video session records
- Provider presence and session acceptance console
- WebRTC signaling table ready for the audio/video transport layer
- Vercel-compatible environment configuration

## Routes

- `/` — visual landing/portal shell
- `/session` — client sign-in and live consultation flow
- `/provider` — provider availability and pending-session console
- `/api/supabase-health` — deployment/Supabase health check
- `/api/session/start` — create a pending consultation
- `/api/session/accept` — provider accepts and starts billing
- `/api/session/cancel` — client cancels a pending request
- `/api/session/end` — ends a live session and calculates the final subtotal
- `/api/message` — authenticated message creation

## Supabase setup

Apply the migrations in `supabase/migrations/` to the project, then configure these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not put a Supabase service-role key in browser-exposed environment variables.

## Session lifecycle

`pending → active → ended`

A pending request does not start the timer or accept chat messages. The provider must be online and accepting before the request can be accepted. Billing is calculated from elapsed session time using the provider's per-minute rate and minimum-minute setting.

## Realtime

The migrations add the consultation/session, message, profile, and WebRTC signaling tables to the Supabase Realtime publication. Row Level Security limits records to the appropriate participants.

## Vercel

Connect the GitHub repository to Vercel, add the two public Supabase environment variables to the appropriate deployment environments, and redeploy. After deployment, visit `/api/supabase-health` to confirm the application can initialize its Supabase client.
