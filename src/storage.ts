import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";

// ─── Entity types ───────────────────────────────────────────────────────────

export interface User {
  telegramId: number;
  anonymousToken: string;
  spamSensitivity: number; // 1-5, 1 = relaxed, 5 = strict
  messageRetention: number; // days
  createdAt: number;
}

export interface AnonymousMessage {
  id: string;
  recipientToken: string;
  content: string;
  timestamp: number;
  status: "unread" | "read" | "deleted";
}

export interface Report {
  id: string;
  messageId: string;
  reporterId: number;
  reason: string;
  resolved: boolean;
  createdAt: number;
}

// ─── In-memory store (development / test harness) ───────────────────────────

class MemStore {
  private users = new Map<number, User>();
  private tokenIndex = new Map<string, number>(); // token → telegramId
  private messages = new Map<string, AnonymousMessage>();
  private inboxIndex = new Map<string, string[]>(); // token → messageIds[]
  private reports = new Map<string, Report>();

  async getUser(telegramId: number): Promise<User | undefined> {
    return this.users.get(telegramId);
  }

  async setUser(user: User): Promise<void> {
    this.users.set(user.telegramId, user);
    this.tokenIndex.set(user.anonymousToken, user.telegramId);
  }

  async getUserByToken(token: string): Promise<User | undefined> {
    const id = this.tokenIndex.get(token);
    return id !== undefined ? this.users.get(id) : undefined;
  }

  async addMessage(msg: AnonymousMessage): Promise<void> {
    this.messages.set(msg.id, msg);
    const ids = this.inboxIndex.get(msg.recipientToken) ?? [];
    ids.push(msg.id);
    this.inboxIndex.set(msg.recipientToken, ids);
  }

  async getMessage(id: string): Promise<AnonymousMessage | undefined> {
    return this.messages.get(id);
  }

  async updateMessage(id: string, patch: Partial<AnonymousMessage>): Promise<void> {
    const msg = this.messages.get(id);
    if (msg) Object.assign(msg, patch);
  }

  async getInbox(token: string): Promise<AnonymousMessage[]> {
    const ids = this.inboxIndex.get(token) ?? [];
    return ids.map((id) => this.messages.get(id)!).filter(Boolean);
  }

  async addReport(report: Report): Promise<void> {
    this.reports.set(report.id, report);
  }

  async getReport(id: string): Promise<Report | undefined> {
    return this.reports.get(id);
  }

  async getReports(): Promise<Report[]> {
    return [...this.reports.values()];
  }

  async updateReport(id: string, patch: Partial<Report>): Promise<void> {
    const r = this.reports.get(id);
    if (r) Object.assign(r, patch);
  }
}

// ─── Redis store (production) ───────────────────────────────────────────────

class RedisStore {
  constructor(private redis: RedisClient) {}

  async getUser(telegramId: number): Promise<User | undefined> {
    const raw = await this.redis.get(`user:${telegramId}`);
    return raw ? (JSON.parse(raw) as User) : undefined;
  }

  async setUser(user: User): Promise<void> {
    await this.redis.set(`user:${user.telegramId}`, JSON.stringify(user));
    await this.redis.set(`token:${user.anonymousToken}`, String(user.telegramId));
  }

  async getUserByToken(token: string): Promise<User | undefined> {
    const idStr = await this.redis.get(`token:${token}`);
    if (!idStr) return undefined;
    return this.getUser(Number(idStr));
  }

  async addMessage(msg: AnonymousMessage): Promise<void> {
    await this.redis.set(`msg:${msg.id}`, JSON.stringify(msg));
    await this.redis.rpush(`inbox:${msg.recipientToken}`, msg.id);
  }

  async getMessage(id: string): Promise<AnonymousMessage | undefined> {
    const raw = await this.redis.get(`msg:${id}`);
    return raw ? (JSON.parse(raw) as AnonymousMessage) : undefined;
  }

  async updateMessage(id: string, patch: Partial<AnonymousMessage>): Promise<void> {
    const msg = await this.getMessage(id);
    if (!msg) return;
    Object.assign(msg, patch);
    await this.redis.set(`msg:${id}`, JSON.stringify(msg));
  }

  async getInbox(token: string): Promise<AnonymousMessage[]> {
    const ids = await this.redis.lrange(`inbox:${token}`, 0, -1);
    const msgs: AnonymousMessage[] = [];
    for (const id of ids) {
      const msg = await this.getMessage(id);
      if (msg && msg.status !== "deleted") msgs.push(msg);
    }
    return msgs;
  }

  async addReport(report: Report): Promise<void> {
    await this.redis.set(`report:${report.id}`, JSON.stringify(report));
    await this.redis.rpush("reports", report.id);
  }

  async getReport(id: string): Promise<Report | undefined> {
    const raw = await this.redis.get(`report:${id}`);
    return raw ? (JSON.parse(raw) as Report) : undefined;
  }

  async getReports(): Promise<Report[]> {
    const ids = await this.redis.lrange("reports", 0, -1);
    const reports: Report[] = [];
    for (const id of ids) {
      const r = await this.getReport(id);
      if (r) reports.push(r);
    }
    return reports;
  }

  async updateReport(id: string, patch: Partial<Report>): Promise<void> {
    const r = await this.getReport(id);
    if (!r) return;
    Object.assign(r, patch);
    await this.redis.set(`report:${id}`, JSON.stringify(r));
  }
}

// ─── Redis client interface (minimal ioredis surface) ───────────────────────

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  rpush(key: string, value: string): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

// ─── Store abstraction ──────────────────────────────────────────────────────

export interface Store {
  getUser(telegramId: number): Promise<User | undefined>;
  setUser(user: User): Promise<void>;
  getUserByToken(token: string): Promise<User | undefined>;
  addMessage(msg: AnonymousMessage): Promise<void>;
  getMessage(id: string): Promise<AnonymousMessage | undefined>;
  updateMessage(id: string, patch: Partial<AnonymousMessage>): Promise<void>;
  getInbox(token: string): Promise<AnonymousMessage[]>;
  addReport(report: Report): Promise<void>;
  getReport(id: string): Promise<Report | undefined>;
  getReports(): Promise<Report[]>;
  updateReport(id: string, patch: Partial<Report>): Promise<void>;
}

// ─── Factory ────────────────────────────────────────────────────────────────

let cachedStore: Store | null = null;

export function getStore(): Store {
  if (cachedStore) return cachedStore;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ioredis: any = require("ioredis");
      const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
      });
      cachedStore = new RedisStore(client as RedisClient);
    } catch {
      cachedStore = new MemStore();
    }
  } else {
    cachedStore = new MemStore();
  }
  return cachedStore;
}

export function generateToken(): string {
  return randomBytes(8).toString("base64url");
}
