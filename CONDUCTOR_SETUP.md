# Conductor Integration Setup Guide

## Overview

The Flow Builder backend has been migrated from BullMQ/Redis to Netflix Conductor for workflow orchestration. This provides:

- Better task management and retry logic
- Workflow versioning and rollback
- Built-in monitoring and debugging
- Scalable worker architecture
- RESTful API for task/workflow management

## Architecture

```
Frontend (React)
    ↓ HTTP
Backend (Node.js Express) :5111
    ↓ REST API
Conductor Server :8080
    ↓ Task Polling
Workers (Node.js)
```

## Quick Start

### 1. Start Conductor Stack

For testing, use the mock Conductor server:

```bash
docker compose -f docker-compose.conductor.yml up -d
```

This starts a lightweight mock Conductor API at `http://localhost:8080`.

**For production**, replace with the full Netflix Conductor stack (see Production Setup below).

### 2. Start Backend with PM2

```bash
cd backend
npm install
PORT=5111 CONDUCTOR_URL=http://localhost:8080/api pm2 start server.js --name flow-backend
pm2 save
```

Verify it's running:
```bash
pm2 status
curl http://localhost:5111/health
```

### 3. Run Frontend (Development)

```bash
VITE_BACKEND_URL=http://localhost:5111 npm run dev
```

The frontend will be available at `http://localhost:3465`.

## How It Works

### Workflow Execution Flow

1. **Frontend** sends workflow nodes to `POST /workflow/run`
2. **Backend** registers task definitions for each unique node type
3. **Backend** creates a workflow definition with sequential tasks
4. **Backend** starts the workflow via Conductor API
5. **Worker threads** poll Conductor for available tasks
6. **Workers** execute tasks using node processors
7. **Workers** report completion/failure back to Conductor
8. **Frontend** polls `GET /workflow/:id/status` for updates
9. **Backend** saves execution history when workflow completes

### Node Configuration References

Nodes can reference outputs from previous nodes:

```json
{
  "id": "node-2",
  "type": "image_to_video",
  "config": {
    "imageUrl": {
      "_type": "reference",
      "nodeId": "node-1",
      "outputKey": "imageUrl"
    }
  }
}
```

These are transformed into Conductor parameter expressions: `${node_1.output.imageUrl}`

### Status Mapping

Conductor statuses are mapped to UI-friendly statuses:

| Conductor Status | UI Status   |
|-----------------|-------------|
| IN_PROGRESS     | running     |
| RUNNING         | running     |
| COMPLETED       | completed   |
| FAILED          | error/failed|
| SCHEDULED       | pending     |

## API Endpoints

### Workflow Management

- `POST /workflow/run` - Submit workflow for execution
  ```json
  {
    "workflowName": "My Workflow",
    "nodes": [...]
  }
  ```

- `GET /workflow/:id/status` - Get workflow execution status
  ```json
  {
    "status": "running",
    "currentNodeId": "node-2",
    "nodeStatuses": [...],
    "results": [...]
  }
  ```

- `GET /workflow/:id/results` - Get workflow results
- `GET /workflow/history` - Get execution history (last 50 runs)

### Health Check

- `GET /health` - Backend and Conductor connectivity status

## Configuration

### Environment Variables

**Backend** (backend/.env):
```bash
PORT=5111
CONDUCTOR_URL=http://localhost:8080/api
WORKER_ID=worker-1
POLL_INTERVAL_MS=1000
OPENAI_API_KEY=your-key
FAL_KEY=your-key
```

**Frontend** (.env):
```bash
VITE_BACKEND_URL=http://localhost:5111
```

## Production Setup

For production, use the full Conductor stack:

1. **Install Netflix Conductor**

```bash
git clone https://github.com/Netflix/conductor.git
cd conductor/docker
docker-compose up -d
```

This provides:
- Conductor Server (port 8080)
- Conductor UI (port 5000)
- Elasticsearch (port 9200)
- Redis (port 6379)

2. **Update docker-compose.conductor.yml**

Replace the mock conductor with the full stack or point `CONDUCTOR_URL` to your Conductor instance.

3. **Scale Workers**

You can run multiple backend instances with different `WORKER_ID` values:

```bash
PORT=5111 WORKER_ID=worker-1 pm2 start server.js --name flow-backend-1
PORT=5112 WORKER_ID=worker-2 pm2 start server.js --name flow-backend-2
```

## Monitoring

### PM2 Monitoring

```bash
pm2 status              # Process status
pm2 logs flow-backend   # View logs
pm2 monit               # Real-time monitoring
```

### Conductor UI

Access the Conductor UI at `http://localhost:5000` (if using full Conductor stack) to:
- View workflow executions
- Debug task failures
- Monitor worker health
- Replay failed workflows

### Check Workflow Status

```bash
# Check specific workflow
curl http://localhost:5111/workflow/{workflowId}/status | jq .

# View execution history
curl http://localhost:5111/workflow/history | jq .
```

## Troubleshooting

### Backend not connecting to Conductor

```bash
# Check Conductor health
curl http://localhost:8080/health

# Check backend logs
pm2 logs flow-backend
```

### Workers not picking up tasks

Check that worker threads are running:
```bash
pm2 logs flow-backend --lines 50 | grep "Worker"
```

Should see polling activity for each task type.

### Workflow stuck in running state

Check Conductor API directly:
```bash
curl http://localhost:8080/api/workflow/{workflowId}
```

### Task failures

View task failure reasons in the workflow status:
```bash
curl http://localhost:5111/workflow/{workflowId}/status | jq '.results[] | select(.success == false)'
```

## Testing

### Run Test Workflow

```bash
cd /home/usr1/code2/flb
curl -X POST http://localhost:5111/workflow/run \
  -H "Content-Type: application/json" \
  -d @test-workflow.json
```

### Monitor Execution

```bash
# Get workflow ID from previous response, then:
curl http://localhost:5111/workflow/{workflowId}/status | jq .
```

## Migration Notes

### Removed Dependencies

- `bullmq` - Replaced by Conductor
- `ioredis` - No longer needed (Conductor uses its own Redis)

### Added Components

- Mock Conductor server (`backend/mock-conductor.js`) for testing
- Task/workflow definition management
- Worker polling system
- Status mapping layer

### Code Changes

- **backend/server.js**: New Conductor integration, worker polling, task execution
- **src/hooks/useWorkflow.ts**: Updated to poll backend status endpoint
- **src/components/ExecutionHistory.tsx**: Reads from backend history endpoint

## Future Enhancements

- [ ] Add health check that pings Conductor on startup
- [ ] Create script to pre-register task definitions
- [ ] Add workflow retry logic
- [ ] Implement workflow cancellation
- [ ] Add task-level timeouts
- [ ] Create custom Conductor UI dashboard
- [ ] Add metrics and analytics

## Support

For issues:
- Check PM2 logs: `pm2 logs flow-backend`
- Check Conductor health: `curl http://localhost:8080/health`
- Review workflow history: `curl http://localhost:5111/workflow/history`
