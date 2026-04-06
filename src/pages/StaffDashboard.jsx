import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  Star,
  BookOpen,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Card } from "../components/UI";
import CustomSelect from "../components/UI/CustomSelect";
import DonutChart from "../components/DonutChart";
import QuestionDonutChart from "../components/QuestionDonutChart";
import { FEEDBACK_QUESTIONS } from "../constants/feedbackQuestions";

/** Same as student submit + HOD allotment: class may live on targetClass or tClass. */
function classKey(row) {
  const c = row?.targetClass ?? row?.tClass ?? "";
  return typeof c === "string" ? c.trim() : String(c);
}

function subjectClassValue(row) {
  const subj = row?.subject ?? "";
  const ck = classKey(row);
  return `${subj}-${ck}`;
}

export default function StaffDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [isStaffPortalOpen, setIsStaffPortalOpen] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        // Gate staff analytics behind a global toggle.
        const settingsSnap = await getDoc(doc(db, "Settings", "Global"));
        const staffOpen =
          settingsSnap.exists() && settingsSnap.data().staffPortalOpen === true;
        setIsStaffPortalOpen(staffOpen);

        // If portal is closed, don't fetch anything else.
        if (!staffOpen) return;

        // 1. Fetch Subjects Allotted to this specific teacher
        const allocQ = query(
          collection(db, "Allocations"),
          where("staff", "==", user.name),
        );
        const allocSnap = await getDocs(allocQ);
        const allocData = allocSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setAllocations(allocData);

        // 2. Fetch all feedback submitted for this specific teacher
        const feedQ = query(
          collection(db, "Feedbacks"),
          where("staffName", "==", user.name),
        );
        const feedSnap = await getDocs(feedQ);
        const feedData = feedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setFeedbacks(feedData);

        // Auto-select the first subject if available
        if (allocData.length > 0) {
          setSelectedSubject(subjectClassValue(allocData[0]));
        }
      } catch (error) {
        console.error("Error fetching staff data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
  }, [user.name]);

  // --- REPORT CALCULATION ENGINE ---
  // Filter feedbacks for the currently selected dropdown option
  const currentFeedbacks = feedbacks.filter(
    (f) => subjectClassValue(f) === selectedSubject,
  );
  const totalResponses = currentFeedbacks.length;

  const qCount = FEEDBACK_QUESTIONS.length;
  let overallAverage = 0;
  const questionAverages = Array(qCount).fill(0);

  // Initialize scoreCounts for each question
  const scoreCounts = Array.from({ length: qCount }, () => ({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  }));

  if (totalResponses > 0) {
    let totalScoreSum = 0;

    currentFeedbacks.forEach((feedback) => {
      // Calculate sum for each specific question
      Object.keys(feedback.scores).forEach((qIndex) => {
        const rating = parseInt(feedback.scores[qIndex]);
        questionAverages[qIndex] += rating;
        // Track rating counts
        if (scoreCounts[qIndex][rating] !== undefined)
          scoreCounts[qIndex][rating]++;
      });
      // Add to grand total
      totalScoreSum += feedback.totalScore;
    });

    // Calculate Final Averages
    for (let i = 0; i < qCount; i++) {
      questionAverages[i] = (questionAverages[i] / totalResponses).toFixed(1);
    }
    // Max possible score per student is qCount questions * 5 points
    // We want the overall average out of 5
    overallAverage = (totalScoreSum / totalResponses / qCount).toFixed(1);
  }

  if (loading)
    return (
      <div className="min-h-[45vh] flex flex-col items-center justify-center gap-5 p-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-400/30 blur-xl scale-150 animate-pulse" />
          <Loader2
            className="relative animate-spin text-blue-600"
            size={44}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <p className="text-sm font-medium text-slate-600">
          Gathering your feedback analytics…
        </p>
      </div>
    );

  if (!isStaffPortalOpen) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="max-w-md overflow-hidden border-red-200/80 p-0 text-center shadow-soft-lg">
          <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4">
            <h1 className="font-display text-xl font-bold text-white">
              Portal closed
            </h1>
            <p className="mt-1 text-sm text-white/90">
              Ask your HOD to open the feedback window for staff.
            </p>
          </div>
          <div className="bg-gradient-to-b from-red-50/80 to-white px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-700">
              When the portal is opened, you will be able to view subject
              ratings and question-wise breakdowns here.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 px-6 py-8 sm:px-10 sm:py-10 shadow-glow-blue">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/4 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-blue-300/90">
              Performance overview
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Faculty dashboard
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-blue-100/90">
              {user.name}
              <span className="mx-2 text-blue-400/80">·</span>
              {user.dept}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <BarChart3 className="text-white" size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200/80">
                Live reports
              </p>
              <p className="text-xs font-medium text-white/95">
                Switch subject below to refresh scores
              </p>
            </div>
          </div>
        </div>
      </div>

      {allocations.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-300/90 bg-gradient-to-b from-white to-slate-50 p-10 text-center shadow-soft-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 shadow-inner">
            <BookOpen className="text-slate-500" size={30} strokeWidth={1.5} />
          </div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            No subjects assigned yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Ask your HOD to map you in Faculty Allotment. Your question-wise
            averages and ratings will appear here once students submit feedback.
          </p>
        </Card>
      ) : (
        <div className="space-y-7">
          {/* Top Row: Context & Overall Snapshot */}
          <div className="grid lg:grid-cols-3 gap-7">
            <div className="lg:col-span-1 space-y-4">
              <Card className="overflow-hidden p-0 !shadow-soft-lg ring-1 ring-slate-200/60">
                <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 text-white">
                  <h2 className="font-display flex items-center gap-2 text-lg font-bold">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                      <BookOpen size={18} strokeWidth={2} />
                    </span>
                    Subject &amp; class
                  </h2>
                  <p className="mt-1.5 text-xs font-medium text-blue-100/90">
                    Each option filters every chart and total on this page.
                  </p>
                </div>
                <div className="bg-slate-50/80 p-5">
                  <label htmlFor="staff-subject" className="sr-only">
                    Subject and class
                  </label>
                  <CustomSelect
                    value={selectedSubject}
                    onChange={(val) => setSelectedSubject(val)}
                    options={allocations.map((alloc) => {
                      const ck = classKey(alloc);
                      return {
                        value: subjectClassValue(alloc),
                        label: `${alloc.subject}${ck ? ` (${ck})` : " (class not set)"}`,
                      };
                    })}
                    placeholder="-- Select Subject --"
                  />
                </div>

                <div className="space-y-4 border-t border-slate-200/80 bg-white px-5 py-5">
                  <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-5 text-white shadow-lg shadow-blue-900/25 ring-1 ring-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/85">
                      Overall rating
                    </p>
                    <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
                      {totalResponses > 0 ? overallAverage : "0.0"}
                      <span className="ml-1 text-xl font-semibold text-blue-200/90">
                        / 5
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Responses received
                    </p>
                    <p className="mt-2 flex items-center gap-3 font-display text-3xl font-bold tabular-nums text-slate-900">
                      {totalResponses}
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Users size={20} strokeWidth={2} />
                      </span>
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {/* Overall Rating Distribution Donut Chart */}
              <Card className="h-full overflow-hidden p-0 !shadow-soft-lg ring-1 ring-slate-200/50">
                <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 px-5 py-4 md:px-7">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Overall Feedback Distribution
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Rating distribution across all student responses for this
                    subject and class.
                  </p>
                </div>
                <div className="bg-gradient-to-b from-slate-50/50 to-white p-5 md:p-7">
                  {totalResponses === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 py-16 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-50 shadow-inner">
                        <Star
                          className="text-amber-500"
                          size={32}
                          strokeWidth={1.25}
                        />
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-800">
                        Waiting for responses
                      </h3>
                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                        When students submit feedback for this subject and
                        class, you&apos;ll see rating distributions and question
                        breakdowns here.
                      </p>
                    </div>
                  ) : (
                    <div>
                      {/* Overall stats */}
                      <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-blue-50 p-4 text-center">
                          <p className="text-xs font-semibold text-blue-600 upper uppercase">
                            Total Responses
                          </p>
                          <p className="mt-1 text-2xl font-bold text-blue-900">
                            {totalResponses}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-4 text-center">
                          <p className="text-xs font-semibold text-emerald-600 uppercase">
                            Overall Rating
                          </p>
                          <p className="mt-1 text-2xl font-bold text-emerald-900">
                            {overallAverage} / 5.0
                          </p>
                        </div>
                      </div>
                      <DonutChart
                        data={[
                          {
                            name: "Excellent (5)",
                            value: Object.values(scoreCounts).reduce(
                              (sum, counts) => sum + counts[5],
                              0,
                            ),
                          },
                          {
                            name: "Very Good (4)",
                            value: Object.values(scoreCounts).reduce(
                              (sum, counts) => sum + counts[4],
                              0,
                            ),
                          },
                          {
                            name: "Good (3)",
                            value: Object.values(scoreCounts).reduce(
                              (sum, counts) => sum + counts[3],
                              0,
                            ),
                          },
                          {
                            name: "Satisfactory (2)",
                            value: Object.values(scoreCounts).reduce(
                              (sum, counts) => sum + counts[2],
                              0,
                            ),
                          },
                          {
                            name: "Poor (1)",
                            value: Object.values(scoreCounts).reduce(
                              (sum, counts) => sum + counts[1],
                              0,
                            ),
                          },
                        ]}
                        colors={[
                          "#22c55e",
                          "#3b82f6",
                          "#eab308",
                          "#f97316",
                          "#ef4444",
                        ]}
                        height={350}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Bottom Row: Full Width Question-wise Donut Charts */}
          {totalResponses > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 px-5 py-4 md:px-7">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Question-wise Breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Rating distribution for each evaluation criterion. Hover over
                  segments to see exact counts and percentages.
                </p>
              </div>
              <div className="bg-gradient-to-b from-slate-50/50 to-white p-5 md:p-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {FEEDBACK_QUESTIONS.map((q, idx) => (
                    <QuestionDonutChart
                      key={idx}
                      questionNumber={idx + 1}
                      questionText={q}
                      scoreCounts={scoreCounts[idx]}
                      totalResponses={totalResponses}
                    />
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
