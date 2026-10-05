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


## Phone and push notifications

Session requests can alert the provider by SMS, an automated Twilio voice call, and browser push notification. Configure these server-side environment variables in Vercel (never commit them):

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` — your Twilio number
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role key
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` — e.g. `mailto:you@example.com`

The provider enters their cellphone in **Provider Console → Phone Alerts** using E.164 format and can enable/disable SMS and voice alerts. The provider can also enable push on the phone/browser used for the console.

For iPhone web push, the site should be added to the Home Screen and notification permission must be granted. SMS and voice remain the cellular fallback.
