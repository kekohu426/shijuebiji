import React, { useState, useEffect, useRef } from 'react';
import { Stage, LeftBrainData } from './types';

interface FlowCanvasProps {
    stage: Stage;
    rawText: string;
    structure: LeftBrainData | null;
    generatedPrompt: string;
    finalImage: string;
    imageError: string;
    setStructure: (data: LeftBrainData) => void;
    setGeneratedPrompt: (prompt: string) => void;
    onAddModule: () => void;
}

const FlowConnection = ({ active, completed }: { active: boolean; completed: boolean }) => (
    <div className="connection-container">
        <svg width="100" height="40" viewBox="0 0 100 40" style={{ overflow: 'visible' }}>
            {/* Background Curved Path */}
            <path
                d="M 50 0 Q 30 20 50 40"
                stroke="var(--border-color)"
                strokeWidth="2"
                fill="none"
            />
            {/* Animated Flow Line */}
            {(active || completed) && (
                <path
                    d="M 50 0 Q 30 20 50 40"
                    className={`connection-line ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}
                />
            )}
            {/* Arrow Head */}
            <path
                d="M 45 32 L 50 40 L 55 32"
                fill="none"
                stroke={active || completed ? (completed ? "var(--success)" : "var(--accent-primary)") : "var(--border-color)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    </div>
);

const FlowNode = ({
    title,
    status,
    isActive,
    isCompleted,
    children,
    defaultExpanded = true
}: {
    title: string;
    status: string;
    isActive: boolean;
    isCompleted: boolean;
    children: React.ReactNode;
    defaultExpanded?: boolean;
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const nodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isActive && nodeRef.current) {
            // Center the active node
            nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isActive]);

    return (
        <div
            ref={nodeRef}
            className={`flow-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isActive && !isCompleted ? 'waiting' : ''}`}
        >
            <div className="node-header" onClick={() => setExpanded(!expanded)}>
                <div className="node-title">
                    {isCompleted ? '✅' : isActive ? '⚡️' : '⚪️'} {title}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.5 }}>
                    {status}
                </div>
            </div>
            <div className={`node-content ${expanded ? 'expanded' : 'collapsed'}`} onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
    stage,
    rawText,
    structure,
    generatedPrompt,
    finalImage,
    imageError,
    setStructure,
    setGeneratedPrompt,
    onAddModule
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const [imageModalOpen, setImageModalOpen] = useState(false);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [stage, structure, generatedPrompt, finalImage]);

    return (
        <div className="flow-canvas">

            {/* 0. Placeholder / Empty State */}
            {stage === Stage.Input && !rawText && (
                <div style={{ marginTop: '10vh', textAlign: 'center', opacity: 0.3 }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌊</div>
                    <div>Flow Canvas Ready</div>
                </div>
            )}

            {/* 1. Input Node */}
            {rawText && (
                <FlowNode
                    title="原始信息 (Input)"
                    status={stage > Stage.Input ? "已导入" : "待处理"}
                    isActive={stage === Stage.Input}
                    isCompleted={stage > Stage.Input}
                    defaultExpanded={true}
                >
                    <div style={{ whiteSpace: 'pre-wrap', color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6' }}>
                        {rawText}
                    </div>
                </FlowNode>
            )}

            {/* Connection 1-2 */}
            {(stage >= Stage.Organizing || (rawText && stage === Stage.Input)) && (
                <FlowConnection
                    active={stage === Stage.Organizing}
                    completed={stage >= Stage.ReviewStructure}
                />
            )}

            {/* 2. Structure Node */}
            {structure && (
                <FlowNode
                    title="结构化笔记 (Structure)"
                    status={stage > Stage.ReviewStructure ? "已确认" : "AI整理中"}
                    isActive={stage === Stage.ReviewStructure}
                    isCompleted={stage > Stage.ReviewStructure}
                >
                    <div style={{ marginBottom: '12px', fontSize: '11px', color: '#818cf8' }}>
                        🏷️ {structure.visual_theme_keywords}
                    </div>
                    <input
                        className="invisible-input title-input"
                        value={structure.title}
                        onChange={e => setStructure({ ...structure, title: e.target.value })}
                        disabled={stage !== Stage.ReviewStructure}
                        placeholder="主标题"
                    />
                    <input
                        className="invisible-input subtitle-input"
                        value={structure.summary_context}
                        onChange={e => setStructure({ ...structure, summary_context: e.target.value })}
                        disabled={stage !== Stage.ReviewStructure}
                        placeholder="内容简介"
                    />

                    <div className="modules-grid">
                        {structure.modules.map((mod, idx) => (
                            <div key={mod.id} className="structure-section-compact">
                                <input
                                    className="invisible-input heading-input-compact"
                                    value={mod.heading}
                                    onChange={e => {
                                        const newMods = [...structure.modules];
                                        newMods[idx].heading = e.target.value;
                                        setStructure({ ...structure, modules: newMods });
                                    }}
                                    disabled={stage !== Stage.ReviewStructure}
                                    placeholder="子标题"
                                />
                                <textarea
                                    className="invisible-input body-input-compact"
                                    value={mod.content}
                                    onChange={e => {
                                        const newMods = [...structure.modules];
                                        newMods[idx].content = e.target.value;
                                        setStructure({ ...structure, modules: newMods });
                                    }}
                                    disabled={stage !== Stage.ReviewStructure}
                                    placeholder="核心内容"
                                />
                            </div>
                        ))}
                    </div>

                    {stage === Stage.ReviewStructure && (
                        <button
                            onClick={onAddModule}
                            className="add-module-btn"
                        >
                            + 新增子模块
                        </button>
                    )}
                </FlowNode>
            )}

            {/* Connection 2-3 */}
            {structure && (
                <FlowConnection
                    active={stage === Stage.Designing}
                    completed={stage >= Stage.ReviewPrompt}
                />
            )}

            {/* 3. Prompt Node */}
            {generatedPrompt && (
                <FlowNode
                    title="绘图指令 (Prompt)"
                    status={stage > Stage.ReviewPrompt ? "已确认" : "生成中"}
                    isActive={stage === Stage.ReviewPrompt}
                    isCompleted={stage > Stage.ReviewPrompt}
                >
                    <textarea
                        className="prompt-editor"
                        value={generatedPrompt}
                        onChange={e => setGeneratedPrompt(e.target.value)}
                        disabled={stage !== Stage.ReviewPrompt}
                    />
                </FlowNode>
            )}

            {/* Connection 3-4 */}
            {generatedPrompt && (
                <FlowConnection
                    active={stage === Stage.Painting}
                    completed={stage === Stage.Done}
                />
            )}

            {/* 4. Image Node */}
            {(stage >= Stage.Painting || finalImage) && (
                <FlowNode
                    title="最终视觉笔记 (Visual Note)"
                    status={stage === Stage.Done ? "完成" : "绘制中"}
                    isActive={stage === Stage.Done || stage === Stage.Painting}
                    isCompleted={stage === Stage.Done}
                >
                    <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #27272a' }}>
                        {finalImage ? (
                            <>
                                {!imageError ? (
                                    <>
                                        <div
                                            className="image-thumbnail"
                                            onClick={() => setImageModalOpen(true)}
                                            style={{ cursor: 'pointer', position: 'relative' }}
                                        >
                                            <img
                                                src={finalImage}
                                                style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block', backgroundColor: '#18181b' }}
                                                onError={(e) => {
                                                    console.error("Image render error", e);
                                                }}
                                                alt="Generated Visual Note"
                                            />
                                            <div className="image-overlay">
                                                <span>🔍 点击查看大图</span>
                                            </div>
                                        </div>
                                        {imageModalOpen && (
                                            <div className="image-modal" onClick={() => setImageModalOpen(false)}>
                                                <div className="image-modal-content" onClick={e => e.stopPropagation()}>
                                                    <button className="modal-close" onClick={() => setImageModalOpen(false)}>✕</button>
                                                    <img src={finalImage} alt="Full Size Visual Note" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ padding: '40px', background: '#3f1111', color: '#f87171', textAlign: 'center' }}>
                                        <h3>⚠️ 图片显示失败</h3>
                                        <p>{imageError}</p>
                                    </div>
                                )}
                                <div style={{ padding: '16px', background: '#18181b', borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'flex-end' }}>
                                    <a href={finalImage} download="soulnote_visual.png" className="primary-btn" style={{ width: 'auto', margin: 0, padding: '8px 16px', fontSize: '14px' }}>
                                        ⬇️ 下载图片
                                    </a>
                                </div>
                            </>
                        ) : (
                            <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#18181b' }}>
                                <div className="spinner" style={{ width: '30px', height: '30px', marginBottom: '16px' }}></div>
                                <div style={{ color: '#a1a1aa', fontSize: '12px' }}>AI 正在绘制...</div>
                            </div>
                        )}
                    </div>
                </FlowNode>
            )}

            <div ref={bottomRef} style={{ height: '20px' }}></div>
        </div>
    );
};
