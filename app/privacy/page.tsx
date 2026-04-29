import Link from 'next/link'

const sections = [
  {
    title: 'Information We Collect',
    body: 'We collect account information such as email address, display name, language preference, subscription status, and usage data related to sessions, trades, strategies, and analytics. Payment card processing is handled by Click; TradeLab stores only limited payment metadata.',
  },
  {
    title: 'How We Use Information',
    body: 'We use information to create accounts, authenticate users, provide trading replay tools, save user sessions, manage subscriptions, process renewals, improve the product, detect abuse, and provide support.',
  },
  {
    title: 'Payment Data',
    body: 'TradeLab does not store full card numbers or CVV codes. Click may tokenize payment cards. We store card network, last four digits, token references, transaction status, billing amount, and renewal dates so subscriptions can operate.',
  },
  {
    title: 'Service Providers',
    body: 'We use Supabase for authentication and database services, Vercel for hosting, and Click for payments. These providers process data only as needed to operate the service.',
  },
  {
    title: 'Data Retention',
    body: 'We keep account, session, trade, and payment metadata while your account is active or as needed for legal, security, tax, accounting, and support purposes. You may request account deletion through support.',
  },
  {
    title: 'Security',
    body: 'We use hosted infrastructure, access controls, row-level security, and secret-managed payment credentials. No online service is perfectly secure, so users should use strong passwords and protect their email accounts.',
  },
  {
    title: 'Your Choices',
    body: 'You can update profile settings in the app and cancel subscriptions from the subscription page. For data access or deletion requests, contact support.',
  },
  {
    title: 'Contact',
    body: 'For privacy questions or requests, contact us on Telegram at @tradelabuz_bot.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-12 md:px-10" style={{ color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>TradeLab</Link>
        <h1 className="mt-6 text-4xl font-black tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
          Last updated: April 30, 2026. This policy explains the default data practices for TradeLab.
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
