# Virtual Threads vs Reactive (WebFlux) Benchmark

Performance benchmark comparing Spring Boot with Virtual Threads vs Spring WebFlux with R2DBC. Includes real-time monitoring via Grafana.

## Prerequisites

Install these tools:

```bash
# Docker & Docker Compose
# Download from: https://www.docker.com/get-started

# k6 (load testing tool)
brew install k6                    # macOS
choco install k6                   # Windows
# Linux: https://k6.io/docs/getting-started/installation/
```

## Quick Start

```bash
# 1. Start everything
docker-compose up --build -d

# 2. Wait 30 seconds for services to start
sleep 30

# 3. Open Grafana
open http://localhost:3000
# Login: admin / admin

# 4. Update Grafana dashboard with container IDs
cd monitoring && ./update-dashboard-ids.sh && cd ..

# 5. Run tests (choose one)
k6 run k6-parallel-test.js              # Load test: both apps
k6 run k6-throughput-parallel.js        # Throughput test: both apps
```

## ⚠️ CRITICAL: Update Grafana Dashboard After Starting

**cAdvisor only exposes Docker container IDs in metrics, not container names!**

After `docker-compose up`, you MUST update the Grafana dashboard with current container IDs.

### Option 1: Automated Script (Recommended)

```bash
# Run this script after starting containers
cd monitoring
./update-dashboard-ids.sh
```

This script automatically:
1. Detects current container IDs for virtual-threads-app and webflux-app
2. Updates the Grafana dashboard JSON file
3. Restarts Grafana to apply changes

**When to run:** Every time you recreate containers (`docker-compose up --build` or `docker-compose down && docker-compose up`)

### Option 2: Manual Update

```bash
# 1. Get container IDs
docker ps --format "{{.ID}} {{.Names}}"

# Look for:
# abc123def456 virtual-threads-app
# 789ghi012jkl webflux-app
```

**2. Update Grafana Dashboard:**

1. Open Grafana: http://localhost:3000
2. Go to: Dashboards → VT vs WebFlux
3. Click ⚙️ (Settings) → JSON Model
4. Find and replace ALL occurrences:
   - Replace: `id="$virtual_threads_id"` with `id="/docker/abc123def456"`
   - Replace: `id="$webflux_id"` with `id="/docker/789ghi012jkl"`
5. Click "Save dashboard"

**Why?** cAdvisor metrics only include `id`, `job`, `instance`, `env`, and `cpu` labels - no container name label exists!

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Virtual Threads API** | http://localhost:8083/api/users | - |
| **WebFlux API** | http://localhost:8084/api/users | - |
| **Grafana Dashboard** | http://localhost:3000 | admin/admin |
| **Prometheus** | http://localhost:9090 | - |
| **cAdvisor** | http://localhost:8082 | - |

## Testing

### Two Test Types

**1. Load Tests (Gradual Ramp-Up)**
- Gradually increases users: 50 → 100 → 200 → 500 → 1000 → 2000
- Duration: ~15 minutes
- Tests: Create + Read operations
- Goal: Find breaking points

**2. Throughput Tests (Burst Load)**
- Sends 40,000 requests per server immediately
- Duration: ~2-5 minutes
- Tests: Create operation only
- Goal: Measure max requests/second

### Test Files

| File | Purpose | Servers | Duration |
|------|---------|---------|----------|
| `k6-load-test.js` | Gradual load | Single | ~15 min |
| `k6-parallel-test.js` | Gradual load | Both | ~15 min |
| `k6-throughput-test.js` | Burst throughput | Single | ~2-5 min |
| `k6-throughput-parallel.js` | Burst throughput | Both | ~2-5 min |

### Run Tests

**Load Tests:**
```bash
# Test both apps simultaneously (recommended)
k6 run k6-parallel-test.js

# Test Virtual Threads only
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js

# Test WebFlux only
k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js
```

**Throughput Tests:**
```bash
# Test both apps simultaneously (80k total requests)
k6 run k6-throughput-parallel.js

# Test Virtual Threads only (40k requests)
k6 run --env BASE_URL=http://localhost:8083 k6-throughput-test.js

# Test WebFlux only (40k requests)
k6 run --env BASE_URL=http://localhost:8084 k6-throughput-test.js
```

### Detailed Guides

- **[LOAD_TESTING.md](LOAD_TESTING.md)** - Complete load testing guide with all options
- **[THROUGHPUT_TESTING.md](THROUGHPUT_TESTING.md)** - Complete throughput testing guide with all options

## Project Structure

```
benchmark/
├── virtual-threads/              # Spring Boot MVC + Virtual Threads
│   ├── src/main/java/
│   ├── Dockerfile
│   └── pom.xml
│
├── webflux/                      # Spring Boot WebFlux + R2DBC
│   ├── src/main/java/
│   ├── Dockerfile
│   └── pom.xml
│
├── monitoring/                   # Prometheus + Grafana configs
│   ├── prometheus/prometheus.yml
│   └── grafana/provisioning/
│
├── docker-compose.yml            # All services orchestration
│
├── k6-load-test.js              # Single server load test
├── k6-parallel-test.js          # Both servers load test
├── k6-throughput-test.js        # Single server throughput
├── k6-throughput-parallel.js    # Both servers throughput
│
├── README.md                    # This file
├── LOAD_TESTING.md              # Detailed load testing guide
├── THROUGHPUT_TESTING.md        # Detailed throughput guide
└── MONITORING.md                # Monitoring guide
```

## Architecture

Both applications provide identical REST API:

**Endpoints:**
- `POST /api/users` - Create user
- `GET /api/users?page=0&size=20` - Get users (paginated)

**Virtual Threads Stack:**
- Spring Boot 4.0.0
- Spring MVC with Virtual Threads
- Spring Data JDBC
- PostgreSQL
- Resource limits: 2 CPU cores, 2GB RAM

**WebFlux Stack:**
- Spring Boot 4.0.0
- Spring WebFlux
- Spring Data R2DBC
- PostgreSQL (R2DBC driver)
- Resource limits: 2 CPU cores, 2GB RAM

## Monitoring with Grafana

**Access:** http://localhost:3000 (admin/admin)

### Key Metrics

| Metric | Description | Good | Bad |
|--------|-------------|------|-----|
| **RPS** | Requests/second | Increasing with load | Plateauing/dropping |
| **P95 Latency** | 95% response time | < 500ms | > 1s |
| **CPU Usage** | Container CPU % | < 80% | 100% |
| **Memory** | Container memory | < 1.5GB | > 1.8GB |
| **Error Rate** | Failed requests % | < 1% | > 5% |

### What to Watch During Tests

**Good Performance:**
- ✅ Flat latency under increasing load
- ✅ RPS scales linearly
- ✅ CPU stays below 80%
- ✅ No errors

**Performance Issues:**
- ⚠️ Latency increasing rapidly
- ⚠️ RPS plateaus despite more users
- ⚠️ CPU at 100%
- ⚠️ Memory approaching 2GB limit
- ⚠️ Error rate > 1%

### Monitoring Stack

- **Grafana** (port 3000) - Dashboard visualization
- **Prometheus** (port 9090) - Metrics collection
- **cAdvisor** (port 8082) - Container metrics
- **Spring Boot Actuator** - Application metrics at `/actuator/prometheus`

## Useful Commands

```bash
# View logs
docker-compose logs -f virtual-threads-app
docker-compose logs -f webflux-app

# Check resource usage
docker stats virtual-threads-app webflux-app

# Restart services
docker-compose restart virtual-threads-app webflux-app

# Stop everything
docker-compose down

# Stop and remove data
docker-compose down -v

# Get container IDs (needed for Grafana)
docker ps --format "{{.ID}} {{.Names}}"
```

## Expected Results

### Virtual Threads
**Pros:**
- Simpler programming model (blocking code)
- Better stack traces and debugging
- Easier integration with existing libraries
- Lower CPU usage for I/O-bound operations

**Cons:**
- May use more memory under extreme load
- Thread context switching overhead (mitigated by virtual threads)

### WebFlux
**Pros:**
- Lower memory footprint
- Better backpressure handling
- Excellent for high-concurrency scenarios

**Cons:**
- Steeper learning curve
- More complex debugging
- Reactive stack required throughout

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs

# Check if ports are available
lsof -i :8083
lsof -i :8084

# Restart everything
docker-compose down -v
docker-compose up --build -d
```

### Grafana shows "No Data"
```bash
# Wait 30 seconds for first metrics
sleep 30

# Check Prometheus targets
open http://localhost:9090/targets

# Verify metrics endpoints
curl http://localhost:8083/actuator/prometheus | head
curl http://localhost:8084/actuator/prometheus | head
```

### cAdvisor metrics not showing
**→ Did you update container IDs in Grafana dashboard? See warning above!**

```bash
# Verify cAdvisor is running
curl http://localhost:8082/containers/

# Get container IDs
docker ps --format "{{.ID}} {{.Names}}"

# Update Grafana dashboard with these IDs
```

### High error rates during tests
```bash
# Check application logs
docker logs -f virtual-threads-app

# Reduce concurrent users in k6 scripts
# Edit k6-load-test.js or k6-throughput-test.js
# Change: vus: 2000 → vus: 1000
```

## Documentation

- **README.md** (this file) - Everything you need to know
- **[LOAD_TESTING.md](LOAD_TESTING.md)** - Detailed load testing guide with all options
- **[THROUGHPUT_TESTING.md](THROUGHPUT_TESTING.md)** - Detailed throughput testing guide with all options

## License

Educational benchmark project.
