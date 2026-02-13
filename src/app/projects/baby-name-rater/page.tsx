import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Baby Name Rater | Noah Shaw',
  description:
    'A collaborative app for couples to rate and discover baby names together.',
}

export default function BabyNameRaterPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-cream/80 backdrop-blur-sm border-b border-slate/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/#projects"
            className="flex items-center gap-1.5 text-sm text-slate hover:text-teal transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-charcoal mb-4">
            Baby Name Rater
          </h1>
          <p className="text-xl text-slate leading-relaxed max-w-2xl">
            A collaborative app for couples to rate and discover baby names
            together. Swipe through names, build a shared shortlist, and find the
            perfect name.
          </p>
        </div>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-charcoal mb-6">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border border-slate/20 rounded-lg p-5">
              <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-teal"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal mb-2">
                Sign Up as a Couple
              </h3>
              <p className="text-sm text-slate leading-relaxed">
                Both partners create accounts with their email. Ratings are
                linked so you can see where you agree.
              </p>
            </div>

            <div className="border border-slate/20 rounded-lg p-5">
              <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-teal"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal mb-2">
                Rate Names 1–5
              </h3>
              <p className="text-sm text-slate leading-relaxed">
                Swipe through baby names one at a time and rate them on a 1–5
                scale. Use keyboard shortcuts for speed.
              </p>
            </div>

            <div className="border border-slate/20 rounded-lg p-5">
              <div className="w-10 h-10 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-teal"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h3 className="font-semibold text-charcoal mb-2">
                Shared Shortlist
              </h3>
              <p className="text-sm text-slate leading-relaxed">
                Names both partners rate highly automatically appear on a shared
                shortlist, making it easy to find common favorites.
              </p>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-charcoal mb-6">
            Features
          </h2>
          <ul className="space-y-3">
            {[
              'Filter by gender (boy, girl, or all names)',
              'Filter by first letter to browse specific ranges',
              'Smart ranking algorithm surfaces diverse, unrated names',
              'Real-time rating statistics and recent activity feed',
              'Database of thousands of names with cultural origin data',
              'Mobile-friendly design for rating on the go',
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-teal mt-0.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate">{feature}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tech Stack */}
        <section className="mb-16">
          <h2 className="text-2xl font-serif font-semibold text-charcoal mb-6">
            Built With
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { name: 'Next.js', detail: 'App Router' },
              { name: 'TypeScript', detail: 'End-to-end type safety' },
              { name: 'PostgreSQL', detail: 'Neon serverless' },
              { name: 'Drizzle ORM', detail: 'Type-safe queries' },
              { name: 'Tailwind CSS', detail: 'Utility-first styling' },
              { name: 'Vercel', detail: 'Deployment' },
            ].map((tech) => (
              <div
                key={tech.name}
                className="border border-slate/20 rounded-lg px-4 py-3"
              >
                <span className="font-medium text-charcoal text-sm">
                  {tech.name}
                </span>
                <span className="text-xs text-slate ml-2">{tech.detail}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Back link */}
        <div className="pt-8 border-t border-slate/20">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-teal hover:text-teal-dark transition-colors font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to all projects
          </Link>
        </div>
      </main>
    </div>
  )
}
