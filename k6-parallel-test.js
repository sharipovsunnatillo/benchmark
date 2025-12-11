import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * K6 Parallel Load Test Script - Tests Both Applications Simultaneously
 *
 * Usage:
 *   k6 run k6-parallel-test.js
 *
 * This script tests both Virtual Threads (port 8083) and WebFlux (port 8084)
 * applications in parallel, allowing real-time side-by-side comparison in Grafana.
 */

// Custom metrics for Virtual Threads
const vtCreateErrors = new Counter('vt_create_user_errors');
const vtGetErrors = new Counter('vt_get_users_errors');
const vtCreateSuccess = new Rate('vt_create_user_success');
const vtGetSuccess = new Rate('vt_get_users_success');
const vtCreateDuration = new Trend('vt_create_user_duration');
const vtGetDuration = new Trend('vt_get_users_duration');

// Custom metrics for WebFlux
const wfCreateErrors = new Counter('wf_create_user_errors');
const wfGetErrors = new Counter('wf_get_users_errors');
const wfCreateSuccess = new Rate('wf_create_user_success');
const wfGetSuccess = new Rate('wf_get_users_success');
const wfCreateDuration = new Trend('wf_create_user_duration');
const wfGetDuration = new Trend('wf_get_users_duration');

// Test configuration - gradually increase load until server crashes
export const options = {
  stages: [
    // Warm-up
    { duration: '1m', target: 50 },       // Ramp up to 50 users

    // Gradual increase
    { duration: '2m', target: 100 },      // Ramp to 100 users
    { duration: '2m', target: 100 },      // Stay at 100 users

    { duration: '2m', target: 200 },      // Ramp to 200 users
    { duration: '2m', target: 200 },      // Stay at 200 users

    { duration: '2m', target: 500 },      // Ramp to 500 users
    { duration: '3m', target: 500 },      // Stay at 500 users

    { duration: '2m', target: 1000 },     // Ramp to 1000 users
    { duration: '3m', target: 1000 },     // Stay at 1000 users

    { duration: '2m', target: 2000 },     // Ramp to 2000 users
    { duration: '5m', target: 2000 },     // Stay at 2000 users

    { duration: '2m', target: 3000 },     // Ramp to 3000 users
    { duration: '5m', target: 3000 },     // Stay at 3000 users

    { duration: '2m', target: 5000 },     // Ramp to 5000 users
    { duration: '5m', target: 5000 },     // Stay at 5000 users

    { duration: '2m', target: 10000 },    // Ramp to 10000 users
    { duration: '5m', target: 10000 },    // Stay at 10000 users

    // Cool down
    { duration: '1m', target: 0 },        // Ramp down to 0 users
  ],

  thresholds: {
    http_req_duration: ['p(95)<1000'],    // 95% of requests should be below 1000ms
    http_req_failed: ['rate<0.10'],       // Less than 10% of requests should fail
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
  const random = Math.floor(Math.random() * 100000);

  return {
    username: `${prefix}_${timestamp}_${vu}_${iter}_${random}`,
    email: `${prefix}_${timestamp}_${vu}_${iter}_${random}@example.com`,
    firstName: `First_${vu}`,
    lastName: `Last_${iter}`,
  };
}

// Test Virtual Threads application
function testVirtualThreads() {
  const userData = generateUserData('vt_user');
  const createPayload = JSON.stringify(userData);

  // Test 1: Create User
  const createStart = Date.now();
  const createRes = http.post(`${VIRTUAL_THREADS_URL}/api/users`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { app: 'virtual-threads' },
  });
  const createDuration = Date.now() - createStart;

  vtCreateDuration.add(createDuration);

  const createSuccess = check(createRes, {
    'VT create status is 201': (r) => r.status === 201,
    'VT create has user id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (createSuccess) {
    vtCreateSuccess.add(1);
  } else {
    vtCreateSuccess.add(0);
    vtCreateErrors.add(1);
  }

  sleep(0.1);

  // Test 2: Get Users (Pagination)
  const page = Math.floor(Math.random() * 10);
  const size = 20;

  const getStart = Date.now();
  const getRes = http.get(`${VIRTUAL_THREADS_URL}/api/users?page=${page}&size=${size}`, {
    timeout: '30s',
    tags: { app: 'virtual-threads' },
  });
  const getDuration = Date.now() - getStart;

  vtGetDuration.add(getDuration);

  const getSuccess = check(getRes, {
    'VT get status is 200': (r) => r.status === 200,
    'VT get has content': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.content !== undefined && Array.isArray(json.content);
      } catch (e) {
        return false;
      }
    },
  });

  if (getSuccess) {
    vtGetSuccess.add(1);
  } else {
    vtGetSuccess.add(0);
    vtGetErrors.add(1);
  }
}

// Test WebFlux application
function testWebFlux() {
  const userData = generateUserData('wf_user');
  const createPayload = JSON.stringify(userData);

  // Test 1: Create User
  const createStart = Date.now();
  const createRes = http.post(`${WEBFLUX_URL}/api/users`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
    tags: { app: 'webflux' },
  });
  const createDuration = Date.now() - createStart;

  wfCreateDuration.add(createDuration);

  const createSuccess = check(createRes, {
    'WF create status is 201': (r) => r.status === 201,
    'WF create has user id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (createSuccess) {
    wfCreateSuccess.add(1);
  } else {
    wfCreateSuccess.add(0);
    wfCreateErrors.add(1);
  }

  sleep(0.1);

  // Test 2: Get Users (Pagination)
  const page = Math.floor(Math.random() * 10);
  const size = 20;

  const getStart = Date.now();
  const getRes = http.get(`${WEBFLUX_URL}/api/users?page=${page}&size=${size}`, {
    timeout: '30s',
    tags: { app: 'webflux' },
  });
  const getDuration = Date.now() - getStart;

  wfGetDuration.add(getDuration);

  const getSuccess = check(getRes, {
    'WF get status is 200': (r) => r.status === 200,
    'WF get has content': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.content !== undefined && Array.isArray(json.content);
      } catch (e) {
        return false;
      }
    },
  });

  if (getSuccess) {
    wfGetSuccess.add(1);
  } else {
    wfGetSuccess.add(0);
    wfGetErrors.add(1);
  }
}

export default function () {
  // Test both applications in parallel
  testVirtualThreads();
  testWebFlux();

  // Variable sleep to simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5);
}

// Handle test lifecycle
export function setup() {
  console.log('Starting parallel load test');
  console.log('Virtual Threads endpoints:');
  console.log(`  - POST ${VIRTUAL_THREADS_URL}/api/users`);
  console.log(`  - GET ${VIRTUAL_THREADS_URL}/api/users`);
  console.log('WebFlux endpoints:');
  console.log(`  - POST ${WEBFLUX_URL}/api/users`);
  console.log(`  - GET ${WEBFLUX_URL}/api/users`);

  // Verify both servers are responsive
  const vtHealthCheck = http.get(`${VIRTUAL_THREADS_URL}/api/users?page=0&size=1`);
  if (vtHealthCheck.status !== 200) {
    throw new Error(`Virtual Threads server not responding: ${vtHealthCheck.status}`);
  }

  const wfHealthCheck = http.get(`${WEBFLUX_URL}/api/users?page=0&size=1`);
  if (wfHealthCheck.status !== 200) {
    throw new Error(`WebFlux server not responding: ${wfHealthCheck.status}`);
  }

  console.log('Both servers are healthy, starting parallel load test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Parallel load test completed in ${duration.toFixed(2)} minutes`);
}
