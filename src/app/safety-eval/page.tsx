import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync } from "fs";
import { join } from "path";

export const metadata: Metadata = {
  title: "Safety Behavior of Frontier Models under Realistic Fraud Requests",
  description:
    "A cross-model evaluation of GPT-5.5, Claude Sonnet 4.6, and DeepSeek V4 Pro on realistic fraud prompts — measuring harmful-compliance rates, robustness to prompt-level evasion, and the effect of repeated sampling.",
  alternates: { canonical: "/safety-eval" },
  openGraph: {
    title: "Safety Behavior of Frontier Models under Realistic Fraud Requests",
    description:
      "Cross-model fraud-safety evaluation: harmful-compliance rates, evasion robustness, and repeated-sampling risk across GPT-5.5, Claude Sonnet 4.6, and DeepSeek V4 Pro.",
    url: "/safety-eval",
    type: "article",
  },
};

// report.generated.html is the rendered report body. It is produced from the
// report's markdown source in the private fraud-safeguard-eval repo (via that
// repo's scripts/build_report_html.mjs) and copied here as published output;
// the source, converter, evaluation code, and data are not part of this repo.
const reportHtml = readFileSync(
  join(process.cwd(), "src/app/safety-eval/report.generated.html"),
  "utf8"
);

const css = `
.se-report { color:#1A1A1A; font-family: var(--font-inter), system-ui, sans-serif; line-height:1.7; font-size:1.02rem; }
.se-report h1 { font-family: var(--font-fraunces), Georgia, serif; font-weight:700; font-size:2.1rem; line-height:1.2; letter-spacing:-0.01em; margin:0 0 0.5rem; }
.se-report h2 { font-family: var(--font-fraunces), Georgia, serif; font-weight:700; font-size:1.55rem; margin:2.75rem 0 1rem; }
.se-report h3 { font-family: var(--font-fraunces), Georgia, serif; font-weight:600; font-size:1.2rem; margin:2rem 0 0.75rem; }
.se-report p { margin:0 0 1rem; color:#374151; }
.se-report a { color:#0F766E; text-decoration:underline; text-underline-offset:2px; word-break:break-word; }
.se-report a:hover { color:#0D9488; }
.se-report strong { font-weight:600; color:#1A1A1A; }
.se-report em { font-style:italic; }
.se-report ul, .se-report ol { margin:0 0 1rem; padding-left:1.4rem; color:#374151; }
.se-report ul { list-style:disc; }
.se-report ol { list-style:decimal; }
.se-report li { margin:0.35rem 0; }
.se-report ul ul { list-style:circle; margin:0.4rem 0 0.4rem 0.4rem; }
.se-report hr { border:none; border-top:1px solid #e5e7eb; margin:2.5rem 0; }
.se-report blockquote { border-left:3px solid #0D9488; background:#f0fdfa; margin:0 0 1rem; padding:0.65rem 1rem; color:#334155; border-radius:0 6px 6px 0; }
.se-report code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:0.86em; background:rgba(13,148,136,0.10); color:#0F766E; padding:0.1rem 0.35rem; border-radius:4px; }
.se-report pre { background:#0f172a; color:#e2e8f0; padding:1rem 1.1rem; border-radius:8px; overflow-x:auto; margin:0 0 1.25rem; font-size:0.82rem; line-height:1.55; }
.se-report pre code { background:none; color:inherit; padding:0; font-size:inherit; }
.se-report .tablewrap { overflow-x:auto; margin:0 0 1.25rem; }
.se-report table { border-collapse:collapse; width:100%; font-size:0.86rem; }
.se-report th, .se-report td { border:1px solid #e2e8f0; padding:0.45rem 0.6rem; text-align:left; vertical-align:top; }
.se-report thead th { background:#f0fdfa; color:#0F766E; font-weight:600; }
.se-report tbody tr:nth-child(even) { background:#faf8f5; }
.se-report .fig { text-align:center; margin:1.5rem 0; }
.se-report .fig img { max-width:100%; height:auto; border:1px solid #e5e7eb; border-radius:8px; background:#fff; }
.se-report > p:first-of-type { color:#6B7280; margin-top:0.25rem; }
`;

export default function SafetyEvalPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-50 bg-cream/80 backdrop-blur-sm border-b border-slate/10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-teal transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to noahhshaw.com
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <article className="se-report" dangerouslySetInnerHTML={{ __html: reportHtml }} />
      </main>
    </div>
  );
}
