"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";

// Data persistence interface
interface SessionData {
  clockedIn: boolean;
  onBreak: boolean;
  clockInTime: string | null; // ISO string
  clockOutTime: string | null; // ISO string
  breakStart: string | null; // ISO string
  totalBreakMs: number;
  elapsedMs: number;
  breakCounter: number;
  lastSaved: number; // timestamp
}

// Storage keys
const STORAGE_KEY = 'shifter_session_data';
const BACKUP_STORAGE_KEY = 'shifter_session_backup';

// Utility functions for data persistence
function saveToStorage(data: SessionData, key: string = STORAGE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

function loadFromStorage(key: string = STORAGE_KEY): SessionData | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return null;
  }
}

function clearStorage(key: string = STORAGE_KEY) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

export default function Home() {
  // --- State ---
  const [showSummary, setShowSummary] = useState(false);
  const [showConfettiBurst, setShowConfettiBurst] = useState(false);
  const [summaryTransition, setSummaryTransition] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [clockedIn, setClockedIn] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [clockOutTime, setClockOutTime] = useState<Date | null>(null);
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [totalBreakMs, setTotalBreakMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [breakCounter, setBreakCounter] = useState(0);
  const [confirmClockOut, setConfirmClockOut] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [confettiOrigin, setConfettiOrigin] = useState<[number, number]>([0.5, 0.7]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRecoveryMessage, setShowRecoveryMessage] = useState(false);
  const [showBackupMenu, setShowBackupMenu] = useState(false);

  // --- Data persistence functions ---
  const saveSessionData = () => {
    setIsSaving(true);
    const sessionData: SessionData = {
      clockedIn,
      onBreak,
      clockInTime: clockInTime?.toISOString() || null,
      clockOutTime: clockOutTime?.toISOString() || null,
      breakStart: breakStart?.toISOString() || null,
      totalBreakMs,
      elapsedMs,
      breakCounter,
      lastSaved: Date.now()
    };
    
    // Save to primary storage
    saveToStorage(sessionData, STORAGE_KEY);
    // Save backup
    saveToStorage(sessionData, BACKUP_STORAGE_KEY);
    
    // Clear saving indicator after a short delay
    setTimeout(() => setIsSaving(false), 500);
  };

  const loadSessionData = (): boolean => {
    // Try primary storage first
    let data = loadFromStorage(STORAGE_KEY);
    let usedBackup = false;
    
    // If primary fails, try backup
    if (!data) {
      data = loadFromStorage(BACKUP_STORAGE_KEY);
      usedBackup = true;
    }
    
    if (data) {
      setClockedIn(data.clockedIn);
      setOnBreak(data.onBreak);
      setClockInTime(data.clockInTime ? new Date(data.clockInTime) : null);
      setClockOutTime(data.clockOutTime ? new Date(data.clockOutTime) : null);
      setBreakStart(data.breakStart ? new Date(data.breakStart) : null);
      setTotalBreakMs(data.totalBreakMs);
      setElapsedMs(data.elapsedMs);
      setBreakCounter(data.breakCounter);
      
      // Show recovery message if backup was used
      if (usedBackup) {
        setShowRecoveryMessage(true);
        setTimeout(() => setShowRecoveryMessage(false), 5000);
      }
      
      return true;
    }
    
    return false;
  };

  const clearSessionData = () => {
    clearStorage(STORAGE_KEY);
    clearStorage(BACKUP_STORAGE_KEY);
  };

  // --- Load data on component mount ---
  useEffect(() => {
    const loaded = loadSessionData();
    setIsDataLoaded(true);
    
    // If we have an active session, validate it
    if (loaded && clockedIn && clockInTime) {
      const now = new Date();
      const sessionAge = now.getTime() - clockInTime.getTime();
      
      // If session is older than 24 hours, clear it (safety measure)
      if (sessionAge > 24 * 60 * 60 * 1000) {
        clearSessionData();
        resetToHome();
      } else {
        // Update elapsed time for active sessions
        if (!onBreak) {
          setElapsedMs(now.getTime() - clockInTime.getTime() - totalBreakMs);
        }
        if (onBreak && breakStart) {
          setBreakCounter(now.getTime() - breakStart.getTime());
        }
      }
    }
  }, []);

  // --- Auto-save data when state changes ---
  useEffect(() => {
    if (isDataLoaded) {
      saveSessionData();
    }
  }, [clockedIn, onBreak, clockInTime, clockOutTime, breakStart, totalBreakMs, elapsedMs, breakCounter, isDataLoaded]);

  // --- Page visibility API for additional persistence ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Save data when page becomes hidden
        saveSessionData();
      }
    };

    const handleBeforeUnload = () => {
      // Save data before page unload
      saveSessionData();
    };

    // Periodic save every 30 seconds for active sessions
    const periodicSave = setInterval(() => {
      if (clockedIn || onBreak) {
        saveSessionData();
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(periodicSave);
    };
  }, [clockedIn, onBreak, clockInTime, clockOutTime, breakStart, totalBreakMs, elapsedMs, breakCounter]);

  // --- Click outside to close backup menu ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showBackupMenu && !(event.target as Element).closest('.backup-menu')) {
        setShowBackupMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBackupMenu]);

  // --- Real-time clock and date ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
      if (clockedIn && clockInTime && !onBreak) {
        setElapsedMs(now.getTime() - clockInTime.getTime() - totalBreakMs);
      }
      if (onBreak && breakStart) {
        setBreakCounter(now.getTime() - breakStart.getTime());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [clockedIn, clockInTime, onBreak, breakStart, totalBreakMs]);

  // --- Confetti burst with canvas ---
  useEffect(() => {
    if (!showConfettiBurst) return;
    const [x, y] = confettiOrigin;
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const myConfetti = confetti.create(canvas!, { resize: true, useWorker: true });
    if (!myConfetti) return;
    myConfetti?.({
      particleCount: 1200,
      startVelocity: 90,
      spread: 140,
      origin: { x, y },
      gravity: 1.25,
      ticks: 900,
      scalar: 1.2,
      colors: ["#ff9860", "#651818", "#22c55e", "#ff9800", "#ef4444", "#fff"],
    })?.then(() => {
      setShowConfettiBurst(false);
    });
  }, [showConfettiBurst, confettiOrigin]);

  // --- Handlers ---
  function handleClockIn() {
    const now = new Date();
    setClockedIn(true);
    setClockInTime(now);
    setClockOutTime(null);
    setTotalBreakMs(0);
    setElapsedMs(0);
    setOnBreak(false);
    setBreakStart(null);
    setBreakCounter(0);
  }

  function handleStartBreak() {
    setOnBreak(true);
    setBreakStart(new Date());
  }

  function handleEndBreak() {
    if (breakStart) {
      const now = new Date();
      setTotalBreakMs((prev) => prev + (now.getTime() - breakStart.getTime()));
    }
    setOnBreak(false);
    setBreakStart(null);
    setBreakCounter(0);
  }

  // --- Integrated Clock Out Confirmation ---
  function handleClockOut(e?: React.MouseEvent) {
    if (!confirmClockOut) {
      setConfirmClockOut(true);
      setTimeout(() => setConfirmClockOut(false), 3000); // auto-reset after 3s
      return;
    }
    // Calculate button center for confetti origin
    let x = 0.5, y = 0.7;
    if (e) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      x = ((rect.left + rect.right) / 2) / window.innerWidth;
      y = ((rect.top + rect.bottom) / 2) / window.innerHeight;
    }
    setConfettiOrigin([x, y]);
    setShowSummary(true);
    setSummaryTransition(true);
    setShowConfettiBurst(true);
    setClockedIn(false);
    setClockOutTime(new Date());
    setOnBreak(false);
    setBreakStart(null);
    setBreakCounter(0);
    setConfirmClockOut(false);
  }

  // --- Formatting helpers ---
  function formatTime(ms: number) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // Format for summary (no seconds)
  function formatTimeHHMM(ms: number) {
    if (ms < 0) ms = 0;
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // --- Screenshot ---
  async function handleScreenshot() {
    if (typeof window === "undefined") return;
    const html2canvas = (await import("html2canvas")).default;
    if (summaryRef.current) {
      html2canvas(summaryRef.current, { background: 'transparent' }).then((canvas: HTMLCanvasElement) => {
        const link = document.createElement("a");
        link.download = `shifter-summary-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  }

  // --- Data export/import for additional backup ---
  function exportSessionData() {
    const sessionData: SessionData = {
      clockedIn,
      onBreak,
      clockInTime: clockInTime?.toISOString() || null,
      clockOutTime: clockOutTime?.toISOString() || null,
      breakStart: breakStart?.toISOString() || null,
      totalBreakMs,
      elapsedMs,
      breakCounter,
      lastSaved: Date.now()
    };
    
    const dataStr = JSON.stringify(sessionData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    link.download = `shifter-session-${Date.now()}.json`;
    link.click();
  }

  function importSessionData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as SessionData;
        
        // Validate the imported data
        if (data && typeof data.clockedIn === 'boolean') {
          setClockedIn(data.clockedIn);
          setOnBreak(data.onBreak);
          setClockInTime(data.clockInTime ? new Date(data.clockInTime) : null);
          setClockOutTime(data.clockOutTime ? new Date(data.clockOutTime) : null);
          setBreakStart(data.breakStart ? new Date(data.breakStart) : null);
          setTotalBreakMs(data.totalBreakMs);
          setElapsedMs(data.elapsedMs);
          setBreakCounter(data.breakCounter);
          
          // Save the imported data
          saveSessionData();
        }
      } catch (error) {
        console.error('Failed to import session data:', error);
        alert('Invalid session data file');
      }
    };
    reader.readAsText(file);
  }

  // --- Dynamic main background color ---
  let mainBg = "#fff";
  if (clockedIn && !onBreak) mainBg = "#c8f7c5";
  if (onBreak) mainBg = "#ff9800";
  if (!clockedIn && clockInTime && clockOutTime) mainBg = "#e3f2fd"; // after clock out

  // Add a function to reset all state to initial home
  function resetToHome() {
    setShowSummary(false);
    setSummaryTransition(false);
    setClockedIn(false);
    setOnBreak(false);
    setClockInTime(null);
    setClockOutTime(null);
    setBreakStart(null);
    setTotalBreakMs(0);
    setElapsedMs(0);
    setBreakCounter(0);
    setConfirmClockOut(false);
    clearSessionData();
  }

  // --- UI ---
  return (
    <div className="min-h-screen flex flex-col" style={{ background: mainBg }}>
      {/* Top Banner - always visible, consistent height */}
      <div className="w-full bg-[#651818] flex items-center justify-between py-0 px-6" style={{ minHeight: 72, height: 72 }}>
        <div className="flex items-center gap-4 h-full" style={{ height: '100%' }}>
          <Image src="/logo.png" alt="Shifter v0 Logo" height={72} width={72} style={{ height: '100%', width: 'auto', objectFit: 'contain' }} priority />
          {/* Backup menu button */}
          <button 
            onClick={() => setShowBackupMenu(!showBackupMenu)}
            className="text-[#ff9860] hover:text-white transition-colors p-2 backup-menu"
            title="Data backup options"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
        {/* Home screen: show title at right */}
        {(!clockedIn && !onBreak && !showSummary) && (
          <div className="text-2xl font-bold text-[#ff9860] ml-auto">Shifter v0</div>
        )}
        {/* Other screens: show time at right */}
        {((clockedIn || onBreak || showSummary) && !( !clockedIn && !onBreak && !showSummary )) && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="text-2xl font-mono text-[#ff9860] font-bold tracking-wider">
              {currentTime.split(":").slice(0, 2).join(":")}
            </div>
            {isSaving && (
              <div className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse"></div>
            )}
          </div>
        )}
      </div>

      {/* Main Area (including summary) */}
      <div className="flex-1 flex flex-col items-center justify-center w-full" style={{ minHeight: 'calc(100vh - 72px)' }}>
        {/* Summary as a normal section below the banner */}
        {summaryTransition && showSummary && clockInTime && clockOutTime ? (
          <div className="flex flex-col items-center justify-center w-full" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            {/* Session Complete title (not in screenshot) */}
            <div className="text-2xl font-extrabold mb-2 text-[#651818] select-none" style={{ userSelect: 'none' }}>Session Complete</div>
            {/* Screenshot area starts here */}
            <div ref={summaryRef} className="flex flex-col gap-4 w-full max-w-xl px-4 text-center items-center justify-center" style={{ margin: '0 auto', paddingTop: 32, paddingBottom: 32, minHeight: 340 }}>
              <div className="mb-6 text-lg text-[#000]">{currentDate}</div>
              <div className="text-2xl" style={{ color: '#000' }}>Clock-in: <span className="font-mono font-bold">{clockInTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="text-2xl" style={{ color: '#000' }}>Clock-out: <span className="font-mono font-bold">{clockOutTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="text-2xl" style={{ color: '#000' }}>Break: <span className="font-mono font-bold">{formatTimeHHMM(totalBreakMs)}</span></div>
              <div className="text-3xl font-bold mt-6" style={{ color: '#000', marginBottom: 16 }}>Total: <span className="font-mono">{formatTimeHHMM(clockOutTime.getTime() - clockInTime.getTime() - totalBreakMs)}</span></div>
            </div>
            {/* Screenshot area ends here */}
          </div>
        ) : (
          <>
            {onBreak ? (
              <>
                <div className="text-7xl font-mono text-[#651818] mb-4" style={{ letterSpacing: "0.05em" }}>{formatTime(breakCounter)}</div>
                <div className="text-lg text-[#651818] font-semibold mb-2">Break in progress</div>
              </>
            ) : clockedIn ? (
              <>
                <div className="text-7xl font-mono text-[#651818] mb-4" style={{ letterSpacing: "0.05em" }}>{formatTime(elapsedMs)}</div>
                {/* No date below the timer when clocked in */}
              </>
            ) : (
              <>
                <div className="text-6xl font-mono text-[#651818] mb-4" style={{ letterSpacing: "0.05em" }}>{currentTime}</div>
                <div className="text-xl text-[#651818] font-semibold mb-2">{currentDate}</div>
              </>
            )}
          </>
        )}
      </div>

      {/* Bottom Banner for summary step: single button */}
      {summaryTransition && showSummary && clockInTime && clockOutTime ? (
        <div className="w-full fixed bottom-0 left-0 flex gap-4 px-4 py-4 items-center justify-center" style={{ zIndex: 20, background: '#fff', borderTop: '1px solid #eee' }}>
          <button className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-4 rounded-lg w-full text-xl transition" style={{ border: 'none' }} onClick={async () => { if (summaryRef.current) { await handleScreenshot(); } resetToHome(); }}>
            Save Screenshot and Close
          </button>
        </div>
      ) : (
        // Regular bottom banner (not visible on summary)
        <>
          {!clockedIn && (
            <div className="w-full fixed bottom-0 left-0 flex gap-4 px-4 py-4 items-center justify-center" style={{ zIndex: 20, background: '#fff', borderTop: '1px solid #eee' }}>
              <button className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-4 rounded-lg w-full text-xl transition" style={{ border: 'none' }} onClick={handleClockIn}>Clock In</button>
            </div>
          )}
          {clockedIn && !onBreak && (
            <div className="w-full fixed bottom-0 left-0 flex gap-4 px-4 py-4 items-center justify-center" style={{ zIndex: 20, background: '#fff', borderTop: '1px solid #eee' }}>
              <button className="bg-[#ff9800] hover:bg-[#fb923c] text-white font-bold py-4 rounded-lg w-full text-lg transition" style={{ border: 'none' }} onClick={handleStartBreak}>Break</button>
              <button className={`font-bold py-4 rounded-lg w-full text-lg transition ${confirmClockOut ? 'bg-[#b91c1c] text-white' : 'bg-[#ef4444] text-white hover:bg-[#b91c1c]'}`} style={{ border: 'none' }} onClick={e => handleClockOut(e)}>
                {confirmClockOut ? 'Confirm?' : 'Clock Out'}
              </button>
            </div>
          )}
          {clockedIn && onBreak && (
            <div className="w-full fixed bottom-0 left-0 flex gap-4 px-4 py-4 items-center justify-center" style={{ zIndex: 20, background: '#fff', borderTop: '1px solid #eee' }}>
              <button className="bg-[#ff9800] hover:bg-[#fb923c] text-white font-bold py-4 rounded-lg w-full text-lg transition" style={{ border: 'none' }} onClick={handleEndBreak}>End Break</button>
              <button className={`font-bold py-4 rounded-lg w-full text-lg transition ${confirmClockOut ? 'bg-[#b91c1c] text-white' : 'bg-[#ef4444] text-white hover:bg-[#b91c1c]'}`} style={{ border: 'none' }} onClick={e => handleClockOut(e)}>
                {confirmClockOut ? 'Confirm?' : 'Clock Out'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Recovery Message */}
      {showRecoveryMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[#22c55e] text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          Session data recovered from backup
        </div>
      )}

      {/* Backup Menu */}
      {showBackupMenu && (
        <div className="fixed top-16 left-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 min-w-48 backup-menu">
          <div className="text-sm font-semibold text-gray-700 mb-2 px-2">Data Backup</div>
          <button 
            onClick={() => { exportSessionData(); setShowBackupMenu(false); }}
            className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
          >
            Export Session Data
          </button>
          <label className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer">
            Import Session Data
            <input 
              type="file" 
              accept=".json" 
              onChange={(e) => { importSessionData(e); setShowBackupMenu(false); }}
              className="hidden"
            />
          </label>
          <button 
            onClick={() => { clearSessionData(); resetToHome(); setShowBackupMenu(false); }}
            className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded text-red-600"
          >
            Clear All Data
          </button>
        </div>
      )}

      {/* Confetti Burst Overlay (canvas) - always on top */}
      {showConfettiBurst && (
        <canvas ref={confettiCanvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, pointerEvents: 'none' }} />
      )}
    </div>
  );
}
