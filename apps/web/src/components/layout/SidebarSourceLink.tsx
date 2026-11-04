import { Code } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { SOURCE_CODE_URL } from '@/utils/app';

// The sidebar entry that opens this build's source code in a new tab.
export default function SidebarSourceLink() {
  const t = useTranslations('nav');
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={t('sourceCode')}>
        <a href={SOURCE_CODE_URL} target="_blank" rel="noopener noreferrer">
          <Code />
          <span>{t('sourceCode')}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
