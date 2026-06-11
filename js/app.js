let currentTab = 'record';
let historyYear, historyMonth;

async function init() {
  await openDB();

  // Tab switching
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Voice input
  const micBtn = document.getElementById('mic-btn');
  const micHint = document.getElementById('mic-hint');
  let voiceReady = false;
  let voiceIniting = false;

  async function ensureVoiceReady() {
    if (voiceReady) return true;
    if (voiceIniting) return false;
    voiceIniting = true;
    micHint.textContent = '正在请求麦克风权限...';
    try {
      voiceReady = await VoiceRecognition.init();
      if (!voiceReady) {
        micHint.textContent = '请在 Safari 设置中允许麦克风权限';
        micBtn.style.opacity = '0.4';
      } else {
        micHint.textContent = '按住说话，松手识别';
      }
    } catch (e) {
      micHint.textContent = '麦克风不可用：' + e.message;
    }
    voiceIniting = false;
    return voiceReady;
  }

  // Use touchstart/touchend for better iOS Safari support
  micBtn.addEventListener('touchstart', async (e) => {
    e.preventDefault();
    if (VoiceRecognition.isRecording) return;
    if (!(await ensureVoiceReady())) return;
    micBtn.classList.add('listening');
    micHint.textContent = '正在听...';
    try {
      await VoiceRecognition.start();
    } catch (err) {
      micHint.textContent = '录音启动失败：' + err.message;
      micBtn.classList.remove('listening');
    }
  });

  micBtn.addEventListener('touchend', async (e) => {
    e.preventDefault();
    await handleMicRelease();
  });

  // Also support mouse for desktop testing
  micBtn.addEventListener('mousedown', async (e) => {
    if (VoiceRecognition.isRecording) return;
    if (!(await ensureVoiceReady())) return;
    micBtn.classList.add('listening');
    micHint.textContent = '正在听...';
    try {
      await VoiceRecognition.start();
    } catch (err) {
      micHint.textContent = '录音启动失败：' + err.message;
      micBtn.classList.remove('listening');
    }
  });

  micBtn.addEventListener('mouseup', async (e) => {
    await handleMicRelease();
  });

  async function handleMicRelease() {
    if (!VoiceRecognition.isRecording) return;
    micHint.textContent = '识别中...';
    try {
      const audioBlob = await VoiceRecognition.stop();
      micHint.textContent = '正在识别语音...';
      const text = await VoiceRecognition.transcribe(audioBlob);
      micHint.textContent = text ? `"${text}"` : '未识别到语音';
      const items = parseExpenseText(text);
      if (items.length === 0) {
        micHint.textContent = '未识别到金额，请重试';
        setTimeout(() => { micHint.textContent = '按住说话，松手识别'; }, 2000);
        micBtn.classList.remove('listening');
        return;
      }
      showVoiceResult(items, async (confirmed) => {
        const today = new Date().toISOString().slice(0, 10);
        for (const item of confirmed) {
          await addExpense({
            amount: item.amount,
            category: item.category,
            description: item.description,
            date: today,
            createdAt: Date.now()
          });
        }
        await refreshToday();
        micHint.textContent = `已记录 ${confirmed.length} 笔 ✓`;
        setTimeout(() => { micHint.textContent = '按住说话，松手识别'; }, 2000);
      }, () => {
        micHint.textContent = '按住说话，松手识别';
      });
    } catch (err) {
      micHint.textContent = '识别失败：' + err.message;
      setTimeout(() => { micHint.textContent = '按住说话，松手识别'; }, 2500);
    }
    micBtn.classList.remove('listening');
  }

  // Manual input
  document.getElementById('manual-btn').addEventListener('click', () => {
    showManualModal(async (item) => {
      await addExpense({
        amount: item.amount,
        category: item.category,
        description: item.description,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now()
      });
      await refreshToday();
    }, () => {});
  });

  // History month navigation
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

  // Swipe for history
  let touchStartX = 0;
  const historyTab = document.getElementById('tab-history');
  historyTab.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  historyTab.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 80) {
      changeMonth(diff > 0 ? -1 : 1);
    }
  });

  // Init history month to current
  const now = new Date();
  historyYear = now.getFullYear();
  historyMonth = now.getMonth() + 1;

  await refreshToday();
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
  if (tab === 'history') refreshHistory();
}

async function refreshToday() {
  const today = new Date().toISOString().slice(0, 10);
  const expenses = await getExpensesByDate(today);
  renderToday(expenses);
}

async function refreshHistory() {
  const expenses = await getExpensesByMonth(historyYear, historyMonth);
  renderHistory(expenses, historyYear, historyMonth);
}

function changeMonth(delta) {
  // Calculate target month/year
  const raw = historyMonth + delta;
  let newYear = historyYear;
  let newMonth = raw;
  if (raw < 1) { newMonth = 12; newYear--; }
  else if (raw > 12) { newMonth = 1; newYear++; }

  // Prevent navigating to future months
  const now = new Date();
  if (newYear > now.getFullYear() ||
      (newYear === now.getFullYear() && newMonth > now.getMonth() + 1)) {
    return;
  }

  historyMonth = newMonth;
  historyYear = newYear;
  refreshHistory();
}

init();
