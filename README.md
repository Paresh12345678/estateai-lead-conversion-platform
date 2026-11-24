# EstateAI

EstateAI is a responsive real-estate lead conversion workspace built with React, TypeScript, Tailwind CSS, Express, Supabase, and Anthropic Claude. It includes a real CRM and listing workflow, AI qualification and drafting, property matching, analytics, and an event activity log.

> **Demo records:** The included Austin, Dallas, and Miami listings and leads are fictional demonstration data. In local demo mode, lead changes and chat history are stored in this browser's local storage. With Supabase configured, the same sample records are available alongside each signed-in user's records.

## Quick start

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). The app starts in local demo mode. CRM edits and conversations persist in browser storage. **AI requests use a real Anthropic API call** and will show a configuration error until `ANTHROPIC_API_KEY` is set in `.env`; there are no canned AI responses.

```dotenv
ANTHROPIC_API_KEY=your-server-side-key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

Restart the API after changing `.env`. Never put the Anthropic key in a `VITE_` variable or browser code.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql). This creates the tables, indexes, profile trigger, RLS policies, and 15 fictional properties plus 10 fictional leads.
3. Configure the Supabase email/password provider and email confirmation policy to suit your agency.
4. Add the project URL and **anon/public** key to `.env` for the client and the server:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ANTHROPIC_API_KEY=your-server-side-key
   ```

5. Restart the dev server. The app switches to Supabase Auth and Postgres mode and requires sign-in.

The Supabase anon key is intended for browser use and is not a service-role key. RLS isolates user-created leads, properties, conversations, drafts, workflow records, and activity logs. The shared sample records are marked `is_demo`; demo leads are editable for exploration but cannot be deleted. **Never expose a Supabase service-role key to the browser.**

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite UI and Express API with server-side reload |
| `npm run dev:web` | Frontend only |
| `npm run dev:api` | Express API with `tsx watch` |
| `npm run build` | Type-check and create the production frontend in `dist/` |
| `npm run start` | Run the Express API and serve `dist/` |
| `npm run lint` | Run Oxlint |

## Architecture

- **React UI (`src/`)** — responsive workspace navigation, dashboard, lead CRM, property inventory, AI chat, follow-up editor, and insights. Tailwind is available for utility styling; shared layout and visual system live in `src/App.css`.
- **Data layer (`src/storage.ts`)** — uses Supabase Postgres when configured; otherwise uses clearly identified fictional demo records and local storage. AI chat history and generated follow-up drafts persist in the active data mode.
- **Express API (`server/index.ts`)** — validates requests with Zod, checks the signed-in Supabase user when cloud auth is configured, applies a per-IP request limit, calls Anthropic from the server, validates structured model responses, and retries transient provider failures once. No model key is sent to the browser.
- **Postgres (`supabase/schema.sql`)** — profiles, leads, properties, conversations, messages, recommendations, follow-ups, workflow executions, and AI activity logs, with ownership policies and indexes.
- **Matching** — transparent score based on budget fit, requested city, property type, bedroom count, and keyword overlap with listing amenities/description. Matches are ranked and labeled with the criteria that contributed.
- **Workflows** — creating a lead starts qualification; high scores create priority activity; matching and follow-up drafting create activity entries; CRM status changes and scheduled reminders are recorded. Draft communication is saved for review and is never sent automatically.

### Security and operational notes

- Configure both Supabase client and server environment variables before exposing a production deployment. In production without Supabase configured, the AI API is disabled unless `ALLOW_UNAUTHENTICATED_DEMO=true` is explicitly set.
- The server uses the Supabase anon key only to verify user access tokens. Database reads and writes remain subject to RLS.
- The API currently limits requests to 30 per IP per minute. Provider keys, model identifiers, and API error details remain server-side.
- Follow-up reminders are stored and surfaced in the CRM; this release does not run a background scheduler or send email/WhatsApp messages.
- This project includes no real brokerage inventory or consumer data. Replace all demonstration listings and contacts before business use.

## API

All agent requests use `POST /api/agent` with JSON. When Supabase is configured, include `Authorization: Bearer <supabase access token>`. Requests are capped at 128 KB; malformed inputs return `400`, invalid sessions `401`, rate limits `429`, missing AI configuration `503`, and provider/structured-output failures `502`.

### Health

`GET /api/health` returns `{ "status": "ok", "aiConfigured": boolean, "cloudAuth": boolean }`. It never exposes a secret.

### Lead qualification

```json
{ "task": "qualify", "name": "Alex Morgan", "enquiry": "Looking for a 3-bedroom home in Austin under $750,000 within two months." }
```

Response `result` contains `budget`, `location`, `propertyType`, `timeline`, `requirements`, `intent`, `score` (0–100), `temperature`, `explanation`, `summary`, and `nextAction`.

### Listing-aware assistant

```json
{
  "task": "chat",
  "message": "Show me homes with a pool in Miami.",
  "history": [{ "role": "user", "content": "I need two bedrooms." }],
  "properties": []
}
```

Provide the current listing records in `properties`. The response contains a `reply`, up to three valid `propertyIds` from that inventory, and `followUpQuestion`.

### Follow-up draft

```json
{
  "task": "followup",
  "channel": "Email",
  "tone": "Friendly",
  "lead": {
    "name": "Alex Morgan",
    "budget": "$650k–$750k",
    "location": "Austin, TX",
    "requirements": "3 bedrooms, home office",
    "nextAction": "Offer two tour times",
    "summary": "Moving this summer."
  }
}
```

Supported channels: `Email`, `WhatsApp`, `Property recommendation`, `Appointment confirmation`. Tones: `Friendly`, `Professional`, `Concise`. The response contains `subject`, `message`, and `suggestedReminder`. The app saves the draft but never sends it.

### Business insights

```json
{ "task": "insights", "leads": [{ "status": "Qualified", "score": 82, "location": "Austin, TX", "propertyType": "Condo", "source": "Website" }] }
```

The response contains a grounded `headline`, `summary`, `trends`, `recommendations`, and `dailyBriefing`.
