# Het betere GP spel

Production-ready project structure built with **Next.js 14**, **TypeScript**, and the **App Router**.

## Tech stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- ESLint (`next/core-web-vitals` + `next/typescript`)
- Supabase (`@supabase/supabase-js`)

## Project structure

```text
.
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── env.ts
│   │       ├── index.ts
│   │       └── server.ts
│   └── styles/
│       └── globals.css
├── .env.example
├── .eslintrc.json
├── next.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## Getting started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project values.

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3) Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Supabase setup

Minimal helper files are included in `src/lib/supabase`:

- `client.ts` – create a browser-side Supabase client.
- `server.ts` – create a server-side Supabase client for App Router server code.
- `env.ts` – centralized environment variable validation.
- `index.ts` – barrel exports for convenient imports.

Example usage:

```ts
import { createBrowserSupabaseClient } from "@/lib/supabase";

const supabase = createBrowserSupabaseClient();
```

```ts
import { createServerSupabaseClient } from "@/lib/supabase";

const supabase = createServerSupabaseClient();
```

## Available scripts

- `npm run dev` – Start Next.js in development mode.
- `npm run build` – Build for production.
- `npm run start` – Run the production server.
- `npm run lint` – Run ESLint checks.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Vercel detects Next.js automatically; keep the default build settings.
4. Add environment variables in the Vercel project settings before deploying.
