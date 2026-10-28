# AzLottery UI and account update

This Next.js project keeps AzLottery branding and uses the supplied CKLottery page as visual inspiration for a responsive blue-and-white frontend. Existing home, games, WinGo, wheel, wallet, transactions and admin views remain in place.

## Real account login and signup

`/signup` creates an account in the project's managed MySQL database using only a phone number or email address and password. `/login` authenticates the same fields. No OTP is sent and no password-confirmation field is required. Myanmar phone digits are normalized; email identifiers are stored in lowercase. Passwords are bcrypt-hashed (cost 12), never saved in browser storage, and sessions use an HttpOnly cookie whose random token is stored only as a SHA-256 hash in the database. Sessions expire after seven days, logout revokes the current session, and wrong-password attempts are temporarily throttled; a correct password can still sign in. Mutating auth APIs require same-origin requests and JSON content type.

Phone/email ownership is not verified and password recovery is not included because no SMS/email provider is configured. Game, wallet, balance and payment behavior remain separate from this authentication update; they have not been migrated to the account database.

## Setup and build

The project uses pnpm `11.25.0`. In an environment with the managed `DATABASE_URL`, run `pnpm install`, `pnpm db:migrate`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build`. The migration creates additive `azlottery_users`, `azlottery_sessions` and `azlottery_login_attempts` tables with `IF NOT EXISTS`. `pnpm test` checks auth validation without writing to the shared database and also runs the existing project logic tests.

## Container deployment

The root `Dockerfile` builds the Next.js standalone server with Node `22.23.4` and pnpm `11.25.0`, installs from the checked-in lockfile, and starts the production listener on the supplied `PORT` (default `3000`). Private runtime values such as `DATABASE_URL` are not needed while building the image. The managed deploy contract uses `Dockerfile` and the unauthenticated readiness endpoint `/api/health`. Saving that contract prepares the project for publishing; it does not publish the site.

## Routes

- `/` — AzLottery lobby and existing frontend views
- `/login` — database-backed sign-in
- `/signup` — database-backed account creation

## K3 / 5D / TRX UI update

The home lottery cards now open dedicated K3, 5D, and TRX Win mobile-first views with the CKLottery-inspired blue header, balance card, period selector, countdown, result history, and selection controls.

These three views are intentionally local practice screens. They do not change the wallet, submit deposits or withdrawals, or connect to CKLottery or any external account. Existing WinGo settlement and wallet/auth flows remain unchanged.

## Backend-connected K3 / 5D / TRX

K3, 5D and TRX now use authenticated server APIs at `/api/games/:game/state` and `/api/games/:game/bet`. Migration `002_games.sql` adds wallet balances, game rounds, bets and an idempotent wallet ledger. The server derives results from the game and period, locks wallet rows during a bet, debits the stake atomically, and settles expired rounds server-side. Run `pnpm db:migrate` with the production `DATABASE_URL` before enabling these screens. The current deposit and withdrawal adapters still need to be migrated into the same wallet ledger before they can be treated as a single production accounting system.
