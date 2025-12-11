import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/**
 * K6 Load Test Script for Virtual Threads vs WebFlux Benchmark
 *
 * Usage:
 *   Basic: k6 run --env BASE_URL=http://localhost:8083 k6-load-test.js
 *
 *   With Prometheus Remote Write (requires k6 >= v0.44.0):
 *   K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
 *     k6 run --env BASE_URL=http://localhost:8083 -o experimental-prometheus-rw k6-load-test.js
 *
 *   With JSON output:
 *   k6 run --env BASE_URL=http://localhost:8083 --out json=results.json k6-load-test.js
 */

// Custom metrics
const createUserErrors = new Counter('create_user_errors');
const getUsersErrors = new Counter('get_users_errors');
const createUserSuccess = new Rate('create_user_success');
const getUsersSuccess = new Rate('get_users_success');
const createUserDuration = new Trend('create_user_duration');
const getUsersDuration = new Trend('get_users_duration');

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
    http_req_duration: ['p(95)<500'],     // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.05'],       // Less than 5% of requests should fail
    create_user_success: ['rate>0.95'],   // More than 95% should succeed
    get_users_success: ['rate>0.95'],     // More than 95% should succeed
  },
};

// Base URL from environment variable or default
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8083';

// Generate unique user data
function generateUserData() {
  const timestamp = Date.now();
  const vu = __VU;
  const iter = __ITER;
  const random = Math.floor(Math.random() * 100000);

  return {
    username: `user_${timestamp}_${vu}_${iter}_${random}`,
    email: `user_${timestamp}_${vu}_${iter}_${random}@example.com`,
    firstName: `First_${vu}`,
    lastName: `Last_${iter}`,
  };
}

export default function () {
  // Test 1: Create User
  const userData = generateUserData();
  const createPayload = JSON.stringify(userData);

  const createStart = Date.now();
  const createRes = http.post(`${BASE_URL}/api/users`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '30s',
  });
  const createDuration = Date.now() - createStart;

  createUserDuration.add(createDuration);

  const createSuccess = check(createRes, {
    'create status is 201': (r) => r.status === 201,
    'create has user id': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.id !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (createSuccess) {
    createUserSuccess.add(1);
  } else {
    createUserSuccess.add(0);
    createUserErrors.add(1);
    console.error(`Create user failed: ${createRes.status} - ${createRes.body}`);
  }

  // Small delay between operations
  sleep(0.1);

  // Test 2: Get Users (Pagination)
  const page = Math.floor(Math.random() * 10);
  const size = 20;

  const getStart = Date.now();
  const getRes = http.get(`${BASE_URL}/api/users?page=${page}&size=${size}`, {
    timeout: '30s',
  });
  const getDuration = Date.now() - getStart;

  getUsersDuration.add(getDuration);

  const getSuccess = check(getRes, {
    'get status is 200': (r) => r.status === 200,
    'get has content': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.content !== undefined && Array.isArray(json.content);
      } catch (e) {
        return false;
      }
    },
    'get has pagination info': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.page !== undefined &&
               json.size !== undefined &&
               json.totalElements !== undefined &&
               json.totalPages !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  if (getSuccess) {
    getUsersSuccess.add(1);
  } else {
    getUsersSuccess.add(0);
    getUsersErrors.add(1);
    console.error(`Get users failed: ${getRes.status} - ${getRes.body}`);
  }

  // Variable sleep to simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5);
}

// Handle test lifecycle
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log('Testing endpoints:');
  console.log(`  - POST ${BASE_URL}/api/users`);
  console.log(`  - GET ${BASE_URL}/api/users`);

  // Verify server is responsive
  const healthCheck = http.get(`${BASE_URL}/api/users?page=0&size=1`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not responding: ${healthCheck.status}`);
  }

  console.log('Server is healthy, starting load test...');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Load test completed in ${duration.toFixed(2)} minutes`);
}
