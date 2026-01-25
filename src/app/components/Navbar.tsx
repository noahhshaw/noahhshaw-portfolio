'use client'

import { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-cream shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <a
          href="#"
          className="text-xl font-serif font-semibold text-charcoal hover:text-teal transition-colors"
        >
          Noah Shaw
        </a>
        <div className="flex gap-8">
          <a
            href="#about"
            className="text-sm text-charcoal hover:text-teal transition-colors"
          >
            About
          </a>
          <a
            href="#experience"
            className="text-sm text-charcoal hover:text-teal transition-colors"
          >
            Experience
          </a>
          <a
            href="#contact"
            className="text-sm text-charcoal hover:text-teal transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </nav>
  )
}
