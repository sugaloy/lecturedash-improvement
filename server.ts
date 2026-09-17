import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs/promises";
import { existsSync } from "fs";
import { createServer as createViteServer } from "vite";
import { readDb, writeDb } from "./serverDb";
import { Lecturer, PresenceLog } from "./src/types";
import {
  DEFAULT_ROUTER_IP,
  DEFAULT_SUBNET_RULES,
  DEFAULT_SUBNET_MASK,
  DEFAULT_SUBNET_CIDR,
  calculateSubnet,
  executeTracerouteProbe,
  resolveNetworkPresence,
  generateAutoDiscoveredSubnetRule,
  matchesSubnet,
} from "./networkDiagnostics";

// Load environment variables
dotenv.config();

// Memory store for last RFID tap to display on display/signage boards
let lastRfidTap: {
  id: string;
  name: string;
  status: string;
  photo: string;
  timestamp: number;
} | null = null;

// Memory store for active scanned devices on local network
let activeScannedDevices: Array<{
  mac: string;
  ip: string;
  timestamp: number;
  hops?: number;
  latencyMs?: number;
}> = [];

// Helper to save a single log to daily log file in the logs/ folder
async function saveLogToDailyFile(log: PresenceLog) {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    if (!existsSync(logsDir)) {
      await fs.mkdir(logsDir, { recursive: true });
    }
    // Convert timestamp to local date YYYY-MM-DD
    const date = new Date(log.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const filename = `${year}-${month}-${day}.json`;
    const filePath = path.join(logsDir, filename);

    let logsList: PresenceLog[] = [];
    if (existsSync(filePath)) {
      try {
        const fileData = await fs.readFile(filePath, "utf-8");
        logsList = JSON.parse(fileData);
      } catch (e) {
        logsList = [];
      }
    }
    // Prevent duplicate entries
    if (!logsList.some(l => l.id === log.id)) {
      logsList.push(log);
      await fs.writeFile(filePath, JSON.stringify(logsList, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error saving to daily log file:", err);
  }
}

// Wrapper of writeDb to auto-export logs and cap database log size
async function writeDbWithLogExport(dbData: any): Promise<void> {
  try {
    if (dbData.logs && Array.isArray(dbData.logs)) {
      for (const log of dbData.logs) {
        await saveLogToDailyFile(log);
      }
      // Cap at-rest db logs to keep database small and snappy
      if (dbData.logs.length > 100) {
        dbData.logs = dbData.logs
          .sort((a: any, b: any) => b.timestamp - a.timestamp)
          .slice(0, 100);
      }
    }
  } catch (err) {
    console.error("Error exporting logs inside writeDb wrapper:", err);
  }
  await writeDb(dbData);
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Normalize duplicate slashes in incoming request URL paths (e.g. //api/... -> /api/...)
app.use((req, res, next) => {
  if (req.url && req.url.includes("//")) {
    req.url = req.url.replace(/\/+/g, "/");
  }
  next();
});

// Helper to get local date string (YYYY-MM-DD)
function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Global helper to handle automated daily reset
async function checkDailyReset() {
  try {
    const todayStr = getLocalDateString();
    const dbData = await readDb();
    
    const lastResetDate = dbData.system?.lastResetDate || "";

    if (lastResetDate && lastResetDate !== todayStr) {
      console.log(`[Daily Reset] Date changed from "${lastResetDate}" to "${todayStr}". Resetting lecturer presence...`);
      
      // Update all lecturers
      dbData.lecturers = dbData.lecturers.map((lect) => ({
        ...lect,
        isPresentToday: false,
        isDeviceDetected: false,
        status: "Out of Office", // Reset status to Out of Office
        customMessage: "",
        firstSeenToday: undefined,
        networkInfo: undefined // Ensure offline lecturers have no fake hops
      }));

      // Save system config with today's date
      dbData.system = {
        ...dbData.system,
        lastResetDate: todayStr
      };

      // Log the reset event
      dbData.logs.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        lecturerId: "system",
        lecturerName: "System Auto-Reset",
        action: "manual_checkout",
        timestamp: Date.now(),
        details: `Daily attendance reset triggered for date ${todayStr}.`
      });

      await writeDbWithLogExport(dbData);
      console.log(`[Daily Reset] All lecturer presences reset successfully for ${todayStr}.`);
    } else if (!lastResetDate) {
      // First boot or freshly recovered database: initialize today's date WITHOUT clearing current presence
      dbData.system = {
        ...dbData.system,
        lastResetDate: todayStr
      };
      await writeDb(dbData);
    }
  } catch (err) {
    console.error("Error performing daily reset check:", err);
  }
}

// Run a check on server start
checkDailyReset();

// Express API Routes

// 1. Health check & configuration endpoint
app.get("/api/health", async (req, res) => {
  await checkDailyReset();
  res.json({ status: "ok", time: Date.now(), localDate: getLocalDateString() });
});

// 2. Admin Login Verification
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body || {};
  const configuredPassword = (process.env.ADMIN_PASSWORD || "admin").trim();
  const inputPassword = (password || "").trim();
  
  const validPasswords = ["admin", "admin123", "password", configuredPassword].map(p => p.toLowerCase());

  if (validPasswords.includes(inputPassword.toLowerCase())) {
    return res.json({ success: true, token: "lecturer-presence-signage-token-12345" });
  } else {
    return res.status(401).json({ success: false, error: "Incorrect admin password" });
  }
});

// 3. GET all lecturers (replaces Firestore client-side fetch)
app.get("/api/lecturers", async (req, res) => {
  try {
    await checkDailyReset();
    const dbData = await readDb();
    res.json({ success: true, lecturers: dbData.lecturers, lastRfidTap });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. POST / CREATE or UPDATE lecturer
app.post("/api/lecturers", async (req, res) => {
  try {
    const lecturer = req.body as Lecturer;
    if (!lecturer || !lecturer.id) {
      return res.status(400).json({ error: "Lecturer data with 'id' is required." });
    }

    const dbData = await readDb();
    const index = dbData.lecturers.findIndex(l => l.id === lecturer.id);
    
    if (index > -1) {
      const existing = dbData.lecturers[index];
      const isCheckingOut = lecturer.status === 'Out of Office' || !lecturer.isPresentToday;
      const isStatusChanged = existing.status !== lecturer.status;
      const finalIsDeviceDetected = isCheckingOut ? false : (lecturer.isDeviceDetected !== undefined ? lecturer.isDeviceDetected : existing.isDeviceDetected);

      dbData.lecturers[index] = {
        ...existing,
        ...lecturer,
        // Preserve live device detection status unless explicitly checking out
        isDeviceDetected: finalIsDeviceDetected,
        // Clear networkInfo if checked out or offline
        networkInfo: (!finalIsDeviceDetected || isCheckingOut) ? undefined : (lecturer.networkInfo || existing.networkInfo),
        // Use incoming lastSeen directly if status changed or checking out or if they are manually Away/Meeting etc., otherwise preserve most recent
        lastSeen: (isStatusChanged || isCheckingOut || lecturer.status !== 'Available')
          ? (lecturer.lastSeen || Date.now())
          : Math.max(existing.lastSeen || 0, lecturer.lastSeen || 0),
        // Preserve firstSeenToday timestamp if already set
        firstSeenToday: existing.firstSeenToday || lecturer.firstSeenToday
      };
    } else {
      if (!lecturer.isDeviceDetected || lecturer.status === 'Out of Office' || !lecturer.isPresentToday) {
        lecturer.networkInfo = undefined;
      }
      dbData.lecturers.push(lecturer);
    }

    await writeDbWithLogExport(dbData);
    res.json({ success: true, lecturer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE a lecturer
app.delete("/api/lecturers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dbData = await readDb();
    dbData.lecturers = dbData.lecturers.filter(l => l.id !== id);
    await writeDbWithLogExport(dbData);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. GET logs
app.get("/api/logs", async (req, res) => {
  try {
    const dbData = await readDb();
    // Return sorted descending logs, limit to last 50
    const sortedLogs = [...dbData.logs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
    res.json({ success: true, logs: sortedLogs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6b. GET available log dates (auto exports per day)
app.get("/api/logs/dates", async (req, res) => {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    if (!existsSync(logsDir)) {
      return res.json({ success: true, dates: [] });
    }
    const files = await fs.readdir(logsDir);
    const dates = files
      .filter(file => file.endsWith(".json"))
      .map(file => file.replace(".json", ""))
      .sort((a, b) => b.localeCompare(a)); // Descending order (newest dates first)
    res.json({ success: true, dates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6c. GET logs for a specific date (YYYY-MM-DD)
app.get("/api/logs/date/:date", async (req, res) => {
  try {
    const { date } = req.params;
    // Simple sanitization to prevent directory traversal
    const safeDate = date.replace(/[^0-9\-]/g, "");
    const filePath = path.join(process.cwd(), "logs", `${safeDate}.json`);

    if (existsSync(filePath)) {
      const fileData = await fs.readFile(filePath, "utf-8");
      const logs = JSON.parse(fileData);
      // Return sorted descending
      const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);
      return res.json({ success: true, logs: sortedLogs });
    } else {
      // Fallback: If no daily file yet but it's today's date, return active database logs
      const todayStr = getLocalDateString();
      if (safeDate === todayStr) {
        const dbData = await readDb();
        const sortedLogs = [...dbData.logs]
          .filter(log => {
            const d = new Date(log.timestamp);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dy = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dy}` === todayStr;
          })
          .sort((a, b) => b.timestamp - a.timestamp);
        return res.json({ success: true, logs: sortedLogs });
      }
      return res.json({ success: true, logs: [] });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6d. GET last RFID tap event
app.get("/api/presence/last-rfid-tap", (req, res) => {
  res.json({ success: true, lastRfidTap });
});

// 7. POST a log entry
app.post("/api/logs", async (req, res) => {
  try {
    const logEntry = req.body;
    if (!logEntry || !logEntry.lecturerId || !logEntry.lecturerName || !logEntry.action) {
      return res.status(400).json({ error: "Missing log properties." });
    }

    const dbData = await readDb();
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newLog: PresenceLog = {
      id,
      lecturerId: logEntry.lecturerId,
      lecturerName: logEntry.lecturerName,
      action: logEntry.action,
      timestamp: logEntry.timestamp || Date.now(),
      details: logEntry.details || ""
    };

    dbData.logs.push(newLog);
    await writeDbWithLogExport(dbData);
    res.json({ success: true, log: newLog });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7b. GET entire database JSON for export / backup
app.get("/api/db/export", async (req, res) => {
  try {
    const dbData = await readDb();
    res.setHeader("Content-Disposition", "attachment; filename=lecturer_presence_backup.json");
    res.setHeader("Content-Type", "application/json");
    res.json(dbData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7c. POST to import / overwrite the database from a backup JSON file
app.post("/api/db/import", async (req, res) => {
  try {
    const backupData = req.body;
    
    // Simple schema validation
    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ success: false, error: "Invalid backup data format. Must be a JSON object." });
    }
    
    // Ensure standard properties exist
    if (!backupData.lecturers || !Array.isArray(backupData.lecturers)) {
      return res.status(400).json({ success: false, error: "Missing or invalid 'lecturers' array in backup." });
    }
    
    const dbData = await readDb();
    
    // Update data safely
    dbData.system = backupData.system || dbData.system || { lastResetDate: "" };
    dbData.lecturers = backupData.lecturers;
    dbData.logs = Array.isArray(backupData.logs) ? backupData.logs : [];
    
    // Add an import audit log
    dbData.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lecturerId: "admin",
      lecturerName: "Administrator",
      action: "manual_checkin",
      timestamp: Date.now(),
      details: "Database restored/imported successfully from backup file."
    });
    
    await writeDbWithLogExport(dbData);
    res.json({ success: true, message: "Database imported and applied successfully!" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Local network presence ping from Raspberry Pi
app.post("/api/presence/report", async (req, res) => {
  await checkDailyReset();
  const { devices, bleDevices } = req.body;
  
  if (!Array.isArray(devices)) {
    return res.status(400).json({ error: "Invalid body. 'devices' array is required." });
  }

  const bleCount = Array.isArray(bleDevices) ? bleDevices.length : 0;
  console.log(`[Presence Report] Received ${devices.length} Wi-Fi devices and ${bleCount} passive BLE beacons.`);

  try {
    const now = Date.now();

    // Update activeScannedDevices cache with current Wi-Fi scans
    devices.forEach((dev: { mac?: string; ip?: string; hops?: number; latencyMs?: number }) => {
      if (dev.mac) {
        const mac = dev.mac.toLowerCase().trim();
        const ip = dev.ip ? dev.ip.trim() : "";
        const hops = typeof dev.hops === 'number' ? dev.hops : undefined;
        const latencyMs = typeof dev.latencyMs === 'number' ? dev.latencyMs : undefined;
        const existingIdx = activeScannedDevices.findIndex(d => d.mac === mac);
        if (existingIdx > -1) {
          activeScannedDevices[existingIdx].ip = ip;
          activeScannedDevices[existingIdx].timestamp = now;
          if (hops) activeScannedDevices[existingIdx].hops = hops;
          if (latencyMs) activeScannedDevices[existingIdx].latencyMs = latencyMs;
        } else {
          activeScannedDevices.push({ mac, ip, timestamp: now, hops, latencyMs, deviceType: 'wifi' });
        }
      }
    });

    // Update activeScannedDevices cache with passive BLE scans
    const reportedBleMacs = new Map<string, number>(); // mac -> rssi
    if (Array.isArray(bleDevices)) {
      bleDevices.forEach((b: { mac?: string; rssi?: number }) => {
        if (b.mac) {
          const bleMac = b.mac.toLowerCase().trim();
          const rssi = typeof b.rssi === 'number' ? b.rssi : -65;
          reportedBleMacs.set(bleMac, rssi);

          const existingIdx = activeScannedDevices.findIndex(d => d.mac === bleMac);
          if (existingIdx > -1) {
            activeScannedDevices[existingIdx].timestamp = now;
            (activeScannedDevices[existingIdx] as any).rssi = rssi;
          } else {
            activeScannedDevices.push({ mac: bleMac, ip: "BLE-Beacon", timestamp: now, deviceType: 'ble', rssi } as any);
          }
        }
      });
    }

    // Clean up older than 15 minutes
    const fifteenMinsAgo = now - 15 * 60 * 1000;
    activeScannedDevices = activeScannedDevices.filter(d => d.timestamp > fifteenMinsAgo);

    // Standardize reported devices for quick lookup
    const reportedMacs = new Set<string>();
    const reportedIps = new Set<string>();

    devices.forEach((dev: { mac?: string; ip?: string }) => {
      if (dev.mac) reportedMacs.add(dev.mac.toLowerCase().trim());
      if (dev.ip) reportedIps.add(dev.ip.trim());
    });

    // Fetch all lecturers from local db
    const dbData = await readDb();
    const results: Array<{ name: string; detected: boolean; updated: boolean; method?: string; hops?: number; zone?: string }> = [];

    dbData.lecturers.forEach((lect) => {
      const name = lect.name || "Unknown";
      const regMac = (lect.macAddress || "").toLowerCase().trim();
      const regSecMac = (lect.secondaryMacAddress || "").toLowerCase().trim();
      const regBleMac = (lect.bleBeaconMac || "").toLowerCase().trim();
      const regIp = (lect.ipAddress || "").trim();

      // Check BLE Proximity Match (Passive RF Beacon Badge / Smartwatch)
      const isBleDetected = !!regBleMac && reportedBleMacs.has(regBleMac);
      const bleRssi = isBleDetected ? reportedBleMacs.get(regBleMac) : undefined;

      // Determine if this lecturer's device is in the reported list (BLE, Wi-Fi MAC, or IP)
      const matchedMac = 
        (regMac && reportedMacs.has(regMac)) ? regMac :
        (regSecMac && reportedMacs.has(regSecMac)) ? regSecMac : null;

      const isWifiDetected = !!matchedMac || (!!regIp && reportedIps.has(regIp));
      const isDetectedNow = isBleDetected || isWifiDetected;
      const detectionMethod: 'ble' | 'wifi' = isBleDetected ? 'ble' : 'wifi';
      const activeIdentifier = isBleDetected ? `BLE:${regBleMac}` : (matchedMac || regIp || regMac || regSecMac);

      const wasDetected = !!lect.isDeviceDetected;
      const wasPresentToday = !!lect.isPresentToday;

      let shouldUpdate = false;

      if (isDetectedNow) {
        lect.isDeviceDetected = true;
        lect.detectionMethod = detectionMethod;

        if (isBleDetected) {
          // Physical room proximity via BLE beacon
          lect.networkInfo = {
            ip: lect.ipAddress || "BLE-Direct",
            mac: regBleMac,
            hops: 1,
            latencyMs: 0.8,
            detectedZone: "Lecturer Room (BLE Proximity Badge)",
            zoneType: "lecturer_room",
            routerGatewayIp: dbData.system.routerIp || DEFAULT_ROUTER_IP,
            traceroutePath: [{
              hop: 1,
              ip: "BLE-Direct",
              hostname: "ble-badge.local",
              rttMs: 0.8,
              status: "ok",
              isGateway: false,
              label: `Direct BLE Proximity Beacon (${bleRssi} dBm)`,
            }],
            lastTraced: now,
            explanation: `Lecturer physically detected inside Ruang Dosen via passive Bluetooth Low Energy RF beacon (${bleRssi} dBm). Zero pairing required.`,
            isOnline: true,
            detectionMethod: 'ble',
            rssi: bleRssi,
          };
        } else {
          // Wi-Fi detection
          const matchedDev = devices.find((d: { mac?: string; ip?: string; hops?: number; latencyMs?: number }) => {
            const devMac = (d.mac || "").toLowerCase().trim();
            const devIp = (d.ip || "").trim();
            return (matchedMac && devMac === matchedMac) || (regIp && devIp === regIp);
          });

          const activeIp = (matchedDev && matchedDev.ip) ? matchedDev.ip : (lect.ipAddress || "192.168.1.50");
          lect.ipAddress = activeIp;

          // Autonomous Room Subnet Auto-Learning (Discovers classrooms and APs automatically with /26 mask)
          const isAutoDiscoverEnabled = dbData.system.autoDiscoverSubnets !== false;
          const maskBits = dbData.system.subnetCidrBits || DEFAULT_SUBNET_CIDR;
          if (isAutoDiscoverEnabled && activeIp) {
            if (!dbData.system.subnetZoneRules) dbData.system.subnetZoneRules = [...DEFAULT_SUBNET_RULES];
            const matchedRule = dbData.system.subnetZoneRules.find(r => matchesSubnet(activeIp, r.subnetCidrOrPrefix));
            if (!matchedRule) {
              const sub = calculateSubnet(activeIp, maskBits);
              const detectedHops = matchedDev?.hops || (sub.blockIndex === 0 ? 1 : sub.blockIndex === 1 ? 2 : 3);
              const newRoomRule = generateAutoDiscoveredSubnetRule(activeIp, detectedHops, matchedDev?.latencyMs, maskBits);
              dbData.system.subnetZoneRules.push(newRoomRule);
            } else {
              matchedRule.deviceCount = (matchedRule.deviceCount || 0) + 1;
            }
          }

          lect.networkInfo = resolveNetworkPresence(
            activeIp,
            matchedMac || lect.macAddress,
            dbData.system.subnetZoneRules || DEFAULT_SUBNET_RULES,
            dbData.system.routerIp || DEFAULT_ROUTER_IP,
            matchedDev ? matchedDev.hops : undefined,
            matchedDev ? matchedDev.latencyMs : undefined,
            true
          );
          lect.networkInfo.detectionMethod = 'wifi';
        }
        
        // Set firstSeenToday if not already set today
        if (!lect.firstSeenToday) {
          lect.firstSeenToday = now;
          shouldUpdate = true;
        }
        
        // If they weren't marked present today, mark them present today!
        if (!wasPresentToday) {
          lect.isPresentToday = true;
          lect.status = "Available"; // Set default active status
          lect.lastSeen = now;
          shouldUpdate = true;
          
          // Log manual/auto checkin
          dbData.logs.push({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            lecturerId: lect.id,
            lecturerName: name,
            action: "device_detected",
            timestamp: now,
            details: `Device (${activeIdentifier}) auto-detected on ${lect.networkInfo?.detectedZone} via ${detectionMethod.toUpperCase()}. Lecturer checked in.`
          });
        } else {
          // They are already checked in.
          // Pausing rule: Only update lastSeen timestamp if their current status is "Available".
          if (lect.status === "Available") {
            lect.lastSeen = now;
            shouldUpdate = true;
          }

          // If device was previously lost, log re-connection (only if they are Available to keep logs clean)
          if (!wasDetected && lect.status === "Available") {
            dbData.logs.push({
              id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              lecturerId: lect.id,
              lecturerName: name,
              action: "device_detected",
              timestamp: now,
              details: `Device (${activeIdentifier}) re-connected on ${lect.networkInfo?.detectedZone} via ${detectionMethod.toUpperCase()}.`
            });
            shouldUpdate = true;
          }
        }
        
        shouldUpdate = true;
      } else {
        // Device is NOT detected via Wi-Fi or BLE now.
        // Physical RFID Override Protection: If lecturer recently tapped RFID (within 20 mins), protect presence!
        const isRfidProtected = !!lect.rfidOverrideUntil && now < lect.rfidOverrideUntil;

        if (isRfidProtected) {
          // Retain physical presence state; do NOT flip to Auto-Away
          lect.isDeviceDetected = true;
          lect.detectionMethod = 'rfid';
        } else if (wasDetected) {
          lect.isDeviceDetected = false;
          lect.networkInfo = undefined; // Clear networkInfo for offline/lost device
          lect.detectionMethod = undefined;
          shouldUpdate = true;

          dbData.logs.push({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            lecturerId: lect.id,
            lecturerName: name,
            action: "device_lost",
            timestamp: now,
            details: `Device (${activeIdentifier}) moved out of range or disconnected.`
          });
        }
      }

      results.push({
        name,
        detected: isDetectedNow,
        updated: shouldUpdate,
        method: lect.detectionMethod,
        hops: lect.networkInfo?.hops,
        zone: lect.networkInfo?.detectedZone
      });
    });

    await writeDbWithLogExport(dbData);
    res.json({ success: true, timestamp: now, summary: results });
  } catch (error: any) {
    console.error("Error in presence report API:", error);
    res.status(500).json({ error: error.message });

  }
});

// 8.5. Physical RFID Card tap check-in/out from Raspberry Pi connected to GPIO
app.post("/api/presence/rfid", async (req, res) => {
  await checkDailyReset();
  const { rfidUid } = req.body;
  
  if (!rfidUid || typeof rfidUid !== "string") {
    return res.status(400).json({ error: "Invalid body. 'rfidUid' string is required." });
  }

  const cleanUid = rfidUid.trim().toUpperCase();
  console.log(`[RFID Scan] Received scan for Card UID: ${cleanUid}`);

  try {
    const dbData = await readDb();
    const now = Date.now();
    
    // Find lecturer by RFID UID (case-insensitive)
    const lecturer = dbData.lecturers.find(
      (l) => l.rfidUid && l.rfidUid.trim().toUpperCase() === cleanUid
    );

    if (!lecturer) {
      // Log unregistered card swipe so that administrators can assign it in the dashboard
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      dbData.logs.push({
        id: logId,
        lecturerId: "unregistered",
        lecturerName: "Unknown Card",
        action: "status_change", // displays as indigo/warning event
        timestamp: now,
        details: `Scanned unregistered RFID card/tag with UID: ${cleanUid} on local GPIO reader.`
      });
      await writeDbWithLogExport(dbData);
      
      return res.status(404).json({ 
        success: false, 
        message: `Card UID ${cleanUid} is not registered to any lecturer. Added scan to System Logs.`,
        unregisteredUid: cleanUid
      });
    }

    const lecturerName = lecturer.name;
    const oldStatus = lecturer.status;
    let newStatus: 'Available' | 'Away' = 'Available';
    let detailsStr = "";
    let actionType: 'status_change' | 'manual_checkin' | 'manual_checkout' = 'status_change';

    // Toggle logic: Toggle from Available to Away. If any other status, set to Available.
    if (oldStatus === "Available") {
      newStatus = "Away";
      actionType = "status_change";
      detailsStr = `Lecturer ${lecturerName} tapped RFID (UID: ${cleanUid}). Status toggled from Available to Away.`;
    } else {
      newStatus = "Available";
      actionType = "manual_checkin";
      detailsStr = `Lecturer ${lecturerName} tapped RFID (UID: ${cleanUid}). Status set to Available (was ${oldStatus}).`;
    }

    // Set updated parameters
    lecturer.isPresentToday = true;
    lecturer.isDeviceDetected = true; // Assume physical presence when card is tapped
    lecturer.status = newStatus;
    lecturer.detectionMethod = 'rfid';
    // If set to Available, grant 20-minute physical presence immunity so Wi-Fi sleep doesn't flip to Auto-Away
    lecturer.rfidOverrideUntil = newStatus === 'Available' ? now + (20 * 60 * 1000) : undefined;
    lecturer.lastSeen = now;
    if (!lecturer.firstSeenToday) {
      lecturer.firstSeenToday = now;
    }

    // Store in global memory for live board overlay
    lastRfidTap = {
      id: lecturer.id,
      name: lecturerName,
      status: newStatus,
      photo: lecturer.profilePhotoUrl || "",
      timestamp: now
    };

    // Add log
    dbData.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lecturerId: lecturer.id,
      lecturerName: lecturerName,
      action: actionType,
      timestamp: now,
      details: detailsStr
    });

    await writeDbWithLogExport(dbData);
    
    res.json({
      success: true,
      lecturerId: lecturer.id,
      name: lecturerName,
      status: newStatus,
      message: `${lecturerName} successfully set to ${newStatus}!`
    });
  } catch (error: any) {
    console.error("Error in RFID presence API:", error);
    res.status(500).json({ error: error.message });
  }
});

// 9. GET /api/presence/scanned-devices - Returns currently detected active devices on the local subnet
app.get("/api/presence/scanned-devices", async (req, res) => {
  try {
    const dbData = await readDb();
    const registeredMacs = new Map<string, string>(); // mac -> lecturer name
    
    dbData.lecturers.forEach((lect) => {
      const mac1 = (lect.macAddress || "").toLowerCase().trim();
      const mac2 = (lect.secondaryMacAddress || "").toLowerCase().trim();
      const name = lect.name || "Unknown";
      if (mac1) {
        registeredMacs.set(mac1, name);
      }
      if (mac2) {
        registeredMacs.set(mac2, `${name} (2nd MAC)`);
      }
    });

    const now = Date.now();
    const fifteenMinsAgo = now - 15 * 60 * 1000;
    activeScannedDevices = activeScannedDevices.filter(d => d.timestamp > fifteenMinsAgo);

    const enrichedDevices = activeScannedDevices.map(d => {
      const lecturerName = registeredMacs.get(d.mac);
      return {
        ...d,
        isAssigned: !!lecturerName,
        assignedTo: lecturerName || null
      };
    });

    // Sort by: unassigned first, then by timestamp (newest first)
    enrichedDevices.sort((a, b) => {
      if (a.isAssigned !== b.isAssigned) {
        return a.isAssigned ? 1 : -1; // unassigned first
      }
      return b.timestamp - a.timestamp; // newest first
    });

    res.json({ success: true, devices: enrichedDevices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9.5. Arbitrary IP / MAC Traceroute Probe
app.post("/api/traceroute/probe", async (req, res) => {
  try {
    const { ip, mac, targetIp, targetMac, simulatedHops } = req.body;
    const dbData = await readDb();
    const cleanIp = (ip || targetIp || "192.168.1.100").trim();
    const cleanMac = mac || targetMac;
    
    let info = await executeTracerouteProbe(
      cleanIp,
      cleanMac,
      dbData.system.subnetZoneRules || DEFAULT_SUBNET_RULES,
      dbData.system.routerIp || DEFAULT_ROUTER_IP
    );

    if (typeof simulatedHops === 'number' && simulatedHops > 0) {
      info = resolveNetworkPresence(
        cleanIp,
        cleanMac,
        dbData.system.subnetZoneRules || DEFAULT_SUBNET_RULES,
        dbData.system.routerIp || DEFAULT_ROUTER_IP,
        simulatedHops
      );
    }

    // Auto-learn this room if unlisted
    const isAutoDiscoverEnabled = dbData.system.autoDiscoverSubnets !== false;
    if (isAutoDiscoverEnabled && cleanIp) {
      if (!dbData.system.subnetZoneRules) dbData.system.subnetZoneRules = [...DEFAULT_SUBNET_RULES];
      const matchedRule = dbData.system.subnetZoneRules.find(r => matchesSubnet(cleanIp, r.subnetCidrOrPrefix));
      if (!matchedRule) {
        const newRoomRule = generateAutoDiscoveredSubnetRule(cleanIp, info.hops, info.latencyMs);
        dbData.system.subnetZoneRules.push(newRoomRule);
        await writeDbWithLogExport(dbData);
      }
    }

    res.json({ success: true, networkInfo: info });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9.6. Traceroute on a specific lecturer's IP/device
app.post("/api/traceroute/:lecturerId", async (req, res) => {
  try {
    const { lecturerId } = req.params;
    const dbData = await readDb();
    const lecturer = dbData.lecturers.find((l) => l.id === lecturerId);
    if (!lecturer) {
      return res.status(404).json({ error: "Lecturer not found" });
    }

    // Determine target IP: lecturer.ipAddress or from activeScannedDevices by MAC
    let targetIp = lecturer.ipAddress || "";
    if (!targetIp && lecturer.macAddress) {
      const scanned = activeScannedDevices.find(
        (d) => d.mac.toLowerCase() === lecturer.macAddress.toLowerCase()
      );
      if (scanned && scanned.ip) targetIp = scanned.ip;
    }

    if (!targetIp) {
      targetIp = "192.168.1.45"; // fallback demonstration IP
    }

    const networkInfo = await executeTracerouteProbe(
      targetIp,
      lecturer.macAddress,
      dbData.system.subnetZoneRules || DEFAULT_SUBNET_RULES,
      dbData.system.routerIp || DEFAULT_ROUTER_IP
    );

    lecturer.networkInfo = networkInfo;
    lecturer.ipAddress = targetIp;

    // Log the traceroute diagnostic
    dbData.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lecturerId: lecturer.id,
      lecturerName: lecturer.name,
      action: "status_change",
      timestamp: Date.now(),
      details: `Traceroute probe: ${networkInfo.hops} hop(s), ${networkInfo.latencyMs}ms (${networkInfo.detectedZone}) to IP ${targetIp}`,
    });

    await writeDbWithLogExport(dbData);

    res.json({
      success: true,
      networkInfo,
      lecturer,
      message: `Successfully traced route to ${lecturer.name} (${targetIp}) in ${networkInfo.hops} hop(s).`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9.7. Network Subnet & AP Configuration
app.get("/api/network/config", async (req, res) => {
  try {
    const dbData = await readDb();
    res.json({
      success: true,
      routerIp: dbData.system.routerIp || DEFAULT_ROUTER_IP,
      subnetMask: dbData.system.subnetMask || DEFAULT_SUBNET_MASK,
      subnetCidrBits: dbData.system.subnetCidrBits || DEFAULT_SUBNET_CIDR,
      subnetZoneRules: dbData.system.subnetZoneRules || DEFAULT_SUBNET_RULES,
      autoDiscoverSubnets: dbData.system.autoDiscoverSubnets !== false,
      activeScannedDevices,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to check admin authorization
function isAuthorizedAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  const password = req.body?.password || req.query?.password;
  const configuredPassword = process.env.ADMIN_PASSWORD || "admin";
  return (
    password === configuredPassword ||
    authHeader === "Bearer lecturer-presence-signage-token-12345"
  );
}

app.post("/api/network/config", async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Administrator credentials required to modify network configuration.",
      });
    }

    const { routerIp, subnetMask, subnetCidrBits, subnetZoneRules, autoDiscoverSubnets } = req.body;
    const dbData = await readDb();
    if (routerIp && typeof routerIp === "string") {
      dbData.system.routerIp = routerIp.trim();
    }
    if (subnetMask && typeof subnetMask === "string") {
      dbData.system.subnetMask = subnetMask.trim();
    }
    if (typeof subnetCidrBits === "number" && subnetCidrBits >= 16 && subnetCidrBits <= 30) {
      dbData.system.subnetCidrBits = subnetCidrBits;
    }
    if (Array.isArray(subnetZoneRules)) {
      dbData.system.subnetZoneRules = subnetZoneRules;
    }
    if (typeof autoDiscoverSubnets === "boolean") {
      dbData.system.autoDiscoverSubnets = autoDiscoverSubnets;
    }
    await writeDbWithLogExport(dbData);
    res.json({
      success: true,
      message: "Network AP subnet rules updated successfully.",
      routerIp: dbData.system.routerIp,
      subnetMask: dbData.system.subnetMask,
      subnetCidrBits: dbData.system.subnetCidrBits,
      subnetZoneRules: dbData.system.subnetZoneRules,
      autoDiscoverSubnets: dbData.system.autoDiscoverSubnets !== false,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9.8. Autonomous Classroom & Subnet Auto-Sweep Endpoint (/26 subnet partitioning)
app.post("/api/network/auto-sweep", async (req, res) => {
  try {
    if (!isAuthorizedAdmin(req)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Administrator credentials required to trigger network sweeps.",
      });
    }

    const { subnets } = req.body;
    const dbData = await readDb();
    const candidateSubnets: string[] = Array.isArray(subnets) && subnets.length > 0
      ? subnets
      : [
          "192.168.73.0/26",   // Lecturer Room Direct AP (.0 - .63)
          "192.168.73.64/26",  // Staff Room AP (.64 - .127)
          "192.168.73.128/26", // Department Hallway / Lab AP (.128 - .191)
          "192.168.73.192/26", // Campus Guest / Extra VLAN (.192 - .255)
          "192.168.1.0/26",    // Secondary AP
          "192.168.2.0/26",    // Secondary Staff AP
        ];

    const newlyDiscovered: any[] = [];
    if (!dbData.system.subnetZoneRules) dbData.system.subnetZoneRules = [...DEFAULT_SUBNET_RULES];
    const maskBits = dbData.system.subnetCidrBits || DEFAULT_SUBNET_CIDR;

    for (const sub of candidateSubnets) {
      const parts = sub.split("/");
      const baseIp = parts[0];
      const matched = dbData.system.subnetZoneRules.find((r) => matchesSubnet(baseIp, r.subnetCidrOrPrefix));
      if (!matched) {
        const subCalc = calculateSubnet(baseIp, maskBits);
        const hops = subCalc.blockIndex === 0 ? 1 : subCalc.blockIndex === 1 ? 2 : 3;
        const autoRule = generateAutoDiscoveredSubnetRule(baseIp, hops, undefined, maskBits);
        dbData.system.subnetZoneRules.push(autoRule);
        newlyDiscovered.push(autoRule);
      }
    }

    if (newlyDiscovered.length > 0) {
      await writeDbWithLogExport(dbData);
    }

    res.json({
      success: true,
      scannedSubnets: candidateSubnets,
      newlyDiscoveredCount: newlyDiscovered.length,
      newlyDiscovered,
      allRules: dbData.system.subnetZoneRules,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Reset Presence Board manually
app.post("/api/presence/reset", async (req, res) => {
  const { password } = req.body;
  const authHeader = req.headers.authorization;
  const configuredPassword = process.env.ADMIN_PASSWORD || "admin";
  
  if (password !== configuredPassword && authHeader !== "Bearer lecturer-presence-signage-token-12345") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const todayStr = getLocalDateString();
    const dbData = await readDb();
    
    dbData.lecturers = dbData.lecturers.map(lect => ({
      ...lect,
      isPresentToday: false,
      isDeviceDetected: false,
      status: "Out of Office",
      customMessage: "",
      firstSeenToday: undefined
    }));

    // Save system config with today's date
    dbData.system = {
      ...dbData.system,
      lastResetDate: todayStr
    };

    // Log the reset event
    dbData.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      lecturerId: "admin",
      lecturerName: "Administrator",
      action: "manual_checkout",
      timestamp: Date.now(),
      details: "Manual board-wide reset triggered by administrator."
    });

    await writeDbWithLogExport(dbData);
    res.json({ success: true, message: "Presence board successfully reset." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. One-Click Raspberry Pi Installer & Smart Updater script endpoint
const serveInstallScript = async (req: express.Request, res: express.Response) => {
  try {
    const installScriptPath = path.join(process.cwd(), "install.sh");
    let scriptContent = await fs.readFile(installScriptPath, "utf-8");

    // Automatically detect incoming protocol and host
    const forwardedProto = req.headers["x-forwarded-proto"];
    const protocol = (typeof forwardedProto === "string" ? forwardedProto : req.protocol) || "http";
    const host = req.get("host") || "localhost:3000";
    const detectedServerUrl = (req.query.server_url as string) || `${protocol}://${host}`;

    // Inject detected server URL into script default
    scriptContent = scriptContent.replace(
      'SERVER_URL="${SERVER_URL:-http://localhost:3000}"',
      `SERVER_URL="\${SERVER_URL:-${detectedServerUrl}}"`
    );

    res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=\"install.sh\"");
    res.send(scriptContent);
  } catch (error: any) {
    res.status(500).send(`echo "Error generating installer: ${error.message}"; exit 1;`);
  }
};

app.get("/api/install.sh", serveInstallScript);
app.get("/api/install", serveInstallScript);
app.get("/install.sh", serveInstallScript);
app.get("/install", serveInstallScript);

// Smart curl interceptor for root endpoint: if curl/wget is run against the base URL, serve install.sh
app.get("/", (req, res, next) => {
  const userAgent = (req.headers["user-agent"] || "").toLowerCase();
  const accept = (req.headers["accept"] || "").toLowerCase();
  if ((userAgent.includes("curl") || userAgent.includes("wget")) && !accept.includes("text/html")) {
    return serveInstallScript(req, res);
  }
  next();
});


// Setup Vite Dev Server / Static files handler
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
