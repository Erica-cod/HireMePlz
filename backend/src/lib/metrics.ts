import client from "prom-client";
import { llmQueue } from "./llm-queue.js";
import { scrapeTriggerQueue } from "./scrape-trigger.js";

// 采集默认的 Node.js 运行时指标（GC、事件循环、内存等）
client.collectDefaultMetrics({ prefix: "hiremeplz_" });

export const httpRequestDuration = new client.Histogram({
  name: "hiremeplz_http_request_duration_seconds",
  help: "HTTP 请求延迟（秒）",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});

export const httpRequestsTotal = new client.Counter({
  name: "hiremeplz_http_requests_total",
  help: "HTTP 请求总数",
  labelNames: ["method", "route", "status_code"] as const
});

export const httpRequestsInFlight = new client.Gauge({
  name: "hiremeplz_http_requests_in_flight",
  help: "当前正在处理的 HTTP 请求数"
});

export const httpRequestSizeBytes = new client.Histogram({
  name: "hiremeplz_http_request_size_bytes",
  help: "HTTP 请求体大小（字节）",
  labelNames: ["method", "route"] as const,
  buckets: [100, 1_000, 10_000, 100_000, 1_000_000]
});

export const httpResponseSizeBytes = new client.Histogram({
  name: "hiremeplz_http_response_size_bytes",
  help: "HTTP 响应体大小（字节）",
  labelNames: ["method", "route"] as const,
  buckets: [100, 1_000, 10_000, 100_000, 1_000_000]
});

// BullMQ 队列指标
const queueWaiting = new client.Gauge({
  name: "hiremeplz_queue_waiting",
  help: "队列中等待处理的任务数",
  labelNames: ["queue"] as const
});

const queueActive = new client.Gauge({
  name: "hiremeplz_queue_active",
  help: "队列中正在处理的任务数",
  labelNames: ["queue"] as const
});

const queueCompleted = new client.Gauge({
  name: "hiremeplz_queue_completed",
  help: "队列中已完成的任务数",
  labelNames: ["queue"] as const
});

const queueFailed = new client.Gauge({
  name: "hiremeplz_queue_failed",
  help: "队列中失败的任务数",
  labelNames: ["queue"] as const
});

const queueDelayed = new client.Gauge({
  name: "hiremeplz_queue_delayed",
  help: "队列中延迟执行的任务数",
  labelNames: ["queue"] as const
});

async function collectQueueMetrics(queue: { name: string; getJobCounts: () => Promise<Record<string, number>> }) {
  try {
    const counts = await queue.getJobCounts();
    queueWaiting.set({ queue: queue.name }, counts.waiting ?? 0);
    queueActive.set({ queue: queue.name }, counts.active ?? 0);
    queueCompleted.set({ queue: queue.name }, counts.completed ?? 0);
    queueFailed.set({ queue: queue.name }, counts.failed ?? 0);
    queueDelayed.set({ queue: queue.name }, counts.delayed ?? 0);
  } catch {
    // 队列不可用时静默忽略
  }
}

/**
 * 定期采集 BullMQ 队列指标（每 15 秒）
 */
export function startQueueMetricsCollector() {
  const collect = () => {
    void collectQueueMetrics(llmQueue);
    void collectQueueMetrics(scrapeTriggerQueue);
  };
  collect();
  setInterval(collect, 15_000);
}

export const register = client.register;
