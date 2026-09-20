/**
 * Client controller for /db. Vanilla TypeScript, no framework.
 * Reads state from lib/db/*, renders into the panel shells in pages/db.astro.
 */
import { CAREER_START, table } from '../lib/db/schema';
import { effectiveAccess, queryById, selectAllQuery, type Access, type PlanNode, type SavedQuery } from '../lib/db/queries';
import { LABELS, formatWalPosition, renderCreateTable, resultFooter, type Engine } from '../lib/db/dialect';
import { renderBTree, type BTreeRender } from '../lib/db/btree';
import {
	BufferPool,
	Metrics,
	POOL_CAPACITY,
	Replication,
	Slo,
	buildVersionChain,
	engineIsolationNote,
	formatUptime,
	visibleVersion,
	type Incident,
	type Series,
} from '../lib/db/simulation';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

type Isolation = 'RR' | 'RC';

interface DigestEntry {
	query: SavedQuery;
	calls: number;
	totalMs: number;
	rowsExamined: number;
	rowsSent: number;
	access: Access;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAGGER = reducedMotion ? 0 : 1;

let engine: Engine = document.documentElement.dataset.engine === 'postgres' ? 'postgres' : 'mysql';
let current: SavedQuery | null = null;
let currentTree: BTreeRender | null = null;
let isolation: Isolation = LABELS[engine].mvcc.defaultIsolation === 'REPEATABLE READ' ? 'RR' : 'RC';
let snapshotPct = 100;
let running = false;

const pool = new BufferPool(POOL_CAPACITY);
const replication = new Replication();
const metrics = new Metrics();
const slo = new Slo();
const digest = new Map<string, DigestEntry>();
const versions = buildVersionChain();
const timers: number[] = [];

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

function $(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing #${id}`);
	return el;
}
function $$<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] {
	return Array.from(root.querySelectorAll<T>(sel));
}
function esc(s: unknown): string {
	return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function later(fn: () => void, ms: number): void {
	timers.push(window.setTimeout(fn, ms * STAGGER));
}
function clearTimers(): void {
	while (timers.length) window.clearTimeout(timers.pop());
}
function fmt(n: number, digits = 0): string {
	return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/* ------------------------------------------------------------------ */
/* SQL highlighting                                                    */
/* ------------------------------------------------------------------ */

const KEYWORDS =
	'SELECT|FROM|WHERE|AND|OR|NOT|NULL|IS|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|OVER|PARTITION|DESC|ASC|CREATE|TABLE|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|UNIQUE|USING|BTREE|ENGINE|DEFAULT|CHARSET|COLLATE|COMMENT|COLUMN|CASCADE|DELETE|GENERATED|ALWAYS|IDENTITY|INT|INTEGER|UNSIGNED|AUTO_INCREMENT|VARCHAR|TEXT|DATE|YEAR|JSON|JSONB|SMALLINT|MONTH|LIKE|IN|BETWEEN|CASE|WHEN|THEN|ELSE|END|DISTINCT|UNION|ALL|EXPLAIN|ANALYZE|FORMAT|TREE|BUFFERS|SEPARATOR|WITH';

function highlightSql(sql: string): string {
	const src = esc(sql);
	const re = new RegExp(
		`('(?:[^'\\\\]|\\\\.)*')|(--[^\\n]*)|(\\b[A-Za-z_][A-Za-z0-9_]*(?=\\())|(\\b(?:${KEYWORDS})\\b)|(\\b\\d+(?:\\.\\d+)?\\b)`,
		'g',
	);
	return src.replace(re, (m, str, cm, fn, kw, num) => {
		if (str) return `<span class="sql-str">${m}</span>`;
		if (cm) return `<span class="sql-cm">${m}</span>`;
		if (fn) return `<span class="sql-fn">${m}</span>`;
		if (kw) return `<span class="sql-kw">${m}</span>`;
		if (num) return `<span class="sql-num">${m}</span>`;
		return m;
	});
}

/* ------------------------------------------------------------------ */
/* Engine switch                                                       */
/* ------------------------------------------------------------------ */

function setEngine(next: Engine, persist = true): void {
	engine = next;
	document.documentElement.dataset.engine = next;
	if (persist) {
		try {
			localStorage.setItem('db-engine', next);
		} catch {
			/* private mode */
		}
	}
	const L = LABELS[next];
	for (const b of $$<HTMLButtonElement>('[data-engine-pick]')) {
		b.setAttribute('aria-pressed', String(b.dataset.enginePick === next));
	}
	$('hdr-engine').textContent = `${L.name} ${L.version}`;
	$('explain-cmd').textContent = L.explainCmd;
	$('bp-title').textContent = L.bufferPool;
	$('bp-pagesize').textContent = `${L.pageSizeKb} KB`;
	$('bp-policy').textContent = L.evictionPolicy;
	$('repl-cmd').textContent = L.replicaStatusCmd;
	$('repl-pos-label').textContent = L.walPositionLabel;
	$('slow-source').textContent = L.slowLogSource.replace('performance_schema.events_statements_summary_by_digest', 'performance_schema…by_digest');
	$('rds-engine').textContent = L.rdsEngine;
	$('rds-pg').textContent = L.rdsParameterGroup;
	for (const p of $$('[data-prompt]')) p.textContent = L.prompt;

	isolation = L.mvcc.defaultIsolation === 'REPEATABLE READ' ? 'RR' : 'RC';
	for (const b of $$<HTMLButtonElement>('[data-iso]')) b.setAttribute('aria-pressed', String(b.dataset.iso === isolation));

	if (current) {
		renderSql(current);
		renderDdl(current.walk.table);
		renderPlan(current);
		renderTree(current, false);
	}
	renderPool(null);
	renderReplication();
	renderMvcc();
	renderDigest();
}

/* ------------------------------------------------------------------ */
/* Query panel                                                         */
/* ------------------------------------------------------------------ */

function renderSql(q: SavedQuery): void {
	const L = LABELS[engine];
	const lines = q.sql[engine].split('\n');
	const cont = engine === 'mysql' ? '    ->' : L.prompt.replace(/=#$/, '-#');
	const body = lines
		.map((line, i) => `<span class="db-prompt">${esc(i === 0 ? L.prompt : cont)}</span> ${highlightSql(line)}`)
		.join('\n');
	$('q-sql').innerHTML = `<code>${body}</code>`;
}

function renderDdl(tableName: string): void {
	const L = LABELS[engine];
	$('q-ddl-cmd').textContent = L.describeCmd(tableName);
	$('q-ddl').innerHTML = `<code>${highlightSql(renderCreateTable(table(tableName), engine))}</code>`;
}

function renderResults(q: SavedQuery, ms: number): void {
	const rs = q.run();
	const isNum = (v: unknown) => typeof v === 'number';
	const head = rs.columns.map((c) => `<th>${esc(c)}</th>`).join('');
	const body = rs.rows
		.map(
			(r, i) =>
				`<tr style="animation-delay:${Math.min(i * 30, 400)}ms">${r
					.map((v, ci) => {
						if (v === null) return '<td class="is-null">NULL</td>';
						const col = rs.columns[ci];
						const wrap = col === 'body' || col === 'hook' || col === 'skills' || col === 'note' || col === 'availability';
						if (typeof v === 'string' && /^https?:\/\//.test(v)) {
							return `<td><a class="text-accent hover:underline" href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v.replace(/^https?:\/\/(www\.)?/, ''))}</a></td>`;
						}
						return `<td class="${isNum(v) ? 'is-num' : ''}${wrap ? ' is-wrap' : ''}" title="${esc(v)}">${esc(v)}</td>`;
					})
					.join('')}</tr>`,
		)
		.join('');
	$('q-results').innerHTML = `<table class="db-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
	$('q-footer').textContent = resultFooter(rs.rows.length, ms, engine);
}

/* ------------------------------------------------------------------ */
/* EXPLAIN                                                             */
/* ------------------------------------------------------------------ */

/** Nodes with an empty label for the current engine are transparent: their children are promoted. */
function visibleNodes(nodes: PlanNode[]): PlanNode[] {
	return nodes.flatMap((n) => (n[engine === 'mysql' ? 'mysql' : 'pg'] ? [n] : visibleNodes(n.children ?? [])));
}

function planLabel(n: PlanNode): string {
	return engine === 'mysql' ? n.mysql : n.pg;
}

function renderPlanNodes(nodes: PlanNode[]): string {
	return `<ul>${visibleNodes(nodes)
		.map((n) => {
			const detail = engine === 'postgres' && n.pgDetail ? `<span class="db-plan-detail">${n.pgDetail.map(esc).join('<br>')}</span>` : '';
			const tag = n.access === 'op' ? '' : `<small>${accessName(n.access)}</small>`;
			return `<li><div class="db-plan-node" data-access="${n.access}"><i class="db-access-dot" data-access="${n.access}"></i><span>${esc(planLabel(n))}</span>${tag}<small>cost=${n.cost.toFixed(2)} rows=${n.rows}</small>${detail}</div>${
				n.children?.length ? renderPlanNodes(n.children) : ''
			}</li>`;
		})
		.join('')}</ul>`;
}

function accessName(a: Access): string {
	if (engine === 'mysql') return { const: 'const', ref: 'ref', range: 'range', index: 'index', all: 'ALL', op: '' }[a];
	return { const: 'pkey', ref: 'index cond', range: 'range', index: 'index scan', all: 'seq scan', op: '' }[a];
}

function rawPlan(nodes: PlanNode[], depth: number, ms: number): string {
	const out: string[] = [];
	for (const n of visibleNodes(nodes)) {
		const pad = '    '.repeat(depth);
		if (engine === 'mysql') {
			out.push(`${pad}-> ${n.mysql}  (cost=${n.cost.toFixed(2)} rows=${n.rows})`);
		} else {
			const arrow = depth === 0 ? '' : `${'  '.repeat(depth)}->  `;
			const t = (ms / Math.max(1, depth + 1)).toFixed(3);
			out.push(`${arrow}${n.pg}  (cost=0.00..${n.cost.toFixed(2)} rows=${n.rows} width=${64 + n.rows * 4}) (actual time=${(Number(t) * 0.6).toFixed(3)}..${t} rows=${n.rows} loops=1)`);
			for (const d of n.pgDetail ?? []) out.push(`${'  '.repeat(depth + 1)}  ${d}`);
		}
		if (n.children?.length) out.push(rawPlan(n.children, depth + 1, ms));
	}
	return out.join('\n');
}

function renderPlan(q: SavedQuery, ms = 0.05): void {
	$('explain-tree').innerHTML = renderPlanNodes([q.plan]);
	let raw = rawPlan([q.plan], 0, ms);
	if (engine === 'postgres') {
		raw += `\nPlanning Time: ${(0.04 + Math.random() * 0.05).toFixed(3)} ms\nExecution Time: ${ms.toFixed(3)} ms`;
	}
	$('explain-raw').innerHTML = `<code>${esc(raw)}</code>`;
}

/* ------------------------------------------------------------------ */
/* B+Tree                                                              */
/* ------------------------------------------------------------------ */

function renderTree(q: SavedQuery, animate: boolean): void {
	currentTree = renderBTree(q.walk, engine);
	$('btree-svg').innerHTML = currentTree.svg;
	$('btree-title').textContent = `${q.walk.table}.${q.walk.index}`;
	const depth = currentTree.path.length;
	let note = '';
	switch (q.walk.scan) {
		case 'lookup':
			note = `Descended ${depth} level${depth === 1 ? '' : 's'} to the leaf holding “${q.walk.target}”. ${
				q.walk.fetchesRow
					? engine === 'mysql'
						? 'InnoDB secondary index leaves store the primary key, so one more descent through the clustered index fetches the row.'
						: 'PostgreSQL index leaves store a tuple id (page, offset), so a heap fetch completes the read.'
					: engine === 'mysql'
						? 'This is the clustered index: the row itself lives in the leaf.'
						: 'Primary key index; the tuple id points straight at the heap page.'
			} Tree height stays 3-4 at billions of keys, which is why lookups cost O(log n) page reads.`;
			break;
		case 'covering':
			note = `Every column the query needs is inside ${q.walk.index}, so the engine reads the leaf chain left to right and never visits the table (${
				engine === 'mysql' ? '“Using index”' : 'Index Only Scan, Heap Fetches: 0'
			}).`;
			break;
		default:
			note =
				q.walk.index === 'PRIMARY'
					? `Full scan: ${engine === 'mysql' ? 'the clustered index' : 'the heap'} is read page by page. Fine for ${table(q.walk.table).rows.length} rows; a disaster at 10⁹. The optimiser chose it because no index matches the predicate.`
					: `Index scan on ${q.walk.index}: the whole leaf level is walked via sibling pointers, which also yields the rows in ORDER BY order for free.`;
	}
	$('btree-note').textContent = note;
	if (animate) animateTree(q);
	else if (q.walk.scan === 'lookup') {
		for (const id of currentTree.path) markNode(id, 'is-visited');
	}
}

function markNode(id: string, cls: string): void {
	const el = document.querySelector(`#btree-svg [data-node="${id}"]`);
	el?.classList.add(cls);
}
function markEdge(id: string): void {
	document.querySelector(`#btree-svg [data-edge="${id}"]`)?.classList.add('is-active');
}

function animateTree(q: SavedQuery): number {
	if (!currentTree) return 0;
	const t = currentTree;
	const step = 260;
	if (q.walk.scan === 'lookup') {
		t.path.forEach((id, i) => {
			later(() => {
				if (i > 0) {
					markNode(t.path[i - 1], 'is-visited');
					document.querySelector(`#btree-svg [data-node="${t.path[i - 1]}"]`)?.classList.remove('is-active');
				}
				markNode(id, 'is-active');
				if (i > 0) markEdge(t.edgesOnPath[i - 1]);
			}, i * step);
		});
		let total = t.path.length * step;
		if (t.fetchId) {
			later(() => {
				markEdge(t.edgesOnPath[t.edgesOnPath.length - 1]);
				markNode('fetch', 'is-active');
			}, total);
			total += step;
		}
		return total;
	}
	// scan: root, then leaves left to right
	later(() => markNode(t.path[0], 'is-active'), 0);
	const leafStep = Math.max(90, Math.min(step, 1400 / Math.max(1, t.leaves.length)));
	t.leaves.forEach((id, i) => {
		later(() => {
			if (i > 0) {
				markNode(t.leaves[i - 1], 'is-visited');
				document.querySelector(`#btree-svg [data-node="${t.leaves[i - 1]}"]`)?.classList.remove('is-active');
				document.querySelector(`#btree-svg [data-sibling="${t.leaves[i - 1]}"]`)?.classList.add('is-active');
			}
			markNode(id, 'is-active');
		}, step + i * leafStep);
	});
	return step + t.leaves.length * leafStep;
}

/* ------------------------------------------------------------------ */
/* Buffer pool                                                         */
/* ------------------------------------------------------------------ */

function shortPage(page: string): { table: string; kind: 'table' | 'index'; label: string } {
	const [left, no] = page.split('#');
	const [tbl, idx] = left.split('.');
	const abbrev = tbl.slice(0, 4);
	return idx
		? { table: tbl, kind: 'index', label: `${abbrev}.${idx.replace(/^(idx_|fk_)/, '').slice(0, 5)}` }
		: { table: tbl, kind: 'table', label: `${abbrev} p${no}` };
}

function renderPool(flash: { hits: string[]; misses: string[]; evicted: string[] } | null): void {
	const grid = $('bp-grid');
	const youngCutoff = Math.floor(pool.capacity * (5 / 8));
	grid.innerHTML = pool.frames
		.map((f, i) => {
			if (!f.page) return `<div class="db-bp-frame" data-frame="${i}"><span>free</span></div>`;
			const s = shortPage(f.page);
			const old = engine === 'mysql' && pool.lruRank(f) >= youngCutoff;
			const usage = engine === 'postgres' ? `<span class="bp-usage">${f.usage}</span>` : '';
			let cls = '';
			if (flash?.hits.includes(f.page)) cls = 'is-hit';
			else if (flash?.misses.includes(f.page)) cls = 'is-miss';
			return `<div class="db-bp-frame ${cls}${old ? ' is-old' : ''}" data-frame="${i}" data-table="${s.table}" data-kind="${s.kind}" title="${esc(f.page)}">${usage}<span>${esc(s.label)}</span></div>`;
		})
		.join('');
	$('bp-hit').textContent = `${(pool.hitRatio * 100).toFixed(1)}%`;
	$('bp-resident').textContent = `${pool.residentCount} / ${pool.capacity}`;
}

function touchPages(pages: string[], done: (hits: number, misses: number) => void): number {
	const perPage = 110;
	let hits = 0;
	let misses = 0;
	const evictedAll: string[] = [];
	pages.forEach((page, i) => {
		later(() => {
			const r = pool.touch([page]);
			hits += r.hits.length;
			misses += r.misses.length;
			evictedAll.push(...r.evicted);
			renderPool(r);
			const L = LABELS[engine];
			$('bp-log').textContent = `${hits} hit${hits === 1 ? '' : 's'}, ${misses} miss${misses === 1 ? '' : 'es'} (${misses} × ${L.pageSizeKb} KB from gp3)${
				evictedAll.length ? ` · evicted ${evictedAll.map((p) => shortPage(p).label).join(', ')}` : ''
			}`;
		}, i * perPage);
	});
	later(() => done(hits, misses), pages.length * perPage);
	return pages.length * perPage;
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

function selectQuery(q: SavedQuery, run = true): void {
	clearTimers();
	current = q;
	for (const b of $$<HTMLButtonElement>('[data-query-pick]')) b.setAttribute('aria-pressed', String(b.dataset.queryPick === q.id));
	$('q-title').textContent = q.title;
	$('q-lesson').textContent = q.lesson;
	renderSql(q);
	renderDdl(q.walk.table);
	renderPlan(q);
	renderTree(q, false);
	($('q-run') as HTMLButtonElement).disabled = false;
	if (run) runCurrent();
}

function runCurrent(): void {
	if (!current || running) return;
	const q = current;
	running = true;
	const runBtn = $('q-run') as HTMLButtonElement;
	runBtn.disabled = true;
	const results = $('q-results');
	results.setAttribute('aria-busy', 'true');
	$('q-footer').textContent = '';

	const replica = replication.routeRead();
	const route = $('q-route');
	route.dataset.state = replica.role === 'primary' ? 'warn' : 'ok';
	route.innerHTML = `<span class="db-pill-dot"></span> read → ${esc(replica.id)}${replica.role === 'replica' ? ` (${replica.lagMs} ms behind)` : ' (primary; no healthy replica)'}`;
	renderReplication();

	renderTree(q, false);
	const treeMs = animateTree(q);
	const poolMs = touchPages(q.pages, (hits, misses) => {
		const latency = 0.04 + q.rowsExamined * 0.012 + hits * 0.02 + misses * 0.42 + Math.random() * 0.03;
		const ms = Math.round(latency * 1000) / 1000;
		later(
			() => {
				renderResults(q, ms);
				renderPlan(q, ms);
				results.setAttribute('aria-busy', 'false');
				metrics.onQuery(q.rowsExamined, misses);
				recordDigest(q, ms);
				running = false;
				runBtn.disabled = false;
			},
			Math.max(0, treeMs - poolMs),
		);
	});
}

/* ------------------------------------------------------------------ */
/* Digest / slow log                                                   */
/* ------------------------------------------------------------------ */

function recordDigest(q: SavedQuery, ms: number): void {
	const e = digest.get(q.id) ?? {
		query: q,
		calls: 0,
		totalMs: 0,
		rowsExamined: 0,
		rowsSent: 0,
		access: effectiveAccess(q.plan),
	};
	e.calls++;
	e.totalMs += ms;
	e.rowsExamined += q.rowsExamined;
	e.rowsSent += q.run().rows.length;
	digest.set(q.id, e);
	renderDigest();
}

function normalise(sql: string): string {
	return sql
		.replace(/\s+/g, ' ')
		.replace(/'(?:[^'\\]|\\.)*'/g, '?')
		.replace(/\b\d+\b/g, '?')
		.trim();
}

function renderDigest(): void {
	const rows = [...digest.values()].sort((a, b) => b.totalMs - a.totalMs);
	$('slow-empty').style.display = rows.length ? 'none' : '';
	$('slow-table').innerHTML = rows
		.map((e) => {
			const flagged = e.access === 'all';
			const label = flagged ? 'FULL SCAN' : accessName(e.access) || 'index';
			const sql = normalise(e.query.sql[engine]);
			return `<tr class="${flagged ? 'is-flagged' : ''}"><td style="max-width:11rem" title="${esc(sql)}">${esc(sql.length > 38 ? `${sql.slice(0, 37)}…` : sql)}</td><td class="is-num">${e.calls}</td><td class="is-num">${(e.totalMs / e.calls).toFixed(3)}</td><td class="is-num">${e.rowsExamined}</td><td class="is-num">${e.rowsSent}</td><td>${label}</td></tr>`;
		})
		.join('');
}

/* ------------------------------------------------------------------ */
/* Replication + failover                                              */
/* ------------------------------------------------------------------ */

function renderReplication(): void {
	const L = LABELS[engine];
	const order = [...replication.nodes].sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : a.role === 'failed' ? -1 : 0));
	$('repl-nodes').innerHTML = order
		.map((n) => {
			const pct = Math.min(100, (n.lagMs / 400) * 100);
			const lagCls = n.lagMs > 250 ? 'is-crit' : n.lagMs > 120 ? 'is-warn' : '';
			const roleLabel = n.role === 'primary' ? (engine === 'mysql' ? 'source · writer' : 'primary · writer') : n.role === 'failed' ? 'unreachable' : engine === 'mysql' ? 'replica · reader' : 'standby · reader';
			const reading = replication.lastReadRoute === n.id ? ' is-reading' : '';
			const lag = n.role === 'primary' ? `${L.walPositionLabel.includes('lsn') ? 'flush' : 'write'} ${formatWalPosition(n.appliedBytes, engine)}` : n.role === 'failed' ? 'no heartbeat' : `${L.lagMetric}: ${engine === 'mysql' ? (n.lagMs / 1000).toFixed(3) + ' s' : n.lagMs + ' ms'}`;
			return `<div class="db-repl-node${reading}" data-role="${n.role}"><div class="flex items-baseline justify-between gap-2"><b class="text-text">${esc(n.id)}</b><span class="repl-role">${roleLabel}</span></div><div class="mt-0.5 text-muted">${esc(n.city)} · ${esc(n.region)}</div><div class="mt-0.5 text-muted">${lag}</div>${
				n.role === 'replica' ? `<div class="repl-lag"><i class="${lagCls}" style="width:${pct}%"></i></div>` : ''
			}</div>`;
		})
		.join('');
	$('repl-pos').textContent = formatWalPosition(replication.writePos, engine);
	$('hdr-primary').textContent = replication.primary.id;
}

function replLog(msg: string): void {
	const li = document.createElement('li');
	const t = new Date();
	li.textContent = `[${t.toTimeString().slice(0, 8)}] ${msg}`;
	const log = $('repl-log');
	log.prepend(li);
	while (log.children.length > 5) log.lastElementChild?.remove();
}

let failing = false;

function simulateFailover(): void {
	if (failing) return;
	failing = true;
	const btn = $('repl-failover') as HTMLButtonElement;
	btn.disabled = true;
	const L = LABELS[engine];
	const old = replication.primary;
	const started = performance.now();
	const incident: Incident = { at: new Date(), title: `${old.id} unreachable (AZ network partition)`, severity: 'SEV1', durationMs: 0, resolved: false };
	slo.incidents.unshift(incident);

	old.role = 'failed';
	replication.failingOver = true;
	setStatus('crit', 'failing over');
	$('rds-status').textContent = 'failing-over';
	$('rds-status').className = 'text-warn';
	replLog(`${old.id}: 3 heartbeats missed, writer unreachable. SEV1 declared, on-call paged.`);
	renderReplication();
	renderSre();

	const candidate = replication.nodes.filter((n) => n.role === 'replica').reduce((a, b) => (a.lagMs <= b.lagMs ? a : b));
	later(() => {
		replLog(
			engine === 'mysql'
				? `Promoting ${candidate.id} (most caught-up, ${L.lagMetric}=${(candidate.lagMs / 1000).toFixed(3)}): STOP REPLICA; SET GLOBAL read_only=OFF;`
				: `Promoting ${candidate.id} (smallest ${L.lagMetric}, ${candidate.lagMs} ms): pg_ctl promote`,
		);
	}, 1400);
	later(() => {
		candidate.role = 'primary';
		candidate.lagMs = 0;
		replication.failingOver = false;
		replLog(`RDS writer endpoint now resolves to ${candidate.id} (DNS TTL 5 s). Writes accepted.`);
		renderReplication();
	}, 2800);
	later(() => {
		old.role = 'replica';
		old.lagMs = 900;
		old.appliedBytes = replication.writePos - 900 * 40;
		replLog(`${old.id} reachable again; rejoined as replica, catching up from ${L.wal}.`);
		const duration = performance.now() - started;
		incident.durationMs = duration;
		incident.resolved = true;
		slo.burn(duration * 20); // 1 simulated second = 20 s of downtime: one failover eats ~1/3 of a 99.99% monthly budget
		setStatus('ok', 'available');
		$('rds-status').textContent = 'available';
		$('rds-status').className = 'text-ok';
		$('sre-mttr').textContent = `${(duration / 1000).toFixed(1)} s (sim)`;
		renderReplication();
		renderSre();
		failing = false;
		btn.disabled = false;
	}, 4400);
}

function setStatus(state: 'ok' | 'warn' | 'crit', text: string): void {
	const pill = $('db-status-pill');
	pill.dataset.state = state;
	pill.innerHTML = `<span class="db-pill-dot"></span> ${esc(text)}`;
}

/* ------------------------------------------------------------------ */
/* SRE                                                                 */
/* ------------------------------------------------------------------ */

function renderSre(): void {
	$('sre-uptime').textContent = formatUptime(new Date());
	const achieved = slo.achieved;
	const a = $('sre-achieved');
	a.textContent = `${achieved.toFixed(4)}%`;
	a.className = achieved >= slo.target ? 'text-ok' : 'text-crit';
	const pct = slo.remainingPct;
	$('sre-budget-pct').textContent = `${pct.toFixed(1)}%`;
	const bar = $('sre-budget-bar');
	bar.style.width = `${pct}%`;
	bar.className = `db-budget-fill${pct < 20 ? ' is-crit' : pct < 50 ? ' is-warn' : ''}`;
	const list = $('sre-incidents');
	if (slo.incidents.length) {
		list.innerHTML = slo.incidents
			.slice(0, 4)
			.map(
				(i) =>
					`<li class="flex items-baseline gap-2"><span class="${i.resolved ? 'text-muted' : 'text-crit'}">${i.severity}</span><span class="text-text">${esc(i.title)}</span><span class="ml-auto shrink-0 text-muted">${
						i.resolved ? `resolved in ${(i.durationMs / 1000).toFixed(1)}s` : 'open'
					}</span></li>`,
			)
			.join('');
	}
}

/* ------------------------------------------------------------------ */
/* Metrics / sparklines                                                */
/* ------------------------------------------------------------------ */

function sparkPath(values: number[], w = 200, h = 48): { line: string; fill: string } {
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const pts = values.map((v, i) => {
		const x = (i / (values.length - 1)) * w;
		const y = h - 3 - ((v - min) / span) * (h - 8);
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	});
	const line = `M${pts.join(' L')}`;
	return { line, fill: `${line} L${w},${h} L0,${h} Z` };
}

function renderSpark(key: string, s: Series, hot: boolean, format: (v: number) => string): void {
	const svg = document.querySelector<SVGSVGElement>(`[data-spark="${key}"]`);
	if (!svg) return;
	const { line, fill } = sparkPath(s.values);
	svg.querySelector('.db-spark-line')?.setAttribute('d', line);
	svg.querySelector('.db-spark-fill')?.setAttribute('d', fill);
	svg.parentElement?.classList.toggle('is-hot', hot);
	const v = document.querySelector(`[data-spark-value="${key}"]`);
	if (v) v.textContent = format(s.last);
}

function tick(): void {
	metrics.step(failing);
	replication.step();
	renderSpark('cpu', metrics.cpu, metrics.cpu.last > 45, (v) => `${v.toFixed(1)}%`);
	renderSpark('connections', metrics.connections, false, (v) => fmt(v));
	renderSpark('readIops', metrics.readIops, metrics.readIops.last > 5000, (v) => `${fmt(v)}/s`);
	renderSpark('freeMem', metrics.freeMem, false, (v) => `${v.toFixed(1)} GB`);
	if (!failing) renderReplication();
	renderSre();
}

/* ------------------------------------------------------------------ */
/* MVCC                                                                */
/* ------------------------------------------------------------------ */

const START = new Date(CAREER_START).getTime();
const NOW = Date.now();

function snapshotDate(): string {
	const t = START + ((NOW - START) * snapshotPct) / 100;
	return new Date(t).toISOString().slice(0, 10);
}

function renderMvcc(): void {
	const L = LABELS[engine];
	const asOf = snapshotDate();
	$('mvcc-asof').textContent = snapshotPct >= 100 ? 'today' : asOf.slice(0, 7);
	const vis = visibleVersion(versions, asOf);
	const newestFirst = [...versions].reverse();
	$('mvcc-chain').innerHTML = newestFirst
		.map((v) => {
			const state = v === vis ? 'visible' : v.committedAt > asOf ? 'future' : 'dead';
			const tag = state === 'visible' ? 'visible' : state === 'future' ? 'not yet committed' : engine === 'mysql' ? 'in undo log' : 'dead tuple';
			const meta =
				engine === 'mysql'
					? `<span>${L.mvcc.txId}</span><b>${v.trx}</b><span>${L.mvcc.rollback}</span><b>${v.rollPtr ?? 'NULL'}</b>`
					: `<span>${L.mvcc.txId}</span><b>${v.trx}</b><span>${L.mvcc.rollback}</span><b>${v.supersededBy ?? '0'}</b>`;
			return `<article class="db-ver" data-vis="${state}"><span class="ver-tag">${tag}</span><div class="ver-meta">${meta}<span>committed</span><b>${v.committedAt.slice(0, 7)}</b></div><div class="ver-role">${esc(v.role)}</div><div class="text-muted">${esc(v.company)} · ${esc(v.location)}</div></article>`;
		})
		.join('');
	const dead = versions.filter((v) => v !== vis && v.committedAt <= asOf).length;
	const future = versions.filter((v) => v.committedAt > asOf).length;
	$('mvcc-note').textContent = `${engineIsolationNote(engine, isolation)} At this ${L.mvcc.snapshot}, ${vis ? `the row reads “${vis.role} @ ${vis.company}”` : 'the row does not exist yet'}; ${dead} older version${dead === 1 ? '' : 's'} wait${dead === 1 ? 's' : ''} in the ${L.mvcc.versionStore} for the ${L.mvcc.cleanup}, and ${future} later commit${future === 1 ? ' is' : 's are'} invisible.`;
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function bind(): void {
	for (const b of $$<HTMLButtonElement>('[data-engine-pick]')) {
		b.addEventListener('click', () => setEngine(b.dataset.enginePick as Engine));
	}
	for (const b of $$<HTMLButtonElement>('[data-query-pick]')) {
		b.addEventListener('click', () => {
			selectQuery(queryById(b.dataset.queryPick as string));
			scrollToQuery();
		});
	}
	for (const b of $$<HTMLButtonElement>('[data-table-pick]')) {
		b.addEventListener('click', () => {
			selectQuery(selectAllQuery(b.dataset.tablePick as string));
			scrollToQuery();
		});
	}
	for (const b of $$<HTMLButtonElement>('[data-table-ddl]')) {
		b.addEventListener('click', () => {
			selectQuery(selectAllQuery(b.dataset.tableDdl as string), false);
			($('q-ddl-wrap') as HTMLDetailsElement).open = true;
			scrollToQuery();
		});
	}
	$('q-run').addEventListener('click', () => {
		clearTimers();
		running = false;
		runCurrent();
	});
	$('repl-failover').addEventListener('click', simulateFailover);
	const slider = $('mvcc-slider') as HTMLInputElement;
	slider.addEventListener('input', () => {
		snapshotPct = Number(slider.value);
		renderMvcc();
	});
	for (const b of $$<HTMLButtonElement>('[data-iso]')) {
		b.addEventListener('click', () => {
			isolation = b.dataset.iso as Isolation;
			for (const x of $$<HTMLButtonElement>('[data-iso]')) x.setAttribute('aria-pressed', String(x === b));
			renderMvcc();
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
}

function scrollToQuery(): void {
	if (window.matchMedia('(max-width: 1023px)').matches) {
		$('panel-query').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
	}
}

function init(): void {
	bind();
	setEngine(engine, false);
	renderPool(null);
	renderReplication();
	renderSre();
	renderMvcc();
	tick();
	window.setInterval(tick, 1000);
	// Cold cache on purpose: the first query shows what a miss costs.
	selectQuery(queryById('who'));
}

init();
