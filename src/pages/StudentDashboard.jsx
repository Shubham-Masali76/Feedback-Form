import React, { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Send,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ChevronLeft,
  Loader2,
  ClipboardList,
  FileText,
  Building2,
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
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FEEDBACK_QUESTIONS,
  INSTITUTION_QUESTIONS,
} from "../constants/feedbackQuestions";
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

  const [exitForms, setExitForms] = useState([]);
  const [activeFormTab, setActiveFormTab] = useState("faculty"); // "faculty" | "exit"
  const [exitRatings, setExitRatings] = useState({});
  const [submittedExitSurveys, setSubmittedExitSurveys] = useState([]);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);

  // --- INSTITUTION FEEDBACK STATES ---
  const [isInstPortalOpen, setIsInstPortalOpen] = useState(false);
  const [currentAcadYear, setCurrentAcadYear] = useState("");
  const [currentSemester, setCurrentSemester] = useState("");
  const [instRatings, setInstRatings] = useState({});
  const [isSubmittingInst, setIsSubmittingInst] = useState(false);
  const [hasSubmittedInst, setHasSubmittedInst] = useState(false);

  // --- AUTOMATION HELPERS ---
  const getAutoAcadYear = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (month >= 6) return `${year}-${String(year + 1).slice(-2)}`;
    return `${year - 1}-${String(year).slice(-2)}`;
  };

  const getYearLevel = useCallback((tClass) => {
    const yearNumber = getYearNumberFromClassCode(tClass);
    if (yearNumber === 2) return "SY";
    if (yearNumber === 3) return "TY";
    return "FY";
  }, []);

  const getSemLabel = (tClass) => {
    if (!tClass) return "I";
    const match = tClass.match(/\d/);
    return match ? `Sem ${match[0]}` : "I";
  };

  const getYearNumberFromClassCode = (classCode) => {
    const code = String(classCode || "")
      .trim()
      .toUpperCase();
    if (!code) return 1;

    const yearPattern = code.match(/([1-3])Y/);
    if (yearPattern) return parseInt(yearPattern[1], 10);

    const semPattern = code.match(/([1-6])/);
    if (semPattern) {
      const semester = parseInt(semPattern[1], 10);
      if (semester <= 2) return 1;
      if (semester <= 4) return 2;
      return 3;
    }
    return 1;
  };

  useEffect(() => {
    const fetchSystemStatusAndData = async () => {
      if (!user?.email || !user?.targetClass || !user?.dept) {
        console.warn("User data incomplete, skipping fetch");
        return;
      }
      try {
        const settingsSnap = await getDoc(doc(db, "Settings", "Global"));
        if (!settingsSnap.exists()) {
          console.warn("Global settings not found");
          return;
        }

        const autoYear = getAutoAcadYear();
        const autoSem = getSemLabel(user?.targetClass || "");

        setCurrentAcadYear(autoYear);
        setCurrentSemester(autoSem);

        if (
          !settingsSnap.exists() ||
          settingsSnap.data().studentPortalOpen !== true
        ) {
          setIsSystemLocked(true);
          return;
        }

        setIsSystemLocked(false);

        // Fetch Institution Portal Status
        const instOpen = settingsSnap.data().institutionPortalOpen === true;
        setIsInstPortalOpen(instOpen);

        const q = query(
          collection(db, "Allocations"),
          where("department", "==", user.dept),
        );
        const querySnapshot = await getDocs(q);

        const allocData = [];
        querySnapshot.forEach((doc) => {
          allocData.push({ id: doc.id, ...doc.data() });
        });
        const currentStudentClass = String(user?.targetClass || "").trim();
        const studentYear = getYearNumberFromClassCode(currentStudentClass);
        const filteredAllocations = allocData.filter((alloc) => {
          const allocClass = alloc.targetClass ?? alloc.tClass ?? "";
          const normalizedAllocClass = String(allocClass).trim();
          if (normalizedAllocClass && currentStudentClass) {
            return normalizedAllocClass === currentStudentClass;
          }
          // Fallback for old records that may not have class information
          const allocYear = getYearNumberFromClassCode(normalizedAllocClass);
          return allocYear === studentYear;
        });
        setAllocations(filteredAllocations);

        const exitQ = query(
          collection(db, "CourseExitForms"),
          where("department", "==", user.dept),
        );
        const exitSnap = await getDocs(exitQ);
        const fetchedExitForms = [];
        exitSnap.forEach((d) => {
          const form = { id: d.id, ...d.data() };
          if (form.isOpen) {
            fetchedExitForms.push(form);
          }
        });
        setExitForms(fetchedExitForms);

        // --- ENHANCED: ROBUST TRACKING USING STUDENT DOC ---
        let studentTrackedStaff = [];
        let studentTrackedExit = [];
        let studentTrackedInst = false;
        if (user?.id) {
          try {
            const studentDocRef = doc(db, "Students", user.id);
            const studentSnap = await getDoc(studentDocRef);
            if (studentSnap.exists()) {
              const sData = studentSnap.data();
              
              // Filter tracked submissions by current year and semester
              const filterCurrent = (list) => {
                if (!Array.isArray(list)) return [];
                return list
                  .filter(item => {
                    // Format: "allocId_year_sem"
                    const parts = item.split("_");
                    if (parts.length >= 3) {
                      const year = parts[1];
                      const sem = parts[2];
                      return year === autoYear && sem === autoSem;
                    }
                    return false;
                  })
                  .map(item => item.split("_")[0]);
              };

              studentTrackedStaff = filterCurrent(sData.submittedStaffFeedbacks);
              studentTrackedExit = filterCurrent(sData.submittedExitSurveys);
              
              if (Array.isArray(sData.submittedInstFeedbacks)) {
                if (sData.submittedInstFeedbacks.includes(autoYear)) {
                  studentTrackedInst = true;
                }
              }
            }
          } catch (err) {
            console.warn("Could not fetch student doc for tracking:", err);
          }
        }

        // --- LOCAL STORAGE TRACKING (Ultimate Fallback for Rules Blocks) ---
        const localStaffKey = `staff_fb_${user?.id}_${autoYear}_${autoSem}`;
        const localExitKey = `exit_fb_${user?.id}_${autoYear}_${autoSem}`;
        const localInstKey = `inst_fb_${user?.id}_${autoYear}`;
        
        let localTrackedStaff = [];
        let localTrackedExit = [];
        let localTrackedInst = false;
        try {
          localTrackedStaff = JSON.parse(localStorage.getItem(localStaffKey) || "[]");
          localTrackedExit = JSON.parse(localStorage.getItem(localExitKey) || "[]");
          localTrackedInst = localStorage.getItem(localInstKey) === "true";
        } catch (e) {}

        // Combine DB and Local tracking
        const mergedStaff = Array.from(new Set([...studentTrackedStaff, ...localTrackedStaff]));
        const mergedExit = Array.from(new Set([...studentTrackedExit, ...localTrackedExit]));
        const mergedInst = studentTrackedInst || localTrackedInst;

        // Check if student already submitted institution feedback for this year
        if (instOpen && autoYear) {
          try {
            const instCheckQ = query(
              collection(db, "InstitutionFeedbackResponses"),
              where("email", "==", user.email),
            );
            const instCheckSnap = await getDocs(instCheckQ);
            const alreadySubmitted = instCheckSnap.docs.some(
              (doc) => doc.data().academicYear === autoYear,
            );
            if (alreadySubmitted || mergedInst) {
              setHasSubmittedInst(true);
            }
          } catch (e) {
            console.warn("Fallback query for Institution Feedback failed", e);
            if (mergedInst) {
              setHasSubmittedInst(true);
            }
          }
        }

        // --- FALLBACK: FETCH PREVIOUS SUBMISSIONS TO ENFORCE SINGLE RESPONSE ---

        // 1. Staff Feedback
        try {
          const staffFeedQ = query(
            collection(db, "Feedbacks"),
            where("studentEmail", "==", user.email),
          );
          const staffFeedSnap = await getDocs(staffFeedQ);
          const prevStaffSubmissions = [...mergedStaff];
          
          staffFeedSnap.forEach((d) => {
            const data = d.data();
            // Strictly check both year and semester
            if (data.academicYear !== autoYear) return;
            if (data.semester && data.semester !== autoSem) return;

            // Find matching allocation ID from the current semester's filtered allocations
            const match = filteredAllocations.find(
              (a) =>
                a.id === data.allocationId ||
                (a.staff === data.staffName &&
                  a.subject === data.subject &&
                  String(a.targetClass || a.tClass).trim() ===
                    String(data.targetClass).trim()),
            );
            if (match && !prevStaffSubmissions.includes(match.id)) {
              prevStaffSubmissions.push(match.id);
            }
          });
          setSubmittedReviews(prevStaffSubmissions);
        } catch (e) {
          console.warn("Fallback query for Staff Feedbacks failed", e);
          setSubmittedReviews(mergedStaff);
        }

        // 2. Course Exit Survey
        try {
          const exitRespTrackerQ = query(
            collection(db, "CourseExitResponses"),
            where("studentEmail", "==", user.email),
          );
          const exitRespTrackerSnap = await getDocs(exitRespTrackerQ);
          const prevExitSubmissions = [...mergedExit];
          
          exitRespTrackerSnap.forEach((d) => {
            const data = d.data();
            if (data.academicYear !== autoYear) return;
            if (data.semester && data.semester !== autoSem) return;

            const match = filteredAllocations.find(
              (a) =>
                a.id === data.allocationId ||
                (a.staff === data.staffName &&
                  a.subject === data.subject &&
                  String(a.targetClass || a.tClass).trim() ===
                    String(data.targetClass).trim()),
            );
            if (match && !prevExitSubmissions.includes(match.id)) {
              prevExitSubmissions.push(match.id);
            }
          });
          setSubmittedExitSurveys(prevExitSubmissions);
        } catch (e) {
          console.warn("Fallback query for Exit Surveys failed", e);
          setSubmittedExitSurveys(mergedExit);
        }
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStatusAndData();
  }, [user.dept, user.email, user.targetClass, getYearLevel]);

  const handleRatingChange = (questionIndex, value) => {
    setRatings((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const handleExitRatingChange = (questionIndex, value) => {
    setExitRatings((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const handleInstRatingChange = (questionIndex, value) => {
    setInstRatings((prev) => ({ ...prev, [questionIndex]: value }));
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

    if (submittedReviews.includes(selectedAllocation)) {
      warning("Feedback already submitted for this subject.");
      return;
    }

    if (!user?.email) {
      notifyError("User session error. Please log in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetData = allocations.find((a) => a.id === selectedAllocation);
      const targetClass = targetData?.targetClass ?? targetData?.tClass ?? "";
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
        studentEmail: user.email, // Tracking for single response
        allocationId: selectedAllocation,
        department: user.dept,
        staffName: targetData.staff,
        subject: targetData.subject,
        targetClass,
        isElective: targetData.isElective || false,
        scores: ratings,
        academicYear: currentAcadYear,
        semester: currentSemester,
        totalScore: totalScore,
        createdAt: new Date(),
      });

      // Update the robust tracking in the student's document
      if (user?.id) {
        try {
          const trackString = `${selectedAllocation}_${currentAcadYear}_${currentSemester}`;
          await updateDoc(doc(db, "Students", user.id), {
            submittedStaffFeedbacks: arrayUnion(trackString)
          });
        } catch (err) {
          console.warn("Could not update robust tracking:", err);
        }
      }

      success(`Feedback for ${targetData.subject} was submitted anonymously.`);

      const newSubmittedReviews = [...submittedReviews, selectedAllocation];
      setSubmittedReviews(newSubmittedReviews);
      
      // Update LocalStorage Fallback
      if (user?.id) {
        try {
          const localStaffKey = `staff_fb_${user.id}_${currentAcadYear}_${currentSemester}`;
          localStorage.setItem(localStaffKey, JSON.stringify(newSubmittedReviews));
        } catch (e) {}
      }

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

  const handleSubmitExitSurvey = async (e, formDoc) => {
    e.preventDefault();

    if (Object.keys(exitRatings).length < formDoc.questions.length) {
      warning(
        `Please answer all ${formDoc.questions.length} questions before submitting.`,
      );
      return;
    }

    if (submittedExitSurveys.includes(selectedAllocation)) {
      warning("Exit survey already submitted for this subject.");
      return;
    }

    if (!user?.email) {
      notifyError("User session error. Please log in again.");
      return;
    }

    setIsSubmittingExit(true);
    try {
      const targetData = allocations.find((a) => a.id === selectedAllocation);

      let totalScore = 0;
      Object.values(exitRatings).forEach(
        (val) => (totalScore += parseInt(val)),
      );

      await addDoc(collection(db, "CourseExitResponses"), {
        studentName: user.name,
        studentEmail: user.email, // Tracking for single response
        allocationId: selectedAllocation,
        staffName: targetData.staff,
        department: user.dept,
        subject: targetData.subject,
        targetClass: targetData.targetClass ?? targetData.tClass ?? "",
        scores: exitRatings,
        academicYear: currentAcadYear,
        semester: currentSemester,
        totalScore: totalScore,
        createdAt: new Date(),
      });

      // Update the robust tracking in the student's document
      if (user?.id) {
        try {
          const trackString = `${selectedAllocation}_${currentAcadYear}_${currentSemester}`;
          await updateDoc(doc(db, "Students", user.id), {
            submittedExitSurveys: arrayUnion(trackString)
          });
        } catch (err) {
          console.warn("Could not update robust tracking:", err);
        }
      }

      success(`Course Exit Survey for ${targetData.subject} was submitted.`);
      const newSubmittedExitSurveys = [...submittedExitSurveys, selectedAllocation];
      setSubmittedExitSurveys(newSubmittedExitSurveys);
      
      // Update LocalStorage Fallback
      if (user?.id) {
        try {
          const localExitKey = `exit_fb_${user.id}_${currentAcadYear}_${currentSemester}`;
          localStorage.setItem(localExitKey, JSON.stringify(newSubmittedExitSurveys));
        } catch (e) {}
      }

      setExitRatings({});

      // Auto switch back to faculty tab if not completed
      if (!submittedReviews.includes(selectedAllocation)) {
        setActiveFormTab("faculty");
      }
    } catch (error) {
      console.error("Error submitting exit survey: ", error);
      notifyError("Could not submit the survey. Please try again.");
    }
    setIsSubmittingExit(false);
  };

  const handleSubmitInstFeedback = async (e) => {
    e.preventDefault();

    if (Object.keys(instRatings).length < INSTITUTION_QUESTIONS.length) {
      warning(
        `Please answer all ${INSTITUTION_QUESTIONS.length} questions before submitting.`,
      );
      return;
    }

    if (hasSubmittedInst) {
      warning("Institution feedback already submitted for this year.");
      return;
    }

    if (!user?.email) {
      notifyError("User session error. Please log in again.");
      return;
    }

    setIsSubmittingInst(true);
    try {
      let totalScore = 0;
      Object.values(instRatings).forEach(
        (val) => (totalScore += parseInt(val)),
      );

      await addDoc(collection(db, "InstitutionFeedbackResponses"), {
        studentName: user.name,
        email: user.email,
        department: user.dept,
        academicYear: currentAcadYear,
        yearLevel: getYearLevel(user.targetClass),
        scores: instRatings,
        totalScore: totalScore,
        createdAt: new Date(),
      });

      // Update the robust tracking in the student's document (tracks by academicYear only)
      if (user?.id) {
        try {
          await updateDoc(doc(db, "Students", user.id), {
            submittedInstFeedbacks: arrayUnion(currentAcadYear)
          });
        } catch (err) {
          console.warn("Could not update robust tracking for institution feedback:", err);
        }
      }

      success(
        `Institution Feedback for ${currentAcadYear} submitted successfully.`,
      );
      setHasSubmittedInst(true);
      
      // Update LocalStorage Fallback
      if (user?.id) {
        try {
          const localInstKey = `inst_fb_${user.id}_${currentAcadYear}`;
          localStorage.setItem(localInstKey, "true");
        } catch (e) {}
      }

      setInstRatings({});
    } catch (error) {
      console.error("Error submitting institution feedback: ", error);
      notifyError("Could not submit the feedback. Please try again.");
    }
    setIsSubmittingInst(false);
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
              <AlertCircle
                className="text-white"
                size={32}
                strokeWidth={1.75}
              />
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

      {isInstPortalOpen && (
        <Card
          className={`overflow-hidden p-0 ring-1 ${hasSubmittedInst ? "ring-slate-200/60" : "ring-amber-200/60 shadow-glow-amber animate-pulse-subtle"}`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between p-5 gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${hasSubmittedInst ? "bg-slate-100 text-slate-500" : "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-200"}`}
              >
                <Building2 size={24} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Institution Level Feedback
                </h2>
                <p className="text-xs font-medium text-slate-500 italic">
                  Global Annual Survey • {currentAcadYear}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (selectedAllocation === "institution_survey") {
                  setSelectedAllocation("");
                } else {
                  setSelectedAllocation("institution_survey");
                  setActiveFormTab("institution");
                }
              }}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 ${
                selectedAllocation === "institution_survey"
                  ? "bg-slate-800 text-white hover:bg-slate-700"
                  : hasSubmittedInst
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-none"
                    : "bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg"
              }`}
            >
              {selectedAllocation === "institution_survey" ? (
                "Back to Subjects"
              ) : hasSubmittedInst ? (
                <>
                  <CheckCircle size={18} />
                  Submitted
                </>
              ) : (
                "Fill Survey now"
              )}
            </button>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-7">
        <div
          className={`lg:col-span-1 space-y-4 ${selectedAllocation === "institution_survey" ? "hidden" : selectedAllocation ? "hidden lg:block" : "block"}`}
        >
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
                  {(() => {
                    const renderButton = (alloc) => {
                      const isCompleted = submittedReviews.includes(alloc.id);
                      const hasExitForm = exitForms.some(
                        (f) =>
                          f.subject === alloc.subject &&
                          String(f.targetClass || "").trim() ===
                            String(
                              alloc.targetClass ?? alloc.tClass ?? "",
                            ).trim() &&
                          f.staffName === alloc.staff,
                      );
                      const isExitCompleted = submittedExitSurveys.includes(
                        alloc.id,
                      );

                      return (
                        <button
                          type="button"
                          key={alloc.id}
                          onClick={() => {
                            setSelectedAllocation(alloc.id);
                            if (isCompleted && hasExitForm && !isExitCompleted) {
                              setActiveFormTab("exit");
                            } else {
                              setActiveFormTab("faculty");
                            }
                            setRatings({});
                            setExitRatings({});
                          }}
                          className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                            selectedAllocation === alloc.id
                              ? "border-transparent bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/40"
                              : isCompleted && (!hasExitForm || isExitCompleted)
                                ? "border-slate-200/80 bg-slate-50/90 hover:border-slate-300"
                                : "border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-md"
                          }`}
                        >
                          <div className="flex justify-between items-center gap-2 mb-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                selectedAllocation === alloc.id
                                  ? "text-blue-100/90"
                                  : isCompleted && (!hasExitForm || isExitCompleted)
                                    ? "text-slate-400"
                                    : "text-slate-500"
                              }`}
                            >
                              {alloc.targetClass ?? alloc.tClass ?? "—"}
                            </span>
                            <div className="flex gap-1.5 items-center">
                              {hasExitForm && (
                                <span
                                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isExitCompleted ? "bg-slate-200 text-slate-500" : selectedAllocation === alloc.id ? "bg-blue-800/40 text-blue-100" : "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"}`}
                                >
                                  Survey Open
                                </span>
                              )}
                              {isCompleted && (
                                <CheckCircle
                                  size={18}
                                  className={`${selectedAllocation === alloc.id ? "text-blue-300" : "text-emerald-500"} shrink-0`}
                                  aria-label="Submitted"
                                />
                              )}
                            </div>
                          </div>
                          <h3
                            className={`font-display text-base font-bold leading-tight ${
                              selectedAllocation === alloc.id
                                ? "text-white"
                                : isCompleted && (!hasExitForm || isExitCompleted)
                                  ? "text-slate-600"
                                  : "text-slate-900"
                            }`}
                          >
                            {alloc.subject}
                          </h3>
                          <p
                            className={`text-xs font-medium mt-1.5 ${
                              selectedAllocation === alloc.id
                                ? "text-blue-100/95"
                                : isCompleted && (!hasExitForm || isExitCompleted)
                                  ? "text-slate-400"
                                  : "text-slate-500"
                            }`}
                          >
                            {alloc.staff}
                          </p>
                        </button>
                      );
                    };

                    return (
                      <>
                        {mandatoryAllocations.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                              Core subjects
                            </p>
                            {mandatoryAllocations.map(renderButton)}
                          </div>
                        )}

                        {electiveAllocations.length > 0 && (
                          <div className="space-y-3 pt-5 border-t border-slate-200/80">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                              Elective
                            </p>
                            {electiveAllocations.map(renderButton)}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div
          className={
            selectedAllocation === "institution_survey"
              ? "lg:col-span-3"
              : "lg:col-span-2"
          }
        >
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
            ) : selectedAllocation === "institution_survey" ? (
              <form
                onSubmit={handleSubmitInstFeedback}
                className="flex flex-col animate-in slide-in-from-right duration-500"
              >
                <div className="border-b border-slate-200/80 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 px-6 py-6 md:px-8">
                  <button
                    type="button"
                    onClick={() => setSelectedAllocation("")}
                    className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-100/80 transition hover:text-white"
                  >
                    <ChevronLeft size={16} />
                    Back to list
                  </button>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/90">
                    Annual Survey {currentAcadYear}
                  </p>
                  <h2 className="font-display mt-2 text-2xl font-bold text-white">
                    Institution Satisfaction Feedback
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-amber-100/95">
                    Rate your satisfaction with the institution's facilities and
                    services from{" "}
                    <strong className="text-white">1 (Poor)</strong> to{" "}
                    <strong className="text-white">5 (Excellent)</strong>.
                  </p>
                </div>
                <div className="space-y-5 bg-gradient-to-b from-slate-50/80 to-white p-6 md:p-8">
                  {hasSubmittedInst ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-inner">
                        <CheckCircle size={40} />
                      </div>
                      <h3 className="font-display text-2xl font-bold text-slate-800">
                        Feedback Received
                      </h3>
                      <p className="text-slate-500 mt-2 max-w-xs mx-auto">
                        Thank you for your valuable feedback. Your response for{" "}
                        {currentAcadYear} has been recorded.
                      </p>
                    </div>
                  ) : (
                    INSTITUTION_QUESTIONS.map((q, idx) => (
                      <fieldset
                        key={idx}
                        className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-amber-100/80 transition-all hover:shadow-md"
                      >
                        <legend className="sr-only">Question {idx + 1}</legend>
                        <p className="text-sm font-medium leading-relaxed text-slate-800 mb-5">
                          <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-xs font-bold text-amber-700 shadow-inner">
                            {idx + 1}
                          </span>
                          {q}
                        </p>
                        <div
                          className="flex flex-wrap gap-2.5"
                          role="radiogroup"
                          aria-label={`Question ${idx + 1}`}
                        >
                          {[1, 2, 3, 4, 5].map((num) => {
                            const selected = instRatings[idx] === num;
                            const labels = [
                              "Average",
                              "Satisfactory",
                              "Good",
                              "Very Good",
                              "Excellent",
                            ];
                            return (
                              <label
                                key={num}
                                title={labels[num - 1]}
                                className={`relative cursor-pointer rounded-xl border-2 px-4 py-2.5 text-center text-sm font-bold transition-all duration-200 ${
                                  selected
                                    ? "border-transparent bg-gradient-to-b from-amber-500 to-orange-600 text-white shadow-md shadow-amber-600/25 scale-105"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`inst-question-${idx}`}
                                  value={num}
                                  checked={selected}
                                  onChange={() =>
                                    handleInstRatingChange(idx, num)
                                  }
                                  className="sr-only"
                                />
                                {num}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))
                  )}
                </div>

                {!hasSubmittedInst && (
                  <div className="sticky bottom-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-6 py-6 md:px-8 flex flex-col sm:flex-row gap-3 sm:gap-4 z-10 shadow-[0_-4px_20px_rgb(0,0,0,0.03)]">
                    <button
                      type="button"
                      disabled={
                        isSubmittingInst ||
                        Object.keys(instRatings).length === 0
                      }
                      onClick={() => setInstRatings({})}
                      className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingInst}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 py-4 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-amber-600/30 transition hover:from-amber-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={20} aria-hidden />
                      {isSubmittingInst
                        ? "Submitting…"
                        : "Submit Institution Feedback"}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              (() => {
                const targetData = allocations.find(
                  (a) => a.id === selectedAllocation,
                );
                const targetClass = String(
                  targetData?.targetClass ?? targetData?.tClass ?? "",
                ).trim();
                const exitForm = exitForms.find(
                  (f) =>
                    f.subject === targetData?.subject &&
                    String(f.targetClass || "").trim() === targetClass &&
                    f.staffName === targetData?.staff,
                );
                const isFacultyCompleted =
                  submittedReviews.includes(selectedAllocation);
                const isExitCompleted =
                  submittedExitSurveys.includes(selectedAllocation);

                const renderFacultyEvaluation = () => (
                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col animate-in fade-in duration-300"
                  >
                    <div className="border-b border-slate-200/80 bg-gradient-to-r from-indigo-600 via-blue-700 to-cyan-700 px-6 py-6 md:px-8">
                      <button
                        type="button"
                        onClick={() => setSelectedAllocation("")}
                        className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-blue-100/80 transition hover:text-white lg:hidden"
                      >
                        <ChevronLeft size={16} />
                        Back to list
                      </button>
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
                      {isFacultyCompleted ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <CheckCircle
                            className="text-emerald-500 mb-3"
                            size={48}
                          />
                          <h3 className="font-display text-xl font-bold text-slate-800">
                            Feedback Submitted
                          </h3>
                          <p className="text-slate-500 mt-2 text-sm">
                            Thank you for completing the faculty evaluation.
                          </p>
                        </div>
                      ) : (
                        FEEDBACK_QUESTIONS.map((q, idx) => (
                          <fieldset
                            key={idx}
                            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80"
                          >
                            <legend className="sr-only">
                              Question {idx + 1}
                            </legend>
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
                                      onChange={() =>
                                        handleRatingChange(idx, num)
                                      }
                                      className="sr-only"
                                    />
                                    {num}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ))
                      )}
                    </div>

                    {!isFacultyCompleted && (
                      <div className="border-t border-slate-200/80 bg-white px-6 py-6 md:px-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button
                          type="button"
                          disabled={
                            isSubmitting || Object.keys(ratings).length === 0
                          }
                          onClick={() => setRatings({})}
                          className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Clear Form
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-600 to-indigo-700 py-4 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 transition hover:from-blue-700 hover:to-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send size={20} aria-hidden />
                          {isSubmitting
                            ? "Submitting…"
                            : "Submit anonymous feedback"}
                        </button>
                      </div>
                    )}
                  </form>
                );

                const renderExitSurvey = () => (
                  <form
                    onSubmit={(e) => handleSubmitExitSurvey(e, exitForm)}
                    className="flex flex-col animate-in fade-in duration-300"
                  >
                    <div className="border-b border-slate-200/80 bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-700 px-6 py-6 md:px-8">
                      <button
                        type="button"
                        onClick={() => setSelectedAllocation("")}
                        className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-100/80 transition hover:text-white lg:hidden"
                      >
                        <ChevronLeft size={16} />
                        Back to list
                      </button>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">
                        End of Semester
                      </p>
                      <h2 className="font-display mt-2 text-2xl font-bold text-white">
                        Course Exit Survey
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-100/95">
                        Rate your understanding of the course outcomes from{" "}
                        <strong className="text-white">1 (poor)</strong> to{" "}
                        <strong className="text-white">5 (excellent)</strong>.
                      </p>
                    </div>
                    <div className="space-y-5 bg-gradient-to-b from-slate-50/80 to-white p-6 md:p-8">
                      {isExitCompleted ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <CheckCircle
                            className="text-emerald-500 mb-3"
                            size={48}
                          />
                          <h3 className="font-display text-xl font-bold text-slate-800">
                            Survey Submitted
                          </h3>
                          <p className="text-slate-500 mt-2 text-sm">
                            Thank you for submitting the Course Exit Survey.
                          </p>
                        </div>
                      ) : (
                        exitForm.questions.map((q, idx) => (
                          <fieldset
                            key={idx}
                            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-emerald-100/80"
                          >
                            <legend className="sr-only">
                              Question {idx + 1}
                            </legend>
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
                                const selected = exitRatings[idx] === num;
                                return (
                                  <label
                                    key={num}
                                    className={`relative cursor-pointer rounded-xl border-2 px-4 py-2.5 text-center text-sm font-bold transition-all duration-150 ${
                                      selected
                                        ? "border-transparent bg-gradient-to-b from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/25"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`exit-question-${idx}`}
                                      value={num}
                                      checked={selected}
                                      onChange={() =>
                                        handleExitRatingChange(idx, num)
                                      }
                                      className="sr-only"
                                    />
                                    {num}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ))
                      )}
                    </div>

                    {!isExitCompleted && (
                      <div className="border-t border-slate-200/80 bg-white px-6 py-6 md:px-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <button
                          type="button"
                          disabled={
                            isSubmittingExit ||
                            Object.keys(exitRatings).length === 0
                          }
                          onClick={() => setExitRatings({})}
                          className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-bold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Clear Form
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingExit}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-600 to-teal-700 py-4 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-600/30 transition hover:from-emerald-700 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Send size={20} aria-hidden />
                          {isSubmittingExit
                            ? "Submitting…"
                            : "Submit exit survey"}
                        </button>
                      </div>
                    )}
                  </form>
                );

                return (
                  <div className="flex flex-col h-full">
                    {/* Tabs configuration if exitform exists */}
                    {exitForm && (
                      <div className="border-b border-slate-200/80 bg-slate-50 flex overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setActiveFormTab("faculty")}
                          className={`flex-1 py-4 px-4 sm:px-6 text-sm font-bold whitespace-nowrap transition-colors ${
                            activeFormTab === "faculty"
                              ? "text-indigo-600 border-b-2 border-indigo-600 bg-white"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                          }`}
                        >
                          Faculty Feedback
                          {isFacultyCompleted && (
                            <CheckCircle
                              size={14}
                              className="inline ml-2 text-emerald-500 mb-0.5"
                            />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFormTab("exit")}
                          className={`flex-1 py-4 px-4 sm:px-6 text-sm font-bold whitespace-nowrap transition-colors ${
                            activeFormTab === "exit"
                              ? "text-emerald-600 border-b-2 border-emerald-600 bg-white"
                              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                          }`}
                        >
                          Course Exit Survey
                          {isExitCompleted && (
                            <CheckCircle
                              size={14}
                              className="inline ml-2 text-emerald-500 mb-0.5"
                            />
                          )}
                        </button>
                      </div>
                    )}
                    {!exitForm || activeFormTab === "faculty"
                      ? renderFacultyEvaluation()
                      : renderExitSurvey()}
                  </div>
                );
              })()
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
