import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { Stage, LeftBrainData, VisualSettings, ContentModule } from './types';
import { FlowCanvas } from './FlowCanvas';

// --- TYPES ---

interface AIStudioClient {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

const ROLES = {
  organizer: { emoji: '📝', name: '笔记整理大师', color: '#6366f1' },
  designer: { emoji: '🎨', name: '视觉设计师', color: '#8b5cf6' },
  painter: { emoji: '🖌️', name: '绘图艺术家', color: '#3b82f6' }
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
  const prompt = `
    # Role
    你是一位 **极致精炼的全覆盖笔记专家**。
    你的目标是将输入文本（<2000字）整理为一份 **全覆盖、极简、逻辑顺畅** 的结构化笔记（JSON格式）。
    **核心限制：笔记总输出字数必须严格控制在 350 字左右。**

    # 结构处理规则 (CRITICAL)
    1. **结构保留优先**：首先检测输入文本是否已经具备清晰的结构（如 "1. 2. 3."、"一、二、三" 或明显的章节标题）。**如果原文已有结构，必须严格沿用原文的层级框架**，不要强行打乱或重组。
    2. **无结构才重组**：只有当输入文本是零散的段落时，才按照“核心概念-逻辑-汇总”的默认逻辑进行重组。

    # 核心目标
    1. **信息100%无死角覆盖**：精准捕捉原文所有核心概念、关键数据、重要结论、逻辑关系、实操步骤、边界条件。确保用户看完笔记无需回看原文。
    2. **精炼到极致**：用「关键词+极简短句（≤10字）」提炼，剔除所有冗余修饰，做到“字字千金”。
    3. **逻辑丝滑**：严格遵循原文的论述顺序/逻辑框架。

    # Output Format (JSON ONLY)
    Do not output any conversational text. Return ONLY valid JSON:
    {
      "title": "1句话精准概括的主题",
      "summary_context": "极简的背景摘要",
      "visual_theme_keywords": "keywords for background vibe",
      "modules": [
        {
          "heading": "原文的标题或归纳的小标题",
          "content": "极简内容点1; 极简内容点2... (保持极度精炼)"
        },
        ... (Repeat based on original structure or 3-6 modules)
      ]
    }
    
    【输入文本】
    ${text}
  `;
  // Use banana model available in v1beta list
  const res = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: prompt });
  const raw = res.text?.replace(/```json|```/g, '').trim() || '{}';
  try {
    const json = JSON.parse(raw);
    // Add IDs for React rendering
    json.modules = json.modules?.map((s: any, i: number) => ({ ...s, id: `m${i}` })) || [];
    return json;
  } catch (e) {
    console.error("Left brain parse error", e);
    return {
      title: "解析失败",
      summary_context: "请重试或检查输入",
      visual_theme_keywords: "abstract",
      modules: []
    };
  }
};

// SYNCHRONOUS TEMPLATE GENERATION (No AI call)
const processRightBrain = (data: LeftBrainData, settings: VisualSettings): string => {
  const styleObj = STYLES.find(s => s.id === settings.styleId) || STYLES[0];

  // Using the strict template provided by user
  return `
Role: You are an expert Information Designer specializing in high-clarity educational sketchnotes. Your goal is to visualize complex information into a clean, organized, and readable "Visual Note".

# VISUAL STYLE: [User Selection: ${styleObj.name}]
- Core Aesthetic: ${styleObj.desc}. Flat Vector Illustration style. Clean lines, high resolution, no blurring.
- Background: Light beige (#F5F5DC) or style-appropriate light background with a faint dot grid pattern. CLEAN background, no heavy textures that interfere with text.
- Color Palette: ${settings.colorTheme ? settings.colorTheme : 'Pastel low-saturation colors (Macaron Blue, Cream Yellow, Soft Pink)'} + Dark Charcoal (#333333) for all text.
- Decorations: Simple 2D icons (flat style), subtle doodles related to "${data.visual_theme_keywords}" scattered *around* text boxes, not *behind* text.

# CRITICAL TEXT RENDERING RULES (Priority Level: MAX)
1. Font Strategy (The Success Secret): Use a font style resembling "Bold Sans-serif" or "Clean Handwriting" (like 楷体/Heiti). Absolutely NO cursive, calligraphy, or messy strokes. Characters must be blocky and distinct.
2. Text Container Strategy: All main text blocks MUST be placed inside **Solid Color Text Bubbles or Rectangular Boxes** (White or very light pastel fill) to ensure maximum contrast against the background dots.
3. Clarity Over Style: Legibility is the #1 priority. Text characters must be sharp, high-contrast, and fully formed.
4. Language: Simplified Chinese (简体中文). Check for correct stroke counts. NO Japanese Kana.
5. Hierarchy (Relative Sizes):
    - Title: Very large, decorative, centered at top.
    - Headers (1., 2.,...): Large, bold.
    - Body Text: Medium size, clear bullet points.

# LAYOUT & COMPOSITION
- Grid System: Use a modular layout (like a bento box). Divide the canvas into 5 clear, non-overlapping sections for the main points, plus a title area and footer.
- Flow: Use cute, hand-drawn dotted arrows to guide the eye from section 1 to 5 logically.

# OUTPUT SPECS
- Ratio: 3:4 (Vertical Long Chart)
- Resolution: High Definition (Vector-like sharpness)

# VISUALIZATION CONTENT (Render exactly as structured below):
Title: "${data.title}"
Subtitle: "${data.summary_context}"
Modules:
${data.modules.map((m, i) => `${i + 1}. Heading: "${m.heading}"\n   Content: "${m.content}"`).join('\n')}

Footer Watermark: "${settings.watermark}"
  `.trim();
};

const processHand = async (ai: GoogleGenAI, prompt: string): Promise<string> => {
  console.log("Starting image generation with prompt:", prompt);

  // Reinforce critical rules in the final prompt sent to the image model
  const finalPrompt = prompt; // Prompt is already strict from template

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: finalPrompt }] },
      config: { imageConfig: { aspectRatio: "3:4", imageSize: "1K" } }
    });

    console.log("API Response received", res);
    const parts = res.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        console.log("Image data found, MIME:", part.inlineData.mimeType, "Length:", part.inlineData.data.length);
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation API error:", e);
    throw e;
  }

  throw new Error("No image data in response. The model might have blocked the request for safety reasons.");
};

// --- APP COMPONENT ---

const App = () => {
  // State
  const [stage, setStage] = useState<Stage>(Stage.Input);

  // Data
  const [rawText, setRawText] = useState('');
  const [structure, setStructure] = useState<LeftBrainData | null>(null);
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({ styleId: 'healing', colorTheme: '', watermark: '' });
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [finalImage, setFinalImage] = useState('');
  const [imageError, setImageError] = useState('');

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
    return !!process.env.API_KEY;
  };

  const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

  // --- ACTIONS ---

  const handleOrganize = async () => {
    if (!rawText.trim()) return;
    if (!(await checkApiKey())) return;

    setStage(Stage.Organizing);
    try {
      const ai = getAI();
      const res = await processLeftBrain(ai, rawText);
      setStructure(res);
      setStage(Stage.ReviewStructure);
    } catch (e) {
      console.error(e);
      alert("整理失败，请重试");
      setStage(Stage.Input);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!structure) return;
    // Synchronous generation - no API key check needed for this step
    setStage(Stage.Designing);

    // Simulate short delay for UX
    setTimeout(() => {
      const res = processRightBrain(structure, visualSettings);
      setGeneratedPrompt(res);
      setStage(Stage.ReviewPrompt);
    }, 800);
  };

  const handlePaint = async () => {
    if (!generatedPrompt) return;
    if (!(await checkApiKey())) return;

    setStage(Stage.Painting);
    setFinalImage('');
    setImageError('');
    try {
      const ai = getAI();
      const img = await processHand(ai, generatedPrompt);
      setFinalImage(img);
      setStage(Stage.Done);
    } catch (e) {
      console.error("Paint error:", e);
      alert("绘制失败: " + (e instanceof Error ? e.message : String(e)));
      setStage(Stage.ReviewPrompt);
    }
  };

  // --- RENDERERS ---

  return (
    <div className="app-container">

      {/* LEFT PANEL: CONTROL & STATUS */}
      <div className="left-panel">
        <div className="left-header">
          <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡️ SoulNote <span style={{ fontSize: '12px', opacity: 0.5, fontWeight: 400 }}>Flow Studio</span>
          </h2>
        </div>

        <div className="left-content">

          {/* STEP 1: INPUT */}
          <div className="control-card">
            <div className="guide-text">1. 笔记内容输入</div>
            <textarea
              className="text-input"
              placeholder="输入原文（2000字以内），AI 将为您整理高密度笔记..."
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={stage > Stage.Input}
            />
            {stage === Stage.Input && (
              <button className="primary-btn" onClick={handleOrganize}>
                ✨ 提交整理 (Organize)
              </button>
            )}
            {stage === Stage.Organizing && (
              <div className="status-indicator">
                <div className="spinner"></div>
                <div>笔记整理大师已就位...<br /><span style={{ fontSize: '12px', opacity: 0.7 }}>正在深度拆解，全覆盖提炼中...</span></div>
              </div>
            )}
            {stage >= Stage.ReviewStructure && !structureConfirmed && (
              <div className="role-invitation">
                <div className="role-header">
                  <span className="role-emoji">{ROLES.organizer.emoji}</span>
                  <span>@{ROLES.organizer.name} 已完成整理</span>
                </div>
                <div className="role-message">
                  请在右侧查看并编辑笔记结构，确认无误后点击继续。
                </div>
                <button className="confirm-btn" onClick={() => setStructureConfirmed(true)}>
                  ✅ 确认结构，邀请设计师
                </button>
              </div>
            )}
            {structureConfirmed && (
              <div className="status-indicator" style={{ borderColor: 'var(--success)', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--success)' }}>
                ✅ 笔记架构已确认
              </div>
            )}
          </div>

          {/* STEP 2: STYLE */}
          {structureConfirmed && stage >= Stage.ReviewStructure && (
            <div className="control-card">
              <div className="role-invitation" style={{ marginTop: 0, marginBottom: '16px' }}>
                <div className="role-header">
                  <span className="role-emoji">{ROLES.designer.emoji}</span>
                  <span>@{ROLES.designer.name} 已加入工作流</span>
                </div>
                <div className="role-message">
                  为您的视觉笔记选择一个合适的风格吧！
                </div>
              </div>
              <div className="guide-text">2. 视觉风格配置</div>

              <div style={{ fontSize: '12px', color: '#a1a1aa' }}>选择风格:</div>
              <div className="style-grid">
                {STYLES.map(s => (
                  <div
                    key={s.id}
                    className={`style-chip ${visualSettings.styleId === s.id ? 'active' : ''}`}
                    onClick={() => stage === Stage.ReviewStructure && setVisualSettings({ ...visualSettings, styleId: s.id })}
                  >
                    <div style={{ fontSize: '20px' }}>{s.emoji}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>{s.name}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '8px' }}>个性化配置:</div>
                <input
                  className="text-input"
                  style={{ minHeight: '40px', padding: '10px' }}
                  placeholder="水印文字 (如 @JoyAI)"
                  value={visualSettings.watermark}
                  onChange={e => setVisualSettings({ ...visualSettings, watermark: e.target.value })}
                  disabled={stage !== Stage.ReviewStructure}
                />
                <input
                  className="text-input"
                  style={{ minHeight: '40px', padding: '10px', marginTop: '8px' }}
                  placeholder="自定义色系 (如: 莫兰迪蓝)"
                  value={visualSettings.colorTheme}
                  onChange={e => setVisualSettings({ ...visualSettings, colorTheme: e.target.value })}
                  disabled={stage !== Stage.ReviewStructure}
                />
              </div>

              {stage === Stage.ReviewStructure && (
                <button className="confirm-btn" onClick={() => { setDesignConfirmed(true); handleGeneratePrompt(); }}>
                  ✅ 确认设计，生成指令
                </button>
              )}
              {stage === Stage.Designing && (
                <div className="status-indicator">
                  <div className="spinner"></div>
                  <div>笔记灵感大师已上线...<br /><span style={{ fontSize: '12px', opacity: 0.7 }}>正在应用高清晰度模版...</span></div>
                </div>
              )}
              {stage >= Stage.ReviewPrompt && (
                <div className="status-indicator" style={{ borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  ✅ 创意指令已生成
                </div>
              )}
            </div>
          )}

          {/* STEP 3: EXECUTION */}
          {stage >= Stage.ReviewPrompt && (
            <div className="control-card">
              <div className="role-invitation" style={{ marginTop: 0, marginBottom: '16px' }}>
                <div className="role-header">
                  <span className="role-emoji">{ROLES.painter.emoji}</span>
                  <span>@{ROLES.painter.name} 已就绪</span>
                </div>
                <div className="role-message">
                  一切准备完毕！请在右侧最后检查绘图指令，即将为您绘制高清视觉笔记。
                </div>
              </div>
              <div className="guide-text">3. 最终确认</div>

              {stage === Stage.ReviewPrompt && (
                <button className="primary-btn" onClick={handlePaint}>
                  🖌️ 确认并绘制 (Paint)
                </button>
              )}
              {stage === Stage.Painting && (
                <div className="status-indicator">
                  <div className="spinner"></div>
                  <div>笔记绘制大师已启动...<br /><span style={{ fontSize: '12px', opacity: 0.7 }}>渲染高清图片中</span></div>
                </div>
              )}
              {stage === Stage.Done && (
                <div className="status-indicator" style={{ borderColor: '#10b981', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  🎉 图片生成成功！
                </div>
              )}
              {stage === Stage.Done && (
                <button className="primary-btn" onClick={() => window.location.reload()} style={{ background: '#27272a' }}>
                  🔄 开始新笔记
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* RIGHT PANEL: FLOW CANVAS */}
      <div className="right-panel">
        <FlowCanvas
          stage={stage}
          rawText={rawText}
          structure={structure}
          generatedPrompt={generatedPrompt}
          finalImage={finalImage}
          imageError={imageError}
          setStructure={setStructure}
          setGeneratedPrompt={setGeneratedPrompt}
          onAddModule={() => {
            if (structure) {
              setStructure({ ...structure, modules: [...structure.modules, { id: Date.now().toString(), heading: "新模块", content: "内容..." }] });
            }
          }}
        />
      </div>

    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
