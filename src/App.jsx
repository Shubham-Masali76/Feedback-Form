import React, { useState, useEffect, lazy, Suspense } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  LogOut,
  Building2,
  Loader2,
  UserCircle,
  KeyRound,
  Users,
  ShieldCheck,
} from "lucide-react";

// Import your pages
import ChangePasswordModal from "./components/ChangePasswordModal";
import StudentLogin from "./pages/StudentLogin";
import Login from "./pages/Login";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy load heavy dashboards — only fetched when the user actually logs in
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const HodDashboard = lazy(() => import("./pages/HodDashboard"));
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));

import { collection, query, where, getDocs } from "firebase/firestore";

function readInitialSession() {
  return { user: null, loading: true };
}

export default function App() {
  const initial = readInitialSession();
  const [user, setUser] = useState(initial.user);
  const [loading, setLoading] = useState(true);

  // Controls the dropdown and which card is shown
  const [loginView, setLoginView] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [firebaseAuthUser, setFirebaseAuthUser] = useState(null);
  const [viewMode, setViewMode] = useState("hod"); // Default to personal HOD view

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setFirebaseAuthUser(u));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "Users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.active === false && data.role !== "student") {
              await signOut(auth);
              setUser(null);
            } else {
              setUser({ id: firebaseUser.uid, ...data });
            }
          } else {
            // It might be a student! Query the Students collection by email
            const q = query(
              collection(db, "Students"),
              where("email", "==", firebaseUser.email)
            );
            const qs = await getDocs(q);
            
            if (!qs.empty) {
              const studentDoc = qs.docs[0];
              const studentData = studentDoc.data();
              setUser({ 
                id: studentDoc.id, 
                role: "student", 
                dept: studentData.department,
                targetClass: studentData.targetClass || studentData.tClass,
                ...studentData 
              });
            } else {
              // Unauthorized email
              await signOut(auth);
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setLoginView(""); // Reset to select portal on logout
  };

  const roleLabel =
    user?.role === "hod"
      ? "Head of Department"
      : user?.role === "staff"
        ? "Faculty"
        : user?.role === "admin"
          ? "Administrator"
          : user?.role === "student"
            ? "Student"
            : "";

  return (
    <>
      {/* MAIN APP LAYER */}
      {!loading ? (
        <div className="animate-fade-in-up min-h-dvh">
          {!user ? (
            <div className="login-page-root flex min-h-dvh items-start justify-center overflow-y-auto p-3 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-5 sm:items-center sm:p-4 sm:pt-[max(1rem,env(safe-area-inset-top,0px))] sm:py-6 md:py-8">
              <div
                className="pointer-events-none absolute right-[-10%] top-1/4 h-[min(60vw,28rem)] w-[min(60vw,28rem)] rounded-full bg-indigo-400/25 blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[min(50vw,24rem)] w-[min(50vw,24rem)] rounded-full bg-cyan-400/20 blur-3xl"
                aria-hidden
              />
              <div className="relative z-10 w-full flex justify-center">
                {loginView === "student" || loginView === "" ? (
                  <StudentLogin
                    onLoginSuccess={handleLoginSuccess}
                    loginView={loginView}
                    setLoginView={setLoginView}
                  />
                ) : (
                  <Login
                    onLoginSuccess={handleLoginSuccess}
                    portalType={loginView}
                    loginView={loginView}
                    setLoginView={setLoginView}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="min-h-dvh bg-app-shell">
              <nav className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/90 px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 sm:px-6 backdrop-blur-md shadow-nav flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 print:hidden print-hide">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
                  <div className="w-11 h-11 shrink-0 rounded-xl overflow-hidden shadow-sm shadow-blue-900/10 border border-slate-200/60 bg-white flex items-center justify-center">
                    <img src={`${import.meta.env.BASE_URL}logo.png`} alt="SESP Logo" className="w-full h-full object-contain p-0.5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-extrabold tracking-tight bg-gradient-to-r from-blue-700 to-indigo-900 bg-clip-text text-transparent text-lg sm:text-xl leading-tight truncate">
                      Feedback Portal
                    </h1>
                    <h2 className="text-xs text-slate-500 font-medium truncate">
                      SES Polytechnic Solapur
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto sm:ml-auto overflow-x-auto pb-1 sm:pb-0">
                  {user?.role === "hod" && (
                    <button
                      type="button"
                      onClick={() =>
                        setViewMode(viewMode === "hod" ? "staff" : "hod")
                      }
                      className={`inline-flex items-center gap-2 text-sm font-bold px-3 sm:px-4 py-2 rounded-xl border transition-all whitespace-nowrap ${
                        viewMode === "hod"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      }`}
                    >
                      {viewMode === "hod" ? (
                        <>
                          <Users size={16} strokeWidth={2.5} />
                          Switch to Faculty Mode
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} strokeWidth={2.5} />
                          Back to HOD Mode
                        </>
                      )}
                    </button>
                  )}

                  {firebaseAuthUser && user?.role !== "student" && (
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-blue-800 px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white shadow-sm hover:shadow transition-all whitespace-nowrap"
                    >
                      <KeyRound size={16} className="shrink-0" aria-hidden />
                      <span className="hidden sm:inline">Password</span>
                    </button>
                  )}
                  <div className="hidden sm:flex items-center gap-2.5 max-w-[240px] min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 text-slate-600">
                      <UserCircle size={20} strokeWidth={1.75} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                        {user?.name || "Signed in"}
                      </p>
                      <p className="text-[11px] font-medium text-blue-600 truncate">
                        {roleLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-red-700 px-3 py-2 rounded-xl border border-slate-200 hover:border-red-200 bg-white shadow-sm hover:shadow transition-all whitespace-nowrap"
                  >
                    <LogOut size={16} className="shrink-0" aria-hidden />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              </nav>

              <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8 pb-[max(3rem,env(safe-area-inset-bottom,0px))] print:p-0 print:m-0 print:max-w-none">
                <ErrorBoundary>
                  <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 size={36} className="animate-spin text-blue-500" /></div>}>
                    {user.role === "admin" && <AdminDashboard user={user} />}
                    {user.role === "student" && <StudentDashboard user={user} />}
                    {user.role === "hod" &&
                      (viewMode === "hod" ? (
                        <HodDashboard user={user} />
                      ) : (
                        <StaffDashboard user={user} />
                      ))}
                    {user.role === "staff" && <StaffDashboard user={user} />}
                  </Suspense>
                </ErrorBoundary>
              </main>

              <ChangePasswordModal
                open={showChangePassword}
                onClose={() => setShowChangePassword(false)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="fixed inset-0 flex items-center justify-center bg-white">
          <Loader2 size={40} className="animate-spin text-indigo-600" />
        </div>
      )}
    </>
  );
}
