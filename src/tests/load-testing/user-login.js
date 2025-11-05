import http from 'k6/http';
import { check, group } from 'k6';
import { SharedArray } from 'k6/data';

const API_BASE_URL = __ENV.API_BASE_URL || 'https://jpeg.gateway';

// Load the user data file
const users = new SharedArray('users', function () {
  return JSON.parse([
  { "email": "user1@example.com", "password": "password123" },
  { "email": "user2@example.com", "password": "password123" },
  { "email": "user3@example.com", "password": "password123" }
]);
});

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    'http_req_duration{group:::Login}': ['p(95)<500'],
    'http_req_duration{group:::Get Profile}': ['p(95)<300'],
  },
};

export default function () {
  // Each VU picks a random user from the array
  const user = users[Math.floor(Math.random() * users.length)];

  group('Login', function () {
    const loginPayload = JSON.stringify({
      email: user.email,
      password: user.password
    });
    
    const loginRes = http.post(`${API_BASE_URL}/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(loginRes, { 'status is 200': (r) => r.status === 200 });

    if (loginRes.status === 200) {
      const token = loginRes.json('token');
      
      group('Get Profile', function () {
        const profileRes = http.get(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(profileRes, { 'status is 200': (r) => r.status === 200 });
      });
    }
  });
}