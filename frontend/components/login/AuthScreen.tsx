import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Eye, EyeOff, Laptop, Link2, LoaderCircle, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import "./auth-screen.css";

type Mode = "login" | "register" | "recover";
function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [visible, setVisible] = useState(false);
  const secret = props.type === "password";
  return <div className="ul-field">
    <label htmlFor={props.id}>{label}</label>
    <div>
      <input required {...props} type={secret && visible ? "text" : props.type} />
      {secret && <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>}
    </div>
  </div>;
}

function SignalArt() {
  return <aside className="ul-art" aria-label="UniLink connects your devices">
    <div className="ul-grid" />
    <div className="ul-art-title">One link.<br /><em>Every device.</em></div>
    <div className="ul-orbits" aria-hidden="true">
      <div className="ul-ring ul-ring-one"><i /></div>
      <div className="ul-ring ul-ring-two"><i /></div>
      <span className="ul-node ul-laptop"><Laptop /></span>
      <span className="ul-node ul-phone"><Smartphone /></span>
    </div>
    <div className="ul-art-caption"><Link2 size={19} /> Cross-device sync</div>
  </aside>;
}

export default function AuthScreen({ initialMode }: { initialMode: "login" | "register" }) {
  const { signIn, signUp, requestRegistrationOtp, verifyRegistrationOtp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState(initialMode === "login" ? localStorage.getItem("remembered_email") || "" : "");
  const [remember, setRemember] = useState(localStorage.getItem("remember-me") === "true");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [terms, setTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const register = mode === "register";
  const recover = mode === "recover";
  const login = mode === "login";
  const title = sent ? (recover ? "Choose a new password" : "Check your inbox") : register ? "Create your account" : recover ? "Reset your password" : "Welcome back";
  const description = sent ? (recover ? `If an account exists for ${email}, a six-digit code is on its way.` : `Enter the six-digit code for ${email} to finish signing up.`) : register ? "Set up your UniLink workspace." : recover ? "Enter your account email to request a reset code." : "Sign in to your UniLink workspace.";

  function changeMode(next: Mode) {
    setMode(next);
    setPassword(""); setConfirm(""); setCode(""); setError(""); setNotice(""); setSent(false);
  }

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (register) {
      const result = await requestRegistrationOtp(address);
      if (result.error) throw result.error;
      setNotice(result.developmentOtp ? `Development code · ${result.developmentOtp}` : "");
    } else {
      await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: address }) });
      setNotice("");
    }
    setEmail(address);
    setCode("");
    setSent(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (login) {
        const result = await signIn(email, password, remember);
        if (result.error) throw result.error;
      } else if (!sent) {
        if (register && password !== confirm) throw new Error("Passwords must match.");
        await sendCode();
      } else if (register) {
        const verified = await verifyRegistrationOtp(email, code);
        if (verified.error) throw verified.error;
        const result = await signUp(email, password, first, last, code);
        if (result.error) throw result.error;
      } else {
        if (password !== confirm) throw new Error("Passwords must match.");
        await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, otp: code, password }) });
        changeMode("login");
        setNotice("Password updated. Sign in with your new password.");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Please try again."); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError("");
    try { await sendCode(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to resend the code."); }
    finally { setBusy(false); }
  }

  const newSecret = (register && !sent) || (recover && sent);
  return <main className="ul-auth">
    <header className="ul-header">
      <Link to="/" className="ul-brand"><span><Link2 /></span>UniLink</Link>
      <Link to="/" className="ul-home">Back to home <ArrowUpRight size={15} /></Link>
    </header>
    <div className="ul-layout">
      <SignalArt />
      <section className="ul-panel" aria-labelledby="auth-title">
        <div className="ul-formwrap" key={mode + sent}>
          <h1 id="auth-title">{title}</h1>
          <p className="ul-description">{description}</p>
          <form onSubmit={submit}><fieldset disabled={busy}>
            {register && !sent && <div className="ul-names">
              <Field label="First name" id="first" autoComplete="given-name" maxLength={60} value={first} onChange={e => setFirst(e.target.value)} />
              <Field label="Last name" id="last" autoComplete="family-name" maxLength={60} value={last} onChange={e => setLast(e.target.value)} />
            </div>}
            {!sent && <Field label="Email address" id="email" type="email" autoComplete="email" placeholder="you@domain.com" maxLength={120} value={email} onChange={e => setEmail(e.target.value)} />}
            {sent && <Field label="Verification code" autoFocus id="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} />}
            {(login || newSecret) && <Field label={recover ? "New password" : "Password"} id="password" type="password" autoComplete={login ? "current-password" : "new-password"} value={password}
              minLength={newSecret ? 8 : 1} maxLength={128} pattern={newSecret ? ".*[^A-Za-z0-9].*" : undefined} title={newSecret ? "Use at least eight characters and one symbol." : undefined} onChange={e => setPassword(e.target.value)} />}
            {newSecret && <><small>Use at least eight characters and one symbol.</small><Field label="Confirm password" id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></>}
            {login && <div className="ul-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me</label><button type="button" onClick={() => changeMode("recover")}>Forgot password?</button></div>}
            {register && !sent && <label className="ul-terms"><input type="checkbox" required checked={terms} onChange={e => setTerms(e.target.checked)} /><span>I agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</span></label>}
            {notice && <p className="ul-notice" role="status">{notice}</p>}
            {error && <p className="ul-error" role="alert">{error}</p>}
            <button className="ul-submit" type="submit">{busy ? "Please wait…" : login ? "Sign in" : sent ? (recover ? "Update password" : "Verify and create account") : "Send verification code"}{busy ? <LoaderCircle className="ul-spin" size={18} /> : <ArrowRight size={18} />}</button>
            {sent && <div className="ul-options"><button type="button" onClick={() => { setSent(false); setNotice(""); setError(""); }}>Edit details</button><button type="button" onClick={resend}>Resend code</button></div>}
          </fieldset></form>
          <p className="ul-switch">{recover ? <button disabled={busy} onClick={() => changeMode("login")}>Back to sign in</button> : register ? <>Already have an account? <Link to="/login">Sign in</Link></> : <>New to UniLink? <Link to="/register">Create an account</Link></>}</p>
        </div>
      </section>
    </div>
  </main>;
}
