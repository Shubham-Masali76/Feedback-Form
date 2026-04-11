import React, { useState, useEffect, useCallback } from "react";
import ReactDOM, { createPortal } from "react-dom";
import {
  Users,
  BookOpen,
  Link,
  Settings,
  Upload,
  Trash2,
  Activity,
  Search,
  FileText,
  Printer,
  PieChart,
  BarChart,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  CheckCircle,
  UserPlus,
  Library,
  Edit2,
  Filter,
  X,
  RefreshCw,
  ArrowUpCircle,
  Building2,
} from "lucide-react";
import CustomSelect from "../components/UI/CustomSelect";
import { Card } from "../components/UI";
import DonutChart from "../components/DonutChart";
import QuestionDonutChart from "../components/QuestionDonutChart";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { FEEDBACK_QUESTIONS } from "../constants/feedbackQuestions";
import {
  isValidRollNumber,
  normalizeRollDigits,
  ROLL_NUMBER_HINT,
  rollFromSpreadsheetCell,
} from "../constants/rollNumber";
import { useNotify } from "../context/NotificationContext.jsx";
// Removed hardcoded MSBTE import

export default function HodDashboard({ user }) {
  const { success, error: notifyError, warning } = useNotify();
  const [activeTab, setActiveTab] = useState("students");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRemainingModal, setShowRemainingModal] = useState(false);
  const [showSubmittedModal, setShowSubmittedModal] = useState(false);

  // -- Data States --
  const [staffList, setStaffList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [students, setStudents] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]); // NEW: Store Feedbacks
  const [allocations, setAllocations] = useState([]); // NEW: Store Allocations
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isStaffPortalOpen, setIsStaffPortalOpen] = useState(false);

  // -- Form States --
  const [excelClass, setExcelClass] = useState("");
  const [excelDiv, setExcelDiv] = useState("A");

  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectForm, setEditSubjectForm] = useState({
    name: "",
    code: "",
    isElective: false,
  });
  const [stdForm, setStdForm] = useState({
    name: "",
    roll: "",
    enroll: "",
    email: "",
    div: "",
    tClass: "",
  });
  const [subForm, setSubForm] = useState({
    name: "",
    code: "",
    isElective: false,
  });
  const [allotForm, setAllotForm] = useState({
    staffDept: user.dept,
    staff: "",
    subject: "",
    tClass: "",
    division: "",
  });

  const [departmentsList, setDepartmentsList] = useState([]);
  const [allDepartmentsData, setAllDepartmentsData] = useState([]);
  const [allStaffList, setAllStaffList] = useState([]);
  const [allSubjectList, setAllSubjectList] = useState([]);
  const [schemeMappings, setSchemeMappings] = useState({
    year1: "",
    year2: "",
    year3: "",
  });

  // -- Monitor & Report States (NEW) --
  const [monitorDept, setMonitorDept] = useState("");
  const [monitorStaff, setMonitorStaff] = useState("");
  const [monitorDivision, setMonitorDivision] = useState("");
  const [reportDept, setReportDept] = useState(user.dept || "");
  const [reportStaff, setReportStaff] = useState("");
  const [reportSubject, setReportSubject] = useState("");
  const [acadYear, setAcadYear] = useState("");
  const [semester, setSemester] = useState("");
  const [dynamicClassOptions, setDynamicClassOptions] = useState([]);

  // -- Course Exit Survey States --
  const [reportMode, setReportMode] = useState("faculty"); // "faculty" | "exit"
  const [exitForms, setExitForms] = useState([]);
  const [exitResponses, setExitResponses] = useState([]);

  // -- Directory Filter & Edit States --
  const [searchRollNo, setSearchRollNo] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    roll: "",
    enroll: "",
    email: "",
    tClass: "",
    div: "",
  });

  // -- Student Lifecycle States --
  const [promoteSource, setPromoteSource] = useState("");
  const [promoteTarget, setPromoteTarget] = useState("");
  const [deleteClassTarget, setDeleteClassTarget] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const allDeptsQ = query(collection(db, "Departments"));
      const allDeptsSnap = await getDocs(allDeptsQ);
      const deptsData = allDeptsSnap.docs.map((d) => d.data());
      setAllDepartmentsData(deptsData);
      setDepartmentsList(deptsData.map((d) => d.name));

      const allStaffQ = query(
        collection(db, "Users"),
        where("role", "==", "staff"),
      );
      const allStaffSnap = await getDocs(allStaffQ);
      const activeStaff = allStaffSnap.docs
        .map((d) => d.data())
        .filter((u) => u.active !== false);

      setAllStaffList(activeStaff);

      setStaffList(
        activeStaff.filter((u) => u.dept === user.dept).map((u) => u.name),
      );

      const allSubQ = query(collection(db, "Subjects"));
      const allSubSnap = await getDocs(allSubQ);
      const fetchedAllSubjects = allSubSnap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      }));
      setAllSubjectList(fetchedAllSubjects);
      setSubjectList(
        fetchedAllSubjects.filter((s) => s.department === user.dept),
      );

      const stdQ = query(
        collection(db, "Students"),
        where("department", "==", user.dept),
      );
      const stdSnap = await getDocs(stdQ);
      const fetchedStudents = stdSnap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      }));
      setStudents(fetchedStudents);
      console.log("Fetched students:", fetchedStudents);

      // Fetch Feedbacks for Monitor & Reports
      const feedQ = query(
        collection(db, "Feedbacks"),
        where("department", "==", user.dept),
      );
      const feedSnap = await getDocs(feedQ);
      const fetchedFeedbacks = feedSnap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setFeedbacks(fetchedFeedbacks);
      console.log("Fetched feedbacks:", fetchedFeedbacks);

      // Fetch Course Exit Data
      const exitFormsQ = query(
        collection(db, "CourseExitForms"),
        where("department", "==", user.dept),
      );
      const exitFormsSnap = await getDocs(exitFormsQ);
      setExitForms(exitFormsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const exitRespQ = query(
        collection(db, "CourseExitResponses"),
        where("department", "==", user.dept),
      );
      const exitRespSnap = await getDocs(exitRespQ);
      setExitResponses(
        exitRespSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      );

      // Fetch Allocations
      const allocQ = query(
        collection(db, "Allocations"),
        where("department", "==", user.dept),
      );
      const allocSnap = await getDocs(allocQ);
      const fetchedAllocations = allocSnap.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      }));
      setAllocations(fetchedAllocations);
      console.log("Fetched allocations:", fetchedAllocations);

      const setSnap = await getDoc(doc(db, "Settings", "Global"));
      if (setSnap.exists()) {
        setIsPortalOpen(setSnap.data().studentPortalOpen === true);
        setIsStaffPortalOpen(setSnap.data().staffPortalOpen === true);
      }

      // --- DYNAMIC SCHEME GENERATION ---
      const mapSnap = await getDoc(doc(db, "Settings", "SchemeMapping"));
      const sMap = mapSnap.exists()
        ? mapSnap.data()
        : { year1: "K-Scheme", year2: "K-Scheme", year3: "K-Scheme" };
      setSchemeMappings(sMap);
      const formatScheme = (val) => {
        if (!val) return "K-Scheme";
        const str = String(val).trim();
        if (str.toLowerCase().includes("scheme")) return str;
        return `${str}-Scheme`;
      };

      const y1 = formatScheme(sMap.year1);
      const y2 = formatScheme(sMap.year2);
      const y3 = formatScheme(sMap.year3);

      const extractL = (s) =>
        s ? String(s).trim().charAt(0).toUpperCase() : "K";
      const l1 = extractL(sMap.year1);
      const l2 = extractL(sMap.year2);
      const l3 = extractL(sMap.year3);

      const deptCodeTarget = !allDeptsSnap.empty
        ? deptsData.find((d) => d.name === user.dept)?.code || "XX"
        : "XX";

      setDynamicClassOptions([
        {
          group: `1st Year (Sem 1 & 2) - ${y1}`,
          options: [
            {
              value: `${deptCodeTarget}1${l1}`,
              label: `${deptCodeTarget}1${l1} (Sem 1 - ${y1})`,
            },
            {
              value: `${deptCodeTarget}2${l1}`,
              label: `${deptCodeTarget}2${l1} (Sem 2 - ${y1})`,
            },
          ],
        },
        {
          group: `2nd Year (Sem 3 & 4) - ${y2}`,
          options: [
            {
              value: `${deptCodeTarget}3${l2}`,
              label: `${deptCodeTarget}3${l2} (Sem 3 - ${y2})`,
            },
            {
              value: `${deptCodeTarget}4${l2}`,
              label: `${deptCodeTarget}4${l2} (Sem 4 - ${y2})`,
            },
          ],
        },
        {
          group: `3rd Year (Sem 5 & 6) - ${y3}`,
          options: [
            {
              value: `${deptCodeTarget}5${l3}`,
              label: `${deptCodeTarget}5${l3} (Sem 5 - ${y3})`,
            },
            {
              value: `${deptCodeTarget}6${l3}`,
              label: `${deptCodeTarget}6${l3} (Sem 6 - ${y3})`,
            },
          ],
        },
      ]);
    } catch (err) {
      console.error(err);
    }
  }, [user.dept]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  // Dynamic Options replaced static MSBTE_CLASS_OPTIONS

  const handleManualStudent = async (e) => {
    e.preventDefault();
    const rollNorm = normalizeRollDigits(stdForm.roll);
    if (!isValidRollNumber(rollNorm)) {
      warning(ROLL_NUMBER_HINT);
      return;
    }
    const emailTrim = stdForm.email.trim();
    if (!emailTrim) {
      warning(
        "Student email is required — OTP login sends the code to this address.",
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      warning("Enter a valid email address.");
      return;
    }
    try {
      await addDoc(collection(db, "Students"), {
        name: stdForm.name.trim(),
        rollNo: rollNorm,
        enrollmentNo: stdForm.enroll.trim(),
        email: emailTrim,
        division: stdForm.div,
        targetClass: stdForm.tClass,
        department: user.dept,
        status: "pending",
        isClaimed: false,
      });
      setStdForm({
        name: "",
        roll: "",
        enroll: "",
        email: "",
        div: "",
        tClass: "",
      });
      fetchData();
      success("Student saved.");
    } catch {
      notifyError("Failed to save student.");
    }
  };

  const handleExcelUpload = async (e) => {
    // YOUR ROBUST EXCEL PARSER (KEPT INTACT)
    const file = e.target.files[0];
    if (!file) return;
    setIsSubmitting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { header: 1 },
      );
      let headerIdx = -1,
        nameCols = [],
        rollCol = -1,
        enrollCol = -1,
        emailCol = -1;
      for (let i = 0; i < Math.min(20, rawRows.length); i++) {
        const row = rawRows[i];
        if (!row || row.length < 2) continue;
        const s = row.join(" ").toLowerCase().replace(/\s/g, "");
        if (s.includes("name") && (s.includes("roll") || s.includes("rno"))) {
          headerIdx = i;
          row.forEach((cell, idx) => {
            const c = String(cell || "")
              .toLowerCase()
              .replace(/\s/g, "");
            if (c.includes("name")) nameCols.push(idx);
            if (c.includes("roll") || c.includes("rno")) rollCol = idx;
            if (c.includes("enroll") || c.includes("prn")) enrollCol = idx;
            if (c.includes("email")) emailCol = idx;
          });
          break;
        }
      }
      if (headerIdx === -1) {
        notifyError(
          "Could not find a header row with Name and Roll/R.No columns. Check your Excel layout.",
        );
        setIsSubmitting(false);
        return;
      }
      if (emailCol === -1) {
        notifyError(
          'Add an "Email" column to your sheet. Students need it to receive OTP codes when logging in.',
        );
        setIsSubmitting(false);
        return;
      }
      const promises = [];
      let skippedRoll = 0;
      let skippedEmail = 0;
      for (let i = headerIdx + 1; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (!r || !r[enrollCol]) continue;
        const rollNo = rollFromSpreadsheetCell(r[rollCol]);
        if (!isValidRollNumber(rollNo)) {
          skippedRoll++;
          continue;
        }
        const emailStr = String(r[emailCol] || "").trim();
        if (!emailStr) {
          skippedEmail++;
          continue;
        }
        promises.push(
          addDoc(collection(db, "Students"), {
            department: user.dept,
            name: nameCols.map((idx) => String(r[idx] || "").trim()).join(" "),
            rollNo,
            enrollmentNo: String(r[enrollCol] || "").trim(),
            email: emailStr,
            division: excelDiv,
            targetClass: excelClass,
            status: "pending",
            isClaimed: false,
          }),
        );
      }
      await Promise.all(promises);
      const skipMsg = [
        skippedRoll
          ? `${skippedRoll} row(s) skipped (invalid roll — use 15xx / 25xx / 35xx).`
          : "",
        skippedEmail ? `${skippedEmail} row(s) skipped (empty email).` : "",
      ]
        .filter(Boolean)
        .join(" ");
      success(
        `Imported ${promises.length} student(s) into ${excelClass} (Div ${excelDiv}).${skipMsg ? ` ${skipMsg}` : ""}`,
      );
      fetchData();
    } catch {
      notifyError(
        "Excel processing failed. Check the file format and try again.",
      );
    }
    setIsSubmitting(false);
  };

  const dynamicClassOptionsForAllotment = React.useMemo(() => {
    const sMap = schemeMappings;
    const formatScheme = (val) => {
      if (!val) return "K-Scheme";
      const str = String(val).trim();
      if (str.toLowerCase().includes("scheme")) return str;
      return `${str}-Scheme`;
    };
    const y1 = formatScheme(sMap.year1);
    const y2 = formatScheme(sMap.year2);
    const y3 = formatScheme(sMap.year3);

    const extractL = (s) =>
      s ? String(s).trim().charAt(0).toUpperCase() : "K";
    const l1 = extractL(sMap.year1);
    const l2 = extractL(sMap.year2);
    const l3 = extractL(sMap.year3);

    const deptCodeTarget =
      allDepartmentsData.find(
        (d) => d.name === (allotForm.staffDept || user.dept),
      )?.code || "XX";

    return [
      {
        group: `1st Year (Sem 1 & 2) - ${y1}`,
        options: [
          {
            value: `${deptCodeTarget}1${l1}`,
            label: `${deptCodeTarget}1${l1} (Sem 1 - ${y1})`,
          },
          {
            value: `${deptCodeTarget}2${l1}`,
            label: `${deptCodeTarget}2${l1} (Sem 2 - ${y1})`,
          },
        ],
      },
      {
        group: `2nd Year (Sem 3 & 4) - ${y2}`,
        options: [
          {
            value: `${deptCodeTarget}3${l2}`,
            label: `${deptCodeTarget}3${l2} (Sem 3 - ${y2})`,
          },
          {
            value: `${deptCodeTarget}4${l2}`,
            label: `${deptCodeTarget}4${l2} (Sem 4 - ${y2})`,
          },
        ],
      },
      {
        group: `3rd Year (Sem 5 & 6) - ${y3}`,
        options: [
          {
            value: `${deptCodeTarget}5${l3}`,
            label: `${deptCodeTarget}5${l3} (Sem 5 - ${y3})`,
          },
          {
            value: `${deptCodeTarget}6${l3}`,
            label: `${deptCodeTarget}6${l3} (Sem 6 - ${y3})`,
          },
        ],
      },
    ];
  }, [allotForm.staffDept, user.dept, allDepartmentsData, schemeMappings]);

  const handleAllotment = async (e) => {
    e.preventDefault();
    try {
      const selectedSubjectData = allSubjectList.find(
        (s) =>
          s.name === allotForm.subject &&
          s.department === (allotForm.staffDept || user.dept),
      );
      const isElective = selectedSubjectData?.isElective || false;
      await addDoc(collection(db, "Allocations"), {
        staff: allotForm.staff,
        subject: allotForm.subject,
        tClass: allotForm.tClass,
        targetClass: allotForm.tClass,
        division: allotForm.division,
        department: allotForm.staffDept || user.dept,
        isElective: isElective,
        createdAt: new Date(),
      });
      setAllotForm({ ...allotForm, staff: "", subject: "" });
      success("Academic allotment confirmed.");
    } catch {
      notifyError("Failed to allot faculty.");
    }
  };

  // --- REPORT ENGINE CALCULATIONS ---
  const monitorStaffOptions = React.useMemo(() => {
    const staffNamesWithDepts = allStaffList.map((s) => ({
      name: s.name,
      dept: s.dept,
    }));

    feedbacks.forEach((f) => {
      if (!staffNamesWithDepts.find((s) => s.name === f.staffName)) {
        staffNamesWithDepts.push({ name: f.staffName, dept: "Unknown" });
      }
    });

    let filtered = staffNamesWithDepts;
    if (monitorDept && monitorDept !== "All") {
      filtered = filtered.filter((s) => s.dept === monitorDept);
    }

    return filtered.map((s) => ({ value: s.name, label: s.name }));
  }, [allStaffList, feedbacks, monitorDept]);

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (monitorDept && monitorDept !== "All") {
      const staffObj = allStaffList.find((s) => s.name === f.staffName);
      if (staffObj) {
        if (staffObj.dept !== monitorDept) return false;
      } else {
        if (monitorDept !== "Unknown") return false;
      }
    }

    if (
      monitorStaff &&
      monitorStaff !== "All Faculty" &&
      f.staffName !== monitorStaff
    )
      return false;

    if (monitorDivision && monitorDivision !== "All") {
      const studentObj = students.find(
        (s) => s.name === f.studentName && s.targetClass === f.targetClass,
      );
      if (!studentObj || studentObj.division !== monitorDivision) return false;
    }
    return true;
  });
  const activeDataSource = reportMode === "exit" ? exitResponses : feedbacks;

  const reportData = activeDataSource.filter((f) => {
    return (
      f.staffName === reportStaff &&
      (reportSubject === "" || f.subject === reportSubject)
    );
  });
  const totalStudents = reportData.length;

  // Calculate total students in class, submitted, and remaining
  const allocation = reportSubject
    ? allocations.find(
        (a) => a.staff === reportStaff && a.subject === reportSubject,
      )
    : null;
  const studentsInClass = allocation
    ? students.filter((s) => {
        const matchClass =
          s.targetClass === (allocation.targetClass || allocation.tClass);
        const matchDiv =
          allocation.division === "All"
            ? true
            : (s.division || "A") === allocation.division;
        return matchClass && matchDiv;
      })
    : [];
  const totalStudentsInClass = studentsInClass.length;

  const submittedStudentNames = new Set(reportData.map((f) => f.studentName));
  const submittedStudents = submittedStudentNames.size;
  const remainingStudentsList = studentsInClass.filter(
    (s) => !submittedStudentNames.has(s.name),
  );
  const remainingStudents = remainingStudentsList.length;

  const submittedStudentsList = studentsInClass.filter((s) =>
    submittedStudentNames.has(s.name),
  );

  // Debug logging
  console.log("Debug Info:", {
    reportStaff,
    reportSubject,
    allocation,
    totalStudentsInClass,
    submittedStudents,
    remainingStudents,
    allocationsCount: allocations.length,
    studentsCount: students.length,
  });

  // For Exit Surveys, we need the specific form to get the custom questions array
  const activeExitForm =
    reportMode === "exit" && reportSubject
      ? exitForms.find(
          (f) => f.staffName === reportStaff && f.subject === reportSubject,
        )
      : null;

  const activeQuestions =
    reportMode === "exit"
      ? activeExitForm?.questions || []
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

  const reportStaffOptions = reportDept
    ? allStaffList.filter((s) => s.dept === reportDept).map((s) => s.name)
    : allStaffList.map((s) => s.name);

  const activeFormSource = reportMode === "exit" ? exitForms : feedbacks;
  const staffSubjects = [
    ...new Set(
      [...feedbacks, ...exitForms]
        .filter((f) => f.staffName === reportStaff)
        .map((f) => f.subject),
    ),
  ];

  // --- STUDENT LIFECYCLE HANDLERS ---
  const handleBulkPromote = async () => {
    if (!promoteSource || !promoteTarget) {
      warning("Please select both source and target classes.");
      return;
    }
    if (promoteSource === promoteTarget) {
      warning("Source and target classes cannot be the same.");
      return;
    }

    const studentsToPromote = students.filter(
      (s) => s.targetClass === promoteSource,
    );
    if (studentsToPromote.length === 0) {
      warning(`No students found in ${promoteSource}.`);
      return;
    }

    const confirmMsg = `Are you sure you want to promote ${studentsToPromote.length} students from ${promoteSource} to ${promoteTarget}? \n\nThis will instantly update their class in all directories and reports.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      studentsToPromote.forEach((std) => {
        const docRef = doc(db, "Students", std.id);
        batch.update(docRef, {
          targetClass: promoteTarget,
          status: "pending", // Reset status for the new semester
        });
      });
      await batch.commit();
      success(
        `Successfully promoted ${studentsToPromote.length} students to ${promoteTarget}.`,
      );
      setPromoteSource("");
      setPromoteTarget("");
      fetchData();
    } catch (err) {
      console.error(err);
      notifyError("Promotion failed. Please try again.");
    }
    setIsSubmitting(false);
  };

  const handleBulkDeleteStudents = async () => {
    if (!deleteClassTarget) {
      warning("Please select a class to delete.");
      return;
    }

    const studentsToDelete = students.filter(
      (s) => s.targetClass === deleteClassTarget,
    );
    if (studentsToDelete.length === 0) {
      warning(`No students found in ${deleteClassTarget}.`);
      return;
    }

    const confirmMsg = `⚠ DANGER: Are you sure you want to PERMANENTLY DELETE all ${studentsToDelete.length} students in ${deleteClassTarget}? \n\nThis cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      studentsToDelete.forEach((std) => {
        batch.delete(doc(db, "Students", std.id));
      });
      await batch.commit();
      success(
        `Deleted ${studentsToDelete.length} students from ${deleteClassTarget}.`,
      );
      setDeleteClassTarget("");
      fetchData();
    } catch (err) {
      console.error(err);
      notifyError("Deletion failed.");
    }
    setIsSubmitting(false);
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "Students", editingStudentId), {
        name: editForm.name.trim(),
        rollNo: editForm.roll,
        enrollmentNo: editForm.enroll.trim(),
        email: editForm.email.trim(),
        targetClass: editForm.tClass,
        division: editForm.div,
      });
      setEditingStudentId(null);
      fetchData();
      success("Student updated successfully.");
    } catch {
      notifyError("Failed to update student.");
    }
  };

  const handleUpdateSubject = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, "Subjects", editingSubjectId), {
        name: editSubjectForm.name.trim(),
        code: editSubjectForm.code.toUpperCase().trim(),
        isElective: editSubjectForm.isElective,
      });
      setEditingSubjectId(null);
      fetchData();
      success("Subject updated successfully.");
    } catch {
      notifyError("Failed to update subject.");
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchRoll = searchRollNo
      ? s.rollNo?.toLowerCase().includes(searchRollNo.toLowerCase()) ||
        s.enrollmentNo?.toLowerCase().includes(searchRollNo.toLowerCase()) ||
        s.name?.toLowerCase().includes(searchRollNo.toLowerCase())
      : true;
    const matchClass = filterClass ? s.targetClass === filterClass : true;
    const matchDiv = filterDivision ? s.division === filterDivision : true;
    return matchRoll && matchClass && matchDiv;
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6 print:hidden bg-white/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-200/50 relative overflow-hidden">
          <div className="flex items-center gap-4 w-full xl:w-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-indigo-200 shrink-0">
              <Building2 size={24} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                HOD Portal
              </h1>
              <h2 className="text-sm font-medium text-slate-500 mt-0.5 truncate">
                {user.dept} - Manage students, subjects, allotments, and
                analytics.
              </h2>
            </div>
          </div>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/60 w-full xl:w-auto"
            role="tablist"
            aria-label="HOD sections"
          >
            {[
              { id: "students", label: "Add Students", icon: UserPlus },
              { id: "directory", label: "Directory", icon: Users },
              { id: "subjects", label: "Manage Subjects", icon: BookOpen },
              { id: "allot", label: "Allot", icon: Link },
              { id: "lifecycle", label: "Lifecycle", icon: RefreshCw },
              { id: "monitor", label: "Monitor", icon: Activity },
              { id: "reports", label: "Reports", icon: PieChart },
              { id: "controls", label: "Controls", icon: Settings },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap w-full ${
                  activeTab === t.id
                    ? "bg-white text-violet-700 shadow-md ring-1 ring-slate-200 scale-100"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                <t.icon
                  size={16}
                  className={
                    activeTab === t.id ? "text-violet-600" : "text-slate-400"
                  }
                />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === "students" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start animate-in slide-in-from-bottom-4 duration-500">
            <Card className="overflow-hidden border-indigo-100 shadow-md">
              <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50/50 p-7 relative">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-200 rounded-full blur-3xl opacity-40 z-0 pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-violet-200 rounded-full blur-3xl opacity-30 z-0 pointer-events-none"></div>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6 relative z-10">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                    <Upload
                      className="h-6 w-6 text-indigo-600"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                      Import Student Batch
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 mb-1 leading-relaxed max-w-xl font-medium">
                      Columns required: Name, Roll (15xx / 25xx / 35xx), PRN,
                      and{" "}
                      <strong className="text-indigo-600 font-semibold">
                        Email
                      </strong>{" "}
                      (for OTP).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-white/60 p-5 ring-1 ring-slate-200 shadow-sm backdrop-blur-md relative z-10">
                  <div className="flex min-w-[150px] flex-1 flex-col gap-1.5 relative z-50">
                    <span className="text-xs font-semibold text-slate-700 ml-1">
                      Select Class
                    </span>
                    <CustomSelect
                      value={excelClass}
                      onChange={(val) => setExcelClass(val)}
                      options={dynamicClassOptions}
                      placeholder="Select Class"
                    />
                  </div>
                  <div className="flex w-full min-w-[120px] max-w-[150px] flex-col gap-1.5 relative z-40">
                    <span className="text-xs font-semibold text-slate-700 ml-1">
                      Division
                    </span>
                    <CustomSelect
                      value={excelDiv}
                      onChange={(val) => setExcelDiv(val)}
                      options={[
                        { value: "A", label: "Div A" },
                        { value: "B", label: "Div B" },
                      ]}
                      placeholder="Division"
                    />
                  </div>
                  <label className="flex flex-1 min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-violet-700 transition-all min-w-[160px] scale-100 hover:scale-[1.02] active:scale-95">
                    {isSubmitting ? "Uploading…" : "Choose Excel file"}
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx, .xls"
                      disabled={isSubmitting}
                      onChange={(e) => {
                        if (!excelClass) {
                          warning("Select a target class first.");
                          return;
                        }
                        handleExcelUpload(e);
                      }}
                    />
                  </label>
                </div>
              </div>
            </Card>

            {/* Manual Student Form */}
            <Card className="p-0 overflow-hidden shadow-sm relative border border-slate-200/80">
              <div className="border-b border-indigo-50 bg-indigo-50/50 px-5 py-4">
                <h3 className="font-extrabold text-indigo-950 text-base">
                  Add Student Manually
                </h3>
                <p className="text-slate-500 text-sm mt-1 leading-relaxed font-medium">
                  Register a single student. Ensure PRN and Email are correct
                  for portal access.
                </p>
              </div>
              <form
                onSubmit={handleManualStudent}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"
              >
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Full Name
                  </label>
                  <input
                    placeholder="As per registration"
                    className="input-app py-2.5 text-sm font-semibold"
                    value={stdForm.name}
                    onChange={(e) =>
                      setStdForm({ ...stdForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Roll No.
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 1523"
                    maxLength={4}
                    title={ROLL_NUMBER_HINT}
                    className="input-app py-2.5 text-sm font-semibold tabular-nums tracking-widest"
                    value={stdForm.roll}
                    onChange={(e) =>
                      setStdForm({
                        ...stdForm,
                        roll: normalizeRollDigits(e.target.value),
                      })
                    }
                    required
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Enrollment (PRN)
                  </label>
                  <input
                    placeholder="PRN"
                    className="input-app py-2.5 text-sm font-semibold"
                    value={stdForm.enroll}
                    onChange={(e) =>
                      setStdForm({ ...stdForm, enroll: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Email
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="student@example.com"
                    className="input-app py-2.5 text-sm font-semibold"
                    value={stdForm.email}
                    onChange={(e) =>
                      setStdForm({ ...stdForm, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="md:col-span-4 relative z-[60]">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Class
                  </label>
                  <CustomSelect
                    value={stdForm.tClass}
                    onChange={(val) => setStdForm({ ...stdForm, tClass: val })}
                    options={dynamicClassOptions}
                    placeholder="Select Class"
                  />
                </div>
                <div className="md:col-span-2 relative z-50">
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Division
                  </label>
                  <CustomSelect
                    value={stdForm.div}
                    onChange={(val) => setStdForm({ ...stdForm, div: val })}
                    options={[
                      { value: "A", label: "A" },
                      { value: "B", label: "B" },
                    ]}
                    placeholder="Div A"
                  />
                </div>
                <div className="md:col-span-12 lg:col-span-12 xl:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full xl:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSubmitting ? "Saving…" : "Save Student"}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {activeTab === "lifecycle" && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            {/* Student Lifecycle Tools */}
            <Card className="overflow-hidden border-orange-100 shadow-md">
              <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50/50 p-7 relative">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-orange-200 shadow-sm">
                    <RefreshCw className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                      Student Lifecycle Tools
                    </h2>
                    <p className="text-slate-500 text-sm mt-1 font-medium italic">
                      "Each sem feedback must be isolated" — HOD
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Batch Promotion */}
                  <div className="p-5 bg-white/60 rounded-2xl border border-orange-100 backdrop-blur-sm space-y-4">
                    <h4 className="text-xs font-bold text-orange-700 uppercase tracking-widest flex items-center gap-2">
                      <ArrowUpCircle size={14} /> Smart Promotion (FY → SY → TY)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 ml-1">
                          SOURCE SEMESTER
                        </span>
                        <CustomSelect
                          value={promoteSource}
                          onChange={(val) => setPromoteSource(val)}
                          options={dynamicClassOptions}
                          placeholder="Current Sem"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 ml-1">
                          TARGET SEMESTER
                        </span>
                        <CustomSelect
                          value={promoteTarget}
                          onChange={(val) => setPromoteTarget(val)}
                          options={dynamicClassOptions}
                          placeholder="Promote to..."
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleBulkPromote}
                      disabled={
                        isSubmitting || !promoteSource || !promoteTarget
                      }
                      className="w-full h-11 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-orange-200 active:scale-95"
                    >
                      {isSubmitting
                        ? "Processing..."
                        : "Promote Batch to Next Semester"}
                    </button>
                  </div>

                  {/* Batch Deletion */}
                  <div className="p-5 bg-red-50/30 rounded-2xl border border-red-100 space-y-4">
                    <h4 className="text-xs font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                      <Trash2 size={14} /> Graduation Cleanup
                    </h4>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <CustomSelect
                          value={deleteClassTarget}
                          onChange={(val) => setDeleteClassTarget(val)}
                          options={dynamicClassOptions}
                          placeholder="Select Graduated Batch"
                        />
                      </div>
                      <button
                        onClick={handleBulkDeleteStudents}
                        disabled={isSubmitting || !deleteClassTarget}
                        className="px-6 h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-100 active:scale-95"
                      >
                        Clear Batch
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Inventory / Directory Tab */}
        {activeTab === "directory" && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <Card className="flex flex-col border-indigo-100 bg-white shadow-sm p-0 overflow-hidden">
              <div className="border-b border-indigo-50 bg-indigo-50/50 px-5 py-5 sticky top-0 z-10">
                <h3 className="font-extrabold text-indigo-950 flex items-center justify-between text-base">
                  Student directory
                  <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-indigo-600 px-2 text-xs font-black text-white tabular-nums shadow-sm">
                    {filteredStudents.length}
                  </span>
                </h3>
                <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative w-full md:max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-2 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-semibold transition-all hover:border-indigo-300 bg-white shadow-sm"
                      placeholder="Search by name, roll, or PRN..."
                      value={searchRollNo}
                      onChange={(e) => setSearchRollNo(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-3 w-full md:w-auto relative z-[60]">
                    <div className="min-w-[200px] flex-1 md:flex-none">
                      <CustomSelect
                        value={filterClass}
                        onChange={(val) => setFilterClass(val)}
                        options={[
                          { value: "", label: "All Classes" },
                          ...dynamicClassOptions.flatMap((g) =>
                            g.options.map((opt) => ({
                              value: opt.value,
                              label: opt.label,
                            })),
                          ),
                        ]}
                        placeholder="All Classes"
                      />
                    </div>
                    <div className="min-w-[140px] flex-1 md:flex-none">
                      <CustomSelect
                        value={filterDivision}
                        onChange={(val) => setFilterDivision(val)}
                        options={[
                          { value: "", label: "All Divisions" },
                          { value: "A", label: "Div A" },
                          { value: "B", label: "Div B" },
                        ]}
                        placeholder="All Divisions"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-4 space-y-3 bg-slate-50/30">
                {filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center h-[300px]">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-300 shadow-inner">
                      <Users size={32} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-bold text-slate-600">
                      No students found
                    </p>
                    <p className="mt-1.5 max-w-[200px] text-[11px] leading-relaxed text-slate-400">
                      Import an Excel file or add single records below.
                    </p>
                  </div>
                ) : (
                  filteredStudents.map((s) => {
                    if (editingStudentId === s.id) {
                      return (
                        <div
                          key={s.id}
                          className="p-4 bg-white rounded-2xl border-2 border-indigo-400 shadow-md transition-all relative z-50 animate-in fade-in zoom-in-95 duration-200"
                        >
                          <form
                            onSubmit={handleUpdateStudent}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                          >
                            <div className="md:col-span-2">
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                Full Name
                              </label>
                              <input
                                required
                                value={editForm.name}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    name: e.target.value,
                                  })
                                }
                                className="input-app py-2 text-sm font-semibold w-full"
                                placeholder="Full Name"
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                Roll No.
                              </label>
                              <input
                                required
                                value={editForm.roll}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    roll: normalizeRollDigits(e.target.value),
                                  })
                                }
                                className="input-app py-2 text-sm font-semibold tabular-nums w-full"
                                placeholder="Roll No"
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                PRN
                              </label>
                              <input
                                required
                                value={editForm.enroll}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    enroll: e.target.value,
                                  })
                                }
                                className="input-app py-2 text-sm font-semibold w-full"
                                placeholder="PRN"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                Email
                              </label>
                              <input
                                required
                                type="email"
                                value={editForm.email}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    email: e.target.value,
                                  })
                                }
                                className="input-app py-2 text-sm font-semibold w-full"
                                placeholder="Email"
                              />
                            </div>
                            <div className="md:col-span-1">
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                Class
                              </label>
                              <select
                                className="input-app py-2 text-sm font-semibold w-full"
                                value={editForm.tClass}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    tClass: e.target.value,
                                  })
                                }
                              >
                                {dynamicClassOptions
                                  .flatMap((g) => g.options)
                                  .map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="md:col-span-1">
                              <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                Division
                              </label>
                              <select
                                className="input-app py-2 text-sm font-semibold w-full"
                                value={editForm.div}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    div: e.target.value,
                                  })
                                }
                              >
                                <option value="A">Div A</option>
                                <option value="B">Div B</option>
                              </select>
                            </div>
                            <div className="md:col-span-2 flex justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setEditingStudentId(null)}
                                className="px-5 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-all active:scale-95"
                              >
                                Save
                              </button>
                            </div>
                          </form>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={s.id}
                        className="group flex flex-col sm:flex-row items-start justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md hover:bg-indigo-50/10 animate-in fade-in duration-300"
                      >
                        <div className="min-w-0 w-full sm:w-auto flex-1">
                          <p className="text-sm font-extrabold text-slate-800 truncate">
                            {s.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-600">
                              {s.targetClass} · Div {s.division || "A"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                              {s.enrollmentNo}
                            </span>
                          </div>
                          {s.email && (
                            <p className="mt-1.5 truncate text-[10px] font-bold text-slate-500 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                              {s.email}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1 w-full sm:w-auto justify-end mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-100 sm:border-0 border-dashed">
                          <button
                            type="button"
                            title="Edit student"
                            onClick={() => {
                              setEditingStudentId(s.id);
                              setEditForm({
                                name: s.name || "",
                                roll: s.rollNo || "",
                                enroll: s.enrollmentNo || "",
                                email: s.email || "",
                                tClass: s.targetClass || "",
                                div: s.division || "A",
                              });
                            }}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none"
                          >
                            <Edit2 size={16} />{" "}
                            <span className="hidden xs:inline">Edit</span>
                          </button>
                          <button
                            type="button"
                            title="Remove student"
                            onClick={async () => {
                              if (window.confirm(`Delete student ${s.name}?`)) {
                                await deleteDoc(doc(db, "Students", s.id));
                                fetchData();
                              }
                            }}
                            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none"
                          >
                            <Trash2 size={16} />{" "}
                            <span className="hidden xs:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        )}

        {/* SUBJECTS TAB (YOUR CODE) */}
        {activeTab === "subjects" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start animate-in slide-in-from-bottom-4 duration-500">
            <Card className="p-0 overflow-hidden border-indigo-100 shadow-md relative w-full">
              <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              <div className="px-8 py-6 border-b border-slate-100 bg-white/50">
                <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-800">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <BookOpen
                      className="text-emerald-500"
                      size={24}
                      strokeWidth={2.5}
                    />
                  </div>
                  Manage Subject
                </h2>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await addDoc(collection(db, "Subjects"), {
                      name: subForm.name,
                      code: subForm.code.toUpperCase(),
                      department: user.dept,
                      isElective: subForm.isElective,
                    });
                    setSubForm({ name: "", code: "", isElective: false });
                    fetchData();
                    success("Subject saved.");
                  } catch {
                    notifyError("Could not save subject.");
                  }
                }}
                className="p-8 space-y-5 bg-slate-50/30"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest ml-1 mb-1.5 block">
                    Subject Name
                  </label>
                  <input
                    placeholder="e.g. Software Engineering"
                    className="input-app py-3 font-semibold text-sm"
                    value={subForm.name}
                    onChange={(e) =>
                      setSubForm({ ...subForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-widest ml-1 mb-1.5 block">
                    Subject Code
                  </label>
                  <input
                    placeholder="e.g. 22001"
                    className="input-app py-3 font-semibold text-sm uppercase"
                    value={subForm.code}
                    onChange={(e) =>
                      setSubForm({ ...subForm, code: e.target.value })
                    }
                    required
                  />
                </div>
                <label className="flex items-center gap-4 p-5 border border-slate-200/80 rounded-2xl cursor-pointer hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/30 transition-all bg-white shadow-sm group">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-emerald-500"
                    checked={subForm.isElective}
                    onChange={(e) =>
                      setSubForm({ ...subForm, isElective: e.target.checked })
                    }
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold text-slate-800 uppercase">
                      This is an Elective
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                      Students will choose this manually while giving feedback.
                    </span>
                  </div>
                </label>
                <button className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 mt-4 text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-95 uppercase tracking-widest">
                  Save Subject
                </button>
              </form>
            </Card>
            <Card className="flex flex-col border-emerald-100 p-0 overflow-hidden shadow-sm max-h-[600px]">
              <div className="px-6 py-5 border-b border-emerald-50 bg-emerald-50/50 flex justify-between items-center">
                <h3 className="font-extrabold text-emerald-950 uppercase text-sm flex items-center gap-2">
                  Subject Inventory
                </h3>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black">
                  {subjectList.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 max-h-[400px]">
                {subjectList.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <BookOpen
                      className="mx-auto mb-3 text-slate-400"
                      size={32}
                    />
                    <p className="font-bold text-sm">No Subjects Added</p>
                  </div>
                ) : (
                  subjectList.map((s) => {
                    if (editingSubjectId === s.id) {
                      return (
                        <div
                          key={s.id}
                          className="p-5 bg-white rounded-2xl border-2 border-emerald-400 shadow-md transition-all relative z-50"
                        >
                          <form
                            onSubmit={handleUpdateSubject}
                            className="flex flex-col gap-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                                  Subject Name
                                </label>
                                <input
                                  required
                                  value={editSubjectForm.name}
                                  onChange={(e) =>
                                    setEditSubjectForm({
                                      ...editSubjectForm,
                                      name: e.target.value,
                                    })
                                  }
                                  className="input-app py-2 text-sm font-semibold w-full"
                                  placeholder="Subject Name"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                                  Subject Code
                                </label>
                                <input
                                  required
                                  value={editSubjectForm.code}
                                  onChange={(e) =>
                                    setEditSubjectForm({
                                      ...editSubjectForm,
                                      code: e.target.value,
                                    })
                                  }
                                  className="input-app py-2 text-sm font-semibold uppercase w-full"
                                  placeholder="Code"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 accent-emerald-500"
                                  checked={editSubjectForm.isElective}
                                  onChange={(e) =>
                                    setEditSubjectForm({
                                      ...editSubjectForm,
                                      isElective: e.target.checked,
                                    })
                                  }
                                />
                                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">
                                  Elective
                                </span>
                              </label>
                              <div className="flex justify-end gap-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setEditingSubjectId(null)}
                                  className="px-5 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all active:scale-95"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </form>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={s.id}
                        className="group flex flex-col sm:flex-row items-center justify-between p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:border-emerald-200 transition-all hover:shadow-md animate-in fade-in duration-300"
                      >
                        <div className="flex flex-col w-full sm:w-auto flex-1 min-w-0">
                          <span className="text-sm font-extrabold text-slate-800 truncate">
                            {s.name}
                          </span>
                          <span className="text-slate-400 font-bold text-[10px] tracking-widest uppercase mt-0.5">
                            Code: {s.code}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-100 sm:border-0 border-dashed">
                          {s.isElective && (
                            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest">
                              Elective
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Edit subject"
                              onClick={() => {
                                setEditingSubjectId(s.id);
                                setEditSubjectForm({
                                  name: s.name || "",
                                  code: s.code || "",
                                  isElective: s.isElective || false,
                                });
                              }}
                              className="flex items-center gap-1 p-2 rounded-xl text-sm font-bold text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 focus:outline-none"
                            >
                              <Edit2 size={16} />{" "}
                              <span className="hidden xs:inline">Edit</span>
                            </button>
                            <button
                              type="button"
                              title="Delete subject"
                              onClick={async () => {
                                if (
                                  window.confirm(`Delete subject ${s.name}?`)
                                ) {
                                  await deleteDoc(doc(db, "Subjects", s.id));
                                  fetchData();
                                }
                              }}
                              className="flex items-center gap-1 p-2 rounded-xl text-sm font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none"
                            >
                              <Trash2 size={16} />{" "}
                              <span className="hidden xs:inline">Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ALLOT TAB (YOUR CODE) */}
        {activeTab === "allot" && (
          <Card className="p-0 overflow-hidden border-orange-100 shadow-md relative max-w-xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-orange-400 to-amber-500"></div>
            <div className="px-8 py-6 border-b border-slate-100 bg-white/50">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-800">
                <div className="p-2 bg-orange-50 rounded-xl">
                  <Link
                    className="text-orange-500"
                    size={24}
                    strokeWidth={2.5}
                  />
                </div>
                Faculty Allotment
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-2 tracking-wide">
                Assign faculty to subjects for the current semester.
              </p>
            </div>
            <form
              onSubmit={handleAllotment}
              className="p-8 space-y-6 bg-slate-50/30"
            >
              <div className="space-y-1.5 relative z-[80]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Select Department
                </label>
                <CustomSelect
                  value={allotForm.staffDept}
                  onChange={(val) =>
                    setAllotForm({ ...allotForm, staffDept: val, staff: "" })
                  }
                  options={departmentsList.map((d) => ({
                    value: d,
                    label: d,
                  }))}
                  placeholder="Select Department"
                />
              </div>
              <div className="space-y-1.5 relative z-[70]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Select Faculty
                </label>
                <CustomSelect
                  value={allotForm.staff}
                  onChange={(val) => setAllotForm({ ...allotForm, staff: val })}
                  options={allStaffList
                    .filter((s) => s.dept === allotForm.staffDept)
                    .map((s) => ({ value: s.name, label: s.name }))}
                  placeholder="Choose Staff"
                />
              </div>
              <div className="space-y-1.5 relative z-[60]">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Select Subject
                </label>
                <CustomSelect
                  value={allotForm.subject}
                  onChange={(val) =>
                    setAllotForm({ ...allotForm, subject: val })
                  }
                  options={[
                    {
                      group: "--- MANDATORY ---",
                      options: allSubjectList
                        .filter(
                          (s) =>
                            s.department ===
                              (allotForm.staffDept || user.dept) &&
                            !s.isElective,
                        )
                        .map((s) => ({
                          value: s.name,
                          label: `${s.name} (${s.code})`,
                        })),
                    },
                    {
                      group: "--- ELECTIVE ---",
                      options: allSubjectList
                        .filter(
                          (s) =>
                            s.department ===
                              (allotForm.staffDept || user.dept) &&
                            s.isElective,
                        )
                        .map((s) => ({
                          value: s.name,
                          label: `${s.name} (${s.code})`,
                        })),
                    },
                  ]}
                  placeholder="Choose Subject"
                />
              </div>
              <div className="grid grid-cols-2 gap-5 relative z-50">
                <div className="space-y-1.5 relative z-40">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Target Class
                  </label>
                  <CustomSelect
                    value={allotForm.tClass}
                    onChange={(val) =>
                      setAllotForm({ ...allotForm, tClass: val })
                    }
                    options={dynamicClassOptionsForAllotment}
                    placeholder="Target Class"
                  />
                </div>
                <div className="space-y-1.5 relative z-30">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Division
                  </label>
                  <CustomSelect
                    value={allotForm.division}
                    onChange={(val) =>
                      setAllotForm({ ...allotForm, division: val })
                    }
                    options={[
                      { value: "A", label: "Div A" },
                      { value: "B", label: "Div B" },
                      { value: "All", label: "All Divisions" },
                    ]}
                    placeholder="Division"
                  />
                </div>
              </div>
              <button className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600 transition-all active:scale-95 uppercase tracking-widest mt-6">
                Confirm Allotment
              </button>
            </form>
          </Card>
        )}

        {/* NEW: MONITOR TAB */}
        {activeTab === "monitor" && (
          <Card className="p-0 border-blue-100 flex flex-col overflow-hidden shadow-md animate-in slide-in-from-bottom-4 duration-500 max-h-[85vh]">
            <div className="p-6 border-b border-blue-50 bg-blue-50/30 flex justify-between items-center gap-4 flex-wrap relative z-[80]">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-800 uppercase tracking-tight">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Activity
                    className="text-blue-600"
                    size={24}
                    strokeWidth={2.5}
                  />
                </div>
                Live Monitor
              </h2>
              <div className="flex gap-4 w-full sm:w-auto flex-wrap items-end relative z-[70]">
                <div className="flex flex-col gap-1.5 w-full sm:w-56 relative z-[60]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Department
                  </span>
                  <CustomSelect
                    value={monitorDept}
                    onChange={(val) => {
                      setMonitorDept(val);
                      setMonitorStaff("");
                    }}
                    options={[
                      { value: "All", label: "All Departments" },
                      ...departmentsList.map((d) => ({ value: d, label: d })),
                    ]}
                    placeholder="All Departments"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full sm:w-56 relative z-50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Filter by Staff
                  </span>
                  <CustomSelect
                    value={monitorStaff}
                    onChange={(val) => setMonitorStaff(val)}
                    options={monitorStaffOptions}
                    placeholder="All Faculty"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full sm:w-48 relative z-40">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Division
                  </span>
                  <CustomSelect
                    value={monitorDivision}
                    onChange={(val) => setMonitorDivision(val)}
                    options={[
                      { value: "All", label: "All Divisions" },
                      { value: "A", label: "Div A" },
                      { value: "B", label: "Div B" },
                    ]}
                    placeholder="All Divisions"
                  />
                </div>
              </div>
            </div>

            {monitorDept &&
            monitorDept !== "All" &&
            monitorStaff &&
            monitorStaff !== "All" &&
            monitorDivision &&
            monitorDivision !== "All" ? (
              <div className="flex-1 overflow-auto bg-slate-50/30">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 shadow-sm z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Date
                      </th>
                      <th className="p-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Student
                      </th>
                      <th className="p-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Target
                      </th>
                      <th className="p-4 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80">
                    {filteredFeedbacks.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="text-center py-16 text-slate-400 font-bold text-sm"
                        >
                          No feedback matching your filters found.
                        </td>
                      </tr>
                    ) : (
                      filteredFeedbacks.map((fb) => (
                        <tr
                          key={fb.id}
                          className="hover:bg-blue-50/50 transition-colors group"
                        >
                          <td className="p-4 px-6 text-xs font-bold text-slate-600">
                            {fb.createdAt?.toDate().toLocaleDateString("en-GB")}
                          </td>
                          <td className="p-4 px-6 font-extrabold text-slate-800 text-sm">
                            {fb.studentName}
                          </td>
                          <td className="p-4 px-6 text-sm font-bold text-slate-700">
                            {fb.staffName} <br />
                            <span className="text-[10px] text-slate-400 font-extrabold tracking-widest uppercase mt-0.5 inline-block">
                              {fb.subject}
                            </span>
                          </td>
                          <td className="p-4 px-6 text-center">
                            <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-blue-100 text-blue-700 shadow-sm border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              {(
                                fb.totalScore / FEEDBACK_QUESTIONS.length
                              ).toFixed(1)}
                              /5.0
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center bg-blue-50/20 flex flex-col items-center justify-center">
                <Activity size={48} className="text-blue-200 mb-4" />
                <h3 className="text-lg font-black text-blue-900 uppercase tracking-tight">
                  Select Filters to Monitor
                </h3>
                <p className="text-sm text-blue-600/70 font-medium mt-2 max-w-sm mx-auto">
                  Please select a specific Department, Faculty member, and
                  Division above to view live feedback data.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* NEW: REPORTS TAB (Replacing your old filter cards with the integrated Pie/Bar & K15 Dashboard) */}
        {activeTab === "reports" && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <Card className="p-0 border-slate-200 overflow-hidden shadow-sm print:hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex items-center gap-2">
                <PieChart className="text-slate-500" size={18} />
                <h3 className="font-extrabold text-slate-800 uppercase tracking-widest text-xs">
                  Report Configuration
                </h3>
              </div>
              <div className="p-6 bg-white flex flex-wrap gap-5 items-end justify-between">
                <div className="flex flex-wrap gap-5 flex-1 w-full xl:w-auto">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-widest">
                      Academic Year
                    </label>
                    <input
                      type="text"
                      value={acadYear}
                      onChange={(e) => setAcadYear(e.target.value)}
                      className="input-app text-sm font-bold py-2.5"
                      placeholder="e.g. 2024-25"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-widest">
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
                      className="input-app text-sm font-bold py-2.5"
                      placeholder="e.g. VI"
                    />
                  </div>
                  <div className="flex-[1] min-w-[180px] relative z-[60]">
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-widest">
                      Department
                    </label>
                    <CustomSelect
                      value={reportDept}
                      onChange={(val) => {
                        setReportDept(val);
                        setReportStaff("");
                        setReportSubject("");
                      }}
                      options={[
                        { value: "", label: "All Departments" },
                        ...departmentsList.map((d) => ({
                          value: d,
                          label: d,
                        })),
                      ]}
                      placeholder="Select Department"
                    />
                  </div>
                  <div className="flex-[2] min-w-[200px] relative z-[60]">
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-widest">
                      Faculty
                    </label>
                    <CustomSelect
                      value={reportStaff}
                      onChange={(val) => {
                        setReportStaff(val);
                        const nextSubjects = [
                          ...new Set(
                            [...feedbacks, ...exitForms]
                              .filter((f) => f.staffName === val)
                              .map((f) => f.subject),
                          ),
                        ];
                        setReportSubject(
                          nextSubjects.length > 0 ? nextSubjects[0] : "",
                        );
                      }}
                      options={(reportDept
                        ? allStaffList
                            .filter((s) => s.dept === reportDept)
                            .map((s) => s.name)
                        : allStaffList.map((s) => s.name)
                      ).map((s) => ({ value: s, label: s }))}
                      placeholder="All Faculty"
                    />
                  </div>
                  {reportStaff && (
                    <div className="flex-[2] min-w-[200px] animate-in fade-in duration-300 relative z-50">
                      <label className="text-xs font-semibold text-slate-700 mb-1.5 block uppercase tracking-widest">
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
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20 hover:from-indigo-700 hover:to-violet-700 font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest text-sm transition-all active:scale-95 w-full xl:w-auto"
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
              </div>
            </div>

            {reportStaff && totalStudents > 0 && qCount > 0 ? (
              <>
                {/* --- OVERALL RATING DONUT CHART (Hidden when printing) --- */}
                <Card className="p-8 border-slate-100 shadow-sm print:hidden">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <PieChart size={24} /> Overall Feedback Distribution
                      </h2>
                      <p className="text-sm text-slate-500 mt-2">
                        Rating distribution across {submittedStudents} submitted
                        feedback{submittedStudents !== 1 ? "s" : ""}
                        {totalStudentsInClass > 0
                          ? ` out of ${totalStudentsInClass} students`
                          : ""}{" "}
                        and {activeQuestions.length} criteria
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-blue-600">
                        {overallAverageOutOf5}
                      </div>
                      <p className="text-sm text-slate-500 font-semibold">
                        out of 5.0
                      </p>
                    </div>
                  </div>
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
                    height={400}
                  />
                </Card>

                {/* --- QUESTION-WISE DONUT CHARTS (Hidden when printing) --- */}
                <div className="mt-8 print:hidden">
                  <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <BarChart size={24} /> Question-wise Breakdown
                  </h2>
                  <p className="text-sm text-slate-600 mb-6">
                    Each donut chart shows the distribution of ratings for a
                    specific criterion. Hover over segments to see exact counts.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                    {activeQuestions.map((q, idx) => (
                      <div className="" key={idx}>
                        <QuestionDonutChart
                          questionNumber={idx + 1}
                          questionText={q}
                          scoreCounts={scoreCounts[idx]}
                          totalResponses={totalStudents}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* --- OFFICIAL MSBTE K15 TABLE (Visible in browser AND in print mode) --- */}
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
                        <p>Programme: {user.dept}</p>
                        <p>Semester: {semester}</p>
                        <p>Date :- {new Date().toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="border-t border-black my-2 print:my-0.5"></div>
                      <p className="pt-2 print:pt-1">
                        Name Of The Faculty :- {reportStaff}{" "}
                        {reportSubject ? `(${reportSubject})` : ""}
                      </p>
                    </div>
                    <table className="w-full text-xs print:text-[10px] border-collapse border border-black text-center mt-4 print:mt-2">
                      <thead>
                        <tr className="font-bold bg-slate-50 print:bg-transparent">
                          <th className="border border-black p-2 print:py-1 print:px-1 w-10">
                            Sr.
                            <br />
                            No.
                          </th>
                          <th className="border border-black p-2 print:py-1 print:px-1 text-left">
                            Parameter
                          </th>
                          <th className="border border-black p-2 print:py-1 print:px-1 w-16">
                            <span className="print:hidden">5 - Excellent</span>
                            <span className="hidden print:inline">5 - Exc</span>
                          </th>
                          <th className="border border-black p-2 print:py-1 print:px-1 w-16">
                            <span className="print:hidden">4 - Very Good</span>
                            <span className="hidden print:inline">4 - VG</span>
                          </th>
                          <th className="border border-black p-2 print:py-1 print:px-1 w-16">
                            3 - Good
                          </th>
                          <th className="border border-black p-2 print:py-1 print:px-1 w-16">
                            <span className="print:hidden">2 - Satisfactory</span>
                            <span className="hidden print:inline">2 - Sat</span>
                          </th>
                          <th className="border border-black p-2 print:py-1 print:px-1 w-16">
                            <span className="print:hidden">1 - Not Satisfactory</span>
                            <span className="hidden print:inline">1 - Not Sat</span>
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
                            className="border border-black p-1.5 print:p-0.5 text-right"
                          >
                            Count
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {colTotals[5]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {colTotals[4]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {colTotals[3]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
                            {colTotals[2]}
                          </td>
                          <td className="border border-black p-1.5 print:p-0.5">
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
                        <tr className="font-bold bg-slate-100 print:bg-transparent">
                          <td
                            colSpan="6"
                            className="border border-black p-3 print:py-1.5 print:px-2 text-right text-sm print:text-xs"
                          >
                            Average Marks Obtained out of 25
                          </td>
                          <td className="border border-black p-3 print:py-1.5 print:px-2 text-sm print:text-xs">
                            {marksOutOf25}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="mt-12 flex justify-end pr-12 font-bold text-sm print:mt-28">
                      <div className="text-left border-black p-4">
                        <p>Signature of HoD :- ________________</p>
                        <p className="mt-4">Name :- {user.name}</p>
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
                      <h2 className="text-lg mt-1">
                        COURSE EXIT SURVEY REPORT
                      </h2>
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
                        <p>Programme: {user.dept}</p>
                        <p>Semester: {semester}</p>
                        <p>Date :- {new Date().toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="border-t border-black my-2"></div>
                      <p className="pt-2">
                        Name Of The Faculty :- {reportStaff}
                      </p>
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
                          <th className="border border-black p-2 w-14">
                            Good 3
                          </th>
                          <th className="border border-black p-2 w-14">
                            Satisfactory 2
                          </th>
                          <th className="border border-black p-2 w-14">
                            Average 1
                          </th>
                          <th className="border border-black p-2 w-14">
                            Max. Marks
                          </th>
                          <th className="border border-black p-2 w-14">
                            TOTAL
                          </th>
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

                    <div className="mt-20 flex justify-end pr-12 font-bold text-sm">
                      <div className="text-left border-black p-4">
                        <p>Signature of HoD :- ________________</p>
                        <p className="mt-4">Name :- {user.name}</p>
                      </div>
                    </div>
                  </div>
                )}

                {reportMode === "institution" && (
                  <div className="bg-white p-8 md:p-12 border border-slate-300 print:border-none print:p-0 print:m-0 w-full overflow-x-auto text-black mt-8 print:mt-0 uppercase font-sans">
                    <div className="text-center font-bold mb-6 border-b-2 border-black pb-6">
                      <h3 className="text-sm tracking-tight uppercase">
                        Solapur Education Society's Polytechnic, Solapur
                      </h3>
                      <h2 className="text-xl mt-2 font-black tracking-widest border-t border-black pt-4 inline-block px-8">
                        STUDENT SATISFACTION FEEDBACK
                      </h2>
                      <p className="mt-2 text-sm italic">
                        Annual Institutional Survey • {user.dept} Dept
                      </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-4 text-sm font-bold px-2">
                      <p>Academic Year : {acadYear}</p>
                      <p className="text-right">
                        Report Date: {new Date().toLocaleDateString("en-GB")}
                      </p>
                    </div>

                    <table className="w-full text-[10px] border-collapse border-2 border-black text-center">
                      <thead>
                        <tr className="font-extrabold bg-slate-100 print:bg-transparent border-b-2 border-black">
                          <th className="border border-black p-2 w-10 text-[11px]">
                            Sr. No.
                          </th>
                          <th className="border border-black p-2 text-left min-w-[200px] text-[11px]">
                            Parameters
                          </th>
                          <th className="border border-black p-2 w-14">
                            Excellent 5
                          </th>
                          <th className="border border-black p-2 w-14">
                            Very good 4
                          </th>
                          <th className="border border-black p-2 w-14">
                            Good 3
                          </th>
                          <th className="border border-black p-2 w-14">
                            Satisfactory 2
                          </th>
                          <th className="border border-black p-2 w-14">
                            Average 1
                          </th>
                          <th className="border border-black p-2 w-14">
                            Max. Marks
                          </th>
                          <th className="border border-black p-2 w-14">
                            TOTAL
                          </th>
                          <th className="border border-black p-2 w-14">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // Filter responses for institution feedback (department specific for HOD)
                          const instData = instResponses.filter(
                            (r) =>
                              r.department === user.dept &&
                              (!acadYear || r.academicYear === acadYear),
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

                    <div className="mt-12 flex justify-end pr-12 font-black text-sm print:mt-28">
                      <div className="text-center">
                        <div className="w-56 border-b-2 border-dotted border-black mb-1"></div>
                        <p>Department Head Signature</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- K15 REPORT VISUALIZATION (Admin style charts - Hidden when printing) --- */}
                <div className="mt-12 print:hidden mb-12">
                  <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                    <PieChart size={24} />{" "}
                    {reportMode === "exit"
                      ? "Course Exit Analytics"
                      : "K-15 Report Visualization"}
                  </h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1 p-8 flex flex-col items-center justify-center border-indigo-100">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                        <PieChart size={18} className="text-indigo-600" /> Count
                        Distribution
                      </h3>
                      <div className="grid grid-cols-2 gap-2 w-full mb-6 text-center opacity-90">
                        <div className="bg-indigo-50 text-indigo-800 p-2 rounded-xl border border-indigo-100 font-bold text-xs flex flex-col justify-center items-center">
                          <span className="text-[9px] uppercase text-indigo-500 mb-0.5">
                            Total Score
                          </span>
                          <span className="font-black text-sm">
                            {grandTotalScore}
                          </span>
                        </div>
                        <div className="bg-blue-50 text-blue-800 p-2 rounded-xl border border-blue-100 font-bold text-xs flex flex-col justify-center items-center">
                          <span className="text-[9px] uppercase text-blue-500 mb-0.5">
                            Avg / 25
                          </span>
                          <span className="font-black text-sm">
                            {marksOutOf25}
                          </span>
                        </div>
                        {totalStudentsInClass > 0 && (
                          <>
                            <button
                              onClick={() => setShowSubmittedModal(true)}
                              type="button"
                              className="bg-green-50 text-green-800 p-2 rounded-xl border border-green-100 font-bold text-xs flex flex-col items-center justify-center hover:bg-green-100 transition-colors cursor-pointer shadow-sm group"
                            >
                              <span className="text-[9px] uppercase text-green-500 group-hover:text-green-600 mb-0.5">
                                Submitted
                              </span>
                              <span className="font-black text-sm">
                                {submittedStudents}
                              </span>
                            </button>
                            <button
                              onClick={() => setShowRemainingModal(true)}
                              type="button"
                              className="bg-red-50 text-red-800 p-2 rounded-xl border border-red-100 font-bold text-xs flex flex-col items-center justify-center hover:bg-red-100 transition-colors cursor-pointer shadow-sm group"
                            >
                              <span className="text-[9px] uppercase text-red-500 group-hover:text-red-600 mb-0.5">
                                Pending
                              </span>
                              <span className="font-black text-sm">
                                {remainingStudents}
                              </span>
                            </button>
                          </>
                        )}
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
                    <Card className="md:col-span-2 p-8 border-indigo-100">
                      <div className="flex justify-between items-end mb-6">
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <BarChart size={18} className="text-indigo-600" />{" "}
                          Parameter Averages
                        </h3>
                        <h2 className="text-3xl font-black text-indigo-700">
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
                </div>
              </>
            ) : reportStaff ? (
              <div className="text-center py-20 opacity-30">
                <h2 className="text-2xl font-black uppercase">
                  {reportMode === "exit" && !reportSubject
                    ? "Select a subject to view Course Exit Analytics"
                    : "No Data Available"}
                </h2>
              </div>
            ) : (
              <div className="text-center py-20 opacity-30">
                <h2 className="text-2xl font-black uppercase">
                  Select a faculty to generate report
                </h2>
              </div>
            )}
          </div>
        )}

        {/* CONTROLS TAB (YOUR CODE) */}
        {activeTab === "controls" && (
          <Card className="p-12 text-center border-slate-100 shadow-sm print:hidden animate-in slide-in-from-bottom-4 duration-500 relative overflow-hidden bg-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100 rounded-full blur-3xl opacity-50 -z-10"></div>
            <div className="mb-10 inline-flex p-4 rounded-3xl bg-slate-50 ring-1 ring-slate-200/50 shadow-inner text-slate-400">
              <Settings size={48} strokeWidth={1} />
            </div>
            <h2 className="text-3xl font-extrabold mb-3 uppercase text-slate-800 tracking-tight">
              Portal Security Controls
            </h2>
            <p className="text-slate-500 font-medium mb-10 max-w-md mx-auto">
              Toggle the global student and staff portal states. When closed,
              the respective users will not be able to log in or submit/view
              feedback.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-center">
              <button
                onClick={async () => {
                  const s = !isPortalOpen;
                  await setDoc(
                    doc(db, "Settings", "Global"),
                    { studentPortalOpen: s },
                    { merge: true },
                  );
                  setIsPortalOpen(s);
                }}
                className={`px-10 py-4 rounded-2xl font-bold text-lg text-white transition-all shadow-xl active:scale-95 uppercase tracking-wide flex items-center justify-center mx-auto gap-3 ${isPortalOpen ? "bg-gradient-to-b from-red-500 to-rose-600 shadow-red-500/30 hover:shadow-red-500/50" : "bg-gradient-to-b from-emerald-500 to-teal-600 shadow-emerald-500/30 hover:shadow-emerald-500/50"}`}
              >
                {isPortalOpen
                  ? "Close Portal for Students"
                  : "Open Portal for Students"}
              </button>

              <button
                onClick={async () => {
                  const s = !isStaffPortalOpen;
                  await setDoc(
                    doc(db, "Settings", "Global"),
                    { staffPortalOpen: s },
                    { merge: true },
                  );
                  setIsStaffPortalOpen(s);
                }}
                className={`px-10 py-4 rounded-2xl font-bold text-lg text-white transition-all shadow-xl active:scale-95 uppercase tracking-wide flex items-center justify-center mx-auto gap-3 ${
                  isStaffPortalOpen
                    ? "bg-gradient-to-b from-red-500 to-rose-600 shadow-red-500/30 hover:shadow-red-500/50"
                    : "bg-gradient-to-b from-violet-500 to-indigo-600 shadow-violet-500/30 hover:shadow-violet-500/50"
                }`}
              >
                {isStaffPortalOpen
                  ? "Close Portal for Staff"
                  : "Open Portal for Staff"}
              </button>
            </div>
          </Card>
        )}

        {/* REMAINING STUDENTS MODAL */}
        {showRemainingModal &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                backgroundColor: "rgba(15,23,42,0.75)",
                backdropFilter: "blur(5px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  padding: "24px",
                  width: "90%",
                  maxWidth: "500px",
                  minHeight: "250px",
                  color: "#0f172a",
                  zIndex: 999999,
                  position: "relative",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "2px solid #f1f5f9",
                    paddingBottom: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: "800",
                      margin: 0,
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Users size={24} /> Remaining Students
                  </h3>
                  <button
                    onClick={() => setShowRemainingModal(false)}
                    style={{
                      background: "#f1f5f9",
                      color: "#64748b",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Close ✕
                  </button>
                </div>
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {remainingStudentsList.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        opacity: 0.6,
                      }}
                    >
                      <p style={{ fontWeight: "bold" }}>
                        All students have submitted!
                      </p>
                    </div>
                  ) : (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {remainingStudentsList.map((s, idx) => (
                        <li
                          key={idx}
                          style={{
                            padding: "12px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#f8fafc",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: "bold",
                                fontSize: "14px",
                                color: "#1e293b",
                              }}
                            >
                              {s.name}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginTop: "4px",
                              }}
                            >
                              {s.enrollmentNo || s.rollNo} • Div{" "}
                              {s.division || "A"}
                            </span>
                          </div>
                          <span
                            style={{
                              backgroundColor: "#fee2e2",
                              color: "#e11d48",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: "900",
                              textTransform: "uppercase",
                            }}
                          >
                            Pending
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* SUBMITTED STUDENTS MODAL */}
        {showSubmittedModal &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                backgroundColor: "rgba(15,23,42,0.75)",
                backdropFilter: "blur(5px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  backgroundColor: "white",
                  borderRadius: "12px",
                  padding: "24px",
                  width: "90%",
                  maxWidth: "500px",
                  minHeight: "250px",
                  color: "#0f172a",
                  zIndex: 999999,
                  position: "relative",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "2px solid #f1f5f9",
                    paddingBottom: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: "800",
                      margin: 0,
                      color: "#10b981",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Activity size={24} /> Submitted Students
                  </h3>
                  <button
                    onClick={() => setShowSubmittedModal(false)}
                    style={{
                      background: "#f1f5f9",
                      color: "#64748b",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    Close ✕
                  </button>
                </div>
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {submittedStudentsList.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "40px 0",
                        opacity: 0.6,
                      }}
                    >
                      <p style={{ fontWeight: "bold" }}>
                        No students have submitted yet.
                      </p>
                    </div>
                  ) : (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {submittedStudentsList.map((s, idx) => (
                        <li
                          key={idx}
                          style={{
                            padding: "12px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#f8fafc",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: "bold",
                                fontSize: "14px",
                                color: "#1e293b",
                              }}
                            >
                              {s.name}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginTop: "4px",
                              }}
                            >
                              {s.enrollmentNo || s.rollNo} • Div{" "}
                              {s.division || "A"}
                            </span>
                          </div>
                          <span
                            style={{
                              backgroundColor: "#d1fae5",
                              color: "#059669",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "10px",
                              fontWeight: "900",
                              textTransform: "uppercase",
                            }}
                          >
                            Submitted
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </>
  );
}
