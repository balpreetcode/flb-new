#!/bin/bash

echo "========================================="
echo "  Flow Builder - System Status Check"
echo "========================================="
echo ""

# Check Docker Conductor
echo "🎭 Mock Conductor Server:"
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "   ✅ Running at http://localhost:8080"
    curl -s http://localhost:8080/health | jq -r '   Status: \(.status)'
else
    echo "   ❌ Not responding at http://localhost:8080"
fi
echo ""

# Check Backend
echo "🚀 Backend Server:"
if curl -s http://localhost:5111/health > /dev/null 2>&1; then
    echo "   ✅ Running at http://localhost:5111"
    curl -s http://localhost:5111/health | jq -r '   Service: \(.service) | Conductor: \(.conductorUrl)'
else
    echo "   ❌ Not responding at http://localhost:5111"
fi
echo ""

# Check PM2
echo "📊 PM2 Process Manager:"
if command -v pm2 > /dev/null 2>&1; then
    pm2 list | grep -q "flow-backend"
    if [ $? -eq 0 ]; then
        echo "   ✅ flow-backend process running"
        pm2 jlist | jq -r '.[] | select(.name=="flow-backend") | "   PID: \(.pid) | CPU: \(.monit.cpu)% | Mem: \(.monit.memory / 1024 / 1024 | floor)MB | Status: \(.pm2_env.status)"'
    else
        echo "   ❌ flow-backend process not found"
    fi
else
    echo "   ❌ PM2 not installed"
fi
echo ""

# Check Workflow History
echo "📜 Workflow History:"
HISTORY_COUNT=$(curl -s http://localhost:5111/workflow/history 2>/dev/null | jq 'length' 2>/dev/null)
if [ ! -z "$HISTORY_COUNT" ]; then
    echo "   ✅ $HISTORY_COUNT workflow(s) in history"
    curl -s http://localhost:5111/workflow/history | jq -r '.[:3] | .[] | "   - \(.workflowName) (\(.status)) - \(.nodeCount) nodes - \((.durationMs / 1000) | floor)s"'
else
    echo "   ⚠️  Unable to retrieve history"
fi
echo ""

# Check Docker Containers
echo "🐳 Docker Containers:"
if command -v docker > /dev/null 2>&1; then
    CONDUCTOR_CONTAINER=$(sudo docker ps --filter "name=conductor" --format "{{.Names}}" | head -1)
    if [ ! -z "$CONDUCTOR_CONTAINER" ]; then
        echo "   ✅ $CONDUCTOR_CONTAINER ($(sudo docker ps --filter "name=$CONDUCTOR_CONTAINER" --format '{{.Status}}'))"
    else
        echo "   ❌ No Conductor container running"
    fi
else
    echo "   ⚠️  Docker not available"
fi
echo ""

echo "========================================="
echo "  System Check Complete"
echo "========================================="
echo ""
echo "Quick Commands:"
echo "  Start services:  docker compose -f docker-compose.conductor.yml up -d"
echo "  Start backend:   PORT=5111 pm2 start backend/server.js --name flow-backend"
echo "  View logs:       pm2 logs flow-backend"
echo "  Stop services:   pm2 stop flow-backend && docker compose -f docker-compose.conductor.yml down"
echo ""
