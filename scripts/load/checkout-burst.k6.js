import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    checkoutBurst: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { target: 20, duration: "2m" },
        { target: 60, duration: "4m" },
        { target: 120, duration: "4m" },
        { target: 0, duration: "2m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.03"],
    http_req_duration: ["p(95)<1200", "p(99)<2500"],
  },
};

const BASE_URL = __ENV.BASE_URL || "https://api.sexxymarket.com/api";
const PRODUCT_ID = __ENV.TEST_PRODUCT_ID || "";

export default function () {
  if (!PRODUCT_ID) return;

  const payload = JSON.stringify({
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    shippingAddress: "Load Test Address",
    shippingState: "Lagos",
    shippingCity: "Ikeja",
    recipientName: "Load Test User",
    recipientPhone: "08000000000",
    guestEmail: `loadtest+${__VU}-${__ITER}@example.com`,
  });

  const response = http.post(`${BASE_URL}/orders`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  check(response, {
    "checkout status 201/200": (r) => r.status === 201 || r.status === 200,
  });
  sleep(0.2);
}
