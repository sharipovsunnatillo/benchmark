# Quick Start Guide

Get up and running with the Virtual Threads vs WebFlux benchmark in 5 minutes.

## Prerequisites

Ensure you have installed:
- Docker Desktop
- Docker Compose
- K6 (for load testing)

```bash
# Install K6
# macOS:
brew install k6

# Linux:
# See https://k6.io/docs/getting-started/installation/

# Windows:
choco install k6
```

## Step 1: Start Everything

```bash
cd /path/to/benchmark
docker-compose up --build -d
```

This starts:
- PostgreSQL database (port 5433)
- Virtual Threads application (port 8083)
- WebFlux application (port 8084)
- Prometheus (port 9090)
- Grafana (port 3000)
- cAdvisor (port 8082)

## Step 2: Wait for Services to Start

```bash
# Check service health (wait until both return 200)
curl -s http://localhost:8083/actuator/health | jq .
curl -s http://localhost:8084/actuator/health | jq .

# Or check all services
docker-compose ps
```

Expected output: All services should be "Up" and healthy.

## Step 3: Open Grafana Dashboard

1. Navigate to: http://localhost:3000
2. Login:
   - Username: `admin`
   - Password: `admin`
3. Click "Dashboards" → "Virtual Threads vs WebFlux Benchmark"
4. Set auto-refresh to 5 seconds (top right)

## Step 4: Run Load Test

You have two options for load testing:

### Option A: Test Both Applications in Parallel (Recommended)

Open a new terminal and run:

```bash
# Test both Virtual Threads and WebFlux simultaneously
k6 run k6-parallel-test.js
```

**Watch the Grafana dashboard in real-time!**

You'll see both applications side-by-side:
- RPS increasing as K6 ramps up load
- Latency comparison between Virtual Threads and WebFlux
- CPU and memory usage comparison
- Thread count variations

### Option B: Test Applications Separately

Test one application at a time:

```bash
# Test Virtual Threads only
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js

# Wait 2-3 minutes for cooldown, then test WebFlux
k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js
```

## Quick Reference

### Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Virtual Threads API | http://localhost:8083/api/users | - |
| WebFlux API | http://localhost:8084/api/users | - |
| Grafana Dashboard | http://localhost:3000 | admin/admin |
| Prometheus | http://localhost:9090 | - |
| cAdvisor | http://localhost:8082 | - |
| Virtual Threads Metrics | http://localhost:8083/actuator/prometheus | - |
| WebFlux Metrics | http://localhost:8084/actuator/prometheus | - |

### Useful Commands

```bash
# View logs
docker-compose logs -f virtual-threads-app
docker-compose logs -f webflux-app

# Check resource usage
docker stats

# Stop everything
docker-compose down

# Stop and remove all data
docker-compose down -v

# Restart a service
docker-compose restart virtual-threads-app

# Rebuild after code changes
docker-compose up --build -d
```

### Test Endpoints Manually

```bash
# Create a user
curl -X POST http://localhost:8083/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }'

# Get users (paginated)
curl http://localhost:8083/api/users?page=0&size=20 | jq .
```

## Understanding the K6 Test

The `k6-load-test.js` script gradually increases load:

1. Warm-up: 50 users
2. Ramp up: 100 → 200 → 500 → 1000 → 2000 → 3000 → 5000 → 10000 users
3. Each level sustains for 2-5 minutes
4. Tests both POST (create user) and GET (pagination) endpoints

**Goal:** Find the breaking point where applications start to fail or degrade significantly.

## What to Watch in Grafana

### 🔴 Red Flags (Problems)
- Latency increasing rapidly
- CPU at 100% sustained
- Memory approaching limit (2GB)
- RPS plateauing or declining under increasing load
- Error rates above 0%

### 🟢 Green Flags (Good Performance)
- Flat latency under load
- RPS scaling linearly with load
- CPU below 80%
- Memory stable
- No errors

### 📊 Key Metrics

| Metric | What's Good | What's Bad |
|--------|-------------|------------|
| **P95 Latency** | <100ms | >500ms |
| **RPS** | Increasing with load | Plateauing or dropping |
| **CPU** | <80% | 100% |
| **Memory** | Stable, <1.5GB | Growing, >1.8GB |
| **Errors** | 0% | >1% |

## Common Issues

### "Connection refused" when accessing services
- Wait longer - containers may still be starting
- Check: `docker-compose ps`
- Check logs: `docker-compose logs`

### K6 shows high failure rate
- Ensure you're testing the right URL
- Check application is healthy
- Reduce K6 load (edit `k6-load-test.js`)

### Grafana shows "No Data"
- Wait 30 seconds for first metrics to appear
- Check Prometheus is scraping: http://localhost:9090/targets
- Verify metrics endpoints: http://localhost:8083/actuator/prometheus

### Dashboard not visible in Grafana
- Check: `/Dashboards` → Search for "benchmark"
- Restart Grafana: `docker-compose restart grafana`
- Check provisioning: `ls -la monitoring/grafana/provisioning/dashboards/`

## Next Steps

1. **Read MONITORING.md** - Detailed guide on interpreting metrics
2. **Read README.md** - Full documentation
3. **Customize load tests** - Edit `k6-load-test.js` for your needs
4. **Try different scenarios** - Test with different data sizes, patterns
5. **Export results** - Save Grafana dashboards and Prometheus data

## Quick Benchmark Workflow

```bash
# 1. Start stack
docker-compose up --build -d

# 2. Open Grafana
open http://localhost:3000

# 3. Run automated benchmark script
./run-benchmark.sh

# 4. Choose option 3 (test both sequentially)

# 5. Watch metrics in Grafana

# 6. Export results
# - Take screenshots of Grafana
# - Save K6 output files
# - Export dashboard JSON

# 7. Clean up
docker-compose down -v
```

## Help

- **Full Documentation**: See [README.md](README.md)
- **Monitoring Guide**: See [MONITORING.md](MONITORING.md)
- **Issues**: Check GitHub issues or create a new one

---

**Happy Benchmarking!** 🚀
