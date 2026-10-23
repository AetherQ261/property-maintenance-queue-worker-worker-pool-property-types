import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";
export const maintenanceRequest = z.object({ request_id: z.string().min(1), property_id: z.string().min(1), tenant_document: z.string().min(1), issue: z.enum(["leak", "heating", "inspection"]), urgency: z.enum(["routine", "high"]) });
export type MaintenanceRequest = z.infer<typeof maintenanceRequest>;
export type WorkDecision = "dispatch-now" | "schedule-inspection" | "queue-routine";
export function decideWork(request: MaintenanceRequest): WorkDecision { if (request.issue === "leak" && request.urgency === "high") return "dispatch-now"; if (request.issue === "inspection") return "schedule-inspection"; return "queue-routine"; }
export async function runWorker(client: InfraiClient, queue: string, limit = 2): Promise<void> { const result = await client.consume(queue, limit, 30) as { messages?: Array<{ message_id: string; payload: unknown }> }; for (const message of result.messages ?? []) { const request = maintenanceRequest.parse(message.payload); const decision = decideWork(request); console.log(JSON.stringify({ request_id: request.request_id, decision })); await client.ack(queue, message.message_id); } }
if (process.argv[1]?.endsWith("queue_worker.ts")) { const queue = process.env.INFRAI_QUEUE; if (!queue) { console.error("INFRAI_QUEUE is required"); process.exitCode = 1; } else runWorker(new InfraiClient(), queue).catch((error: unknown) => { console.error(error); process.exitCode = 1; }); }
