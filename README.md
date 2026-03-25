# BackTest App

Candle-by-candle trading simulator — **Next.js 14** (App Router) + **Supabase** + **TypeScript** + **Tailwind CSS** + **TradingView lightweight-charts**.

---

## Tech Stack:

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Frontend    | Next.js 14 (App Router)                     |
| Language    | TypeScript                                  |
| Styling     | Tailwind CSS + CSS variables (dark/light)   |
| Backend/DB  | Supabase (Auth + PostgreSQL + RLS)          |
| Charts      | TradingView `lightweight-charts` v4         |
| Market Data | Dukascopy XAUUSD M1 CSV (real tick data)    |
| Deployment  | Vercel (recommended)                        |

---

## Features

- 🌐 **3 languages** — English, Russian, Uzbek (client-side i18n, localStorage-persisted)
- 🌙 **Dark / Light mode** — toggle in sidebar, nav, and settings; CSS variables throughout
- 🎨 **Blue primary colour** — consistent accent across all components
- 🔐 **Supabase email auth** — register → verify email → sign in
- 🕯 **Real Dukascopy data** — XAUUSD M1 bid, Jan 2025 (17,834 active candles)
- 📈 **TradingView chart** — `lightweight-charts`, candlestick, theme-aware
- ⏭ **Candle replay** — Next Candle + Skip (3/5/10/15/30/60/120/240)
- 💰 **Trade execution** — Buy/Sell with SL/TP drawn on chart, auto-trigger per candle
- 🗄 **Full Supabase persistence** — sessions, trades, candle cache, profiles
- 📉 **Analytics** — Equity curve, win rate, profit factor, avg R:R, weekday bar chart

---

## Project Structure

```
backtest-app/
├── app/
│   ├── layout.tsx                    # Root layout (ThemeProvider → AuthProvider → LangProvider)
│   ├── globals.css                   # CSS variables: dark + light theme, blue accent
│   ├── page.tsx                      # Root → redirect
│   ├── landing/page.tsx              # Public landing: hero, preview chart, features
│   ├── auth/
│   │   ├── layout.tsx                # Centred auth layout with theme toggle
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── verify/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx                # Sidebar + theme toggle
│   │   ├── sessions/page.tsx         # Session list + create modal (XAUUSD only)
│   │   ├── analytics/page.tsx        # Stats cards + equity curve + weekday chart
│   │   └── settings/page.tsx         # Profile, language, appearance, password
│   └── workspace/[id]/page.tsx       # Full-screen candle replay workspace
│
├── components/
│   ├── ui/index.tsx                  # Button, Input, Select, Badge, Modal, TabBar,
│   │                                 # StatCard, Alert, Spinner, ThemeToggle
│   ├── chart/
│   │   ├── WorkspaceChart.tsx        # lightweight-charts (theme-aware, SL/TP lines)
│   │   └── PreviewChart.tsx          # Landing preview chart (real CSV data)
│   └── analytics/
│       ├── EquityCurveChart.tsx      # Canvas equity curve (theme-aware)
│       └── DayPerformanceChart.tsx   # Canvas weekday bar chart (theme-aware)
│
├── contexts/
│   ├── ThemeContext.tsx              # dark/light toggle, data-theme attribute
│   ├── AuthContext.tsx               # Supabase user + profile
│   └── LangContext.tsx               # i18n (en/ru/uz), localStorage-persisted
│
├── lib/
│   ├── loadCsvData.ts               # Fetch + parse /public/xauusd-m1-2025.csv
│   ├── supabase/client.ts           # Browser Supabase client
│   ├── supabase/server.ts           # Server Supabase client (RSC / middleware)
│   ├── i18n.ts                      # All translations (en/ru/uz)
│   └── utils.ts                     # Candle gen, stats, calcPnl, formatters
│
├── data/symbols.ts                  # 18 trading instruments (XAUUSD active)
├── types/index.ts                   # TypeScript interfaces
├── middleware.ts                    # Route protection via Supabase session
├── public/
│   └── xauusd-m1-2025.csv          # Real Dukascopy XAUUSD M1 data (28,800 rows)
└── supabase/migrations/001_init.sql # Full DB schema + RLS policies
```

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Create Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) → create new project
2. **SQL Editor** → paste `supabase/migrations/001_init.sql` → Run

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Found at: Supabase → **Project Settings → API**

### 4. Supabase Auth settings

In Supabase → **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/verify`

### 5. Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Market Data

The app ships with **real Dukascopy XAUUSD M1 bid data** in `public/xauusd-m1-2025.csv`:

| Property  | Value                          |
|-----------|--------------------------------|
| Symbol    | XAU/USD (Gold)                 |
| Timeframe | M1 (1-minute candles)          |
| Range     | 2025-01-01 → 2025-01-20        |
| Rows      | 28,800 total, 17,834 active    |
| Price     | ~$2,624 → $2,711               |
| Format    | `timestamp_ms,open,high,low,close` |

Flat rows (weekends/holidays where high === low) are automatically skipped by `lib/loadCsvData.ts`.

**To add more data:** Export additional periods from Dukascopy in CSV format, concatenate them (keeping one header), and replace `public/xauusd-m1-2025.csv`. No code changes needed.

---

## Database Schema

| Table          | Purpose                                         |
|----------------|-------------------------------------------------|
| `profiles`     | Display name, language preference               |
| `sessions`     | Replay sessions with candle progress + balance  |
| `trades`       | All trades: entry/exit/SL/TP/PnL/weekday        |
| `candle_cache` | Serialised candle array (unused when CSV loads) |

All tables have **Row Level Security** — users only access their own rows.

---

## Deployment

```bash
npm run build
```

Push to GitHub → connect to [Vercel](https://vercel.com). Add the same env vars in Vercel dashboard.
