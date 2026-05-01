import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import emailjs from "@emailjs/browser";
import {
  isValidRollNumber,
  normalizeRollDigits,
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
  const { success, error: notifyError, warning } = useNotify();
  const [step, setStep] = useState(1);
  const [rollNo, setRollNo] = useState("");
  const [enrollNo, setEnrollNo] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [validOtps, setValidOtps] = useState([]);
  const [otpTimestamp, setOtpTimestamp] = useState(null);
  const [sentRollNo, setSentRollNo] = useState("");
  const [sentEnrollNo, setSentEnrollNo] = useState("");

  const roles = [
    { id: "student", label: "Student Portal" },
    { id: "staff", label: "Staff Portal" },
    { id: "hod", label: "HOD Portal" },
    { id: "admin", label: "Admin Portal" },
  ];

  const handleSendOTP = async (e, forceResend = false) => {
    e?.preventDefault?.();
    const rollNormalized = normalizeRollDigits(rollNo);
    const prnNormalized = enrollNo.trim();
    if (!isValidRollNumber(rollNormalized)) {
      warning(ROLL_NUMBER_HINT);
      return;
    }
    if (!prnNormalized) {
      warning("Please enter your Enrollment (PRN) number.");
      return;
    }

    if (
      !forceResend &&
      validOtps.length > 0 &&
      rollNormalized === sentRollNo &&
      prnNormalized === sentEnrollNo
    ) {
      if (otpTimestamp && Date.now() - otpTimestamp < 5 * 60 * 1000) {
        setStep(2);
        success("OTP is still valid. Continuing to verification.");
        return;
      }
    }

    setLoading(true);

    try {
      const q = query(
        collection(db, "Students"),
        where("rollNo", "==", rollNormalized),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        notifyError(
          "Invalid roll number or enrollment number. Check and try again.",
        );
        setLoading(false);
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const student = { id: studentDoc.id, ...studentDoc.data() };

      if (student.enrollmentNo !== enrollNo.trim()) {
        notifyError(
          "Enrollment number does not match our records. Check your PRN and try again.",
        );
        setLoading(false);
        return;
      }

      if (!student.email) {
        notifyError(
          "No email is registered for this profile. Please contact your HOD.",
        );
        setLoading(false);
        return;
      }

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setValidOtps((prev) => [...prev, newOtp]);
      setOtpTimestamp(Date.now());
      setSentRollNo(rollNormalized);
      setSentEnrollNo(prnNormalized);
      setStudentData(student);

      const templateParams = {
        to_email: student.email,
        to_name: student.name,
        otp_code: newOtp,
      };

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
      );

      setStep(2);
      const maskedEmail = student.email.replace(
        /(.{2})(.*)(?=@)/,
        function (gp1, gp2, gp3) {
          for (let i = 0; i < gp3.length; i++) {
            gp2 += "*";
          }
          return gp2;
        },
      );

      success(`OTP sent to ${maskedEmail}. Check your inbox.`);
    } catch (error) {
      console.error("Login Error:", error);
      notifyError("Something went wrong. Please try again later.");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpInput.trim()) return warning("Please enter the 6-digit OTP.");
    setLoading(true);

    if (validOtps.includes(otpInput)) {
      if (otpTimestamp && Date.now() - otpTimestamp > 5 * 60 * 1000) {
        notifyError(
          "OTP has expired (Valid for 5 mins). Please request a new one.",
        );
        setLoading(false);
        return;
      }

      onLoginSuccess({
        id: studentData.id,
        name: studentData.name,
        email: studentData.email,
        rollNo: studentData.rollNo,
        dept: studentData.department,
        division: studentData.division,
        targetClass: studentData.targetClass,
        role: "student",
      });
    } else {
      notifyError("Invalid OTP. Access denied.");
      setLoading(false);
    }
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
            Roll + PRN, then one-time code to your email.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-xl shadow-indigo-950/10 ring-1 ring-slate-200/50 backdrop-blur-md">
        <div
          className={`relative overflow-hidden bg-gradient-to-r ${loginView === "" ? "from-slate-700 via-slate-800 to-indigo-900" : "from-blue-600 via-indigo-600 to-cyan-600"} px-4 py-3.5 sm:px-5`}
        >
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              {step === 1 ? (
                loginView === "" ? (
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
                )
              ) : (
                <Mail className="text-white" size={22} strokeWidth={2} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {loginView !== "" && (
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-100/95">
                  <Sparkles size={12} className="shrink-0 text-amber-200" />
                  {step === 1 ? "Step 1" : "Step 2"}
                </p>
              )}
              <h2 className="font-display truncate text-lg font-extrabold tracking-tight text-white">
                {step === 1
                  ? loginView === ""
                    ? "User sign-in"
                    : "Student sign-in"
                  : "Enter OTP"}
              </h2>
              {loginView !== "" && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-blue-50/95">
                  {step === 1
                    ? "We email an OTP after roll & PRN match."
                    : "6-digit code from your inbox."}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-4 py-4 sm:px-5">
          {step === 1 && loginView === "" && (
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

          {step === 1 && loginView !== "" && (
            <div
              className="space-y-3"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendOTP(e);
              }}
            >
              <div>
                <label
                  htmlFor="student-roll"
                  className="mb-1 block text-xs font-semibold text-slate-800"
                >
                  Roll no.{" "}
                  <span className="font-normal text-slate-500">(4 digits)</span>
                </label>
                <input
                  id="student-roll"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="e.g. 1523"
                  maxLength={4}
                  value={rollNo}
                  onChange={(e) =>
                    setRollNo(normalizeRollDigits(e.target.value))
                  }
                  className="input-app py-2 tabular-nums text-sm font-semibold"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  <span className="font-medium text-slate-600">15</span>xx /
                  <span className="font-medium text-slate-600"> 25</span>xx /
                  <span className="font-medium text-slate-600"> 35</span>xx —
                  yrs 1–3
                </p>
              </div>
              <div>
                <label
                  htmlFor="student-prn"
                  className="mb-1 block text-xs font-semibold text-slate-800"
                >
                  Enrollment (PRN)
                </label>
                <input
                  id="student-prn"
                  type="text"
                  autoComplete="off"
                  placeholder="PRN on ID card"
                  value={enrollNo}
                  onChange={(e) => setEnrollNo(e.target.value)}
                  className="input-app py-2 tabular-nums text-sm font-semibold"
                  required
                />
              </div>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-indigo-700 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send code to email"}
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
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-3">
              <div>
                <label
                  htmlFor="student-otp"
                  className="mb-1 block text-xs font-semibold text-slate-800"
                >
                  One-time code
                </label>
                <input
                  id="student-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="input-app py-2.5 text-center font-display text-lg font-bold tracking-[0.35em] text-slate-900"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-600 to-teal-700 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:from-emerald-700 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Verify & continue"}
                {!loading && <CheckCircle size={17} aria-hidden />}
              </button>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/2 py-1 text-center text-xs font-semibold text-slate-600 hover:text-indigo-700 transition"
                >
                  ← Back
                </button>
                <div className="h-4 w-px bg-slate-200" aria-hidden />
                <button
                  type="button"
                  onClick={(e) => handleSendOTP(e, true)}
                  disabled={loading}
                  className="w-1/2 py-1 text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {loginView !== "" && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Secure
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                Email OTP
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
        Feedback is anonymous; login only verifies your identity.
      </p>
    </div>
  );
}
