import {
  AppWindow,
  Camera,
  FileCode,
  Globe,
  MessageCircle,
  Webhook,
  X,
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
  CLOSE_APP: X,
  FOCUS_APP: AppWindow,
  CHROME_EXTENSION: Puzzle,
  DESKTOP_AUTOMATION: MousePointer2,
  SCREEN_CAPTURE: Camera,
  HTTP_REQUEST: Webhook,
  TELEGRAM_SEND: MessageCircle,
};

export function taskTypeIcon(type: string): LucideIcon {
  return ICONS[type as TaskType] ?? Terminal;
}
