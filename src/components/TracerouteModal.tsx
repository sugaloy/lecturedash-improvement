import React, { useState } from 'react';
import { Lecturer, TracerouteHop } from '../types';
import { 
  X, Route, Wifi, WifiOff, Server, Smartphone, ArrowRight, Activity, 
  HelpCircle, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, MapPin, Radio
} from 'lucide-react';

interface TracerouteModalProps {
  lecturer: Lecturer;
  isOpen: boolean;
  onClose: () => void;
  onTracerouteComplete?: (updatedLecturer: Lecturer) => void;
}

export const TracerouteModal: React.FC<TracerouteModalProps> = ({
  lecturer,
  isOpen,
  onClose,
  onTracerouteComplete,
}) => {
  const [isRunningTrace, setIsRunningTrace] = useState(false);
  const [activeLecturer, setActiveLecturer] = useState<Lecturer>(lecturer);
  const [showExplanationDetail, setShowExplanationDetail] = useState(false);
  const [traceFeedback, setTraceFeedback] = useState<string | null>(null);

  // Sync state if prop changes (only when not actively tracing)
  React.useEffect(() => {
    if (!isRunningTrace) {
      setActiveLecturer(lecturer);
    }
  }, [lecturer, isRunningTrace]);

  if (!isOpen) return null;

  const isOnline = !!activeLecturer.isPresentToday && !!activeLecturer.isDeviceDetected && activeLecturer.status !== 'Out of Office';
  const networkInfo = activeLecturer.networkInfo;
  const hops = isOnline ? (networkInfo?.hops ?? 1) : 0;
  const latency = isOnline ? (networkInfo?.latencyMs ?? 2.1) : 0;
  const ip = activeLecturer.ipAddress || networkInfo?.ip || '192.168.73.45';
  const mac = activeLecturer.macAddress || 'fc:a1:3e:8b:2d:4c';
  const zoneName = isOnline 
    ? (networkInfo?.detectedZone || (hops === 1 ? 'Lecturer Room Router (Direct AP)' : 'Staff Room Access Point (Routed)'))
    : 'Offline / Disconnected';
  const isDirect = isOnline && hops === 1;
  const isStaffRoom = isOnline && (hops === 2 || zoneName.toLowerCase().includes('staff'));

  const handleRunTraceroute = async () => {
    setIsRunningTrace(true);
    setTraceFeedback(null);
    try {
      const res = await fetch(`/api/traceroute/${activeLecturer.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.lecturer) {
        setActiveLecturer(data.lecturer);
        setTraceFeedback(`Trace completed: ${data.networkInfo.hops} hop(s) • ${data.networkInfo.latencyMs}ms`);
        if (onTracerouteComplete) {
          onTracerouteComplete(data.lecturer);
        }
      } else {
        setTraceFeedback(`Trace finished: ${data.message || 'Updated network state'}`);
      }
    } catch (err: any) {
      setTraceFeedback(`Trace error: ${err.message}`);
    } finally {
      setIsRunningTrace(false);
      setTimeout(() => setTraceFeedback(null), 4000);
    }
  };

  const hopsList: TracerouteHop[] = networkInfo?.traceroutePath && networkInfo.traceroutePath.length > 0 
    ? networkInfo.traceroutePath 
    : [
        {
          hop: 1,
          ip: isDirect ? ip : '192.168.1.1',
          hostname: isDirect ? 'lecturer-phone.lan' : 'gateway.ruang-dosen.lan',
          rttMs: isDirect ? latency : 1.2,
          status: 'ok',
          isGateway: !isDirect,
          label: isDirect ? 'Direct Wi-Fi Association (Lecturer Room AP)' : 'Lecturer Room Router (Default Gateway)',
        },
        ...(!isDirect ? [{
          hop: 2,
          ip: ip,
          hostname: 'staff-ap-node.lan',
          rttMs: latency,
          status: 'ok' as const,
          isGateway: false,
          label: 'Staff Room Access Point Subnet Client',
        }] : [])
      ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div 
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-white">Network Traceroute Diagnostics</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  !isOnline
                    ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                    : isDirect 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isOnline ? `${hops} ${hops === 1 ? 'Hop' : 'Hops'}` : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tracing route to {activeLecturer.name} ({ip})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-700">
          
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Network Hops</span>
              <p className={`text-xl font-black mt-0.5 ${!isOnline ? 'text-slate-500' : isDirect ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isOnline ? hops : '0'} <span className="text-xs font-semibold text-slate-500">{!isOnline ? '(Offline)' : hops === 1 ? 'Hop (Direct)' : 'Hops (Routed)'}</span>
              </p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Ping Latency</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {latency} <span className="text-xs font-semibold text-slate-500">{isOnline ? 'ms' : 'N/A'}</span>
              </p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Target IP</span>
              <p className="text-sm font-mono font-bold text-indigo-700 mt-1 truncate select-all">
                {ip}
              </p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Target MAC</span>
              <p className="text-xs font-mono font-semibold text-slate-600 mt-1 truncate select-all uppercase">
                {mac}
              </p>
            </div>
          </div>

          {/* Current Location & Zone Pill */}
          <div className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
            isDirect 
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900' 
              : isStaffRoom
                ? 'bg-amber-50/70 border-amber-200/80 text-amber-900'
                : 'bg-indigo-50/70 border-indigo-200/80 text-indigo-900'
          }`}>
            <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${
              isDirect ? 'text-emerald-600' : isStaffRoom ? 'text-amber-600' : 'text-indigo-600'
            }`} />
            <div className="space-y-1 text-xs">
              <div className="flex items-center space-x-2">
                <strong className="font-bold text-sm">Detected AP Zone: {zoneName}</strong>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                  isDirect ? 'bg-emerald-200/80 text-emerald-800' : 'bg-amber-200/80 text-amber-800'
                }`}>
                  {isDirect ? 'In Lecturer Room' : 'Staff Room Area'}
                </span>
              </div>
              <p className="leading-relaxed opacity-90">
                {networkInfo?.explanation || (
                  isDirect 
                    ? 'The device is in direct layer-2 Wi-Fi association with the Lecturer Room router (1 hop, zero intermediate routers). The lecturer is seated inside or immediately adjacent to Ruang Dosen 1.'
                    : 'The device is connected via the Staff Room Access Point subnet (2 hops away from the Lecturer Room router). This explains why the device is assigned an IP from the Staff Room AP DHCP pool.'
                )}
              </p>
            </div>
          </div>

          {/* Traceroute Route Path Diagram */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono flex items-center">
                <Radio className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                Hop-by-Hop Routing Path
              </h4>
              <span className="text-[11px] text-slate-400">
                Source: Lecturer Room Router ({networkInfo?.routerGatewayIp || '192.168.1.1'})
              </span>
            </div>

            {!isOnline ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3 text-xs text-slate-600">
                <WifiOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-bold text-slate-800 text-sm block">Device Offline — Not Connected to Network</strong>
                  <p>
                    {activeLecturer.name}'s device is not currently detected on the local Wi-Fi network. Routing hops are not shown while offline.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {hopsList.map((hop, idx) => {
                  const isFinal = idx === hopsList.length - 1;
                  return (
                    <div 
                      key={hop.hop}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isFinal 
                          ? 'bg-indigo-50/50 border-indigo-200' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isFinal 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          #{hop.hop}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            {isFinal ? (
                              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <Server className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {hop.ip}
                            </span>
                            {hop.hostname && (
                              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                                ({hop.hostname})
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">
                            {hop.label || (isFinal ? `Lecturer Device (${activeLecturer.name})` : 'Intermediate Gateway')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-slate-700 block">
                          {hop.rttMs} ms
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 block">
                          Reached
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Explanation Accordion on Why IP Changes between Lecturer Room & Staff Room */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs space-y-2.5">
            <button
              onClick={() => setShowExplanationDetail(!showExplanationDetail)}
              className="w-full flex items-center justify-between text-left font-bold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Why does the device get a Staff Room IP inside the office?</span>
              </div>
              <span className="text-indigo-600 font-semibold text-[11px]">
                {showExplanationDetail ? 'Hide Explanation ▲' : 'Read Explanation ▼'}
              </span>
            </button>

            {showExplanationDetail && (
              <div className="pt-2 border-t border-slate-200 text-slate-600 space-y-2 leading-relaxed animate-fade-in">
                <p>
                  In campus buildings (like Gd. Sipil Lt. 6), the <strong>Lecturer Room (Ruang Dosen 1)</strong> and the adjacent <strong>Staff Room</strong> have separate Access Points configured on different subnets (e.g. <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">192.168.1.x</code> vs <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">192.168.2.x</code>).
                </p>
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <strong className="text-slate-800 block mb-1">1. Wi-Fi Sticky Roaming</strong>
                    Phones don't disconnect from a Wi-Fi AP until signal drops below -75dBm. If the lecturer briefly walked past the Staff Room door, their phone remains connected to the Staff Room AP even when seated at their office desk.
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <strong className="text-slate-800 block mb-1">2. Hop Count Resolves It</strong>
                    Even with a Staff Room IP, the <strong>Traceroute Hop Counter</strong> directly tells us how many routing hops away they are (1 hop = direct room link; 2 hops = routed through staff room AP).
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feedback message banner */}
          {traceFeedback && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{traceFeedback}</span>
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Traced via local intranet router socket probe</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleRunTraceroute}
              disabled={isRunningTrace}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningTrace ? 'animate-spin' : ''}`} />
              <span>{isRunningTrace ? 'Tracing Route...' : 'Run Live Traceroute'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
