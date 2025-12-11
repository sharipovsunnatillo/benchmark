# Real-time Monitoring Guide

This guide explains how to use the integrated monitoring stack to analyze the Virtual Threads vs WebFlux benchmark in real-time.

## Quick Start

```bash
# 1. Start everything
docker-compose up --build -d

# 2. Open Grafana
open http://localhost:3000
# Login: admin / admin

# 3. Open the benchmark dashboard
# Navigate to "Virtual Threads vs WebFlux Benchmark"

# 4. Run a load test and watch metrics in real-time
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js
```

## Monitoring Stack Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Virtual    │────>│  Prometheus  │────>│  Grafana   │
│  Threads    │     │              │     │            │
│  App:8083   │     │  :9090       │     │  :3000     │
└─────────────┘     │              │     │            │
                    │              │     │            │
┌─────────────┐     │              │     │            │
│  WebFlux    │────>│              │     │            │
│  App:8084   │     │              │     │            │
└─────────────┘     └──────────────┘     └────────────┘
                           ^
                           │
┌─────────────┐           │
│  cAdvisor   │───────────┘
│  :8082      │
└─────────────┘
```

## Components

### 1. Spring Boot Actuator + Micrometer
- Exposes `/actuator/prometheus` endpoint
- Provides application-level metrics:
  - HTTP request rates
  - Response time percentiles
  - JVM metrics (heap, threads, GC)
  - Custom business metrics

### 2. Prometheus
- Scrapes metrics every 5 seconds
- Stores time-series data
- Provides query language (PromQL)
- Access: http://localhost:9090

### 3. Grafana
- Visualizes metrics from Prometheus
- Pre-configured dashboard
- Auto-refresh every 5 seconds
- Access: http://localhost:3000

### 4. cAdvisor
- Collects container resource metrics
- Provides CPU, memory, network, disk usage
- Access: http://localhost:8082

## Metrics Explained

### Average Latency (P95)
**What it measures:** 95th percentile response time - 95% of requests complete faster than this value.

**Why it matters:** Shows how the application performs under load, excluding outliers.

**What to watch:**
- Gradual increase = System reaching capacity
- Sudden spike = Resource exhaustion or contention
- Stays flat = Good scalability

**PromQL Query:**
```promql
histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{application="virtual-threads"}[1m])) by (le))
```

### RPS (Requests Per Second)
**What it measures:** Rate of incoming HTTP requests.

**Why it matters:** Shows throughput and helps identify maximum load capacity.

**What to watch:**
- Increasing RPS with flat latency = Good performance
- RPS plateaus while load increases = Hitting limits
- Declining RPS = System starting to fail

**PromQL Query:**
```promql
rate(http_server_requests_seconds_count{application="virtual-threads"}[1m])
```

### CPU Usage (%)
**What it measures:** Percentage of allocated CPU being used (max 200% for 2 cores).

**Why it matters:** Identifies if CPU is the bottleneck.

**What to watch:**
- Approaching 100% = CPU-bound
- Low CPU with high latency = I/O-bound or blocking
- Spiky patterns = Inefficient resource usage

**PromQL Query:**
```promql
sum(rate(container_cpu_usage_seconds_total{name="virtual-threads-app"}[1m])) * 100 / 2
```

### Memory Usage
**What it measures:** Container and JVM heap memory consumption.

**Why it matters:** Identifies memory pressure and potential OOM conditions.

**What to watch:**
- Steady state = Good memory management
- Continuous growth = Memory leak
- Frequent GC = Heap pressure
- Approaching limit = Risk of OOM

**PromQL Query:**
```promql
container_memory_usage_bytes{name="virtual-threads-app"}
jvm_memory_used_bytes{application="virtual-threads", area="heap"}
```

## Dashboard Panels

### 1. RPS Comparison (Top Left)
**Shows:** Requests per second for both applications over time

**How to interpret:**
- Compare throughput capabilities
- Identify which approach handles more concurrent requests
- Watch for plateaus indicating max capacity

### 2. Response Time Percentiles (Top Right)
**Shows:** P50 and P95 latency for both applications

**How to interpret:**
- P50 = median response time (typical request)
- P95 = 95th percentile (near-worst case)
- Gap between P50 and P95 indicates variability
- Increasing gap = performance degradation

### 3. CPU Usage (Middle Left)
**Shows:** CPU utilization percentage

**How to interpret:**
- Virtual Threads may use CPU more efficiently for I/O operations
- WebFlux might show lower CPU for same workload
- 100% = CPU bottleneck

### 4. Memory Usage (Middle Right)
**Shows:** Container and JVM heap memory

**How to interpret:**
- Compare memory efficiency
- Watch GC patterns
- Virtual Threads may use more memory per request
- WebFlux typically has lower memory footprint

### 5. Gauge Panels (Bottom)
**Shows:** Current values for latency and RPS

**How to interpret:**
- Quick glance at current performance
- Color-coded thresholds (green/yellow/red)

### 6. JVM Thread Count (Bottom Left)
**Shows:** Number of active JVM threads

**How to interpret:**
- Virtual Threads: Many virtual threads on few platform threads
- WebFlux: Small, fixed thread pool (typically 2x CPU cores)
- Helpful for understanding concurrency model

### 7. JVM Heap Memory (Bottom Right)
**Shows:** Heap usage vs max heap

**How to interpret:**
- Watch for heap exhaustion
- Compare GC efficiency
- Identify memory pressure

## Using Grafana During Load Tests

### Pre-Test Setup
1. Open Grafana dashboard
2. Set time range to "Last 15 minutes" or "Last 30 minutes"
3. Enable auto-refresh (5s or 10s)
4. Optionally open two browser windows side-by-side:
   - Left: Grafana dashboard
   - Right: Terminal running K6

### During Load Test
1. **Watch the RPS panel** - See load ramping up
2. **Monitor latency** - Identify when response time degrades
3. **Check CPU** - See if CPU maxes out
4. **Observe memory** - Watch for memory pressure
5. **Note thread count** - Compare threading models
6. **Take screenshots** - Document key observations at different load levels

### Key Moments to Capture
- Baseline (minimal load)
- 50% of max expected load
- When latency starts increasing
- When CPU hits 100%
- When errors start occurring
- Maximum sustainable load
- Failure point

### Post-Test Analysis
1. Review the entire test timeline
2. Identify inflection points
3. Export dashboard as JSON
4. Save Prometheus data if needed
5. Document observations

## Prometheus Queries

Access Prometheus directly at http://localhost:9090 for custom queries.

### Useful Queries

**Total request count:**
```promql
http_server_requests_seconds_count{application="virtual-threads"}
```

**Average response time (last 5 minutes):**
```promql
rate(http_server_requests_seconds_sum{application="virtual-threads"}[5m]) /
rate(http_server_requests_seconds_count{application="virtual-threads"}[5m])
```

**Error rate:**
```promql
rate(http_server_requests_seconds_count{application="virtual-threads", status!~"2.."}[1m])
```

**Memory usage in GB:**
```promql
container_memory_usage_bytes{name="virtual-threads-app"} / 1024 / 1024 / 1024
```

**GC pause time:**
```promql
rate(jvm_gc_pause_seconds_sum{application="virtual-threads"}[1m])
```

**Thread count delta:**
```promql
delta(jvm_threads_live_threads{application="virtual-threads"}[1m])
```

## Comparing Applications

### Side-by-Side Comparison

Use Grafana's ability to show multiple series on the same graph to directly compare:

1. **Latency at same RPS:**
   - Who responds faster at 1000 req/s?
   - Who maintains lower latency under pressure?

2. **RPS at same latency:**
   - Who handles more requests while staying under 100ms?

3. **Resource efficiency:**
   - Who uses less CPU for same workload?
   - Who uses less memory?

4. **Scalability:**
   - Who degrades more gracefully?
   - Who has a higher ceiling before failure?

### Creating Custom Comparisons

Add new panels to the dashboard:

1. Click "Add Panel" → "Add a new panel"
2. Write your PromQL query
3. Add multiple queries for comparison
4. Choose visualization type (time series, gauge, stat, etc.)
5. Save to dashboard

## Exporting Data

### Export Dashboard
1. Click dashboard settings (gear icon)
2. Go to "JSON Model"
3. Copy JSON
4. Save to file for documentation

### Export Metrics Data
```bash
# Query Prometheus HTTP API
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(http_server_requests_seconds_count[5m])' \
  | jq . > metrics.json

# Query range data
curl -G http://localhost:9090/api/v1/query_range \
  --data-urlencode 'query=rate(http_server_requests_seconds_count[5m])' \
  --data-urlencode 'start=2024-01-01T00:00:00Z' \
  --data-urlencode 'end=2024-01-01T01:00:00Z' \
  --data-urlencode 'step=15s' \
  | jq . > metrics_range.json
```

### Take Screenshots
- Use Grafana's built-in screenshot feature (camera icon on panels)
- Or use browser screenshot tools
- Or use kiosk mode for clean screenshots:
  ```
  http://localhost:3000/d/benchmark-dashboard?kiosk
  ```

## Troubleshooting

### Metrics not appearing
```bash
# Check if Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Check if apps are exposing metrics
curl http://localhost:8083/actuator/prometheus
curl http://localhost:8084/actuator/prometheus

# Check Prometheus logs
docker logs benchmark-prometheus
```

### Grafana shows "No data"
- Verify Prometheus data source is configured
- Check time range (try "Last 5 minutes")
- Verify Prometheus has data: http://localhost:9090
- Check Grafana logs: `docker logs benchmark-grafana`

### cAdvisor not showing container metrics
- Ensure cAdvisor has access to Docker socket
- Check cAdvisor UI: http://localhost:8082
- Verify containers are running: `docker ps`

### Dashboard not auto-provisioned
```bash
# Check provisioning directory
ls -la monitoring/grafana/provisioning/dashboards/

# Restart Grafana
docker-compose restart grafana

# Check Grafana logs
docker logs benchmark-grafana
```

## Best Practices

1. **Always monitor during tests** - Don't rely solely on K6 output
2. **Take screenshots** - Visual data is easier to share and review
3. **Document observations** - Note what you see at each load level
4. **Export data** - Save dashboard JSON and Prometheus queries
5. **Cooldown between tests** - Wait 2-5 minutes between runs
6. **Test one at a time** - Don't load test both apps simultaneously
7. **Establish baseline** - Run a light test first to verify everything works

## Advanced Monitoring

### Custom Metrics in Code

Add custom metrics to your Spring Boot applications:

```java
@Component
public class CustomMetrics {
    private final Counter customCounter;
    private final Timer customTimer;

    public CustomMetrics(MeterRegistry registry) {
        this.customCounter = Counter.builder("custom_operation_total")
            .description("Total custom operations")
            .register(registry);

        this.customTimer = Timer.builder("custom_operation_duration")
            .description("Custom operation duration")
            .register(registry);
    }
}
```

These will automatically appear in Prometheus and can be visualized in Grafana.

### Alerting (Optional)

Configure alerts in Grafana for:
- High latency (P95 > 1s)
- High error rate (>5%)
- CPU > 90%
- Memory > 90% of limit

## Summary

The monitoring stack provides comprehensive, real-time visibility into:
- **Performance**: Latency and throughput
- **Resources**: CPU and memory usage
- **Behavior**: Thread count and GC patterns
- **Comparison**: Side-by-side metrics for both approaches

Use Grafana as your primary analysis tool during load tests to make informed decisions about which approach performs better under various conditions.
