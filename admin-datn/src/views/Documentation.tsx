import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Chrome,
  Download,
  Layers,
  ListTodo,
  MousePointer2,
  Share2,
  Terminal,
  Users,
} from 'lucide-react';
import { ChromeScriptRecorderGuide } from '@/src/components/chromeScript/ChromeScriptRecorderGuide';
import { DesktopRecorderGuide } from '@/src/components/desktopRecording/DesktopRecorderGuide';
import { DocCodeBlock, DocSection, DocSteps } from '@/src/components/docs/DocSection';
import { t } from '@/src/i18n/t';

const TOC = [
  { id: 'overview', labelKey: 'docs.tocOverview' as const },
  { id: 'install', labelKey: 'docs.tocInstall' as const },
  { id: 'usage', labelKey: 'docs.tocUsage' as const },
  { id: 'chrome', labelKey: 'docs.tocChrome' as const },
  { id: 'desktop', labelKey: 'docs.tocDesktop' as const },
];

export default function Documentation() {
  return (
    <div className="pb-16 max-w-4xl mx-auto">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <BookOpen size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-on-surface">
              {t('docs.pageTitle')}
            </h1>
            <p className="text-on-surface-variant text-sm mt-1">{t('docs.pageSubtitle')}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 mt-6">
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10 bg-surface-container-low/50 hover:bg-white/5 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {t(item.labelKey)}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-10">
        <DocSection
          id="overview"
          title={t('docs.overviewTitle')}
          subtitle={t('docs.overviewSubtitle')}
          icon={Layers}
        >
          <p className="text-sm text-on-surface-variant leading-relaxed">{t('docs.overviewBody')}</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {(
              [
                ['docs.overviewItemAgent', '/agents', Users],
                ['docs.overviewItemTasks', '/tasks', ListTodo],
                ['docs.overviewItemWorkflows', '/workflows', Share2],
                ['docs.overviewItemChrome', '/chrome-scripts', Chrome],
                ['docs.overviewItemDesktop', '/desktop-recordings', MousePointer2],
              ] as const
            ).map(([key, path, Icon]) => (
              <li key={key}>
                <Link
                  to={path}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <Icon size={16} className="text-primary shrink-0" />
                  <span className="font-medium text-on-surface">{t(key)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </DocSection>

        <DocSection
          id="install"
          title={t('docs.installTitle')}
          subtitle={t('docs.installSubtitle')}
          icon={Download}
        >
          <p className="text-sm font-bold text-on-surface">{t('docs.installRequirements')}</p>
          <DocSteps
            steps={[
              t('docs.installStep1'),
              t('docs.installStep2'),
              t('docs.installStep3'),
              t('docs.installStep4'),
            ]}
          />
          <DocCodeBlock>{t('docs.installCodeBlock')}</DocCodeBlock>
          <p className="text-xs text-on-surface-variant">{t('docs.installEnvHint')}</p>
          <DocCodeBlock>{t('docs.installEnvExample')}</DocCodeBlock>
        </DocSection>

        <DocSection
          id="usage"
          title={t('docs.usageTitle')}
          subtitle={t('docs.usageSubtitle')}
          icon={Terminal}
        >
          <DocSteps
            steps={[
              t('docs.usageStep1'),
              t('docs.usageStep2'),
              t('docs.usageStep3'),
              t('docs.usageStep4'),
              t('docs.usageStep5'),
            ]}
          />
          <p className="text-sm text-on-surface-variant">{t('docs.usageSyncHint')}</p>
        </DocSection>

        <div id="chrome" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-bold text-on-surface">{t('docs.tocChrome')}</h2>
          <p className="text-sm text-on-surface-variant">{t('docs.chromeIntro')}</p>
          <ChromeScriptRecorderGuide defaultOpen className="mb-0" />
          <p className="text-sm">
            <Link to="/chrome-scripts" className="text-primary font-bold hover:underline">
              {t('docs.openChromeScripts')} →
            </Link>
          </p>
        </div>

        <div id="desktop" className="scroll-mt-24 space-y-3">
          <h2 className="text-xl font-bold text-on-surface">{t('docs.tocDesktop')}</h2>
          <p className="text-sm text-on-surface-variant">{t('docs.desktopIntro')}</p>
          <DesktopRecorderGuide defaultOpen className="mb-0" />
          <p className="text-sm">
            <Link to="/desktop-recordings" className="text-primary font-bold hover:underline">
              {t('docs.openDesktopRecordings')} →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
