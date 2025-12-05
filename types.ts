export interface ContentModule {
  id: string;
  heading: string;
  content: string;
}

export interface LeftBrainData {
  title: string;
  summary_context: string;
  visual_theme_keywords: string;
  modules: ContentModule[];
}

export interface VisualSettings {
  styleId: string;
  colorTheme: string;
  watermark: string;
}

export enum Stage {
  Input = 0,
  Splitting = 1,           // New: AI splits long text
  ReviewSplit = 2,         // New: User reviews split results
  Organizing = 3,          // (Batch) Processing structure
  ReviewStructure = 4,     // (Batch) Review structure
  Designing = 5,           // (Batch) Generating prompts
  ReviewPrompt = 6,        // (Batch) Review prompts
  Painting = 7,            // (Batch) Generating images
  Done = 8,                 // All done
  BatchProcessing = 9      // New: Batch processing active
}

export interface NoteUnit {
  id: string;
  order: number;
  originalText: string;

  // Workflow State
  stage: Stage;
  isProcessing: boolean;
  error?: string;

  // Data
  structure?: LeftBrainData;
  generatedPrompt?: string;
  finalImage?: string;
}

// --- CHAT TYPES ---

export type RoleType = 'user' | 'organizer' | 'designer' | 'painter' | 'system';

export interface ProcessStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  detail?: string; // 可选的详细信息
}

export interface ChatItem {
  id: string;
  type: 'user_message' | 'role_message' | 'process_log' | 'component';
  role?: RoleType;
  content?: string; // 文本消息内容
  timestamp?: number; // 时间戳用于排序

  // 处理过程日志
  steps?: ProcessStep[];

  // 自定义组件
  componentType?:
  | 'input_form'
  | 'structure_review'
  | 'style_select'
  | 'final_result'
  | 'split_review'
  | 'batch_progress'
  | 'confirm_button';
  data?: any; // 组件数据
}
