const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'projectflow-dev-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(__dirname));

// Google OAuth client initialized if CLIENT_ID is present
let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID) {
  googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  console.log('[Auth] Real Google Sign-In enabled.');
} else {
  console.log('[Auth] GOOGLE_CLIENT_ID not set. Real Google Sign-In requires configuration, using Demo/Mock Sign-In fallback.');
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Helper to generate a unique random ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper to get today's date in YYYY-MM-DD
function today() {
  return new Date().toISOString().slice(0, 10);
}

// --- AUTHENTICATION ENDPOINTS ---

// Get auth configurations (Google Client ID)
app.get('/api/auth/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Google ID token verification and sign-in
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Credential token is required' });

  if (!googleClient) {
    return res.status(503).json({ error: 'Google OAuth not configured on server. Use Mock Sign-In.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    // Register user in storage
    const users = await db.getUsers();
    let user = users.find(u => u.email === email);
    if (!user) {
      user = { id: sub, name, email, picture, role: 'Manager' };
      users.push(user);
      await db.saveUsers(users);
    } else {
      // Update profile picture or name if changed
      user.name = name;
      user.picture = picture;
      await db.saveUsers(users);
    }

    // Sign JWT
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, picture: user.picture }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    console.error('[Auth] Google Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid Google Token' });
  }
});

// Demo/Mock sign-in for local development and testing collaboration
app.post('/api/auth/mock', async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const cleanEmail = email.trim().toLowerCase();
  const userName = name || cleanEmail.split('@')[0];
  const role = cleanEmail.includes('manager') ? 'Manager' : 'Employee';

  const users = await db.getUsers();
  let user = users.find(u => u.email === cleanEmail);
  if (!user) {
    user = {
      id: `mock-${generateId()}`,
      name: `${userName} (${role})`,
      email: cleanEmail,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`,
      role
    };
    users.push(user);
    await db.saveUsers(users);
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, picture: user.picture }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = await db.getUsers();

  if (users.find(u => u.email === cleanEmail)) {
    return res.status(400).json({ error: 'Email is already registered' });
  }

  const role = cleanEmail.includes('manager') ? 'Manager' : 'Employee';
  const user = {
    id: `usr-${generateId()}`,
    name: name.trim(),
    email: cleanEmail,
    password: password, // For database simplicity, stored directly
    picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
    role
  };

  users.push(user);
  await db.saveUsers(users);

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, picture: user.picture }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = await db.getUsers();
  const user = users.find(u => u.email === cleanEmail);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, picture: user.picture }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

// --- PROJECT MANAGEMENT ENDPOINTS ---

// Fetch visible projects (owned or member)
app.get('/api/projects', authenticateToken, async (req, res) => {
  const projects = await db.getProjects();
  const visibleProjects = projects.filter(p => 
    p.ownerId === req.user.id || 
    p.ownerEmail === req.user.email || 
    (p.members && p.members.map(m => m.toLowerCase()).includes(req.user.email.toLowerCase()))
  );
  res.json(visibleProjects);
});

// Create project (Manager/Owner)
app.post('/api/projects', authenticateToken, async (req, res) => {
  const { name, stage, priority, due, progress, goal } = req.body;
  if (!name || !due || !goal) return res.status(400).json({ error: 'Project name, due date, and goal are required' });

  const projects = await db.getProjects();
  const newProject = {
    id: generateId(),
    name: name.trim(),
    owner: req.user.name,
    ownerId: req.user.id,
    ownerEmail: req.user.email,
    stage: stage || 'Planning',
    priority: priority || 'Medium',
    due,
    progress: Number(progress) || 0,
    goal: goal.trim(),
    tasks: [],
    updates: [
      { id: generateId(), text: 'Project created and initialized on backend.', date: today() }
    ],
    members: []
  };

  projects.unshift(newProject);
  await db.saveProjects(projects);
  res.status(201).json(newProject);
});

// Edit project details (Manager-only)
app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, owner, stage, priority, due, progress, goal } = req.body;

  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  // Authorization check: Only project owner (Manager) can edit core project details
  if (project.ownerId !== req.user.id && project.ownerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Only the project Manager (owner) can edit project configuration' });
  }

  projects[index] = {
    ...project,
    name: name ? name.trim() : project.name,
    owner: owner ? owner.trim() : project.owner,
    stage: stage || project.stage,
    priority: priority || project.priority,
    due: due || project.due,
    progress: progress !== undefined ? Number(progress) : project.progress,
    goal: goal ? goal.trim() : project.goal
  };

  await db.saveProjects(projects);
  res.json(projects[index]);
});

// Delete project (Manager-only)
app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  // Authorization check: Only project owner (Manager) can delete it
  if (project.ownerId !== req.user.id && project.ownerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Only the project Manager (owner) can delete this project' });
  }

  const updatedProjects = projects.filter(p => p.id !== id);
  await db.saveProjects(updatedProjects);
  res.json({ success: true, message: 'Project deleted successfully' });
});

// --- MEMBER/COLLABORATION ENDPOINTS ---

// List registered users (to search or pick member emails)
app.get('/api/users', authenticateToken, async (req, res) => {
  const users = await db.getUsers();
  // Map to exclude sensitive attributes if any
  const publicUsers = users.map(u => ({ name: u.name, email: u.email, picture: u.picture }));
  res.json(publicUsers);
});

// Add/modify project members (Manager-only)
app.put('/api/projects/:id/members', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { email } = req.body; // Expect single email to add

  if (!email) return res.status(400).json({ error: 'Employee email is required' });

  const cleanEmail = email.trim().toLowerCase();
  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  // Authorization check: Only project owner (Manager) can invite employees
  if (project.ownerId !== req.user.id && project.ownerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Only the project Manager can invite employees' });
  }

  if (project.ownerEmail.toLowerCase() === cleanEmail) {
    return res.status(400).json({ error: 'Owner is already a manager and cannot be added as an employee' });
  }

  if (!project.members) project.members = [];

  if (project.members.map(m => m.toLowerCase()).includes(cleanEmail)) {
    return res.status(400).json({ error: 'Employee is already assigned to this project' });
  }

  project.members.push(cleanEmail);

  // Add system update logs
  project.updates.unshift({
    id: generateId(),
    text: `Assigned employee "${cleanEmail}" to the project.`,
    date: today()
  });

  await db.saveProjects(projects);
  res.json(project);
});

// Remove project member (Manager-only)
app.delete('/api/projects/:id/members', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Employee email is required' });

  const cleanEmail = email.trim().toLowerCase();
  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  if (project.ownerId !== req.user.id && project.ownerEmail !== req.user.email) {
    return res.status(403).json({ error: 'Only the project Manager can remove employees' });
  }

  project.members = (project.members || []).filter(m => m.toLowerCase() !== cleanEmail);
  project.updates.unshift({
    id: generateId(),
    text: `Removed employee "${cleanEmail}" from the project.`,
    date: today()
  });

  await db.saveProjects(projects);
  res.json(project);
});

// --- TASKS & UPDATES ENDPOINTS (Collaborative) ---

// Add Task (Both Manager and assigned Employees can perform)
app.post('/api/projects/:id/tasks', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!title) return res.status(400).json({ error: 'Task title is required' });

  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  // Authorization check: Owner or member
  const isOwner = project.ownerId === req.user.id || project.ownerEmail === req.user.email;
  const isMember = project.members && project.members.map(m => m.toLowerCase()).includes(req.user.email.toLowerCase());

  if (!isOwner && !isMember) {
    return res.status(403).json({ error: 'You do not have access to manage tasks for this project' });
  }

  const newTask = {
    id: `t-${generateId()}`,
    title: title.trim(),
    status: 'Backlog'
  };

  project.tasks.unshift(newTask);
  project.updates.unshift({
    id: generateId(),
    text: `Task added: "${newTask.title}" (by ${req.user.name})`,
    date: today()
  });

  await db.saveProjects(projects);
  res.status(201).json(project);
});

// Move Task / Update Task status (Both Manager and assigned Employees can perform)
app.put('/api/projects/:id/tasks/:taskId', authenticateToken, async (req, res) => {
  const { id, taskId } = req.params;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Task status is required' });

  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  // Authorization check
  const isOwner = project.ownerId === req.user.id || project.ownerEmail === req.user.email;
  const isMember = project.members && project.members.map(m => m.toLowerCase()).includes(req.user.email.toLowerCase());

  if (!isOwner && !isMember) {
    return res.status(403).json({ error: 'You do not have access to manage tasks for this project' });
  }

  const taskIndex = project.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return res.status(404).json({ error: 'Task not found' });

  const task = project.tasks[taskIndex];
  const oldStatus = task.status;
  task.status = status;

  project.updates.unshift({
    id: generateId(),
    text: `Moved task "${task.title}" from "${oldStatus}" to "${status}" (by ${req.user.name})`,
    date: today()
  });

  await db.saveProjects(projects);
  res.json(project);
});

// Add Project Log Update (Both Manager and assigned Employees can perform)
app.post('/api/projects/:id/updates', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: 'Update text is required' });

  const projects = await db.getProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  const project = projects[index];

  // Authorization check
  const isOwner = project.ownerId === req.user.id || project.ownerEmail === req.user.email;
  const isMember = project.members && project.members.map(m => m.toLowerCase()).includes(req.user.email.toLowerCase());

  if (!isOwner && !isMember) {
    return res.status(403).json({ error: 'You do not have access to post updates for this project' });
  }

  const newUpdate = {
    id: `u-${generateId()}`,
    text: `${text.trim()} (by ${req.user.name})`,
    date: today()
  };

  project.updates.unshift(newUpdate);
  await db.saveProjects(projects);
  res.status(201).json(project);
});

// Listen on server
app.listen(PORT, () => {
  console.log(`[Server] ProjectFlow Server running at http://localhost:${PORT}/`);
});
