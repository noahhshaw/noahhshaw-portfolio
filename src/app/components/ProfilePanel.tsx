'use client'

export default function ProfilePanel() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-8 lg:px-12 py-16 lg:py-0 bg-cream lg:border-r lg:border-slate/10">
      {/* Profile Picture */}
      <div className="w-52 h-52 lg:w-64 lg:h-64 rounded-full overflow-hidden mb-6 lg:mb-8 shadow-sm">
        <img src="/profile.jpg" alt="Noah Shaw" className="w-full h-full object-cover" />
      </div>

      {/* Name */}
      <h1 className="text-4xl lg:text-5xl font-serif font-bold text-charcoal mb-4 text-center">
        Noah Shaw
      </h1>

      {/* Headline */}
      <p className="text-lg lg:text-xl text-slate text-center max-w-sm mb-6 lg:mb-8 leading-relaxed">
        Product leader building and scaling AI/ML products in complex and safety-critical domains
      </p>

      {/* Social Links */}
      <div className="flex gap-4 mb-8 lg:mb-12">
        <a
          href="https://www.linkedin.com/in/noahhshaw/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-teal hover:text-teal-dark transition-colors"
          aria-label="LinkedIn"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
          <span className="text-sm font-medium">LinkedIn</span>
        </a>
      </div>
    </div>
  )
}
