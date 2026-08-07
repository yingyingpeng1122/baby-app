import './App.css';
import { useState, useEffect, useRef } from 'react';
import {
  Baby, Ruler, Scale, Milk, Utensils, Music, Gamepad2, Video, Save,
  PlayCircle, Loader2, AlertCircle, Sparkles, Pencil, Check, Maximize2, Minimize2,
  Plus, Trash2, Clock, TrendingUp, ChevronDown, Sun, BookOpen, Heart, Moon, Pill, Smile, ListChecks, ChevronLeft, ChevronRight, Calendar, X,
  Eye, MessageCircle, Footprints, Hand, Brain
} from 'lucide-react';

// WHO 最低食物种类（MDD）的 7 个食物组
const FOOD_GROUPS = ['谷物根茎', '豆坚果', '奶制品', '肉禽鱼', '蛋', '富维A果蔬', '其他果蔬'];

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
  // 喂养记录
  const [feedRecords, setFeedRecords] = useState([]);
  const [feedEval, setFeedEval] = useState(null);
  const [feedForm, setFeedForm] = useState({ time: '', amount: '', type: 'milk', note: '', foodGroups: [] });
  const [feedLoading, setFeedLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
  const [feedingStats, setFeedingStats] = useState(null);

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
      // 同时拉取喂养数据和照护清单
      fetchFeedData();
      fetchChecklist();
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

  const openFeedingCalendar = () => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    setFeedingCalendarDate({ year: y, month: m });
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
    if (!feedForm.time || !feedForm.amount) return alert('请填写喂养时间和喂养量');
    setFeedLoading(true);
    try {
      if (editingId) {
        // 更新已有记录
        await apiFetch(`${API_BASE}/feeding-records/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time: feedForm.time,
            amount: parseFloat(feedForm.amount),
            type: feedForm.type,
            note: feedForm.note,
            foodGroups: feedForm.foodGroups.join(','),
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
            amount: parseFloat(feedForm.amount),
            type: feedForm.type,
            note: feedForm.note,
            foodGroups: feedForm.foodGroups.join(','),
          }),
        });
      }
      setFeedForm({ time: '', amount: '', type: 'milk', note: '', foodGroups: [] });
      await fetchFeedData();
    } catch (e) { alert('操作失败：' + e.message); }
    setFeedLoading(false);
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setFeedForm({ time: r.time, amount: String(r.amount), type: r.type, note: r.note || '', foodGroups: r.foodGroups ? r.foodGroups.split(',').filter(Boolean) : [] });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFeedForm({ time: '', amount: '', type: 'milk', note: '', foodGroups: [] });
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
  const { profile, months, growthStandard: g, isWeightNormal, isHeightNormal, feedingAdvice: f, activities, music = [] } = data;
  const allOk = isWeightNormal && isHeightNormal;
  const [devOpen, setDevOpen] = useState(false);
  const hPct = pct(profile.height, g.minH, g.maxH);
  const wPct = pct(profile.weight, g.minW, g.maxW);

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
              <span className="family-bar__members">{family.members?.length || 0} 位成员</span>
            </div>
          </div>
        )}
      </header>

      <div className="wrap">
        <Reveal className="hero">
          <div className="hero__compact">
            <span className="hero__eyebrow"><Sparkles className="icon icon--xs" />成长档案</span>
            <h1 className="hero__title">{profile.name} 已经 <b>{months}</b> 个月啦</h1>
          </div>
          <span className={`hero__status ${allOk ? 'is-ok' : 'is-warn'}`}>
            {allOk ? <Check className="icon icon--xs" /> : <AlertCircle className="icon icon--xs" />}
            {allOk ? '发育良好' : '需关注'}
          </span>
        </Reveal>

        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><Sparkles className="icon icon--sm" /></span>
            <h2 className="section__title">发育概况</h2>
            <button className={`section__toggle ${devOpen ? 'is-open' : ''}`} onClick={() => setDevOpen(v => !v)} aria-expanded={devOpen}>
              {devOpen ? '收起' : '详情'}
              <ChevronDown className="icon icon--xs" />
            </button>
          </div>
          <div className="assess">
            <span className="assess__ico">{allOk ? <Check className="icon icon--lg" /> : <AlertCircle className="icon icon--lg" />}</span>
            <div className="assess__body">
              <div className="assess__k">综合评估</div>
              <div className="assess__text">{allOk ? '身高与体重均落在同龄参考区间内，发育节奏良好。' : '部分指标偏离参考区间，建议结合喂养与睡眠再观察两周。'}</div>
            </div>
            <div className="assess__badges">
              <Badge ok={isHeightNormal}>身高{isHeightNormal ? '达标' : '关注'}</Badge>
              <Badge ok={isWeightNormal}>体重{isWeightNormal ? '达标' : '关注'}</Badge>
            </div>
          </div>
          {devOpen && (
          <div className="grid2">
            <div className="stat stat--teal">
              <div className="stat__head"><span className="stat__label"><span className="stat__ico"><Ruler className="icon icon--sm" /></span>身高</span><Badge ok={isHeightNormal}>{isHeightNormal ? '达标' : '关注'}</Badge></div>
              <div><span className="stat__value">{profile.height}</span><span className="stat__unit">cm</span></div>
              <div className="bar"><div className="bar__fill" style={{ '--w': `${hPct}%` }} /></div>
              <div className="bar__scale"><span>{g.minH}</span><span>参考区间</span><span>{g.maxH}</span></div>
            </div>
            <div className="stat stat--sky">
              <div className="stat__head"><span className="stat__label"><span className="stat__ico"><Scale className="icon icon--sm" /></span>体重</span><Badge ok={isWeightNormal}>{isWeightNormal ? '达标' : '关注'}</Badge></div>
              <div><span className="stat__value">{profile.weight}</span><span className="stat__unit">kg</span></div>
              <div className="bar"><div className="bar__fill" style={{ '--w': `${wPct}%` }} /></div>
              <div className="bar__scale"><span>{g.minW}</span><span>参考区间</span><span>{g.maxW}</span></div>
            </div>
          </div>
          )}
        </Reveal>

        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--honey"><Milk className="icon icon--sm" /></span>
            <h2 className="section__title">今日喂养建议</h2>
          </div>
          <div className="feed">
            <div className="feed__head">
              <span className="feed__stage"><span className="dot" />{f.stage}</span>
              <span className="feed__tip">{f.videoTip}</span>
            </div>
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

            {/* 喂养间隔 */}
            <div className="feed__interval">
              <Clock className="icon icon--sm" />
              <span className="feed__interval-text">{f.feedingInterval}</span>
            </div>

            <div className="feed__foot">
              <button className="btn btn--coral btn--block" onClick={() => setModal({ open: true, title: `喂养演示 · ${f.stage}`, src: f.videoUrl || '' })}><Video className="icon icon--xs" />查看本阶段喂养演示视频</button>
            </div>

            {/* 喂养记录录入 */}
            <div className="feed__log">
              <div className="feed__log-title">{editingId ? '编辑喂养记录' : '记录今日喂养'}</div>
              <div className="feed__log-form">
                <div className="feed__log-field">
                  <label>时间</label>
                  <TimePicker value={feedForm.time} onChange={(v) => setFeedForm({ ...feedForm, time: v })} />
                </div>
                <div className="feed__log-field">
                  <label>喂养量(ml)</label>
                  <input type="number" className="input input--sm" placeholder="0" value={feedForm.amount} onChange={(e) => setFeedForm({ ...feedForm, amount: e.target.value })} />
                </div>
                <div className="feed__log-field">
                  <label>类型</label>
                  <Dropdown
                    value={feedForm.type}
                    onChange={(v) => setFeedForm({ ...feedForm, type: v })}
                    options={[
                      { value: 'milk', label: '奶', icon: <Milk className="icon icon--xs" /> },
                      { value: 'solids', label: '辅食', icon: <Utensils className="icon icon--xs" /> },
                    ]}
                  />
                </div>
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

            {/* 今日记录列表 */}
            {feedRecords.length > 0 && (
              <div className="feed__records">
                <div className="feed__records-title">今日喂养记录</div>
                <div className="feed__records-list">
                  {feedRecords.map((r) => (
                    <div key={r.id} className={`feed__record ${editingId === r.id ? 'feed__record--editing' : ''}`}>
                      <span className="feed__record-time">{r.time}</span>
                      <span className="feed__record-amount">{r.amount}ml</span>
                      <span className={`feed__record-type feed__record-type--${r.type}`}>{r.type === 'milk' ? '奶' : '辅食'}</span>
                      {r.note && <span className="feed__record-note">{r.note}</span>}
                      <button className="feed__record-edit" onClick={() => startEdit(r)} aria-label="编辑">
                        <Pencil className="icon icon--xs" />
                      </button>
                      <button className="feed__record-del" onClick={() => deleteFeedRecord(r.id)} aria-label="删除">
                        <Trash2 className="icon icon--xs" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 喂养评估 */}
            {feedEval && (
              <div className={`feed__eval feed__eval--${feedEval.status}`}>
                <div className="feed__eval-icon">
                  {feedEval.status === 'good' ? <Check className="icon icon--lg" /> : <TrendingUp className="icon icon--lg" />}
                </div>
                <div className="feed__eval-body">
                  <div className="feed__eval-title">今日喂养评估</div>
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
          {/* 打开日历按钮 */}
          <button className="btn btn--ghost checklist__cal-btn" onClick={() => { setCalendarOpen(true); setCalendarDetail(null); }}>
            <Calendar className="icon icon--xs" /> 查看照护日历
          </button>
        </Reveal>

        {/* 照护日历弹窗 */}
        {calendarOpen && (
          <div className="cal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCalendarOpen(false); }}>
            <div className="cal-modal">
              <div className="cal-modal__head">
                <h3 className="cal-modal__title"><Calendar className="icon icon--sm" /> 照护日历回顾</h3>
                <button className="cal-modal__close" onClick={() => { setCalendarOpen(false); setCalendarDetail(null); }}><X className="icon icon--sm" /></button>
              </div>
              {/* 月份切换 */}
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
              <div className="cal-modal__head">
                <h3 className="cal-modal__title"><Milk className="icon icon--sm" /> 喂养日历</h3>
                <button className="cal-modal__close" onClick={() => setFeedingCalendarOpen(false)}><X className="icon icon--sm" /></button>
              </div>
              <div className="cal-month-nav">
                <button className="cal-month-nav__btn" onClick={() => changeFeedingCalendarMonth(-1)}><ChevronLeft className="icon icon--sm" /></button>
                <span className="cal-month-nav__label">{feedingCalendarDate.year}年{feedingCalendarDate.month}月</span>
                <button className="cal-month-nav__btn" onClick={() => changeFeedingCalendarMonth(1)}><ChevronRight className="icon icon--sm" /></button>
              </div>
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
                  cells.push(
                    <div key={d} className={`cal-cell ${isToday ? 'is-today' : ''} ${level === 'future' ? 'is-future' : ''}`}
                      title={level === 'good' ? `奶量 ${info.totalMilk}ml` : level === 'low' ? `奶量不足 ${info.totalMilk}ml` : level === 'high' ? `奶量超出 ${info.totalMilk}ml` : level === 'future' ? '未来日期' : level === 'empty' ? '无记录' : ''}>
                      <span className="cal-cell__num">{d}</span>
                      {level !== 'future' && level !== 'empty' && (
                        <span className={`cal-cell__dot cal-cell__dot--feed-${level}`} />
                      )}
                      {level === 'empty' && (
                        <span className="cal-cell__dot cal-cell__dot--none" />
                      )}
                    </div>
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

              {/* 月度统计 */}
              {feedingStats && (
                <div className="feed-stats" style={{ marginTop: 14, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-mid)', border: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10, color: 'var(--text)' }}>
                    📊 {feedingCalendarDate.year}年{feedingCalendarDate.month}月喂养统计
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>总奶量</span>
                      <b style={{ color: 'var(--text)' }}>{feedingStats.totalMilk.toFixed(0)}ml</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>总辅食</span>
                      <b style={{ color: 'var(--text)' }}>{feedingStats.totalSolids.toFixed(0)}g</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>日均奶量</span>
                      <b style={{ color: 'var(--text)' }}>{feedingStats.avgDailyMilk.toFixed(0)}ml</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>建议每日</span>
                      <b style={{ color: 'var(--text)' }}>{feedingStats.targetMilk.toFixed(0)}ml</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>总喂养次数</span>
                      <b style={{ color: 'var(--text)' }}>{feedingStats.totalFeeds} 次</b>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>有记录天数</span>
                      <b style={{ color: 'var(--text)' }}>{feedingStats.daysWithData}/{feedingStats.pastDays} 天</b>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 12, fontWeight: 600 }}>
                    <span style={{ color: 'var(--green)' }}>✅ 充足 {feedingStats.goodDays}天</span>
                    <span style={{ color: 'var(--honey)' }}>⚠️ 不足 {feedingStats.lowDays}天</span>
                    <span style={{ color: 'var(--coral)' }}>📈 超出 {feedingStats.highDays}天</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Reveal className="section" delay={0.05}>
          <h2 className="section__title">早教活动</h2>
          <ActList items={activities} onPlay={(a) => setModal({ open: true, title: a.title, src: a.videoUrl || '' })} />
        </Reveal>

        <Reveal className="section" delay={0.08}>
          <h2 className="section__title">音乐区</h2>
          <ActList items={music} onPlay={(a) => setModal({ open: true, title: a.title, src: a.videoUrl || '' })} />
        </Reveal>
      </div>

      <VideoModal open={modal.open} title={modal.title} src={modal.src || ''} onClose={() => setModal({ open: false, title: '', src: '' })} />
    </div>
  );
}