import { promises as fs } from "fs";
import path from "path";
import { DbSchema, Lecturer } from "./src/types";
import { DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, DEFAULT_SUBNET_MASK, DEFAULT_SUBNET_CIDR, resolveNetworkPresence } from "./networkDiagnostics";

const DB_FILE = process.env.DB_PATH || path.join(process.cwd(), "presence_db.json");

export const DEFAULT_LECTURERS: Lecturer[] = [
  {
    id: "lecturer_1784259234521",
    name: "Banni Satria Andoko",
    pin: "1234",
    macAddress: "3c:56:6e:99:7c:54",
    ipAddress: "192.168.73.45",
    rfidUid: "8A2BC34D",
    status: "Available",
    customMessage: "",
    isPresentToday: true,
    isDeviceDetected: true,
    lastSeen: Date.now() - 300000,
    networkInfo: resolveNetworkPresence("192.168.73.45", "3c:56:6e:99:7c:54", DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 1, 2.1, true)
  },
  {
    id: "lecturer_1784259256573",
    name: "Ridwan Rismanto, Ph.D",
    pin: "2222",
    macAddress: "00:11:22:33:44:55",
    ipAddress: "192.168.73.112",
    rfidUid: "B2C3D4E5",
    status: "Out of Office",
    customMessage: "",
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: Date.now() - 3600000,
    networkInfo: undefined
  },
  {
    id: "lecturer_1784259278123",
    name: "Usman Nurhasan",
    pin: "3333",
    macAddress: "aa:bb:cc:dd:ee:ff",
    ipAddress: "192.168.73.58",
    rfidUid: "C3D4E5F6",
    status: "Out of Office",
    customMessage: "",
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: Date.now() - 3600000,
    networkInfo: undefined
  },
  {
    id: "lecturer_1784259299456",
    name: "Satrio Binusa Suryadi",
    pin: "4444",
    macAddress: "11:22:33:44:55:66",
    ipAddress: "192.168.73.88",
    rfidUid: "D4E5F678",
    status: "Out of Office",
    customMessage: "",
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: Date.now() - 3600000,
    networkInfo: undefined
  },
  {
    id: "lecturer_1784259312789",
    name: "Galih Putra Riatma, S.ST., M.T.",
    pin: "5555",
    macAddress: "ab:cd:ef:01:23:45",
    ipAddress: "192.168.73.50",
    rfidUid: "E5F6789A",
    status: "Available",
    customMessage: "",
    isPresentToday: true,
    isDeviceDetected: true,
    lastSeen: Date.now() - 300000,
    networkInfo: resolveNetworkPresence("192.168.73.50", "ab:cd:ef:01:23:45", DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 1, 2.0, true)
  },
  {
    id: "lecturer_1784259334012",
    name: "Bagas Satya Dian Nugraha",
    pin: "6666",
    macAddress: "a1:b2:c3:d4:e5:f6",
    ipAddress: "192.168.73.52",
    rfidUid: "F6789AB1",
    status: "Out of Office",
    customMessage: "",
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: Date.now() - 3600000,
    networkInfo: undefined
  },
  {
    id: "lecturer_1784259355345",
    name: "Anugrah Nur Rahmanto",
    pin: "7777",
    macAddress: "99:88:77:66:55:44",
    ipAddress: "192.168.73.77",
    rfidUid: "789AB1C2",
    status: "Out of Office",
    customMessage: "",
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: Date.now() - 3600000,
    networkInfo: undefined
  }
];

let writeQueue = Promise.resolve();
let lastKnownValidDb: DbSchema | null = null;

export async function readDb(): Promise<DbSchema> {
  try {
    let data: string;
    try {
      data = await fs.readFile(DB_FILE, "utf-8");
    } catch (readErr: any) {
      if (readErr.code === 'ENOENT') {
        // DB_FILE does not exist. Check candidate backups before creating defaults!
        const candidateFiles = [
          path.join(process.cwd(), "lecturer_presence_backup.json"),
          path.join(process.cwd(), "db.json"),
          path.join(process.cwd(), "..", "presence_db.json"),
          path.join(process.cwd(), "..", "db.json"),
        ];

        // Also search for any presence_db.backup_*.json in cwd
        try {
          const files = await fs.readdir(process.cwd());
          const backups = files.filter(f => f.startsWith("presence_db.backup_") && f.endsWith(".json")).sort().reverse();
          for (const b of backups) {
            candidateFiles.push(path.join(process.cwd(), b));
          }
        } catch {}

        let restored = false;
        for (const candidate of candidateFiles) {
          try {
            const candidateData = await fs.readFile(candidate, "utf-8");
            const parsedCandidate = JSON.parse(candidateData);
            if (parsedCandidate.lecturers && Array.isArray(parsedCandidate.lecturers) && parsedCandidate.lecturers.length > 0) {
              console.log(`[Database Recovery] Discovered existing database at ${candidate}. Restoring to ${DB_FILE}...`);
              await fs.writeFile(DB_FILE, candidateData, "utf-8");
              await fs.chmod(DB_FILE, 0o666).catch(() => {});
              data = candidateData;
              restored = true;
              break;
            }
          } catch {}
        }

        if (!restored) {
          console.warn(`[Database Init] No existing database found at ${DB_FILE} or candidate paths. Initializing fresh database...`);
          const initialDb: DbSchema = {
            system: {
              lastResetDate: "",
              routerIp: DEFAULT_ROUTER_IP,
              subnetMask: DEFAULT_SUBNET_MASK,
              subnetCidrBits: DEFAULT_SUBNET_CIDR,
              subnetZoneRules: DEFAULT_SUBNET_RULES,
            },
            lecturers: DEFAULT_LECTURERS,
            logs: []
          };
          await writeDb(initialDb);
          lastKnownValidDb = initialDb;
          return initialDb;
        }
      } else {
        throw readErr;
      }
    }

    const parsed = JSON.parse(data!);
    if (!parsed.system) {
      parsed.system = {
        lastResetDate: "",
        routerIp: DEFAULT_ROUTER_IP,
        subnetMask: DEFAULT_SUBNET_MASK,
        subnetCidrBits: DEFAULT_SUBNET_CIDR,
        subnetZoneRules: DEFAULT_SUBNET_RULES,
      };
    } else {
      if (!parsed.system.routerIp) parsed.system.routerIp = DEFAULT_ROUTER_IP;
      if (!parsed.system.subnetMask) parsed.system.subnetMask = DEFAULT_SUBNET_MASK;
      if (!parsed.system.subnetCidrBits) parsed.system.subnetCidrBits = DEFAULT_SUBNET_CIDR;
      if (!parsed.system.subnetZoneRules || !Array.isArray(parsed.system.subnetZoneRules)) {
        parsed.system.subnetZoneRules = DEFAULT_SUBNET_RULES;
      }
    }
    if (!parsed.lecturers || !Array.isArray(parsed.lecturers) || parsed.lecturers.length === 0) {
      if (lastKnownValidDb && lastKnownValidDb.lecturers && lastKnownValidDb.lecturers.length > 0) {
        console.warn("[Database Safety] Parsed empty lecturers list, preserving last known valid lecturers.");
        parsed.lecturers = lastKnownValidDb.lecturers;
      } else {
        parsed.lecturers = DEFAULT_LECTURERS;
      }
    }
    if (!parsed.logs || !Array.isArray(parsed.logs)) parsed.logs = [];

    // Ensure ONLY online/detected lecturers have active networkInfo
    parsed.lecturers.forEach((l: Lecturer) => {
      if (l.isDeviceDetected && l.isPresentToday && (l.ipAddress || l.macAddress)) {
        if (!l.networkInfo || l.networkInfo.hops === 0) {
          l.networkInfo = resolveNetworkPresence(
            l.ipAddress || "192.168.73.20",
            l.macAddress,
            parsed.system.subnetZoneRules,
            parsed.system.routerIp,
            undefined,
            undefined,
            true
          );
        }
      } else {
        // Offline or not detected: completely clear networkInfo to avoid fake hops
        l.networkInfo = undefined;
      }
    });

    lastKnownValidDb = parsed;
    return parsed;
  } catch (err) {
    console.error("Error reading or parsing database file:", err);
    if (lastKnownValidDb && lastKnownValidDb.lecturers && lastKnownValidDb.lecturers.length > 0) {
      console.warn("[Database Safety] Returning last known valid database to prevent data loss.");
      return lastKnownValidDb;
    }
    return {
      system: {
        lastResetDate: "",
        routerIp: DEFAULT_ROUTER_IP,
        subnetMask: DEFAULT_SUBNET_MASK,
        subnetCidrBits: DEFAULT_SUBNET_CIDR,
        subnetZoneRules: DEFAULT_SUBNET_RULES,
      },
      lecturers: DEFAULT_LECTURERS,
      logs: []
    };
  }
}

export async function writeDb(data: DbSchema): Promise<void> {
  // Safety guard: Never write an empty lecturer list if we previously had valid lecturers!
  if (!data || !Array.isArray(data.lecturers) || data.lecturers.length === 0) {
    if (lastKnownValidDb && lastKnownValidDb.lecturers && lastKnownValidDb.lecturers.length > 0) {
      console.error("[Database Safety] Blocked destructive writeDb call with 0 lecturers! Preserving existing database.");
      return writeQueue;
    }
  }

  writeQueue = writeQueue.then(async () => {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      const dir = path.dirname(DB_FILE);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tempFile, DB_FILE);
      await fs.chmod(DB_FILE, 0o666).catch(() => {});
      lastKnownValidDb = data;
    } catch (err) {
      console.error("Error writing to local database file:", err);
    }
  });
  return writeQueue;
}
