# AzLottery Login/Signup болон Publish Deployment Plan

## Одоогийн бүтээгдэхүүн

AzLottery-ийн `/login` болон `/signup` хуудсууд managed MySQL database-д account үүсгэж нэвтэрнэ. User-ийн баталсан шаардлагаар бүртгэл/нэвтрэлтэд утасны дугаар эсвэл email, password л орно—OTP болон password confirmation талбар байхгүй. Manus OAuth ашиглахгүй. Frontend нь одоогийн blue/white, mobile-first төрхөө хадгална.

Password bcrypt cost 12-аар hash хийгдэж, browser storage болон log-д орохгүй. Random opaque session token-ийг HttpOnly cookie-д, SHA-256 hash-ийг database-д хадгална; долоо хоногийн expiry, server logout, same-origin mutation хамгаалалттай. Хэрэглэгчийн email/phone ownership баталгаажихгүй, recovery service холбогдоогүй.

## Server ба database

Project-ийн `server: true`, `database: true` capabilities асаалттай; managed `DATABASE_URL`-ийг зөвхөн Node server runtime ашиглана. `mysql2/promise` pool болон `migrations/001_auth.sql` хэрэглэгч, session, login attempt хүснэгтүүдийг удирдана. Auth API нь `/api/auth/{register,login,session,logout}` замууд дээр ажиллаж, account UI нь session/status/logout холбоостой.

## Missing deploy contract засах

Next.js-ийн `output: 'standalone'` build-ийг ажиллуулах root `Dockerfile` нэмнэ. Node toolchain-ийг `22.23.4`, pnpm-ийг `11.25.0` болгон pin; checked-in lockfile болон `pnpm-workspace.yaml` lifecycle policy-гаар install/build хийнэ. Runtime image нь standalone server, `.next/static`, `public` файлуудыг агуулж non-root user-аар ажиллана. Server нь `0.0.0.0` дээр configured `PORT` (default `3000`) сонсоно; secrets/`DATABASE_URL` build-time-д шаардахгүй.

Unauthenticated `/api/health` route нь container readiness-д 200 буцаана. Managed `deploy` domain-д `dockerfilePath: "Dockerfile"`, `healthPath: "/api/health"` хадгална. `features.server`/`database` өөрчлөхгүй; `publishing.auto_publish` false хэвээр. Шалгалтын дараа шинэ source checkpoint хадгална, гэхдээ user тусад нь хүсээгүй тул public publish хийхгүй.

## Бүтцийн үүрэг

- `components/AuthScreen.tsx`, `components/Header.tsx`: phone/email + password auth UI, session badge/logout.
- `app/api/auth/*`, `lib/auth/*`: register/login/session/logout routes, pool, validation, hash/session/security helpers.
- `migrations/001_auth.sql`, `scripts/migrate-auth.mjs`: additive shared-DB schema and runner.
- `Dockerfile`: pinned multi-stage standalone container build and production listener.
- `app/api/health/route.ts`: unauthenticated readiness response.
- `app/login/page.tsx`, `app/signup/page.tsx`, `public/manus-routes.json`: user page declarations; APIs remain excluded from page manifest.
- `TODO.md`, `README_UI_UPDATE.md`: requirements and setup instructions.

## Хамрах хүрээний хязгаар

Game/wallet/balance/payment state migration, OTP/contact verification, password recovery, admin role management нь тусдаа ажил. Managed DB нь dev/test/prod-д shared. Энэ хүсэлтийн хүрээнд publish configuration-ийг бэлдэж, checkpoint хийнэ; live publish эхлүүлэхгүй.


## Current task: CKLottery WinGo visual alignment

The supplied archive is the source of truth. Only the WinGo view's UI/UX presentation is in scope. Preserve AzLottery branding and the existing timer, round settlement, bet placement, wallet/API data flow, and other pages. The CKLottery WinGo reference was inspected after sign-in: blue header and page surround; white balance card with Withdraw/Deposit actions; announcement strip; five period choices (30 seconds, 1, 3, 5, and 10 minutes); blue round/timer card with previous results and How to play; Green/Violet/Red choices; number balls; Random/multiplier controls; Big/Small control; history tabs and table; floating support shortcut.

Design follows the supplied reference rather than introducing a new style: blue-first mobile game canvas, compact white cards, cool-gray page background, saturated result/selection colors, and a centered constrained surface on wider viewports. Retain current Myanmar copy, AzLottery wordmark, and project assets. Existing interactions and disabled/feedback states remain unchanged; visual transitions stay subtle.

Structure remains unchanged: `components/WinGoView.tsx` owns page presentation and existing interactions; `app/globals.css` owns shared and Wingo styles; `lib/rules.ts` and `lib/store.ts` own period and game data; `app/page.tsx` supplies navigation and callbacks. UI changes should be localized to `WinGoView.tsx` and Wingo-specific CSS unless an interval option is already supported by existing game rules.


## Integration details
The Wingo state retains its own blue game header and support controls, so the site-wide navigation, footer, and mobile tab bar are hidden only on that view; the in-game Back action remains the route back. The existing generic interval calculation and settlement path support the added 10-minute period, with no changes to payout formulas or bet confirmation flow. The lobby summary now lists the period to keep the entry copy accurate.


## Current task: Account page and bottom menu

Reference inspected at `https://cklottery.cc/#/main` while signed in for viewing; the reference account screen has a blue profile header, circular avatar, member/UID line, total-balance card, four wallet/VIP shortcuts, a 2×2 history/deposit/withdraw group, account rows for Notification, Gifts, Top-Up Coupons, Game statistics and Language, then a Service Center icon group (Settings, Feedback, Announcement, Customer service, Beginner's Guide, About us) and Log out. Its fixed lower menu is Home, Activity, Promotion, Wallet, Account.

Implement a CKLottery-inspired Account screen with AzLottery identity and real local balance/session display; use the existing wallet and transactions screens for their respective actions. Keep unsupported profile/service functions clearly non-destructive and do not invent balances, credits, eligibility or external payment behavior. Map the bottom menu to Home, existing transaction activity, a safe Promotion destination, existing Wallet, and the new Account view. Keep Wingo's no-bottom-menu presentation intact and hide site chrome only where the account/game screen provides its own layout.
