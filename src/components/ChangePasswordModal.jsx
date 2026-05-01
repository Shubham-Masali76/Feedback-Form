import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { X, KeyRound, Loader2, Eye, EyeOff } from "lucide-react";
import { useNotify } from "../context/NotificationContext.jsx";

export default function ChangePasswordModal({ open, onClose }) {
  const { success, error: notifyError } = useNotify();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [showPwd3, setShowPwd3] = useState(false);

  useEffect(() => {
    if (!open) {
      // Use a timeout or move to onClose to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setCurrent("");
        setNext("");
        setConfirm("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!current) return notifyError("Please enter your current password.");
    if (!next) return notifyError("Please enter your new password.");
    if (!confirm) return notifyError("Please confirm your new password.");
    
    const user = auth.currentUser;
    if (!user?.email) {
      notifyError("No Firebase account session. Sign in again.");
      return;
    }
    if (next.length < 6) {
      notifyError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      notifyError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, next);
      success("Your password was updated.");
      onClose();
    } catch (err) {
      console.error(err);
      const code = err?.code;
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        notifyError("Current password is incorrect.");
      } else if (code === "auth/weak-password") {
        notifyError("New password is too weak. Use a stronger password.");
      } else if (code === "auth/requires-recent-login") {
        notifyError(
          "For security, sign out, sign in again, then change your password.",
        );
      } else {
        notifyError(err?.message || "Could not update password.");
      }
    }
    setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 z-[300] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div className="block min-h-full p-4 pt-16 pb-20 text-center sm:p-6 sm:pt-24">
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/50 transition-opacity w-full cursor-default"
          onClick={() => !busy && onClose()}
          aria-label="Close"
          tabIndex="-1"
        />
        <div className="relative inline-block text-left w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all align-middle animate-toast-in">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <KeyRound size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2
                  id="change-password-title"
                  className="text-lg font-semibold text-slate-900"
                >
                  Change password
                </h2>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {auth.currentUser?.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                Current password
              </label>
              <div className="relative">
                <input
                  type={showPwd1 ? "text" : "password"}
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="input-app w-full pr-10"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd1(!showPwd1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none"
                  tabIndex="-1"
                >
                  {showPwd1 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPwd2 ? "text" : "password"}
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="input-app w-full pr-10"
                  required
                  minLength={6}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd2(!showPwd2)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none"
                  tabIndex="-1"
                >
                  {showPwd2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  type={showPwd3 ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-app w-full pr-10"
                  required
                  minLength={6}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd3(!showPwd3)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none"
                  tabIndex="-1"
                >
                  {showPwd3 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
              <button
                type="button"
                onClick={() => !busy && onClose()}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
