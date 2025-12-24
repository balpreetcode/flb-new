import React from 'react';
import { useWorkflowContext } from '../context/WorkflowContext';
import { getNodeTypeConfig, type NodeExecutionConfig, type NodeType } from '../types/nodes';
import './NodePropertiesPanel.css';

interface FormField {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number' | 'slider' | 'toggle' | 'file' | 'video' | 'audio' | 'image';
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
}

const FORM_SCHEMAS: Record<NodeType, FormField[]> = {
    'upload_files': [
        { name: 'sourceType', label: 'Source Type', type: 'select', options: ['Local', 'URL', 'Cloud Storage'] },
        { name: 'assetType', label: 'Asset Type', type: 'select', options: ['Image', 'Video', 'Audio'] },
        { name: 'files', label: 'Files', type: 'file' }
    ],
    'text_to_text': [
        { name: 'prompt', label: 'Prompt', type: 'textarea' },
        { name: 'model', label: 'Model', type: 'select', options: ['gpt-4o', 'gpt-4o-mini', 'claude-3-opus', 'claude-3-sonnet'] },
        { name: 'systemPrompt', label: 'System Prompt', type: 'textarea' },
        { name: 'temperature', label: 'Temperature', type: 'slider', min: 0, max: 1, step: 0.1 }
    ],
    'text_to_image': [
        { name: 'prompt', label: 'Positive Prompt', type: 'textarea' },
        { name: 'negativePrompt', label: 'Negative Prompt', type: 'textarea' },
        { name: 'aspectRatio', label: 'Aspect Ratio', type: 'select', options: ['1:1', '16:9', '9:16', '4:3'] },
        { name: 'model', label: 'Model', type: 'select', options: ['fal-ai/flux/schnell', 'fal-ai/z-image/turbo', 'dall-e-3'] }
    ],
    'text_to_video': [
        { name: 'prompt', label: 'Prompt', type: 'textarea' },
        { name: 'duration', label: 'Duration', type: 'select', options: ['5 seconds', '10 seconds'] },
        { name: 'resolution', label: 'Resolution', type: 'select', options: ['720p', '1080p', '4K'] },
        { name: 'style', label: 'Style', type: 'select', options: ['Realistic', 'Cinematic', 'Anime', '3D Render'] },
        { name: 'model', label: 'Model', type: 'select', options: ['fal-ai/ltxv-13b-098-distilled', 'fal-ai/wan/v2.1/text-to-video'] }
    ],
    'text_to_music': [
        { name: 'prompt', label: 'Prompt', type: 'textarea' },
        { name: 'duration', label: 'Duration (sec)', type: 'number' },
        { name: 'tempo', label: 'Tempo (BPM)', type: 'number' }
    ],
    'text_to_speech': [
        { name: 'text', label: 'Text Content', type: 'textarea' },
        { name: 'voice', label: 'Voice', type: 'select', options: ['af_bella', 'af_sky', 'en_us_1'] },
        { name: 'model', label: 'Model', type: 'select', options: ['fal-ai/playht/tts/v3', 'openai/tts-1'] },
        { name: 'stability', label: 'Stability', type: 'slider', min: 0, max: 1, step: 0.1 }
    ],
    'image_to_video': [
        { name: 'imageUrl', label: 'Source Image', type: 'image' },
        { name: 'prompt', label: 'Motion Prompt', type: 'textarea' },
        { name: 'model', label: 'Model', type: 'select', options: ['fal-ai/ltxv-13b-098-distilled/image-to-video', 'fal-ai/wan/v2.1/image-to-video'] },
        { name: 'motionBucket', label: 'Motion Bucket', type: 'number', min: 1, max: 255 },
        { name: 'duration', label: 'Duration', type: 'number' },
        { name: 'seed', label: 'Seed', type: 'number' }
    ],
    'image_to_image': [
        { name: 'imageUrl', label: 'Source Image', type: 'image' },
        { name: 'prompt', label: 'Prompt', type: 'textarea' },
        { name: 'strength', label: 'Strength', type: 'slider', min: 0, max: 1, step: 0.1 },
        { name: 'model', label: 'Model', type: 'select', options: ['fal-ai/stable-diffusion-v3-medium', 'openai/dall-e-2'] }
    ],
    'face_swap': [
        { name: 'targetImageUrl', label: 'Target Image', type: 'image' },
        { name: 'sourceImageUrl', label: 'Source Face', type: 'image' },
        { name: 'faceEnhance', label: 'Face Enhance', type: 'toggle' }
    ],
    'lip_sync': [
        { name: 'videoUrl', label: 'Video File', type: 'video' },
        { name: 'audioUrl', label: 'Audio File', type: 'audio' },
        { name: 'model', label: 'Model', type: 'select', options: ['SadTalker', 'HeyGen', 'SyncLabs'] }
    ],
    'ai_avatar': [
        { name: 'avatar', label: 'Avatar', type: 'select', options: ['Predefined 1', 'Predefined 2', 'Custom'] },
        { name: 'script', label: 'Script', type: 'textarea' },
        { name: 'background', label: 'Background', type: 'select', options: ['Transparent', 'Solid Color', 'Image'] }
    ],
    'enhancer': [
        { name: 'sourceUrl', label: 'Source File', type: 'file' },
        { name: 'upscaleFactor', label: 'Upscale Factor', type: 'select', options: ['1x', '2x', '4x'] },
        { name: 'denoiseStrength', label: 'Denoise Strength', type: 'slider', min: 0, max: 1, step: 0.1 }
    ],
    'split_text': [
        { name: 'text', label: 'Source', type: 'textarea' },
        { name: 'numSegments', label: 'Scenes', type: 'number' },
        { name: 'splitMode', label: 'Split Mode', type: 'select', options: ['text', 'array', 'json_path'] },
        { name: 'arrayPath', label: 'Array Path', type: 'text' }
    ],
    'image_object_removal': [
        { name: 'imageUrl', label: 'Source Image', type: 'image' },
        { name: 'description', label: 'Mask/Description', type: 'text' }
    ],
    'image_remove_background': [
        { name: 'imageUrl', label: 'Source Image', type: 'image' },
        { name: 'outputFormat', label: 'Output Format', type: 'select', options: ['PNG', 'JPG'] }
    ],
    'video_sound_effects': [
        { name: 'prompt', label: 'Prompt', type: 'textarea' },
        { name: 'duration', label: 'Duration (sec)', type: 'number' },
        { name: 'videoUrl', label: 'Sync to Video', type: 'video' }
    ],
    'edit_video': [
        { name: 'videoUrl', label: 'Source Video', type: 'video' },
        { name: 'startTime', label: 'Trim Start', type: 'text' },
        { name: 'endTime', label: 'Trim End', type: 'text' },
        { name: 'cropRatio', label: 'Crop Ratio', type: 'select', options: ['1:1', '16:9', '9:16'] },
        { name: 'filter', label: 'Filter', type: 'select', options: ['None', 'Grayscale', 'Sepia', 'High Contrast'] }
    ],
    'clip_merger': [
        { name: 'clips', label: 'Input Clips', type: 'text' }, // Simplified for now
        { name: 'transition', label: 'Transition', type: 'select', options: ['Cross-fade', 'Slide', 'Cut', 'Zoom'] },
        { name: 'bgmUrl', label: 'BGM Overlay', type: 'audio' }
    ]
};

const OUTPUT_KEYS: Record<string, string[]> = {
    'text_to_text': ['text'],
    'text_to_image': ['imageUrl'],
    'image_to_image': ['imageUrl'],
    'text_to_video': ['videoUrl'],
    'image_to_video': ['videoUrl'],
    'text_to_music': ['audioUrl'],
    'text_to_speech': ['audioUrl', 'text'],
    'split_text': ['segments', 'items'],
    'edit_video': ['videoUrl'],
    'clip_merger': ['videoUrl'],
    'upload_files': ['files'],
};

export const NodePropertiesPanel: React.FC = () => {
    const { workflow, selectedNodeId, updateNode, execution } = useWorkflowContext();

    const selectedNode = workflow.nodes.find(n => n.id === selectedNodeId);

    if (!selectedNode) {
        return (
            <aside className="properties-panel empty">
                <div className="empty-state">
                    <span className="empty-icon">🖱️</span>
                    <p>Select a node to edit its properties</p>
                </div>
            </aside>
        );
    }

    const nodeIndex = workflow.nodes.findIndex(n => n.id === selectedNode.id);
    const previousNodes = workflow.nodes.slice(0, nodeIndex);

    const nodeConfig = getNodeTypeConfig(selectedNode.type);
    const fields = FORM_SCHEMAS[selectedNode.type] || [];
    const executionConfig: NodeExecutionConfig = selectedNode.execution || {
        mode: 'parallel',
        waitForAll: false,
        aggregateItems: false
    };

    const arrayInputCount = (() => {
        const outputs = new Map<string, any>();
        execution.results.forEach(result => {
            const output = (result.data as any)?.output;
            if (output) {
                outputs.set(result.nodeId, output);
            }
        });

        const refs: Array<{ nodeId: string; outputKey: string }> = [];
        const collectReferences = (value: any) => {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) {
                value.forEach(item => collectReferences(item));
                return;
            }
            if (value._type === 'reference' && value.nodeId && value.outputKey) {
                refs.push({ nodeId: value.nodeId, outputKey: value.outputKey });
                return;
            }
            Object.values(value).forEach(item => collectReferences(item));
        };

        collectReferences(selectedNode.config);

        let count: number | undefined;
        refs.forEach(ref => {
            const output = outputs.get(ref.nodeId);
            if (!output) return;
            const value = output[ref.outputKey];
            if (Array.isArray(value)) {
                count = count ?? value.length;
                return;
            }
            if (ref.outputKey === 'items') {
                if (Array.isArray(output.items)) {
                    count = count ?? output.items.length;
                } else if (typeof output.itemsCount === 'number') {
                    count = count ?? output.itemsCount;
                }
            }
        });

        return count;
    })();

    const handleFieldChange = (name: string, value: any) => {
        const nextConfig: Record<string, unknown> = {
            ...(selectedNode.config || {}),
            [name]: value
        };

        if (selectedNode.type === 'split_text' && name === 'splitMode') {
            if (value === 'json_path' && typeof nextConfig.arrayPath !== 'string') {
                nextConfig.arrayPath = '';
            }
        }

        if (selectedNode.type === 'split_text' && name === 'arrayPath' && typeof value !== 'string') {
            nextConfig.arrayPath = '';
        }

        updateNode(selectedNode.id, { config: nextConfig });
    };

    const updateExecution = (updates: Partial<NodeExecutionConfig>) => {
        updateNode(selectedNode.id, {
            execution: {
                ...executionConfig,
                ...updates
            }
        });
    };

    const toggleReference = (fieldName: string) => {
        const currentVal = (selectedNode.config as any)?.[fieldName];
        if (currentVal && typeof currentVal === 'object' && currentVal._type === 'reference') {
            handleFieldChange(fieldName, '');
        } else {
            handleFieldChange(fieldName, {
                _type: 'reference',
                nodeId: previousNodes[previousNodes.length - 1]?.id || '',
                outputKey: OUTPUT_KEYS[previousNodes[previousNodes.length - 1]?.type]?.[0] || ''
            });
        }
    };

    return (
        <aside className="properties-panel">
            <div className="panel-header">
                <div className="node-type-badge">
                    <span className="type-icon">{nodeConfig.icon}</span>
                    <span className="type-label">{nodeConfig.label}</span>
                </div>
                <h3>Node Configuration</h3>
            </div>

            <div className="panel-content">
                <div className="form-group title-group">
                    <label>Display Title</label>
                    <input
                        type="text"
                        value={selectedNode.title}
                        onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                    />
                </div>

                <div className="section-title">Execution</div>
                <div className="form-group toggle-group">
                    <span className="toggle-label">Run items in parallel</span>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={executionConfig.mode === 'parallel'}
                            onChange={(e) => updateExecution({ mode: e.target.checked ? 'parallel' : 'sequential' })}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
                <div className="form-group toggle-group">
                    <span className="toggle-label">Wait for all previous items</span>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={executionConfig.waitForAll}
                            onChange={(e) => updateExecution({ waitForAll: e.target.checked })}
                        />
                        <span className="slider round"></span>
                    </label>
                </div>
                {executionConfig.waitForAll && (
                    <div className="form-group toggle-group">
                        <span className="toggle-label">Aggregate items into one request</span>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={executionConfig.aggregateItems}
                                onChange={(e) => updateExecution({ aggregateItems: e.target.checked })}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                )}
                {typeof arrayInputCount === 'number' && (
                    <div className="execution-hint">
                        Array input detected ({arrayInputCount} items)
                    </div>
                )}

                {fields.map(field => {
                    if (selectedNode.type === 'split_text' && field.name === 'arrayPath') {
                        const splitMode = ((selectedNode.config as any)?.splitMode || 'text').toString().toLowerCase();
                        if (!splitMode.includes('json')) {
                            return null;
                        }
                    }
                    const fieldValue = (selectedNode.config as any)?.[field.name];
                    const isReference = fieldValue && typeof fieldValue === 'object' && fieldValue._type === 'reference';
                    const canBeReference = ['text', 'textarea', 'image', 'video', 'audio', 'file'].includes(field.type)
                        && !(selectedNode.type === 'split_text' && field.name === 'arrayPath');

                    const fieldNode = (
                        <div key={field.name} className="form-group">
                            <label>
                                {field.label}
                                {canBeReference && previousNodes.length > 0 && (
                                    <div className="reference-controls">
                                        <button
                                            className={`btn-link-node ${isReference ? 'active' : ''}`}
                                            onClick={() => toggleReference(field.name)}
                                            title="Link to previous node output"
                                        >
                                            🔗 {isReference ? 'Linked' : 'Link'}
                                        </button>
                                    </div>
                                )}
                            </label>

                            {isReference ? (
                                <div className="reference-selector">
                                    <select
                                        value={fieldValue.nodeId}
                                        onChange={(e) => handleFieldChange(field.name, { ...fieldValue, nodeId: e.target.value })}
                                    >
                                        {previousNodes.map(node => (
                                            <option key={node.id} value={node.id}>{node.title}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={fieldValue.outputKey}
                                        onChange={(e) => handleFieldChange(field.name, { ...fieldValue, outputKey: e.target.value })}
                                    >
                                        {(() => {
                                            const keys = OUTPUT_KEYS[workflow.nodes.find(n => n.id === fieldValue.nodeId)?.type || ''] || [];
                                            const withItems = keys.includes('items') ? keys : [...keys, 'items'];
                                            return withItems.map(key => (
                                                <option key={key} value={key}>{key}</option>
                                            ));
                                        })() || <option value="">No outputs</option>}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    {field.type === 'textarea' && (
                                        <textarea
                                            value={fieldValue || ''}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                                        />
                                    )}
                                    {field.type === 'text' && (
                                        <input
                                            type="text"
                                            value={field.name === 'arrayPath' ? (typeof fieldValue === 'string' ? fieldValue : '') : (fieldValue || '')}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            placeholder={field.name === 'arrayPath' ? 'response.body.Items' : `Enter ${field.label.toLowerCase()}...`}
                                        />
                                    )}
                                    {field.type === 'number' && (
                                        <input
                                            type="number"
                                            value={fieldValue || ''}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            min={field.min}
                                            max={field.max}
                                        />
                                    )}
                                    {field.type === 'select' && (
                                        <select
                                            value={fieldValue || field.options?.[0]}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        >
                                            {field.options?.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    )}
                                    {field.type === 'slider' && (
                                        <div className="slider-container">
                                            <input
                                                type="range"
                                                min={field.min}
                                                max={field.max}
                                                step={field.step}
                                                value={fieldValue || field.min}
                                                onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value))}
                                            />
                                            <span className="slider-value">{fieldValue || field.min}</span>
                                        </div>
                                    )}
                                    {field.type === 'toggle' && (
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={fieldValue || false}
                                                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                    )}
                                    {(field.type === 'file' || field.type === 'image' || field.type === 'video' || field.type === 'audio') && (
                                        <div className="file-input-container">
                                            <input
                                                type="text"
                                                value={fieldValue || ''}
                                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                                placeholder="Paste URL or upload..."
                                            />
                                            <button className="btn-secondary small">Upload</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );

                    if (field.name !== 'prompt') {
                        return fieldNode;
                    }

                    const concatPromptsEnabled = Boolean((selectedNode.config as any)?.concatPrompts);
                    const extraPrompts: FormField[] = [
                        { name: 'prompt2', label: 'Prompt 2', type: 'textarea' },
                        { name: 'prompt3', label: 'Prompt 3', type: 'textarea' },
                        { name: 'prompt4', label: 'Prompt 4', type: 'textarea' }
                    ];

                    return (
                        <React.Fragment key={`${field.name}-extra`}>
                            {fieldNode}
                            <div className="form-group toggle-group">
                                <span className="toggle-label">Concat more prompts</span>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={concatPromptsEnabled}
                                        onChange={(e) => handleFieldChange('concatPrompts', e.target.checked)}
                                    />
                                    <span className="slider round"></span>
                                </label>
                            </div>
                            {concatPromptsEnabled && extraPrompts.map(extraField => {
                                const extraValue = (selectedNode.config as any)?.[extraField.name];
                                const extraIsReference = extraValue && typeof extraValue === 'object' && extraValue._type === 'reference';
                                const extraCanBeReference = true;

                                return (
                                    <div key={extraField.name} className="form-group">
                                        <label>
                                            {extraField.label}
                                            {extraCanBeReference && previousNodes.length > 0 && (
                                                <div className="reference-controls">
                                                    <button
                                                        className={`btn-link-node ${extraIsReference ? 'active' : ''}`}
                                                        onClick={() => toggleReference(extraField.name)}
                                                        title="Link to previous node output"
                                                    >
                                                        🔗 {extraIsReference ? 'Linked' : 'Link'}
                                                    </button>
                                                </div>
                                            )}
                                        </label>
                                        {extraIsReference ? (
                                            <div className="reference-selector">
                                                <select
                                                    value={extraValue.nodeId}
                                                    onChange={(e) => handleFieldChange(extraField.name, { ...extraValue, nodeId: e.target.value })}
                                                >
                                                    {previousNodes.map(node => (
                                                        <option key={node.id} value={node.id}>{node.title}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={extraValue.outputKey}
                                                    onChange={(e) => handleFieldChange(extraField.name, { ...extraValue, outputKey: e.target.value })}
                                                >
                                                    {(() => {
                                                        const keys = OUTPUT_KEYS[workflow.nodes.find(n => n.id === extraValue.nodeId)?.type || ''] || [];
                                                        const withItems = keys.includes('items') ? keys : [...keys, 'items'];
                                                        return withItems.map(key => (
                                                            <option key={key} value={key}>{key}</option>
                                                        ));
                                                    })() || <option value="">No outputs</option>}
                                                </select>
                                            </div>
                                        ) : (
                                            <textarea
                                                value={extraValue || ''}
                                                onChange={(e) => handleFieldChange(extraField.name, e.target.value)}
                                                placeholder={`Enter ${extraField.label.toLowerCase()}...`}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="panel-footer">
                <div className="node-stats">
                    <div className="stat">
                        <span className="stat-label">Provider:</span>
                        <span className="stat-value">{selectedNode.provider}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Estimated Time:</span>
                        <span className="stat-value">{selectedNode.estimatedTime}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};
