# TradeLab

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
| Payments    | Click Merchant API                          |

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
tradelab/
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
cp .env.example .env.local
```

Fill in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_APP_URL=https://tradelab.uz
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=replace-with-a-long-random-secret
ADMIN_EMAILS=bekhruzjke@gmail.com

CLICK_API_URL=https://api.click.uz/v2/merchant
CLICK_SERVICE_ID=your-click-service-id
CLICK_MERCHANT_ID=your-click-merchant-id
CLICK_MERCHANT_USER_ID=your-click-merchant-user-id
CLICK_SECRET_KEY=your-click-secret-key
CLICK_SUBSCRIPTION_AMOUNT_UZS=99000
```

Found at: Supabase → **Project Settings → API**

Click values come from your Click Business/Merchant cabinet. The suggested starter price is `99000` UZS per month. Keep `CLICK_SUBSCRIPTION_AMOUNT_UZS=0` only for a free trial/card-verification launch.

`ADMIN_EMAILS` is a comma-separated allowlist for `/dashboard/admin`. The first production admin is `bekhruzjke@gmail.com`.

### 4. Supabase Auth settings

In Supabase → **Authentication → URL Configuration**:
- Site URL: `https://tradelab.uz`
- Redirect URLs: `https://tradelab.uz/auth/verify`

For local development, also add `http://localhost:3000/auth/verify` to Redirect URLs.

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

Before public launch:
- Run every Supabase migration in `supabase/migrations` in order.
- In Supabase Auth, set the production Site URL and `/auth/verify` redirect URL.
- In Click Business, configure the production merchant credentials and callback/return URLs for your deployed domain.
- Rotate any credentials that were ever committed or shared.
- Add `CRON_SECRET` in Vercel. Vercel Cron calls `/api/subscription/renew` daily; the endpoint renews subscriptions whose expiry date has arrived.

## Production Operations

### Supabase Auth emails

In Supabase Dashboard → Authentication → Email Templates:
- Update the confirmation email subject to include TradeLab.
- Keep the confirmation link token provided by Supabase in the template.
- Use support contact `@tradelabuz_bot`.
- Send users back to `https://tradelab.uz/auth/verify`.

### Backups

In Supabase Dashboard → Project Settings → Database → Backups:
- Confirm automatic backups are enabled for the production project.
- Before major schema changes, create a manual backup or export.
- Keep migrations in `supabase/migrations` as the source of truth for schema history.

### Renewals

Vercel Cron runs `/api/subscription/renew` daily at 02:00 UTC. It charges active users whose `subscription_expires_at` is due, creates a `subscription_transactions` row, and extends access by one month after a successful Click payment.
