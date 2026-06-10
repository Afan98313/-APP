# 极简语音记账 App — 设计文档

**日期**: 2026-06-11  
**平台**: PWA（iPhone 主屏幕安装）  
**定位**: 极简支出记录，语音优先

---

## 1. 功能范围

- ✅ 只记支出，不记收入
- ✅ 语音一句话记多笔（如"盒饭19元，水4元"）
- ✅ 手动记账（备选）
- ✅ 今日流水展示
- ✅ 历史查看 + 月度汇总
- ✅ 固定六大分类：餐饮、交通、购物、娱乐、居住、医疗
- ✅ PWA，可添加到 iPhone 主屏幕
- ✅ 纯本地存储（IndexedDB），支持 JSON 导出备份
- ❌ 无 iCloud 同步（后续可加 CloudKit JS）
- ❌ 无预算功能
- ❌ 无多账户

## 2. 技术栈

| 层 | 选择 |
|---|------|
| 框架 | 无框架，纯 HTML/CSS/JS |
| 离线 | Service Worker + Web App Manifest |
| 语音 | Web Speech API（浏览器原生） |
| 存储 | IndexedDB |
| NLP | 正则 + 关键词匹配 |

## 3. 数据模型

```javascript
// IndexedDB: expenses 表
{
  id: number,          // 自增主键
  amount: number,      // 金额
  category: string,    // 餐饮/交通/购物/娱乐/居住/医疗
  description: string, // 描述，如"盒饭"
  date: string,        // YYYY-MM-DD
  createdAt: number    // 时间戳
}
```

分类固定映射：
```
餐饮 🍜  交通 🚇  购物 🛒  娱乐 🎮  居住 🏠  医疗 💊
```

## 4. 语音解析算法

输入："盒饭19元，水4元"

1. Web Speech API 将语音转为文字
2. 正则提取 `(描述词)(数字)元` 组合
3. 关键词匹配分类（"饭"→餐饮、"地铁"→交通、"衣服"→购物 等）
4. 未匹配的默认归为"其他"
5. 返回待确认列表，用户可修改后确认

## 5. 页面结构

### 首页（记账页）
- 日期 + 今日支出合计
- 今日流水列表（按时间倒序）
- 中间大麦克风按钮（按住说话）
- 底部"手动记账"入口
- 顶部导航：记账 | 历史

### 历史页
- 月份选择器（左右滑动切换）
- 月度总支出
- 分类占比（简易柱状/饼图）
- 每日明细列表

## 6. 交互流程

```
打开 App → 首页
  ├─ 按麦克风 → 说话 → 语音转文字 → NLP解析 → 确认/修改 → 存入
  ├─ 手动记账 → 输金额 + 选分类 → 确认 → 存入
  └─ 顶部 Tab → 历史页
       └─ 左右滑动切换月份
```

## 7. PWA 配置

- `manifest.json`: 定义 App 名称、图标、全屏显示
- Service Worker: 缓存静态资源，支持离线打开
- 添加到主屏幕后以独立窗口运行（无浏览器地址栏）

## 8. 文件结构

```
记账APP/
├── index.html          # 首页（记账页）
├── history.html        # 历史页
├── css/
│   └── app.css         # 全局样式
├── js/
│   ├── app.js          # 主入口
│   ├── db.js           # IndexedDB 操作
│   ├── voice.js        # 语音识别
│   ├── parser.js       # NLP 解析
│   ├── ui.js           # UI 渲染
│   └── utils.js        # 工具函数
├── sw.js               # Service Worker
├── manifest.json       # PWA 配置
└── icons/              # App 图标
```
