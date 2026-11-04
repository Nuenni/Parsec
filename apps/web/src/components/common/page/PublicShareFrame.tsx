import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { APP_NAME, SOURCE_CODE_URL } from '@/utils/app';

// The bare wrapper for a public read-only share page (a shared issue, board or document).
// No app navigation, header or session — just the shared content on a full-height
// background, so the page shows only what is shared. The footer offers the source code.
export default function PublicShareFrame({ children }: { children: ReactNode }) {
  const t = useTranslations('common.share');
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex-1">{children}</div>
      <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
        {t('openSource', { app: APP_NAME })}{' '}
        <a
          href={SOURCE_CODE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {t('sourceCode')}
        </a>
      </footer>
    </div>
  );
}
