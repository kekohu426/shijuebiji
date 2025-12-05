import React, { useState, useEffect, useRef } from 'react';
import { Stage, NoteUnit, LeftBrainData, ContentModule } from './types';

interface FlowCanvasProps {
    notes: NoteUnit[];
    updateNote: (id: string, data: Partial<NoteUnit>) => void;
    rawText: string;
    regenerateNote: (id: string) => void;
}

// --- Helper Components ---

// 1. Original Text Capsule
const OriginalTextCapsule: React.FC<{ text: string }> = ({ text }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="flow-stage-original">
            <div
                className="original-capsule"
                onClick={() => setExpanded(!expanded)}
            >
                <span className="stage-icon">📄</span>
                <span>原始文本</span>
                <span className="text-muted">({text.length} 字)</span>
                <span style={{ fontSize: '10px', marginLeft: '4px' }}>{expanded ? '▼' : '▶'}</span>
            </div>

            {expanded && (
                <div className="original-content-expanded">
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '12px', textAlign: 'left', margin: 0, color: '#a1a1aa' }}>
                        {text}
                    </p>
                </div>
            )}
        </div>
    );
};

// 2. Block-based Structure Editor
interface BlockEditorProps {
    structure: LeftBrainData;
    onChange: (newStructure: LeftBrainData) => void;
    readOnly?: boolean;
}

const BlockEditor: React.FC<BlockEditorProps> = ({ structure, onChange, readOnly }) => {
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...structure, title: e.target.value });
    };

    const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange({ ...structure, summary_context: e.target.value });
    };

    const handleModuleChange = (index: number, field: keyof ContentModule, value: string) => {
        const newModules = [...structure.modules];
        newModules[index] = { ...newModules[index], [field]: value };
        onChange({ ...structure, modules: newModules });
    };

    const addModule = () => {
        const newModule: ContentModule = {
            id: Date.now().toString(),
            heading: '新模块',
            content: ''
        };
        onChange({ ...structure, modules: [...structure.modules, newModule] });
    };

    const deleteModule = (index: number) => {
        const newModules = structure.modules.filter((_, i) => i !== index);
        onChange({ ...structure, modules: newModules });
    };

    return (
        <div className="block-editor">
            <div className="block-editor-header">
                <input
                    className="block-title-input"
                    value={structure.title}
                    onChange={handleTitleChange}
                    disabled={readOnly}
                    placeholder="主标题"
                />
                <textarea
                    className="block-summary-input"
                    value={structure.summary_context}
                    onChange={handleSummaryChange}
                    disabled={readOnly}
                    placeholder="背景摘要..."
                />
            </div>

            <div className="block-modules-list">
                {structure.modules.map((module, index) => (
                    <div key={module.id || index} className="module-card">
                        <div className="module-index">{index + 1}.</div>
                        <div className="module-content-area">
                            <input
                                className="module-heading-input"
                                value={module.heading}
                                onChange={(e) => handleModuleChange(index, 'heading', e.target.value)}
                                disabled={readOnly}
                                placeholder="模块标题"
                            />
                            <textarea
                                className="module-body-input"
                                value={module.content}
                                onChange={(e) => handleModuleChange(index, 'content', e.target.value)}
                                disabled={readOnly}
                                placeholder="模块内容..."
                            />
                        </div>
                        <div className="module-actions">
                            {!readOnly && <button className="icon-btn delete" onClick={() => deleteModule(index)} title="删除">🗑️</button>}
                        </div>
                    </div>
                ))}
                {!readOnly && (
                    <button className="add-module-btn" onClick={addModule}>
                        <span>➕ 添加模块</span>
                    </button>
                )}
            </div>
        </div>
    );
};

// 3. Magic Prompt Display
const MagicPrompt: React.FC<{ isProcessing: boolean; isCompleted: boolean }> = ({ isProcessing, isCompleted }) => {
    if (isProcessing) {
        return (
            <div className="magic-prompt-container">
                <div className="magic-icon">🔮</div>
                <div className="magic-text">正在提取视觉灵感...</div>
            </div>
        );
    }

    if (isCompleted) {
        return (
            <div className="magic-ready">
                <span style={{ fontSize: '24px' }}>✨</span>
                <span>绘图指令已就绪</span>
            </div>
        );
    }

    return <div className="card-placeholder">等待生成...</div>;
};

// --- Main Card Component ---

interface EditableCardProps {
    type: 'split' | 'structure' | 'prompt' | 'image';
    note: NoteUnit;
    index: number;
    onEdit: (field: string, value: any) => void;
    isActive: boolean;
    onRegenerate?: (id: string) => void;
}

const EditableCard: React.FC<EditableCardProps> = ({ type, note, index, onEdit, isActive, onRegenerate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    const isProcessing =
        type === 'prompt'
            ? note.isProcessing || (!!note.structure && !note.generatedPrompt && note.stage >= Stage.Designing)
            : note.isProcessing;
    const isCompleted = type === 'split' ? !!note.structure :
        type === 'structure' ? !!note.generatedPrompt :
            type === 'prompt' ? !!note.generatedPrompt :
                !!note.finalImage;

    // Auto-expand logic for Split Text
    useEffect(() => {
        if (type === 'split' && !isEditing) {
            // Split text is always "editing" in the sense of being visible text
            // But here we use a textarea that auto-saves on blur or change?
            // Actually requirement says: "Direct edit... WYSIWYG".
            // So we can just render a textarea that updates state.
        }
    }, [type]);

    const handleSplitTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onEdit('originalText', e.target.value);
    };

    const cardClass = `flow-card ${isActive ? 'focus-active' : 'focus-dimmed'}`;
    const locked =
        type === 'split'
            ? note.stage > Stage.ReviewSplit
            : type === 'structure'
                ? note.stage >= Stage.ReviewPrompt
                : type === 'prompt'
                    ? note.stage >= Stage.Painting
                    : note.stage >= Stage.Done;

    // 1. Split Text Card
    if (type === 'split') {
        return (
            <div className={cardClass} id={`card-split-${index}`}>
                <div className="flow-card-header">
                    <div className="flow-card-title">
                        <span className="card-icon">📝</span>
                        <span>片段 #{index + 1}</span>
                    </div>
                </div>
                <div className="flow-card-content">
                    <textarea
                        className="card-textarea"
                        style={{ minHeight: '120px', background: 'transparent', border: 'none', resize: 'vertical' }}
                        value={note.originalText}
                        onChange={handleSplitTextChange}
                        disabled={locked}
                    />
                </div>
            </div>
        );
    }

    // 2. Structure Card
    if (type === 'structure') {
        return (
            <div className={cardClass} id={`card-structure-${index}`}>
                <div className="flow-card-header">
                    <div className="flow-card-title">
                        <span className="card-icon">🧠</span>
                        <span>结构 #{index + 1}</span>
                    </div>
                    <div className="flow-card-actions">
                        {isProcessing && <span className="status-badge processing">分析中</span>}
                        {isCompleted && <span className="status-badge completed">✓</span>}
                    </div>
                </div>
                <div className="flow-card-content">
                    {note.structure ? (
                        <BlockEditor
                            structure={note.structure}
                            onChange={(newStructure) => onEdit('structure', newStructure)}
                            readOnly={locked}
                        />
                    ) : (
                        <div className="card-placeholder">等待处理...</div>
                    )}
                </div>
            </div>
        );
    }

    // 3. Prompt Card
    if (type === 'prompt') {
        return (
            <div className={cardClass} id={`card-prompt-${index}`}>
                <div className="flow-card-header">
                    <div className="flow-card-title">
                        <span className="card-icon">🎨</span>
                        <span>绘图指令</span>
                    </div>
                </div>
                <div className="flow-card-content">
                    <MagicPrompt isProcessing={isProcessing} isCompleted={!!note.generatedPrompt} />
                </div>
            </div>
        );
    }

    // 4. Image Card
if (type === 'image') {
    return (
        <div className={cardClass} id={`card-image-${index}`}>
            <div className="flow-card-header">
                <div className="flow-card-title">
                        <span className="card-icon">🖼️</span>
                        <span>视觉笔记</span>
                    </div>
                    <div className="flow-card-actions">
                        {isProcessing && <span className="status-badge processing">绘制中</span>}
                        {isCompleted && <span className="status-badge completed">✓</span>}
                    </div>
                </div>
            <div className="flow-card-content">
                {note.finalImage ? (
                    <>
                        <img src={note.finalImage} alt={`视觉笔记 ${index + 1}`} className="result-image" />
                        <a
                                href={note.finalImage}
                                download={`visual-note-${index + 1}.png`}
                            className="download-btn"
                        >
                            ⬇️ 下载图片
                        </a>
                        <button
                            className="download-btn"
                            style={{ marginTop: '8px' }}
                            onClick={() => onRegenerate && onRegenerate(note.id)}
                            disabled={note.isProcessing}
                        >
                            🔄 重新生成
                        </button>
                    </>
                ) : (
                    <div className="image-placeholder">
                        <span className="placeholder-icon">🖼️</span>
                        <p className="card-placeholder">等待绘制...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

// --- Main Canvas ---

export const FlowCanvas: React.FC<FlowCanvasProps> = ({ notes, updateNote, rawText, regenerateNote }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Determine active stage/card for auto-focus
    // Logic: Find the first note that is processing, or the last one that was updated?
    // Let's use a simple heuristic:
    // If any note is processing, focus that one.
    // If not, focus the last note's most advanced stage.
    const getActiveCardInfo = () => {
        if (notes.length === 0) return { index: -1, type: 'none' };

        // 1. Find processing note
        const processingIndex = notes.findIndex(n => n.isProcessing);
        if (processingIndex !== -1) {
            const note = notes[processingIndex];
            // Guess stage based on data presence
            if (!note.structure) return { index: processingIndex, type: 'split' }; // Should be structure processing actually
            if (!note.generatedPrompt) return { index: processingIndex, type: 'structure' };
            if (!note.finalImage) return { index: processingIndex, type: 'prompt' };
            return { index: processingIndex, type: 'image' };
        }

        // 2. If none processing, find the "furthest" note
        // For simplicity, let's just focus on the last note and its latest available stage
        const lastIndex = notes.length - 1;
        const lastNote = notes[lastIndex];
        if (lastNote.finalImage) return { index: lastIndex, type: 'image' };
        if (lastNote.generatedPrompt) return { index: lastIndex, type: 'prompt' };
        if (lastNote.structure) return { index: lastIndex, type: 'structure' };
        return { index: lastIndex, type: 'split' };
    };

    const activeInfo = getActiveCardInfo();

    // Auto-scroll effect
    useEffect(() => {
        if (activeInfo.index !== -1 && scrollContainerRef.current) {
            const elementId = `card-${activeInfo.type}-${activeInfo.index}`;
            const element = document.getElementById(elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }
    }, [activeInfo.index, activeInfo.type, notes]); // Depend on notes to trigger on updates

    const hasAnyNotes = notes.length > 0;
    const hasStructures = notes.some(n => n.structure);
    const hasPrompts = notes.some(n => n.generatedPrompt);
    const hasImages = notes.some(n => n.finalImage);

    return (
        <div className="flow-canvas-vertical" ref={scrollContainerRef}>
            {/* 1. Original Text */}
            {rawText && (
                <div className="horizontal-scroll-stage">
                    <div className="stage-box-original">
                        <OriginalTextCapsule text={rawText} />
                    </div>
                </div>
            )}

            {/* 2. Split Text Stage */}
            {hasAnyNotes && (
                <div className="horizontal-scroll-stage">
                    <div className="stage-box">
                        <div className="stage-label">
                            <span className="stage-icon">📝</span>
                            <span>原文拆分 (Core Workbench)</span>
                        </div>
                        <div className="horizontal-cards-container">
                            {notes.map((note, index) => (
                            <EditableCard
                                key={note.id}
                                type="split"
                                note={note}
                                index={index}
                                onEdit={(field, value) => updateNote(note.id, { [field]: value })}
                                isActive={activeInfo.type === 'split' && activeInfo.index === index}
                            />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Structure Stage */}
            {hasStructures && (
                <div className="horizontal-scroll-stage">
                    <div className="stage-box">
                        <div className="stage-label">
                            <span className="stage-icon">🧠</span>
                            <span>笔记结构</span>
                        </div>
                        <div className="horizontal-cards-container">
                            {notes.map((note, index) => (
                            <EditableCard
                                key={note.id}
                                type="structure"
                                note={note}
                                index={index}
                                onEdit={(field, value) => updateNote(note.id, { [field]: value })}
                                isActive={activeInfo.type === 'structure' && activeInfo.index === index}
                            />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Prompt Stage */}
            {hasPrompts && (
                <div className="horizontal-scroll-stage">
                    <div className="stage-box">
                        <div className="stage-label">
                            <span className="stage-icon">🎨</span>
                            <span>绘图指令</span>
                        </div>
                        <div className="horizontal-cards-container">
                            {notes.map((note, index) => (
                            <EditableCard
                                key={note.id}
                                type="prompt"
                                note={note}
                                index={index}
                                onEdit={(field, value) => updateNote(note.id, { [field]: value })}
                                isActive={activeInfo.type === 'prompt' && activeInfo.index === index}
                            />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Image Stage */}
            {hasImages && (
                <div className="horizontal-scroll-stage">
                    <div className="stage-box">
                        <div className="stage-label">
                            <span className="stage-icon">🖼️</span>
                            <span>视觉笔记</span>
                        </div>
                        <div className="horizontal-cards-container">
                            {notes.map((note, index) => (
                            <EditableCard
                                key={note.id}
                                type="image"
                                note={note}
                                index={index}
                                onEdit={() => { }}
                                isActive={activeInfo.type === 'image' && activeInfo.index === index}
                                onRegenerate={regenerateNote}
                            />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!hasAnyNotes && !rawText && (
                <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <p className="empty-text">在左侧输入文本开始创建视觉笔记</p>
                </div>
            )}
        </div>
    );
};
