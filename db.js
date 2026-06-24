const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

let storage = null;
let bucket = null;
const bucketName = process.env.GCS_BUCKET_NAME;

// Check if we can use Google Cloud Storage
if (bucketName) {
  try {
    const { Storage } = require('@google-cloud/storage');
    // The library automatically picks up GOOGLE_APPLICATION_CREDENTIALS from env
    storage = new Storage();
    bucket = storage.bucket(bucketName);
    console.log(`[Storage] Configured to use Google Cloud Storage bucket: "${bucketName}"`);
  } catch (err) {
    console.warn('[Storage] Failed to initialize Google Cloud Storage client. Falling back to local storage.', err.message);
  }
} else {
  console.log('[Storage] GCS_BUCKET_NAME not set in environment. Using local file storage.');
}

const LOCAL_DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(LOCAL_DATA_DIR)) {
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
}

const LOCAL_FILES = {
  projects: path.join(LOCAL_DATA_DIR, 'projects.json'),
  users: path.join(LOCAL_DATA_DIR, 'users.json')
};

// Seed Data for default setup
const seedProjects = [
  {
    id: "alpha",
    name: "Client Portal Modernization",
    owner: "Aditya Sharma",
    ownerId: "mock-manager-id",
    ownerEmail: "manager@example.com",
    stage: "Development",
    priority: "High",
    due: "2026-06-21",
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
    due: "2026-06-12",
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

const seedUsers = [
  {
    id: "mock-manager-id",
    name: "Aditya Sharma (Manager)",
    email: "manager@example.com",
    picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    role: "Manager"
  },
  {
    id: "mock-employee-id",
    name: "Rahul (Employee)",
    email: "employee@example.com",
    picture: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    role: "Employee"
  }
];

// Helper to read data from cloud or local file
async function readData(fileName, seedData) {
  if (bucket) {
    const file = bucket.file(fileName);
    try {
      const [exists] = await file.exists();
      if (exists) {
        const [content] = await file.download();
        return JSON.parse(content.toString('utf8'));
      } else {
        // Upload seed data on first load if it doesn't exist in bucket
        console.log(`[Storage] ${fileName} not found in GCS. Uploading seed data...`);
        await file.save(JSON.stringify(seedData, null, 2), {
          contentType: 'application/json',
          resumable: false
        });
        return seedData;
      }
    } catch (err) {
      console.error(`[Storage] GCS error reading ${fileName}. Using seed data.`, err.message);
      return seedData;
    }
  } else {
    // Local storage
    const localPath = LOCAL_FILES[fileName.split('.')[0]];
    if (!fs.existsSync(localPath)) {
      fs.writeFileSync(localPath, JSON.stringify(seedData, null, 2), 'utf8');
      return seedData;
    }
    try {
      const content = fs.readFileSync(localPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`[Storage] Local error reading ${fileName}. Using seed data.`, err.message);
      return seedData;
    }
  }
}

// Helper to write data to cloud or local file
async function writeData(fileName, data) {
  if (bucket) {
    const file = bucket.file(fileName);
    try {
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        resumable: false
      });
    } catch (err) {
      console.error(`[Storage] GCS error saving ${fileName}:`, err.message);
      throw err;
    }
  } else {
    // Local storage
    const localPath = LOCAL_FILES[fileName.split('.')[0]];
    try {
      fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[Storage] Local error saving ${fileName}:`, err.message);
      throw err;
    }
  }
}

module.exports = {
  async getProjects() {
    return await readData('projects.json', seedProjects);
  },
  async saveProjects(projects) {
    await writeData('projects.json', projects);
  },
  async getUsers() {
    return await readData('users.json', seedUsers);
  },
  async saveUsers(users) {
    await writeData('users.json', users);
  }
};
