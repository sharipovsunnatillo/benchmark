# Virtual Threads vs Reactive (WebFlux) Benchmark

This project benchmarks two different approaches to handling concurrent requests in Spring Boot applications with **real-time monitoring via Grafana**.

## Approaches Compared

1. **Virtual Threads** - Uses Spring Boot with Spring MVC and Virtual Threads (Project Loom)
2. **Reactive (WebFlux)** - Uses Spring Boot with Spring WebFlux and R2DBC

Both applications are containerized with Docker and limited to 2 CPU cores to provide a fair comparison.

## Key Features

- ✅ **Real-time Grafana Dashboard** - Monitor average latency, RPS, CPU, and memory usage live
- ✅ **Prometheus Metrics** - Comprehensive application and system metrics collection
- ✅ **Automated Load Testing** - K6 script that gradually increases load until crash
- ✅ **Docker Compose Setup** - One command to start entire stack
- ✅ **Pre-configured Dashboards** - Ready-to-use Grafana visualizations
- ✅ **Fair Comparison** - Identical endpoints, database, and resource limits

## Quick Start

```bash
# 1. Start everything
docker-compose up --build -d

# 2. Open Grafana at http://localhost:3000 (admin/admin)

# 3. Run load test
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js

# 4. Watch metrics in real-time!
```

See [QUICKSTART.md](QUICKSTART.md) for detailed 5-minute setup guide.

## Project Structure

```
benchmark/
├── virtual-threads/              # Spring Boot MVC with Virtual Threads
│   ├── src/main/java/           # Application source code
│   ├── src/main/resources/      # Configuration and DB migrations
│   ├── Dockerfile               # Container image definition
│   ├── pom.xml                  # Maven dependencies
│   └── README.md                # Virtual Threads documentation
│
├── webflux/                      # Spring Boot WebFlux with R2DBC
│   ├── src/main/java/           # Application source code
│   ├── src/main/resources/      # Configuration and DB migrations
│   ├── Dockerfile               # Container image definition
│   ├── pom.xml                  # Maven dependencies
│   └── README.md                # WebFlux documentation
│
├── monitoring/                   # Monitoring stack configuration
│   ├── prometheus/
│   │   └── prometheus.yml       # Prometheus scrape config
│   └── grafana/
│       └── provisioning/
│           ├── datasources/     # Auto-configured Prometheus datasource
│           └── dashboards/      # Pre-built benchmark dashboard
│
├── docker-compose.yml            # Orchestrates all services
├── k6-load-test.js              # K6 load testing script
├── run-benchmark.sh             # Automated benchmark runner
├── README.md                    # This file - comprehensive guide
├── QUICKSTART.md                # 5-minute getting started guide
├── MONITORING.md                # Detailed monitoring documentation
└── .gitignore                   # Git ignore rules
```

## Features

Both applications provide identical functionality:

### API Endpoints

1. **Create User** - `POST /api/users`
   ```json
   {
     "username": "john_doe",
     "email": "john@example.com",
     "firstName": "John",
     "lastName": "Doe"
   }
   ```

2. **Get Users (Paginated)** - `GET /api/users?page=0&size=20`
   ```json
   {
     "content": [...],
     "page": 0,
     "size": 20,
     "totalElements": 100,
     "totalPages": 5
   }
   ```

### Technology Stack

**Virtual Threads Application:**
- Spring Boot 4.0.0
- Spring MVC with Virtual Threads enabled
- Spring Data JDBC
- PostgreSQL
- MapStruct for DTO mapping
- Liquibase for database migrations

**WebFlux Application:**
- Spring Boot 4.0.0
- Spring WebFlux
- Spring Data R2DBC
- PostgreSQL (R2DBC driver)
- MapStruct for DTO mapping
- Liquibase for database migrations

## Prerequisites

- Docker and Docker Compose
- Java 25 (for local development)
- Maven 3.9+ (for local development)

## Quick Start

### Build and Run with Docker Compose

```bash
# Build and start all services (PostgreSQL + both applications)
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d

# Check logs
docker-compose logs -f virtual-threads-app
docker-compose logs -f webflux-app

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Service URLs

- **Virtual Threads App**: http://localhost:8083
- **WebFlux App**: http://localhost:8084
- **PostgreSQL**: localhost:5433
- **Grafana Dashboard**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **cAdvisor**: http://localhost:8082

### Resource Limits

Both applications are configured with:
- **CPU Limit**: 2 cores
- **Memory Limit**: 2GB
- **Memory Reservation**: 512MB

## Real-time Monitoring with Grafana

The benchmark includes a complete monitoring stack for real-time visualization of performance metrics.

### Monitoring Stack

- **Grafana**: Dashboard visualization (http://localhost:3000)
- **Prometheus**: Metrics collection and storage (http://localhost:9090)
- **cAdvisor**: Container resource metrics (http://localhost:8082)
- **Spring Boot Actuator**: Application metrics via `/actuator/prometheus`
- **Micrometer**: Metrics instrumentation library

### Accessing Grafana Dashboard

1. **Start all services:**
   ```bash
   docker-compose up --build -d
   ```

2. **Open Grafana:**
   - URL: http://localhost:3000
   - Username: `admin`
   - Password: `admin`

3. **View the benchmark dashboard:**
   - The dashboard is automatically provisioned
   - Look for "Virtual Threads vs WebFlux Benchmark" in the dashboards list
   - Or navigate directly to: http://localhost:3000/d/benchmark-dashboard

### Metrics Available

The Grafana dashboard displays the following real-time metrics for both applications:

#### Application Performance Metrics
- **Requests Per Second (RPS)**: Rate of incoming requests
- **Response Time Percentiles**: P50 and P95 latency measurements
- **Average Latency**: Real-time response time tracking
- **HTTP Status Codes**: Success/error rates

#### System Resource Metrics
- **CPU Usage (%)**: Container CPU utilization (2 cores max)
- **Memory Usage**: Container memory consumption vs limit (2GB max)
- **JVM Heap Memory**: Java heap usage and limits
- **JVM Thread Count**: Number of active threads

### Metrics Endpoints

Both applications expose Prometheus-compatible metrics:

- Virtual Threads: http://localhost:8083/actuator/prometheus
- WebFlux: http://localhost:8084/actuator/prometheus

You can also access health and info endpoints:
- http://localhost:8083/actuator/health
- http://localhost:8084/actuator/health

### Prometheus Queries

Access Prometheus UI at http://localhost:9090 to run custom queries:

```promql
# Request rate for Virtual Threads
rate(http_server_requests_seconds_count{application="virtual-threads"}[1m])

# P95 latency for WebFlux
histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{application="webflux"}[1m])) by (le))

# CPU usage percentage
sum(rate(container_cpu_usage_seconds_total{name="virtual-threads-app"}[1m])) * 100 / 2

# Memory usage in MB
container_memory_usage_bytes{name="webflux-app"} / 1024 / 1024
```

### Custom Dashboard Panels

The pre-configured dashboard includes:

1. **RPS Comparison**: Side-by-side requests per second
2. **Latency Comparison**: P50 and P95 response times
3. **CPU Usage**: Real-time CPU utilization
4. **Memory Usage**: Container and JVM memory tracking
5. **Summary Gauges**: Current latency and RPS values
6. **Thread Count**: JVM thread monitoring
7. **Heap Memory**: Java heap usage visualization

### Monitoring During Load Tests

To effectively monitor during load testing:

1. **Open Grafana dashboard** before starting the load test
2. **Start your load test** using K6 or another tool
3. **Watch real-time metrics** as load increases
4. **Identify bottlenecks** by observing:
   - When latency starts increasing
   - When CPU hits 100%
   - When memory approaches the limit
   - When error rates increase

### Exporting Metrics

**Export data from Prometheus:**
```bash
# Query API example
curl 'http://localhost:9090/api/v1/query?query=rate(http_server_requests_seconds_count[1m])'
```

**Export Grafana dashboard as JSON:**
- Open dashboard → Settings → JSON Model → Copy to clipboard

**Take screenshots:**
- Grafana has built-in screenshot functionality
- Or use browser developer tools

## Load Testing Tools

To benchmark these applications with gradually increasing load until they crash, use one of the following tools:

### 1. K6 (Recommended)

K6 is a modern load testing tool with excellent support for ramping scenarios.

**Installation:**
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

**Example Test Script (k6-test.js):**
```javascript
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '3m', target: 200 },   // Stay at 200 users
    { duration: '2m', target: 500 },   // Ramp up to 500 users
    { duration: '3m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '2m', target: 2000 },  // Ramp up to 2000 users
    { duration: '5m', target: 2000 },  // Stay at 2000 users
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8083';

export default function () {
  // Test create user endpoint
  const createPayload = JSON.stringify({
    username: `user_${Date.now()}_${__VU}_${__ITER}`,
    email: `user_${Date.now()}_${__VU}_${__ITER}@example.com`,
    firstName: 'Test',
    lastName: 'User',
  });

  const createRes = http.post(`${BASE_URL}/api/users`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(createRes, {
    'create status is 201': (r) => r.status === 201,
  });

  sleep(0.1);

  // Test pagination endpoint
  const pageRes = http.get(`${BASE_URL}/api/users?page=0&size=20`);

  check(pageRes, {
    'page status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}
```

**Run K6 Tests:**
```bash
# Option 1: Test both applications in parallel (Recommended for side-by-side comparison)
k6 run k6-parallel-test.js

# Option 2: Test applications separately
k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js  # Virtual Threads
k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js  # WebFlux
```

The parallel test script (`k6-parallel-test.js`) tests both applications simultaneously, allowing you to see real-time comparison metrics in Grafana. This is the recommended approach for benchmarking.

### 2. wrk2

wrk2 is a high-performance HTTP benchmarking tool with constant throughput support.

**Installation:**
```bash
# macOS
brew install wrk

# Linux (build from source)
git clone https://github.com/giltene/wrk2.git
cd wrk2
make
sudo cp wrk /usr/local/bin/
```

**Example Usage:**
```bash
# Test Virtual Threads - Create User endpoint
wrk -t12 -c100 -d60s -R2000 --latency \
  -s create-user.lua \
  http://localhost:8083/api/users

# Test WebFlux - Pagination endpoint
wrk -t12 -c100 -d60s -R2000 --latency \
  http://localhost:8084/api/users?page=0&size=20
```

**Lua Script for POST requests (create-user.lua):**
```lua
wrk.method = "POST"
wrk.body   = '{"username":"test_'..os.time()..'","email":"test@example.com","firstName":"Test","lastName":"User"}'
wrk.headers["Content-Type"] = "application/json"
```

### 3. Gatling

Gatling is a powerful load testing framework with detailed reports.

**Installation:**
```bash
# macOS
brew install gatling

# Or download from https://gatling.io/open-source/
```

### 4. Apache JMeter

JMeter is a mature, GUI-based load testing tool.

**Download:** https://jmeter.apache.org/download_jmeter.cgi

### 5. Vegeta

Vegeta is a versatile HTTP load testing tool.

**Installation:**
```bash
# macOS
brew install vegeta

# Linux
go install github.com/tsenart/vegeta@latest
```

**Example Usage:**
```bash
# Create target file (targets.txt)
echo "GET http://localhost:8083/api/users?page=0&size=20" | \
  vegeta attack -duration=60s -rate=100/s | \
  vegeta report

# Gradually increase rate
for rate in 100 200 500 1000 2000 5000; do
  echo "Testing at ${rate} req/s"
  echo "GET http://localhost:8083/api/users" | \
    vegeta attack -duration=30s -rate=${rate}/s | \
    vegeta report
  sleep 5
done
```

## Benchmarking Strategy

### Recommended Approach with Real-time Monitoring

1. **Start All Services (Apps + Monitoring Stack):**
   ```bash
   docker-compose up --build -d
   ```

2. **Open Grafana Dashboard:**
   - Navigate to http://localhost:3000
   - Login with `admin` / `admin`
   - Open "Virtual Threads vs WebFlux Benchmark" dashboard
   - Set auto-refresh to 5 seconds
   - Keep this open in a separate window/monitor

3. **Wait for Startup:**
   ```bash
   # Check if applications are healthy
   curl http://localhost:8083/api/users
   curl http://localhost:8084/api/users

   # Verify metrics are being collected
   curl http://localhost:8083/actuator/prometheus
   curl http://localhost:8084/actuator/prometheus
   ```

4. **Create Initial Test Data (Optional):**
   ```bash
   # Pre-populate database
   for i in {1..100}; do
     curl -X POST http://localhost:8083/api/users \
       -H "Content-Type: application/json" \
       -d "{\"username\":\"user$i\",\"email\":\"user$i@test.com\",\"firstName\":\"Test\",\"lastName\":\"User$i\"}"
   done
   ```

5. **Run Load Tests with K6 (Watch Grafana in Real-time):**
   ```bash
   # Test Virtual Threads - watch Grafana dashboard for real-time metrics
   k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js > virtual-threads-results.txt

   # Wait for cooldown (2-5 minutes)
   sleep 300

   # Test WebFlux - compare metrics with Virtual Threads in Grafana
   k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js > webflux-results.txt
   ```

6. **Monitor in Real-time (via Grafana Dashboard):**
   - **Average Latency**: Watch P95 response times
   - **RPS (Requests Per Second)**: Monitor throughput
   - **CPU Usage**: Track CPU percentage (max 100% for 2 cores)
   - **Memory Usage**: Observe container and JVM heap memory
   - **Thread Count**: See JVM thread behavior
   - **Error Rates**: Identify when applications start failing

7. **Alternative: Monitor with Docker Stats:**
   ```bash
   # Run in parallel with load test
   docker stats virtual-threads-app webflux-app
   ```

8. **Collect Metrics from Multiple Sources:**
   - **K6 Output**: Response times, throughput, error rates from load test
   - **Grafana**: Visual comparison of both applications
   - **Prometheus**: Raw metrics data for analysis
   - **Docker Stats**: Container resource usage
   - Screenshots of Grafana dashboard at key load levels

9. **Analyze Results:**
   - Compare maximum sustainable load before degradation
   - Identify at what RPS latency starts increasing significantly
   - Note CPU and memory usage patterns
   - Compare thread count between virtual threads and reactive
   - Determine failure points and error conditions
   - Export Grafana dashboard as JSON for documentation

## Monitoring and Debugging

### View Application Logs
```bash
docker-compose logs -f virtual-threads-app
docker-compose logs -f webflux-app
```

### Access Database
```bash
docker exec -it benchmark-postgres psql -U postgres -d benchmark
```

### Check Resource Usage
```bash
docker stats
```

### Restart Individual Service
```bash
docker-compose restart virtual-threads-app
docker-compose restart webflux-app
```

## Development

### Run Locally (without Docker)

1. **Start PostgreSQL:**
   ```bash
   docker run -d \
     --name postgres-local \
     -e POSTGRES_DB=benchmark \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -p 5433:5432 \
     postgres:17-alpine
   ```

2. **Build and Run Virtual Threads:**
   ```bash
   cd virtual-threads
   mvn clean package
   java -jar target/*.jar
   ```

3. **Build and Run WebFlux:**
   ```bash
   cd webflux
   mvn clean package
   java -jar target/*.jar
   ```

## Expected Outcomes

### Virtual Threads (Spring MVC)
- **Pros:**
  - Simpler programming model (blocking code)
  - Better stack traces and debugging
  - Easier integration with existing libraries
  - Lower CPU usage for I/O-bound operations

- **Cons:**
  - May use more memory under extreme load
  - Thread context switching overhead (mitigated by virtual threads)

### Reactive (Spring WebFlux)
- **Pros:**
  - Lower memory footprint
  - Better backpressure handling
  - Excellent for high-concurrency scenarios

- **Cons:**
  - Steeper learning curve
  - More complex debugging
  - Reactive stack required throughout

## Troubleshooting

### Application won't start
- Check if port 8083 or 8084 is already in use
- Ensure PostgreSQL is healthy: `docker-compose ps`
- Check logs: `docker-compose logs`

### Database connection errors
- Verify PostgreSQL is running: `docker-compose ps postgres`
- Check database credentials in docker-compose.yml
- Ensure health check passes before apps start

### Out of memory errors
- Increase memory limits in docker-compose.yml
- Adjust JVM heap settings in Dockerfiles

## License

This is a benchmark project for educational purposes.

## Contributing

Feel free to submit issues and enhancement requests!
