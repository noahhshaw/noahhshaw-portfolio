/**
 * Canonical Data Source for Noah Shaw's Professional Information
 * This is the ONLY source of truth for the chatbot's RAG system.
 * The chatbot must NEVER infer or extrapolate beyond this data.
 */

export interface Employment {
  company: string
  role: string
  startDate: string
  endDate: string | 'Present'
  description: string
  highlights: string[]
}

export interface Education {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
}

export interface Skill {
  category: string
  items: string[]
}

export interface CanonicalData {
  personalInfo: {
    name: string
    title: string
    tagline: string
    linkedIn: string
    location: string
  }
  approvedBios: {
    short: string
    medium: string
  }
  employment: Employment[]
  education: Education[]
  skills: Skill[]
  approvedLinks: {
    label: string
    url: string
    description: string
  }[]
}

export const canonicalData: CanonicalData = {
  personalInfo: {
    name: 'Noah Shaw',
    title: 'Senior Product Manager',
    tagline: 'Product leader building and scaling AI/ML products in complex and safety-critical domains',
    linkedIn: 'https://www.linkedin.com/in/noahhshaw/',
    location: 'San Francisco Bay Area',
  },

  approvedBios: {
    short: 'Product leader with 10+ years of experience spanning data science, autonomous vehicles, and marketplace optimization.',
    medium: 'Product leader with 10+ years of experience spanning data science, autonomous vehicles, and marketplace optimization. Currently leading product for Uber Eats Logistics, driving AI/ML initiatives and cross-functional execution across multiple business lines. Previously an early hire at Ghost Autonomy (Khosla-funded AV startup), where I helped scale the organization and led the human-machine interface for autonomous driving systems through public road deployment.',
  },

  employment: [
    {
      company: 'Uber',
      role: 'Senior Product Manager, Marketplace',
      startDate: '2022',
      endDate: 'Present',
      description: 'Leading product strategy for Uber Eats Logistics, focusing on marketplace efficiency and AI/ML-powered optimization.',
      highlights: [
        'Driving AI/ML initiatives across multiple business lines',
        'Cross-functional execution with engineering, operations, and data science teams',
        'Improving delivery speed and reliability at scale',
      ],
    },
    {
      company: 'Ghost Autonomy',
      role: 'Product Manager',
      startDate: '2020',
      endDate: '2022',
      description: 'Early team member at Khosla Ventures-backed autonomous vehicle startup.',
      highlights: [
        'Led human-machine interface product from concept through public road deployment',
        'Managed cross-functional teams for safety-critical software delivery',
        'Helped scale the organization during rapid growth phase',
        'Delivered Level 2+ autonomous driving systems',
      ],
    },
    {
      company: 'Uber',
      role: 'Data Scientist',
      startDate: '2018',
      endDate: '2020',
      description: 'Built predictive models and analytics tools for marketplace optimization.',
      highlights: [
        'Developed machine learning systems for driver-rider matching',
        'Reduced wait times through data-driven optimization',
        'Collaborated with product and engineering teams to deploy features at scale',
      ],
    },
    {
      company: 'Boeing',
      role: 'Systems Engineer',
      startDate: '2016',
      endDate: '2018',
      description: 'Worked on avionics systems for commercial aircraft programs.',
      highlights: [
        'Managed requirements, integration, and testing for flight control systems',
        'Collaborated with cross-functional engineering teams across global sites',
        'Worked on safety-critical systems for commercial aviation',
      ],
    },
  ],

  education: [
    {
      institution: 'Northwestern University',
      degree: 'Bachelor of Science',
      field: 'Mechanical Engineering',
      startDate: '2012',
      endDate: '2016',
    },
  ],

  skills: [
    {
      category: 'Product Management',
      items: ['Product Strategy', 'Roadmap Planning', 'Cross-functional Leadership', 'Stakeholder Management', 'User Research'],
    },
    {
      category: 'Technical',
      items: ['AI/ML Products', 'Data Science', 'Marketplace Systems', 'Autonomous Vehicles', 'Safety-Critical Systems'],
    },
    {
      category: 'Domains',
      items: ['Logistics', 'Mobility', 'Autonomous Driving', 'Aviation', 'Two-Sided Marketplaces'],
    },
  ],

  approvedLinks: [
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/noahhshaw/',
      description: "Noah's LinkedIn profile",
    },
    {
      label: 'About Section',
      url: '#about',
      description: 'Learn more about Noah',
    },
    {
      label: 'Experience Section',
      url: '#experience',
      description: "View Noah's work history",
    },
    {
      label: 'Contact Section',
      url: '#contact',
      description: 'Send Noah a message',
    },
  ],
}

/**
 * Search the canonical data for relevant information
 * Returns matching content or null if not found
 */
export function searchCanonicalData(query: string): string | null {
  const lowerQuery = query.toLowerCase()
  const results: string[] = []

  // Search employment
  for (const job of canonicalData.employment) {
    if (
      lowerQuery.includes(job.company.toLowerCase()) ||
      lowerQuery.includes(job.role.toLowerCase()) ||
      job.description.toLowerCase().includes(lowerQuery) ||
      job.highlights.some(h => h.toLowerCase().includes(lowerQuery))
    ) {
      results.push(
        `${job.role} at ${job.company} (${job.startDate}-${job.endDate}): ${job.description} Key highlights: ${job.highlights.join('; ')}`
      )
    }
  }

  // Search education
  for (const edu of canonicalData.education) {
    if (
      lowerQuery.includes(edu.institution.toLowerCase()) ||
      lowerQuery.includes(edu.field.toLowerCase()) ||
      lowerQuery.includes('education') ||
      lowerQuery.includes('degree') ||
      lowerQuery.includes('university') ||
      lowerQuery.includes('college')
    ) {
      results.push(
        `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.startDate}-${edu.endDate})`
      )
    }
  }

  // Search skills
  for (const skillCategory of canonicalData.skills) {
    if (
      lowerQuery.includes('skill') ||
      lowerQuery.includes('expertise') ||
      lowerQuery.includes('experience') ||
      skillCategory.items.some(s => lowerQuery.includes(s.toLowerCase()))
    ) {
      results.push(`${skillCategory.category}: ${skillCategory.items.join(', ')}`)
    }
  }

  // General queries about Noah
  if (
    lowerQuery.includes('who is') ||
    lowerQuery.includes('tell me about') ||
    lowerQuery.includes('background') ||
    lowerQuery.includes('summary')
  ) {
    results.push(canonicalData.approvedBios.medium)
  }

  return results.length > 0 ? results.join('\n\n') : null
}

/**
 * Get a formatted summary of all canonical data
 */
export function getFullContext(): string {
  const parts: string[] = []

  parts.push(`Name: ${canonicalData.personalInfo.name}`)
  parts.push(`Title: ${canonicalData.personalInfo.title}`)
  parts.push(`Tagline: ${canonicalData.personalInfo.tagline}`)
  parts.push(`\nBio: ${canonicalData.approvedBios.medium}`)

  parts.push('\nWork Experience:')
  for (const job of canonicalData.employment) {
    parts.push(`- ${job.role} at ${job.company} (${job.startDate}-${job.endDate}): ${job.description}`)
  }

  parts.push('\nEducation:')
  for (const edu of canonicalData.education) {
    parts.push(`- ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.startDate}-${edu.endDate})`)
  }

  parts.push('\nSkills:')
  for (const skill of canonicalData.skills) {
    parts.push(`- ${skill.category}: ${skill.items.join(', ')}`)
  }

  return parts.join('\n')
}
