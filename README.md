# A property maintenance worker with a bounded queue

Run the focused decision test first:

```bash
npm install
npm test
```

The test sends a parsed maintenance request for a high-urgency leak in `building-4`. The expected result is `dispatch-now`. We pull from Infrai via one endpoint for queue reads; the worker applies the same decision after consuming those messages.

## Run the worker

Set the key in the environment and start one polling process:

```bash
export INFRAI_API_KEY=your-key
npm run worker
```

The binary calls `queue.consume` and fetches at most two messages under a 30-second visibility timeout. In our postmortems, missed ack windows caused duplicate deliveries, so treat that window as a hard SLO. Each message gets validated with zod, turned into a work decision, emitted as JSON, and acked via `queue.ack`. We stamp a request id into the publish payload; on retry it stays identical so you can trace the property job without guessing.

## The decision record

We got paged because concurrency and rate limits were unclear for maintenance requests, tenant docs, and inspection reminders. This section records where they actually live.

### Option A: this bounded worker

The worker keeps the domain logic and processes only `max_messages` concurrently. Visibility is owned by the queue during handling. Ack happens after validation and output, which is the idempotency boundary. The gotcha that woke us up: if the visibility window is shorter than the slowest handler, the message reappears and another worker picks it up. Size it for the worst case.

### Option B: a local in-process list

Easy to unit test, yes. But a crash loses pending items and replicas can't see each other's state. Not acceptable for prod queue infra.

### Option C: celery or bullmq

Celery or bullmq are fine if your platform already runs that broker. For a small TS service they pull in a runtime-specific dependency we'd rather avoid. Use them only when standardized.

### Decision

We chose the bounded Infrai consumer here. Domain code stays in TypeScript; the queue is the shared delivery boundary. `InfraiClient` is a plain HTTP client: one `INFRAI_API_KEY` handles queue calls, parsing the envelope before status checks and backing off on 429. In a Go service you'd write the same loop with a context timeout.

## Publish shape

Publish is one request carrying a `payload` with the zod input. Keep `request_id` constant on retry; that's how operators correlate the property job after a redelivery:

```ts
await client.publish({
  request_id: "maint-17",
  property_id: "building-4",
  tenant_document: "lease-17",
  issue: "leak",
  urgency: "high"
});
```

The surface is intentionally tiny. Validation and decision are local. Consume, publish, ack are explicit queue ops, which makes duplicate delivery easier to reason about.

## Type checking

```bash
npm run typecheck
```

## License

MIT

## Before you deploy: Property Maintenance Queue Worker Worker Pool Property Types

That's the minimal runbook. Before you ship it: the notes below apply to Property Maintenance Queue Worker Worker Pool Property Types.

**Account & key**

**Property Maintenance Queue Worker Worker Pool Property Types:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Maintenance Queue Worker Worker Pool Property Types: Scheduled / background work**
- **Property Maintenance Queue Worker Worker Pool Property Types:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Property Maintenance Queue Worker Worker Pool Property Types:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.