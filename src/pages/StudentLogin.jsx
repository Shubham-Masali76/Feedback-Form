import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  ROLL_NUMBER_HINT,
} from "../constants/rollNumber";
import CustomSelect from "../components/UI/CustomSelect";
import { useNotify } from "../context/NotificationContext.jsx";
import {
  Mail,
  ArrowRight,
  CheckCircle,
  Lock,
  GraduationCap,
  Shield,
  Sparkles,
  Building2,
  UserCircle,
} from "lucide-react";

export default function StudentLogin({
  onLoginSuccess,
  loginView,
  setLoginView,
}) {
  const { success, error: notifyError } = useNotify();
  const [loading, setLoading] = useState(false);

  const roles = [
    { id: "student", label: "Student Portal" },
    { id: "staff", label: "Staff Portal" },
    { id: "hod", label: "HOD Portal" },
    { id: "admin", label: "Admin Portal" },
  ];

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email;

      // Check if this email exists in our Students collection
      const q = query(
        collection(db, "Students"),
        where("email", "==", userEmail),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        notifyError(
          `Email ${userEmail} is not registered. Please contact your HOD.`,
        );
        await auth.signOut(); // Sign them out if unauthorized
        setLoading(false);
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const student = { id: studentDoc.id, ...studentDoc.data() };

      success(`Welcome back, ${student.name}!`);
      
      onLoginSuccess({
        id: student.id,
        name: student.name,
        email: student.email,
        rollNo: student.rollNo,
        dept: student.department,
        division: student.division,
        targetClass: student.targetClass || student.tClass,
        role: "student",
      });
    } catch (error) {
      console.error("Google Login Error:", error);
      if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
        notifyError("Authentication failed. Please try again.");
      }
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
        {loginView !== "" && (
          <p className="max-w-xs sm:max-w-full text-xs sm:text-sm md:text-base font-medium tracking-wide origin-center leading-snug text-slate-500 mt-1">
            Sign in with your official college email.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-xl shadow-indigo-950/10 ring-1 ring-slate-200/50 backdrop-blur-md">
        <div
          className={`relative overflow-hidden bg-gradient-to-r ${loginView === "" ? "from-slate-700 via-slate-800 to-indigo-900" : "from-blue-600 via-indigo-600 to-cyan-600"} px-4 py-3.5 sm:px-5`}
        >
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              {loginView === "" ? (
                <UserCircle
                  className="text-white"
                  size={22}
                  strokeWidth={2}
                />
              ) : (
                <GraduationCap
                  className="text-white"
                  size={22}
                  strokeWidth={2}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {loginView !== "" && (
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-100/95">
                  <Sparkles size={12} className="shrink-0 text-amber-200" />
                  Secure Access
                </p>
              )}
              <h2 className="font-display truncate text-lg font-extrabold tracking-tight text-white">
                {loginView === "" ? "User sign-in" : "Student sign-in"}
              </h2>
              {loginView !== "" && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-blue-50/95">
                  Identity verified by Google
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-4 sm:px-5">
          {loginView === "" && (
            <div className="mb-3">
              <label
                htmlFor="student-portal-select"
                className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"
              >
                <Building2 size={12} className="text-slate-400" aria-hidden />
                Portal
              </label>
              <CustomSelect
                value={loginView}
                placeholder="Select your role"
                onChange={(val) => setLoginView(val)}
                options={roles.map((r) => ({ value: r.id, label: r.label }))}
              />
            </div>
          )}

          {loginView !== "" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white border border-slate-200 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!loading && (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                )}
                {loading ? "Signing in..." : "Sign in with Google"}
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
            </div>
          )}

          {loginView !== "" && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Secure
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                Identity Verified
              </span>
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                Anonymous
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] leading-snug text-slate-500">
        Feedback is completely anonymous; login only verifies identity.
      </p>
    </div>
  );
}
