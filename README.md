# Lecturer Presence Directory & Smart TV Signage

A full-stack presence tracking and digital signage directory designed for academic departments and office hallways. Features real-time status indicators, auto-away detection, live RFID/MAC scanner integration endpoints, and a TV lobby kiosk with smooth staggered page carousel transitions.

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**, **pnpm**, or **bun**

### 2. Installation
Clone your exported repository and install the dependencies:

```bash
# Clone repository
git clone <your-github-repo-url>
cd <repo-name>

# Install dependencies
npm install
```

### 3. Environment Variables
Copy the sample environment file to `.env`:

```bash
cp .env.example .env
```

Key environment variables:
- `PORT`: Dev/production port (defaults to `3000`).
- `ADMIN_PASSWORD`: Custom admin password for the Admin Management Panel (defaults to `admin`).
- `DB_PATH`: Optional custom path to store the local JSON database (defaults to `presence_db.json` in parent or current working directory).

### 4. Running the Development Server
Start the Express backend and Vite client concurrently:

```bash
npm run dev
```

Visit **http://localhost:3000** in your browser.

---

## 🛠️ Production Build

To build the client bundle and bundle the Express server into `dist/`:

```bash
# Build frontend and compile backend
npm run build

# Start production server
npm start
```

---

## 🖥️ Application Modes

1. **Lecturer & Visitor Portal (`/`)**
   - Live availability grid with instant search by name, desk station, or status.
   - Quick PIN check-in / status update popup for lecturers.
   - Real-time desk detector sync (simulated WiFi MAC presence & RFID scans).

2. **Full-Screen TV Signage Mode**
   - High-contrast, glanceable layout for hallway 1080p, 4K, or 1366x768 monitors.
   - Smooth staggered card entry and exit animations (using `motion/react`) under 2 seconds.
   - Configurable auto-rotation carousel, items per page, and vertical fill options.
   - Direct TV URL: append `?signage=true` (or `?mobile=true` for mobile kiosk view).

3. **Admin Panel**
   - Manage lecturer profiles, photos, PINs, RFID cards, and MAC addresses.
   - Built-in RFID scanner & network device simulator for testing check-ins.
   - Database backup, JSON export/restore, and reset logs.
   - TV Signage display preferences configurator.

---

## 📡 API Endpoints

- `GET /api/lecturers` — List all registered lecturers and current status.
- `POST /api/lecturers/:id/status` — Update status and custom message via PIN.
- `POST /api/rfid/tap` — Handle RFID card tap event (from IoT reader).
- `POST /api/scanner/network-sync` — Sync detected MAC addresses from network scanner.
- `POST /api/auth/login` — Authenticate admin session.
- `GET /api/logs` — View audit activity log.
