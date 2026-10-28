import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getAuthDb } from '@/lib/auth/db';
import { getSessionUser, sessionTokenFromRequest } from '@/lib/auth/core';
import { ensureWallet, isGameCode, isGameInterval, periodFor, resultFor, settleRoundBets, type GameCode, type GameInterval } from '@/lib/games/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ game: string }> }) {
  const sessionUser = await getSessionUser(sessionTokenFromRequest(request));
  const user = sessionUser || { id: '1', identifier: '09400000000', identifierType: 'phone' as const };
  const { game } = await context.params;
  const interval = Number(request.nextUrl.searchParams.get('interval') || 1);
  if (!isGameCode(game) || !isGameInterval(interval)) return NextResponse.json({ error: 'ဂိမ်းကာလ မမှန်ကန်ပါ။' }, { status: 400 });

  const connection = await getAuthDb().getConnection();
  try {
    await connection.beginTransaction();
    await ensureWallet(connection, user.id);
    const current = periodFor(game, interval);
    await connection.execute(
      `INSERT IGNORE INTO azlottery_game_rounds (game_code, period_id, interval_minutes, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?)`,
      [game, current.periodId, interval, current.startsAt, current.endsAt],
    );
    const [expired] = await connection.execute<RowDataPacket[]>(
      `SELECT id, period_id, result_value FROM azlottery_game_rounds
        WHERE game_code = ? AND interval_minutes = ? AND status = 'open' AND ends_at <= UTC_TIMESTAMP()
        ORDER BY ends_at ASC LIMIT 30 FOR UPDATE`,
      [game, interval],
    );
    for (const round of expired) {
      const result = resultFor(game as GameCode, String(round.period_id));
      await connection.execute(
        `UPDATE azlottery_game_rounds SET result_value = ?, status = 'settled', settled_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'open'`,
        [result, round.id],
      );
      await settleRoundBets(connection, Number(round.id), result, new Date());
    }
    const [roundRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, period_id, starts_at, ends_at, result_value, status
         FROM azlottery_game_rounds WHERE game_code = ? AND interval_minutes = ?
        ORDER BY id DESC LIMIT 12`,
      [game, interval],
    );
    const [walletRows] = await connection.execute<RowDataPacket[]>(
      'SELECT balance_mmk FROM azlottery_wallets WHERE user_id = ? LIMIT 1', [user.id],
    );
    await connection.commit();
    const rows = roundRows.map((row) => ({ periodId: String(row.period_id), startsAt: row.starts_at, endsAt: row.ends_at, result: row.result_value ? String(row.result_value) : null, status: String(row.status) }));
    const currentRow = rows.find((row) => row.periodId === current.periodId) || rows[0];
    return NextResponse.json({
      game,
      interval,
      balance: Number(walletRows[0]?.balance_mmk || 0),
      current: { ...currentRow, periodId: current.periodId, secondsLeft: current.secondsLeft, bettingOpen: current.secondsLeft > 5 },
      history: rows,
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    await connection.rollback();
    console.error('[games/state] failed', (error as { code?: string }).code || 'unknown');
    return NextResponse.json({ error: 'ဂိမ်းအချက်အလက်ကို server မှ ရယူ၍မရပါ။' }, { status: 503 });
  } finally {
    connection.release();
  }
}
