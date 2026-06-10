# 极简语音记账 App — 实现计划

> **For agentic workers:** 使用 superpowers:executing-plans 按任务逐步实现。每个任务完成后打勾。

**Goal:** 构建一个极简语音记账 PWA，用户可通过语音一句话记录多笔支出，在 iPhone 上使用。

**Architecture:** 单页 PWA（index.html 内两个 Tab：记账/历史），IndexedDB 本地存储，Web Speech API 语音识别，正则 NLP 解析中文消费语句。

**Tech Stack:** 纯 HTML/CSS/JS，无框架，Service Worker 离线支持

---

## 文件结构

```
记账APP/
├── index.html          # 单页应用（记账 Tab + 历史 Tab）
├── css/app.css         # 全局样式
├── js/
│   ├── db.js           # IndexedDB CRUD + 查询
│   ├── parser.js       # 语音文本 NLP 解析
│   ├── voice.js        # Web Speech API 封装
│   ├── ui.js           # DOM 渲染 + 事件绑定
│   └── app.js          # 初始化 + Tab 切换 + 协调各模块
├── sw.js               # Service Worker
├── manifest.json       # PWA Manifest
└── icons/              # SVG 图标（内联在 manifest）
```

---

### Task 1: 项目骨架 — HTML + CSS + 基础结构

**Files:** Create `index.html`, `css/app.css`

- [ ] **Step 1: 创建 index.html — 双 Tab 骨架**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>记账</title>
  <link rel="stylesheet" href="css/app.css">
  <link rel="manifest" href="manifest.json">
</head>
<body>
  <div id="app">
    <!-- Tab 导航 -->
    <nav id="tab-bar">
      <button class="tab active" data-tab="record">📒 记账</button>
      <button class="tab" data-tab="history">📊 历史</button>
    </nav>

    <!-- 记账 Tab -->
    <main id="tab-record" class="tab-content active">
      <div id="today-header">
        <span id="today-date"></span>
        <span id="today-total">¥0.00</span>
      </div>
      <div id="today-list"></div>
      <div id="mic-area">
        <button id="mic-btn">🎤</button>
        <p id="mic-hint">按住说话，松手识别</p>
      </div>
      <button id="manual-btn">📝 手动记一笔</button>
    </main>

    <!-- 历史 Tab -->
    <main id="tab-history" class="tab-content">
      <div id="history-header">
        <button id="prev-month">◀</button>
        <span id="history-month">2026年6月</span>
        <button id="next-month">▶</button>
      </div>
      <div id="history-total">本月支出 ¥0.00</div>
      <div id="category-chart"></div>
      <div id="history-list"></div>
    </main>

    <!-- 语音确认弹窗 -->
    <div id="voice-modal" class="modal hidden">
      <div class="modal-content">
        <h3>识别结果</h3>
        <div id="voice-result"></div>
        <div class="modal-actions">
          <button id="voice-cancel">取消</button>
          <button id="voice-confirm">✓ 确认记账</button>
        </div>
      </div>
    </div>

    <!-- 手动记账弹窗 -->
    <div id="manual-modal" class="modal hidden">
      <div class="modal-content">
        <h3>手动记账</h3>
        <input type="number" id="manual-amount" placeholder="金额" inputmode="decimal">
        <select id="manual-category">
          <option value="餐饮">🍜 餐饮</option>
          <option value="交通">🚇 交通</option>
          <option value="购物">🛒 购物</option>
          <option value="娱乐">🎮 娱乐</option>
          <option value="居住">🏠 居住</option>
          <option value="医疗">💊 医疗</option>
        </select>
        <input type="text" id="manual-desc" placeholder="备注（选填）">
        <div class="modal-actions">
          <button id="manual-cancel">取消</button>
          <button id="manual-confirm">✓ 确认</button>
        </div>
      </div>
    </div>
  </div>

  <script src="js/db.js"></script>
  <script src="js/parser.js"></script>
  <script src="js/voice.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 app.css — iPhone 风格样式**

完整样式代码见实现步骤。

- [ ] **Step 3: 验证** — 在浏览器打开 index.html，确认两个 Tab 可切换、弹窗可打开

---

### Task 2: 数据层 — IndexedDB 封装

**Files:** Create `js/db.js`

- [ ] **Step 1: 实现 db.js**

```javascript
const DB_NAME = 'ExpenseTracker';
const DB_VERSION = 1;
const STORE_NAME = 'expenses';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    request.onerror = (e) => reject(e.target.error);
  });
}

function addExpense(expense) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(expense);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getExpensesByDate(date) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('date');
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

function getExpensesByMonth(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('date');
    const range = IDBKeyRange.bound(start, end);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllExpenses() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 2: 验证** — 在浏览器控制台调用 openDB()，确认数据库创建成功

---

### Task 3: NLP 解析引擎

**Files:** Create `js/parser.js`

- [ ] **Step 1: 实现 parser.js**

```javascript
const CATEGORY_KEYWORDS = {
  '餐饮': ['饭', '餐', '面', '粉', '菜', '肉', '鱼', '虾', '鸡', '鸭', '牛', '羊', '猪', '蛋', '奶', '茶', '咖啡', '奶茶', '饮料', '水', '酒', '啤', '果', '水果', '零食', '面包', '饼', '糕', '包', '饺', '馒', '粥', '汤', '火锅', '烧烤', '串', '炸', '鸡腿', '汉堡', '薯条', '可乐', '雪碧', '早餐', '午餐', '晚饭', '宵夜', '外卖', '盒饭', '盖浇', '麻辣烫', '米线', '螺蛳粉'],
  '交通': ['地铁', '公交', '车', '打车', '滴滴', '出租', '高铁', '火车', '机票', '飞机', '油', '充电', '停车', '高速', '过路费', '骑行', '共享单车', '单车', '地铁卡'],
  '购物': ['衣', '裤', '鞋', '袜', '帽', '包', '妆', '护肤', '洗', '纸', '巾', '牙刷', '牙膏', '超市', '淘宝', '京东', '拼多多', '买', '购', '日用品', '电器', '手机', '电脑', '数据线', '充电器', '家居'],
  '娱乐': ['电影', '游戏', '唱', 'KTV', '歌', '玩', '门票', '景区', '旅游', '酒店', '健身', '运动', '球', '游泳', '会员', '订阅', '视频', '音乐', '书', '杂志', '剧', '演出', '展览', '密室', '剧本杀', '桌游'],
  '居住': ['租', '房', '电费', '水费', '煤气', '天然气', '物业', '网费', '宽带', '维修', '装修', '家具', '家电', '暖气', '空调'],
  '医疗': ['药', '医院', '挂号', '检查', '体检', '牙', '眼', '诊所', '中药', '西药', '口罩', '纱布', '看病', '手术', '疫苗'],
};

function guessCategory(desc) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (desc.includes(kw)) return category;
    }
  }
  return '其他';
}

function parseExpenseText(text) {
  // Match pattern: description + number + 元/块
  const regex = /([^\d,，。.。\s]+?)(\d+\.?\d*)\s*[元块]/g;
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const desc = match[1].trim();
    const amount = parseFloat(match[2]);
    const category = guessCategory(desc);
    results.push({ description: desc, amount, category });
  }
  return results;
}
```

- [ ] **Step 2: 验证** — 控制台测试 `parseExpenseText("盒饭19元，矿泉水4元")`，确认返回正确解析结果

---

### Task 4: 语音识别模块

**Files:** Create `js/voice.js`

- [ ] **Step 1: 实现 voice.js**

```javascript
const VoiceRecognition = {
  recognition: null,
  isListening: false,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      return false;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    return true;
  },

  start() {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not available'));
        return;
      }
      this.isListening = true;
      this.recognition.start();
      this.recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        this.isListening = false;
        resolve(text);
      };
      this.recognition.onerror = (event) => {
        this.isListening = false;
        reject(event.error);
      };
      this.recognition.onend = () => {
        this.isListening = false;
      };
    });
  },

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
};
```

- [ ] **Step 2: 验证** — 在浏览器中调用 VoiceRecognition.start()，测试语音识别

---

### Task 5: UI 渲染 + 事件绑定

**Files:** Create `js/ui.js`

- [ ] **Step 1: 实现 ui.js — 渲染函数**

```javascript
const CATEGORY_ICONS = {
  '餐饮': '🍜', '交通': '🚇', '购物': '🛒',
  '娱乐': '🎮', '居住': '🏠', '医疗': '💊', '其他': '📌'
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`;
}

function renderToday(expenses) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('today-date').textContent = formatDate(new Date().toISOString().slice(0, 10));
  document.getElementById('today-total').textContent = `¥${total.toFixed(2)}`;

  const list = document.getElementById('today-list');
  if (expenses.length === 0) {
    list.innerHTML = '<div class="empty">今天还没记账，试试语音吧 ✨</div>';
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
  chart.innerHTML = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = ((amt / total) * 100).toFixed(1);
      return `<div class="chart-row">
        <span class="chart-label">${CATEGORY_ICONS[cat]} ${cat}</span>
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
  list.innerHTML = dates.map(date => `
    <div class="history-day">
      <div class="history-day-header">
        <span>${formatDate(date)}</span>
        <span>¥${grouped[date].reduce((s, e) => s + e.amount, 0).toFixed(2)}</span>
      </div>
      ${grouped[date].map(e => `
        <div class="expense-item">
          <span class="expense-icon">${CATEGORY_ICONS[e.category]}</span>
          <span class="expense-desc">${e.description}</span>
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
      <span>${item.description}</span>
      <input type="number" value="${item.amount}" data-index="${i}" class="voice-amount" step="0.01">
      <select data-index="${i}" class="voice-category">
        ${Object.entries(CATEGORY_ICONS).map(([cat, icon]) =>
          `<option value="${cat}" ${cat === item.category ? 'selected' : ''}>${icon} ${cat}</option>`
        ).join('')}
      </select>
    </div>
  `).join('');
  modal.classList.remove('hidden');

  document.getElementById('voice-confirm').onclick = () => {
    const updated = items.map((item, i) => ({
      ...item,
      amount: parseFloat(resultDiv.querySelector(`.voice-amount[data-index="${i}"]`).value),
      category: resultDiv.querySelector(`.voice-category[data-index="${i}"]`).value
    }));
    modal.classList.add('hidden');
    onConfirm(updated);
  };
  document.getElementById('voice-cancel').onclick = () => {
    modal.classList.add('hidden');
    onCancel();
  };
}

function showManualModal(onConfirm, onCancel) {
  const modal = document.getElementById('manual-modal');
  modal.classList.remove('hidden');
  document.getElementById('manual-amount').value = '';
  document.getElementById('manual-desc').value = '';

  document.getElementById('manual-confirm').onclick = () => {
    const amount = parseFloat(document.getElementById('manual-amount').value);
    if (!amount || amount <= 0) return;
    const category = document.getElementById('manual-category').value;
    const description = document.getElementById('manual-desc').value || category;
    modal.classList.add('hidden');
    onConfirm({ amount, category, description });
  };
  document.getElementById('manual-cancel').onclick = () => {
    modal.classList.add('hidden');
    onCancel();
  };
}
```

- [ ] **Step 2: 验证** — 调用 renderToday([]) 确认空状态渲染正常

---

### Task 6: 主逻辑 — 串联所有模块

**Files:** Create `js/app.js`

- [ ] **Step 1: 实现 app.js**

```javascript
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
  VoiceRecognition.init();

  micBtn.addEventListener('pointerdown', async () => {
    micBtn.classList.add('listening');
    document.getElementById('mic-hint').textContent = '正在听...';
    try {
      const text = await VoiceRecognition.start();
      const items = parseExpenseText(text);
      if (items.length === 0) {
        document.getElementById('mic-hint').textContent = '未识别到金额，请重试';
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
      }, () => {});
    } catch (err) {
      document.getElementById('mic-hint').textContent = `识别失败: ${err}`;
    }
    micBtn.classList.remove('listening');
    setTimeout(() => {
      document.getElementById('mic-hint').textContent = '按住说话，松手识别';
    }, 2000);
  });

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
  historyMonth += delta;
  if (historyMonth < 1) { historyMonth = 12; historyYear--; }
  if (historyMonth > 12) { historyMonth = 1; historyYear++; }
  refreshHistory();
}

init();
```

- [ ] **Step 2: 验证** — 浏览器打开 index.html，完整流程测试

---

### Task 7: PWA 支持

**Files:** Create `sw.js`, `manifest.json`

- [ ] **Step 1: 创建 manifest.json**

```json
{
  "name": "极简记账",
  "short_name": "记账",
  "start_url": "/记账APP/index.html",
  "display": "standalone",
  "background_color": "#f5f5f7",
  "theme_color": "#4CAF50",
  "icons": [
    { "src": "icons/icon-192.svg", "sizes": "192x192", "type": "image/svg+xml" },
    { "src": "icons/icon-512.svg", "sizes": "512x512", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 2: 创建 sw.js**

```javascript
const CACHE_NAME = 'expense-tracker-v1';
const ASSETS = [
  '/记账APP/',
  '/记账APP/index.html',
  '/记账APP/css/app.css',
  '/记账APP/js/db.js',
  '/记账APP/js/parser.js',
  '/记账APP/js/voice.js',
  '/记账APP/js/ui.js',
  '/记账APP/js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
```

- [ ] **Step 3: 创建图标 SVG**

```svg
<!-- icons/icon-192.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#4CAF50"/>
  <text x="96" y="130" text-anchor="middle" font-size="120">💰</text>
</svg>
```

- [ ] **Step 4: 在 index.html 注册 Service Worker**

在 `</body>` 前添加：
```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
</script>
```

---

### Task 8: 完整 CSS 样式

**Files:** Modify `css/app.css`

- [ ] **Step 1: 实现完整的 iPhone 风格样式**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #f5f5f7;
  --card: #ffffff;
  --text: #1d1d1f;
  --sub: #86868b;
  --green: #4CAF50;
  --red: #FF4D4F;
  --blue: #007AFF;
  --radius: 16px;
  --safe-bottom: env(safe-area-inset-bottom, 16px);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  overflow-x: hidden;
}

#app { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; }

/* Tab Bar */
#tab-bar {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  background: var(--bg);
  position: sticky; top: 0; z-index: 10;
}
.tab {
  flex: 1; padding: 10px;
  border: none; border-radius: 10px;
  background: var(--card);
  font-size: 15px; font-weight: 500;
  color: var(--sub); cursor: pointer;
  transition: all 0.2s;
}
.tab.active { background: #1d1d1f; color: #fff; }

/* Tab Content */
.tab-content { display: none; flex: 1; padding: 0 16px 24px; flex-direction: column; }
.tab-content.active { display: flex; }

/* Today Header */
#today-header {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 16px;
}
#today-date { font-size: 17px; font-weight: 600; }
#today-total { font-size: 28px; font-weight: 700; color: var(--red); }

/* Expense List */
#today-list { flex: 1; overflow-y: auto; margin-bottom: 16px; }
.expense-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px; margin-bottom: 6px;
  background: var(--card); border-radius: 12px;
}
.expense-icon { font-size: 20px; }
.expense-desc { flex: 1; font-size: 15px; }
.expense-cat { font-size: 12px; color: var(--sub); margin-right: 4px; }
.expense-amount { font-size: 16px; font-weight: 600; }

.empty { text-align: center; color: var(--sub); padding: 40px 0; font-size: 15px; }

/* Mic Area */
#mic-area { text-align: center; margin: 16px 0; }
#mic-btn {
  width: 80px; height: 80px; border-radius: 50%;
  border: none; background: var(--red);
  font-size: 36px; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 8px;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 20px rgba(255, 77, 79, 0.3);
  -webkit-user-select: none;
}
#mic-btn:active, #mic-btn.listening {
  transform: scale(1.15);
  box-shadow: 0 8px 30px rgba(255, 77, 79, 0.5);
}
#mic-hint { font-size: 13px; color: var(--sub); }

/* Manual Button */
#manual-btn {
  width: 100%; padding: 14px;
  border: 1px solid #ddd; border-radius: var(--radius);
  background: var(--card); font-size: 16px;
  color: var(--blue); cursor: pointer;
  margin-bottom: var(--safe-bottom);
}

/* History */
#history-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
#history-header button {
  width: 40px; height: 40px; border: none; border-radius: 50%;
  background: var(--card); font-size: 16px; cursor: pointer;
}
#history-month { font-size: 18px; font-weight: 600; }
#history-total { text-align: center; font-size: 24px; font-weight: 700; color: var(--red); margin-bottom: 16px; }

/* Category Chart */
#category-chart { margin-bottom: 16px; }
.chart-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  font-size: 13px;
}
.chart-label { width: 70px; text-align: right; }
.chart-bar-wrap { flex: 1; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
.chart-bar { height: 100%; background: var(--green); border-radius: 4px; transition: width 0.3s; }
.chart-amt { width: 50px; text-align: right; color: var(--sub); }

/* History List */
#history-list { overflow-y: auto; }
.history-day { margin-bottom: 16px; }
.history-day-header {
  display: flex; justify-content: space-between;
  font-size: 14px; font-weight: 600; margin-bottom: 6px; padding: 0 4px;
}
.history-day .expense-item .expense-cat { display: none; }

/* Modal */
.modal {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: flex-end; justify-content: center;
  padding: 16px;
}
.modal.hidden { display: none; }
.modal-content {
  width: 100%; max-width: 480px; background: #fff;
  border-radius: 20px; padding: 20px;
  animation: slideUp 0.25s ease;
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.modal-content h3 { font-size: 18px; margin-bottom: 16px; text-align: center; }

.voice-item {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.voice-amount, .voice-category {
  padding: 8px 10px; border: 1px solid #ddd; border-radius: 8px;
  font-size: 14px; background: #f9f9f9;
}
.voice-amount { width: 80px; }

#manual-amount, #manual-category, #manual-desc {
  width: 100%; padding: 12px; margin-bottom: 10px;
  border: 1px solid #ddd; border-radius: 12px;
  font-size: 16px; background: #f9f9f9;
}

.modal-actions { display: flex; gap: 10px; margin-top: 16px; }
.modal-actions button {
  flex: 1; padding: 12px; border: none; border-radius: 12px;
  font-size: 16px; font-weight: 600; cursor: pointer;
}
.modal-actions button:first-child { background: #f0f0f0; color: #666; }
.modal-actions button:last-child { background: var(--green); color: #fff; }
```

- [ ] **Step 2: 完整验证** — 浏览器 + iPhone 测试所有功能

---
