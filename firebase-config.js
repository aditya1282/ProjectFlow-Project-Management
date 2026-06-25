// ============================================================
// Firebase Web SDK Configuration & Hybrid Real/Mock Client
// ============================================================
// Replace the values below with your Firebase project config.
// Find it at: Firebase Console → Project Settings → General → Your Apps
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCkychmlbCm5VgV8cfZCssRpmIh9P9KBNQ",
  authDomain: "projectflow-prject-management.firebaseapp.com",
  projectId: "projectflow-prject-management",
  storageBucket: "projectflow-prject-management.firebasestorage.app",
  messagingSenderId: "58015164824",
  appId: "1:58015164824:web:bcd1ae887efff3fa2ce3ed",
  measurementId: "G-XYQC9P1ZMJ"
};


// Check if the user has replaced the default placeholders with real config
const isFirebaseConfigured = firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "" && 
  !firebaseConfig.apiKey.includes("PASTE_YOUR_API_KEY");

// Export configuration status to window
window.firebaseConfigured = isFirebaseConfigured;

// ------------------------------------------------------------
// Mock Firebase Auth and Firestore Fallback Classes
// ------------------------------------------------------------
class MockAuth {
  constructor() {
    this.listeners = [];
    this.currentUser = JSON.parse(localStorage.getItem('projectflow-mock-user')) || null;
    this.Persistence = { LOCAL: 'local' };
  }

  setPersistence() {
    return Promise.resolve();
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    // Trigger immediately with current user state (async behavior simulation)
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _trigger(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('projectflow-mock-user', JSON.stringify(user));
    } else {
      localStorage.removeItem('projectflow-mock-user');
    }
    this.listeners.forEach(l => l(user));
  }

  async signInWithEmailAndPassword(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem('projectflow-mock-users-db')) || [];
    const user = users.find(u => u.email === cleanEmail);
    if (!user || user.password !== password) {
      throw { code: 'auth/wrong-password', message: 'Invalid email or password.' };
    }
    this._trigger({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`
    });
    return { user: this.currentUser };
  }

  async createUserWithEmailAndPassword(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem('projectflow-mock-users-db')) || [];
    if (users.some(u => u.email === cleanEmail)) {
      throw { code: 'auth/email-already-in-use', message: 'Email address already registered.' };
    }
    const uid = 'mock-uid-' + Math.random().toString(36).substring(2, 11);
    const displayName = cleanEmail.split('@')[0];
    const newUser = { uid, email: cleanEmail, password, displayName };
    users.push(newUser);
    localStorage.setItem('projectflow-mock-users-db', JSON.stringify(users));

    this._trigger({
      uid,
      email: cleanEmail,
      displayName,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`
    });

    const updateProfile = async (profile) => {
      const uDb = JSON.parse(localStorage.getItem('projectflow-mock-users-db')) || [];
      const idx = uDb.findIndex(u => u.uid === uid);
      if (idx !== -1) {
        uDb[idx].displayName = profile.displayName;
        localStorage.setItem('projectflow-mock-users-db', JSON.stringify(uDb));
      }
      if (this.currentUser) {
        this.currentUser.displayName = profile.displayName;
        this.currentUser.photoURL = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.displayName)}`;
        this._trigger(this.currentUser);
      }
    };

    return {
      user: {
        ...this.currentUser,
        updateProfile
      }
    };
  }

  async signInWithPopup(provider) {
    // Simulate interactive popup auth with browser prompts
    const name = prompt("Google Mock Login — Enter display name:");
    if (!name || name.trim() === "") {
      throw { code: 'auth/popup-closed-by-user', message: 'Popup closed by user.' };
    }
    const email = name.trim().toLowerCase().replace(/\s+/g, '.') + "@gmail.com";
    const uid = 'mock-google-' + Math.random().toString(36).substring(2, 11);
    
    this._trigger({
      uid,
      email,
      displayName: name.trim(),
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`
    });
    return { user: this.currentUser };
  }

  async signOut() {
    this._trigger(null);
    return Promise.resolve();
  }
}

class MockDocumentReference {
  constructor(id, collectionRef) {
    this.id = id;
    this.collectionRef = collectionRef;
  }

  async get() {
    const list = this.collectionRef._read();
    const item = list.find(item => item.id === this.id);
    return {
      exists: !!item,
      data: () => item
    };
  }

  async set(data) {
    const list = this.collectionRef._read();
    const index = list.findIndex(item => item.id === this.id);
    const updatedData = { ...list[index], ...data, id: this.id };
    if (index !== -1) {
      list[index] = updatedData;
    } else {
      list.push(updatedData);
    }
    this.collectionRef._write(list);
  }

  async update(data) {
    const list = this.collectionRef._read();
    const index = list.findIndex(item => item.id === this.id);
    if (index !== -1) {
      list[index] = { ...list[index], ...data };
      this.collectionRef._write(list);
    } else {
      throw new Error(`Document with ID ${this.id} not found.`);
    }
  }

  async delete() {
    const list = this.collectionRef._read();
    const filtered = list.filter(item => item.id !== this.id);
    this.collectionRef._write(filtered);
  }
}

class MockCollectionReference {
  constructor(name) {
    this.name = name;
  }

  _read() {
    const raw = localStorage.getItem(`projectflow-mock-fs-${this.name}`);
    if (raw) return JSON.parse(raw);

    // Seed default projects if reading projects and none exist
    if (this.name === 'projects') {
      const seed = [
        {
          id: "alpha",
          name: "Client Portal Modernization",
          owner: "Aditya Sharma",
          ownerId: "mock-manager-id",
          ownerEmail: "manager@example.com",
          stage: "Development",
          priority: "High",
          due: "2026-09-30",
          progress: 62,
          goal: "Ship a cleaner customer portal with secure onboarding, project visibility, and faster support handoffs.",
          tasks: [
            { id: "t1", title: "Finalize account settings screen", status: "In Progress" },
            { id: "t2", title: "Connect audit activity API", status: "Backlog" },
            { id: "t3", title: "Review responsive dashboard QA", status: "Done" }
          ],
          updates: [
            { id: "u1", text: "Sprint review completed. Main risk is API readiness for audit activity.", date: "2026-06-02" },
            { id: "u2", text: "Design handoff accepted with minor spacing fixes.", date: "2026-05-30" }
          ],
          members: ["employee@example.com"]
        },
        {
          id: "beta",
          name: "HR Leave Management",
          owner: "Operations Team",
          ownerId: "mock-manager-id",
          ownerEmail: "manager@example.com",
          stage: "Testing",
          priority: "Medium",
          due: "2026-07-15",
          progress: 78,
          goal: "Track leave requests, approvals, carry-forward rules, and manager notifications from one workflow.",
          tasks: [
            { id: "t4", title: "Regression test approval chain", status: "In Progress" },
            { id: "t5", title: "Prepare UAT feedback notes", status: "Backlog" },
            { id: "t6", title: "Validate holiday calendar import", status: "Done" }
          ],
          updates: [
            { id: "u3", text: "UAT round one finished with four small issues logged.", date: "2026-06-01" }
          ],
          members: []
        }
      ];
      localStorage.setItem(`projectflow-mock-fs-${this.name}`, JSON.stringify(seed));
      return seed;
    }
    return [];
  }

  _write(data) {
    localStorage.setItem(`projectflow-mock-fs-${this.name}`, JSON.stringify(data));
    this._triggerListeners();
  }

  _triggerListeners() {
    const listKey = `projectflow-mock-fs-${this.name}`;
    if (window._mockFsListeners && window._mockFsListeners[this.name]) {
      window._mockFsListeners[this.name].forEach(cb => {
        const data = JSON.parse(localStorage.getItem(listKey)) || [];
        cb(new MockQuerySnapshot(data));
      });
    }
  }

  doc(id) {
    const finalId = id || 'doc-' + Math.random().toString(36).substring(2, 11);
    return new MockDocumentReference(finalId, this);
  }

  async add(data) {
    const id = 'doc-' + Math.random().toString(36).substring(2, 11);
    const docRef = new MockDocumentReference(id, this);
    await docRef.set(data);
    return docRef;
  }

  onSnapshot(callback) {
    if (!window._mockFsListeners) window._mockFsListeners = {};
    if (!window._mockFsListeners[this.name]) window._mockFsListeners[this.name] = [];
    window._mockFsListeners[this.name].push(callback);

    // Initial trigger
    setTimeout(() => {
      const data = this._read();
      callback(new MockQuerySnapshot(data));
    }, 0);

    // Return unsubscribe function
    return () => {
      window._mockFsListeners[this.name] = window._mockFsListeners[this.name].filter(cb => cb !== callback);
    };
  }
}

class MockQuerySnapshot {
  constructor(data) {
    this.docs = data.map(item => new MockQueryDocumentSnapshot(item));
  }
  forEach(callback) {
    this.docs.forEach(callback);
  }
}

class MockQueryDocumentSnapshot {
  constructor(item) {
    this.id = item.id;
    this._item = item;
  }
  data() {
    return this._item;
  }
}

class MockFirestore {
  collection(name) {
    return new MockCollectionReference(name);
  }
}

// ------------------------------------------------------------
// Initialize Real or Mock Firebase Services
// ------------------------------------------------------------
let auth;
let db;

if (isFirebaseConfigured) {
  console.log("%c[Firebase] Real Web SDK configuration loaded successfully.", "color: #22c55e; font-weight: bold;");
  try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (err) {
    console.error("[Firebase] Initialization error. Switching to LocalStorage fallback.", err);
    auth = new MockAuth();
    db = new MockFirestore();
  }
} else {
  console.log("%c[Firebase] Using offline Mock/LocalStorage mode. Fill firebase-config.js to sync with the cloud.", "color: #f97316; font-weight: bold;");
  auth = new MockAuth();
  db = new MockFirestore();
  
  // Inject mock firebase globally
  window.firebase = {
    auth: () => auth,
    firestore: () => db
  };
  window.firebase.auth.GoogleAuthProvider = class {};
}

// Export active auth and db to window
window.auth = auth;
window.db = db;
