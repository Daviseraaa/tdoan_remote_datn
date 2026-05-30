import {
  AppWindow,
  Camera,
  FileCode,
  Globe,
  Info,
  MousePointer2,
  Puzzle,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import type { TaskType } from '@/src/types/api';

const ICONS: Record<TaskType, LucideIcon> = {
  COMMAND: Terminal,
  SCRIPT: FileCode,
  FILE_OPERATION: FileCode,
  SYSTEM_INFO: Info,
  OPEN_APP: AppWindow,
  OPEN_BROWSER: Globe,
  CHROME_EXTENSION: Puzzle,
  DESKTOP_AUTOMATION: MousePointer2,
  SCREEN_CAPTURE: Camera,
};

export function taskTypeIcon(type: string): LucideIcon {
  return ICONS[type as TaskType] ?? Terminal;
}
