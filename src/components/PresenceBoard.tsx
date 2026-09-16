import React, { useState, useEffect } from 'react';
import { Lecturer } from '../types';
import { LecturerCard } from './LecturerCard';
import { TracerouteModal } from './TracerouteModal';
import { Clock, Users, Search, Filter, Share2, Copy, Check } from 'lucide-react';

interface PresenceBoardProps {
  lecturers: Lecturer[];
  onCardClick: (lecturer: Lecturer) => void;
  onAdminClick: () => void;
  isAdminActive: boolean;
  onEnterSignage: () => void;
}

export const PresenceBoard: React.FC<PresenceBoardProps> = ({ 
  lecturers, 
  onCardClick, 
  onAdminClick,
  isAdminActive,
  onEnterSignage
}) => {
  const [filter, setFilter] = useState<'all' | 'present' | 'away' | 'absent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showShareLinks, setShowShareLinks] = useState(false);
  const [copiedLink, setCopiedLink] = useState<'tv' | 'mobile' | null>(null);
  const [shareableTvUrl, setShareableTvUrl] = useState('');
  const [shareableMobileUrl, setShareableMobileUrl] = useState('');
  const [tracerouteLecturer, setTracerouteLecturer] = useState<Lecturer | null>(null);

  // Sync tracerouteLecturer with live background polling updates
  useEffect(() => {
    if (tracerouteLecturer) {
      const updated = lecturers.find((l) => l.id === tracerouteLecturer.id);
      if (updated) {
        setTracerouteLecturer(updated);
      }
    }
  }, [lecturers]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setShareableTvUrl(`${origin}/?tv=true`);
      setShareableMobileUrl(`${origin}/?tv=true&mobile=true`);
    }
  }, []);

  const handleCopy = (type: 'tv' | 'mobile', url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Keep digital clock updated every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format digital clock
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Filter and search lecturers
  const filteredLecturers = lecturers.filter((lect) => {
    const matchesSearch = lect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (lect.customMessage || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    if (filter === 'present') return lect.isPresentToday && lect.isDeviceDetected && lect.status === 'Available';
    if (filter === 'away') return lect.isPresentToday && (!lect.isDeviceDetected || lect.status !== 'Available');
    if (filter === 'absent') return !lect.isPresentToday;
    
    return true;
  });

  // Calculate statistics
  const totalCount = lecturers.length;
  const presentCount = lecturers.filter(l => l.isPresentToday && l.isDeviceDetected && l.status === 'Available').length;
  const awayCount = lecturers.filter(l => l.isPresentToday && (!l.isDeviceDetected || l.status !== 'Available')).length;
  const outCount = totalCount - presentCount - awayCount;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Redesigned Clean Minimalist Header & Live Clock Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 relative overflow-hidden border border-slate-200/80 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 blur-3xl opacity-65 -mr-16 -mt-16 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-widest border border-slate-200">
              Department Signage • Ruang Dosen 1 Gd. Sipil Lt. 6
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-950">
              Lecturer Availability
            </h1>
            <p className="text-slate-500 text-xs md:text-sm max-w-lg leading-relaxed font-sans">
              Real-time directory check. Avoid knocking or disturbing others. Tap your profile card to manage availability, log-in details, and away states.
            </p>
            <div className="pt-2 flex flex-col gap-2.5 w-full">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onEnterSignage}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-950 hover:bg-slate-900 active:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer select-none group"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse group-hover:scale-110 transition-transform" />
                  <span>📺 Enter TV Signage Mode</span>
                </button>
                <button
                  onClick={() => setShowShareLinks(!showShareLinks)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer select-none"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Get Signage Links</span>
                </button>
              </div>

              {/* Collapsible Signage Link Drawer */}
              {showShareLinks && (
                <div className="mt-1 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3 max-w-lg animate-fade-in text-left">
                  <div className="flex items-center justify-between border-b border-slate-200/40 pb-2">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Hallway Signage Feed URLs</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Use on external screens</span>
                  </div>

                  {/* 1. Widescreen TV Signage Link */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600">🖥️ Widescreen TV Signage (4x2 Grid)</span>
                      <button
                        onClick={() => handleCopy('tv', shareableTvUrl)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedLink === 'tv' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[9px] text-slate-500 truncate select-all">
                      {shareableTvUrl}
                    </div>
                  </div>

                  {/* 2. Mobile Screen TV Signage Link */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600">📱 Mobile / Tablet Signage (Vertical Scroll)</span>
                      <button
                        onClick={() => handleCopy('mobile', shareableMobileUrl)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedLink === 'mobile' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[9px] text-slate-500 truncate select-all">
                      {shareableMobileUrl}
                    </div>
                  </div>

                  <p className="text-[9px] text-slate-400 leading-normal font-sans italic">
                    Tip: Bookmark these links directly on your hallway smart TV browser or wall-mounted tablet to display the automatic, live-updating presence feed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Minimalist Live Digital Clock (Highly Readable) */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl py-3 px-5 text-center md:text-right shrink-0 min-w-[210px] shadow-sm">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono flex items-center justify-center md:justify-end gap-1.5 mb-1 font-bold">
              <Clock className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Live Presence Clock
            </span>
            <div className="text-2xl md:text-3xl font-black font-mono tracking-wider text-slate-900">
              {formatTime(currentTime)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-semibold">
              {formatDate(currentTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary Bento Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', count: totalCount, bg: 'bg-white border-slate-200', text: 'text-slate-800' },
          { label: 'Available Now', count: presentCount, bg: 'bg-emerald-50/50 border-emerald-200/70', text: 'text-emerald-700' },
          { label: 'In Building (Away)', count: awayCount, bg: 'bg-amber-50/50 border-amber-200/70', text: 'text-amber-700' },
          { label: 'Off Site', count: outCount, bg: 'bg-slate-50/50 border-slate-200/70', text: 'text-slate-400' },
        ].map((stat, i) => (
          <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between shadow-xs transition-all duration-300 ${stat.bg}`}>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
            <span className={`text-xl font-extrabold font-mono ${stat.text}`}>{stat.count}</span>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search lecturer name or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-slate-800 font-sans"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: 'all', label: 'All Staff' },
            { id: 'present', label: 'Available' },
            { id: 'away', label: 'Away / Busy' },
            { id: 'absent', label: 'Off Site' },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Lecturers */}
      {filteredLecturers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-xs">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg mb-1">No matches found</h3>
          <p className="text-slate-500 text-xs">Try adjusting your filter settings or search query above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLecturers.map((lect) => (
            <LecturerCard
              key={lect.id}
              lecturer={lect}
              onCardClick={onCardClick}
              onTracerouteClick={(targetLect) => setTracerouteLecturer(targetLect)}
            />
          ))}
        </div>
      )}

      {/* Elevated Traceroute Route Inspector Modal */}
      {tracerouteLecturer && (
        <TracerouteModal
          lecturer={tracerouteLecturer}
          isOpen={!!tracerouteLecturer}
          onClose={() => setTracerouteLecturer(null)}
          onTracerouteComplete={(updated) => setTracerouteLecturer(updated)}
        />
      )}

      {/* Footer signage tip */}
      <p className="text-center text-[10px] text-slate-400 font-mono select-none">
        * System utilizes Raspberry Pi presence beacons and network signal triggers.
      </p>

    </div>
  );
};
