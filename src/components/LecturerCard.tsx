import React, { useState } from 'react';
import { Lecturer } from '../types';
import { Clock, Wifi, WifiOff, MessageSquare, Route, MapPin } from 'lucide-react';

interface LecturerCardProps {
  lecturer: Lecturer;
  onCardClick: (lecturer: Lecturer) => void;
  onTracerouteClick?: (lecturer: Lecturer) => void;
}

export const LecturerCard: React.FC<LecturerCardProps> = ({ lecturer, onCardClick, onTracerouteClick }) => {
  const [activeLecturer, setActiveLecturer] = useState<Lecturer>(lecturer);

  React.useEffect(() => {
    setActiveLecturer(lecturer);
  }, [lecturer]);

  const {
    id,
    name,
    status,
    customMessage,
    isPresentToday,
    isDeviceDetected,
    lastSeen,
    profilePhotoUrl,
    awayPhotoUrl,
    networkInfo,
  } = activeLecturer;

  // Format last seen time
  const formatLastSeen = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMins = Math.floor((now - timestamp) / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine which photo to show
  const showAwayPhoto = isPresentToday && (status === 'Away' || (status === 'Available' && !isDeviceDetected));
  const photoToDisplay = showAwayPhoto ? awayPhotoUrl : profilePhotoUrl;
  const isDefaultPhoto = !photoToDisplay || photoToDisplay.trim() === '';

  // Get initials for placeholder
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Border & background classes based on presence state
  const getCardClasses = () => {
    if (!isPresentToday) {
      return 'bg-slate-100 border border-slate-200';
    }
    if (isDeviceDetected && status === 'Available') {
      return 'bg-white border-2 border-emerald-500 shadow-sm';
    }
    // Present but away / in meeting / class
    return 'bg-white border border-slate-200 opacity-95';
  };

  // Status text configuration
  const getStatusInfo = () => {
    if (!isPresentToday) {
      return {
        text: 'Off Site',
        colorClass: 'text-slate-400',
        dotColor: 'bg-slate-300'
      };
    }
    if (!isDeviceDetected && status === 'Available') {
      return {
        text: 'Auto-Away (Not at Desk)',
        colorClass: 'text-orange-600 font-extrabold tracking-wide uppercase',
        dotColor: 'bg-orange-500 animate-pulse'
      };
    }
    switch (status) {
      case 'Available':
        return {
          text: '● Available Now',
          colorClass: 'text-emerald-600',
          dotColor: 'bg-emerald-500'
        };
      case 'Away':
        return {
          text: 'Away from Desk',
          colorClass: 'text-amber-600 font-bold',
          dotColor: 'bg-amber-400'
        };
      case 'Meeting':
        return {
          text: 'In a Meeting',
          colorClass: 'text-purple-600',
          dotColor: 'bg-purple-500'
        };
      case 'Class':
        return {
          text: 'Teaching Class',
          colorClass: 'text-blue-600',
          dotColor: 'bg-blue-500'
        };
      default:
        return {
          text: 'Off Site',
          colorClass: 'text-slate-400',
          dotColor: 'bg-slate-300'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div
      id={`lecturer-card-${id}`}
      onClick={() => onCardClick(lecturer)}
      className={`rounded-2xl p-4 flex items-center transition-all duration-300 cursor-pointer group hover:scale-[1.01] hover:shadow-md ${getCardClasses()}`}
    >
      {/* Profile/Photo Container */}
      <div className="relative shrink-0">
        <div className={`w-24 h-24 rounded-xl overflow-hidden shrink-0 flex items-center justify-center transition-all duration-300 ${
          !isPresentToday 
            ? 'bg-slate-300 grayscale opacity-40' 
            : showAwayPhoto 
              ? 'bg-amber-50 border-2 border-amber-200' 
              : 'bg-slate-200'
        }`}>
          {isDefaultPhoto ? (
            showAwayPhoto ? (
              <div className="text-center text-amber-500 flex flex-col items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[9px] font-black uppercase tracking-tighter">Away</span>
              </div>
            ) : (
              <div className={`w-full h-full flex items-center justify-center font-bold text-xl tracking-wider select-none ${
                !isPresentToday 
                  ? 'bg-slate-300 text-slate-500' 
                  : 'bg-indigo-100 text-indigo-700'
              }`}>
                {getInitials(name)}
              </div>
            )
          ) : (
            <img
              src={photoToDisplay}
              alt={name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-all duration-300"
            />
          )}
        </div>
        
        {/* Status indicator pin overlays */}
        {isPresentToday && (
          <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${statusInfo.dotColor}`} />
        )}
      </div>

      {/* Lecturer Info / Body */}
      <div className="ml-6 flex-1 min-w-0">
        <h2 className={`text-xl font-bold truncate group-hover:text-slate-800 transition-colors ${
          !isPresentToday ? 'text-slate-400' : 'text-slate-900'
        }`}>
          {name}
        </h2>
        
        <p className={`font-bold uppercase text-xs tracking-widest mt-1 ${statusInfo.colorClass}`}>
          {statusInfo.text}
        </p>

        {/* Custom Status Message */}
        {isPresentToday && customMessage ? (
          <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic flex items-center">
            <MessageSquare className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
            <span>{customMessage}</span>
          </p>
        ) : null}

        {/* Sync/Last Seen info */}
        <div className="flex flex-col gap-1 mt-2.5 font-mono text-[11px] text-slate-400">
          <p className="flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
            <span>
              {isPresentToday 
                ? `Last active: ${formatLastSeen(lastSeen)}` 
                : `Last seen: ${lastSeen ? formatLastSeen(lastSeen) : 'Yesterday'}`
              }
            </span>
          </p>
          {isPresentToday && lecturer.firstSeenToday && (
            <p className="flex items-center text-indigo-600 font-bold bg-indigo-50/50 border border-indigo-100/40 rounded-lg px-1.5 py-0.5 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 shrink-0 animate-pulse" />
              <span>Checked in: {new Date(lecturer.firstSeenToday).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          )}

          {/* Network Traceroute & Hop Distance Badge */}
          {networkInfo && (
            <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTracerouteClick?.(activeLecturer);
                }}
                title={`Click to inspect traceroute hops to ${activeLecturer.ipAddress || 'device'}`}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                  networkInfo.hops === 1
                    ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100'
                    : 'bg-amber-50/80 text-amber-700 border-amber-200/60 hover:bg-amber-100'
                }`}
              >
                <Route className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[130px]">
                  {networkInfo.hops === 1 ? '1 Hop (In Room)' : `${networkInfo.hops} Hops (Staff AP)`}
                </span>
                <span className="font-mono text-[9px] opacity-75">
                  {networkInfo.latencyMs}ms
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTracerouteClick?.(activeLecturer);
                }}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center cursor-pointer ml-1"
              >
                Trace ➔
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
