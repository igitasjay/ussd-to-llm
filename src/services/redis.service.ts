import { createClient, type RedisClientType } from "redis";
import dotenv from "dotenv";

dotenv.config();

const rawRedisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redisUrl = rawRedisUrl.startsWith("redis://") ? rawRedisUrl : `redis://${rawRedisUrl}`;

const redisClient: RedisClientType = createClient({
  url: redisUrl,
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USER,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  try {
    await redisClient.connect();
    // Verify authentication with a PING
    await redisClient.ping();
    console.log("✅ Successfully connected and authenticated to Redis Cloud");
  } catch (err: any) {
    if (err.message.includes("NOAUTH") || err.message.includes("WRONGPASS")) {
      console.error("❌ Redis Authentication Failed: Please check REDIS_PASSWORD in .env");
    } else {
      console.error("❌ Failed to connect to Redis Cloud");
      console.error("Redis Init Error:", err.message || err);
    }
    // In production, we might want to exit if Redis is critical
    // process.exit(1);
  }
})();

export interface SessionState {
  fullResponse: string;
  currentChunkIndex: number;
  status: "processing" | "ready" | "failed";
  lastQuery: string;
  createdAt: number;
}

const SESSION_TTL = 900; // 15 minutes
const RATE_LIMIT_TTL = 3600; // 1 hour
const MAX_QUERIES_PER_HOUR = 5; // Configurable rate limit

export const getSession = async (
  sessionId: string,
): Promise<SessionState | null> => {
  const data = await redisClient.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
};

export const saveSession = async (
  sessionId: string,
  state: SessionState,
): Promise<void> => {
  await redisClient.set(`session:${sessionId}`, JSON.stringify(state), {
    EX: SESSION_TTL,
  });
};

/**
 * Increments query count for rate limiting.
 * Returns true if the user is within the limit, false if they have exceeded it.
 */
export const checkRateLimit = async (phoneNumber: string): Promise<boolean> => {
  const key = `ratelimit:${phoneNumber}`;
  const count = await redisClient.incr(key);

  if (count === 1) {
    await redisClient.expire(key, RATE_LIMIT_TTL);
  }

  return count <= MAX_QUERIES_PER_HOUR;
};

export const updateChunkIndex = async (
  sessionId: string,
  newIndex: number,
): Promise<void> => {
  const session = await getSession(sessionId);
  if (session) {
    session.currentChunkIndex = newIndex;
    await saveSession(sessionId, session);
  }
};

export default redisClient;
