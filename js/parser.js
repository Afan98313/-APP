const CATEGORY_KEYWORDS = {
  '餐饮': ['饭', '餐', '面', '粉', '菜', '肉', '鱼', '虾', '鸡', '鸭', '牛', '羊', '猪', '蛋', '奶', '茶', '咖啡', '奶茶', '饮料', '水', '酒', '啤', '果', '水果', '零食', '面包', '饼', '糕', '包', '饺', '馒', '粥', '汤', '火锅', '烧烤', '串', '炸', '鸡腿', '汉堡', '薯条', '可乐', '雪碧', '早餐', '午餐', '晚饭', '宵夜', '外卖', '盒饭', '盖浇', '麻辣烫', '米线', '螺蛳粉', '冰激凌', '冰淇淋', '甜品', '蛋糕', '糖', '巧克力', '披萨', '寿司', '刺身', '日料', '韩料', '西餐', '自助', '西瓜', '苹果', '香蕉', '橘子', '葡萄', '橙子', '梨'],
  '交通': ['地铁', '公交', '车', '打车', '滴滴', '出租', '高铁', '火车', '机票', '飞机', '油', '充电', '停车', '高速', '过路费', '骑行', '共享单车', '单车', '地铁卡', '交通卡', '加油', '顺风车', '快车', '专车', '大巴', '客车', '轮渡', '船'],
  '购物': ['衣', '裤', '鞋', '袜', '帽', '包', '妆', '护肤', '洗', '纸', '巾', '牙刷', '牙膏', '超市', '淘宝', '京东', '拼多多', '买', '购', '日用品', '电器', '手机', '电脑', '数据线', '充电器', '家居', '化妆品', '香水', '口红', '眼影', '面膜', '洗发', '沐浴', '洗衣', '垃圾袋', '收纳', '架', '灯', '被子', '枕头', '床单', '毛巾', '拖把', '扫把', '碗', '筷', '锅'],
  '娱乐': ['电影', '游戏', '唱', 'KTV', '歌', '玩', '门票', '景区', '旅游', '酒店', '健身', '运动', '球', '游泳', '会员', '订阅', '视频', '音乐', '书', '杂志', '剧', '演出', '展览', '密室', '剧本杀', '桌游', '麻将', '扑克', '蹦迪', '酒吧', '网吧', '网咖', '游乐园', '迪士尼', '动物园', '公园', '爬山', '滑雪', '冲浪', '潜水', '瑜伽', '舞蹈', 'spa', '按摩', '足浴', '桑拿'],
  '居住': ['租', '房', '电费', '水费', '煤气', '天然气', '物业', '网费', '宽带', '维修', '装修', '家具', '家电', '暖气', '空调', '冰箱', '洗衣机', '热水器', '马桶', '水管', '电路', '墙', '地板', '窗帘', '房租', '房贷', '月供'],
  '医疗': ['药', '医院', '挂号', '检查', '体检', '牙', '眼', '诊所', '中药', '西药', '口罩', '纱布', '看病', '手术', '疫苗', '感冒', '发烧', '咳嗽', '头疼', '肚子', '过敏', '消炎', '输液', '针', 'B超', 'CT', 'X光', '化验', '血糖', '血压', '维生素', '钙片', '创可贴', '碘伏', '酒精']
};

function guessCategory(desc) {
  const text = desc.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category;
    }
  }
  return '其他';
}

function cleanDescription(raw) {
  // Strip leading/trailing punctuation, spaces, and filler words
  let desc = raw
    .replace(/^[，,。.！!？?\s]+/, '')
    .replace(/[，,。.！!？?\s]+$/, '')
    .trim();

  // Remove common prefix filler words
  const prefixes = ['今天', '昨天', '刚才', '然后', '还有', '另外', '花了', '买了', '用了', '付了', '交了', '充了'];
  for (const p of prefixes) {
    if (desc.startsWith(p)) {
      const rest = desc.slice(p.length);
      if (rest.length > 0) { desc = rest; break; }
    }
  }

  return desc || raw.trim();
}

// Chinese numeral to Arabic number
const CHINESE_NUMS = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
const CHINESE_UNITS = { '十': 10, '百': 100, '千': 1000, '万': 10000 };

function chineseToNumber(chinese) {
  let num = 0;
  let current = 0;
  for (const ch of chinese) {
    if (ch in CHINESE_NUMS) {
      current = CHINESE_NUMS[ch];
    } else if (ch in CHINESE_UNITS) {
      const unit = CHINESE_UNITS[ch];
      current = current === 0 ? unit : current * unit;
      if (unit >= 10) {
        num += current;
        current = 0;
      }
    }
  }
  num += current;
  return num || parseFloat(chinese);
}

function parseChinesePrice(text) {
  // Pattern: "八点八元" "八块八" "八元五" "八块五毛" "十二块五"
  const patterns = [
    // 八点八元/块, 八点八
    /([零一二两三四五六七八九十]+)[点\.]([零一二两三四五六七八九]+)\s*[元块]?/g,
    // 八块八, 八元八, 八块八毛
    /([零一二两三四五六七八九十]+)\s*[元块]\s*([零一二两三四五六七八九]+)\s*[毛角]?/g,
    // 八元五角, 八块五毛
    /([零一二两三四五六七八九十]+)\s*[元块]\s*([零一二两三四五六七八九]+)\s*[角毛]/g,
    // 十五元, 二十块
    /([零一二两三四五六七八九十百千万]+)\s*[元块](?![零一二两三四五六七八九十角毛])\s*/g,
  ];

  const results = [];
  let remaining = text;

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(remaining)) !== null) {
      let amount;
      if (match[2] !== undefined && match[1].includes('点') === false) {
        // Pattern: integer + unit + fractional part
        const integer = chineseToNumber(match[1]);
        const fractional = chineseToNumber(match[2]);
        if (match[2].length === 1) {
          amount = integer + fractional * 0.1; // "八块五" → 8.5
        } else {
          amount = parseFloat(`${integer}.${Math.round(fractional)}`) || (integer + fractional * 0.1);
        }
      } else {
        // Simple number before 元/块, or 点 pattern
        amount = chineseToNumber(match[1]);
      }
      results.push({ match: match[0], amount });
    }
  }
  return results;
}

function replaceChinesePrices(text) {
  // Replace Chinese price expressions with Arabic equivalents
  const prices = parseChinesePrice(text);
  let result = text;
  for (const p of prices) {
    result = result.replace(p.match, `${p.amount}元`);
  }
  return result;
}

function parseExpenseText(text) {
  // First, convert Chinese price expressions to Arabic
  const normalized = replaceChinesePrices(text);

  // Match pattern: description + number + 元/块
  const regex = /([^\d,，。.\s]+?)(\d+\.?\d*)\s*[元块]/g;
  const results = [];
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const desc = cleanDescription(match[1]);
    const amount = parseFloat(match[2]);
    if (amount <= 0 || isNaN(amount)) continue;
    const category = guessCategory(desc);
    results.push({ description: desc, amount, category });
  }
  return results;
}
