import React, { useState, useEffect } from 'react';
import { Lecturer } from './types';
import { PresenceBoard } from './components/PresenceBoard';
import { SignageBoard } from './components/SignageBoard';
import { QuickCheckInModal } from './components/QuickCheckInModal';
import { AdminPanel } from './components/AdminPanel';
import { PiScriptGuide } from './components/PiScriptGuide';
import { NetworkDiagnosticsView } from './components/NetworkDiagnosticsView';
import { LayoutDashboard, Shield, Cpu, Loader2, AlertTriangle, Route } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'network' | 'pi-setup' | 'admin'>('board');
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [selectedLecturer, setSelectedLecturer] = useState<Lecturer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSignageMode, setIsSignageMode] = useState<boolean>(() => {
    // 1. Check if '?tv=true' or '/signage' or '/tv' is in the URL!
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isTvParam = urlParams.get('tv') === 'true';
      const isSignagePath = window.location.pathname.includes('/signage') || window.location.pathname.includes('/tv');
      const isHashSignage = window.location.hash.includes('signage') || window.location.hash.includes('tv');
      if (isTvParam || isSignagePath || isHashSignage) {
        localStorage.setItem('presence_signage_mode', 'true');
        return true;
      }
    }

    // 2. Fallback to localStorage saved state
    const saved = localStorage.getItem('presence_signage_mode');
    return saved === 'true';
  });

  // RFID scan real-time tap reactive popup state
  const [lastSeenRfidTimestamp, setLastSeenRfidTimestamp] = useState<number>(() => Date.now());
  const [activeRfidModal, setActiveRfidModal] = useState<{
    name: string;
    status: string;
    photo: string;
  } | null>(null);

  // Auto-close RFID popup after 2 seconds
  useEffect(() => {
    if (activeRfidModal) {
      const timer = setTimeout(() => {
        setActiveRfidModal(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeRfidModal]);

  const fetchLecturers = async () => {
    try {
      const response = await fetch('/api/lecturers');
      if (!response.ok) throw new Error('Failed to fetch lecturers');
      const data = await response.json();
      if (data.success) {
        const list = data.lecturers || [];
        list.sort((a: Lecturer, b: Lecturer) => a.name.localeCompare(b.name));
        setLecturers(list);
        setLoading(false);

        // Scan for new physical RFID Card Tap events
        if (data.lastRfidTap && data.lastRfidTap.timestamp > lastSeenRfidTimestamp) {
          const age = Date.now() - data.lastRfidTap.timestamp;
          if (age < 15000) { // Limit to taps that happened in the last 15 seconds
            setActiveRfidModal({
              name: data.lastRfidTap.name,
              status: data.lastRfidTap.status,
              photo: data.lastRfidTap.photo
            });
          }
          setLastSeenRfidTimestamp(data.lastRfidTap.timestamp);
        }
      }
    } catch (err) {
      console.error("Error fetching lecturers:", err);
      setLoading(false);
    }
  };

  // Poll lecturers list from local server
  useEffect(() => {
    // Initial fetch
    fetchLecturers();

    // Poll every 3 seconds for near real-time reactivity offline
    const interval = setInterval(fetchLecturers, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Monitor URL parameters and location continuously to ensure direct links activate signage mode
  useEffect(() => {
    const checkUrlForSignage = () => {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const isTvParam = urlParams.get('tv') === 'true';
        const isSignagePath = window.location.pathname.includes('/signage') || window.location.pathname.includes('/tv');
        const isHashSignage = window.location.hash.includes('signage') || window.location.hash.includes('tv');
        
        if (isTvParam || isSignagePath || isHashSignage) {
          setIsSignageMode(true);
          localStorage.setItem('presence_signage_mode', 'true');
        }
      }
    };

    checkUrlForSignage();
    // Re-check on hash or navigation popstate updates
    window.addEventListener('hashchange', checkUrlForSignage);
    window.addEventListener('popstate', checkUrlForSignage);
    return () => {
      window.removeEventListener('hashchange', checkUrlForSignage);
      window.removeEventListener('popstate', checkUrlForSignage);
    };
  }, []);

  // Keep selectedLecturer in sync with updated lecturers list to prevent stale data
  useEffect(() => {
    if (selectedLecturer) {
      const updated = lecturers.find(l => l.id === selectedLecturer.id);
      if (updated) {
        setSelectedLecturer(updated);
      }
    }
  }, [lecturers]);

  if (isSignageMode) {
    return (
      <SignageBoard
        lecturers={lecturers}
        onExit={() => {
          setIsSignageMode(false);
          localStorage.setItem('presence_signage_mode', 'false');
          // Clean the URL so they can return to the regular board normally
          if (typeof window !== 'undefined' && window.history.pushState) {
            const cleanUrl = window.location.protocol + "//" + window.location.host + "/";
            window.history.pushState({ path: cleanUrl }, '', cleanUrl);
          }
        }}
      />
    );
  }

  return (
    <div id="app-root-container" className="min-h-screen min-h-[100dvh] w-full bg-slate-100 text-slate-900 flex flex-col font-sans antialiased overflow-x-hidden">
      
      {/* Universal Desktop/Mobile Site Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          
          {/* Brand/Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('board')}>
            <div className="h-9 w-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm tracking-widest shadow-xs shrink-0">
              LP
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block">LecturerPresence</span>
              <span className="text-[9px] text-slate-400 font-mono font-bold block uppercase tracking-wider">Departmental Portal</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="flex space-x-1 sm:space-x-1.5 overflow-x-auto scrollbar-none py-1">
            {[
              { id: 'board', label: 'Presence Board', icon: LayoutDashboard },
              { id: 'network', label: 'Network & Traceroute', icon: Route },
              { id: 'pi-setup', label: 'Raspberry Pi Agent', icon: Cpu },
              { id: 'admin', label: 'Admin Console', icon: Shield },
            ].map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </header>

      {/* Main Body Stage */}
      <main className="flex-grow max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 w-full">
        {loading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
            <p className="text-xs font-bold text-slate-400 tracking-wider animate-pulse uppercase">Syncing Live Directory...</p>
          </div>
        ) : (
          <div className="w-full">
            {activeTab === 'board' && (
              <PresenceBoard
                lecturers={lecturers}
                onCardClick={(lect) => setSelectedLecturer(lect)}
                onAdminClick={() => setActiveTab('admin')}
                isAdminActive={activeTab === 'admin'}
                onEnterSignage={() => {
                  setIsSignageMode(true);
                  localStorage.setItem('presence_signage_mode', 'true');
                }}
              />
            )}

            {activeTab === 'network' && (
              <NetworkDiagnosticsView
                lecturers={lecturers}
                onLecturerUpdated={fetchLecturers}
                onNavigateToAdmin={() => setActiveTab('admin')}
              />
            )}

            {activeTab === 'pi-setup' && (
              <PiScriptGuide />
            )}

            {activeTab === 'admin' && (
              <AdminPanel lecturers={lecturers} onLecturersChange={fetchLecturers} />
            )}
          </div>
        )}

        {/* Network Scanner / Nmap Warning Alert */}
        <div className="mt-8">
          <div className="bg-amber-50/90 border border-amber-200/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">
                  Subnet Scan & Auto-Detection Status Notice
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  If auto-presence is not active, ensure <code className="bg-amber-100/60 px-1 py-0.5 rounded font-mono font-bold text-amber-800">nmap</code> is installed on your local scanning gateway or Raspberry Pi (<code className="bg-amber-100/60 px-1 py-0.5 rounded font-mono font-bold text-amber-800">sudo apt install nmap</code>). The board remains fully operational with offline-friendly manual keypad tap overrides!
                </p>
              </div>
            </div>
            {activeTab !== 'pi-setup' && (
              <button
                onClick={() => setActiveTab('pi-setup')}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/60 hover:bg-amber-100 px-3.5 py-1.5 rounded-xl transition-all border border-amber-200 shrink-0 cursor-pointer select-none"
              >
                Agent Setup Guide →
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <div>
            <p>© 2026 Beacon Presence Ruang Dosen 1 lt.6</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-1 font-sans">
            <span className="font-semibold text-slate-500">Designed and served by SugaloyDev</span>
            <span className="text-[10px] text-slate-400">co-developed by Teknik Telekomunikasi Politeknik Negeri Malang</span>
          </div>
        </div>
      </footer>

      {/* Modal Overlay for Rapid Tap Check-In / PIN keypad entry */}
      {selectedLecturer && (
        <QuickCheckInModal
          lecturer={selectedLecturer}
          onClose={() => setSelectedLecturer(null)}
          onLecturersChange={fetchLecturers}
        />
      )}

      {/* Real-Time Physical RFID Card Swipe Active Modal Popup */}
      {activeRfidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-lg animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-6 transform scale-100 transition-all duration-300 animate-slide-up">
            <div className="relative mx-auto w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-500 animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-1 rounded-full bg-white overflow-hidden flex items-center justify-center">
                {activeRfidModal.photo ? (
                  <img
                    src={activeRfidModal.photo}
                    alt={activeRfidModal.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-3xl font-sans">
                    {activeRfidModal.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 tracking-widest font-mono uppercase">RFID Card Tap Detected</p>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight font-sans">{activeRfidModal.name}</h2>
            </div>

            <div className="py-2.5 px-6 inline-flex items-center space-x-2 rounded-2xl border bg-slate-50 border-slate-100 shadow-xs">
              <span className={`h-2.5 w-2.5 rounded-full animate-ping ${
                activeRfidModal.status === "Available" ? "bg-emerald-500" : "bg-amber-500"
              }`} />
              <span className={`text-xs font-black tracking-wider uppercase font-mono ${
                activeRfidModal.status === "Available" ? "text-emerald-600" : "text-amber-600"
              }`}>
                {activeRfidModal.status}
              </span>
            </div>

            <p className="text-xs text-slate-400 font-medium italic">
              Status updated. Closing in 2 seconds...
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
