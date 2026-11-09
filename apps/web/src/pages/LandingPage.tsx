import { motion } from 'framer-motion';
import { ArrowRight, EyeOff, Link2, Sparkles, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/layout/SiteHeader';
import { BrandMark } from '../components/ui/BrandMark';

const fade = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};

export function LandingPage() {
  return (
    <div>
      <SiteHeader />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 honeycomb opacity-60" aria-hidden />
        <div className="db-shell relative grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <motion.div {...fade} transition={{ duration: 0.55 }}>
            <p className="db-chip mb-5">
              <Sparkles size={14} /> Consent-first social discovery
            </p>
            <h1 className="db-display max-w-xl text-5xl leading-[1.02] text-ink-950 sm:text-6xl lg:text-7xl">
              Detsbee
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600 sm:text-xl">
              Discover the little things about people you care about — and how they see you —
              through a playful, private, two-sided game.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="db-btn db-btn-primary">
                Open your hive <ArrowRight size={18} />
              </Link>
              <a href="#how" className="db-btn db-btn-ghost">
                See how it works
              </a>
            </div>
            <p className="mt-5 text-sm text-ink-500">
              Demo ready: <code className="rounded bg-white/70 px-1.5 py-0.5">demo@detsbee.app</code> /{' '}
              <code className="rounded bg-white/70 px-1.5 py-0.5">honeycomb123</code>
            </p>
          </motion.div>

          <motion.div
            className="db-dark-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.1 }}
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-honey-400/20 blur-3xl" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-honey-300">
              Live preview
            </p>
            <h2 className="db-display mt-3 text-3xl">A discovery in motion</h2>
            <div className="mt-6 space-y-3">
              {[
                { label: 'Round 1 · About me', text: 'Favourite rainy-day food?' },
                { label: 'Visibility', text: 'Share with Avery · or keep private' },
                { label: 'Round 2 · How I see you', text: 'Three words for Avery?' },
              ].map((card, i) => (
                <motion.div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.12 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-honey-300">
                    {card.label}
                  </p>
                  <p className="mt-1 text-lg text-cream">{card.text}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-honey-400/15 px-4 py-3 text-sm text-honey-100">
              <ShieldCheck size={18} />
              Skip anytime. Private answers never reach the creator.
            </div>
          </motion.div>
        </div>
      </section>

      <section id="how" className="db-shell py-20">
        <div className="max-w-2xl">
          <p className="db-chip">How Detsbee works</p>
          <h2 className="db-display mt-4 text-4xl text-ink-950 sm:text-5xl">
            Two gentle rounds. One honest reveal.
          </h2>
          <p className="mt-4 text-ink-600">
            No awkward interrogation. Just curated curiosity with clear consent at every step.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Link2,
              title: 'Invite',
              body: 'Create a discovery, choose questions, and share a unique honeycomb link.',
            },
            {
              icon: Sparkles,
              title: 'Play',
              body: 'Respondents answer About Me, then How I See You — skip or privatize freely.',
            },
            {
              icon: EyeOff,
              title: 'Reveal',
              body: 'Creators see only shared answers. Respondents keep a private receipt.',
            },
          ].map((step) => (
            <article key={step.title} className="db-glass rounded-[1.75rem] p-6">
              <step.icon className="text-honey-600" />
              <h3 className="db-display mt-4 text-2xl">{step.title}</h3>
              <p className="mt-2 text-ink-600">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="db-shell pb-20">
        <div className="db-dark-panel overflow-hidden rounded-[2rem] p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="db-display text-4xl">Shared Ground & Perspective Cards</h2>
              <p className="mt-4 max-w-md text-ink-300">
                When interests overlap, Detsbee surfaces Shared Ground. Warm answers become
                Perspective Cards — memorable, not clinical.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Cooking', 'Night walks', 'Indie music', 'Quiet humour'].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-honey-400/20 bg-honey-400/10 px-4 py-5 text-center text-honey-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="db-shell pb-24">
        <div className="db-glass rounded-[2rem] p-8 sm:p-10">
          <p className="db-chip">
            <ShieldCheck size={14} /> Privacy is the product
          </p>
          <h2 className="db-display mt-4 text-4xl">Designed so respect is default.</h2>
          <ul className="mt-6 grid gap-3 text-ink-700 md:grid-cols-2">
            {[
              'No answers collected before consent',
              'Per-answer Share / Private / Skip controls',
              'Invitation tokens hashed at rest',
              'Private answers blocked in creator APIs',
              'Respondent receipts without forced email',
              'Creator and respondent deletion workflows',
            ].map((item) => (
              <li key={item} className="rounded-2xl bg-white/60 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-ink-900/5 bg-ink-950 text-cream">
        <div className="db-shell flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandMark light />
            <p className="mt-3 max-w-sm text-sm text-ink-300">
              Detsbee helps people discover little things — with curiosity, consent, and care.
            </p>
          </div>
          <div className="text-sm text-ink-400">
            <p>© {new Date().getFullYear()} Detsbee</p>
            <p className="mt-1">Built as a privacy-first social discovery product.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
