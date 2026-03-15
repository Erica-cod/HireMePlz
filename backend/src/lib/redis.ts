import { env } from "../config/env.js";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined
  };
}

export const redisConnectionOptions = parseRedisUrl(env.REDIS_URL);
