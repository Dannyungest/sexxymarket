import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 20 },
    { duration: "4m", target: 150 },
    { duration: "4m", target: 250 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1200", "p(99)<3000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "https://api.sexxymarket.com/api";
const WEBHOOK_SIGNATURE = __ENV.FLW_SIGNATURE || "";
const TX_REF_PREFIX = __ENV.TX_REF_PREFIX || "loadtest_tx_ref_";

export default function () {
  const payload = JSON.stringify({
    type: "charge.completed",
    data: {
      tx_ref: `${TX_REF_PREFIX}${__VU}_${__ITER}`,
      reference: `${TX_REF_PREFIX}${__VU}_${__ITER}`,
      status: "succeeded",
      amount: Number(__ENV.AMOUNT_NGN || "1000"),
      currency: "NGN",
    },
  });

  const response = http.post(`${BASE_URL}/payments/webhooks/flutterwave`, payload, {
    headers: {
      "Content-Type": "application/json",
      "flutterwave-signature": WEBHOOK_SIGNATURE,
      "verif-hash": WEBHOOK_SIGNATURE,
    },
  });

  check(response, {
    "webhook status 200": (r) => r.status === 200,
  });
  sleep(0.1);
}
