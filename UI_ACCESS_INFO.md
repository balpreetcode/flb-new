# Conductor UI Access Issue

## The Problem

Browser shows "Access to localhost was denied" when trying to access http://localhost:5000

## Why This Happens

The Conductor UI at port 5000 **IS running** and serving files (verified with curl), but the browser is blocking access. This typically happens when:

1. **You're accessing from a different machine** - localhost only works on the same machine
2. **Browser security** - Some browsers block localhost in certain configurations
3. **Network isolation** - Docker network might not be properly exposed

## Verification

```bash
# This works (returns HTML):
curl http://localhost:5000

# UI files exist:
$ docker exec conductor-server ls /usr/share/nginx/html/
index.html  static/  ...

# Port is listening:
$ netstat -tlnp | grep 5000
tcp  0.0.0.0:5000  LISTEN  nginx
```

## Solutions

### Option 1: Use SSH Port Forwarding (if remote)

If you're connecting to a remote server:

```bash
ssh -L 5000:localhost:5000 -L 8080:localhost:8080 user@your-server

# Then access in browser:
http://localhost:5000
```

### Option 2: Use Server IP Instead of Localhost

Find your server's IP:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Then access:
```
http://YOUR_SERVER_IP:5000
```

### Option 3: Use API Directly (No UI needed)

You can monitor and manage workflows via the REST API:

**List all workflows:**
```bash
curl http://localhost:8080/api/workflow
```

**Get workflow status:**
```bash
curl http://localhost:8080/api/workflow/{workflowId}
```

**View workflow executions:**
```bash
curl "http://localhost:8080/api/workflow/search?query=*"
```

**List task definitions:**
```bash
curl http://localhost:8080/api/metadata/taskdefs
```

### Option 4: Use Backend API (Recommended)

Our backend already provides clean endpoints:

**View execution history:**
```bash
curl http://localhost:5111/workflow/history | jq .
```

**Get workflow status:**
```bash
curl http://localhost:5111/workflow/{workflowId}/status | jq .
```

**Get workflow results:**
```bash
curl http://localhost:5111/workflow/{workflowId}/results | jq .
```

## Alternative: CLI Monitoring Script

Create a simple monitoring script:

```bash
#!/bin/bash
# watch-workflows.sh

while true; do
  clear
  echo "=== Active Workflows ==="
  curl -s http://localhost:8080/api/workflow | jq -r '.[] | "\(.workflowId) - \(.status)"'

  echo -e "\n=== Recent History ==="
  curl -s http://localhost:5111/workflow/history | jq -r '.[:5] | .[] | "\(.workflowName) - \(.status) - \(.durationMs/1000)s"'

  sleep 5
done
```

```bash
chmod +x watch-workflows.sh
./watch-workflows.sh
```

## Bottom Line

**The UI is working** - the issue is browser/network access, not the Conductor itself.

**You don't need the UI** - everything can be done via:
- Backend API (http://localhost:5111)
- Conductor API (http://localhost:8080/api)
- Command line tools

The workflow orchestration is **fully functional** without the UI.
