import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

/**
 * K6 Parallel Throughput Test Script
 *
 * This script sends 40k requests to BOTH servers simultaneously (80k total)
 * to test throughput and measure failure rates under extreme parallel load.
 *
 * Usage:
 *   k6 run k6-throughput-parallel.js
 */

// Custom metrics for Virtual Threads
const vtRequestsTotal = new Counter('vt_requests_total');
const vtRequestsSuccess = new Counter('vt_requests_success');
const vtRequestsFailed = new Counter('vt_requests_failed');
const vtSuccessRate = new Rate('vt_success_rate');
const vtResponseTime = new Trend('vt_response_time');

// Custom metrics for WebFlux
const wfRequestsTotal = new Counter('wf_requests_total');
const wfRequestsSuccess = new Counter('wf_requests_success');
const wfRequestsFailed = new Counter('wf_requests_failed');
const wfSuccessRate = new Rate('wf_success_rate');
const wfResponseTime = new Trend('wf_response_time');

// Test configuration - 40k requests burst per server (80k total)
export const options = {
  scenarios: {
    burst_test: {
      executor: 'shared-iterations',
      vus: 2000,              // 2000 virtual users
      iterations: 40000,      // 40k total iterations (will test both servers)
      maxDuration: '5m',      // Max 5 minutes for all requests
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<1000', 'p(95)<5000', 'p(99)<10000'],
    http_req_failed: ['rate<0.1'],  // Allow up to 10% failure
    vt_success_rate: ['rate>0.9'],  // Expect at least 90% success for VT
    wf_success_rate: ['rate>0.9'],  // Expect at least 90% success for WF
  },
};

// Application URLs
const VIRTUAL_THREADS_URL = 'http://localhost:8083';
const WEBFLUX_URL = 'http://localhost:8084';

// Generate unique user data
function generateUserData(prefix) {
  const timestamp = Date.now();
  const vu = __VU;
  const iter = __ITER;
  const random = Math.floor(Math.random() * 1000000);

  return {
    username: `${prefix}_${timestamp}_${vu}_${iter}_${random}`,
    email: `${prefix}_${timestamp}_${vu}_${iter}_${random}@example.com`,
    firstName: `BurstFirst_${vu}`,
    lastName: `BurstLast_${iter}`,
  };
}

// Test Virtual Threads
function testVirtualThreads() {
  vtRequestsTotal.add(1);

  const userData = generateUserData('vt_burst');
  const payload = JSON.stringify(userData);

  const startTime = Date.now();
  const res = http.post(`${VIRTUAL_THREADS_URL}/api/users`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { app: 'virtual-threads' },
  });
  const duration = Date.now() - startTime;

  vtResponseTime.add(duration);

  const success = check(res, {
    'VT status is 201': (r) => r.status === 201,
    'VT has user id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    vtRequestsSuccess.add(1);
    vtSuccessRate.add(1);
  } else {
    vtRequestsFailed.add(1);
    vtSuccessRate.add(0);
    // Only log every 100th failure to avoid console spam
    if (__ITER % 100 === 0) {
      console.error(`VT Request failed: Status ${res.status}, VU ${__VU}, Iter ${__ITER}`);
    }
  }
}

// Test WebFlux
function testWebFlux() {
  wfRequestsTotal.add(1);

  const userData = generateUserData('wf_burst');
  const payload = JSON.stringify(userData);

  const startTime = Date.now();
  const res = http.post(`${WEBFLUX_URL}/api/users`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { app: 'webflux' },
  });
  const duration = Date.now() - startTime;

  wfResponseTime.add(duration);

  const success = check(res, {
    'WF status is 201': (r) => r.status === 201,
    'WF has user id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (success) {
    wfRequestsSuccess.add(1);
    wfSuccessRate.add(1);
  } else {
    wfRequestsFailed.add(1);
    wfSuccessRate.add(0);
    // Only log every 100th failure to avoid console spam
    if (__ITER % 100 === 0) {
      console.error(`WF Request failed: Status ${res.status}, VU ${__VU}, Iter ${__ITER}`);
    }
  }
}

export default function () {
  // Test both applications in each iteration
  testVirtualThreads();
  testWebFlux();
}

// Setup phase
export function setup() {
  console.log('='.repeat(70));
  console.log('PARALLEL THROUGHPUT BURST TEST');
  console.log('='.repeat(70));
  console.log(`Virtual Threads: ${VIRTUAL_THREADS_URL}`);
  console.log(`WebFlux: ${WEBFLUX_URL}`);
  console.log('');
  console.log('Test config:');
  console.log('  - Total iterations: 40,000');
  console.log('  - Requests per iteration: 2 (one to each server)');
  console.log('  - Total requests: 80,000 (40k to each server)');
  console.log('  - Virtual users: 2,000');
  console.log('  - Max duration: 5 minutes');
  console.log('='.repeat(70));

  // Verify both servers are responsive
  console.log('Verifying servers are healthy...');

  const vtHealthCheck = http.get(`${VIRTUAL_THREADS_URL}/api/users?page=0&size=1`);
  if (vtHealthCheck.status !== 200) {
    throw new Error(`Virtual Threads server not responding: ${vtHealthCheck.status}`);
  }
  console.log('✓ Virtual Threads server is healthy');

  const wfHealthCheck = http.get(`${WEBFLUX_URL}/api/users?page=0&size=1`);
  if (wfHealthCheck.status !== 200) {
    throw new Error(`WebFlux server not responding: ${wfHealthCheck.status}`);
  }
  console.log('✓ WebFlux server is healthy');

  console.log('');
  console.log('Starting parallel burst test...');
  console.log('');

  return {
    startTime: Date.now(),
  };
}

// Teardown phase with detailed summary
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('');
  console.log('='.repeat(70));
  console.log('PARALLEL THROUGHPUT TEST COMPLETED');
  console.log('='.repeat(70));
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log('');
  console.log('Both applications were tested simultaneously with identical load.');
  console.log('Check the summary above for detailed metrics including:');
  console.log('');
  console.log('Per-Application Metrics:');
  console.log('  - vt_* metrics: Virtual Threads performance');
  console.log('  - wf_* metrics: WebFlux performance');
  console.log('');
  console.log('Key Metrics to Compare:');
  console.log('  - Success rate (vt_success_rate vs wf_success_rate)');
  console.log('  - Response time (vt_response_time vs wf_response_time)');
  console.log('  - Failed requests count');
  console.log('  - Response time percentiles (p50, p95, p99)');
  console.log('  - Requests per second');
  console.log('='.repeat(70));
}

// Generate HTML report
export function handleSummary(data) {
  return {
    'throughput-parallel-report.html': htmlReport(data),
  };
}
