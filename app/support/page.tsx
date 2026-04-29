import Link from 'next/link'

export default function SupportPage() {
  return (
    <main className="min-h-screen px-6 py-12 md:px-10" style={{ color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>TradeLab</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Support</h1>
        <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
          For account, payment, subscription, refund, or product support, contact us on Telegram.
        </p>
        <a
          href="https://t.me/tradelabuz_bot"
          className="mt-8 inline-flex rounded-xl px-5 py-3 text-sm font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Open @tradelabuz_bot
        </a>
        <div className="mt-10 space-y-4 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
          <p>Include your account email, payment date, and a short description of the issue.</p>
          <p>For payment questions, please include the amount and card last four digits if available. Never send full card numbers or SMS codes.</p>
        </div>
      </div>
    </main>
  )
}
