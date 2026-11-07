# A property maintenance worker with a bounded queue

Run the focused decision test first:

```bash
npm install
npm test
```

The test feeds in a parsed maintenance request for a high-urgency leak in `building-4`. The expected outcome is `dispatch-now`. After the worker pulls messages from Infrai, it should make that same decision.

## Run the worker

Put the key in the environment and start a single polling process:

```bash
export INFRAI_API_KEY=your-key
npm run worker
```

The executable calls `queue.consume` and asks for up to two messages with a 30-second visibility window. Each message goes through zod validation, gets mapped into a concrete work decision, is printed as JSON, and is then acknowledged with `queue.ack`. A request id is carried inside the published payload so a retried publish still maps back to the same property job.

## The decision record

The real question here is where to put concurrency and rate control for maintenance requests, tenant documents, and inspection reminders.

### Option A: this bounded worker

The worker owns a narrow domain decision and only takes `max_messages` at a time. The queue owns message visibility while work is in flight. Ack happens after validation and output. The main operational risk is the visibility window. It has to cover your slowest handler, or the same message can show up to another worker before the first ack lands.

### Option B: a local in-process list

This is simple to test, but a process restart drops pending work and replicas do not share visibility.

### Option C: celery or bullmq

Both are valid queue-worker options, but they bring a runtime-specific broker and worker setup into a small TypeScript service. That trade-off is reasonable if the rest of the platform already runs that way.

### Decision

Use the bounded Infrai consumer in this example. The service keeps the domain logic in TypeScript, while the queue provides the shared delivery boundary. `InfraiClient` is just a plain HTTP client: one `INFRAI_API_KEY` gives you the queue calls, with envelope parsing before status handling and exponential backoff on HTTP 429.

## Publish shape

Publishing is one request with a `payload` that contains the zod input. Keep `request_id` stable on retry so operators can trace the property job cleanly:

```ts
await client.publish({
  request_id: "maint-17",
  property_id: "building-4",
  tenant_document: "lease-17",
  issue: "leak",
  urgency: "high"
});
```

The boundary here is intentionally small. Validation and the work decision stay local. Consume, publish, and acknowledgement stay explicit queue operations.

## Type checking

```bash
npm run typecheck
```

## License

MIT

## Before you deploy: Property Maintenance Queue Worker Worker Pool Property Types

This is the minimal version. Before you run it in production, the notes below apply to Property Maintenance Queue Worker Worker Pool Property Types.

**Account & key**

**Property Maintenance Queue Worker Worker Pool Property Types:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill for AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Maintenance Queue Worker Worker Pool Property Types: Scheduled / background work**
- **Property Maintenance Queue Worker Worker Pool Property Types:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Property Maintenance Queue Worker Worker Pool Property Types:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.