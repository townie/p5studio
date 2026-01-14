
export interface HistoryEntry {
  id: string;
  code: string;
  timestamp: number;
  label: string;
  type: 'initial' | 'manual' | 'ai';
  prompt?: string;
}

export interface ProjectData {
  name: string;
  history: HistoryEntry[];
  currentIndex: number;
}

export enum ViewMode {
  Split = 'split',
  Code = 'code',
  Preview = 'preview',
  Timeline = 'timeline'
}
