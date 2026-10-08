import { DEMO_USERS, type MockUser } from './fixtures';
import { UserLibrary } from './library';

interface QuickConnectRequest {
  code: string;
  secret: string;
  createdAt: number;
  approvedBy: string | null;
}

export interface MockOptions {
  /** Approve Quick Connect codes automatically after this many ms (demo mode). null = never. */
  quickConnectAutoApproveMs: number | null;
  quickConnectEnabled: boolean;
  /** Simulated network latency in ms. */
  latencyMs: number;
  /** Keeps tokens and watch state across page loads (demo mode), like a real server would. */
  storage: Storage | null;
  /**
   * Simulated failures for tests: 'directPlay' (the file cannot be decoded), 'transcode' (HLS
   * fails), 'playbackInfo' (the server refuses). In demo mode also read from localStorage
   * ('jellymorph.demo.faults', comma separated), so end-to-end tests can switch them on.
   */
  faults: readonly string[];
}

export interface PlaySession {
  userId: string;
  itemId: string;
}

const TOKEN_STORAGE_KEY = 'jellymorph.demo.tokens';
const FAULTS_STORAGE_KEY = 'jellymorph.demo.faults';

/** Mutable state of the mock server: issued tokens and pending Quick Connect requests. */
export class MockState {
  readonly options: MockOptions;
  readonly users: MockUser[] = [...DEMO_USERS];
  /** Watch state (played, favorite, progress) per user. */
  readonly library: UserLibrary;
  private readonly tokens: Map<string, string>;
  private readonly quickConnect = new Map<string, QuickConnectRequest>();
  /** Active playbacks by PlaySessionId. */
  readonly playSessions = new Map<string, PlaySession>();
  /** Every report the server received, in order (for tests). */
  readonly reports: { kind: 'start' | 'progress' | 'stopped' | 'ping'; body: unknown }[] = [];
  private counter = 0;

  constructor(options: Partial<MockOptions> = {}) {
    this.options = {
      quickConnectAutoApproveMs: null,
      quickConnectEnabled: true,
      latencyMs: 0,
      storage: null,
      faults: [],
      ...options,
    };
    this.tokens = new Map(this.loadTokens());
    this.library = new UserLibrary(this.options.storage);
  }

  private loadTokens(): [string, string][] {
    try {
      const raw = this.options.storage?.getItem(TOKEN_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter(
            (entry): entry is [string, string] =>
              Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string',
          )
        : [];
    } catch {
      return [];
    }
  }

  private saveTokens(): void {
    try {
      this.options.storage?.setItem(TOKEN_STORAGE_KEY, JSON.stringify([...this.tokens]));
    } catch {
      // Demo persistence is best effort.
    }
  }

  private nextId(): string {
    this.counter += 1;
    const random = Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    return `${Date.now().toString(16)}${this.counter.toString(16).padStart(4, '0')}${random}`.padEnd(
      32,
      '0',
    );
  }

  hasFault(fault: string): boolean {
    if (this.options.faults.includes(fault)) return true;
    try {
      const stored = this.options.storage?.getItem(FAULTS_STORAGE_KEY) ?? '';
      return stored.split(',').includes(fault);
    } catch {
      return false;
    }
  }

  newPlaySessionId(): string {
    return this.nextId();
  }

  issueToken(userId: string): string {
    const token = this.nextId();
    this.tokens.set(token, userId);
    this.saveTokens();
    return token;
  }

  userForToken(token: string | null): MockUser | null {
    if (!token) return null;
    const userId = this.tokens.get(token);
    return this.users.find((user) => user.id === userId) ?? null;
  }

  revokeToken(token: string): void {
    this.tokens.delete(token);
    this.saveTokens();
  }

  /** Revokes every token, e.g. to test the "session expired" flow. */
  revokeAll(): void {
    this.tokens.clear();
    this.saveTokens();
  }

  findUserByName(name: string): MockUser | null {
    return this.users.find((user) => user.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
  }

  startQuickConnect(): QuickConnectRequest {
    const request: QuickConnectRequest = {
      code: String(100000 + ((Date.now() + this.counter * 7919) % 900000)).slice(0, 6),
      secret: this.nextId(),
      createdAt: Date.now(),
      approvedBy: null,
    };
    this.counter += 1;
    this.quickConnect.set(request.secret, request);
    return request;
  }

  quickConnectRequest(secret: string): QuickConnectRequest | null {
    const request = this.quickConnect.get(secret);
    if (!request) return null;
    const autoApprove = this.options.quickConnectAutoApproveMs;
    if (
      !request.approvedBy &&
      autoApprove !== null &&
      Date.now() - request.createdAt >= autoApprove
    ) {
      request.approvedBy = DEMO_USERS[0]?.id ?? null;
    }
    return request;
  }

  approveQuickConnect(code: string, userId: string): boolean {
    for (const request of this.quickConnect.values()) {
      if (request.code === code) {
        request.approvedBy = userId;
        return true;
      }
    }
    return false;
  }

  consumeQuickConnect(secret: string): string | null {
    const request = this.quickConnectRequest(secret);
    if (!request?.approvedBy) return null;
    this.quickConnect.delete(secret);
    return request.approvedBy;
  }
}
