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
  Organizing = 1,
  ReviewStructure = 2,
  Designing = 3,
  ReviewPrompt = 4,
  Painting = 5,
  Done = 6
}
