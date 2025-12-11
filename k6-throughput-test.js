import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

/**
 * K6 Throughput Test Script - Burst Testing
 *
 * This script sends a large burst of concurrent requests to test throughput
 * and measure failure rates under extreme load.
 *
 * Usage:
 *   Test Virtual Threads: k6 run --env BASE_URL=http://localhost:8083 k6-throughput-test.js
 *   Test WebFlux: k6 run --env BASE_URL=http://localhost:8084 k6-throughput-test.js
 */

// Custom metrics
const requestsTotal = new Counter('requests_total');
const requestsSuccess = new Counter('requests_success');
const requestsFailed = new Counter('requests_failed');
const successRate = new Rate('success_rate');
const responseTime = new Trend('response_time');

// Test configuration - 10k requests burst
export const options = {
  scenarios: {
    burst_test: {
      executor: 'shared-iterations',
      vus: 2000,              // 1000 virtual users
      iterations: 40000,      // 10k total requests
      maxDuration: '5m',      // Max 5 minutes for all requests
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<1000', 'p(95)<5000', 'p(99)<10000'],
    http_req_failed: ['rate<0.1'],  // Allow up to 10% failure
    success_rate: ['rate>0.9'],      // Expect at least 90% success
  },
};

// Base URL from environment variable
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8083';
const APP_NAME = __ENV.APP_NAME || 'Unknown';

// Generate unique user data
function generateUserData() {
  const timestamp = Date.now();
  const vu = __VU;
  const iter = __ITER;
  const random = Math.floor(Math.random() * 1000000);

  return {
    username: `burst_user_${timestamp}_${vu}_${iter}_${random}`,
    email: `burst_${timestamp}_${vu}_${iter}_${random}@example.com`,
    firstName: `BurstFirst_${vu}`,
    lastName: `BurstLast_${iter}`,
  };
}

export default function () {
  requestsTotal.add(1);

  const userData = generateUserData();
  const payload = JSON.stringify(userData);

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/users`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });
  const duration = Date.now() - startTime;

  responseTime.add(duration);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'has user id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    requestsSuccess.add(1);
    successRate.add(1);
  } else {
    requestsFailed.add(1);
    successRate.add(0);
    // Only log status, not the response body to avoid JSON output
    if (__ITER % 100 === 0) {
      console.error(`Request failed: Status ${res.status}, VU ${__VU}, Iter ${__ITER}`);
    }
  }
}

// Setup phase
export function setup() {
  console.log('='.repeat(60));
  console.log('THROUGHPUT BURST TEST');
  console.log('='.repeat(60));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Application: ${APP_NAME}`);
  console.log(`Test config:`);
  console.log(`  - Total requests: 10,000`);
  console.log(`  - Virtual users: 1,000`);
  console.log(`  - Requests per VU: 10`);
  console.log(`  - Max duration: 5 minutes`);
  console.log('='.repeat(60));

  // Verify server is responsive
  const healthCheck = http.get(`${BASE_URL}/api/users?page=0&size=1`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not responding: ${healthCheck.status}`);
  }

  console.log('Server is healthy, starting burst test...');
  console.log('');

  return {
    startTime: Date.now(),
    appName: APP_NAME,
    baseUrl: BASE_URL,
  };
}

// Teardown phase with detailed summary
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('');
  console.log('='.repeat(60));
  console.log('THROUGHPUT TEST COMPLETED');
  console.log('='.repeat(60));
  console.log(`Application: ${data.appName}`);
  console.log(`URL: ${data.baseUrl}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log('='.repeat(60));
  console.log('Check the summary above for detailed metrics including:');
  console.log('  - Total requests sent');
  console.log('  - Success rate');
  console.log('  - Failed requests count');
  console.log('  - Response time percentiles (p50, p95, p99)');
  console.log('  - Requests per second');
  console.log('='.repeat(60));
}

// Generate HTML report
export function handleSummary(data) {
  return {
    'throughput-report.html': htmlReport(data),
  };
}
