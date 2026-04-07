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
import { FEEDBACK_QUESTIONS } from "../constants/feedbackQuestions";
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
  const [reportDept, setReportDept] = useState("");
  const [reportStaff, setReportStaff] = useState("");
  const [acadYear, setAcadYear] = useState("");
  const [semester, setSemester] = useState("");

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

      const schemeSnap = await getDocs(collection(db, "Schemes"));
      setSchemesList(schemeSnap.docs.map((d) => d.data().name));

      const mappingSnap = await getDoc(doc(db, "Settings", "SchemeMapping"));
      if (mappingSnap.exists()) {
        setSchemeMapping(mappingSnap.data());
      }
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
    const name = schemeName.trim();
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

  // --- REPORT ENGINE CALCULATIONS ---
  const reportData = globalFeedbacks.filter(
    (f) => f.department === reportDept && f.staffName === reportStaff,
  );
  const totalStudents = reportData.length;

  const scoreCounts = Array.from({ length: FEEDBACK_QUESTIONS.length }, () => ({
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
        if (scoreCounts[qIndex][rating] !== undefined)
          scoreCounts[qIndex][rating]++;
      });
    });
  }

  const colTotals = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const colScores = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let grandTotalScore = 0;

  for (let i = 0; i < FEEDBACK_QUESTIONS.length; i++) {
    [5, 4, 3, 2, 1].forEach((rating) => {
      colTotals[rating] += scoreCounts[i][rating];
      colScores[rating] += scoreCounts[i][rating] * rating;
      grandTotalScore += scoreCounts[i][rating] * rating;
    });
  }

  const maxPossibleScore = totalStudents * FEEDBACK_QUESTIONS.length * 5;
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

  const staffAccounts = globalStaffList.filter((u) => u.role === "staff");
  const activeStaffRows = staffAccounts.filter((u) => u.active !== false);
  const inactiveStaffRows = staffAccounts.filter((u) => u.active === false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-indigo-200">
            <Building2 size={24} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Admin Portal</h1>
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
          {["departments", "hods", "schemes", "staff", "feedback"].map(
            (tab) => {
              let label = tab;
              if (tab === "feedback") label = "Reports";
              else if (tab === "hods") label = "HODs";
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
            },
          )}
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
                    1st Year (Sem 1 & 2)
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
                    2nd Year (Sem 3 & 4)
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
                    3rd Year (Sem 5 & 6)
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="page-card-title flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <UserPlus size={20} />
                </span>
                Add faculty (staff)
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Unique email per person — cannot duplicate an HOD email.
              </p>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6">
                <div>
                  <label className="section-title mb-2 block">Full name</label>
                  <input
                    type="text"
                    placeholder="Faculty name"
                    className="input-app-admin"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="section-title mb-2 block">Department</label>
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
                  <label className="section-title mb-2 block">Email</label>
                  <input
                    type="email"
                    placeholder="staff@college.edu"
                    className="input-app-admin"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="section-title mb-2 block">
                    Initial password
                  </label>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      className="input-app-admin w-full pr-10"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 focus:outline-none"
                      tabIndex="-1"
                    >
                      {showStaffPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
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
                    <PlusCircle size={18} strokeWidth={2.5} /> Save Staff
                  </>
                )}
              </button>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h2 className="page-card-title flex items-center gap-2">
                <Users size={18} className="text-slate-500" />
                Faculty accounts
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Deactivate retired or departed faculty — they disappear from HOD
                allotments and reports but historical feedback stays in the
                database. Firebase login remains until you remove the user in
                Firebase Console if required.
              </p>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Active ({activeStaffRows.length})
                </h3>
                {activeStaffRows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No staff accounts yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 w-36 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeStaffRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {row.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {row.dept}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  handleDeactivateStaff(row.id, row.name)
                                }
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                              >
                                <UserX size={14} />
                                Deactivate
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {inactiveStaffRows.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Deactivated ({inactiveStaffRows.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 border-dashed">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 w-36 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inactiveStaffRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100 last:border-0 opacity-90"
                          >
                            <td className="px-4 py-3 font-medium text-slate-600">
                              {row.name}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {row.dept}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  handleReactivateStaff(row.id, row.name)
                                }
                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <RotateCcw size={14} />
                                Reactivate
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
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
            <div className="p-6 md:p-8 flex flex-wrap gap-5 items-center justify-between">
              <div className="flex flex-wrap gap-5 flex-1 w-full xl:w-auto">
                <div className="flex-1 min-w-[200px] relative z-50">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-2">
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
                  <div className="flex-[2] min-w-[200px] relative z-40 animate-in fade-in duration-300">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-2">
                      Faculty
                    </label>
                    <CustomSelect
                      value={reportStaff}
                      onChange={(val) => setReportStaff(val)}
                      options={filteredStaffList.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      placeholder="All Faculty"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-[100px]">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-2">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={acadYear}
                    onChange={(e) => setAcadYear(e.target.value)}
                    className="input-app py-2.5 text-sm font-bold text-center"
                    placeholder="e.g. 2025-26"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest block mb-2">
                    Semester
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={semester}
                    onChange={(e) => setSemester(e.target.value.replace(/[^IViv]/g, '').toUpperCase())}
                    className="input-app py-2.5 text-sm font-bold text-center"
                    placeholder="e.g. VI"
                  />
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20 hover:from-purple-700 hover:to-indigo-700 font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest text-sm transition-all active:scale-95 w-full xl:w-auto mt-4 xl:mt-0"
              >
                <Printer size={18} strokeWidth={2.5} /> Print Report
              </button>
            </div>
          </Card>

          {reportDept && reportStaff && totalStudents > 0 ? (
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
                  <div className="w-full h-[320px]">
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
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4">
                    {FEEDBACK_QUESTIONS.map((q, idx) => {
                      const qTotalScore =
                        scoreCounts[idx][5] * 5 +
                        scoreCounts[idx][4] * 4 +
                        scoreCounts[idx][3] * 3 +
                        scoreCounts[idx][2] * 2 +
                        scoreCounts[idx][1] * 1;
                      const qAvg = (qTotalScore / totalStudents).toFixed(1);
                      const widthPercent = (qAvg / 5) * 100;
                      const barColor =
                        qAvg >= 4.0
                          ? "bg-green-500"
                          : qAvg >= 3.0
                            ? "bg-blue-500"
                            : qAvg >= 2.0
                              ? "bg-yellow-500"
                              : "bg-red-500";
                      return (
                        <div key={idx} className="relative">
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                            <span className="truncate w-3/4">
                              {idx + 1}. {q}
                            </span>
                            <span>{qAvg}</span>
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
              <div className="bg-white p-8 md:p-12 border border-slate-300 print:border-none print:p-0 print:m-0 w-full overflow-x-auto text-black mt-8 print:mt-0">
                <div className="text-center font-bold mb-4 border-b-2 border-black pb-4">
                  <h3 className="text-sm">
                    Maharashtra State Board of Technical Education
                  </h3>
                  <h2 className="text-lg mt-1">STUDENT FEEDBACK</h2>
                  <p className="absolute right-8 top-8 font-bold text-sm">
                    K15
                  </p>
                </div>
                <div className="text-sm font-bold space-y-2 border-b-2 border-black pb-4 mb-4">
                  <p>
                    Institute Name: Solapur Education Society's Polytechnic,
                    Solapur
                  </p>
                  <div className="border-t border-black my-2"></div>
                  <p>Academic Year :- {acadYear}</p>
                  <div className="border-t border-black my-2"></div>
                  <div className="flex justify-between">
                    <p>Programme: {reportDept}</p>
                    <p>Semester: {semester}</p>
                    <p>Date :- {new Date().toLocaleDateString("en-GB")}</p>
                  </div>
                  <div className="border-t border-black my-2"></div>
                  <p className="pt-2">Name Of The Faculty :- {reportStaff}</p>
                </div>
                <table className="w-full text-xs border-collapse border border-black text-center mt-4">
                  <thead>
                    <tr className="font-bold bg-slate-50 print:bg-transparent">
                      <th className="border border-black p-2 w-10">
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
                      <th className="border border-black p-2 w-16">3 - Good</th>
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
                        className="border border-black p-1.5 text-right"
                      >
                        Total Score
                      </td>
                      <td className="border border-black p-1.5">
                        {colScores[5]}
                      </td>
                      <td className="border border-black p-1.5">
                        {colScores[4]}
                      </td>
                      <td className="border border-black p-1.5">
                        {colScores[3]}
                      </td>
                      <td className="border border-black p-1.5">
                        {colScores[2]}
                      </td>
                      <td className="border border-black p-1.5">
                        {colScores[1]}
                      </td>
                    </tr>
                    <tr className="font-bold bg-purple-50 print:bg-transparent">
                      <td
                        colSpan="6"
                        className="border border-black p-3 text-right text-sm text-purple-900 print:text-black"
                      >
                        Average Marks Obtained out of 25
                      </td>
                      <td className="border border-black p-3 text-sm text-purple-900 print:text-black">
                        {marksOutOf25}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-20 flex justify-end pr-12 font-bold text-sm">
                  <div className="text-left border-black p-4">
                    <p>Signature of Principal :- ________________</p>
                  </div>
                </div>
              </div>
            </>
          ) : reportDept && reportStaff ? (
            <div className="text-center py-20 opacity-30">
              <h2 className="text-2xl font-black uppercase text-purple-900">
                No Data Available for {reportStaff}
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
    </div>
  );
}
