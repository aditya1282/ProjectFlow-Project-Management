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
let jwtToken = localStorage.getItem("projectflow-jwt") || null;

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

// API Call Wrapper with Authorization header
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, options);
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      throw new Error("Session expired or unauthorized. Please log in again.");
    }
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `API Error: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error("API Call error:", err.message);
    alert(err.message);
    throw err;
  }
}

// Fetch all accessible projects from server
async function fetchProjects() {
  try {
    const data = await apiCall('/api/projects');
    projects = data;
    if (projects.length > 0) {
      // Retain selection if valid, otherwise select the first project
      if (!selectedProjectId || !projects.some(p => p.id === selectedProjectId)) {
        selectedProjectId = projects[0].id;
      }
    } else {
      selectedProjectId = "";
    }
    render();
  } catch (err) {
    console.error("Error fetching projects:", err);
  }
}

// Authentication Handlers
function handleLoginSuccess(token, user) {
  jwtToken = token;
  currentUser = user;
  localStorage.setItem("projectflow-jwt", token);
  localStorage.setItem("projectflow-user", JSON.stringify(user));
  
  // Update user profile block in sidebar
  document.querySelector("#userName").textContent = user.name;
  document.querySelector("#userEmail").textContent = user.email;
  document.querySelector("#userAvatar").src = user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`;
  
  // Transition views
  document.querySelector("#loginScreen").style.display = "none";
  document.querySelector("#appShell").style.display = "grid";

  // Load backend content
  fetchProjects();
}

function handleLogout() {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem("projectflow-jwt");
  localStorage.removeItem("projectflow-user");
  
  // Transition views
  document.querySelector("#appShell").style.display = "none";
  document.querySelector("#loginScreen").style.display = "flex";
  
  projects = [];
  selectedProjectId = "";
  render();
}

// Authentication state and toggles
let authMode = "login";

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

  if (mode === "signup") {
    nameGroup.style.display = "block";
    nameInput.required = true;
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
    emailLabel.textContent = "Email address or user name";
    title.textContent = "Log in";
    submitBtn.textContent = "Log in";
    forgotLink.style.display = "inline-block";
    rememberGroup.style.display = "flex";
    toggleText.textContent = "Don't have an account?";
    toggleMode.textContent = "Sign up";
  }
}

// Google Sign-In Callback
async function handleCredentialResponse(response) {
  try {
    const res = await apiCall('/api/auth/google', 'POST', { credential: response.credential });
    handleLoginSuccess(res.token, res.user);
  } catch (err) {
    console.error("Google login authentication failed:", err);
  }
}

// Initialize Auth configurations
async function initAuth() {
  const storedUser = localStorage.getItem("projectflow-user");
  if (jwtToken && storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      document.querySelector("#userName").textContent = currentUser.name;
      document.querySelector("#userEmail").textContent = currentUser.email;
      document.querySelector("#userAvatar").src = currentUser.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`;
      
      document.querySelector("#loginScreen").style.display = "none";
      document.querySelector("#appShell").style.display = "grid";
      
      await fetchProjects();
    } catch (err) {
      handleLogout();
    }
  } else {
    handleLogout();
  }

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

  // Password visibility Show/Hide Toggle
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

  // Form Submit Handler (unified signup and login)
  document.querySelector("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.querySelector("#authEmail").value.trim();
    const password = document.querySelector("#authPassword").value;
    
    try {
      if (authMode === "signup") {
        const name = document.querySelector("#authName").value.trim();
        const res = await apiCall('/api/auth/signup', 'POST', { email, password, name });
        handleLoginSuccess(res.token, res.user);
      } else {
        const res = await apiCall('/api/auth/login', 'POST', { email, password });
        handleLoginSuccess(res.token, res.user);
      }
    } catch (err) {
      console.error("Auth action failed:", err);
    }
  });

  // Bind Logout Action
  document.querySelector("#logoutBtn").addEventListener("click", handleLogout);

  // Bind Quick Demo Access Link
  document.querySelector("#demoQuickLoginLink").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await apiCall('/api/auth/mock', 'POST', { 
        email: "manager@example.com", 
        name: "Aditya Sharma" 
      });
      handleLoginSuccess(res.token, res.user);
    } catch (err) {
      console.error("Demo login failed:", err);
    }
  });

  // Initialize Google Identity Services
  try {
    const config = await (await fetch('/api/auth/config')).json();
    if (config.googleClientId && typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: handleCredentialResponse
      });
      
      // Render official Google button overlayed inside G wrapper
      google.accounts.id.renderButton(
        document.getElementById("googleBtn"),
        { theme: "outline", size: "large", type: "icon", shape: "circle" }
      );
    } else {
      // If client ID is missing, Google OAuth will alert when clicked
      document.getElementById("googleBtn").addEventListener("click", () => {
        alert("Google Client ID is not configured on the server. Please use standard credentials or Demo User.");
      });
    }
  } catch (err) {
    console.error("Failed to retrieve Google Auth config:", err);
  }
}

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

  // Role Access Evaluation: Owner checks
  const isOwner = currentUser && (project.ownerId === currentUser.id || project.ownerEmail?.toLowerCase() === currentUser.email?.toLowerCase());

  if (els.editProjectBtn) els.editProjectBtn.style.display = isOwner ? "" : "none";
  if (els.deleteProjectBtn) els.deleteProjectBtn.style.display = isOwner ? "" : "none";

  // Members section is shown to all members
  document.querySelector("#projectCollaborationSection").style.display = "";
  // Invite inputs are Manager-only
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
    const tasks = project.tasks.filter((t) => t.status === status);
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
  const updates = [...project.updates].sort((a, b) => new Date(b.date) - new Date(a.date));
  els.updatesList.innerHTML = updates.length
    ? updates.map((u, i) => `
      <div class="update-item" style="animation-delay:${i*0.05}s">
        <strong>${escapeHtml(u.text)}</strong>
        <small>📅 ${formatDate(u.date)}</small>
      </div>
    `).join("")
    : `<div class="empty-state">No updates yet.</div>`;
}

function openProjectDialog(project) {
  editingProjectId = project?.id || null;
  els.dialogTitle.textContent = project ? "Edit Project" : "New Project";
  els.projectName.value = project?.name || "";
  // Owner display name is automatically set on server
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
      await apiCall(`/api/projects/${editingProjectId}`, 'PUT', data);
    } else {
      const newProj = await apiCall('/api/projects', 'POST', data);
      selectedProjectId = newProj.id;
    }
    els.projectDialog.close();
    await fetchProjects();
  } catch (err) {
    console.error("Save project failed:", err);
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

  try {
    if (quickMode === "task") {
      await apiCall(`/api/projects/${selectedProjectId}/tasks`, 'POST', { title: text });
    } else {
      await apiCall(`/api/projects/${selectedProjectId}/updates`, 'POST', { text });
    }
    els.quickDialog.close();
    await fetchProjects();
  } catch (err) {
    console.error("Quick save failed:", err);
  }
}

async function advanceSelectedStage() {
  const selected = getSelectedProject();
  if (!selected) return;
  const current = stages.indexOf(selected.stage);
  const nextStage = stages[Math.min(current + 1, stages.length - 1)];

  try {
    await apiCall(`/api/projects/${selected.id}`, 'PUT', { stage: nextStage });
    await fetchProjects();
  } catch (err) {
    console.error("Advance stage failed:", err);
  }
}

async function moveTask(taskId, direction) {
  const project = getSelectedProject();
  if (!project) return;
  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const index = taskStatuses.indexOf(task.status);
  const next = direction === "next" ? index + 1 : index - 1;
  const nextStatus = taskStatuses[Math.max(0, Math.min(taskStatuses.length - 1, next))];

  try {
    await apiCall(`/api/projects/${project.id}/tasks/${taskId}`, 'PUT', { status: nextStatus });
    await fetchProjects();
  } catch (err) {
    console.error("Move task failed:", err);
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

// Init stage options
stages.forEach((stage) => {
  const opt = document.createElement("option");
  opt.value = stage;
  opt.textContent = stage;
  els.projectStage.append(opt);
});

// Events
document.querySelector("#newProjectBtn").addEventListener("click", () => openProjectDialog());
document.querySelector("#editProjectBtn").addEventListener("click", () => openProjectDialog(getSelectedProject()));
document.querySelector("#deleteProjectBtn").addEventListener("click", deleteSelectedProject);

els.confirmForm.addEventListener("submit", async (event) => {
  if (event.submitter?.value === "delete") {
    if (selectedProjectId) {
      try {
        await apiCall(`/api/projects/${selectedProjectId}`, 'DELETE');
        selectedProjectId = "";
        await fetchProjects();
      } catch (err) {
        console.error("Delete project failed:", err);
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

// Member Collaboration Events
document.querySelector("#addMemberForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedProjectId) return;
  const emailInput = document.querySelector("#newMemberEmail");
  const email = emailInput.value.trim();
  try {
    await apiCall(`/api/projects/${selectedProjectId}/members`, 'PUT', { email });
    emailInput.value = "";
    await fetchProjects();
  } catch (err) {
    console.error("Failed to add member:", err);
  }
});

document.querySelector("#projectMembersList").addEventListener("click", async (e) => {
  const removeBtn = e.target.closest(".remove-member-btn");
  if (!removeBtn || !selectedProjectId) return;
  const email = removeBtn.dataset.memberEmail;
  if (confirm(`Remove employee ${email} from this project?`)) {
    try {
      await apiCall(`/api/projects/${selectedProjectId}/members`, 'DELETE', { email });
      await fetchProjects();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  }
});

// Start Authentication lifecycle
initAuth();
