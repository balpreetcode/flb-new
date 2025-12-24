const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// In-memory storage
const taskDefinitions = new Map();
const workflowDefinitions = new Map();
const workflows = new Map();
const tasks = new Map();

// Health endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'UP', healthy: true });
});

// Task Definitions
app.get('/api/metadata/taskdefs/:name', (req, res) => {
    const taskDef = taskDefinitions.get(req.params.name);
    if (!taskDef) {
        return res.status(404).json({ error: 'Task definition not found' });
    }
    res.json(taskDef);
});

app.post('/api/metadata/taskdefs', (req, res) => {
    const defs = Array.isArray(req.body) ? req.body : [req.body];
    defs.forEach(def => {
        taskDefinitions.set(def.name, def);
    });
    res.status(204).send();
});

// Workflow Definitions
app.post('/api/metadata/workflow', (req, res) => {
    const def = req.body;
    workflowDefinitions.set(def.name, def);
    res.status(204).send();
});

app.put('/api/metadata/workflow', (req, res) => {
    const def = req.body;
    workflowDefinitions.set(def.name, def);
    res.status(204).send();
});

// Start Workflow
app.post('/api/workflow/:name', (req, res) => {
    const { name } = req.params;
    const workflowDef = workflowDefinitions.get(name);

    if (!workflowDef) {
        return res.status(404).json({ error: 'Workflow definition not found' });
    }

    const workflowId = uuidv4();
    const workflow = {
        workflowId,
        workflowType: name,
        version: 1,
        status: 'RUNNING',
        input: req.body,
        tasks: [],
        startTime: Date.now(),
        updateTime: Date.now()
    };

    // Create tasks
    workflowDef.tasks.forEach((taskDef, index) => {
        const task = {
            taskId: uuidv4(),
            taskType: taskDef.name,
            taskDefName: taskDef.name,
            referenceTaskName: taskDef.taskReferenceName,
            workflowInstanceId: workflowId,
            status: index === 0 ? 'SCHEDULED' : 'SCHEDULED',
            inputData: taskDef.inputParameters || {},
            outputData: {},
            startTime: null,
            endTime: null,
            updateTime: Date.now()
        };
        tasks.set(task.taskId, task);
        workflow.tasks.push(task);
    });

    workflows.set(workflowId, workflow);
    res.json(workflowId);
});

// Get Workflow Status
app.get('/api/workflow/:workflowId', (req, res) => {
    const workflow = workflows.get(req.params.workflowId);

    if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json(workflow);
});

// Poll for Task
app.get('/api/tasks/poll/:taskType', (req, res) => {
    const { taskType } = req.params;

    // Find first scheduled task of this type
    for (const task of tasks.values()) {
        if (task.taskDefName === taskType && task.status === 'SCHEDULED') {
            task.status = 'IN_PROGRESS';
            task.startTime = Date.now();
            task.updateTime = Date.now();
            return res.json(task);
        }
    }

    // No task available
    res.json({});
});

// Update Task
app.post('/api/tasks', (req, res) => {
    const update = req.body;
    const task = tasks.get(update.taskId);

    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    task.status = update.status;
    task.outputData = update.outputData || {};
    task.reasonForIncompletion = update.reasonForIncompletion;
    task.endTime = Date.now();
    task.updateTime = Date.now();

    // Update workflow
    const workflow = workflows.get(task.workflowInstanceId);
    if (workflow) {
        const taskIndex = workflow.tasks.findIndex(t => t.taskId === task.taskId);
        if (taskIndex !== -1) {
            workflow.tasks[taskIndex] = task;
        }

        // Check if there's a next task to schedule
        if (task.status === 'COMPLETED' && taskIndex < workflow.tasks.length - 1) {
            const nextTask = workflow.tasks[taskIndex + 1];
            if (nextTask.status === 'SCHEDULED' && !nextTask.startTime) {
                // Keep it scheduled so it can be polled
            }
        }

        // Check if workflow is complete
        const allCompleted = workflow.tasks.every(t => t.status === 'COMPLETED');
        const anyFailed = workflow.tasks.some(t => t.status === 'FAILED');

        if (allCompleted) {
            workflow.status = 'COMPLETED';
            workflow.endTime = Date.now();
        } else if (anyFailed) {
            workflow.status = 'FAILED';
            workflow.endTime = Date.now();
            workflow.reasonForIncompletion = task.reasonForIncompletion;
        }

        workflow.updateTime = Date.now();
    }

    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`🎭 Mock Conductor server running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API: http://localhost:${PORT}/api`);
});
