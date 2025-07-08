// --- DOM Elements ---
const clock = document.getElementById("clock");
const clockInBtn = document.getElementById("clockInBtn");
const clockOutBtn = document.getElementById("clockOutBtn");
const breakBtn = document.getElementById("breakBtn");
const elapsed = document.getElementById("elapsed");
const earnings = document.getElementById("earnings");
const breakCounter = document.getElementById("break-counter");
const summary = document.getElementById("summary");
const summaryDate = document.getElementById("summaryDate");
const closeSummary = document.getElementById("close-summary");

// --- NEW: History related DOM elements ---
const viewHistoryBtn = document.getElementById("viewHistoryBtn");
const historyModal = document.getElementById("historyModal");
const historyList = document.getElementById("historyList");
const closeHistoryModalBtn = document.getElementById("closeHistoryModalBtn");
const historyDaysCount = document.getElementById("historyDaysCount"); // For displaying count in modal title

// --- Add after DOM Elements ---
const prevMonthButton = document.getElementById("prevMonthButton");
const prevMonthPopin = document.getElementById("prevMonthPopin");

// --- State Variables ---
let clockInTime = null;
let clockOutTime = null;
let breakStart = null;
let totalBreak = 0; // Stored in milliseconds
let timerInterval = null;
let breakCounterInterval = null;
let rate = 26.4;
let clockOutClickCount = 0;
let onBreak = false;

// --- localStorage Keys ---
const HISTORY_STORAGE_KEY = 'clockr_workHistory_v2'; // New key for the array format
const MAX_HISTORY_DAYS = 35;

const CLOCKED_IN_KEY = 'clockr_clocked_in';
const CLOCK_IN_TIME_KEY = 'clockr_clock_in_time';
const TOTAL_BREAK_KEY = 'clockr_total_break';
const ON_BREAK_KEY = 'clockr_on_break';
const BREAK_START_KEY = 'clockr_break_start';

// --- Money visibility state ---
let moneyVisible = false;

// --- Helper Functions ---
function formatDate(date) { // Expects a Date object
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeWithSeconds(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatTimeHHMM(ms) {
  if (ms < 0) ms = 0; // Ensure no negative time
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// --- UI Update Functions ---
function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function updateElapsed(elapsedMs) {
  if (elapsedMs < 0) elapsedMs = 0;
  elapsed.textContent = `⏳ ${formatTimeWithSeconds(elapsedMs)}`;
}

function updateBreakCounter() {
  if (breakStart) {
    const now = new Date();
    const breakDuration = now.getTime() - breakStart.getTime();
    const totalSeconds = Math.floor(breakDuration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    breakCounter.textContent = `Break: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function displayClockInTime() {
  const clockInDisplay = document.getElementById("clock-in-display");
  const clockInTimeSpan = document.getElementById("clock-in-time");
  if (clockInTime && clockInDisplay && clockInTimeSpan) {
    clockInTimeSpan.textContent = clockInTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    clockInDisplay.style.display = "block";
    clockInDisplay.style.visibility = "visible";
    clockInDisplay.style.opacity = "1";
  }
}

// --- Core Logic: Saving and Loading State ---

function saveClockedInState() {
  if (clockInTime) {
    localStorage.setItem(CLOCKED_IN_KEY, 'true');
    localStorage.setItem(CLOCK_IN_TIME_KEY, clockInTime.toISOString());
    localStorage.setItem(TOTAL_BREAK_KEY, totalBreak.toString());
    localStorage.setItem(ON_BREAK_KEY, onBreak.toString());
    if (breakStart) {
      localStorage.setItem(BREAK_START_KEY, breakStart.toISOString());
    } else {
      localStorage.removeItem(BREAK_START_KEY);
    }
  } else {
    localStorage.setItem(CLOCKED_IN_KEY, 'false');
    localStorage.removeItem(CLOCK_IN_TIME_KEY);
    localStorage.removeItem(TOTAL_BREAK_KEY);
    localStorage.removeItem(ON_BREAK_KEY);
    localStorage.removeItem(BREAK_START_KEY);
  }
}

function loadClockedInState() {
  const isClockedIn = localStorage.getItem(CLOCKED_IN_KEY) === 'true';
  if (isClockedIn) {
    const storedClockInTime = localStorage.getItem(CLOCK_IN_TIME_KEY);
    const storedTotalBreak = localStorage.getItem(TOTAL_BREAK_KEY);
    const storedOnBreak = localStorage.getItem(ON_BREAK_KEY) === 'true';
    const storedBreakStart = localStorage.getItem(BREAK_START_KEY);

    if (storedClockInTime) {
      clockInTime = new Date(storedClockInTime);
      totalBreak = storedTotalBreak ? parseInt(storedTotalBreak, 10) : 0;
      onBreak = storedOnBreak;

      document.body.style.backgroundColor = "#c8f7c5";
      if(clockInBtn) clockInBtn.style.display = "none";
      if(clockOutBtn) clockOutBtn.style.display = "inline-block";
      if(breakBtn) breakBtn.style.display = "inline-block";

      if (onBreak && storedBreakStart) {
        breakStart = new Date(storedBreakStart);
        if(breakBtn) {
            breakBtn.textContent = "End Break";
            breakBtn.style.backgroundColor = "#cc7000";
        }
        document.body.style.backgroundColor = "#ff9800";
        if(breakCounter) breakCounter.style.display = "block";
        breakCounterInterval = setInterval(updateBreakCounter, 1000);
        updateBreakCounter();
        clearInterval(timerInterval);
      } else if (!onBreak) {
        if(breakBtn) {
            breakBtn.textContent = "Start Break";
            breakBtn.style.backgroundColor = "#ff9800";
        }
        if(breakCounter) breakCounter.style.display = "none";
        clearInterval(breakCounterInterval);
        timerInterval = setInterval(() => {
          const currentTime = new Date();
          const currentElapsed = currentTime.getTime() - clockInTime.getTime();
          updateElapsed(currentElapsed - totalBreak);
        }, 1000);
      }

      const now = new Date();
      const elapsedSinceClockIn = now.getTime() - clockInTime.getTime();
      updateElapsed(elapsedSinceClockIn - totalBreak);

      if(elapsed) {
        elapsed.style.visibility = "visible";
        elapsed.style.opacity = "1";
      }
      if(earnings) {
        earnings.style.display = 'none';
      }
      displayClockInTime();
    }
  }
}

// --- History Functionality ---
function saveSession() {
  if (clockInTime && clockOutTime) {
    const sessionDate = formatDate(new Date(clockInTime)); // Base date on clockInTime
    const totalDurationMs = clockOutTime.getTime() - clockInTime.getTime() - totalBreak;
    const earnedAmount = (totalDurationMs / 3600000) * rate;

    const newSessionEntry = {
      date: sessionDate, // YYYY-MM-DD
      inTime: clockInTime.toISOString(),
      outTime: clockOutTime.toISOString(),
      totalBreakMs: totalBreak,
      durationMs: totalDurationMs,
      earned: earnedAmount,
      displayInTime: clockInTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      displayOutTime: clockOutTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      displayBreak: formatTimeHHMM(totalBreak),
      displayDuration: formatTimeHHMM(totalDurationMs)
    };

    let workHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)) || [];
    const existingEntryIndex = workHistory.findIndex(entry => entry.date === newSessionEntry.date);

    if (existingEntryIndex > -1) {
      workHistory[existingEntryIndex] = newSessionEntry;
    } else {
      workHistory.push(newSessionEntry);
    }

    workHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date object for accuracy

    if (workHistory.length > MAX_HISTORY_DAYS) {
      workHistory = workHistory.slice(0, MAX_HISTORY_DAYS);
    }

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(workHistory));
    console.log(`Session for ${sessionDate} saved. History has ${workHistory.length} entries.`);
  }
}

function displayWorkHistory() {
  const workHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)) || [];
  if (!historyList || !historyModal || !historyDaysCount) {
    console.error("History modal elements not found in DOM.");
    return;
  }
  historyList.innerHTML = '';
  historyDaysCount.textContent = workHistory.length > 0 ? String(workHistory.length) : '0';

  if (workHistory.length === 0) {
    historyList.innerHTML = '<li style="text-align: center; padding: 10px; color: #555;">No work history recorded yet.</li>';
  } else {
    workHistory.forEach(record => {
      const listItem = document.createElement('li');
      listItem.style.borderBottom = "1px solid #eee";
      listItem.style.padding = "12px 0";
      listItem.style.lineHeight = "1.6";

      const recordDateObj = new Date(record.date + "T00:00:00"); // Ensure correct date parsing
      const displayDate = recordDateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

      listItem.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 1.1em; color: #333;">${displayDate}</strong>
          <span style="font-size: 0.85em; color: #777;">(${record.date})</span>
        </div>
        <div style="font-size: 0.95em;">
            <span><strong>In:</strong> ${record.displayInTime}</span> | <span><strong>Out:</strong> ${record.displayOutTime}</span>
        </div>
        <div style="font-size: 0.95em;">
            <span><strong>Break:</strong> ${record.displayBreak}</span> | <span style="color: #007bff;"><strong>Worked:</strong> ${record.displayDuration}</span>
        </div>
      `;
      historyList.appendChild(listItem);
    });
  }
  historyModal.style.display = 'flex';
}

// --- Event Handlers ---
if (clockInBtn) {
  clockInBtn.onclick = () => {
    clockInTime = new Date();
    totalBreak = 0; // Reset total break time for the new session
    onBreak = false; // Ensure not on break
    breakStart = null;
    saveClockedInState();

    timerInterval = setInterval(() => {
      const now = new Date();
      const currentElapsed = now.getTime() - clockInTime.getTime();
      updateElapsed(currentElapsed - totalBreak);
    }, 1000);

    clockInBtn.style.display = "none";
    if(clockOutBtn) clockOutBtn.style.display = "inline-block";
    if(breakBtn) {
        breakBtn.style.display = "inline-block";
        breakBtn.textContent = "Start Break";
        breakBtn.style.backgroundColor = "#ff9800";
    }
    if(elapsed) {
        elapsed.style.visibility = "visible";
        elapsed.style.opacity = "1";
    }
    if(earnings) {
        earnings.style.display = 'none';
    }
    if(breakCounter) breakCounter.style.display = "none"; // Hide break counter
    document.body.style.backgroundColor = "#c8f7c5";
    displayClockInTime();
    updatePrevMonthButtonVisibility();
  };
}

if (breakBtn) {
  breakBtn.onclick = () => {
    if (!clockInTime) return; // Should not be able to take a break if not clocked in

    if (!onBreak) {
      breakStart = new Date();
      onBreak = true;
      saveClockedInState();
      breakBtn.textContent = "End Break";
      breakBtn.style.backgroundColor = "#cc7000";
      document.body.style.backgroundColor = "#ff9800";
      clearInterval(timerInterval);
      if(breakCounter) {
        breakCounter.style.display = "block";
        breakCounterInterval = setInterval(updateBreakCounter, 1000);
        updateBreakCounter();
      }
    } else {
      const now = new Date();
      totalBreak += (now.getTime() - breakStart.getTime());
      breakStart = null;
      onBreak = false;
      saveClockedInState();
      breakBtn.textContent = "Start Break";
      breakBtn.style.backgroundColor = "#ff9800";
      document.body.style.backgroundColor = "#c8f7c5";
      clearInterval(breakCounterInterval);
      if(breakCounter) breakCounter.style.display = "none";

      timerInterval = setInterval(() => {
        const currentTime = new Date();
        const currentElapsed = currentTime.getTime() - clockInTime.getTime();
        updateElapsed(currentElapsed - totalBreak);
      }, 1000);
    }
  };
}

if (clockOutBtn) {
  clockOutBtn.onclick = () => {
    if (!clockInTime) return; // Should not be able to clock out if not clocked in

    if (clockOutClickCount === 0) {
      clockOutBtn.textContent = "Tap again to confirm Clock Out";
      clockOutBtn.style.backgroundColor = "#d32f2f";
      clockOutClickCount++;
      setTimeout(() => {
        if (clockOutClickCount === 1) {
          clockOutBtn.textContent = "Clock Out";
          clockOutBtn.style.backgroundColor = "#f44336"; // Original red
          clockOutClickCount = 0;
        }
      }, 5000);
    } else {
      clockOutClickCount = 0;
      clockOutTime = new Date();
      clearInterval(timerInterval); // Always stop countdown
      timerInterval = null;
      clearInterval(breakCounterInterval);
      breakCounterInterval = null;

      if (onBreak && breakStart) {
        const now = new Date();
        totalBreak += (now.getTime() - breakStart.getTime());
        breakStart = null;
        onBreak = false; // Make sure to set onBreak to false
      }

      const totalDurationMs = clockOutTime.getTime() - clockInTime.getTime() - totalBreak;

      if(summaryDate && clockInTime) setSummaryDateWithDay(clockInTime);
      if(document.getElementById("summaryIn")) document.getElementById("summaryIn").textContent = clockInTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if(document.getElementById("summaryOut")) document.getElementById("summaryOut").textContent = clockOutTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if(document.getElementById("summaryBreak")) document.getElementById("summaryBreak").textContent = formatTimeHHMM(totalBreak);
      if(document.getElementById("summaryDuration")) document.getElementById("summaryDuration").textContent = formatTimeHHMM(totalDurationMs);
      // Remove money emoji row if present
      const moneyRow = document.querySelector('.money-highlight');
      if (moneyRow) moneyRow.style.display = 'none';

      if(summary) summary.style.display = "flex";

      saveSession(); // Save to the 35-day history

      // Clear active session state
      localStorage.setItem(CLOCKED_IN_KEY, 'false');
      localStorage.removeItem(CLOCK_IN_TIME_KEY);
      localStorage.removeItem(TOTAL_BREAK_KEY);
      localStorage.removeItem(ON_BREAK_KEY);
      localStorage.removeItem(BREAK_START_KEY);

      // Reset UI
      if(clockOutBtn) clockOutBtn.style.display = "none";
      if(breakBtn) breakBtn.style.display = "none";
      if(clockInBtn) {
        clockInBtn.style.display = "inline-block";
        clockInBtn.style.backgroundColor = "#2196F3"; // Default blue
      }
      if(clockOutBtn) { // Reset clockOutBtn text and color
        clockOutBtn.textContent = "Clock Out";
        clockOutBtn.style.backgroundColor = "#f44336"; // Original red
      }

      if(elapsed) {
        elapsed.style.visibility = "hidden";
        elapsed.style.opacity = "0";
      }
      if(earnings) {
        earnings.style.display = 'none';
      }
      if(breakCounter) breakCounter.style.display = "none";
      const clockInDisplay = document.getElementById("clock-in-display");
      if (clockInDisplay) {
        clockInDisplay.style.visibility = "hidden";
        clockInDisplay.style.opacity = "0";
      }
      document.body.style.backgroundColor = "white";
      showSummaryWithConfetti3D();
      // Nullify active session variables
      clockInTime = null;
      clockOutTime = null;
      totalBreak = 0;
      onBreak = false;
      breakStart = null;
      updatePrevMonthButtonVisibility();
    }
  };
}

if (closeSummary) {
  closeSummary.onclick = () => {
    if(summary) summary.style.display = "none";
    restoreUIAfterSummary();
    updatePrevMonthButtonVisibility();
  };
}

// History Modal Event Listeners
if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', displayWorkHistory);
}
if (closeHistoryModalBtn) {
    closeHistoryModalBtn.addEventListener('click', () => {
        if(historyModal) historyModal.style.display = 'none';
    });
}
if (historyModal) {
    historyModal.addEventListener('click', (event) => {
        if (event.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });
}

// --- iOS Elastic Scrolling Prevention & Confetti ---
document.addEventListener('touchmove', function(e) {
  if (e.target.closest('#summary') === null && e.target.closest('#historyModal div') === null) { // Allow scroll in summary and history modal content
    e.preventDefault();
  }
}, { passive: false });

// --- Subtle Animated Gradient Background for Summary Pop-in ---
function createGradientBackground() {
  let overlay = document.createElement('div');
  overlay.id = 'gradient-bg-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '1199';
  overlay.style.background = 'linear-gradient(120deg, #aee9f7 0%, #f2d74e 100%)';
  overlay.style.overflow = 'hidden';
  overlay.style.pointerEvents = 'none';
  overlay.style.transition = 'background 2s linear';
  document.body.appendChild(overlay);
  // Animate gradient
  let step = 0;
  function animate() {
    step += 0.002;
    const angle = 120 + Math.sin(step) * 30;
    overlay.style.background = `linear-gradient(${angle}deg, #aee9f7 0%, #f2d74e 100%)`;
    overlay._gradientAnimFrame = requestAnimationFrame(animate);
  }
  animate();
}
function removeGradientBackground() {
  const overlay = document.getElementById('gradient-bg-overlay');
  if (overlay) {
    if (overlay._gradientAnimFrame) cancelAnimationFrame(overlay._gradientAnimFrame);
    overlay.remove();
  }
}
function showSummaryWithGradientBg() {
  createGradientBackground();
  summary.style.display = 'flex';
  if (document.getElementById('bottom-bar')) document.getElementById('bottom-bar').style.display = 'none';
  if (prevMonthButton) prevMonthButton.style.display = 'none';
}
function restoreUIAfterSummary() {
  removeGradientBackground();
  summary.style.display = 'none';
  if (document.getElementById('bottom-bar')) document.getElementById('bottom-bar').style.display = '';
  updatePrevMonthButtonVisibility();
}
// Update summary date to always show day of week before date
function setSummaryDateWithDay(dateObj) {
  if (summaryDate) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateStr = dateObj.toLocaleDateString('en-GB', options);
    summaryDate.textContent = dateStr;
  }
}

// --- Add to Home Screen (PWA) ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Optionally, show a button or UI element to trigger the install prompt
  // e.g., installButton.style.display = 'block';
  // installButton.addEventListener('click', (e) => {
  //   deferredPrompt.prompt();
  //   deferredPrompt.userChoice.then((choiceResult) => {
  //     if (choiceResult.outcome === 'accepted') {
  //       console.log('User accepted the A2HS prompt');
  //     }
  //     deferredPrompt = null;
  //   });
  // });
});

// --- Initializations ---
setInterval(updateClock, 1000);
updateClock();
loadClockedInState(); // Load active session state on page load

const screenshotSummaryBtn = document.getElementById("screenshot-summary-btn");

if (screenshotSummaryBtn && summary) {
  screenshotSummaryBtn.onclick = () => {
    // Hide the screenshot and done buttons for the screenshot
    screenshotSummaryBtn.style.display = 'none';
    if (closeSummary) closeSummary.style.display = 'none';
    // Hide money row for screenshot
    const moneyRow = document.querySelector('.money-highlight');
    let prevDisplay = '';
    if (moneyRow) {
      prevDisplay = moneyRow.style.display;
      moneyRow.style.display = 'none';
    }
    html2canvas(summary, { backgroundColor: null }).then(canvas => {
      // Restore buttons and money row
      screenshotSummaryBtn.style.display = '';
      if (closeSummary) closeSummary.style.display = '';
      if (moneyRow) moneyRow.style.display = prevDisplay;
      // Download the image
      const link = document.createElement('a');
      link.download = `clockr-summary-${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL();
      link.click();
      // Show a quick message
      const msg = document.createElement('div');
      msg.textContent = 'Screenshot saved!';
      msg.style.position = 'fixed';
      msg.style.top = '20px';
      msg.style.left = '50%';
      msg.style.transform = 'translateX(-50%)';
      msg.style.background = '#2196F3';
      msg.style.color = 'white';
      msg.style.padding = '10px 20px';
      msg.style.borderRadius = '6px';
      msg.style.zIndex = '2000';
      document.body.appendChild(msg);
      setTimeout(() => { msg.remove(); }, 1500);
    });
  };
}

function updatePrevMonthButtonVisibility() {
  // Hide when clocked in and not on summary
  if (prevMonthButton) {
    if (clockInTime && !summary.style.display.includes('flex') && !summary.style.display.includes('block')) {
      prevMonthButton.style.display = 'none';
    } else {
      prevMonthButton.style.display = '';
    }
  }
}

// Call on load and after clock-in/out
window.addEventListener('DOMContentLoaded', updatePrevMonthButtonVisibility);

function showSummaryWithConfetti3D() {
  createConfetti3DPhysicsBackground();
  summary.style.display = 'flex';
  summary.style.background = '#fff';
  if (document.getElementById('bottom-bar')) document.getElementById('bottom-bar').style.display = 'none';
  if (prevMonthButton) prevMonthButton.style.display = 'none';
}
function restoreUIAfterSummary() {
  removeConfetti3DPhysicsBackground();
  summary.style.display = 'none';
  if (document.getElementById('bottom-bar')) document.getElementById('bottom-bar').style.display = '';
  updatePrevMonthButtonVisibility();
}
function createConfetti3DPhysicsBackground() {
  let overlay = document.createElement('div');
  overlay.id = 'confetti-3d-bg-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '1199';
  overlay.style.background = '#fff';
  overlay.style.overflow = 'hidden';
  overlay.style.pointerEvents = 'none';
  overlay.style.perspective = '900px';
  document.body.appendChild(overlay);
  // Confetti parameters
  const colors = ['#f2d74e','#95c3de','#ff9a91','#f8a5c2','#b0c2f2','#c5e384','#22c55e','#2563eb','#f59e42','#a21caf'];
  const numConfetti = 120;
  const confetti = [];
  const ground = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  function spawnConfettiPiece() {
    let piece = document.createElement('div');
    piece.className = 'confetti-3d';
    let size = 10 + Math.random()*10;
    piece.style.width = size + 'px';
    piece.style.height = size*0.6 + 'px';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.position = 'absolute';
    // Start at random top position
    piece.style.left = (Math.random()*width) + 'px';
    piece.style.top = (-40 - Math.random()*60) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.opacity = 0.92;
    piece.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    piece.style.transform = `rotateX(${Math.random()*360}deg) rotateY(${Math.random()*360}deg) rotateZ(${Math.random()*360}deg)`;
    overlay.appendChild(piece);
    // Physics state
    const angle = (Math.PI/2) + (Math.random()-0.5)*Math.PI*0.8;
    const speed = 0.5 + Math.random()*0.5; // even slower initial speed
    confetti.push({
      el: piece,
      x: parseFloat(piece.style.left),
      y: parseFloat(piece.style.top),
      vx: Math.cos(angle)*speed,
      vy: Math.abs(Math.sin(angle)*speed) + 0.25 + Math.random()*0.25, // much slower downward velocity
      rz: Math.random()*360,
      rx: Math.random()*360,
      ry: Math.random()*360,
      vrz: (Math.random()-0.5)*8,
      vrx: (Math.random()-0.5)*6,
      vry: (Math.random()-0.5)*6,
      size,
      grounded: false
    });
  }
  // Initial burst
  for (let i = 0; i < numConfetti; i++) {
    spawnConfettiPiece();
  }
  // Spawn more confetti at intervals
  let spawnInterval = setInterval(() => {
    for (let i = 0; i < 10; i++) spawnConfettiPiece();
  }, 1200);
  overlay._confettiSpawnInterval = spawnInterval;
  function animate() {
    for (let c of confetti) {
      if (c.grounded) continue;
      c.vy += 0.012 + Math.random()*0.004; // much slower gravity
      c.x += c.vx;
      c.y += c.vy;
      c.rz += c.vrz;
      c.rx += c.vrx;
      c.ry += c.vry;
      c.vx += (Math.random()-0.5)*0.07;
      if (c.y + c.size >= height - 8) {
        c.y = height - 8 - c.size;
        c.vy = 0;
        c.vx *= 0.3;
        c.vrz *= 0.5;
        c.vrx *= 0.5;
        c.vry *= 0.5;
        c.grounded = true;
        ground.push(c);
      }
      c.el.style.left = c.x + 'px';
      c.el.style.top = c.y + 'px';
      c.el.style.transform = `rotateX(${c.rx}deg) rotateY(${c.ry}deg) rotateZ(${c.rz}deg)`;
    }
    for (let g of ground) {
      g.y = height - 8 - g.size;
      g.el.style.top = g.y + 'px';
    }
    overlay._confettiAnimFrame = requestAnimationFrame(animate);
  }
  animate();
}
function removeConfetti3DPhysicsBackground() {
  const overlay = document.getElementById('confetti-3d-bg-overlay');
  if (overlay) {
    if (overlay._confettiAnimFrame) cancelAnimationFrame(overlay._confettiAnimFrame);
    if (overlay._confettiSpawnInterval) clearInterval(overlay._confettiSpawnInterval);
    overlay.remove();
  }
}