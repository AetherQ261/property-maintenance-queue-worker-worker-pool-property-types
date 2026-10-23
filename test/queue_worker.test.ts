import test from "node:test";
import assert from "node:assert/strict";
import { decideWork, maintenanceRequest } from "../src/queue_worker.ts";
test("high urgency leak is dispatched immediately", () => { const input = maintenanceRequest.parse({ request_id: "maint-17", property_id: "building-4", tenant_document: "lease-17", issue: "leak", urgency: "high" }); assert.equal(decideWork(input), "dispatch-now"); });
