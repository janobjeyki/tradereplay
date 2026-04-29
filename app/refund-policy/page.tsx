import Link from 'next/link'

const sections = [
  {
    title: 'Subscription Charges',
    body: 'TradeLab subscriptions are charged through Click. The amount and billing period are shown before payment. Monthly subscriptions renew automatically while the subscription is active and a valid Click card token is available.',
  },
  {
    title: 'Refund Window',
    body: 'If you paid for TradeLab and cannot access the service due to a technical issue on our side, contact support within 7 days of the payment. We will either restore access, extend your subscription, or issue a refund where appropriate.',
  },
  {
    title: 'Non-Refundable Cases',
    body: 'Refunds may be declined for completed billing periods, account misuse, violation of the Terms, or cases where the service was available and used normally.',
  },
  {
    title: 'Cancellation',
    body: 'You can cancel future renewals from the subscription page or by contacting support. Cancellation does not automatically refund prior paid periods.',
  },
  {
    title: 'How to Request Help',
    body: 'Contact @tradelabuz_bot on Telegram with your account email, payment date, approximate amount, and a short description of the issue.',
  },
]

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen px-6 py-12 md:px-10" style={{ color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>TradeLab</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Refund Policy</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          Last updated: April 30, 2026.
        </p>
        <div className="mt-10 space-y-8">
          {sections.map(section => (
            <section key={section.title}>
              <h2 className="text-lg font-bold">{section.title}</h2>
              <p className="mt-2 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
