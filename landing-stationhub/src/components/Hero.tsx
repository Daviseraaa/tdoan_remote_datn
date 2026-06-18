import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { Navbar } from './Navbar';
import { DashboardMockup } from './DashboardMockup';
import { ScaledDashboard } from './ScaledDashboard';
import { consoleUrl } from '@/src/lib/consoleUrl';
import { t } from '@/src/i18n/t';

const HERO_BG =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260611_133301_d5f2a94a-b22e-4e4a-a6b6-eacdddf1f5b0.png&w=1280&q=85';

const GRASS_URL =
  'https://res.cloudinary.com/dy5er7kv5/image/upload/q_auto/f_auto/v1781191264/grass_eam204.png';

export function Hero() {
  return (
    <section
      className="relative min-h-[92svh] overflow-hidden bg-cover bg-center flex flex-col text-gray-900"
      style={{ backgroundImage: `url(${HERO_BG})` }}
    >
      <Navbar variant="transparent" />

      <div className="flex-1 min-h-8 sm:min-h-12 lg:min-h-16 shrink-0" />

      <div className="relative z-20 px-5 sm:px-8 text-center flex flex-col items-center">
        <p className="animate-fade-up text-xs sm:text-sm font-medium uppercase tracking-[0.2em] text-gray-600">
          {t('landing.heroEyebrow')}
        </p>

        <h1 className="animate-fade-up [animation-delay:80ms] mt-3 text-gray-900 font-semibold leading-[1.08] tracking-tight text-[36px] min-[400px]:text-[42px] sm:text-5xl lg:text-6xl xl:text-[68px] max-w-4xl">
          {t('landing.heroTitle')}
        </h1>

        <p className="animate-fade-up [animation-delay:180ms] mt-5 sm:mt-6 text-gray-600 text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl">
          {t('landing.heroSubtitle')}
        </p>

        <div className="animate-fade-up [animation-delay:280ms] mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={consoleUrl('/register')}
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-gray-800 hover:shadow-lg transition-all"
          >
            {t('landing.ctaStart')}
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-md ring-1 ring-gray-200 text-gray-900 text-sm font-medium px-6 py-3 rounded-full hover:bg-white transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            {t('landing.ctaWatchDemo')}
          </Link>
        </div>

        <p className="animate-fade-up [animation-delay:360ms] mt-4 text-sm text-gray-500">
          {t('landing.heroNote')}
        </p>
      </div>

      <div className="flex-1 min-h-10 sm:min-h-12 lg:min-h-16 shrink-0" />

      <div className="animate-hero-rise [animation-delay:480ms] relative z-0 w-[92%] sm:w-[84%] lg:w-[72%] max-w-4xl mx-auto shrink-0 -mb-10 sm:-mb-20 lg:-mb-32 px-5 sm:px-0">
        <ScaledDashboard>
          <DashboardMockup />
        </ScaledDashboard>
      </div>

      <img
        src={GRASS_URL}
        alt=""
        className="pointer-events-none absolute bottom-0 left-0 z-10 w-full select-none"
        draggable={false}
      />
    </section>
  );
}
