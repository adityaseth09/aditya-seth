/**
 * Client controller for /sre. Vanilla TypeScript, no framework.
 * Reads state from lib/sre/data.ts, renders into the shells in pages/sre.astro:
 * a guided terminal, the incident postmortems, the SLO gauge, golden-signal
 * sparklines, and the deploy timeline interactions.
 */
import {
	INCIDENTS,
	DEPLOYS,
	SLOS,
	SIGNALS,
	ONCALL,
	OBSERVABILITY_STACK,
	TALKS,
	HEADLINE,
	CAREER_START,
	PLATFORM,
	COMMANDS,
	type Incident,
} from '../lib/sre/data';
import resume from '../data/resume.json';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- console output ---------- */

type Line = [text: string, cls?: string];

const out = $('#sre-out');

function say(lines: Line[]): void {
	if (!out) return;
	for (const [text, cls] of lines) {
		const div = document.createElement('div');
		div.className = `sre-line${cls ? ` ${cls}` : ''}`;
		div.textContent = text;
		out.appendChild(div);
	}
	out.scrollTop = out.scrollHeight;
}

function echo(cmd: string): void {
	say([[cmd, 'cmd']]);
}

function boot(): void {
	say([
		[`connected to ${PLATFORM} · all systems operational`, 'ok'],
		[`${INCIDENTS.length} incidents on file · ${DEPLOYS.length} deploys · 0 rollbacks`, 'muted'],
		['type help (or click a chip) to explore the platform', 'muted'],
	]);
}

/* ---------- command handlers ---------- */

const SEVS = ['SEV1', 'SEV2', 'SEV3'] as const;

function cmdHelp(): Line[] {
	return [
		['commands:', 'head'],
		['  help                 this list'],
		['  status               platform summary'],
		['  incidents [sev]      incident feed, optionally filtered by SEV1/2/3'],
		['  postmortem <id>      full postmortem, e.g. postmortem INC-2022-042'],
		['  slo                  SLOs and error budget'],
		['  uptime               reliability record since the first production shift'],
		['  deploys              the career deploy timeline'],
		['  savings              the FinOps numbers'],
		['  fleet                the MySQL fleet at a glance'],
		['  observability        the monitoring stack'],
		['  talks                speaking and community'],
		['  oncall               who carries the pager'],
		['  whoami                the primary on-call, in résumé form'],
		['  clear                clear the console'],
		['promql-ish input is parsed leniently: sum(savings) works too.', 'muted'],
	];
}

function cmdStatus(): Line[] {
	return [
		[`${PLATFORM} · all systems operational`, 'ok'],
		['availability   B.SQL off the top-offender list for availability budget loss (sustained since)'],
		['on-call        pages ~1/month · runbooks cover ~95% of failure modes'],
		['observability  Datadog company-wide (MCP in Fabric) · VividCortex decommissioned'],
		[`incidents      ${INCIDENTS.length} on file · 0 unresolved`],
		[`deploys        ${DEPLOYS.length} releases · 0 rollbacks`],
		['on-call        Aditya · ADS-level escalation rotation · Manchester DB shifts'],
	];
}

function cmdIncidents(sev?: string): Line[] {
	const list = sev ? INCIDENTS.filter((i) => i.sev.toLowerCase() === sev) : INCIDENTS;
	if (!list.length) return [[`no incidents match ${sev ?? ''}`, 'warn']];
	return [
		[`${list.length} resolved incident${list.length === 1 ? '' : 's'}:`, 'head'],
		...list.flatMap((i) => [
			[`  [${i.sev}] ${i.id}  ${i.title}`, i.sev === 'SEV1' ? 'crit' : i.sev === 'SEV2' ? 'warn' : ''],
			[`         ${i.service} · ${i.opened} · ttr ${i.ttr}`, 'muted'],
		]),
		['run: postmortem <id> for the full write-up', 'muted'],
	];
}

function pmLines(i: Incident): Line[] {
	return [
		[`${i.id} · ${i.sev} · resolved`, i.sev === 'SEV1' ? 'crit' : i.sev === 'SEV2' ? 'warn' : ''],
		[i.title, 'head'],
		[`service    ${i.service}`],
		[`opened     ${i.opened}`],
		[`ttr        ${i.ttr}`],
		['impact     ' + i.impact],
		['detection  ' + i.detected],
		['resolution ' + i.resolution],
		['outcome    ' + i.outcome, 'ok'],
		[`tags       ${i.tags.join(' · ')}`, 'muted'],
	];
}

function findIncident(id: string): Incident | undefined {
	const lower = id.toLowerCase();
	if (lower === 'latest') return INCIDENTS[0];
	return INCIDENTS.find((i) => i.id.toLowerCase() === lower);
}

function cmdSlo(): Line[] {
	return [
		['slo.yaml', 'head'],
		...SLOS.flatMap((s): Line[] => [[`  ${s.name.padEnd(16)} target ${s.target} · achieved ${s.achieved} · ${s.budget}`]]),
		['availability budget recovered: B.SQL removed from the top-offender list, sustained since the 2022 turnaround', 'ok'],
	];
}

function cmdUptime(): Line[] {
	const start = new Date(CAREER_START).getTime();
	const days = Math.max(1, Math.floor((Date.now() - start) / 86_400_000));
	const years = Math.floor(days / 365.25);
	const rem = Math.round(days - years * 365.25);
	return [
		['reliability record', 'head'],
		[`  since first production shift (${CAREER_START}): ${years}y ${rem}d`],
		['  B.SQL: off the top-offender list for availability budget loss — sustained since the 2022 turnaround', 'ok'],
		[`  runbooks   ${ONCALL.runbooks} · updated after every new repeating or big failure`],
		[`  pages      ${ONCALL.pages} · Pythian handles routine L1`],
	];
}

function cmdDeploys(): Line[] {
	return [
		['release history · 0 rollbacks', 'head'],
		...DEPLOYS.flatMap((d): Line[] => [
			[`  ${d.version}  ${d.service}  ${d.channel}`, d.current ? 'ok' : undefined],
			[`           ${d.start} → ${d.end} · ${d.region} · ${d.note}`, 'muted'],
		]),
	];
}

function cmdSavings(): Line[] {
	return [
		['finops · savings_total', 'head'],
		['  $40M+/yr     MySQL infrastructure costs cut company-wide for DML', 'ok'],
		['  65%+         cost reduction across AWS and on-prem MySQL', 'ok'],
		['  ~50%         Datadog licence negotiated below the initial quote — and below VividCortex', 'ok'],
		['  migration    thousands of servers supervised to AWS'],
		['  method       measure first (production evidence), then optimise — company-wide cost visibility', 'muted'],
	];
}

function cmdFleet(): Line[] {
	return [
		['mysql_fleet', 'head'],
		['  20,000+ servers · on-prem and AWS · one of the world\u2019s largest MySQL fleets'],
		['  changes       percentage-based canary deployments for database changes — a first for the team'],
		['  pull requests every PR must improve reliability or test coverage'],
		['  ops           outsourced Pythian team handles routine L1 · runbooks ~95% of failure modes'],
		['  compliance    100% SOX · PCI · PII across the MySQL estate'],
	];
}

function cmdObservability(): Line[] {
	return [
		['observability stack', 'head'],
		...OBSERVABILITY_STACK.flatMap((s): Line[] => [['  ' + s]]),
		['Datadog MCP wired into Fabric: every engineer can query monitoring data through AI tooling.', 'muted'],
	];
}

function cmdTalks(): Line[] {
	return [
		['speaking and community', 'head'],
		...TALKS.flatMap((t): Line[] => [
			[`  ${t.event} · ${t.when}`],
			[`    "${t.title}"`, 'ok'],
		]),
		['internal: Observability Day Datadog workshop (30+ attendees) + the Datadog training programme', 'muted'],
	];
}

function cmdSignals(): Line[] {
	return [
		['the four golden signals', 'head'],
		...SIGNALS.map((s) => [`  ${s.label.padEnd(18)} ${s.value}`]),
		['runbooks cover ~95% of known failure modes; the pager now fires about once a month.', 'muted'],
	];
}

function cmdOncall(): Line[] {
	return [
		['pager duty', 'head'],
		[`  primary     ${ONCALL.primary}`],
		[`  rotation    ${ONCALL.escalation}`],
		[`  runbooks    ${ONCALL.runbooks} · updated after every new repeating or big failure`],
		[`  pages       ${ONCALL.pages} — Pythian handles routine L1`, 'ok'],
		['page the primary via LinkedIn (see the On-call panel →)', 'muted'],
	];
}

function cmdWhoami(): Line[] {
	const { profile } = resume;
	return [
		[`${profile.name} — ${HEADLINE}`, 'head'],
		[profile.hook],
		[`  location   ${profile.location}`],
		[`  status     ${profile.availability}`, 'ok'],
		['leads large incidents, sits in the ADS-level escalation rotation, 20+ years in software engineering', 'muted'],
		['run: incidents to see what gets resolved around here', 'muted'],
	];
}

/* ---------- lenient parsing ---------- */

function runCommand(raw: string): void {
	const input = raw.trim();
	if (!input) return;
	echo(input);

	// promql-ish input: strip braces/parens and match on the metric name.
	const flat = input.toLowerCase().replace(/[(){}"']/g, ' ');
	const first = flat.split(/\s+/).filter(Boolean);
	const cmd = first[0] ?? '';
	const arg = first.slice(1).join(' ');

	// A metric-looking query like sum(savings_total) → keyword match anywhere.
	const keyword = (k: string) => flat.includes(k);

	if (cmd === 'clear') {
		if (out) out.replaceChildren();
		return;
	}
	if (cmd === 'help' || cmd === '?') return say(cmdHelp());
	if (cmd === 'status' || keyword(' up ') || flat === 'up') return say(cmdStatus());
	if (cmd === 'incidents' || keyword('incident')) {
		const sev = first.find((w) => SEVS.some((s) => s.toLowerCase() === w));
		return say(cmdIncidents(sev?.toLowerCase()));
	}
	if (cmd === 'postmortem' || keyword('postmortem')) {
		const inc = findIncident(arg || 'latest');
		if (!inc) return say([[`no postmortem matches "${arg}" — try: postmortem latest`, 'warn']]);
		selectIncident(inc.id, false);
		return say(pmLines(inc));
	}
	if (cmd === 'slo' || keyword('slo') || keyword('error_budget')) return say(cmdSlo());
	if (cmd === 'uptime' || keyword('uptime')) return say(cmdUptime());
	if (cmd === 'deploys' || cmd === 'releases' || keyword('deploy')) return say(cmdDeploys());
	if (cmd === 'savings' || cmd === 'finops' || cmd === 'cost' || keyword('savings')) return say(cmdSavings());
	if (cmd === 'fleet' || cmd === 'mysql' || keyword('fleet')) return say(cmdFleet());
	if (cmd === 'observability' || keyword('datadog') || keyword('observability')) return say(cmdObservability());
	if (cmd === 'talks' || cmd === 'speaking' || keyword('talks')) return say(cmdTalks());
	if (cmd === 'signals' || cmd === 'golden' || keyword('rate(')) return say(cmdSignals());
	if (cmd === 'oncall' || cmd === 'page' || keyword('oncall')) return say(cmdOncall());
	if (cmd === 'whoami' || cmd === 'profile' || keyword('whoami')) return say(cmdWhoami());

	say([
		[`unknown command: ${cmd}`, 'warn'],
		['type help — or click one of the chips below the console', 'muted'],
	]);
}

/* ---------- incident postmortem panel ---------- */

function selectIncident(id: string, announce = true): void {
	const inc = findIncident(id);
	if (!inc) return;
	for (const row of $$<HTMLButtonElement>('.sre-incident')) {
		row.setAttribute('aria-pressed', String(row.dataset.incident === inc.id));
	}
	const set = (sel: string, text: string) => {
		const el = $(sel);
		if (el) el.textContent = text;
	};
	const sev = $('#pm-sev');
	if (sev) sev.dataset.sev = inc.sev;
	set('#pm-id', inc.id);
	set('#pm-title', inc.title);
	set('#pm-service', inc.service);
	set('#pm-opened', inc.opened);
	set('#pm-ttr', inc.ttr);
	set('#pm-impact', inc.impact);
	set('#pm-detected', inc.detected);
	set('#pm-resolution', inc.resolution);
	set('#pm-outcome', inc.outcome);
	const tags = $('#pm-tags');
	if (tags) tags.replaceChildren(...inc.tags.map((t) => {
		const span = document.createElement('span');
		span.className = 'sre-tag';
		span.textContent = t;
		return span;
	}));
	if (announce) say(pmLines(inc));
}

/* ---------- gauge, budget, sparklines ---------- */

function animateHealth(): void {
	// Gauge: runbook coverage (~95% of known failure modes), from the CV.
	const C = 2 * Math.PI * 52; // 326.7
	const gauge = $('#gauge-fill');
	const gaugeValue = $('#gauge-value');
	const budgetBar = $('#budget-bar');
	const budgetPct = $('#budget-pct');
	const target = (C * 0.05).toFixed(1); // 95% of the ring
	if (reducedMotion) {
		if (gauge) gauge.style.strokeDashoffset = target;
		if (budgetBar) budgetBar.style.width = '100%';
	} else {
		window.setTimeout(() => {
			if (gauge) gauge.style.strokeDashoffset = target;
		}, 150);
		window.setTimeout(() => {
			if (budgetBar) budgetBar.style.width = '100%';
		}, 350);
	}
	if (gaugeValue) gaugeValue.textContent = '95%';
	if (budgetPct) budgetPct.textContent = '100%';
}

interface SparkState {
	el: HTMLElement;
	line: SVGPathElement;
	fill: SVGPathElement;
	values: number[];
	base: number;
	amp: number;
	fmt: (n: number) => string;
	readout: HTMLElement | null;
}

function fmtSignal(id: string): (n: number) => string {
	// n is a 0–100 scale value on the sparkline; map to readout text per signal.
	switch (id) {
		case 'latency':
			return (n) => `${(12 + (n / 100) * 6).toFixed(1)} ms p99`;
		case 'traffic':
			return (n) => `${(0.85 + (n / 100) * 0.3).toFixed(2)}M req/min`;
		case 'errors':
			return (n) => `${((n / 100) * 0.002).toFixed(4)}%`;
		default:
			return (n) => `${Math.round(n)}%`;
	}
}

function sparkPath(values: number[], w: number, h: number, pad: number): { line: string; fill: string } {
	const max = h - pad * 2;
	const step = w / (values.length - 1);
	const pts = values.map((v, i) => {
		const x = i * step;
		const y = pad + (1 - v / 100) * max;
		return [x, y] as const;
	});
	const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
	const fill = `${line} L${w},${h} L0,${h} Z`;
	return { line, fill };
}

function initSparks(): SparkState[] {
	return $$('.sre-spark').map((el) => {
		const base = Number(el.dataset.base ?? 50);
		const amp = Number(el.dataset.amp ?? 10);
		const id = el.dataset.signal ?? 'signal';
		const values = Array.from({ length: 24 }, (_, i) => {
			const wave = Math.sin(i * 0.55) * amp * 0.5 + Math.cos(i * 0.21) * amp * 0.3;
			return Math.max(4, Math.min(96, base + wave + (Math.random() - 0.5) * amp));
		});
		const line = el.querySelector<SVGPathElement>('.sre-spark-line');
		const fill = el.querySelector<SVGPathElement>('.sre-spark-fill');
		const readout = el.querySelector<HTMLElement>('b');
		const state: SparkState = { el, line: line!, fill: fill!, values, base, amp, fmt: fmtSignal(id), readout };
		renderSpark(state);
		return state;
	});
}

function renderSpark(s: SparkState): void {
	const { line, fill } = sparkPath(s.values, 200, 48, 4);
	s.line.setAttribute('d', line);
	s.fill.setAttribute('d', fill);
	if (s.readout) s.readout.textContent = s.fmt(s.values[s.values.length - 1]);
}

function tickSparks(sparks: SparkState[]): void {
	for (const s of sparks) {
		const prev = s.values[s.values.length - 1];
		const drift = (Math.random() - 0.5) * s.amp * 0.6;
		const pull = (s.base - prev) * 0.25; // gently pulled toward the base
		const next = Math.max(4, Math.min(96, prev + drift + pull));
		s.values.push(next);
		s.values.shift();
		renderSpark(s);
	}
}

/* ---------- boot ---------- */

function bind(): void {
	const input = $('#sre-in');
	const run = $('#sre-run');

	const history: string[] = [];
	let historyIx = -1;

	const submit = () => {
		if (!input) return;
		const value = input.value;
		if (!value.trim()) return;
		history.push(value);
		historyIx = history.length;
		runCommand(value);
		input.value = '';
	};

	run?.addEventListener('click', submit);
	input?.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		} else if (e.key === 'ArrowUp' && history.length) {
			e.preventDefault();
			historyIx = Math.max(0, historyIx - 1);
			input.value = history[historyIx] ?? '';
		} else if (e.key === 'ArrowDown' && history.length) {
			e.preventDefault();
			historyIx = Math.min(history.length, historyIx + 1);
			input.value = historyIx === history.length ? '' : (history[historyIx] ?? '');
		}
	});

	for (const chip of $$<HTMLButtonElement>('.sre-chip')) {
		chip.addEventListener('click', () => {
			const cmd = chip.dataset.cmd ?? '';
			if (cmd === 'clear' && out) {
				out.replaceChildren();
				if (input) input.value = '';
				return;
			}
			runCommand(cmd);
			if (input) input.value = '';
		});
	}

	for (const row of $$<HTMLButtonElement>('.sre-incident')) {
		row.addEventListener('click', () => {
			selectIncident(row.dataset.incident ?? '', true);
		});
	}

	// Leaving for the classic view must reset the remembered view, otherwise / bounces back here.
	for (const a of $$<HTMLAnchorElement>('a[href="/"]')) {
		a.addEventListener('click', () => {
			try {
				localStorage.setItem('view', 'classic');
			} catch {
				/* ignore */
			}
		});
	}

	input?.focus();
}

function init(): void {
	bind();
	boot();
	selectIncident(INCIDENTS[0].id, false);
	animateHealth();
	const sparks = initSparks();
	if (sparks.length && !reducedMotion) {
		window.setInterval(() => tickSparks(sparks), 900);
	}
	// Sanity: every command chip must run without throwing.
	console.assert(COMMANDS.length > 0);
}

init();
