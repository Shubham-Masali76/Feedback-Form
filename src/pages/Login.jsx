import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import CustomSelect from "../components/UI/CustomSelect";
import { useNotify } from "../context/NotificationContext.jsx";

export default function Login({
  onLoginSuccess,
  portalType,
  setLoginView,
}) {
  const { error: notifyError, warning } = useNotify();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const portalConfig = {
    staff: {
      title: "Staff sign-in",
      desc: "Use the email and password issued by your administrator.",
    },
    hod: {
      title: "HOD sign-in",
      desc: "Department head access — manage students, allotments, and reports.",
    },
    admin: {
      title: "Admin sign-in",
      desc: "College-wide setup: departments, accounts, and global reports.",
    },
  };

  const currentConfig = portalConfig[portalType] || portalConfig.staff;

  const headerGradient =
    portalType === "hod"
      ? "from-violet-600 via-purple-700 to-indigo-900"
      : portalType === "admin"
        ? "from-slate-800 via-violet-900 to-slate-950"
        : "from-slate-700 via-slate-800 to-indigo-900";

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim()) return warning("Please enter your email address.");
    if (!password) return warning("Please enter your password.");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const userDoc = await getDoc(doc(db, "Users", userCredential.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        if (userData.role === "student") {
          warning("Students must sign in through the Student Portal.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        if (userData.active === false && userData.role !== "student") {
          notifyError(
            "This account has been deactivated. Contact the administrator.",
          );
          await signOut(auth);
          setLoading(false);
          return;
        }

        onLoginSuccess({ id: userCredential.user.uid, ...userData });
      } else {
        notifyError("User profile not found. Contact the administrator.");
        auth.signOut();
      }
    } catch (error) {
      console.error(error);
      notifyError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md px-1 sm:px-0">
      <div className="mb-4 flex flex-col items-center text-center px-2">
        <h1 className="flex w-full items-center justify-center py-2 font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight origin-center pb-1">
          <span className="bg-gradient-to-r from-blue-700 to-indigo-900 bg-clip-text text-transparent">
            Feedback Portal
          </span>
        </h1>
        <h2 className="font-display text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-blue-600 uppercase tracking-wide sm:tracking-widest origin-center mt-2 mb-2">
          SES Polytechnic Solapur
        </h2>
        <p className="max-w-xs text-xs sm:text-sm font-medium tracking-wide origin-center leading-snug text-slate-500 mt-1">
          Staff, HOD &amp; admin — institutional email sign-in.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-xl shadow-indigo-950/10 ring-1 ring-slate-200/50 backdrop-blur-md">
        <div
          className={`relative overflow-hidden bg-gradient-to-r px-4 py-3.5 sm:px-5 ${headerGradient}`}
        >
          <div
            className="pointer-events-none absolute -right-12 top-0 h-36 w-36 rounded-full bg-white/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <ShieldCheck className="text-white" size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80">
                <Sparkles size={12} className="shrink-0 text-amber-200" />
                Staff access
              </p>
              <h2 className="font-display truncate text-lg font-extrabold tracking-tight text-white">
                {currentConfig.title}
              </h2>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/85">
                {currentConfig.desc}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-4 sm:px-5">
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label
                htmlFor="staff-email"
                className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-800"
              >
                <Mail size={13} className="text-indigo-500" aria-hidden />
                Email
              </label>
              <input
                id="staff-email"
                type="email"
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-app py-2 text-sm"
                required
              />
            </div>
            <div>
              <label
                htmlFor="staff-password"
                className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-800"
              >
                <Lock size={13} className="text-indigo-500" aria-hidden />
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-app py-2 text-sm pr-10 w-full"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-indigo-700 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight size={17} aria-hidden />}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setLoginView("")}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition"
              >
                ← Change Role
              </button>
            </div>
          </form>
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] leading-snug text-slate-500">
        Authorized use only. Misuse may be logged per college policy.
      </p>
    </div>
  );
}
