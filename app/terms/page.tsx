import Link from 'next/link'

const sections = [
  {
    title: 'Service',
    body: 'TradeLab provides a candle-by-candle trading replay and analytics platform for education, practice, and performance review. TradeLab is not a broker, investment adviser, signal provider, or financial institution.',
  },
  {
    title: 'No Financial Advice',
    body: 'All market data, replay tools, analytics, and educational materials are provided for informational purposes only. You are responsible for your own trading decisions and risk management.',
  },
  {
    title: 'Account Access',
    body: 'You are responsible for keeping your login credentials secure. We may suspend access if an account is used abusively, attempts to bypass payment, harms the service, or violates these terms.',
  },
  {
    title: 'Subscriptions',
    body: 'Paid access is provided through the active subscription shown in your account. Unless cancelled, subscriptions may renew automatically using the payment method authorized through Click. Prices are shown before payment and may change for future billing periods.',
  },
  {
    title: 'Payments',
    body: 'Payments are processed through Click. TradeLab does not store full card numbers or CVV codes. We store limited payment metadata such as card network, last four digits, payment status, transaction references, and subscription dates.',
  },
  {
    title: 'Cancellation',
    body: 'You may cancel your subscription from the subscription page or by contacting support. Cancellation stops future renewals; access may remain available until the end of the paid period unless otherwise required by law.',
  },
  {
    title: 'Acceptable Use',
    body: 'Do not reverse engineer the service, abuse APIs, scrape data at scale, resell access, share accounts commercially, upload malicious content, or interfere with other users.',
  },
  {
    title: 'Availability',
    body: 'We work to keep TradeLab reliable, but we do not guarantee uninterrupted service. Maintenance, provider outages, data-source changes, or payment-provider issues may affect access.',
  },
  {
    title: 'Contact',
    body: 'For support, billing questions, or account issues, contact us on Telegram at @tradelabuz_bot.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-12 md:px-10" style={{ color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>TradeLab</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          Last updated: April 30, 2026. These starter terms are provided for launch readiness and should be reviewed for your business entity and jurisdiction.
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
