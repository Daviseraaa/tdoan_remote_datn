import type { LucideIcon } from 'lucide-react';

export type DocBlock =
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; id: string; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  blocks: DocBlock[];
};

export type DocNavItem = {
  slug: string;
  labelKey: `docs.nav.${string}`;
  icon: LucideIcon;
};

export type DocNavSection = {
  id: string;
  labelKey: `docs.nav.${string}`;
  icon: LucideIcon;
  items: DocNavItem[];
};
