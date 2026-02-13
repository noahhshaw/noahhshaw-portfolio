import Link from 'next/link'

interface Project {
  title: string
  description: string
  tags: string[]
  href: string
}

export default function Projects() {
  const projects: Project[] = [
    {
      title: 'Baby Name Rater',
      description:
        'A collaborative app for couples to rate and discover baby names together. Features a Tinder-style swiping interface, smart ranking algorithm, and a shared shortlist to find the perfect name.',
      tags: ['Next.js', 'TypeScript', 'PostgreSQL', 'Tailwind CSS'],
      href: '/projects/baby-name-rater',
    },
  ]

  return (
    <section id="projects" className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-charcoal mb-12">
          Projects
        </h2>
        <div className="space-y-6">
          {projects.map((project) => (
            <Link
              key={project.title}
              href={project.href}
              className="block group"
            >
              <div className="border border-slate/20 rounded-lg p-6 transition-all duration-200 hover:border-teal/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-serif font-semibold text-charcoal group-hover:text-teal transition-colors mb-2">
                      {project.title}
                    </h3>
                    <p className="text-slate leading-relaxed mb-4">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2.5 py-1 rounded-full bg-teal/10 text-teal-dark font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-slate/40 group-hover:text-teal transition-colors mt-1 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
