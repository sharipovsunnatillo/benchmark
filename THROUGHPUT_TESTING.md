# Throughput Testing Guide

Throughput tests measure maximum requests per second by sending a large burst of concurrent requests as quickly as possible. Tests send 40,000 requests per server using 2,000 concurrent users.

## Table of Contents

- [Overview](#overview)
- [Test Configuration](#test-configuration)
- [Single Server Tests](#single-server-tests)
- [Parallel Tests (Both Servers)](#parallel-tests-both-servers)
- [Reading Results](#reading-results)
- [Best Practices](#best-practices)

## Overview

### What Throughput Tests Do

Throughput tests measure:
- **Maximum requests per second** - Peak throughput capacity
- **Failure rates under burst load** - How many requests fail?
- **Response time distribution** - P50, P95, P99 percentiles
- **System stability** - Can it handle sudden load spikes?

### Key Differences from Load Tests

| Aspect | Load Tests | Throughput Tests |
|--------|-----------|------------------|
| Duration | ~50 minutes | ~2-5 minutes |
| Load Pattern | Gradual ramp-up | Immediate burst |
| Users | 50 → 10,000 | 2,000 constant |
| Requests | Unlimited | 40,000 per server |
| Purpose | Find limits | Measure max throughput |
| Operations | Create + Read | Create only |

### Test Configuration

- **Virtual Users:** 2,000
- **Total Requests:** 40,000 (per server)
- **Requests per User:** 20 iterations
- **Maximum Duration:** 5 minutes
- **Operation:** POST /api/users (write-heavy)

### Success Criteria

- **Success Rate:** > 90%
- **Error Rate:** < 10%
- **P50 Latency:** < 1 second
- **P95 Latency:** < 5 seconds
- **P99 Latency:** < 10 seconds

## Test Configuration

### Scripts Used

- **k6-throughput-test.js** - Single server throughput testing
- **k6-throughput-parallel.js** - Both servers simultaneously

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

Test one server at a time for isolated throughput measurement.

### Option 1: Test Virtual Threads Only

```bash
k6 run --quiet \
  --env BASE_URL=http://localhost:8083 \
  --env APP_NAME="Virtual Threads" \
  k6-throughput-test.js 2>&1 | grep -v '^{'
```

**What it does:**
- Sends 40,000 POST requests to Virtual Threads (port 8083)
- Uses 2,000 concurrent users
- Each user executes 20 iterations
- Maximum duration: 5 minutes
- Only tests user creation (write-heavy workload)

**When to use:**
- Measuring Virtual Threads maximum throughput
- Testing write performance under burst load
- Comparing against previous Virtual Threads results
- System resources are limited

**Expected output:**
```
==========================================================================
THROUGHPUT BURST TEST
==========================================================================
Target: http://localhost:8083
Application: Virtual Threads
Test config:
  - Total requests: 40,000
  - Virtual users: 2,000
  - Requests per VU: 20
  - Max duration: 5 minutes
==========================================================================

     ✓ status is 201
     ✓ has user id

     checks.........................: 99.2%  ✓ 39680  ✗ 320
     http_req_duration..............: avg=234ms  p(50)=187ms p(95)=612ms p(99)=1.2s
     http_req_failed................: 0.8%   ✓ 320    ✗ 39680
     http_reqs......................: 40000  3245/s
     iterations.....................: 40000  3245/s
     requests_success...............: 39680
     requests_failed................: 320
     success_rate...................: 99.2%

Duration: 12.32 seconds
```

### Option 2: Test WebFlux Only

```bash
k6 run --quiet \
  --env BASE_URL=http://localhost:8084 \
  --env APP_NAME="WebFlux" \
  k6-throughput-test.js 2>&1 | grep -v '^{'
```

**What it does:**
- Sends 40,000 POST requests to WebFlux (port 8084)
- Same burst configuration as Virtual Threads
- Allows direct throughput comparison

**When to use:**
- Measuring WebFlux maximum throughput
- Testing reactive write performance
- Comparing against Virtual Threads throughput
- After testing Virtual Threads (with cooldown)

### Option 3: Test Both Sequentially (with Cooldown)

Test both applications one after another with a cooldown period between tests.

```bash
#!/bin/bash

# Timestamp for file naming
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Test Virtual Threads
echo "==================================="
echo "Testing Virtual Threads Throughput"
echo "==================================="

k6 run --quiet \
  --env BASE_URL=http://localhost:8083 \
  --env APP_NAME="Virtual Threads" \
  --out json=throughput-vt-${TIMESTAMP}.json \
  k6-throughput-test.js 2>&1 | grep -v '^{' | tee throughput-vt-${TIMESTAMP}.txt

# Save HTML report if generated
if [ -f "throughput-report.html" ]; then
  mv throughput-report.html throughput-vt-report-${TIMESTAMP}.html
  echo "HTML report saved: throughput-vt-report-${TIMESTAMP}.html"
fi

# Cooldown period (3 minutes recommended)
echo ""
echo "==================================="
echo "Cooldown Period (3 minutes)"
echo "==================================="
for i in {180..1}; do
  printf "\rCooldown: %03d seconds remaining..." $i
  sleep 1
done
echo ""
echo ""

# Test WebFlux
echo "==================================="
echo "Testing WebFlux Throughput"
echo "==================================="

k6 run --quiet \
  --env BASE_URL=http://localhost:8084 \
  --env APP_NAME="WebFlux" \
  --out json=throughput-wf-${TIMESTAMP}.json \
  k6-throughput-test.js 2>&1 | grep -v '^{' | tee throughput-wf-${TIMESTAMP}.txt

# Save HTML report if generated
if [ -f "throughput-report.html" ]; then
  mv throughput-report.html throughput-wf-report-${TIMESTAMP}.html
  echo "HTML report saved: throughput-wf-report-${TIMESTAMP}.html"
fi

# Summary
echo ""
echo "==================================="
echo "Tests Complete!"
echo "==================================="
echo "Results saved:"
echo "  Virtual Threads:"
echo "    - throughput-vt-${TIMESTAMP}.txt"
echo "    - throughput-vt-${TIMESTAMP}.json"
echo "    - throughput-vt-report-${TIMESTAMP}.html"
echo ""
echo "  WebFlux:"
echo "    - throughput-wf-${TIMESTAMP}.txt"
echo "    - throughput-wf-${TIMESTAMP}.json"
echo "    - throughput-wf-report-${TIMESTAMP}.html"
echo ""

# Extract key metrics for comparison
echo "==================================="
echo "Quick Comparison"
echo "==================================="
echo ""
echo "Virtual Threads:"
grep -E "(http_req_duration|http_req_failed|http_reqs|success_rate)" \
  throughput-vt-${TIMESTAMP}.txt | head -10
echo ""
echo "WebFlux:"
grep -E "(http_req_duration|http_req_failed|http_reqs|success_rate)" \
  throughput-wf-${TIMESTAMP}.txt | head -10
```

**What it does:**
- Tests Virtual Threads with 40k requests
- Saves results with timestamp
- Waits for 3-minute cooldown
- Tests WebFlux with 40k requests
- Saves separate result files
- Provides quick comparison summary

**When to use:**
- You want clean, isolated measurements
- System resources are limited
- Need reproducible throughput results
- Running on laptop or shared machine

**Advantages:**
- Clean baseline for each test
- No resource contention
- Accurate max throughput measurement
- Easier to compare results

**Disadvantages:**
- Takes 2x the time (~10-15 minutes total)
- Can't compare in real-time via Grafana
- Different system conditions (DB size, cache state)

### Saving Results

Save test output with timestamps:

```bash
# Simple run with output file
k6 run --env BASE_URL=http://localhost:8083 \
  k6-throughput-test.js | tee results-$(date +%Y%m%d_%H%M%S).txt

# With JSON output for analysis
k6 run --env BASE_URL=http://localhost:8083 \
  --out json=results-$(date +%Y%m%d_%H%M%S).json \
  k6-throughput-test.js

# Both text and JSON with clean console output
k6 run --quiet \
  --env BASE_URL=http://localhost:8083 \
  --env APP_NAME="Virtual Threads" \
  --out json=results-$(date +%Y%m%d_%H%M%S).json \
  k6-throughput-test.js 2>&1 | grep -v '^{' | tee results-$(date +%Y%m%d_%H%M%S).txt
```

## Parallel Tests (Both Servers)

Test both servers simultaneously for direct head-to-head throughput comparison.

### Option 4: Test Both Applications in Parallel

```bash
k6 run --quiet k6-throughput-parallel.js 2>&1 | grep -v '^{'
```

**What it does:**
- Sends 40,000 requests to EACH server simultaneously (80,000 total)
- Uses 2,000 virtual users
- Each user sends requests to BOTH servers
- Runs for maximum 5 minutes
- Provides direct side-by-side comparison

**When to use:**
- Real-time throughput comparison
- You have sufficient system resources (8+ cores, 16GB+ RAM)
- Want to see how both handle identical burst load
- Direct head-to-head performance analysis

**Advantages:**
- Real-time comparison in Grafana dashboard
- Identical test conditions (same time, same system state)
- Single test run for both applications
- Easy to spot throughput differences
- Tests how apps compete for resources

**Disadvantages:**
- Doubles the system load (80k requests total)
- May hit system resource limits sooner
- Both apps compete for CPU/memory/database
- Lower absolute throughput per app

**System requirements:**
- 8+ CPU cores recommended
- 16GB+ RAM recommended
- SSD for database performance
- High database connection pool limits

### Parallel Test with Results

```bash
# Run with timestamp and output files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

k6 run --quiet \
  --out json=throughput-parallel-${TIMESTAMP}.json \
  k6-throughput-parallel.js 2>&1 | grep -v '^{' | tee throughput-parallel-${TIMESTAMP}.txt

echo ""
echo "Results saved:"
echo "  - throughput-parallel-${TIMESTAMP}.txt"
echo "  - throughput-parallel-${TIMESTAMP}.json"
echo "  - throughput-parallel-report.html"
```

### Parallel Test Metrics

The parallel test provides separate metrics for each application:

**Virtual Threads Metrics:**
- `vt_requests_total` - Total requests sent to VT
- `vt_requests_success` - Successful VT requests
- `vt_requests_failed` - Failed VT requests
- `vt_success_rate` - VT success percentage
- `vt_response_time` - VT response time distribution

**WebFlux Metrics:**
- `wf_requests_total` - Total requests sent to WF
- `wf_requests_success` - Successful WF requests
- `wf_requests_failed` - Failed WF requests
- `wf_success_rate` - WF success percentage
- `wf_response_time` - WF response time distribution

**Example output:**
```
==========================================================================
PARALLEL THROUGHPUT BURST TEST
==========================================================================
Virtual Threads: http://localhost:8083
WebFlux: http://localhost:8084

Test config:
  - Total iterations: 40,000
  - Requests per iteration: 2 (one to each server)
  - Total requests: 80,000 (40k to each server)
  - Virtual users: 2,000
  - Max duration: 5 minutes
==========================================================================

     ✓ VT status is 201
     ✓ VT has user id
     ✓ WF status is 201
     ✓ WF has user id

     vt_requests_total.............: 40000
     vt_requests_success...........: 39234
     vt_requests_failed............: 766
     vt_success_rate...............: 98.08%
     vt_response_time..............: avg=287ms  p(50)=234ms p(95)=723ms p(99)=1.4s

     wf_requests_total.............: 40000
     wf_requests_success...........: 38912
     wf_requests_failed............: 1088
     wf_success_rate...............: 97.28%
     wf_response_time..............: avg=312ms  p(50)=256ms p(95)=801ms p(99)=1.6s

     http_req_duration.............: avg=299ms  p(95)=762ms p(99)=1.5s
     http_reqs.....................: 80000  2893/s (1446/s per server)
     iterations....................: 40000  1446/s

Duration: 27.65 seconds
```

### Comparing Parallel Results

When running parallel tests, compare these metrics:

| Metric | Virtual Threads | WebFlux | Winner |
|--------|----------------|---------|--------|
| Success Rate | 98.08% | 97.28% | VT |
| Failed Requests | 766 | 1,088 | VT |
| Avg Response Time | 287ms | 312ms | VT |
| P95 Response Time | 723ms | 801ms | VT |
| P99 Response Time | 1.4s | 1.6s | VT |
| RPS | 1,446/s | 1,446/s | Tie |

*(Example numbers - your results will vary)*

## Reading Results

### Console Summary

Throughput test summary shows burst performance:

```
     checks.........................: 99.2%  ✓ 79360  ✗ 640
     http_req_duration..............: avg=234ms  p(50)=187ms p(95)=612ms p(99)=1.2s
     http_req_failed................: 0.8%   ✓ 640    ✗ 79360
     http_reqs......................: 80000  3245/s
     iterations.....................: 40000  1622/s
     requests_success...............: 79360
     requests_failed................: 640
     response_time..................: avg=234ms
     success_rate...................: 99.2%
```

### Key Metrics

**http_reqs (RPS)** - Throughput
- Total requests and requests per second
- **Primary metric** for throughput tests
- Higher = better throughput capacity

**success_rate** - Reliability
- Percentage of successful requests
- Should be > 90%
- Indicates stability under burst load

**http_req_duration** - Performance
- Response time distribution
- P50 (median), P95, P99 percentiles
- Shows how fast the system responds under burst

**http_req_failed** - Error rate
- Percentage of failed requests
- Should be < 10%
- Indicates system stress level

### Performance Analysis

**Excellent throughput:**
```
✓ Success rate > 98%
✓ 3000+ requests/second per server
✓ P95 latency < 500ms
✓ < 2% errors
```

**Good throughput:**
```
✓ Success rate 90-98%
✓ 2000-3000 requests/second
✓ P95 latency < 1 second
✓ 2-5% errors
```

**Marginal throughput:**
```
⚠ Success rate 85-90%
⚠ 1000-2000 requests/second
⚠ P95 latency 1-3 seconds
⚠ 5-10% errors
```

**Poor throughput:**
```
✗ Success rate < 85%
✗ < 1000 requests/second
✗ P95 latency > 3 seconds
✗ > 10% errors
```

### Comparing Results

**Example Comparison:**

| Metric | VT (Single) | WF (Single) | VT (Parallel) | WF (Parallel) |
|--------|-------------|-------------|---------------|---------------|
| RPS | 3,245/s | 3,180/s | 1,446/s | 1,398/s |
| Success Rate | 99.2% | 98.7% | 98.1% | 97.3% |
| P50 Latency | 187ms | 198ms | 234ms | 256ms |
| P95 Latency | 612ms | 687ms | 723ms | 801ms |
| P99 Latency | 1.2s | 1.4s | 1.4s | 1.6s |
| Failed Reqs | 320 | 520 | 766 | 1,088 |

**Observations:**
- Virtual Threads has higher RPS in all scenarios
- Success rates drop slightly when testing in parallel
- Response times increase when both apps compete for resources
- Single-server tests show higher absolute throughput

## Best Practices

### Before Testing

1. **Clean system state:**
   ```bash
   # Restart services
   docker-compose restart virtual-threads-app webflux-app

   # Wait for warmup
   sleep 30

   # Verify health
   curl http://localhost:8083/actuator/health
   curl http://localhost:8084/actuator/health
   ```

2. **Check database state:**
   ```bash
   # Check database size (large DB may slow tests)
   docker exec -it benchmark-postgres psql -U postgres -d benchmark -c \
     "SELECT pg_size_pretty(pg_database_size('benchmark'));"

   # Optionally clear data for consistent baseline
   docker exec -it benchmark-postgres psql -U postgres -d benchmark -c \
     "TRUNCATE TABLE users RESTART IDENTITY CASCADE;"
   ```

3. **Monitor resources:**
   ```bash
   # Check available resources
   docker stats --no-stream
   ```

4. **Open Grafana (recommended):**
   ```bash
   open http://localhost:3000
   # Navigate to benchmark dashboard
   # Enable auto-refresh (5s)
   ```

### During Testing

1. **Watch Grafana** - Monitor real-time throughput and errors
2. **Don't interrupt** - Let burst complete (only takes 2-5 minutes)
3. **Check for errors** - Watch error rates spike
4. **Monitor CPU/Memory** - See resource saturation
5. **Note observations** - Document any issues

### After Testing

1. **Cool down before next test** - Wait 3-5 minutes minimum
2. **Save all results** - Keep JSON, text, and HTML files
3. **Take screenshots** - Capture Grafana metrics during burst
4. **Review results** - Compare RPS, success rate, latency
5. **Document findings** - Which has better throughput and why?

### Sequential vs Parallel Testing

**Use Sequential Throughput Testing When:**
- Want maximum absolute throughput measurement
- System resources are limited
- Need clean baseline comparisons
- Testing on laptop or shared machine
- Comparing absolute performance limits

**Use Parallel Throughput Testing When:**
- Want direct head-to-head comparison
- Sufficient system resources available (8+ cores, 16GB+ RAM)
- Using Grafana for real-time visualization
- Testing resource contention scenarios
- Quick comparison is priority

### Interpreting Throughput Results

**High RPS, Low Errors:**
- System handles burst load well
- Good throughput capacity
- Stable under stress

**High RPS, High Errors:**
- System overwhelmed
- Needs tuning (connection pools, memory)
- May need to reduce concurrent users

**Low RPS, Low Errors:**
- Bottleneck somewhere (CPU, DB, network)
- Check resource utilization
- May need optimization

**Low RPS, High Errors:**
- Serious performance issues
- Check logs for errors
- May need architectural changes

### Troubleshooting

**Very high error rates (> 20%):**
```bash
# Check application logs
docker logs -f virtual-threads-app
docker logs -f webflux-app

# Check database connections
docker exec -it benchmark-postgres psql -U postgres -d benchmark -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='benchmark';"

# Reduce concurrent users
# Edit k6-throughput-test.js: vus: 2000 → 1000
```

**Low throughput (< 1000 RPS):**
```bash
# Check CPU usage
docker stats --no-stream

# Check database performance
docker exec -it benchmark-postgres psql -U postgres -d benchmark -c \
  "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5;"

# Increase connection pool sizes in application.yml
```

**Tests timing out:**
```bash
# Increase timeout in k6 script
# Edit k6-throughput-test.js: timeout: '30s' → '60s'

# Or reduce total requests
# Edit k6-throughput-test.js: iterations: 40000 → 20000
```

**Out of memory errors:**
```bash
# Increase memory limits in docker-compose.yml
# memory: 2G → 4G

# Restart services
docker-compose restart virtual-threads-app webflux-app
```

## Next Steps

After completing throughput tests:

1. **Analyze Results** - Which application has better throughput?
2. **Compare with Load Tests** - How do sustained vs burst loads compare?
3. **Check Grafana** - Review dashboard at http://localhost:3000
4. **Review Load Tests** - See [LOAD_TESTING.md](LOAD_TESTING.md)
5. **Document Findings** - Save results and conclusions

## Summary

Throughput testing helps you understand:
- **Maximum RPS** - Peak requests per second capacity
- **Burst handling** - How well system handles sudden load spikes
- **Error rates** - Reliability under maximum load
- **Response times** - Performance during burst load
- **Comparison** - Which approach has better throughput?

Use **sequential testing** for maximum absolute throughput or **parallel testing** for direct head-to-head comparison. Always monitor with Grafana for comprehensive insights.

Key differences from load tests:
- **Duration:** Minutes vs. hours
- **Pattern:** Immediate burst vs. gradual ramp
- **Purpose:** Max throughput vs. sustained capacity
- **Metric:** RPS primary vs. latency primary
