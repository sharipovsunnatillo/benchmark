# Load Testing Guide

Load tests gradually increase concurrent users over time to identify performance limits and breaking points. Tests ramp from 50 to 10,000 users over ~50 minutes.

## Table of Contents

- [Overview](#overview)
- [Test Configuration](#test-configuration)
- [Single Server Tests](#single-server-tests)
- [Parallel Tests (Both Servers)](#parallel-tests-both-servers)
- [Reading Results](#reading-results)
- [Best Practices](#best-practices)

## Overview

### What Load Tests Do

Load tests simulate real user behavior by:
- Creating new users (POST /api/users)
- Fetching paginated user lists (GET /api/users)
- Gradually increasing concurrent users
- Measuring performance under sustained load

### Test Stages

The load test progresses through these stages:

| Stage | Duration | Target Users | Purpose |
|-------|----------|--------------|---------|
| Warm-up | 30s | 50 | Initial warmup |
| Stage 1 | 1 min → 1 min | 100 | Ramp & hold |
| Stage 2 | 1 min → 1 min | 200 | Ramp & hold |
| Stage 3 | 1 min → 2 min | 500 | Ramp & hold |
| Stage 4 | 1 min → 2 min | 1,000 | Ramp & hold |
| Stage 5 | 1 min → 2 min | 2,000 | Ramp & hold |
| Cool down | 30s | 0 | Ramp down |

**Total Duration:** ~14 minutes

### Success Criteria

- **P95 Latency:** < 500ms
- **Error Rate:** < 5%
- **Success Rate:** > 95%

## Test Configuration

### Scripts Used

- **k6-load-test.js** - Single server load testing
- **k6-parallel-test.js** - Both servers simultaneously

### Prerequisites

```bash
# 1. Install k6
brew install k6  # macOS
choco install k6  # Windows
# Linux: https://k6.io/docs/getting-started/installation/

# 2. Start all services
docker-compose up --build -d

# 3. Wait for services
sleep 30

# 4. Verify services are running
curl http://localhost:8083/api/users?page=0&size=1
curl http://localhost:8084/api/users?page=0&size=1

# 5. Open Grafana for real-time monitoring
open http://localhost:3000

# 6. ⚠️ CRITICAL: Update Grafana dashboard with container IDs!
# See README.md "CRITICAL: Update Grafana Dashboard" section
# cAdvisor requires exact Docker container IDs, not names
docker ps --format "{{.ID}} {{.Names}}"
# Then update dashboard JSON with these IDs
```

## Single Server Tests

Test one server at a time for isolated performance measurement.

### Option 1: Test Virtual Threads Only

```bash
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js
```

**What it does:**
- Targets Virtual Threads application (port 8083)
- Gradually ramps: 50 → 100 → 200 → 500 → 1000 → 2000 users
- Tests both create and read operations
- Runs for approximately 15 minutes

**When to use:**
- Measuring Virtual Threads performance in isolation
- Comparing against previous Virtual Threads results
- System resources are limited (testing one at a time)

**Expected output:**
```
     ✓ create status is 201
     ✓ create has user id
     ✓ get status is 200
     ✓ get has content

     checks.........................: 99.85% ✓ 245234  ✗ 368
     http_req_duration..............: avg=123ms  p(95)=321ms p(99)=876ms
     http_req_failed................: 0.15%
     http_reqs......................: 245602 162/s
     iterations.....................: 122801 81/s
```

### Option 2: Test WebFlux Only

```bash
k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js
```

**What it does:**
- Targets WebFlux application (port 8084)
- Same test stages as Virtual Threads
- Allows direct comparison of results

**When to use:**
- Measuring WebFlux performance in isolation
- Comparing against previous WebFlux results
- After testing Virtual Threads (with cooldown period)

### Option 3: Test Both Sequentially (with Cooldown)

Test both applications one after another with a cooldown period between tests.

```bash
# Test Virtual Threads first
echo "Testing Virtual Threads..."
k6 run --env BASE_URL=http://localhost:8083 \
  --out json=vt-load-$(date +%Y%m%d_%H%M%S).json \
  k6-load-test.js | tee vt-load-$(date +%Y%m%d_%H%M%S).txt

# Cooldown period (3-5 minutes recommended)
echo "Waiting for cooldown (3 minutes)..."
for i in {180..1}; do
  printf "\rCooldown: %03d seconds remaining..." $i
  sleep 1
done
echo ""

# Test WebFlux
echo "Testing WebFlux..."
k6 run --env BASE_URL=http://localhost:8084 \
  --out json=wf-load-$(date +%Y%m%d_%H%M%S).json \
  k6-load-test.js | tee wf-load-$(date +%Y%m%d_%H%M%S).txt

echo "Both tests completed!"
```

**What it does:**
- Tests Virtual Threads completely
- Waits for system cooldown (database, memory, CPU)
- Tests WebFlux with clean baseline
- Saves separate result files for each

**When to use:**
- You want clean, isolated measurements
- System resources are limited
- You need reproducible results
- Running on laptop or shared machine

**Advantages:**
- Clean baseline for each test
- No resource contention between apps
- More accurate performance limits
- Easier to identify bottlenecks

**Disadvantages:**
- Takes 2x the time (~100 minutes total)
- Can't compare in real-time via Grafana
- Different test conditions (DB size, system state)

### Saving Results

Save test output to files for later analysis:

```bash
# Basic output to text file
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js \
  | tee results-vt-$(date +%Y%m%d_%H%M%S).txt

# JSON output for detailed analysis
k6 run --env BASE_URL=http://localhost:8083 \
  --out json=results-vt-$(date +%Y%m%d_%H%M%S).json \
  k6-load-test.js

# Both text and JSON
k6 run --env BASE_URL=http://localhost:8083 \
  --out json=results-vt-$(date +%Y%m%d_%H%M%S).json \
  k6-load-test.js | tee results-vt-$(date +%Y%m%d_%H%M%S).txt
```

## Parallel Tests (Both Servers)

Test both servers simultaneously for real-time side-by-side comparison.

### Option 4: Test Both Applications in Parallel

```bash
k6 run k6-parallel-test.js
```

**What it does:**
- Tests BOTH Virtual Threads (8083) AND WebFlux (8084) simultaneously
- Each virtual user sends requests to both servers
- Same load stages for both applications
- Separate metrics: `vt_*` for Virtual Threads, `wf_*` for WebFlux
- Runs for approximately 15 minutes

**When to use:**
- Real-time side-by-side comparison in Grafana
- You have sufficient system resources (8+ cores, 16GB+ RAM)
- You want to see how both perform under identical conditions
- Direct head-to-head performance analysis

**Advantages:**
- Real-time comparison in Grafana dashboard
- Identical test conditions (same time, same DB state)
- Single test run for both applications
- Easy to spot performance differences

**Disadvantages:**
- Doubles the system load
- May hit system resource limits sooner
- Both apps compete for CPU/memory/database
- Harder to identify individual app limits

**System requirements:**
- 8+ CPU cores recommended
- 16GB+ RAM recommended
- SSD for database performance
- Sufficient database connections

### Parallel Test with Results

```bash
# Run with output files
k6 run --out json=parallel-load-$(date +%Y%m%d_%H%M%S).json \
  k6-parallel-test.js | tee parallel-load-$(date +%Y%m%d_%H%M%S).txt
```

### Parallel Test Metrics

The parallel test provides separate metrics for each application:

**Virtual Threads Metrics:**
- `vt_create_user_errors` - Failed user creation count
- `vt_get_users_errors` - Failed user fetch count
- `vt_create_user_success` - User creation success rate
- `vt_get_users_success` - User fetch success rate
- `vt_create_user_duration` - User creation response time
- `vt_get_users_duration` - User fetch response time

**WebFlux Metrics:**
- `wf_create_user_errors` - Failed user creation count
- `wf_get_users_errors` - Failed user fetch count
- `wf_create_user_success` - User creation success rate
- `wf_get_users_success` - User fetch success rate
- `wf_create_user_duration` - User creation response time
- `wf_get_users_duration` - User fetch response time

**Example output:**
```
     ✓ VT create status is 201
     ✓ VT create has user id
     ✓ VT get status is 200
     ✓ VT get has content
     ✓ WF create status is 201
     ✓ WF create has user id
     ✓ WF get status is 200
     ✓ WF get has content

     vt_create_user_success.......: 99.8%
     vt_get_users_success.........: 99.9%
     wf_create_user_success.......: 99.7%
     wf_get_users_success.........: 99.9%

     http_req_duration............: avg=145ms p(95)=398ms
     http_reqs....................: 490234 (245117 per server)
```

## Reading Results

### Console Summary

k6 provides a detailed summary at the end:

```
     checks.........................: 99.85% ✓ 245234  ✗ 368
     data_received..................: 123 MB  42 kB/s
     data_sent......................: 98 MB   33 kB/s
     http_req_duration..............: avg=123ms  med=98ms   p(95)=321ms p(99)=876ms
     http_req_failed................: 0.15%  ✓ 368    ✗ 244866
     http_reqs......................: 245234  81/s
     iteration_duration.............: avg=3.2s   med=3.0s   p(95)=4.8s
     iterations.....................: 122617  40/s
```

### Key Metrics

**http_req_duration** - Request response time
- `avg`: Average response time across all requests
- `med`: Median (p50) - 50% of requests faster than this
- `p(95)`: 95th percentile - only 5% were slower
- `p(99)`: 99th percentile - only 1% were slower

**http_req_failed** - Error rate
- Percentage of failed requests (4xx, 5xx status codes)
- Should be < 5% for healthy system
- Watch for spikes at high load levels

**http_reqs** - Throughput
- Total requests and requests per second
- Higher is better (if latency acceptable)
- Compare between Virtual Threads and WebFlux

**checks** - Assertion pass rate
- Percentage of validation checks that passed
- Should be > 95%
- Drops indicate server errors or timeouts

### Performance Analysis

**When performance is good:**
```
✓ All stages complete successfully
✓ P95 latency stays below 500ms
✓ Error rate < 1%
✓ RPS increases linearly with user count
```

**When approaching limits:**
```
⚠ P95 latency starts increasing (500ms → 1000ms)
⚠ Error rate increases (1% → 5%)
⚠ RPS plateaus despite more users
⚠ CPU hits 100%
```

**When system is overloaded:**
```
✗ P95 latency > 5 seconds
✗ Error rate > 10%
✗ Many timeouts
✗ RPS declining
✗ Checks failing
```

### Comparing Results

**Virtual Threads vs WebFlux:**

| Metric | Virtual Threads | WebFlux | Winner |
|--------|----------------|---------|--------|
| Max RPS (P95 < 500ms) | 1,250/s | 1,180/s | VT |
| P95 Latency @ 1000 RPS | 245ms | 268ms | VT |
| P99 Latency @ 1000 RPS | 512ms | 623ms | VT |
| Error rate @ max load | 0.8% | 1.2% | VT |
| Max concurrent users | 8,500 | 7,200 | VT |

*(Example numbers - your results will vary)*

## Best Practices

### Before Testing

1. **Clean system state:**
   ```bash
   # Restart services for clean baseline
   docker-compose restart virtual-threads-app webflux-app
   sleep 30  # Wait for warmup
   ```

2. **Verify health:**
   ```bash
   curl http://localhost:8083/actuator/health
   curl http://localhost:8084/actuator/health
   ```

3. **Check resources:**
   ```bash
   docker stats --no-stream
   ```

4. **Open Grafana (recommended):**
   - URL: http://localhost:3000
   - Dashboard: "Virtual Threads vs WebFlux Benchmark"
   - Enable auto-refresh (5s)

### During Testing

1. **Don't interrupt** - Let tests complete naturally
2. **Monitor Grafana** - Watch real-time metrics
3. **Document observations** - Note when issues occur
4. **Check Docker stats** - `docker stats virtual-threads-app webflux-app`
5. **Watch for errors** - Note when error rates increase

### After Testing

1. **Cool down between tests** - Wait 3-5 minutes
2. **Save all results** - Keep JSON and text files
3. **Review Grafana timeline** - Check full test duration
4. **Take screenshots** - Document key moments
5. **Document findings** - Which performed better and why

### Sequential vs Parallel Testing

**Use Sequential Testing When:**
- System resources are limited (< 8 cores, < 16GB RAM)
- You want clean, isolated measurements
- Finding absolute performance limits
- Running on laptop or shared machine
- Need reproducible baseline results

**Use Parallel Testing When:**
- Sufficient system resources available
- Want real-time side-by-side comparison
- Using Grafana for visual analysis
- Testing how apps compete for resources
- Quick comparison is more important than absolute limits

### Troubleshooting

**High error rates during test:**
- Reduce concurrent users in k6-load-test.js
- Increase database connection pool size
- Check application logs: `docker logs -f virtual-threads-app`

**System resources exhausted:**
- Use sequential testing instead of parallel
- Reduce max users (10,000 → 5,000)
- Increase resource limits in docker-compose.yml

**Inconsistent results between runs:**
- Always restart services between tests
- Use longer cooldown periods (5+ minutes)
- Close other applications
- Test multiple times and average results

**Tests timing out:**
- Increase timeout in k6 script (30s → 60s)
- Check network connectivity
- Verify Docker containers are healthy

## Next Steps

After completing load tests:

1. **Review Results** - Analyze performance at each load level
2. **Compare Applications** - Which performed better and why?
3. **Check Grafana** - Review dashboard at http://localhost:3000
4. **Run Throughput Tests** - See [THROUGHPUT_TESTING.md](THROUGHPUT_TESTING.md)
5. **Document Findings** - Save results and observations

## Summary

Load testing helps you understand:
- **Maximum sustainable load** - How many users can the system handle?
- **Performance degradation** - When does latency start increasing?
- **Resource limits** - CPU, memory, or database bottleneck?
- **Error thresholds** - At what point do errors become significant?
- **Comparison** - Which approach performs better and why?

Use **sequential testing** for accurate individual measurements or **parallel testing** for real-time comparison. Always monitor with Grafana for comprehensive insights.
