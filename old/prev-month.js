function getPreviousMonthRange() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-based, so this month
  if (month === 0) {
    month = 11;
    year -= 1;
  } else {
    month -= 1;
  }
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of prev month
  return { start, end };
}

function formatTimeHHMM(ms) {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

window.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('prevMonthContent');
  const HISTORY_STORAGE_KEY = 'clockr_workHistory_v2';
  const workHistory = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)) || [];
  const { start, end } = getPreviousMonthRange();
  const prevMonthRecords = workHistory.filter(record => {
    const d = new Date(record.date + 'T00:00:00');
    return d >= start && d <= end;
  });
  if (prevMonthRecords.length === 0) {
    content.innerHTML = '<div style="text-align:center; color:#888; font-size:1.1em;">No records for previous month.</div>';
    return;
  }
  let html = '';
  prevMonthRecords.forEach(record => {
    const recordDateObj = new Date(record.date + "T00:00:00");
    const displayDate = recordDateObj.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    html += `<div style="border-bottom:1px solid #e5e7eb; padding:16px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:1.1em; color:#2563eb;">${displayDate}</strong>
        <span style="font-size:0.95em; color:#777;">(${record.date})</span>
      </div>
      <div style="font-size:1em; margin-bottom:2px;"><span><strong>In:</strong> ${record.displayInTime}</span> | <span><strong>Out:</strong> ${record.displayOutTime}</span></div>
      <div style="font-size:1em; margin-bottom:2px;"><span><strong>Break:</strong> ${record.displayBreak}</span> | <span style="color:#2563eb;"><strong>Worked:</strong> ${record.displayDuration}</span></div>
      <div style="margin-top:4px; font-size:1.05em;"><strong>Earned:</strong> <span style="color:#22c55e; font-weight:bold;">€${Number(record.earned).toFixed(2)}</span></div>
    </div>`;
  });
  content.innerHTML = html;
}); 