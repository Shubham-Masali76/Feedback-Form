/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useId,
} from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

const NotificationContext = createContext(null);

let toastId = 0;

function Toast({ message, title, type, onDismiss }) {
  const styles = {
    success: {
      bar: "bg-emerald-500",
      icon: CheckCircle,
      ring: "ring-emerald-200/80",
      bg: "bg-white",
    },
    error: {
      bar: "bg-red-500",
      icon: AlertCircle,
      ring: "ring-red-200/80",
      bg: "bg-white",
    },
    warning: {
      bar: "bg-amber-500",
      icon: AlertTriangle,
      ring: "ring-amber-200/80",
      bg: "bg-white",
    },
    info: {
      bar: "bg-blue-500",
      icon: Info,
      ring: "ring-blue-200/80",
      bg: "bg-white",
    },
  };
  const s = styles[type] ?? styles.info;
  const Icon = s.icon;

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-full max-w-md overflow-hidden rounded-xl border border-slate-200/90 ${s.bg} shadow-soft-lg ring-1 ring-slate-200/40 animate-toast-in`}
    >
      <div className={`w-1 shrink-0 ${s.bar}`} aria-hidden />
      <div className="flex flex-1 gap-3 p-3 min-w-0">
        <Icon
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            type === "success"
              ? "text-emerald-600"
              : type === "error"
                ? "text-red-600"
                : type === "warning"
                  ? "text-amber-600"
                  : "text-blue-600"
          }`}
          strokeWidth={2}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          {title && (
            <p className="text-sm font-semibold text-slate-900 leading-tight mb-0.5">
              {title}
            </p>
          )}
          <p className="text-sm text-slate-600 whitespace-pre-wrap break-words leading-snug">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const regionId = useId();

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback(
    (message, options = {}) => {
      const type = options.type ?? "info";
      const duration =
        options.duration ??
        (type === "error" ? 9000 : type === "warning" ? 7000 : 5000);
      const id = ++toastId;
      const title = options.title;

      setToasts((t) => [...t, { id, message, type, title }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (message, opts) => notify(message, { ...opts, type: "success" }),
    [notify],
  );
  const error = useCallback(
    (message, opts) => notify(message, { ...opts, type: "error" }),
    [notify],
  );
  const warning = useCallback(
    (message, opts) => notify(message, { ...opts, type: "warning" }),
    [notify],
  );
  const info = useCallback(
    (message, opts) => notify(message, { ...opts, type: "info" }),
    [notify],
  );

  const value = { notify, success, error, warning, info, dismiss };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div
        id={regionId}
        className="fixed bottom-4 right-4 z-[200] flex w-[calc(100%-2rem)] max-w-md flex-col gap-2 pointer-events-none sm:right-6"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotify must be used within NotificationProvider");
  }
  return ctx;
}
