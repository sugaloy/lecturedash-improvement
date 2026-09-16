import fs from "fs/promises";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import { Lecturer, PresenceLog, SubnetZoneRule } from "./src/types";
import { DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, resolveNetworkPresence } from "./networkDiagnostics";

// Determine the best persistent location for the database
function getDbFilePath(): string {
  // 1. Explicit environment variable
  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }

  // 2. Common persistent directories (e.g. Docker /data volume mount)
  if (existsSync("/data")) {
    return "/data/db.json";
  }

  // 3. Parent directory of the app folder
  // This is highly robust: when updating/replacing the app folder, the database at `../presence_db.json` is preserved.
  const parentPath = path.resolve(process.cwd(), "..");
  try {
    const testFile = path.join(parentPath, `.write_test_${Date.now()}`);
    writeFileSync(testFile, "test");
    unlinkSync(testFile);
    return path.join(parentPath, "presence_db.json");
  } catch (e) {
    // Fallback to local cwd if parent is not writable
    return path.join(process.cwd(), "db.json");
  }
}

const DB_FILE = getDbFilePath();
console.log(`[Database Engine] Active local database file path: ${DB_FILE}`);

interface DbSchema {
  system: {
    lastResetDate: string;
    routerIp?: string;
    subnetZoneRules?: SubnetZoneRule[];
    autoDiscoverSubnets?: boolean;
  };
  lecturers: Lecturer[];
  logs: PresenceLog[];
}

const DEFAULT_LECTURERS: Lecturer[] = [
  {
    id: 'lecturer_1',
    name: 'Dr. Aris Giatma',
    macAddress: 'fc:a1:3e:8b:2d:4c',
    ipAddress: '192.168.1.45',
    rfidUid: '8A2BC34D',
    pin: '1234',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=250',
    status: 'Available',
    customMessage: 'At desk, consulting hour open.',
    isPresentToday: true,
    isDeviceDetected: true,
    lastSeen: Date.now() - 500000,
    networkInfo: resolveNetworkPresence('192.168.1.45', 'fc:a1:3e:8b:2d:4c', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 1, 2.1)
  },
  {
    id: 'lecturer_2',
    name: 'Prof. Budi Santoso',
    macAddress: '00:11:22:33:44:55',
    ipAddress: '192.168.2.112',
    rfidUid: 'B2C3D4E5',
    pin: '2222',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=250',
    status: 'Class',
    customMessage: 'Teaching DBMS in Lab 3.',
    isPresentToday: true,
    isDeviceDetected: false,
    lastSeen: Date.now() - 1500000,
    networkInfo: resolveNetworkPresence('192.168.2.112', '00:11:22:33:44:55', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 2, 18.4)
  },
  {
    id: 'lecturer_3',
    name: 'Dr. Citra Lestari',
    macAddress: 'aa:bb:cc:dd:ee:ff',
    ipAddress: '192.168.1.58',
    rfidUid: 'C3D4E5F6',
    pin: '3333',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=250',
    status: 'Away',
    customMessage: 'Briefly stepped out for coffee.',
    isPresentToday: true,
    isDeviceDetected: false,
    lastSeen: Date.now() - 3600000,
    networkInfo: resolveNetworkPresence('192.168.1.58', 'aa:bb:cc:dd:ee:ff', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 1, 2.5)
  },
  {
    id: 'lecturer_4',
    name: 'Dr. Denny Wijaya',
    macAddress: '11:22:33:44:55:66',
    ipAddress: '192.168.1.88',
    rfidUid: 'D4E5F678',
    pin: '4444',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=250',
    status: 'Meeting',
    customMessage: 'Department curriculum coordination meeting.',
    isPresentToday: true,
    isDeviceDetected: true,
    lastSeen: Date.now() - 600000,
    networkInfo: resolveNetworkPresence('192.168.1.88', '11:22:33:44:55:66', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 1, 1.9)
  },
  {
    id: 'lecturer_5',
    name: 'Prof. Elizabeth',
    macAddress: 'ab:cd:ef:01:23:45',
    ipAddress: '10.0.4.12',
    rfidUid: 'E5F6789A',
    pin: '5555',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=250',
    status: 'Out of Office',
    customMessage: 'Attending IEEE Symposium off-site today.',
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: 0
  },
  {
    id: 'lecturer_6',
    name: 'Dr. Farhan Hakim',
    macAddress: 'a1:b2:c3:d4:e5:f6',
    ipAddress: '192.168.1.52',
    rfidUid: 'F6789AB1',
    pin: '6666',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=250',
    status: 'Available',
    customMessage: 'Grading final project assessments. Come in.',
    isPresentToday: true,
    isDeviceDetected: true,
    lastSeen: Date.now() - 100000,
    networkInfo: resolveNetworkPresence('192.168.1.52', 'a1:b2:c3:d4:e5:f6', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 1, 2.0)
  },
  {
    id: 'lecturer_7',
    name: 'Dr. Gita Permata',
    macAddress: '99:88:77:66:55:44',
    ipAddress: '192.168.2.77',
    rfidUid: '789AB1C2',
    pin: '7777',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=250',
    status: 'Meeting',
    customMessage: 'Online thesis examination board.',
    isPresentToday: true,
    isDeviceDetected: true,
    lastSeen: Date.now() - 300000,
    networkInfo: resolveNetworkPresence('192.168.2.77', '99:88:77:66:55:44', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 2, 21.3)
  },
  {
    id: 'lecturer_8',
    name: 'Prof. Hariadi',
    macAddress: '88:77:66:55:44:33',
    ipAddress: '192.168.73.40',
    rfidUid: '89AB1C2D',
    pin: '8888',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
    awayPhotoUrl: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=250',
    status: 'Away',
    customMessage: 'In reference library reading room.',
    isPresentToday: true,
    isDeviceDetected: false,
    lastSeen: Date.now() - 1200000,
    networkInfo: resolveNetworkPresence('192.168.73.40', '88:77:66:55:44:33', DEFAULT_SUBNET_RULES, DEFAULT_ROUTER_IP, 3, 29.5)
  }
];

let writeQueue = Promise.resolve();

export async function readDb(): Promise<DbSchema> {
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.system) {
      parsed.system = {
        lastResetDate: "",
        routerIp: DEFAULT_ROUTER_IP,
        subnetZoneRules: DEFAULT_SUBNET_RULES,
      };
    } else {
      if (!parsed.system.routerIp) parsed.system.routerIp = DEFAULT_ROUTER_IP;
      if (!parsed.system.subnetZoneRules || !Array.isArray(parsed.system.subnetZoneRules)) {
        parsed.system.subnetZoneRules = DEFAULT_SUBNET_RULES;
      }
    }
    if (!parsed.lecturers || !Array.isArray(parsed.lecturers)) parsed.lecturers = DEFAULT_LECTURERS;
    if (!parsed.logs || !Array.isArray(parsed.logs)) parsed.logs = [];

    // Ensure any detected lecturer without networkInfo gets accurate network analysis
    parsed.lecturers.forEach((l: Lecturer) => {
      if (!l.networkInfo && (l.ipAddress || l.macAddress)) {
        l.networkInfo = resolveNetworkPresence(
          l.ipAddress || "192.168.1.50",
          l.macAddress,
          parsed.system.subnetZoneRules,
          parsed.system.routerIp
        );
      }
    });

    return parsed;
  } catch (err) {
    if ((err as any).code === 'ENOENT') {
      const initialDb: DbSchema = {
        system: {
          lastResetDate: "",
          routerIp: DEFAULT_ROUTER_IP,
          subnetZoneRules: DEFAULT_SUBNET_RULES,
        },
        lecturers: DEFAULT_LECTURERS,
        logs: []
      };
      await writeDb(initialDb);
      return initialDb;
    }
    console.error("Error reading or parsing database file, falling back to defaults:", err);
    return {
      system: {
        lastResetDate: "",
        routerIp: DEFAULT_ROUTER_IP,
        subnetZoneRules: DEFAULT_SUBNET_RULES,
      },
      lecturers: DEFAULT_LECTURERS,
      logs: []
    };
  }
}

export async function writeDb(data: DbSchema): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      // Ensure folder structure of external path exists if created dynamically
      const dir = path.dirname(DB_FILE);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tempFile, DB_FILE);
    } catch (err) {
      console.error("Error writing to local database file:", err);
    }
  });
  return writeQueue;
}
