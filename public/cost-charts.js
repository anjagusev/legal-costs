// Minimal, dependency-free charts for the Legal Cost Counter.
// Reads monthly aggregates from the JSON script tag #lc_data.

function lcParseData() {
	const el = document.getElementById('lc_data');
	if (!el) return { currency: 'CAD', monthly: [] };
	try {
		const parsed = JSON.parse(el.textContent || '{}');
		return {
			currency: parsed.currency || 'CAD',
			monthly: Array.isArray(parsed.monthly) ? parsed.monthly : [],
		};
	} catch {
		return { currency: 'CAD', monthly: [] };
	}
}

function lcMoney(currency, v) {
	try {
		return new Intl.NumberFormat('en-CA', {
			style: 'currency',
			currency: currency || 'CAD',
			maximumFractionDigits: 2,
		}).format(v);
	} catch {
		return `$${Number(v || 0).toFixed(2)}`;
	}
}

function lcCssVar(name, fallback) {
	const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return v || fallback;
}

function lcClear(el) {
	while (el.firstChild) el.removeChild(el.firstChild);
}

function lcSvgEl(tag, attrs) {
	const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (v == null) continue;
			el.setAttribute(k, String(v));
		}
	}
	return el;
}

function lcTicks(max, count) {
	if (!(max > 0)) return [0];
	const nice = (n) => {
		const exp = Math.floor(Math.log10(n));
		const f = n / Math.pow(10, exp);
		const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
		return nf * Math.pow(10, exp);
	};
	const step = nice(max / Math.max(1, count));
	const out = [];
	for (let v = 0; v <= max + step * 0.5; v += step) out.push(v);
	return out;
}

function lcBand(i, n, x0, x1, gap) {
	const w = x1 - x0;
	const band = w / Math.max(1, n);
	const inner = Math.max(0, band - gap);
	const x = x0 + i * band + (band - inner) / 2;
	return { x, w: inner };
}

function lcHash32(s) {
	// FNV-1a (32-bit)
	let h = 2166136261;
	const str = String(s || '');
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function lcRenderBars(host, rows, currency, opts) {
	const accent = lcCssVar('--accent', '#fbbf24');
	const accent2 = lcCssVar('--accent2', '#22c55e');
	const axis = lcCssVar('--border', 'rgba(255,255,255,0.16)');
	const faint = lcCssVar('--faint', 'rgba(255,255,255,0.56)');
	const text = lcCssVar('--text', 'rgba(255,255,255,0.92)');
	const mono = lcCssVar('--font-mono', 'ui-monospace');

	const palette = [
		'#38bdf8', // sky
		'#fb7185', // rose
		'#a3e635', // lime
		'#f97316', // orange
		'#2dd4bf', // teal
		'#60a5fa', // blue
		'#eab308', // yellow
		'#34d399', // emerald
		'#f472b6', // pink
	];

	const width = host.clientWidth || 900;
	const height = 260;
	const m = { l: 56, r: 16, t: 18, b: 56 };
	const W = width;
	const H = height;
	let x0 = m.l;
	const x1 = W - m.r;
	const y1 = H - m.b;

	const maxTotal = rows.reduce((acc, r) => Math.max(acc, Number(r.total || 0)), 0);
	const maxStack = rows.reduce((acc, r) => {
		const sum = Object.values(r.byCategory || {}).reduce((a, v) => a + Number(v || 0), 0);
		return Math.max(acc, sum);
	}, 0);
	const maxY = opts.view === 'category' ? maxStack : maxTotal;
	const ticks = lcTicks(maxY, 4);
	// Expand left margin based on longest formatted label so digits don't get clipped.
	const longest = ticks.reduce((acc, t) => Math.max(acc, lcMoney(currency, t).length), 0);
	// Monospace at 11px: ~7px per char + padding.
	x0 = Math.max(x0, 14 + longest * 7 + 10);

	const catTotals = (() => {
		const map = new Map();
		for (const r of rows) {
			for (const [k, v] of Object.entries(r.byCategory || {})) {
				const prev = map.get(k) || 0;
				map.set(k, prev + Number(v || 0));
			}
		}
		return map;
	})();

	const cats = [...catTotals.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([k]) => k);

	const colorFor = (cat) => {
		const s = String(cat || '').toLowerCase();
		if (s.includes('mediat')) return accent2;
		if (s.includes('legal') || s.includes('counsel') || s.includes('solicitor')) return accent;
		if (s.includes('other')) return 'rgba(255,255,255,0.72)';
		return palette[lcHash32(cat) % palette.length];
	};

	let legendH = 0;
	if (opts.view === 'category' && cats.length) {
		let lx = x0;
		let rowsUsed = 1;
		for (const c of cats) {
			const itemW = 14 + Math.min(220, c.length * 7 + 30);
			if (lx + itemW > x1) {
				rowsUsed++;
				lx = x0;
			}
			lx += itemW;
		}
		legendH = rowsUsed * 16 + 10;
	}

	const y0 = m.t + legendH;

	const svg = lcSvgEl('svg', {
		viewBox: `0 0 ${W} ${H}`,
		width: '100%',
		height: String(H),
		role: 'img',
		'aria-label': 'Monthly costs',
	});

	// Grid + y-axis labels
	for (const t of ticks) {
		const y = y1 - (maxY ? (t / maxY) * (y1 - y0) : 0);
		svg.appendChild(lcSvgEl('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: axis, 'stroke-width': 1 }));
		const label = lcSvgEl('text', {
			x: x0 - 10,
			y: y + 4,
			fill: faint,
			'font-family': mono,
			'font-size': 11,
			'text-anchor': 'end',
		});
		label.textContent = lcMoney(currency, t);
		svg.appendChild(label);
	}

	// X axis
	svg.appendChild(lcSvgEl('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: axis, 'stroke-width': 1 }));

	// Legend (category view)
	if (opts.view === 'category' && cats.length) {
		let lx = x0;
		let ly = m.t + 14;
		for (const c of cats) {
			const itemW = 14 + Math.min(220, c.length * 7 + 30);
			if (lx + itemW > x1) {
				lx = x0;
				ly += 16;
			}
			const g = lcSvgEl('g');
			g.appendChild(lcSvgEl('rect', { x: lx, y: ly - 10, width: 10, height: 10, rx: 3, fill: colorFor(c), opacity: 0.95 }));
			const t = lcSvgEl('text', { x: lx + 14, y: ly - 2, fill: faint, 'font-family': mono, 'font-size': 11 });
			t.textContent = c;
			g.appendChild(t);
			svg.appendChild(g);
			lx += itemW;
		}
	}

	const n = rows.length;
	for (let i = 0; i < n; i++) {
		const r = rows[i];
		const band = lcBand(i, n, x0, x1, 10);
		const month = String(r.month || '');

		if (opts.view === 'category') {
			const present = cats
				.map((c) => ({ c, v: Number(r.byCategory?.[c] || 0) }))
				.filter((d) => d.v > 0);
			let acc = 0;
			for (let j = 0; j < present.length; j++) {
				const { c, v } = present[j];
				const h = maxY ? (v / maxY) * (y1 - y0) : 0;
				const y = y1 - (acc / maxY) * (y1 - y0) - h;
				acc += v;
				const isBottom = j === 0;
				const isTop = j === present.length - 1;
				const rect = lcSvgEl('rect', {
					x: band.x,
					y,
					width: band.w,
					height: Math.max(0, h),
					rx: isBottom || isTop ? 8 : 0,
					fill: colorFor(c),
					opacity: 0.92,
					stroke: 'rgba(0,0,0,0.12)',
					'stroke-width': 1,
				});
				rect.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'));
				rect.lastChild.textContent = `${month}\n${c}: ${lcMoney(currency, v)}`;
				svg.appendChild(rect);
			}
		} else {
			const v = Number(r.total || 0);
			const h = maxY ? (v / maxY) * (y1 - y0) : 0;
			const rect = lcSvgEl('rect', {
				x: band.x,
				y: y1 - h,
				width: band.w,
				height: Math.max(0, h),
				rx: 8,
				fill: accent,
				opacity: 0.92,
				stroke: 'rgba(0,0,0,0.10)',
				'stroke-width': 1,
			});
			rect.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'));
			rect.lastChild.textContent = `${month}\nTotal: ${lcMoney(currency, v)}`;
			svg.appendChild(rect);
		}

		// x tick label every other month if crowded
		const show = n <= 8 || i % 2 === 0;
		if (show) {
			const tx = band.x + band.w / 2;
			const label = lcSvgEl('text', {
				x: tx,
				y: y1 + 30,
				fill: faint,
				'font-family': mono,
				'font-size': 11,
				'text-anchor': 'middle',
			});
			label.textContent = month;
			svg.appendChild(label);
		}
	}

	host.appendChild(svg);
}

function lcRenderLine(host, rows, currency) {
	const accent2 = lcCssVar('--accent2', '#22c55e');
	const axis = lcCssVar('--border', 'rgba(255,255,255,0.16)');
	const faint = lcCssVar('--faint', 'rgba(255,255,255,0.56)');
	const mono = lcCssVar('--font-mono', 'ui-monospace');

	const width = host.clientWidth || 900;
	const height = 240;
	const m = { l: 56, r: 16, t: 18, b: 56 };
	const W = width;
	const H = height;
	let x0 = m.l;
	const x1 = W - m.r;
	const y0 = m.t;
	const y1 = H - m.b;

	const maxY = rows.reduce((acc, r) => Math.max(acc, Number(r.cumulative || 0)), 0);
	const ticks = lcTicks(maxY, 4);
	const longest = ticks.reduce((acc, t) => Math.max(acc, lcMoney(currency, t).length), 0);
	x0 = Math.max(x0, 14 + longest * 7 + 10);

	const svg = lcSvgEl('svg', {
		viewBox: `0 0 ${W} ${H}`,
		width: '100%',
		height: String(H),
		role: 'img',
		'aria-label': 'Cumulative costs',
	});

	for (const t of ticks) {
		const y = y1 - (maxY ? (t / maxY) * (y1 - y0) : 0);
		svg.appendChild(lcSvgEl('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: axis, 'stroke-width': 1 }));
		const label = lcSvgEl('text', {
			x: x0 - 10,
			y: y + 4,
			fill: faint,
			'font-family': mono,
			'font-size': 11,
			'text-anchor': 'end',
		});
		label.textContent = lcMoney(currency, t);
		svg.appendChild(label);
	}

	svg.appendChild(lcSvgEl('line', { x1: x0, y1: y1, x2: x1, y2: y1, stroke: axis, 'stroke-width': 1 }));

	const n = rows.length;
	if (!n) {
		host.appendChild(svg);
		return;
	}

	const pts = rows.map((r, i) => {
		const band = lcBand(i, n, x0, x1, 10);
		const x = band.x + band.w / 2;
		const v = Number(r.cumulative || 0);
		const y = y1 - (maxY ? (v / maxY) * (y1 - y0) : 0);
		return { x, y, v, month: String(r.month || '') };
	});

	let d = '';
	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		d += (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y + ' ';
	}

	const path = lcSvgEl('path', { d, fill: 'none', stroke: accent2, 'stroke-width': 2.2 });
	svg.appendChild(path);

	for (let i = 0; i < pts.length; i++) {
		const p = pts[i];
		const dot = lcSvgEl('circle', { cx: p.x, cy: p.y, r: 3.4, fill: accent2 });
		dot.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'title'));
		dot.lastChild.textContent = `${p.month}\nCumulative: ${lcMoney(currency, p.v)}`;
		svg.appendChild(dot);

		const show = n <= 8 || i % 2 === 0;
		if (show) {
			const label = lcSvgEl('text', {
				x: p.x,
				y: y1 + 30,
				fill: faint,
				'font-family': mono,
				'font-size': 11,
				'text-anchor': 'middle',
			});
			label.textContent = p.month;
			svg.appendChild(label);
		}
	}

	host.appendChild(svg);
}

function lcSetPressed(groupEl, value) {
	for (const btn of groupEl.querySelectorAll('button')) {
		const isOn = btn.getAttribute('data-range') === value || btn.getAttribute('data-view') === value;
		btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
	}
}

function lcRenderAll(state) {
	const parsed = lcParseData();
	const monthlyAll = parsed.monthly || [];
	const rows = state.range === '12' ? monthlyAll.slice(Math.max(0, monthlyAll.length - 12)) : monthlyAll;
	const hostMonthly = document.getElementById('lc_chart_monthly');
	const hostCum = document.getElementById('lc_chart_cumulative');
	if (!hostMonthly || !hostCum) return;

	lcClear(hostMonthly);
	lcClear(hostCum);

	lcRenderBars(hostMonthly, rows, parsed.currency, { view: state.view });
	lcRenderLine(hostCum, rows, parsed.currency);
}

function lcInit() {
	const state = { range: 'all', view: 'total' };

	for (const seg of document.querySelectorAll('.seg')) {
		seg.addEventListener('click', (e) => {
			const btn = e.target && e.target.closest ? e.target.closest('button') : null;
			if (!btn) return;
			const range = btn.getAttribute('data-range');
			const view = btn.getAttribute('data-view');
			if (range) {
				state.range = range;
				lcSetPressed(seg, range);
			}
			if (view) {
				state.view = view;
				lcSetPressed(seg, view);
			}
			lcRenderAll(state);
		});
	}

	// Re-render on theme changes + resize.
	const mo = new MutationObserver(() => lcRenderAll(state));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	window.addEventListener('resize', () => lcRenderAll(state));

	lcRenderAll(state);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', lcInit);
} else {
	lcInit();
}
