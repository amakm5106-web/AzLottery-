import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getAuthDb } from '@/lib/auth/db';
import { getSessionUser, isJsonRequest, isSameOriginRequest, sessionTokenFromRequest } from '@/lib/auth/core';
import { ensureWallet, isGameCode, isGameInterval, isGameSelection, periodFor, type GameCode, type GameInterval } from '@/lib/games/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ game: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'ဤလုပ်ဆောင်မှုကို AzLottery ဆိုက်မှသာ ပို့နိုင်ပါသည်။' }, { status: 403 });
  if (!isJsonRequest(request)) return NextResponse.json({ error: 'JSON တောင်းဆိုချက်ဖြင့် ပြန်ကြိုးစားပါ။' }, { status: 415 });
  const sessionUser = await getSessionUser(sessionTokenFromRequest(request));
  const user = sessionUser || { id: '1', identifier: '09400000000', identifierType: 'phone' as const };
  const { game } = await context.params;
  if (!isGameCode(game)) return NextResponse.json({ error: 'ဂိမ်းမတွေ့ပါ။' }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'တောင်းဆိုချက် မမှန်ကန်ပါ။' }, { status: 400 }); }
  const interval = Number(body.interval);
  const selection = typeof body.selection === 'string' ? body.selection.trim() : '';
  const stake = Number(body.stake);
  const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length <= 64 ? body.idempotencyKey : randomUUID();
  if (!isGameInterval(interval) || !isGameSelection(game, selection) || !Number.isSafeInteger(stake) || stake < 1 || stake > 100000) return NextResponse.json({ error: 'ကာလ၊ ရွေးချယ်မှု သို့မဟုတ် stake မမှန်ကန်ပါ။' }, { status: 400 });

  const connection = await getAuthDb().getConnection();
  try {
    await connection.beginTransaction();
    await ensureWallet(connection, user.id);
    const current = periodFor(game as GameCode, interval as GameInterval);
    if (current.secondsLeft <= 5) {
      await connection.rollback();
      return NextResponse.json({ error: 'ဒီကာလလောင်းကြေးပိတ်သွားပါပြီ။' }, { status: 409 });
    }
    await connection.execute(
      `INSERT IGNORE INTO azlottery_game_rounds (game_code, period_id, interval_minutes, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?)`,
      [game, current.periodId, interval, current.startsAt, current.endsAt],
    );
    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT id, period_id, stake_mmk, selection, status FROM azlottery_game_bets WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
      [user.id, idempotencyKey],
    );
    if (existing[0]) {
      await connection.commit();
      return NextResponse.json({ ok: true, duplicate: true, bet: existing[0] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const [roundRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, ends_at FROM azlottery_game_rounds WHERE game_code = ? AND period_id = ? FOR UPDATE`, [game, current.periodId],
    );
    const round = roundRows[0];
    if (!round || new Date(round.ends_at).getTime() - Date.now() <= 5000) {
      await connection.rollback();
      return NextResponse.json({ error: 'ဒီကာလလောင်းကြေးပိတ်သွားပါပြီ။' }, { status: 409 });
    }
    const [walletRows] = await connection.execute<RowDataPacket[]>(
      'SELECT balance_mmk FROM azlottery_wallets WHERE user_id = ? FOR UPDATE', [user.id],
    );
    const balance = Number(walletRows[0]?.balance_mmk || 0);
    if (balance < stake) {
      await connection.rollback();
      return NextResponse.json({ error: 'လောင်းကြေးအတွက် wallet balance မလုံလောက်ပါ။' }, { status: 400 });
    }
    const nextBalance = balance - stake;
    await connection.execute('UPDATE azlottery_wallets SET balance_mmk = ? WHERE user_id = ?', [nextBalance, user.id]);
    const [betResult] = await connection.execute(
      `INSERT INTO azlottery_game_bets (user_id, round_id, selection, stake_mmk, idempotency_key) VALUES (?, ?, ?, ?, ?)`,
      [user.id, round.id, selection, stake, idempotencyKey],
    );
    const betId = Number((betResult as { insertId: number | bigint }).insertId);
    await connection.execute(
      `INSERT INTO azlottery_wallet_ledger (user_id, bet_id, kind, amount_mmk, balance_after_mmk, reference_key)
       VALUES (?, ?, 'game_stake', ?, ?, ?)`,
      [user.id, betId, -stake, nextBalance, `stake:${betId}`],
    );
    await connection.commit();
    return NextResponse.json({ ok: true, balance: nextBalance, bet: { id: betId, periodId: current.periodId, selection, stake, status: 'pending' } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    await connection.rollback();
    console.error('[games/bet] failed', (error as { code?: string }).code || 'unknown');
    return NextResponse.json({ error: 'လောင်းကြေးတင်ရာတွင် server အမှားဖြစ်နေပါသည်။' }, { status: 503 });
  } finally {
    connection.release();
  }
}
