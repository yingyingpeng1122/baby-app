import './App.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import { SPOTS, SPOTS_VISITABLE, DISTRICTS, AGE_BANDS, CATEGORIES, starsForAge, reasonForAge, getBandIdx, getBandLabel, ageMonthsLabel, categoryLabel, categoryEmoji } from './travelSpots.js';
import TravelMap from './TravelMap.jsx';
import {
  Baby, Ruler, Scale, Milk, Utensils, Music, Gamepad2, Video, Save,
  PlayCircle, Loader2, AlertCircle, Sparkles, Pencil, Check, Maximize2, Minimize2,
  Plus, Trash2, Clock, TrendingUp, ChevronDown, Sun, BookOpen, Heart, Moon, Pill, Smile, ListChecks, ChevronLeft, ChevronRight, Calendar, X, Thermometer, Stethoscope, Syringe, Activity,
  Eye, MessageCircle, Footprints, Hand, Brain, Bell, Lightbulb, Home, MoreHorizontal, MapPin,
  User, LogOut
} from 'lucide-react';

// WHO 最低食物种类（MDD）的 7 个食物组
const FOOD_GROUPS = ['谷物根茎', '豆坚果', '奶制品', '肉禽鱼', '蛋', '富维A果蔬', '其他果蔬'];

// ============ 身高体重参考曲线（中位数 P50，仅作趋势示意）============
// 数据来源：WHO 儿童生长标准 2006（国际）；中国九市儿童体格发育调查（中国参考）。
// 锚点按月，曲线内插。非精确百分位图，临床评估以医生 z 评分/百分位为准。
// WHO Child Growth Standards (0-24 月) 五百分位参考
// 数据来源：WHO Multicentre Growth Reference Study (2006)
// 每个锚点 [月龄, 值]，P3=第3百分位(下限参考)，P50=中位，P97=第97百分位(上限参考)
const _WHO = {
  boy: {
    w: {
      p3:  [[0,2.5],[1,3.4],[2,4.3],[3,5.0],[4,5.6],[5,6.0],[6,6.4],[9,7.1],[12,7.7],[15,8.3],[18,8.8],[21,9.2],[24,9.7]],
      p15: [[0,2.9],[1,3.9],[2,4.9],[3,5.7],[4,6.3],[5,6.8],[6,7.1],[9,8.0],[12,8.6],[15,9.2],[18,9.8],[21,10.3],[24,10.8]],
      p50: [[0,3.3],[1,4.5],[2,5.6],[3,6.4],[4,7.0],[5,7.5],[6,7.9],[9,8.9],[12,9.6],[15,10.3],[18,10.9],[21,11.5],[24,12.2]],
      p85: [[0,3.9],[1,5.2],[2,6.5],[3,7.3],[4,8.0],[5,8.5],[6,8.9],[9,10.0],[12,10.8],[15,11.5],[18,12.2],[21,12.9],[24,13.6]],
      p97: [[0,4.4],[1,5.8],[2,7.2],[3,8.0],[4,8.7],[5,9.3],[6,9.8],[9,10.9],[12,11.8],[15,12.6],[18,13.4],[21,14.1],[24,15.0]],
    },
    h: {
      p3:  [[0,46.1],[1,50.8],[2,54.4],[3,57.3],[4,59.7],[5,61.7],[6,63.4],[9,67.5],[12,71.4],[15,74.8],[18,77.6],[21,80.0],[24,81.7]],
      p15: [[0,47.8],[1,52.6],[2,56.3],[3,59.3],[4,61.7],[5,63.8],[6,65.5],[9,69.8],[12,73.6],[15,77.1],[18,80.0],[21,82.5],[24,84.4]],
      p50: [[0,49.9],[1,54.7],[2,58.4],[3,61.4],[4,63.9],[5,65.9],[6,67.6],[9,72.0],[12,75.7],[15,79.6],[18,82.6],[21,85.1],[24,87.1]],
      p85: [[0,52.0],[1,56.9],[2,60.6],[3,63.5],[4,66.0],[5,68.0],[6,69.7],[9,74.1],[12,77.9],[15,82.1],[18,85.2],[21,87.8],[24,89.8]],
      p97: [[0,53.7],[1,58.7],[2,62.5],[3,65.5],[4,68.0],[5,70.1],[6,71.8],[9,76.3],[12,80.0],[15,84.4],[18,87.6],[21,90.3],[24,92.5]],
    },
  },
  girl: {
    w: {
      p3:  [[0,2.4],[1,3.2],[2,3.9],[3,4.5],[4,5.0],[5,5.4],[6,5.7],[9,6.3],[12,6.8],[15,7.2],[18,7.6],[21,8.0],[24,8.4]],
      p15: [[0,2.8],[1,3.6],[2,4.5],[3,5.1],[4,5.6],[5,6.0],[6,6.4],[9,7.1],[12,7.6],[15,8.1],[18,8.6],[21,9.0],[24,9.6]],
      p50: [[0,3.2],[1,4.2],[2,5.1],[3,5.8],[4,6.4],[5,6.9],[6,7.3],[9,8.2],[12,8.9],[15,9.6],[18,10.2],[21,10.8],[24,11.5]],
      p85: [[0,3.7],[1,4.8],[2,5.8],[3,6.6],[4,7.2],[5,7.8],[6,8.2],[9,9.2],[12,10.0],[15,10.8],[18,11.5],[21,12.2],[24,13.0]],
      p97: [[0,4.2],[1,5.5],[2,6.5],[3,7.4],[4,8.0],[5,8.6],[6,9.0],[9,10.2],[12,11.1],[15,12.0],[18,12.9],[21,13.6],[24,14.6]],
    },
    h: {
      p3:  [[0,45.4],[1,49.8],[2,53.0],[3,55.6],[4,57.8],[5,59.6],[6,61.2],[9,65.2],[12,68.9],[15,72.0],[18,74.8],[21,77.1],[24,80.0]],
      p15: [[0,47.1],[1,51.6],[2,54.9],[3,57.6],[4,59.8],[5,61.7],[6,63.3],[9,67.5],[12,71.3],[15,74.5],[18,77.5],[21,80.0],[24,83.0]],
      p50: [[0,49.1],[1,53.7],[2,57.1],[3,59.8],[4,62.1],[5,64.0],[6,65.7],[9,70.1],[12,74.0],[15,77.5],[18,80.7],[21,83.4],[24,86.4]],
      p85: [[0,51.1],[1,55.8],[2,59.2],[3,62.0],[4,64.3],[5,66.2],[6,68.0],[9,72.6],[12,76.7],[15,80.4],[18,83.9],[21,86.7],[24,89.9]],
      p97: [[0,52.8],[1,57.6],[2,61.1],[3,63.9],[4,66.3],[5,68.3],[6,70.1],[9,74.8],[12,79.2],[15,83.0],[18,86.7],[21,89.6],[24,92.9]],
    },
  },
};
const GROWTH_REF = {
  boy:  { who: _WHO.boy,  cn: { w: [[0,3.3],[1,4.6],[2,5.7],[3,6.5],[4,7.1],[5,7.6],[6,8.0],[9,9.1],[12,9.8],[15,10.6],[18,11.2],[21,11.9],[24,12.6]], h: [[0,50.0],[1,54.8],[2,58.6],[3,61.6],[4,64.2],[5,66.1],[6,67.9],[9,72.4],[12,76.2],[15,80.3],[18,83.4],[21,86.0],[24,88.1]] } },
  girl: { who: _WHO.girl, cn: { w: [[0,3.2],[1,4.3],[2,5.2],[3,5.9],[4,6.5],[5,7.0],[6,7.4],[9,8.4],[12,9.1],[15,9.9],[18,10.5],[21,11.2],[24,11.9]], h: [[0,49.2],[1,53.8],[2,57.3],[3,60.0],[4,62.4],[5,64.3],[6,66.0],[9,70.6],[12,74.6],[15,78.2],[18,81.4],[21,84.2],[24,86.6]] } },
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
  const W = 680, H = 320;
  const padL = 48, padR = 16, padT = 16, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const key = metric === 'weight' ? 'w' : 'h';
  const ref = GROWTH_REF[gender] || GROWTH_REF.boy;
  const who = ref.who[key];
  const cur = birthday ? monthsBetween(birthday, todayISO()) : 0;
  // 年龄上限：WHO 数据到 24 月，宝宝当前月龄超过 24 时给到 cur+2，但不超过 36
  const ageMax = Math.min(36, Math.max(24, Math.ceil(cur) + 2));

  const pts = records
    .map(r => ({ age: monthsBetween(birthday, r.date), v: metric === 'weight' ? r.weight : r.height, date: r.date }))
    .filter(p => p.v > 0 && p.age <= ageMax + 0.5)
    .sort((a, b) => a.age - b.age);

  // 采样五条 WHO 百分位 + 中国参考
  const sampleN = Math.max(24, ageMax * 2);
  const pKeys = ['p3', 'p15', 'p50', 'p85', 'p97'];
  const pLines = {};
  const cnLine = [];
  const vals = [...pts.map(p => p.v)];
  for (let i = 0; i <= sampleN; i++) {
    const a = (ageMax * i) / sampleN;
    pKeys.forEach(k => { const v = refAt(who[k], a); pLines[k] = pLines[k] || []; pLines[k].push([a, v]); vals.push(v); });
    cnLine.push([a, refAt(ref.cn[key], a)]);
  }
  if (vals.length === 0) vals.push(0, 1);
  const vMin = Math.max(0, Math.floor(Math.min(...vals) - 1));
  const vMax = Math.ceil(Math.max(...vals) + 1);
  const xOf = a => padL + (a / ageMax) * plotW;
  const yOf = v => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const linePath = arr => arr.map((p, i) => `${i ? 'L' : 'M'}${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`).join(' ');
  // 闭合多边形路径：上边线正向 + 下边线反向
  const areaPath = (upper, lower) => {
    const top = upper.map((p, i) => `${i ? 'L' : 'M'}${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`).join(' ');
    const bot = [...lower].reverse().map(p => `L${xOf(p[0]).toFixed(1)},${yOf(p[1]).toFixed(1)}`).join(' ');
    return top + bot + ' Z';
  };
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
      {/* WHO 百分位填充区间：P3-P15（浅红）/ P85-P97（浅黄） */}
      <path d={areaPath(pLines.p15, pLines.p3)} fill="#fde2e1" opacity="0.55" />
      <path d={areaPath(pLines.p97, pLines.p85)} fill="#fdf2cd" opacity="0.55" />
      {/* WHO 百分位曲线：P3/P97 红/黄虚线，P15/P85 浅虚线，P50 实线 */}
      <path d={linePath(pLines.p3)}  fill="none" stroke="#e8867d" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={linePath(pLines.p15)} fill="none" stroke="#e8b4ad" strokeWidth="1.2" strokeDasharray="3 3" />
      <path d={linePath(pLines.p50)} fill="none" stroke="#4a5568" strokeWidth="2" />
      <path d={linePath(pLines.p85)} fill="none" stroke="#d4b876" strokeWidth="1.2" strokeDasharray="3 3" />
      <path d={linePath(pLines.p97)} fill="none" stroke="#c79a3a" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* 中国参考（淡蓝点线，叠加） */}
      <path d={linePath(cnLine)} fill="none" stroke="#7fb3ff" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.8" />
      {/* 百分位标签（右侧） */}
      <text x={W - padR} y={yOf(refAt(who.p97, ageMax)) - 3} textAnchor="end" className="chart-thr chart-thr--warn">P97</text>
      <text x={W - padR} y={yOf(refAt(who.p3,  ageMax)) + 11} textAnchor="end" className="chart-thr chart-thr--danger">P3</text>
      <text x={W - padR} y={yOf(refAt(who.p50, ageMax)) + 3} textAnchor="end" className="chart-thr">P50</text>
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
// 根据宝宝生日 + 建议月龄算建议日期（YYYY-MM-DD），用于疫苗/里程碑弹窗的日期默认值
// 例：birthday='2026-01-08', months=6 → '2026-07-08'
// 始终返回按生日+月龄算出的建议日期，即使已逾期（让用户看到具体哪天该打，而不是无脑用今天）
// birthday 非法时 fallback 到今天
const suggestDate = (birthday, months) => {
  try {
    const d = new Date(birthday + 'T00:00:00'); // 按本地时区解析
    if (isNaN(d.getTime())) return todayISO();
    d.setMonth(d.getMonth() + months);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return todayISO();
  }
};
// 把 'YYYY-MM-DD' 格式化为中文短日期 'M月D日'（用于 hint 文案）
const fmtCNDate = (iso) => {
  if (!iso || iso.length < 10) return '';
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  return `${m}月${d}日`;
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

/* 账号体系：手机号+密码登录，token 存 localStorage。
 * 未登录时 fallback 到旧的随机 user_id（兼容过渡期，登录后以 token 为准）。 */
function getToken() { try { return localStorage.getItem('babyapp_token') || ''; } catch { return ''; } }
function setToken(t) { try { t ? localStorage.setItem('babyapp_token', t) : localStorage.removeItem('babyapp_token'); } catch {} }
function getLegacyUserId() {
  let id = ''; try { id = localStorage.getItem('babyapp_user_id') || ''; } catch {}
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem('babyapp_user_id', id); } catch {}
  }
  return id;
}
const LEGACY_USER_ID = getLegacyUserId();

/* 当前选中的宝宝 ID（模块级，组件内通过 useEffect 同步） */
let _currentBabyId = null;

/* 请求超时：避免后端无响应时前端一直转圈 */
const FETCH_TIMEOUT = 15000;

/* 401 时清 token 触发回调（由 App 组件注册） */
let _onUnauthorized = null;
function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

/* 统一 fetch 包装：有 token 带 Authorization，否则带 X-User-Id 兜底 */
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  else headers['X-User-Id'] = LEGACY_USER_ID; // 未登录：兼容旧随机 ID
  if (_currentBabyId) headers['X-Baby-Id'] = _currentBabyId;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, headers, signal: ctrl.signal });
    if (res.status === 401 && _onUnauthorized) _onUnauthorized();
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/* 账号相关请求（不走 apiFetch 的 401 自动跳转，避免登录页自己 401 死循环） */
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), 'Content-Type': 'application/json' };
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
    // 兜底：切 tab 导致 display 从 none 变 block 后，IntersectionObserver 不一定会立即重新检查，
    // 元素可能一直停在 opacity:0（看起来空白）。200ms 后若仍未 in-view，强制显示。
    const fallback = setTimeout(() => {
      if (!el.classList.contains('in-view')) el.classList.add('in-view');
    }, 250);
    return () => { io.disconnect(); clearTimeout(fallback); };
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

/* 修改个人信息弹窗：昵称 + 密码（手机号不可改） */
function EditProfileModal({ currentUser, onClose, onSave }) {
  const [nickname, setNickname] = useState(currentUser?.nickname || '');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    // 只填了昵称没动密码：只改昵称
    const onlyNick = !oldPw && !newPw && !confirmPw;
    if (!onlyNick) {
      if (!oldPw) { alert('请输入旧密码'); return; }
      if (newPw.length < 6) { alert('新密码至少 6 位'); return; }
      if (newPw !== confirmPw) { alert('两次新密码不一致'); return; }
    }
    setSubmitting(true);
    try {
      const form = { nickname: nickname.trim() };
      if (!onlyNick) { form.old_password = oldPw; form.new_password = newPw; }
      await onSave(form);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__card modal__card--form">
        <div className="modal__head">
          <h3 className="modal__title">修改个人信息</h3>
          <button className="modal__close" onClick={onClose} aria-label="关闭">✕</button>
        </div>
        <div className="modal__body">
          <div className="field">
            <label className="field__label">手机号</label>
            <input className="field__input" value={currentUser?.phone || ''} disabled style={{ opacity: .6 }} />
            <p className="field__hint">手机号不可修改</p>
          </div>
          <div className="field">
            <label className="field__label">昵称</label>
            <input
              className="field__input"
              value={nickname}
              maxLength={20}
              placeholder="例如：妈妈"
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">修改密码（可选）</label>
            <input
              className="field__input"
              type="password"
              value={oldPw}
              placeholder="旧密码"
              onChange={(e) => setOldPw(e.target.value)}
            />
            <input
              className="field__input"
              type="password"
              value={newPw}
              placeholder="新密码（至少 6 位，不修改请留空）"
              onChange={(e) => setNewPw(e.target.value)}
              style={{ marginTop: 8 }}
            />
            <input
              className="field__input"
              type="password"
              value={confirmPw}
              placeholder="确认新密码"
              onChange={(e) => setConfirmPw(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={onClose}>取消</button>
            <button className="btn btn--primary" onClick={handleSave} disabled={submitting}>
              {submitting ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

/* ---------- 账号登录/注册页 ---------- */
function AuthPage({ mode, onAuth }) {
  const [m, setM] = useState(mode); // 'login' | 'register'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^1[3-9]\d{9}$/.test(phone)) { setErr('请输入正确的手机号'); return; }
    if (password.length < 6) { setErr('密码至少 6 位'); return; }
    if (m === 'register' && !nickname.trim()) { setErr('请填写昵称'); return; }
    setBusy(true);
    try {
      const endpoint = m === 'register' ? '/auth/register' : '/auth/login';
      const body = m === 'register'
        ? { phone, password, nickname: nickname.trim() }
        : { phone, password };
      const res = await authFetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.detail || '请求失败'); return; }
      setToken(data.token);
      // 拉取 /auth/me 取完整信息（含 family）
      const meRes = await authFetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } });
      const me = meRes.ok ? await meRes.json() : data;
      onAuth(me);
    } catch (e) {
      setErr(e.name === 'AbortError' ? '请求超时，请检查网络' : '网络错误');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app app--center">
      <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
      <div className="form family-form">
        <div className="form__head">
          <div className="form__logo"><Baby className="icon icon--lg" /></div>
          <h2 className="form__title">{m === 'register' ? '注册账号' : '欢迎回来'}</h2>
          <p className="form__sub">{m === 'register' ? '用手机号注册，数据跨设备同步' : '登录后继续记录宝宝的成长'}</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label className="field">
            <span className="field__label">手机号</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="11 位手机号"
              autoComplete="tel"
              required
            />
          </label>
          {m === 'register' && (
            <label className="field">
              <span className="field__label">昵称</span>
              <input
                type="text"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="如：妈妈 / 爸爸 / 小姨"
                required
              />
            </label>
          )}
          <label className="field">
            <span className="field__label">密码</span>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoComplete={m === 'register' ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {err && <p className="form__error">{err}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? '处理中…' : (m === 'register' ? '注册并登录' : '登录')}
          </button>
        </form>
        <p className="auth-switch">
          {m === 'register' ? '已有账号？' : '还没有账号？'}
          <button
            type="button"
            className="auth-switch__btn"
            onClick={() => { setM(m === 'register' ? 'login' : 'register'); setErr(''); }}
          >
            {m === 'register' ? '去登录' : '去注册'}
          </button>
        </p>
      </div>
    </div>
  );
}

// 出行清单：新增自定义项的小组件（带本地 state）
function TravelAddCustom({ onAdd }) {
  const [cat, setCat] = useState('feed');
  const [name, setName] = useState('');
  const submit = () => {
    if (!name.trim()) return;
    onAdd(cat, name);
    setName('');
  };
  return (
    <div className="travel-add-custom">
      <select value={cat} onChange={(e) => setCat(e.target.value)}>
        {Object.entries({ feed: '喂养', hygiene: '卫生清洁', clothing: '衣物', sleep: '睡眠安抚', gear: '出行装备', docs: '证件医疗', extra: '长途/出境加项' }).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="自定义物品名" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
      <button className="btn btn--ghost btn--sm" onClick={submit}><Plus className="icon icon--xs" />添加</button>
    </div>
  );
}

export default function BabyAppFullStack() {
  const [view, setView] = useState('loading');
  const [error, setError] = useState(null);
  const [connError, setConnError] = useState(null); // 初始化连接失败（超时/网络不可达）
  const [data, setData] = useState(null);
  const [modal, setModal] = useState({ open: false, title: '' });
  const [form, setForm] = useState({ name: '', gender: 'boy', birthday: '', height: '', weight: '', night_bedtime: '', night_wake_time: '' });
  // 账号系统
  const [currentUser, setCurrentUser] = useState(null); // { user_id, phone, nickname }
  const [authView, setAuthView] = useState(null); // 'login' | 'register' | null
  // 家庭系统
  const [family, setFamily] = useState(null);          // { family_id, family_name, role, members, babies }
  const [babies, setBabies] = useState([]);            // 家庭所有宝宝列表
  const [currentBabyId, setCurrentBabyId] = useState(null); // 当前选中宝宝
  const [familySetupMode, setFamilySetupMode] = useState(null); // 'create' | 'join' | null
  const [familyName, setFamilyName] = useState('');
  const [joinFamilyId, setJoinFamilyId] = useState('');
  // 成员昵称编辑
  const [nickModal, setNickModal] = useState({ open: false, nickname: '' });
  // 修改个人信息弹窗（昵称 + 密码，手机号不可改）
  const [editProfileModal, setEditProfileModal] = useState(false);
  // 家庭成员「+x」下拉展开
  const [membersOpen, setMembersOpen] = useState(false);
  // 家庭管理弹窗（收起家庭名/ID/成员/退出家庭，点入口打开）
  const [familyMgmtOpen, setFamilyMgmtOpen] = useState(false);
  // 多宝宝快速切换下拉（顶部宝宝条旁）
  const [babySwitchOpen, setBabySwitchOpen] = useState(false);
  // topbar 用户菜单（手机端「更多 ⋯」）
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
  // 疫苗日历
  const [vaccines, setVaccines] = useState([]);
  const [vaccineModal, setVaccineModal] = useState(null); // { vaccine, administeredDate, note } 或 null
  const [vxFilter, setVxFilter] = useState('action'); // 'action' 默认(逾期+待打) | 'administered' | 'upcoming' | 'all'
  const [vaxFilter, setVaxFilter] = useState('todo'); // 'todo' 默认(逾期+待打) | 'administered' | 'upcoming' | 'all'
  // 里程碑打卡
  const [milestones, setMilestones] = useState([]);
  const [milestoneModal, setMilestoneModal] = useState(null); // { milestone, achievedDate, note } 或 null
  const [msFilter, setMsFilter] = useState('pending'); // 'pending' 默认 | 'achieved' | 'upcoming' | 'all'
  const [msExpandedId, setMsExpandedId] = useState(null); // 展开的里程碑 id（null 全收起）
  // 睡眠 SweetSpot 预测
  const [sleepStats, setSleepStats] = useState(null);
  // 提交成功反馈 toast
  const [toast, setToast] = useState(null); // { msg, key }
  const [activeZone, setActiveZone] = useState('daily'); // 'daily' | 'growth' | 'travel'
  const toastTimer = useRef(null);
  const showToast = (msg) => {
    setToast({ msg, key: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };
  // 录入表单类型 tab：feed / diaper / sleep
  const [recordTab, setRecordTab] = useState('feed');
  // 「添加记录」弹窗显隐（只控制开关，表单数据仍走 feedForm）
  const [recordModalOpen, setRecordModalOpen] = useState(false);
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
  // 出行：目的地推荐 + 打包清单 + 出行历史
  const [travelLists, setTravelLists] = useState([]);       // [{id, dest_type, age_months, items(JSON string)}]
  const [travelRecords, setTravelRecords] = useState([]);  // [{id, dest_name, dest_type, travel_date, age_months, rating, note}]
  const [travelTab, setTravelTab] = useState('reco');      // 'reco' | 'list' | 'history'
  const [travelListDraft, setTravelListDraft] = useState(null); // 当前编辑的清单 {id?, dest_type, age_months, items:[]}
  const [travelRecordDraft, setTravelRecordDraft] = useState({ dest_name: '', dest_type: 'short', category: '', travel_date: todayISO(), age_months: 0, rating: 0, note: '' });
  const [editingTravelRecordId, setEditingTravelRecordId] = useState(null);
  const [travelLoading, setTravelLoading] = useState(false);
  // 目的地推荐：区筛选 + 星级筛选 + 已打卡状态来自 travelRecords（按 dest_name 匹配）
  const [recoDistrict, setRecoDistrict] = useState('all');   // 'all' | 区名
  const [recoStar, setRecoStar] = useState('all');           // 'all' | 1-5
  const [recoVisited, setRecoVisited] = useState('all');     // 'all' | 'visited' | 'unvisited'
  const [recoCategory, setRecoCategory] = useState('park');   // 默认选中'公园'，避免一进来 50+ 点太多
  // 标记出行的弹窗（从地点详情"标记出行"按钮打开）
  const [markModal, setMarkModal] = useState(null);          // { spot } | null
  // 夜间作息弹窗（从睡眠图"作息"按钮打开，独立于档案表单）
  const [nightModal, setNightModal] = useState(null);        // { bedtime, wake } | null
  const [nightSaving, setNightSaving] = useState(false);
  // 地点详情弹窗（从地图点位点击打开）
  const [spotModal, setSpotModal] = useState(null);          // { spot } | null
  // 退出登录二次确认弹窗（自建 Modal，不用原生 confirm，避免移动端 PWA 不响应）
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  // 生病模式：体温记录（按宝宝同步到后端，跨设备一致）
  const [sickMode, setSickMode] = useState(false);
  const [tempRecords, setTempRecords] = useState([]);
  const [tempDraft, setTempDraft] = useState({ temp: '', note: '', datetime: nowDateTime().replace(' ', 'T'), symptoms: [] });
  const [editingTempId, setEditingTempId] = useState(null); // 正在编辑的体温记录 id（null=新增）
  const TEMP_SYMPTOMS = ['咳嗽', '流涕', '呕吐', '腹泻', '精神差', '已用药'];
  // 生病模式开关持久化到后端（按宝宝），不同设备打开会同步
  const persistSickMode = async (next) => {
    setSickMode(next);
    try { localStorage.setItem('babyapp_sickmode', next ? '1' : '0'); } catch {}
    if (!currentBabyId) return;
    try {
      await apiFetch(`${API_BASE}/family/babies/${currentBabyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sick_mode: next ? 1 : 0 }),
      });
    } catch (e) { console.error('sync sick_mode failed', e); }
  };

  // 保存夜间作息（从睡眠图右上角"作息"按钮触发，独立于档案表单）
  const saveNightRoutine = async () => {
    if (!currentBabyId || !nightModal) return;
    // 简单校验：要么都填、要么都空
    const { bedtime, wake } = nightModal;
    if ((bedtime && !wake) || (!bedtime && wake)) {
      alert('入睡时间和起床时间需要同时填写，或同时留空');
      return;
    }
    setNightSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/family/babies/${currentBabyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ night_bedtime: bedtime || null, night_wake_time: wake || null }),
      });
      if (!res.ok) throw new Error(`保存失败 (${res.status})`);
      await fetchDashboard();
      await loadSleepStats();
      setNightModal(null);
    } catch (e) {
      alert('保存夜间作息失败：' + (e.message || '请确认后端已启动'));
    } finally {
      setNightSaving(false);
    }
  };

  // 同步 currentBabyId 到模块级变量
  useEffect(() => { _currentBabyId = currentBabyId; }, [currentBabyId]);

  // 注册 401 拦截：任何业务请求返回 401 → 清 token，回登录页
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken('');
      setCurrentUser(null);
      setAuthView('login');
      setView('auth');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // 启动初始化：先校验 token → 拉用户信息 → 再走家庭流程
  useEffect(() => { bootstrapAuth(); }, []);

  const bootstrapAuth = async () => {
    const token = getToken();
    if (!token) {
      setAuthView('login');
      setView('auth');
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        setToken('');
        setAuthView('login');
        setView('auth');
        return;
      }
      const me = await res.json();
      setCurrentUser(me);
      initFamily();
    } catch (e) {
      // 网络问题，不清 token，回连接错误页
      setConnError('连接后端失败，请确认服务已启动');
      setView('conn-error');
    }
  };

  // 登录/注册成功后回调
  const onAuthSuccess = (me) => {
    setCurrentUser(me);
    setAuthView(null);
    initFamily();
  };

  const logout = async () => {
    setLogoutConfirm(false);            // 关闭确认弹窗
    try { await authFetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } }); } catch {}
    setToken('');
    setCurrentUser(null);
    setFamily(null);
    setBabies([]);
    setData(null);
    setAuthView('login');
    setView('auth');
  };

  // 修改个人信息：昵称和密码（手机号不可改）
  const saveProfile = async (form) => {
    try {
      const res = await authFetch(`${API_BASE}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || '保存失败');
      }
      const data = await res.json();
      // 更新本地 currentUser（昵称改了要同步）
      setCurrentUser(prev => prev ? { ...prev, nickname: data.nickname ?? prev.nickname } : prev);
      // 同步刷新家庭（成员昵称可能也改了）
      await initFamily();
      setEditProfileModal(false);
      alert('保存成功');
    } catch (e) { alert('保存失败：' + (e.message || '')); }
  };

  // 初始化：检查家庭状态（旧入口，bootstrapAuth 鉴权通过后调用）
  // 保留无 token 时的兜底入口（向后兼容）
  useEffect(() => { if (getToken()) return; /* 由 bootstrapAuth 接管 */ }, []);

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
        setSickMode(fam.babies[0].sick_mode === 1);
        try { localStorage.setItem('babyapp_sickmode', fam.babies[0].sick_mode === 1 ? '1' : '0'); } catch {}
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
  const saveNickname = async () => {    try {
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
      setForm({ name: '', gender: 'boy', birthday: '', height: '', weight: '', night_bedtime: '', night_wake_time: '' });
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
    // 切换宝宝时同步该宝宝的生病模式状态（跨设备一致）
    const target = babies.find(b => b.baby_id === babyId);
    if (target) {
      setSickMode(target.sick_mode === 1);
      try { localStorage.setItem('babyapp_sickmode', target.sick_mode === 1 ? '1' : '0'); } catch {}
    }
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
      loadTravel();
      loadVaccines();
      loadMilestones();
      loadSleepStats();
      // 拉取宝宝列表，同步生病模式状态（跨设备一致）
      try {
        const bres = await apiFetch(`${API_BASE}/family/babies`);
        if (bres.ok) {
          const list = await bres.json();
          setBabies(list);
          const cur = list.find(b => b.baby_id === currentBabyId);
          if (cur) {
            setSickMode(cur.sick_mode === 1);
            try { localStorage.setItem('babyapp_sickmode', cur.sick_mode === 1 ? '1' : '0'); } catch {}
          }
        }
      } catch {}
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

  // ---- 出行：打包清单 + 出行历史 ----
  // 打包清单预设模板：按目的地类型 + 月龄段生成
  // dest_type: 'short'(短途<3天) / 'long'(长途>3天) / 'abroad'(出境)
  // 月龄段：<6m / 6-12m / 12-24m / 24m+
  const TRAVEL_ITEM_TEMPLATES = {
    // 喂养类（按月龄差异大）
    feed: {
      '<6m':  ['奶粉分装盒', '奶瓶×2', '便携温奶器', '围嘴×3', '辅食碗勺'],
      '6-12m': ['奶粉分装盒', '奶瓶×2', '辅食泥×5', '便携辅食碗勺', '围嘴×3', '儿童餐具'],
      '12-24m': ['儿童餐具', '便携辅食剪', '零食盒', '吸管杯', '围兜×2'],
      '24m+': ['儿童餐具', '零食盒', '便携水杯', '辅食剪'],
    },
    // 卫生清洁
    hygiene: {
      '<6m':  ['纸尿裤(日均8片)', '湿巾', '棉柔巾', '护臀霜', '体温计', '婴儿沐浴露'],
      '6-12m': ['纸尿裤(日均6片)', '湿巾', '棉柔巾', '护臀霜', '体温计', '婴儿洗衣皂'],
      '12-24m': ['纸尿裤(日均5片)', '拉拉裤', '湿巾', '洗手液', '体温计', '儿童牙刷牙膏'],
      '24m+': ['拉拉裤(夜用)', '湿巾', '儿童牙刷牙膏', '洗手液', '体温计'],
    },
    // 衣物
    clothing: {
      '<6m':  ['连体衣×3', '袜子×3', '薄毯', '口水巾×5'],
      '6-12m': ['连体衣×3', '袜子×3', '薄毯', '外套×1', '口水巾×3'],
      '12-24m': ['上衣×3', '裤子×3', '袜子×3', '外套×1', '睡衣×1'],
      '24m+': ['上衣×3', '裤子×3', '袜子×3', '外套×1', '睡衣×1', '遮阳帽'],
    },
    // 睡眠安抚
    sleep: {
      '<6m':  ['安抚奶嘴', '睡袋', '便携小床/床中床', '白噪音机'],
      '6-12m': ['安抚奶嘴', '睡袋', '便携小床', '熟悉的安抚玩具', '白噪音机'],
      '12-24m': ['熟悉安抚玩具', '睡袋/小被子', '便携床围'],
      '24m+': ['熟悉安抚玩具', '小被子', '睡前绘本×2'],
    },
    // 出行装备
    gear: {
      '<6m':  ['婴儿车', '背带/腰凳', '车载安全座椅', '妈咪包'],
      '6-12m': ['婴儿车', '背带/腰凳', '车载安全座椅', '妈咪包', '便携餐椅'],
      '12-24m': ['婴儿车/溜娃神器', '背带', '车载安全座椅', '妈咪包', '便携餐椅'],
      '24m+': ['溜娃神器', '车载安全座椅', '妈咪包', '防走失背包'],
    },
    // 证件医疗（长途/出境必备）
    docs: {
      '<6m':  ['出生证明复印件', '疫苗本', '医保卡'],
      '6-12m': ['出生证明复印件', '疫苗本', '医保卡'],
      '12-24m': ['出生证明复印件', '疫苗本', '医保卡', '户口本复印件'],
      '24m+': ['户口本复印件', '医保卡', '宝宝身份证(如有)'],
    },
  };
  // 长途/出境额外加项
  const TRAVEL_EXTRA = {
    long: ['常用药(退烧/止泻/过敏)', '创可贴', '免洗洗手液', '密封袋(装脏衣)'],
    abroad: ['护照/港澳通行证', '常用药(退烧/止泻/过敏)', '创可贴', '免洗洗手液', '密封袋', '转换插头', '旅行保险单'],
  };

  const ageBucket = (m) => m < 6 ? '<6m' : m < 12 ? '6-12m' : m < 24 ? '12-24m' : '24m+';
  const CATEGORY_LABELS = { feed: '喂养', hygiene: '卫生清洁', clothing: '衣物', sleep: '睡眠安抚', gear: '出行装备', docs: '证件医疗', extra: '长途/出境加项' };

  // 生成清单模板
  const genTravelList = (destType, ageMonths) => {
    const bucket = ageBucket(ageMonths);
    const items = [];
    for (const [cat, byAge] of Object.entries(TRAVEL_ITEM_TEMPLATES)) {
      (byAge[bucket] || []).forEach(name => items.push({ cat, name, checked: false, custom: false }));
    }
    if (destType === 'long' || destType === 'abroad') {
      (TRAVEL_EXTRA[destType] || []).forEach(name => items.push({ cat: 'extra', name, checked: false, custom: false }));
    }
    return items;
  };

  const loadTravel = async () => {
    try {
      const [listRes, recRes] = await Promise.all([
        apiFetch(`${API_BASE}/travel/lists`),
        apiFetch(`${API_BASE}/travel/records`),
      ]);
      if (listRes.ok) setTravelLists(await listRes.json());
      if (recRes.ok) setTravelRecords(await recRes.json());
    } catch (e) { console.error('fetch travel failed', e); }
  };

  // 疫苗日历
  const loadVaccines = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/vaccines`);
      if (res.ok) setVaccines(await res.json());
    } catch (e) { console.error('fetch vaccines failed', e); }
  };
  // 标记疫苗已接种
  const markVaccine = async (vaccineId, administeredDate, note = '') => {
    try {
      const res = await apiFetch(`${API_BASE}/vaccines/${vaccineId}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ administeredDate, note }),
      });
      if (res.ok) {
        showToast('已记录接种');
        loadVaccines();
      }
    } catch (e) { console.error('mark vaccine failed', e); }
  };
  // 撤销疫苗接种记录
  const unmarkVaccine = async (recordId) => {
    try {
      const res = await apiFetch(`${API_BASE}/vaccine-records/${recordId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('已撤销');
        loadVaccines();
      }
    } catch (e) { console.error('unmark vaccine failed', e); }
  };

  // 里程碑打卡
  const loadMilestones = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/milestones`);
      if (res.ok) setMilestones(await res.json());
    } catch (e) { console.error('fetch milestones failed', e); }
  };
  const markMilestone = async (milestoneId, achievedDate, note = '') => {
    try {
      const res = await apiFetch(`${API_BASE}/milestones/${milestoneId}/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ achievedDate, note }),
      });
      if (res.ok) {
        showToast('已记录达成');
        loadMilestones();
      }
    } catch (e) { console.error('mark milestone failed', e); }
  };
  const unmarkMilestone = async (recordId) => {
    try {
      const res = await apiFetch(`${API_BASE}/milestone-records/${recordId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('已撤销');
        loadMilestones();
      }
    } catch (e) { console.error('unmark milestone failed', e); }
  };

  // 睡眠 SweetSpot 预测
  const loadSleepStats = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/sleep-stats`);
      if (res.ok) setSleepStats(await res.json());
    } catch (e) { console.error('fetch sleep-stats failed', e); }
  };

  // 新建清单草稿
  const startNewTravelList = () => {
    const m = months || 0;
    setTravelListDraft({ id: '', dest_type: 'short', age_months: m, items: genTravelList('short', m) });
  };
  // 编辑已有清单
  const editTravelList = (list) => {
    let items = [];
    try { items = JSON.parse(list.items || '[]'); } catch (e) { items = []; }
    setTravelListDraft({ id: list.id, dest_type: list.dest_type || 'short', age_months: list.age_months || 0, items });
  };
  // 切换目的地类型时重新生成模板（仅未保存的新清单）
  const changeTravelListType = (destType) => {
    if (!travelListDraft) return;
    const m = travelListDraft.age_months || 0;
    setTravelListDraft({ ...travelListDraft, dest_type: destType, items: genTravelList(destType, m) });
  };
  // 勾选某项
  const toggleTravelItem = (idx) => {
    if (!travelListDraft) return;
    const items = travelListDraft.items.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it);
    setTravelListDraft({ ...travelListDraft, items });
  };
  // 删除某项
  const removeTravelItem = (idx) => {
    if (!travelListDraft) return;
    const items = travelListDraft.items.filter((_, i) => i !== idx);
    setTravelListDraft({ ...travelListDraft, items });
  };
  // 新增自定义项
  const addCustomTravelItem = (cat, name) => {
    if (!travelListDraft || !name.trim()) return;
    const items = [...travelListDraft.items, { cat, name: name.trim(), checked: false, custom: true }];
    setTravelListDraft({ ...travelListDraft, items });
  };
  // 保存清单
  const saveTravelList = async () => {
    if (!travelListDraft) return;
    setTravelLoading(true);
    try {
      const body = {
        id: travelListDraft.id,
        dest_type: travelListDraft.dest_type,
        age_months: travelListDraft.age_months,
        items: JSON.stringify(travelListDraft.items),
      };
      const res = travelListDraft.id
        ? await apiFetch(`${API_BASE}/travel/lists/${travelListDraft.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch(`${API_BASE}/travel/lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || '保存失败'); }
      showToast(travelListDraft.id ? '清单已更新 ✓' : '清单已保存 ✓');
      setTravelListDraft(null);
      await loadTravel();
    } catch (e) { alert('保存清单失败：' + (e.message || '')); }
    setTravelLoading(false);
  };
  const delTravelList = async (id) => {
    if (!window.confirm('删除这份打包清单？')) return;
    try {
      const res = await apiFetch(`${API_BASE}/travel/lists/${id}`, { method: 'DELETE' });
      if (res.ok) setTravelLists(prev => prev.filter(l => l.id !== id));
    } catch (e) { console.error('delete travel list failed', e); }
  };

  // 出行历史
  const saveTravelRecord = async () => {
    if (!travelRecordDraft.dest_name.trim()) return alert('请填写目的地');
    setTravelLoading(true);
    try {
      const body = { ...travelRecordDraft, dest_name: travelRecordDraft.dest_name.trim(), age_months: months || 0 };
      const res = editingTravelRecordId
        ? await apiFetch(`${API_BASE}/travel/records/${editingTravelRecordId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch(`${API_BASE}/travel/records`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || '保存失败'); }
      showToast(editingTravelRecordId ? '出行记录已更新 ✓' : '出行记录已保存 ✓');
      setTravelRecordDraft({ dest_name: '', dest_type: 'short', category: '', travel_date: todayISO(), age_months: 0, rating: 0, note: '' });
      setEditingTravelRecordId(null);
      setMarkModal(null);
      await loadTravel();
    } catch (e) { alert('保存出行记录失败：' + (e.message || '')); }
    setTravelLoading(false);
  };
  const editTravelRecord = (r) => {
    setEditingTravelRecordId(r.id);
    setTravelRecordDraft({ dest_name: r.dest_name || '', dest_type: r.dest_type || 'short', category: r.category || '', travel_date: r.travel_date || todayISO(), age_months: r.age_months || 0, rating: r.rating || 0, note: r.note || '' });
  };
  const delTravelRecord = async (id) => {
    if (!window.confirm('删除这条出行记录？')) return;
    try {
      const res = await apiFetch(`${API_BASE}/travel/records/${id}`, { method: 'DELETE' });
      if (res.ok) setTravelRecords(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error('delete travel record failed', e); }
  };

  // ---- 目的地推荐 ----
  // 已出行的地点名集合（按 dest_name 匹配 SPOTS.name）
  const visitedSpotNames = useMemo(() => {
    const s = new Set();
    travelRecords.forEach(r => { if (r.dest_name) s.add(r.dest_name); });
    return s;
  }, [travelRecords]);
  // 当前月龄（从 data 中取，避免依赖渲染期解构的 months）
  const recoMonths = data?.months || 0;
  // 筛选 + 排序后的推荐列表
  const filteredSpots = useMemo(() => {
    let arr = SPOTS_VISITABLE.filter(s => {
      if (recoDistrict !== 'all' && s.district !== recoDistrict) return false;
      if (recoCategory !== 'all' && s.category !== recoCategory) return false;
      const stars = starsForAge(s, recoMonths);
      if (recoStar !== 'all' && stars !== recoStar) return false;
      const visited = visitedSpotNames.has(s.name);
      if (recoVisited === 'visited' && !visited) return false;
      if (recoVisited === 'unvisited' && visited) return false;
      return true;
    });
    // 已出行排到列表最下方；未出行按当前月龄星级降序
    arr.sort((a, b) => {
      const va = visitedSpotNames.has(a.name) ? 1 : 0;
      const vb = visitedSpotNames.has(b.name) ? 1 : 0;
      if (va !== vb) return va - vb;          // 未出行(0)在前，已出行(1)在后
      const sa = starsForAge(a, recoMonths), sb = starsForAge(b, recoMonths);
      return sb - sa;                          // 同组内按星级降序
    });
    return arr;
  }, [recoDistrict, recoCategory, recoStar, recoVisited, recoMonths, visitedSpotNames]);
  // 打卡统计
  const recoStats = useMemo(() => {
    const total = SPOTS_VISITABLE.length;
    const visited = SPOTS_VISITABLE.filter(s => visitedSpotNames.has(s.name)).length;
    return { total, visited, percent: total ? Math.round(visited / total * 100) : 0 };
  }, [visitedSpotNames]);
  // 从目的地推荐点击"标记出行" → 打开弹窗预填
  const openMarkModal = (spot) => {
    setTravelRecordDraft({ dest_name: spot.name, dest_type: 'daily', category: spot.category || '', travel_date: todayISO(), age_months: recoMonths, rating: starsForAge(spot, recoMonths), note: '' });
    setEditingTravelRecordId(null);
    setMarkModal({ spot });
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
      setFeedForm({ time: nowHM(), amount: '', type: feedForm.type, note: '', foodGroups: [], kind: '', duration: 0, wakeTime: '' });
      setRecordTab(feedForm.type === 'diaper' ? 'diaper' : feedForm.type === 'sleep' ? 'sleep' : 'feed');
      showToast(editingId ? '已更新 ✓' : '已保存 ✓');
      setRecordModalOpen(false);   // 添加/更新成功后自动关闭弹窗
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
    setRecordModalOpen(true);   // 从时间轴点编辑时打开弹窗
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

  /* ---------- 账号登录/注册页 ---------- */
  if (view === 'auth') {
    return <AuthPage mode={authView || 'login'} onAuth={onAuthSuccess} />;
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
  const { profile, months, growthStandard: g, isWeightNormal, isHeightNormal, weightStatus: wStat, heightStatus: hStat, feedingAdvice: f, activities, music = [], stories = [], stageTip: st = {} } = data;
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
    <div className="app" data-zone={activeZone}>
      <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
      {toast && (
        <div key={toast.key} className="toast" role="status" aria-live="polite">
          <Check className="icon icon--sm" />{toast.msg}
        </div>
      )}

      <header className="topbar">
        <div className="topbar__inner">
          {/* 宝宝精简条：当前宝宝名片 */}
          <div className="brand brand--baby">
            <div className="brand__logo brand__logo--baby"><Baby className="icon icon--lg" /></div>
            <div>
              <div className="brand__name">{profile.name}的成长记录</div>
              <div className="brand__meta">{months} 个月大 · {profile.gender === 'boy' ? '男宝' : '女宝'}</div>
            </div>
          </div>
          {/* 多宝宝时显示快速切换下拉 */}
          {babies.length > 1 && (
            <div className="baby-quick-switch">
              <button
                type="button"
                className="baby-quick-switch__btn"
                onClick={() => setBabySwitchOpen(v => !v)}
                aria-expanded={babySwitchOpen}
                title="切换宝宝"
              >
                <span className="baby-quick-switch__cur">{profile.name}</span>
                <ChevronDown className="icon icon--xs" />
              </button>
              {babySwitchOpen && (
                <>
                  <div className="baby-quick-switch__mask" onClick={() => setBabySwitchOpen(false)} />
                  <div className="baby-quick-switch__menu">
                    {babies.map(b => (
                      <button
                        key={b.baby_id}
                        type="button"
                        className={`baby-quick-switch__item ${b.baby_id === currentBabyId ? 'is-current' : ''}`}
                        onClick={() => { switchBaby(b.baby_id); setBabySwitchOpen(false); }}
                      >
                        {b.name}
                        {b.baby_id === currentBabyId && <Check className="icon icon--xs" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="topbar__actions">
            {/* 家庭管理入口（家庭名/ID/成员/退出家庭/添加宝宝） */}
            {family && (
              <button className="topbar__icon-btn" onClick={() => setFamilyMgmtOpen(true)} title="家庭管理" aria-label="家庭管理">
                <Home className="icon icon--sm" />
              </button>
            )}
            {/* 修改信息 / 退出登录（纯图标，与家庭管理入口风格统一） */}
            {currentUser && (
              <>
                <button className="topbar__icon-btn" onClick={() => setEditProfileModal(true)} title="修改昵称和密码" aria-label="修改信息">
                  <User className="icon icon--sm" />
                </button>
                <button className="topbar__icon-btn" onClick={() => setLogoutConfirm(true)} title={`退出登录（${currentUser.nickname || currentUser.phone}）`} aria-label="退出登录">
                  <LogOut className="icon icon--sm" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="zone-tabs" aria-label="功能区域切换">
        <button
          className={`zone-tabs__btn ${activeZone === 'daily' ? 'is-active' : ''}`}
          onClick={() => setActiveZone('daily')}
        >
          <span className="zone-tabs__ico"><Milk className="icon icon--sm" /></span>
          <span className="zone-tabs__label">日常</span>
        </button>
        <button
          className={`zone-tabs__btn ${activeZone === 'growth' ? 'is-active' : ''}`}
          onClick={() => setActiveZone('growth')}
        >
          <span className="zone-tabs__ico"><Sparkles className="icon icon--sm" /></span>
          <span className="zone-tabs__label">成长</span>
        </button>
        <button
          className={`zone-tabs__btn ${activeZone === 'travel' ? 'is-active' : ''}`}
          onClick={() => setActiveZone('travel')}
        >
          <span className="zone-tabs__ico"><MapPin className="icon icon--sm" /></span>
          <span className="zone-tabs__label">出行</span>
        </button>
      </nav>

      <div className="wrap">
        <Reveal className="section zone zone--growth" delay={0.05}>
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
            <button className="btn btn--ghost btn--sm section__edit" onClick={() => { setForm({ name: profile.name, gender: profile.gender, birthday: profile.birthday, height: String(profile.height), weight: String(profile.weight), night_bedtime: profile.night_bedtime || '', night_wake_time: profile.night_wake_time || '' }); setView('edit'); }} title="编辑宝宝档案">
              <Pencil className="icon icon--xs" />编辑
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
                  <span className="growth__lg growth__lg--p97"><i />P97</span>
                  <span className="growth__lg growth__lg--p85"><i />P85</span>
                  <span className="growth__lg growth__lg--p50"><i />P50 中位</span>
                  <span className="growth__lg growth__lg--p15"><i />P15</span>
                  <span className="growth__lg growth__lg--p3"><i />P3</span>
                  <span className="growth__lg growth__lg--cn"><i />中国参考</span>
                </div>
                <p className="growth__note">WHO 百分位曲线（P3–P97）：浅黄区 P85–P97 偏高，浅红区 P3–P15 偏低；落在 P15–P85 区间为正常范围。仅作直观参考，临床评估请以医生 z 评分结论为准。</p>
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
                        {r.recorderName && <span className="recorder-chip">{r.recorderName}</span>}
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

        <Reveal className="section zone zone--growth" delay={0.05}>
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



        {/* 宝宝的一天 · 横向时间轴 + 「添加记录」按钮 */}
        <Reveal className="section zone zone--daily" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--violet"><Sparkles className="icon icon--sm" /></span>
            <h2 className="section__title">宝宝的一天</h2>
            <button
              className="btn btn--primary btn--sm section__head-btn"
              onClick={() => setRecordModalOpen(true)}
            >
              <Plus className="icon icon--xs" /> 添加记录
            </button>
          </div>
          <div className="daytime-canvas">
            <div className="daytime">
              {(() => {
                const items = [...feedRecords].sort((a, b) => a.time.localeCompare(b.time));
                if (items.length === 0) {
                  // 区分"加载中"和"真的没记录"：feedEval 还是 null 说明喂养数据尚未加载完
                  const loading = feedEval === null;
                  return <div className="daytime__empty">{loading ? '加载中…' : '今天还没有记录，添加一个喂养 / 换尿布 / 睡觉吧～'}</div>;
                }
                return (
                  (() => {
                    // 真实时间轴：按 HH:MM 算当天分钟数，相邻间距按真实时间差比例排布
                    const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
                    const ITEM_W = 96;          // 方格宽度（与 CSS 一致）
                    const PX_PER_MIN = 0.7;      // 每分钟对应的像素，控制整体疏密
                    const MIN_GAP = ITEM_W + 8;  // 相邻方格最小净间距（防重叠）
                    let cursor = 0;             // 累计 left 偏移
                    const placed = items.map((r, i) => {
                      const t = toMin(r.time);
                      if (i === 0) { cursor = 0; }
                      else {
                        const prevT = toMin(items[i - 1].time);
                        let delta = t - prevT;
                        if (delta < 0) delta += 24 * 60; // 跨午夜
                        // 上一条若是睡觉且有 duration，其长条向右延伸 sleepBarW 像素，
                        // 必须保证当前卡片 left 至少跳过「长条右端 + MIN_GAP」，否则长条会盖到本卡片
                        const prev = items[i - 1];
                        const prevSleepBarW = (prev.type === 'sleep' && prev.duration > 0)
                          ? Math.max(36, Math.min(prev.duration * 1.2, 320)) : 0;
                        cursor += Math.max(MIN_GAP, delta * PX_PER_MIN, prevSleepBarW + 8);
                      }
                      return { r, left: cursor };
                    });
                    // totalW 需把最后一条若为睡觉的长条右端算进去，否则长条会被容器裁掉
                    const last = placed[placed.length - 1];
                    const lastSleepBarW = (last.r.type === 'sleep' && last.r.duration > 0)
                      ? Math.max(36, Math.min(last.r.duration * 1.2, 320)) : 0;
                    const totalW = last.left + ITEM_W + lastSleepBarW + 20;
                    return (
                  <div className="daytime__inner" style={{ width: totalW }}>
                    {placed.map(({ r, left }, i) => {
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
                        <div key={r.id} className={`daytime__item daytime__item--${pos} daytime__item--${meta.cls}${sleepEnd ? ' daytime__item--sleep-range' : ''}`} style={{ left: `${left}px`, ...(sleepEnd ? { '--shift': `${sleepBarW / 2}px` } : {}) }}>
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
                                <div className="daytime__time">{r.time}</div>
                                <div className="daytime__amount">{subTitle}</div>
                              </div>
                            </div>
                            {sub && <div className="daytime__note">{sub}</div>}
                            {r.recorderName && <div className="daytime__note"><span className="recorder-chip">{r.recorderName}</span></div>}
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
                  })()
                );
              })()}
            </div>
          </div>
        </Reveal>

        {/* 今日建议卡 · 四字段（建议奶量 + 建议间隔 + 下次喂养时间 + 睡眠提示）+ 喂养评估 */}
        <Reveal className="section zone zone--daily" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><Lightbulb className="icon icon--sm" /></span>
            <h2 className="section__title">今日建议</h2>
            <span className="section__hint">基于当前月龄与今日记录</span>
          </div>
          {(() => {
            // 缺数据时优雅降级
            if (!feedEval) {
              return <div className="advice-card advice-card--empty">加载中…</div>;
            }
            const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
            const now = new Date();
            const nowHM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

            // 1) 建议奶量 + 建议间隔 + 单次奶量
            const target = feedEval.effectiveTargetMilk || 0;
            const recFeeds = feedEval.recommendFeeds || (months >= 6 ? 5 : 6);
            const perFeed = feedEval.perFeedMl || (recFeeds > 0 ? target / recFeeds : 0);
            const intervalMin = recFeeds > 0 ? Math.round((24 * 60) / recFeeds) : 0;
            const fmtH = (m) => { const h = Math.floor(m/60), mm = m%60; return h > 0 ? `${h}h${String(mm).padStart(2,'0')}m` : `${mm}m`; };
            const intervalText = intervalMin > 0 ? fmtH(intervalMin) : '—';

            // 2) 下次喂养时间：今日最近一次喂养（milk/solids）+ 建议间隔；今日未喂则用当前时间
            const fedToday = feedRecords
              .filter(r => r.type === 'milk' || r.type === 'solids')
              .sort((a, b) => a.time.localeCompare(b.time));
            const lastFed = fedToday.length > 0 ? fedToday[fedToday.length - 1] : null;
            const baseTime = lastFed ? lastFed.time : nowHM;
            const nextFeedTime = intervalMin > 0 ? addMinutesHM(baseTime, intervalMin) : '—';
            const nextFeedLabel = lastFed
              ? `上次 ${lastFed.time} → 下次约 ${nextFeedTime}`
              : `今日未记录 → 下次约 ${nextFeedTime}`;

            // 3) 睡眠 SweetSpot：取今日 sleep 记录 + sleepStats（后端基于 7 天数据）算下次小睡窗口
            const sleeps = feedRecords
              .filter(r => r.type === 'sleep' && r.duration > 0)
              .sort((a, b) => a.time.localeCompare(b.time));

            // 实际平均清醒时长：优先用 sleepStats（样本≥3），否则用月龄标准
            const ssStats = sleepStats || {};
            const sampleCnt = ssStats.sampleCount || 0;
            const avgWakeMin = (sampleCnt >= 3 && ssStats.avgWakeMin) ? ssStats.avgWakeMin : null;
            // 月龄对应的标准清醒时长（兜底）
            let stdWakeMin = 120;
            if (months < 3) stdWakeMin = 60;
            else if (months < 6) stdWakeMin = 90;
            else if (months < 9) stdWakeMin = 150;
            else if (months < 12) stdWakeMin = 180;
            else if (months < 18) stdWakeMin = 210;
            else if (months < 24) stdWakeMin = 240;
            else stdWakeMin = 300;
            // 用实际平均兜底，月龄标准备用
            const wakeTargetMin = avgWakeMin || stdWakeMin;
            const wakeSrc = avgWakeMin ? '基于最近 7 天' : '月龄标准值';
            const recNaps = ssStats.recNaps || (months < 6 ? 4 : months < 9 ? 3 : months < 18 ? 2 : 1);
            const sleepSignals = ssStats.sleepSignals || ['揉眼睛', '打哈欠'];

            let sleepTip = '';
            let sleepTipKind = 'info';
            let nextSleepHM = '';
            if (sleeps.length === 0) {
              sleepTip = months < 6
                ? `小月龄清醒约 ${fmtH(wakeTargetMin)}，留意犯困信号`
                : `宝宝清醒约 ${fmtH(wakeTargetMin)} 后建议安排小睡`;
            } else {
              const last = sleeps[sleeps.length - 1];
              const wakeAt = addMinutesHM(last.time, last.duration); // 最近一次醒来
              const wakeMin = toMin(wakeAt);
              const nowMin = toMin(nowHM);
              let awakeMin = nowMin - wakeMin;
              if (awakeMin < 0) awakeMin += 24 * 60; // 跨午夜
              const nextSleepMin = wakeMin + wakeTargetMin;
              nextSleepHM = nextSleepMin >= 24 * 60 ? addMinutesHM(wakeAt, wakeTargetMin) : `${String(Math.floor(nextSleepMin/60)).padStart(2,'0')}:${String(nextSleepMin%60).padStart(2,'0')}`;
              if (awakeMin < 0) {
                sleepTip = `宝宝睡眠中，约 ${wakeAt} 醒来`;
                sleepTipKind = 'good';
              } else if (awakeMin >= wakeTargetMin + 30) {
                sleepTip = `已清醒 ${fmtH(awakeMin)}（${wakeSrc}建议 ${fmtH(wakeTargetMin)}），宝宝可能困了`;
                sleepTipKind = 'warn';
              } else if (awakeMin >= wakeTargetMin - 15) {
                sleepTip = `已清醒 ${fmtH(awakeMin)}，接近犯困窗口，约 ${nextSleepHM} 可安排小睡`;
                sleepTipKind = 'info';
              } else {
                sleepTip = `已清醒 ${fmtH(awakeMin)}，下次犯困窗口约 ${nextSleepHM}`;
                sleepTipKind = 'good';
              }
            }

            // SweetSpot 时间条：横向 24h 进度，已睡时段填充，当前时间指针，预测下次窗口
            const toPct = (min) => (min / (24 * 60)) * 100;
            const nowPct = toPct(toMin(nowHM));
            const napSegs = sleeps.map(s => {
              const sStart = toMin(s.time);
              const sEnd = sStart + s.duration;
              return { start: sStart, end: sEnd, startPct: toPct(sStart), endPct: toPct(Math.min(sEnd, 24*60)) };
            });
            // 夜间作息段（跨午夜拆成两段：入睡→24:00 和 00:00→起床）
            const nightSegs = [];
            const nbTime = ssStats.nightBedtime || profile.night_bedtime || '';
            const nwTime = ssStats.nightWakeTime || profile.night_wake_time || '';
            if (nbTime && nwTime) {
              const nb = toMin(nbTime);
              const nw = toMin(nwTime);
              if (nb >= 0 && nb < 24 * 60 && nw >= 0 && nw < 24 * 60 && nb !== nw) {
                // 入睡点在起床点之前 → 跨午夜：入睡→24:00 + 00:00→起床
                // 入睡点在起床点之后 → 不跨午夜（如 13:00 入睡 15:00 起床，午睡作息）：入睡→起床
                if (nb < nw) {
                  nightSegs.push({ start: 0, end: nw, startPct: toPct(0), endPct: toPct(nw), isNight: true });
                  nightSegs.push({ start: nb, end: 24 * 60, startPct: toPct(nb), endPct: toPct(24 * 60), isNight: true });
                } else {
                  nightSegs.push({ start: nb, end: 24 * 60, startPct: toPct(nb), endPct: toPct(24 * 60), isNight: true });
                  nightSegs.push({ start: 0, end: nw, startPct: toPct(0), endPct: toPct(nw), isNight: true });
                }
              }
            }
            const sleepSegs = [...napSegs, ...nightSegs];
            const nextSleepPct = nextSleepHM ? toPct(toMin(nextSleepHM)) : null;
            const todaySleepTotal = ssStats.todaySleepTotalMin || (sleeps.reduce((acc, s) => acc + s.duration, 0));
            const todaySleepCnt = ssStats.todaySleepCount || sleeps.length;
            const nightSleepText = (nbTime && nwTime) ? `夜间 ${nbTime}-${nwTime}` : '';

            return (
              <>
                <div className="advice-card">
                  <div className="advice-card__row">
                    <div className="advice-card__tile">
                      <span className="advice-card__ico"><Milk className="icon icon--xs" /></span>
                      <div className="advice-card__k">建议奶量</div>
                      <div className="advice-card__v">{perFeed > 0 ? `每次约 ${perFeed.toFixed(0)}ml` : '—'}</div>
                      <div className="advice-card__sub">{target > 0 ? `全天 ${target.toFixed(0)}ml · ${recFeeds} 次` : ''}</div>
                    </div>
                    <div className="advice-card__tile">
                      <span className="advice-card__ico"><Bell className="icon icon--xs" /></span>
                      <div className="advice-card__k">下次喂养</div>
                      <div className="advice-card__v">{nextFeedTime}</div>
                      <div className="advice-card__sub">{nextFeedLabel}</div>
                    </div>
                    <div className="advice-card__tile">
                      <span className="advice-card__ico"><Moon className="icon icon--xs" /></span>
                      <div className="advice-card__k">建议睡眠量</div>
                      <div className="advice-card__v">{ssStats.recSleepText || '—'}</div>
                      <div className="advice-card__sub">
                        {todaySleepTotal > 0 ? `今日已睡 ${fmtH(todaySleepTotal)}` : '含夜间 + 小睡'}
                        {nightSleepText ? ` · ${nightSleepText}` : ''}
                      </div>
                    </div>
                    <div className="advice-card__tile">
                      <span className="advice-card__ico"><Moon className="icon icon--xs" /></span>
                      <div className="advice-card__k">睡眠提示</div>
                      <div className="advice-card__v advice-card__v--sm">{sleepTip}</div>
                      <div className={`advice-card__sub advice-card__sub--${sleepTipKind}`}>{
                        sleepTipKind === 'warn' ? '该小睡了' :
                        sleepTipKind === 'good' ? '状态良好' : '犯困窗口'
                      }</div>
                    </div>
                  </div>
                  {/* SweetSpot 时间条 */}
                  <div className="advice-card__sweetspot">
                    <div className="sweetspot__legend">
                      <span className="sweetspot__legend-item"><i className="sweetspot__dot sweetspot__dot--sleep"></i>今日睡眠 {fmtH(todaySleepTotal)} · {todaySleepCnt}/{recNaps} 次{nightSleepText ? ` · ${nightSleepText}` : ''}</span>
                      <span className="sweetspot__legend-item"><i className="sweetspot__dot sweetspot__dot--win"></i>预测窗口 {nextSleepHM || '—'}</span>
                      <button
                        className="btn btn--ghost btn--sm sweetspot__routine"
                        onClick={() => setNightModal({ bedtime: profile.night_bedtime || '', wake: profile.night_wake_time || '' })}
                        title="设置夜间作息时间"
                      >
                        <Moon className="icon icon--xs" />作息
                      </button>
                    </div>
                    <div className="sweetspot__bar">
                      {sleepSegs.map((seg, i) => (
                        <div
                          key={i}
                          className={`sweetspot__seg${seg.isNight ? ' sweetspot__seg--night' : ''}`}
                          style={{ left: `${seg.startPct}%`, width: `${seg.endPct - seg.startPct}%` }}
                        />
                      ))}
                      {nextSleepPct !== null && (
                        <div className="sweetspot__win" style={{ left: `${nextSleepPct}%` }} />
                      )}
                      <div className="sweetspot__now" style={{ left: `${nowPct}%` }} />
                      <div className="sweetspot__ticks">
                        {[0, 6, 12, 18, 24].map(h => (
                          <span key={h} className="sweetspot__tick" style={{ left: `${(h/24)*100}%` }}>{String(h).padStart(2,'0')}</span>
                        ))}
                      </div>
                    </div>
                    <div className="sweetspot__signals">
                      <span className="sweetspot__signals-label">犯困信号</span>
                      {sleepSignals.map((sig, i) => (
                        <span key={i} className="sweetspot__sig-chip">{sig}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 喂养评估（从原「今日记录」section 迁移至此） */}
                {feedEval && (
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
              </>
            );
          })()}
        </Reveal>

        {/* 每日照护清单 */}
        <Reveal className="section zone zone--daily" delay={0.05}>
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
        <Reveal className="section zone zone--daily" delay={0.05}>
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
                        {r.recorderName && <span className="recorder-chip">{r.recorderName}</span>}
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
        <Reveal className="section zone zone--daily" delay={0.05}>
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

        <Reveal className="section zone zone--growth" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><BookOpen className="icon icon--sm" /></span>
            <h2 className="section__title">早教活动</h2>
          </div>
          <ActList items={activities} onPlay={(a) => setModal({ open: true, title: a.title, src: a.videoUrl || '' })} />
        </Reveal>

        {/* 成长区 · 疫苗日历（国家免疫规划 + 自费推荐） */}
        <Reveal className="section zone zone--growth" delay={0.08}>
          <div className="section__head">
            <span className="section__ico section__ico--coral"><Syringe className="icon icon--sm" /></span>
            <h2 className="section__title">疫苗日历</h2>
            <span className="section__hint">国家免疫规划 · {vaccines.filter(v => v.status === 'administered').length}/{vaccines.length} 已接种</span>
          </div>
          {vaccines.length === 0 ? (
            <div className="section__sub">加载中...</div>
          ) : (
            <>
              {/* 统计条 · 可点击切换显示 */}
              {(() => {
                const done = vaccines.filter(v => v.status === 'administered').length;
                const overdue = vaccines.filter(v => v.status === 'overdue').length;
                const upcoming = vaccines.filter(v => v.status === 'upcoming').length;
                const pending = vaccines.filter(v => v.status === 'pending').length;
                const action = overdue + pending;
                const chip = (key, label, count, modifier) => (
                  <button
                    type="button"
                    className={`vax-summary__item vax-summary__item--btn ${modifier} ${vxFilter === key ? 'vax-summary__item--active' : ''}`}
                    onClick={() => setVxFilter(prev => prev === key ? 'all' : key)}
                    title={vxFilter === key ? '再次点击显示全部' : `只显示${label}`}
                  >
                    {label} {count}
                  </button>
                );
                return (
                  <div className="vax-summary">
                    {chip('action', '需接种', action, 'vax-summary__item--action')}
                    {chip('administered', '已接种', done, 'vax-summary__item--done')}
                    {chip('upcoming', '未到月龄', upcoming, 'vax-summary__item--upcoming')}
                    {vxFilter === 'all' && <span className="vax-summary__item vax-summary__item--all">全部 {vaccines.length}</span>}
                  </div>
                );
              })()}
              {/* 疫苗列表：按月龄分组（按 vxFilter 过滤） */}
              {(() => {
                const visible = vaccines.filter(v => {
                  if (vxFilter === 'all') return true;
                  if (vxFilter === 'action') return v.status === 'overdue' || v.status === 'pending';
                  return v.status === vxFilter;
                });
                if (visible.length === 0) {
                  return <div className="vax-empty">该筛选下暂无疫苗</div>;
                }
                const groups = {};
                visible.forEach(v => {
                  const m = v.month;
                  if (!groups[m]) groups[m] = [];
                  groups[m].push(v);
                });
                const monthLabel = (m) => {
                  if (m === 0) return '出生时';
                  if (m < 12) return `${m} 月龄`;
                  if (m === 12) return '1 岁';
                  if (m < 24) return `${m} 月龄`;
                  const y = Math.floor(m / 12);
                  return m % 12 === 0 ? `${y} 岁` : `${y} 岁 ${m % 12} 月`;
                };
                return Object.keys(groups).sort((a, b) => Number(a) - Number(b)).map(m => (
                  <div key={m} className="vax-group">
                    <div className="vax-group__head">{monthLabel(Number(m))}</div>
                    <div className="vax-group__list">
                      {groups[m].map(v => (
                        <div key={v.id} className={`vax-card vax-card--${v.status}`}>
                          <div className="vax-card__main">
                            <div className="vax-card__name">
                              {v.name}
                              <span className="vax-card__seq">第 {v.seq} 剂</span>
                              {!v.isNip && <span className="vax-card__tag">自费</span>}
                            </div>
                            <div className="vax-card__prevent">预防：{v.prevent}</div>
                            <div className="vax-card__note">{v.note}</div>
                            {v.status === 'administered' && v.administeredDate && (
                              <div className="vax-card__date">
                                {v.coveredBy ? `已由${v.coveredBy}覆盖 · ${v.administeredDate}` : `已接种 · ${v.administeredDate}`}
                                {v.note && !v.coveredBy && ' · ' + v.note}
                                {v.recorderName && <span className="recorder-chip">{v.recorderName}</span>}
                              </div>
                            )}
                          </div>
                          <div className="vax-card__action">
                            {v.status === 'administered' ? (
                              v.coveredBy ? (
                                <span className="vax-card__covered-hint" title={`该剂次已由${v.coveredBy}覆盖，如需修改请撤销对应五联记录`}>五联覆盖</span>
                              ) : (
                                <button className="vax-btn vax-btn--undo" onClick={() => unmarkVaccine(v.recordId)}>撤销</button>
                              )
                            ) : (
                              <button className="vax-btn vax-btn--mark" onClick={() => setVaccineModal({ vaccine: v, administeredDate: suggestDate(profile.birthday, v.month), note: '' })}>标记接种</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </>
          )}
        </Reveal>

        {/* 成长区 · 里程碑打卡（4 大领域发育追踪） */}
        <Reveal className="section zone zone--growth" delay={0.11}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><Activity className="icon icon--sm" /></span>
            <h2 className="section__title">里程碑打卡</h2>
            <span className="section__hint">CDC 发育里程碑 · {milestones.filter(m => m.status === 'achieved').length}/{milestones.length} 已达成</span>
          </div>
          {milestones.length === 0 ? (
            <div className="section__sub">加载中...</div>
          ) : (
            <>
              {/* 统计条 · 可点击切换显示 */}
              {(() => {
                const achieved = milestones.filter(m => m.status === 'achieved').length;
                const pending = milestones.filter(m => m.status === 'pending').length;
                const upcoming = milestones.filter(m => m.status === 'upcoming').length;
                const redFlagPending = milestones.filter(m => m.red_flag && m.status === 'pending').length;
                const chip = (key, label, count, modifier) => (
                  <button
                    key={key}
                    type="button"
                    className={`ms-summary__item ms-summary__item--btn ${modifier} ${msFilter === key ? 'ms-summary__item--active' : ''}`}
                    onClick={() => setMsFilter(prev => (prev === key ? 'all' : key))}
                    title={msFilter === key ? '再次点击显示全部' : `只显示${label}`}
                  >
                    {label} {count}
                  </button>
                );
                return (
                  <div className="ms-summary">
                    {chip('achieved', '已达成', achieved, 'ms-summary__item--done')}
                    {chip('pending', '待打卡', pending, 'ms-summary__item--pending')}
                    {chip('upcoming', '未到月龄', upcoming, 'ms-summary__item--upcoming')}
                    {msFilter === 'all' && <span className="ms-summary__item ms-summary__item--all">全部 {milestones.length}</span>}
                    {redFlagPending > 0 && <span className="ms-summary__item ms-summary__item--alert">⚠ 警惕 {redFlagPending}</span>}
                  </div>
                );
              })()}
              {/* 按领域分组（按 msFilter 过滤） */}
              {(() => {
                const DOMAIN_META = {
                  motor: { label: '粗大动作', icon: 'Footprints' },
                  fine: { label: '精细动作', icon: 'Hand' },
                  language: { label: '语言', icon: 'MessageCircle' },
                  social: { label: '社交情感', icon: 'Smile' },
                };
                const domains = ['motor', 'fine', 'language', 'social'];
                const visible = milestones.filter(m => msFilter === 'all' ? true : m.status === msFilter);
                if (visible.length === 0) {
                  return <div className="ms-empty">当前筛选下没有里程碑</div>;
                }
                return domains.map(dom => {
                  const items = visible.filter(m => m.domain === dom).sort((a, b) => a.month - b.month);
                  if (items.length === 0) return null;
                  const meta = DOMAIN_META[dom];
                  const IconCmp = { Footprints, Hand, MessageCircle, Smile }[meta.icon];
                  const domDone = milestones.filter(m => m.domain === dom && m.status === 'achieved').length;
                  const domTotal = milestones.filter(m => m.domain === dom).length;
                  const domPct = domTotal > 0 ? Math.round(domDone / domTotal * 100) : 0;
                  return (
                    <div key={dom} className="ms-domain">
                      <div className="ms-domain__head">
                        <IconCmp className="icon icon--sm" />
                        <span className="ms-domain__label">{meta.label}</span>
                        <span className="ms-domain__count">{domDone}/{domTotal}</span>
                        <span className="ms-domain__bar"><span style={{ width: domPct + '%' }} /></span>
                      </div>
                      <div className="ms-domain__list">
                        {items.map(m => {
                          const isExpanded = msExpandedId === m.id;
                          const monthsToGo = m.month - months;
                          return (
                            <div
                              key={m.id}
                              className={`ms-card ms-card--${m.status}${m.red_flag ? ' ms-card--alert' : ''}${isExpanded ? ' ms-card--expanded' : ''}`}
                            >
                              <div className="ms-card__main" onClick={() => setMsExpandedId(isExpanded ? null : m.id)} style={{ cursor: 'pointer' }}>
                                <div className="ms-card__desc">
                                  {m.desc}
                                  {m.red_flag && <span className="ms-card__flag" title="该里程碑未达成需警惕，建议咨询儿科医生">⚠ 警惕</span>}
                                </div>
                                <div className="ms-card__month">
                                  多数 {m.month} 月达成
                                  {m.status === 'upcoming' && monthsToGo > 0 && (
                                    <span className="ms-card__wait">还有 {monthsToGo} 月</span>
                                  )}
                                  {m.status === 'pending' && m.red_flag && monthsToGo >= -2 && (
                                    <span className="ms-card__wait ms-card__wait--alert">已到月龄 ±2 月窗口</span>
                                  )}
                                </div>
                                {m.status === 'achieved' && m.achievedDate && (
                                  <div className="ms-card__date">已达成 · {m.achievedDate}{m.note && ' · ' + m.note}{m.recorderName && <span className="recorder-chip">{m.recorderName}</span>}</div>
                                )}
                                {isExpanded && (
                                  <div className="ms-card__detail">
                                    <div className="ms-card__detail-row">
                                      <strong>发育窗口：</strong>多数宝宝 {m.month} 月达成，±2 月内都属正常范围。
                                    </div>
                                    {m.red_flag && (
                                      <div className="ms-card__detail-row ms-card__detail-row--alert">
                                        <strong>警惕项：</strong>该里程碑为 CDC 标注的「红旗」指标，若逾期未达成，建议咨询儿科医生做进一步评估。
                                      </div>
                                    )}
                                    <div className="ms-card__detail-row">
                                      <strong>下一步：</strong>
                                      {(() => {
                                        const next = milestones.find(x => x.domain === dom && x.month > m.month && x.status !== 'achieved');
                                        if (!next) return '已是该领域当前月龄最高的里程碑。';
                                        const gap = next.month - m.month;
                                        return `下一项「${next.desc}」约 ${next.month} 月达成（${gap > 0 ? `约 ${gap} 月后` : '已到月龄'}）。`;
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="ms-card__action">
                                {m.status === 'achieved' ? (
                                  <button className="ms-btn ms-btn--undo" onClick={() => unmarkMilestone(m.recordId)}>撤销</button>
                                ) : (
                                  <button
                                    className="ms-btn ms-btn--mark"
                                    disabled={m.status === 'upcoming'}
                                    onClick={() => setMilestoneModal({ milestone: m, achievedDate: suggestDate(profile.birthday, m.month), note: '' })}
                                  >{m.status === 'upcoming' ? '未到月龄' : '打卡'}</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </>
          )}
        </Reveal>

        <Reveal className="section zone zone--daily" delay={0.08}>
          <div className="section__head">
            <span className="section__ico section__ico--violet"><Music className="icon icon--sm" /></span>
            <h2 className="section__title">音乐区</h2>
          </div>
          <ActList items={music} onPlay={(a) => setModal({ open: true, title: a.title, src: a.videoUrl || '' })} />
        </Reveal>

        {months >= 6 && stories.length > 0 && (
          <Reveal className="section zone zone--daily" delay={0.11}>
            <div className="section__head">
              <span className="section__ico section__ico--honey"><BookOpen className="icon icon--sm" /></span>
              <h2 className="section__title">绘本推荐</h2>
              <span className="section__hint">每日精选 · 共读示范</span>
            </div>
            <ActList items={stories} onPlay={(a) => setModal({ open: true, title: `${a.title} · 共读示范`, src: a.videoUrl || '' })} />
          </Reveal>
        )}
      </div>

      {/* 出行区：目的地推荐 → 打包清单 → 出行历史 */}
      {activeZone === 'travel' && (
        <div className="zone zone--travel wrap">
          <div className="section" style={{ opacity: 1, transform: 'none' }}>
            <div className="section__head">
              <span className="section__ico section__ico--coral"><MapPin className="icon icon--sm" /></span>
              <h2 className="section__title">带娃出行</h2>
            </div>

            {/* 子 Tab：目的地推荐 / 打包清单 / 出行历史 */}
            <div className="travel-subtabs">
              <button className={`travel-subtab ${travelTab === 'reco' ? 'is-on' : ''}`} onClick={() => setTravelTab('reco')}>
                目的地推荐
              </button>
              <button className={`travel-subtab ${travelTab === 'list' ? 'is-on' : ''}`} onClick={() => setTravelTab('list')}>
                打包清单
              </button>
              <button className={`travel-subtab ${travelTab === 'history' ? 'is-on' : ''}`} onClick={() => setTravelTab('history')}>
                出行历史
              </button>
            </div>

            {/* ---------- 目的地推荐 ---------- */}
            {travelTab === 'reco' && (
              <div className="travel-panel travel-reco">
                {/* 打卡进度条 */}
                <div className="reco-stats">
                  <div className="reco-stats__nums">
                    <span className="reco-stats__v">{recoStats.visited}</span>
                    <span className="reco-stats__sep">/</span>
                    <span className="reco-stats__t">{recoStats.total}</span>
                    <span className="reco-stats__label">已打卡</span>
                  </div>
                  <div className="reco-stats__pct">{recoStats.percent}%</div>
                </div>
                <div className="reco-progress"><div style={{ width: recoStats.percent + '%' }} /></div>

                {/* 当前月龄提示 */}
                <div className="reco-age-tag">
                  <Sparkles className="icon icon--xs" />
                  <span>当前 {ageMonthsLabel(recoMonths)} · {getBandLabel(recoMonths).split('（')[1]?.replace('）', '') || ''} · 星级按月龄自动推荐</span>
                </div>

                {/* SVG 深圳地图：点击点位打开地点详情卡片，与下方筛选联动 */}
                <TravelMap
                  months={recoMonths}
                  visitedSpotNames={visitedSpotNames}
                  onSpotClick={(s) => setSpotModal({ spot: s })}
                  filter={{ district: recoDistrict, category: recoCategory, star: recoStar, visited: recoVisited, matched: (recoDistrict !== 'all' || recoCategory !== 'all' || recoStar !== 'all' || recoVisited !== 'all') ? new Set(filteredSpots.map(s => s.id)) : null }}                />

                {/* 筛选器：类型(首行，默认公园) + 区 + 出行状态 + 星级 */}
                <div className="reco-filters">
                  <div className="reco-filter-row reco-filter-row--cat">
                    <button className={`reco-chip reco-chip--cat ${recoCategory === 'all' ? 'is-on' : ''}`} onClick={() => setRecoCategory('all')}>全部类型</button>
                    {CATEGORIES.map(c => (
                      <button key={c.value} className={`reco-chip reco-chip--cat ${recoCategory === c.value ? 'is-on' : ''}`} onClick={() => setRecoCategory(c.value)}>{c.emoji} {c.label}</button>
                    ))}
                  </div>
                  <div className="reco-filter-row">
                    <button className={`reco-chip ${recoDistrict === 'all' ? 'is-on' : ''}`} onClick={() => setRecoDistrict('all')}>全部区</button>
                    {DISTRICTS.map(d => (
                      <button key={d.name} className={`reco-chip ${recoDistrict === d.name ? 'is-on' : ''}`} onClick={() => setRecoDistrict(d.name)}>{d.name}</button>
                    ))}
                  </div>
                  <div className="reco-filter-row reco-filter-row--visited">
                    <button className={`reco-chip reco-chip--visited ${recoVisited === 'all' ? 'is-on' : ''}`} onClick={() => setRecoVisited('all')}>全部</button>
                    <button className={`reco-chip reco-chip--visited ${recoVisited === 'visited' ? 'is-on' : ''}`} onClick={() => setRecoVisited('visited')}>去过 ✓</button>
                    <button className={`reco-chip reco-chip--visited ${recoVisited === 'unvisited' ? 'is-on' : ''}`} onClick={() => setRecoVisited('unvisited')}>没去过</button>
                  </div>
                  <div className="reco-filter-row reco-filter-row--star">
                    <button className={`reco-chip reco-chip--star ${recoStar === 'all' ? 'is-on' : ''}`} onClick={() => setRecoStar('all')}>全部星级</button>
                    {[5,4,3,2,1].map(n => (
                      <button key={n} className={`reco-chip reco-chip--star ${recoStar === n ? 'is-on' : ''}`} onClick={() => setRecoStar(n)}>{'★'.repeat(n)}</button>
                    ))}
                  </div>
                </div>

                {/* 地点卡片列表 */}
                {filteredSpots.length === 0 ? (
                  <p className="travel-empty">当前筛选没有匹配的地点</p>
                ) : (
                  <div className="reco-cards">
                    {filteredSpots.map(s => {
                      const visited = visitedSpotNames.has(s.name);
                      const stars = starsForAge(s, recoMonths);
                      return (
                        <div key={s.id} className={`reco-card ${visited ? 'is-visited' : ''}`}>
                          <div className="reco-card__head">
                            <span className="reco-card__name">{s.name}</span>
                            {s.category && <span className="reco-card__cat">{categoryEmoji(s.category)} {categoryLabel(s.category)}</span>}
                            <span className="reco-card__dist">{s.district}</span>
                            {stars > 0 && <span className="reco-card__stars">{'★'.repeat(stars)}<span className="reco-card__stars-dim">{'★'.repeat(5 - stars)}</span></span>}
                          </div>
                          {s.feel && <div className="reco-card__feel">{s.feel}</div>}
                          <div className="reco-card__reason"><span className="reco-card__reason-label">推荐理由</span>{reasonForAge(s, recoMonths)}</div>
                          <div className="reco-card__actions">
                            {visited ? (
                              <span className="reco-card__visited">已出行 ✓</span>
                            ) : (
                              <button className="btn btn--primary btn--sm" onClick={() => openMarkModal(s)}>
                                标记出行
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------- 打包清单 ---------- */}
            {travelTab === 'list' && (
              <div className="travel-panel">
                {/* 清单编辑态 */}
                {travelListDraft ? (
                  <div className="travel-list-edit">
                    <div className="travel-list-edit__bar">
                      <label className="travel-list-edit__label">
                        目的地类型：
                        <select value={travelListDraft.dest_type} onChange={(e) => changeTravelListType(e.target.value)}>
                          <option value="daily">日常遛弯</option>
                          <option value="short">短途（&lt;3天）</option>
                          <option value="long">长途（&gt;3天）</option>
                          <option value="abroad">出境</option>
                        </select>
                      </label>
                      <span className="travel-list-edit__age">月龄参考：{ageBucket(travelListDraft.age_months || months || 0)}</span>
                      <button className="btn btn--ghost btn--sm" onClick={() => setTravelListDraft(null)}>取消</button>
                      <button className="btn btn--primary btn--sm" disabled={travelLoading} onClick={saveTravelList}>
                        {travelLoading ? '保存中…' : '保存清单'}
                      </button>
                    </div>
                    {/* 按类别分组 */}
                    {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                      const catItems = travelListDraft.items.map((it, i) => ({ ...it, _idx: i })).filter(it => it.cat === cat);
                      if (!catItems.length) return null;
                      return (
                        <div key={cat} className="travel-list-cat">
                          <div className="travel-list-cat__head">{label}</div>
                          {catItems.map(it => (
                            <label key={it._idx} className={`travel-item ${it.checked ? 'is-checked' : ''}`}>
                              <input type="checkbox" checked={it.checked} onChange={() => toggleTravelItem(it._idx)} />
                              <span className="travel-item__name">{it.name}</span>
                              {it.custom && <span className="travel-item__tag">自定义</span>}
                              <button className="travel-item__del" onClick={(e) => { e.preventDefault(); removeTravelItem(it._idx); }} title="移除">
                                <Trash2 className="icon icon--xs" />
                              </button>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                    {/* 新增自定义项 */}
                    <TravelAddCustom onAdd={(cat, name) => addCustomTravelItem(cat, name)} />
                  </div>
                ) : (
                  /* 清单列表态 */
                  <div className="travel-list-home">
                    <button className="travel-add-btn" onClick={startNewTravelList}>
                      <Plus className="icon icon--sm" /> 新建打包清单
                    </button>
                    {travelLists.length === 0 ? (
                      <p className="travel-empty">还没有打包清单，点上方按钮新建一份吧～</p>
                    ) : (
                      <div className="travel-list-cards">
                        {travelLists.map(l => {
                          let items = []; try { items = JSON.parse(l.items || '[]'); } catch (e) {}
                          const total = items.length;
                          const done = items.filter(i => i.checked).length;
                          const pct = total ? Math.round(done / total * 100) : 0;
                          const typeLabel = { daily: '日常遛弯', short: '短途', long: '长途', abroad: '出境' }[l.dest_type] || '出行';
                          return (
                            <div key={l.id} className="travel-list-card">
                              <div className="travel-list-card__head">
                                <span className="travel-list-card__type">{typeLabel}</span>
                                <span className="travel-list-card__age">{l.age_months || 0}月龄</span>
                                <span className="travel-list-card__pct">{pct}%</span>
                                {l.recorderName && <span className="recorder-chip">· {l.recorderName}</span>}
                              </div>
                              <div className="travel-list-card__bar"><div style={{ width: pct + '%' }} /></div>
                              <div className="travel-list-card__sum">{done}/{total} 已备齐</div>
                              <div className="travel-list-card__actions">
                                <button className="btn btn--ghost btn--sm" onClick={() => editTravelList(l)}>编辑/勾选</button>
                                <button className="btn btn--ghost btn--sm" onClick={() => delTravelList(l.id)}>删除</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ---------- 出行历史 ---------- */}
            {travelTab === 'history' && (
              <div className="travel-panel">
                {/* 记录表单 */}
                <div className="travel-rec-form">
                  <div className="travel-rec-form__title">{editingTravelRecordId ? '编辑出行记录' : '记录一次出行'}</div>
                  <div className="travel-rec-form__grid">
                    <label className="field">
                      <span>目的地</span>
                      <input value={travelRecordDraft.dest_name} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, dest_name: e.target.value })} placeholder="如：外婆家 / 三亚 / 大梅沙" />
                    </label>
                    <label className="field">
                      <span>类型</span>
                      <select value={travelRecordDraft.dest_type} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, dest_type: e.target.value })}>
                        <option value="daily">日常遛弯</option>
                        <option value="short">短途</option>
                        <option value="long">长途</option>
                        <option value="abroad">出境</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>地点类型</span>
                      <select value={travelRecordDraft.category} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, category: e.target.value })}>
                        <option value="">不指定</option>
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>出行日期</span>
                      <input type="date" value={travelRecordDraft.travel_date} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, travel_date: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>评分（按月龄自动）</span>
                      <div className="stars stars--readonly">
                        {[1,2,3,4,5].map(n => (
                          <span key={n} className={`star ${n <= travelRecordDraft.rating ? 'is-on' : ''}`}>★</span>
                        ))}
                      </div>
                    </label>
                  </div>
                  <label className="field">
                    <span>备注</span>
                    <textarea rows={2} value={travelRecordDraft.note} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, note: e.target.value })} placeholder="宝宝表现 / 有趣的事 / 注意事项" />
                  </label>
                  <div className="travel-rec-form__actions">
                    {editingTravelRecordId && <button className="btn btn--ghost btn--sm" onClick={() => { setEditingTravelRecordId(null); setTravelRecordDraft({ dest_name: '', dest_type: 'short', category: '', travel_date: todayISO(), age_months: 0, rating: 0, note: '' }); }}>取消编辑</button>}
                    <button className="btn btn--primary btn--sm" disabled={travelLoading} onClick={saveTravelRecord}>
                      {travelLoading ? '保存中…' : editingTravelRecordId ? '更新记录' : '保存记录'}
                    </button>
                  </div>
                </div>

                {/* 历史列表 */}
                {travelRecords.length === 0 ? (
                  <p className="travel-empty">还没有出行记录，记录宝宝第一次坐高铁、第一次看海吧～</p>
                ) : (
                  <div className="travel-rec-list">
                    {[...travelRecords].sort((a,b) => (b.travel_date||'').localeCompare(a.travel_date||'')).map(r => {
                      const typeLabel = { daily: '日常遛弯', short: '短途', long: '长途', abroad: '出境' }[r.dest_type] || '出行';
                      return (
                        <div key={r.id} className="travel-rec-card">
                          <div className="travel-rec-card__head">
                            <span className="travel-rec-card__name">{r.dest_name}</span>
                            {r.category && <span className="travel-rec-card__cat">{categoryEmoji(r.category)} {categoryLabel(r.category)}</span>}
                            <span className="travel-rec-card__type">{typeLabel}</span>
                            <span className="travel-rec-card__date">{r.travel_date}</span>
                          </div>
                          {r.rating > 0 && (
                            <div className="travel-rec-card__stars">{'★'.repeat(r.rating)}<span className="travel-rec-card__stars-dim">{'★'.repeat(5 - r.rating)}</span></div>
                          )}
                          {r.note && <div className="travel-rec-card__note">{r.note}</div>}
                          <div className="travel-rec-card__meta">时 {r.age_months || 0} 月龄{r.recorderName && <span className="recorder-chip">{r.recorderName}</span>}</div>
                          <div className="travel-rec-card__actions">
                            <button className="btn btn--ghost btn--sm" onClick={() => editTravelRecord(r)}>编辑</button>
                            <button className="btn btn--ghost btn--sm" onClick={() => delTravelRecord(r.id)}>删除</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---------- 目的地推荐（占位） ---------- */}
          </div>
        </div>
      )}

      <VideoModal open={modal.open} title={modal.title} src={modal.src || ''} onClose={() => setModal({ open: false, title: '', src: '' })} />

      {/* 添加记录弹窗（从原「今日记录」section 抽出，由「宝宝的一天」标题处按钮唤起） */}
      {recordModalOpen && (
        <div className="modal modal--record" onClick={(e) => { if (e.target === e.currentTarget) setRecordModalOpen(false); }}>
          <div className="modal__card modal__card--record">
            <div className="modal__head">
              <h3 className="modal__title">{editingId ? '编辑记录' : '添加记录'}</h3>
              <button className="modal__close" onClick={() => { setRecordModalOpen(false); cancelEdit(); }}><X className="icon icon--sm" /></button>
            </div>
            <div className="modal__body">
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
                  <div className="feed__log-field feed__log-field--seg">
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
                  <div className="record-modal__actions">
                    <button className="btn btn--primary btn--sm" onClick={addFeedRecord} disabled={feedLoading}>
                      {feedLoading ? <Loader2 className="icon icon--xs animate-spin" /> : <Save className="icon icon--xs" />}
                      更新
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => { cancelEdit(); setRecordModalOpen(false); }}>取消</button>
                  </div>
                ) : (
                  <div className="record-modal__actions">
                    <button className="btn btn--primary btn--sm" onClick={addFeedRecord} disabled={feedLoading}>
                      {feedLoading ? <Loader2 className="icon icon--xs animate-spin" /> : <Plus className="icon icon--xs" />}
                      添加
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setRecordModalOpen(false)}>关闭</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 疫苗标记弹窗 */}
      {vaccineModal && (
        <div className="modal modal--vax" onClick={(e) => { if (e.target === e.currentTarget) setVaccineModal(null); }}>
          <div className="modal__card modal__card--fm">
            <div className="modal__head">
              <h3 className="modal__title">标记接种 · {vaccineModal.vaccine.name}（第 {vaccineModal.vaccine.seq} 剂）</h3>
              <button className="modal__close" onClick={() => setVaccineModal(null)}><X className="icon icon--sm" /></button>
            </div>
            <div className="modal__body">
              <div className="form-row">
                <label className="form-label">接种日期</label>
                <input
                  type="date"
                  className="input"
                  value={vaccineModal.administeredDate}
                  onChange={(e) => setVaccineModal({ ...vaccineModal, administeredDate: e.target.value })}
                />
                <div className="form-hint">{(() => {
                  const today = todayISO();
                  const suggested = suggestDate(profile.birthday, vaccineModal.vaccine.month);
                  const lbl = fmtCNDate(suggested);
                  if (suggested < today) return `建议接种日 ${lbl} 已过，请按实际接种日修改`;
                  if (suggested === today) return `今日为建议接种日（${vaccineModal.vaccine.month} 月龄），可按实际修改`;
                  return `默认为宝宝 ${vaccineModal.vaccine.month} 月龄的建议日期 ${lbl}，可修改`;
                })()}</div>
              </div>
              <div className="form-row">
                <label className="form-label">备注（可选）</label>
                <input
                  type="text"
                  className="input"
                  placeholder="如：在社区卫生服务中心打"
                  value={vaccineModal.note}
                  onChange={(e) => setVaccineModal({ ...vaccineModal, note: e.target.value })}
                />
              </div>
              <div className="vax-modal__hint">
                预防：{vaccineModal.vaccine.prevent}<br />
                {vaccineModal.vaccine.note}
              </div>
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost" onClick={() => setVaccineModal(null)}>取消</button>
              <button
                className="btn btn--primary"
                disabled={!vaccineModal.administeredDate}
                onClick={() => {
                  markVaccine(vaccineModal.vaccine.id, vaccineModal.administeredDate, vaccineModal.note);
                  setVaccineModal(null);
                }}
              >确认接种</button>
            </div>
          </div>
        </div>
      )}

      {/* 里程碑打卡弹窗 */}
      {milestoneModal && (
        <div className="modal modal--ms" onClick={(e) => { if (e.target === e.currentTarget) setMilestoneModal(null); }}>
          <div className="modal__card modal__card--fm">
            <div className="modal__head">
              <h3 className="modal__title">里程碑打卡</h3>
              <button className="modal__close" onClick={() => setMilestoneModal(null)}><X className="icon icon--sm" /></button>
            </div>
            <div className="modal__body">
              <div className="ms-modal__desc">{milestoneModal.milestone.desc}</div>
              <div className="ms-modal__meta">多数宝宝 {milestoneModal.milestone.month} 月达成 · 该领域发育追踪</div>
              {milestoneModal.milestone.red_flag && (
                <div className="ms-modal__alert">⚠ 该里程碑未达成需警惕，建议咨询儿科医生</div>
              )}
              <div className="form-row">
                <label className="form-label">首达日期</label>
                <input
                  type="date"
                  className="input"
                  value={milestoneModal.achievedDate}
                  onChange={(e) => setMilestoneModal({ ...milestoneModal, achievedDate: e.target.value })}
                />
                <div className="form-hint">{(() => {
                  const today = todayISO();
                  const suggested = suggestDate(profile.birthday, milestoneModal.milestone.month);
                  const lbl = fmtCNDate(suggested);
                  if (suggested < today) return `建议达成日 ${lbl} 已过，请按实际首达日修改`;
                  if (suggested === today) return `今日为建议达成日（${milestoneModal.milestone.month} 月龄），可按实际修改`;
                  return `默认为宝宝 ${milestoneModal.milestone.month} 月龄的建议日期 ${lbl}，可修改`;
                })()}</div>
              </div>
              <div className="form-row">
                <label className="form-label">备注（可选）</label>
                <input
                  type="text"
                  className="input"
                  placeholder="如：第一次翻身"
                  value={milestoneModal.note}
                  onChange={(e) => setMilestoneModal({ ...milestoneModal, note: e.target.value })}
                />
              </div>
            </div>
            <div className="modal__foot">
              <button className="btn btn--ghost" onClick={() => setMilestoneModal(null)}>取消</button>
              <button
                className="btn btn--primary"
                disabled={!milestoneModal.achievedDate}
                onClick={() => {
                  markMilestone(milestoneModal.milestone.id, milestoneModal.achievedDate, milestoneModal.note);
                  setMilestoneModal(null);
                }}
              >确认达成</button>
            </div>
          </div>
        </div>
      )}

      {/* 地点详情弹窗（从地图点位点击打开） */}
      {spotModal && (() => {
        const s = spotModal.spot;
        const visited = visitedSpotNames.has(s.name);
        const stars = starsForAge(s, recoMonths);
        return (
          <div className="modal modal--spot" role="dialog" aria-modal="true">
            <div className="modal__backdrop" onClick={() => setSpotModal(null)} />
            <div className="modal__card modal__card--spot">
              <button className="modal__close" onClick={() => setSpotModal(null)} aria-label="关闭"><X className="icon icon--sm" /></button>
              <div className="spot-head">
                <div className="spot-head__badge">{s.district}</div>
                <h3 className="spot-head__name">{s.name}</h3>
                <div className="spot-head__sub">
                  {ageMonthsLabel(recoMonths)} · 当前推荐
                  {stars > 0 && <span className="spot-head__stars">{'★'.repeat(stars)}<span className="spot-head__stars-dim">{'★'.repeat(5 - stars)}</span></span>}
                  {visited && <span className="spot-head__visited">已出行 ✓</span>}
                </div>
              </div>
              <div className="spot-body">
                {s.feel && (
                  <div className="spot-section">
                    <div className="spot-section__label">口碑</div>
                    <p className="spot-section__text spot-section__text--feel">{s.feel}</p>
                  </div>
                )}
                <div className="spot-section">
                  <div className="spot-section__label">推荐理由</div>
                  <p className="spot-section__text">{reasonForAge(s, recoMonths)}</p>
                </div>
                <div className="spot-section spot-section--band">
                  <div className="spot-section__label">月龄星级</div>
                  <div className="spot-band">
                    {AGE_BANDS.map((b, i) => {
                      const st = s.ratings[i] || 0;
                      const isCur = getBandIdx(recoMonths) === i;
                      return (
                        <div key={i} className={`spot-band__item ${isCur ? 'is-cur' : ''} ${st === 0 ? 'is-zero' : ''}`}>
                          <span className="spot-band__label">{b.label.split('（')[0]}</span>
                          <span className="spot-band__stars">{st > 0 ? '★'.repeat(st) : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="spot-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setSpotModal(null)}>关闭</button>
                <button className="btn btn--primary btn--sm" onClick={() => { openMarkModal(s); setSpotModal(null); }}>
                  {visited ? '再记一次' : '标记出行'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 标记出行弹窗（从地点详情"标记出行"按钮进入） */}
      {markModal && (
        <div className="modal modal--mark" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setMarkModal(null)} />
          <div className="modal__card modal__card--mark">
            <button className="modal__close" onClick={() => setMarkModal(null)} aria-label="关闭"><X className="icon icon--sm" /></button>
            <div className="mark-head">
              <div className="mark-head__badge">标记出行</div>
              <h3 className="mark-head__name">{markModal.spot.name}</h3>
              <div className="mark-head__sub">{markModal.spot.district} · {ageMonthsLabel(recoMonths)}</div>
            </div>
            <div className="mark-body">
              <label className="field">
                <span>出行日期</span>
                <input type="date" value={travelRecordDraft.travel_date} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, travel_date: e.target.value })} />
              </label>
              <label className="field">
                <span>类型</span>
                <select value={travelRecordDraft.dest_type} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, dest_type: e.target.value })}>
                  <option value="daily">日常遛弯</option>
                  <option value="short">短途</option>
                  <option value="long">长途</option>
                  <option value="abroad">出境</option>
                </select>
              </label>
              <label className="field">
                <span>地点类型</span>
                <select value={travelRecordDraft.category} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, category: e.target.value })}>
                  <option value="">不指定</option>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>评分（按月龄自动）</span>
                <div className="stars stars--readonly">
                  {[1,2,3,4,5].map(n => (
                    <span key={n} className={`star ${n <= travelRecordDraft.rating ? 'is-on' : ''}`}>★</span>
                  ))}
                </div>
              </label>
              <label className="field">
                <span>备注</span>
                <textarea rows={2} value={travelRecordDraft.note} onChange={(e) => setTravelRecordDraft({ ...travelRecordDraft, note: e.target.value })} placeholder="宝宝表现 / 有趣的事 / 注意事项" />
              </label>
              <div className="mark-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setMarkModal(null)}>取消</button>
                <button className="btn btn--primary btn--sm" disabled={travelLoading} onClick={saveTravelRecord}>
                  {travelLoading ? '保存中…' : '确认标记出行'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 夜间作息弹窗（从睡眠图"作息"按钮打开，独立于档案表单） */}
      {nightModal && (
        <div className="modal modal--mark" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setNightModal(null)} />
          <div className="modal__card modal__card--mark">
            <button className="modal__close" onClick={() => setNightModal(null)} aria-label="关闭"><X className="icon icon--sm" /></button>
            <div className="mark-head">
              <div className="mark-head__badge">夜间作息</div>
              <h3 className="mark-head__name">规律的夜间睡眠时间</h3>
              <div className="mark-head__sub">用于计算今日已睡总时长与睡眠图夜间段</div>
            </div>
            <div className="mark-body">
              <div className="field field__row">
                <div>
                  <span>入睡时间</span>
                  <input type="time" value={nightModal.bedtime} onChange={(e) => setNightModal({ ...nightModal, bedtime: e.target.value })} />
                </div>
                <div>
                  <span>起床时间</span>
                  <input type="time" value={nightModal.wake} onChange={(e) => setNightModal({ ...nightModal, wake: e.target.value })} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '4px 0 8px' }}>填宝宝规律的夜间睡眠时间，跨午夜自动处理（如 20:00 入睡 → 07:00 起床算作 11 小时）。两个都留空表示清除设置。</p>
              <div className="mark-actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setNightModal(null)}>取消</button>
                <button className="btn btn--primary btn--sm" disabled={nightSaving} onClick={saveNightRoutine}>
                  {nightSaving ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 修改个人信息弹窗：昵称 + 密码（手机号不可改） */}
      {editProfileModal && (
        <EditProfileModal
          currentUser={currentUser}
          onClose={() => setEditProfileModal(false)}
          onSave={saveProfile}
        />
      )}

      {/* 退出登录二次确认弹窗 */}
      {logoutConfirm && (
        <div className="modal modal--confirm" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setLogoutConfirm(false)} />
          <div className="modal__card modal__card--confirm">
            <div className="confirm__title">退出登录</div>
            <div className="confirm__msg">确定要退出当前账号吗？</div>
            <div className="confirm__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setLogoutConfirm(false)}>取消</button>
              <button className="btn btn--primary btn--sm" onClick={logout}>退出</button>
            </div>
          </div>
        </div>
      )}

      {/* 家庭管理弹窗（家庭名/ID/成员/退出家庭/添加宝宝） */}
      {familyMgmtOpen && family && (
        <div className="modal modal--fm" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => setFamilyMgmtOpen(false)} />
          <div className="modal__card modal__card--fm">
            <button className="modal__close" onClick={() => setFamilyMgmtOpen(false)} aria-label="关闭"><X className="icon icon--sm" /></button>
            <div className="fm-head">
              <div className="fm-head__name">🏠 {family.family_name}</div>
              <button className="fm-head__fid" onClick={copyFamilyId} title="点击复制家庭 ID">
                ID: <b>{family.family_id}</b>
              </button>
            </div>

            <div className="fm-section">
              <div className="fm-section__title">家庭成员</div>
              <div className="fm-members">
                {family.members?.map((m) => {
                  const name = m.nickname || (m.role === 'creator' ? '创建者' : '成员');
                  const isMe = m.user_id === (currentUser?.user_id || '');
                  return (
                    <div key={m.user_id} className={`fm-member ${isMe ? 'is-me' : ''}`}>
                      {isMe && <span className="fm-member__tag">我</span>}
                      <span className="fm-member__name">{name}</span>
                      {isMe ? (
                        <button className="fm-member__edit" onClick={() => { setFamilyMgmtOpen(false); setNickModal({ open: true, nickname: m.nickname || '' }); }} title="修改我的昵称">
                          <Pencil className="icon icon--xs" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="fm-section">
              <div className="fm-section__title">宝宝列表</div>
              <div className="fm-babies">
                {babies.map(b => (
                  <div key={b.baby_id} className={`fm-baby ${b.baby_id === currentBabyId ? 'is-current' : ''}`}>
                    <button className="fm-baby__btn" onClick={() => { switchBaby(b.baby_id); setFamilyMgmtOpen(false); }}>
                      <span className="fm-baby__name">{b.name}</span>
                      {b.baby_id === currentBabyId && <span className="fm-baby__cur">当前</span>}
                    </button>
                    <button className="fm-baby__del" onClick={(e) => { e.stopPropagation(); deleteBaby(b.baby_id, b.name); }} title={`删除 ${b.name}`}>
                      <Trash2 className="icon icon--xs" />
                    </button>
                  </div>
                ))}
              </div>
              <button className="btn btn--ghost btn--sm fm-add-baby" onClick={() => { setFamilyMgmtOpen(false); setForm({ name: '', gender: 'boy', birthday: '', height: '', weight: '', night_bedtime: '', night_wake_time: '' }); setView('baby-edit'); }}>
                <Plus className="icon icon--xs" />添加宝宝
              </button>
            </div>

            <button className="btn btn--ghost fm-leave" onClick={() => { setFamilyMgmtOpen(false); leaveFamily(); }}>
              退出家庭
            </button>
          </div>
        </div>
      )}

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