'use client';

import { useEffect } from 'react';

import { analytics } from '@/lib/analytics';

const highlights = [
  {
    title: 'Shared goals, shared clarity',
    description:
      'Invite teammates, partners, or family members to co-create plans and keep every milestone in view.',
  },
  {
    title: 'Predictable returns',
    description:
      'Track progress against a fixed return schedule so everyone understands how contributions grow over time.',
  },
  {
    title: 'Neutral guidance',
    description:
      'GoalSplit never recommends products. Instead, it focuses on transparent planning tools you control.',
  },
];

export default function HomePage(): JSX.Element {
  useEffect(() => {
    analytics.init();
    analytics.track('page_view', {
      location: 'home_page',
    });
  }, []);

  const handleCtaClick = (cta: 'planner' | 'insights') => {
    analytics.track('marketing_cta_clicked', {
      location: 'home_page',
      cta,
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-20 px-6 py-16 sm:px-10 lg:px-12">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1 text-sm font-semibold text-primary-700">
            GoalSplit Planner
          </span>
          <h1 className="font-display text-4xl font-bold leading-tight text-neutral-900 sm:text-5xl">
            Plan shared goals with confidence and a clear path to a fixed return.
          </h1>
          <p className="max-w-xl text-lg text-neutral-700 sm:text-xl">
            GoalSplit gives groups a single source of truth for contribution schedules, role clarity, and progress
            tracking. No sales pitches—just a calm workspace to align on what matters.
          </p>
          <div className="flex flex-wrap gap-4">
            <a className="btn-primary" href="#features" onClick={() => handleCtaClick('planner')}>
              Explore the planner
            </a>
            <a
              className="inline-flex items-center justify-center rounded-lg border border-primary-200 px-6 py-3 font-semibold text-primary-700 transition hover:border-primary-300 hover:text-primary-800"
              href="#insights"
              onClick={() => handleCtaClick('insights')}
            >
              View shared insights
            </a>
          </div>
        </div>
        <div className="rounded-3xl border border-primary-100 bg-surface p-8 shadow-lg shadow-primary-100/50">
          <div className="space-y-4 text-sm text-neutral-700">
            <p className="text-lg font-semibold text-neutral-900">Upcoming milestones</p>
            <ul className="space-y-3">
              <li className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <p className="font-semibold text-neutral-900">Community workspace refresh</p>
                <p className="text-neutral-600">Shared contribution goal: 80% funded · Fixed 4% return</p>
              </li>
              <li className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <p className="font-semibold text-neutral-900">Family education fund</p>
                <p className="text-neutral-600">Shared contribution goal: 45% funded · Fixed 4% return</p>
              </li>
              <li className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
                <p className="font-semibold text-neutral-900">Wellness retreat savings</p>
                <p className="text-neutral-600">Shared contribution goal: 20% funded · Fixed 4% return</p>
              </li>
            </ul>
            <p className="rounded-2xl bg-primary-50 p-4 text-primary-800">
              Everyone sees the same plan, updates, and progress. GoalSplit keeps communication neutral and
              constructive.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="space-y-10">
        <div className="space-y-4">
          <h2 className="font-display text-3xl font-semibold text-neutral-900 sm:text-4xl">
            Built for transparent collaboration
          </h2>
          <p className="max-w-2xl text-lg text-neutral-700">
            Align on shared outcomes with structured updates, predictable growth forecasts, and clear responsibilities.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {highlights.map((highlight) => (
            <article key={highlight.title} className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm">
              <h3 className="font-display text-2xl font-semibold text-neutral-900">{highlight.title}</h3>
              <p className="text-base text-neutral-700">{highlight.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="insights" className="rounded-3xl bg-neutral-900 px-8 py-12 text-neutral-100 shadow-xl">
        <div className="space-y-6">
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Transparent insights for every contributor</h2>
          <p className="max-w-3xl text-lg text-neutral-200">
            Generate shared summaries, commitments, and timelines that keep everyone informed. GoalSplit highlights
            variances early and provides calm nudges—never unsolicited offers—so teams can adjust together.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-neutral-800/70 p-6 shadow-inner">
              <p className="text-sm uppercase tracking-wide text-primary-200">Live Alignment</p>
              <p className="mt-2 text-lg text-neutral-100">Capture notes from planning sessions and publish next steps instantly.</p>
            </div>
            <div className="rounded-2xl bg-neutral-800/70 p-6 shadow-inner">
              <p className="text-sm uppercase tracking-wide text-primary-200">Fixed Returns</p>
              <p className="mt-2 text-lg text-neutral-100">Keep the focus on predictable schedules so contributors know exactly what to expect.</p>
            </div>
            <div className="rounded-2xl bg-neutral-800/70 p-6 shadow-inner">
              <p className="text-sm uppercase tracking-wide text-primary-200">Shared Wins</p>
              <p className="mt-2 text-lg text-neutral-100">Celebrate milestones together with updates that spotlight collective progress.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
