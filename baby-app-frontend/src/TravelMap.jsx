// 深圳带娃出行地图（SVG）
// 来源：shenzhen-baby-map.html，适配为 React 组件
import { useState, useRef, useMemo, useEffect } from 'react';
import { DISTRICTS, SPOTS, SPOTS_VISITABLE, starsForAge } from './travelSpots.js';

const NS = 'http://www.w3.org/2000/svg';
const VB = { x: 0, y: 0, w: 1000, h: 700 };

const DISTRICT_COLORS = {
  '罗湖': '#fde8e4', '福田': '#fef0d6', '南山': '#e3f0e7',
  '宝安': '#e6f0f5', '龙岗': '#f1e9f5', '盐田': '#e8f5f3',
  '龙华': '#fdf3d6', '坪山': '#e9efe5', '光明': '#f3e9e4',
  '大鹏新区': '#e0eee9',
};

function centroid(pts) {
  const arr = pts.trim().split(/\s+/).map(p => { const q = p.split(','); return { x: +q[0], y: +q[1] }; });
  let sx = 0, sy = 0; arr.forEach(p => { sx += p.x; sy += p.y; });
  return { x: Math.round(sx / arr.length), y: Math.round(sy / arr.length) };
}

// 根据一组点位计算覆盖范围，返回聚焦 viewBox（含 padding）
function focusViewBox(spots, padding = 60) {
  if (!spots.length) return { ...VB };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  spots.forEach(s => {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x > maxX) maxX = s.x;
    if (s.y > maxY) maxY = s.y;
  });
  const w = Math.max(maxX - minX + padding * 2, 120);
  const h = Math.max(maxY - minY + padding * 2, 90);
  // 保持地图原始宽高比 1000:700 ≈ 1.4286，避免 slice 模式变形
  const ratio = VB.w / VB.h;
  let fw = w, fh = h;
  if (fw / fh > ratio) fh = fw / ratio; else fw = fh * ratio;
  let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let nx = cx - fw / 2, ny = cy - fh / 2;
  nx = Math.max(VB.x, Math.min(nx, VB.x + VB.w - fw));
  ny = Math.max(VB.y, Math.min(ny, VB.y + VB.h - fh));
  return { x: nx, y: ny, w: fw, h: fh };
}

export default function TravelMap({ months, visitedSpotNames, onSpotClick, height, filter }) {
  // filter: { district: 'all'|区名, star: 'all'|1-5, matched: Set<id> | null }
  //   - matched 非 null 时：地图只高亮 matched 中的点，其余变灰；且 viewBox 聚焦 matched 范围
  //   - matched 为 null 时：全部高亮，viewBox 默认全图
  const filterActive = filter && filter.matched && filter.matched.size > 0;
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // {id, x, y, name, stars}
  const [view, setView] = useState({ x: VB.x, y: VB.y, w: VB.w, h: VB.h });
  const [userControlled, setUserControlled] = useState(false); // 用户是否手动拖拽/缩放过

  // 点位数据（带星级 + 是否命中筛选）
  const points = useMemo(() => {
    return SPOTS_VISITABLE.map(s => {
      const stars = starsForAge(s, months);
      let matched = true;
      if (filterActive) matched = filter.matched.has(s.id);
      return { ...s, stars, visited: visitedSpotNames.has(s.name), matched };
    });
  }, [months, visitedSpotNames, filterActive, filter]);

  // 家点（始终显示，不受筛选影响）
  const homePoints = useMemo(() => SPOTS.filter(s => s.type === 'home'), []);

  // 筛选变化时强制自动聚焦命中点范围（不管 userControlled，保证筛选后地图必然聚焦）
  useEffect(() => {
    if (filterActive) {
      const matchedSpots = SPOTS_VISITABLE.filter(s => filter.matched.has(s.id));
      setView(focusViewBox(matchedSpots, 70));
    } else {
      setView({ ...VB });
    }
    setUserControlled(false); // 筛选变化后重置用户控制标记，让后续聚焦生效
  }, [filterActive, filter]);

  const zoom = (factor) => {
    setUserControlled(true);
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    let nw = view.w * factor, nh = view.h * factor;
    if (nw < 200) { nw = 200; nh = nw * (VB.h / VB.w); }
    if (nw > VB.w) { nw = VB.w; nh = VB.h; }
    let nx = cx - nw / 2, ny = cy - nh / 2;
    nx = Math.max(VB.x, Math.min(nx, VB.x + VB.w - nw));
    ny = Math.max(VB.y, Math.min(ny, VB.y + VB.h - nh));
    setView({ x: nx, y: ny, w: nw, h: nh });
  };
  const reset = () => { setUserControlled(false); setView(filterActive ? focusViewBox(SPOTS_VISITABLE.filter(s => filter.matched.has(s.id)), 70) : { ...VB }); };

  // 标签防重叠：贪心算法 + 四向放置（上/下/左/右）
  // 优先级：星级高 > 已出行 > id 小（数据靠前）
  // 对每个标签依次尝试：上方 → 下方 → 左侧 → 右侧，全部碰撞才隐藏
  const labelLayout = useMemo(() => {
    const visible = points.filter(s => {
      if (filterActive && !s.matched) return false;
      if (s.stars <= 0) return false;
      return true;
    });
    const charW = 11 * (view.w / VB.w);   // 单字宽（SVG 坐标）
    const labelH = 14 * (view.h / VB.h);  // 标签行高
    const offsetY = 11 * (view.h / VB.h); // 标签距点位的垂直偏移
    const offsetX = 12 * (view.w / VB.w); // 标签距点位的水平偏移（左右放置时）
    // 每个景点生成四个候选位置：上/下/左/右
    const candidates = visible.flatMap(s => {
      const w = (s.name.length || 4) * charW;
      const h = labelH;
      return [
        { s, pos: 'top',    x: s.x - w / 2,       y: s.y - offsetY - h, w, h },
        { s, pos: 'bottom', x: s.x - w / 2,       y: s.y + offsetY,     w, h },
        { s, pos: 'left',   x: s.x - w - offsetX, y: s.y - h / 2,       w, h },
        { s, pos: 'right',  x: s.x + offsetX,     y: s.y - h / 2,       w, h },
      ];
    });
    // 按优先级排序：星级降序 > 已出行优先 > id 升序
    const sorted = [...visible].sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars;
      if (a.visited !== b.visited) return a.visited ? -1 : 1;
      return a.id - b.id;
    });
    const placed = [];
    const result = new Map();  // id -> 'top'|'bottom'|'left'|'right' | null（隐藏）
    for (const s of sorted) {
      const cands = candidates.filter(c => c.s.id === s.id);
      let chosen = null;
      for (const c of cands) {
        const collide = placed.some(p => !(c.x + c.w < p.x || c.x > p.x + p.w || c.y + c.h < p.y || c.y > p.y + p.h));
        if (!collide) { chosen = c; break; }
      }
      if (chosen) {
        placed.push(chosen);
        result.set(s.id, chosen.pos);
      } else {
        result.set(s.id, null);
      }
    }
    return result;
  }, [points, view, filterActive]);

  // 拖动平移
  const dragRef = useRef(null);
  const pinchRef = useRef(null);  // 双指缩放状态（移动端捏合手势）
  const onPointerDown = (e) => {
    if (!svgRef.current) return;
    if (pinchRef.current) return;  // 双指缩放进行中，不启动单指拖拽
    svgRef.current.setPointerCapture(e.pointerId);
    const rect = svgRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      viewX: view.x, viewY: view.y,
      scale: view.w / rect.width,
      moved: false,
    };
    svgRef.current.classList.add('grabbing');
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (pinchRef.current) { dragRef.current = null; return; }  // 进入双指模式，终止单指拖拽
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    d.moved = true;
    setUserControlled(true);
    let nx = d.viewX - dx * d.scale, ny = d.viewY - dy * d.scale;
    nx = Math.max(VB.x, Math.min(nx, VB.x + VB.w - view.w));
    ny = Math.max(VB.y, Math.min(ny, VB.y + VB.h - view.h));
    setView(v => ({ ...v, x: nx, y: ny }));
  };
  const onPointerUp = (e) => {
    if (svgRef.current) svgRef.current.classList.remove('grabbing');
    dragRef.current = null;
  };

  // 点位点击：记录 down 时的坐标，up 时若未移动则触发 onSpotClick。
  // 不依赖 svg 级 setPointerCapture（会劫持子元素事件），独立用 down/up 判定。
  const spotDownRef = useRef(null);
  const onSpotPointerDown = (e, s) => {
    e.stopPropagation();           // 阻止冒泡到 svg 的拖拽 onPointerDown
    spotDownRef.current = { x: e.clientX, y: e.clientY, s };
  };
  const onSpotPointerUp = (e, s) => {
    e.stopPropagation();
    const d = spotDownRef.current;
    spotDownRef.current = null;
    if (!d || d.s !== s) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) onSpotClick(s);  // 纯点击（非拖拽）才触发
  };

  // 滚轮缩放（以鼠标位置为锚点，且仅鼠标在地图内时拦截页面滚动）
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault(); // 鼠标在地图内时阻止页面滚动，改为缩放
      setUserControlled(true);
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      // 鼠标在 SVG 坐标系中的位置
      const mx = (e.clientX - rect.left) / rect.width * view.w + view.x;
      const my = (e.clientY - rect.top) / rect.height * view.h + view.y;
      // wheelDeltaY < 0 (向下滚) → 放大（factor < 1）；> 0 (向上滚) → 缩小（factor > 1）
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      let nw = view.w * factor, nh = view.h * factor;
      if (nw < 200) { nw = 200; nh = nw * (VB.h / VB.w); }
      if (nw > VB.w) { nw = VB.w; nh = VB.h; }
      // 保持鼠标位置在 SVG 坐标系中不变：mx = nx + (mx - view.x) * (nw / view.w)
      let nx = mx - (mx - view.x) * (nw / view.w);
      let ny = my - (my - view.y) * (nh / view.h);
      nx = Math.max(VB.x, Math.min(nx, VB.x + VB.w - nw));
      ny = Math.max(VB.y, Math.min(ny, VB.y + VB.h - nh));
      setView({ x: nx, y: ny, w: nw, h: nh });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view]);

  // 双指缩放/平移（移动端捏合手势）
  // 用原生 touch 事件（touches 数组可拿多触点），与单指 pointer 拖拽互不干扰：
  //   - 2 指：按两指距离比缩放（以中点为锚点），同方向移动则平移
  //   - 1 指交给 pointer 事件处理单指拖拽，这里不拦截
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const dist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const midSvg = (t1, t2) => {
      const rect = el.getBoundingClientRect();
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      return {
        x: (cx - rect.left) / rect.width * view.w + view.x,
        y: (cy - rect.top) / rect.height * view.h + view.y,
        clientX: cx, clientY: cy,
      };
    };
    const clampView = (nx, ny, nw, nh) => {
      if (nw < 200) { nw = 200; nh = nw * (VB.h / VB.w); }
      if (nw > VB.w) { nw = VB.w; nh = VB.h; }
      nx = Math.max(VB.x, Math.min(nx, VB.x + VB.w - nw));
      ny = Math.max(VB.y, Math.min(ny, VB.y + VB.h - nh));
      return { x: nx, y: ny, w: nw, h: nh };
    };
    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();                 // 阻止浏览器默认缩放/滚动
      setUserControlled(true);
      const [t1, t2] = e.touches;
      const m = midSvg(t1, t2);
      pinchRef.current = {
        startDist: dist(t1, t2),
        startMid: m,
        startView: { ...view },
      };
      el.classList.add('grabbing');
    };
    const onTouchMove = (e) => {
      const p = pinchRef.current;
      if (!p || e.touches.length !== 2) return;
      e.preventDefault();
      const [t1, t2] = e.touches;
      const ratio = p.startDist > 0 ? dist(t1, t2) / p.startDist : 1;
      // 标准地图手势：双指分开(ratio>1)→放大(viewBox 变小, factor<1)；双指靠近(ratio<1)→缩小(viewBox 变大, factor>1)
      // 因此 factor = 1/ratio（反比关系）
      let factor = 1 / Math.max(0.25, Math.min(4, ratio));
      let nw = p.startView.w * factor, nh = p.startView.h * factor;
      // 以起始中点为锚点保持不动
      let nx = p.startMid.x - (p.startMid.x - p.startView.x) * (nw / p.startView.w);
      let ny = p.startMid.y - (p.startMid.y - p.startView.y) * (nh / p.startView.h);
      // 叠加平移：当前两指中点相对起始中点的位移
      const curMid = midSvg(t1, t2);
      // 平移量用 SVG 坐标系换算
      const rect = el.getBoundingClientRect();
      const dx = (curMid.clientX - p.startMid.clientX) / rect.width * p.startView.w;
      const dy = (curMid.clientY - p.startMid.clientY) / rect.height * p.startView.h;
      nx -= dx; ny -= dy;
      setView(clampView(nx, ny, nw, nh));
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        pinchRef.current = null;
        el.classList.remove('grabbing');
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [view]);

  return (
    <div className="travel-map">
      <div className="travel-map__bar">
        <span className="travel-map__hint">
          {filterActive ? (
            <>筛选命中 <b>{points.filter(p => p.matched).length}</b> 处 · 已打卡 <b>{points.filter(p => p.visited).length}</b> 处</>
          ) : (
            <>共 <b>{points.length}</b> 处 · 已打卡 <b>{points.filter(p => p.visited).length}</b> 处</>
          )}
        </span>
        <div className="travel-map__zoom">
          <button className="travel-map__zbtn" onClick={() => zoom(0.7)} title="放大">+</button>
          <button className="travel-map__zbtn" onClick={() => zoom(1.4)} title="缩小">−</button>
          <button className="travel-map__zbtn" onClick={reset} title="复位">⟳</button>
        </div>
      </div>
      <div className="travel-map__wrap" style={height ? { height } : undefined}>
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid slice"
          xmlns={NS}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <radialGradient id="seaGrad"><stop offset="0%" stopColor="#e8f0f5" /><stop offset="100%" stopColor="#d8e4ec" /></radialGradient>
            <pattern id="waves" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M0 10 Q10 4 20 10 T40 10" stroke="#c5d4df" strokeWidth="0.8" fill="none" opacity="0.5" />
            </pattern>
            <pattern id="streets" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
              <path d="M0 0 L0 26 M13 0 L13 26 M0 0 L26 0 M0 13 L26 13" stroke="#fff" strokeWidth="0.4" opacity="0.35" />
            </pattern>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d97757" /><stop offset="100%" stopColor="#e8a87c" /></linearGradient>
            <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c98bd4" /><stop offset="100%" stopColor="#b8a8e8" /></linearGradient>
          </defs>
          <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="url(#seaGrad)" />
          <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="url(#waves)" />
          {/* 区轮廓 */}
          <g>
            {DISTRICTS.map(d => (
              <g key={d.name}>
                <polygon points={d.points} fill={DISTRICT_COLORS[d.name] || '#f5efe6'} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
                <polygon points={d.points} fill="url(#streets)" />
                <text x={d.labelX || centroid(d.points).x} y={d.labelY || centroid(d.points).y} textAnchor="middle" className="map-district-label">{d.name}</text>
              </g>
            ))}
          </g>
          {/* 家标记（特殊图标，不受筛选影响） */}
          <g>
            {homePoints.map(h => (
              <g
                key={h.id}
                className="map-home"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => onSpotPointerDown(e, h)}
                onPointerUp={(e) => onSpotPointerUp(e, h)}
                onPointerEnter={() => setHover(h)}
                onPointerLeave={() => setHover(null)}
              >
                <circle cx={h.x} cy={h.y} r="16" fill="transparent" />
                {/* 房子外框 */}
                <path
                  d={`M${h.x-9} ${h.y+2} L${h.x-9} ${h.y-4} L${h.x} ${h.y-11} L${h.x+9} ${h.y-4} L${h.x+9} ${h.y+2} Z`}
                  fill="#fff7ed" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round"
                />
                {/* 屋顶高亮 */}
                <path
                  d={`M${h.x-9} ${h.y-4} L${h.x} ${h.y-11} L${h.x+9} ${h.y-4}`}
                  fill="none" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round"
                />
                <text x={h.x} y={h.y - 15} textAnchor="middle" className="map-home-label">{h.name}</text>
              </g>
            ))}
          </g>
          {/* 地点点位 */}
          <g>
            {points.map(s => {
              const visited = s.visited;
              const stars = s.stars;
              const dimmed = filterActive && !s.matched;
              return (
                <g
                  key={s.id}
                  className={`map-spot${dimmed ? ' is-dimmed' : ''}`}
                  style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}
                  onPointerDown={(e) => onSpotPointerDown(e, s)}
                  onPointerUp={(e) => onSpotPointerUp(e, s)}
                  onPointerEnter={() => setHover(s)}
                  onPointerLeave={() => setHover(null)}
                >
                  {/* 透明命中区（扩大点击范围） */}
                  <circle cx={s.x} cy={s.y} r="14" fill="transparent" />
                  {/* 视觉层 */}
                  <circle cx={s.x} cy={s.y} r="6.5"
                    fill={dimmed ? '#d8d8d8' : (visited ? 'url(#g2)' : '#c8c2b5')}
                    stroke="#fff" strokeWidth="2"
                  />
                  {/* 已出行：紫色圆里加白色 √ */}
                  {visited && !dimmed && (
                    <path
                      d={`M${s.x - 2.6},${s.y + 0.2} L${s.x - 0.6},${s.y + 2.2} L${s.x + 3},${s.y - 2.4}`}
                      stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
                    />
                  )}
                  {!dimmed && stars > 0 && labelLayout.get(s.id) && (
                    <text
                      x={(() => {
                        const pos = labelLayout.get(s.id);
                        if (pos === 'left')  return s.x - 12;
                        if (pos === 'right') return s.x + 12;
                        return s.x;  // top/bottom 居中
                      })()}
                      y={(() => {
                        const pos = labelLayout.get(s.id);
                        if (pos === 'bottom') return s.y + 22;
                        if (pos === 'left' || pos === 'right') return s.y + 4;  // 左右放置：垂直居中
                        return s.y - 11;  // top
                      })()}
                      textAnchor={(() => {
                        const pos = labelLayout.get(s.id);
                        if (pos === 'left')  return 'end';
                        if (pos === 'right') return 'start';
                        return 'middle';
                      })()}
                      className="map-spot-label"
                    >{s.name}</text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        {/* 悬浮提示 */}
        {hover && (
          <div className="map-tooltip" style={{ left: '50%', top: 8 }}>
            <span className="map-tooltip__name">{hover.name}</span>
            {hover.stars > 0 && <span className="map-tooltip__stars">{'★'.repeat(hover.stars)}</span>}
            <span className="map-tooltip__hint">{hover.visited ? '已出行' : '点击标记出行'}</span>
          </div>
        )}
      </div>
      <div className="travel-map__legend">
        <span className="legend-item"><i className="legend-dot legend-dot--v2" />已打卡</span>
        <span className="legend-item"><i className="legend-dot legend-dot--uv" />未去过</span>
      </div>
    </div>
  );
}
