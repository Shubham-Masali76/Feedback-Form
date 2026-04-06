import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Send,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ChevronDown,
  Loader2,
  ClipboardList,
} from "lucide-react";
import { Card } from "../components/UI";
import CustomSelect from "../components/UI/CustomSelect";

import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { FEEDBACK_QUESTIONS } from "../constants/feedbackQuestions";
import { useNotify } from "../context/NotificationContext.jsx";

export default function StudentDashboard({ user }) {
  const { success, error: notifyError, warning } = useNotify();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSystemLocked, setIsSystemLocked] = useState(true);

  const [selectedAllocation, setSelectedAllocation] = useState("");
  const [ratings, setRatings] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReviews, setSubmittedReviews] = useState([]);

  useEffect(() => {
    const fetchSystemStatusAndData = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, "Settings", "Global"));

        if (
          !settingsSnap.exists() ||
          settingsSnap.data().studentPortalOpen !== true
        ) {
          setIsSystemLocked(true);
          return;
        }

        setIsSystemLocked(false);

        const q = query(
          collection(db, "Allocations"),
          where("department", "==", user.dept),
        );
        const querySnapshot = await getDocs(q);

        const allocData = [];
        querySnapshot.forEach((doc) => {
          allocData.push({ id: doc.id, ...doc.data() });
        });
        setAllocations(allocData);
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStatusAndData();
  }, [user.dept]);

  const handleRatingChange = (questionIndex, value) => {
    setRatings((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (Object.keys(ratings).length < FEEDBACK_QUESTIONS.length) {
      warning(
        `Please answer all ${FEEDBACK_QUESTIONS.length} questions before submitting.`,
      );
      return;
    }

    if (!selectedAllocation) {
      warning("Select a subject to review first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetData = allocations.find((a) => a.id === selectedAllocation);
      const targetClass =
        targetData?.targetClass ?? targetData?.tClass ?? "";
      if (!targetData || !targetClass) {
        notifyError(
          "This subject is missing class information. Ask your HOD to check the faculty allotment.",
        );
        setIsSubmitting(false);
        return;
      }

      let totalScore = 0;
      Object.values(ratings).forEach((val) => (totalScore += parseInt(val)));

      await addDoc(collection(db, "Feedbacks"), {
        studentName: user.name,
        department: user.dept,
        staffName: targetData.staff,
        subject: targetData.subject,
        targetClass,
        isElective: targetData.isElective || false,
        scores: ratings,
        totalScore: totalScore,
        createdAt: new Date(),
      });

      success(
        `Feedback for ${targetData.subject} was submitted anonymously.`,
      );

      const newSubmittedReviews = [...submittedReviews, selectedAllocation];
      setSubmittedReviews(newSubmittedReviews);
      setSelectedAllocation("");
      setRatings({});

      // OPTIONAL: If you want to lock the student out after they finish ALL their subjects,
      // you would run the updateDoc({status: 'completed'}) here by comparing lengths.
    } catch (error) {
      console.error("Error submitting feedback: ", error);
      notifyError("Could not submit feedback. Please try again.");
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-5 p-8">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-indigo-400/25 blur-2xl" />
          <Loader2
            className="relative animate-spin text-indigo-600"
            size={44}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <p className="text-sm font-medium text-slate-600">
          Preparing your subjects…
        </p>
      </div>
    );
  }

  if (isSystemLocked && !loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="max-w-md overflow-hidden border-red-200/80 p-0 text-center shadow-soft-lg">
          <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <AlertCircle className="text-white" size={32} strokeWidth={1.75} />
            </div>
            <h1 className="font-display mt-4 text-xl font-bold text-white">
              Portal closed
            </h1>
          </div>
          <div className="bg-gradient-to-b from-red-50/80 to-white px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-700">
              Your HOD has not opened the feedback window yet. Please check
              again later.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // --- SMART FILTERING ---
  // Separate the subjects into Mandatory and Elective
  const mandatoryAllocations = allocations.filter((a) => !a.isElective);
  const electiveAllocations = allocations.filter((a) => a.isElective);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 px-6 py-8 sm:px-10 sm:py-9 shadow-glow-emerald">
        <div
          className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-[-20%] h-48 w-72 rounded-full bg-cyan-400/20 blur-3xl"
          aria-hidden
        />
        <header className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100/90">
              Anonymous feedback
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Student feedback
            </h1>
            <p className="mt-2 text-sm font-medium text-emerald-50/95">
              {user.name}
              <span className="mx-2 text-emerald-200/70">·</span>
              {user.dept}
            </p>
          </div>
          <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/15 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur-sm">
            <CheckCircle size={20} className="shrink-0 text-emerald-100" />
            Portal open — submit anytime
          </div>
        </header>
      </div>

      <div className="grid lg:grid-cols-3 gap-7">
        <div className="lg:col-span-1 space-y-4">
          <Card className="overflow-hidden p-0 !shadow-soft-lg ring-1 ring-slate-200/60">
            <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 text-white">
              <h2 className="font-display flex items-center gap-2 text-lg font-bold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <BookOpen size={18} strokeWidth={2} />
                </span>
                Your subjects
              </h2>
              <p className="mt-1.5 text-xs font-medium text-slate-300">
                Tap a subject, then complete the form on the right.
              </p>
            </div>
            <div className="p-5">
            {allocations.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-300/90 bg-gradient-to-b from-slate-50 to-white py-12 px-4 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/80 shadow-inner">
                  <ClipboardList
                    className="text-slate-500"
                    strokeWidth={1.5}
                    size={28}
                    aria-hidden
                  />
                </div>
                <p className="font-display text-base font-bold text-slate-800">
                  No subjects yet
                </p>
                <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-600">
                  Ask your HOD if allocations are set up for your class.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {mandatoryAllocations.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Core subjects
                    </p>
                    {mandatoryAllocations.map((alloc) => {
                      const isCompleted = submittedReviews.includes(alloc.id);
                      return (
                        <button
                          type="button"
                          key={alloc.id}
                          onClick={() =>
                            !isCompleted && setSelectedAllocation(alloc.id)
                          }
                          disabled={isCompleted}
                          className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                            isCompleted
                              ? "cursor-not-allowed border-slate-200/80 bg-slate-50/90 opacity-75"
                              : selectedAllocation === alloc.id
                                ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/40"
                                : "border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-md"
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2 mb-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                isCompleted
                                  ? "text-slate-400"
                                  : selectedAllocation === alloc.id
                                    ? "text-blue-100/90"
                                    : "text-slate-500"
                              }`}
                            >
                              {alloc.targetClass ?? alloc.tClass ?? "—"}
                            </span>
                            {isCompleted && (
                              <CheckCircle
                                size={18}
                                className="text-emerald-500 shrink-0"
                                aria-label="Submitted"
                              />
                            )}
                          </div>
                          <h3
                            className={`font-display text-base font-bold leading-tight ${
                              selectedAllocation === alloc.id && !isCompleted
                                ? "text-white"
                                : "text-slate-900"
                            } ${isCompleted ? "text-slate-600" : ""}`}
                          >
                            {alloc.subject}
                          </h3>
                          <p
                            className={`text-xs font-medium mt-1.5 ${
                              selectedAllocation === alloc.id && !isCompleted
                                ? "text-blue-100/95"
                                : "text-slate-500"
                            } ${isCompleted ? "text-slate-400" : ""}`}
                          >
                            {alloc.staff}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {electiveAllocations.length > 0 && (
                  <div className="space-y-3 pt-5 border-t border-slate-200/80">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Elective
                    </p>
                    <div className="relative">
                      <label htmlFor="elective-select" className="sr-only">
                        Elective subject
                      </label>
                      <CustomSelect
                        value={
                          electiveAllocations.find(
                            (a) => a.id === selectedAllocation,
                          )
                            ? selectedAllocation
                            : ""
                        }
                        onChange={(val) => {
                          if (val && !submittedReviews.includes(val)) {
                            setSelectedAllocation(val);
                          }
                        }}
                        options={electiveAllocations.map((alloc) => {
                          const isCompleted = submittedReviews.includes(alloc.id);
                          return {
                            value: alloc.id,
                            label: `${alloc.subject} — Taught by ${alloc.staff}${isCompleted ? " (Completed)" : ""}`
                          };
                        })}
                        placeholder="Choose elective…"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full overflow-hidden p-0 !shadow-soft-lg ring-1 ring-slate-200/50">
            {!selectedAllocation ? (
              <div className="relative flex h-full min-h-[360px] flex-col items-center justify-center overflow-hidden px-6 py-14 text-center">
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/90 via-white to-cyan-50/80"
                  aria-hidden
                />
                <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-100 to-cyan-100 shadow-inner ring-1 ring-white">
                  <GraduationCap
                    className="text-indigo-600"
                    size={44}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <h2 className="font-display relative text-2xl font-bold text-slate-900">
                  Pick a subject to begin
                </h2>
                <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                  Choose from the list or elective menu on the left. All ratings
                  are anonymous.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col">
                <div className="border-b border-slate-200/80 bg-gradient-to-r from-indigo-600 via-blue-700 to-cyan-700 px-6 py-6 md:px-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/90">
                    Confidential
                  </p>
                  <h2 className="font-display mt-2 text-2xl font-bold text-white">
                    Faculty evaluation
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100/95">
                    Rate each statement from{" "}
                    <strong className="text-white">1 (poor)</strong> to{" "}
                    <strong className="text-white">5 (excellent)</strong>.
                  </p>
                </div>
                <div className="space-y-5 bg-gradient-to-b from-slate-50/80 to-white p-6 md:p-8">
                  {FEEDBACK_QUESTIONS.map((q, idx) => (
                    <fieldset
                      key={idx}
                      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80"
                    >
                      <legend className="sr-only">Question {idx + 1}</legend>
                      <p className="text-sm font-medium leading-relaxed text-slate-800 mb-5">
                        <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/80 text-xs font-bold text-slate-600 shadow-inner">
                          {idx + 1}
                        </span>
                        {q}
                      </p>
                      <div
                        className="flex flex-wrap gap-2 sm:gap-2.5"
                        role="radiogroup"
                        aria-label={`Question ${idx + 1}`}
                      >
                        {[1, 2, 3, 4, 5].map((num) => {
                          const selected = ratings[idx] === num;
                          return (
                            <label
                              key={num}
                              className={`relative cursor-pointer rounded-xl border-2 px-4 py-2.5 text-center text-sm font-bold transition-all duration-150 ${
                                selected
                                  ? "border-transparent bg-gradient-to-b from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-600/25"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`question-${idx}`}
                                value={num}
                                checked={selected}
                                onChange={() => handleRatingChange(idx, num)}
                                className="sr-only"
                              />
                              {num}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>

                <div className="border-t border-slate-200/80 bg-white px-6 py-6 md:px-8">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-indigo-700 py-4 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-700 hover:to-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={20} aria-hidden />
                    {isSubmitting ? "Submitting…" : "Submit anonymous feedback"}
                  </button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
