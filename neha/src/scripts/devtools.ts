import {
	PROFILE,
	EXPERIENCE,
	SKILLS,
	MARKETS,
	DEVICES,
	METHODS,
	LIGHTHOUSE,
	CONSOLE_FACTS,
	METHOD_BY_ID,
	MARKET_BY_CODE,
	DEVICE_BY_ID,
	ORDER,
	methodsFor,
	orderTotals,
	money,
	buildDom,
	perfData,
	type DomNode,
	type Market,
	type Device,
	type PaymentMethod,
} from '../lib/devtools/model';
import { SOURCES, highlight, type SourceFile } from '../lib/devtools/sources';

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: unknown) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function jsonHtml(value: unknown, indent = 0): string {
	const pad = '  '.repeat(indent);
	if (value === null) return '<span class="b">null</span>';
	if (typeof value === 'string') return `<span class="s">'${esc(value)}'</span>`;
	if (typeof value === 'number') return `<span class="n">${value}</span>`;
	if (typeof value === 'boolean') return `<span class="b">${value}</span>`;
	if (Array.isArray(value)) {
		if (!value.length) return '[]';
		return `[\n${value.map((v) => `${pad}  ${jsonHtml(v, indent + 1)}`).join(',\n')}\n${pad}]`;
	}
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>);
		if (!entries.length) return '{}';
		return `{\n${entries.map(([k, v]) => `${pad}  <span class="k">${esc(k)}</span>: ${jsonHtml(v, indent + 1)}`).join(',\n')}\n${pad}}`;
	}
	return esc(String(value));
}

function compact(value: Record<string, unknown>): string {
	const parts = Object.entries(value)
		.slice(0, 4)
		.map(([k, v]) => `<span class="k">${esc(k)}</span>: ${typeof v === 'object' ? (Array.isArray(v) ? `Array(${v.length})` : '{…}') : jsonHtml(v)}`);
	const more = Object.keys(value).length > 4 ? ', …' : '';
	return `{${parts.join(', ')}${more}}`;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

type Flags = Record<string, boolean>;

const state = {
	market: MARKETS[0] as Market,
	device: DEVICES[0] as Device,
	method: 'ideal' as string | null,
	flags: {
		'applepay-ios18-fix': true,
		'legacy-payment-path': false,
		'voucher-split-v2': true,
		'pay-button-experiment': false,
	} as Flags,
	button: { variant: 'primary', size: 'md', radius: 'pill', label: 'Pay {total}', loading: false, disabled: false },
	tile: { hints: true, badges: true },
	paying: false,
	confirmed: null as null | { ref: string; method: string },
	error: null as null | { title: string; body: string; fixFlag?: string },
	inspecting: false,
	throttle: 1,
	tab: 'elements',
	selectedNode: null as string | null,
	selectedComp: 'PayButton' as string | null,
};

const FLAG_META: Record<string, string> = {
	'applepay-ios18-fix': 'Wait for merchant validation before requesting the Apple Pay sheet.',
	'legacy-payment-path': 'Retired v1 payment path. Kept dark to prove nothing depends on it.',
	'voucher-split-v2': 'Explain the remainder when a voucher only covers eligible items.',
	'pay-button-experiment': 'A/B: wallet-styled pay button on mobile. Measured, then decided.',
};

/* ------------------------------------------------------------------ */
/* Tabs, resize, shortcuts                                             */
/* ------------------------------------------------------------------ */

const tabButtons = [...document.querySelectorAll<HTMLButtonElement>('.dt-tabbtn')];
const openedOnce = new Set<string>();

function showTab(id: string) {
	state.tab = id;
	tabButtons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
	document.querySelectorAll<HTMLElement>('.dt-pane').forEach((p) => p.classList.toggle('is-active', p.id === `pane-${id}`));
	if (!openedOnce.has(id)) {
		openedOnce.add(id);
		if (id === 'lighthouse') runLighthouse();
		if (id === 'performance') renderPerf();
	}
	if (id === 'console') {
		consoleBadge.textContent = '';
		unreadErrors = 0;
		requestAnimationFrame(() => (consoleLog.scrollTop = consoleLog.scrollHeight));
	}
	try {
		localStorage.setItem('neha-devtools-tab', id);
	} catch {}
}
tabButtons.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab!)));

// Resize handle
(() => {
	const handle = $('resize');
	let startY = 0;
	let startH = 0;
	const panel = document.querySelector<HTMLElement>('.dt-panel')!;
	const onMove = (e: PointerEvent) => {
		const h = Math.min(window.innerHeight * 0.85, Math.max(160, startH + (startY - e.clientY)));
		document.documentElement.style.setProperty('--dt-panel-h', `${h}px`);
	};
	handle.addEventListener('pointerdown', (e) => {
		startY = e.clientY;
		startH = panel.getBoundingClientRect().height;
		handle.setPointerCapture(e.pointerId);
		handle.addEventListener('pointermove', onMove);
	});
	handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', onMove));
	handle.addEventListener('keydown', (e) => {
		const h = panel.getBoundingClientRect().height;
		if (e.key === 'ArrowUp') document.documentElement.style.setProperty('--dt-panel-h', `${Math.min(window.innerHeight * 0.85, h + 24)}px`);
		if (e.key === 'ArrowDown') document.documentElement.style.setProperty('--dt-panel-h', `${Math.max(160, h - 24)}px`);
	});
})();

document.addEventListener('keydown', (e) => {
	if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
		e.preventDefault();
		setInspecting(!state.inspecting);
	}
	if (e.key === 'Escape' && state.inspecting) setInspecting(false);
});

/* ------------------------------------------------------------------ */
/* Console                                                             */
/* ------------------------------------------------------------------ */

const consoleLog = $('console-log');
const consoleBadge = $('console-badge');
let unreadErrors = 0;

type Level = 'log' | 'info' | 'warn' | 'error' | 'input' | 'result';

function appendMsg(level: Level, html: string, src = '') {
	const row = document.createElement('div');
	row.className = `dt-msg is-${level}`;
	row.innerHTML = `<span class="ico"></span><div>${html}</div><span class="src">${src ? `<a>${esc(src)}</a>` : ''}</span>`;
	consoleLog.appendChild(row);
	consoleLog.scrollTop = consoleLog.scrollHeight;
	if (level === 'error' && state.tab !== 'console') {
		unreadErrors++;
		consoleBadge.textContent = String(unreadErrors);
	}
	while (consoleLog.children.length > 400) consoleLog.firstElementChild?.remove();
}

function clog(level: Level, text: string, obj?: Record<string, unknown>, src = 'payments-mfe.js') {
	let html = esc(text);
	if (obj) {
		html += ` <details class="obj"><summary>${compact(obj)}</summary><pre style="margin:2px 0 0 14px">${jsonHtml(obj)}</pre></details>`;
	}
	appendMsg(level, html, src);
}

function ctable(rows: Record<string, unknown>[], src = '') {
	if (!rows.length) return;
	const cols = Object.keys(rows[0]);
	const html = `<table><thead><tr><th>(index)</th>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows
		.map((r, i) => `<tr><td>${i}</td>${cols.map((c) => `<td>${esc(r[c] ?? '')}</td>`).join('')}</tr>`)
		.join('')}</tbody></table>`;
	appendMsg('log', html, src);
}

const COMMANDS: Record<string, { hint: string; run: () => unknown }> = {
	'help()': {
		hint: 'list commands',
		run: () => {
			appendMsg(
				'log',
				`Available commands:\n${Object.entries(COMMANDS)
					.map(([k, v]) => `  <span class="obj"><span class="k">${esc(k)}</span></span>  <span class="dt-muted">— ${esc(v.hint)}</span>`)
					.join('\n')}\n  <span class="dt-muted">…or any arithmetic. Everything else throws, like a real console.</span>`,
			);
			return undefined;
		},
	},
	'neha': { hint: 'the engineer object', run: () => ({ name: PROFILE.name, title: PROFILE.title, focus: PROFILE.focus, location: PROFILE.location, years: 10, stack: PROFILE.stack, available: true }) },
	'neha.experience()': {
		hint: 'console.table of roles',
		run: () => {
			ctable(EXPERIENCE.map((r) => ({ company: r.company, role: r.role, from: r.start, to: r.end, location: r.location })));
			return undefined;
		},
	},
	'neha.skills()': { hint: 'skills grouped by area', run: () => Object.fromEntries(SKILLS.map((g) => [g.group, g.items.map((i) => `${i.name} (${i.years}y)`)])) },
	'neha.payments()': {
		hint: 'the 15 payment methods',
		run: () => {
			ctable(METHODS.map((m) => ({ id: m.id, name: m.name, kind: m.kind, provider: m.provider, markets: MARKETS.filter((mk) => mk.methods.includes(m.id)).length })));
			return undefined;
		},
	},
	'neha.markets()': {
		hint: 'the 9 markets',
		run: () => {
			ctable(MARKETS.map((m) => ({ code: m.code, market: m.name, currency: m.currency, methods: m.methods.length })));
			return undefined;
		},
	},
	'neha.contact()': { hint: 'how to reach her', run: () => ({ email: PROFILE.email, linkedin: PROFILE.linkedin, pdf: location.origin + PROFILE.resumePdf, availability: PROFILE.availability }) },
	'neha.hire()': {
		hint: 'opens your mail client',
		run: () => {
			location.href = `mailto:${PROFILE.email}?subject=${encodeURIComponent('Hello from your DevTools résumé')}`;
			return 'Opening mail client…';
		},
	},
	'checkout.pay()': { hint: 'pay with the selected method', run: () => (pay(), 'Promise {<pending>}') },
	"checkout.select('ideal')": { hint: 'select a payment method by id', run: () => (selectMethod('ideal'), state.method) },
	"checkout.market('DE')": { hint: 'switch market', run: () => (setMarket('DE'), state.market.code) },
	"checkout.device('ios')": { hint: 'emulate a device', run: () => (setDevice('ios'), state.device.name) },
	'checkout.flags': { hint: 'feature flags', run: () => ({ ...state.flags }) },
	"checkout.flags.set('applepay-ios18-fix', false)": { hint: 'toggle a flag', run: () => (setFlag('applepay-ios18-fix', false), { ...state.flags }) },
	'checkout.state': { hint: 'current checkout state', run: () => ({ market: state.market.code, device: state.device.id, method: state.method, total: money(orderTotals(state.market).total, state.market), paying: state.paying }) },
	'document.title': { hint: '', run: () => document.title },
	'location.href': { hint: '', run: () => `https://checkout.example/pay?market=${state.market.code}&device=${state.device.id}` },
	'navigator.userAgent': { hint: 'emulated', run: () => state.device.ua },
	'clear()': { hint: 'clear the console', run: () => (clearConsole(), undefined) },
};

function clearConsole() {
	consoleLog.innerHTML = '';
	appendMsg('log', '<span class="dt-muted">Console was cleared</span>');
}

function evaluate(input: string) {
	const src = input.trim();
	if (!src) return;
	appendMsg('input', esc(src));
	cmdHistory.push(src);
	historyIndex = cmdHistory.length;

	// generic forms: checkout.select('x'), checkout.market('X'), checkout.device('x'), checkout.flags.set('k', bool)
	let m: RegExpMatchArray | null;
	if ((m = src.match(/^checkout\.select\(['"]([\w-]+)['"]\)$/))) {
		if (!METHOD_BY_ID.has(m[1])) return appendMsg('error', `Uncaught Error: unknown payment method '${esc(m[1])}'. Try neha.payments()`);
		selectMethod(m[1]);
		return appendMsg('result', jsonHtml(state.method));
	}
	if ((m = src.match(/^checkout\.market\(['"](\w{2})['"]\)$/))) {
		if (!MARKET_BY_CODE.has(m[1].toUpperCase())) return appendMsg('error', `Uncaught Error: no market '${esc(m[1])}'. Try neha.markets()`);
		setMarket(m[1].toUpperCase());
		return appendMsg('result', jsonHtml(state.market.name));
	}
	if ((m = src.match(/^checkout\.device\(['"](\w+)['"]\)$/))) {
		if (!DEVICE_BY_ID.has(m[1])) return appendMsg('error', `Uncaught Error: no device '${esc(m[1])}'. Options: ${DEVICES.map((d) => d.id).join(', ')}`);
		setDevice(m[1]);
		return appendMsg('result', jsonHtml(state.device.name));
	}
	if ((m = src.match(/^checkout\.flags\.set\(['"]([\w-]+)['"],\s*(true|false)\)$/))) {
		if (!(m[1] in state.flags)) return appendMsg('error', `Uncaught Error: unknown flag '${esc(m[1])}'`);
		setFlag(m[1], m[2] === 'true');
		return appendMsg('result', `<span class="obj">${jsonHtml({ ...state.flags })}</span>`);
	}
	if (src === 'console.clear()') return clearConsole();

	const cmd = COMMANDS[src];
	if (cmd) {
		const out = cmd.run();
		if (out !== undefined) appendMsg('result', `<span class="obj">${jsonHtml(out)}</span>`);
		return;
	}
	if (/^[\d\s+\-*/().%]+$/.test(src)) {
		try {
			// digits and operators only; nothing else can reach Function()
			const val = Function(`"use strict"; return (${src});`)();
			return appendMsg('result', jsonHtml(val));
		} catch {
			return appendMsg('error', 'Uncaught SyntaxError: Unexpected token');
		}
	}
	const ident = src.match(/^[A-Za-z_$][\w$.]*/)?.[0] ?? src;
	appendMsg('error', `Uncaught ReferenceError: ${esc(ident)} is not defined\n    <span class="dt-muted">at &lt;anonymous&gt;:1:1 — try help()</span>`);
}

const cmdHistory: string[] = [];
let historyIndex = 0;
const consoleInput = $<HTMLInputElement>('console-input');
const consoleHint = $('console-hint');
function submitConsole() {
	evaluate(consoleInput.value);
	consoleInput.value = '';
	updateHint();
}
$('console-form').addEventListener('submit', (e) => {
	e.preventDefault();
	submitConsole();
});
consoleInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		submitConsole();
	} else if (e.key === 'Tab') {
		e.preventDefault();
		const match = Object.keys(COMMANDS).find((k) => k.startsWith(consoleInput.value) && k !== consoleInput.value);
		if (match) consoleInput.value = match;
		updateHint();
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		if (historyIndex > 0) consoleInput.value = cmdHistory[--historyIndex] ?? '';
	} else if (e.key === 'ArrowDown') {
		e.preventDefault();
		if (historyIndex < cmdHistory.length - 1) consoleInput.value = cmdHistory[++historyIndex] ?? '';
		else {
			historyIndex = cmdHistory.length;
			consoleInput.value = '';
		}
	}
});
consoleInput.addEventListener('input', updateHint);
function updateHint() {
	const v = consoleInput.value;
	const match = v ? Object.keys(COMMANDS).find((k) => k.startsWith(v)) : null;
	consoleHint.innerHTML = match && match !== v ? `<b>Tab</b> → ${esc(match)}` : '<b>Tab</b> to autocomplete · <b>↑</b> history';
}
$('console-clear').addEventListener('click', clearConsole);

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */

interface NetRow {
	id: number;
	name: string;
	url: string;
	method: string;
	status: number | null;
	type: 'fetch' | 'doc' | 'script' | 'css' | 'img';
	initiator: string;
	kb: number;
	start: number;
	end: number | null;
	error?: boolean;
	story?: string;
	response?: unknown;
	paymentMethod?: PaymentMethod;
}

const netRows: NetRow[] = [];
let netSeq = 0;
let netEpoch = performance.now();
let netSelected: number | null = null;
let netTypeFilter = 'All';
const netRowsEl = $('net-rows');
const netDetail = $('net-detail');
const netBody = $('net-body');
const netSummary = $('net-summary');
const netBadge = $('network-badge');

const TYPE_LABEL: Record<NetRow['type'], string> = { fetch: 'fetch', doc: 'document', script: 'script', css: 'stylesheet', img: 'webp' };

function netStart(partial: Omit<NetRow, 'id' | 'status' | 'start' | 'end'>): NetRow {
	const row: NetRow = { ...partial, id: ++netSeq, status: null, start: performance.now() - netEpoch, end: null };
	netRows.push(row);
	renderNet();
	return row;
}
function netFinish(row: NetRow, status: number, error = false) {
	row.status = status;
	row.error = error || status >= 400;
	row.end = performance.now() - netEpoch;
	renderNet();
}

function renderNet() {
	const filter = $<HTMLInputElement>('net-filter').value.toLowerCase();
	const visible = netRows.filter((r) => {
		if (filter && !r.name.toLowerCase().includes(filter)) return false;
		if (netTypeFilter === 'All') return true;
		if (netTypeFilter === 'Fetch/XHR') return r.type === 'fetch';
		if (netTypeFilter === 'Doc') return r.type === 'doc';
		if (netTypeFilter === 'JS') return r.type === 'script';
		if (netTypeFilter === 'CSS') return r.type === 'css';
		if (netTypeFilter === 'Img') return r.type === 'img';
		return true;
	});
	// Collapse idle gaps (user thinking time) so bursts of requests stay readable, like DevTools' "group by frame".
	const now = performance.now() - netEpoch;
	const sorted = [...netRows].sort((a, b) => a.start - b.start);
	const shift = new Map<number, number>();
	let offset = 0;
	let lastEnd = 0;
	for (const r of sorted) {
		if (r.start - lastEnd > 800) offset += r.start - lastEnd - 400;
		shift.set(r.id, offset);
		lastEnd = Math.max(lastEnd, r.end ?? now);
	}
	const mapped = (r: NetRow, t: number) => t - (shift.get(r.id) ?? 0);
	const t0 = sorted.length ? mapped(sorted[0], sorted[0].start) : 0;
	const t1 = Math.max(...netRows.map((r) => mapped(r, r.end ?? now)), t0 + 300);
	const span = t1 - t0;
	netRowsEl.innerHTML = visible
		.map((r) => {
			const pending = r.end === null;
			const left = ((mapped(r, r.start) - t0) / span) * 100;
			const width = (((r.end ?? now) - r.start) / span) * 100;
			const dur = pending ? '…' : `${Math.round(r.end! - r.start)} ms`;
			return `<tr data-id="${r.id}" class="${r.id === netSelected ? 'is-selected' : ''} ${r.error ? 'is-error' : ''} ${pending ? 'is-pending' : ''}">
				<td title="${esc(r.url)}">${esc(r.name)}</td>
				<td class="st-${r.status ? String(r.status)[0] : ''}">${pending ? '(pending)' : r.error && r.status === 0 ? '(failed)' : r.status}</td>
				<td>${TYPE_LABEL[r.type]}</td>
				<td>${esc(r.initiator)}</td>
				<td>${r.kb >= 1 ? `${r.kb.toFixed(1)} kB` : `${Math.round(r.kb * 1000)} B`}</td>
				<td>${dur}</td>
				<td><div class="dt-wf"><div class="dt-wf-bar is-${r.type} ${r.error ? 'is-error' : ''} ${pending ? 'is-pending' : ''}" style="left:${left}%;width:${Math.max(width, 0.6)}%"></div></div></td>
			</tr>`;
		})
		.join('');
	const done = netRows.filter((r) => r.end !== null);
	const kb = done.reduce((n, r) => n + r.kb, 0);
	const finish = done.length ? span : 0;
	netSummary.innerHTML = `<span>${netRows.length} requests</span><span>${kb.toFixed(1)} kB transferred</span><span>Finish: ${Math.round(finish)} ms</span><span>DOMContentLoaded: 212 ms</span><span>Load: ${Math.max(212, Math.round(finish))} ms</span>`;
	const failed = netRows.filter((r) => r.error).length;
	netBadge.textContent = failed ? String(failed) : '';
	if (netRows.some((r) => r.end === null)) requestAnimationFrame(renderNet);
}

netRowsEl.addEventListener('click', (e) => {
	const tr = (e.target as HTMLElement).closest('tr');
	if (!tr) return;
	netSelected = Number(tr.dataset.id);
	renderNet();
	renderNetDetail('headers');
});

function renderNetDetail(tab: 'headers' | 'preview' | 'response' | 'timing') {
	const r = netRows.find((x) => x.id === netSelected);
	if (!r) {
		netDetail.hidden = true;
		netBody.classList.remove('has-detail');
		return;
	}
	netDetail.hidden = false;
	netBody.classList.add('has-detail');
	const tabs = ['headers', 'preview', 'response', 'timing'] as const;
	let body = '';
	if (tab === 'headers') {
		body = `<h4>General</h4>
			<div class="row"><b>Request URL</b><span>${esc(r.url)}</span></div>
			<div class="row"><b>Request Method</b><span>${esc(r.method)}</span></div>
			<div class="row"><b>Status Code</b><span>${r.status === null ? '(pending)' : r.status} ${r.error ? '✕' : '●'}</span></div>
			<div class="row"><b>Remote Address</b><span>151.101.1.195:443</span></div>
			<h4>Request Headers</h4>
			<div class="row"><b>accept</b><span>application/json</span></div>
			<div class="row"><b>content-type</b><span>application/json</span></div>
			<div class="row"><b>x-market</b><span>${state.market.code}</span></div>
			<div class="row"><b>x-device</b><span>${state.device.id}</span></div>
			<div class="row"><b>x-feature-flags</b><span>${Object.entries(state.flags).filter(([, v]) => v).map(([k]) => k).join(', ') || '—'}</span></div>
			<div class="row"><b>user-agent</b><span>${esc(state.device.ua)}</span></div>
			<h4>Response Headers</h4>
			<div class="row"><b>content-type</b><span>${r.type === 'fetch' ? 'application/json; charset=utf-8' : r.type === 'doc' ? 'text/html; charset=utf-8' : r.type === 'script' ? 'application/javascript' : r.type === 'css' ? 'text/css' : 'image/webp'}</span></div>
			<div class="row"><b>cache-control</b><span>${r.type === 'fetch' || r.type === 'doc' ? 'no-store' : 'public, max-age=31536000, immutable'}</span></div>
			<div class="row"><b>x-served-by</b><span>payments-bff · eu-west-1</span></div>`;
	} else if (tab === 'preview') {
		body = r.story
			? `<p><b class="dt-mono" style="color:var(--color-accent)">${esc(r.paymentMethod?.name ?? r.name)}</b></p><p>${esc(r.story)}</p>${r.paymentMethod ? `<p class="dt-muted" style="font-size:11.5px">Flow: ${esc(r.paymentMethod.flow)} · Provider: ${esc(r.paymentMethod.provider)}</p>` : ''}`
			: `<pre>${r.response ? jsonHtml(r.response) : '<span class="dt-muted">(binary)</span>'}</pre>`;
	} else if (tab === 'response') {
		body = `<pre>${r.response ? jsonHtml(r.response) : r.type === 'doc' ? esc('<!doctype html>\n<html lang="' + state.market.locale + '">\n  <head><title>Checkout — ' + ORDER.restaurant + '</title>…') : '<span class="dt-muted">(binary · ' + r.kb.toFixed(1) + ' kB)</span>'}</pre>`;
	} else {
		const total = r.end === null ? 0 : r.end - r.start;
		const parts: [string, number][] = [
			['Queueing', total * 0.04],
			['Stalled', total * 0.06],
			['DNS Lookup', total * 0.03],
			['Initial connection', total * 0.08],
			['SSL', total * 0.06],
			['Request sent', total * 0.01],
			['Waiting for server response', total * 0.6],
			['Content Download', total * 0.12],
		];
		body = `<h4>Timing breakdown · ${Math.round(total)} ms</h4>${parts
			.map(([k, v]) => `<div class="row"><b>${k}</b><span><i style="display:inline-block;height:8px;width:${Math.max(1, (v / Math.max(total, 1)) * 100)}%;background:var(--color-accent-2);border-radius:2px;vertical-align:middle;margin-right:6px"></i>${v.toFixed(1)} ms</span></div>`)
			.join('')}`;
	}
	netDetail.innerHTML = `<div class="dt-toolbar"><button class="dt-iconbtn" id="net-detail-close" aria-label="Close">✕</button><b class="dt-mono" style="color:var(--color-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</b><span class="grow"></span>${tabs
		.map((t) => `<button type="button" data-dtab="${t}" aria-selected="${t === tab}" style="height:30px">${t[0].toUpperCase() + t.slice(1)}</button>`)
		.join('')}</div><div class="dt-kv" style="overflow:auto;flex:1">${body}</div>`;
	netDetail.querySelector('#net-detail-close')!.addEventListener('click', () => {
		netSelected = null;
		renderNet();
		renderNetDetail('headers');
	});
	netDetail.querySelectorAll<HTMLButtonElement>('[data-dtab]').forEach((b) => b.addEventListener('click', () => renderNetDetail(b.dataset.dtab as 'headers')));
}

$('net-clear').addEventListener('click', () => {
	netRows.length = 0;
	netSelected = null;
	netEpoch = performance.now();
	renderNet();
	renderNetDetail('headers');
});
$('net-filter').addEventListener('input', renderNet);
document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((b) =>
	b.addEventListener('click', () => {
		netTypeFilter = b.dataset.type!;
		document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
		renderNet();
	}),
);
$<HTMLSelectElement>('net-throttle').addEventListener('change', (e) => {
	state.throttle = Number((e.target as HTMLSelectElement).value);
	clog('info', `Network throttling: ${(e.target as HTMLSelectElement).selectedOptions[0].textContent} (×${state.throttle} latency)`, undefined, 'devtools');
});

/** Simulates the checkout's initial page load. */
async function pageLoad(reason: string) {
	if (!$<HTMLInputElement>('net-preserve').checked) {
		netRows.length = 0;
		netSelected = null;
		netEpoch = performance.now();
		renderNetDetail('headers');
	}
	if (!$<HTMLInputElement>('console-preserve').checked) consoleLog.innerHTML = '';
	const mk = state.market;
	const methods = methodsFor(mk, state.device);
	const t = state.throttle;
	const seq: [Omit<NetRow, 'id' | 'status' | 'start' | 'end'>, number, number][] = [
		[{ name: `pay?market=${mk.code}`, url: `https://checkout.example/pay?market=${mk.code}&device=${state.device.id}`, method: 'GET', type: 'doc', initiator: 'Other', kb: 12.4 }, 0, 180],
		[{ name: 'design-system.a91f2c.css', url: 'https://cdn.checkout.example/assets/design-system.a91f2c.css', method: 'GET', type: 'css', initiator: `pay?market=${mk.code}`, kb: 18.2 }, 190, 90],
		[{ name: 'checkout.7c3e19.js', url: 'https://cdn.checkout.example/assets/checkout.7c3e19.js', method: 'GET', type: 'script', initiator: `pay?market=${mk.code}`, kb: 86.4 }, 195, 220],
		[{ name: 'payments-mfe.f02b9d.js', url: 'https://cdn.checkout.example/mfe/payments-mfe.f02b9d.js', method: 'GET', type: 'script', initiator: 'single-spa', kb: 41.7 }, 420, 160],
		[{ name: 'sunday-ramen-club.webp', url: 'https://images.checkout.example/r/sunday-ramen-club.webp', method: 'GET', type: 'img', initiator: `pay?market=${mk.code}`, kb: 24.9 }, 230, 140],
		[
			{
				name: 'feature-flags',
				url: 'https://checkout.example/api/feature-flags?scope=payments',
				method: 'GET',
				type: 'fetch',
				initiator: 'checkout.7c3e19.js:1',
				kb: 0.9,
				response: { ...state.flags },
			},
			430,
			60,
		],
		[
			{
				name: `paymentMethods?countryCode=${mk.code}`,
				url: `https://checkout.example/api/checkoutshopper/v71/paymentMethods?countryCode=${mk.code}&amount=${Math.round(orderTotals(mk).total * 100)}&currency=${mk.currency}`,
				method: 'POST',
				type: 'fetch',
				initiator: 'payments-mfe.f02b9d.js:1',
				kb: 3.8,
				response: {
					paymentMethods: methods.map((m) => ({ type: m.id, name: m.name, kind: m.kind, provider: m.provider })),
					hidden: mk.methods.filter((id) => !methods.some((m) => m.id === id)).map((id) => ({ type: id, reason: 'device not eligible (isReadyToPay=false)' })),
				},
			},
			590,
			140,
		],
		[
			{
				name: 'stored-payment-methods',
				url: 'https://checkout.example/api/consumer/stored-payment-methods',
				method: 'GET',
				type: 'fetch',
				initiator: 'payments-mfe.f02b9d.js:1',
				kb: 0.7,
				response: { stored: mk.methods.includes('saved-card') ? [{ type: 'scheme', brand: 'visa', lastFour: '4242', cvcRequired: mk.code === 'GB' }] : [] },
			},
			600,
			110,
		],
	];
	clog('info', `Navigated to https://checkout.example/pay?market=${mk.code} (${reason})`, undefined, 'devtools');
	await Promise.all(
		seq.map(async ([row, at, dur]) => {
			await wait(at * t * 0.35);
			const r = netStart(row);
			await wait(dur * t * 0.5);
			netFinish(r, 200);
		}),
	);
	clog(
		'log',
		`payments-mfe mounted`,
		{ market: mk.code, currency: mk.currency, locale: mk.locale, device: state.device.id, methods: methods.map((m) => m.id), hiddenByDevice: mk.methods.filter((id) => !methods.some((m) => m.id === id)) },
	);
}

/* ------------------------------------------------------------------ */
/* Checkout page                                                       */
/* ------------------------------------------------------------------ */

const page = $('page');
const viewport = $('viewport');
const frame = $('frame');

const LOGO: Record<string, [string, string]> = {
	card: ['CARD', '#1a1f71'],
	'saved-card': ['•4242', '#1a1f71'],
	recurring: ['↻', '#334155'],
	applepay: ['Pay', '#000'],
	googlepay: ['G Pay', '#1f1f1f'],
	amazonpay: ['amazon', '#232f3e'],
	paypal: ['PayPal', '#003087'],
	ideal: ['iDEAL', '#cc0066'],
	bancontact: ['BC', '#005498'],
	payconiq: ['Pq', '#ff4785'],
	eps: ['eps', '#7a1e8c'],
	twint: ['TWINT', '#000'],
	dankort: ['DK', '#c8102e'],
	openbanking: ['OB', '#0f766e'],
	'meal-voucher': ['🍽', '#b45309'],
};

const HINT: Record<string, string> = {
	card: 'Visa, Mastercard, Maestro',
	'saved-card': 'Visa ending 4242',
	recurring: 'Save for your weekly order',
	applepay: 'Face ID, done in a second',
	googlepay: 'Pay with your Google account',
	amazonpay: 'Use your Amazon address & card',
	paypal: 'You will be redirected to PayPal',
	ideal: 'Pay with your Dutch bank',
	bancontact: 'Bancontact card or app',
	payconiq: 'Scan the QR with your app',
	eps: 'Austrian online bank transfer',
	twint: 'Swiss mobile payment',
	dankort: 'Denmark’s national card',
	openbanking: 'Pay directly from your bank',
	'meal-voucher': 'Covers eligible items only',
};

function renderPage() {
	const mk = state.market;
	const totals = orderTotals(mk);
	const methods = methodsFor(mk, state.device);
	if (state.method && !methods.some((m) => m.id === state.method)) state.method = methods[0]?.id ?? null;
	const selected = state.method ? METHOD_BY_ID.get(state.method) : null;
	const label = state.button.label.replace('{total}', money(totals.total, mk));
	const busy = state.paying || state.button.loading;

	const tiles = methods
		.map(
			(m) => `<label class="ck-tile" data-method="${m.id}" data-inspect="payment-method#${m.id}">
			<input type="radio" name="pm" value="${m.id}" ${m.id === state.method ? 'checked' : ''} ${state.paying ? 'disabled' : ''} aria-describedby="hint-${m.id}" />
			<span class="ck-logo" style="background:${LOGO[m.id]?.[1] ?? '#333'}">${LOGO[m.id]?.[0] ?? m.id}</span>
			<span class="ck-name">${esc(m.name)}</span>
			<span class="ck-hint" id="hint-${m.id}">${state.tile.hints ? esc(HINT[m.id] ?? m.flow) : ''}</span>
			${state.tile.badges && m.id === 'saved-card' ? '<span class="ck-badge">Fastest</span>' : state.tile.badges && m.kind === 'wallet' && m.id !== 'paypal' ? '<span class="ck-badge is-new">1-tap</span>' : ''}
		</label>`,
		)
		.join('');

	const story = selected
		? `<div class="ck-story" data-inspect="payment-method#${selected.id}"><b>Behind this integration</b>${esc(selected.story)}<small>${esc(selected.provider)} · ${esc(selected.flow)} · ${selected.requests.length} request${selected.requests.length > 1 ? 's' : ''} per attempt</small></div>`
		: '';

	const status = state.error
		? `<div class="ck-status is-err" role="alert"><strong>${esc(state.error.title)}</strong><br>${esc(state.error.body)}${state.error.fixFlag ? `<br><button type="button" data-fix="${state.error.fixFlag}">Turn on the fix and retry</button>` : ''}</div>`
		: state.confirmed
			? ''
			: selected?.id === 'meal-voucher' && state.flags['voucher-split-v2']
				? `<div class="ck-status is-info">Your voucher covers <b>${money(totals.subtotal * 0.8, mk)}</b> of eligible items. The remaining <b>${money(totals.total - totals.subtotal * 0.8, mk)}</b> (fees, drinks, tip) goes on your saved card.</div>`
				: '';

	const summary = state.confirmed
		? `<div class="ck-confirm" data-inspect="section#experience"><i>✓</i><h3>Order confirmed</h3><p>${esc(ORDER.restaurant)} · ${money(totals.total, mk)} via ${esc(METHOD_BY_ID.get(state.confirmed.method)?.name ?? '')}<br>Ref <span class="dt-mono">${state.confirmed.ref}</span> · arriving in 25–35 min</p><button type="button" data-action="again">Start a new order</button></div>`
		: `<ul class="ck-lines">
			${totals.items.map((i) => `<li class="is-item"><span>${i.qty}× ${esc(i.name)}</span><span>${money(i.amount, mk)}</span></li>`).join('')}
			<li><span>Delivery</span><span>${money(totals.delivery, mk)}</span></li>
			<li><span>Service fee</span><span>${money(totals.service, mk)}</span></li>
			<li><span>Rider tip</span><span>${money(totals.tip, mk)}</span></li>
			<li class="is-voucher"><span>Voucher WELCOME5</span><span>${money(totals.voucher, mk)}</span></li>
			<li class="is-total"><span>Total</span><span>${money(totals.total, mk)}</span></li>
		</ul>
		<button type="button" class="ck-pay" id="pay-btn" data-inspect="section#payments" data-variant="${state.button.variant === 'primary' && (selected?.id === 'applepay' || selected?.id === 'googlepay' || (state.flags['pay-button-experiment'] && state.device.id !== 'desktop' && selected?.kind === 'wallet')) ? 'wallet' : state.button.variant}" data-size="${state.button.size}" data-radius="${state.button.radius}" aria-busy="${busy}" ${state.button.disabled || !selected || busy ? 'disabled' : ''}>
			${busy ? '<span class="spin" aria-hidden="true"></span> Contacting ' + esc(selected?.name ?? '') + '…' : selected?.id === 'applepay' ? 'Pay with Apple Pay' : selected?.id === 'googlepay' ? 'Pay with G Pay' : esc(label)}
		</button>
		<p class="ck-legal">By paying you agree to the Terms. Payments are processed by Adyen.</p>
		${status}`;

	page.innerHTML = `
		<header class="ck-header" data-inspect="header#profile">
			<span class="ck-brand"><i>b</i>bite</span>
			<nav class="ck-steps" aria-label="Checkout steps"><span>Basket</span><span>›</span><span>Delivery</span><span>›</span><b>Payment</b></nav>
			<select class="ck-market" id="market-select" aria-label="Country">${MARKETS.map((m) => `<option value="${m.code}" ${m.code === mk.code ? 'selected' : ''}>${m.flag} ${esc(m.name)}</option>`).join('')}</select>
		</header>
		<div class="ck-grid">
			<section class="ck-main">
				<div class="ck-card" data-inspect="html">
					<div class="ck-address">
						<i><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></i>
						<div><b>Deliver to ${esc(PROFILE.location.split(',')[0])}</b><span>${mk.code === 'NL' ? 'Prinsengracht 263, 1016 GV' : 'Home · saved address'} · ${esc(mk.name)}</span></div>
						<a class="ck-link" href="#" onclick="return false">Change</a>
					</div>
				</div>
				<div class="ck-card">
					<h2>Payment <small>${methods.length} of ${mk.methods.length} methods on ${esc(state.device.name.split(' · ')[0])}</small></h2>
					<p class="ck-sub">${mk.methods.length - methods.length ? `${mk.methods.length - methods.length} wallet${mk.methods.length - methods.length > 1 ? 's' : ''} hidden: not available on this device.` : 'Everything this market supports is available on this device.'}</p>
					<fieldset class="ck-methods" id="methods">
						<legend class="sr-only">Payment method</legend>
						${tiles || '<div class="ck-empty">No payment methods for this market/device combination.</div>'}
					</fieldset>
					${story}
				</div>
			</section>
			<aside class="ck-summary">
				<div class="ck-card">
					<h2>Your order <small>${esc(ORDER.restaurant)}</small></h2>
					${summary}
					<div class="ck-flags" data-inspect="section#payments">
						<p>Feature flags · ${Object.values(state.flags).filter(Boolean).length} on</p>
						${Object.entries(state.flags)
							.map(
								([k, v]) => `<div class="ck-flag"><div><span>${k}</span><small>${esc(FLAG_META[k] ?? '')}</small></div><button type="button" class="ck-switch" role="switch" aria-checked="${v}" data-flag="${k}" aria-label="${k}"></button></div>`,
							)
							.join('')}
					</div>
				</div>
			</aside>
		</div>`;

	$('tab-title').textContent = state.confirmed ? `Order confirmed — ${ORDER.restaurant}` : `Checkout — ${ORDER.restaurant}`;
	$('url-market').textContent = mk.code;
	$('url-device').textContent = state.device.id;
	$<HTMLSelectElement>('market-select-top').value = mk.code;
	$<HTMLSelectElement>('device-select').value = state.device.id;
	document.title = `${PROFILE.name} — résumé, inspected · ${mk.flag} ${mk.code}`;
	refreshInspectedHighlight();
	renderCompTree();
}

page.addEventListener('change', (e) => {
	const t = e.target as HTMLElement;
	if (t.id === 'market-select') setMarket((t as HTMLSelectElement).value);
	if ((t as HTMLInputElement).name === 'pm') selectMethod((t as HTMLInputElement).value);
});
page.addEventListener('click', (e) => {
	const t = e.target as HTMLElement;
	if (state.inspecting) {
		e.preventDefault();
		const target = t.closest<HTMLElement>('[data-inspect]');
		if (target) {
			selectNodeBySelector(target.dataset.inspect!);
			setInspecting(false);
			showTab('elements');
		}
		return;
	}
	if (t.closest('#pay-btn')) pay();
	const flag = t.closest<HTMLElement>('[data-flag]');
	if (flag) setFlag(flag.dataset.flag!, flag.getAttribute('aria-checked') !== 'true');
	const fix = t.closest<HTMLElement>('[data-fix]');
	if (fix) {
		setFlag(fix.dataset.fix!, true);
		pay();
	}
	if (t.closest('[data-action="again"]')) {
		state.confirmed = null;
		state.error = null;
		renderPage();
		pageLoad('new order');
	}
});
page.addEventListener('mouseover', (e) => {
	if (!state.inspecting) return;
	page.querySelectorAll('.is-hovered').forEach((el) => el.classList.remove('is-hovered'));
	(e.target as HTMLElement).closest<HTMLElement>('[data-inspect]')?.classList.add('is-hovered');
});
page.addEventListener('mouseleave', () => page.querySelectorAll('.is-hovered').forEach((el) => el.classList.remove('is-hovered')));

function selectMethod(id: string) {
	if (!METHOD_BY_ID.has(id)) return;
	state.method = id;
	state.error = null;
	const m = METHOD_BY_ID.get(id)!;
	clog('log', `payment_method.selected`, { method: id, kind: m.kind, market: state.market.code, device: state.device.id });
	renderPage();
	const node = findNode((n) => n.linkMethod === id);
	if (node && state.tab === 'elements') selectNode(node.id, false);
}

function setMarket(code: string) {
	const mk = MARKET_BY_CODE.get(code);
	if (!mk || mk.code === state.market.code) return;
	state.market = mk;
	state.confirmed = null;
	state.error = null;
	renderPage();
	pageLoad(`market → ${mk.code}`);
}

function applyDevice(d: Device) {
	state.device = d;
	viewport.dataset.device = d.id;
	frame.style.maxWidth = d.id === 'desktop' ? '' : `${d.width + 20}px`;
	$('device-label').textContent = `${d.name} · ${d.width}px · ${d.ua}`;
	$('device-toggle').setAttribute('aria-pressed', String(d.id !== 'desktop'));
}

function setDevice(id: string) {
	const d = DEVICE_BY_ID.get(id);
	if (!d || d.id === state.device.id) return;
	applyDevice(d);
	state.error = null;
	renderPage();
	clog('info', `Device emulation: ${d.name}`, { userAgent: d.ua, width: d.width, applePay: methodsFor(state.market, d).some((m) => m.id === 'applepay'), googlePay: methodsFor(state.market, d).some((m) => m.id === 'googlepay') }, 'devtools');
	pageLoad(`device → ${d.id}`);
}

function setFlag(key: string, value: boolean) {
	if (!(key in state.flags)) return;
	state.flags[key] = value;
	state.error = null;
	clog(value ? 'info' : 'warn', `feature_flag.${value ? 'enabled' : 'disabled'}`, { flag: key, value, scope: 'payments', note: FLAG_META[key] });
	if (key === 'legacy-payment-path' && value) clog('warn', 'legacy-payment-path is retired. Enabling it routes nowhere; the next payment will show you why.', undefined, 'payments-mfe.js');
	renderPage();
}

/** The payment flow. Requests, logs and failure modes come from her actual work. */
async function pay() {
	if (state.paying || !state.method) return;
	const m = METHOD_BY_ID.get(state.method)!;
	const mk = state.market;
	const totals = orderTotals(mk);
	state.paying = true;
	state.error = null;
	state.confirmed = null;
	renderPage();
	const t0 = performance.now();
	const ctx = { method: m.id, market: mk.code, currency: mk.currency, amount: Math.round(totals.total * 100), device: state.device.id, psp: 'adyen' };
	clog('info', 'payment.started', ctx);

	const race = m.id === 'applepay' && state.device.id === 'ios' && !state.flags['applepay-ios18-fix'];

	if (state.flags['legacy-payment-path']) {
		const r = netStart({ name: 'v1/legacy/pay', url: 'https://checkout.example/api/v1/legacy/pay', method: 'POST', type: 'fetch', initiator: 'payments-mfe.f02b9d.js:1', kb: 0.2, response: { error: 'Gone', message: 'Legacy payment path retired 2025-05. Use /payments.' } });
		await wait(120 * state.throttle);
		netFinish(r, 410, true);
		clog('error', 'POST https://checkout.example/api/v1/legacy/pay 410 (Gone)', undefined, 'payments-mfe.js');
		clog('warn', 'payment.legacy_path_blocked — falling back to /payments. This is the point: nothing depends on the old path anymore.', { code: 'payments.web.legacy.gone', retired: '3 paths', regression: 'none' });
	}

	for (let i = 0; i < m.requests.length; i++) {
		const req = m.requests[i];
		const isScript = 'type' in req && req.type === 'script';
		const url = req.path.startsWith('http') ? req.path : `https://checkout.example/api${req.path}`;
		const r = netStart({
			name: req.path.startsWith('http') ? req.path.replace(/^https?:\/\//, '').replace(/\?.*$/, '') : req.path.replace(/^\//, ''),
			url,
			method: isScript ? 'GET' : req.method,
			type: isScript ? 'script' : 'fetch',
			initiator: 'payments-mfe.f02b9d.js:1',
			kb: req.kb,
			paymentMethod: m,
			story: m.story,
			response: isScript
				? undefined
				: req.status === 302
					? { redirect: url, note: 'Bank/wallet redirect. Checkout state persisted so the return is re-entrant.' }
					: { resultCode: i === m.requests.length - 1 ? 'Authorised' : 'Pending', pspReference: `${Date.now().toString(36).toUpperCase()}${i}`, merchantReference: `bite-${mk.code.toLowerCase()}-${(1000 + i * 37).toString(36)}`, amount: { currency: mk.currency, value: Math.round(totals.total * 100) }, paymentMethod: { type: m.id } },
		});
		await wait(req.ms * state.throttle * 0.55);
		netFinish(r, req.status);
		clog('log', `${isScript ? 'GET' : req.method} ${req.path} → ${req.status} (${Math.round(req.ms * state.throttle)} ms)`, undefined, 'payments-mfe.js');

		if (race && i === 0) {
			await wait(150 * state.throttle);
			state.paying = false;
			state.error = {
				title: 'Apple Pay isn’t available right now',
				body: 'The payment sheet was requested before merchant validation finished. On iOS 18 Safari this throws instead of waiting.',
				fixFlag: 'applepay-ios18-fix',
			};
			clog('error', 'Uncaught (in promise) InvalidAccessError: Must create a new ApplePaySession from a user gesture handler.\n    at requestSheet (payments-mfe.f02b9d.js:1:48213)\n    at async pay (payments-mfe.f02b9d.js:1:47790)', undefined, 'payments-mfe.js');
			clog('error', 'payment.failed', { code: 'payments.web.applepay.session_race', severity: 'P2', monitor: 'applepay-session-failures', ios: '18.0', fix: 'flag applepay-ios18-fix → await validation before requestSheet()', ...ctx });
			appendMsg('warn', `<span class="dt-mono">DataDog</span> monitor <b>applepay-session-failures</b> would page <span class="tag">P2</span> — this is the alert taxonomy she built, aligned with iOS.`, 'datadog-rum.js');
			renderPage();
			return;
		}
	}

	const durationMs = Math.round(performance.now() - t0);
	state.paying = false;
	state.confirmed = { ref: `BITE-${mk.code}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, method: m.id };
	clog('info', 'payment.authorised', { ...ctx, resultCode: 'Authorised', durationMs, requests: m.requests.length + (state.flags['legacy-payment-path'] ? 1 : 0) });
	if (m.id === 'meal-voucher') clog('log', 'voucher.split', { covered: Math.round(totals.subtotal * 0.8 * 100), remainder: Math.round((totals.total - totals.subtotal * 0.8) * 100), remainderMethod: 'saved-card', experiment: state.flags['voucher-split-v2'] ? 'split-explainer-v2' : 'control' });
	if (m.id === 'applepay' && state.device.id === 'ios') clog('log', 'applepay.sheet_total_verified', { sheetTotal: Math.round(totals.total * 100), orderTotal: Math.round(totals.total * 100), match: true, note: 'Derived from the same source as the order summary since the mismatch fix.' });
	clog('log', 'conversion.recorded', { market: mk.code, method: m.id, device: state.device.id, outcome: 'authorised', weeklyReview: 'success rate by market × method × device' }, 'snowplow.js');
	renderPage();
}

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */

const DOM = buildDom();
const nodeIndex = new Map<string, { node: DomNode; parent: DomNode | null; depth: number }>();
(function index(node: DomNode, parent: DomNode | null, depth: number) {
	nodeIndex.set(node.id, { node, parent, depth });
	node.children?.forEach((c) => index(c, node, depth + 1));
})(DOM, null, 0);

const VOID = new Set(['meta', 'link', 'img', 'br', 'input']);
const domTree = $('dom-tree');
const stylesPane = $('styles-pane');
const crumbs = $('crumbs');

function openTag(n: DomNode) {
	const attrs = Object.entries(n.attrs ?? {})
		.map(([k, v]) => ` <span class="an">${esc(k)}</span>=<span class="av">"${esc(v)}"</span>`)
		.join('');
	return `<span class="tag">&lt;${esc(n.tag)}</span>${attrs}<span class="tag">&gt;</span>`;
}

function renderNode(n: DomNode, depth: number): string {
	if (n.tag === '#text') return `<div class="dt-node" data-id="${n.id}"><div class="dt-node-row" style="--depth:${depth}"><span class="tw" style="visibility:hidden">▸</span><span class="txt">${esc(n.text)}</span></div></div>`;
	const hasChildren = Boolean(n.children?.length);
	const inlineText = !hasChildren && n.text !== undefined;
	const isVoid = VOID.has(n.tag);
	const open = n.open ?? false;
	if (!hasChildren) {
		return `<div class="dt-node" data-id="${n.id}" data-open="true"><div class="dt-node-row" style="--depth:${depth}"><span class="tw" style="visibility:hidden">▸</span><span>${openTag(n)}${inlineText ? `<span class="txt">${esc(n.text)}</span>` : ''}${isVoid ? '' : `<span class="tag">&lt;/${esc(n.tag)}&gt;</span>`}</span></div></div>`;
	}
	return `<div class="dt-node" data-id="${n.id}" data-open="${open}">
		<div class="dt-node-row" style="--depth:${depth}"><span class="tw">▸</span><span>${openTag(n)}<span class="ellip">…</span><span class="close-inline tag">&lt;/${esc(n.tag)}&gt;</span></span></div>
		<div class="dt-children">${n.children!.map((c) => renderNode(c, depth + 1)).join('')}</div>
		<div class="dt-close-row" style="--depth:${depth}">&lt;/${esc(n.tag)}&gt;</div>
	</div>`;
}

function renderTree() {
	domTree.innerHTML = `<div class="dt-node-row" style="--depth:0;color:var(--color-muted)"><span class="tw" style="visibility:hidden">▸</span>&lt;!DOCTYPE html&gt;</div>${renderNode(DOM, 0)}`;
}

domTree.addEventListener('click', (e) => {
	const t = e.target as HTMLElement;
	const row = t.closest<HTMLElement>('.dt-node-row');
	const nodeEl = row?.parentElement as HTMLElement | null;
	if (!row || !nodeEl?.dataset.id) return;
	if (t.classList.contains('tw')) {
		nodeEl.dataset.open = String(nodeEl.dataset.open !== 'true');
		return;
	}
	selectNode(nodeEl.dataset.id, false);
});
domTree.addEventListener('dblclick', (e) => {
	const nodeEl = (e.target as HTMLElement).closest<HTMLElement>('.dt-node-row')?.parentElement;
	if (nodeEl?.dataset.id && nodeEl.querySelector('.dt-children')) nodeEl.dataset.open = String(nodeEl.dataset.open !== 'true');
});
domTree.addEventListener('mouseover', (e) => {
	const nodeEl = (e.target as HTMLElement).closest<HTMLElement>('.dt-node');
	page.querySelectorAll('.is-hovered').forEach((el) => el.classList.remove('is-hovered'));
	const n = nodeEl?.dataset.id ? nodeIndex.get(nodeEl.dataset.id)?.node : null;
	if (n?.linkMethod) page.querySelector(`[data-method="${n.linkMethod}"]`)?.classList.add('is-hovered');
});
domTree.addEventListener('mouseleave', () => page.querySelectorAll('.is-hovered').forEach((el) => el.classList.remove('is-hovered')));

function findNode(pred: (n: DomNode) => boolean): DomNode | null {
	for (const { node } of nodeIndex.values()) if (pred(node)) return node;
	return null;
}

function selectNodeBySelector(sel: string) {
	const m = sel.match(/^([a-z-]+)(?:#([\w-]+))?$/);
	if (!m) return;
	const node = findNode((n) => n.tag === m[1] && (!m[2] || n.attrs?.id === m[2]));
	if (node) selectNode(node.id, true);
}

function selectNode(id: string, reveal: boolean) {
	state.selectedNode = id;
	domTree.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
	const el = domTree.querySelector<HTMLElement>(`.dt-node[data-id="${id}"] > .dt-node-row`);
	if (el) {
		el.classList.add('is-selected');
		// expand ancestors
		let p = el.parentElement?.parentElement?.closest<HTMLElement>('.dt-node');
		while (p) {
			p.dataset.open = 'true';
			p = p.parentElement?.closest<HTMLElement>('.dt-node') ?? null;
		}
		if (reveal) el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
	}
	renderStyles(id);
	renderCrumbs(id);
	refreshInspectedHighlight();
}

function refreshInspectedHighlight() {
	page.querySelectorAll('.is-inspected').forEach((el) => el.classList.remove('is-inspected'));
	const n = state.selectedNode ? nodeIndex.get(state.selectedNode)?.node : null;
	if (!n) return;
	const sel = n.linkMethod ? `[data-method="${n.linkMethod}"]` : `[data-inspect="${n.tag}${n.attrs?.id ? '#' + n.attrs.id : ''}"]`;
	page.querySelector(sel)?.classList.add('is-inspected');
}

function ruleHtml(sel: string, decl: Record<string, string>, src: string) {
	return `<div class="dt-rule"><span class="src">${esc(src)}</span><span class="sel">${esc(sel)}</span> {<div class="decl">${Object.entries(decl)
		.map(([p, v]) => `<div><span class="p">${esc(p)}</span>: <span class="v ${v.startsWith('"') ? 'str' : ''}">${esc(v)}</span>;</div>`)
		.join('')}</div>}</div>`;
}

function renderStyles(id: string) {
	const entry = nodeIndex.get(id);
	if (!entry) return;
	const { node } = entry;
	let html = `<div class="dt-styles-tabs"><b>Styles</b><span>Computed</span><span>Layout</span><span>Event Listeners</span><span>Accessibility</span></div>`;
	html += ruleHtml('element.style', {}, '');
	(node.styles ?? []).forEach((r) => (html += ruleHtml(r.selector, r.decl, 'resume.css')));
	if (node.tag === '#text') html += `<p class="dt-muted" style="font-family:var(--font-sans);font-size:12px;line-height:1.5">${esc(node.text)}</p>`;
	// inherited
	let p = entry.parent;
	while (p) {
		if (p.styles?.length) {
			html += `<p class="dt-muted" style="margin:10px 0 4px;font-family:var(--font-sans);font-size:11px">Inherited from <span class="dt-mono" style="color:var(--color-accent-2)">${esc(p.tag)}${p.attrs?.id ? '#' + esc(p.attrs.id) : ''}</span></p>`;
			p.styles.forEach((r) => (html += ruleHtml(r.selector, r.decl, 'resume.css')));
		}
		p = nodeIndex.get(p.id)?.parent ?? null;
	}
	const textLen = (node.text ?? '').length || (node.children?.length ?? 0);
	html += `<div class="dt-boxmodel">margin —<div>border 1<div>padding 16<div style="border-style:solid">${textLen} × ${node.children?.length ?? 1}</div></div></div></div>`;
	stylesPane.innerHTML = html;
}

function renderCrumbs(id: string) {
	const chain: DomNode[] = [];
	let cur = nodeIndex.get(id);
	while (cur) {
		chain.unshift(cur.node);
		cur = cur.parent ? nodeIndex.get(cur.parent.id) : undefined;
	}
	crumbs.innerHTML = chain
		.map((n, i) => {
			const label = n.tag === '#text' ? '#text' : `${n.tag}${n.attrs?.id ? '#' + n.attrs.id : ''}${n.attrs?.class ? '.' + n.attrs.class.split(' ').join('.') : ''}`;
			return `${i ? '<i>›</i>' : ''}<button type="button" data-crumb="${n.id}">${i === chain.length - 1 ? `<b>${esc(label)}</b>` : esc(label)}</button>`;
		})
		.join('');
	crumbs.querySelectorAll<HTMLButtonElement>('[data-crumb]').forEach((b) => b.addEventListener('click', () => selectNode(b.dataset.crumb!, true)));
}

function setInspecting(on: boolean) {
	state.inspecting = on;
	viewport.classList.toggle('is-inspecting', on);
	$('inspect-toggle').setAttribute('aria-pressed', String(on));
	if (!on) page.querySelectorAll('.is-hovered').forEach((el) => el.classList.remove('is-hovered'));
}
$('inspect-toggle').addEventListener('click', () => setInspecting(!state.inspecting));

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

const edits = new Map<string, string>();
let currentFile: SourceFile = SOURCES[0];
let wrap = false;
const codeView = $('code-view');
const codeEdit = $<HTMLTextAreaElement>('code-edit');
const gutter = $('gutter');
const preview = $<HTMLIFrameElement>('preview');

function fileCode(f: SourceFile) {
	return edits.get(f.path) ?? f.code;
}

function openFile(path: string) {
	const f = SOURCES.find((x) => x.path === path);
	if (!f) return;
	currentFile = f;
	document.querySelectorAll<HTMLButtonElement>('[data-file]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.file === path)));
	$('editor-path').textContent = f.path;
	$('editor-note').textContent = f.note + (f.editable ? '' : ' Read-only excerpt.');
	$('editor-reset').hidden = !f.editable;
	const code = fileCode(f);
	gutter.textContent = code.split('\n').map((_, i) => i + 1).join('\n');
	if (f.editable) {
		codeView.hidden = true;
		codeEdit.hidden = false;
		codeEdit.value = code;
		autosize();
	} else {
		codeEdit.hidden = true;
		codeView.hidden = false;
		codeView.innerHTML = highlight(code, f.lang);
	}
	try {
		localStorage.setItem('neha-devtools-file', path);
	} catch {}
}

function autosize() {
	codeEdit.style.height = 'auto';
	codeEdit.style.height = `${codeEdit.scrollHeight + 24}px`;
}

let previewTimer = 0;
function renderPreview() {
	const get = (p: string) => fileCode(SOURCES.find((f) => f.path === p)!);
	const html = get('playground/index.html');
	const css = get('playground/styles.css');
	const js = get('playground/app.js');
	preview.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style="color:#b91c1c;font:12px monospace">'+e+'</pre>')}<\/script></body></html>`;
	$('preview-status').textContent = `rendered ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

codeEdit.addEventListener('input', () => {
	edits.set(currentFile.path, codeEdit.value);
	gutter.textContent = codeEdit.value.split('\n').map((_, i) => i + 1).join('\n');
	autosize();
	$('preview-status').textContent = 'rendering…';
	clearTimeout(previewTimer);
	previewTimer = window.setTimeout(renderPreview, 250);
});
codeEdit.addEventListener('keydown', (e) => {
	if (e.key === 'Tab') {
		e.preventDefault();
		const s = codeEdit.selectionStart;
		codeEdit.setRangeText('  ', s, codeEdit.selectionEnd, 'end');
		codeEdit.dispatchEvent(new Event('input'));
	}
});
$('editor-reset').addEventListener('click', () => {
	edits.delete(currentFile.path);
	openFile(currentFile.path);
	renderPreview();
	clog('info', `Reset ${currentFile.path} to the committed version`, undefined, 'devtools');
});
$('editor-format').addEventListener('click', () => {
	wrap = !wrap;
	codeView.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
	codeEdit.style.whiteSpace = wrap ? 'pre-wrap' : 'pre';
	$('editor-format').setAttribute('aria-pressed', String(wrap));
});
document.querySelectorAll<HTMLButtonElement>('[data-file]').forEach((b) => b.addEventListener('click', () => openFile(b.dataset.file!)));

/* ------------------------------------------------------------------ */
/* Components (React DevTools × Storybook controls)                    */
/* ------------------------------------------------------------------ */

interface CompNode {
	name: string;
	key?: string;
	props: Record<string, unknown>;
	children?: CompNode[];
	pill?: string;
	docs?: string;
	hooks?: string[];
	controls?: 'button' | 'tile' | 'flags';
	a11y?: string[];
}

function compTree(): CompNode {
	const mk = state.market;
	const methods = methodsFor(mk, state.device);
	const totals = orderTotals(mk);
	return {
		name: 'App',
		props: {},
		children: [
			{
				name: 'CheckoutPage',
				props: { market: mk.code, device: state.device.id, locale: mk.locale },
				hooks: [`useMarket() → "${mk.code}"`, `useDeviceCapabilities() → { applePay: ${methods.some((m) => m.id === 'applepay')}, googlePay: ${methods.some((m) => m.id === 'googlepay')} }`, 'useFeatureFlags() → 4 flags'],
				docs: 'Server-rendered shell; the payments micro-frontend mounts into it via single-spa.',
				children: [
					{ name: 'DeliveryAddress', props: { city: PROFILE.location.split(',')[0], editable: true }, docs: 'Static in this demo.' },
					{
						name: 'PaymentMethodList',
						props: { market: mk.code, count: methods.length, hiddenByDevice: mk.methods.length - methods.length, selected: state.method },
						hooks: [`usePaymentMethods("${mk.code}") → ${methods.length} items`, 'useMemo(visible) → device-gated'],
						docs: 'Wallets are gated by isReadyToPay-style capability checks so users never see a wallet they cannot use.',
						a11y: ['fieldset + legend give the group a name', 'each tile is a real radio with a label', 'hints linked via aria-describedby', 'focus ring visible on keyboard navigation'],
						children: methods.map((m) => ({
							name: 'PaymentMethodTile',
							key: m.id,
							props: { id: m.id, kind: m.kind, provider: m.provider, checked: m.id === state.method, hint: state.tile.hints, badge: state.tile.badges },
							controls: 'tile' as const,
							docs: m.story,
							a11y: ['role=radio via native input', 'accessible name = method name', 'contrast ≥ 4.5:1 on label and hint', 'logo is decorative (aria-hidden)'],
						})),
					},
					{
						name: 'OrderSummary',
						props: { currency: mk.currency, total: money(totals.total, mk), items: totals.items.length, voucher: 'WELCOME5' },
						docs: 'Totals are formatted with Intl.NumberFormat for the market locale; CHF rounds to 0.05.',
						children: [
							{
								name: 'PayButton',
								props: { ...state.button, method: state.method, busy: state.paying },
								controls: 'button' as const,
								pill: 'controls',
								docs: 'The one button that touches money. Variants exist for wallets (black), destructive retries and experiments; size and radius are design tokens, not one-offs.',
								a11y: ['aria-busy while contacting the PSP', 'disabled state has no pointer cursor and no shadow', 'label includes the amount so screen readers hear what is being paid', 'min hit target 44×44 on mobile'],
								hooks: [`useTotal() → ${money(totals.total, mk)}`, 'useExperiment("pay-button-experiment")'],
							},
						],
					},
					{ name: 'FeatureFlags', props: { ...state.flags }, controls: 'flags' as const, docs: 'Flags are read once at mount and pushed via context. The checkout ships behind them.' },
				],
			},
			{
				name: 'Engineer',
				props: { name: PROFILE.name, title: PROFILE.title, focus: PROFILE.focus, years: 10, stack: PROFILE.stack },
				docs: PROFILE.hook,
				hooks: ['useState(curious) → true', `useLocation() → "${PROFILE.location}"`, 'useEffect(() => ship(), [everySprint])'],
				children: [
					...EXPERIENCE.map((r) => ({
						name: 'Role',
						key: r.id,
						props: { company: r.company, title: r.role, from: r.start, to: r.end, location: r.location, stack: r.tags },
						docs: `${r.blurb} ${r.highlights[0]}`,
						hooks: [`useHighlights() → ${r.highlights.length}`],
					})),
					...SKILLS.map((g) => ({ name: 'SkillGroup', key: g.group, props: { group: g.group, items: g.items.map((i) => `${i.name} (${i.years}y)`) }, docs: `${g.items.length} skills, ${Math.max(...g.items.map((i) => i.years))} years at the deepest.` })),
					{ name: 'Contact', props: { email: PROFILE.email, linkedin: PROFILE.linkedin, availability: PROFILE.availability }, docs: 'Email is fastest.' },
				],
			},
		],
	};
}

const compTreeEl = $('comp-tree');
const compPropsEl = $('comp-props');
let compFlat: { node: CompNode; id: string; depth: number }[] = [];

function renderCompTree() {
	const filter = $<HTMLInputElement>('comp-filter').value.trim();
	let re: RegExp | null = null;
	if (filter) {
		const m = filter.match(/^\/(.+)\/([a-z]*)$/);
		try {
			re = m ? new RegExp(m[1], m[2]) : new RegExp(filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
		} catch {
			re = null;
		}
	}
	compFlat = [];
	const walk = (n: CompNode, depth: number, path: string) => {
		const id = `${path}/${n.name}${n.key ? `:${n.key}` : ''}`;
		compFlat.push({ node: n, id, depth });
		n.children?.forEach((c) => walk(c, depth + 1, id));
	};
	walk(compTree(), 0, '');
	compTreeEl.innerHTML = compFlat
		.filter(({ node }) => !re || re.test(node.name) || (node.key && re.test(node.key)))
		.map(
			({ node, id, depth }) =>
				`<div class="dt-comp-row ${id === state.selectedComp || (state.selectedComp && !state.selectedComp.includes('/') && node.name === state.selectedComp && !node.key) ? 'is-selected' : ''}" style="--depth:${re ? 0 : depth}" data-cid="${esc(id)}"><span class="name">${esc(node.name)}</span>${node.key ? `<span class="key"> key="${esc(node.key)}"</span>` : ''}${node.pill ? `<span class="pill">${esc(node.pill)}</span>` : ''}</div>`,
		)
		.join('');
	const sel = compFlat.find((c) => c.id === state.selectedComp) ?? compFlat.find((c) => c.node.name === state.selectedComp && !c.node.key);
	if (sel) {
		state.selectedComp = sel.id;
		// don't yank focus away from a control the user is typing in
		if (!compPropsEl.contains(document.activeElement)) renderCompProps(sel.node);
	}
}
compTreeEl.addEventListener('click', (e) => {
	const row = (e.target as HTMLElement).closest<HTMLElement>('[data-cid]');
	if (!row) return;
	state.selectedComp = row.dataset.cid!;
	renderCompTree();
	if (row.dataset.cid!.includes('PaymentMethodTile:')) {
		const id = row.dataset.cid!.split('PaymentMethodTile:')[1];
		page.querySelectorAll('.is-hovered').forEach((el) => el.classList.remove('is-hovered'));
		page.querySelector(`[data-method="${id}"]`)?.classList.add('is-hovered');
	}
});
$('comp-filter').addEventListener('input', renderCompTree);

function propVal(v: unknown) {
	if (typeof v === 'string') return `<span class="v s">"${esc(v)}"</span>`;
	if (typeof v === 'number') return `<span class="v n">${v}</span>`;
	if (typeof v === 'boolean') return `<span class="v b">${v}</span>`;
	if (v === null || v === undefined) return `<span class="v b">null</span>`;
	if (Array.isArray(v)) return `<span class="v">[${v.map((x) => `"${esc(x)}"`).join(', ')}]</span>`;
	return `<span class="v">${esc(JSON.stringify(v))}</span>`;
}

function renderCompProps(n: CompNode) {
	let html = `<h3>&lt;<span class="name">${esc(n.name)}</span>${n.key ? ` key="${esc(n.key)}"` : ''} /&gt;</h3>`;
	if (n.controls === 'button') {
		html += `<h4>Controls</h4>
			<div class="dt-prop"><span class="k">variant</span><select data-ctl="button.variant">${['primary', 'secondary', 'wallet', 'danger'].map((v) => `<option ${state.button.variant === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
			<div class="dt-prop"><span class="k">size</span><select data-ctl="button.size">${['sm', 'md', 'lg'].map((v) => `<option ${state.button.size === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
			<div class="dt-prop"><span class="k">radius</span><select data-ctl="button.radius">${['pill', 'sharp'].map((v) => `<option ${state.button.radius === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
			<div class="dt-prop"><span class="k">label</span><input type="text" data-ctl="button.label" value="${esc(state.button.label)}" /></div>
			<div class="dt-prop"><span class="k">loading</span><input type="checkbox" data-ctl="button.loading" ${state.button.loading ? 'checked' : ''} /></div>
			<div class="dt-prop"><span class="k">disabled</span><input type="checkbox" data-ctl="button.disabled" ${state.button.disabled ? 'checked' : ''} /></div>`;
	}
	if (n.controls === 'tile') {
		html += `<h4>Controls (all tiles)</h4>
			<div class="dt-prop"><span class="k">hint</span><input type="checkbox" data-ctl="tile.hints" ${state.tile.hints ? 'checked' : ''} /></div>
			<div class="dt-prop"><span class="k">badge</span><input type="checkbox" data-ctl="tile.badges" ${state.tile.badges ? 'checked' : ''} /></div>`;
	}
	if (n.controls === 'flags') {
		html += `<h4>Controls</h4>${Object.entries(state.flags)
			.map(([k, v]) => `<div class="dt-prop"><span class="k">${esc(k)}</span><input type="checkbox" data-flagctl="${k}" ${v ? 'checked' : ''} /></div>`)
			.join('')}`;
	}
	html += `<h4>props</h4>${Object.entries(n.props)
		.map(([k, v]) => `<div class="dt-prop"><span class="k">${esc(k)}</span>${propVal(v)}</div>`)
		.join('')}`;
	if (n.hooks?.length) html += `<h4>hooks</h4>${n.hooks.map((h) => `<div class="dt-prop"><span class="k">${esc(h.split('(')[0])}</span><span class="v">${esc(h.slice(h.indexOf('(')))}</span></div>`).join('')}`;
	if (n.docs) html += `<h4>Docs</h4><p class="dt-docs">${esc(n.docs)}</p>`;
	if (n.a11y?.length) html += `<h4>Accessibility · ${n.a11y.length} checks passing</h4><ul class="dt-a11y">${n.a11y.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`;
	html += `<h4>rendered by</h4><div class="dt-prop"><span class="k">${n.name === 'App' ? 'createRoot()' : 'App'}</span><span class="v dt-muted">react-dom@18 · single-spa</span></div>`;
	compPropsEl.innerHTML = html;
}
compPropsEl.addEventListener('change', (e) => {
	const t = e.target as HTMLInputElement | HTMLSelectElement;
	const ctl = t.dataset.ctl;
	if (ctl) {
		const [group, key] = ctl.split('.') as ['button' | 'tile', string];
		const value = t.type === 'checkbox' ? (t as HTMLInputElement).checked : t.value;
		(state[group] as Record<string, unknown>)[key] = value;
		clog('log', `props.${ctl} = ${JSON.stringify(value)}`, undefined, 'react-devtools');
		renderPage();
	}
	if (t.dataset.flagctl) setFlag(t.dataset.flagctl, (t as HTMLInputElement).checked);
});
compPropsEl.addEventListener('input', (e) => {
	const t = e.target as HTMLInputElement;
	if (t.dataset.ctl === 'button.label') {
		state.button.label = t.value;
		renderPage();
	}
});

/* ------------------------------------------------------------------ */
/* Lighthouse                                                          */
/* ------------------------------------------------------------------ */

let lhCat = 'payments';
function runLighthouse() {
	const btn = $<HTMLButtonElement>('lh-run');
	btn.disabled = true;
	btn.textContent = 'Analyzing…';
	document.querySelectorAll<SVGCircleElement>('.dt-gauge .arc').forEach((c) => (c.style.strokeDashoffset = '226'));
	document.querySelectorAll<SVGTextElement>('.dt-gauge .num').forEach((t) => (t.textContent = '0'));
	setTimeout(() => {
		document.querySelectorAll<HTMLButtonElement>('.dt-gauge').forEach((g) => {
			const arc = g.querySelector<SVGCircleElement>('.arc')!;
			const num = g.querySelector<SVGTextElement>('.num')!;
			const score = Number(arc.dataset.score);
			arc.style.strokeDashoffset = String(226 - (226 * score) / 100);
			const start = performance.now();
			const tick = (now: number) => {
				const p = Math.min(1, (now - start) / (reduceMotion ? 1 : 1400));
				num.textContent = String(Math.round(score * (1 - Math.pow(1 - p, 3))));
				if (p < 1) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		btn.disabled = false;
		btn.innerHTML = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> Analyze again';
		clog('info', 'Lighthouse report generated', Object.fromEntries(LIGHTHOUSE.map((c) => [c.label, c.score])), 'lighthouse');
	}, reduceMotion ? 0 : 500);
	renderAudits();
}
function renderAudits() {
	const cat = LIGHTHOUSE.find((c) => c.id === lhCat) ?? LIGHTHOUSE[0];
	document.querySelectorAll<HTMLButtonElement>('.dt-gauge').forEach((g) => g.setAttribute('aria-pressed', String(g.dataset.cat === cat.id)));
	$('lh-audits').innerHTML = `<h4>${esc(cat.label)} · ${cat.audits.length} passed audits · score ${cat.score}</h4><ul>${cat.audits.map((a) => `<li>${esc(a.title)}</li>`).join('')}</ul>`;
}
$('lh-run').addEventListener('click', runLighthouse);
document.querySelectorAll<HTMLButtonElement>('.dt-gauge').forEach((g) =>
	g.addEventListener('click', () => {
		lhCat = g.dataset.cat!;
		renderAudits();
	}),
);

/* ------------------------------------------------------------------ */
/* Performance                                                         */
/* ------------------------------------------------------------------ */

function renderPerf() {
	const { start, end, bars, markers } = perfData();
	const W = 1000;
	const L = 96;
	const rulerH = 26;
	const trackH = 30;
	const tracks = Math.max(...bars.map((b) => b.track)) + 1;
	const markerY = rulerH + tracks * trackH + 10;
	const H = markerY + 62;
	const x = (year: number) => L + ((year - start) / (end - start)) * (W - L - 12);
	const trackNames = ['Main · roles', 'Stack', 'Stack', 'Payments', 'Payments'];
	let svg = `<svg class="dt-flame" viewBox="0 0 ${W} ${H}" role="img" aria-label="Career flame chart 2016 to today">`;
	svg += '<g class="ruler">';
	for (let y = Math.ceil(start); y <= Math.floor(end); y++) svg += `<line x1="${x(y)}" x2="${x(y)}" y1="${rulerH - 6}" y2="${H}" /><text x="${x(y) + 3}" y="${rulerH - 10}">${y}</text>`;
	svg += '</g>';
	for (let t = 0; t < tracks; t++) {
		if (trackNames[t] && trackNames[t] !== trackNames[t - 1]) svg += `<text class="track-label" x="8" y="${rulerH + t * trackH + 19}">${trackNames[t]}</text>`;
	}
	bars.forEach((b, i) => {
		const x0 = x(b.start);
		const w = Math.max(3, x(b.end) - x0);
		const y = rulerH + b.track * trackH + 3;
		const label = b.label.length * 6 > w - 8 ? b.label.slice(0, Math.max(0, Math.floor((w - 12) / 6))) + (w > 30 ? '…' : '') : b.label;
		svg += `<g class="bar is-${b.tone}" data-bar="${i}"><rect x="${x0}" y="${y}" width="${w}" height="${trackH - 6}" /><text x="${x0 + 5}" y="${y + 16}">${esc(label)}</text></g>`;
	});
	// Stagger labels onto a second row when two markers are too close to read.
	let lastX = -Infinity;
	let row = 0;
	markers.forEach((m, i) => {
		const mx = x(m.at);
		row = mx - lastX < 36 ? 1 - row : 0;
		lastX = mx;
		const ly = markerY + 8 + row * 22;
		svg += `<g class="marker" data-marker="${i}"><line x1="${mx}" x2="${mx}" y1="${rulerH}" y2="${ly + 2}" /><rect x="${mx - 15}" y="${ly}" width="30" height="16" /><text x="${mx}" y="${ly + 12}" text-anchor="middle" style="fill:#1c1523">${m.kind}</text></g>`;
	});
	svg += `<g class="now"><line x1="${x(end)}" x2="${x(end)}" y1="${rulerH - 6}" y2="${H}" /><text x="${x(end) - 4}" y="${H - 4}" text-anchor="end">now</text></g>`;
	svg += '</svg>';
	$('perf-scroll').innerHTML = svg;
	const detail = $('perf-detail');
	const show = (html: string) => (detail.innerHTML = html);
	$('perf-scroll').querySelectorAll<SVGGElement>('[data-bar]').forEach((g) => {
		const b = bars[Number(g.dataset.bar)];
		const dur = b.end - b.start;
		const html = `<span><b>${esc(b.label)}</b><br>${esc(b.detail)}</span><span class="dur">${dur >= 1 ? `${dur.toFixed(1)} yrs` : `${Math.round(dur * 12)} mo`}</span>`;
		g.addEventListener('mouseenter', () => show(html));
		g.addEventListener('click', () => show(html));
	});
	$('perf-scroll').querySelectorAll<SVGGElement>('[data-marker]').forEach((g) => {
		const m = markers[Number(g.dataset.marker)];
		const html = `<span><b>${m.kind}</b> · ${esc(m.detail)}</span><span class="dur">${Math.floor(m.at)}</span>`;
		g.addEventListener('mouseenter', () => show(html));
		g.addEventListener('click', () => show(html));
	});
}

/* ------------------------------------------------------------------ */
/* Browser chrome                                                      */
/* ------------------------------------------------------------------ */

$<HTMLSelectElement>('device-select').addEventListener('change', (e) => setDevice((e.target as HTMLSelectElement).value));
$<HTMLSelectElement>('market-select-top').addEventListener('change', (e) => setMarket((e.target as HTMLSelectElement).value));
$('device-toggle').addEventListener('click', () => setDevice(state.device.id === 'desktop' ? 'ios' : 'desktop'));
$('nav-reload').addEventListener('click', () => {
	state.confirmed = null;
	state.error = null;
	renderPage();
	pageLoad('reload');
});
$('nav-back').addEventListener('click', () => {
	clog('info', 'history.back() — nothing before checkout in this tab. The classic résumé is one click up.', undefined, 'devtools');
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

(function boot() {
	const clock = () => ($('status-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
	clock();
	setInterval(clock, 30_000);

	// Leaving for the classic view must not bounce straight back here.
	document.querySelectorAll<HTMLAnchorElement>('a[href="/"]').forEach((a) =>
		a.addEventListener('click', () => {
			try {
				localStorage.setItem('neha-view', 'classic');
			} catch {}
		}),
	);

	renderTree();
	applyDevice(DEVICES[0] as Device);
	renderPage();
	openFile((() => {
		try {
			return localStorage.getItem('neha-devtools-file') || SOURCES[0].path;
		} catch {
			return SOURCES[0].path;
		}
	})());
	renderPreview();
	renderAudits();

	const introNode = findNode((n) => n.tag === 'article' && n.attrs?.['data-to'] === 'present');
	if (introNode) selectNode(introNode.id, false);

	appendMsg(
		'log',
		`Hi. This is <b>${esc(PROFILE.name)}</b>'s résumé, opened in DevTools.\n` +
			`<span class="dt-muted">The page above is a checkout like the one she works on. Pick a market, a device and a payment method, then press pay and watch Network and Console.\n` +
			`Elements shows her career as a DOM tree · Sources has a live playground · Components has Storybook-style controls wired to the real button · Lighthouse and Performance speak for themselves.</span>`,
		'neha.seth.ltd',
	);
	CONSOLE_FACTS.forEach((f) => appendMsg('info', esc(f), 'resume.json'));
	appendMsg('log', `<span class="dt-muted">Type <span class="obj"><span class="k">help()</span></span> for commands.</span>`);

	let initial = 'elements';
	try {
		initial = localStorage.getItem('neha-devtools-tab') || 'elements';
	} catch {}
	showTab(initial);
	pageLoad('initial');
})();
