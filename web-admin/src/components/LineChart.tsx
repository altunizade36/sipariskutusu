interface Series {
  label: string;
  color: string;
  data: { day: string; count: number }[];
}

interface Props {
  series: Series[];
  height?: number;
}

const W = 800;
const PAD = { top: 28, right: 24, bottom: 44, left: 52 };

function bezierPath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const cpx = (px + cx) / 2;
    d += ` C ${cpx},${py} ${cpx},${cy} ${cx},${cy}`;
  }
  return d;
}

export default function LineChart({ series, height = 220 }: Props) {
  const H = height;
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const allCounts = series.flatMap(s => s.data.map(d => d.count));
  const maxVal = Math.max(1, ...allCounts);
  const len = series[0]?.data.length ?? 0;

  function xOf(i: number) {
    return PAD.left + (len <= 1 ? cW / 2 : (i / (len - 1)) * cW);
  }
  function yOf(v: number) {
    return PAD.top + (1 - v / maxVal) * cH;
  }

  const gridLevels = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {gridLevels.map(p => {
        const v = Math.round(p * maxVal);
        const y = yOf(v);
        return (
          <g key={p}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="#e5e7eb" strokeWidth={p === 0 ? 1.5 : 1}
              strokeDasharray={p > 0 ? '4 4' : ''}
            />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
              {v.toLocaleString('tr-TR')}
            </text>
          </g>
        );
      })}

      {series.map(s => {
        const pts: [number, number][] = s.data.map((d, i) => [xOf(i), yOf(d.count)]);
        const line = bezierPath(pts);
        const lastPt = pts[pts.length - 1];
        const firstPt = pts[0];
        const area = pts.length > 0
          ? line + ` L ${lastPt[0]},${PAD.top + cH} L ${firstPt[0]},${PAD.top + cH} Z`
          : '';
        return (
          <g key={s.label}>
            <path d={area} fill={s.color} fillOpacity={0.1} />
            <path d={line} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {len <= 35 && pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3} fill="white" stroke={s.color} strokeWidth={2}>
                <title>{`${s.data[i].day}: ${s.data[i].count}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {series[0]?.data.map((d, i) => {
        if (len > 10 && i % 5 !== 0 && i !== len - 1) return null;
        return (
          <text key={d.day} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="#9ca3af">
            {d.day.slice(5)}
          </text>
        );
      })}

      <line
        x1={PAD.left} y1={PAD.top + cH} x2={W - PAD.right} y2={PAD.top + cH}
        stroke="#d1d5db" strokeWidth={1.5}
      />
    </svg>
  );
}
