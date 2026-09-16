import React, { useState } from 'react';
import { Copy, Check, Terminal, Cpu, AlertTriangle, ShieldCheck, CreditCard, Layers, Zap, Download, RefreshCw, CheckCircle2, ArrowRight, Shield } from 'lucide-react';

export const PiScriptGuide: React.FC = () => {
  const [activeGuideTab, setActiveGuideTab] = useState<'oneclick' | 'wifi' | 'rfid' | 'pn532' | 'autostart'>('oneclick');
  const [copiedOneClick, setCopiedOneClick] = useState(false);
  const [copiedLocalRun, setCopiedLocalRun] = useState(false);
  const [customServerIp, setCustomServerIp] = useState('');
  const [installerMode, setInstallerMode] = useState<'all' | 'scanner'>('all');
  const [copiedPython, setCopiedPython] = useState(false);
  const [copiedRfid, setCopiedRfid] = useState(false);
  const [copiedPn532, setCopiedPn532] = useState(false);
  const [copiedShell, setCopiedShell] = useState(false);
  const [copiedRfidShell, setCopiedRfidShell] = useState(false);
  const [copiedPn532Shell, setCopiedPn532Shell] = useState(false);
  const [copiedAutostart, setCopiedAutostart] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const isCloudUrl = appUrl.includes('run.app') || appUrl.includes('google') || appUrl.includes('web.app');

  // Compute effective server URL and one-click shell command
  const resolvedServerUrl = customServerIp.trim()
    ? (customServerIp.startsWith('http') ? customServerIp.trim() : `http://${customServerIp.trim()}`)
    : (isCloudUrl ? 'http://192.168.1.50:3000' : appUrl);

  const oneClickCmd = installerMode === 'all'
    ? `curl -sSL "${resolvedServerUrl}/api/install.sh" | sudo bash`
    : `curl -sSL "${resolvedServerUrl}/api/install.sh" | sudo bash -s -- --mode scanner`;

  const localRunCmd = installerMode === 'all'
    ? `sudo bash install.sh`
    : `sudo bash install.sh --mode scanner`;

  // wifi sweep python agent with traceroute hop detection
  const pythonScript = `import subprocess
import re
import json
import urllib.request
import time

# === CONFIGURATION ===
# Local Intranet Presence Server Endpoint
SERVER_URL = "${appUrl}/api/presence/report"
SERVER_CONFIG_URL = "${appUrl}/api/network/config"

# Auto-sanitize SERVER_URL (converts double slashes like //api into a single /api)
if SERVER_URL.startswith("http"):
    parts = SERVER_URL.split("://", 1)
    SERVER_URL = parts[0] + "://" + parts[1].replace("//", "/")
if SERVER_CONFIG_URL.startswith("http"):
    parts = SERVER_CONFIG_URL.split("://", 1)
    SERVER_CONFIG_URL = parts[0] + "://" + parts[1].replace("//", "/")

# Interval between network scans in seconds (60s is recommended)
SCAN_INTERVAL = 60

# Autonomous Subnet Discovery: Automatically inspects local interfaces (wlan0, eth0)
# and retrieves registered classroom/AP subnets from the server.
AUTO_DISCOVER_SUBNETS = True
DEFAULT_FALLBACK_SUBNETS = ["192.168.1.0/24", "192.168.2.0/24"]
# =====================

def discover_active_subnets():
    """
    Autonomously discovers active subnets without manual configuration:
    1. Inspects local Pi interfaces & kernel routing table ('ip route show')
    2. Syncs any additional classroom/AP subnets configured on the server
    """
    subnets = set()
    
    # 1. Query Linux kernel routing table for directly attached interface subnets
    try:
        route_output = subprocess.check_output(["ip", "-o", "-4", "route", "show"]).decode("utf-8")
        for line in route_output.splitlines():
            # Matches routes like '192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.50'
            m = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2})", line)
            if m:
                cidr = m.group(1)
                # Ignore loopback and default gateway placeholder (0.0.0.0/0)
                if not cidr.startswith("127.") and not cidr.startswith("0.0.0.0"):
                    subnets.add(cidr)
    except Exception as e:
        print(f"[*] Route table inspection note: {e}")

    # 2. Sync dynamically discovered subnets from presence server
    try:
        req = urllib.request.Request(SERVER_CONFIG_URL, headers={"User-Agent": "PresenceAgent/1.0"})
        with urllib.request.urlopen(req, timeout=4) as res:
            cfg = json.loads(res.read().decode("utf-8"))
            rules = cfg.get("subnetZoneRules", [])
            for r in rules:
                prefix = r.get("subnetCidrOrPrefix", "")
                if "/" in prefix:
                    subnets.add(prefix)
                elif prefix.endswith("."):
                    subnets.add(f"{prefix}0/24")
    except Exception:
        pass

    # 3. Fallback defaults if no interfaces were resolved
    if not subnets:
        for s in DEFAULT_FALLBACK_SUBNETS:
            subnets.add(s)

    return sorted(list(subnets))

def get_device_hops(ip):
    """
    Autonomously measures routing distance (hop count) and latency to the target device:
    1 Hop  = Direct layer-2 Wi-Fi association in Lecturer Room (<3ms RTT).
    2 Hops = Routed through Staff Room Access Point (~18ms RTT).
    3 Hops = Routed through Classroom / Floor distribution AP (~28ms RTT).
    """
    try:
        res = subprocess.run(
            ["traceroute", "-n", "-m", "4", "-w", "1", ip],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=3
        )
        lines = [l.strip() for l in res.stdout.decode().splitlines() if l.strip() and not l.startswith("traceroute")]
        hops = len(lines)
        return max(1, hops)
    except Exception:
        # Topology heuristic based on subnet
        if ip.startswith("192.168.1."):
            return 1
        elif ip.startswith("192.168.2."):
            return 2
        return 3

def scan_network():
    active_subnets = discover_active_subnets() if AUTO_DISCOVER_SUBNETS else DEFAULT_FALLBACK_SUBNETS
    print(f"\\n[Scanning] Autonomous ping sweep across {len(active_subnets)} subnet(s): {', '.join(active_subnets)}")
    
    for subnet in active_subnets:
        try:
            subprocess.run(["nmap", "-sn", subnet], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except FileNotFoundError:
            pass

    devices = []
    seen_macs = set()
    try:
        # Read the system ARP table cache (arp -an)
        arp_output = subprocess.check_output(["arp", "-an"]).decode("utf-8")
        pattern = re.compile(r"\\((\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})\\) at ([0-9a-fA-F:]{17})")
        
        for line in arp_output.splitlines():
            match = pattern.search(line)
            if match:
                ip = match.group(1)
                mac = match.group(2).lower()
                if mac not in seen_macs and mac != "ff:ff:ff:ff:ff:ff":
                    seen_macs.add(mac)
                    hops = get_device_hops(ip)
                    devices.append({
                        "mac": mac,
                        "ip": ip,
                        "hops": hops
                    })
                    print(f"[+] Active Device: IP={ip} | MAC={mac} | Hops={hops}")
                
    except Exception as e:
        print(f"[-] Error reading ARP cache: {e}")
        
    return devices

def report_presence(devices):
    print(f"[Reporting] Sending {len(devices)} active intranet devices to presence server...")
    data = json.dumps({"devices": devices}).encode("utf-8")
    
    req = urllib.request.Request(
        SERVER_URL, 
        data=data, 
        headers={
            "Content-Type": "application/json",
            "User-Agent": "PresenceAgent/1.0"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if res_data.get("success"):
                summary = res_data.get("summary", [])
                detected_count = sum(1 for s in summary if s.get("detected"))
                print(f"[✓] Presence synchronized! ({detected_count} registered lecturers detected)")
            else:
                print("[-] Server processed request but returned failure.")
    except Exception as e:
        print(f"[-] Error communicating with local server API: {e}")

if __name__ == "__main__":
    print("==================================================")
    print("   Autonomous Multi-Room Presence Agent (Wi-Fi)   ")
    print("==================================================")
    print(f"Local Server URL:   {SERVER_URL}")
    print(f"Auto-Discovery:     {'ENABLED (Kernel routes + Server APs)' if AUTO_DISCOVER_SUBNETS else 'DISABLED'}")
    print(f"Scan Interval:      {SCAN_INTERVAL} seconds")
    print("==================================================")
    
    while True:
        try:
            active_devices = scan_network()
            report_presence(active_devices)
        except KeyboardInterrupt:
            print("\\nExiting presence agent...")
            break
        except Exception as e:
            print(f"[-] Unexpected error: {e}")
        
        time.sleep(SCAN_INTERVAL)
`;

  // rfid reader python scaffolding agent
  const rfidScript = `import time
import json
import urllib.request
import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522

# === CONFIGURATION ===
# Local Intranet RFID Scan Server Endpoint
SERVER_URL = "${appUrl}/api/presence/rfid"

# Auto-sanitize SERVER_URL (converts double slashes like //api into a single /api)
if SERVER_URL.startswith("http"):
    parts = SERVER_URL.split("://", 1)
    SERVER_URL = parts[0] + "://" + parts[1].replace("//", "/")

# Hardware Tactility Pinouts
BUZZER_PIN = 16  # GPIO 16 (Physical Board Pin 36)
# =====================

# Initialize GPIO
GPIO.setmode(GPIO.BOARD)
GPIO.setup(BUZZER_PIN, GPIO.OUT)
GPIO.output(BUZZER_PIN, GPIO.LOW)

# Initialize RC522 Simple Reader
reader = SimpleMFRC522()

def beep(duration=0.05, repeats=1, gap=0.05):
    for i in range(repeats):
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        time.sleep(duration)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        if i < repeats - 1:
            time.sleep(gap)

print("==================================================")
print(" RPi GPIO Physical RFID Card Reader & Buzzer Agent ")
print("==================================================")
print(f"Local Server URL: {SERVER_URL}")
print(f"Buzzer GPIO Pin:  GPIO 16 (Physical Pin 36)")
print("Ready! Tap/Hold a physical RFID tag on MFRC522...")
print("==================================================")

try:
    while True:
        try:
            # Physical blocking call waiting for an RFID tap
            card_id, card_text = reader.read()
            
            # Convert card integer ID to a clean hexadecimal uppercase UID string
            hex_uid = hex(card_id).replace("0x", "").upper().strip()
            
            # Tactility 1: One very short beep on card detection
            beep(0.04, 1)
            print(f"\\n[RFID Tap] Card Integer ID: {card_id} -> Hexadecimal UID: {hex_uid}")
            
            # Send swipe event payload to local express endpoint
            payload = json.dumps({"rfidUid": hex_uid}).encode("utf-8")
            req = urllib.request.Request(
                SERVER_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "MFRC522-GPIO-Beacon/1.0"
                }
            )
            
            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    if res_data.get("success"):
                        print(f"[✓] Success: {res_data.get('message')}")
                        # Tactility 2: Two very short beeps on status change / completed reading
                        beep(0.04, 2, 0.04)
                    else:
                        print(f"[-] Scan details: {res_data.get('message')}")
                        beep(0.15, 1) # error alert
            except Exception as err:
                print(f"[-] Connection failed to local doorboard API: {err}")
                beep(0.15, 1) # error alert
                
            # Cooldown sleep. If holding the card, 1.5 seconds is enough to trigger a continuous cycle.
            time.sleep(1.5)
            print("\\nWaiting for next RFID scan...")
            
        except Exception as inner_err:
            print(f"[-] RFID scan loop error: {inner_err}")
            time.sleep(1)
finally:
    # Safely release GPIO pins on exit
    GPIO.cleanup()
`;

  const shellCommand = `sudo apt update && sudo apt install nmap traceroute net-tools -y
# Run a test ping sweep manually across Lecturer Room and Staff Room subnets:
nmap -sn 192.168.1.0/24 192.168.2.0/24 && arp -an
# Test hop count to a lecturer's phone:
traceroute -n -m 3 192.168.2.112`;

  const rfidShellCommand = `# Enable SPI on Raspberry Pi (required for MFRC522)
sudo raspi-config nonint do_spi 0

# Install build dependencies and library
sudo apt update
sudo apt install python3-pip python3-dev -y
pip3 install spidev mfrc522`;

  const pn532Script = `import time
import json
import urllib.request
import board
import busio
import RPi.GPIO as GPIO
from adafruit_pn532.i2c import PN532_I2C

# === CONFIGURATION ===
# Local Intranet PN532 NFC Scan Server Endpoint
SERVER_URL = "${appUrl}/api/presence/rfid"

# Auto-sanitize SERVER_URL (converts double slashes like //api into a single /api)
if SERVER_URL.startswith("http"):
    parts = SERVER_URL.split("://", 1)
    SERVER_URL = parts[0] + "://" + parts[1].replace("//", "/")

# Hardware Tactility Pinouts
BUZZER_PIN = 16  # GPIO 16 (BCM mode, Physical Pin 36)
# =====================

# Setup GPIO for buzzer
GPIO.setmode(GPIO.BCM)  # CircuitPython libraries require BCM numbering
GPIO.setup(BUZZER_PIN, GPIO.OUT)
GPIO.output(BUZZER_PIN, GPIO.LOW)

def beep(duration=0.05, repeats=1, gap=0.05):
    for i in range(repeats):
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        time.sleep(duration)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        if i < repeats - 1:
            time.sleep(gap)

# Initialize I2C Bus and PN532 board
try:
    i2c = busio.I2C(board.SCL, board.SDA)
    # Using standard PN532 I2C address (0x24)
    pn532 = PN532_I2C(i2c, debug=False)
    
    # Get firmware version to verify connection
    ic, ver, rev, support = pn532.firmware_version
    print("==================================================")
    print(" RPi Local PN532 NFC Card Reader & Buzzer Agent ")
    print("==================================================")
    print(f"Found PN532 NFC Chip! Firmware ver: {ver}.{rev}")
    print(f"Local Server URL: {SERVER_URL}")
    print(f"Buzzer GPIO Pin:  GPIO 16 (BCM, Physical Pin 36)")
    print("==================================================")
    
    # Configure PN532 to communicate with MiFare cards
    pn532.SAM_configuration()
except Exception as e:
    print(f"[-] Hardware initialization failed: {e}")
    print("[*] Please verify switches on your Red board: CH1=ON, CH2=OFF (for I2C).")
    exit(1)

print("Ready! Tap an NFC card/tag, RFID keyfob, or smartphone on PN532...")

try:
    while True:
        try:
            # Check if a card is available to read
            uid = pn532.read_passive_target(timeout=0.5)
            
            if uid is not None:
                # Format bytes into an uppercase Hexadecimal UID string (e.g. 04A1B2C3)
                hex_uid = "".join([f"{x:02X}" for x in uid])
                
                # Tactility 1: One very short beep on card detection
                beep(0.04, 1)
                print(f"\\\\n[NFC Tap] Detected Card UID: {hex_uid}")
                
                # Send swipe event payload to local express endpoint
                payload = json.dumps({"rfidUid": hex_uid}).encode("utf-8")
                req = urllib.request.Request(
                    SERVER_URL,
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "PN532-I2C-Beacon/1.0"
                    }
                )
                
                try:
                    with urllib.request.urlopen(req, timeout=5) as response:
                        res_data = json.loads(response.read().decode("utf-8"))
                        if res_data.get("success"):
                            print(f"[✓] Success: {res_data.get('message')}")
                            # Tactility 2: Two very short beeps on status change
                            beep(0.04, 2, 0.04)
                        else:
                            print(f"[-] Scan details: {res_data.get('message')}")
                            beep(0.15, 1)
                except Exception as err:
                    print(f"[-] Connection failed to local doorboard API: {err}")
                    beep(0.15, 1)
                
                # Cooldown to avoid continuous rapid duplicate scans.
                # If holding the card, 1.5s is enough to cycle through states nicely.
                time.sleep(1.5)
                print("\\\\nWaiting for next NFC scan...")
            else:
                # Small sleep to keep CPU usage low while polling
                time.sleep(0.1)
                
        except Exception as inner_err:
            print(f"[-] NFC scanning exception: {inner_err}")
            time.sleep(1)
except KeyboardInterrupt:
    print("\\\\nExiting PN532 NFC agent...")
`;

  const pn532ShellCommand = `# Enable I2C interface on Raspberry Pi (required for PN532 I2C mode)
sudo raspi-config nonint do_i2c 0

# Install Adafruit CircuitPython PN532 package (with break-system-packages flag for modern Debian/Pi OS)
sudo apt update
sudo apt install python3-pip python3-dev -y
pip3 install adafruit-circuitpython-pn532 --break-system-packages`;

  const autostartScript = `# ==============================================================================
# RASPBERRY PI SYSTEMD AUTOSTART & KEEP-ALIVE CONFIGURATION
# ==============================================================================

# --- STEP 0: PRE-BUILD THE APP (REQUIRED) ---
# Navigate to your project folder and compile the app first:
cd /home/$USER/lecturerpresence
npm run build


# --- STEP 1: CREATE MAIN WEB APP SERVICE ---
sudo nano /etc/systemd/system/lecturedash.service

# Paste the following into /etc/systemd/system/lecturedash.service:
# Note: Replace 'root' with your username if you don't want to run as root.
[Unit]
Description=Lecturer Presence Signage Web App
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi/lecturerpresence
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target


# --- STEP 2: CREATE WI-FI PRESENCE AGENT SERVICE ---
sudo nano /etc/systemd/system/presence-agent.service

# Paste the following into presence-agent.service:
[Unit]
Description=Wi-Fi Network Scanner Presence Agent
After=lecturedash.service
Wants=lecturedash.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/presence_agent.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target


# --- STEP 3: CREATE PN532 RFID/NFC AGENT SERVICE ---
sudo nano /etc/systemd/system/pn532-agent.service

# Paste the following into pn532-agent.service:
[Unit]
Description=PN532 NFC Card Reader Agent
After=lecturedash.service
Wants=lecturedash.service

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/pn532_agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target


# --- STEP 4: RELOAD & ENABLE ALL SERVICES ON BOOT ---
sudo systemctl daemon-reload
sudo systemctl enable --now lecturedash.service
sudo systemctl enable --now presence-agent.service
sudo systemctl enable --now pn532-agent.service

# Check service status:
sudo systemctl status lecturedash.service
`;

  const fallbackCopy = (text: string, setCopied: (v: boolean) => void) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        console.warn('execCommand copy failed');
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
  };

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {
            fallbackCopy(text, setCopied);
          });
      } else {
        fallbackCopy(text, setCopied);
      }
    } catch (e) {
      fallbackCopy(text, setCopied);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm max-w-4xl mx-auto space-y-8 animate-fade-in font-sans">
      {/* Intro Header */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-50 text-slate-800 rounded-2xl border border-slate-200">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Raspberry Pi Local Agents</h2>
        </div>
        <p className="text-slate-500 text-xs md:text-sm max-w-2xl leading-relaxed">
          The presence system runs entirely **locally on your intranet network**, with zero dependencies on external clouds. Use these hardware agents on a Raspberry Pi positioned in your office or classroom.
        </p>
      </div>

      {/* Concept Architecture Block */}
      <div className="grid md:grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-200">
        <div className="space-y-1.5 p-3">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">Method A</span>
          <h3 className="font-bold text-slate-800 text-sm">Wi-Fi MAC Sweeper</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pi agent performs periodic network checks. If a lecturer's registered phone MAC is active on the Wi-Fi subnet, they show as present automatically.
          </p>
        </div>
        <div className="space-y-1.5 p-3 border-t md:border-t-0 md:border-l border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">Method B</span>
          <h3 className="font-bold text-slate-800 text-sm">Physical RFID Reader</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Connect an MFRC522 RFID reader to the Pi's GPIO pins. Lecturers can physically tap keyfobs or ID cards to instantly sign in or out.
          </p>
        </div>
        <div className="space-y-1.5 p-3 border-t md:border-t-0 md:border-l border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">Local Sync</span>
          <h3 className="font-bold text-slate-800 text-sm">Offline Local Database</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            All data sits inside your local database. State changes apply instantly to the electronic doorboard and administration panel.
          </p>
        </div>
      </div>

      {/* MAC randomization notice */}
      <div className="p-4 bg-amber-50 border border-amber-200/50 rounded-2xl flex items-start space-x-3.5 text-xs text-amber-850">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <strong className="font-bold block text-slate-900">MAC Randomization & Intranet Security</strong>
          <p>
            Randomized MAC addresses are **strictly static for each individual Wi-Fi SSID**. As long as lecturers connect to your specific office network, their MAC address remains static and recognizable by the local agent.
          </p>
          <p className="mt-1.5">
            <strong>Self-Hosted Networking Notice:</strong> Since the server runs locally, ensure your Raspberry Pi and this web console container reside in the same physical subnet or can ping each other's IP addresses.
          </p>
        </div>
      </div>

      {/* Local Server Connection notice */}
      <div className="p-5 bg-emerald-50 border border-emerald-200/50 rounded-2xl flex items-start space-x-3.5 text-xs text-emerald-850">
        <ShieldCheck className="w-5.5 h-5.5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-2.5 leading-relaxed w-full">
          <div>
            <strong className="font-bold block text-emerald-900 text-sm font-sans">Local Intranet Self-Hosted Connection Guide</strong>
            <p className="mt-1 text-slate-600">
              The presence board runs fully locally on your intranet on port <strong className="text-slate-950 font-bold">3000</strong>. Your Raspberry Pi scanning agents must send HTTP POST requests directly to your local server IP.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-1">
            <div className="bg-white/80 rounded-xl p-3 border border-emerald-100/60">
              <span className="font-bold text-[10px] text-emerald-800 uppercase tracking-wider block mb-1">1. Wi-Fi Sweep Endpoint</span>
              <p className="text-[11px] text-slate-500 mb-1.5">For reports of scanned MAC/IP devices (POST request):</p>
              <code className="block bg-emerald-100/60 text-emerald-950 font-mono p-1.5 rounded-lg text-xs break-all border border-emerald-200/40 select-all font-semibold">
                http://[YOUR_SERVER_IP]:3000/api/presence/report
              </code>
            </div>
            <div className="bg-white/80 rounded-xl p-3 border border-emerald-100/60">
              <span className="font-bold text-[10px] text-emerald-800 uppercase tracking-wider block mb-1">2. RFID Reader Endpoint</span>
              <p className="text-[11px] text-slate-500 mb-1.5">For physical RFID card scans (POST request):</p>
              <code className="block bg-emerald-100/60 text-emerald-950 font-mono p-1.5 rounded-lg text-xs break-all border border-emerald-200/40 select-all font-semibold">
                http://[YOUR_SERVER_IP]:3000/api/presence/rfid
              </code>
            </div>
          </div>

          <div className="p-3 bg-white/40 rounded-xl border border-emerald-200/20 text-slate-600 text-[11px] space-y-1.5">
            <p>
              🔌 <strong>Intranet Deployment Instructions:</strong>
            </p>
            <p>
              Run the Express server on your office PC or server. Make sure your Raspberry Pi and the server are connected to the same local subnet (e.g. connected to the same Wi-Fi router or office switch). Find your server's local IP (using <code className="bg-emerald-100/50 px-1 rounded font-mono">ip a</code> or <code className="bg-emerald-100/50 px-1 rounded font-mono">ifconfig</code>) and substitute it in place of <code className="font-bold text-slate-700">[YOUR_SERVER_IP]</code> in your Python script configuration.
            </p>
            <p className="text-red-700 font-medium">
              ⚠️ <em>Avoid hitting the base URL (without /api/presence/*) from your scripts, as it will return a 404 response.</em>
            </p>
          </div>
        </div>
      </div>

      {/* Toggle Agent Tabs */}
      <div className="space-y-4">
        <div className="flex border-b border-slate-200 pb-0.5 space-x-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveGuideTab('oneclick')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer shrink-0 flex items-center space-x-1.5 ${
              activeGuideTab === 'oneclick' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ One-Click Installer & Updater</span>
          </button>
          <button
            onClick={() => setActiveGuideTab('wifi')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
              activeGuideTab === 'wifi' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            2. Wi-Fi MAC Sweeper Agent
          </button>
          <button
            onClick={() => setActiveGuideTab('rfid')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
              activeGuideTab === 'rfid' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            3. MFRC522 (RFID) Reader
          </button>
          <button
            onClick={() => setActiveGuideTab('pn532')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
              activeGuideTab === 'pn532' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            4. PN532 (NFC v3 Red) Reader
          </button>
          <button
            onClick={() => setActiveGuideTab('autostart')}
            className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer shrink-0 ${
              activeGuideTab === 'autostart' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            5. Autostart & Keep-Alive (systemd)
          </button>
        </div>

        {activeGuideTab === 'oneclick' && (
          /* ONE CLICK INSTALLER & SMART UPDATER PANEL */
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white p-6 rounded-3xl shadow-md border border-indigo-800/40 relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-indigo-500/30 border border-indigo-400/40 rounded-xl text-indigo-300">
                      <Zap className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-lg text-white">One-Click Automated Installer & Smart Updater</h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <Shield className="w-3 h-3 mr-1" />
                    Zero Database Overwrite
                  </span>
                </div>

                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Run a single command directly on your Raspberry Pi terminal. The script <strong>autodetects whether the presence scripts or services are already installed</strong>, gracefully upgrades your scanner code, and <strong>strictly preserves your database (`presence_db.json`) with an automated timestamped backup</strong>.
                </p>

                {/* Configuration / Options */}
                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-800/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                      Target Intranet Server Address
                    </label>
                    <input
                      type="text"
                      value={customServerIp}
                      onChange={(e) => setCustomServerIp(e.target.value)}
                      placeholder={appUrl}
                      className="w-full px-3 py-1.5 bg-slate-900 text-xs font-mono text-indigo-300 rounded-xl border border-slate-700 focus:border-indigo-400 outline-hidden"
                    />
                    <span className="text-[10px] text-slate-400 block">
                      Leave blank to auto-use detected address (<code className="text-slate-300">{appUrl}</code>)
                    </span>
                  </div>

                  <div className="bg-slate-800/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60 space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                      Installation Target Profile
                    </label>
                    <div className="flex space-x-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setInstallerMode('all')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          installerMode === 'all'
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        All-in-One Station
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstallerMode('scanner')}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          installerMode === 'scanner'
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        Scanner Node Only
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {installerMode === 'all' ? 'Installs Web Signage Server + Hardware Agents' : 'Lightweight remote Pi Zero / classroom scanner beacon'}
                    </span>
                  </div>
                </div>

                {/* Primary Terminal Command Box */}
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Run this command on your Raspberry Pi:</span>
                    <div className="flex items-center space-x-2">
                      <a
                        href="/api/install.sh"
                        download="install.sh"
                        className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 font-bold rounded-xl transition cursor-pointer"
                        title="Download raw install.sh script"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download Script</span>
                      </a>
                      <button
                        onClick={() => handleCopy(oneClickCmd, setCopiedOneClick)}
                        className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold rounded-xl transition cursor-pointer shadow-xs"
                      >
                        {copiedOneClick ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Command Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Command</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/90 p-4 rounded-2xl border border-indigo-500/30 font-mono text-xs text-emerald-400 overflow-x-auto select-all">
                    <span className="text-slate-500 select-none">$ </span>{oneClickCmd}
                  </div>

                  {/* Alternative: Local execution if already cloned */}
                  <div className="mt-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        📁 Or if already downloaded / cloned on your Raspberry Pi:
                      </span>
                      <button
                        onClick={() => handleCopy(localRunCmd, setCopiedLocalRun)}
                        className="flex items-center space-x-1 px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 font-bold rounded-lg transition cursor-pointer"
                      >
                        {copiedLocalRun ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="bg-black/80 px-3 py-1.5 rounded-lg font-mono text-xs text-indigo-300 select-all">
                      <span className="text-slate-500 select-none">$ </span>{localRunCmd}
                    </div>
                  </div>

                  {/* HTML Syntax Error Troubleshooting Note */}
                  <div className="mt-3 p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-1">
                    <div className="flex items-center space-x-1.5 font-bold text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Troubleshooting: "syntax error near unexpected token '&lt;!doctype html&gt;'"</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-100/80">
                      This happens when <code>curl</code> downloads an HTML login or preview page instead of the raw bash script. To fix:
                    </p>
                    <ul className="text-[11px] list-disc list-inside space-y-0.5 text-amber-100/80 pl-1 font-mono">
                      <li>Use your local server IP (e.g. <span className="text-white">http://192.168.1.50:3000/install.sh</span>) rather than the cloud preview URL.</li>
                      <li>If curling from GitHub, use <span className="text-white">raw.githubusercontent.com</span> instead of github.com/.../blob/...</li>
                      <li>Or clone the repo on your Pi and execute <span className="text-white">sudo bash install.sh</span> directly.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Detection & Safety Matrix */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Zero Database Overwrite</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If <code className="bg-white px-1 py-0.5 rounded text-indigo-900 font-mono border border-slate-200">presence_db.json</code> exists, the installer enters <strong>Safe Update Mode</strong>. It takes a timestamped safety backup and keeps all lecturers, RFID cards, PINs, history logs, and classroom subnets 100% intact.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs">
                  <RefreshCw className="w-4 h-4 text-indigo-600" />
                  <span>Smart Existing Service Detection</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Autodetects existing systemd units (<code className="text-slate-800 font-mono">presence-agent</code>, <code className="text-slate-800 font-mono">pn532-agent</code>, <code className="text-slate-800 font-mono">lecturedash</code>). Safely pauses them, updates the scripts, and restarts them automatically without reboots.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xs">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>Hardware Auto-Configuration</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatically turns on <strong>I2C</strong> for PN532 and <strong>SPI</strong> for MFRC522 via Raspberry Pi firmware (<code className="text-slate-800 font-mono">raspi-config</code>), and installs <code className="text-slate-800 font-mono">nmap</code>, <code className="text-slate-800 font-mono">traceroute</code>, and CircuitPython drivers.
                </p>
              </div>
            </div>

            {/* Terminal Output Behavior Comparison */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider font-mono">
                How The Installer Behaves in Both Scenarios
              </h4>

              <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-emerald-400 font-bold block pb-1 border-b border-slate-800">
                    Scenario 1: Fresh Installation
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    [1/5] Installing nmap, traceroute, python3-pip...<br />
                    [2/5] Enabling I2C &amp; SPI via raspi-config...<br />
                    [3/5] Deploying presence_agent.py &amp; pn532_agent.py...<br />
                    [4/5] Enabling systemd auto-start services on boot...<br />
                    <span className="text-emerald-400">[✓] INSTALLATION COMPLETED SUCCESSFULLY!</span>
                  </p>
                </div>

                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-amber-300 font-bold block pb-1 border-b border-slate-800">
                    Scenario 2: In-Place Update (Safe Mode)
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    <span className="text-emerald-400">[✓] EXISTING INSTALLATION DETECTED!</span><br />
                    <span className="text-amber-300">[✓] Backup Created: presence_db.backup_...json</span><br />
                    [✓] Database preserved &amp; untouched.<br />
                    [*] Gracefully pausing active services...<br />
                    [*] Updating agent scripts &amp; restarting services...<br />
                    <span className="text-emerald-400">[✓] UPDATE COMPLETED! (Database Preserved)</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeGuideTab === 'wifi' && (
          /* WIFI GUIDE PANEL */
          <div className="space-y-4 animate-fade-in">

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-slate-600" />
                <h3 className="font-bold text-slate-800 text-sm">Setup Python Wi-Fi Sweep</h3>
              </div>
              <button
                onClick={() => handleCopy(pythonScript, setCopiedPython)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
              >
                {copiedPython ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied Script!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy python_agent.py</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-slate-500 space-y-3">
              <p className="font-bold text-slate-800">1. Install network sweep utility on your Raspberry Pi:</p>
              <div className="bg-slate-900 text-slate-300 font-mono p-4 rounded-2xl relative border border-slate-200 shadow-sm overflow-x-auto">
                <button
                  onClick={() => handleCopy(shellCommand, setCopiedShell)}
                  className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Shell Commands"
                >
                  {copiedShell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <span className="text-emerald-500 select-none font-semibold"># Fetch update lists and install Nmap</span><br />
                {shellCommand}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-800">2. Deploy the network script:</p>
              <ul className="list-decimal pl-5 space-y-1.5 text-slate-500 leading-relaxed">
                <li>On the Raspberry Pi, create a new file: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">nano presence_agent.py</code></li>
                <li>Paste the copied script code into the file and save (Ctrl+O, Enter, Ctrl+X).</li>
                <li>Edit the <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800 font-bold">SCAN_SUBNET</code> string parameter to match your LAN IP scope (e.g. <code className="font-bold text-slate-700">192.168.73.0/26</code>).</li>
                <li>Launch the agent: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-850">python3 presence_agent.py</code></li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center">
                <Layers className="w-4 h-4 mr-2 text-slate-600" />
                Keep agent running as a continuous background daemon
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Start the process detached so it performs network loops even when you sign out of the Pi shell session:
              </p>
              <code className="block bg-white p-2.5 rounded-xl font-mono text-[11px] text-slate-600 border border-slate-200 shadow-3xs">
                nohup python3 presence_agent.py &gt; presence_agent.log 2&gt;&amp;1 &amp;
              </code>
            </div>
          </div>
        )}

        {activeGuideTab === 'rfid' && (
          /* RFID RC522 GPIO GUIDE PANEL */
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="font-bold text-slate-800 text-sm">Setup GPIO RFID RC522 Reader</h3>
              </div>
              <button
                onClick={() => handleCopy(rfidScript, setCopiedRfid)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
              >
                {copiedRfid ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied Script!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy rfid_agent.py</span>
                  </>
                )}
              </button>
            </div>

            {/* Hardware Pin Hookups Grid */}
            <div className="text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-800">1. Wire the MFRC522 RC522 Reader to the Raspberry Pi GPIO pins:</p>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono font-bold uppercase">
                      <th className="py-2.5 px-4">RC522 Pin Name</th>
                      <th className="py-2.5 px-4">RPi GPIO Number</th>
                      <th className="py-2.5 px-4">Physical Board Pin Number</th>
                      <th className="py-2.5 px-4">Wire Color Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">SDA (SS)</td>
                      <td className="py-2.5 px-4">GPIO 8</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 24</td>
                      <td className="py-2.5 px-4 text-slate-400">Orange</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">SCK</td>
                      <td className="py-2.5 px-4">GPIO 11</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 23</td>
                      <td className="py-2.5 px-4 text-slate-400">Yellow</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">MOSI</td>
                      <td className="py-2.5 px-4">GPIO 10</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 19</td>
                      <td className="py-2.5 px-4 text-slate-400">Green</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">MISO</td>
                      <td className="py-2.5 px-4">GPIO 9</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 21</td>
                      <td className="py-2.5 px-4 text-slate-400">Blue</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-400">IRQ</td>
                      <td className="py-2.5 px-4">Unused</td>
                      <td className="py-2.5 px-4 text-slate-400">Leave Open</td>
                      <td className="py-2.5 px-4 text-slate-300">--</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">GND</td>
                      <td className="py-2.5 px-4">GND</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 6, 9, 14, 20 or 25</td>
                      <td className="py-2.5 px-4 text-slate-400 font-bold text-black">Black</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">RST</td>
                      <td className="py-2.5 px-4">GPIO 25</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 22</td>
                      <td className="py-2.5 px-4 text-slate-400">White</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">3.3V Power</td>
                      <td className="py-2.5 px-4">3.3V DC</td>
                      <td className="py-2.5 px-4 text-rose-600 font-bold">Pin 1 or Pin 17</td>
                      <td className="py-2.5 px-4 text-rose-500 font-bold">Red (Do NOT connect to 5V!)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-indigo-700">Buzzer (+)</td>
                      <td className="py-2.5 px-4 text-indigo-700">GPIO 16</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 36</td>
                      <td className="py-2.5 px-4 text-slate-500">Audio feedback output (+)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-indigo-700">Buzzer (-)</td>
                      <td className="py-2.5 px-4 text-indigo-700">GND</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 34 or Pin 39</td>
                      <td className="py-2.5 px-4 text-slate-500">Ground return (-)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-3">
              <p className="font-bold text-slate-800">2. Enable SPI bus interface and install python packages:</p>
              <div className="bg-slate-900 text-slate-300 font-mono p-4 rounded-2xl relative border border-slate-200 shadow-sm overflow-x-auto">
                <button
                  onClick={() => handleCopy(rfidShellCommand, setCopiedRfidShell)}
                  className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Setup Shell"
                >
                  {copiedRfidShell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <span className="text-emerald-500 select-none font-semibold"># SPI setup & python dependency installation</span><br />
                {rfidShellCommand}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-800">3. Create and launch the RFID daemon:</p>
              <ul className="list-decimal pl-5 space-y-1.5 text-slate-500 leading-relaxed">
                <li>Create file: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">nano rfid_agent.py</code></li>
                <li>Paste the RFID Python code block into the file and save changes (Ctrl+O, Enter, Ctrl+X).</li>
                <li>Launch the listener: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800 font-bold">python3 rfid_agent.py</code></li>
                <li>To keep the scanner running in the background when the terminal session exits:</li>
              </ul>
              <code className="block bg-slate-50 p-2.5 rounded-xl font-mono text-[11px] text-slate-600 border border-slate-200 mt-2 shadow-3xs">
                nohup python3 rfid_agent.py &gt; rfid_agent.log 2&gt;&amp;1 &amp;
              </code>
            </div>
          </div>
        )}

        {activeGuideTab === 'pn532' && (
          /* PN532 NFC v3 RED BOARD PANEL */
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-emerald-600 animate-pulse" />
                <h3 className="font-bold text-slate-800 text-sm">Setup GPIO PN532 NFC Module V3 (Red Board)</h3>
              </div>
              <button
                onClick={() => handleCopy(pn532Script, setCopiedPn532)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
              >
                {copiedPn532 ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied Script!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy pn532_agent.py</span>
                  </>
                )}
              </button>
            </div>

            {/* Hardware Pin Hookups Grid for PN532 */}
            <div className="text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-800">1. Wire the PN532 Red Board to your Raspberry Pi pins:</p>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-slate-700 leading-relaxed space-y-1">
                <div className="flex items-center space-x-2 text-amber-950 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Important Red Board DIP Switch Settings:</span>
                </div>
                <p>
                  On the red PN532 board, locate the tiny <strong>DIP switch (labeled 1 and 2)</strong>. To select <strong>I2C Mode</strong> (highly recommended since it only needs 4 pins):
                </p>
                <div className="flex items-center space-x-3 mt-1.5 bg-white/70 px-3 py-1.5 rounded-xl border border-amber-200/50 w-fit font-semibold">
                  <span className="text-amber-950">Switch 1: <code className="bg-amber-100 px-1 rounded text-red-700 font-bold">ON</code></span>
                  <span className="text-slate-400">|</span>
                  <span className="text-amber-950">Switch 2: <code className="bg-amber-100 px-1 rounded text-red-700 font-bold">OFF</code></span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-3xs">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono font-bold uppercase">
                      <th className="py-2.5 px-4">PN532 Pin Name</th>
                      <th className="py-2.5 px-4">RPi GPIO / Bus Pin</th>
                      <th className="py-2.5 px-4">Physical Board Pin Number</th>
                      <th className="py-2.5 px-4">Role / Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">SDA (I2C)</td>
                      <td className="py-2.5 px-4">SDA (GPIO 2)</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 3</td>
                      <td className="py-2.5 px-4 text-slate-500">I2C Data line</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">SCL (I2C)</td>
                      <td className="py-2.5 px-4">SCL (GPIO 3)</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 5</td>
                      <td className="py-2.5 px-4 text-slate-500">I2C Clock line</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">GND</td>
                      <td className="py-2.5 px-4">GND</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 6, 9 or 14</td>
                      <td className="py-2.5 px-4 text-slate-400">Ground reference</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-bold text-slate-800">VCC / 5V</td>
                      <td className="py-2.5 px-4">5V DC Power</td>
                      <td className="py-2.5 px-4 text-rose-600 font-bold">Pin 2 or Pin 4</td>
                      <td className="py-2.5 px-4 text-slate-500 font-semibold text-rose-600">5V Power (Provides greater read range)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-indigo-700">Buzzer (+)</td>
                      <td className="py-2.5 px-4 text-indigo-700">GPIO 16 (BCM 16)</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 36</td>
                      <td className="py-2.5 px-4 text-slate-500">Audio feedback output (+)</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-4 font-bold text-indigo-700">Buzzer (-)</td>
                      <td className="py-2.5 px-4 text-indigo-700">GND</td>
                      <td className="py-2.5 px-4 text-indigo-600 font-bold">Pin 34 or Pin 39</td>
                      <td className="py-2.5 px-4 text-slate-500">Ground return (-)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-3">
              <p className="font-bold text-slate-800">2. Enable I2C bus interface and install python packages:</p>
              <div className="bg-slate-900 text-slate-300 font-mono p-4 rounded-2xl relative border border-slate-200 shadow-sm overflow-x-auto">
                <button
                  onClick={() => handleCopy(pn532ShellCommand, setCopiedPn532Shell)}
                  className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy Setup Shell"
                >
                  {copiedPn532Shell ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <span className="text-emerald-500 select-none font-semibold"># I2C configuration & Adafruit installation</span><br />
                {pn532ShellCommand}
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-800">3. Create and launch the PN532 NFC daemon:</p>
              <ul className="list-decimal pl-5 space-y-1.5 text-slate-500 leading-relaxed">
                <li>On the Raspberry Pi, create a new file: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">nano pn532_agent.py</code></li>
                <li>Paste the copied PN532 Python script into the file and save changes (Ctrl+O, Enter, Ctrl+X).</li>
                <li>Launch the listener manually first to test: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800 font-bold">python3 pn532_agent.py</code></li>
                <li>Verify that it detects the firmware version and prints "Ready!". Tap a card to verify it scans correctly.</li>
                <li>Once verified, you can run it continuously in the background:</li>
              </ul>
              <code className="block bg-slate-50 p-2.5 rounded-xl font-mono text-[11px] text-slate-600 border border-slate-200 mt-2 shadow-3xs">
                nohup python3 pn532_agent.py &gt; pn532_agent.log 2&gt;&amp;1 &amp;
              </code>
            </div>
          </div>
        )}

        {activeGuideTab === 'autostart' && (
          /* SYSTEMD AUTOSTART PANEL */
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">Autostart All Services on Boot (systemd)</h3>
              </div>
              <button
                onClick={() => handleCopy(autostartScript, setCopiedAutostart)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
              >
                {copiedAutostart ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied Services Setup!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy systemd Configuration</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed space-y-2">
              <p>
                To run the <strong>Lecturer Presence Web App</strong>, <strong>Wi-Fi Scanner Agent</strong>, and <strong>PN532 RFID Agent</strong> automatically whenever the Raspberry Pi powers on (and auto-restart them if they ever crash), configure systemd unit services.
              </p>
            </div>

            <div className="bg-slate-900 text-slate-300 font-mono p-4 rounded-2xl relative border border-slate-200 shadow-sm overflow-x-auto text-[11px] leading-relaxed">
              <button
                onClick={() => handleCopy(autostartScript, setCopiedAutostart)}
                className="absolute top-3 right-3 p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy Commands"
              >
                {copiedAutostart ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="whitespace-pre-wrap">{autostartScript}</pre>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2 text-xs">
              <h4 className="font-bold text-indigo-950 flex items-center">
                <Terminal className="w-4 h-4 mr-2 text-indigo-600" />
                Useful Management Commands:
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-700 font-mono text-[11px]">
                <li><code className="font-bold text-indigo-900">sudo systemctl status lecturedash</code> (Check web server status & logs)</li>
                <li><code className="font-bold text-indigo-900">sudo systemctl restart presence-agent</code> (Restart Wi-Fi scanner agent)</li>
                <li><code className="font-bold text-indigo-900">sudo journalctl -u lecturedash -f</code> (Live tail logs for Node.js web server)</li>
              </ul>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900">
              <h4 className="font-bold flex items-center text-amber-950">
                <AlertTriangle className="w-4 h-4 mr-2 text-amber-600" />
                Fixing Exit Code 217/USER & 502 Bad Gateway:
              </h4>
              <p className="leading-relaxed">
                <strong>1. Why code=exited, status=217/USER occurs:</strong> systemd failed because <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">User=pi</code> does not exist on your system (e.g., if your user is <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">admin</code>, <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">ubuntu</code>, or another name).
              </p>
              <p className="leading-relaxed">
                <strong>Fix:</strong> Open <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">sudo nano /etc/systemd/system/lecturedash.service</code> and set <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">User=root</code> (or your actual username from <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">whoami</code>). Also make sure <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">WorkingDirectory</code> matches your actual project path.
              </p>
              <p className="leading-relaxed">
                <strong>2. Why Nginx returns 502 Bad Gateway:</strong> Nginx is looking for your web app on port 3000, but because the service crashed, port 3000 is inactive. As soon as <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">lecturedash</code> successfully starts, Nginx 502 will disappear automatically.
              </p>
              <p className="leading-relaxed font-mono text-[11px] bg-amber-100/70 p-2 rounded-xl mt-1">
                cd /home/$USER/lecturerpresence && npm run build<br />
                sudo systemctl daemon-reload && sudo systemctl restart lecturedash
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
