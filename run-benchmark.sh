#!/bin/bash

# Benchmark Runner Script
# This script helps you run load tests against both Virtual Threads and WebFlux applications

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Virtual Threads vs WebFlux Benchmark${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Please install k6 first:"
    echo "  macOS: brew install k6"
    echo "  Linux: See https://k6.io/docs/getting-started/installation/"
    echo "  Windows: choco install k6"
    exit 1
fi

# Check if docker-compose is running
if ! docker ps | grep -q benchmark-postgres; then
    echo -e "${YELLOW}Warning: Docker containers don't seem to be running${NC}"
    echo "Starting Docker containers..."
    docker-compose up -d
    echo "Waiting for services to be ready..."
    sleep 30
fi

# Wait for applications to be healthy
echo "Checking if applications are ready..."

for i in {1..30}; do
    if curl -s http://localhost:8083/api/users?page=0&size=1 > /dev/null 2>&1; then
        echo -e "${GREEN}Virtual Threads app is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Virtual Threads app failed to start${NC}"
        exit 1
    fi
    sleep 2
done

for i in {1..30}; do
    if curl -s http://localhost:8084/api/users?page=0&size=1 > /dev/null 2>&1; then
        echo -e "${GREEN}WebFlux app is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}WebFlux app failed to start${NC}"
        exit 1
    fi
    sleep 2
done

echo ""
echo -e "${GREEN}Both applications are ready!${NC}"
echo ""
echo -e "${YELLOW}Open Grafana Dashboard for real-time metrics:${NC}"
echo "  URL: http://localhost:3000"
echo "  Username: admin"
echo "  Password: admin"
echo "  Dashboard: Virtual Threads vs WebFlux Benchmark"
echo ""

# Ask which test to run
echo "Which application do you want to test?"
echo "1) Virtual Threads (port 8083)"
echo "2) WebFlux (port 8084)"
echo "3) Both (sequentially)"
echo "4) Both (in parallel) - Recommended for side-by-side comparison"
read -p "Enter your choice [1-4]: " choice

timestamp=$(date +%Y%m%d_%H%M%S)

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Running load test on Virtual Threads...${NC}"
        k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js \
            --out json=virtual-threads-results-${timestamp}.json \
            | tee virtual-threads-results-${timestamp}.txt
        echo ""
        echo -e "${GREEN}Results saved to:${NC}"
        echo "  - virtual-threads-results-${timestamp}.txt"
        echo "  - virtual-threads-results-${timestamp}.json"
        ;;
    2)
        echo ""
        echo -e "${GREEN}Running load test on WebFlux...${NC}"
        k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js \
            --out json=webflux-results-${timestamp}.json \
            | tee webflux-results-${timestamp}.txt
        echo ""
        echo -e "${GREEN}Results saved to:${NC}"
        echo "  - webflux-results-${timestamp}.txt"
        echo "  - webflux-results-${timestamp}.json"
        ;;
    3)
        echo ""
        echo -e "${GREEN}Running load test on Virtual Threads...${NC}"
        k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js \
            --out json=virtual-threads-results-${timestamp}.json \
            | tee virtual-threads-results-${timestamp}.txt

        echo ""
        echo -e "${YELLOW}Waiting 2 minutes before testing WebFlux...${NC}"
        sleep 120

        echo ""
        echo -e "${GREEN}Running load test on WebFlux...${NC}"
        k6 run --env BASE_URL=http://localhost:8084 k6-load-test.js \
            --out json=webflux-results-${timestamp}.json \
            | tee webflux-results-${timestamp}.txt

        echo ""
        echo -e "${GREEN}All tests completed! Results saved to:${NC}"
        echo "  Virtual Threads:"
        echo "    - virtual-threads-results-${timestamp}.txt"
        echo "    - virtual-threads-results-${timestamp}.json"
        echo "  WebFlux:"
        echo "    - webflux-results-${timestamp}.txt"
        echo "    - webflux-results-${timestamp}.json"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Benchmark complete!${NC}"
echo ""
echo "📊 View results in Grafana:"
echo "  http://localhost:3000/d/benchmark-dashboard"
echo ""
echo "📈 View raw metrics in Prometheus:"
echo "  http://localhost:9090"
echo ""
echo "🐳 To view Docker stats:"
echo "  docker stats virtual-threads-app webflux-app"
echo ""
echo "📝 To view application logs:"
echo "  docker logs -f virtual-threads-app"
echo "  docker logs -f webflux-app"
