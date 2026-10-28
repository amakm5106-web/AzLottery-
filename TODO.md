# ToDo

- [x] **AzLottery pages and CKLottery-inspired frontend** — “ဒီ zip code ကိုဖြည်ပြီး http://CKLottery.cc ဒီ site ရဲ့ UI/UX frontend အပိုင်းယူပါ source code ယူပြီး ဒီ zip ထဲက source code ကိုပြင်ပေးပါ page အတိုင်းပြင်ပါ”; adapted the supplied frontend to a responsive design while retaining AzLottery branding and the existing lobby/game/wallet screens.
- [x] **Real database-backed login/signup** — “login / Signup page ကိုကော အကုန် ဒီsite frontend အတိုင်းတူအောင် ကိုလုပ်ပါ”; “Az lottery Database နဲ့လုပ်ပါ”; “otp ဘာညာ မပို့ဘူး email or phone, psw ထည့်ယုံပဲ”. Use managed MySQL for actual account registration/login; accept only phone/email and password; do not send OTP or require password confirmation; store only bcrypt-hashed passwords; create hashed-token server sessions and revoke them on logout; use same-origin protections for auth mutations; keep the responsive AzLottery account UI free of demo-only behavior. Migration was applied; no test accounts were created. Contact ownership is not verified, and game/wallet state remains outside this auth database.
- [x] **Build and refreshed source ZIP** — “siteကိုပါ build လုပ် နောက်ဆုံး source code zip ပြန်ပေးပါ”; production build and TypeScript check succeeded, eight tests passed, Preview routes/security checks succeeded, and the refreshed source archive contains the auth implementation and deployment Dockerfile/health endpoint without Git, dependencies/build output, or secrets.
- [x] **Container publishing contract** — “Missing publish configuration: deploy. Ask Manus to inspect this project and configure these fields before publishing. Error: publish_contract_missing.” Added a pinned standalone-server Dockerfile and local Docker ignore policy; added unauthenticated `/api/health` (HTTP 200 from the production standalone server); configured `deploy.dockerfilePath` as `Dockerfile` and `deploy.healthPath` as `/api/health`; verified the managed config write was applied. Site was not published.


## Current task: Wingo UI/UX
- [x] **Inspect CKLottery Wingo reference** — “login လိုအပ်ရင်”; login to the supplied site only to view the Wingo screen. No game bet, deposit, or withdrawal was placed.
- [x] **Match the Wingo page layout** — “ဒီ source code ထဲက UI အပိုင်းကို ပြောင်းမလို့ http://CKLottery.cc ဒီ site. ထဲက Wingo page UI/Ux layout အတိုင်းလုပ်ပေးပါ”. Unzip and modify the supplied source code's Wingo UI/UX to follow the CKLottery.cc Wingo page layout, including the five period cards, blue round ticket, betting controls, history, and floating support shortcut.
- [x] **Keep existing functionality intact** — Preserve the current timer, round settlement, betting/data flow, API connections, wallet interactions, AzLottery identity, and non-Wingo pages; keep mobile and desktop layouts usable. The generic timing/settlement path supports the added 10-minute interval; no bet was placed.
- [x] **Return the edited source** — Packaged the modified source at `/home/ubuntu/azlottery-wingo-ui-updated.zip`; excluded dependencies, build output, Git metadata, and private environment files; ZIP integrity check passed.


## Current task: Account page and bottom menu
- [x] **Account page layout and icons** — “Account page ကိုလဲ cklottery.cc page UI/UX အတိုင်းလုပ်ပေး ပါ layout icon ဘာညာရော”. Build an Account screen following CKLottery's profile header, balance card, shortcut icons, account/history menu groups, service-center icon group, and sign-out layout, while showing the project's real user/session and wallet state.
- [x] **Bottom menu** — “အောက်က Menu တွေကိုပါ cklottery.cc အတိုင်းလုပ်ပေးနော်”. Match CKLottery's lower menu order and icon treatment: Home, Activity, Promotion, Wallet, Account. Each item must navigate to a corresponding existing or safe in-app screen.
- [x] **Preserve existing behavior** — Keep existing wallet, transaction, account-authentication, admin access, and Wingo navigation/state intact; do not add payment actions or fabricated balances/promotions.

## Current task: Backend-connected K3 / 5D / TRX
- [x] **Database schema** — Added `migrations/002_games.sql` for server-owned wallets, game rounds, bets, payout records and an idempotent wallet ledger.
- [x] **Server APIs** — Added authenticated `GET /api/games/:game/state` and same-origin `POST /api/games/:game/bet` routes with row locks, server-side result derivation, stake debit and expired-round settlement.
- [x] **Frontend wiring** — K3, 5D and TRX screens now load balance/round/history from the backend and submit bets through the server API instead of local practice state.
- [ ] **Runtime activation** — Run `pnpm db:migrate` with the real AzLottery `DATABASE_URL`. Existing deposit/withdrawal adapters still need to write into the new wallet ledger before the whole money flow is one unified production ledger.
