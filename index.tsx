
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { Stage, LeftBrainData, VisualSettings, ContentModule, NoteUnit, ChatItem, ProcessStep, RoleType } from './types';
import { FlowCanvas } from './FlowCanvas';
// import { v4 as uuidv4 } from 'uuid'; // Removed: not in package.json
const uuidv4 = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- TYPES ---

interface AIStudioClient {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

const ROLES = {
  organizer: { emoji: '📝', name: '笔记整理大师', color: '#6366f1', avatar: 'organizer_avatar.png' },
  designer: { emoji: '🎨', name: '视觉设计大师', color: '#8b5cf6', avatar: 'designer_avatar.png' },
  painter: { emoji: '🖌️', name: '绘图创作大师', color: '#3b82f6', avatar: 'painter_avatar.png' }
};

const STYLES = [
  { id: 'healing', name: '可爱手帐 (Cute Journal)', emoji: '📒', desc: 'Hand-drawn grid paper background, pastel markers, dense text notes, cute stickers, kawaii aesthetic, study note style' },
  { id: 'tech', name: '极客蓝图 (Tech Blueprint)', emoji: '📟', desc: 'Dark blue blueprint background, neon cyan lines, dense data visualization, holographic UI elements, futuristic technical schematic' },
  { id: 'retro', name: '复古海报 (Retro Poster)', emoji: '📰', desc: 'Vintage paper texture, bold typography, densely packed layout, pop art halftone patterns, collage style, infographic poster' },
  { id: 'zen', name: '新中式 (Zen Ink)', emoji: '🎋', desc: 'White rice paper texture, minimalist ink wash painting, black calligraphy, vertical layout, red seal, intellectual aesthetic' },
  { id: 'clay', name: '3D粘土 (3D Clay)', emoji: '🧸', desc: '3D rendered claymorphism, plasticine texture, soft lighting, rounded edges, playful toy-like look, flat text labels on clay surfaces' },
];

// --- API HELPERS ---

const processLeftBrain = async (ai: GoogleGenAI, text: string): Promise<LeftBrainData> => {
  console.log("Processing Left Brain for text length:", text.length);
  const prompt = `
    # Role
你是一位 ** 极致精炼的全覆盖笔记专家 **。
你的目标是将输入文本（< 2000字）整理为一份 ** 全覆盖、极简、逻辑顺畅 ** 的结构化笔记（JSON格式）。
    ** 核心限制：笔记总输出字数必须严格控制在 350 字左右。**

    # 结构处理规则(CRITICAL)
1. ** 结构保留优先 **：首先检测输入文本是否已经具备清晰的结构（如 "1. 2. 3."、"一、二、三" 或明显的章节标题）。** 如果原文已有结构，必须严格沿用原文的层级框架 **，不要强行打乱或重组。
2. ** 无结构才重组 **：只有当输入文本是零散的段落时，才按照“核心概念 - 逻辑 - 汇总”的默认逻辑进行重组。

    # 核心目标
1. ** 信息100 % 无死角覆盖 **：精准捕捉原文所有核心概念、关键数据、重要结论、逻辑关系、实操步骤、边界条件。确保用户看完笔记无需回看原文。
2. ** 精炼到极致 **：用「关键词 + 极简短句（≤10字）」提炼，剔除所有冗余修饰，做到“字字千金”。
3. ** 逻辑丝滑 **：严格遵循原文的论述顺序 / 逻辑框架。

    # Output Format(JSON ONLY)
    Do not output any conversational text.Return ONLY valid JSON:
{
  "title": "1句话精准概括的主题",
    "summary_context": "极简的背景摘要",
      "visual_theme_keywords": "keywords for background vibe",
        "modules": [
          {
            "heading": "原文的标题或归纳的小标题",
            "content": "极简内容点1; 极简内容点2... (保持极度精炼)"
          },
          ... (Repeat based on original structure or 3 - 6 modules)
        ]
}
    
    【输入文本】
    ${text}
`;
  try {
    const res = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: prompt });
    console.log("Left Brain Raw Response:", res.text);
    const raw = res.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '{}';
    const json = JSON.parse(raw);
    // Add IDs for React rendering
    json.modules = json.modules?.map((s: any, i: number) => ({ ...s, id: `m${i} ` })) || [];

    // Validate structure
    if (!json.modules || json.modules.length === 0) {
      console.warn("Left Brain returned empty modules, using fallback");
      throw new Error("Empty modules");
    }

    return json;
  } catch (e) {
    console.error("Left brain parse error", e);
    return {
      title: "解析失败",
      summary_context: "请重试或检查输入",
      visual_theme_keywords: "abstract",
      modules: [
        { id: 'err1', heading: '错误', content: '无法解析内容，请重试' }
      ]
    };
  }
};

const processSplitBrain = async (ai: GoogleGenAI, text: string): Promise<string[]> => {
  const prompt = `
# Role
你是一位**资深内容策略师**，擅长判断文本是否需要拆分，以及如何进行最优拆分。

# Task
分析以下文本，**智能判断**是否需要拆分成多个笔记单元。

# 评估标准（按优先级排序）
1. **主题多样性**：文本是否包含多个独立主题或章节？
2. **内容密度**：单个主题的信息密度是否过高，难以在一张视觉笔记中呈现？
3. **逻辑层次**：是否存在明显的逻辑分层（如"背景-方法-结论"）？
4. **篇幅合理性**：单个笔记单元的字数是否在800-1500字之间最合适？

# 拆分决策规则
- **不拆分**：如果文本主题单一、结构紧凑、字数适中（≤2500字且只有1个核心主题）→ 返回原文
- **拆分2-3个**：文本有2-3个明确主题，或单主题但内容过于密集（3000-5000字）
- **拆分3-5个**：文本包含多个章节或主题，内容丰富（>5000字且有明显分段）

# 拆分质量要求
⚠️ **严禁**：
- 产生空白或无意义的片段
- 强行将短文本拆分（如2001字拆成2个）
- 破坏主题完整性（如将一个完整论述拆成两半）

✅ **必须**：
- 每个单元至少600字，有完整的主题表达
- 单元之间有清晰的逻辑边界
- 保持原文的叙述顺序和逻辑流

# Output Format
返回 JSON 数组：
- 如果**不需要拆分** → \`["原文全文"]\`
- 如果**需要拆分** → \`["第一部分全文", "第二部分全文", ...]\`

**只返回 JSON，不要任何解释文字。**

---
【待分析文本】
${text}
`;

  try {
    const res = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: prompt });
    const raw = res.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '[]';
    const parts = JSON.parse(raw);

    if (Array.isArray(parts) && parts.length > 0) {
      // Filter out empty or very short pieces (< 100 chars)
      const validParts = parts.filter((p: string) => typeof p === 'string' && p.trim().length >= 100);

      if (validParts.length === 0) {
        console.warn("AI returned invalid split, using original text");
        return [text];
      }

      return validParts;
    }

    return [text];
  } catch (e) {
    console.error("Split brain error", e);
    return [text];
  }
};

// SYNCHRONOUS TEMPLATE GENERATION (No AI call)
const processRightBrain = (data: LeftBrainData, settings: VisualSettings): string => {
  // 安全检查：确保 data 存在
  if (!data) {
    console.error("processRightBrain: data is null or undefined");
    return "Error: No data provided";
  }

  const styleObj = STYLES.find(s => s.id === settings.styleId) || STYLES[0];

  // 安全提取字段，提供默认值
  const title = data.title || '未命名笔记';
  const summary = data.summary_context || '';
  const keywords = data.visual_theme_keywords || 'abstract concepts';
  const modules = data.modules || [];

  // Using the strict template provided by user
  return `
Role: You are an expert Information Designer specializing in high - clarity educational sketchnotes.Your goal is to visualize complex information into a clean, organized, and readable "Visual Note".

# VISUAL STYLE: [User Selection: ${styleObj.name}]
  - Core Aesthetic: ${styleObj.desc}. Flat Vector Illustration style.Clean lines, high resolution, no blurring.
- Background: Light beige(#F5F5DC) or style - appropriate light background with a faint dot grid pattern.CLEAN background, no heavy textures that interfere with text.
- Color Palette: ${settings.colorTheme ? settings.colorTheme : 'Pastel low-saturation colors (Macaron Blue, Cream Yellow, Soft Pink)'} + Dark Charcoal(#333333) for all text.
- Decorations: Simple 2D icons(flat style), subtle doodles related to "${keywords}" scattered * around * text boxes, not * behind * text.

# CRITICAL TEXT RENDERING RULES(Priority Level: MAX)
1. Font Strategy(The Success Secret): Use a font style resembling "Bold Sans-serif" or "Clean Handwriting"(like 楷体 / Heiti).Absolutely NO cursive, calligraphy, or messy strokes.Characters must be blocky and distinct.
2. Text Container Strategy: All main text blocks MUST be placed inside ** Solid Color Text Bubbles or Rectangular Boxes ** (White or very light pastel fill) to ensure maximum contrast against the background dots.
3. Clarity Over Style: Legibility is the #1 priority.Text characters must be sharp, high - contrast, and fully formed.
4. Language: Simplified Chinese(简体中文).Check for correct stroke counts.NO Japanese Kana.
5. Hierarchy(Relative Sizes):
- Title: Very large, decorative, centered at top.
    - Headers(1., 2., ...): Large, bold.
    - Body Text: Medium size, clear bullet points.

# LAYOUT & COMPOSITION
  - Grid System: Use a modular layout(like a bento box).Divide the canvas into 5 clear, non - overlapping sections for the main points, plus a title area and footer.
- Flow: Use cute, hand - drawn dotted arrows to guide the eye from section 1 to 5 logically.

# OUTPUT SPECS
  - Ratio: 3: 4(Vertical Long Chart)
    - Resolution: High Definition(Vector - like sharpness)

# VISUALIZATION CONTENT(Render exactly as structured below):
Title: "${title}"
Subtitle: "${summary}"
Modules:
${modules.map((m, i) => `${i + 1}. Heading: "${m?.heading || ''}"\n   Content: "${m?.content || ''}"`).join('\n')}

Footer Watermark: "${settings.watermark}"
  `.trim();
};

// Default to Gemini 3 Pro Image (preview); override via IMAGE_MODEL env if needed.
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-3-pro-image-preview';
const IMAGEN_PROXY = process.env.IMAGEN_PROXY || '/api/imagen';

const processHand = async (ai: GoogleGenAI, prompt: string, styleId: string): Promise<string> => {
  console.log("Starting image generation with prompt:", prompt.substring(0, 120));

  const getStyleInstructions = (id: string) => {
    switch (id) {
      case 'tech':
        return `
            - TECH BLUEPRINT: geometric shapes, straight neon cyan lines, dark blue background, circuit motifs, monospaced label style.
            - Add grid overlays and holographic UI hints; crisp thin strokes; keep text high-contrast.
          `;
      case 'retro':
        return `
            - RETRO POSTER: bold blocky layout, halftone texture, vibrant red/yellow/blue with aged paper feel, collage starbursts.
            - Use impactful headline typography and chunky separators; keep text clear.
          `;
      case 'zen':
        return `
            - ZEN INK: rice paper white/cream background, ink wash strokes, sparse bamboo or red seal accents, calligraphic headings.
            - Minimal composition with generous whitespace and crisp black text.
          `;
      case 'clay':
        return `
            - 3D CLAY: soft pastel claymorphism, rounded blobs, gentle gradients and shadows, toy-like icons.
            - Text on flat labels with clear sans-serif; avoid noisy details.
          `;
      case 'healing':
      default:
        return `
            - CUTE JOURNAL: pastel palette, rounded note boxes, dotted arrows, small doodles (stars/hearts), subtle cream grid background.
            - Clean sans-serif handwriting style, high readability.
          `;
    }
  };

  const imagePrompt = `
    ${prompt}

    # Visual Intent
    - Render as a finished 3:4 vertical visual note (no code, no SVG).
    - Ensure all Chinese text is fully legible, sharp, high-contrast inside light text boxes.
    - Bento-like layout with title at top, 5 clear sections, footer watermark.
    - Flow arrows or connectors should be neat and not occlude text.

    # Style Guide
    ${getStyleInstructions(styleId)}

    # Output
    - Photo-real or illustration accepted, but keep it flat/clean (no blur).
    - Resolution: high quality PNG suitable for download and display.
  `;

  const maxRetries = 3;
  let lastError;

  const extractInlineImage = (response: any): { data: string, mimeType: string } | null => {
    const candidates = response?.candidates || [];
    for (const cand of candidates) {
      const parts = cand?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
        }
      }
    }
    return null;
  };

  const fetchImagen = async (imagePrompt: string): Promise<{ dataUri: string }> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Missing API_KEY for Imagen request");
    }

    // Use proxy to avoid browser CORS; Vite proxy handles dev, production needs backend.
    const url = `${IMAGEN_PROXY}/v1beta/models/${IMAGE_MODEL}:predict?key=${apiKey}`;
    const body = {
      instances: [
        { prompt: imagePrompt }
      ],
      parameters: {
        sampleCount: 1,
        outputMimeType: "image/png"
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Imagen HTTP ${res.status}: ${errText}`);
    }

    const json = await res.json();
    const img = json?.predictions?.[0];
    const data = img?.bytesBase64Encoded || img?.base64Data || img?.data;
    const mimeType = img?.mimeType || 'image/png';
    if (!data) {
      throw new Error("Imagen response missing image data");
    }
    return { dataUri: `data:${mimeType};base64,${data}` };
  };

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (IMAGE_MODEL.toLowerCase().includes('gemini')) {
        const res = await ai.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: 'user', parts: [{ text: imagePrompt }] }],
          generationConfig: {
            responseMimeType: 'image/png'
          }
        });

        const inline = extractInlineImage(res);
        if (!inline) {
          throw new Error("No inline image returned");
        }
        const dataUri = `data:${inline.mimeType};base64,${inline.data}`;
        console.log("Generated image data URI length:", dataUri.length);
        return dataUri;
      } else {
        const { dataUri } = await fetchImagen(imagePrompt);
        console.log("Generated image data URI length:", dataUri.length);
        return dataUri;
      }
    } catch (e) {
      console.warn(`Image generation attempt ${i + 1} failed: `, e);
      lastError = e;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  console.error("All image generation attempts failed:", lastError);
  throw lastError;
};

// --- MASTER WORKING COMPONENT ---

interface MasterWorkingProps {
  role: keyof typeof ROLES;
  description: string;
}

const MasterWorkingCard: React.FC<MasterWorkingProps> = ({ role, description }) => {
  const [dots, setDots] = React.useState(0);
  const roleInfo = ROLES[role];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const dotString = '.'.repeat(dots);

  return (
    <div className="master-working-card">
      <div className="master-working-header">
        <img src={roleInfo.avatar} alt={roleInfo.name} className="master-working-avatar" />
        <div className="master-working-info">
          <div className="master-working-name">
            {roleInfo.emoji} {roleInfo.name}
          </div>
          <div className="master-working-desc">
            {description}{dotString}
          </div>
        </div>
      </div>
      <div className="master-working-progress">
        <div className="master-working-dots">
          <div className="master-working-dot"></div>
          <div className="master-working-dot"></div>
          <div className="master-working-dot"></div>
        </div>
        <span>正在处理中，请稍候</span>
      </div>
    </div>
  );
};
// --- NEW COMPONENTS ---

const ProcessLog: React.FC<{ steps: ProcessStep[], embedded?: boolean }> = ({ steps, embedded }) => {
  const [expanded, setExpanded] = React.useState(false);
  const isAllCompleted = steps.every(s => s.status === 'completed');
  const currentStep = steps.find(s => s.status === 'running') || steps[steps.length - 1];

  return (
    <div className={`process - log - card ${expanded ? 'expanded' : 'collapsed'} ${embedded ? 'embedded' : ''} `} style={embedded ? { background: 'transparent', border: 'none', padding: 0 } : {}}>
      <div
        className="process-header"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAllCompleted ? (
            <span style={{ color: '#a1a1aa', fontSize: '11px' }}>✅ 思考完成</span>
          ) : (
            <>
              <span className="icon-spin">⟳</span>
              <span>正在思考... {currentStep?.label}</span>
            </>
          )}
        </div>
        <div style={{ fontSize: '10px', opacity: 0.5 }}>
          {expanded ? '收起 ▲' : '展开 ▼'}
        </div>
      </div>

      {expanded && (
        <div className="process-steps">
          {steps.map((step) => {
            const isProcessing = step.status === 'running';
            const isCompleted = step.status === 'completed';

            return (
              <div key={step.id} className={`process - step - card ${step.status} `}>
                <div className="step-icon-container">
                  {isCompleted && <span className="icon-check">✓</span>}
                  {isProcessing && <span className="icon-spin">⟳</span>}
                  {step.status === 'pending' && <span className="icon-dot">·</span>}
                </div>
                <div className="step-content">
                  <span className="step-label">{step.label}</span>
                  {isProcessing && <span className="step-dots">...</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ChatBubble: React.FC<{ item: ChatItem }> = ({ item }) => {
  if (item.type === 'user_message') {
    return (
      <div className="chat-message user">
        <div className="chat-bubble user">{item.content}</div>
      </div>
    );
  }

  if (item.type === 'role_message') {
    const roleConfig = ROLES[item.role as keyof typeof ROLES] || ROLES.organizer;
    return (
      <div className="chat-message role">
        <img src={roleConfig.avatar} className="chat-avatar" alt={roleConfig.name} />
        <div className="chat-content">
          <div className="chat-name">{roleConfig.name}</div>
          <div className="chat-bubble role">
            {item.content}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'process_log') {
    return <ProcessLog steps={item.steps || []} />;
  }

  return null;
};

// --- LEGACY MASTER COMPONENT (Kept for reference or transition) ---

// --- APP COMPONENT ---

const App = () => {
  // State
  const [stage, setStage] = useState<Stage>(Stage.Input);

  // Data
  const [rawText, setRawText] = useState('');
  const [savedOriginalText, setSavedOriginalText] = useState(''); // 保存原始输入，用于右边面板显示
  const [notes, setNotes] = useState<NoteUnit[]>([]); // New: Array of notes
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({ styleId: 'healing', colorTheme: '', watermark: '' });
  // Legacy state removed or ignored in favor of notes

  // Chat History State
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    { id: 'init', type: 'role_message', role: 'organizer', content: '你好！请在下方输入内容，我将为您提炼核心要点。' },
    { id: 'input', type: 'component', componentType: 'input_form' }
  ]);

  // Ref for auto-scrolling chat stream
  const chatStreamRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat stream when new messages arrive
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [chatHistory, stage]);

  // Legacy single-note state (kept for compatibility or mapped to notes[0])
  // We will primarily use 'notes' array now.

  // Confirmation states for role workflow
  const [structureConfirmed, setStructureConfirmed] = useState(false);
  const [designConfirmed, setDesignConfirmed] = useState(false);

  const checkApiKey = async () => {
    try {
      const aiStudio = (window as any).aistudio as AIStudioClient | undefined;
      if (aiStudio && !(await aiStudio.hasSelectedApiKey())) {
        await aiStudio.openSelectKey();
        return await aiStudio.hasSelectedApiKey();
      }
    } catch (e) { }
    return !!(
      process.env.API_KEY ||
      process.env.GEMINI_API_KEY ||
      (import.meta as any)?.env?.VITE_API_KEY ||
      (import.meta as any)?.env?.VITE_GEMINI_API_KEY
    );
  };

  const getAI = () => new GoogleGenAI({
    apiKey:
      process.env.API_KEY ||
      process.env.GEMINI_API_KEY ||
      (import.meta as any)?.env?.VITE_API_KEY ||
      (import.meta as any)?.env?.VITE_GEMINI_API_KEY
  });

  // --- ACTIONS ---

  const handleOrganize = async () => {
    if (!rawText.trim()) return;
    if (!(await checkApiKey())) return;

    // 保存当前输入用于处理
    const inputText = rawText.trim();

    // 立即清空输入框
    setRawText('');

    // Add user message to chat
    const userMsgId = uuidv4();
    setChatHistory(prev => [
      ...prev.filter(item => item.id !== 'input'), // Remove input form temporarily or move it to bottom? Better to just append.
      { id: userMsgId, type: 'user_message', content: inputText }
    ]);

    setStage(Stage.Organizing);

    // Add process log
    const processId = uuidv4();
    const initialSteps: ProcessStep[] = [
      { id: 'p1', label: '正在分析文本结构...', status: 'running' },
      { id: 'p2', label: '提炼核心知识点...', status: 'pending' },
      { id: 'p3', label: '构建视觉逻辑框架...', status: 'pending' }
    ];
    setChatHistory(prev => [...prev, { id: processId, type: 'process_log', role: 'organizer', steps: initialSteps }]);

    try {
      const ai = getAI();

      // Simulate step updates (mocking progress)
      setTimeout(() => {
        setChatHistory(prev => prev.map(item => {
          if (item.id === processId && item.steps) {
            // Prevent race condition: if already completed, don't revert
            if (item.steps.every(s => s.status === 'completed')) return item;

            return {
              ...item, steps: [
                { ...item.steps[0], status: 'completed' },
                { ...item.steps[1], status: 'running' },
                item.steps[2]
              ]
            };
          }
          return item;
        }));
      }, 1500);

      const res = await processLeftBrain(ai, inputText);

      // Initialize notes with the result
      setNotes([{
        id: uuidv4(),
        order: 1,
        originalText: inputText,
        stage: Stage.ReviewStructure,
        structure: res,
        isProcessing: false
      }]);

      // Complete process
      setChatHistory(prev => prev.map(item => {
        if (item.id === processId && item.steps) {
          return { ...item, steps: item.steps.map(s => ({ ...s, status: 'completed' })) };
        }
        return item;
      }));

      // Add Organizer success message and invite Designer
      setChatHistory(prev => [
        ...prev,
        { id: uuidv4(), type: 'role_message', role: 'organizer', content: '笔记结构已整理完成！请查看右侧预览。确认无误后，我们将邀请视觉设计大师为您设计风格。' },
        { id: uuidv4(), type: 'component', componentType: 'structure_review' }
      ]);

      setStage(Stage.ReviewStructure);
    } catch (e) {
      console.error(e);
      alert("整理失败，请重试");
      setStage(Stage.Input);
      // Reset chat to input state? Or just add error message.
    }
  };

  const handleGeneratePrompt = async () => {
    if (notes.length === 0) return;

    // Add confirmation message
    setChatHistory(prev => [
      ...prev.filter(item => item.componentType !== 'structure_review'), // Remove review button
      { id: uuidv4(), type: 'user_message', content: '确认结构，开始设计' },
      { id: uuidv4(), type: 'role_message', role: 'designer', content: '收到！我是视觉设计大师。请选择您喜欢的视觉风格，我将为您定制专属设计方案。' },
      { id: uuidv4(), type: 'component', componentType: 'style_select' }
    ]);

    setStage(Stage.Designing);
  };

  const handleStyleConfirm = () => {
    handleBatchDesign();
  };

  // --- BATCH ACTIONS ---

  const updateNote = (id: string, updates: Partial<NoteUnit>) => {
    console.log(`Updating note ${id.slice(0, 4)}: `, Object.keys(updates));
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleSplit = async () => {
    console.log("Starting handleSplit");
    if (!rawText.trim()) return;
    if (!(await checkApiKey())) return;

    // 保存当前输入用于处理
    const inputText = rawText.trim();

    // 保存原始文本用于右边面板显示
    setSavedOriginalText(inputText);

    // 立即清空输入框
    setRawText('');

    // 添加用户消息
    setChatHistory(prev => [
      ...prev,
      { id: uuidv4(), type: 'user_message', content: inputText.substring(0, 100) + (inputText.length > 100 ? '...' : ''), timestamp: Date.now() }
    ]);

    // 添加处理过程
    const processId = uuidv4();
    setChatHistory(prev => [
      ...prev,
      {
        id: processId, type: 'process_log', role: 'organizer', steps: [
          { id: 's1', label: '分析文本长度与结构', status: 'running' },
          { id: 's2', label: '智能拆分内容片段', status: 'pending' },
          { id: 's3', label: '规划笔记单元', status: 'pending' }
        ]
      }
    ]);

    setStage(Stage.Splitting);
    try {
      const ai = getAI();

      // 模拟步骤更新
      setTimeout(() => {
        setChatHistory(prev => prev.map(item => {
          if (item.id === processId && item.steps) {
            // Prevent race condition: if already completed, don't revert
            if (item.steps.every(s => s.status === 'completed')) return item;

            return {
              ...item, steps: [
                { ...item.steps[0], status: 'completed' },
                { ...item.steps[1], status: 'running' },
                item.steps[2]
              ]
            };
          }
          return item;
        }));
      }, 1000);

      const parts = await processSplitBrain(ai, inputText);

      // 完成所有步骤
      setChatHistory(prev => prev.map(item => {
        if (item.id === processId && item.steps) {
          return { ...item, steps: item.steps.map(s => ({ ...s, status: 'completed' })) };
        }
        return item;
      }));

      const newNotes: NoteUnit[] = parts.map((text, i) => ({
        id: uuidv4(),
        order: i + 1,
        originalText: text,
        stage: Stage.Organizing,
        isProcessing: false
      }));

      setNotes(newNotes);

      // 添加整理大师的回复和拆分预览组件
      setChatHistory(prev => [
        ...prev,
        { id: uuidv4(), type: 'role_message', role: 'organizer', content: `文本分析完成！已智能拆分为 ${parts.length} 个笔记单元，请确认后开始整理。`, timestamp: Date.now() },
        { id: uuidv4(), type: 'component', componentType: 'split_review' }
      ]);

      setStage(Stage.ReviewSplit);
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [
        ...prev,
        { id: uuidv4(), type: 'role_message', role: 'organizer', content: '抱歉，处理过程中出现了问题，请重试。', timestamp: Date.now() }
      ]);
      setStage(Stage.Input);
    }
  };

  const handleConfirmSplit = () => {
    // 添加用户确认消息
    setChatHistory(prev => [
      ...prev.filter(item => item.componentType !== 'split_review'),
      { id: uuidv4(), type: 'user_message', content: '确认拆分，开始整理', timestamp: Date.now() }
    ]);

    setStage(Stage.BatchProcessing);
    handleBatchOrganize();
  };

  const handleBatchOrganize = async () => {
    // 添加处理过程日志
    const processId = uuidv4();
    setChatHistory(prev => [
      ...prev,
      {
        id: processId, type: 'process_log', role: 'organizer', steps: [
          { id: 'b1', label: '批量整理笔记结构', status: 'running' },
          { id: 'b2', label: '提炼核心知识点', status: 'pending' },
          { id: 'b3', label: '生成视觉框架', status: 'pending' }
        ]
      }
    ]);

    const ai = getAI();

    const processNoteStructure = async (note: NoteUnit) => {
      updateNote(note.id, { isProcessing: true });
      try {
        const res = await processLeftBrain(ai, note.originalText);
        updateNote(note.id, {
          structure: res,
          stage: Stage.ReviewStructure,
          isProcessing: false
        });
      } catch (e) {
        updateNote(note.id, { isProcessing: false, error: "结构整理失败" });
      }
    };

    await Promise.all(notes.map(n => processNoteStructure(n)));

    // 完成处理过程
    setChatHistory(prev => prev.map(item => {
      if (item.id === processId && item.steps) {
        return { ...item, steps: item.steps.map(s => ({ ...s, status: 'completed' })) };
      }
      return item;
    }));

    // 添加成功消息和风格选择
    setChatHistory(prev => [
      ...prev,
      { id: uuidv4(), type: 'role_message', role: 'organizer', content: `所有笔记结构整理完成！请在右侧查看预览。`, timestamp: Date.now() },
      { id: uuidv4(), type: 'role_message', role: 'designer', content: '你好！我是视觉设计大师。请选择您喜欢的视觉风格：', timestamp: Date.now() },
      { id: uuidv4(), type: 'component', componentType: 'style_select' }
    ]);

    setStage(Stage.ReviewStructure);
  };

  const handleBatchDesign = () => {
    // 移除风格选择组件，添加用户选择消息
    const selectedStyle = STYLES.find(s => s.id === visualSettings.styleId);
    setChatHistory(prev => [
      ...prev.filter(item => item.componentType !== 'style_select'),
      { id: uuidv4(), type: 'user_message', content: `选择风格：${selectedStyle?.name || '默认'} `, timestamp: Date.now() },
      {
        id: uuidv4(), type: 'process_log', role: 'designer', steps: [
          { id: 'd1', label: '分析视觉元素', status: 'completed' },
          { id: 'd2', label: '生成画面布局', status: 'completed' },
          { id: 'd3', label: '编写绘图指令', status: 'completed' }
        ]
      }
    ]);

    setStage(Stage.Designing);

    const designNote = (note: NoteUnit) => {
      if (!note.structure) return;
      updateNote(note.id, { isProcessing: true });

      setTimeout(() => {
        const prompt = processRightBrain(note.structure!, visualSettings);
        updateNote(note.id, {
          generatedPrompt: prompt,
          stage: Stage.ReviewPrompt,
          isProcessing: false
        });
      }, 800 + Math.random() * 500);
    };

    notes.forEach(n => designNote(n));

    // 添加设计完成消息
    setTimeout(() => {
      setChatHistory(prev => [
        ...prev,
        { id: uuidv4(), type: 'role_message', role: 'designer', content: '创意方案已生成！请查看右侧详情。', timestamp: Date.now() },
        { id: uuidv4(), type: 'role_message', role: 'painter', content: `我是绘图大师。准备就绪，可以开始绘制 ${notes.length} 张视觉笔记！`, timestamp: Date.now() },
        { id: uuidv4(), type: 'component', componentType: 'paint_confirmation' }
      ]);
      setStage(Stage.ReviewPrompt);
    }, 1000);
  };

  const handleBatchPaint = async () => {
    if (!(await checkApiKey())) return;

    // 添加开始绘制消息
    setChatHistory(prev => [
      ...prev,
      { id: uuidv4(), type: 'user_message', content: '开始绘制', timestamp: Date.now() },
      { id: uuidv4(), type: 'component', componentType: 'batch_progress' }
    ]);

    setStage(Stage.Painting);

    const ai = getAI();

    const paintNote = async (note: NoteUnit) => {
      if (!note.generatedPrompt) return;
      updateNote(note.id, { isProcessing: true });

      try {
        const img = await processHand(ai, note.generatedPrompt, visualSettings.styleId);
        updateNote(note.id, {
          finalImage: img,
          stage: Stage.Done,
          isProcessing: false
        });
      } catch (e) {
        updateNote(note.id, { isProcessing: false, error: "绘制失败" });
      }
    };

    const chunk = (arr: any[], size: number) =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );

    const chunks = chunk(notes, 3);
    for (const c of chunks) {
      await Promise.all(c.map(n => paintNote(n)));
    }

    // 添加完成消息
    setChatHistory(prev => [
      ...prev.filter(item => item.componentType !== 'batch_progress'),
      { id: uuidv4(), type: 'role_message', role: 'painter', content: '🎉 全部绘制完成！请查看右侧的视觉笔记。', timestamp: Date.now() },
      { id: uuidv4(), type: 'component', componentType: 'final_result' }
    ]);

    setStage(Stage.Done);
  };

  const handleBatchDownload = () => {
    notes.forEach((note, index) => {
      if (note.finalImage) {
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = note.finalImage!;
          link.download = `soulnote_batch_${index + 1}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, index * 500); // Stagger downloads to avoid browser blocking
      }
    });
  };

  // --- RENDERERS ---

  return (
    <div className="app-container">

      {/* LEFT PANEL: VISUAL CANVAS (Formerly Right) */}
      <div className="right-panel">
        <FlowCanvas
          notes={notes}
          updateNote={updateNote}
          rawText={savedOriginalText || rawText}
        />
      </div>

      {/* RIGHT PANEL: CHAT STREAM (Formerly Left) */}
      <div className="left-panel">
        <div className="left-header">
          <h2 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚡️ SoulNote <span style={{ fontSize: '10px', opacity: 0.5, fontWeight: 400 }}>智能笔记工坊</span>
          </h2>
        </div>

        {/* 聊天流区域 */}
        <div className="chat-stream" ref={chatStreamRef}>
          {chatHistory.map(item => {
            // 用户消息
            if (item.type === 'user_message') {
              return (
                <div key={item.id} className="chat-message user">
                  <img src="user_avatar.png" className="chat-avatar" alt="User" />
                  <div className="chat-bubble user">{item.content}</div>
                </div>
              );
            }

            // 角色消息
            if (item.type === 'role_message') {
              const roleConfig = ROLES[item.role as keyof typeof ROLES] || ROLES.organizer;
              return (
                <div key={item.id} className="chat-message role">
                  <img src={roleConfig.avatar} className="chat-avatar" alt={roleConfig.name} />
                  <div className="chat-content">
                    <div className="chat-name">{roleConfig.emoji} {roleConfig.name}</div>
                    <div className="chat-bubble role">{item.content}</div>
                  </div>
                </div>
              );
            }

            // 渲染思考过程 - Wrapped in Role Bubble
            if (item.type === 'process_log') {
              const roleConfig = ROLES.organizer; // Default to Organizer for thinking process
              return (
                <div key={item.id} className="chat-message role">
                  <img src={roleConfig.avatar} className="chat-avatar" alt={roleConfig.name} />
                  <div className="chat-content">
                    <div className="chat-name">{roleConfig.emoji} {roleConfig.name}</div>
                    <div className="chat-bubble role">
                      <ProcessLog steps={item.steps || []} embedded={true} />
                    </div>
                  </div>
                </div>
              );
            }

            // 嵌入组件 - Wrapped in Role Message
            if (item.type === 'component') {
              // Default to organizer if no role specified, or infer based on component type
              let roleKey = 'organizer';
              if (item.componentType === 'style_select' || item.componentType === 'structure_review') roleKey = 'designer';
              if (item.componentType === 'final_result') roleKey = 'painter';

              const roleConfig = ROLES[roleKey as keyof typeof ROLES];

              return (
                <div key={item.id} className="chat-message role">
                  <img src={roleConfig.avatar} className="chat-avatar" alt={roleConfig.name} />
                  <div className="chat-content">
                    <div className="chat-name">{roleConfig.emoji} {roleConfig.name}</div>
                    <div className="chat-bubble role component-bubble">

                      {item.componentType === 'structure_review' && (
                        <div className="center-container" style={{ margin: '4px 0' }}>
                          <p style={{ marginBottom: '8px' }}>结构分析已完成，请确认：</p>
                          <button className="confirm-btn btn-compact" onClick={handleGeneratePrompt}>
                            ✅ 确认结构，开始设计
                          </button>
                        </div>
                      )}

                      {item.componentType === 'style_select' && (
                        <div className="control-card" style={{ marginTop: '0', border: 'none', background: 'transparent', padding: 0 }}>
                          <div style={{ marginBottom: '8px' }}>请选择视觉风格：</div>
                          <div className="style-grid">
                            {STYLES.map(s => (
                              <div
                                key={s.id}
                                className={`style - chip ${visualSettings.styleId === s.id ? 'active' : ''} `}
                                onClick={() => setVisualSettings({ ...visualSettings, styleId: s.id })}
                              >
                                <div style={{ fontSize: '16px' }}>{s.emoji}</div>
                                <div style={{ fontSize: '9px', marginTop: '2px', lineHeight: '1.2' }}>{s.name}</div>
                              </div>
                            ))}
                          </div>
                          <div className="center-container" style={{ marginTop: '12px' }}>
                            <button className="confirm-btn btn-compact" onClick={handleStyleConfirm}>
                              ✅ 确认风格
                            </button>
                          </div>
                        </div>
                      )}

                      {item.componentType === 'split_review' && (
                        <div style={{ marginTop: '0' }}>
                          <div style={{ marginBottom: '8px' }}>
                            已拆分为 {notes.length} 个笔记单元，请确认：
                          </div>
                          {notes.map((note, idx) => (
                            <div key={note.id} style={{
                              marginBottom: '4px',
                              padding: '6px 8px',
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: '6px',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                              <div style={{ fontSize: '9px', color: 'var(--accent-primary)', marginBottom: '2px' }}>
                                📝 单元 {idx + 1}
                              </div>
                              <div style={{ fontSize: '10px', color: '#ccc', lineHeight: '1.3' }}>
                                {note.originalText.substring(0, 60)}...
                              </div>
                            </div>
                          ))}
                          <div className="center-container" style={{ marginTop: '12px' }}>
                            <button className="confirm-btn btn-compact" onClick={handleConfirmSplit}>
                              ✅ 确认拆分，开始整理
                            </button>
                          </div>
                        </div>
                      )}

                      {item.componentType === 'batch_progress' && (
                        <div style={{
                          padding: '12px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          borderRadius: '8px',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          width: '100%'
                        }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                            批量处理进度：{notes.filter(n => n.finalImage).length}/{notes.length}
                          </div>
                          <div style={{
                            height: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${(notes.filter(n => n.finalImage).length / notes.length) * 100}% `,
                              background: 'var(--gradient-primary)',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                        </div>
                      )}

                      {item.componentType === 'paint_confirmation' && (
                        <div
                          className="action-link"
                          onClick={handleBatchPaint}
                          style={{
                            cursor: 'pointer',
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--accent-primary)',
                            fontSize: '13px'
                          }}
                        >
                          <span className="icon-play">▶️</span>
                          <span style={{ textDecoration: 'underline', textUnderlineOffset: '4px' }}>点击开始绘制 ({notes.length} 张)</span>
                        </div>
                      )}

                      {item.componentType === 'final_result' && (
                        <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                          🎉 全部绘制完成！请查看右侧的视觉笔记。
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>

        {/* 底部输入区 */}
        <div className="chat-input-area">
          {stage === Stage.Done ? (
            <button className="primary-btn" onClick={() => window.location.reload()} style={{ height: '50px', fontSize: '14px' }}>
              🔄 开始新笔记
            </button>
          ) : (
            <>
              <textarea
                className="text-input"
                placeholder="输入您想整理的文本内容..."
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                disabled={stage > Stage.Input}
                style={{ minHeight: '80px', marginBottom: '12px' }}
              />
              {stage === Stage.Input && (
                <button className="primary-btn" onClick={handleSplit} disabled={!rawText.trim()}>
                  ✨ 开始智能整理
                </button>
              )}
              {stage === Stage.ReviewPrompt && (
                <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '10px' }}>
                  等待确认绘制...
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
