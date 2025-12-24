require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const { generateText, parseJSON } = require('./generators/text');
const { generateImage } = require('./generators/image');
const { generateVideo, generateVideoFromText } = require('./generators/video');
const { generateMusic } = require('./generators/music');
const { generateSpeech } = require('./generators/speech');
const { generateImageOpenAI, editImageOpenAI } = require('./generators/openai-image');
const { composeVideo, concatAudioUrls, concatVideoUrls } = require('./generators/ffmpeg');

const HISTORY_FILE = path.join(__dirname, 'workflow-history.json');
const CONDUCTOR_URL = process.env.CONDUCTOR_URL || 'https://p5200.winds-os.com/api';
const CONTENT_SERVICE_URL = process.env.CONTENT_SERVICE_URL; // Optional external service for face_swap, lip_sync, etc.
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1000);
const PORT = Number(process.env.PORT || 5111);

const conductor = axios.create({
    baseURL: CONDUCTOR_URL,
    timeout: 30000
});

const app = express();
app.use(cors());
app.use(express.json());

const savedHistoryIds = new Set();

loadHistoryIndex();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const MOCK_ENDPOINTS = {
    face_swap: '/face-swap',
    lip_sync: '/lip-sync',
    ai_avatar: '/ai-avatar',
    enhancer: '/enhancer',
    image_object_removal: '/image-object-removal',
    image_remove_background: '/image-remove-background',
    video_sound_effects: '/video-sound-effects'
};

const nodeProcessors = {
    text_to_text: async (config, previousResults) => {
        const prompt = config.prompt || 'Write a short creative story.';
        const systemPrompt = config.systemPrompt || '';
        const model = config.model || 'gpt-4o-mini';

        const text = await generateText(prompt, systemPrompt, model);
        return {
            type: 'text_to_text',
            output: { text, model, tokens: text.length }
        };
    },
    text_to_image: async (config) => {
        const prompt = config.prompt || 'A beautiful landscape';
        const aspectRatio = config.aspectRatio || '16:9';
        const provider = config.provider || 'fal';

        let imageUrl;
        if (provider === 'openai') {
            imageUrl = await generateImageOpenAI(prompt, {
                model: config.model || 'gpt-image-1-mini',
                size: config.size || '1024x1024'
            });
        } else {
            imageUrl = await generateImage(prompt, aspectRatio, config.model);
        }

        return {
            type: 'text_to_image',
            output: { imageUrl, prompt, aspectRatio }
        };
    },
    image_to_image: async (config, previousResults) => {
        const imageUrl = config.imageUrl || getLastOutput(previousResults, 'imageUrl');
        const prompt = config.prompt || 'Enhance this image';

        if (!imageUrl) throw new Error('No input image provided');

        const resultUrl = await editImageOpenAI(imageUrl, prompt, {
            model: config.model || 'gpt-image-1-mini'
        });

        return {
            type: 'image_to_image',
            output: { imageUrl: resultUrl, originalUrl: imageUrl }
        };
    },
    image_to_video: async (config, previousResults) => {
        const imageUrl = config.imageUrl || getLastOutput(previousResults, 'imageUrl');
        const prompt = config.prompt || 'gentle animation with subtle movement';
        const duration = config.duration || 5;

        if (!imageUrl) throw new Error('No input image provided');

        const videoUrl = await generateVideo(imageUrl, prompt, duration, config.model);
        return {
            type: 'image_to_video',
            output: { videoUrl, sourceImage: imageUrl, duration }
        };
    },
    text_to_video: async (config) => {
        const prompt = config.prompt || 'A cinematic scene';
        const duration = config.duration || 5;

        const videoUrl = await generateVideoFromText(prompt, duration, config.model);
        return {
            type: 'text_to_video',
            output: { videoUrl, prompt, duration }
        };
    },
    text_to_music: async (config) => {
        const prompt = config.prompt || 'Upbeat electronic music';
        const duration = config.duration || 30;

        const audioUrl = await generateMusic(prompt, duration, config.model);
        return {
            type: 'text_to_music',
            output: { audioUrl, prompt, duration }
        };
    },
    text_to_speech: async (config, previousResults) => {
        const text = config.text || getLastOutput(previousResults, 'text') || 'Hello world';
        const voice = config.voice || 'af_bella';
        const model = config.model || 'fal-ai/playht/tts/v3';

        const audioUrl = await generateSpeech(text, voice, model);
        return {
            type: 'text_to_speech',
            output: { audioUrl, text: text.substring(0, 100), voice }
        };
    },
    split_text: async (config, previousResults) => {
        const source = config.text ?? getLastOutput(previousResults, 'text') ?? '';
        const numSegments = Number(config.numSegments || 3);
        const splitModeRaw = (config.splitMode || 'text').toString().toLowerCase();
        const splitMode = splitModeRaw.includes('json') ? 'json_path' : splitModeRaw.includes('array') ? 'array' : 'text';

        const getValueByPath = (obj, path) => {
            if (!path) return undefined;
            const cleaned = path.replace(/^\$?\.*response\./, '').replace(/^\$?\./, '');
            return cleaned
                .split('.')
                .filter(Boolean)
                .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
        };

        const buildSegmentsFromArray = (items) => {
            let slicedItems = items;
            if (numSegments > 0 && items.length > numSegments) {
                slicedItems = items.slice(0, numSegments);
            }
            const segments = slicedItems.map((item, index) => {
                if (item && typeof item === 'object') {
                    return {
                        index,
                        text: item.text ?? JSON.stringify(item),
                        duration: Number(item.duration || 10)
                    };
                }
                return { index, text: String(item), duration: 10 };
            });
            return segments;
        };

        if (splitMode === 'array') {
            let items = source;
            if (typeof items === 'string') {
                const parsed = parseJSON(items, () => []);
                items = parsed;
            }
            if (!Array.isArray(items)) {
                throw new Error('Split mode "array" requires array input');
            }
            const segments = buildSegmentsFromArray(items);
            return {
                type: 'split_text',
                output: { segments, items: segments.map(segment => segment.text), totalSegments: segments.length }
            };
        }

        if (splitMode === 'json_path') {
            let payload = source;
            if (typeof payload === 'string') {
                payload = parseJSON(payload, () => ({}));
            }
            const items = getValueByPath(payload, config.arrayPath);
            if (!Array.isArray(items)) {
                throw new Error('Array path did not resolve to an array');
            }
            const segments = buildSegmentsFromArray(items);
            return {
                type: 'split_text',
                output: { segments, items: segments.map(segment => segment.text), totalSegments: segments.length }
            };
        }

        const text = Array.isArray(source) ? source.join('\n') : String(source);
        const prompt = `Split the following text into ${numSegments} logical segments for video scenes. Return as JSON array with objects containing "index", "text", and "duration" (estimated seconds). Text: "${text}"`;
        const result = await generateText(prompt, 'You are a text segmentation assistant. Always respond with valid JSON.');
        const segments = parseJSON(result, () => [{ index: 0, text, duration: 10 }]);

        return {
            type: 'split_text',
            output: { segments, items: segments.map(segment => segment.text), totalSegments: segments.length }
        };
    },
    edit_video: async (config, previousResults) => {
        const items = Array.isArray(config.items) ? config.items : null;
        const videoUrl = config.videoUrl || getLastOutput(previousResults, 'videoUrl');
        const speechUrl = config.speechUrl || getLastOutput(previousResults, 'audioUrl');
        const musicUrl = config.musicUrl;

        const speechVolume = config.speechVolume || 1.0;
        const musicVolume = config.musicVolume || 0.3;

        let mergedVideoPath = null;
        let mergedSpeechPath = null;
        let finalVideoSource = videoUrl;
        let finalSpeechSource = speechUrl;

        if (items) {
            const videoUrls = items.map(item => item.videoUrl).filter(Boolean);
            const speechUrls = items.map(item => item.speechUrl).filter(Boolean);

            if (videoUrls.length === 0) {
                throw new Error('No input videos provided');
            }

            mergedVideoPath = await concatVideoUrls(videoUrls);
            finalVideoSource = mergedVideoPath;

            if (speechUrls.length > 0) {
                mergedSpeechPath = await concatAudioUrls(speechUrls);
                finalSpeechSource = mergedSpeechPath;
            }
        }

        if (!finalVideoSource) throw new Error('No input video provided');

        const result = await composeVideo({
            videoUrl: finalVideoSource,
            speechUrl: finalSpeechSource,
            musicUrl,
            speechVolume,
            musicVolume,
            subtitleText: config.subtitleText,
            subtitlePosition: config.subtitlePosition,
            subtitleColor: config.subtitleColor,
            subtitleSize: config.subtitleSize
        });

        return {
            type: 'edit_video',
            output: { videoUrl: result.videoUrl, localPath: result.localPath }
        };
    },
    clip_merger: async (config, previousResults) => {
        const clips = config.clips || previousResults
            .filter(r => r.data?.output?.videoUrl)
            .map(r => r.data.output.videoUrl);

        if (!clips || clips.length === 0) {
            throw new Error('No video clips to merge');
        }

        return {
            type: 'clip_merger',
            output: {
                videoUrl: clips[clips.length - 1],
                clipsMerged: clips.length,
                note: 'Full merge implementation pending'
            }
        };
    },
    upload_files: async (config) => {
        const files = config.files || [];
        return {
            type: 'upload_files',
            output: {
                files: files.map((f, i) => ({ id: `file_${i}`, name: f.name || `file_${i}`, url: f.url })),
                totalFiles: files.length
            }
        };
    }
};

function loadHistoryIndex() {
    if (!fs.existsSync(HISTORY_FILE)) {
        return;
    }
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        const history = JSON.parse(data);
        history.forEach(entry => savedHistoryIds.add(entry.workflowId));
    } catch (error) {
        console.error('[History] Failed to load history index:', error.message);
    }
}

function saveExecutionHistory(executionData) {
    try {
        let history = [];
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            history = JSON.parse(data);
        }

        history.unshift(executionData);
        if (history.length > 50) {
            history = history.slice(0, 50);
        }

        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        savedHistoryIds.add(executionData.workflowId);
        console.log(`[History] Saved execution for workflow ${executionData.workflowId}`);
    } catch (err) {
        console.error('[History] Failed to save execution history:', err.message);
    }
}

function mapTaskStatus(status) {
    switch (status) {
        case 'IN_PROGRESS':
        case 'RUNNING':
            return 'running';
        case 'COMPLETED':
            return 'completed';
        case 'FAILED':
            return 'failed';
        default:
            return 'pending';
    }
}

function mapWorkflowStatus(status) {
    switch (status) {
        case 'RUNNING':
            return 'running';
        case 'COMPLETED':
            return 'completed';
        case 'FAILED':
            return 'failed';
        case 'PAUSED':
        case 'SCHEDULED':
        default:
            return 'pending';
    }
}

function getLastOutput(previousResults, key) {
    for (let i = previousResults.length - 1; i >= 0; i--) {
        const output = previousResults[i]?.data?.output;
        if (output && output[key]) {
            return output[key];
        }
    }
    return null;
}

function mapConfigReferences(config, nodeIdToTaskRef) {
    if (!config || typeof config !== 'object') return config;

    if (Array.isArray(config)) {
        return config.map(value => mapConfigReferences(value, nodeIdToTaskRef));
    }

    const resolved = {};
    Object.entries(config).forEach(([key, value]) => {
        if (value && typeof value === 'object' && value._type === 'reference') {
            const taskRef = nodeIdToTaskRef.get(value.nodeId);
            if (!taskRef || !value.outputKey) {
                resolved[key] = null;
            } else {
                resolved[key] = '${' + taskRef + '.output.' + value.outputKey + '}';
            }
        } else if (value && typeof value === 'object') {
            resolved[key] = mapConfigReferences(value, nodeIdToTaskRef);
        } else {
            resolved[key] = value;
        }
    });

    return resolved;
}

const DEFAULT_EXECUTION = {
    mode: 'parallel',
    waitForAll: false,
    aggregateItems: false
};

function normalizeExecution(execution) {
    if (!execution || typeof execution !== 'object') {
        return { ...DEFAULT_EXECUTION };
    }
    return {
        mode: execution.mode === 'parallel' ? 'parallel' : 'sequential',
        waitForAll: Boolean(execution.waitForAll),
        aggregateItems: Boolean(execution.aggregateItems)
    };
}

function getArrayFields(config) {
    if (!config || typeof config !== 'object') return [];
    return Object.entries(config).filter(([, value]) => Array.isArray(value));
}

function normalizePromptConfig(config) {
    if (!config || typeof config !== 'object' || !config.concatPrompts) {
        return config;
    }

    const promptFields = ['prompt', 'prompt2', 'prompt3', 'prompt4'];
    const values = promptFields
        .map(field => config[field])
        .filter(value => value !== undefined && value !== null && value !== '');

    if (values.length <= 1) {
        return {
            ...config,
            prompt: values[0] ?? config.prompt
        };
    }

    const hasArray = values.some(Array.isArray);
    let mergedPrompt;

    if (!hasArray) {
        mergedPrompt = values.join('\n\n');
    } else {
        const arrays = values.filter(Array.isArray);
        const length = arrays[0].length;
        arrays.forEach((arr) => {
            if (arr.length !== length) {
                throw new Error('Prompt arrays must be the same length');
            }
        });
        mergedPrompt = Array.from({ length }, (_, index) => (
            values
                .map(value => Array.isArray(value) ? value[index] : value)
                .filter(value => value !== undefined && value !== null && value !== '')
                .join('\n\n')
        ));
    }

    const normalized = { ...config, prompt: mergedPrompt };
    promptFields.slice(1).forEach(field => {
        if (field in normalized) delete normalized[field];
    });

    return normalized;
}

function buildItemConfigs(config, arrayFields) {
    const firstArray = arrayFields[0]?.[1] || [];
    const length = firstArray.length;

    arrayFields.forEach(([key, value]) => {
        if (!Array.isArray(value)) {
            throw new Error(`Input field "${key}" must be an array`);
        }
        if (value.length !== length) {
            throw new Error('Array inputs must be the same length');
        }
    });

    const baseConfig = { ...config };
    arrayFields.forEach(([key]) => {
        delete baseConfig[key];
    });

    const itemConfigs = Array.from({ length }, (_, index) => {
        const itemConfig = { ...baseConfig };
        arrayFields.forEach(([key, value]) => {
            itemConfig[key] = value[index];
        });
        return itemConfig;
    });

    return { itemConfigs, itemsCount: length, baseConfig };
}

async function runItemHandlers(runOne, itemConfigs, mode) {
    if (mode === 'parallel') {
        return Promise.all(itemConfigs.map(config => runOne(config)));
    }

    const results = [];
    for (const itemConfig of itemConfigs) {
        results.push(await runOne(itemConfig));
    }
    return results;
}

function combineOutputs(results, aggregateItems) {
    const outputs = results.map(result => {
        if (result && typeof result === 'object' && result.output && typeof result.output === 'object') {
            return result.output;
        }
        if (result && typeof result === 'object') {
            return result;
        }
        return { value: result };
    });

    if (aggregateItems) {
        return { items: outputs };
    }

    const combined = { items: outputs };
    outputs.forEach(output => {
        Object.entries(output).forEach(([key, value]) => {
            if (!combined[key]) {
                combined[key] = [];
            }
            combined[key].push(value);
        });
    });

    return combined;
}

async function ensureTaskDefinition(taskType) {
    try {
        await conductor.get(`/metadata/taskdefs/${taskType}`);
        return;
    } catch (error) {
        if (error.response?.status !== 404) {
            throw error;
        }
    }

    const taskDef = {
        name: taskType,
        description: `Flow Builder task: ${taskType}`,
        retryCount: 0,
        timeoutSeconds: 3600,
        responseTimeoutSeconds: 3600,
        inputKeys: ['config', 'nodeId', 'nodeType'],
        outputKeys: []
    };

    await conductor.post('/metadata/taskdefs', [taskDef]);
}

async function ensureWorkflowDefinition(workflowDef) {
    try {
        await conductor.post('/metadata/workflow', workflowDef);
    } catch (error) {
        if (error.response?.status === 409) {
            await conductor.put('/metadata/workflow', workflowDef);
        } else {
            throw error;
        }
    }
}

function buildWorkflowDefinition(workflowDefName, nodes) {
    const nodeIdToTaskRef = new Map();
    nodes.forEach((node, index) => {
        nodeIdToTaskRef.set(node.id, `node_${index + 1}`);
    });

    const tasks = nodes.map(node => ({
        name: node.type,
        taskReferenceName: nodeIdToTaskRef.get(node.id),
        type: 'SIMPLE',
        inputParameters: {
            nodeId: node.id,
            nodeType: node.type,
            config: mapConfigReferences(node.config || {}, nodeIdToTaskRef),
            execution: node.execution || {}
        }
    }));

    return {
        name: workflowDefName,
        description: 'Flow Builder dynamic workflow',
        version: 1,
        tasks,
        outputParameters: {},
        schemaVersion: 2,
        ownerEmail: 'noreply@flowbuilder.local'
    };
}

async function startWorkflow(workflowDefName, input) {
    const response = await conductor.post(`/workflow/${workflowDefName}`, input, {
        params: { version: 1 }
    });
    return response.data;
}

async function pollTask(taskType) {
    const response = await conductor.get(`/tasks/poll/${taskType}`, {
        params: { workerid: WORKER_ID }
    });

    if (!response.data || !response.data.taskId) {
        return null;
    }

    return response.data;
}

async function updateTaskStatus(task, status, outputData, reason) {
    await conductor.post('/tasks', {
        taskId: task.taskId,
        workflowInstanceId: task.workflowInstanceId,
        status,
        outputData,
        reasonForIncompletion: reason,
        workerId: WORKER_ID
    });
}

async function callExternalService(nodeType, config, previousResults) {
    if (!CONTENT_SERVICE_URL) {
        throw new Error(`Node type "${nodeType}" requires external content service. Set CONTENT_SERVICE_URL environment variable.`);
    }

    const endpoint = MOCK_ENDPOINTS[nodeType];
    if (!endpoint) {
        throw new Error(`No handler or external endpoint for node type: ${nodeType}`);
    }

    const response = await axios.post(`${CONTENT_SERVICE_URL}${endpoint}`, {
        config,
        previousResults
    });

    return response.data;
}

async function executeTask(task) {
    const taskType = task.taskType || task.taskDefName;
    const handler = nodeProcessors[taskType];
    const config = normalizePromptConfig(task.inputData?.config || {});
    const execution = normalizeExecution(task.inputData?.execution);
    const aggregateItems = execution.waitForAll && execution.aggregateItems;

    try {
        const arrayFields = getArrayFields(config);
        const runOne = async (itemConfig) => {
            if (handler) {
                return handler(itemConfig, []);
            }
            return callExternalService(taskType, itemConfig, []);
        };

        if (arrayFields.length > 0) {
            const { itemConfigs, itemsCount, baseConfig } = buildItemConfigs(config, arrayFields);

            if (aggregateItems) {
                const aggregateConfig = { ...baseConfig, items: itemConfigs };
                const result = await runOne(aggregateConfig);
                const output = result && result.output ? result.output : {};
                await updateTaskStatus(task, 'COMPLETED', {
                    ...output,
                    itemsCount,
                    nodeType: result?.type || taskType
                }, null);
                return;
            }

            const results = await runItemHandlers(runOne, itemConfigs, execution.mode);
            const combinedOutput = combineOutputs(results, false);

            await updateTaskStatus(task, 'COMPLETED', {
                ...combinedOutput,
                itemsCount,
                nodeType: taskType
            }, null);
            return;
        }

        const result = await runOne(config);
        const output = result && result.output ? result.output : {};
        await updateTaskStatus(task, 'COMPLETED', { ...output, nodeType: result?.type || taskType }, null);
    } catch (error) {
        await updateTaskStatus(task, 'FAILED', {}, error.message);
    }
}

function startWorkerPoller(taskType) {
    const loop = async () => {
        while (true) {
            try {
                const task = await pollTask(taskType);
                if (!task) {
                    await delay(POLL_INTERVAL_MS);
                    continue;
                }
                await executeTask(task);
            } catch (error) {
                console.error(`[Worker] Polling error for ${taskType}:`, error.message);
                await delay(POLL_INTERVAL_MS);
            }
        }
    };

    loop();
}

function maybeSaveHistory(workflow) {
    const workflowId = workflow.workflowId;
    if (!workflowId) return;
    if (savedHistoryIds.has(workflowId)) return;

    const status = mapWorkflowStatus(workflow.status);
    if (status !== 'completed' && status !== 'failed') return;

    const startTime = workflow.startTime ? new Date(workflow.startTime).toISOString() : new Date().toISOString();
    const endTime = workflow.endTime ? new Date(workflow.endTime).toISOString() : new Date().toISOString();
    const durationMs = workflow.endTime && workflow.startTime ? workflow.endTime - workflow.startTime : 0;

    const results = (workflow.tasks || []).map(task => ({
        nodeId: task.inputData?.nodeId || task.taskReferenceName,
        nodeType: task.inputData?.nodeType || task.taskType,
        success: task.status === 'COMPLETED',
        data: task.status === 'COMPLETED' ? { type: task.taskType, output: task.outputData } : undefined,
        error: task.status === 'FAILED' ? task.reasonForIncompletion || task.failureReason : undefined
    }));

    saveExecutionHistory({
        workflowId,
        workflowName: workflow.input?.workflowName || 'Untitled Workflow',
        status,
        startTime,
        endTime,
        durationMs,
        nodeCount: workflow.tasks?.length || 0,
        results
    });
}

// API Endpoints

app.post('/workflow/run', async (req, res) => {
    try {
        const { nodes, workflowName } = req.body;

        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            return res.status(400).json({ error: 'Nodes array is required' });
        }

        const uniqueTaskTypes = [...new Set(nodes.map(node => node.type))];
        for (const taskType of uniqueTaskTypes) {
            await ensureTaskDefinition(taskType);
        }

        const workflowDefName = `flow_builder_${uuidv4().replace(/-/g, '')}`;
        const workflowDef = buildWorkflowDefinition(workflowDefName, nodes);
        await ensureWorkflowDefinition(workflowDef);

        const workflowId = await startWorkflow(workflowDefName, {
            workflowName: workflowName || 'Untitled Workflow'
        });

        res.json({
            success: true,
            workflowId,
            message: 'Workflow queued for execution'
        });
    } catch (error) {
        console.error('[API] Error queueing workflow:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/workflow/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await conductor.get(`/workflow/${id}`);
        const workflow = response.data;

        const tasks = workflow.tasks || [];
        const nodeStatuses = tasks.map(task => ({
            id: task.inputData?.nodeId || task.taskReferenceName,
            status: mapTaskStatus(task.status)
        }));

        const runningTask = tasks.find(task => mapTaskStatus(task.status) === 'running');
        const results = tasks
            .filter(task => task.status === 'COMPLETED' || task.status === 'FAILED')
            .map(task => ({
                nodeId: task.inputData?.nodeId || task.taskReferenceName,
                nodeType: task.inputData?.nodeType || task.taskType,
                success: task.status === 'COMPLETED',
                data: task.status === 'COMPLETED' ? { type: task.taskType, output: task.outputData } : undefined,
                error: task.status === 'FAILED' ? task.reasonForIncompletion || task.failureReason : undefined
            }));

        maybeSaveHistory(workflow);

        res.json({
            status: mapWorkflowStatus(workflow.status),
            currentNodeId: runningTask?.inputData?.nodeId || null,
            nodeStatuses,
            results,
            error: workflow.reasonForIncompletion || workflow.failureReason || null
        });
    } catch (error) {
        res.status(404).json({ error: 'Workflow execution not found' });
    }
});

app.get('/workflow/history', (req, res) => {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json([]);
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to read history' });
    }
});

app.get('/workflow/:id/results', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await conductor.get(`/workflow/${id}`);
        const workflow = response.data;

        const results = (workflow.tasks || []).map(task => ({
            nodeId: task.inputData?.nodeId || task.taskReferenceName,
            nodeType: task.inputData?.nodeType || task.taskType,
            success: task.status === 'COMPLETED',
            data: task.status === 'COMPLETED' ? { type: task.taskType, output: task.outputData } : undefined,
            error: task.status === 'FAILED' ? task.reasonForIncompletion || task.failureReason : undefined
        }));

        res.json({
            status: mapWorkflowStatus(workflow.status),
            results
        });
    } catch (error) {
        res.status(404).json({ error: 'Workflow not found' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'workflow-backend', conductorUrl: CONDUCTOR_URL });
});

app.listen(PORT, () => {
    console.log(`🚀 Workflow Backend running on http://localhost:${PORT}`);
    console.log(`🧭 Conductor API at ${CONDUCTOR_URL}`);
    if (CONTENT_SERVICE_URL) {
        console.log(`🔗 External content service at ${CONTENT_SERVICE_URL}`);
    }

    const workerTaskTypes = [...new Set([
        ...Object.keys(nodeProcessors),
        ...Object.keys(MOCK_ENDPOINTS)
    ])];

    workerTaskTypes.forEach(taskType => startWorkerPoller(taskType));
});
