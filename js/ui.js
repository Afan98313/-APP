const CATEGORY_ICONS = {
  '餐饮': '🍜', '交通': '🚇', '购物': '🛒',
  '娱乐': '🎮', '居住': '🏠', '医疗': '💊', '其他': '📌'
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;
}

function renderToday(expenses) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('today-date').textContent = formatDate(new Date().toISOString().slice(0, 10));
  document.getElementById('today-total').textContent = `¥${total.toFixed(2)}`;

  const list = document.getElementById('today-list');
  if (expenses.length === 0) {
    list.innerHTML = '<div class="empty">今天还没记账 ✨<br><span style="font-size:13px">按住麦克风试试语音记账吧</span></div>';
    return;
  }
  list.innerHTML = expenses.map(e => `
    <div class="expense-item">
      <span class="expense-icon">${CATEGORY_ICONS[e.category] || '📌'}</span>
      <span class="expense-desc">${e.description}</span>
      <span class="expense-cat">${e.category}</span>
      <span class="expense-amount">-¥${e.amount.toFixed(2)}</span>
    </div>
  `).join('');
}

function renderHistory(expenses, year, month) {
  document.getElementById('history-month').textContent = `${year}年${month}月`;
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('history-total').textContent = `本月支出 ¥${total.toFixed(2)}`;
  renderCategoryChart(expenses);
  renderHistoryList(expenses);
}

function renderCategoryChart(expenses) {
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  const total = expenses.reduce((s, e) => s + e.amount, 0) || 1;
  const chart = document.getElementById('category-chart');

  if (Object.keys(byCategory).length === 0) {
    chart.innerHTML = '<div class="empty" style="padding:20px">暂无数据</div>';
    return;
  }

  chart.innerHTML = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = ((amt / total) * 100).toFixed(1);
      return `<div class="chart-row">
        <span class="chart-label">${CATEGORY_ICONS[cat] || '📌'} ${cat}</span>
        <span class="chart-bar-wrap"><span class="chart-bar" style="width:${pct}%"></span></span>
        <span class="chart-amt">¥${amt.toFixed(0)}</span>
      </div>`;
    }).join('');
}

function renderHistoryList(expenses) {
  const grouped = {};
  expenses.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  const dates = Object.keys(grouped).sort().reverse();
  const list = document.getElementById('history-list');

  if (dates.length === 0) {
    list.innerHTML = '<div class="empty">本月暂无记录</div>';
    return;
  }

  list.innerHTML = dates.map(date => `
    <div class="history-day">
      <div class="history-day-header">
        <span>${formatDate(date)}</span>
        <span>¥${grouped[date].reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
      </div>
      ${grouped[date].map(e => `
        <div class="expense-item">
          <span class="expense-icon">${CATEGORY_ICONS[e.category] || '📌'}</span>
          <span class="expense-desc">${e.description}</span>
          <span class="expense-cat">${e.category}</span>
          <span class="expense-amount">-¥${e.amount.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function showVoiceResult(items, onConfirm, onCancel) {
  const modal = document.getElementById('voice-modal');
  const resultDiv = document.getElementById('voice-result');
  resultDiv.innerHTML = items.map((item, i) => `
    <div class="voice-item">
      <span>📝 ${item.description}</span>
      <input type="number" value="${item.amount}" data-index="${i}" class="voice-amount" step="0.01">
      <select data-index="${i}" class="voice-category">
        ${Object.entries(CATEGORY_ICONS).map(([cat, icon]) =>
          `<option value="${cat}" ${cat === item.category ? 'selected' : ''}>${icon} ${cat}</option>`
        ).join('')}
      </select>
    </div>
  `).join('');
  modal.classList.remove('hidden');

  const confirmBtn = document.getElementById('voice-confirm');
  const cancelBtn = document.getElementById('voice-cancel');
  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newConfirm.addEventListener('click', () => {
    const updated = items.map((item, i) => ({
      ...item,
      amount: parseFloat(resultDiv.querySelector(`.voice-amount[data-index="${i}"]`).value) || 0,
      category: resultDiv.querySelector(`.voice-category[data-index="${i}"]`).value
    }));
    modal.classList.add('hidden');
    onConfirm(updated.filter(item => item.amount > 0));
  });
  newCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    onCancel();
  });
}

function showManualModal(onConfirm, onCancel) {
  const modal = document.getElementById('manual-modal');
  modal.classList.remove('hidden');
  document.getElementById('manual-amount').value = '';
  document.getElementById('manual-desc').value = '';
  document.getElementById('manual-amount').focus();

  const confirmBtn = document.getElementById('manual-confirm');
  const cancelBtn = document.getElementById('manual-cancel');
  const newConfirm = confirmBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  newConfirm.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('manual-amount').value);
    if (!amount || amount <= 0) {
      document.getElementById('manual-amount').style.border = '2px solid #FF4D4F';
      return;
    }
    const category = document.getElementById('manual-category').value;
    const description = document.getElementById('manual-desc').value || category;
    modal.classList.add('hidden');
    onConfirm({ amount, category, description });
  });
  newCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
    onCancel();
  });
}
