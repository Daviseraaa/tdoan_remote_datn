import { Link } from 'react-router-dom';
import { CalendarClock, LayoutDashboard, MessageSquare, Workflow } from 'lucide-react';
import { consoleUrl } from '@/src/lib/consoleUrl';
import { t } from '@/src/i18n/t';

const FEATURES = [
  { key: 'feature1' as const, icon: LayoutDashboard },
  { key: 'feature2' as const, icon: Workflow },
  { key: 'feature3' as const, icon: MessageSquare },
  { key: 'feature4' as const, icon: CalendarClock },
] as const;

export function FeaturesSection() {
  return (
    <section className="bg-white border-y border-gray-200/70">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {t('landing.featuresEyebrow')}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            {t('landing.featuresTitle')}
          </h2>
          <p className="mt-3 text-gray-600 text-base sm:text-lg leading-relaxed">
            {t('landing.featuresSubtitle')}
          </p>
        </div>

        <div className="mt-10 sm:mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map(({ key, icon: Icon }) => (
            <article
              key={key}
              className="rounded-2xl border border-gray-200/80 bg-[#fafaf9] p-6 sm:p-7 hover:border-gray-300/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {t(`landing.${key}Title`)}
              </h3>
              <p className="mt-2 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
                {t(`landing.${key}Desc`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = ['step1', 'step2', 'step3'] as const;

  return (
    <section className="bg-[#fafaf9]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {t('landing.howEyebrow')}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            {t('landing.howTitle')}
          </h2>
        </div>

        <ol className="mt-10 sm:mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step}
              className="relative rounded-2xl bg-white border border-gray-200/80 p-6 sm:p-7"
            >
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-gray-900 text-white text-sm font-semibold">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">
                {t(`landing.${step}Title`)}
              </h3>
              <p className="mt-2 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
                {t(`landing.${step}Desc`)}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-sm text-gray-500">
          {t('landing.howHint')}{' '}
          <Link to="/docs/quick-start" className="text-gray-900 font-medium hover:underline">
            {t('landing.howHintLink')}
          </Link>
        </p>
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section className="bg-gray-900 text-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-10 py-14 sm:py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t('landing.ctaTitle')}
        </h2>
        <p className="mt-3 text-gray-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          {t('landing.ctaSubtitle')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={consoleUrl('/register')}
            className="inline-flex bg-white text-gray-900 text-sm font-medium px-6 py-2.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            {t('landing.ctaStart')}
          </a>
          <Link
            to="/demo"
            className="inline-flex ring-1 ring-white/30 text-white text-sm font-medium px-6 py-2.5 rounded-full hover:bg-white/10 transition-colors"
          >
            {t('landing.ctaWatchDemo')}
          </Link>
        </div>
      </div>
    </section>
  );
}