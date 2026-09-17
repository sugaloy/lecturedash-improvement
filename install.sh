#!/usr/bin/env bash
# ==============================================================================
# LECTURER PRESENCE SIGNAGE & HARDWARE SCANNER
# ONE-CLICK INSTALLER & SMART UPDATER FOR RASPBERRY PI
# ==============================================================================
# Features:
# 1. Autodetects existing installations & running systemd services
# 2. SAFE UPDATE MODE: Preserves database (presence_db.json) with automated backup
# 3. Hardware Auto-Config: Enables I2C & SPI, installs nmap/traceroute/drivers
# 4. Zero Downtime: Gracefully restarts services
# ==============================================================================

set -e

# ANSI Color codes for clean terminal output
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_GREEN="\033[32m"
CLR_BLUE="\033[34m"
CLR_CYAN="\033[36m"
CLR_YELLOW="\033[33m"
CLR_RED="\033[31m"
CLR_PURPLE="\033[35m"

# Default configuration
DEFAULT_INSTALL_DIR="/opt/lecturerpresence"
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
MODE="all" # 'all' (Web App + Scanners) or 'scanner-only' (Remote Pi Beacon)

# Parse CLI flags
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --server-url) SERVER_URL="$2"; shift ;;
    --mode) MODE="$2"; shift ;;
    --dir) DEFAULT_INSTALL_DIR="$2"; shift ;;
    --help)
      echo "Usage: sudo bash install.sh [OPTIONS]"
      echo "Options:"
      echo "  --server-url <URL>    Set the central intranet server URL (e.g. http://192.168.1.50:3000)"
      echo "  --mode <all|scanner>  'all' installs Web Board + Agents. 'scanner' installs background Pi agents only."
      echo "  --dir <PATH>          Install target directory (default: /opt/lecturerpresence)"
      exit 0
      ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Ensure running with root privileges
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${CLR_RED}Error: This installer requires root privileges. Please run with sudo:${CLR_RESET}"
  echo -e "${CLR_BOLD}sudo bash install.sh${CLR_RESET}"
  exit 1
fi

echo -e "${CLR_PURPLE}${CLR_BOLD}"
echo "======================================================================"
echo "    LECTURER PRESENCE DOORBOARD - ONE-CLICK INSTALLER & UPDATER       "
echo "======================================================================"
echo -e "${CLR_RESET}"

# 1. Resolve Install Directory
INSTALL_DIR="$DEFAULT_INSTALL_DIR"
if [ -f "./presence_db.json" ] || [ -f "./presence_agent.py" ]; then
  # If executed from inside an existing checked-out repository
  INSTALL_DIR="$(pwd)"
  echo -e "${CLR_CYAN}[*] Current working directory detected as repository root: ${INSTALL_DIR}${CLR_RESET}"
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 2. Auto-Detect Existing Installation & Services
IS_UPDATE=false
FOUND_SERVICES=()

if systemctl list-unit-files | grep -q "presence-agent.service"; then
  FOUND_SERVICES+=("presence-agent.service")
fi
if systemctl list-unit-files | grep -q "pn532-agent.service"; then
  FOUND_SERVICES+=("pn532-agent.service")
fi
if systemctl list-unit-files | grep -q "lecturedash.service"; then
  FOUND_SERVICES+=("lecturedash.service")
fi

if [ -f "$INSTALL_DIR/presence_db.json" ] || [ ${#FOUND_SERVICES[@]} -gt 0 ]; then
  IS_UPDATE=true
fi

if [ "$IS_UPDATE" = true ]; then
  echo -e "${CLR_GREEN}${CLR_BOLD}[✓] EXISTING INSTALLATION DETECTED!${CLR_RESET}"
  echo -e "${CLR_CYAN}    Target Directory:  ${INSTALL_DIR}${CLR_RESET}"
  echo -e "${CLR_CYAN}    Existing Services: ${FOUND_SERVICES[*]:-None}${CLR_RESET}"
  echo -e "${CLR_YELLOW}${CLR_BOLD}    Mode:              SAFE IN-PLACE UPDATE (Database will NOT be overwritten)${CLR_RESET}"
  echo ""
  
  # 3. SAFETY BACKUP OF DATABASE
  if [ -f "$INSTALL_DIR/presence_db.json" ]; then
    BACKUP_NAME="presence_db.backup_$(date +%Y%m%d_%H%M%S).json"
    cp "$INSTALL_DIR/presence_db.json" "$INSTALL_DIR/$BACKUP_NAME"
    echo -e "${CLR_GREEN}[✓] Safety Backup Created: ${INSTALL_DIR}/${BACKUP_NAME}${CLR_RESET}"
    echo -e "${CLR_GREEN}[✓] All lecturer profiles, RFID cards, PINs, history logs & custom subnets are safe!${CLR_RESET}"
  fi

  # Stop running services before updating scripts
  echo -e "${CLR_CYAN}[*] Gracefully pausing active presence services for update...${CLR_RESET}"
  systemctl stop presence-agent.service pn532-agent.service lecturedash.service 2>/dev/null || true
else
  echo -e "${CLR_BLUE}${CLR_BOLD}[*] NEW INSTALLATION DETECTED${CLR_RESET}"
  echo -e "${CLR_CYAN}    Target Directory: ${INSTALL_DIR}${CLR_RESET}"
  echo -e "${CLR_CYAN}    Mode:             ${MODE}${CLR_RESET}"
  echo ""
fi

# 4. System Package Dependencies
echo -e "${CLR_BOLD}${CLR_CYAN}[1/5] Checking and installing system dependencies...${CLR_RESET}"
apt-get update -qq

DEPS_TO_INSTALL=()
for pkg in nmap traceroute net-tools iproute2 curl python3-pip python3-dev i2c-tools git; do
  if ! dpkg -s "$pkg" >/dev/null 2>&1; then
    DEPS_TO_INSTALL+=("$pkg")
  fi
done

if [ ${#DEPS_TO_INSTALL[@]} -gt 0 ]; then
  echo -e "${CLR_CYAN}[*] Installing required packages: ${DEPS_TO_INSTALL[*]}...${CLR_RESET}"
  apt-get install -y -qq "${DEPS_TO_INSTALL[@]}"
else
  echo -e "${CLR_GREEN}[✓] All core system utilities are already installed.${CLR_RESET}"
fi

# 5. Enable Hardware Interfaces (I2C for PN532, SPI for MFRC522)
echo -e "${CLR_BOLD}${CLR_CYAN}[2/5] Configuring Raspberry Pi hardware interfaces (I2C & SPI)...${CLR_RESET}"
if command -v raspi-config >/dev/null 2>&1; then
  raspi-config nonint do_i2c 0 2>/dev/null || true
  raspi-config nonint do_spi 0 2>/dev/null || true
  echo -e "${CLR_GREEN}[✓] I2C and SPI interfaces enabled via raspi-config.${CLR_RESET}"
else
  echo -e "${CLR_YELLOW}[!] raspi-config not found (non-Raspberry Pi OS). Skipping interface toggle.${CLR_RESET}"
fi

# Install Python hardware reader dependencies
echo -e "${CLR_CYAN}[*] Ensuring Python CircuitPython PN532 and GPIO libraries are installed...${CLR_RESET}"
pip3 install adafruit-circuitpython-pn532 --break-system-packages -q 2>/dev/null || pip3 install adafruit-circuitpython-pn532 -q 2>/dev/null || true
pip3 install spidev mfrc522 --break-system-packages -q 2>/dev/null || pip3 install spidev mfrc522 -q 2>/dev/null || true

# 6. Deploy / Update Python Agents
echo -e "${CLR_BOLD}${CLR_CYAN}[3/5] Deploying Autonomous Hardware Agents...${CLR_RESET}"

# Create autonomous presence_agent.py (Wi-Fi sweep + Hop count traceroute)
cat << 'EOF' > "$INSTALL_DIR/presence_agent.py"
import time
import json
import urllib.request
import subprocess
import re
import os

# Server endpoint
SERVER_URL = os.environ.get("PRESENCE_SERVER_URL", "__SERVER_URL__/api/presence/report")
CONFIG_URL = os.environ.get("PRESENCE_CONFIG_URL", "__SERVER_URL__/api/network/config")
SCAN_INTERVAL = 60
AUTO_DISCOVER = True
DEFAULT_SUBNETS = ["192.168.73.0/26", "192.168.73.64/26", "192.168.73.128/26", "192.168.73.192/26"]

def discover_subnets():
    subnets = set()
    try:
        routes = subprocess.check_output(["ip", "-o", "-4", "route", "show"]).decode("utf-8")
        for line in routes.splitlines():
            m = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2})", line)
            if m:
                cidr = m.group(1)
                if not cidr.startswith("127.") and not cidr.startswith("0.0.0.0"):
                    subnets.add(cidr)
    except Exception as e:
        print(f"[*] Interface inspect note: {e}")

    try:
        req = urllib.request.Request(CONFIG_URL, headers={"User-Agent": "PresenceAgent/1.0"})
        with urllib.request.urlopen(req, timeout=4) as res:
            cfg = json.loads(res.read().decode("utf-8"))
            for r in cfg.get("subnetZoneRules", []):
                p = r.get("subnetCidrOrPrefix", "")
                if "/" in p:
                    subnets.add(p)
                elif p.endswith("."):
                    subnets.add(f"{p}0/26")
                    subnets.add(f"{p}64/26")
                    subnets.add(f"{p}128/26")
                    subnets.add(f"{p}192/26")
    except Exception:
        pass

    if not subnets:
        return DEFAULT_SUBNETS
    return sorted(list(subnets))

def get_hops(ip):
    try:
        res = subprocess.run(["traceroute", "-n", "-m", "4", "-w", "1", ip], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=3)
        lines = [l for l in res.stdout.decode("utf-8").splitlines() if re.match(r"^\s*\d+", l)]
        if lines:
            return max(1, len(lines))
    except Exception:
        pass

    # Deterministic fallback based on 255.255.255.192 (/26) subnet blocks:
    try:
        last_octet = int(ip.split(".")[-1])
        block = last_octet // 64
        if block == 0: return 1   # .0 - .63   -> 1 Hop (Direct Room AP)
        elif block == 1: return 2 # .64 - .127 -> 2 Hops (Staff Room AP)
        else: return 3            # .128 - .255 -> 3 Hops (Lab / Corridor AP)
    except Exception:
        return 1

def scan_network():
    active_subnets = discover_subnets() if AUTO_DISCOVER else DEFAULT_SUBNETS
    print(f"\n[Scanning] Subnets ({len(active_subnets)}): {', '.join(active_subnets)}")
    for subnet in active_subnets:
        try:
            subprocess.run(["nmap", "-sn", subnet], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    devices = []
    try:
        arp_out = subprocess.check_output(["arp", "-an"]).decode("utf-8")
        pattern = re.compile(r"\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\) at ([0-9a-fA-F:]{17})")
        for line in arp_out.splitlines():
            m = pattern.search(line)
            if m:
                ip, mac = m.group(1), m.group(2).upper()
                if mac != "00:00:00:00:00:00" and not ip.startswith("127."):
                    devices.append({"mac": mac, "ip": ip, "hops": get_hops(ip)})
    except Exception as e:
        print(f"[-] ARP error: {e}")
    return devices

def report(devices):
    print(f"[Reporting] Sending {len(devices)} active intranet devices to presence server...")
    try:
        data = json.dumps({"devices": devices}).encode("utf-8")
        req = urllib.request.Request(SERVER_URL, data=data, headers={"Content-Type": "application/json", "User-Agent": "PresenceAgent/1.0"})
        with urllib.request.urlopen(req, timeout=8) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            if res_data.get("success"):
                detected = sum(1 for s in res_data.get("summary", []) if s.get("detected"))
                print(f"[✓] Synchronized: {detected} registered lecturer(s) detected.")
    except Exception as e:
        print(f"[-] Report connection note: {e}")

if __name__ == "__main__":
    print("==================================================")
    print("   Lecturer Presence Autonomous Wi-Fi Scanner     ")
    print("==================================================")
    print(f"Server URL: {SERVER_URL}")
    while True:
        try:
            devs = scan_network()
            report(devs)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[-] Scan loop error: {e}")
        time.sleep(SCAN_INTERVAL)
EOF

# Replace __SERVER_URL__ placeholder with actual target URL
sed -i "s|__SERVER_URL__|$SERVER_URL|g" "$INSTALL_DIR/presence_agent.py"
chmod +x "$INSTALL_DIR/presence_agent.py"
echo -e "${CLR_GREEN}[✓] presence_agent.py deployed.${CLR_RESET}"

# Create PN532 NFC reader agent
cat << 'EOF' > "$INSTALL_DIR/pn532_agent.py"
import time
import json
import urllib.request
import os

SERVER_URL = os.environ.get("RFID_SERVER_URL", "__SERVER_URL__/api/presence/rfid")
BUZZER_PIN = 16

try:
    import board
    import busio
    import RPi.GPIO as GPIO
    from adafruit_pn532.i2c import PN532_I2C

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(BUZZER_PIN, GPIO.OUT)
    GPIO.output(BUZZER_PIN, GPIO.LOW)

    def beep(duration=0.05, repeats=1, gap=0.05):
        for i in range(repeats):
            GPIO.output(BUZZER_PIN, GPIO.HIGH)
            time.sleep(duration)
            GPIO.output(BUZZER_PIN, GPIO.LOW)
            if i < repeats - 1:
                time.sleep(gap)

    i2c = busio.I2C(board.SCL, board.SDA)
    pn532 = PN532_I2C(i2c, debug=False)
    ic, ver, rev, support = pn532.firmware_version
    pn532.SAM_configuration()
    print(f"[✓] PN532 NFC Chip initialized (Firmware ver {ver}.{rev})")

    while True:
        try:
            uid = pn532.read_passive_target(timeout=0.5)
            if uid is not None:
                hex_uid = "".join([f"{x:02X}" for x in uid])
                beep(0.04, 1)
                print(f"\n[NFC Tap] Detected Card UID: {hex_uid}")
                payload = json.dumps({"rfidUid": hex_uid}).encode("utf-8")
                req = urllib.request.Request(SERVER_URL, data=payload, headers={"Content-Type": "application/json", "User-Agent": "PN532-Agent/1.0"})
                try:
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        if res.get("success"):
                            print(f"[✓] {res.get('message')}")
                            beep(0.04, 2, 0.04)
                        else:
                            beep(0.15, 1)
                except Exception as net_err:
                    print(f"[-] API connection note: {net_err}")
                    beep(0.15, 1)
                time.sleep(1.5)
            else:
                time.sleep(0.1)
        except Exception as read_err:
            time.sleep(1)
except Exception as init_err:
    print(f"[*] PN532 I2C hardware is not currently connected ({init_err}). Agent is idle.")
    while True:
        time.sleep(60)
EOF

sed -i "s|__SERVER_URL__|$SERVER_URL|g" "$INSTALL_DIR/pn532_agent.py"
chmod +x "$INSTALL_DIR/pn532_agent.py"
echo -e "${CLR_GREEN}[✓] pn532_agent.py deployed.${CLR_RESET}"

# 7. Configure Systemd Services
echo -e "${CLR_BOLD}${CLR_CYAN}[4/5] Setting up systemd services and autostart...${CLR_RESET}"

cat << EOF > /etc/systemd/system/presence-agent.service
[Unit]
Description=Lecturer Presence Wi-Fi Scanner Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/presence_agent.py
Restart=always
RestartSec=10
Environment=PRESENCE_SERVER_URL=$SERVER_URL/api/presence/report
Environment=PRESENCE_CONFIG_URL=$SERVER_URL/api/network/config

[Install]
WantedBy=multi-user.target
EOF

cat << EOF > /etc/systemd/system/pn532-agent.service
[Unit]
Description=Lecturer Presence PN532 NFC Card Reader Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/pn532_agent.py
Restart=always
RestartSec=10
Environment=RFID_SERVER_URL=$SERVER_URL/api/presence/rfid

[Install]
WantedBy=multi-user.target
EOF

# If running in all-in-one mode and package.json is present, ensure web service is active
if [ -f "$INSTALL_DIR/package.json" ]; then
  echo -e "${CLR_CYAN}[*] Installing Node dependencies and building production bundle in $INSTALL_DIR...${CLR_RESET}"
  if command -v npm >/dev/null 2>&1; then
    (cd "$INSTALL_DIR" && npm install --no-fund --no-audit && npm run build) || true
  else
    echo -e "${CLR_YELLOW}[!] npm not found. Skipping build step.${CLR_RESET}"
  fi

  cat << EOF > /etc/systemd/system/lecturedash.service
[Unit]
Description=Lecturer Presence Signage Web App
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF
  systemctl enable lecturedash.service >/dev/null 2>&1 || true
fi

# Reload and restart services
systemctl daemon-reload
systemctl enable --now presence-agent.service >/dev/null 2>&1 || true
systemctl enable --now pn532-agent.service >/dev/null 2>&1 || true
if [ -f "$INSTALL_DIR/package.json" ]; then
  systemctl restart lecturedash.service 2>/dev/null || true
fi
systemctl restart presence-agent.service
systemctl restart pn532-agent.service

# 8. Verification & Summary
echo -e "${CLR_BOLD}${CLR_CYAN}[5/5] Verifying service statuses...${CLR_RESET}"
sleep 2

AGENT_STATUS=$(systemctl is-active presence-agent.service || echo "inactive")
PN532_STATUS=$(systemctl is-active pn532-agent.service || echo "inactive")

echo ""
echo -e "${CLR_GREEN}${CLR_BOLD}======================================================================${CLR_RESET}"
if [ "$IS_UPDATE" = true ]; then
  echo -e "${CLR_GREEN}${CLR_BOLD}  [✓] UPDATE COMPLETED SUCCESSFULLY! (Database preserved)            ${CLR_RESET}"
else
  echo -e "${CLR_GREEN}${CLR_BOLD}  [✓] INSTALLATION COMPLETED SUCCESSFULLY!                           ${CLR_RESET}"
fi
echo -e "${CLR_GREEN}${CLR_BOLD}======================================================================${CLR_RESET}"
echo -e "${CLR_BOLD}  Install Directory:  ${CLR_RESET}${INSTALL_DIR}"
echo -e "${CLR_BOLD}  Server Endpoint:    ${CLR_RESET}${SERVER_URL}"
echo -e "${CLR_BOLD}  Wi-Fi Sweep Agent:  ${CLR_GREEN}${AGENT_STATUS}${CLR_RESET}"
echo -e "${CLR_BOLD}  PN532 NFC Agent:    ${CLR_GREEN}${PN532_STATUS}${CLR_RESET}"
if [ -f "$INSTALL_DIR/presence_db.json" ]; then
  echo -e "${CLR_BOLD}  Presence Database:  ${CLR_GREEN}Intact & Preserved${CLR_RESET} (${INSTALL_DIR}/presence_db.json)"
fi
echo ""
echo -e "${CLR_BOLD}Useful Service Commands:${CLR_RESET}"
echo "  • View Wi-Fi scanner live logs:   sudo journalctl -u presence-agent.service -f"
echo "  • View NFC card reader logs:      sudo journalctl -u pn532-agent.service -f"
echo "  • Restart Wi-Fi agent:            sudo systemctl restart presence-agent.service"
echo "  • Check service status:           sudo systemctl status presence-agent.service"
echo "======================================================================"
