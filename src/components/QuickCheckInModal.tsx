import React, { useState } from 'react';
import { Lecturer } from '../types';
import { X, Check, Lock, AlertCircle, Clock, Trash2, MessageSquare } from 'lucide-react';

interface QuickCheckInModalProps {
  lecturer: Lecturer;
  onClose: () => void;
  onLecturersChange?: () => void;
}

export const QuickCheckInModal: React.FC<QuickCheckInModalProps> = ({ lecturer, onClose, onLecturersChange }) => {
  const [pin, setPin] = useState<string>('');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Status edit states
  const [status, setStatus] = useState<Lecturer['status']>(lecturer.status);
  const [customMessage, setCustomMessage] = useState<string>(lecturer.customMessage || '');
  const [isPresentToday, setIsPresentToday] = useState<boolean>(lecturer.isPresentToday);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Handle PIN input from on-screen keypad / keyboard
  const handleKeyPress = (num: string) => {
    setError('');
    setPin((prev) => {
      if (prev.length < 4) {
        const next = prev + num;
        if (next.length === 4) {
          // Delay verification slightly to allow visual feedback
          setTimeout(() => {
            handleVerify(next);
          }, 150);
        }
        return next;
      }
      return prev;
    });
  };

  const handleBackspace = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPin('');
  };

  // Verify PIN
  const handleVerify = (pinToVerify: string) => {
    if (pinToVerify === lecturer.pin) {
      setIsVerified(true);
      setError('');
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  // Listen to physical keyboard events
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerified || successMsg) return;

      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVerified, successMsg, lecturer.pin]);

  // Save changes to local database via backend API
  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const now = Date.now();
      const isCheckingOut = status === 'Out of Office' || !isPresentToday;
      
      const updateData: Partial<Lecturer> = {
        status: isCheckingOut ? 'Out of Office' : status,
        customMessage: isCheckingOut ? '' : customMessage,
        isPresentToday: !isCheckingOut,
        lastSeen: now,
      };

      // Call local backend to save lecturer updates
      const lectResponse = await fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lecturer, ...updateData }),
      });

      if (!lectResponse.ok) {
        throw new Error('Failed to update status on local database server');
      }

      // Call local backend to log action
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturerId: lecturer.id,
          lecturerName: lecturer.name,
          action: isCheckingOut ? 'manual_checkout' : 'status_change',
          timestamp: now,
          details: isCheckingOut 
            ? `Lecturer checked out manually.` 
            : `Status manually updated to "${status}" with message: "${customMessage || 'None'}"`
        }),
      });

      // Notify parent
      if (onLecturersChange) {
        onLecturersChange();
      }

      setSuccessMsg('Status updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError('Failed to update status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center space-x-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg shrink-0">
            {lecturer.profilePhotoUrl ? (
              <img
                src={lecturer.profilePhotoUrl}
                alt={lecturer.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              lecturer.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
            )}
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-900 line-clamp-1">{lecturer.name}</h2>
            <p className="text-xs text-slate-500 font-medium">Quick Presence Board Login</p>
          </div>
        </div>

        {/* Success Screen */}
        {successMsg ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 flex-grow">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Done!</h3>
            <p className="text-slate-500 text-sm">{successMsg}</p>
          </div>
        ) : !isVerified ? (
          /* PIN Verification Screen */
          <div className="p-6 flex flex-col flex-grow">
            <div className="text-center space-y-2 mb-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">Enter Security PIN</h3>
              <p className="text-xs text-slate-400">Please enter your 4-digit security PIN to unlock status controls.</p>
            </div>

            {/* Display Circles */}
            <div className="flex justify-center space-x-4 mb-6">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    pin.length > index
                      ? 'bg-emerald-500 border-emerald-500 scale-110'
                      : 'bg-transparent border-slate-300'
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl flex items-center text-xs space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* On-Screen Touch Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto w-full mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  className="h-14 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 font-bold text-lg text-slate-700 transition-colors flex items-center justify-center focus:outline-none"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="h-14 rounded-2xl border border-slate-100 bg-red-50 hover:bg-red-100 active:bg-red-200 text-xs font-bold text-red-600 transition-colors flex items-center justify-center focus:outline-none"
              >
                Clear
              </button>
              <button
                onClick={() => handleKeyPress('0')}
                className="h-14 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 font-bold text-lg text-slate-700 transition-colors flex items-center justify-center focus:outline-none"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="h-14 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center focus:outline-none"
              >
                <Trash2 className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
          </div>
        ) : (
          /* Status Configuration Form */
          <div className="p-6 flex flex-col space-y-4 flex-grow overflow-y-auto">
            {/* Today's Presence Checkbox */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Present in Office Today?</h4>
                <p className="text-xs text-slate-400">Controls if you appear on the active presence board today.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPresentToday(!isPresentToday)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPresentToday ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPresentToday ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isPresentToday ? (
              <>
                {/* Status Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Current Availability Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Available', label: 'Available', color: 'bg-emerald-500' },
                      { id: 'Away', label: 'Away / Break', color: 'bg-amber-500' },
                      { id: 'Meeting', label: 'In Meeting', color: 'bg-purple-500' },
                      { id: 'Class', label: 'In Class / Teaching', color: 'bg-blue-500' },
                    ].map((st) => {
                      const active = status === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => setStatus(st.id as Lecturer['status'])}
                          className={`flex items-center space-x-2 p-3.5 rounded-2xl border text-sm font-bold transition-all text-left ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${st.color}`} />
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Message input */}
                <div className="space-y-2">
                  <label htmlFor="custom-status-msg" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Custom Status Message (Optional)
                  </label>
                  <input
                    id="custom-status-msg"
                    type="text"
                    placeholder="e.g. Back in 10 minutes, room 103"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full bg-white rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-sans"
                  />
                </div>
              </>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start space-x-3 text-xs text-slate-500">
                <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                <span>
                  Marking yourself as absent for today resets your status to <strong>Out of Office</strong>. Your custom message is cleared and your status card will be grayed out.
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl flex items-center text-xs space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex space-x-3 pt-4 border-t border-slate-100 mt-auto">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex-1 bg-slate-900 hover:bg-slate-850 active:bg-black disabled:bg-slate-300 text-white py-3.5 rounded-2xl text-sm font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
