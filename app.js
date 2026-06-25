const stages = [
  "Planning","Requirements","Design","Development","Testing","Deployment","Maintenance"
];

const taskStatuses = ["Backlog", "In Progress", "Done"];

// Frontend State
let projects = [];
let selectedProjectId = "";
let editingProjectId = null;
let quickMode = "update";
let currentUser = null;
let authMode = "login";

const els = {
  searchInput: document.querySelector("#searchInput"),
  stageFilter: document.querySelector("#stageFilter"),
  projectList: document.querySelector("#projectList"),
  projectDetail: document.querySelector("#projectDetail"),
  detailTitle: document.querySelector("#detailTitle"),
  sdlcTrack: document.querySelector("#sdlcTrack"),
  kanbanBoard: document.querySelector("#kanbanBoard"),
  updatesList: document.querySelector("#updatesList"),
  metricProjects: document.querySelector("#metricProjects"),
  metricProgress: document.querySelector("#metricProgress"),
  metricRisks: document.querySelector("#metricRisks"),
  metricDue: document.querySelector("#metricDue"),
  projectDialog: document.querySelector("#projectDialog"),
  projectForm: document.querySelector("#projectForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  projectName: document.querySelector("#projectName"),
  projectOwner: document.querySelector("#projectOwner"),
  projectStage: document.querySelector("#projectStage"),
  projectPriority: document.querySelector("#projectPriority"),
  projectDue: document.querySelector("#projectDue"),
  projectProgress: document.querySelector("#projectProgress"),
  projectGoal: document.querySelector("#projectGoal"),
  quickDialog: document.querySelector("#quickDialog"),
  quickForm: document.querySelector("#quickForm"),
  quickEyebrow: document.querySelector("#quickEyebrow"),
  quickTitle: document.querySelector("#quickTitle"),
  quickTextLabel: document.querySelector("#quickTextLabel"),
  quickText: document.querySelector("#quickText"),
  editProjectBtn: document.querySelector("#editProjectBtn"),
  deleteProjectBtn: document.querySelector("#deleteProjectBtn"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmForm: document.querySelector("#confirmForm")
};

// ============================================================
// Custom Notification and Dialog Systems
// ============================================================

// Custom toast notification system
function showToast(title, message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ"
  }[type] || "ℹ";

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" type="button">✕</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Trigger CSS entry animation
  setTimeout(() => toast.classList.add("show"), 10);

  // Bind close action
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  });

  // Animate progress bar scale down
  const progress = toast.querySelector(".toast-progress");
  progress.style.transition = "transform 4s linear";
  progress.style.transform = "scaleX(1)";
  setTimeout(() => {
    progress.style.transform = "scaleX(0)";
  }, 50);

  // Auto remove toast
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }
  }, 4000);
}

// Custom confirmation dialog system (returns a Promise)
function showCustomConfirm(title, message, eyebrow = "Action Required") {
  return new Promise((resolve) => {
    const dialog = document.getElementById("customConfirmDialog");
    const titleEl = document.getElementById("customConfirmTitle");
    const msgEl = document.getElementById("customConfirmMessage");
    const eyebrowEl = document.getElementById("customConfirmEyebrow");
    
    const cancelBtn = document.getElementById("customConfirmCancelBtn");
    const submitBtn = document.getElementById("customConfirmSubmitBtn");
    const closeBtn = document.getElementById("customConfirmCloseBtn");

    titleEl.textContent = title;
    msgEl.textContent = message;
    eyebrowEl.textContent = eyebrow;

    const cleanup = (value) => {
      dialog.close();
      submitBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
      resolve(value);
    };

    submitBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    closeBtn.onclick = () => cleanup(false);

    dialog.showModal();
  });
}

function showFirebaseSetupGuide() {
  document.getElementById("setupGuideDialog").showModal();
}

// ============================================================
// Real-time Database Listeners
// ============================================================
function setupRealtimeProjects() {
  // Clear any existing listeners
  if (window.projectsUnsubscribe) {
    window.projectsUnsubscribe();
  }

  // Set up live Firestore listener
  window.projectsUnsubscribe = window.db.collection('projects')
    .onSnapshot((snapshot) => {
      const allProjects = [];
      snapshot.forEach(doc => {
        allProjects.push({ id: doc.id, ...doc.data() });
      });

      // Role Access Enforcement: Filter projects client-side
      projects = allProjects.filter(p => 
        p.ownerId === currentUser.id || 
        p.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase() || 
        (p.members && p.members.map(m => m.toLowerCase()).includes(currentUser.email.toLowerCase()))
      );

      if (projects.length > 0) {
        if (!selectedProjectId || !projects.some(p => p.id === selectedProjectId)) {
          selectedProjectId = projects[0].id;
        }
      } else {
        selectedProjectId = "";
      }

      render();
    }, (err) => {
      console.error("Firestore subscription error:", err);
      if (err.code === 'permission-denied' || err.message?.includes('permission-denied') || err.message?.includes('permissions')) {
        showCustomConfirm(
          "Your Cloud Firestore security rules are blocking reads/writes. To resolve this: 1) Go to Firebase Console > Firestore Database. 2) Click the 'Rules' tab. 3) Replace the rules to allow authenticated access (e.g., allow read, write: if request.auth != null;). 4) Click 'Publish'.",
          "Configure Firestore security rules to allow read/write access.",
          "Firestore Permissions Required"
        );
      } else {
        showCustomConfirm(
          "Unable to connect to Cloud Firestore. Please ensure: 1) You have clicked 'Create database' under Firestore Database in the Firebase Console. 2) Your database is in the correct region. 3) You are connected to the internet.",
          "Make sure Firestore is enabled in your Firebase Project.",
          "Firestore Database Connection Error"
        );
      }
      showToast("Sync Offline", "Could not fetch projects from database.", "error");
    });
}

// ============================================================
// Authentication Lifecycles & Handlers
// ============================================================

function setAuthMode(mode) {
  authMode = mode;
  const nameGroup = document.querySelector("#authNameGroup");
  const nameInput = document.querySelector("#authName");
  const emailLabel = document.querySelector("#authEmailLabel");
  const title = document.querySelector("#authTitle");
  const submitBtn = document.querySelector("#authSubmitBtn");
  const forgotLink = document.querySelector("#authForgotLink");
  const toggleText = document.querySelector("#authToggleText");
  const toggleMode = document.querySelector("#authToggleMode");
  const rememberGroup = document.querySelector("#authRememberGroup");

  const roleGroup = document.querySelector("#authRoleGroup");

  if (mode === "signup") {
    nameGroup.style.display = "block";
    nameInput.required = true;
    roleGroup.style.display = "block";
    emailLabel.textContent = "Email address";
    title.textContent = "Sign up";
    submitBtn.textContent = "Sign up";
    forgotLink.style.display = "none";
    rememberGroup.style.display = "none";
    toggleText.textContent = "Already have an account?";
    toggleMode.textContent = "Log in";
  } else {
    nameGroup.style.display = "none";
    nameInput.required = false;
    roleGroup.style.display = "none";
    emailLabel.textContent = "Email address or user name";
    title.textContent = "Log in";
    submitBtn.textContent = "Log in";
    forgotLink.style.display = "inline-block";
    rememberGroup.style.display = "flex";
    toggleText.textContent = "Don't have an account?";
    toggleMode.textContent = "Sign up";
  }
}

async function saveUserRole(uid, email, name, role) {
  const collectionName = role === 'manager' ? 'managers' : 'employees';
  await window.db.collection(collectionName).doc(uid).set({
    uid: uid,
    email: email,
    name: name,
    role: role,
    createdAt: new Date().toISOString()
  });
}

async function fetchUserRole(uid) {
  if (uid === 'mock-manager-id') {
    return 'manager';
  }
  // Check managers collection first
  try {
    let doc = await window.db.collection('managers').doc(uid).get();
    if (doc.exists) {
      return 'manager';
    }
  } catch (e) {
    console.warn("Checking managers collection failed, trying employees...", e);
  }

  // Check employees collection
  try {
    let doc = await window.db.collection('employees').doc(uid).get();
    if (doc.exists) {
      return 'employee';
    }
  } catch (e) {
    console.error("Error reading employees collection:", e);
  }

  return null;
}

function promptUserRole(uid, email, name) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("roleSelectionDialog");
    const chooseManager = document.getElementById("chooseManagerBtn");
    const chooseEmployee = document.getElementById("chooseEmployeeBtn");

    const selectRole = async (role) => {
      try {
        await saveUserRole(uid, email, name, role);
        dialog.close();
        resolve(role);
      } catch (err) {
        console.error("Failed to save role:", err);
        showToast("Error", "Failed to save selected role. Please try again.", "error");
      }
    };

    chooseManager.onclick = () => selectRole('manager');
    chooseEmployee.onclick = () => selectRole('employee');

    dialog.showModal();
  });
}

// Initialize Auth listeners and buttons
function initAuth() {
  // Bind Setup Guide triggers
  document.getElementById("setupGuideBtn").addEventListener("click", showFirebaseSetupGuide);

  // Show banner if running in local LocalStorage fallback mode
  if (!window.firebaseConfigured) {
    document.getElementById("firebaseConfigBanner").style.display = "flex";
  }

  // Register state change listener
  window.auth.onAuthStateChanged(async (user) => {
    if (user) {
      const name = user.displayName || user.email.split('@')[0];
      let role = await fetchUserRole(user.uid);
      if (!role) {
        role = await promptUserRole(user.uid, user.email, name);
      }

      currentUser = {
        id: user.uid,
        email: user.email,
        name: name,
        role: role,
        picture: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      };
      
      // Update DOM UI profile
      document.querySelector("#userName").textContent = `${currentUser.name} (${role === 'manager' ? '👑 Manager' : '👤 Employee'})`;
      document.querySelector("#userEmail").textContent = currentUser.email;
      document.querySelector("#userAvatar").src = currentUser.picture;

      // Hide Manager features for Employees!
      const newProjBtn = document.querySelector("#newProjectBtn");
      if (newProjBtn) newProjBtn.style.display = role === 'manager' ? "" : "none";
      
      // View Transition
      document.querySelector("#loginScreen").style.display = "none";
      document.querySelector("#appShell").style.display = "grid";

      // Initialize database listener
      setupRealtimeProjects();
    } else {
      currentUser = null;
      if (window.projectsUnsubscribe) {
        window.projectsUnsubscribe();
        window.projectsUnsubscribe = null;
      }
      
      // View Transition back to auth
      document.querySelector("#appShell").style.display = "none";
      document.querySelector("#loginScreen").style.display = "flex";
      
      projects = [];
      selectedProjectId = "";
      render();
    }
  });

  // Toggle Mode Click
  document.querySelector("#authToggleMode").addEventListener("click", (e) => {
    e.preventDefault();
    setAuthMode(authMode === "login" ? "signup" : "login");
  });

  // Back Button click
  document.querySelector("#loginBackBtn").addEventListener("click", () => {
    if (authMode === "signup") {
      setAuthMode("login");
    } else {
      document.querySelector("#authForm").reset();
    }
  });

  // Show/Hide password toggle
  document.querySelector("#togglePasswordBtn").addEventListener("click", () => {
    const pwdInput = document.querySelector("#authPassword");
    const toggleBtn = document.querySelector("#togglePasswordBtn");
    if (pwdInput.type === "password") {
      pwdInput.type = "text";
      toggleBtn.textContent = "👁️ Hide";
    } else {
      pwdInput.type = "password";
      toggleBtn.textContent = "👁️ Show";
    }
  });

  // Auth Form Submit
  document.querySelector("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.querySelector("#authEmail").value.trim();
    const password = document.querySelector("#authPassword").value;
    
    try {
      if (authMode === "signup") {
        const name = document.querySelector("#authName").value.trim();
        const role = document.querySelector("#authRole").value;
        const cred = await window.auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        await saveUserRole(cred.user.uid, email, name, role);
        showToast("Account Created", `Welcome, ${name}!`, "success");
      } else {
        await window.auth.signInWithEmailAndPassword(email, password);
        showToast("Logged In", "Welcome back to ProjectFlow!", "success");
      }
    } catch (err) {
      console.error("Auth action failed:", err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        showCustomConfirm(
          "Email/Password sign-in is not enabled in your Firebase Project Console. To activate: 1) Open your Firebase Console. 2) Go to Build > Authentication > Sign-in method. 3) Click 'Add new provider' and select 'Email/Password'. 4) Toggle 'Enable' and click Save.",
          "Enable Email/Password Sign-In in Firebase Console to use this feature.",
          "Firebase Auth Action Required"
        );
      } else {
        showToast("Access Denied", err.message || "Authentication failed. Check your password.", "error");
      }
    }
  });

  // Bind Sign Out
  document.querySelector("#logoutBtn").addEventListener("click", () => {
    window.auth.signOut().then(() => {
      showToast("Signed Out", "You have been logged out safely.", "info");
    });
  });

  // Bind Quick Demo Access
  document.querySelector("#demoQuickLoginLink").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (!window.firebaseConfigured) {
        // Direct mock login
        const mockAuth = window.auth;
        mockAuth._trigger({
          uid: 'mock-manager-id',
          email: 'manager@example.com',
          displayName: 'Aditya Sharma',
          photoURL: 'https://api.dicebear.com/7.x/initials/svg?seed=Aditya%20Sharma'
        });
        showToast("Demo Manager Mode", "Signed in as Aditya Sharma.", "success");
      } else {
        // Firebase Auth credentials sign-in/registration
        try {
          await window.auth.signInWithEmailAndPassword('demo@projectflow.com', 'demo1234');
          showToast("Demo Logged In", "Signed in with cloud demo credentials.", "success");
        } catch (err) {
          if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            // Auto register the user in Firebase project
            const cred = await window.auth.createUserWithEmailAndPassword('demo@projectflow.com', 'demo1234');
            await cred.user.updateProfile({ displayName: 'Demo Manager' });
            await saveUserRole(cred.user.uid, 'demo@projectflow.com', 'Demo Manager', 'manager');
            showToast("Demo Environment Configured", "Registered and signed in.", "success");
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error("Demo login failed:", err);
      if (err.code === 'auth/operation-not-allowed' || err.message?.includes('operation-not-allowed')) {
        showCustomConfirm(
          "Email/Password sign-in is not enabled in your Firebase Project Console. To activate: 1) Open your Firebase Console. 2) Go to Build > Authentication > Sign-in method. 3) Click 'Add new provider' and select 'Email/Password'. 4) Toggle 'Enable' and click Save.",
          "Enable Email/Password Sign-In in Firebase Console to use this feature.",
          "Firebase Auth Action Required"
        );
      } else {
        showToast("Demo Access Offline", err.message || "Could not log into demo mode.", "error");
      }
    }
  });

  // Bind Google Authentication
  document.querySelector("#googleSignInBtn").addEventListener("click", async () => {
    try {
      if (!window.firebaseConfigured) {
        // Fallback popup simulator
        await window.auth.signInWithPopup(null);
        showToast("Google Mode Enabled", "Logged in using mock credentials.", "success");
      } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        await window.auth.signInWithPopup(provider);
        showToast("Verified Account", "Authenticated via Google Cloud successfully.", "success");
      }
    } catch (err) {
      console.error("Google Sign-In failed:", err);
      if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration-not-found')) {
        showCustomConfirm(
          "Google provider is not enabled in your Firebase Project Console. To activate it: 1) Go to the Firebase Console. 2) Under Authentication > Sign-in method, click 'Add new provider'. 3) Select Google, toggle 'Enable', choose your support email, and save.",
          "Enable Google Sign-In in Firebase Console to use this feature.",
          "Firebase Admin Action Required"
        );
      } else if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        showCustomConfirm(
          `This domain (${window.location.hostname}) is not authorized for OAuth in your Firebase project. To resolve: 1) Open the app via http://localhost:3000/ (which is authorized by default) instead of 127.0.0.1. 2) Or go to Firebase Console > Authentication > Settings > Authorized domains, and add "${window.location.hostname}" to the list.`,
          "Authorize this domain in Firebase Console to use Google Sign-In.",
          "Firebase Domain Authorization Required"
        );
      } else {
        showToast("Google Login Cancelled", err.message || "Action was cancelled.", "error");
      }
    }
  });
}

// ============================================================
// Core Dashboard Helpers and Rendering Engine
// ============================================================

function getSelectedProject() {
  return projects.find((p) => p.id === selectedProjectId) || projects[0];
}

function getVisibleProjects() {
  const query = els.searchInput.value.trim().toLowerCase();
  const stage = els.stageFilter.value;
  return projects.filter((p) => {
    const matchesStage = stage === "all" || p.stage === stage;
    const text = `${p.name} ${p.owner} ${p.goal}`.toLowerCase();
    return matchesStage && (!query || text.includes(query));
  });
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function daysUntil(value) {
  return Math.ceil((new Date(value) - new Date()) / 86400000);
}

function animateCount(el, target) {
  const start = parseInt(el.textContent) || 0;
  const isPercent = String(target).includes("%");
  const end = parseInt(target);
  if (start === end) return;
  const duration = 600;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(start + (end - start) * easeOut(progress));
    el.textContent = isPercent ? `${value}%` : value;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function render() {
  const visible = getVisibleProjects();
  if (!visible.some((p) => p.id === selectedProjectId) && visible[0]) {
    selectedProjectId = visible[0].id;
  }
  const selected = getSelectedProject();
  renderMetrics(visible);
  renderProjectList(visible);
  renderDetails(selected);
  renderSdlc(selected);
  renderKanban(selected);
  renderUpdates(selected);
  highlightNav();
}

function renderMetrics(items) {
  const avg = items.length
    ? Math.round(items.reduce((s, p) => s + Number(p.progress), 0) / items.length) : 0;
  const risks = items.filter((p) => p.priority === "High" || daysUntil(p.due) <= 7).length;
  const dueSoon = items.filter((p) => { const d = daysUntil(p.due); return d >= 0 && d <= 14; }).length;

  animateCount(els.metricProjects, items.length);
  animateCount(els.metricProgress, `${avg}%`);
  animateCount(els.metricRisks, risks);
  animateCount(els.metricDue, dueSoon);
}

function renderProjectList(items) {
  if (!items.length) {
    els.projectList.innerHTML = `<div class="empty-state">No projects match the current filters.</div>`;
    return;
  }
  els.projectList.innerHTML = items.map((p, i) => `
    <button class="project-card ${p.id === selectedProjectId ? "selected" : ""}"
      type="button" data-project-id="${p.id}"
      style="animation-delay:${i * 0.06}s">
      <div class="project-row">
        <h3>${escapeHtml(p.name)}</h3>
        <span class="badge ${p.priority.toLowerCase()}">${p.priority}</span>
      </div>
      <div class="project-meta">
        <span>👤 ${escapeHtml(p.owner)}</span>
        <span>🔖 ${p.stage}</span>
        <span>📅 Due ${formatDate(p.due)}</span>
      </div>
      <div class="progress" aria-label="${p.progress}% complete" title="${p.progress}% complete">
        <span style="width:${p.progress}%"></span>
      </div>
    </button>
  `).join("");
}

function renderDetails(project) {
  if (!project) {
    els.detailTitle.textContent = "No project selected";
    els.projectDetail.innerHTML = `<div class="empty-state">Select a project or create a new one to see details.</div>`;
    if (els.editProjectBtn) els.editProjectBtn.style.display = "none";
    if (els.deleteProjectBtn) els.deleteProjectBtn.style.display = "none";
    document.querySelector("#projectCollaborationSection").style.display = "none";
    return;
  }

  // Owner evaluation check
  const isOwner = currentUser && (project.ownerId === currentUser.id || project.ownerEmail?.toLowerCase() === currentUser.email?.toLowerCase());

  if (els.editProjectBtn) els.editProjectBtn.style.display = isOwner ? "" : "none";
  if (els.deleteProjectBtn) els.deleteProjectBtn.style.display = isOwner ? "" : "none";

  // Show member module to all assigned participants
  document.querySelector("#projectCollaborationSection").style.display = "";
  document.querySelector("#addMemberForm").style.display = isOwner ? "flex" : "none";

  const remaining = daysUntil(project.due);
  els.detailTitle.textContent = project.name;
  const healthColor = remaining < 0 ? "#ef4444" : remaining <= 7 ? "#f97316" : "#22c55e";
  const healthText = remaining < 0 ? "⛔ Overdue" : remaining <= 7 ? `⚡ ${remaining} days left` : `✅ ${remaining} days left`;
  
  els.projectDetail.innerHTML = `
    <p>${escapeHtml(project.goal)}</p>
    ${detailRow("👤 Owner", escapeHtml(project.owner))}
    ${detailRow("🔖 SDLC Stage", project.stage)}
    ${detailRow("📊 Progress", `
      <div style="display:flex;align-items:center;gap:10px;min-width:140px">
        <div class="progress" style="flex:1"><span style="width:${project.progress}%"></span></div>
        <strong style="min-width:36px">${project.progress}%</strong>
      </div>`)}
    ${detailRow("📅 Due Date", formatDate(project.due))}
    ${detailRow("🏥 Timeline Health", `<strong style="color:${healthColor}">${healthText}</strong>`)}
  `;

  renderMembers(project, isOwner);
}

function renderMembers(project, isOwner) {
  const membersList = document.querySelector("#projectMembersList");
  if (!project.members || project.members.length === 0) {
    membersList.innerHTML = `<div class="empty-state" style="padding: 8px 10px; font-size: 11px; width: 100%;">No employees assigned yet.</div>`;
    return;
  }

  membersList.innerHTML = project.members.map(email => `
    <div class="member-badge">
      <span>👤 ${escapeHtml(email)}</span>
      ${isOwner ? `<button type="button" class="remove-member-btn" data-member-email="${email}">✕</button>` : ""}
    </div>
  `).join("");
}

function detailRow(label, value) {
  return `<div class="detail-row"><span>${label}</span><span>${value}</span></div>`;
}

function renderSdlc(project) {
  const counts = stages.reduce((acc, s) => {
    acc[s] = projects.filter((p) => p.stage === s).length;
    return acc;
  }, {});

  els.sdlcTrack.innerHTML = stages.map((stage, i) => `
    <div class="stage ${project?.stage === stage ? "active" : ""}" style="animation-delay:${i*0.05}s">
      <strong>${i + 1}. ${stage}</strong>
      <div class="stage-count">${counts[stage]} project${counts[stage] === 1 ? "" : "s"}</div>
      <p>${stageDescription(stage)}</p>
    </div>
  `).join("");
}

function stageDescription(stage) {
  return {
    Planning: "Scope, budget, timeline, and ownership.",
    Requirements: "User needs, rules, acceptance criteria.",
    Design: "UX, architecture, data, and solution shape.",
    Development: "Build features and connect services.",
    Testing: "QA, UAT, defects, and release readiness.",
    Deployment: "Ship, monitor, and validate launch.",
    Maintenance: "Improve, support, and measure outcomes."
  }[stage];
}

function renderKanban(project) {
  if (!project) {
    els.kanbanBoard.innerHTML = taskStatuses.map((status) => `
      <div class="column">
        <h3><span class="col-dot backlog"></span>${status}</h3>
        <div class="task-stack">
          <div class="empty-state">No project selected</div>
        </div>
      </div>
    `).join("");
    return;
  }
  const dotClass = { "Backlog": "backlog", "In Progress": "inprogress", "Done": "done" };
  els.kanbanBoard.innerHTML = taskStatuses.map((status) => {
    const tasks = (project.tasks || []).filter((t) => t.status === status);
    return `
      <div class="column">
        <h3><span class="col-dot ${dotClass[status]}"></span>${status}</h3>
        <div class="task-stack">
          ${tasks.length ? tasks.map((t, i) => taskCard(t, i)).join("") : `<div class="empty-state">No tasks</div>`}
        </div>
      </div>
    `;
  }).join("");
}

function taskCard(task, i) {
  return `
    <div class="task-card" data-task-id="${task.id}" style="animation-delay:${i*0.06}s">
      <div class="task-top">
        <strong>${escapeHtml(task.title)}</strong>
        <div class="task-actions">
          <button class="mini-btn" type="button" data-task-action="back" title="Move back">‹</button>
          <button class="mini-btn" type="button" data-task-action="next" title="Move next">›</button>
        </div>
      </div>
      <small>${task.status}</small>
    </div>
  `;
}

function renderUpdates(project) {
  if (!project) {
    els.updatesList.innerHTML = `<div class="empty-state">No project selected</div>`;
    return;
  }
  const updates = [...(project.updates || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  els.updatesList.innerHTML = updates.length
    ? updates.map((u, i) => `
      <div class="update-item" style="animation-delay:${i*0.05}s">
        <strong>${escapeHtml(u.text)}</strong>
        <small>📅 ${formatDate(u.date)}</small>
      </div>
    `).join("")
    : `<div class="empty-state">No updates yet.</div>`;
}

// ============================================================
// Interactive Form and Dialog Control Actions
// ============================================================

function openProjectDialog(project) {
  editingProjectId = project?.id || null;
  els.dialogTitle.textContent = project ? "Edit Project" : "New Project";
  els.projectName.value = project?.name || "";
  els.projectOwner.value = project?.owner || currentUser?.name || "";
  els.projectStage.value = project?.stage || "Planning";
  els.projectPriority.value = project?.priority || "Medium";
  els.projectDue.value = project?.due || new Date().toISOString().slice(0, 10);
  els.projectProgress.value = project?.progress ?? 0;
  els.projectGoal.value = project?.goal || "";
  els.projectDialog.showModal();
}

async function handleProjectSave(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") { els.projectDialog.close(); return; }

  const data = {
    name: els.projectName.value.trim(),
    owner: els.projectOwner.value.trim(),
    stage: els.projectStage.value,
    priority: els.projectPriority.value,
    due: els.projectDue.value,
    progress: Number(els.projectProgress.value),
    goal: els.projectGoal.value.trim()
  };

  try {
    if (editingProjectId) {
      window.db.collection('projects').doc(editingProjectId).update(data).catch(err => {
        console.error("Delayed update failed:", err);
        showToast("Sync Error", "Failed to sync updates to the cloud.", "error");
      });
      showToast("Success", `"${data.name}" has been modified successfully.`, "success");
    } else {
      const newProj = {
        ...data,
        ownerId: currentUser.id,
        ownerEmail: currentUser.email,
        tasks: [],
        updates: [
          { id: generateId(), text: `Project initialized by ${currentUser.name}.`, date: today() }
        ],
        members: []
      };
      window.db.collection('projects').add(newProj).then(docRef => {
        selectedProjectId = docRef.id;
      }).catch(err => {
        console.error("Delayed creation failed:", err);
        showToast("Sync Error", "Failed to sync project creation to the cloud.", "error");
      });
      showToast("Success", `"${data.name}" has been created.`, "success");
    }
    els.projectDialog.close();
  } catch (err) {
    console.error("Save project failed:", err);
    showToast("Error", "Unable to save project data.", "error");
  }
}

function openQuickDialog(mode) {
  quickMode = mode;
  els.quickEyebrow.textContent = mode === "task" ? "Task" : "Update";
  els.quickTitle.textContent = mode === "task" ? "Add Task" : "Add Update";
  els.quickTextLabel.firstChild.textContent = mode === "task" ? "Task Name" : "Details";
  els.quickText.placeholder = mode === "task" ? "Describe the task…" : "Write your update…";
  els.quickText.value = "";
  els.quickDialog.showModal();
}

async function handleQuickSave(event) {
  event.preventDefault();
  if (event.submitter?.value === "cancel") { els.quickDialog.close(); return; }
  if (!selectedProjectId) return;
  const text = els.quickText.value.trim();
  const selected = getSelectedProject();
  if (!selected) return;

  try {
    if (quickMode === "task") {
      const newTask = { id: `t-${generateId()}`, title: text, status: 'Backlog' };
      const updatedTasks = [newTask, ...(selected.tasks || [])];
      const updatedUpdates = [
        { id: generateId(), text: `Task added: "${text}" (by ${currentUser.name})`, date: today() },
        ...(selected.updates || [])
      ];
      window.db.collection('projects').doc(selectedProjectId).update({
        tasks: updatedTasks,
        updates: updatedUpdates
      }).catch(err => {
        console.error("Delayed task add failed:", err);
        showToast("Sync Error", "Failed to sync task to the cloud.", "error");
      });
      showToast("Task Created", `"${text}" was added to backlog.`, "success");
    } else {
      const newUpdate = { id: `u-${generateId()}`, text: `${text} (by ${currentUser.name})`, date: today() };
      const updatedUpdates = [newUpdate, ...(selected.updates || [])];
      window.db.collection('projects').doc(selectedProjectId).update({
        updates: updatedUpdates
      }).catch(err => {
        console.error("Delayed log add failed:", err);
        showToast("Sync Error", "Failed to sync update to the cloud.", "error");
      });
      showToast("Log Added", "Update logged successfully.", "success");
    }
    els.quickDialog.close();
  } catch (err) {
    console.error("Quick save failed:", err);
    showToast("Error", "Could not complete update.", "error");
  }
}

async function advanceSelectedStage() {
  const selected = getSelectedProject();
  if (!selected) return;
  const current = stages.indexOf(selected.stage);
  const nextStage = stages[Math.min(current + 1, stages.length - 1)];

  if (nextStage === selected.stage) {
    showToast("Info", "This project is already in its final maintenance phase.", "info");
    return;
  }

  try {
    const updatedUpdates = [
      { id: generateId(), text: `SDLC stage advanced from "${selected.stage}" to "${nextStage}" (by ${currentUser.name})`, date: today() },
      ...(selected.updates || [])
    ];
    await window.db.collection('projects').doc(selected.id).update({
      stage: nextStage,
      updates: updatedUpdates
    });
    showToast("Stage Updated", `Moved to "${nextStage}" stage.`, "success");
  } catch (err) {
    console.error("Advance stage failed:", err);
    showToast("Error", "Could not update SDLC stage.", "error");
  }
}

async function moveTask(taskId, direction) {
  const project = getSelectedProject();
  if (!project) return;
  const task = (project.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  const index = taskStatuses.indexOf(task.status);
  const next = direction === "next" ? index + 1 : index - 1;
  const nextStatus = taskStatuses[Math.max(0, Math.min(taskStatuses.length - 1, next))];
  
  if (nextStatus === task.status) return;

  const oldStatus = task.status;
  task.status = nextStatus;

  const updatedUpdates = [
    {
      id: generateId(),
      text: `Moved task "${task.title}" from "${oldStatus}" to "${nextStatus}" (by ${currentUser.name})`,
      date: today()
    },
    ...(project.updates || [])
  ];

  try {
    await window.db.collection('projects').doc(project.id).update({
      tasks: project.tasks,
      updates: updatedUpdates
    });
  } catch (err) {
    console.error("Move task failed:", err);
    showToast("Error", "Could not relocate task status.", "error");
  }
}

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function deleteSelectedProject() {
  const selected = getSelectedProject();
  if (!selected) return;
  els.confirmDialog.showModal();
}

function highlightNav() {
  document.querySelectorAll(".nav-item").forEach(a => a.classList.remove("active"));
  const hash = location.hash || "#overview";
  const active = document.querySelector(`.nav-item[href="${hash}"]`);
  if (active) active.classList.add("active");
}

function today() { return new Date().toISOString().slice(0, 10); }

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Populate Stage Filter and Select Fields
stages.forEach((stage) => {
  const opt = document.createElement("option");
  opt.value = stage;
  opt.textContent = stage;
  els.projectStage.append(opt);
});

// ============================================================
// Event Binding Operations
// ============================================================

document.querySelector("#newProjectBtn").addEventListener("click", () => openProjectDialog());
document.querySelector("#editProjectBtn").addEventListener("click", () => openProjectDialog(getSelectedProject()));
document.querySelector("#deleteProjectBtn").addEventListener("click", deleteSelectedProject);

els.confirmForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "delete") {
    if (selectedProjectId) {
      try {
        const pName = getSelectedProject()?.name || "Project";
        window.db.collection('projects').doc(selectedProjectId).delete().catch(err => {
          console.error("Delayed delete failed:", err);
          showToast("Sync Error", "Failed to sync delete to the cloud.", "error");
        });
        selectedProjectId = "";
        showToast("Project Deleted", `"${pName}" has been deleted.`, "success");
      } catch (err) {
        console.error("Delete project failed:", err);
        showToast("Error", "Failed to delete project.", "error");
      }
    }
  }
});

document.querySelector("#addTaskBtn").addEventListener("click", () => openQuickDialog("task"));
document.querySelector("#addUpdateBtn").addEventListener("click", () => openQuickDialog("update"));
document.querySelector("#advanceStageBtn").addEventListener("click", advanceSelectedStage);
els.projectForm.addEventListener("submit", handleProjectSave);
els.quickForm.addEventListener("submit", handleQuickSave);
els.searchInput.addEventListener("input", render);
els.stageFilter.addEventListener("change", render);
window.addEventListener("hashchange", highlightNav);

els.projectList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-project-id]");
  if (!card) return;
  selectedProjectId = card.dataset.projectId;
  render();
});

els.kanbanBoard.addEventListener("click", (event) => {
  const action = event.target.closest("[data-task-action]");
  if (!action) return;
  const card = event.target.closest("[data-task-id]");
  if (!card) return;
  moveTask(card.dataset.taskId, action.dataset.taskAction);
});

// Member Collaboration Event Bindings
document.querySelector("#addMemberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedProjectId) return;
  const emailInput = document.querySelector("#newMemberEmail");
  const email = emailInput.value.trim().toLowerCase();
  const selected = getSelectedProject();
  if (!selected) return;

  if (selected.ownerEmail?.toLowerCase() === email) {
    showToast("Invalid Invitation", "The project owner cannot be invited as an employee.", "warning");
    return;
  }
  if (selected.members && selected.members.map(m => m.toLowerCase()).includes(email)) {
    showToast("Already Assigned", "Employee is already assigned to this project.", "info");
    return;
  }

  const updatedMembers = [...(selected.members || []), email];
  const updatedUpdates = [
    {
      id: generateId(),
      text: `Assigned employee "${email}" to the project.`,
      date: today()
    },
    ...(selected.updates || [])
  ];

  try {
    await window.db.collection('projects').doc(selectedProjectId).update({
      members: updatedMembers,
      updates: updatedUpdates
    });
    emailInput.value = "";
    showToast("Member Added", `Added ${email} to project dashboard.`, "success");
  } catch (err) {
    console.error("Failed to add member:", err);
    showToast("Error", "Could not assign member to project.", "error");
  }
});

document.querySelector("#projectMembersList").addEventListener("click", async (e) => {
  const removeBtn = e.target.closest(".remove-member-btn");
  if (!removeBtn || !selectedProjectId) return;
  const email = removeBtn.dataset.memberEmail;
  const selected = getSelectedProject();
  if (!selected) return;

  // Use the new custom confirm dialog instead of standard browser confirm popup!
  const confirmed = await showCustomConfirm(
    "Remove Member",
    `Are you sure you want to remove employee "${email}" from this project?`,
    "Collaboration"
  );
  
  if (confirmed) {
    const updatedMembers = (selected.members || []).filter(m => m.toLowerCase() !== email.toLowerCase());
    const updatedUpdates = [
      {
        id: generateId(),
        text: `Removed employee "${email}" from the project.`,
        date: today()
      },
      ...(selected.updates || [])
    ];

    try {
      await window.db.collection('projects').doc(selectedProjectId).update({
        members: updatedMembers,
        updates: updatedUpdates
      });
      showToast("Member Removed", `Removed ${email} from project dashboard.`, "success");
    } catch (err) {
      console.error("Failed to remove member:", err);
      showToast("Error", "Could not remove member.", "error");
    }
  }
});

// Start Authentication Lifecycle
initAuth();
