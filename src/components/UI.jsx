import React from "react";

export const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-2xl border border-slate-200/90 bg-white shadow-soft overflow-hidden card-print transition-shadow duration-200 hover:shadow-md hover:border-slate-200/95 ${className}`}
  >
    {children}
  </div>
);

export const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  title = "",
}) => {
  const base =
    "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 no-print disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary:
      "bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-600/25",
    secondary:
      "bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300",
    ghost: "text-slate-700 hover:bg-slate-100/90 rounded-xl",
    success:
      "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-emerald-800",
    danger:
      "bg-red-50 text-red-800 hover:bg-red-100 border border-red-200/90 shadow-sm",
  };
  return (
    <button
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
};
