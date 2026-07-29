import './App.css';
import { useState, useEffect, useRef } from 'react';
import {
  Baby, Ruler, Scale, Milk, Utensils, Music, Gamepad2, Video, Save,
  PlayCircle, Loader2, AlertCircle, Sparkles, Pencil, Check, Maximize2, Minimize2,
  Plus, Trash2, Clock, TrendingUp, ChevronDown, Sun, BookOpen, Heart, Moon, Pill, Smile, ListChecks, ChevronLeft, ChevronRight, Calendar, X
} from 'lucide-react';

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

/* 统一 fetch 包装：自动注入 X-User-Id header */
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), 'X-User-Id': USER_ID };
  return fetch(url, { ...options, headers });
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 全屏状态变化监听：用户可能通过浏览器自带方式退出全屏
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await cardRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (e) {
      // 部分浏览器（如老 Safari）不支持 requestFullscreen，静默失败即可
      console.warn('fullscreen toggle failed', e);
    }
  };

  if (!open) return null;
  // 没有配置视频（空串或占位符 '#'）时不再回退到同一个共享示例，避免“所有活动打开同一地址”
  const isEmpty = !src || src === '#';
  const videoSrc = isEmpty ? '' : src;
  const biliEmbed = getBiliEmbedUrl(videoSrc);
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__card modal__card--video" ref={cardRef}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <div className="modal__head-actions">
            <button
              className="modal__iconbtn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? '退出全屏' : '全屏播放'}
              title={isFullscreen ? '退出全屏' : '全屏播放'}
            >
              {isFullscreen ? <Minimize2 className="icon icon--sm" /> : <Maximize2 className="icon icon--sm" />}
            </button>
            <button className="modal__close" onClick={onClose} aria-label="关闭">✕</button>
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
  const [data, setData] = useState(null);
  const [modal, setModal] = useState({ open: false, title: '' });
  const [form, setForm] = useState({ name: '', gender: 'boy', birthday: '', height: '', weight: '' });
  // 喂养记录
  const [feedRecords, setFeedRecords] = useState([]);
  const [feedEval, setFeedEval] = useState(null);
  const [feedForm, setFeedForm] = useState({ time: '', amount: '', type: 'milk', note: '' });
  const [feedLoading, setFeedLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // 每日照护清单
  const [checklist, setChecklist] = useState([]);
  // 照护日历
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarData, setCalendarData] = useState(null);
  const [calendarDate, setCalendarDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [calendarDetail, setCalendarDetail] = useState(null); // { date, items }

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const res = await apiFetch(`${API_BASE}/dashboard`);
      if (res.status === 404) return setView('edit');
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
      setView('dashboard');
    } catch (e) { console.error(e); setView('edit'); }
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

  // dashboard 加载完成后拉取喂养数据
  useEffect(() => { if (view === 'dashboard') { fetchFeedData(); fetchChecklist(); } }, [view]);

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
          }),
        });
      }
      setFeedForm({ time: '', amount: '', type: 'milk', note: '' });
      await fetchFeedData();
    } catch (e) { alert('操作失败：' + e.message); }
    setFeedLoading(false);
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setFeedForm({ time: r.time, amount: String(r.amount), type: r.type, note: r.note || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFeedForm({ time: '', amount: '', type: 'milk', note: '' });
  };

  const deleteFeedRecord = async (id) => {
    try {
      await apiFetch(`${API_BASE}/feeding-records/${id}`, { method: 'DELETE' });
      await fetchFeedData();
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!form.name || !form.birthday) return alert('请填写昵称和出生日期');
    try {
      setError(null);
      const res = await apiFetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, height: parseFloat(form.height) || 0, weight: parseFloat(form.weight) || 0 })
      });
      if (!res.ok) throw new Error(`保存失败 (${res.status})`);
      await fetchDashboard();
    } catch (e) { setError('保存失败：' + (e.message || '请确认后端已启动')); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  /* ---------- 加载 ---------- */
  if (view === 'loading') {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="loading"><div className="spinner" /><p className="loading__txt">正在加载宝宝数据…</p></div>
      </div>
    );
  }

  /* ---------- 表单 ---------- */
  if (view === 'edit') {
    return (
      <div className="app app--center">
        <span className="blob blob--1" aria-hidden /><span className="blob blob--2" aria-hidden />
        <div className="form">
          <div className="form__head">
            <div className="form__logo"><Baby className="icon icon--lg" /></div>
            <h2 className="form__title">建立宝宝档案</h2>
            <p className="form__sub">记录成长的第一步</p>
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
          <button className="btn btn--primary btn--block" onClick={handleSave}><Save className="icon icon--sm" />保存并生成报告</button>
        </div>
      </div>
    );
  }

  /* ---------- 仪表盘 ---------- */
  if (!data) return null;
  const { profile, months, growthStandard: g, isWeightNormal, isHeightNormal, feedingAdvice: f, activities } = data;
  const allOk = isWeightNormal && isHeightNormal;
  const ringDeg = Math.min(1, months / 12) * 360;
  const hPct = pct(profile.height, g.minH, g.maxH);
  const wPct = pct(profile.weight, g.minW, g.maxW);

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
          <button className="btn btn--ghost" onClick={() => { setForm(profile); setView('edit'); }}><Pencil className="icon icon--xs" />编辑</button>
        </div>
      </header>

      <div className="wrap">
        <Reveal className="hero">
          <div className="hero__main">
            <span className="hero__eyebrow"><Sparkles className="icon icon--xs" />成长档案</span>
            <h1 className="hero__title">{profile.name} 已经 <b>{months}</b> 个月啦</h1>
            <p className="hero__sub">{allOk ? '各项指标都在参考区间里，状态很棒，继续保持这份用心。' : '有一项指标偏离了参考区间，下面的建议帮你留意一下。'}</p>
            <div className="hero__chips">
              <span className="chip"><span className="chip__dot" style={{ background: 'var(--sky)' }} />{profile.gender === 'boy' ? '男宝' : '女宝'}</span>
              <span className="chip"><span className="chip__dot" style={{ background: 'var(--primary)' }} />身高 {profile.height}cm</span>
              <span className="chip"><span className="chip__dot" style={{ background: 'var(--sky)' }} />体重 {profile.weight}kg</span>
            </div>
          </div>
          <div>
            <div className="ring" style={{ '--deg': `${ringDeg}deg` }}>
              <div className="ring__hole"><span className="ring__num">{months}</span><span className="ring__unit">个月</span></div>
            </div>
            <div className="ring__label">满一岁进度</div>
          </div>
        </Reveal>

        <Reveal className="section" delay={0.05}>
          <div className="section__head">
            <span className="section__ico section__ico--teal"><Sparkles className="icon icon--sm" /></span>
            <h2 className="section__title">发育概况</h2>
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
                      {feedEval.targetMilk > 0 && <span className="feed__eval-target">/ 建议 {feedEval.targetMilk.toFixed(0)}ml</span>}
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

        <Reveal className="section" delay={0.05}>
          <div className="acts">
            {activities.map((a, i) => (
              <Reveal key={a.id} className="act" delay={i * 0.07}>
                <span className={`act__tile ${a.type === 'music' ? 'act__tile--music' : 'act__tile--game'}`}>{a.type === 'music' ? <Music className="icon icon--lg" /> : <Gamepad2 className="icon icon--lg" />}</span>
                <div className="act__main">
                  <div className="act__title">{a.title}</div>
                  <div className="act__desc">{a.desc}</div>
                  <span className="act__age">适用 {a.ageRange[0]}–{a.ageRange[1]} 个月</span>
                </div>
                <button className="act__play" aria-label={`查看 ${a.title} 演示`} onClick={() => setModal({ open: true, title: a.title, src: a.videoUrl || '' })}><PlayCircle className="icon icon--sm" /></button>
              </Reveal>
            ))}
            {activities.length === 0 && <div className="acts__empty">本月暂无推荐活动</div>}
          </div>
        </Reveal>
      </div>

      <VideoModal open={modal.open} title={modal.title} src={modal.src || ''} onClose={() => setModal({ open: false, title: '', src: '' })} />
    </div>
  );
}