import Link from 'next/link'

interface Project {
  title: string
  description: string
  tags: string[]
  href: string
  external?: boolean
}

export default function Projects() {
  const projects: Project[] = [
    {
      title: 'Fraud-Safety Evaluation of Frontier Models',
      description:
        `An independent red-team study of how today's leading models behave when asked to produce fraud content. I built a corpus of realistic scam prompts — written the way an actual requester would, with no eval tells — and measured GPT-5.5, Claude Sonnet 4.6, and an open-weight model (DeepSeek V4 Pro) across plain requests, a single obfuscation wrapper, and repeated sampling, with every response labeled by an LLM judge whose reliability I checked against a cross-family panel. The findings: all three produced usable artifacts at substantial rates, a one-line roleplay wrapper converted refusals and hedges into operational output, retrying the same prompt sharply raised an attacker's odds, and the open-weight model complied almost every time — so end-to-end safety rested on the models themselves. It reflects how I think about measuring and governing AI risk in safety-critical domains.`,
      tags: ['LLM Safety', 'Evaluation', 'Red-teaming', 'Python', 'LLM-as-judge'],
      href: '/safety-eval',
    },
    {
      title: 'San Francisco — A Private Guide',
      description:
        `A personal city interface I built for my mother-in-law's month in San Francisco around the birth of my son: simple enough to share as a URL, opinionated enough to feel like my guide. Instead of spending hours wrangling Google Maps lists, I used voice prompting with a coding agent to turn favorites like Rose's polenta, Turtle Tower, Dalida, the Legion of Honor, and the de Young into a lightweight map with search, filters, and one-tap navigation. It became a small proof point for a bigger belief: AI will let more people turn their taste into personal software.`,
      tags: ['HTML', 'CSS', 'Leaflet', 'OpenStreetMap'],
      href: '/sf/',
      external: true,
    },
    {
      title: 'Shop Lens',
      description:
        `An imaginative-shopping prototype for turning an existing scene into a counterfactual one. Upload a room photo, describe the party or room you want to create in natural language, and the system uses Gemini 2.5 Pro to infer intent, query SerpApi for real inventory, and pass the product assortment into Gemini 2.5 Flash Image to recompose the scene with items you can actually buy. I built it because I love throwing themed parties but hate the search-and-revise loop of online shopping; the hard product work was giving the agent low-latency inventory and iterating until the generated images and shoppable items matched the user's taste.`,
      tags: ['Next.js', 'Gemini 2.5 Pro', 'Gemini 2.5 Flash Image', 'SerpApi', 'QStash'],
      href: '/shop-lens',
    },
    {
      title: 'Night Sky',
      description:
        'A private, browser-based sky map inspired by childhood nights at Hetch Hetchy, where a naturalist once led us out at 2 a.m. to lie under the Milky Way during a meteor shower. I ran the same prompt across Claude Code, Codex, and Antigravity to evaluate one-shot constellation accuracy, time-to-output, and qualitative UX, then productionized the strongest result into a tool that accepts real addresses and computes constellations, planets, the sun, moon, and moon phase in the browser. The learning was both technical and personal: AI can produce surprising scientific interfaces, but the craft is in making complexity legible and trustworthy.',
      tags: ['Next.js', 'TypeScript', 'Canvas', 'astronomy-engine'],
      href: '/sky',
    },
    {
      title: 'Baby Name Rater',
      description:
        `Disposable software I built while my wife and I were choosing our son's name: a small, purpose-built app for a temporary but meaningful decision. The problem was not a lack of baby-name lists; it was that tone, timing, cultural constraints, and busy schedules made preference-sharing noisy. The Hinge-like rating and matching UX gave each of us a private login, a fast flow through names, meanings, and origins, partner-aware ranking, and a shared shortlist when we both liked something. It taught me that software can structure an emotional decision without pretending to replace taste — fittingly, the name we chose, Avi, was on the list.`,
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
          {projects.map((project) => {
            const card = (
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
            )

            return project.external ? (
              <a key={project.title} href={project.href} className="block group">
                {card}
              </a>
            ) : (
              <Link key={project.title} href={project.href} className="block group">
                {card}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
