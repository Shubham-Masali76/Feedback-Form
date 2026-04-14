import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  FileText,
  PlusCircle,
  Shield,
  GraduationCap,
  UserPlus,
  UserX,
  RotateCcw,
  Printer,
  PieChart,
  BarChart,
  Eye,
  EyeOff,
  Search,
  UserCheck,
} from "lucide-react";
import { Card } from "../components/UI";
import CustomSelect from "../components/UI/CustomSelect";
import DonutChart from "../components/DonutChart";

// 1. Import Firestore & Auth tools
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, secondaryAuth } from "../firebase";
import {
  FEEDBACK_QUESTIONS,
  INSTITUTION_QUESTIONS,
} from "../constants/feedbackQuestions";
import { useNotify } from "../context/NotificationContext.jsx";

function firestoreErrorMessage(error, hint = "") {
  const code = error?.code ?? "error";
  const msg = error?.message ?? String(error);
  const base = `${code}: ${msg}`;
  if (code === "permission-denied") {
    return `${base}\n\nFirestore blocked this write. In Firebase Console → Firestore → Rules, ensure authenticated admins can create documents in this collection.${hint ? ` ${hint}` : ""}`;
  }
  if (code === "unavailable" || code === "failed-precondition") {
    return `${base}\n\nCheck your network connection and that Firestore is enabled for this project.`;
  }
  return base;
}

function authSignupErrorMessage(error, context) {
  const code = error?.code;
  if (code === "auth/email-already-in-use") {
    return `This email is already registered. Firebase allows only one login per email. You cannot add a second “${context}” with the same address as an existing HOD or staff member. Use another email, or sign in as that person—they already have one account.`;
  }
  if (code === "auth/weak-password") {
    return "Password is too weak. Use at least 6 characters.";
  }
  if (code === "auth/invalid-email") {
    return "Invalid email address.";
  }
  return error?.message || `Could not create ${context} account.`;
}

export default function AdminDashboard() {
  const { success, error: notifyError, warning } = useNotify();
  const [activeTab, setActiveTab] = useState("departments");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- STATE VARIABLES ---
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [schemeYear, setSchemeYear] = useState("");
  const [hodName, setHodName] = useState("");
  const [hodDept, setHodDept] = useState("");
  const [hodEmail, setHodEmail] = useState("");
  const [hodPassword, setHodPassword] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffDept, setStaffDept] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const [showHodPassword, setShowHodPassword] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // --- NEW: GLOBAL DATA STATES FOR REPORTS ---
  const [departmentsList, setDepartmentsList] = useState([]);
  const [globalStaffList, setGlobalStaffList] = useState([]);
  const [globalFeedbacks, setGlobalFeedbacks] = useState([]);
  const [schemesList, setSchemesList] = useState([]);
  const [schemeMapping, setSchemeMapping] = useState({
    year1: "",
    year2: "",
    year3: "",
  });

  // Report Filters
  const [reportMode, setReportMode] = useState("faculty");
  const [reportSubject, setReportSubject] = useState("");
  const [reportDept, setReportDept] = useState("");
  const [reportStaff, setReportStaff] = useState("");
  const [acadYear, setAcadYear] = useState("");
  const [semester, setSemester] = useState("");
  const [reportYearLevel, setReportYearLevel] = useState("");

  const [globalExitForms, setGlobalExitForms] = useState([]);
  const [globalExitResponses, setGlobalExitResponses] = useState([]);

  const [globalInstResponses, setGlobalInstResponses] = useState([]);
  const [isInstPortalOpen, setIsInstPortalOpen] = useState(false);

  // Faculty Directory Filters
  const [filterStaffDept, setFilterStaffDept] = useState("");

  // Fetch Global Data for the Admin
  const fetchGlobalData = useCallback(async () => {
    try {
      const deptSnap = await getDocs(collection(db, "Departments"));
      setDepartmentsList(deptSnap.docs.map((d) => d.data().name));

      const staffSnap = await getDocs(query(collection(db, "Users")));
      setGlobalStaffList(
        staffSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.role === "staff" || u.role === "hod"),
      );

      const feedSnap = await getDocs(collection(db, "Feedbacks"));
      setGlobalFeedbacks(feedSnap.docs.map((d) => ({ ...d.data(), id: d.id })));

      const exitFormsSnap = await getDocs(collection(db, "CourseExitForms"));
      setGlobalExitForms(
        exitFormsSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
      );

      const exitResSnap = await getDocs(collection(db, "CourseExitResponses"));
      setGlobalExitResponses(
        exitResSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
      );

      const schemeSnap = await getDocs(collection(db, "Schemes"));
      setSchemesList(schemeSnap.docs.map((d) => d.data().name));

      const mappingSnap = await getDoc(doc(db, "Settings", "SchemeMapping"));
      if (mappingSnap.exists()) {
        setSchemeMapping(mappingSnap.data());
      }

      const globalSets = await getDoc(doc(db, "Settings", "Global"));
      if (globalSets.exists()) {
        const data = globalSets.data();
        setIsInstPortalOpen(data.institutionPortalOpen === true);
        if (data.academicYear) setAcadYear(data.academicYear);
        if (data.semester) setSemester(data.semester);
      }

      const instSnap = await getDocs(
        collection(db, "InstitutionFeedbackResponses"),
      );
      setGlobalInstResponses(
        instSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
      );
    } catch (err) {
      console.error("Error fetching global data:", err);
    }
  }, []);

  useEffect(() => {
    fetchGlobalData();
  }, [fetchGlobalData]);

  // --- FIREBASE FUNCTIONS (YOUR CODE INTACT) ---
  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    const name = deptName.trim();
    const code = deptCode.trim().toUpperCase();
    if (!name || !code) {
      warning("Please enter both department name and code.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "Departments"), {
        name,
        code,
        createdAt: serverTimestamp(),
      });
      success(`Department “${name}” saved.`);
      setDeptName("");
      setDeptCode("");
      fetchGlobalData();
    } catch (error) {
      console.error("Create department:", error);
      notifyError(
        `Could not save department.\n\n${firestoreErrorMessage(error)}`,
      );
    }
    setIsSubmitting(false);
  };

  const handleCreateScheme = async (e) => {
    e.preventDefault();
    let name = schemeName.trim();
    if (/^[a-z]$/i.test(name)) {
      name = name.toUpperCase() + "-Scheme";
    } else if (!/scheme$/i.test(name)) {
      name = name + " Scheme";
    }
    const year = schemeYear.trim();
    if (!name || !year) {
      warning("Please enter scheme name and year.");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "Schemes"), {
        name,
        year,
        createdAt: serverTimestamp(),
      });
      success(`Scheme “${name}” saved.`);
      setSchemeName("");
      setSchemeYear("");
      fetchGlobalData();
    } catch (error) {
      console.error("Create scheme:", error);
      notifyError(`Could not save scheme.\n\n${firestoreErrorMessage(error)}`);
    }
    setIsSubmitting(false);
  };

  const handleUpdateSchemeMapping = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "Settings", "SchemeMapping"), schemeMapping);
      success("Scheme mapping updated successfully.");
      fetchGlobalData();
    } catch (error) {
      console.error("Update mapping:", error);
      notifyError(
        `Could not update mapping.\n\n${firestoreErrorMessage(error)}`,
      );
    }
    setIsSubmitting(false);
  };

  const handleCreateHOD = async (e) => {
    e.preventDefault();
    if (!hodDept) {
      warning("Please select a department.");
      return;
    }
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        hodEmail,
        hodPassword,
      );
      const newUserId = userCredential.user.uid;
      await setDoc(doc(db, "Users", newUserId), {
        name: hodName,
        email: hodEmail,
        dept: hodDept,
        role: "hod",
        active: true,
        createdAt: new Date(),
      });
      success(`HOD account created for ${hodName}.`);
      setHodName("");
      setHodDept("");
      setHodEmail("");
      setHodPassword("");
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      notifyError(authSignupErrorMessage(error, "HOD"));
    }
    setIsSubmitting(false);
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!staffDept) {
      warning("Please select a department.");
      return;
    }
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        staffEmail,
        staffPassword,
      );
      const newUserId = userCredential.user.uid;
      await setDoc(doc(db, "Users", newUserId), {
        name: staffName,
        email: staffEmail,
        dept: staffDept,
        role: "staff",
        active: true,
        createdAt: new Date(),
      });
      success(`Staff account created for ${staffName}.`);
      setStaffName("");
      setStaffDept("");
      setStaffEmail("");
      setStaffPassword("");
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      notifyError(authSignupErrorMessage(error, "staff"));
    }
    setIsSubmitting(false);
  };

  const handleDeactivateStaff = async (uid, displayName) => {
    if (
      !window.confirm(
        `Deactivate “${displayName}”?\n\nThey will be removed from faculty dropdowns and can no longer sign in. Past feedback data is kept.`,
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "Users", uid), {
        active: false,
        inactiveAt: serverTimestamp(),
      });
      success(`${displayName} deactivated.`);
      if (reportStaff === displayName) setReportStaff("");
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      notifyError(
        `Could not deactivate user.\n\n${firestoreErrorMessage(error)}`,
      );
    }
    setIsSubmitting(false);
  };

  const handleReactivateStaff = async (uid, displayName) => {
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "Users", uid), {
        active: true,
        inactiveAt: deleteField(),
      });
      success(`${displayName} reactivated.`);
      fetchGlobalData();
    } catch (error) {
      console.error(error);
      notifyError(
        `Could not reactivate user.\n\n${firestoreErrorMessage(error)}`,
      );
    }
    setIsSubmitting(false);
  };

  const handleToggleInstPortal = async () => {
    setIsSubmitting(true);
    try {
      const newStatus = !isInstPortalOpen;
      await updateDoc(doc(db, "Settings", "Global"), {
        institutionPortalOpen: newStatus,
      });
      setIsInstPortalOpen(newStatus);
      success(`Institution Feedback Portal ${newStatus ? "Opened" : "Closed"}`);
    } catch (error) {
      console.error(error);
      notifyError("Failed to toggle portal.");
    }
    setIsSubmitting(false);
  };

  // --- REPORT ENGINE CALCULATIONS ---
  const activeDataSource =
    reportMode === "exit"
      ? globalExitResponses
      : reportMode === "institution"
        ? globalInstResponses
        : globalFeedbacks;

  const reportData = activeDataSource.filter((f) => {
    const matchDept = !reportDept || f.department === reportDept;
    if (reportMode === "institution") {
      const matchYear = !acadYear || f.academicYear === acadYear;
      return matchDept && matchYear;
    }
    const matchStaff = f.staffName === reportStaff;
    const matchSub = !reportSubject || f.subject === reportSubject;
    return matchDept && matchStaff && matchSub;
  });
  const totalStudents = reportData.length;

  const activeExitForm =
    reportMode === "exit" && reportSubject
      ? globalExitForms.find(
          (f) =>
            f.staffName === reportStaff &&
            f.subject === reportSubject &&
            f.department === reportDept,
        )
      : null;
  const activeQuestions =
    reportMode === "exit"
      ? activeExitForm?.questions || []
      : reportMode === "institution"
        ? INSTITUTION_QUESTIONS
        : FEEDBACK_QUESTIONS;
  const qCount = activeQuestions.length;

  const scoreCounts = Array.from({ length: qCount }, () => ({
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  }));
  if (totalStudents > 0) {
    reportData.forEach((fb) => {
      Object.keys(fb.scores).forEach((qIndex) => {
        const rating = parseInt(fb.scores[qIndex]);
        if (scoreCounts[qIndex] && scoreCounts[qIndex][rating] !== undefined)
          scoreCounts[qIndex][rating]++;
      });
    });
  }

  const colTotals = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const colScores = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let grandTotalScore = 0;

  for (let i = 0; i < qCount; i++) {
    [5, 4, 3, 2, 1].forEach((rating) => {
      colTotals[rating] += scoreCounts[i][rating];
      colScores[rating] += scoreCounts[i][rating] * rating;
      grandTotalScore += scoreCounts[i][rating] * rating;
    });
  }

  const maxPossibleScore = totalStudents * qCount * 5;
  const marksOutOf25 =
    maxPossibleScore > 0
      ? ((grandTotalScore / maxPossibleScore) * 25).toFixed(2)
      : "0.00";
  const overallAverageOutOf5 =
    maxPossibleScore > 0
      ? ((grandTotalScore / maxPossibleScore) * 5).toFixed(1)
      : "0.0";

  const totalVotes =
    colTotals[5] + colTotals[4] + colTotals[3] + colTotals[2] + colTotals[1];
  const p5 = totalVotes ? (colTotals[5] / totalVotes) * 100 : 0;
  const p4 = totalVotes ? (colTotals[4] / totalVotes) * 100 : 0;
  const p3 = totalVotes ? (colTotals[3] / totalVotes) * 100 : 0;
  const p2 = totalVotes ? (colTotals[2] / totalVotes) * 100 : 0;
  const p1 = totalVotes ? (colTotals[1] / totalVotes) * 100 : 0;

  const pieChartStyle = {
    background: `conic-gradient(#22c55e 0% ${p5}%, #3b82f6 ${p5}% ${p5 + p4}%, #eab308 ${p5 + p4}% ${p5 + p4 + p3}%, #f97316 ${p5 + p4 + p3}% ${p5 + p4 + p3 + p2}%, #ef4444 ${p5 + p4 + p3 + p2}% 100%)`,
  };

  // Active faculty only (retired / deactivated users excluded)
  const filteredStaffList = globalStaffList
    .filter((s) => s.dept === reportDept && s.active !== false)
    .map((s) => s.name);

  const activeFormSource =
    reportMode === "exit" ? globalExitForms : globalFeedbacks;
  const staffSubjects = [
    ...new Set(
      [...globalFeedbacks, ...globalExitForms]
        .filter(
          (f) => f.staffName === reportStaff && f.department === reportDept,
        )
        .map((f) => f.subject),
    ),
  ];

  const staffAccounts = globalStaffList
    .filter((u) => u.role === "staff" || u.role === "hod")
    .sort((a, b) => {
      // HODs first, then staff members
      if (a.role === "hod" && b.role !== "hod") return -1;
      if (a.role !== "hod" && b.role === "hod") return 1;
      return a.name.localeCompare(b.name);
    });

  // Filtered Logic for Staff Directory
  const matchesSearchAndDept = (u) => {
    return filterStaffDept === "" || u.dept === filterStaffDept;
  };

  const activeStaffRows = staffAccounts.filter(
    (u) => u.active !== false && matchesSearchAndDept(u),
  );
  const inactiveStaffRows = staffAccounts.filter(
    (u) => u.active === false && matchesSearchAndDept(u),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden backdrop-blur-xl print:hidden print-hide">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-indigo-200">
            <Building2 size={24} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Admin Portal
            </h1>
            <h2 className="text-sm font-medium text-slate-500 mt-0.5">
              SES Polytechnic Solapur
            </h2>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/60"
          role="tablist"
          aria-label="Admin sections"
        >
          {[
            "departments",
            "hods",
            "schemes",
            "staff",
            "directory",
            "feedback",
            "controls",
          ].map((tab) => {
            let label = tab;
            if (tab === "feedback") label = "Reports";
            else if (tab === "hods") label = "HODs";
            else if (tab === "directory") label = "Faculty List";
            else label = tab.charAt(0).toUpperCase() + tab.slice(1);

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab
                    ? "bg-white text-violet-700 shadow-sm ring-1 ring-slate-200 scale-100"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "departments" && (
        <Card className="max-w-3xl overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <h2 className="page-card-title flex items-center gap-2 text-slate-900">
              <Building2 size={18} className="text-slate-500" aria-hidden />
              Create department
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Add a name and short code for timetables and reports.
            </p>
          </div>
          <form onSubmit={handleCreateDepartment} className="p-6 md:p-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 mb-6">
              <div>
                <label className="section-title mb-2 block">
                  Department name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Technology"
                  className="input-app-admin"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="section-title mb-2 block">Code</label>
                <input
                  type="text"
                  placeholder="e.g. CM"
                  className="input-app-admin uppercase"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-fuchsia-700 transition-all active:scale-95 disabled:opacity-60 disabled:scale-100 uppercase tracking-widest mt-2"
            >
              {isSubmitting ? (
                "Saving..."
              ) : (
                <>
                  <PlusCircle size={18} strokeWidth={2.5} /> Save Department
                </>
              )}
            </button>
          </form>
        </Card>
      )}

      {activeTab === "hods" && (
        <Card className="max-w-3xl overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <h2 className="page-card-title flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Shield size={20} />
              </span>
              Create HOD account
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Creates Firebase login + profile. One email = one account.
            </p>
          </div>
          <form onSubmit={handleCreateHOD} className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6">
              <div>
                <label className="section-title mb-2 block">Full name</label>
                <input
                  type="text"
                  placeholder="HOD name"
                  className="input-app-admin"
                  value={hodName}
                  onChange={(e) => setHodName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="section-title mb-2 block">Department</label>
                <CustomSelect
                  value={hodDept}
                  onChange={(val) => setHodDept(val)}
                  options={departmentsList.map((d) => ({ value: d, label: d }))}
                  placeholder="Select department"
                />
              </div>
              <div>
                <label className="section-title mb-2 block">Email</label>
                <input
                  type="email"
                  placeholder="hod@college.edu"
                  className="input-app-admin"
                  value={hodEmail}
                  onChange={(e) => setHodEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="section-title mb-2 block">
                  Initial password
                </label>
                <div className="relative">
                  <input
                    type={showHodPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    className="input-app-admin w-full pr-10"
                    value={hodPassword}
                    onChange={(e) => setHodPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowHodPassword(!showHodPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 focus:outline-none"
                    tabIndex="-1"
                  >
                    {showHodPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-fuchsia-700 transition-all active:scale-95 disabled:opacity-60 disabled:scale-100 uppercase tracking-widest mt-2"
            >
              {isSubmitting ? (
                "Creating..."
              ) : (
                <>
                  <PlusCircle size={18} strokeWidth={2.5} /> Save HOD
                </>
              )}
            </button>
          </form>
        </Card>
      )}

      {activeTab === "schemes" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="page-card-title flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <GraduationCap size={20} />
                </span>
                Curriculum scheme
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                e.g. K-scheme and academic year for records.
              </p>
            </div>
            <form onSubmit={handleCreateScheme} className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6">
                <div>
                  <label className="section-title mb-2 block">
                    Scheme name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. K-Scheme"
                    className="input-app-admin"
                    value={schemeName}
                    onChange={(e) => setSchemeName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="section-title mb-2 block">Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2023"
                    className="input-app-admin"
                    value={schemeYear}
                    onChange={(e) => setSchemeYear(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-fuchsia-700 transition-all active:scale-95 disabled:opacity-60 disabled:scale-100 uppercase tracking-widest mt-2"
              >
                {isSubmitting ? (
                  "Saving..."
                ) : (
                  <>
                    <PlusCircle size={18} strokeWidth={2.5} /> Save scheme
                  </>
                )}
              </button>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="page-card-title flex items-center gap-2 text-slate-900">
                <GraduationCap
                  size={18}
                  className="text-slate-500"
                  aria-hidden
                />
                Progressive Scheme Assignment
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Assign exact schemes to specific years. This automatically
                generates the correct dropdowns for HOD student management.
              </p>
            </div>
            <form onSubmit={handleUpdateSchemeMapping} className="p-6 md:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4 md:gap-5 mb-6">
                <div>
                  <label className="section-title mb-2 block">
                    1st Year
                  </label>
                  <CustomSelect
                    value={schemeMapping.year1}
                    onChange={(val) =>
                      setSchemeMapping({ ...schemeMapping, year1: val })
                    }
                    options={schemesList.map((s) => ({ value: s, label: s }))}
                    placeholder="Select Scheme"
                  />
                </div>
                <div>
                  <label className="section-title mb-2 block">
                    2nd Year
                  </label>
                  <CustomSelect
                    value={schemeMapping.year2}
                    onChange={(val) =>
                      setSchemeMapping({ ...schemeMapping, year2: val })
                    }
                    options={schemesList.map((s) => ({ value: s, label: s }))}
                    placeholder="Select Scheme"
                  />
                </div>
                <div>
                  <label className="section-title mb-2 block">
                    3rd Year
                  </label>
                  <CustomSelect
                    value={schemeMapping.year3}
                    onChange={(val) =>
                      setSchemeMapping({ ...schemeMapping, year3: val })
                    }
                    options={schemesList.map((s) => ({ value: s, label: s }))}
                    placeholder="Select Scheme"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:from-violet-700 hover:to-fuchsia-700 transition-all active:scale-95 disabled:opacity-60 disabled:scale-100 uppercase tracking-widest mt-2"
              >
                {isSubmitting ? "Updating..." : "Update Year Mapping"}
              </button>
            </form>
          </Card>
        </div>
      )}

      {activeTab === "staff" && (
        <div className="max-w-4xl mx-auto">
          <Card className="overflow-hidden p-0 shadow-soft-xl border-slate-200/60">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <h2 className="page-card-title flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-100">
                  <UserPlus size={24} />
                </span>
                <span className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-900 tracking-tight">
                    Add faculty (staff)
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5 uppercase tracking-wider">
                    New access account
                  </span>
                </span>
              </h2>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 md:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                <div>
                  <label className="section-title mb-2.5 block text-slate-700 font-bold uppercase tracking-tight text-[11px]">
                    Full name
                  </label>
                  <input
                    type="text"
                    placeholder="Faculty name"
                    className="input-app-admin h-12 bg-slate-50/50 border-slate-200/80 focus:bg-white px-4"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="section-title mb-2.5 block text-slate-700 font-bold uppercase tracking-tight text-[11px]">
                    Department
                  </label>
                  <CustomSelect
                    value={staffDept}
                    onChange={(val) => setStaffDept(val)}
                    options={departmentsList.map((d) => ({
                      value: d,
                      label: d,
                    }))}
                    placeholder="Select department"
                  />
                </div>
                <div>
                  <label className="section-title mb-2.5 block text-slate-700 font-bold uppercase tracking-tight text-[11px]">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="staff@college.edu"
                    className="input-app-admin h-12 bg-slate-50/50 border-slate-200/80 focus:bg-white px-4"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="section-title mb-2.5 block text-slate-700 font-bold uppercase tracking-tight text-[11px]">
                    Initial password
                  </label>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      className="input-app-admin w-full h-12 bg-slate-50/50 border-slate-200/80 focus:bg-white px-4 pr-12"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-violet-600 focus:outline-none transition-colors"
                      tabIndex="-1"
                    >
                      {showStaffPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-6 w-6 flex items-center justify-center rounded-xl bg-violet-100 text-violet-600 shadow-sm">
                    <UserCheck size={14} strokeWidth={3} />
                  </div>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed max-w-[400px]">
                    Once saved, the faculty member can immediately log in and
                    will be available for subject allotments by their HOD.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 px-8 py-4 text-sm font-black text-white shadow-xl shadow-indigo-200/50 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:scale-100 uppercase tracking-widest sm:min-w-[200px]"
                >
                  {isSubmitting ? (
                    "Creating Account..."
                  ) : (
                    <>
                      <PlusCircle size={20} strokeWidth={2.5} /> Save Faculty
                    </>
                  )}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {activeTab === "directory" && (
        <Card className="flex flex-col border-slate-200 bg-white shadow-soft-xl p-0 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-6 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-start gap-10">
              <div>
                <h3 className="font-black text-slate-900 flex items-center gap-3 text-lg tracking-tight">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-200">
                    <Users size={20} />
                  </span>
                  Faculty Directory
                  <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-black text-slate-600 shadow-inner ring-1 ring-slate-200">
                    {activeStaffRows.length + inactiveStaffRows.length}
                  </span>
                </h3>
              </div>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="w-full md:w-auto md:min-w-[240px] relative z-[60]">
                  <CustomSelect
                    value={filterStaffDept}
                    onChange={(val) => setFilterStaffDept(val)}
                    options={departmentsList.map((d) => ({
                      value: d,
                      label: d,
                    }))}
                    placeholder="Select Department"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className={`px-6 md:px-10 py-6 md:py-8 ${!filterStaffDept ? "space-y-4" : "space-y-8"} ${!filterStaffDept ? "bg-slate-50/30" : "bg-white"}`}
          >
            <div className="rounded-2xl bg-blue-50/50 border border-blue-100 p-5 flex items-start gap-4 shadow-sm">
              <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Shield size={18} />
              </div>
              <p className="text-xs leading-relaxed text-blue-800 font-semibold max-w-4xl">
                Manage your department's faculty accounts here. Deactivated
                faculty will lose access immediately and disappear from HOD
                allotments, but their historical data remains preserved for
                reports.
              </p>
            </div>

            {!filterStaffDept ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-white shadow-soft-2xl border border-slate-100 text-slate-200 group hover:scale-110 transition-transform duration-500">
                  <Building2
                    size={48}
                    strokeWidth={1}
                    className="group-hover:text-violet-200 transition-colors"
                  />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">
                  Account Directory Empty
                </h3>
                <p className="mt-2.5 max-w-[320px] text-sm text-slate-500 font-semibold leading-relaxed">
                  Please select a department from the dropdown to view and
                  manage its faculty personnel.
                </p>
              </div>
            ) : (
              <>
                {/* ACTIVE STAFF */}
                <div>
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                      Active Personnel ({activeStaffRows.length})
                    </h3>
                  </div>
                  {activeStaffRows.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                      <p className="text-sm font-bold text-slate-400 italic">
                        No active staff members found in {filterStaffDept}.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                      {activeStaffRows.map((row) => (
                        <div
                          key={row.id}
                          className="group flex flex-col sm:flex-row items-center justify-between gap-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm hover:shadow-xl hover:border-violet-500/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-4">
                            <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-400 group-hover:from-violet-50 group-hover:to-violet-100 group-hover:text-violet-600 transition-all shadow-sm">
                              {row.role === "hod" ? (
                                <Shield size={22} />
                              ) : (
                                <Users size={22} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-900 group-hover:text-violet-700 transition-colors truncate">
                                {row.name}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-black ring-1 ${
                                    row.role === "hod"
                                      ? "bg-amber-50 text-amber-700 ring-amber-200"
                                      : "bg-violet-50 text-violet-700 ring-violet-200"
                                  }`}
                                >
                                  {row.role === "hod" ? "HOD" : "STAFF"}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                  <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                  {row.email}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() =>
                                handleDeactivateStaff(row.id, row.name)
                              }
                              className="h-10 px-4 flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-[11px] font-black text-red-600 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-200 transition-all active:scale-95 uppercase tracking-wider"
                              title="Deactivate Account"
                            >
                              <UserX size={16} strokeWidth={2.5} />
                              <span>Deactivate Account</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* INACTIVE STAFF */}
                {inactiveStaffRows.length > 0 && (
                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        Deactivated Personnel ({inactiveStaffRows.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {inactiveStaffRows.map((row) => (
                        <div
                          key={row.id}
                          className="group flex flex-col sm:flex-row items-center justify-between gap-5 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50/50 p-4 opacity-70 grayscale-[0.8] hover:grayscale-0 hover:opacity-100 hover:border-slate-300 transition-all duration-300"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-600 truncate line-through decoration-slate-400">
                                {row.name}
                              </p>
                              <p className="text-[10px] font-semibold text-slate-400 mt-1 flex items-center gap-1.5 uppercase tracking-tighter">
                                <span className="font-black text-slate-500">
                                  {row.role}
                                </span>
                                <span className="text-slate-200 inline-block">
                                  |
                                </span>
                                {row.email}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() =>
                                handleReactivateStaff(row.id, row.name)
                              }
                              className="h-9 px-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 text-[10px] font-black text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all active:scale-95"
                            >
                              <RotateCcw size={14} strokeWidth={3} />
                              RESTORE
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* NEW: THE GLOBAL FEEDBACK TAB FOR ADMIN */}
      {activeTab === "feedback" && (
        <div className="space-y-6">
          <Card className="p-0 border-purple-200 overflow-hidden shadow-sm print:hidden bg-white">
            <div className="border-b border-purple-100 bg-purple-50/50 px-6 py-4 flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
                <PieChart size={18} strokeWidth={2.5} />
              </div>
              <h3 className="font-extrabold text-purple-900 uppercase tracking-widest text-xs">
                Global Report Configuration
              </h3>
            </div>
            <div className="p-6 md:p-8 flex flex-wrap gap-5 items-end justify-between">
              <div className="flex flex-wrap gap-5 flex-1 w-full xl:w-auto">
                <div className="flex-1 min-w-0 sm:min-w-[120px]">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-1.5">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={acadYear}
                    onChange={(e) => setAcadYear(e.target.value)}
                    className="input-app py-2.5 text-sm font-bold px-4"
                    placeholder="e.g. 2025-26"
                  />
                </div>
                <div className="flex-1 min-w-0 sm:min-w-[120px]">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-1.5">
                    Semester
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={semester}
                    onChange={(e) =>
                      setSemester(
                        e.target.value.replace(/[^IViv]/g, "").toUpperCase(),
                      )
                    }
                    className="input-app py-2.5 text-sm font-bold px-4"
                    placeholder="e.g. VI"
                  />
                </div>
                <div className="flex-[1.5] min-w-0 sm:min-w-[200px] relative z-50">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-1.5">
                    Department
                  </label>
                  <CustomSelect
                    value={reportDept}
                    onChange={(val) => {
                      setReportDept(val);
                      setReportStaff("");
                    }}
                    options={departmentsList.map((d) => ({
                      value: d,
                      label: d,
                    }))}
                    placeholder="Choose Department"
                  />
                </div>
                {reportDept && (
                  <div className="flex-[2] min-w-0 sm:min-w-[200px] relative z-40 animate-in fade-in duration-300">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-1.5">
                      Faculty
                    </label>
                    <CustomSelect
                      value={reportStaff}
                      onChange={(val) => {
                        setReportStaff(val);
                        setReportSubject("");
                      }}
                      options={filteredStaffList.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      placeholder="All Faculty"
                    />
                  </div>
                )}
                {reportStaff && (
                  <div className="flex-[2] min-w-0 sm:min-w-[200px] relative z-[35] animate-in fade-in duration-300">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-1.5">
                      Subject
                    </label>
                    <CustomSelect
                      value={reportSubject}
                      onChange={(val) => setReportSubject(val)}
                      options={staffSubjects.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      placeholder="All Subjects"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (!acadYear || !semester) {
                    notifyError("Academic Year and Semester are required before printing.");
                    return;
                  }
                  window.print();
                }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest text-sm transition-all active:scale-95 w-full xl:w-auto mt-4 xl:mt-0"
              >
                <Printer size={18} strokeWidth={2.5} /> Print Report
              </button>
            </div>
          </Card>

          <div className="flex justify-center mb-6 mt-2 print:hidden print-hide" style={{ "@media print": { display: "none" } }}>
            <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex w-full md:w-auto">
              <button
                onClick={() => setReportMode("faculty")}
                className={`flex-1 md:w-48 py-3 text-sm font-bold rounded-xl transition-all ${reportMode === "faculty" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Faculty Feedback
              </button>
              <button
                onClick={() => setReportMode("exit")}
                className={`flex-1 md:w-48 py-3 text-sm font-bold rounded-xl transition-all ${reportMode === "exit" ? "bg-emerald-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Course Exit Survey
              </button>
              <button
                onClick={() => setReportMode("institution")}
                className={`flex-1 md:w-48 py-3 text-sm font-bold rounded-xl transition-all ${reportMode === "institution" ? "bg-amber-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`}
              >
                Institution Feedback
              </button>
            </div>
          </div>

          {(reportMode === "institution" || (reportDept && reportStaff)) &&
          totalStudents > 0 &&
          qCount > 0 ? (
            <>
              {/* --- VISUAL CHARTS (Hidden when printing) --- */}
              <div className="grid md:grid-cols-3 gap-6 mb-8 mt-4 print:hidden">
                <Card className="md:col-span-1 p-8 flex flex-col items-center justify-center border-purple-100">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                    <PieChart size={18} className="text-purple-600" />{" "}
                    Distribution
                  </h3>
                  <div className="flex gap-4 w-full mb-6 text-center justify-center opacity-80">
                    <div className="bg-purple-50 text-purple-800 px-3 py-1.5 rounded-lg border border-purple-100 font-bold text-xs flex flex-col">
                      <span className="text-[10px] uppercase text-purple-500">
                        Total Score
                      </span>
                      <span className="font-black text-sm">
                        {grandTotalScore}
                      </span>
                    </div>
                    <div className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-100 font-bold text-xs flex flex-col">
                      <span className="text-[10px] uppercase text-blue-500">
                        Avg / 25
                      </span>
                      <span className="font-black text-sm">{marksOutOf25}</span>
                    </div>
                  </div>
                  <div className="w-full relative">
                    <DonutChart
                      data={[
                        { name: "Excellent (5)", value: colTotals[5] },
                        { name: "Very Good (4)", value: colTotals[4] },
                        { name: "Good (3)", value: colTotals[3] },
                        { name: "Satisfactory (2)", value: colTotals[2] },
                        { name: "Poor (1)", value: colTotals[1] },
                      ]}
                      colors={[
                        "#22c55e",
                        "#3b82f6",
                        "#eab308",
                        "#f97316",
                        "#ef4444",
                      ]}
                      height={300}
                    />
                  </div>
                </Card>
                <Card className="md:col-span-2 p-8 border-purple-100">
                  <div className="flex justify-between items-end mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                      <BarChart size={18} className="text-purple-600" /> Global
                      Averages
                    </h3>
                    <h2 className="text-3xl font-black text-purple-700">
                      {overallAverageOutOf5}{" "}
                      <span className="text-sm text-slate-400">/ 5.0</span>
                    </h2>
                  </div>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-4">
                    {activeQuestions.map((q, idx) => {
                      const qTotalScore =
                        scoreCounts[idx][5] * 5 +
                        scoreCounts[idx][4] * 4 +
                        scoreCounts[idx][3] * 3 +
                        scoreCounts[idx][2] * 2 +
                        scoreCounts[idx][1] * 1;
                      const qAvg = (qTotalScore / totalStudents).toFixed(1);
                      const widthPercent = (qAvg / 5) * 100;
                      const numAvg = parseFloat(qAvg);
                      const barColor =
                        numAvg >= 4.5
                          ? "bg-green-500"
                          : numAvg >= 3.5
                            ? "bg-blue-500"
                            : numAvg >= 2.5
                              ? "bg-yellow-500"
                              : numAvg >= 1.5
                                ? "bg-orange-500"
                                : "bg-red-500";
                      return (
                        <div key={idx} className="relative">
                          <div className="flex justify-between items-start text-xs md:text-[13px] font-bold text-slate-700 mb-1.5 gap-4">
                            <span className="leading-snug">
                              {idx + 1}. {q}
                            </span>
                            <span className="shrink-0 font-black text-slate-800">
                              {qAvg}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${barColor}`}
                              style={{ width: `${widthPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* --- OFFICIAL MSBTE K15 TABLE (Printable) --- */}
              {reportMode !== "exit" && (
                <div className="bg-white p-8 md:p-12 border border-slate-300 print:border-none print:p-0 print:m-0 w-full overflow-x-auto print:overflow-visible text-black mt-8 print:mt-0">
                  <div className="text-center font-bold mb-4 border-b-2 border-black pb-4 relative">
                    <h3 className="text-sm">
                      Maharashtra State Board of Technical Education
                    </h3>
                    <h2 className="text-lg mt-1">STUDENT FEEDBACK</h2>
                    <p className="absolute right-0 top-0 font-bold text-sm">
                      K15
                    </p>
                  </div>
                  <div className="text-sm font-bold space-y-2 border-b-2 border-black pb-4 mb-4 print:pb-2 print:mb-2 print:space-y-1">
                    <p>
                      Institute Name: Solapur Education Society's Polytechnic,
                      Solapur
                    </p>
                    <div className="border-t border-black my-2 print:my-0.5"></div>
                    <p>Academic Year :- {acadYear}</p>
                    <div className="border-t border-black my-2 print:my-0.5"></div>
                    <div className="flex justify-between">
                      <p>Programme: {reportDept}</p>
                      <p>Semester: {semester}</p>
                      <p>Date :- {new Date().toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className="border-t border-black my-2 print:my-0.5"></div>
                    <p className="pt-2 print:pt-1">Name Of The Faculty :- {reportStaff}</p>
                  </div>
                  <table className="w-full text-xs print:text-[10px] border-collapse border border-black text-center mt-4 print:mt-2">
                    <thead>
                      <tr className="font-bold bg-slate-50 print:bg-transparent">
                        <th className="border border-black p-2 print:py-1 print:px-1 w-10">
                          Sr.
                          <br />
                          No.
                        </th>
                        <th className="border border-black p-2 text-left">
                          Parameter
                        </th>
                        <th className="border border-black p-2 w-16">
                          5 - Excellent
                        </th>
                        <th className="border border-black p-2 w-16">
                          4 - Very Good
                        </th>
                        <th className="border border-black p-2 w-16">
                          3 - Good
                        </th>
                        <th className="border border-black p-2 w-16">
                          2 - Satisfactory
                        </th>
                        <th className="border border-black p-2 w-16">
                          1 - Not Satisfactory
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {FEEDBACK_QUESTIONS.map((q, idx) => (
                        <tr key={idx}>
                          <td className="border border-black p-1.5 print:p-0.5 font-bold">
                            {idx + 1}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5 text-left font-semibold">
                            {q}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {scoreCounts[idx][5]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {scoreCounts[idx][4]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {scoreCounts[idx][3]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {scoreCounts[idx][2]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {scoreCounts[idx][1]}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td
                          colSpan="2"
                          className="border border-black p-1.5 text-right"
                        >
                          Count
                        </td>
                        <td className="border border-black p-1.5">
                          {colTotals[5]}
                        </td>
                        <td className="border border-black p-1.5">
                          {colTotals[4]}
                        </td>
                        <td className="border border-black p-1.5">
                          {colTotals[3]}
                        </td>
                        <td className="border border-black p-1.5">
                          {colTotals[2]}
                        </td>
                        <td className="border border-black p-1.5">
                          {colTotals[1]}
                        </td>
                      </tr>
                      <tr className="font-bold">
                        <td
                          colSpan="2"
                          className="border border-black p-1.5 print:p-0.5 text-right"
                        >
                          Total Score
                        </td>
                        <td className="border border-black p-1.5 print:p-0.5">
                          {colScores[5]}
                        </td>
                        <td className="border border-black p-1.5 print:p-0.5">
                          {colScores[4]}
                        </td>
                        <td className="border border-black p-1.5 print:p-0.5">
                          {colScores[3]}
                        </td>
                        <td className="border border-black p-1.5 print:p-0.5">
                          {colScores[2]}
                        </td>
                        <td className="border border-black p-1.5 print:p-0.5">
                          {colScores[1]}
                        </td>
                      </tr>
                      <tr className="font-bold bg-purple-50 print:bg-transparent">
                        <td
                          colSpan="6"
                          className="border border-black p-3 print:py-1 print:px-2 text-right text-sm print:text-xs text-purple-900 print:text-black"
                        >
                          Average Marks Obtained out of 25
                        </td>
                        <td className="border border-black p-3 print:py-1 print:px-2 text-sm print:text-xs text-purple-900 print:text-black">
                          {marksOutOf25}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-12 flex justify-end px-4 font-black text-sm print:mt-28">
                    <div className="text-center w-48">
                      <div className="w-full border-b-2 border-dotted border-black mb-2"></div>
                      <p>Principal Signature</p>
                    </div>
                  </div>
                </div>
              )}

              {reportMode === "exit" && (
                <div className="bg-white p-8 md:p-12 border border-slate-300 print:border-none print:p-0 print:m-0 w-full overflow-x-auto print:overflow-visible text-black mt-8 print:mt-0 uppercase">
                  <div className="text-center font-bold mb-4 border-b-2 border-black pb-4 relative">
                    <h3 className="text-sm">
                      Maharashtra State Board of Technical Education
                    </h3>
                    <h2 className="text-lg mt-1">COURSE EXIT SURVEY REPORT</h2>
                  </div>
                  <div className="text-sm font-bold space-y-2 border-b-2 border-black pb-4 mb-4">
                    <p>
                      Institute Name: Solapur Education Society&#39;s
                      Polytechnic, Solapur
                    </p>
                    <div className="border-t border-black my-2"></div>
                    <div className="flex justify-between">
                      <p>Course :- {reportSubject}</p>
                      <p>Academic Year :- {acadYear}</p>
                    </div>
                    <div className="border-t border-black my-2"></div>
                    <div className="flex justify-between">
                      <p>Programme: {reportDept}</p>
                      <p>Semester: {semester}</p>
                      <p>Date :- {new Date().toLocaleDateString("en-GB")}</p>
                    </div>
                    <div className="border-t border-black my-2"></div>
                    <p className="pt-2">Name Of The Faculty :- {reportStaff}</p>
                  </div>
                  <table className="w-full text-[11px] border-collapse border border-black text-center mt-4">
                    <thead>
                      <tr className="font-bold bg-slate-50 print:bg-transparent">
                        <th className="border border-black p-2 w-10">
                          Sr. No.
                        </th>
                        <th className="border border-black p-2 text-left">
                          Parameters (Course Outcomes)
                        </th>
                        <th className="border border-black p-2 w-14">
                          Excellent 5
                        </th>
                        <th className="border border-black p-2 w-14">
                          Very good 4
                        </th>
                        <th className="border border-black p-2 w-14">Good 3</th>
                        <th className="border border-black p-2 w-14">
                          Satisfactory 2
                        </th>
                        <th className="border border-black p-2 w-14">
                          Average 1
                        </th>
                        <th className="border border-black p-2 w-14">
                          Max. Marks
                        </th>
                        <th className="border border-black p-2 w-14">TOTAL</th>
                        <th className="border border-black p-2 w-14">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQuestions.map((q, idx) => {
                        const rowTotal =
                          scoreCounts[idx][5] * 5 +
                          scoreCounts[idx][4] * 4 +
                          scoreCounts[idx][3] * 3 +
                          scoreCounts[idx][2] * 2 +
                          scoreCounts[idx][1] * 1;
                        const rowMax = totalStudents * 5;
                        const rowPerc =
                          rowMax > 0
                            ? ((rowTotal / rowMax) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <tr key={idx}>
                            <td className="border border-black p-1.5 font-bold">
                              {idx + 1}
                            </td>
                            <td className="border border-black p-1.5 text-left font-semibold">
                              {q}
                            </td>
                            <td className="border border-black p-1.5">
                              {scoreCounts[idx][5]}
                            </td>
                            <td className="border border-black p-1.5">
                              {scoreCounts[idx][4]}
                            </td>
                            <td className="border border-black p-1.5">
                              {scoreCounts[idx][3]}
                            </td>
                            <td className="border border-black p-1.5">
                              {scoreCounts[idx][2]}
                            </td>
                            <td className="border border-black p-1.5">
                              {scoreCounts[idx][1]}
                            </td>
                            <td className="border border-black p-1.5 font-bold">
                              {rowMax}
                            </td>
                            <td className="border border-black p-1.5 font-bold">
                              {rowTotal}
                            </td>
                            <td className="border border-black p-1.5 font-bold">
                              {rowPerc}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="mt-12 flex justify-end pr-12 font-bold text-sm print:mt-28">
                    <div className="text-left border-black p-4">
                      <p>Signature of Principal :- ________________</p>
                    </div>
                  </div>
                </div>
              )}

              {reportMode === "institution" && (
                <div className="bg-white p-8 md:p-12 border border-slate-300 print:border-none print:p-0 print:m-0 w-full overflow-x-auto print:overflow-visible text-black mt-8 print:mt-0 uppercase font-sans">
                  <div className="text-center font-bold mb-6 border-b-2 border-black pb-6 relative">
                    <h3 className="text-base tracking-tight uppercase">
                      Solapur Education Society's Polytechnic, Solapur
                    </h3>
                    <h2 className="text-2xl mt-2 font-black tracking-widest border-t border-black pt-4 inline-block px-8">
                      STUDENT SATISFACTION FEEDBACK
                    </h2>
                    <p className="mt-2 text-sm">Academic Year : {acadYear}</p>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-4 text-sm font-bold px-2">
                    <p>Department: {reportDept || "All Departments"}</p>
                    <p className="text-right">
                      Report Date: {new Date().toLocaleDateString("en-GB")}
                    </p>
                  </div>

                  <table className="w-full text-[10px] border-collapse border-2 border-black text-center">
                    <thead>
                      <tr className="font-extrabold bg-slate-100 print:bg-transparent border-b-2 border-black">
                        <th className="border border-black p-2 print:py-1 print:px-1 w-10">
                          Sr. No.
                        </th>
                        <th className="border border-black p-2 print:py-1 print:px-1 text-left min-w-[200px]">
                          Parameters
                        </th>
                        <th className="border border-black p-2 w-14">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Filter responses for institution feedback
                        const instData = globalInstResponses.filter(
                          (r) =>
                            (!reportDept || r.department === reportDept) &&
                            (!acadYear || r.academicYear === acadYear) &&
                            (!reportYearLevel ||
                              r.yearLevel === reportYearLevel),
                        );

                        const respondentsCount = instData.length;

                        return INSTITUTION_QUESTIONS.map((q, idx) => {
                          const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
                          instData.forEach((r) => {
                            const val = parseInt(r.scores[idx]);
                            if (counts[val] !== undefined) counts[val]++;
                          });

                          const totalScore =
                            counts[5] * 5 +
                            counts[4] * 4 +
                            counts[3] * 3 +
                            counts[2] * 2 +
                            counts[1] * 1;
                          const maxMarks = respondentsCount * 5;
                          const percentage =
                            maxMarks > 0
                              ? ((totalScore / maxMarks) * 100).toFixed(1)
                              : "0.0";

                          return (
                            <tr key={idx} className="border-b border-black">
                              <td className="border border-black p-1.5 font-bold">
                                {idx + 1}
                              </td>
                              <td className="border border-black p-1.5 text-left font-bold text-[11px] leading-tight">
                                {q}
                              </td>
                              <td className="border border-black p-1.5">
                                {counts[5]}
                              </td>
                              <td className="border border-black p-1.5">
                                {counts[4]}
                              </td>
                              <td className="border border-black p-1.5">
                                {counts[3]}
                              </td>
                              <td className="border border-black p-1.5">
                                {counts[2]}
                              </td>
                              <td className="border border-black p-1.5">
                                {counts[1]}
                              </td>
                              <td className="border border-black p-1.5 font-black">
                                {maxMarks}
                              </td>
                              <td className="border border-black p-1.5 font-black">
                                {totalScore}
                              </td>
                              <td className="border border-black p-1.5 font-black">
                                {percentage}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>

                  <div className="mt-20 flex justify-between items-end px-4 font-black text-sm print:mt-32">
                    <div className="text-center">
                      <div className="w-48 border-b-2 border-dotted border-black mb-2"></div>
                      <p>Head of Department</p>
                    </div>
                    <div className="text-center">
                      <div className="w-48 border-b-2 border-dotted border-black mb-2"></div>
                      <p>Principal Signature</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : reportDept && reportStaff ? (
            <div className="text-center py-20 opacity-30">
              <h2 className="text-2xl font-black uppercase text-purple-900">
                {reportMode === "exit" && !reportSubject
                  ? "Select a subject to view Course Exit Analytics"
                  : `No Data Available for ${reportStaff}`}
              </h2>
            </div>
          ) : (
            <Card className="p-16 text-center bg-purple-50 border-purple-100 shadow-inner">
              <FileText size={64} className="mx-auto text-purple-300 mb-6" />
              <h2 className="text-2xl font-black uppercase text-purple-900 tracking-tight">
                Global Feedback Access
              </h2>
              <p className="text-purple-600 font-medium mt-3 max-w-md mx-auto">
                Select a Department and Faculty member above to generate their
                MSBTE K15 report across all assigned subjects.
              </p>
            </Card>
          )}
        </div>
      )}

      {activeTab === "controls" && (
        <Card className="max-w-3xl overflow-hidden p-0 border-amber-200">
          <div className="border-b border-amber-100 bg-amber-50 px-6 py-5">
            <h2 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-slate-900">
              <Building2 size={26} className="text-amber-600" />
              Global Institution Controls
            </h2>
            <p className="mt-1.5 text-base font-medium text-slate-600">
              Manage global settings for the annual institution-level satisfy
              survey.
            </p>
          </div>
          <div className="p-6 md:p-8 space-y-6">

            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <h4 className="text-lg font-bold text-slate-900">
                  Annual Portal Access
                </h4>
                <p className="text-sm font-medium text-slate-600 mt-0.5">
                  Enable students to fill the satisfaction survey
                </p>
              </div>
              <button
                onClick={handleToggleInstPortal}
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${isInstPortalOpen ? "bg-red-500 text-white hover:bg-red-600" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
              >
                {isInstPortalOpen
                  ? "Close Portal"
                  : "Open Portal"}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
