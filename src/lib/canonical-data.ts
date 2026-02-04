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

export interface Patent {
  number: string
  title: string
  status: 'Granted' | 'Pending'
  url: string
  description: string
}

export interface CanonicalData {
  personalInfo: {
    name: string
    title: string
    tagline: string
    linkedIn: string
    location: string
    livesIn: string
    spouse: string
  }
  approvedBios: {
    short: string
    medium: string
  }
  employment: Employment[]
  education: Education[]
  skills: Skill[]
  patents: Patent[]
  personalLife: {
    hobbies: string[]
    interests: string[]
  }
  collegeActivities: string[]
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
    livesIn: 'San Francisco, CA',
    spouse: 'Anoushka Vaswani',
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
      description: 'Leading product strategy for Uber Eats Logistics and Grocery delivery, focusing on marketplace efficiency and AI/ML-powered optimization.',
      highlights: [
        'Driving AI/ML initiatives across multiple business lines',
        'Cross-functional execution with engineering, operations, and data science teams',
        'Improving delivery speed and reliability at scale',
        'Leading Grocery delivery improvements including batched delivery and matching optimizations',
        'Achieved more than $1 per trip in delivery cost savings through optimization initiatives',
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
      description: 'Worked on avionics systems and airplane-level safety analysis for the 777-9 commercial aircraft program.',
      highlights: [
        'Led airplane-level Failure Mode and Effects Analysis (FMEA) for the 777-9 program',
        'Interfaced with senior engineers across 60+ aircraft systems including engines, electrical power, avionics, flight controls, and displays',
        'Managed requirements, integration, and testing for flight control systems',
        'Collaborated with cross-functional engineering teams across global sites',
        'Worked on safety-critical systems for commercial aviation following aerospace standards (ARP4761, AS9100)',
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

  collegeActivities: [
    'Served as Sustainability Chair of fraternity, leading initiatives to reduce waste',
    'Led transition from paper plates and plastic cutlery to reusable varieties',
    'Implemented environmental sustainability programs in the fraternity house',
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

  patents: [
    {
      number: 'US12219033B2',
      title: 'Prediction engine for a network-based service',
      status: 'Granted',
      url: 'https://patents.google.com/patent/US12219033B2',
      description: 'System that uses optimization models to determine actions improving wait time, travel distance, and earnings for service providers.',
    },
    {
      number: 'US11914366B2',
      title: 'Blended operator and autonomous control in an autonomous vehicle',
      status: 'Granted',
      url: 'https://patents.google.com/patent/US11914366B2',
      description: 'System for blended control determining degree of autonomous control for each control input based on sensor data.',
    },
    {
      number: 'US20220402499A1',
      title: 'Detecting operator contact with a steering wheel',
      status: 'Granted',
      url: 'https://patents.google.com/patent/US20220402499A1',
      description: 'Method for detecting whether an operator is in contact with steering wheel by comparing measured and expected torque.',
    },
    {
      number: 'US20250217756A1',
      title: 'Real-time multi-order batching using multiple couriers',
      status: 'Granted',
      url: 'https://patents.google.com/patent/US20250217756A1',
      description: 'Systems for coordinating delivery by splitting orders between walker and vehicle couriers for efficient pickup and delivery.',
    },
    {
      number: 'US20250390832A1',
      title: 'Adjusting Signals to Shift System Resource Utilization',
      status: 'Pending',
      url: 'https://patents.google.com/patent/US20250390832A1',
      description: 'Demand shaping system that provides personalized incentives to encourage scheduling deliveries during optimal time windows for batching.',
    },
  ],

  personalLife: {
    hobbies: [
      'Running in Marin and the Presidio',
      'Completed multiple half marathons and full marathons',
      'Annual participant in Bay to Breakers',
    ],
    interests: ['Endurance running', 'Outdoor activities in the Bay Area'],
  },

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
    {
      label: 'Patent: Prediction Engine',
      url: 'https://patents.google.com/patent/US12219033B2',
      description: 'Patent for network-based service prediction engine',
    },
    {
      label: 'Patent: Blended Autonomous Control',
      url: 'https://patents.google.com/patent/US11914366B2',
      description: 'Patent for blended operator and autonomous vehicle control',
    },
    {
      label: 'Patent: Steering Wheel Contact Detection',
      url: 'https://patents.google.com/patent/US20220402499A1',
      description: 'Patent for detecting operator contact with steering wheel',
    },
    {
      label: 'Patent: Multi-Order Batching',
      url: 'https://patents.google.com/patent/US20250217756A1',
      description: 'Patent for real-time multi-order batching with multiple couriers',
    },
    {
      label: 'Patent: Demand Shaping (Pending)',
      url: 'https://patents.google.com/patent/US20250390832A1',
      description: 'Patent for adjusting signals to shift system resource utilization',
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

  // Search patents
  if (
    lowerQuery.includes('patent') ||
    lowerQuery.includes('invention') ||
    lowerQuery.includes('intellectual property')
  ) {
    for (const patent of canonicalData.patents) {
      results.push(
        `Patent ${patent.number} (${patent.status}): ${patent.title} - ${patent.description} View at: ${patent.url}`
      )
    }
  }

  // Search personal life
  if (
    lowerQuery.includes('hobby') ||
    lowerQuery.includes('hobbies') ||
    lowerQuery.includes('running') ||
    lowerQuery.includes('marathon') ||
    lowerQuery.includes('personal') ||
    lowerQuery.includes('free time') ||
    lowerQuery.includes('outside work')
  ) {
    results.push(`Hobbies: ${canonicalData.personalLife.hobbies.join('; ')}`)
  }

  // Search family/personal info
  if (
    lowerQuery.includes('wife') ||
    lowerQuery.includes('spouse') ||
    lowerQuery.includes('married') ||
    lowerQuery.includes('family') ||
    lowerQuery.includes('live')
  ) {
    results.push(`Noah lives in ${canonicalData.personalInfo.livesIn} with his wife ${canonicalData.personalInfo.spouse}.`)
  }

  // Search college activities
  if (
    lowerQuery.includes('college') ||
    lowerQuery.includes('university') ||
    lowerQuery.includes('fraternity') ||
    lowerQuery.includes('sustainability') ||
    lowerQuery.includes('extracurricular')
  ) {
    results.push(`College Activities: ${canonicalData.collegeActivities.join('; ')}`)
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
  parts.push(`Location: ${canonicalData.personalInfo.livesIn} with wife ${canonicalData.personalInfo.spouse}`)
  parts.push(`\nBio: ${canonicalData.approvedBios.medium}`)

  parts.push('\nWork Experience:')
  for (const job of canonicalData.employment) {
    parts.push(`- ${job.role} at ${job.company} (${job.startDate}-${job.endDate}): ${job.description}`)
    parts.push(`  Highlights: ${job.highlights.join('; ')}`)
  }

  parts.push('\nEducation:')
  for (const edu of canonicalData.education) {
    parts.push(`- ${edu.degree} in ${edu.field} from ${edu.institution} (${edu.startDate}-${edu.endDate})`)
  }
  parts.push(`  College Activities: ${canonicalData.collegeActivities.join('; ')}`)

  parts.push('\nSkills:')
  for (const skill of canonicalData.skills) {
    parts.push(`- ${skill.category}: ${skill.items.join(', ')}`)
  }

  parts.push('\nPatents:')
  for (const patent of canonicalData.patents) {
    parts.push(`- ${patent.title} (${patent.number}, ${patent.status}): ${patent.description} URL: ${patent.url}`)
  }

  parts.push('\nPersonal Life:')
  parts.push(`- Hobbies: ${canonicalData.personalLife.hobbies.join('; ')}`)

  return parts.join('\n')
}
