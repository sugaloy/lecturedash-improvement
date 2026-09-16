import React, { useState, useEffect } from 'react';
import { Lecturer, PresenceLog, SubnetZoneRule } from '../types';
import { 
  Plus, Edit, Trash2, RefreshCw, LogIn, Lock, CheckCircle2, 
  AlertCircle, Upload, User, FileText, X, Cpu, CreditCard, Download, Database, Loader2, Tv, Sliders,
  Route, Server, Wifi, Sparkles, Check, Edit2, Radio
} from 'lucide-react';

interface AdminPanelProps {
  lecturers: Lecturer[];
  onLecturersChange?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ lecturers: propLecturers, onLecturersChange }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'lecturers' | 'logs' | 'rfid' | 'backup' | 'signage' | 'network'>('lecturers');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Network Subnet Rules State
  const [networkRouterIp, setNetworkRouterIp] = useState('192.168.1.1');
  const [networkSubnetRules, setNetworkSubnetRules] = useState<SubnetZoneRule[]>([]);
  const [networkAutoDiscover, setNetworkAutoDiscover] = useState(true);
  const [isLoadingNetworkConfig, setIsLoadingNetworkConfig] = useState(false);
  const [isSavingNetworkConfig, setIsSavingNetworkConfig] = useState(false);
  const [isAutoSweeping, setIsAutoSweeping] = useState(false);
  const [sweepFeedback, setSweepFeedback] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Signage Settings State
  const [signageIntervalSec, setSignageIntervalSec] = useState<number>(10);
  const [signageItemsPerPage, setSignageItemsPerPage] = useState<number>(8);
  const [signageExpandToFill, setSignageExpandToFill] = useState<boolean>(true);
  const [signageAutoRotate, setSignageAutoRotate] = useState<boolean>(true);

  // Load signage settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('presence_signage_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rotationIntervalSec) setSignageIntervalSec(parsed.rotationIntervalSec);
        if (parsed.itemsPerPage) setSignageItemsPerPage(parsed.itemsPerPage);
        if (typeof parsed.expandToFill === 'boolean') setSignageExpandToFill(parsed.expandToFill);
        if (typeof parsed.autoRotate === 'boolean') setSignageAutoRotate(parsed.autoRotate);
      }
    } catch (e) {
      console.error('Error reading signage settings:', e);
    }
  }, []);

  const handleSaveSignageSettings = (
    intervalSec: number,
    itemsPerPage: number,
    expandToFill: boolean,
    autoRotate: boolean
  ) => {
    setSignageIntervalSec(intervalSec);
    setSignageItemsPerPage(itemsPerPage);
    setSignageExpandToFill(expandToFill);
    setSignageAutoRotate(autoRotate);

    const settings = {
      rotationIntervalSec: intervalSec,
      itemsPerPage,
      expandToFill,
      autoRotate
    };
    localStorage.setItem('presence_signage_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('signage_settings_updated'));
    showToast('TV Signage settings saved successfully!');
  };

  // RFID Simulator State
  const [simRfidUid, setSimRfidUid] = useState('');
  const [simResult, setSimResult] = useState<{ success: boolean; message: string; unregisteredUid?: string } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Database Backup / Import State
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [isDraggingBackup, setIsDraggingBackup] = useState(false);
  const [backupImportError, setBackupImportError] = useState('');
  const [backupImportSuccess, setBackupImportSuccess] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Firestore collections state
  const [dbLecturers, setDbLecturers] = useState<Lecturer[]>(propLecturers);
  const [logs, setLogs] = useState<PresenceLog[]>([]);
  const [logDates, setLogDates] = useState<string[]>([]);
  const [selectedLogDate, setSelectedLogDate] = useState<string>('active');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Edit / Add Form State
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formMac, setFormMac] = useState('');
  const [formSecondaryMac, setFormSecondaryMac] = useState('');
  const [formIp, setFormIp] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRfid, setFormRfid] = useState('');
  const [formProfilePhoto, setFormProfilePhoto] = useState('');
  const [formAwayPhoto, setFormAwayPhoto] = useState('');
  const [isCompressingProfile, setIsCompressingProfile] = useState(false);
  const [isCompressingAway, setIsCompressingAway] = useState(false);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Custom Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Custom Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    isOpen: boolean;
  }>({
    message: '',
    type: 'success',
    isOpen: false,
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, isOpen: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, isOpen: false }));
    }, 4500);
  };

  const triggerConfirm = (title: string, message: string, action: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        action();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Active Scanned Devices State
  const [scannedDevices, setScannedDevices] = useState<Array<{ mac: string; ip: string; timestamp: number; isAssigned: boolean; assignedTo: string | null }>>([]);
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [showScanPicker, setShowScanPicker] = useState(false);
  const [scanTargetField, setScanTargetField] = useState<'primary' | 'secondary' | null>(null);

  // Local storage for admin token
  useEffect(() => {
    const savedToken = localStorage.getItem('presence_admin_token');
    if (savedToken === 'lecturer-presence-signage-token-12345') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  // Fetch available dates for daily log files
  const fetchLogDates = async () => {
    try {
      const response = await fetch('/api/logs/dates');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogDates(data.dates || []);
        }
      }
    } catch (err) {
      console.error("Error fetching log dates:", err);
    }
  };

  // Fetch log records from local server database (active or specific date)
  const fetchLogs = async (dateParam?: string) => {
    setLoadingLogs(true);
    try {
      const targetDate = dateParam || selectedLogDate;
      const endpoint = targetDate === 'active' ? '/api/logs' : `/api/logs/date/${targetDate}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch system logs');
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Error fetching system logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchScannedDevices = async () => {
    setIsScanningDevices(true);
    try {
      const response = await fetch('/api/presence/scanned-devices');
      const data = await response.json();
      if (response.ok && data.success) {
        setScannedDevices(data.devices || []);
      }
    } catch (err) {
      console.error('Error fetching scanned devices:', err);
    } finally {
      setIsScanningDevices(false);
    }
  };

  const fetchNetworkConfig = async () => {
    setIsLoadingNetworkConfig(true);
    try {
      const res = await fetch('/api/network/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNetworkRouterIp(data.routerIp || '192.168.1.1');
          setNetworkSubnetRules(data.subnetZoneRules || []);
          setNetworkAutoDiscover(data.autoDiscoverSubnets !== false);
        }
      }
    } catch (err) {
      console.error("Error fetching network config in admin:", err);
    } finally {
      setIsLoadingNetworkConfig(false);
    }
  };

  const handleSaveNetworkConfig = async () => {
    setIsSavingNetworkConfig(true);
    try {
      const token = localStorage.getItem('presence_admin_token') || 'lecturer-presence-signage-token-12345';
      const res = await fetch('/api/network/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          routerIp: networkRouterIp,
          subnetZoneRules: networkSubnetRules,
          autoDiscoverSubnets: networkAutoDiscover
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Network AP subnet rules & gateway configuration saved!');
        if (onLecturersChange) onLecturersChange();
      } else {
        showToast(data.error || 'Failed to save network configuration', 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSavingNetworkConfig(false);
    }
  };

  const handleRunAdminAutoSweep = async () => {
    setIsAutoSweeping(true);
    setSweepFeedback(null);
    try {
      const token = localStorage.getItem('presence_admin_token') || 'lecturer-presence-signage-token-12345';
      const res = await fetch('/api/network/auto-sweep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNetworkSubnetRules(data.allRules || []);
        setSweepFeedback(
          data.newlyDiscoveredCount > 0
            ? `Sweep Complete: Discovered and registered ${data.newlyDiscoveredCount} new classroom AP zone(s)! Total active zones: ${data.allRules.length}.`
            : `Sweep Complete: All scanned campus subnets are already cataloged and up-to-date.`
        );
        showToast(`Subnet sweep completed successfully!`);
        if (onLecturersChange) onLecturersChange();
      } else {
        setSweepFeedback(data.error || 'Failed to run sweep.');
        showToast(data.error || 'Sweep failed', 'error');
      }
    } catch (err: any) {
      setSweepFeedback(`Error: ${err.message}`);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsAutoSweeping(false);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn && activeTab === 'logs') {
      fetchLogDates();
      fetchLogs(selectedLogDate);
    }
    if (isAdminLoggedIn && activeTab === 'network') {
      fetchNetworkConfig();
    }
  }, [isAdminLoggedIn, activeTab, selectedLogDate]);

  // Sync propLecturers with local dbLecturers state when it updates
  useEffect(() => {
    if (propLecturers && propLecturers.length > 0) {
      setDbLecturers(propLecturers);
    }
  }, [propLecturers]);

  // Handle Admin Login via backend
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('presence_admin_token', data.token);
        setIsAdminLoggedIn(true);
        setAdminPassword('');
      } else {
        setLoginError(data.error || 'Incorrect admin password.');
      }
    } catch (err) {
      setLoginError('Failed to verify password with server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('presence_admin_token');
    setIsAdminLoggedIn(false);
  };

  // Image compression helper using Object URLs and Canvas to avoid reading huge base64 in memory
  const compressImageFile = (file: File, callback: (compressed: string) => void) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress as 65% quality JPEG to yield a very small ~15-20KB file size
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
          callback(compressedBase64);
        } else {
          fallbackFileReader(file, callback);
        }
      } catch (err) {
        fallbackFileReader(file, callback);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      fallbackFileReader(file, callback);
    };
  };

  const fallbackFileReader = (file: File, callback: (compressed: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Image upload handler helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'away') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) { // Up to 15MB allowed now since client-side handles it perfectly
      setFormError('Image size exceeds 15MB limit.');
      return;
    }

    if (target === 'profile') {
      setIsCompressingProfile(true);
    } else {
      setIsCompressingAway(true);
    }
    setFormError('');

    compressImageFile(file, (compressed) => {
      if (target === 'profile') {
        setFormProfilePhoto(compressed);
        setIsCompressingProfile(false);
      } else {
        setFormAwayPhoto(compressed);
        setIsCompressingAway(false);
      }
    });
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, target: 'profile' | 'away') => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Only image files are allowed.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) { // 15MB limit
      setFormError('Image size exceeds 15MB limit.');
      return;
    }

    if (target === 'profile') {
      setIsCompressingProfile(true);
    } else {
      setIsCompressingAway(true);
    }
    setFormError('');

    compressImageFile(file, (compressed) => {
      if (target === 'profile') {
        setFormProfilePhoto(compressed);
        setIsCompressingProfile(false);
      } else {
        setFormAwayPhoto(compressed);
        setIsCompressingAway(false);
      }
    });
  };

  // Pre-fill forms for Editing
  const startEdit = (lecturer: Lecturer) => {
    setEditingLecturer(lecturer);
    setFormName(lecturer.name);
    setFormMac(lecturer.macAddress);
    setFormSecondaryMac(lecturer.secondaryMacAddress || '');
    setFormIp(lecturer.ipAddress || '');
    setFormPin(lecturer.pin);
    setFormRfid(lecturer.rfidUid || '');
    setFormProfilePhoto(lecturer.profilePhotoUrl || '');
    setFormAwayPhoto(lecturer.awayPhotoUrl || '');
    setFormError('');
    setFormSuccess('');
    setShowAddForm(false);
    setShowScanPicker(false);
    setScanTargetField(null);
  };

  // Reset Form states
  const resetForm = () => {
    setEditingLecturer(null);
    setFormName('');
    setFormMac('');
    setFormSecondaryMac('');
    setFormIp('');
    setFormPin('');
    setFormRfid('');
    setFormProfilePhoto('');
    setFormAwayPhoto('');
    setFormError('');
    setFormSuccess('');
    setShowAddForm(false);
    setShowScanPicker(false);
    setScanTargetField(null);
    setIsCompressingProfile(false);
    setIsCompressingAway(false);
  };

  // Handle Save (Create / Update)
  const handleSaveLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formName.trim()) return setFormError('Name is required.');
    if (!formPin.trim() || formPin.length !== 4) return setFormError('PIN must be exactly 4 digits.');
    if (!formMac.trim()) return setFormError('Primary MAC Address is required.');

    // Validate Primary MAC pattern
    const cleanMac = formMac.toLowerCase().trim();
    const macRegex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
    if (!macRegex.test(cleanMac)) {
      return setFormError('Invalid Primary MAC address format. Example: aa:bb:cc:dd:ee:ff');
    }

    // Validate Secondary MAC pattern if provided
    let cleanSecondaryMac = formSecondaryMac.toLowerCase().trim();
    if (cleanSecondaryMac) {
      if (!macRegex.test(cleanSecondaryMac)) {
        return setFormError('Invalid Secondary MAC address format. Example: aa:bb:cc:dd:ee:ff');
      }
    }

    setIsSubmitting(true);
    try {
      const lecturerId = editingLecturer ? editingLecturer.id : `lecturer_${Date.now()}`;
      
      const payload: Lecturer = {
        id: lecturerId,
        name: formName.trim(),
        macAddress: cleanMac,
        secondaryMacAddress: cleanSecondaryMac || undefined,
        ipAddress: formIp.trim() || undefined,
        rfidUid: formRfid.trim() || undefined,
        pin: formPin.trim(),
        profilePhotoUrl: formProfilePhoto,
        awayPhotoUrl: formAwayPhoto,
        status: editingLecturer ? editingLecturer.status : 'Out of Office',
        customMessage: editingLecturer ? editingLecturer.customMessage : '',
        isPresentToday: editingLecturer ? editingLecturer.isPresentToday : false,
        isDeviceDetected: editingLecturer ? editingLecturer.isDeviceDetected : false,
        lastSeen: editingLecturer ? editingLecturer.lastSeen : 0
      };

      // Save to local database via backend API
      const response = await fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save to local database server');
      }

      setFormSuccess(editingLecturer ? 'Lecturer updated successfully!' : 'Lecturer added successfully!');
      
      // Update local listing
      const updatedList = dbLecturers.filter(l => l.id !== lecturerId);
      updatedList.push(payload);
      setDbLecturers(updatedList);

      // Notify parent
      if (onLecturersChange) {
        onLecturersChange();
      }

      setTimeout(() => {
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setFormError('Failed to save to local database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Lecturer via backend API
  const handleDeleteLecturer = async (id: string, name: string) => {
    triggerConfirm(
      'Delete Lecturer Profile',
      `Are you absolutely sure you want to delete ${name}? This action cannot be undone.`,
      async () => {
        try {
          const response = await fetch(`/api/lecturers/${id}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete lecturer');

          setDbLecturers(dbLecturers.filter((l) => l.id !== id));
          showToast(`Successfully deleted lecturer profile for ${name}.`);
          
          // Notify parent
          if (onLecturersChange) {
            onLecturersChange();
          }
        } catch (err) {
          console.error(err);
          showToast('Failed to delete lecturer from local database.', 'error');
        }
      }
    );
  };

  // Board-wide Daily Reset Manual Trigger
  const handleManualReset = async () => {
    triggerConfirm(
      'Reset Presence Board',
      'This will mark ALL lecturers as Out of Office and clear present-today flags. Proceed?',
      async () => {
        setIsSubmitting(true);
        try {
          const response = await fetch('/api/presence/reset', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('presence_admin_token') || ''}`
            },
            body: JSON.stringify({ password: adminPassword }), 
          });

          if (response.ok) {
            showToast('Board-wide manual reset completed successfully!');
            setTimeout(() => {
              window.location.reload();
            }, 1200);
          } else {
            const d = await response.json();
            showToast(`Reset failed: ${d.error || 'Server error'}`, 'error');
          }
        } catch (err) {
          showToast('Failed to execute reset API.', 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  // Handle database export (download)
  const handleExportDb = () => {
    try {
      const link = document.createElement('a');
      link.href = '/api/db/export';
      link.setAttribute('download', 'lecturer_presence_backup.json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Database backup downloaded successfully!');
    } catch (err) {
      showToast('Failed to export database.', 'error');
    }
  };

  // Handle database import (upload JSON)
  const handleImportDb = async () => {
    if (!backupFile) {
      setBackupImportError('Please select or drop a backup .json file first.');
      return;
    }

    setIsImporting(true);
    setBackupImportError('');
    setBackupImportSuccess('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const jsonData = JSON.parse(text);

        // Send JSON data to the backend
        const response = await fetch('/api/db/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setBackupImportSuccess(data.message || 'Database restored successfully!');
          showToast('Database restored successfully!');
          setBackupFile(null);
          
          if (onLecturersChange) {
            onLecturersChange();
          }
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setBackupImportError(data.error || 'Failed to restore database.');
        }
      } catch (err: any) {
        setBackupImportError('Invalid JSON format. Please upload a valid database backup file.');
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setBackupImportError('Error reading file.');
      setIsImporting(false);
    };

    reader.readAsText(backupFile);
  };

  // Login Gate
  if (!isAdminLoggedIn) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 my-10 animate-fade-in text-center">
        <div className="w-14 h-14 bg-slate-50 text-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Administrator Gate</h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed font-sans">
          Enter the administrator password to register staff, configure phone MAC addresses, change doorway board PINs, and view connection system logs.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              placeholder="Enter Admin Password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-center text-sm font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-slate-800"
              required
            />
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-150 rounded-2xl text-xs flex items-center justify-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 hover:bg-slate-850 active:bg-black text-white font-bold py-4 rounded-2xl text-sm shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:bg-slate-300"
          >
            {isSubmitting ? (
              <span>Logging in...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Verify Password</span>
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Administrator Panel</h2>
          <p className="text-xs text-slate-500 font-medium">Configure network detection, lecturer PINs, and check detailed system sync logs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleManualReset}
            disabled={isSubmitting}
            className="flex items-center space-x-1.5 px-4 py-2 bg-red-50 border border-red-100 hover:bg-red-100 active:bg-red-200 text-xs font-bold text-red-700 rounded-xl transition-all cursor-pointer"
            title="Manual reset all statuses to Out of Office"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Manual Reset</span>
          </button>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingLecturer(null);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-xs font-bold text-white rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lecturer</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xs font-bold text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200"
          >
            Exit Console
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex space-x-1 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveTab('lecturers')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'lecturers' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Lecturers ({dbLecturers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'logs' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>System Events</span>
        </button>
        <button
          onClick={() => setActiveTab('rfid')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'rfid' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>RFID Simulator</span>
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'backup' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Backup & Restore</span>
        </button>
        <button
          onClick={() => setActiveTab('signage')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'signage' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>TV Signage Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'network' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>AP Subnet & Rooms</span>
        </button>
      </div>

      {/* Form Popup / Panel (Add or Edit) */}
      {(showAddForm || editingLecturer) && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">
              {editingLecturer ? `Edit Profile: ${editingLecturer.name}` : 'Register New Lecturer'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveLecturer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Left Column: Basic Details */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. John Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    required
                  />
                </div>
                {/* Primary MAC (5GHz) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500">Primary MAC (5GHz SSID)</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (showScanPicker && scanTargetField === 'primary') {
                          setShowScanPicker(false);
                          setScanTargetField(null);
                        } else {
                          setScanTargetField('primary');
                          setShowScanPicker(true);
                          fetchScannedDevices();
                        }
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isScanningDevices && scanTargetField === 'primary' ? 'animate-spin' : ''}`} />
                      <span>{showScanPicker && scanTargetField === 'primary' ? 'Close Scan' : 'Scan 5GHz MAC'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 7c:a1:42:ff:8a:2d"
                    value={formMac}
                    onChange={(e) => setFormMac(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-850 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Main phone MAC address connected to 5GHz network.</p>
                </div>

                {/* Secondary MAC (2.4GHz) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500">Secondary MAC (2.4GHz SSID - Optional)</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (showScanPicker && scanTargetField === 'secondary') {
                          setShowScanPicker(false);
                          setScanTargetField(null);
                        } else {
                          setScanTargetField('secondary');
                          setShowScanPicker(true);
                          fetchScannedDevices();
                        }
                      }}
                      className="text-[10px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${isScanningDevices && scanTargetField === 'secondary' ? 'animate-spin' : ''}`} />
                      <span>{showScanPicker && scanTargetField === 'secondary' ? 'Close Scan' : 'Scan 2.4GHz MAC'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 7c:a1:42:ff:8a:2e (optional)"
                    value={formSecondaryMac}
                    onChange={(e) => setFormSecondaryMac(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-850 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Secondary MAC if phone uses different virtual/band MAC address on 2.4GHz.</p>
                </div>

                {/* Scanner Popup Dropdown (Shared for Primary or Secondary) */}
                {showScanPicker && (
                  <div className="mt-1 border border-indigo-200 rounded-xl bg-indigo-50/60 p-3 max-h-52 overflow-y-auto space-y-1 shadow-md">
                    <div className="flex items-center justify-between text-[10px] text-indigo-900 font-mono font-bold uppercase pb-1.5 border-b border-indigo-200 mb-1.5">
                      <span>Select Device for {scanTargetField === 'secondary' ? '2.4GHz MAC' : '5GHz MAC'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowScanPicker(false);
                          setScanTargetField(null);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 font-sans text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    {isScanningDevices && scannedDevices.length === 0 ? (
                      <p className="text-[10px] text-indigo-500 text-center py-2 animate-pulse font-mono">Scanning local subnet devices...</p>
                    ) : scannedDevices.length === 0 ? (
                      <div className="text-center py-2 space-y-1">
                        <p className="text-[10px] text-slate-500">No active devices reported yet.</p>
                        <p className="text-[9px] text-slate-400">Ensure scanner agent is reporting device pings.</p>
                      </div>
                    ) : (
                      scannedDevices.map((dev) => (
                        <button
                          key={dev.mac}
                          type="button"
                          disabled={dev.isAssigned}
                          onClick={() => {
                            if (scanTargetField === 'secondary') {
                              setFormSecondaryMac(dev.mac);
                            } else {
                              setFormMac(dev.mac);
                            }
                            if (dev.ip) setFormIp(dev.ip);
                            setShowScanPicker(false);
                            setScanTargetField(null);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] transition-all cursor-pointer ${
                            dev.isAssigned
                              ? 'bg-slate-100/70 opacity-60 cursor-not-allowed border border-slate-200'
                              : 'hover:bg-white hover:text-indigo-950 border border-indigo-100 bg-white/90 shadow-2xs mb-1'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-800">{dev.mac}</span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              IP: {dev.ip || 'Unknown'} • {Math.round((Date.now() - dev.timestamp) / 1000 / 60)}m ago
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            dev.isAssigned
                              ? 'bg-slate-200 text-slate-500'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}>
                            {dev.isAssigned ? `Assigned (${dev.assignedTo})` : `Pick as ${scanTargetField === 'secondary' ? '2.4GHz' : '5GHz'}`}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">4-Digit Security PIN</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-850 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Needed for rapid status updates at the physical doorboard.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Assigned / Last Known IP (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 192.168.1.105 or 192.168.2.112"
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-850 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Used for traceroute hop distance tracking & roaming diagnostics.</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">RFID Card / Tag UID (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8A2BC34D"
                    value={formRfid}
                    onChange={(e) => setFormRfid(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-850 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Assign a physical card or keyfob (hex). Taps toggle presence.</p>
                </div>
              </div>

              {/* Middle Column: Profile Photo Dropzone */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Profile Photo</label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'profile')}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-white hover:bg-slate-50 transition-colors relative flex flex-col items-center justify-center min-h-[140px]"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'profile')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={isCompressingProfile}
                  />
                  {isCompressingProfile ? (
                    <div className="space-y-2 text-indigo-600 flex flex-col items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <p className="text-[10px] font-bold">Compressing photo...</p>
                      <p className="text-[8px] text-slate-400">Optimizing phone high-res image</p>
                    </div>
                  ) : formProfilePhoto ? (
                    <div className="relative">
                      <img src={formProfilePhoto} alt="Profile preview" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setFormProfilePhoto('')}
                        className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-400">
                      <Upload className="w-5 h-5 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-600">Drag file here or click</p>
                      <p className="text-[9px]">Auto-Compressed on device</p>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Or paste external Image URL"
                    value={formProfilePhoto.startsWith('data:') ? '' : formProfilePhoto}
                    onChange={(e) => setFormProfilePhoto(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    disabled={isCompressingProfile}
                  />
                </div>
              </div>

              {/* Right Column: Away Photo Dropzone */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Away Photo</label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'away')}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center bg-white hover:bg-slate-50 transition-colors relative flex flex-col items-center justify-center min-h-[140px]"
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'away')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={isCompressingAway}
                  />
                  {isCompressingAway ? (
                    <div className="space-y-2 text-indigo-600 flex flex-col items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <p className="text-[10px] font-bold">Compressing photo...</p>
                      <p className="text-[8px] text-slate-400">Optimizing phone high-res image</p>
                    </div>
                  ) : formAwayPhoto ? (
                    <div className="relative">
                      <img src={formAwayPhoto} alt="Away preview" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setFormAwayPhoto('')}
                        className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-400">
                      <Upload className="w-5 h-5 mx-auto text-amber-500" />
                      <p className="text-[10px] font-bold text-slate-600">Drag file here or click</p>
                      <p className="text-[9px]">Displayed during away times</p>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Or paste external Image URL"
                    value={formAwayPhoto.startsWith('data:') ? '' : formAwayPhoto}
                    onChange={(e) => setFormAwayPhoto(e.target.value)}
                    className="w-full bg-white rounded-xl border border-slate-200 px-3.5 py-2.5 text-[11px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    disabled={isCompressingAway}
                  />
                </div>
              </div>

            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-150 rounded-xl text-xs flex items-center space-x-2 animate-pulse">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressingProfile || isCompressingAway}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {(isSubmitting || isCompressingProfile || isCompressingAway) && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                <span>
                  {isSubmitting ? 'Saving...' : (isCompressingProfile || isCompressingAway) ? 'Compressing...' : 'Save Lecturer'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'lecturers' && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 uppercase tracking-wider font-mono font-bold">
                  <th className="py-4 px-5 font-bold">Lecturer</th>
                  <th className="py-4 px-5 font-bold">MAC Address</th>
                  <th className="py-4 px-5 font-bold">RFID Tag</th>
                  <th className="py-4 px-5 font-bold">Board PIN</th>
                  <th className="py-4 px-5 font-bold">Presence</th>
                  <th className="py-4 px-5 font-bold">Device</th>
                  <th className="py-4 px-5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs">
                {dbLecturers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 italic font-sans">
                      No lecturers registered yet. Click "Add Lecturer" above to get started.
                    </td>
                  </tr>
                ) : (
                  dbLecturers.map((lect) => (
                    <tr key={lect.id} className="hover:bg-slate-50/50 transition-all font-sans">
                      {/* Lecturer Info */}
                      <td className="py-4 px-5 flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                          {lect.profilePhotoUrl ? (
                            <img src={lect.profilePhotoUrl} alt={lect.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            lect.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{lect.name}</p>
                          <p className="text-[10px] text-slate-400 italic line-clamp-1 max-w-[155px]">
                            {lect.customMessage || 'No status message'}
                          </p>
                        </div>
                      </td>
                      
                      {/* MAC Addresses (Primary 5GHz & Secondary 2.4GHz) */}
                      <td className="py-4 px-5 font-mono text-slate-700 font-bold uppercase">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-bold px-1 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-sans uppercase">5GHz</span>
                            <span className="text-[11px]">{lect.macAddress}</span>
                          </div>
                          {lect.secondaryMacAddress ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] font-bold px-1 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-sans uppercase">2.4GHz</span>
                              <span className="text-[11px] text-slate-600">{lect.secondaryMacAddress}</span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-300 italic font-sans font-normal block pl-0.5">No 2.4GHz MAC</span>
                          )}
                        </div>
                      </td>

                      {/* RFID Card Tag */}
                      <td className="py-4 px-5">
                        {lect.rfidUid ? (
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-lg select-all">
                            {lect.rfidUid}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 italic">None</span>
                        )}
                      </td>

                      {/* Security PIN */}
                      <td className="py-4 px-5 font-mono text-slate-500 font-bold tracking-wider">
                        •••• (PIN: {lect.pin})
                      </td>

                      {/* Today's status */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          lect.isPresentToday 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-50 text-slate-400 border-slate-150'
                        }`}>
                          {lect.isPresentToday ? 'Checked-In' : 'Off-site'}
                        </span>
                      </td>

                      {/* Current Device connection state */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          lect.isDeviceDetected 
                            ? 'bg-blue-50 text-blue-700 border-blue-100' 
                            : 'bg-slate-50 text-slate-400 border-slate-150'
                        }`}>
                          {lect.isDeviceDetected ? 'Connected' : 'Disconnected'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right space-x-1.5">
                        <button
                          onClick={() => startEdit(lect)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit Lecturer Profile"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLecturer(lect.id, lect.name)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                          title="Delete Lecturer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        /* Log Views */
        <div className="space-y-4 font-sans animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider font-mono">System Events</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Logs are archived daily to optimize system performance.</p>
            </div>
            
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase">Log Date:</span>
              <select
                value={selectedLogDate}
                onChange={(e) => setSelectedLogDate(e.target.value)}
                className="text-xs bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-bold py-1 px-2.5 rounded-xl cursor-pointer outline-none transition-all font-sans"
              >
                <option value="active">Active (Recent 50)</option>
                {logDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
              <button
                onClick={() => { fetchLogDates(); fetchLogs(selectedLogDate); }}
                disabled={loadingLogs}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Refresh log files"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[400px] overflow-y-auto shadow-xs">
            {loadingLogs ? (
              <div className="py-12 text-center text-slate-400 italic">Fetching system log logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic">No system log activity recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <div key={log.id} className="p-3.5 flex items-start justify-between space-x-4 hover:bg-slate-50/50 text-xs">
                    <div className="flex items-start space-x-3">
                      <span className={`mt-1 shrink-0 h-2 w-2 rounded-full ${
                        log.action === 'device_detected' ? 'bg-emerald-500' :
                        log.action === 'device_lost' ? 'bg-amber-500' :
                        log.action === 'status_change' ? 'bg-indigo-500' : 'bg-rose-500'
                      }`} />
                      <div>
                        <p className="text-slate-800 font-bold">{log.lecturerName}</p>
                        <p className="text-slate-500 mt-0.5">{log.details}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'rfid' && (
        <div className="space-y-6 font-sans animate-fade-in">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center space-x-3 text-slate-800">
              <div className="p-2.5 bg-slate-900 text-white rounded-xl">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Physical RFID Hardware Simulator</h3>
                <p className="text-[11px] text-slate-500">Emulate real-time MFRC522 keyfob/card scans connected to Raspberry Pi GPIO pins.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Card 1: Registered RFID Tokens */}
              <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-3.5 shadow-3xs">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">Registered Lecturer Keyfobs</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Tap any configured keyfob below to toggle presence (Available &lt;-&gt; Out of Office) in real-time.
                </p>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {dbLecturers.filter(l => l.rfidUid).length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                      <p className="text-[11px] text-slate-400 italic">No lecturers have RFID tags assigned yet.</p>
                      <button
                        onClick={() => setActiveTab('lecturers')}
                        className="mt-2 text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Assign tags in Lecturer tab &rarr;
                      </button>
                    </div>
                  ) : (
                    dbLecturers.filter(l => l.rfidUid).map((lect) => (
                      <button
                        key={lect.id}
                        onClick={async () => {
                          if (!lect.rfidUid) return;
                          setIsSimulating(true);
                          setSimResult(null);
                          try {
                            const response = await fetch('/api/presence/rfid', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ rfidUid: lect.rfidUid }),
                            });
                            const data = await response.json();
                            if (response.ok && data.success) {
                              setSimResult({ success: true, message: data.message });
                              showToast(data.message, 'success');
                              if (onLecturersChange) onLecturersChange();
                              fetchLogs();
                            } else {
                              setSimResult({ success: false, message: data.error || data.message || 'Error occurred.' });
                              showToast(data.error || data.message || 'Simulation error', 'error');
                            }
                          } catch (err: any) {
                            setSimResult({ success: false, message: err.message || 'Network connection failed.' });
                          } finally {
                            setIsSimulating(false);
                          }
                        }}
                        disabled={isSimulating}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-150 hover:border-slate-300 hover:bg-slate-50 transition-all text-left text-xs cursor-pointer group disabled:opacity-50 bg-white"
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-600">
                            {lect.profilePhotoUrl ? (
                              <img src={lect.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              lect.name[0]
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-850">{lect.name}</p>
                            <p className="text-[9px] font-mono font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                              UID: {lect.rfidUid}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          lect.status === 'Out of Office'
                            ? 'bg-slate-50 text-slate-400 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {lect.status}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Card 2: Custom / Unregistered Tag */}
              <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between shadow-3xs min-h-[300px]">
                <div className="space-y-3.5">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">Scan New / Custom Tag</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Tap an unassigned card UID to simulate scanning a new tag. Unregistered swipes are logged in system logs, allowing you to easily copy the hex ID and assign it!
                  </p>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 block uppercase font-mono">Custom Card UID (Hex)</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="e.g. 789AB1C2"
                        value={simRfidUid}
                        onChange={(e) => setSimRfidUid(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))}
                        className="flex-1 bg-white rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                      <button
                        onClick={async () => {
                          if (!simRfidUid.trim()) return;
                          setIsSimulating(true);
                          setSimResult(null);
                          try {
                            const response = await fetch('/api/presence/rfid', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ rfidUid: simRfidUid.trim() }),
                            });
                            const data = await response.json();
                            if (response.ok && data.success) {
                              setSimResult({ success: true, message: data.message });
                              showToast(data.message, 'success');
                              if (onLecturersChange) onLecturersChange();
                              fetchLogs();
                            } else {
                              setSimResult({ 
                                success: false, 
                                message: data.error || data.message || 'Card is not registered.',
                                unregisteredUid: data.unregisteredUid
                              });
                              showToast(data.error || data.message || 'Scan unregistered card', 'error');
                              fetchLogs();
                            }
                          } catch (err: any) {
                            setSimResult({ success: false, message: err.message || 'Connection failed.' });
                          } finally {
                            setIsSimulating(false);
                          }
                        }}
                        disabled={isSimulating || !simRfidUid.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-bold text-xs rounded-xl transition-all shadow-3xs cursor-pointer disabled:cursor-not-allowed"
                      >
                        Tap Card
                      </button>
                    </div>
                  </div>

                  {/* Preset Unregistered cards for quick testing */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">Test Presets:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {['ABC123D4', 'FA783CE9', '092BC87F'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSimRfidUid(preset)}
                          className="px-2 py-1 text-[10px] font-mono font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Simulation Result Dialog */}
                {simResult && (
                  <div className={`mt-4 p-3 rounded-xl border text-xs leading-relaxed font-sans ${
                    simResult.success 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-start space-x-2">
                      <span className="mt-0.5 font-bold">{simResult.success ? '✔ SUCCESS:' : 'ℹ SCAN REPORT:'}</span>
                      <div className="space-y-1 flex-1">
                        <p>{simResult.message}</p>
                        {simResult.unregisteredUid && (
                          <div className="mt-2 bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Card UID: <code className="font-mono font-bold text-slate-800 bg-slate-50 px-1 py-0.5 rounded border border-slate-150">{simResult.unregisteredUid}</code></span>
                            <button
                              onClick={() => {
                                setFormRfid(simResult.unregisteredUid || '');
                                setShowAddForm(true);
                                setEditingLecturer(null);
                                setFormName('');
                                setFormMac('');
                                setFormPin('');
                                showToast('Card UID copied! Complete registration below.', 'success');
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                            >
                              + Register Card
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-800 text-sm mb-1">Database Update, Import, & Export Console</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans mb-4">
              To update or rebuild the application without resetting your database, you can safely export your current dataset and restore it at any time. The database contains all registered lecturers, active PIN codes, and event history log entries.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Panel */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-3xs">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Download className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span className="text-xs font-bold text-slate-700">1. Export / Backup Database</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    Download the complete current database as a structured <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">lecturer_presence_backup.json</code> file. Keep this file safe. You can use it as a complete restorable snapshot when deploying newer application releases.
                  </p>
                </div>
                <div className="pt-4">
                  <button
                    onClick={handleExportDb}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>
              </div>

              {/* Import Panel */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-3xs">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700">2. Import / Restore Database</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                    Overwrite the active database with an existing JSON backup file. All current lecturer spots, registered RFID tags, and system events will be replaced by the backup dataset.
                  </p>

                  {/* Drag and Drop Zone conforming to criteria */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingBackup(true);
                    }}
                    onDragLeave={() => setIsDraggingBackup(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingBackup(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && (file.type === "application/json" || file.name.endsWith('.json'))) {
                        setBackupFile(file);
                        setBackupImportError('');
                      } else {
                        setBackupImportError('Only JSON database backup files (.json) are supported.');
                      }
                    }}
                    onClick={() => document.getElementById('backup-file-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-300 ${
                      isDraggingBackup
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : backupFile
                          ? 'border-emerald-500 bg-emerald-50/20'
                          : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/40'
                    }`}
                  >
                    <input
                      id="backup-file-input"
                      type="file"
                      accept=".json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setBackupFile(file);
                          setBackupImportError('');
                        }
                      }}
                      className="hidden"
                    />
                    {backupFile ? (
                      <div className="space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                        <p className="text-xs font-bold text-slate-800 truncate">{backupFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{(backupFile.size / 1024).toFixed(2)} KB • Click to replace</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">Drag & Drop backup JSON or click</p>
                        <p className="text-[10px] text-slate-400">Supported: lecturer_presence_backup.json</p>
                      </div>
                    )}
                  </div>

                  {backupImportError && (
                    <p className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg p-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{backupImportError}</span>
                    </p>
                  )}

                  {backupImportSuccess && (
                    <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{backupImportSuccess}</span>
                    </p>
                  )}
                </div>

                <div className="pt-4 flex gap-2">
                  {backupFile && (
                    <button
                      onClick={() => setBackupFile(null)}
                      className="px-3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleImportDb}
                    disabled={isImporting || !backupFile}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    {isImporting ? (
                      <span>Restoring Database...</span>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload & Restore Backup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TV Signage Settings Tab */}
      {activeTab === 'signage' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <div className="flex items-center space-x-2">
                <Tv className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">TV Signage Display & Layout Preferences</h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg">
                Applies to TV Signage Mode
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Configure how the hallway TV kiosk displays lecturer cards. These settings adapt the board dynamically across different screen sizes (e.g. 1366x768 17" displays vs 4K TVs) without requiring manual scrolling.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              
              {/* Option 1: Rotation Interval */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <label className="text-xs font-bold text-slate-800 block flex items-center justify-between">
                  <span>Carousel Page Rotation Speed</span>
                  <span className="text-indigo-600 font-mono font-bold">{signageIntervalSec} seconds</span>
                </label>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Frequency at which the TV board automatically rotates through pages of lecturers when total count exceeds items per page. Default is <strong>10 seconds</strong>.
                </p>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[5, 10, 15, 20].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleSaveSignageSettings(sec, signageItemsPerPage, signageExpandToFill, signageAutoRotate)}
                      className={`py-2 px-1 text-xs font-bold font-mono rounded-xl border transition-all cursor-pointer ${
                        signageIntervalSec === sec
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {sec}s {sec === 10 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <span className="text-[11px] font-medium text-slate-500">Custom (seconds):</span>
                  <input
                    type="number"
                    min="3"
                    max="120"
                    value={signageIntervalSec}
                    onChange={(e) => {
                      const val = Math.max(3, Math.min(120, parseInt(e.target.value) || 10));
                      handleSaveSignageSettings(val, signageItemsPerPage, signageExpandToFill, signageAutoRotate);
                    }}
                    className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 text-center"
                  />
                </div>
              </div>

              {/* Option 2: Items Per Page */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <label className="text-xs font-bold text-slate-800 block flex items-center justify-between">
                  <span>Lecturers Cards Per Page</span>
                  <span className="text-indigo-600 font-mono font-bold">{signageItemsPerPage} cards</span>
                </label>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Choose how many cards fit per page before splitting into rotating pages. Fits smaller 1366x768 screens or large 4K displays.
                </p>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[4, 6, 8, 12].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleSaveSignageSettings(signageIntervalSec, num, signageExpandToFill, signageAutoRotate)}
                      className={`py-2 px-1 text-xs font-bold font-mono rounded-xl border transition-all cursor-pointer ${
                        signageItemsPerPage === num
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {num} {num === 8 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Card Expand To Fill Vertical Height */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block">Expand Cards to Fill 100% TV Height</label>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      Automatically stretches cards to fill vertical container height so there are no empty gaps on any kiosk screen size.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={signageExpandToFill}
                    onChange={(e) => handleSaveSignageSettings(signageIntervalSec, signageItemsPerPage, e.target.checked, signageAutoRotate)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shrink-0"
                  />
                </div>
              </div>

              {/* Option 4: Auto Rotate Pages Toggle */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block">Auto-Rotate Carousel Pages</label>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      Continuously cycle pages automatically on the kiosk board. Disable if you prefer manual page navigation.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={signageAutoRotate}
                    onChange={(e) => handleSaveSignageSettings(signageIntervalSec, signageItemsPerPage, signageExpandToFill, e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shrink-0"
                  />
                </div>
              </div>

            </div>

            <div className="pt-2 border-t border-slate-200/60 flex justify-end">
              <button
                type="button"
                onClick={() => handleSaveSignageSettings(signageIntervalSec, signageItemsPerPage, signageExpandToFill, signageAutoRotate)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Signage Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: AP Subnet Rules Configuration (Protected Admin Console) */}
      {activeTab === 'network' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Route className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">AP Subnet & Room Zone Configuration</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Map campus subnets to physical rooms and expected router hop counts for precise presence tracking.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={fetchNetworkConfig}
                  disabled={isLoadingNetworkConfig}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNetworkConfig ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveNetworkConfig}
                  disabled={isSavingNetworkConfig}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingNetworkConfig ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>

            {/* Gateway & Auto-Discovery Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Default Gateway Router IP */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Server className="w-4 h-4 text-slate-500" />
                  <span>Lecturer Room Router Gateway IP</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  The primary subnet gateway router. Devices on this subnet are considered directly present (1 hop).
                </p>
                <input
                  type="text"
                  value={networkRouterIp}
                  onChange={(e) => setNetworkRouterIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Classroom Auto-Discovery Toggle */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Classroom Auto-Discovery</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={networkAutoDiscover}
                      onChange={(e) => setNetworkAutoDiscover(e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shrink-0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1">
                    When active, newly detected subnets from lecturer devices are automatically probed for router hops and registered as room zones.
                  </p>
                </div>
                <div className="pt-1">
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    networkAutoDiscover ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <span>Status: {networkAutoDiscover ? 'Enabled (Autonomous Learning)' : 'Disabled (Manual Only)'}</span>
                  </span>
                </div>
              </div>

            </div>

            {/* Autonomous Campus Subnet Sweep Trigger */}
            <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 rounded-xl border border-indigo-100/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1.5">
                  <Radio className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900">Autonomous Campus Subnet Sweep</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Trigger an on-demand scan of campus subnets (classrooms, labs, auditorium) to detect new AP zones without waiting for periodic sweeps.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunAdminAutoSweep}
                disabled={isAutoSweeping}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0 flex items-center space-x-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAutoSweeping ? 'animate-spin' : ''}`} />
                <span>{isAutoSweeping ? 'Sweeping Campus...' : 'Trigger Auto-Sweep'}</span>
              </button>
            </div>

            {sweepFeedback && (
              <div className="p-3 bg-white border border-indigo-200 text-indigo-900 rounded-xl text-xs font-medium leading-relaxed animate-fade-in flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>{sweepFeedback}</span>
              </div>
            )}

            {/* Rules Management List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">
                    Subnet & Room Zone Rules ({networkSubnetRules.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Editable by Admin Only
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newRule: SubnetZoneRule = {
                      id: `rule_${Date.now()}`,
                      subnetCidrOrPrefix: '192.168.3.',
                      name: 'New Classroom AP',
                      expectedHops: 2,
                      zoneType: 'adjacent',
                      description: 'Classroom / Lab access point zone',
                    };
                    setNetworkSubnetRules([...networkSubnetRules, newRule]);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Room Rule</span>
                </button>
              </div>

              {networkSubnetRules.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-medium">No custom subnet rules configured.</p>
                  <p className="text-[11px] text-slate-400">Click "Add Room Rule" or run "Trigger Auto-Sweep" to auto-discover rooms.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {networkSubnetRules.map((rule, idx) => (
                    <div key={rule.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            {rule.subnetCidrOrPrefix}
                          </span>
                          {rule.autoLearned && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>Auto-Discovered</span>
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rule.expectedHops === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rule.expectedHops} {rule.expectedHops === 1 ? 'Hop (Direct)' : 'Hops (Routed)'}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              triggerConfirm(
                                'Delete Subnet Rule',
                                `Are you sure you want to delete rule for "${rule.name}" (${rule.subnetCidrOrPrefix})?`,
                                () => {
                                  setNetworkSubnetRules(networkSubnetRules.filter((_, i) => i !== idx));
                                  showToast(`Removed rule for ${rule.name}`);
                                }
                              );
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Rule Fields Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Subnet Prefix / CIDR</label>
                          <input
                            type="text"
                            value={rule.subnetCidrOrPrefix}
                            onChange={(e) => {
                              const copy = [...networkSubnetRules];
                              copy[idx].subnetCidrOrPrefix = e.target.value;
                              setNetworkSubnetRules(copy);
                            }}
                            placeholder="e.g. 192.168.3."
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Room / Zone Name</label>
                          <input
                            type="text"
                            value={rule.name}
                            onChange={(e) => {
                              const copy = [...networkSubnetRules];
                              copy[idx].name = e.target.value;
                              setNetworkSubnetRules(copy);
                            }}
                            placeholder="e.g. Ruang Kuliah 301"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Expected Routing Hops</label>
                          <select
                            value={rule.expectedHops}
                            onChange={(e) => {
                              const copy = [...networkSubnetRules];
                              copy[idx].expectedHops = parseInt(e.target.value, 10);
                              setNetworkSubnetRules(copy);
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                          >
                            <option value="1">1 Hop (Direct - Lecturer Office)</option>
                            <option value="2">2 Hops (Adjacent AP / Classroom)</option>
                            <option value="3">3 Hops (Corridor / Multi-Switch AP)</option>
                            <option value="4">4 Hops (Remote Building / Hall)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Description / Notes</label>
                        <input
                          type="text"
                          value={rule.description || ''}
                          onChange={(e) => {
                            const copy = [...networkSubnetRules];
                            copy[idx].description = e.target.value;
                            setNetworkSubnetRules(copy);
                          }}
                          placeholder="Zone description (e.g. 3rd Floor Computer Science Classroom AP)"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save & Reset Actions Bar */}
            <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerConfirm(
                    'Reset Subnet Rules to Standard Defaults',
                    'This will replace the custom rules with standard campus presets (Lecturer Room, Staff AP, Classroom 301, Classroom 302, Auditorium, Corridor AP).',
                    () => {
                      const defaults: SubnetZoneRule[] = [
                        {
                          id: "rule_lecturer_room",
                          name: "Lecturer Room (Direct AP)",
                          subnetCidrOrPrefix: "192.168.1.",
                          expectedHops: 1,
                          zoneType: "lecturer_room",
                          description: "Direct department access point. Zero intermediate router hops.",
                        },
                        {
                          id: "rule_staff_room",
                          name: "Staff Room Access Point",
                          subnetCidrOrPrefix: "192.168.2.",
                          expectedHops: 2,
                          zoneType: "staff_room",
                          description: "Adjacent department access point connected through floor router (1 hop).",
                        },
                        {
                          id: "rule_classroom_301",
                          name: "Classroom 301 / Lab AP",
                          subnetCidrOrPrefix: "192.168.3.",
                          expectedHops: 2,
                          zoneType: "adjacent",
                          description: "Multimedia laboratory and classroom floor AP.",
                        },
                        {
                          id: "rule_classroom_302",
                          name: "Classroom 302 AP",
                          subnetCidrOrPrefix: "192.168.4.",
                          expectedHops: 2,
                          zoneType: "adjacent",
                          description: "Standard classroom wing AP.",
                        },
                        {
                          id: "rule_auditorium",
                          name: "Auditorium / Hall AP",
                          subnetCidrOrPrefix: "192.168.10.",
                          expectedHops: 3,
                          zoneType: "remote",
                          description: "Central campus auditorium / grand hall AP.",
                        },
                        {
                          id: "rule_corridor",
                          name: "Corridor & Public Access Point",
                          subnetCidrOrPrefix: "192.168.73.",
                          expectedHops: 3,
                          zoneType: "remote",
                          description: "Campus walkway and corridor public access point.",
                        },
                      ];
                      setNetworkSubnetRules(defaults);
                      showToast('Subnet rules restored to campus standard defaults. Click Save Changes to apply.');
                    }
                  );
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                Reset to Standard Defaults
              </button>

              <button
                type="button"
                onClick={handleSaveNetworkConfig}
                disabled={isSavingNetworkConfig}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingNetworkConfig ? 'Saving Configuration...' : 'Save Network Configuration'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toast.isOpen && (
        <div className="fixed bottom-5 right-5 z-50 animate-fade-in">
          <div className={`flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-xl border ${
            toast.type === 'error' 
              ? 'bg-red-50 text-red-800 border-red-200' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
            }`} />
            <p className="text-xs font-bold font-sans">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <h4 className="font-bold text-slate-900 text-sm">{confirmModal.title}</h4>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
