import TimelineItem, { IllustrationType } from './TimelineItem'

interface Experience {
  company: string
  role: string
  dates: string
  description: string
  isEducation?: boolean
  illustrationType?: IllustrationType
}

export default function Timeline() {
  const experiences: Experience[] = [
    {
      company: 'Uber',
      role: 'Senior Product Manager, Marketplace',
      dates: '2022 - Present',
      description:
        'Leading product strategy for Uber Eats Logistics, focusing on marketplace efficiency and AI/ML-powered optimization. Driving cross-functional execution across engineering, operations, and data science teams to improve delivery speed and reliability at scale.',
      illustrationType: 'marketplace',
    },
    {
      company: 'Ghost Autonomy',
      role: 'Product Manager',
      dates: '2020 - 2022',
      description:
        'Early team member at Khosla Ventures-backed autonomous vehicle startup. Led the human-machine interface product from concept through public road deployment. Managed cross-functional teams to deliver safety-critical software for Level 2+ autonomous driving systems.',
      illustrationType: 'autonomous-vehicle',
    },
    {
      company: 'Uber',
      role: 'Data Scientist',
      dates: '2018 - 2020',
      description:
        'Built predictive models and analytics tools for marketplace optimization. Developed machine learning systems to improve driver-rider matching and reduce wait times. Collaborated with product and engineering teams to deploy data-driven features at scale.',
      illustrationType: 'uber-data',
    },
    {
      company: 'Boeing',
      role: 'Systems Engineer',
      dates: '2016 - 2018',
      description:
        'Worked on avionics systems for commercial aircraft programs. Managed requirements, integration, and testing for safety-critical flight control systems. Collaborated with cross-functional engineering teams across multiple global sites.',
      illustrationType: 'aerospace',
    },
    {
      company: 'Northwestern University',
      role: 'BS Mechanical Engineering',
      dates: '2012 - 2016',
      description:
        'Graduated with a Bachelor of Science in Mechanical Engineering. Focused on controls, robotics, and design. Participated in research projects and engineering design teams.',
      isEducation: true,
      illustrationType: 'northwestern',
    },
  ]

  return (
    <section id="experience" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-charcoal mb-12">
          Experience
        </h2>
        <div className="relative">
          {experiences.map((exp, index) => (
            <TimelineItem
              key={index}
              company={exp.company}
              role={exp.role}
              dates={exp.dates}
              description={exp.description}
              isEducation={exp.isEducation}
              illustrationType={exp.illustrationType}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
