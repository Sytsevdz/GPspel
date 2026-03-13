# Fantasy F1 Manager

Initial production-ready project structure built with **Next.js 14**, **TypeScript**, and the **App Router**.

## Tech stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- ESLint (`next/core-web-vitals` + `next/typescript`)

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
│   └── styles/
│       └── globals.css
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

### 2) Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available scripts

- `npm run dev` – Start Next.js in development mode.
- `npm run build` – Build for production.
- `npm run start` – Run the production server.
- `npm run lint` – Run ESLint checks.
