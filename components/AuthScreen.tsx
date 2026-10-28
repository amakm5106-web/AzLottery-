'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Eye, EyeOff, Gamepad2, Home, LoaderCircle,
  LockKeyhole, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react';

type AuthMode = 'login' | 'signup';

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const isSignup = mode === 'signup';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('ဖုန်းနံပါတ် သို့မဟုတ် အီးမေးလ်ကို ဖြည့်ပါ။');
      return;
    }
    if (password.length < 8) {
      setError('စကားဝှက်ကို အနည်းဆုံး ၈ လုံး ဖြည့်ပါ။');
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/auth/${isSignup ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof result.error === 'string' ? result.error : 'လုပ်ဆောင်မှု မအောင်မြင်ပါ။ ပြန်ကြိုးစားပါ။');
        return;
      }

      try {
        localStorage.setItem('az_is_logged_in', 'true');
        const loginId = (result.user?.identifier || identifier).trim();
        const loginUser = {
          id: Number(result.user?.id) || Date.now(),
          login_identifier: loginId,
          role: 'user',
          status: 'active',
          wallet_balance: 0,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        };
        localStorage.setItem('az_curr_user', JSON.stringify(loginUser));
      } catch { /* ignore */ }

      setPassword('');
      window.location.assign('/');
    } catch {
      setError('Server သို့ ချိတ်ဆက်၍မရပါ။ အင်တာနက်ကို စစ်ဆေးပြီး ပြန်ကြိုးစားပါ။');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link href="/" className="auth-brand" aria-label="AzLottery ပင်မစာမျက်နှာသို့">
          <span className="auth-brand-mark">A</span><span>AzLottery</span>
        </Link>
        <Link href="/" className="auth-home-link"><ArrowLeft size={16} /> ပင်မစာမျက်နှာသို့</Link>
      </header>

      <div className="auth-layout">
        <aside className="auth-promo">
          <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
          <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
          <div className="auth-promo-content">
            <div className="auth-promo-badge"><Sparkles size={15} /> AzLottery Account</div>
            <h1>ကံစမ်းခန်းထဲကို<br />ဆက်လက်ဝင်ရောက်ပါ</h1>
            <p>သင့် AzLottery အကောင့်ဖြင့် ဝင်ရောက်ပြီး ဂိမ်းကဏ္ဍများနှင့် အကောင့်နေရာကို ဆက်လက်အသုံးပြုပါ။</p>
            <div className="auth-feature-list">
              <div><span className="auth-feature-icon"><Gamepad2 size={18} /></span><span><strong>အကောင့်တစ်ခုဖြင့် ဝင်ရောက်ပါ</strong><small>ဖုန်းနံပါတ် သို့မဟုတ် အီးမေးလ်ကို အသုံးပြုနိုင်သည်</small></span></div>
              <div><span className="auth-feature-icon"><ShieldCheck size={18} /></span><span><strong>စကားဝှက်ကို လုံခြုံစွာသိမ်းဆည်းသည်</strong><small>Database တွင် bcrypt hash အဖြစ်သာသိမ်းသည်</small></span></div>
            </div>
          </div>
          <div className="auth-promo-bottom"><span className="auth-promo-dot" /> AZLOTTERY ACCOUNT</div>
        </aside>

        <section className="auth-form-panel" aria-labelledby="auth-form-title">
          <div className="auth-form-heading">
            <div className="auth-small-mark"><UserRound size={18} /></div>
            <div className="auth-eyebrow">AzLottery အကောင့်</div>
            <h2 id="auth-form-title">{isSignup ? 'အကောင့်ဖွင့်ရန်' : 'အကောင့်ဝင်ရန်'}</h2>
            <p>{isSignup ? 'ဖုန်းနံပါတ်/အီးမေးလ်နှင့် စကားဝှက်ဖြင့် စာရင်းသွင်းပါ။' : 'သင့် AzLottery အကောင့်သို့ ဝင်ရောက်ပါ။'}</p>
          </div>

          <nav className="auth-mode-switch" aria-label="အကောင့်မုဒ်ရွေးရန်">
            <Link href="/login" aria-current={!isSignup ? 'page' : undefined} className={!isSignup ? 'active' : ''}>အကောင့်ဝင်ရန်</Link>
            <Link href="/signup" aria-current={isSignup ? 'page' : undefined} className={isSignup ? 'active' : ''}>စာရင်းသွင်းရန်</Link>
          </nav>

          <div className="auth-account-notice" id="auth-account-note">
            <LockKeyhole size={17} aria-hidden="true" />
            <span><strong>AzLottery database account</strong> — စကားဝှက်ကို bcrypt hash ဖြင့်သိမ်းမည်။ ဖုန်း/အီးမေးလ် OTP မပို့ပါ။</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <label className="auth-label" htmlFor={`${mode}-identifier`}>ဖုန်းနံပါတ် သို့မဟုတ် အီးမေးလ်</label>
            <div className="auth-input-wrap">
              <UserRound size={17} aria-hidden="true" />
              <input
                id={`${mode}-identifier`}
                type="text"
                inputMode="email"
                autoComplete="username"
                maxLength={191}
                placeholder="ဥပမာ — name@example.com သို့မဟုတ် 09..."
                value={identifier}
                onChange={(event) => { setIdentifier(event.target.value); setError(''); }}
                aria-describedby="auth-account-note"
                required
              />
            </div>

            <div className="auth-label-row">
              <label className="auth-label" htmlFor={`${mode}-password`}>{isSignup ? 'စကားဝှက်အသစ်' : 'စကားဝှက်'}</label>
              <span className="auth-password-hint">အနည်းဆုံး ၈ လုံး</span>
            </div>
            <div className="auth-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id={`${mode}-password`}
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                maxLength={72}
                placeholder="အနည်းဆုံး ၈ လုံး"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(''); }}
                aria-describedby="auth-account-note"
                required
              />
              <button className="auth-eye-button" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'စကားဝှက်ဖျောက်ရန်' : 'စကားဝှက်ပြရန်'}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && <div className="auth-message error" role="alert">{error}</div>}
            <button type="submit" className="auth-submit-button" disabled={pending}>
              {pending ? <LoaderCircle className="auth-spinner" size={17} /> : <>{isSignup ? 'အကောင့်ဖွင့်မည်' : 'အကောင့်ဝင်မည်'}<ArrowLeft className="auth-submit-arrow" size={17} /></>}
            </button>
          </form>

          <div className="auth-switch-copy">{isSignup ? 'အကောင့်ရှိပြီးသားလား။ ' : 'အကောင့်အသစ်ဖွင့်လိုပါသလား။ '}<Link href={isSignup ? '/login' : '/signup'}>{isSignup ? 'အကောင့်ဝင်ရန်' : 'စာရင်းသွင်းရန်'}</Link></div>
          <div className="auth-form-footer"><Home size={14} /><Link href="/">AzLottery ပင်မစာမျက်နှာ</Link><span aria-hidden="true">·</span><span>Database account</span></div>
        </section>
      </div>
      <p className="auth-copyright">© {new Date().getFullYear()} AzLottery</p>
    </main>
  );
}
