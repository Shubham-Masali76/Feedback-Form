import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  isDark = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isBottomClipped = rect.bottom + 250 > window.innerHeight;

    setDropdownStyle({
      position: "fixed",
      minWidth: Math.min(rect.width, window.innerWidth - 32) + "px",
      maxWidth: "calc(100vw - 32px)",
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)) + "px",
      top: isBottomClipped ? "auto" : rect.bottom + 8 + "px",
      bottom: isBottomClipped
        ? window.innerHeight - rect.top + 8 + "px"
        : "auto",
      zIndex: 9999,
    });
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        // We also need to check if the click was inside the portal
        const isPortalClick = event.target.closest(".custom-select-portal");
        if (!isPortalClick) {
          setIsOpen(false);
        }
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen && containerRef.current) {
        updatePosition();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen]);

  let selectedLabel = "";
  for (const opt of options) {
    if (opt.group) {
      const found = opt.options.find((o) => o.value === value);
      if (found) {
        selectedLabel = found.label;
        break;
      }
    } else {
      if (opt.value === value) {
        selectedLabel = opt.label;
        break;
      }
    }
  }

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
  };

  const currentTheme = isDark
    ? "bg-white/10 text-white border-white/20 hover:bg-white/20 focus:ring-indigo-400"
    : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 focus:border-indigo-400";

  const dropdownTheme = isDark
    ? "bg-slate-800 border-slate-700 shadow-xl shadow-black/50"
    : "bg-white border-slate-100 shadow-xl shadow-slate-200";

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-2 ${currentTheme}`}
      >
        <span
          className={`truncate text-left flex-1 mr-4 ${!value ? (isDark ? "text-indigo-200/50" : "text-slate-600") : ""}`}
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`transition-transform duration-300 shrink-0 ${isOpen ? "rotate-180" : ""} ${isDark ? "text-indigo-300" : "text-slate-400"}`}
        />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`custom-select-portal animate-in fade-in zoom-in-95 duration-200 max-h-64 overflow-y-auto rounded-xl border p-1.5 ${dropdownTheme}`}
            style={dropdownStyle}
          >
            {(options.length === 0 ||
              options.every(
                (opt) => opt.group && opt.options.length === 0,
              )) && (
              <div
                className={`p-3 text-center text-xs font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                No options
              </div>
            )}

            {options.map((opt, i) => {
              if (opt.group) {
                if (opt.options.length === 0) return null;
                return (
                  <div key={i} className="mb-2 last:mb-0">
                    <div
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${isDark ? "text-indigo-400" : "text-slate-400"}`}
                    >
                      {opt.group}
                    </div>
                    {opt.options.map((o) => (
                      <OptionItem
                        key={o.value}
                        option={o}
                        selectedValue={value}
                        onSelect={handleSelect}
                        isDark={isDark}
                      />
                    ))}
                  </div>
                );
              }
              return (
                <OptionItem
                  key={opt.value || i}
                  option={opt}
                  selectedValue={value}
                  onSelect={handleSelect}
                  isDark={isDark}
                />
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

function OptionItem({ option, selectedValue, onSelect, isDark }) {
  const isSelected = option.value === selectedValue;

  const hoverClass = isDark
    ? "hover:bg-indigo-500/20 active:bg-indigo-500/30 text-slate-200"
    : "hover:bg-indigo-50 active:bg-indigo-100 text-slate-700";

  const selectedClass = isDark
    ? "bg-indigo-600/30 text-indigo-200"
    : "bg-indigo-50 text-indigo-700";

  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-all ${
        isSelected ? selectedClass : hoverClass
      }`}
    >
      <span className="pr-2 break-words">{option.label}</span>
      {isSelected && (
        <Check
          size={16}
          className={`shrink-0 ${isDark ? "text-indigo-300" : "text-indigo-600"}`}
          strokeWidth={3}
        />
      )}
    </button>
  );
}
