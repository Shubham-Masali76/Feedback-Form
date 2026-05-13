# Feedback Portal — Code Audit Report

**Project:** Feedback-Form-master  
**Stack:** React 19 + Vite + Firebase (Firestore + Auth) + Tailwind CSS  
**Date:** 2026-05-10  

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 6 |
| 🟠 High | 7 |
| 🟡 Medium | 6 |
| 🔵 Low / Code Quality | 6 |

---

## 🔴 Critical Issues

---

### C1 — OTP is Generated and Verified Entirely on the Client

**File:** `src/pages/StudentLogin.jsx` — lines 110–174

**Problem:**  
The 6-digit OTP is generated with `Math.random()` inside the browser, stored in React state (`validOtps`), and verified by comparing what the user types against that same in-memory array. There is no server involved in the generation or validation. This means:

- Anyone with DevTools open can inspect React state and read the current OTP directly.
- `Math.random()` is not cryptographically secure; the output can be predicted in some environments.
- A user could call `handleVerifyOTP` from the browser console with any known OTP value.
- On page refresh all valid OTPs are lost without any server-side invalidation.

**Expected Resolution:**
Move OTP generation and verification to a server-side function (e.g. a Firebase Cloud Function). The function should:
1. Generate the OTP using a cryptographically secure random source (`crypto.randomBytes`).
2. Store a **hashed** copy (SHA-256 or bcrypt) in Firestore with a TTL timestamp, keyed to the student's document ID.
3. Return only a success/failure response to the client — never the OTP value itself.
4. Delete the OTP record after one successful use.

---

### C2 — Student Session Stored in `localStorage` with No Expiry or Integrity Check

**File:** `src/App.jsx` — lines 28–43, 97

**Problem:**  
After a student logs in, their full profile object (name, email, rollNo, dept, division, role) is serialised to `localStorage` as plain JSON. On next page load, this value is trusted directly to restore the session without any re-validation against Firestore or checking whether the student record has changed. There is no session expiry time, no signature/HMAC, and no server acknowledgement. Anyone with access to the device — or a malicious browser extension — can forge a valid `studentSession` object with `role: "student"` and be logged in immediately.

**Expected Resolution:**
- Set a `sessionExpiry` timestamp when writing to `localStorage` (e.g. 12 hours) and reject sessions past that time on read.
- On restore, optionally do a lightweight Firestore `getDoc` to confirm the student record still exists and is active before accepting the session.
- Consider signing the session token with a Firebase custom token issued by a Cloud Function after OTP verification, and using `onAuthStateChanged` like the other roles do.

---

### C3 — Firestore Rules Allow Any Unauthenticated User to Read All Student Records

**File:** `firestore.rules` — line 20 (`allow read: if true`)

**Problem:**  
The `Students` collection is world-readable with no authentication required. Any person on the internet who knows the Firebase project ID can query the entire student database — including names, email addresses, roll numbers, and enrollment (PRN) numbers — without providing any credentials. The comment in the file acknowledges this is for the roll-number login query but does not restrict the scope.

**Expected Resolution:**
Tighten the read rule to only allow lookup by a specific roll number field, not a full collection scan. For example:

```
match /Students/{docId} {
  // Only allow reading a document if the requester supplies the matching rollNo
  allow get: if true; // single-doc read is unavoidable for OTP flow
  allow list: if request.auth != null; // collection scans only for authenticated staff
  allow create, update, delete: if request.auth != null;
}
```

Even better: move the OTP lookup to a Cloud Function so students never touch Firestore directly.

---

### C4 — Firestore Rules Allow Anyone to Create Feedback Without Any Rate Limiting or Deduplication Enforcement

**File:** `firestore.rules` — line 33 (`allow create: if true`)

**Problem:**  
The `Feedbacks`, `CourseExitResponses`, and `InstitutionFeedbackResponses` collections all permit unauthenticated `create` with no server-side constraints. Duplicate-submission prevention is handled only in client-side React state (`submittedReviews`, `hasSubmittedInst`), which can be bypassed by anyone making direct HTTP requests to Firestore. A malicious actor can flood the database with thousands of fake feedback entries, skewing all analytics.

**Expected Resolution:**
- Use Firestore security rule conditions to enforce one submission per student per allocation, e.g.:
  ```
  allow create: if !exists(/databases/$(database)/documents/Feedbacks/$(request.resource.data.studentRollNo + "_" + request.resource.data.allocationId));
  ```
- Or route all feedback submissions through a Cloud Function that validates the student session token and enforces idempotency.
- Add rate-limiting in the Cloud Function (e.g. max 30 submissions per hour per IP or student identity).

---

### C5 — `AdminDashboard` Performs No Role Check on Its Own Props

**File:** `src/pages/AdminDashboard.jsx` — line 72

**Problem:**  
The `AdminDashboard` component is declared as `export default function AdminDashboard()` — it accepts no props at all. The role gate exists only in `App.jsx`'s JSX (`{user.role === "admin" && <AdminDashboard />}`), which is purely client-side. If a developer ever accidentally renders `<AdminDashboard />` on a different route, or if the `App.jsx` role check is circumvented via browser DevTools (modifying React state), the admin panel is fully accessible. All destructive Firestore writes (creating HOD/Staff accounts, deactivating users) would proceed without any server-side role check because Firestore rules only check `request.auth != null` — any authenticated user (including HOD or Staff) passes that check.

**Expected Resolution:**
- Add a Firestore rule that restricts `Users` creates and updates to users whose own document has `role == "admin"`:
  ```
  allow create, update: if request.auth != null
    && get(/databases/$(database)/documents/Users/$(request.auth.uid)).data.role == "admin";
  ```
- Repeat this pattern for `Departments`, `Schemes`, and `Settings`.
- Optionally have `AdminDashboard` accept and verify the `user` prop and render an error state if `user.role !== "admin"`.

---

### C6 — The Secondary Firebase App Instance Leaks Admin Credential Context

**File:** `src/firebase.js` — lines 28–35

**Problem:**  
A second Firebase app instance (`SecondaryApp`) is initialised with the same config specifically to allow creating new user accounts without signing the current admin out. This is a known pattern but it means the `secondaryAuth` object — which holds an unauthenticated session that can call `createUserWithEmailAndPassword` — is exported at module scope and importable by any component in the app. No Firestore rule prevents a non-admin authenticated user from calling `createUserWithEmailAndPassword` on `secondaryAuth` (since it's a client-side SDK call to Firebase Auth, not Firestore). If a staff or HOD user loads a page that imports `secondaryAuth`, they can programmatically create new Firebase Auth accounts.

**Expected Resolution:**
Move account creation to a Firebase Cloud Function (`callable` type) that verifies the caller's custom claims (e.g. `role == "admin"`) before creating the account. Remove the secondary app export from the client entirely.

---

## 🟠 High Issues

---

### H1 — Duplicate `onAuthStateChanged` Listener in `App.jsx`

**File:** `src/App.jsx` — lines 56–92

**Problem:**  
Two separate `useEffect` hooks both call `onAuthStateChanged(auth, ...)`. The first one (line 56) sets `firebaseAuthUser` state; the second one (line 60) asynchronously fetches the user's Firestore document and sets `user` state. Both are mounted at the same time and run on every auth state change. This creates two active Firebase listeners for the same event simultaneously, and the second listener's async work (Firestore `getDoc`) races with the first listener's state update. The `firebaseAuthUser` variable set by the first listener is used elsewhere in JSX (to show the "Change Password" button) and can briefly be out of sync with `user`.

**Expected Resolution:**
Merge both listeners into a single `useEffect` with one `onAuthStateChanged` call that sets both `firebaseAuthUser` and `user` in one coherent block. Unsubscribe in the cleanup of that single effect.

---

### H2 — `loading` State Not Reset on Login Error in `Login.jsx`

**File:** `src/pages/Login.jsx` — lines 57–95

**Problem:**  
The `handleLogin` function sets `setLoading(true)` at the top and only sets `setLoading(false)` inside `catch` and within two early-return branches inside `if (userDoc.exists())`. If `userDoc.exists()` is `true` and `userData.active` is neither `false` nor `role === "student"` (i.e. the happy path continues to `onLoginSuccess`), `setLoading(false)` is never called — the button stays disabled. More importantly, if `auth.signOut()` throws in the `student` role branch, `setLoading(false)` is also skipped. There is no `finally` block.

**Expected Resolution:**
Wrap `setLoading(false)` in a `finally` block, or use a `try/catch/finally` structure to guarantee the loading state is always cleared:
```js
} finally {
  setLoading(false);
}
```
Remove all the manual `setLoading(false); return;` calls inside the try block.

---

### H3 — `window.confirm()` Used for Destructive Deletions

**File:** `src/pages/HodDashboard.jsx` — lines 2262, 2570

**Problem:**  
Student and subject deletions are confirmed using `window.confirm()`, which is a browser-native blocking dialog that is visually inconsistent with the app's design system, cannot be styled, is blocked by default in some embedded browser contexts (iframes, certain Android WebViews), and provides no context about the consequences of the action (e.g. "This will also delete all feedback linked to this student").

**Expected Resolution:**
Replace `window.confirm()` with a proper confirmation modal component (similar to the existing `ChangePasswordModal`). The modal should clearly describe what will be deleted and its side effects, and require an explicit "Delete" button click.

---

### H4 — `xlsx` Package Version 0.18.5 Has Known Security Vulnerabilities

**File:** `package.json` — `"xlsx": "^0.18.5"`

**Problem:**  
The `xlsx` (SheetJS community edition) package at version 0.18.x has been flagged in multiple security advisories for prototype pollution and ReDoS (Regular Expression Denial of Service) vulnerabilities when parsing untrusted spreadsheet files. HODs can upload `.xlsx` student lists, which are parsed client-side with this library. A crafted malicious spreadsheet uploaded by an attacker who has HOD credentials could exploit these vulnerabilities.

**Expected Resolution:**
Migrate to the actively maintained SheetJS Pro (`@sheet/core`) or switch to a server-side parsing approach via a Cloud Function. If staying on the community edition, pin to the latest available patch and monitor CVEs. Add file size and format validation before passing data to the parser.

---

### H5 — No Input Sanitisation on Spreadsheet-Imported Student Data

**File:** `src/pages/HodDashboard.jsx` — lines 481–530 (Excel import block)

**Problem:**  
When a HOD uploads a spreadsheet to bulk-import students, the raw cell values are mapped directly into Firestore writes with minimal transformation (only `rollFromSpreadsheetCell` normalisation on roll number). Fields like `name`, `email`, and `enrollmentNo` have no length limits, no character-set restrictions, and no XSS sanitisation before being stored. If a malicious spreadsheet contains a script payload in a name field (e.g. `<img src=x onerror=alert(1)>`), it will be stored verbatim in Firestore and later rendered in the UI via React's JSX (which escapes by default), but it creates a persistent dirty data problem and could be dangerous if ever rendered via `dangerouslySetInnerHTML` or exported to a non-React surface.

**Expected Resolution:**
Add validation rules to the import function: enforce maximum field lengths (e.g. name ≤ 100 chars, email must match a regex), strip or reject entries with HTML tags, and validate email format. Show a preview table before committing the batch write so the HOD can review what will be imported.

---

### H6 — Splash Screen Delays Are Hardcoded and Always Active

**File:** `src/App.jsx` — lines 80–88

**Problem:**  
The splash screen forces a minimum 1.2-second display time plus a 1.2-second fade, for a total forced wait of at least 2.4 seconds before the login form is visible — regardless of how fast the device or network is. This is purely cosmetic and penalises returning users on fast connections. On slow mobile connections the actual auth check may still be pending when the splash fades, causing a blank state flicker.

**Expected Resolution:**
Show the splash only until the Firebase `onAuthStateChanged` fires for the first time (which confirms whether there's a cached session). Use a minimum display time of ~300ms only if the auth check resolves faster than that, to avoid a flash. Remove the fixed 1.2s delay.

---

### H7 — No `Error Boundary` Around Lazy-Loaded Dashboards

**File:** `src/App.jsx` — lines 131–145

**Problem:**  
The four dashboard components are lazy-loaded with `React.lazy` and wrapped in a `<Suspense>` fallback. However, there is no `ErrorBoundary` wrapping the `<Suspense>`. If a lazy chunk fails to load (e.g. due to a network error or a deploy that changes chunk filenames), React will throw an uncaught error that crashes the entire app with a blank white screen and no user-friendly message.

**Expected Resolution:**
Wrap the `<Suspense>` in an `ErrorBoundary` component that renders a fallback UI with a "Reload" button:
```jsx
<ErrorBoundary fallback={<PageErrorFallback />}>
  <Suspense fallback={<Loader />}>
    {/* dashboards */}
  </Suspense>
</ErrorBoundary>
```

---

## 🟡 Medium Issues

---

### M1 — Student Submission Deduplication Relies on Client-Side Arrays Only

**File:** `src/pages/StudentDashboard.jsx` — lines 359, 508

**Problem:**  
Whether a student has already submitted feedback for an allocation is checked by reading `submittedReviews` — a React state array populated from the student's Firestore document on load. This prevents re-submission within a session, but a student can open the same form in a second browser tab (or incognito window), load the same state from Firestore simultaneously, and submit twice before either tab's Firestore listener reflects the other's write.

**Expected Resolution:**
Use a Firestore transaction or `setDoc` with a deterministic document ID (e.g. `${studentId}_${allocationId}_${acadYear}`) for each feedback document, so a second write to the same ID either overwrites idempotently or is rejected by a security rule.

---

### M2 — Sensitive Student Data Sent via EmailJS (Third-Party Service)

**File:** `src/pages/StudentLogin.jsx` — lines 117–129

**Problem:**  
The student's name, email address, and the OTP are sent through the EmailJS client-side SDK. This routes the data (including the plaintext OTP) through EmailJS's servers. It also exposes the EmailJS public key, service ID, and template ID as `VITE_` environment variables which are embedded into the compiled JavaScript bundle and visible to anyone who inspects the page source. The public key alone is sufficient to send emails from your EmailJS account, enabling spam abuse.

**Expected Resolution:**
Move email sending to a Firebase Cloud Function. The function is the only party that knows the OTP, sends the email via a server-side SDK (e.g. Nodemailer, SendGrid, or Firebase Email Extension), and never exposes credentials to the client. The client only calls the Cloud Function with the student's identifiers.

---

### M3 — `HodDashboard` Makes Unrestricted Cross-Department Firestore Queries

**File:** `src/pages/HodDashboard.jsx` — line 226

**Problem:**  
The HOD dashboard fetches all `Users` with `role in ["staff", "hod"]` from the entire `Users` collection — not filtered to the HOD's own department. A HOD can therefore see (and potentially act on) staff accounts from other departments. The Firestore rule allows any authenticated user to read all of `Users`.

**Expected Resolution:**
Filter the query by `dept == user.dept` on the client, and enforce it on the server via a Firestore rule that requires `request.auth.token.dept == resource.data.dept` (using custom claims) or move the query behind a Cloud Function that scopes the response to the caller's department.

---

### M4 — No `VITE_` Environment Variable Validation at Startup

**File:** `src/firebase.js`, `src/pages/StudentLogin.jsx`

**Problem:**  
If the `.env` file is missing or incomplete (e.g. during a fresh clone or a CI/CD deploy misconfiguration), all `import.meta.env.VITE_*` values are `undefined`. Firebase will initialise silently with an `undefined` API key and surface a confusing "FirebaseError: projectId must be a non-empty string" deep inside a component render, rather than a clear startup error.

**Expected Resolution:**
Add an environment variable validation step that runs before `initializeApp`, throwing a descriptive error if any required variable is undefined:
```js
const required = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", ...];
required.forEach(key => {
  if (!import.meta.env[key]) throw new Error(`Missing env var: ${key}`);
});
```

---

### M5 — `page-wrap` CSS Class Defined but Never Used

**File:** `src/responsive.css` — lines 16–38

**Problem:**  
The `responsive.css` file defines a `.page-wrap` utility class with responsive padding, but no component in the codebase uses it. The actual layout width/padding is handled inline via Tailwind classes (`max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8`) in `App.jsx`. This creates dead CSS and a false impression that `.page-wrap` should be used for new pages.

**Expected Resolution:**
Either remove `.page-wrap` from `responsive.css` entirely, or migrate the inline Tailwind layout classes in `App.jsx` to use it consistently — and document that convention.

---

### M6 — `name` Package Field in `package.json` Is a Generic Placeholder

**File:** `package.json` — line 2 (`"name": "my-react-app"`)

**Problem:**  
The project name is still the Vite scaffold default. This surfaces in build logs, error messages, and npm-related tooling. It also makes it harder to identify the project in monorepo or multi-project CI setups.

**Expected Resolution:**
Update to a meaningful, lowercase, hyphenated name such as `"feedback-portal-ses"`.

---

## 🔵 Low / Code Quality Issues

---

### L1 — 35 `console.log` / `console.error` / `console.warn` Calls Left in Production Code

**Scope:** Across all files in `src/`

**Problem:**  
Debugging statements are present throughout the codebase. In production, these leak internal implementation details (Firestore query structures, error codes, user object shapes) to anyone with DevTools open.

**Expected Resolution:**
Remove all `console.*` calls before deploying to production. For error monitoring, integrate a proper observability tool such as Firebase Crashlytics, Sentry, or a simple Cloud Function error logger.

---

### L2 — Monolithic Page Components (Up to 4,315 Lines)

**Scope:** `src/pages/HodDashboard.jsx` (4,315 lines), `src/pages/AdminDashboard.jsx` (1,821 lines)

**Problem:**  
`HodDashboard.jsx` is a single 4,315-line component. It mixes data fetching, business logic, state management, and UI for at least six distinct features (Students, Subjects, Allocations, Feedback, Reports, Settings). This makes the file very hard to review, test, and maintain. A change to the Allocations tab risks accidentally breaking the Reports tab.

**Expected Resolution:**
Split each feature/tab into its own sub-component or page module (e.g. `HodStudentsTab.jsx`, `HodReportsTab.jsx`). Extract data-fetching logic into custom hooks (`useStudents`, `useFeedbackData`). Each file should have a single clear responsibility.

---

### L3 — Hardcoded Institution Name in Multiple Files

**Scope:** `src/pages/Login.jsx`, `src/pages/StudentLogin.jsx`, `src/App.jsx`

**Problem:**  
The string `"SES Polytechnic Solapur"` is hardcoded in at least three separate files. If the portal is reused for another institution, all instances must be found and changed manually.

**Expected Resolution:**
Create a `src/constants/institution.js` file exporting `INSTITUTION_NAME`, `INSTITUTION_SHORT`, and related strings. Import from there wherever needed.

---

### L4 — `UI.jsx` Component Is a Near-Empty Stub

**File:** `src/components/UI.jsx`

**Problem:**  
`UI.jsx` currently exports only a `Card` component (a simple `<div>` wrapper with a className). Its name implies it will be a shared component library, but it is almost empty. Other shared UI needs (buttons, inputs, modals) are either duplicated inline or handled with one-off Tailwind classes across pages.

**Expected Resolution:**
Either populate `UI.jsx` with the shared UI primitives actually used across the app (Button, Input, Modal, Badge), or rename it to `Card.jsx` to accurately reflect its current content and avoid confusion.

---

### L5 — Academic Year Derived Purely from System Clock

**File:** `src/pages/StudentDashboard.jsx` — lines 60–65 (`getAutoAcadYear`)

**Problem:**  
The academic year (e.g. `"2025-26"`) is computed locally from `new Date()` with a hardcoded rule that June is the year boundary. If the device's clock is wrong, or the real academic calendar differs from this assumption, feedback records will be stored under the wrong year key, potentially corrupting analytics.

**Expected Resolution:**
Store the current academic year and semester in the `Settings/Global` Firestore document (already partially used) and read it from there, rather than deriving it from the client clock.

---

### L6 — ESLint `react-refresh/only-export-components` Suppressed in `NotificationContext.jsx`

**File:** `src/context/NotificationContext.jsx` — line 1

**Problem:**  
The file starts with `/* eslint-disable react-refresh/only-export-components */`. This disables a lint rule that prevents HMR (Hot Module Replacement) from breaking during development when non-component exports are mixed in the same file. The workaround is necessary here because `useNotify` and `NotificationProvider` are co-located, but suppressing a lint rule at file scope is a code smell.

**Expected Resolution:**
Split `NotificationContext.jsx` into `NotificationContext.js` (context + provider) and `useNotify.js` (the hook), removing the need for the eslint disable comment.

---

## Appendix — Files Reviewed

| File | Lines |
|------|-------|
| `src/App.jsx` | 232 |
| `src/firebase.js` | 35 |
| `src/pages/Login.jsx` | 217 |
| `src/pages/StudentLogin.jsx` | 415 |
| `src/pages/StudentDashboard.jsx` | 1,343 |
| `src/pages/AdminDashboard.jsx` | 1,821 |
| `src/pages/HodDashboard.jsx` | 4,315 |
| `src/pages/StaffDashboard.jsx` | 1,125 |
| `src/components/ChangePasswordModal.jsx` | 176 |
| `src/components/UI.jsx` / `UI/CustomSelect.jsx` | — |
| `src/context/NotificationContext.jsx` | 105 |
| `src/constants/feedbackQuestions.js` | 52 |
| `src/constants/rollNumber.js` | 24 |
| `firestore.rules` | 52 |
| `package.json` | 33 |
| `src/responsive.css` | 47 |
