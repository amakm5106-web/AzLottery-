import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';

declare global {
  // Reuse one connection pool across Next.js hot reloads in development.
  var azLotteryDbPool: Pool | undefined;
  var azLotteryMemoryDb: MemoryDatabase | undefined;
}

interface MemoryUser {
  id: number;
  identifier: string;
  identifier_type: 'email' | 'phone';
  password_hash: string;
  status: 'active' | 'suspended';
  created_at: Date;
  updated_at: Date;
}

interface MemorySession {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

interface MemoryWallet {
  user_id: number;
  balance_mmk: number;
  updated_at: Date;
}

interface MemoryRound {
  id: number;
  game_code: string;
  period_id: string;
  interval_minutes: number;
  starts_at: Date;
  ends_at: Date;
  result_value: string | null;
  status: 'open' | 'settled';
  created_at: Date;
  settled_at: Date | null;
}

interface MemoryBet {
  id: number;
  user_id: number;
  round_id: number;
  selection: string;
  stake_mmk: number;
  payout_mmk: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  idempotency_key: string;
  created_at: Date;
  settled_at: Date | null;
}

class MemoryDatabase {
  users: MemoryUser[] = [
    {
      id: 1,
      identifier: '09400000000',
      identifier_type: 'phone',
      // Default bcrypt hash for 'password123'
      password_hash: '$2a$12$e8g3m92vUeB0sTq5rE4.sOU7G6h1K6z6xWJ7I.x7cTz3Fz8jV3Q0e',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];
  sessions: MemorySession[] = [];
  loginAttempts: Map<string, { attempts: number; window: Date; blockedUntil?: Date }> = new Map();
  wallets: Map<number, MemoryWallet> = new Map([
    [1, { user_id: 1, balance_mmk: 100000, updated_at: new Date() }],
  ]);
  rounds: MemoryRound[] = [];
  bets: MemoryBet[] = [];
  ledgers: Array<{
    id: number;
    user_id: number;
    bet_id: number | null;
    kind: string;
    amount_mmk: number;
    balance_after_mmk: number;
    reference_key: string;
    created_at: Date;
  }> = [];

  nextUserId = 2;
  nextSessionId = 1;
  nextRoundId = 1;
  nextBetId = 1;
  nextLedgerId = 1;

  async execute(sql: string, params: any[] = []): Promise<[any, any]> {
    const s = sql.trim();
    const now = new Date();

    // 1. SELECT user from session
    if (s.includes('FROM azlottery_sessions s') && s.includes('JOIN azlottery_users u')) {
      const tokenHash = params[0];
      const session = this.sessions.find(
        (sess) => sess.token_hash === tokenHash && sess.expires_at > now
      );
      if (!session) return [[], []];
      const user = this.users.find((u) => u.id === session.user_id && u.status === 'active');
      if (!user) return [[], []];
      return [
        [
          {
            id: user.id,
            identifier: user.identifier,
            identifier_type: user.identifier_type,
          },
        ],
        [],
      ];
    }

    // 2. INSERT into azlottery_sessions
    if (s.startsWith('INSERT INTO azlottery_sessions')) {
      const userId = Number(params[0]);
      const tokenHash = String(params[1]);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const newSession: MemorySession = {
        id: this.nextSessionId++,
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: now,
      };
      this.sessions.push(newSession);
      return [{ insertId: newSession.id, affectedRows: 1 }, []];
    }

    // 3. DELETE from azlottery_sessions
    if (s.startsWith('DELETE FROM azlottery_sessions WHERE token_hash')) {
      const tokenHash = params[0];
      this.sessions = this.sessions.filter((sess) => sess.token_hash !== tokenHash);
      return [{ affectedRows: 1 }, []];
    }

    // 4. SELECT user by identifier
    if (s.includes('FROM azlottery_users WHERE identifier = ?')) {
      const identifier = params[0];
      const user = this.users.find((u) => u.identifier === identifier);
      if (!user) return [[], []];
      return [
        [
          {
            id: user.id,
            identifier: user.identifier,
            identifier_type: user.identifier_type,
            password_hash: user.password_hash,
            status: user.status,
          },
        ],
        [],
      ];
    }

    // 5. INSERT into azlottery_users
    if (s.startsWith('INSERT INTO azlottery_users')) {
      const identifier = String(params[0]);
      const identifierType = params[1] as 'email' | 'phone';
      const passwordHash = String(params[2]);

      const existing = this.users.find((u) => u.identifier === identifier);
      if (existing) {
        const err: any = new Error(`Duplicate entry '${identifier}' for key 'uq_azlottery_users_identifier'`);
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }

      const newUser: MemoryUser = {
        id: this.nextUserId++,
        identifier,
        identifier_type: identifierType,
        password_hash: passwordHash,
        status: 'active',
        created_at: now,
        updated_at: now,
      };
      this.users.push(newUser);
      // Give initial starting balance of 50,000 MMK
      this.wallets.set(newUser.id, { user_id: newUser.id, balance_mmk: 50000, updated_at: now });
      return [{ insertId: newUser.id, affectedRows: 1 }, []];
    }

    // 6. Login attempts
    if (s.includes('azlottery_login_attempts')) {
      return [[], []];
    }

    // 7. INSERT IGNORE INTO azlottery_wallets
    if (s.includes('INTO azlottery_wallets')) {
      const userId = Number(params[0]);
      if (!this.wallets.has(userId)) {
        this.wallets.set(userId, { user_id: userId, balance_mmk: 50000, updated_at: now });
      }
      return [{ affectedRows: 1 }, []];
    }

    // 8. SELECT balance_mmk FROM azlottery_wallets
    if (s.includes('SELECT balance_mmk FROM azlottery_wallets')) {
      const userId = Number(params[0]);
      const wallet = this.wallets.get(userId) || { user_id: userId, balance_mmk: 50000, updated_at: now };
      return [[{ balance_mmk: wallet.balance_mmk }], []];
    }

    // 9. UPDATE azlottery_wallets SET balance_mmk
    if (s.startsWith('UPDATE azlottery_wallets SET balance_mmk')) {
      const nextBalance = Number(params[0]);
      const userId = Number(params[1]);
      const wallet = this.wallets.get(userId) || { user_id: userId, balance_mmk: 0, updated_at: now };
      wallet.balance_mmk = nextBalance;
      wallet.updated_at = now;
      this.wallets.set(userId, wallet);
      return [{ affectedRows: 1 }, []];
    }

    // 10. INSERT IGNORE INTO azlottery_game_rounds
    if (s.includes('INTO azlottery_game_rounds')) {
      const [gameCode, periodId, intervalMinutes, startsAt, endsAt] = params;
      const exists = this.rounds.find((r) => r.game_code === gameCode && r.period_id === periodId);
      if (!exists) {
        const newRound: MemoryRound = {
          id: this.nextRoundId++,
          game_code: String(gameCode),
          period_id: String(periodId),
          interval_minutes: Number(intervalMinutes),
          starts_at: new Date(startsAt),
          ends_at: new Date(endsAt),
          result_value: null,
          status: 'open',
          created_at: now,
          settled_at: null,
        };
        this.rounds.push(newRound);
      }
      return [{ affectedRows: 1 }, []];
    }

    // 11. SELECT expired rounds
    if (s.includes('FROM azlottery_game_rounds') && s.includes("status = 'open'") && s.includes('ends_at <=')) {
      const [gameCode, intervalMinutes] = params;
      const expired = this.rounds.filter(
        (r) =>
          r.game_code === gameCode &&
          r.interval_minutes === Number(intervalMinutes) &&
          r.status === 'open' &&
          r.ends_at <= now
      );
      return [expired, []];
    }

    // 12. UPDATE azlottery_game_rounds SET result_value
    if (s.startsWith('UPDATE azlottery_game_rounds SET result_value')) {
      const [result, roundId] = params;
      const round = this.rounds.find((r) => r.id === Number(roundId));
      if (round) {
        round.result_value = String(result);
        round.status = 'settled';
        round.settled_at = now;
      }
      return [{ affectedRows: 1 }, []];
    }

    // 13. SELECT recent rounds
    if (s.includes('FROM azlottery_game_rounds WHERE game_code = ? AND interval_minutes = ?')) {
      const [gameCode, intervalMinutes] = params;
      const filtered = this.rounds
        .filter((r) => r.game_code === gameCode && r.interval_minutes === Number(intervalMinutes))
        .sort((a, b) => b.id - a.id)
        .slice(0, 12);
      return [filtered, []];
    }

    // 14. SELECT single round by period_id
    if (s.includes('FROM azlottery_game_rounds WHERE game_code = ? AND period_id = ?')) {
      const [gameCode, periodId] = params;
      const round = this.rounds.find((r) => r.game_code === gameCode && r.period_id === periodId);
      return [round ? [round] : [], []];
    }

    // 15. INSERT INTO azlottery_game_bets
    if (s.startsWith('INSERT INTO azlottery_game_bets')) {
      const [userId, roundId, selection, stake, idempotencyKey] = params;
      const newBet: MemoryBet = {
        id: this.nextBetId++,
        user_id: Number(userId),
        round_id: Number(roundId),
        selection: String(selection),
        stake_mmk: Number(stake),
        payout_mmk: 0,
        status: 'pending',
        idempotency_key: String(idempotencyKey),
        created_at: now,
        settled_at: null,
      };
      this.bets.push(newBet);
      return [{ insertId: newBet.id, affectedRows: 1 }, []];
    }

    // 16. SELECT pending bets for round
    if (s.includes('FROM azlottery_game_bets WHERE round_id = ? AND status = \'pending\'')) {
      const roundId = Number(params[0]);
      const matched = this.bets.filter((b) => b.round_id === roundId && b.status === 'pending');
      return [matched, []];
    }

    // 17. UPDATE azlottery_game_bets SET payout_mmk
    if (s.startsWith('UPDATE azlottery_game_bets SET payout_mmk')) {
      const [payout, status, settledAt, betId] = params;
      const bet = this.bets.find((b) => b.id === Number(betId));
      if (bet) {
        bet.payout_mmk = Number(payout);
        bet.status = status;
        bet.settled_at = new Date(settledAt);
      }
      return [{ affectedRows: 1 }, []];
    }

    // 18. INSERT INTO azlottery_wallet_ledger
    if (s.startsWith('INSERT INTO azlottery_wallet_ledger')) {
      const [userId, betId, kind, amount, balanceAfter, referenceKey] = params;
      this.ledgers.push({
        id: this.nextLedgerId++,
        user_id: Number(userId),
        bet_id: betId ? Number(betId) : null,
        kind: String(kind),
        amount_mmk: Number(amount),
        balance_after_mmk: Number(balanceAfter),
        reference_key: String(referenceKey),
        created_at: now,
      });
      return [{ affectedRows: 1 }, []];
    }

    // Default fallback
    return [[], []];
  }
}

function createMemoryPool(): Pool {
  if (!globalThis.azLotteryMemoryDb) {
    globalThis.azLotteryMemoryDb = new MemoryDatabase();
  }
  const db = globalThis.azLotteryMemoryDb;

  const mockConnection = {
    execute: (sql: string, params?: any[]) => db.execute(sql, params),
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  } as unknown as PoolConnection;

  const mockPool = {
    execute: (sql: string, params?: any[]) => db.execute(sql, params),
    getConnection: async () => mockConnection,
    end: async () => {},
  } as unknown as Pool;

  return mockPool;
}

export function getAuthDb(): Pool {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    // Graceful in-process memory database fallback so auth & game backend work out-of-the-box
    return createMemoryPool();
  }

  if (!globalThis.azLotteryDbPool) {
    globalThis.azLotteryDbPool = mysql.createPool({
      uri,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      timezone: 'Z',
      enableKeepAlive: true,
    });
  }

  return globalThis.azLotteryDbPool;
}
