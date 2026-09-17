#!/usr/bin/env python3
"""
LecturerDash - Autonomous Multi-Room Presence Agent (Wi-Fi + BLE)
Features:
1. Passive BLE beacon / badge scanning (zero pairing, zero connection, pure RF sniffing)
2. Routed multi-subnet /26 network ping sweep (nmap -sn -oG -)
3. Direct Layer-2 ARP cache inspection
4. Autonomous hop count and latency measurement
5. Automatic presence report sync to LecturerDash Intranet Server
"""

import subprocess
import re
import json
import urllib.request
import time
import os

# Server endpoints
SERVER_URL = os.environ.get("PRESENCE_SERVER_URL", "http://localhost:3000/api/presence/report")
SERVER_CONFIG_URL = os.environ.get("PRESENCE_CONFIG_URL", "http://localhost:3000/api/network/config")

# Interval between network scans in seconds
SCAN_INTERVAL = int(os.environ.get("PRESENCE_SCAN_INTERVAL", "60"))

# Subnet discovery settings
AUTO_DISCOVER_SUBNETS = True
DEFAULT_FALLBACK_SUBNETS = ["192.168.73.0/26", "192.168.73.64/26", "192.168.73.128/26", "192.168.73.192/26"]

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
            m = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2})", line)
            if m:
                cidr = m.group(1)
                if not cidr.startswith("127.") and not cidr.startswith("0.0.0.0"):
                    subnets.add(cidr)
    except Exception as e:
        print(f"[*] Route table inspection note: {e}")

    # 2. Sync dynamically discovered subnets from presence server
    try:
        req = urllib.request.Request(SERVER_CONFIG_URL, headers={"User-Agent": "PresenceAgent/2.0"})
        with urllib.request.urlopen(req, timeout=4) as res:
            cfg = json.loads(res.read().decode("utf-8"))
            rules = cfg.get("subnetZoneRules", [])
            for r in rules:
                prefix = r.get("subnetCidrOrPrefix", "")
                if "/" in prefix:
                    subnets.add(prefix)
                elif prefix.endswith("."):
                    subnets.add(f"{prefix}0/26")
                    subnets.add(f"{prefix}64/26")
                    subnets.add(f"{prefix}128/26")
                    subnets.add(f"{prefix}192/26")
    except Exception:
        pass

    if not subnets:
        return DEFAULT_FALLBACK_SUBNETS
    return sorted(list(subnets))

def get_device_hops(ip):
    """
    Measures routing distance (hop count) and latency to the target device:
    1 Hop  = Direct layer-2 Wi-Fi association in Lecturer Room.
    2 Hops = Routed through Staff Room Access Point.
    3 Hops = Routed through Classroom / Floor distribution AP.
    """
    try:
        res = subprocess.run(
            ["traceroute", "-n", "-m", "4", "-w", "1", ip],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=3
        )
        lines = [l.strip() for l in res.stdout.decode().splitlines() if l.strip() and not l.startswith("traceroute")]
        if lines:
            return max(1, len(lines))
    except Exception:
        pass

    # Deterministic fallback based on 255.255.255.192 (/26) subnet division
    try:
        last_octet = int(ip.split(".")[-1])
        block = last_octet // 64
        if block == 0: return 1   # .0 - .63 = Direct AP (Lecturer Room)
        elif block == 1: return 2 # .64 - .127 = Staff Room AP
        else: return 3            # .128 - .255 = Lab / Corridor AP
    except Exception:
        return 1

def scan_ble(duration_sec=3):
    """
    Pure passive Bluetooth Low Energy (BLE) beacon detection.
    Zero pairing, zero connection, zero battery drain on target devices.
    Listens for incoming advertising packets (iBeacon, Eddystone, BLE Badges, Smartwatches).
    """
    ble_devices = []
    seen_ble_macs = set()
    try:
        cmd = ["hcitool", "lescan", "--duplicates"]
        if os.geteuid() != 0:
            cmd = ["sudo", "-n"] + cmd
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        time.sleep(duration_sec)
        proc.terminate()
        try:
            stdout, _ = proc.communicate(timeout=1)
        except Exception:
            proc.kill()
            stdout, _ = proc.communicate()

        for line in stdout.splitlines():
            m = re.match(r"^([0-9A-Fa-f:]{17})", line.strip())
            if m:
                mac = m.group(1).lower()
                if mac not in seen_ble_macs:
                    seen_ble_macs.add(mac)
                    ble_devices.append({"mac": mac, "rssi": -65})
        if ble_devices:
            print(f"[+] Passive BLE: Captured {len(ble_devices)} broadcasting beacon/badge(s)")
    except Exception as e:
        print(f"[-] BLE scan note: {e}")
    return ble_devices

def scan_network():
    active_subnets = discover_active_subnets() if AUTO_DISCOVER_SUBNETS else DEFAULT_FALLBACK_SUBNETS
    print(f"\n[Scanning] Multi-subnet sweep across {len(active_subnets)} subnet(s): {', '.join(active_subnets)}")
    
    nmap_alive_ips = set()
    for subnet in active_subnets:
        try:
            res = subprocess.run(["nmap", "-sn", "-oG", "-", subnet], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=15)
            for line in res.stdout.splitlines():
                if "Status: Up" in line:
                    m = re.search(r"Host:\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", line)
                    if m:
                        nmap_alive_ips.add(m.group(1))
        except Exception:
            pass

    devices = []
    seen_macs = set()
    seen_ips = set()
    try:
        arp_output = subprocess.check_output(["arp", "-an"]).decode("utf-8")
        pattern = re.compile(r"\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\) at ([0-9a-fA-F:]{17})")
        
        for line in arp_output.splitlines():
            match = pattern.search(line)
            if match:
                ip = match.group(1)
                mac = match.group(2).lower()
                if mac not in seen_macs and mac != "ff:ff:ff:ff:ff:ff":
                    seen_macs.add(mac)
                    seen_ips.add(ip)
                    hops = get_device_hops(ip)
                    devices.append({
                        "mac": mac,
                        "ip": ip,
                        "hops": hops
                    })
                    print(f"[+] Active Wi-Fi Device: IP={ip} | MAC={mac} | Hops={hops}")
    except Exception as e:
        print(f"[-] Error reading ARP cache: {e}")

    # Include alive IPs from routed subnets that might not populate the link-local ARP table
    for alive_ip in nmap_alive_ips:
        if alive_ip not in seen_ips and not alive_ip.endswith(".0") and not alive_ip.endswith(".63") and not alive_ip.endswith(".127") and not alive_ip.endswith(".191") and not alive_ip.endswith(".255"):
            hops = get_device_hops(alive_ip)
            devices.append({
                "mac": "",
                "ip": alive_ip,
                "hops": hops
            })
            seen_ips.add(alive_ip)
        
    return devices

def report_presence(devices, ble_devices=None):
    ble_count = len(ble_devices) if ble_devices else 0
    print(f"[Reporting] Sending {len(devices)} active Wi-Fi devices and {ble_count} BLE beacons to presence server...")
    payload = {"devices": devices}
    if ble_devices:
        payload["bleDevices"] = ble_devices
    data = json.dumps(payload).encode("utf-8")
    
    req = urllib.request.Request(
        SERVER_URL, 
        data=data, 
        headers={
            "Content-Type": "application/json",
            "User-Agent": "PresenceAgent/2.0"
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
    print("   Autonomous Multi-Room Presence Agent (Wi-Fi+BLE) ")
    print("==================================================")
    print(f"Local Server URL:   {SERVER_URL}")
    print(f"Auto-Discovery:     {'ENABLED' if AUTO_DISCOVER_SUBNETS else 'DISABLED'}")
    print(f"Scan Interval:      {SCAN_INTERVAL} seconds")
    print("==================================================")
    
    while True:
        try:
            active_wifi = scan_network()
            active_ble = scan_ble(duration_sec=3)
            report_presence(active_wifi, active_ble)
        except KeyboardInterrupt:
            print("\nExiting presence agent...")
            break
        except Exception as e:
            print(f"[-] Unexpected error: {e}")
        
        time.sleep(SCAN_INTERVAL)
