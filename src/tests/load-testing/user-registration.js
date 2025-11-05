import http from 'k6/http';
import { check } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const API_BASE_URL = __ENV.API_BASE_URL || 'https://jpeg.gateway';

export const options = {
  vus: 10,
  duration: '10s',
  thresholds: {
    'http_req_duration{name:Register}': ['p(95)<500'],
    'http_req_failed{name:Register}': ['rate<0.01'],
  },
};

export default function () {
  const username = `user_${randomString(10)}`;
  const email = `${randomString(10)}@example.com`;
  const passwordhash = 'aVeryStrongPassword123!';

  const payload = JSON.stringify({
    username: username,
    email: email,
    passwordhash: passwordhash,
  });

  const res = http.post(`${API_BASE_URL}/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'Register' },
  });

  check(res, {
    'Register: status is 201': (r) => r.status === 201,
  });
}