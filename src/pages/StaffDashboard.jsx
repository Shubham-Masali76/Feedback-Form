import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  Star,
  BookOpen,
  ChevronDown,
  Loader2,
  FileText,
  Plus,
  Trash2,
  Save,
  ToggleLeft,
  ToggleRight,
  Send
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { Card, Button } from "../components/UI";
import CustomSelect from "../components/UI/CustomSelect";
import DonutChart from "../components/DonutChart";
import QuestionDonutChart from "../components/QuestionDonutChart";
import { FEEDBACK_QUESTIONS } from "../constants/feedbackQuestions";
import { useNotify } from "../context/NotificationContext";

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
  const { success, error: notifyError, warning } = useNotify();
  const [loading, setLoading] = useState(true);
  const [isStaffPortalOpen, setIsStaffPortalOpen] = useState(false);
  const [allocations, setAllocations] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [exitForms, setExitForms] = useState({});
  const [exitResponses, setExitResponses] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [activeTab, setActiveTab] = useState("exit-forms");
  const [reportTab, setReportTab] = useState("faculty"); // "faculty" | "exit"

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        // Gate staff analytics behind a global toggle.
        const settingsSnap = await getDoc(doc(db, "Settings", "Global"));
        const staffOpen =
          settingsSnap.exists() && settingsSnap.data().staffPortalOpen === true;
        setIsStaffPortalOpen(staffOpen);



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

        // 3. Fetch Course Exit Forms defined by this teacher
        const exitQ = query(
          collection(db, "CourseExitForms"),
          where("staffName", "==", user.name)
        );
        const exitSnap = await getDocs(exitQ);
        const evData = {};
        exitSnap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const targetClass = classKey(d);
          evData[`${d.subject}-${targetClass}`] = { id: docSnap.id, ...d };
        });
        setExitForms(evData);

        // 4. Fetch Course Exit Responses 
        const exitResQ = query(
          collection(db, "CourseExitResponses"),
          where("staffName", "==", user.name)
        );
        const exitResSnap = await getDocs(exitResQ);
        const erData = exitResSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setExitResponses(erData);

        // Auto-select is removed to show placeholder
      } catch (error) {
        console.error("Error fetching staff data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaffData();
  }, [user.name]);

  // --- REPORT CALCULATION ENGINE ---
  const isExitMode = reportTab === "exit";
  const sourceFeedbacks = isExitMode ? exitResponses : feedbacks;
  
  // Filter feedbacks for the currently selected dropdown option
  const currentFeedbacks = sourceFeedbacks.filter(
    (f) => subjectClassValue(f) === selectedSubject,
  );
  const totalResponses = currentFeedbacks.length;

  const activeQuestions = isExitMode 
        ? (exitForms[selectedSubject]?.questions || []) 
        : FEEDBACK_QUESTIONS;
        
  const qCount = activeQuestions.length;
  let overallAverage = 0;
  const questionAverages = Array(qCount).fill(0);

  // Initialize scoreCounts for each question
  const scoreCounts = qCount > 0 ? Array.from({ length: qCount }, () => ({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  })) : [];

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
          <div className="flex bg-white/10 p-1.5 rounded-xl backdrop-blur-sm ring-1 ring-white/20 shadow-inner overflow-x-auto">
            <button
              onClick={() => setActiveTab("exit-forms")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === "exit-forms"
                  ? "bg-white text-blue-900 shadow-md ring-1 ring-black/5"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <FileText size={18} strokeWidth={2.5} />
              Course Exit Forms
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === "reports"
                  ? "bg-white text-blue-900 shadow-md ring-1 ring-black/5"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <BarChart3 size={18} strokeWidth={2.5} />
              Analytics
            </button>
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
      ) : activeTab === "reports" ? (
        !isStaffPortalOpen ? (
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
        ) : (
        <div className="space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                    placeholder="Select Subject"
                  />
                  {selectedSubject && (
                     <div className="mt-4 flex gap-1 p-1 bg-slate-200/50 rounded-xl">
                        <button
                          onClick={() => setReportTab("faculty")}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === "faculty" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Faculty Feedback
                        </button>
                        <button
                          onClick={() => setReportTab("exit")}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportTab === "exit" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Course Exit Survey
                        </button>
                     </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-slate-200/80 bg-white px-5 py-5">
                  <div className={`overflow-hidden rounded-2xl p-5 text-white shadow-lg ring-1 ring-white/10 ${isExitMode ? 'bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 shadow-emerald-900/25' : 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 shadow-blue-900/25'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isExitMode ? 'text-emerald-100/85' : 'text-blue-100/85'}`}>
                      Overall rating
                    </p>
                    <p className="mt-2 font-display text-4xl font-extrabold tabular-nums tracking-tight">
                      {totalResponses > 0 && overallAverage !== "NaN" ? overallAverage : "0.0"}
                      <span className={`ml-1 text-xl font-semibold ${isExitMode ? 'text-emerald-200/90' : 'text-blue-200/90'}`}>
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
                  {activeQuestions.map((q, idx) => (
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
        )
      ) : (
        <CourseExitBuilder
          allocations={allocations}
          user={user}
          exitForms={exitForms}
          setExitForms={setExitForms}
          notify={{ success, notifyError, warning }}
          subjectClassValue={subjectClassValue}
          classKey={classKey}
        />
      )}
    </div>
  );
}

// Sub-component for Exit Form Creation
function CourseExitBuilder({ allocations, user, exitForms, setExitForms, notify, subjectClassValue, classKey }) {
  const [selectedBuilderSubject, setSelectedBuilderSubject] = useState("");
  const [questions, setQuestions] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing form data when subject changes
  useEffect(() => {
    if (!selectedBuilderSubject) {
      setQuestions([]);
      setIsFormOpen(false);
      return;
    }
    const existing = exitForms[selectedBuilderSubject];
    if (existing && existing.questions) {
      setQuestions(existing.questions);
      setIsFormOpen(!!existing.isOpen);
    } else {
      setQuestions(["Course objectives were clearly communicated.", "The subject helped improve practical knowledge."]);
      setIsFormOpen(false);
    }
  }, [selectedBuilderSubject, exitForms]);

  const handleAddQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const handleQuestionChange = (index, value) => {
    const newQs = [...questions];
    newQs[index] = value;
    setQuestions(newQs);
  };

  const handleRemoveQuestion = (index) => {
    const newQs = [...questions];
    newQs.splice(index, 1);
    setQuestions(newQs);
  };

  const handleSaveForm = async () => {
    if (!selectedBuilderSubject) {
      notify.warning("Please select a subject first.");
      return;
    }
    const alloc = allocations.find((a) => subjectClassValue(a) === selectedBuilderSubject);
    if (!alloc) return;

    // Filter out empty questions
    const validQuestions = questions.map(q => q.trim()).filter(q => q.length > 0);
    if (validQuestions.length === 0) {
      notify.warning("Please add at least one valid question.");
      return;
    }

    setIsSaving(true);
    try {
      const formKey = subjectClassValue(alloc);
      const targetClass = classKey(alloc);
      
      const formDocId = exitForms[formKey]?.id || `${user.name}_${alloc.subject}_${targetClass}`.replace(/\s+/g, '_');
      
      const payload = {
        staffName: user.name,
        department: alloc.department || user.dept,
        subject: alloc.subject,
        targetClass: targetClass,
        questions: validQuestions,
        isOpen: isFormOpen,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, "CourseExitForms", formDocId), payload);
      
      setExitForms(prev => ({
        ...prev,
        [formKey]: { id: formDocId, ...payload }
      }));
      
      notify.success("Course Exit Survey saved successfully.");
    } catch (e) {
      console.error(e);
      notify.notifyError("Failed to save Course Exit Survey.");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid lg:grid-cols-3 gap-7">
        <div className="lg:col-span-1 space-y-4">
          <Card className="overflow-hidden p-0 !shadow-soft-lg ring-1 ring-slate-200/60">
            <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 text-white">
              <h2 className="font-display flex items-center gap-2 text-lg font-bold">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <BookOpen size={18} strokeWidth={2} />
                </span>
                Target Subject
              </h2>
              <p className="mt-1.5 text-xs font-medium text-blue-100/90">
                Select a class to create or edit its exit survey.
              </p>
            </div>
            <div className="bg-slate-50/80 p-5">
              <label className="sr-only">Subject and class selection</label>
              <CustomSelect
                value={selectedBuilderSubject}
                onChange={setSelectedBuilderSubject}
                options={allocations.map((alloc) => {
                  const ck = classKey(alloc);
                  const isExisting = !!exitForms[subjectClassValue(alloc)];
                  return {
                    value: subjectClassValue(alloc),
                    label: `${alloc.subject}${ck ? ` (${ck})` : ""} ${isExisting ? "(✓ Saved)" : ""}`,
                  };
                })}
                placeholder="Choose subject..."
              />
            </div>
            
            {selectedBuilderSubject && (
              <div className="space-y-5 border-t border-slate-200/80 bg-white px-5 py-5">
                <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      Portal Controls
                    </p>
                    <button
                      onClick={() => setIsFormOpen(!isFormOpen)}
                      className={`transition-colors ${isFormOpen ? "text-emerald-500 hover:text-emerald-600" : "text-slate-400 hover:text-slate-500"}`}
                      title={isFormOpen ? "Close Portal" : "Open Portal"}
                    >
                      {isFormOpen ? <ToggleRight size={38} strokeWidth={1.5} /> : <ToggleLeft size={38} strokeWidth={1.5} />}
                    </button>
                  </div>
                  <div>
                    <p className={`text-base font-bold flex items-center gap-1.5 ${isFormOpen ? "text-emerald-700" : "text-slate-700"}`}>
                      {isFormOpen ? "Responses Open" : "Responses Paused"}
                      {isFormOpen && <span className="relative flex h-2.5 w-2.5 ml-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {isFormOpen 
                        ? "Students can currently view and submit this exit survey." 
                        : "Survey is hidden from students. Toggle to open when ready."}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50/70 text-blue-900 border border-blue-100 p-4">
                   <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">Notice</p>
                   <p className="text-sm font-medium leading-relaxed opacity-90">
                     Options <span className="font-bold underline">1 to 5</span> (Poor to Excellent) will automatically be available for every valid question you drop below.
                   </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
           {!selectedBuilderSubject ? (
              <Card className="h-full border-2 border-dashed border-slate-300/90 bg-slate-50/50 flex flex-col items-center justify-center p-10 min-h-[400px]">
                <div className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-50 shadow-inner">
                  <FileText className="text-indigo-400" size={32} strokeWidth={1.5} />
                </div>
                <h2 className="font-display text-xl font-bold text-slate-800">
                  Select a targeted class
                </h2>
                <p className="mt-2 text-sm text-slate-500 max-w-sm text-center">
                  Pick a subject from the left column to begin creating or evaluating its customized Course Exit Survey.
                </p>
              </Card>
           ) : (
              <Card className="h-full flex flex-col overflow-hidden p-0 !shadow-soft-lg ring-1 ring-slate-200/50">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 px-5 py-4 md:px-7 gap-4">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900">
                        Survey Questions
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Create the number of questions that the CO contains in the subject.
                      </p>
                    </div>
                    <Button variant="ghost" onClick={handleAddQuestion} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ring-1 ring-indigo-200/50 shrink-0 self-start sm:self-auto">
                       <Plus size={16} strokeWidth={2.5}/> Add Question
                    </Button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white p-5 md:p-7 space-y-4">
                    {questions.length === 0 ? (
                       <div className="text-center py-10 opacity-70">
                         <p className="text-sm font-medium text-slate-500">No questions added yet. Click &quot;Add Question&quot; above.</p>
                       </div>
                    ) : (
                       questions.map((q, idx) => (
                         <div key={idx} className="flex gap-4 items-start group">
                            <div className="flex-1">
                               <div className="relative">
                                  <textarea
                                    value={q}
                                    placeholder={`e.g. Rate your understanding of Module ${idx+1}...`}
                                    onChange={(e) => handleQuestionChange(idx, e.target.value)}
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none shadow-sm"
                                  />
                               </div>
                               <div className="mt-2 flex items-center justify-start gap-1 sm:gap-2 overflow-x-auto pb-1 text-xs select-none">
                                  <span className="text-slate-400 font-medium px-1 mr-1">Scale:</span>
                                  {["1 - Poor", "2", "3 - Good", "4", "5 - Excellent"].map((label, i) => (
                                    <span key={i} className="inline-flex rounded-md bg-slate-100/80 px-2 py-1 font-semibold text-slate-500 border border-slate-200 shrink-0">
                                      {label}
                                    </span>
                                  ))}
                               </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(idx)}
                              className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Remove question"
                            >
                              <Trash2 size={18} />
                            </button>
                         </div>
                       ))
                    )}
                 </div>

                 <div className="border-t border-slate-200/80 bg-white p-5 md:px-7 flex justify-end">
                    <Button variant="primary" onClick={handleSaveForm} disabled={isSaving} className="pl-5 pr-6 w-full sm:w-auto">
                       {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                       {isSaving ? "Saving..." : "Save Exit Survey"}
                    </Button>
                 </div>
              </Card>
           )}
        </div>
      </div>
    </div>
  );
}
