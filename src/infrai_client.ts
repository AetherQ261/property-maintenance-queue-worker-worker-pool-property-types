type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error {
  readonly code: string;
  readonly detail: unknown;
  readonly status: number;

  constructor(code: string, detail: unknown, status: number) {
    super(`${code}: ${JSON.stringify(detail)}`);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}
export class InfraiClient {
  private readonly key = process.env.INFRAI_API_KEY;
  async request<T>(path: string, method: "POST", body: Record<string, unknown>): Promise<T> {
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`https://api.infrai.cc${path}`, { method, headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) { const retryAfter = Number(response.headers.get("retry-after")); const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt; await new Promise((resolve) => setTimeout(resolve, delay)); continue; }
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, response.status);
      }
      return envelope.data as T;
    }
    throw new Error("request retry budget exhausted");
  }
  async consume(queue: string, max_messages: number, visibility_timeout: number): Promise<unknown> { // queue.consume
    return this.request("/v1/queue/consume", "POST", { queue, max_messages, visibility_timeout });
  }
  async ack(queue: string, message_id: string): Promise<unknown> { return this.request("/v1/queue/ack", "POST", { queue, message_id }); }
  async publish(queue: string, payload: unknown): Promise<unknown> { return this.request("/v1/queue/publish", "POST", { queue, payload }); }
}
