import React, { useState, useEffect } from 'react';
import { Lecturer, SubnetZoneRule, TracerouteHop, NetworkPresenceInfo } from '../types';
import { 
  Route, Wifi, WifiOff, Server, Smartphone, Activity, HelpCircle, 
  RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Settings, 
  MapPin, Shield, Radio, Search, Plus, Trash2, Check,
  Sparkles, Edit2, Play, Building2, X, Lock
} from 'lucide-react';
import { TracerouteModal } from './TracerouteModal';

interface NetworkDiagnosticsViewProps {
  lecturers: Lecturer[];
  onLecturerUpdated?: () => void;
  onNavigateToAdmin?: () => void;
}

export const NetworkDiagnosticsView: React.FC<NetworkDiagnosticsViewProps> = ({
  lecturers,
  onLecturerUpdated,
  onNavigateToAdmin,
}) => {
  const [routerIp, setRouterIp] = useState('192.168.1.1');
  const [subnetRules, setSubnetRules] = useState<SubnetZoneRule[]>([]);
  const [scannedDevices, setScannedDevices] = useState<any[]>([]);
  const [autoDiscoverSubnets, setAutoDiscoverSubnets] = useState<boolean>(true);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Live traceroute test state
  const [targetType, setTargetType] = useState<'lecturer' | 'custom'>('lecturer');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(lecturers[0]?.id || '');
  const [customIp, setCustomIp] = useState('192.168.2.112');
  const [customMac, setCustomMac] = useState('00:11:22:33:44:55');
  const [simulatedHopOverride, setSimulatedHopOverride] = useState<number>(0);
  
  const [isTracing, setIsTracing] = useState(false);
  const [activeTraceResult, setActiveTraceResult] = useState<NetworkPresenceInfo | null>(null);
  const [traceFeedback, setTraceFeedback] = useState<string | null>(null);

  // Modal for individual lecturer
  const [modalLecturer, setModalLecturer] = useState<Lecturer | null>(null);

  // Fetch current network config (read-only for general viewers)
  const fetchNetworkConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const res = await fetch('/api/network/config');
      const data = await res.json();
      if (data.success) {
        setRouterIp(data.routerIp || '192.168.1.1');
        setSubnetRules(data.subnetZoneRules || []);
        setScannedDevices(data.activeScannedDevices || []);
        setAutoDiscoverSubnets(data.autoDiscoverSubnets !== false);
      }
    } catch (err) {
      console.error("Error loading network config:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchNetworkConfig();
  }, []);

  // Update selected lecturer when list updates
  useEffect(() => {
    if (!selectedLecturerId && lecturers.length > 0) {
      setSelectedLecturerId(lecturers[0].id);
    }
  }, [lecturers]);

  const handleRunTraceProbe = async () => {
    setIsTracing(true);
    setTraceFeedback(null);
    try {
      if (targetType === 'lecturer') {
        const lect = lecturers.find(l => l.id === selectedLecturerId);
        if (!lect) throw new Error('Lecturer not found');

        const res = await fetch(`/api/traceroute/${lect.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.success && data.networkInfo) {
          setActiveTraceResult(data.networkInfo);
          setTraceFeedback(`Trace completed: ${data.networkInfo.hops} hop(s) to ${lect.name} (${data.networkInfo.ip})`);
          if (onLecturerUpdated) onLecturerUpdated();
        } else {
          throw new Error(data.error || 'Traceroute probe failed');
        }
      } else {
        const res = await fetch('/api/traceroute/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: customIp,
            mac: customMac,
            simulatedHops: simulatedHopOverride > 0 ? simulatedHopOverride : undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.networkInfo) {
          setActiveTraceResult(data.networkInfo);
          setTraceFeedback(`Probe completed: ${data.networkInfo.hops} hop(s) to ${customIp}`);
        } else {
          throw new Error(data.error || 'Traceroute probe failed');
        }
      }
    } catch (err: any) {
      setTraceFeedback(`Error: ${err.message}`);
    } finally {
      setIsTracing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner Header */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Route className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-indigo-400">
              Intranet Topology Diagnostics
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Traceroute & Hop Distance Analyzer
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Measures the exact layer-3 routing hop count from the <strong>Lecturer Room Router</strong> to any faculty device MAC/IP.
            Solves multi-AP roaming confusion where office devices temporarily receive Staff Room Access Point IP leases.
          </p>
        </div>

        {/* Top Right Quick Stats */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-800/60 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Subnet Mask</span>
            <span className="text-xs font-mono font-bold text-cyan-400 mt-0.5 block">255.255.255.192 (/26)</span>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Active Router</span>
            <span className="text-sm font-mono font-bold text-indigo-300 mt-0.5 block">{routerIp}</span>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">In-Room Hops</span>
            <span className="text-sm font-bold text-emerald-400 mt-0.5 block">1 Hop (Direct AP)</span>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Multi-Room Hops</span>
            <span className="text-sm font-bold text-amber-400 mt-0.5 block">2-3 Hops (Staff/Lab)</span>
          </div>
          <div className="bg-slate-800/60 backdrop-blur-xs p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Subnet Discovery</span>
            <span className={`text-sm font-bold mt-0.5 flex items-center space-x-1.5 ${autoDiscoverSubnets ? 'text-emerald-400' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${autoDiscoverSubnets ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span>{autoDiscoverSubnets ? 'Autonomous' : 'Manual'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Roaming & IP Confusion Explanation Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-amber-50 rounded-2xl text-amber-600 border border-amber-200/60 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">
              Why do devices inside the office get assigned Staff Room IP addresses?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              In university departments, the <strong>Lecturer Room (Ruang Dosen 1)</strong> and adjacent <strong>Staff Room (Ruang Staf)</strong> share overlapping Wi-Fi coverage across walls. Understanding this prevents false absence reports:
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
              <strong className="text-xs text-slate-900 font-bold">Sticky Wi-Fi Association</strong>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mobile phones only disconnect from an AP when signal drops below roughly -75dBm. If a lecturer walked by the staff room door, their device stays bound to the Staff Room AP even when seated at their office desk.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
              <strong className="text-xs text-slate-900 font-bold">Independent DHCP Pools</strong>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ruang Dosen operates on <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">192.168.1.0/24</code>, while the Staff Room operates on <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">192.168.2.0/24</code>. DHCP lease expiry takes 12-24 hours unless forced.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">3</span>
              <strong className="text-xs text-slate-900 font-bold">Hop Count Resolves Location</strong>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Traceroute probes reveal the physical route: <strong>1 Hop</strong> means direct wireless association to the Lecturer Room router; <strong>2 Hops</strong> traverses the inter-AP staff room gateway.
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section: Live Traceroute Probe & Subnet Rules */}
      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* Left Column: Live Traceroute Probe Tool (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Run Live Traceroute Probe</h3>
                  <p className="text-xs text-slate-500">Trace hop count and routing path from local router</p>
                </div>
              </div>

              {/* Target Type Selector */}
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTargetType('lecturer')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    targetType === 'lecturer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Lecturer
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    targetType === 'custom' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Custom IP / MAC
                </button>
              </div>
            </div>

            {/* Input Selectors */}
            {targetType === 'lecturer' ? (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">Select Faculty Member:</label>
                <select
                  value={selectedLecturerId}
                  onChange={(e) => setSelectedLecturerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {lecturers.map((l) => {
                    const isOnline = !!l.isPresentToday && !!l.isDeviceDetected && l.status !== 'Out of Office';
                    const hopText = isOnline ? `${l.networkInfo?.hops || 1} Hop` : 'Offline';
                    return (
                      <option key={l.id} value={l.id}>
                        {l.name} — {l.ipAddress || 'No IP'} ({l.macAddress || 'No MAC'}) [{hopText}]
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Target IP Address:</label>
                  <input
                    type="text"
                    value={customIp}
                    onChange={(e) => setCustomIp(e.target.value)}
                    placeholder="e.g. 192.168.2.112"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Target MAC Address:</label>
                  <input
                    type="text"
                    value={customMac}
                    onChange={(e) => setCustomMac(e.target.value)}
                    placeholder="e.g. 00:11:22:33:44:55"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Quick Test Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400">Quick Test Scenarios:</span>
              <button
                type="button"
                onClick={() => {
                  setTargetType('custom');
                  setCustomIp('192.168.1.45');
                  setCustomMac('fc:a1:3e:8b:2d:4c');
                  setSimulatedHopOverride(1);
                }}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                In Lecturer Room (1 Hop)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('custom');
                  setCustomIp('192.168.2.112');
                  setCustomMac('00:11:22:33:44:55');
                  setSimulatedHopOverride(2);
                }}
                className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                Staff Room AP (2 Hops)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('custom');
                  setCustomIp('192.168.73.40');
                  setCustomMac('88:77:66:55:44:33');
                  setSimulatedHopOverride(3);
                }}
                className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                Corridor AP (3 Hops)
              </button>
            </div>

            {/* Execute Trace Button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleRunTraceProbe}
                disabled={isTracing}
                className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isTracing ? 'animate-spin' : ''}`} />
                <span>{isTracing ? 'Tracing Hop Route...' : 'Execute Traceroute Probe'}</span>
              </button>

              {traceFeedback && (
                <span className="text-xs text-slate-500 font-mono truncate max-w-xs">
                  {traceFeedback}
                </span>
              )}
            </div>

            {/* Active Trace Result Breakdown */}
            {activeTraceResult && (
              <div className="pt-4 border-t border-slate-200 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                    Probe Analysis Output
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    activeTraceResult.hops === 1 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {activeTraceResult.hops} {activeTraceResult.hops === 1 ? 'Hop (Direct)' : 'Hops (Intermediate)'}
                  </span>
                </div>

                {/* Metric Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Hops From Router</span>
                    <strong className="text-lg font-black text-slate-900 block mt-0.5">{activeTraceResult.hops} Hop(s)</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Round-Trip Ping</span>
                    <strong className="text-lg font-black text-emerald-600 block mt-0.5">{activeTraceResult.latencyMs} ms</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Estimated Zone</span>
                    <strong className="text-xs font-bold text-indigo-700 block mt-1 truncate">{activeTraceResult.detectedZone}</strong>
                  </div>
                </div>

                {/* Hop Path List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 block">Routing Hops Traversed:</span>
                  {activeTraceResult.traceroutePath.map((hop) => (
                    <div key={hop.hop} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center">
                          {hop.hop}
                        </span>
                        <div>
                          <span className="font-mono font-bold text-slate-900">{hop.ip}</span>
                          <span className="text-[10px] text-slate-500 ml-2">({hop.label})</span>
                        </div>
                      </div>
                      <span className="font-mono text-emerald-600 font-bold text-[11px]">{hop.rttMs} ms</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 leading-relaxed">
                  <strong>Diagnostic Note: </strong>
                  {activeTraceResult.explanation}
                </div>
              </div>
            )}
          </div>

          {/* Active Faculty Hop Distance Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Faculty Router Distance Directory</h3>
                <p className="text-xs text-slate-500">Live hop count & AP zone mapping for all lecturers</p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded-lg">
                {lecturers.length} Lecturers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Lecturer</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Hops</th>
                    <th className="py-2.5 px-3">Detected AP Zone</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lecturers.map((lect) => {
                    const isOnline = !!lect.isPresentToday && !!lect.isDeviceDetected && lect.status !== 'Out of Office';
                    const hops = isOnline ? (lect.networkInfo?.hops || 1) : 0;
                    const isDirect = hops === 1;
                    return (
                      <tr key={lect.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span>{lect.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {lect.ipAddress || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {isOnline ? (
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isDirect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              <Route className="w-2.5 h-2.5" />
                              <span>{hops} {hops === 1 ? 'Hop' : 'Hops'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-500">
                              <WifiOff className="w-2.5 h-2.5" />
                              <span>Offline</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <span className="truncate block max-w-[160px]" title={isOnline ? lect.networkInfo?.detectedZone : 'Not Connected'}>
                            {isOnline ? (lect.networkInfo?.detectedZone || 'Lecturer Room (Direct)') : '— (Disconnected)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setModalLecturer(lect)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer text-[11px]"
                          >
                            Trace ➔
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Subnet Topology Rules List (Protected Configuration) (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Office AP Subnet Rules</h3>
                  <p className="text-xs text-slate-500">Mapping subnets to rooms & expected hops</p>
                </div>
              </div>

              {onNavigateToAdmin && (
                <button
                  type="button"
                  onClick={onNavigateToAdmin}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Configure Subnet Rules in Admin Console"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Configure in Admin</span>
                </button>
              )}
            </div>

            {/* Admin Lock Notice */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3">
              <div className="p-1.5 bg-slate-200 text-slate-600 rounded-lg shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">
                  Subnet Configuration Protected
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Subnet zone mappings, default router IPs, and campus sweeps are locked behind administrator authentication to prevent unauthorized tampering. Active rules are displayed below for network monitoring.
                </p>
                {onNavigateToAdmin && (
                  <button
                    type="button"
                    onClick={onNavigateToAdmin}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1 pt-0.5 cursor-pointer"
                  >
                    <span>Open Admin Console to edit</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Read-Only Classroom Auto-Discovery Info Strip */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 rounded-2xl border border-indigo-100/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Classroom Auto-Discovery</h4>
                    <p className="text-[11px] text-slate-500">Autonomous subnet & room registration</p>
                  </div>
                </div>

                <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  autoDiscoverSubnets 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${autoDiscoverSubnets ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                  <span>{autoDiscoverSubnets ? 'Active' : 'Disabled'}</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                When active, faculty devices detected on new classroom subnets (e.g. Ruang Kuliah, Lab, Auditorium) are automatically analyzed for hop count and cataloged into the room zone directory.
              </p>
            </div>

            {/* Read-Only Gateway and Subnet Rules List */}
            <div className="space-y-3.5">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                  Default Gateway (Lecturer Room Router)
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 block mt-1">
                  {routerIp}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 block">
                    Registered Room & Subnet Zones ({subnetRules.length}):
                  </span>
                  <button
                    type="button"
                    onClick={fetchNetworkConfig}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center space-x-1 cursor-pointer"
                    title="Refresh Subnet Rules"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingConfig ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>

                {subnetRules.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
                    Loading subnet rules...
                  </div>
                ) : (
                  subnetRules.map((rule) => (
                    <div key={rule.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {rule.subnetCidrOrPrefix}
                          </span>
                          {rule.autoLearned && (
                            <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-md">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Auto-Learned</span>
                            </span>
                          )}
                          {rule.deviceCount !== undefined && rule.deviceCount > 0 && (
                            <span className="text-[10px] text-slate-400">
                              ({rule.deviceCount} device{rule.deviceCount > 1 ? 's' : ''})
                            </span>
                          )}
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rule.expectedHops === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {rule.expectedHops} {rule.expectedHops === 1 ? 'Hop (Direct)' : 'Hops (Routed)'}
                        </span>
                      </div>

                      <div className="pt-0.5">
                        <strong className="text-xs text-slate-800 block">{rule.name}</strong>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed">{rule.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Raspberry Pi Traceroute Command Cheatsheet */}
          <div className="bg-slate-900 text-slate-200 rounded-3xl p-6 space-y-4">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                <Radio className="w-4 h-4" />
              </span>
              <h4 className="font-bold text-white text-sm">Pi Scanner Hop-Probe Helper</h4>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              The Raspberry Pi scanner agent measures hops to discovered ARP devices using ICMP TTL or traceroute:
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 space-y-1">
              <div className="text-slate-500"># Run quick 2-hop traceroute on Pi:</div>
              <div>traceroute -n -m 3 192.168.2.112</div>
              <div className="text-slate-500 pt-1"># View ARP table with gateway flags:</div>
              <div>ip neigh show</div>
            </div>

            <p className="text-[11px] text-slate-400">
              When the Pi agent POSTs scans to <code className="text-indigo-300">/api/presence/report</code>, it can include the <code className="text-indigo-300">hops</code> and <code className="text-indigo-300">latencyMs</code> fields to automatically populate the real-time distance.
            </p>
          </div>

          {/* Architectural Feasibility Breakdown: Automatic Multi-Room Scanning */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">How Multi-Room Automatic Scanning Works</h4>
                <p className="text-xs text-slate-500">Why manual subnet configuration is NOT required</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-1">
                <span className="font-bold text-purple-900 block text-xs">1. Dynamic Linux Interface & Routing Sweep</span>
                <p className="text-slate-600 text-[11px]">
                  The Python scanner on the Raspberry Pi does not need static IP lists. It queries kernel routing via <code className="bg-white px-1 py-0.5 rounded text-purple-800 font-mono">ip -o route</code> to detect all attached subnets and active VLANs automatically.
                </p>
              </div>

              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1">
                <span className="font-bold text-indigo-900 block text-xs">2. Autonomous Hop Probing (ICMP TTL / Traceroute)</span>
                <p className="text-slate-600 text-[11px]">
                  When a lecturer&apos;s phone is detected anywhere on the university network, the scanner runs an instantaneous 1-second traceroute. 
                  Direct Wi-Fi in the lecturer room = <strong>1 Hop</strong> (&lt;3ms). Through the staff room switch = <strong>2 Hops</strong>. Across hallway or classroom access points = <strong>3+ Hops</strong>.
                </p>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                <span className="font-bold text-emerald-900 block text-xs">3. Self-Cataloging Subnet Clustering</span>
                <p className="text-slate-600 text-[11px]">
                  Whenever an IP from an unmapped classroom subnet is encountered, the backend automatically extracts its network prefix (e.g. <code className="bg-white px-1 py-0.5 rounded text-emerald-800 font-mono">192.168.3.0/24</code>), labels it as an Auto-Learned Zone, and saves it permanently to the database.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Modal for Selected Lecturer */}
      {modalLecturer && (
        <TracerouteModal
          lecturer={modalLecturer}
          isOpen={!!modalLecturer}
          onClose={() => setModalLecturer(null)}
          onTracerouteComplete={() => {
            if (onLecturerUpdated) onLecturerUpdated();
          }}
        />
      )}
    </div>
  );
};
