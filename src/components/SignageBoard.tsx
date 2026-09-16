import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lecturer } from '../types';
import { 
  Clock, Wifi, WifiOff, Users, ArrowLeft, MessageSquare, ShieldCheck, 
  HelpCircle, Pause, Play, ChevronLeft, ChevronRight, RotateCw, Tv
} from 'lucide-react';

interface SignageBoardProps {
  lecturers: Lecturer[];
  onExit: () => void;
}

interface SignageSettings {
  rotationIntervalSec: number;
  itemsPerPage: number;
  expandToFill: boolean;
  autoRotate: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
      duration: 0.2,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 26,
    scale: 0.91,
    filter: 'blur(6px)',
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 24,
      mass: 0.75,
    },
  },
  exit: {
    opacity: 0,
    y: -18,
    scale: 0.94,
    filter: 'blur(4px)',
    transition: {
      duration: 0.18,
      ease: 'easeIn',
    },
  },
};

export const SignageBoard: React.FC<SignageBoardProps> = ({ lecturers, onExit }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isMobileDisplay, setIsMobileDisplay] = useState(false);

  // TV Signage Preferences (Admin Configurable)
  const [signageSettings, setSignageSettings] = useState<SignageSettings>({
    rotationIntervalSec: 10,
    itemsPerPage: 8,
    expandToFill: true,
    autoRotate: true,
  });

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Load Signage Settings from localStorage & listen for admin updates
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('presence_signage_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSignageSettings({
            rotationIntervalSec: parsed.rotationIntervalSec || 10,
            itemsPerPage: parsed.itemsPerPage || 8,
            expandToFill: typeof parsed.expandToFill === 'boolean' ? parsed.expandToFill : true,
            autoRotate: typeof parsed.autoRotate === 'boolean' ? parsed.autoRotate : true,
          });
        }
      } catch (e) {
        console.error('Error reading signage settings:', e);
      }
    };

    loadSettings();
    window.addEventListener('signage_settings_updated', loadSettings);
    return () => window.removeEventListener('signage_settings_updated', loadSettings);
  }, []);

  // Responsive mobile screen check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hasMobileParam = params.get('mobile') === 'true';
      setIsMobileDisplay(hasMobileParam || window.innerWidth < 768);

      const handleResize = () => {
        setIsMobileDisplay(hasMobileParam || window.innerWidth < 768);
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  
  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Pagination Math
  const itemsPerPage = signageSettings.itemsPerPage || 8;
  const totalLecturers = lecturers.length;
  const totalPages = Math.max(1, Math.ceil(totalLecturers / itemsPerPage));

  // Auto-rotate carousel timer & progress indicator
  useEffect(() => {
    if (!signageSettings.autoRotate || isPaused || totalPages <= 1 || isMobileDisplay) {
      setProgressPercent(0);
      return;
    }

    const intervalMs = (signageSettings.rotationIntervalSec || 10) * 1000;
    const tickMs = 100;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += tickMs;
      const pct = Math.min(100, (elapsed / intervalMs) * 100);
      setProgressPercent(pct);

      if (elapsed >= intervalMs) {
        elapsed = 0;
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [signageSettings.autoRotate, signageSettings.rotationIntervalSec, isPaused, totalPages, isMobileDisplay]);

  // Keep currentPage inside safe bounds
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(0);
    }
  }, [totalPages, currentPage]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Slice current page lecturers and pad with placeholders if needed
  const startIndex = currentPage * itemsPerPage;
  const pageLecturers = lecturers.slice(startIndex, startIndex + itemsPerPage);
  const neededPadding = Math.max(0, itemsPerPage - pageLecturers.length);

  const paddedSlots = Array.from({ length: neededPadding }).map((_, index) => ({
    id: `placeholder_p${currentPage}_${index}`,
    name: 'Unassigned Desk',
    status: 'Out of Office' as const,
    customMessage: 'Consult administration to assign this screen slot.',
    isPresentToday: false,
    isDeviceDetected: false,
    lastSeen: 0,
    pin: '',
    profilePhotoUrl: '',
    awayPhotoUrl: '',
    macAddress: ''
  }));

  const activePageSlots = [...pageLecturers, ...paddedSlots];

  // Calculate overall statistics
  const presentCount = lecturers.filter(l => l.isPresentToday && l.isDeviceDetected && l.status === 'Available').length;
  const busyCount = lecturers.filter(l => l.isPresentToday && l.status !== 'Available' && l.status !== 'Out of Office').length;

  // Format last seen helper
  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'Offline';
    const now = Date.now();
    const diffMins = Math.floor((now - timestamp) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Status visual attributes
  const getStatusConfig = (lect: Lecturer) => {
    if (!lect.isPresentToday) {
      return {
        label: 'OFF SITE',
        colorClass: 'text-slate-500 bg-slate-100 border-slate-200',
        glowClass: 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.4)]',
        borderGlow: 'border-l-slate-300',
        photoFilter: 'grayscale opacity-40',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200'
      };
    }

    if (!lect.isDeviceDetected && lect.status === 'Available') {
      return {
        label: 'AUTO-AWAY (NOT AT DESK)',
        colorClass: 'text-orange-700 bg-orange-50 border-orange-200',
        glowClass: 'bg-orange-500 animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.65)]',
        borderGlow: 'border-l-orange-500 border-l-[10px]',
        photoFilter: 'border-orange-400 scale-102 ring-4 ring-orange-100',
        badgeColor: 'bg-orange-500 text-white font-extrabold border-orange-600 text-xs px-3 py-1 rounded-2xl animate-pulse shadow-md'
      };
    }

    switch (lect.status) {
      case 'Available':
        return {
          label: 'AVAILABLE NOW',
          colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
          glowClass: 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]',
          borderGlow: 'border-l-emerald-500',
          photoFilter: 'border-emerald-400 scale-102',
          badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
        };
      case 'Away':
        return {
          label: 'AWAY FROM DESK',
          colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
          glowClass: 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]',
          borderGlow: 'border-l-amber-500',
          photoFilter: 'border-amber-400 scale-100',
          badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'Meeting':
        return {
          label: 'IN A MEETING',
          colorClass: 'text-purple-700 bg-purple-50 border-purple-200',
          glowClass: 'bg-purple-500 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.5)]',
          borderGlow: 'border-l-purple-500',
          photoFilter: 'border-purple-300 filter brightness-95',
          badgeColor: 'bg-purple-50 text-purple-800 border-purple-200'
        };
      case 'Class':
        return {
          label: 'TEACHING CLASS',
          colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
          glowClass: 'bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]',
          borderGlow: 'border-l-blue-500',
          photoFilter: 'border-blue-300 filter brightness-95',
          badgeColor: 'bg-blue-50 text-blue-800 border-blue-200'
        };
      default:
        return {
          label: 'OFF SITE',
          colorClass: 'text-slate-500 bg-slate-100 border-slate-200',
          glowClass: 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.4)]',
          borderGlow: 'border-l-slate-300',
          photoFilter: 'grayscale opacity-40',
          badgeColor: 'bg-slate-100 text-slate-600 border-slate-200'
        };
    }
  };

  // Dynamic Grid Class Generator to expand cards perfectly on display screens
  const getGridClass = () => {
    if (isMobileDisplay) {
      return 'grid grid-cols-1 sm:grid-cols-2 gap-4 h-auto overflow-visible pb-16';
    }

    const heightClass = signageSettings.expandToFill 
      ? 'h-[calc(100vh-140px)] min-h-0' 
      : 'h-auto max-h-[calc(100vh-140px)]';
    
    switch (itemsPerPage) {
      case 2:
        return `grid grid-cols-2 grid-rows-1 gap-4 md:gap-5 ${heightClass} overflow-hidden pb-2`;
      case 4:
        return `grid grid-cols-2 grid-rows-2 gap-4 md:gap-5 ${heightClass} overflow-hidden pb-2`;
      case 6:
        return `grid grid-cols-3 grid-rows-2 gap-3.5 md:gap-4 ${heightClass} overflow-hidden pb-2`;
      case 10:
        return `grid grid-cols-5 grid-rows-2 gap-3 md:gap-3.5 ${heightClass} overflow-hidden pb-2`;
      case 12:
        return `grid grid-cols-4 lg:grid-cols-6 grid-rows-2 gap-3 ${heightClass} overflow-hidden pb-2`;
      case 8:
      default:
        return `grid grid-cols-2 lg:grid-cols-4 grid-rows-2 gap-3.5 md:gap-4 ${heightClass} overflow-hidden pb-2`;
    }
  };

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-slate-100 text-slate-900 flex flex-col font-sans p-3.5 md:p-5 select-none z-50 ${isMobileDisplay ? 'overflow-y-auto' : 'overflow-hidden'}`}>
      
      {/* Top Progress Bar for Page Auto-Rotation */}
      {signageSettings.autoRotate && totalPages > 1 && !isPaused && !isMobileDisplay && (
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-200/60 z-50 overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-100 ease-linear shadow-xs"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Dynamic Header Board */}
      <header className={`relative z-10 shrink-0 border-b border-slate-200/90 pb-3 mb-3 flex ${isMobileDisplay ? 'flex-col gap-3' : 'flex-row items-center justify-between'} bg-white px-5 py-3 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)]`}>
        
        {/* Left: Department & Badge */}
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg tracking-widest shadow-md">
            LP
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-slate-900 flex items-center gap-1.5 flex-wrap">
              Lecturer Presence Directory
              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live {isMobileDisplay ? 'Mobile' : 'TV Kiosk'} Feed
              </span>
            </h1>
            <p className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-widest mt-0.5">
              Automated Hallway Display Panel • Ruang Dosen 1 Gd. Sipil Lt. 6
            </p>
          </div>
        </div>

        {/* Center: Live Large Clock & Date */}
        <div className={`flex items-center gap-4 bg-slate-100 border border-slate-200/80 px-4 py-1.5 rounded-xl shadow-inner ${isMobileDisplay ? 'justify-between w-full' : ''}`}>
          <div className="text-right">
            <div className="text-[10px] text-slate-700 font-mono font-bold uppercase tracking-wider">
              {formatDate(currentTime)}
            </div>
            <div className="text-[9px] text-slate-500 font-mono">
              Network Scanner Sync: 100% Active
            </div>
          </div>
          <div className="h-6 w-px bg-slate-300" />
          <div className="text-xl font-black font-mono tracking-wider text-slate-900 drop-shadow-sm">
            {formatTime(currentTime)}
          </div>
        </div>

        {/* Right: Carousel Override Controls & Exit */}
        <div className={`flex items-center ${isMobileDisplay ? 'justify-between w-full mt-1' : 'gap-3'}`}>
          
          {/* Page Carousel Controls (If totalPages > 1) */}
          {totalPages > 1 && !isMobileDisplay && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
              <span className="text-[10px] font-mono font-bold text-slate-600 mr-1">
                Page {currentPage + 1}/{totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isPaused ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200 text-slate-700'
                }`}
                title={isPaused ? "Resume Auto-Rotate" : "Pause Auto-Rotate"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => (prev + 1) % totalPages)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Stats Bar */}
          <div className={`${isMobileDisplay ? 'flex' : 'hidden lg:flex'} items-center gap-2`}>
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl text-center shadow-xs">
              <span className="text-[9px] text-emerald-700 font-bold font-mono uppercase">Avail: {presentCount}</span>
            </div>
            <div className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl text-center shadow-xs">
              <span className="text-[9px] text-blue-700 font-bold font-mono uppercase">Busy: {busyCount}</span>
            </div>
          </div>

          {/* Exit Display button */}
          {!isMobileDisplay && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-all shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit
            </button>
          )}
        </div>

      </header>

      {/* Main Grid Space - Expanding Cards to fill 100% available TV display height */}
      <main className="relative z-10 flex-grow overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className={getGridClass()}
          >
            {activePageSlots.map((lect, idx) => {
              const config = getStatusConfig(lect);
              const isPlaceholder = lect.id.startsWith('placeholder_');
              
              // Determine photo
              const showAwayPhoto = lect.isPresentToday && (lect.status === 'Away' || (lect.status === 'Available' && !lect.isDeviceDetected));
              const photoToDisplay = showAwayPhoto ? lect.awayPhotoUrl : lect.profilePhotoUrl;
              const hasPhoto = photoToDisplay && photoToDisplay.trim() !== '';

              const stationNumber = startIndex + idx + 1;

              return (
                <motion.div
                  key={lect.id}
                  variants={cardVariants}
                  className={`bg-white border-[3px] shadow-[0_4px_18px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] rounded-3xl p-3.5 md:p-4.5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                    signageSettings.expandToFill && !isMobileDisplay ? 'h-full min-h-0' : ''
                  } ${
                    isPlaceholder 
                      ? 'opacity-40 border-dashed border-slate-450 bg-slate-50' 
                      : !lect.isPresentToday
                        ? 'bg-slate-50 border-slate-300'
                        : 'bg-white border-slate-300'
                  } border-l-[7px] ${config.borderGlow}`}
                >
              {/* Top Section of Card: Photo & Status */}
              <div className="flex items-start justify-between gap-3 shrink-0">
                
                {/* Photo & Glow Ring */}
                <div className="relative shrink-0">
                  <div className={`w-18 h-18 md:w-22 md:h-22 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center transition-all duration-300 border-2 ${
                    isPlaceholder 
                      ? 'border-slate-350' 
                      : !lect.isPresentToday
                        ? 'border-slate-350 grayscale'
                        : showAwayPhoto
                          ? 'border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                          : 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  }`}>
                    {isPlaceholder ? (
                      <HelpCircle className="w-8 h-8 text-slate-400" />
                    ) : !hasPhoto ? (
                      <div className="w-full h-full flex items-center justify-center font-black text-xl tracking-wider text-slate-700 bg-slate-100">
                        {lect.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    ) : (
                      <img
                        src={photoToDisplay}
                        alt={lect.name}
                        referrerPolicy="no-referrer"
                        className={`w-full h-full object-cover transition-all duration-300 ${config.photoFilter}`}
                      />
                    )}
                  </div>

                  {/* Pulsing beacon status dot */}
                  {!isPlaceholder && (
                    <span className={`absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center ${config.glowClass}`} />
                  )}
                </div>

                {/* Status Badges & MAC Detection Indicator */}
                <div className="text-right flex flex-col items-end gap-1 flex-1 min-w-0">
                  {/* Station Label */}
                  {!isPlaceholder && (
                    <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-widest bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/50">
                      Station {stationNumber}
                    </span>
                  )}

                  <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider border shadow-xs ${config.badgeColor}`}>
                    {config.label}
                  </span>

                  {/* Network scanner badge */}
                  {!isPlaceholder && lect.isPresentToday && lect.status === 'Available' && (
                    <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold ${
                      lect.isDeviceDetected ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {lect.isDeviceDetected ? (
                        <>
                          <Wifi className="w-3.5 h-3.5 animate-pulse text-emerald-600 shrink-0" />
                          <span>At Desk</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Stepped Out</span>
                        </>
                      )}
                    </span>
                  )}
                </div>

              </div>

              {/* Middle Section of Card: Name */}
              <div className="my-1.5 md:my-2 flex-1 min-w-0 flex flex-col justify-center">
                <h2 className={`font-black tracking-tight leading-tight ${
                  isPlaceholder 
                    ? 'text-slate-450 text-base' 
                    : !lect.isPresentToday 
                      ? 'text-slate-500 text-lg md:text-xl lg:text-2xl' 
                      : 'text-slate-900 text-lg md:text-xl lg:text-2xl'
                }`}>
                  {lect.name}
                </h2>
              </div>

              {/* Bottom Section of Card: Custom Message / Whereabouts */}
              <div className="w-full space-y-1.5 shrink-0">
                {!isPlaceholder && lect.isPresentToday && lect.customMessage ? (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl px-3 py-1.5 flex items-start gap-1.5 shadow-xs">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-700 font-bold italic leading-snug line-clamp-2">
                      "{lect.customMessage}"
                    </p>
                  </div>
                ) : !isPlaceholder && lect.isPresentToday ? (
                  (() => {
                    const isAtDesk = lect.status === 'Available' && lect.isDeviceDetected;
                    if (isAtDesk) {
                      return (
                        <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl px-3 py-1 text-center shadow-xs">
                          <p className="text-[10px] md:text-[11px] text-emerald-800 font-bold font-sans">
                            Available at desk station
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="bg-amber-50/40 border border-amber-100 rounded-2xl px-3 py-1 text-center shadow-xs">
                          <p className="text-[10px] md:text-[11px] text-amber-800 font-bold font-sans">
                            Checked-in, but not at desk
                          </p>
                        </div>
                      );
                    }
                  })()
                ) : !isPlaceholder && !lect.isPresentToday ? (
                  <div className="bg-slate-100/50 rounded-2xl px-3 py-1 text-center border border-slate-200/40 shadow-xs">
                    <p className="text-[10px] text-slate-500 italic font-mono font-bold truncate">
                      Last Seen: {formatLastSeen(lect.lastSeen)}
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-100/50 rounded-2xl px-3 py-1 text-center border border-slate-200/40 shadow-xs">
                    <p className="text-[10px] text-slate-400 italic font-mono font-bold truncate">
                      Placeholder slot
                    </p>
                  </div>
                )}

                {/* Checked in details */}
                {!isPlaceholder && lect.isPresentToday && (
                  <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-1.5 font-mono text-[9px] md:text-[10px] text-slate-500">
                    <div className="flex justify-between items-center px-1">
                      <span>Last Seen:</span>
                      <span className="font-bold text-slate-700">{formatLastSeen(lect.lastSeen)}</span>
                    </div>
                    {lect.firstSeenToday && (
                      <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100/30 rounded-xl px-2 py-0.5 text-indigo-600 font-bold mt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                          Checked In:
                        </span>
                        <span>{new Date(lect.firstSeenToday).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Decorative Status Bar & Pagination Dots */}
      <footer className="relative z-10 shrink-0 border-t border-slate-200 pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] md:text-[11px] text-slate-600 font-mono font-bold bg-white/70 px-4 py-2 rounded-2xl shadow-xs border border-slate-200/60 mt-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-slate-800">Lobby Display Mode | Developed and Served by SugaloyDev</span>
          </div>
          <span className="text-[10px] text-slate-400 font-normal sm:border-l sm:border-slate-200 sm:pl-3 font-sans">
            co-developed by JTE and JTI Politeknik Negeri Malang
          </span>
        </div>

        {/* Page Dots Indicator if totalPages > 1 */}
        {totalPages > 1 && !isMobileDisplay && (
          <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-0.5 rounded-full border border-slate-200/60">
            {Array.from({ length: totalPages }).map((_, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => setCurrentPage(pIdx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  pIdx === currentPage ? 'w-5 bg-indigo-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                title={`Go to page ${pIdx + 1}`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-slate-700">Display Station status: ONLINE</span>
        </div>
      </footer>

    </div>
  );
};
