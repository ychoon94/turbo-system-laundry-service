import { httpRouter } from "convex/server";
import { handleStripeWebhook } from "./payments";

const http = httpRouter();

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: handleStripeWebhook,
});

export default http;
