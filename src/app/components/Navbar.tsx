'use client'

import { useState, useEffect } from 'react'

interface NavbarProps {
  variant?: 'mobile' | 'desktop'
}

export default function Navbar({ variant = 'mobile' }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (variant === 'desktop') return

    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [variant])

  const navLinks = (
    <div className="flex gap-6">
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
        href="#projects"
        className="text-sm text-charcoal hover:text-teal transition-colors"
      >
        Projects
      </a>
      <a
        href="#contact"
        className="text-sm text-charcoal hover:text-teal transition-colors"
      >
        Contact
      </a>
    </div>
  )

  if (variant === 'desktop') {
    return (
      <nav className="bg-cream/80 backdrop-blur-sm border-b border-slate/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-end items-center">
          {navLinks}
        </div>
      </nav>
    )
  }

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
        {navLinks}
      </div>
    </nav>
  )
}
