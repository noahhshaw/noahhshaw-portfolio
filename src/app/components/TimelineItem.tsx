'use client'

import { useState } from 'react'

interface TimelineItemProps {
  company: string
  role: string
  dates: string
  description: string
  isEducation?: boolean
}

export default function TimelineItem({
  company,
  role,
  dates,
  description,
  isEducation = false,
}: TimelineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle()
    }
  }

  return (
    <div className="relative pl-8 pb-12 last:pb-0">
      {/* Timeline dot */}
      <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-teal border-4 border-cream" />

      {/* Timeline line */}
      <div className="absolute left-[5px] top-4 bottom-0 w-0.5 bg-slate/30 last:hidden" />

      {/* Content */}
      <div
        onClick={handleToggle}
        onKeyDown={handleKeyPress}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className="cursor-pointer group"
      >
        <div className="mb-1">
          <h3 className="text-xl font-serif font-semibold text-charcoal group-hover:text-teal transition-colors">
            {company}
          </h3>
          <p className="text-slate text-sm">
            {role} • {dates}
          </p>
        </div>

        {/* Expandable description */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
          }`}
        >
          <p className="text-slate leading-relaxed">{description}</p>
        </div>

        {/* Expand indicator */}
        <div className="mt-2 text-xs text-teal group-hover:text-teal-dark transition-colors">
          {isExpanded ? '− Show less' : '+ Show more'}
        </div>
      </div>
    </div>
  )
}
