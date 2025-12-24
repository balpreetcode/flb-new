import { useState, useCallback, useEffect, useRef } from 'react';
import type { WorkflowNodeData, NodeType } from '../types/nodes';
import { createNode } from '../types/nodes';

const STORAGE_KEY = 'workflow-builder-state';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export interface WorkflowState {
    nodes: WorkflowNodeData[];
    name: string;
    lastModified: string;
    templateVersion?: number;
}

export interface ExecutionState {
    isRunning: boolean;
    workflowId: string | null;
    currentNodeId: string | null;
    error: string | null;
    results: Array<{
        nodeId: string;
        nodeType: string;
        success: boolean;
        data?: unknown;
        error?: string;
    }>;
}

const DEFAULT_TEMPLATE_VERSION = 5;

const DEFAULT_NODE_EXECUTION = {
    mode: 'parallel' as const,
    waitForAll: false,
    aggregateItems: false
};

const normalizeWorkflow = (workflowState: WorkflowState): WorkflowState => ({
    ...workflowState,
    nodes: workflowState.nodes.map(node => ({
        ...node,
        execution: {
            ...DEFAULT_NODE_EXECUTION,
            ...(node.execution || {})
        }
    }))
});

const defaultWorkflow: WorkflowState = {
    nodes: [
        {
            id: 'node-story-1',
            type: 'text_to_text',
            title: '1. Generate Story',
            provider: 'OpenAI',
            status: 'not_run',
            estimatedTime: '10s',
            config: {
                prompt: 'Write a short, vivid story (6-8 sentences) with a clear beginning, middle, and end.'
            },
            execution: {
                mode: 'parallel',
                waitForAll: false,
                aggregateItems: false
            }
        },
        {
            id: 'node-scenes-1',
            type: 'split_text',
            title: '2. Split Story Into 3 Scenes',
            provider: 'ClipZap',
            status: 'not_run',
            estimatedTime: '30s',
            config: {
                text: { _type: 'reference', nodeId: 'node-story-1', outputKey: 'text' },
                numSegments: 3
            },
            execution: {
                mode: 'parallel',
                waitForAll: false,
                aggregateItems: false
            }
        },
        {
            id: 'node-narration-1',
            type: 'text_to_text',
            title: '3. Narration For All Scenes',
            provider: 'OpenAI',
            status: 'not_run',
            estimatedTime: '10s',
            config: {
                prompt: { _type: 'reference', nodeId: 'node-scenes-1', outputKey: 'items' },
                systemPrompt: 'Write a short narration (2-3 sentences) for the given scene. Return only the narration text.'
            },
            execution: {
                mode: 'parallel',
                waitForAll: false,
                aggregateItems: false
            }
        },
        {
            id: 'node-img-prompt-1',
            type: 'text_to_text',
            title: '4. Image Prompts For All Scenes',
            provider: 'OpenAI',
            status: 'not_run',
            estimatedTime: '10s',
            config: {
                prompt: { _type: 'reference', nodeId: 'node-scenes-1', outputKey: 'items' },
                systemPrompt: 'Generate a vivid image generation prompt for this scene. Return only the prompt.'
            },
            execution: {
                mode: 'parallel',
                waitForAll: false,
                aggregateItems: false
            }
        },
        {
            id: 'node-video-prompt-1',
            type: 'text_to_text',
            title: '5. Video Prompts For All Scenes',
            provider: 'OpenAI',
            status: 'not_run',
            estimatedTime: '10s',
            config: {
                prompt: { _type: 'reference', nodeId: 'node-scenes-1', outputKey: 'items' },
                systemPrompt: 'Generate a cinematic video motion prompt for this scene. Return only the prompt.'
            },
            execution: {
                mode: 'parallel',
                waitForAll: false,
                aggregateItems: false
            }
        },
        {
            id: 'node-tts-all',
            type: 'text_to_speech',
            title: '6. Speech For All Narrations',
            provider: 'ElevenLabs',
            status: 'not_run',
            estimatedTime: '20s',
            config: {
                text: { _type: 'reference', nodeId: 'node-narration-1', outputKey: 'text' },
                voice: 'af_bella'
            },
            execution: {
                mode: 'parallel',
                waitForAll: true,
                aggregateItems: false
            }
        },
        {
            id: 'node-img-all',
            type: 'text_to_image',
            title: '7. Images For All Scenes',
            provider: 'Fal AI',
            status: 'not_run',
            estimatedTime: '30s',
            config: {
                prompt: { _type: 'reference', nodeId: 'node-img-prompt-1', outputKey: 'text' },
                aspectRatio: '16:9'
            },
            execution: {
                mode: 'parallel',
                waitForAll: true,
                aggregateItems: false
            }
        },
        {
            id: 'node-video-all',
            type: 'image_to_video',
            title: '8. Videos For All Scenes',
            provider: 'Runway',
            status: 'not_run',
            estimatedTime: '2min',
            config: {
                imageUrl: { _type: 'reference', nodeId: 'node-img-all', outputKey: 'imageUrl' },
                prompt: { _type: 'reference', nodeId: 'node-video-prompt-1', outputKey: 'text' },
                duration: 5
            },
            execution: {
                mode: 'parallel',
                waitForAll: true,
                aggregateItems: false
            }
        },
        {
            id: 'node-music-1',
            type: 'text_to_music',
            title: '9. Story Music',
            provider: 'MiniMax',
            status: 'not_run',
            estimatedTime: '3min',
            config: {
                prompt: { _type: 'reference', nodeId: 'node-story-1', outputKey: 'text' },
                duration: 20
            },
            execution: {
                mode: 'parallel',
                waitForAll: false,
                aggregateItems: false
            }
        },
        {
            id: 'node-final-merge',
            type: 'edit_video',
            title: '10. Merge All Scenes + Audio',
            provider: 'FFmpeg',
            status: 'not_run',
            estimatedTime: '2min',
            config: {
                videoUrl: { _type: 'reference', nodeId: 'node-video-all', outputKey: 'videoUrl' },
                speechUrl: { _type: 'reference', nodeId: 'node-tts-all', outputKey: 'audioUrl' },
                musicUrl: { _type: 'reference', nodeId: 'node-music-1', outputKey: 'audioUrl' },
                speechVolume: 1.0,
                musicVolume: 0.3
            },
            execution: {
                mode: 'parallel',
                waitForAll: true,
                aggregateItems: true
            }
        }
    ],
    name: 'Story to Scenes (Parallel Template)',
    lastModified: new Date().toISOString(),
    templateVersion: DEFAULT_TEMPLATE_VERSION,
};

const defaultExecution: ExecutionState = {
    isRunning: false,
    workflowId: null,
    currentNodeId: null,
    error: null,
    results: [],
};

export const useWorkflow = () => {
    const [workflow, setWorkflow] = useState<WorkflowState>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
                    return normalizeWorkflow(defaultWorkflow);
                }
                if (parsed.templateVersion !== DEFAULT_TEMPLATE_VERSION) {
                    return normalizeWorkflow(defaultWorkflow);
                }
                return normalizeWorkflow(parsed);
            } catch {
                return normalizeWorkflow(defaultWorkflow);
            }
        }
        return normalizeWorkflow(defaultWorkflow);
    });

    const [execution, setExecution] = useState<ExecutionState>(defaultExecution);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Auto-select first node if none selected and nodes exist
    useEffect(() => {
        if (!selectedNodeId && workflow.nodes.length > 0) {
            setSelectedNodeId(workflow.nodes[0].id);
        }
    }, [workflow.nodes, selectedNodeId]);

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow));
    }, [workflow]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, []);

    const addNode = useCallback((type: NodeType, afterIndex?: number) => {
        setWorkflow(prev => {
            const newNode = createNode(type, afterIndex !== undefined ? afterIndex + 1 : prev.nodes.length);
            const nodes = [...prev.nodes];

            if (afterIndex !== undefined) {
                nodes.splice(afterIndex + 1, 0, newNode);
            } else {
                nodes.push(newNode);
            }

            // Update titles with correct numbering
            const updatedNodes = nodes.map((node, index) => ({
                ...node,
                title: `${index + 1}. ${node.title.replace(/^\d+\.\s*/, '')}`,
            }));

            return {
                ...prev,
                nodes: updatedNodes,
                lastModified: new Date().toISOString(),
            };
        });
    }, []);

    const removeNode = useCallback((nodeId: string) => {
        setWorkflow(prev => {
            const nodes = prev.nodes.filter(n => n.id !== nodeId);

            // Update titles with correct numbering
            const updatedNodes = nodes.map((node, index) => ({
                ...node,
                title: `${index + 1}. ${node.title.replace(/^\d+\.\s*/, '')}`,
            }));

            return {
                ...prev,
                nodes: updatedNodes,
                lastModified: new Date().toISOString(),
            };
        });
    }, []);

    const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNodeData>) => {
        setWorkflow(prev => ({
            ...prev,
            nodes: prev.nodes.map(node =>
                node.id === nodeId ? { ...node, ...updates } : node
            ),
            lastModified: new Date().toISOString(),
        }));
    }, []);

    const moveNode = useCallback((fromIndex: number, toIndex: number) => {
        setWorkflow(prev => {
            const nodes = [...prev.nodes];
            const [removed] = nodes.splice(fromIndex, 1);
            nodes.splice(toIndex, 0, removed);

            // Update titles with correct numbering
            const updatedNodes = nodes.map((node, index) => ({
                ...node,
                title: `${index + 1}. ${node.title.replace(/^\d+\.\s*/, '')}`,
            }));

            return {
                ...prev,
                nodes: updatedNodes,
                lastModified: new Date().toISOString(),
            };
        });
    }, []);

    const clearWorkflow = useCallback(() => {
        setWorkflow(normalizeWorkflow({
            ...defaultWorkflow,
            lastModified: new Date().toISOString(),
        }));
    }, []);

    const renameWorkflow = useCallback((name: string) => {
        setWorkflow(prev => ({
            ...prev,
            name,
            lastModified: new Date().toISOString(),
        }));
    }, []);

    // Poll for workflow status
    const pollStatus = useCallback(async (workflowId: string) => {
        try {
            const response = await fetch(`${BACKEND_URL}/workflow/${workflowId}/status`);
            const data = await response.json();

            if (data.error) {
                setExecution(prev => ({
                    ...prev,
                    error: data.error,
                    isRunning: false,
                }));
                return;
            }

            // Update node statuses in UI
            if (data.nodeStatuses) {
                setWorkflow(prev => ({
                    ...prev,
                    nodes: prev.nodes.map(node => {
                        const statusInfo = data.nodeStatuses.find((s: { id: string }) => s.id === node.id);
                        if (statusInfo) {
                            return {
                                ...node,
                                status: statusInfo.status === 'completed' ? 'completed' :
                                    statusInfo.status === 'running' ? 'running' :
                                        statusInfo.status === 'pending' ? 'not_run' :
                                            statusInfo.status === 'failed' || statusInfo.status === 'error' ? 'error' : node.status
                            };
                        }
                        return node;
                    }),
                }));
            }

            setExecution(prev => ({
                ...prev,
                currentNodeId: data.currentNodeId,
                results: data.results || [],
            }));

            // Stop polling if completed or failed
            if (data.status === 'completed' || data.status === 'failed') {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                setExecution(prev => ({
                    ...prev,
                    isRunning: false,
                    error: data.status === 'failed' ? data.error : null,
                }));
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, []);

    // Run the workflow
    const runWorkflow = useCallback(async () => {
        if (workflow.nodes.length === 0) {
            setExecution(prev => ({
                ...prev,
                error: 'No nodes in workflow',
            }));
            return;
        }

        // Reset all node statuses
        setWorkflow(prev => ({
            ...prev,
            nodes: prev.nodes.map(node => ({
                ...node,
                status: 'not_run' as const,
            })),
        }));

        setExecution({
            isRunning: true,
            workflowId: null,
            currentNodeId: null,
            error: null,
            results: [],
        });

        try {
            const response = await fetch(`${BACKEND_URL}/workflow/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodes: workflow.nodes,
                    workflowName: workflow.name,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                setExecution(prev => ({
                    ...prev,
                    isRunning: false,
                    error: data.error || 'Failed to start workflow',
                }));
                return;
            }

            setExecution(prev => ({
                ...prev,
                workflowId: data.workflowId,
            }));

            // Start polling for status
            pollingRef.current = setInterval(() => {
                pollStatus(data.workflowId);
            }, 500);

        } catch (error) {
            setExecution(prev => ({
                ...prev,
                isRunning: false,
                error: error instanceof Error ? error.message : 'Failed to connect to backend',
            }));
        }
    }, [workflow.nodes, workflow.name, pollStatus]);

    const stopWorkflow = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        setExecution(prev => ({
            ...prev,
            isRunning: false,
        }));
    }, []);

    return {
        workflow,
        execution,
        addNode,
        removeNode,
        updateNode,
        moveNode,
        clearWorkflow,
        renameWorkflow,
        runWorkflow,
        stopWorkflow,
        selectedNodeId,
        setSelectedNodeId,
    };
};
