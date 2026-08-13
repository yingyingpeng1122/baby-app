import './App.css';
import { useState, useEffect, useRef } from 'react';
import {
  Baby, Ruler, Scale, Milk, Utensils, Music, Gamepad2, Video, Save,
  PlayCircle, Loader2, AlertCircle, Sparkles, Pencil, Check, Maximize2, Minimize2,
  Plus, Trash2, Clock, TrendingUp, ChevronDown, Sun, BookOpen, Heart, Moon, Pill, Smile, ListChecks, ChevronLeft, ChevronRight, Calendar, X, Thermometer, Stethoscope, Syringe, Activity,
  Eye, MessageCircle, Footprints, Hand, Brain, Bell, Lightbulb
} from 'lucide-react';

// WHO 最低食物种类（MDD）的 7 个食物组
const FOOD_GROUPS = ['谷物根茎', '豆坚果', '奶制品', '肉禽鱼', '蛋', '富维A果蔬', '其他果蔬'];

// ============ 身高体重参考曲线（中位数 P50，仅作趋势示意）============
// 数据来源：WHO 儿童生长标准 2006（国际）；中国九市儿童体格发育调查（中国参考）。
// 锚点按月，曲线内插。非精确百分位图，临床评估以医生 z 评分/百分位为准。
const GROWTH_REF = {
  boy: {
    intl: { // WHO 国际标准
      w: [[0,3.3],[1,4.5],[2,5.6],[3,6.4],[4,7.0],[5,7.5],[6,7.9],[9,8.9],[12,9.6],[15,10.3],[18,10.9],[21,11.5],[24,12.2],[30,13.3],[36,14.3]],
      h: [[0,49.9],[1,54.7],[2,58.4],[3,61.4],[4,63.9],[5,65.9],[6,67.6],[9,72.0],[12,75.7],[15,79.6],[18,82.6],[21,85.1],[24,87.1],[30,90.7],[36,96.1]],
    },
    cn: { // 中国参考（城市，略高于 WHO）
      w: [[0,3.3],[1,4.6],[2,5.7],[3,6.5],[4,7.1],[5,7.6],[6,8.0],[9,9.1],[12,9.8],[15,10.6],[18,11.2],[21,11.9],[24,12.6],[30,13.8],[36,14.8]],
      h: [[0,50.0],[1,54.8],[2,58.6],[3,61.6],[4,64.2],[5,66.1],[6,67.9],[9,72.4],[12,76.2],[15,80.3],[18,83.4],[21,86.0],[24,88.1],[30,91.9],[36,97.3]],
    },
  },
  girl: {
    intl: {
      w: [[0,3.2],[1,4.2],[2,5.1],[3,5.8],[4,6.4],[5,6.9],[6,7.3],[9,8.2],[12,8.9],[15,9.6],[18,10.2],[21,10.8],[24,11.5],[30,12.7],[36,13.9]],
      h: [[0,49.1],[1,53.7],[2,57.1],[3,59.8],[4,62.1],[5,64.0],[6,65.7],[9,70.1],[12,74.0],[15,77.5],[18,80.7],[21,83.4],[24,85.7],[30,89.9],[36,95.1]],
    },
    cn: {
      w: [[0,3.2],[1,4.3],[2,5.2],[3,5.9],[4,6.5],[5,7.0],[6,7.4],[9,8.4],[12,9.1],[15,9.9],[18,10.5],[21,11.2],[24,11.9],[30,13.1],[36,14.4]],
      h: [[0,49.2],[1,53.8],[2,57.3],[3,60.0],[4,62.4],[5,64.3],[6,66.0],[9,70.6],[12,74.6],[15,78.2],[18,81.4],[21,84.2],[24,86.6],[30,90.8],[36,96.0]],
    },
  },
};
// 线性内插：给定锚点数组与月龄，返回参考值
function refAt(anchors, age) {
  if (age <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (age >= last[0]) return last[1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [a0, v0] = anchors[i], [a1, v1] = anchors[i + 1];
    if (age >= a0 && age <= a1) {
      const t = (age - a0) / (a1 - a0);
      return v0 + (v1 - v0) * t;
    }
  }
  return last[1];
}
function monthsBetween(birthday, dateStr) {
  const b = new Date(birthday), d = new Date(dateStr);
  let m = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  m += (d.getDate() - b.getDate()) / 30;
  return Math.max(0, m);
}
function ageLabel(age) {
  const whole = Math.floor(age);
  const dec = Math.round((age - whole) * 10);
  return dec ? `${whole}.${dec}月` : `${whole}月`;
}

// 生病模式：根据月龄与体温给出动态就医建议
function sicknessAdvice(months, temp) {
  if (!temp) return { level: 'none', title: '尚未记录体温', text: '记录体温后，会自动判断是否需要就医。', seeDoctor: false };
  const m = Math.floor(months);
  // 任何月龄的危急信号已在 note 中体现，此处给温度红线
  const under3 = m < 3;
  const under6 = m < 6;
  if (under3) {
    return temp >= 38
      ? { level: 'red', title: '⚠️ 立即就医', text: '3 个月以下婴儿肛温 ≥ 38°C 属于急诊，请立即就医。', seeDoctor: true }
      : { level: 'warn', title: '密切观察', text: '小婴儿体温异常波动需警惕，建议尽快咨询医生。', seeDoctor: false };
  }
  if (under6) {
    return temp >= 39
      ? { level: 'red', title: '⚠️ 建议就医', text: '3–6 个月体温 ≥ 39°C，建议尽快就医。', seeDoctor: true }
      : { level: 'warn', title: '居家观察', text: '可先物理降温并每 4 小时记录体温，若持续升高或精神差请就医。', seeDoctor: false };
  }
  // ≥6 个月
  if (temp >= 39.4) return { level: 'red', title: '⚠️ 建议就医', text: '6 个月以上体温 ≥ 39.4°C 建议就医；若发热超过 3 天也需就诊。', seeDoctor: true };
  if (temp >= 38) return { level: 'warn', title: '居家观察', text: '低热，可居家护理，每 4 小时记录一次体温，关注精神状态。', seeDoctor: false };
  return { level: 'ok', title: '体温正常', text: '体温在正常范围，继续观察即可。', seeDoctor: false };
}
// 下次记录体温的建议时间 = 上次 + 4 小时
function nextTempTime(datetimeStr) {
  if (!datetimeStr) return '';
  const d = new Date(datetimeStr.replace(' ', 'T'));
  if (isNaN(d)) return '';
  d.setHours(d.getHours() + 4);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
// 距上次记录的小时数
function hoursSince(datetimeStr) {
  if (!datetimeStr) return null;
  const d = new Date(datetimeStr.replace(' ', 'T'));
  if (isNaN(d)) return null;
  return Math.max(0, (Date.now() - d.getTime()) / 3600000);
}

// ============ 身高体重曲线对比图（SVG）============
function GrowthChart({ records, metric, gender, birthday }) {
  const W = 680, H = 310;
  const padL = 48, padR = 16, padT = 16, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const key = metric === 'weight' ? 'w' : 'h';
  const ref = GROWTH_REF[gender] || GROWTH_REF.boy;
  const cur = birthday ? monthsBetween(birthday, todayISO()) : 0;
  const ageMax = Math.min(36, Math.max(12, Math.ceil(cur) + 2));

  const pts = records
    .map(r => ({ age: monthsBetween(birthday, r.date), v: metric === 'weight' ? r.weight : r.height, date: r.date }))
    .filter(p => p.v > 0 && p.age <= ageMax + 0.5)
    .sort((a, b) => a.age - b.age);

  const sampleN = 36;
  const intlLine = [], cnLine = [];
  const vals = [...pts.map(p => p.v)];
  for (let i = 0; i <= sampleN; i++) {
    const a = (ageMax * i) / sampleN;
    const iv = refAt(ref.intl[key], a), cv = refAt(ref.cn[key], a);
    intlLine.push([a, iv]); cnLine.push([a, cv]); vals.push(iv, cv);
  }
  if (vals.length === 0) vals.push(0, 1);
  const vMin = Math.max(0, Math.floor(Math.min(...vals) - 1));
  const vMax = Math.ceil(Math.max(...vals) + 1);
  const xOf = a => padL + (a / ageMax) * plotW;
  const yOf = v => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const linePath = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round((vMin + (vMax - vMin) * f) * 10) / 10);
  const yTitle = metric === 'weight' ? '体重 (kg)' : '身高 (cm)';
  const cx = padL + plotW / 2;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="身高体重曲线">
      {/* 网格 + Y 轴刻度 */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 8} y={yOf(t) + 3} textAnchor="end" className="chart-axis">{t}</text>
        </g>
      ))}
      {/* Y 轴标题（单位） */}
      <text x={14} y={padT + plotH / 2} textAnchor="middle" className="chart-axis-title" transform={`rotate(-90 14 ${padT + plotH / 2})`}>{yTitle}</text>
      {/* X 轴刻度 */}
      {[0, 3, 6, 9, 12, 18, 24, 30, 36].filter(m => m <= ageMax).map(m => (
        <text key={m} x={xOf(m)} y={H - 26} textAnchor="middle" className="chart-axis">{m}</text>
      ))}
      {/* X 轴标题 */}
      <text x={cx} y={H - 6} textAnchor="middle" className="chart-axis-title">月龄</text>
      {/* 参考曲线：国际(虚线灰) / 中国(虚线蓝) */}
      <path d={linePath(intlLine)} fill="none" stroke="#9aa3b2" strokeWidth="2" strokeDasharray="5 4" />
      <path d={linePath(cnLine)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 4" />
      {/* 宝宝数据 */}
      {pts.length > 1 && (
        <path d={linePath(pts.map(p => [p.age, p.v]))} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={xOf(p.age)} cy={yOf(p.v)} r="4" fill="var(--primary)" stroke="#fff" strokeWidth="1.5">
          <title>{p.date} · {metric === 'weight' ? p.v + ' kg' : p.v + ' cm'}</title>
        </circle>
      ))}
    </svg>
  );
}

// ============ 体温曲线图（SVG）============
function TempChart({ records }) {
  const W = 680, H = 286;
  const padL = 36, padR = 14, padT = 14, padB = 56;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vMin = 35.5, vMax = 41;
  // 横轴时间标签：月-日 时:分（跨天也能区分日期）
  const fmtAxis = (dt) => {
    const s = (dt || '').replace('T', ' ');
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    return m ? `${m[2]}-${m[3]} ${m[4]}:${m[5]}` : s;
  };
  const pts = [...records]
    .map(r => {
      const dt = r.datetime || '';
      const t = new Date(dt.replace(' ', 'T'));
      return { t: isNaN(t) ? null : t, v: Number(r.temp) || 0, dt, note: r.note || '' };
    })
    .filter(p => p.t !== null)
    .sort((a, b) => a.t - b.t);
  const n = pts.length;
  const xOf = i => n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
  const yOf = v => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
  const yTicks = [36, 37, 38, 39, 40];
  const axisY = padT + plotH;
  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="体温曲线">
      {/* 横向网格 + Y 轴刻度（体温 °C） */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 6} y={yOf(t) + 3} textAnchor="end" className="chart-axis">{t}</text>
        </g>
      ))}
      {/* 发热线 38 / 就医线 39.4 */}
      <line x1={padL} y1={yOf(38)} x2={W - padR} y2={yOf(38)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" />
      <line x1={padL} y1={yOf(39.4)} x2={W - padR} y2={yOf(39.4)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x={W - padR} y={yOf(38) - 4} textAnchor="end" className="chart-thr chart-thr--warn">发热 38°C</text>
      <text x={W - padR} y={yOf(39.4) - 4} textAnchor="end" className="chart-thr chart-thr--danger">就医 39.4°C</text>
      {n > 0 && <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="2.5" />}
      {/* X 轴基线 + 每个测量点的时间标签（体现时间轴） */}
      <line x1={padL} y1={axisY} x2={W - padR} y2={axisY} stroke="var(--ink-soft)" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <g key={i}>
          <line x1={xOf(i)} y1={axisY} x2={xOf(i)} y2={axisY + 4} stroke="var(--ink-soft)" strokeWidth="1" />
          <text x={xOf(i)} y={axisY + 18} textAnchor="middle" className="chart-axis chart-axis--x">{fmtAxis(p.dt)}</text>
          <circle cx={xOf(i)} cy={yOf(p.v)} r="4" fill={p.v >= 38 ? '#ef4444' : '#f59e0b'} stroke="#fff" strokeWidth="1.5">
            <title>{p.dt} · {p.v}°C{p.note ? ' · ' + p.note : ''}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

// 当前时刻 HH:MM（录入默认时间）
const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// 今天日期 YYYY-MM-DD
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// 现在日期时间 YYYY-MM-DD HH:MM
const nowDateTime = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// 两个 HH:MM 相差分钟（跨午夜自动 +24h）
const diffMinutes = (a, b) => {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  let d = (bh * 60 + bm) - (ah * 60 + am);
  if (d <= 0) d += 24 * 60;
  return d;
};
// HH:MM 加分钟数，返回 HH:MM（处理跨午夜）
const addMinutesHM = (hm, mins) => {
  const [h, m] = hm.split(':').map(Number);
  const t = (((h * 60 + m) + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
// 分钟数转中文时长
const fmtDur = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  if (h && mm) return `${h} 小时 ${mm} 分`;
  if (h) return `${h} 小时`;
  return `${mm} 分`;
};

// 宝宝生病护理指南（通用科普，不能替代医生诊断）
const CARE_GUIDE = {
  stageFever: [
    {
      key: 'teething',
      title: '出牙期（约 4–10 个月，常从 6 个月起）',
      icon: 'thermometer',
      points: [
        '常见表现：流口水、爱咬东西、牙龈红肿、烦躁，以及轻微体温升高（多数 < 38°C）。',
        '重要区分：出牙一般只引起低热；若体温 ≥ 38°C 或持续不退，多半是其他原因（感冒、中耳炎等），需排查。',
        '护理：牙胶冷藏后冷敷、干净手指轻按摩牙龈、及时擦干口水防口水疹。',
      ],
    },
    {
      key: 'vaccine',
      title: '接种疫苗后（2/3/4/5/6/8/12/18 月龄等）',
      icon: 'syringe',
      points: [
        '常见：接种后 1–2 天内低热（约 37.5–38.5°C），百白破、麻腮风等疫苗更明显。',
        '麻腮风疫苗多在接种后 7–12 天出现低热和零星皮疹，通常 1–2 天自行消退。',
        '护理：多喂母乳/水、适当减衣、必要时按年龄用退热药（见“发烧”）。',
        '需就医：发热超过 48 小时、体温 ≥ 39°C、精神极差或接种部位严重红肿。',
      ],
    },
    {
      key: 'roseola',
      title: '幼儿急疹 / 玫瑰疹（6–18 个月高发）',
      icon: 'activity',
      points: [
        '特点：体温骤升到 39–40°C，持续 3–4 天，孩子精神通常尚可；热退后全身出玫瑰色皮疹。',
        '护理：高热期按“发烧”处理，重点退热、补液、观察精神。',
        '警惕：若高热伴精神差、抽搐、皮疹按压不褪色，及时就医。',
      ],
    },
  ],
  illnesses: [
    {
      key: 'fever',
      title: '发烧',
      icon: 'thermometer',
      points: [
        '测量：肛温最准；发热约指肛温 ≥ 38°C（腋温 ≥ 37.5°C）。',
        '居家退热：≥ 2 个月可用对乙酰氨基酚（按体重 10–15 mg/kg，间隔 ≥ 4–6 小时）；≥ 6 个月可加用布洛芬（5–10 mg/kg，间隔 ≥ 6–8 小时）。',
        '禁用：阿司匹林（警惕瑞氏综合征）；6 岁以下不推荐复方感冒药与镇咳药。',
        '物理降温：温水擦浴，不推荐酒精擦浴、冰敷。',
        '看医生红线：① 任何 < 3 个月婴儿肛温 ≥ 38°C 立即就医；② 3–6 个月 ≥ 39°C；③ 6 个月以上 ≥ 39.4°C 或发热 > 3 天；④ 精神差、呕吐、皮疹、呼吸急促、抽搐。',
      ],
    },
    {
      key: 'cough',
      title: '咳嗽',
      icon: 'stethoscope',
      points: [
        '护理：充足液体、空气加湿、睡前抬高上半身。',
        '不推荐：婴幼儿（尤其 < 6 岁）用非处方镇咳药，可能抑制排痰。',
        '看医生：呼吸急促/喘息、犬吠样咳嗽（疑似喉炎）、锁骨上凹陷（三凹征）、口唇发青、咳嗽 > 2 周。',
      ],
    },
    {
      key: 'diarrhea',
      title: '拉肚子（腹泻）',
      icon: 'stethoscope',
      points: [
        '关键：口服补液盐（ORS）少量多次，继续母乳/正常饮食，避免果汁和甜饮。',
        '观察脱水信号：尿量减少、无泪、口唇干、精神差、眼窝凹陷。',
        '不随便用止泻药（婴幼儿慎用洛哌丁胺）；益生菌可辅助调理。',
        '看医生：血便、高热、持续呕吐、6–8 小时无尿、嗜睡——警惕脱水与轮状病毒。',
      ],
    },
    {
      key: 'cold',
      title: '感冒',
      icon: 'stethoscope',
      points: [
        '护理：休息、补液、生理盐水滴鼻/吸鼻、空气加湿；发热按“发烧”处理。',
        '抗生素对病毒无效，是否合并细菌感染（如中耳炎）由医生判断。',
        '看医生：高热 > 3 天、耳痛、呼吸费力、精神差。',
      ],
    },
  ],
  redflags: [
    '任何 < 3 个月婴儿出现发热（肛温 ≥ 38°C）',
    '高热达到就医阈值且持续（见上方各病条）',
    '精神萎靡、嗜睡、难以唤醒',
    '呼吸急促或困难、口唇/指甲发青',
    '抽搐（热性惊厥）或颈部僵硬',
    '反复呕吐、无法进食进水',
    '皮疹按压不褪色、眼窝明显凹陷',
    '腹泻伴 6–8 小时无尿等脱水迹象',
  ],
};

const CARE_ICONS = {
  thermometer: Thermometer,
  syringe: Syringe,
  activity: Activity,
  stethoscope: Stethoscope,
};

// 早教活动类型 → 图标
const ACT_ICONS = {
  vision: Eye, music: Music, language: MessageCircle, motor: Footprints,
  fine: Hand, cog: Brain, social: Smile, reading: BookOpen, life: Baby,
};

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin);

/* 多用户：浏览器自动生成唯一 ID，存 localStorage 持久化 */
function getUserId() {
  let id = localStorage.getItem('babyapp_user_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('babyapp_user_id', id);
  }
  return id;
}
const USER_ID = getUserId();

/* 当前选中的宝宝 ID（模块级，组件内通过 useEffect 同步） */
let _currentBabyId = null;

/* 请求超时：避免后端无响应时前端一直转圈 */
const FETCH_TIMEOUT = 15000;

/* 统一 fetch 包装：自动注入 X-User-Id 和 X-Baby-Id header，并带超时兜底 */
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), 'X-User-Id': USER_ID };
  if (_currentBabyId) headers['X-Baby-Id'] = _currentBabyId;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...options, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* 清单图标映射 */
const CHECKLIST_ICONS = {
  pill: <Pill className="icon icon--sm" />,
  sun: <Sun className="icon icon--sm" />,
  baby: <Baby className="icon icon--sm" />,
  heart: <Heart className="icon icon--sm" />,
  utensils: <Utensils className="icon icon--sm" />,
  smile: <Smile className="icon icon--sm" />,
  book: <BookOpen className="icon icon--sm" />,
  moon: <Moon className="icon icon--sm" />,
  check: <Check className="icon icon--sm" />,
};

/* 滚动揭示：逻辑在 JS，样式在 CSS */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
function Reveal({ as: Tag = 'div', delay = 0, className = '', children }) {
  return <Tag ref={useReveal()} className={`reveal ${className}`} style={{ '--d': `${delay}s` }}>{children}</Tag>;
}

const Badge = ({ ok, children }) => (
  <span className={`badge ${ok ? 'badge--ok' : 'badge--warn'}`}>
    {ok ? <Check className="icon icon--xs" /> : <AlertCircle className="icon icon--xs" />}
    {children}
  </span>
);

// 身高 / 体重偏离参考区间时的状态文案（分级提醒）
const HEIGHT_STATUS_TEXT = { normal: '达标', short: '偏矮', tall: '偏高' };
const WEIGHT_STATUS_TEXT = { normal: '达标', light: '略轻', under: '超轻', heavy: '略重', over: '超重' };
const growthOk = (s) => s === 'normal';

function VideoModal({ open, title, src = '', onClose }) {
  const cardRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false); // 浏览器原生 Fullscreen API
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false); // iOS 等不支持元素全屏时的伪全屏兜底

  // 全屏状态变化监听：用户可能通过浏览器自带方式（Esc / 系统手势）退出全屏
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // 伪全屏下按 Esc 退出
  useEffect(() => {
    if (!pseudoFullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPseudoFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudoFullscreen]);

  const toggleFullscreen = async () => {
    const el = cardRef.current;
    if (!el) return;
    // 桌面 / Android Chrome 等支持原生全屏：优先用标准 Fullscreen API
    if (typeof el.requestFullscreen === 'function') {
      try {
        if (!document.fullscreenElement) {
          await el.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
        return;
      } catch (e) {
        // 原生失败则降级到伪全屏
        console.warn('native fullscreen failed, fallback to pseudo', e);
      }
    }
    // iOS Safari 等：元素没有 requestFullscreen，用撑满视口的“伪全屏”兜底
    setPseudoFullscreen((v) => !v);
  };

  if (!open) return null;
  // 没有配置视频（空串或占位符 '#'）时不再回退到同一个共享示例，避免“所有活动打开同一地址”
  const isEmpty = !src || src === '#';
  const videoSrc = isEmpty ? '' : src;
  const biliEmbed = getBiliEmbedUrl(videoSrc);
  const active = isFullscreen || pseudoFullscreen;
  return (
    <div className={`modal ${pseudoFullscreen ? 'modal--pseudo-fullscreen' : ''}`} role="dialog" aria-modal="true">
      <div
        className="modal__backdrop"
        onClick={pseudoFullscreen ? undefined : onClose}
      />
      <div className={`modal__card modal__card--video ${active ? 'is-fullscreen' : ''}`} ref={cardRef}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <div className="modal__head-actions">
            <button
              className="modal__iconbtn"
              onClick={toggleFullscreen}
              aria-label={active ? '退出全屏' : '全屏播放'}
              title={active ? '退出全屏' : '全屏播放'}
            >
              {active ? <Minimize2 className="icon icon--sm" /> : <Maximize2 className="icon icon--sm" />}
            </button>
            <button className="modal__close" onClick={() => { setPseudoFullscreen(false); onClose(); }} aria-label="关闭">✕</button>
          </div>
        </div>
        <div className="modal__video">
          {isEmpty ? (
            <div className="modal__fallback">
              <p>该活动暂未配置对应的演示视频。</p>
            </div>
          ) : biliEmbed ? (
            // B 站官方可内嵌播放器：直接在弹窗内联播放，不再跳转到新标签页
            <iframe
              className="modal__iframe"
              title={title}
              src={biliEmbed}
              frameBorder="0"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer"
            />
          ) : videoSrc.includes('bilibili.com') ? (
            // 极少数无法内嵌的 B 站短链，退回新标签页
            <div className="modal__fallback">
              <p>该 B 站链接暂不支持内嵌播放。</p>
              <a className="btn btn--primary" href={videoSrc} target="_blank" rel="noreferrer">在新标签页打开 B 站播放</a>
            </div>
          ) : (
            <video className="modal__player" controls autoPlay src={videoSrc}>
              您的浏览器不支持 video 元素。
            </video>
          )}
        </div>
      </div>
    </div>
  );
}

const pct = (v, lo, hi) => Math.max(4, Math.min(100, ((v - lo) / (hi - lo)) * 100));

// 早教活动 / 音乐区 共用的卡片列表
function ActList({ items, onPlay }) {
  return (
    <div className="acts">
      {items.map((a, i) => {
        const Icon = ACT_ICONS[a.icon] || Sparkles;
        const sub = a.lang
          ? a.lang
          : (a.stage ? `适合 · ${a.stage}` : `适用 ${a.ageRange?.[0] ?? 0}–${a.ageRange?.[1] ?? 24} 个月`);
        return (
          <Reveal key={a.id} className="act" delay={i * 0.07}>
            <span className={`act__tile act__tile--${a.icon || 'cog'}`}><Icon className="icon icon--lg" /></span>
            <div className="act__main">
              <div className="act__title">{a.title}</div>
              <div className="act__desc">{a.desc}</div>
              <span className="act__age">{sub}</span>
            </div>
            <button className="act__play" aria-label={`查看 ${a.title} 演示`} onClick={() => onPlay(a)}><PlayCircle className="icon icon--sm" /></button>
          </Reveal>
        );
      })}
      {items.length === 0 && <div className="acts__empty">暂无推荐</div>}
    </div>
  );
}

function getBiliEmbedUrl(url) {
  if (!url) return '';
  try {
    // already an embed
    if (url.includes('player.bilibili.com')) return url;
    // common BV id
    const bv = url.match(/(BV[0-9A-Za-z]+)/);
    if (bv) return `https://player.bilibili.com/player.html?bvid=${bv[1]}&page=1`;
    // bvid query
    const bq = url.match(/[?&]bvid=([^&]+)/);
    if (bq) return `https://player.bilibili.com/player.html?bvid=${bq[1]}&page=1`;
    // av id
    const av = url.match(/av(\d+)/i) || url.match(/[?&]aid=(\d+)/i);
    if (av) return `https://player.bilibili.com/player.html?aid=${av[1]}&page=1`;
    // path based video id: /video/{id}
    const pathMatch = url.match(/video\/([^\/?#]+)/i);
    if (pathMatch && pathMatch[1]) return `https://player.bilibili.com/player.html?bvid=${pathMatch[1]}&page=1`;
    // short link (b23.tv) fallback: just open original URL in iframe (may not work reliably)
    if (url.includes('b23.tv')) return url;
  } catch (e) {
    return '';
  }
  return '';
}

function isBilibili(url) { return !!getBiliEmbedUrl(url); }

/* ---------- 自定义下拉框 ---------- */
function Dropdown({ value, onChange, options, placeholder = '请选择' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className={`dropdown__trigger ${open ? 'is-open' : ''}`} onClick={() => setOpen(!open)}>
        {selected?.icon && <span className="dropdown__trigger-icon">{selected.icon}</span>}
        <span className="dropdown__label">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="icon icon--xs dropdown__chevron" />
      </button>
      {open && (
        <div className="dropdown__menu">
          {options.map(opt => (
            <button key={opt.value} type="button"
              className={`dropdown__option ${opt.value === value ? 'is-selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}>
              {opt.icon && <span className="dropdown__opt-icon">{opt.icon}</span>}
              <span className="dropdown__opt-label">{opt.label}</span>
              {opt.value === value && <Check className="icon icon--xs dropdown__check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 自定义时间选择器 ---------- */
function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hrScrollRef = useRef(null);
  const minScrollRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 打开时自动滚动到选中项
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      hrScrollRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'center' });
      minScrollRef.current?.querySelector('.is-selected')?.scrollIntoView({ block: 'center' });
    }, 10);
  }, [open]);

  const curH = value?.split(':')[0] || '';
  const curM = value?.split(':')[1] || '';

  const pickH = (h) => onChange(`${h}:${curM || '00'}`);
  const pickM = (m) => onChange(`${curH || '08'}:${m}`);

  return (
    <div className="timepicker" ref={ref}>
      <button type="button"
        className={`timepicker__trigger ${open ? 'is-open' : ''} ${value ? 'has-value' : ''}`}
        onClick={() => setOpen(!open)}>
        <Clock className="icon icon--xs" />
        <span className="timepicker__label">{value || '选择时间'}</span>
      </button>
      {open && (
        <div className="timepicker__panel">
          <div className="timepicker__cols">
            <div className="timepicker__col">
              <div className="timepicker__col-head">时</div>
              <div className="timepicker__col-scroll" ref={hrScrollRef}>
                {Array.from({ length: 24 }, (_, h) => {
                  const hh = String(h).padStart(2, '0');
                  return (
                    <button key={h} type="button"
                      className={`timepicker__item ${curH === hh ? 'is-selected' : ''}`}
                      onClick={() => pickH(hh)}>{hh}</button>
                  );
                })}
              </div>
            </div>
            <div className="timepicker__col">
              <div className="timepicker__col-head">分</div>
              <div className="timepicker__col-scroll" ref={minScrollRef}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => {
                  const mm = String(m).padStart(2, '0');
                  return (
                    <button key={m} type="button"
                      className={`timepicker__item ${curM === mm ? 'is-selected' : ''}`}
                      onClick={() => pickM(mm)}>{mm}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <button type="button" className="timepicker__confirm" onClick={() => setOpen(false)}>确定</button>
        </div>
      )}
    </div>
  );
}

export default function BabyAppFullStack() {
  const [view, setView] = useState('loading');
  const [error, setError] = useState(null);
  const [connError, setConnError] = useState(null); // 初始化连接失败（超时/网络不可达）
  const [data, setData] = useState(null);
  const [modal, setModal] = useState({ open: false, title: '' });
  const [form, setForm] = useState({ name: '', gender: 'boy', birthday: '', height: '', weight: '' });
  // 家庭系统
  const [family, setFamily] = useState(null);          // { family_id, family_name, role, members, babies }
  const [babies, setBabies] = useState([]);            // 家庭所有宝宝列表
  const [currentBabyId, setCurrentBabyId] = useState(null); // 当前选中宝宝
  const [familySetupMode, setFamilySetupMode] = useState(null); // 'create' | 'join' | null
  const [familyName, setFamilyName] = useState('');
  const [joinFamilyId, setJoinFamilyId] = useState('');
  // 成员昵称编辑
  const [nickModal, setNickModal] = useState({ open: false, nickname: '' });
  // 家庭成员「+x」下拉展开
  const [membersOpen, setMembersOpen] = useState(false);
  // 成长阶段详情弹窗
  const [stageModal, setStageModal] = useState(null); // { key,title,principle,signs,advice,sources } | null
  // 生病护理指南折叠
  const [careOpen, setCareOpen] = useState(false);
  const [careItem, setCareItem] = useState(null); // 当前展开的条目 key
  // 喂养记录
  const [feedRecords, setFeedRecords] = useState([]);
  const [feedEval, setFeedEval] = useState(null);
  const [feedForm, setFeedForm] = useState({ time: nowHM(), amount: '', type: 'milk', note: '', foodGroups: [], kind: '', duration: 0, wakeTime: '' });
  const [feedLoading, setFeedLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // 录入表单类型 tab：feed / diaper / sleep
  const [recordTab, setRecordTab] = useState('feed');
  // 每日照护清单
  const [checklist, setChecklist] = useState([]);
  // 照护日历
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarData, setCalendarData] = useState(null);
  const [calendarDate, setCalendarDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [calendarDetail, setCalendarDetail] = useState(null); // { date, items }
  // 喂养日历
  const [feedingCalendarOpen, setFeedingCalendarOpen] = useState(false);
  const [feedingCalendarData, setFeedingCalendarData] = useState(null);
  const [feedingCalendarDate, setFeedingCalendarDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [feedingDetail, setFeedingDetail] = useState(null); // { date, records }
  // 生病日历
  const [sickCalendarOpen, setSickCalendarOpen] = useState(false);
  const [sickCalendarData, setSickCalendarData] = useState(null);
  const [sickCalendarDate, setSickCalendarDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [feedingStats, setFeedingStats] = useState(null);
  const [devOpen, setDevOpen] = useState(false); // 发育概况折叠（必须放在提前 return 之前，遵守 hooks 规则）
  // 成长记录（身高体重）
  const [growthRecords, setGrowthRecords] = useState([]);
  const [growthDraft, setGrowthDraft] = useState({ date: todayISO(), height: '', weight: '', note: '' });
  const [growthMetric, setGrowthMetric] = useState('weight'); // weight | height
  const [editingGrowthId, setEditingGrowthId] = useState(null);
  const [growthHistoryOpen, setGrowthHistoryOpen] = useState(false);
  // 生病模式：体温记录
  const [sickMode, setSickMode] = useState(() => {
    try { return localStorage.getItem('babyapp_sickmode') === '1'; } catch { return false; }
  });
  const [tempRecords, setTempRecords] = useState([]);
  const [tempDraft, setTempDraft] = useState({ temp: '', note: '', datetime: nowDateTime().replace(' ', 'T'), symptoms: [] });
  const [editingTempId, setEditingTempId] = useState(null); // 正在编辑的体温记录 id（null=新增）
  const TEMP_SYMPTOMS = ['咳嗽', '流涕', '呕吐', '腹泻', '精神差', '已用药'];
  // 生病模式开关持久化：下次进入仍保持开启
  const persistSickMode = (next) => {
    setSickMode(next);
    try { localStorage.setItem('babyapp_sickmode', next ? '1' : '0'); } catch {}
  };

  // 同步 currentBabyId 到模块级变量
  useEffect(() => { _currentBabyId = currentBabyId; }, [currentBabyId]);

  // 初始化：检查家庭状态
  useEffect(() => { initFamily(); }, []);

  const initFamily = async () => {
    try {
      setError(null);
      const res = await apiFetch(`${API_BASE}/family`);
      if (res.status === 404) {
        // 不在任何家庭中，显示家庭设置页
        return setView('family-setup');
      }
      if (!res.ok) throw new Error('fetch family failed');
      const fam = await res.json();
      setFamily(fam);
      setBabies(fam.babies || []);
      if (fam.babies && fam.babies.length > 0) {
        _currentBabyId = fam.babies[0].baby_id;
        setCurrentBabyId(fam.babies[0].baby_id);
        setView('dashboard');
        setTimeout(() => fetchDashboard(), 0);
      } else {
        setView('baby-edit');
      }
    } catch (e) {
      console.error('init family failed', e);
      if (e.name === 'AbortError') {
        setConnError('连接后端超时，请确认服务已启动或检查网络');
        setView('conn-error');
      } else {
        setView('family-setup');
      }
    }
  };

  // ---- 家庭操作 ----
  const createFamily = async () => {
    if (!familyName.trim()) return alert('请输入家庭名称');
    try {
      const res = await apiFetch(`${API_BASE}/family`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_name: familyName.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '创建失败'); }
      const fam = await res.json();
      setFamily(fam);
      setBabies([]);
      setView('baby-edit');
    } catch (e) { alert('创建家庭失败：' + e.message); }
  };

  const joinFamily = async () => {
    if (!joinFamilyId.trim()) return alert('请输入家庭 ID');
    try {
      const res = await apiFetch(`${API_BASE}/family/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: joinFamilyId.trim().toUpperCase() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '加入失败'); }
      await initFamily();
    } catch (e) { alert('加入家庭失败：' + e.message); }
  };

  // ---- 退出家庭（之后可在设置页重新创建/加入，即实现"切换家庭"）----
  const leaveFamily = async () => {
    if (!window.confirm(`确定要退出家庭「${family?.family_name || ''}」吗？\n退出后需重新创建或加入家庭才能继续记录，当前设备数据将清空。`)) return;
    try {
      const res = await apiFetch(`${API_BASE}/family/leave`, { method: 'POST' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '退出失败'); }
      // 重置本地状态，回到家庭设置页
      _currentBabyId = null;
      setCurrentBabyId(null);
      setFamily(null);
      setBabies([]);
      setData(null);
      setFeedRecords([]);
      setFeedEval(null);
      setChecklist([]);
      setFamilySetupMode(null);
      setView('family-setup');
    } catch (e) { alert('退出家庭失败：' + (e.message || '请确认后端已启动')); }
  };

  // ---- 更新我的成员昵称 ----
  const saveNickname = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/family/member`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickModal.nickname.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '保存失败'); }
      // 刷新家庭信息，使成员栏立即更新
      const fres = await apiFetch(`${API_BASE}/family`);
      if (fres.ok) setFamily(await fres.json());
      setNickModal({ open: false, nickname: '' });
    } catch (e) { alert('保存昵称失败：' + (e.message || '请确认后端已启动')); }
  };

  // ---- 宝宝操作 ----
  const addBaby = async () => {
    if (!form.name || !form.birthday) return alert('请填写昵称和出生日期');
    // 前端重名校验
    if (babies.some(b => b.name === form.name)) return alert(`宝宝「${form.name}」已存在，请使用其他名字`);
    try {
      setError(null);
      const res = await apiFetch(`${API_BASE}/family/babies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, height: parseFloat(form.height) || 0, weight: parseFloat(form.weight) || 0 }),
      });
      if (res.status === 409) { const e = await res.json(); throw new Error(e.detail || '重名'); }
      if (!res.ok) throw new Error(`添加失败 (${res.status})`);
      const newBaby = await res.json();
      setBabies(prev => [...prev, newBaby]);
      _currentBabyId = newBaby.baby_id;
      setCurrentBabyId(newBaby.baby_id);
      setForm({ name: '', gender: 'boy', birthday: '', height: '', weight: '' });
      fetchDashboard();
    } catch (e) { setError('添加失败：' + (e.message || '请确认后端已启动')); }
  };

  const deleteBaby = async (babyId, babyName) => {
    if (!confirm(`确定要删除宝宝「${babyName}」吗？该宝宝的所有喂养记录和清单数据也将被删除，此操作不可撤销。`)) return;
    try {
      setError(null);
      const res = await apiFetch(`${API_BASE}/family/babies/${babyId}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || '删除失败'); }
      // 移除本地列表
      const newBabies = babies.filter(b => b.baby_id !== babyId);
      setBabies(newBabies);
      // 如果删的是当前宝宝，切换到第一个
      if (babyId === currentBabyId) {
        if (newBabies.length > 0) {
          _currentBabyId = newBabies[0].baby_id;
          setCurrentBabyId(newBabies[0].baby_id);
          setTimeout(() => fetchDashboard(), 0);
        }
      }
    } catch (e) { setError('删除失败：' + (e.message || '请确认后端已启动')); }
  };

  const switchBaby = (babyId) => {
    if (babyId === currentBabyId) return;
    _currentBabyId = babyId;
    setCurrentBabyId(babyId);
    setData(null);
    setFeedRecords([]);
    setFeedEval(null);
    setChecklist([]);
    setTimeout(() => fetchDashboard(), 0);
  };

  const fetchDashboard = async () => {
    try {
      setError(null);
      const res = await apiFetch(`${API_BASE}/dashboard`);
      if (res.status === 404) return setView('baby-edit');
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
      setView('dashboard');
      // 同时拉取喂养数据、照护清单、成长记录、体温记录
      fetchFeedData();
      fetchChecklist();
      loadGrowth();
      loadTemps();
    } catch (e) {
      console.error(e);
      if (e.name === 'AbortError') {
        setConnError('连接后端超时，请确认服务已启动或检查网络');
        setView('conn-error');
      } else {
        setView('baby-edit');
      }
    }
  };

  // 拉取今日喂养记录 + 评估
  const fetchFeedData = async () => {
    try {
      const [recRes, evalRes] = await Promise.all([
        apiFetch(`${API_BASE}/feeding-records`),
        apiFetch(`${API_BASE}/feeding-evaluation`),
      ]);
      if (recRes.ok) setFeedRecords(await recRes.json());
      if (evalRes.ok) setFeedEval(await evalRes.json());
    } catch (e) { console.error('fetch feed data failed', e); }
  };

  // dashboard 加载完成后拉取喂养数据（由 fetchDashboard 内部统一触发）

  // 拉取今日照护清单
  const fetchChecklist = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/daily-checklist`);
      if (res.ok) setChecklist(await res.json());
    } catch (e) { console.error('fetch checklist failed', e); }
  };

  // ---- 成长记录（身高体重）----
  const loadGrowth = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/growth-records`);
      if (res.ok) setGrowthRecords(await res.json());
    } catch (e) { console.error('fetch growth failed', e); }
  };
  const addGrowth = async () => {
    if (!growthDraft.height && !growthDraft.weight) return alert('请至少填写身高或体重');
    try {
      const body = {
        date: growthDraft.date || todayISO(),
        height: growthDraft.height ? parseFloat(growthDraft.height) : 0,
        weight: growthDraft.weight ? parseFloat(growthDraft.weight) : 0,
        note: growthDraft.note || '',
      };
      const res = editingGrowthId
        ? await apiFetch(`${API_BASE}/growth-records/${editingGrowthId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch(`${API_BASE}/growth-records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || '保存失败'); }
      await loadGrowth();
      setGrowthDraft({ date: todayISO(), height: '', weight: '', note: '' });
      setEditingGrowthId(null);
    } catch (e) { alert('保存身高体重失败：' + (e.message || '')); }
  };
  const editGrowth = (r) => {
    setEditingGrowthId(r.id);
    setGrowthDraft({ date: r.date, height: r.height ? String(r.height) : '', weight: r.weight ? String(r.weight) : '', note: r.note || '' });
    setGrowthHistoryOpen(true);
  };
  const cancelEditGrowth = () => {
    setEditingGrowthId(null);
    setGrowthDraft({ date: todayISO(), height: '', weight: '', note: '' });
  };
  const delGrowth = async (id) => {
    if (!window.confirm('删除这条身高体重记录？')) return;
    try {
      const res = await apiFetch(`${API_BASE}/growth-records/${id}`, { method: 'DELETE' });
      if (res.ok) setGrowthRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error('delete growth failed', e); }
  };

  // ---- 生病模式：体温记录 ----
  const loadTemps = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/temperature-records`);
      if (res.ok) setTempRecords(await res.json());
    } catch (e) { console.error('fetch temp failed', e); }
  };
  const addTemp = async () => {
    const t = parseFloat(tempDraft.temp);
    if (!t || t < 34 || t > 43) return alert('请输入有效体温（34–43°C）');
    try {
      const res = await apiFetch(`${API_BASE}/temperature-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: (tempDraft.datetime || nowDateTime()).replace('T', ' ').slice(0, 16),
          temp: t,
          note: tempDraft.note || '',
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || '保存失败'); }
      await loadTemps();
      setTempDraft({ temp: '', note: '', datetime: nowDateTime().replace(' ', 'T'), symptoms: [] });
    } catch (e) { alert('保存体温失败：' + (e.message || '')); }
  };
  const delTemp = async (id) => {
    try {
      const res = await apiFetch(`${API_BASE}/temperature-records/${id}`, { method: 'DELETE' });
      if (res.ok) setTempRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error('delete temp failed', e); }
  };
  const editTemp = (r) => {
    setTempDraft({
      temp: String(r.temp),
      note: r.note || '',
      datetime: (r.datetime || '').replace(' ', 'T').slice(0, 16),
      symptoms: [],
    });
    setEditingTempId(r.id);
    // 滚动到表单，便于直接修改
    requestAnimationFrame(() => document.getElementById('temp-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const cancelTempEdit = () => {
    setEditingTempId(null);
    setTempDraft({ temp: '', note: '', datetime: nowDateTime().replace(' ', 'T'), symptoms: [] });
  };
  const updateTemp = async () => {
    const t = parseFloat(tempDraft.temp);
    if (!t || t < 34 || t > 43) return alert('请输入有效体温（34–43°C）');
    try {
      const res = await apiFetch(`${API_BASE}/temperature-records/${editingTempId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: (tempDraft.datetime || nowDateTime()).replace('T', ' ').slice(0, 16),
          temp: t,
          note: tempDraft.note || '',
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || '保存失败'); }
      await loadTemps();
      cancelTempEdit();
    } catch (e) { alert('保存体温失败：' + (e.message || '')); }
  };

  // 勾选 / 取消勾选
  const toggleChecklistItem = async (itemId, checked) => {
    // 乐观更新
    setChecklist(prev => prev.map(it => it.id === itemId ? { ...it, checked } : it));
    try {
      await apiFetch(`${API_BASE}/daily-checklist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, checked }),
      });
    } catch (e) {
      // 回滚
      setChecklist(prev => prev.map(it => it.id === itemId ? { ...it, checked: !checked } : it));
      console.error('toggle checklist failed', e);
    }
  };

  // 拉取某月照护历史
  const fetchCalendarHistory = async (year, month) => {
    try {
      const res = await apiFetch(`${API_BASE}/checklist/history?year=${year}&month=${month}`);
      if (res.ok) setCalendarData(await res.json());
    } catch (e) { console.error('fetch calendar history failed', e); }
  };

  // 拉取某日清单详情
  const fetchCalendarDetail = async (dateStr) => {
    try {
      const res = await apiFetch(`${API_BASE}/daily-checklist/by-date?date=${dateStr}`);
      if (res.ok) {
        const items = await res.json();
        setCalendarDetail({ date: dateStr, items });
      }
    } catch (e) { console.error('fetch calendar detail failed', e); }
  };

  // 切换日历月份
  const changeCalendarMonth = (delta) => {
    setCalendarDate(prev => {
      let { year, month } = prev;
      month += delta;
      if (month < 1) { year--; month = 12; }
      if (month > 12) { year++; month = 1; }
      return { year, month };
    });
  };

  // 喂养日历
  const fetchFeedingCalendar = async (year, month) => {
    try {
      const res = await apiFetch(`${API_BASE}/feeding-calendar?year=${year}&month=${month}`);
      if (res.ok) setFeedingCalendarData(await res.json());
    } catch (e) { console.error('fetch feeding calendar failed', e); }
  };

  const fetchFeedingStats = async (year, month) => {
    try {
      const res = await apiFetch(`${API_BASE}/feeding-stats-monthly?year=${year}&month=${month}`);
      if (res.ok) setFeedingStats(await res.json());
    } catch (e) { console.error('fetch feeding stats failed', e); }
  };

  // 拉取某日喂养记录详情
  const fetchFeedingDetail = async (dateStr) => {
    try {
      const res = await apiFetch(`${API_BASE}/feeding-records?date=${dateStr}`);
      if (res.ok) {
        const records = await res.json();
        setFeedingDetail({ date: dateStr, records });
      }
    } catch (e) { console.error('fetch feeding detail failed', e); }
  };

  // 生病日历
  const fetchSicknessCalendar = async (year, month) => {
    try {
      const res = await apiFetch(`${API_BASE}/sickness-calendar?year=${year}&month=${month}`);
      if (res.ok) setSickCalendarData(await res.json());
    } catch (e) { console.error('fetch sickness calendar failed', e); }
  };

  const openSicknessCalendar = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    setSickCalendarDate({ year: y, month: m });
    fetchSicknessCalendar(y, m);
    setSickCalendarOpen(true);
  };

  const changeSicknessCalendarMonth = (delta) => {
    setSickCalendarDate(prev => {
      let { year, month } = prev;
      month += delta;
      if (month < 1) { year--; month = 12; }
      if (month > 12) { year++; month = 1; }
      fetchSicknessCalendar(year, month);
      return { year, month };
    });
  };

  const openFeedingCalendar = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    setFeedingCalendarDate({ year: y, month: m });
    setFeedingDetail(null);
    fetchFeedingCalendar(y, m);
    fetchFeedingStats(y, m);
    setFeedingCalendarOpen(true);
  };

  const changeFeedingCalendarMonth = (delta) => {
    setFeedingCalendarDate(prev => {
      let { year, month } = prev;
      month += delta;
      if (month < 1) { year--; month = 12; }
      if (month > 12) { year++; month = 1; }
      setFeedingDetail(null);
      fetchFeedingCalendar(year, month);
      fetchFeedingStats(year, month);
      return { year, month };
    });
  };

  // 打开日历时拉取数据
  useEffect(() => {
    if (calendarOpen) {
      fetchCalendarHistory(calendarDate.year, calendarDate.month);
    }
  }, [calendarOpen, calendarDate]);

  const addFeedRecord = async () => {
    if (!feedForm.time) return alert('请选择时间');
    if ((feedForm.type === 'milk' || feedForm.type === 'solids') && !feedForm.amount) return alert('请填写喂养量');
    if (feedForm.type === 'diaper' && !feedForm.kind) return alert('请选择尿布类型（💧尿 / 💩屎 / 都有）');
    setFeedLoading(true);
    try {
      if (editingId) {
        // 更新已有记录
        await apiFetch(`${API_BASE}/feeding-records/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: feedForm.time,
            amount: (feedForm.type === 'milk' || feedForm.type === 'solids') ? (parseFloat(feedForm.amount) || 0) : 0,
            type: feedForm.type,
            note: feedForm.note,
            foodGroups: feedForm.foodGroups.join(','),
            duration: (feedForm.type === 'sleep' && feedForm.wakeTime) ? diffMinutes(feedForm.time, feedForm.wakeTime) : (feedForm.duration || 0),
            kind: feedForm.type === 'diaper' ? (feedForm.kind || '') : '',
          }),
        });
        setEditingId(null);
      } else {
        // 新增记录
        await apiFetch(`${API_BASE}/feeding-records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: feedForm.time,
            amount: (feedForm.type === 'milk' || feedForm.type === 'solids') ? (parseFloat(feedForm.amount) || 0) : 0,
            type: feedForm.type,
            note: feedForm.note,
            foodGroups: feedForm.foodGroups.join(','),
            duration: (feedForm.type === 'sleep' && feedForm.wakeTime) ? diffMinutes(feedForm.time, feedForm.wakeTime) : (feedForm.duration || 0),
            kind: feedForm.type === 'diaper' ? (feedForm.kind || '') : '',
          }),
        });
      }
      setFeedForm({ time: nowHM(), amount: '', type: 'milk', note: '', foodGroups: [], kind: '', duration: 0, wakeTime: '' });
      await fetchFeedData();
    } catch (e) { alert('操作失败：' + e.message); }
    setFeedLoading(false);
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setFeedForm({
      time: r.time,
      amount: String(r.amount),
      type: r.type,
      note: r.note || '',
      foodGroups: r.foodGroups ? r.foodGroups.split(',').filter(Boolean) : [],
      kind: r.kind || '',
      duration: r.duration || 0,
      wakeTime: (r.type === 'sleep' && r.duration) ? addMinutesHM(r.time, r.duration) : '',
    });
    setRecordTab(r.type === 'diaper' ? 'diaper' : r.type === 'sleep' ? 'sleep' : 'feed');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFeedForm({ time: nowHM(), amount: '', type: 'milk', note: '', foodGroups: [], kind: '', duration: 0, wakeTime: '' });
  };

  const toggleFoodGroup = (g) => {
    setFeedForm({
      ...feedForm,
      foodGroups: feedForm.foodGroups.includes(g)
        ? feedForm.foodGroups.filter((x) => x !== g)
        : [...feedForm.foodGroups, g],
    });
  };

  const deleteFeedRecord = async (id) => {
    try {
      await apiFetch(`${API_BASE}/feeding-records/${id}`, { method: 'DELETE' });
      await fetchFeedData();
    } catch (e) { console.error(e); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  /* ---------- 连接失败兜底 ---------- */
  if (view === 'conn-error') {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="form">
          <div className="form__head">
            <div className="form__logo"><AlertCircle className="icon icon--lg" /></div>
            <h2 className="form__title">暂时连不上服务</h2>
            <p className="form__sub">{connError || '请确认后端已启动，或检查网络连接'}</p>
          </div>
          <button className="btn btn--primary btn--block" onClick={() => { setConnError(null); setError(null); initFamily(); }}>
            <Loader2 className="icon icon--sm" />重新连接
          </button>
          <p className="form__sub" style={{ marginTop: 12, fontSize: 12 }}>
            本地调试：请先启动后端（FastAPI，默认 8000 端口），再用 <code>npm run dev</code> 打开；<br />
            线上访问请确认网络可连通 baby.datawinwin.cn
          </p>
        </div>
      </div>
    );
  }

  /* ---------- 加载 ---------- */
  if (view === 'loading') {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="loading"><div className="spinner" /><p className="loading__txt">正在加载…</p></div>
      </div>
    );
  }

  /* ---------- 家庭设置页 ---------- */
  if (view === 'family-setup') {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="form family-form">
          <div className="form__head">
            <div className="form__logo"><Baby className="icon icon--lg" /></div>
            <h2 className="form__title">欢迎来到宝宝成长记录</h2>
            <p className="form__sub">创建或加入一个家庭，与家人一起记录宝宝的成长</p>
          </div>

          {familySetupMode === null ? (
            <div className="family-actions">
              <button className="btn btn--primary btn--block btn--family" onClick={() => setFamilySetupMode('create')}>
                <span className="family-action-icon">🏠</span>
                <span className="family-action-text">创建家庭</span>
                <span className="family-action-hint">创建一个新家庭，自动生成唯一家庭 ID</span>
              </button>
              <button className="btn btn--outline btn--block btn--family" onClick={() => setFamilySetupMode('join')}>
                <span className="family-action-icon">🔗</span>
                <span className="family-action-text">加入家庭</span>
                <span className="family-action-hint">输入家庭 ID，加入已有家庭</span>
              </button>
            </div>
          ) : familySetupMode === 'create' ? (
            <div>
              <div className="field">
                <label className="field__label">家庭名称</label>
                <input className="input" placeholder="比如：快乐小家" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
              </div>
              <button className="btn btn--primary btn--block" onClick={createFamily}>创建家庭</button>
              <button className="btn btn--ghost btn--block" onClick={() => setFamilySetupMode(null)} style={{ marginTop: 8 }}>返回</button>
            </div>
          ) : (
            <div>
              <div className="field">
                <label className="field__label">请输入家庭 ID</label>
                <input className="input" placeholder="如：A7X3K9" value={joinFamilyId} onChange={(e) => setJoinFamilyId(e.target.value.toUpperCase())} maxLength={6} />
              </div>
              <button className="btn btn--primary btn--block" onClick={joinFamily}>加入家庭</button>
              <button className="btn btn--ghost btn--block" onClick={() => setFamilySetupMode(null)} style={{ marginTop: 8 }}>返回</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 添加宝宝页 ---------- */
  if (view === 'baby-edit') {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="form">
          <div className="form__head">
            <div className="form__logo"><Baby className="icon icon--lg" /></div>
            <h2 className="form__title">{babies.length > 0 ? '添加新宝宝' : '添加第一个宝宝'}</h2>
            <p className="form__sub">{family ? `家庭：${family.family_name}` : '记录成长的第一步'}</p>
          </div>
          {error && <div className="err"><AlertCircle className="icon icon--sm" />{error}</div>}
          <div className="field">
            <label className="field__label">昵称</label>
            <input className="input" placeholder="给宝宝起个名字吧" value={form.name} onChange={set('name')} />
          </div>
          <div className="field">
            <label className="field__label">性别</label>
            <div className="seg">
              <button type="button" className={`seg__btn seg__btn--boy ${form.gender === 'boy' ? 'seg__btn--on' : ''}`} onClick={() => setForm({ ...form, gender: 'boy' })}>👦 男宝</button>
              <button type="button" className={`seg__btn seg__btn--girl ${form.gender === 'girl' ? 'seg__btn--on' : ''}`} onClick={() => setForm({ ...form, gender: 'girl' })}>👧 女宝</button>
            </div>
          </div>
          <div className="field">
            <label className="field__label">出生日期</label>
            <input type="date" className="input" value={form.birthday} onChange={set('birthday')} />
          </div>
          <div className="field field__row">
            <div><label className="field__label">身高 (cm)</label><input type="number" className="input" placeholder="0.0" value={form.height} onChange={set('height')} /></div>
            <div><label className="field__label">体重 (kg)</label><input type="number" className="input" placeholder="0.0" value={form.weight} onChange={set('weight')} /></div>
          </div>
          <button className="btn btn--primary btn--block" onClick={addBaby}>
            <Save className="icon icon--sm" />{babies.length > 0 ? '添加宝宝' : '保存并开始记录'}
          </button>
          {babies.length > 0 && (
            <button className="btn btn--ghost btn--block" onClick={() => {
              if (babies.length > 0) { _currentBabyId = babies[0].baby_id; setCurrentBabyId(babies[0].baby_id); fetchDashboard(); }
            }} style={{ marginTop: 8 }}>跳过，查看已有宝宝</button>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 旧版：编辑档案（兼容） ---------- */

  /* ---------- 编辑宝宝 ---------- */
  if (view === 'edit') {
    const handleEditBaby = async () => {
      if (!form.name || !form.birthday) return alert('请填写昵称和出生日期');
      try {
        setError(null);
        const res = await apiFetch(`${API_BASE}/family/babies/${currentBabyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, height: parseFloat(form.height) || 0, weight: parseFloat(form.weight) || 0 }),
        });
        if (!res.ok) throw new Error(`更新失败 (${res.status})`);
        await fetchDashboard();
      } catch (e) { setError('更新失败：' + (e.message || '请确认后端已启动')); }
    };

    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="form">
          <div className="form__head">
            <div className="form__logo"><Baby className="icon icon--lg" /></div>
            <h2 className="form__title">编辑宝宝档案</h2>
            <p className="form__sub">{form.name || '更新成长信息'}</p>
          </div>
          {error && <div className="err"><AlertCircle className="icon icon--sm" />{error}</div>}
          <div className="field">
            <label className="field__label">昵称</label>
            <input className="input" placeholder="给宝宝起个名字吧" value={form.name} onChange={set('name')} />
          </div>
          <div className="field">
            <label className="field__label">性别</label>
            <div className="seg">
              <button type="button" className={`seg__btn seg__btn--boy ${form.gender === 'boy' ? 'seg__btn--on' : ''}`} onClick={() => setForm({ ...form, gender: 'boy' })}>👦 男宝</button>
              <button type="button" className={`seg__btn seg__btn--girl ${form.gender === 'girl' ? 'seg__btn--on' : ''}`} onClick={() => setForm({ ...form, gender: 'girl' })}>👧 女宝</button>
            </div>
          </div>
          <div className="field">
            <label className="field__label">出生日期</label>
            <input type="date" className="input" value={form.birthday} onChange={set('birthday')} />
          </div>
          <div className="field field__row">
            <div><label className="field__label">身高 (cm)</label><input type="number" className="input" placeholder="0.0" value={form.height} onChange={set('height')} /></div>
            <div><label className="field__label">体重 (kg)</label><input type="number" className="input" placeholder="0.0" value={form.weight} onChange={set('weight')} /></div>
          </div>
          <button className="btn btn--primary btn--block" onClick={handleEditBaby}><Save className="icon icon--sm" />保存修改</button>
          <button className="btn btn--ghost btn--block" onClick={() => { fetchDashboard(); }} style={{ marginTop: 8 }}>取消</button>
        </div>
      </div>
    );
  }

  /* ---------- 仪表盘 ---------- */
  if (!data) {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="loading"><div className="spinner" /><p className="loading__txt">正在加载成长数据…</p></div>
      </div>
    );
  }
  const { profile, months, growthStandard: g, isWeightNormal, isHeightNormal, weightStatus: wStat, heightStatus: hStat, feedingAdvice: f, activities, music = [], stageTip: st = {} } = data;
  const stFeatured = st.featured || null;
  const stCurrent = st.current || [];
  const stAfter = st.after || null;
  const allOk = isWeightNormal && isHeightNormal;
  const hPct = pct(profile.height, g.minH, g.maxH);
  const wPct = pct(profile.weight, g.minW, g.maxW);

  // 综合评估文案：分别列出偏离的指标（偏矮/偏高、超轻/略轻/略重/超重）
  const growthIssues = [];
  if (hStat !== 'normal') growthIssues.push('身高' + HEIGHT_STATUS_TEXT[hStat]);
  if (wStat !== 'normal') growthIssues.push('体重' + WEIGHT_STATUS_TEXT[wStat]);
  const assessText = allOk
    ? '身高与体重均落在同龄参考区间内，发育节奏良好。'
    : `${growthIssues.join('、')}，偏离同龄参考区间，建议结合喂养与睡眠再观察两周。`;

  const copyFamilyId = () => {
    if (family) {
      navigator.clipboard.writeText(family.family_id).then(() => alert('家庭 ID 已复制！')).catch(() => alert('家庭 ID: ' + family.family_id));
    }
  };

  return (
    <div className="app">
      <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />

      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <div className="brand__logo"><Baby className="icon icon--lg" /></div>
            <div>
              <div className="brand__name">{profile.name}的成长记录</div>
              <div className="brand__meta">{months} 个月大 · {profile.gender === 'boy' ? '男宝' : '女宝'}</div>
            </div>
          </div>
          <div className="topbar__actions">
            {/* 宝宝切换器 */}
            {babies.length > 1 && (
              <div className="baby-switcher">
                {babies.map(b => (
                  <div key={b.baby_id} className="baby-switcher__item">
                    <button className={`baby-switcher__btn ${b.baby_id === currentBabyId ? 'baby-switcher__btn--on' : ''}`}
                      onClick={() => switchBaby(b.baby_id)}>
                      {b.name}
                    </button>
                    <button className="baby-switcher__del" onClick={(e) => { e.stopPropagation(); deleteBaby(b.baby_id, b.name); }} title={`删除 ${b.name}`}>
                      <Trash2 className="icon icon--xs" />
                    </button>
                  </div>
                ))}
                <button className="baby-switcher__btn baby-switcher__btn--add" onClick={() => { setForm({ name: '', gender: 'boy', birthday: '', height: '', weight: '' }); setView('baby-edit'); }} title="添加宝宝">
                  <Plus className="icon icon--xs" />
                </button>
              </div>
            )}
            {babies.length <= 1 && (
              <button className="btn btn--ghost btn--sm" onClick={() => { setForm({ name: '', gender: 'boy', birthday: '', height: '', weight: '' }); setView('baby-edit'); }}>
                <Plus className="icon icon--xs" />添加宝宝
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => { setForm({ name: profile.name, gender: profile.gender, birthday: profile.birthday, height: String(profile.height), weight: String(profile.weight) }); setView('edit'); }}><Pencil className="icon icon--xs" />编辑</button>
            {babies.length > 1 && (
              <button className="btn btn--ghost" style={{ color: 'var(--red)' }} onClick={() => deleteBaby(currentBabyId, profile.name)}>
                <Trash2 className="icon icon--xs" />删除
              </button>
            )}
          </div>
        </div>
        {/* 家庭信息栏 */}
        {family && (
          <div className="family-bar">
            <div className="family-bar__inner">
              <span className="family-bar__name">🏠 {family.family_name}</span>
              <span className="family-bar__id" onClick={copyFamilyId} title="点击复制家庭 ID">
                ID: <b>{family.family_id}</b>
              </span>
              <div className="family-bar__members">
                {(() => {
                  const me = family.members?.find((m) => m.user_id === USER_ID);
                  const others = (family.members || []).filter((m) => m.user_id !== USER_ID);
                  const meName = me ? (me.nickname || (me.role === 'creator' ? '创建者' : '成员')) : '我';
                  return (
                    <>
                      {/* 自己（带编辑按钮） */}
                      <button
                        type="button"
                        className="member-chip member-chip--me"
                        title="点击修改我的昵称"
                        onClick={() => me && setNickModal({ open: true, nickname: me.nickname || '' })}
                      >
                        <span className="member-chip__me">自己</span>
                        <span className="member-chip__name">{meName}</span>
                        <Pencil className="icon icon--xs" />
                      </button>
                      {/* +x 展开其他成员 */}
                      <div className="member-more">
                        <button
                          type="button"
                          className="member-chip member-chip--more"
                          onClick={() => setMembersOpen((v) => !v)}
                          aria-expanded={membersOpen}
                          title="查看其他家庭成员"
                        >
                          +{others.length}
                        </button>
                        {membersOpen && (
                          <div className="member-more__menu">
                            {family.members?.map((m) => {
                              const name = m.nickname || (m.role === 'creator' ? '创建者' : '成员');
                              const isMe = m.user_id === USER_ID;
                              return (
                                <div key={m.user_id} className={`member-more__item ${isMe ? 'is-me' : ''}`}>
                                  {isMe && <span className="member-more__tag">我</span>}
                                  {name}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <button className="family-bar__leave" onClick={leaveFamily} title="退出当前家庭">退出</button>
            </div>
          </div>
        )}
      </header>

      <div className="wrap">
        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><Sparkles className="icon icon--sm" /></span>
            <h2 className="section__title">发育概况</h2>
            <span className={`section__status ${allOk ? 'is-ok' : 'is-warn'}`}>
              {allOk ? <Check className="icon icon--xs" /> : <AlertCircle className="icon icon--xs" />}
              {allOk ? '发育良好' : '需关注'}
            </span>
            <button className={`section__toggle ${devOpen ? 'is-open' : ''}`} onClick={() => setDevOpen(v => !v)} aria-expanded={devOpen}>
              {devOpen ? '收起' : '详情'}
              <ChevronDown className="icon icon--xs" />
            </button>
          </div>
          <div className="assess">
            <span className="assess__ico">{allOk ? <Check className="icon icon--lg" /> : <AlertCircle className="icon icon--lg" />}</span>
            <div className="assess__body">
              <div className="assess__k">综合评估</div>
              <div className="assess__sub">{profile.name} 已经 <b>{months}</b> 个月啦</div>
              <div className="assess__text">{assessText}</div>
            </div>
            <div className="assess__badges">
              <Badge ok={growthOk(hStat)}>身高{HEIGHT_STATUS_TEXT[hStat]}</Badge>
              <Badge ok={growthOk(wStat)}>体重{WEIGHT_STATUS_TEXT[wStat]}</Badge>
            </div>
          </div>

          {devOpen && (() => {
            const sortedG = [...growthRecords].sort((a, b) => a.date.localeCompare(b.date));
            const latestG = sortedG[sortedG.length - 1];
            const hv = (latestG && latestG.height) ? latestG.height : profile.height;
            const wv = (latestG && latestG.weight) ? latestG.weight : profile.weight;
            const hPct2 = pct(hv, g.minH, g.maxH);
            const wPct2 = pct(wv, g.minW, g.maxW);
            return (
          <div className="dev-detail">
            {/* 最新身高体重：复用收起的 stat 卡片，缩小 */}
            <div className="grid2 dev-grid2">
              <div className="stat stat--teal">
                <div className="stat__head"><span className="stat__label"><span className="stat__ico"><Ruler className="icon icon--sm" /></span>身高</span><Badge ok={growthOk(hStat)}>{HEIGHT_STATUS_TEXT[hStat]}</Badge></div>
                <div><span className="stat__value">{hv}</span><span className="stat__unit">cm</span></div>
                <div className="bar"><div className="bar__fill" style={{ '--w': `${hPct2}%` }} /></div>
                <div className="bar__scale"><span>{g.minH}</span><span>参考区间</span><span>{g.maxH}</span></div>
              </div>
              <div className="stat stat--sky">
                <div className="stat__head"><span className="stat__label"><span className="stat__ico"><Scale className="icon icon--sm" /></span>体重</span><Badge ok={growthOk(wStat)}>{WEIGHT_STATUS_TEXT[wStat]}</Badge></div>
                <div><span className="stat__value">{wv}</span><span className="stat__unit">kg</span></div>
                <div className="bar"><div className="bar__fill" style={{ '--w': `${wPct2}%` }} /></div>
                <div className="bar__scale"><span>{g.minW}</span><span>参考区间</span><span>{g.maxW}</span></div>
              </div>
            </div>

            {/* 录入 / 编辑表单 */}
            <div className="growth__form">
              <div className="growth__form-row">
                <div className="feed__log-field">
                  <label>日期</label>
                  <input type="date" className="input input--sm" value={growthDraft.date} onChange={(e) => setGrowthDraft({ ...growthDraft, date: e.target.value })} />
                </div>
                <div className="feed__log-field">
                  <label>身高(cm)</label>
                  <input type="number" step="0.1" className="input input--sm" placeholder="如 68.5" value={growthDraft.height} onChange={(e) => setGrowthDraft({ ...growthDraft, height: e.target.value })} />
                </div>
                <div className="feed__log-field">
                  <label>体重(kg)</label>
                  <input type="number" step="0.01" className="input input--sm" placeholder="如 8.2" value={growthDraft.weight} onChange={(e) => setGrowthDraft({ ...growthDraft, weight: e.target.value })} />
                </div>
              </div>
              <div className="growth__form-row">
                <div className="feed__log-field feed__log-field--note">
                  <label>备注（可选）</label>
                  <input type="text" className="input input--sm" placeholder="如：体检 / 在家测" value={growthDraft.note} onChange={(e) => setGrowthDraft({ ...growthDraft, note: e.target.value })} />
                </div>
                {editingGrowthId ? (
                  <>
                    <button type="button" className="btn btn--primary btn--sm growth__add" onClick={addGrowth}><Save className="icon icon--xs" />更新</button>
                    <button type="button" className="btn btn--ghost btn--sm growth__add" onClick={cancelEditGrowth}>取消</button>
                  </>
                ) : (
                  <button type="button" className="btn btn--primary btn--sm growth__add" onClick={addGrowth}><Plus className="icon icon--xs" />保存</button>
                )}
              </div>
            </div>

            {/* 指标切换 + 曲线 */}
            {growthRecords.length > 0 ? (
              <>
                <div className="growth__metric">
                  <button type="button" className={`growth__metric-btn ${growthMetric === 'weight' ? 'is-on' : ''}`} onClick={() => setGrowthMetric('weight')}>体重</button>
                  <button type="button" className={`growth__metric-btn ${growthMetric === 'height' ? 'is-on' : ''}`} onClick={() => setGrowthMetric('height')}>身高</button>
                </div>
                <GrowthChart records={growthRecords} metric={growthMetric} gender={profile.gender} birthday={profile.birthday} />
                <div className="growth__legend">
                  <span className="growth__lg growth__lg--baby"><i />宝宝 {growthMetric === 'weight' ? '体重' : '身高'}</span>
                  <span className="growth__lg growth__lg--intl"><i />国际参考 (WHO)</span>
                  <span className="growth__lg growth__lg--cn"><i />中国参考</span>
                </div>
                <p className="growth__note">曲线为参考中位数（P50）趋势线，仅作直观对比；临床评估请以医生百分位 / z 评分结论为准。</p>
              </>
            ) : (
              <div className="growth__empty">还没有身高体重记录，添加一条就能看到成长曲线啦～</div>
            )}

            {/* 历史记录：默认收起，可展开 */}
            {growthRecords.length > 0 && (
              <div className="growth__history">
                <button type="button" className={`growth__history-toggle ${growthHistoryOpen ? 'is-open' : ''}`} onClick={() => setGrowthHistoryOpen(v => !v)} aria-expanded={growthHistoryOpen}>
                  历史记录（{growthRecords.length} 条）
                  <span className="growth__history-hint">{growthHistoryOpen ? '收起' : '展开'}</span>
                  <ChevronDown className="icon icon--xs growth__history-chev" />
                </button>
                {growthHistoryOpen && (
                  <div className="growth__list">
                    {[...growthRecords].sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                      <div key={r.id} className={`growth__row ${editingGrowthId === r.id ? 'is-editing' : ''}`}>
                        <span className="growth__row-date">{r.date}</span>
                        <span className="growth__row-v">{r.height ? r.height + 'cm' : '—'}</span>
                        <span className="growth__row-v">{r.weight ? r.weight + 'kg' : '—'}</span>
                        {r.note && <span className="growth__row-note">{r.note}</span>}
                        <button className="growth__row-edit" onClick={() => editGrowth(r)} aria-label="编辑"><Pencil className="icon icon--xs" /></button>
                        <button className="growth__row-del" onClick={() => delGrowth(r.id)} aria-label="删除"><Trash2 className="icon icon--xs" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
            );
          })()}
        </Reveal>

        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--amber"><Sparkles className="icon icon--sm" /></span>
            <h2 className="section__title">成长阶段提醒</h2>
          </div>
          {/* 正在经历的阶段：仅罗列名字，点击弹出详情 */}
          {stCurrent.length > 0 && (
            <div className="stage-now">
              <div className="stage-now__label"><Bell className="icon icon--xs" />正在经历</div>
              <div className="stage-now__chips">
                {stCurrent.map(c => (
                  <button type="button" key={c.key} className="stage-now__chip" onClick={() => setStageModal(c)}>{c.title}</button>
                ))}
              </div>
            </div>
          )}
          {/* 阶段提醒：即将进入的发育阶段科普 */}
          {stFeatured && stFeatured.status === 'upcoming' && (
            <div className="stage-tip">
              <div className="stage-tip__head">
                <Sparkles className="icon icon--sm stage-tip__ico" />
                <span className="stage-tip__tag">{stFeatured.monthsAway > 0 ? `即将进入 · 约 ${stFeatured.monthsAway} 个月后` : '即将进入'}</span>
                <h3 className="stage-tip__title">{stFeatured.title}</h3>
              </div>
              <p className="stage-tip__why"><b>原理：</b>{stFeatured.principle}</p>
              <div className="stage-tip__cols">
                <div className="stage-tip__col">
                  <div className="stage-tip__k"><Bell className="icon icon--xs" />信号提醒</div>
                  <ul className="stage-tip__list">
                    {stFeatured.signs.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="stage-tip__col">
                  <div className="stage-tip__k"><Lightbulb className="icon icon--xs" />陪伴建议</div>
                  <ul className="stage-tip__list">
                    {stFeatured.advice.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>
              <div className="stage-tip__foot">
                <span className="stage-tip__src">资料来源：{stFeatured.sources}</span>
                {stAfter && <span className="stage-tip__next">之后将迎来：{stAfter}</span>}
              </div>
            </div>
          )}
          {/* 暂无即将进入的阶段 */}
          {(!stFeatured || stFeatured.status !== 'upcoming') && (
            <div className="stage-tip stage-tip--muted">
              <div className="stage-tip__head">
                <Sparkles className="icon icon--sm stage-tip__ico" />
                <h3 className="stage-tip__title">{stCurrent.length > 0 ? '暂无即将进入的阶段' : '成长新阶段'}</h3>
              </div>
              <p className="stage-tip__why">
                {stCurrent.length > 0
                  ? '宝宝当前正处于上方所列阶段，点击名字可查看原理、信号提醒与陪伴建议。'
                  : '宝宝已进入幼儿期，更多探索与成长的惊喜在路上，记得定期记录身高体重与日常哦。'}
              </p>
            </div>
          )}
        </Reveal>



        {/* 宝宝的一天 · 横向时间轴（置于今日记录上方） */}
        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--violet"><Sparkles className="icon icon--sm" /></span>
            <h2 className="section__title">宝宝的一天</h2>
          </div>
          <div className="daytime-canvas">
            <div className="daytime">
              {(() => {
                const items = [...feedRecords].sort((a, b) => a.time.localeCompare(b.time));
                if (items.length === 0) {
                  return <div className="daytime__empty">今天还没有记录，添加一个喂养 / 换尿布 / 睡觉吧～</div>;
                }
                return (
                  <div className="daytime__inner">
                    {items.map((r, i) => {
                      const map = {
                        milk: { emoji: '🍼', cls: 'milk', typeLabel: '喝奶', amount: r.amount ? `${r.amount}ml` : '' },
                        solids: { emoji: '🥣', cls: 'solids', typeLabel: '辅食', amount: r.amount ? `${r.amount}g` : '' },
                        diaper: { emoji: r.kind === 'poop' ? '💩' : r.kind === 'both' ? '💩💧' : '💧', cls: 'diaper', typeLabel: '换尿布', amount: '' },
                        sleep: { emoji: '😴', cls: 'sleep', typeLabel: '睡觉', amount: r.duration ? fmtDur(r.duration) : '' },
                      };
                      const meta = map[r.type] || { emoji: '⏰', cls: '', typeLabel: r.type || '记录', amount: '' };
                      const sub = r.type === 'solids' && r.foodGroups ? r.foodGroups.split(',').filter(Boolean).join('、') : (r.note || '');
                      const subTitle = meta.amount ? meta.amount : meta.typeLabel;
                      const pos = i % 2 === 0 ? 'up' : 'down';
                      const sleepEnd = r.type === 'sleep' && r.duration > 0 ? addMinutesHM(r.time, r.duration) : '';
                      const sleepBarW = sleepEnd ? Math.max(36, Math.min(r.duration * 1.2, 320)) : 0;
                      return (
                        <div key={r.id} className={`daytime__item daytime__item--${pos} daytime__item--${meta.cls}`}>
                          {sleepEnd && (
                            <div className="daytime__sleep-range" style={{ width: `${sleepBarW}px` }}>
                              <span className="daytime__sleep-end">{sleepEnd}</span>
                            </div>
                          )}
                          <span className="daytime__dot" />
                          <div className="daytime__card">
                            <div className="daytime__top">
                              <span className="daytime__icon">{meta.emoji}</span>
                              <div className="daytime__title">
                                <div className="daytime__time">{sleepEnd ? `${r.time} → ${sleepEnd}` : r.time}</div>
                                <div className="daytime__amount">{subTitle}</div>
                              </div>
                            </div>
                            {sub && <div className="daytime__note">{sub}</div>}
                            <div className="daytime__ops">
                              <button className="daytime__op" onClick={(e) => { e.stopPropagation(); startEdit(r); }} aria-label="编辑"><Pencil className="icon icon--xs" /></button>
                              <button className="daytime__op daytime__op--del" onClick={(e) => { e.stopPropagation(); deleteFeedRecord(r.id); }} aria-label="删除"><Trash2 className="icon icon--xs" /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </Reveal>

        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--honey"><Milk className="icon icon--sm" /></span>
            <h2 className="section__title">今日记录</h2>
          </div>
          <div className="feed">
            {/* 喂养记录录入 */}
            <div className="feed__log">
              <div className="feed__log-form">
                {/* 类型 tab：喂养 / 换尿布 / 睡觉，置于最上方 */}
                <div className="feed__log-tabs">
                  <button type="button" className={`feed__log-tab ${recordTab === 'feed' ? 'feed__log-tab--on' : ''}`} onClick={() => { setRecordTab('feed'); if (feedForm.type !== 'milk' && feedForm.type !== 'solids') setFeedForm({ ...feedForm, type: 'milk' }); }}>
                    <Milk className="icon icon--xs" />喂养
                  </button>
                  <button type="button" className={`feed__log-tab ${recordTab === 'diaper' ? 'feed__log-tab--on' : ''}`} onClick={() => { setRecordTab('diaper'); setFeedForm({ ...feedForm, type: 'diaper' }); }}>
                    <Baby className="icon icon--xs" />换尿布
                  </button>
                  <button type="button" className={`feed__log-tab ${recordTab === 'sleep' ? 'feed__log-tab--on' : ''}`} onClick={() => { setRecordTab('sleep'); setFeedForm({ ...feedForm, type: 'sleep' }); }}>
                    <Moon className="icon icon--xs" />睡觉
                  </button>
                </div>
                {feedForm.type !== 'sleep' && (
                  <div className="feed__log-field">
                    <label>时间</label>
                    <TimePicker value={feedForm.time} onChange={(v) => setFeedForm({ ...feedForm, time: v })} />
                  </div>
                )}
                {feedForm.type === 'sleep' && (
                  <div className="feed__log-sleep">
                    <div className="feed__log-field">
                      <label>开始时间</label>
                      <TimePicker value={feedForm.time} onChange={(v) => setFeedForm({ ...feedForm, time: v })} />
                    </div>
                    <div className="feed__log-field">
                      <label>结束时间（可选）</label>
                      <TimePicker value={feedForm.wakeTime || ''} onChange={(v) => setFeedForm({ ...feedForm, wakeTime: v })} />
                    </div>
                  </div>
                )}
                {(feedForm.type === 'milk' || feedForm.type === 'solids') && (
                  <div className="feed__log-field">
                    <label>喂养量({feedForm.type === 'milk' ? 'ml' : 'g'})</label>
                    <input type="number" className="input input--sm" placeholder="0" value={feedForm.amount} onChange={(e) => setFeedForm({ ...feedForm, amount: e.target.value })} />
                  </div>
                )}
                {/* 喂养 tab 内：奶 / 辅食 细分 */}
                {recordTab === 'feed' && (
                  <div className="feed__log-field">
                    <label>喂养种类</label>
                    <div className="feed__log-seg">
                      <button type="button" className={`feed__log-seg-btn ${feedForm.type === 'milk' ? 'feed__log-seg-btn--on' : ''}`} onClick={() => setFeedForm({ ...feedForm, type: 'milk' })}>奶</button>
                      <button type="button" className={`feed__log-seg-btn ${feedForm.type === 'solids' ? 'feed__log-seg-btn--on' : ''}`} onClick={() => setFeedForm({ ...feedForm, type: 'solids' })}>辅食</button>
                    </div>
                  </div>
                )}
                {feedForm.type === 'solids' && (
                  <div className="feed__log-field feed__log-field--note">
                    <label>食物种类（按 WHO 标准评估营养多样性）</label>
                    <div className="feed__foodgroups">
                      {FOOD_GROUPS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={`feed__chip ${feedForm.foodGroups.includes(g) ? 'feed__chip--on' : ''}`}
                          onClick={() => toggleFoodGroup(g)}
                        >
                          {feedForm.foodGroups.includes(g) && <Check className="icon icon--xs" />}
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {feedForm.type === 'diaper' && (
                  <div className="feed__log-field feed__log-field--note">
                    <label>换的是</label>
                    <div className="feed__chips">
                      {[{ v: 'pee', l: '💧', t: '尿' }, { v: 'poop', l: '💩', t: '屎' }, { v: 'both', l: '💩💧', t: '都有' }].map((o) => (
                        <button key={o.v} type="button" title={o.t}
                          className={`feed__chip feed__chip--emoji ${feedForm.kind === o.v ? 'feed__chip--on' : ''}`}
                          onClick={() => setFeedForm({ ...feedForm, kind: o.v })}>{o.l}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="feed__log-field feed__log-field--note">
                  <label>备注</label>
                  <input type="text" className="input input--sm" placeholder="如：晨奶" value={feedForm.note} onChange={(e) => setFeedForm({ ...feedForm, note: e.target.value })} />
                </div>
                {editingId ? (
                  <>
                    <button className="btn btn--primary btn--sm" onClick={addFeedRecord} disabled={feedLoading}>
                      {feedLoading ? <Loader2 className="icon icon--xs animate-spin" /> : <Save className="icon icon--xs" />}
                      更新
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={cancelEdit}>取消</button>
                  </>
                ) : (
                  <button className="btn btn--primary btn--sm" onClick={addFeedRecord} disabled={feedLoading}>
                    {feedLoading ? <Loader2 className="icon icon--xs animate-spin" /> : <Plus className="icon icon--xs" />}
                    添加
                  </button>
                )}
              </div>
            </div>

            {/* 喂养建议（仅选中「喂养」tab 时显示） */}
            {recordTab === 'feed' && (
              <div className="feed__advice">
                <div className="feed__advice-title"><Sparkles className="icon icon--xs" /> 喂养建议</div>
                <div className="feed__advice-card">
                  {(f.stage || f.videoTip) && (
                    <div className="feed__stage-row">
                      {f.stage && (
                        <div className="feed__block">
                          <span className="feed__tile feed__tile--honey"><Sparkles className="icon" /></span>
                          <div><div className="feed__k">所属阶段</div><div className="feed__v">{f.stage}</div></div>
                        </div>
                      )}
                      {f.videoTip && (
                        <div className="feed__block">
                          <span className="feed__tile feed__tile--honey"><Lightbulb className="icon" /></span>
                          <div><div className="feed__k">提示</div><div className="feed__v">{f.videoTip}</div></div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="feed__body">
                    <div className="feed__block">
                      <span className="feed__tile feed__tile--sky"><Milk className="icon" /></span>
                      <div><div className="feed__k">奶量建议</div><div className="feed__v">{f.milk}</div></div>
                    </div>
                    <div className="feed__block">
                      <span className="feed__tile feed__tile--green"><Utensils className="icon" /></span>
                      <div>
                        <div className="feed__k">辅食安排</div>
                        <div className="feed__v">{f.solids === '不需要' ? '暂未开始添加辅食' : `每餐约 ${f.solidAmount}`}</div>
                        {f.solids !== '不需要' && <div className="feed__chips">{f.types.map((t, i) => <span key={i}>{t}</span>)}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="feed__interval">
                    <Clock className="icon icon--sm" />
                    <span className="feed__interval-text">{f.feedingInterval}</span>
                  </div>
                  <div className="feed__foot">
                    <button className="btn btn--coral btn--block" onClick={() => setModal({ open: true, title: `喂养演示 · ${f.stage}`, src: f.videoUrl || '' })}><Video className="icon icon--xs" />查看本阶段喂养演示视频</button>
                  </div>
                </div>
              </div>
            )}

            {/* 喂养评估 */}
            {feedEval && recordTab === 'feed' && (
              <div className={`feed__eval feed__eval--${feedEval.status}`}>
                <div className="feed__eval-body">
                  <div className="feed__eval-title">喂养评估</div>
                  <div className="feed__eval-msg">{feedEval.message}</div>
                  <div className="feed__eval-stats">
                    <span className={`feed__eval-stat feed__eval-stat--${feedEval.milkStatus}`}>
                      <Milk className="icon icon--xs" />
                      奶量 <b>{feedEval.totalMilk.toFixed(0)}ml</b>
                      {feedEval.targetMilk > 0 && (
                        <span className="feed__eval-target">
                          / 建议 {feedEval.effectiveTargetMilk.toFixed(0)}ml
                          {feedEval.milkDisplaced && '（已随辅食下调）'}
                        </span>
                      )}
                    </span>
                    {feedEval.totalSolids > 0 && (
                      <span className={`feed__eval-stat feed__eval-stat--${feedEval.solidsStatus}`}>
                        <Utensils className="icon icon--xs" />
                        辅食 <b>{feedEval.totalSolids.toFixed(0)}g</b>
                      </span>
                    )}
                    {feedEval.feedCount > 0 && (
                      <span className="feed__eval-stat">
                        <Clock className="icon icon--xs" />
                        喂养 <b>{feedEval.feedCount}</b> 次
                        {feedEval.avgInterval && <span className="feed__eval-target">/ 均隔 {feedEval.avgInterval}</span>}
                      </span>
                    )}
                  </div>

                  {/* 辅食三项评估（WHO 口径：餐次 + 种类 + 单餐量） */}
                  {feedEval.solidsMealCount > 0 && (
                    <div className="feed__eval-solids">
                      <div className="feed__eval-solids-item">
                        <span className="feed__eval-solids-label">餐次</span>
                        <span className={`feed__eval-solids-val ${feedEval.solidsMealCount >= feedEval.targetSolidsMeals ? 'is-ok' : 'is-bad'}`}>
                          {feedEval.solidsMealCount}/{feedEval.targetSolidsMeals}
                        </span>
                      </div>
                      <div className="feed__eval-solids-item">
                        <span className="feed__eval-solids-label">种类</span>
                        <span className={`feed__eval-solids-val ${feedEval.solidsDiversity >= feedEval.targetDiversity ? 'is-ok' : (feedEval.solidsGroupsLogged ? 'is-bad' : '')}`}>
                          {feedEval.solidsDiversity}/{feedEval.targetDiversity}
                        </span>
                      </div>
                      <div className="feed__eval-solids-item">
                        <span className="feed__eval-solids-label">单餐量</span>
                        <span className="feed__eval-solids-val">{feedEval.solidsAmountPerMeal.toFixed(0)}g</span>
                      </div>
                    </div>
                  )}
                  {/* 今日喂养水平标记 */}
                  <div className="feed__level">
                    <span className={`feed__level-badge feed__level-badge--${feedEval.status}`}>
                      {feedEval.status === 'good' ? '✅ 喂养量充足' : feedEval.status === 'low' ? '⚠️ 喂养量不足' : '📈 喂养量超出'}
                    </span>
                    <button className="btn btn--ghost btn--sm" onClick={openFeedingCalendar} style={{ marginLeft: 'auto' }}>
                      <Calendar className="icon icon--xs" />喂养日历
                    </button>
                  </div>
                  {feedEval.suggestions && feedEval.suggestions.length > 0 && (
                    <div className="feed__eval-tips">
                      <Sparkles className="icon icon--xs" />
                      <div className="feed__eval-tips-list">
                        {feedEval.suggestions.map((s, i) => (
                          <div key={i} className="feed__eval-tip">{s}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </Reveal>

        {/* 每日照护清单 */}
        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--primary"><ListChecks className="icon icon--sm" /></span>
            <h2 className="section__title">今日照护清单</h2>
            {checklist.length > 0 && (
              <span className="checklist__progress">
                {checklist.filter(i => i.checked).length}/{checklist.length}
              </span>
            )}
            <button className="btn btn--ghost btn--sm checklist__cal-btn" onClick={() => { setCalendarOpen(true); setCalendarDetail(null); }}>
              <Calendar className="icon icon--xs" /> 查看照护日历
            </button>
          </div>
          <div className="checklist">
            <div className="checklist__bar">
              <div
                className="checklist__bar-fill"
                style={{ width: `${checklist.length > 0 ? (checklist.filter(i => i.checked).length / checklist.length * 100) : 0}%` }}
              />
            </div>
            <div className="checklist__list">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className={`checklist__item ${item.checked ? 'is-checked' : ''}`}
                  onClick={() => toggleChecklistItem(item.id, !item.checked)}
                >
                  <span className="checklist__check">
                    {item.checked && <Check className="icon icon--xs" />}
                  </span>
                  <span className="checklist__icon">{CHECKLIST_ICONS[item.icon] || <Check className="icon icon--sm" />}</span>
                  <div className="checklist__content">
                    <span className="checklist__label">{item.label}</span>
                    {item.desc && <span className="checklist__desc">{item.desc}</span>}
                  </div>
                </div>
              ))}
            </div>
            {checklist.length > 0 && checklist.every(i => i.checked) && (
              <div className="checklist__done">
                <Sparkles className="icon icon--xs" /> 今日照护全部完成，辛苦啦！
              </div>
            )}
          </div>
        </Reveal>

        {/* 生病模式：体温记录 + 动态就医建议 */}
        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--rose"><Thermometer className="icon icon--sm" /></span>
            <h2 className="section__title">生病模式</h2>
            {sickMode && (
              <button
                type="button"
                className="sick-toggle is-on"
                onClick={() => persistSickMode(!sickMode)}
                aria-pressed={sickMode}
              >
                <span className="sick-toggle__track"><span className="sick-toggle__dot" /></span>
                已开启
              </button>
            )}
            <button className="btn btn--ghost btn--sm sick-calendar-btn" onClick={openSicknessCalendar}><Calendar className="icon icon--xs" /> 查看生病日历</button>
          </div>

          {!sickMode ? (
            <div className="sick__hint">
              <p>宝宝不舒服时开启，记录体温变化、查看是否需要就医，并每隔 4 小时提醒复测。</p>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => persistSickMode(true)}>🤒 开启生病模式</button>
            </div>
          ) : (() => {
            const latest = tempRecords[0]; // 因后端按时间倒序
            const latestTemp = latest ? latest.temp : null;
            const advice = sicknessAdvice(months, latestTemp);
            const nextAt = nextTempTime(latest ? latest.datetime : '');
            const sinceH = hoursSince(latest ? latest.datetime : '');
            return (
              <>
                {/* 动态就医建议 */}
                <div className={`sick__advice sick__advice--${advice.level}`}>
                  <div className="sick__advice-title">{advice.title}</div>
                  <div className="sick__advice-text">{advice.text}</div>
                  {latest && (
                    <div className="sick__advice-meta">
                      最近一次 {latest.datetime || '—'}：{latestTemp}°C
                      {sinceH !== null && <span> · 距现在 {sinceH < 1 ? Math.round(sinceH * 60) + ' 分钟' : sinceH.toFixed(1) + ' 小时'}</span>}
                    </div>
                  )}
                  {nextAt && <div className="sick__advice-next">建议下次复测：约 {nextAt}</div>}
                </div>

                {/* 体温曲线（置于记录功能上方、当前体温状态下方） */}
                {tempRecords.length > 0 ? (
                  <div className="sick__chart">
                    <h3 className="sick__h">体温变化曲线</h3>
                    <TempChart records={tempRecords} />
                    <div className="growth__legend">
                      <span className="growth__lg growth__lg--intl"><i />发热线 38°C</span>
                      <span className="growth__lg growth__lg--cn"><i />就医线 39.4°C</span>
                    </div>
                  </div>
                ) : (
                  <div className="sick__chart">
                    <h3 className="sick__h">体温变化曲线</h3>
                    <div className="growth__empty">记录第一次体温后，这里会画出体温变化曲线。</div>
                  </div>
                )}

                {/* 体温录入 */}
                <h3 className="sick__h">记录体温</h3>
                <div className="growth__form" id="temp-form">
                  {/* 时间 + 体温 + 症状：同一行（手机端自动堆叠） */}
                  <div className="growth__form-row growth__form-row--temp-symp">
                    <div className="feed__log-field feed__log-field--time">
                      <label>时间</label>
                      <input type="datetime-local" className="input input--sm" value={tempDraft.datetime} onChange={(e) => setTempDraft({ ...tempDraft, datetime: e.target.value })} />
                    </div>
                    <div className="feed__log-field feed__log-field--temp">
                      <label>体温(°C)</label>
                      <input type="number" step="0.1" className="input input--sm" placeholder="如 38.5" value={tempDraft.temp} onChange={(e) => setTempDraft({ ...tempDraft, temp: e.target.value })} />
                    </div>
                    <div className="feed__log-field feed__log-field--symp">
                      <label>症状</label>
                      <div className="feed__chips">
                        {TEMP_SYMPTOMS.map(s => (
                          <button key={s} type="button"
                            className={`feed__chip ${(tempDraft.symptoms || []).includes(s) ? 'feed__chip--on' : ''}`}
                            onClick={() => setTempDraft({
                              ...tempDraft,
                              symptoms: (tempDraft.symptoms || []).includes(s) ? (tempDraft.symptoms || []).filter(x => x !== s) : [...(tempDraft.symptoms || []), s],
                            })}>{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* 备注：单独一行 */}
                  <div className="growth__form-row growth__form-row--note">
                    <div className="feed__log-field feed__log-field--note">
                      <label>备注（可选）</label>
                      <input type="text" className="input input--sm" placeholder="如：已服美林" value={tempDraft.note} onChange={(e) => setTempDraft({ ...tempDraft, note: e.target.value })} />
                    </div>
                  </div>
                  {/* 操作按钮 */}
                  <div className="growth__form-row growth__form-row--actions">
                    <button type="button" className="btn btn--primary btn--sm growth__add" onClick={() => editingTempId ? updateTemp() : addTemp()}>
                      {editingTempId ? <><Check className="icon icon--xs" />保存修改</> : <><Plus className="icon icon--xs" />记录体温</>}
                    </button>
                    {editingTempId && (
                      <button type="button" className="btn btn--ghost btn--sm growth__add" onClick={cancelTempEdit}>取消</button>
                    )}
                  </div>
                </div>

                {/* 体温记录列表 */}
                {tempRecords.length > 0 && (
                  <div className="growth__list">
                    {tempRecords.map(r => (
                      <div key={r.id} className={`growth__row ${editingTempId === r.id ? 'is-editing' : ''}`}>
                        <span className="growth__row-date">{r.datetime || '—'}</span>
                        <span className={`growth__row-temp ${r.temp >= 38 ? 'is-high' : ''}`}>{r.temp}°C</span>
                        {r.note && <span className="growth__row-note">{r.note}</span>}
                        <span className="growth__row-actions">
                          <button className="growth__row-edit" onClick={() => editTemp(r)} aria-label="编辑"><Pencil className="icon icon--xs" /></button>
                          <button className="growth__row-del" onClick={() => delTemp(r.id)} aria-label="删除"><Trash2 className="icon icon--xs" /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </Reveal>

        {/* 宝宝生病护理指南：置于生病模式下方，仅生病模式开启时显示 */}
        {sickMode && (
        <Reveal className="section" delay={0.05}>
          <button
            type="button"
            className={`care-toggle ${careOpen ? 'is-open' : ''}`}
            onClick={() => setCareOpen(v => !v)}
            aria-expanded={careOpen}
          >
            <span className="section__ico section__ico--rose"><Heart className="icon icon--sm" /></span>
            <h2 className="section__title">宝宝生病护理指南</h2>
            <span className="care-toggle__hint">{careOpen ? '收起' : '点击展开'}</span>
            <ChevronDown className="icon icon--sm care-toggle__chev" />
          </button>

          {careOpen && (
            <div className="care">
              <div className="care__disclaimer">
                <AlertCircle className="icon icon--xs" />
                本指南为通用科普，<b>不能替代医生诊断</b>。用药前请遵医嘱，尤其 3 个月以下婴儿出现发热须立即就医。
              </div>

              <div className="care__block">
                <h3 className="care__h">阶段相关发烧风险</h3>
                {CARE_GUIDE.stageFever.map(it => {
                  const Ico = CARE_ICONS[it.icon] || Thermometer;
                  const open = careItem === it.key;
                  return (
                    <div className={`care-item ${open ? 'is-open' : ''}`} key={it.key}>
                      <button type="button" className="care-item__head" onClick={() => setCareItem(open ? null : it.key)} aria-expanded={open}>
                        <Ico className="icon icon--sm care-item__ico" />
                        <span className="care-item__title">{it.title}</span>
                        <ChevronDown className="icon icon--xs care-item__chev" />
                      </button>
                      {open && (
                        <ul className="care-item__list">
                          {it.points.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="care__block">
                <h3 className="care__h">常见不适护理</h3>
                {CARE_GUIDE.illnesses.map(it => {
                  const Ico = CARE_ICONS[it.icon] || Stethoscope;
                  const open = careItem === it.key;
                  return (
                    <div className={`care-item ${open ? 'is-open' : ''}`} key={it.key}>
                      <button type="button" className="care-item__head" onClick={() => setCareItem(open ? null : it.key)} aria-expanded={open}>
                        <Ico className="icon icon--sm care-item__ico" />
                        <span className="care-item__title">{it.title}</span>
                        <ChevronDown className="icon icon--xs care-item__chev" />
                      </button>
                      {open && (
                        <ul className="care-item__list">
                          {it.points.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="care__redflag">
                <h3 className="care__h care__h--warn"><AlertCircle className="icon icon--xs" />必须立即就医的红线</h3>
                <ul className="care__redlist">
                  {CARE_GUIDE.redflags.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
          )}
        </Reveal>
        )}

        {/* 照护日历弹窗 */}
        {calendarOpen && (
          <div className="cal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCalendarOpen(false); }}>
            <div className="cal-modal">
              <div className="cal-modal__sticky">
              <div className="cal-modal__head">
                <h3 className="cal-modal__title"><Calendar className="icon icon--sm" /> 照护日历</h3>
                <button className="cal-modal__close" onClick={() => { setCalendarOpen(false); setCalendarDetail(null); }}><X className="icon icon--sm" /></button>
              </div>
              </div>
              {/* 月份切换（不固定，随内容滚动） */}
              <div className="cal-month-nav">
                <button className="cal-month-nav__btn" onClick={() => changeCalendarMonth(-1)}><ChevronLeft className="icon icon--sm" /></button>
                <span className="cal-month-nav__label">{calendarDate.year}年{calendarDate.month}月</span>
                <button className="cal-month-nav__btn" onClick={() => changeCalendarMonth(1)}><ChevronRight className="icon icon--sm" /></button>
              </div>
              {/* 星期头 */}
              <div className="cal-weekdays">
                {['日','一','二','三','四','五','六'].map(d => <span key={d} className="cal-weekdays__day">{d}</span>)}
              </div>
              {/* 日期网格 */}
              {(() => {
                const { year, month } = calendarDate;
                const firstDay = new Date(year, month - 1, 1).getDay();
                const daysInMonth = new Date(year, month, 0).getDate();
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<span key={`e${i}`} className="cal-cell cal-cell--empty" />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const info = calendarData?.days?.[String(d)];
                  const isToday = dateStr === todayStr;
                  const isFuture = info?.isFuture;
                  const hasData = info?.hasData;
                  const ratio = info?.total ? info.checked / info.total : 0;
                  const allDone = info?.total && info.checked === info.total;
                  cells.push(
                    <button
                      key={d}
                      className={`cal-cell ${isToday ? 'is-today' : ''} ${allDone ? 'is-done' : ''} ${hasData ? 'has-data' : ''} ${isFuture ? 'is-future' : ''}`}
                      onClick={() => !isFuture && fetchCalendarDetail(dateStr)}
                    >
                      <span className="cal-cell__num">{d}</span>
                      {hasData && !isFuture && (
                        <span className={`cal-cell__dot ${allDone ? 'cal-cell__dot--full' : ratio > 0 ? 'cal-cell__dot--partial' : 'cal-cell__dot--none'}`} />
                      )}
                    </button>
                  );
                }
                return <div className="cal-grid">{cells}</div>;
              })()}
              {/* 图例 */}
              <div className="cal-legend">
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--full" /> 全部完成</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--partial" /> 部分完成</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--none" /> 未完成</span>
              </div>
              {/* 日期详情 */}
              {calendarDetail && (
                <div className="cal-detail">
                  <div className="cal-detail__head">
                    <span className="cal-detail__date">{calendarDetail.date.slice(5).replace('-', '月')}日 照护记录</span>
                    <span className="cal-detail__count">{calendarDetail.items.filter(i => i.checked).length}/{calendarDetail.items.length}</span>
                  </div>
                  <div className="cal-detail__list">
                    {calendarDetail.items.map(item => (
                      <div key={item.id} className={`cal-detail__item ${item.checked ? 'is-checked' : ''}`}>
                        <span className="checklist__check">{item.checked && <Check className="icon icon--xs" />}</span>
                        <span className="checklist__icon">{CHECKLIST_ICONS[item.icon] || <Check className="icon icon--sm" />}</span>
                        <span className="cal-detail__label">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 喂养日历弹窗 */}
        {feedingCalendarOpen && (
          <div className="cal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setFeedingCalendarOpen(false); }}>
            <div className="cal-modal" style={{ maxWidth: '480px' }}>
              <div className="cal-modal__sticky">
              <div className="cal-modal__head">
                <h3 className="cal-modal__title"><Milk className="icon icon--sm" /> 喂养日历</h3>
                <button className="cal-modal__close" onClick={() => setFeedingCalendarOpen(false)}><X className="icon icon--sm" /></button>
              </div>
              </div>
              {/* 月份切换（不固定，随内容滚动） */}
              <div className="cal-month-nav">
                <button className="cal-month-nav__btn" onClick={() => changeFeedingCalendarMonth(-1)}><ChevronLeft className="icon icon--sm" /></button>
                <span className="cal-month-nav__label">{feedingCalendarDate.year}年{feedingCalendarDate.month}月</span>
                <button className="cal-month-nav__btn" onClick={() => changeFeedingCalendarMonth(1)}><ChevronRight className="icon icon--sm" /></button>
              </div>

              {/* 月度统计（月报）放在最上面 */}
              {feedingStats && (
                <div className="feed-monthly">
                  <div className="feed-monthly__title">📊 {feedingCalendarDate.year}年{feedingCalendarDate.month}月喂养月报</div>
                  <div className="feed-monthly__grid">
                    <div className="feed-monthly__item feed-monthly__item--good">
                      <span className="feed-monthly__num">{feedingStats.goodDays}</span>
                      <span className="feed-monthly__label">充足天数</span>
                    </div>
                    <div className="feed-monthly__item feed-monthly__item--low">
                      <span className="feed-monthly__num">{feedingStats.lowDays}</span>
                      <span className="feed-monthly__label">不足天数</span>
                    </div>
                    <div className="feed-monthly__item feed-monthly__item--high">
                      <span className="feed-monthly__num">{feedingStats.highDays}</span>
                      <span className="feed-monthly__label">超出天数</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="cal-weekdays">
                {['日','一','二','三','四','五','六'].map(d => <span key={d} className="cal-weekdays__day">{d}</span>)}
              </div>
              {(() => {
                const { year, month } = feedingCalendarDate;
                const firstDay = new Date(year, month - 1, 1).getDay();
                const daysInMonth = new Date(year, month, 0).getDate();
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<span key={`fe${i}`} className="cal-cell cal-cell--empty" />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const info = feedingCalendarData?.days?.[String(d)];
                  const isToday = dateStr === todayStr;
                  const level = info?.level || 'empty';
                  const hasData = level === 'good' || level === 'low' || level === 'high';
                  const isSelected = feedingDetail?.date === dateStr;
                  cells.push(
                    <button
                      key={d}
                      type="button"
                      className={`cal-cell ${isToday ? 'is-today' : ''} ${level === 'future' ? 'is-future' : ''} ${hasData ? 'has-data' : ''} ${isSelected ? 'is-selected' : ''}`}
                      disabled={!hasData}
                      onClick={() => hasData && fetchFeedingDetail(dateStr)}
                      title={level === 'good' ? `奶量 ${info.totalMilk}ml` : level === 'low' ? `奶量不足 ${info.totalMilk}ml` : level === 'high' ? `奶量超出 ${info.totalMilk}ml` : level === 'future' ? '未来日期' : level === 'empty' ? '无记录' : ''}>
                      <span className="cal-cell__num">{d}</span>
                      {level !== 'future' && level !== 'empty' && (
                        <span className={`cal-cell__dot cal-cell__dot--feed-${level}`} />
                      )}
                      {level === 'empty' && (
                        <span className="cal-cell__dot cal-cell__dot--none" />
                      )}
                    </button>
                  );
                }
                return <div className="cal-grid">{cells}</div>;
              })()}
              <div className="cal-legend">
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--feed-good" /> 充足</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--feed-low" /> 不足</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--feed-high" /> 超出</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--none" /> 无记录</span>
              </div>

              {/* 某日喂养记录详情 */}
              {feedingDetail && (
                <div className="cal-detail cal-detail--feed">
                  <div className="cal-detail__head">
                    <span className="cal-detail__date">{feedingDetail.date.slice(5).replace('-', '月')}日 喂养记录</span>
                    <span className="cal-detail__count">{feedingDetail.records.length} 条</span>
                  </div>
                  {/* 当日总结 */}
                  {(() => {
                    const milkRecords = feedingDetail.records.filter(r => r.type === 'milk');
                    const solidsRecords = feedingDetail.records.filter(r => r.type === 'solids');
                    const totalMilk = milkRecords.reduce((s, r) => s + (r.amount || 0), 0);
                    const totalSolids = solidsRecords.reduce((s, r) => s + (r.amount || 0), 0);
                    const dayNum = parseInt(feedingDetail.date.split('-')[2], 10);
                    const level = feedingCalendarData?.days?.[String(dayNum)]?.level || 'empty';
                    const levelText = level === 'good' ? '充足' : level === 'low' ? '不足' : level === 'high' ? '超出' : '无记录';
                    return (
                      <div className="feed-detail__summary">
                        <div className="feed-detail__sum-item">
                          <span className="feed-detail__sum-v">{totalMilk}<small>ml</small></span>
                          <span className="feed-detail__sum-k">总奶量</span>
                        </div>
                        <div className="feed-detail__sum-item">
                          <span className="feed-detail__sum-v">{totalSolids}<small>g</small></span>
                          <span className="feed-detail__sum-k">总辅食</span>
                        </div>
                        <div className="feed-detail__sum-item">
                          <span className="feed-detail__sum-v">{feedingDetail.records.length}<small>次</small></span>
                          <span className="feed-detail__sum-k">喂养次数</span>
                        </div>
                        <span className={`feed-detail__level feed-detail__level--${level}`}>{levelText}</span>
                      </div>
                    );
                  })()}
                  {feedingDetail.records.length === 0 ? (
                    <div className="cal-detail__empty">这一天没有喂养记录</div>
                  ) : (
                    <div className="cal-detail__list">
                      {feedingDetail.records.map(r => (
                        <div key={r.id} className="feed-detail__item">
                          <div className="feed-detail__top">
                            <span className={`feed-detail__type feed-detail__type--${r.type}`}>{r.type === 'milk' ? '奶' : '辅食'}</span>
                            <span className="feed-detail__time">{r.time || '--:--'}</span>
                            <span className="feed-detail__amount">{r.amount != null ? `${r.amount}${r.type === 'milk' ? 'ml' : 'g'}` : ''}</span>
                          </div>
                          {r.foodGroups && r.type === 'solids' && (
                            <div className="feed-detail__groups">种类：{r.foodGroups}</div>
                          )}
                          {r.note && <div className="feed-detail__note">备注：{r.note}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 本月每日奶量柱形图（放在最下方） */}
              {feedingCalendarData?.dailyMilk && feedingCalendarData.dailyMilk.length > 0 && (() => {
                const dm = feedingCalendarData.dailyMilk;
                const maxMilk = Math.max(1, ...dm);
                return (
                  <div className="feed-chart">
                    <div className="feed-chart__title">📈 本月每日奶量(ml)</div>
                    <div className="feed-chart__bars">
                      {dm.map((milk, i) => {
                        const day = i + 1;
                        const lvl = feedingCalendarData.days?.[String(day)]?.level || 'empty';
                        const barH = Math.max(milk > 0 ? 4 : 2, Math.round((milk / maxMilk) * 96));
                        return (
                          <div key={day} className="feed-chart__col" title={`${day}日 ${milk}ml`}>
                            {milk > 0 && <span className="feed-chart__val">{milk}</span>}
                            <div className={`feed-chart__bar feed-chart__bar--${lvl}`} style={{ height: `${barH}px` }}></div>
                            <span className="feed-chart__x">{day}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 生病日历弹窗 */}
        {sickCalendarOpen && (
          <div className="cal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSickCalendarOpen(false); }}>
            <div className="cal-modal" style={{ maxWidth: '480px' }}>
              <div className="cal-modal__sticky">
                <div className="cal-modal__head">
                  <h3 className="cal-modal__title"><Thermometer className="icon icon--sm" /> 生病日历</h3>
                  <button className="cal-modal__close" onClick={() => setSickCalendarOpen(false)}><X className="icon icon--sm" /></button>
                </div>
                </div>
                {/* 月份切换（不固定，随内容滚动） */}
                <div className="cal-month-nav">
                  <button className="cal-month-nav__btn" onClick={() => changeSicknessCalendarMonth(-1)}><ChevronLeft className="icon icon--sm" /></button>
                  <span className="cal-month-nav__label">{sickCalendarDate.year}年{sickCalendarDate.month}月</span>
                  <button className="cal-month-nav__btn" onClick={() => changeSicknessCalendarMonth(1)}><ChevronRight className="icon icon--sm" /></button>
                </div>

              {/* 月报（顶部） */}
              {sickCalendarData && (
                <div className="feed-monthly">
                  <div className="feed-monthly__title">🌡️ {sickCalendarDate.year}年{sickCalendarDate.month}月生病月报</div>
                  <div className="feed-monthly__grid">
                    <div className="feed-monthly__item feed-monthly__item--sick">
                      <span className="feed-monthly__num">{sickCalendarData.sickDays}</span>
                      <span className="feed-monthly__label">生病天数</span>
                    </div>
                    <div className="feed-monthly__item feed-monthly__item--fever">
                      <span className="feed-monthly__num">{sickCalendarData.feverDays}</span>
                      <span className="feed-monthly__label">发烧天数</span>
                    </div>
                    <div className="feed-monthly__item feed-monthly__item--dur">
                      <span className="feed-monthly__num">{sickCalendarData.currentDuration}</span>
                      <span className="feed-monthly__label">本次持续(天)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="cal-weekdays">
                {['日','一','二','三','四','五','六'].map(d => <span key={d} className="cal-weekdays__day">{d}</span>)}
              </div>
              {(() => {
                const { year, month } = sickCalendarDate;
                const firstDay = new Date(year, month - 1, 1).getDay();
                const daysInMonth = new Date(year, month, 0).getDate();
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                const cells = [];
                for (let i = 0; i < firstDay; i++) cells.push(<span key={`se${i}`} className="cal-cell cal-cell--empty" />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const info = sickCalendarData?.days?.[String(d)];
                  const isToday = dateStr === todayStr;
                  const level = info?.level || 'empty';
                  const hasData = level === 'fever' || level === 'normal';
                  cells.push(
                    <div key={d} className={`cal-cell ${isToday ? 'is-today' : ''} ${level === 'future' ? 'is-future' : ''} ${hasData ? 'has-data' : ''}`}
                      title={level === 'fever' ? `发烧 ${info.maxTemp}°C` : level === 'normal' ? `记录体温 ${info.maxTemp}°C` : level === 'future' ? '未来日期' : '无记录'}>
                      <span className="cal-cell__num">{d}</span>
                      {level !== 'future' && level !== 'empty' && (
                        <span className={`cal-cell__dot cal-cell__dot--sick-${level}`} />
                      )}
                      {level === 'empty' && <span className="cal-cell__dot cal-cell__dot--none" />}
                    </div>
                  );
                }
                return <div className="cal-grid">{cells}</div>;
              })()}
              <div className="cal-legend">
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--sick-fever" /> 发烧</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--sick-normal" /> 记录体温</span>
                <span className="cal-legend__item"><span className="cal-cell__dot cal-cell__dot--none" /> 无记录</span>
              </div>

              {/* 生病区间与持续时长 */}
              {sickCalendarData?.episodes?.length > 0 && (
                <div className="sick-episodes">
                  <div className="sick-episodes__title">🩹 生病区间（持续时长）</div>
                  <div className="sick-episodes__list">
                    {sickCalendarData.episodes.map((ep, i) => (
                      <div key={i} className="sick-episode">
                        <span className="sick-episode__range">{sickCalendarDate.month}月{ep.start}日 – {ep.end}日</span>
                        <span className="sick-episode__dur">共 {ep.days} 天</span>
                        <span className="sick-episode__max">最高 {ep.maxTemp}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><BookOpen className="icon icon--sm" /></span>
            <h2 className="section__title">早教活动</h2>
          </div>
          <ActList items={activities} onPlay={(a) => setModal({ open: true, title: a.title, src: a.videoUrl || '' })} />
        </Reveal>

        <Reveal className="section" delay={0.08}>
          <div className="section__head">
            <span className="section__ico section__ico--violet"><Music className="icon icon--sm" /></span>
            <h2 className="section__title">音乐区</h2>
          </div>
          <ActList items={music} onPlay={(a) => setModal({ open: true, title: a.title, src: a.videoUrl || '' })} />
        </Reveal>

      </div>

      <VideoModal open={modal.open} title={modal.title} src={modal.src || ''} onClose={() => setModal({ open: false, title: '', src: '' })} />

      {/* 成员昵称编辑弹窗 */}
      {nickModal.open && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setNickModal({ open: false, nickname: '' })} />
          <div className="modal__card modal__card--form">
            <div className="modal__head">
              <h3 className="modal__title">设置我的昵称</h3>
              <button className="modal__close" onClick={() => setNickModal({ open: false, nickname: '' })} aria-label="关闭">✕</button>
            </div>
            <div className="modal__body">
              <p className="modal__hint">给自己起个好记的称呼，方便家人识别（如 妈妈、爸爸、奶奶）。仅你自己可修改。</p>
              <input
                className="field__input"
                value={nickModal.nickname}
                maxLength={20}
                placeholder="例如：妈妈"
                autoFocus
                onChange={(e) => setNickModal((v) => ({ ...v, nickname: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNickname(); }}
              />
              <div className="modal__actions">
                <button className="btn btn--ghost" onClick={() => setNickModal({ open: false, nickname: '' })}>取消</button>
                <button className="btn btn--primary" onClick={saveNickname}>保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 成长阶段详情弹窗：点击「正在经历」名字时展示 */}
      {stageModal && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setStageModal(null)} />
          <div className="modal__card modal__card--stage">
            <div className="modal__head">
              <h3 className="modal__title">{stageModal.title}</h3>
              <button className="modal__close" onClick={() => setStageModal(null)} aria-label="关闭">✕</button>
            </div>
            <div className="modal__body">
              <div className="stage-now__tag">正在经历</div>
              {stageModal.principle && (
                <div className="stage-modal__block">
                  <div className="stage-tip__k"><BookOpen className="icon icon--xs" />原理</div>
                  <p className="stage-modal__text">{stageModal.principle}</p>
                </div>
              )}
              {stageModal.signs && stageModal.signs.length > 0 && (
                <div className="stage-modal__block">
                  <div className="stage-tip__k stage-tip__k--warn"><Bell className="icon icon--xs" />信号提醒</div>
                  <ul className="stage-tip__list">
                    {stageModal.signs.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {stageModal.advice && stageModal.advice.length > 0 && (
                <div className="stage-modal__block">
                  <div className="stage-tip__k stage-tip__k--care"><Lightbulb className="icon icon--xs" />陪伴建议</div>
                  <ul className="stage-tip__list">
                    {stageModal.advice.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {stageModal.sources && (
                <p className="stage-modal__src">资料来源：{stageModal.sources}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}