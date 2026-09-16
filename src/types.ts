export interface TracerouteHop {
  hop: number;
  ip: string;
  hostname?: string;
  rttMs: number;
  status: 'ok' | 'timeout';
  isGateway?: boolean;
  label?: string; // e.g. "Lecturer Room Router (Default Gateway)", "Staff Room AP Gateway"
}

export interface NetworkPresenceInfo {
  ip?: string;
  mac?: string;
  hops: number; // 1 = Direct (Lecturer Room AP), 2 = 1 router hop (Staff Room AP), 3+ = Remote
  latencyMs: number;
  detectedZone: string; // e.g. "Lecturer Room AP (Direct)", "Staff Room AP (Routed)", "Corridor AP"
  zoneType: 'lecturer_room' | 'staff_room' | 'adjacent' | 'remote';
  routerGatewayIp?: string;
  traceroutePath: TracerouteHop[];
  lastTraced: number;
  explanation?: string;
}

export interface SubnetZoneRule {
  id: string;
  name: string; // e.g. "Lecturer Room AP (Direct)", "Classroom 101 AP", "Staff Room Access Point"
  subnetCidrOrPrefix: string; // e.g. "192.168.1." or "192.168.1.0/24"
  expectedHops: number; // 1 = direct, 2 = adjacent AP, 3 = classroom / routed
  zoneType: 'lecturer_room' | 'staff_room' | 'adjacent' | 'remote';
  description?: string;
  autoLearned?: boolean; // Discovered automatically by network traceroute/ARP sweep
  discoveredAt?: number; // Timestamp when discovered
  deviceCount?: number; // Number of devices currently or recently associated with this subnet
  gatewayHostname?: string; // Optional resolved DNS/mDNS name of the AP gateway
}

export interface Lecturer {
  id: string;
  name: string;
  macAddress: string; // Primary MAC address (e.g. 5GHz Wi-Fi)
  secondaryMacAddress?: string; // Secondary MAC address (e.g. 2.4GHz Wi-Fi)
  ipAddress?: string; // Optional static or dynamic IP address
  rfidUid?: string; // Optional RFID Card UID for physical reader/tag check-ins (e.g. "8A2BC34D")
  pin: string; // 4-digit PIN for quick check-in / manual status update
  profilePhotoUrl: string; // Base64 image data or external image URL
  awayPhotoUrl: string; // Base64 image data or external image URL (used when status is 'Present but Away')
  status: 'Available' | 'Away' | 'Meeting' | 'Class' | 'Out of Office';
  customMessage: string; // Optional custom status message (e.g. "In Class A until 10:00")
  isPresentToday: boolean; // Has been present at least once today
  isDeviceDetected: boolean; // Currently connected to Wi-Fi
  lastSeen: number; // Timestamp (ms) when device was last active or manual status changed
  firstSeenToday?: number; // Timestamp (ms) when device was first auto-detected today
  networkInfo?: NetworkPresenceInfo; // Real-time traceroute and hop presence info
}

export interface PresenceLog {
  id: string;
  lecturerId: string;
  lecturerName: string;
  action: 'device_detected' | 'device_lost' | 'manual_checkin' | 'manual_checkout' | 'status_change';
  timestamp: number;
  details: string;
}

export interface SystemConfig {
  adminPasswordHash: string; // Simple hashed admin password
  lastResetDate: string; // 'YYYY-MM-DD' - used to automatically reset 'isPresentToday' on new day
  routerIp?: string; // Lecturer room router IP (e.g. 192.168.1.1)
  subnetZoneRules?: SubnetZoneRule[];
  autoDiscoverSubnets?: boolean; // When true, unlisted room subnets & APs are discovered and registered automatically
}
