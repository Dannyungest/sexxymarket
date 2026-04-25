import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "4m", target: 250 },
    { duration: "4m", target: 500 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<900", "p(99)<2000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "https://api.sexxymarket.com";

export default function () {
  const products = http.get(`${BASE_URL}/catalog/products/feed?limit=40`);
  check(products, {
    "catalog feed status 200": (r) => r.status === 200,
  });

  const categories = http.get(`${BASE_URL}/catalog/categories`);
  check(categories, {
    "categories status 200": (r) => r.status === 200,
  });

  sleep(0.3);
}
