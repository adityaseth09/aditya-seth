/**
 * Small, deterministic-enough simulations of database internals. Nothing here
 * touches the DOM; the console script renders whatever state these expose.
 */
import { ALL_PAGES, table, CAREER_START, type Row } from './schema';
import type { Engine } from './dialect';

/* ------------------------------------------------------------------ */
/* Buffer pool                                                         */
/* ------------------------------------------------------------------ */

export interface PoolFrame {
	page: string | null;
	/** PostgreSQL clock-sweep usage counter (0-5). Cosmetic for MySQL. */
	usage: number;
	lastTouched: number;
}

export interface PoolTouchResult {
	hits: string[];
	misses: string[];
	evicted: string[];
}

export class BufferPool {
	readonly frames: PoolFrame[];
	reads = 0;
	hits = 0;
	private tick = 0;

	constructor(public readonly capacity: number) {
		this.frames = Array.from({ length: capacity }, () => ({ page: null, usage: 0, lastTouched: 0 }));
	}

	get hitRatio(): number {
		return this.reads === 0 ? 1 : this.hits / this.reads;
	}

	touch(pages: string[]): PoolTouchResult {
		const result: PoolTouchResult = { hits: [], misses: [], evicted: [] };
		for (const page of pages) {
			this.reads++;
			this.tick++;
			const frame = this.frames.find((f) => f.page === page);
			if (frame) {
				this.hits++;
				frame.usage = Math.min(5, frame.usage + 1);
				frame.lastTouched = this.tick;
				result.hits.push(page);
				continue;
			}
			result.misses.push(page);
			let target = this.frames.find((f) => f.page === null);
			if (!target) {
				// LRU victim: least recently touched frame.
				target = this.frames.reduce((a, b) => (a.lastTouched <= b.lastTouched ? a : b));
				if (target.page) result.evicted.push(target.page);
			}
			target.page = page;
			target.usage = 1;
			target.lastTouched = this.tick;
		}
		return result;
	}

	/** Position of a frame in LRU order (0 = most recent). Used for young/old split. */
	lruRank(frame: PoolFrame): number {
		const sorted = [...this.frames].filter((f) => f.page).sort((a, b) => b.lastTouched - a.lastTouched);
		return sorted.indexOf(frame);
	}

	get residentCount(): number {
		return this.frames.filter((f) => f.page).length;
	}
}

export const TOTAL_PAGES = ALL_PAGES.length;
export const POOL_CAPACITY = Math.max(8, Math.floor(TOTAL_PAGES * 0.6));

/* ------------------------------------------------------------------ */
/* Replication topology                                                */
/* ------------------------------------------------------------------ */

export interface ReplicaNode {
	id: string;
	region: string;
	city: string;
	role: 'primary' | 'replica' | 'failed';
	lagMs: number;
	appliedBytes: number;
}

export interface Incident {
	at: Date;
	title: string;
	severity: 'SEV1' | 'SEV2' | 'SEV3';
	durationMs: number;
	resolved: boolean;
}

export class Replication {
	nodes: ReplicaNode[] = [
		{ id: 'eu-west-1a', region: 'eu-west-1', city: 'Dublin', role: 'primary', lagMs: 0, appliedBytes: 4_212_900_412 },
		{ id: 'eu-central-1b', region: 'eu-central-1', city: 'Frankfurt', role: 'replica', lagMs: 18, appliedBytes: 4_212_899_800 },
		{ id: 'ap-south-1a', region: 'ap-south-1', city: 'Mumbai', role: 'replica', lagMs: 142, appliedBytes: 4_212_896_120 },
		{ id: 'us-east-1c', region: 'us-east-1', city: 'N. Virginia', role: 'replica', lagMs: 96, appliedBytes: 4_212_897_500 },
	];
	writePos = 4_212_900_412;
	failingOver = false;
	lastReadRoute: string | null = null;

	get primary(): ReplicaNode {
		return this.nodes.find((n) => n.role === 'primary') ?? this.nodes[0];
	}

	/** One second of simulated traffic. */
	step(): void {
		if (!this.failingOver) this.writePos += 8_000 + Math.floor(Math.random() * 24_000);
		for (const n of this.nodes) {
			if (n.role === 'primary') {
				n.lagMs = 0;
				n.appliedBytes = this.writePos;
			} else if (n.role === 'replica') {
				const baseline = n.region === 'eu-central-1' ? 20 : n.region === 'us-east-1' ? 90 : 140;
				n.lagMs = Math.max(0, Math.round(baseline + (Math.random() - 0.5) * baseline * 0.6));
				n.appliedBytes = Math.max(n.appliedBytes, this.writePos - n.lagMs * 40);
			}
		}
	}

	/** Route a read to the least-lagged healthy replica. */
	routeRead(): ReplicaNode {
		const replicas = this.nodes.filter((n) => n.role === 'replica');
		const pick = replicas.length ? replicas.reduce((a, b) => (a.lagMs <= b.lagMs ? a : b)) : this.primary;
		this.lastReadRoute = pick.id;
		return pick;
	}
}

/* ------------------------------------------------------------------ */
/* CloudWatch-style metrics                                            */
/* ------------------------------------------------------------------ */

export class Series {
	readonly values: number[];
	private smoothed: number;
	constructor(
		public readonly name: string,
		public readonly unit: string,
		private readonly baseline: number,
		private readonly jitter: number,
		public readonly max: number,
		length = 40,
	) {
		this.smoothed = baseline;
		this.values = [];
		for (let i = 0; i < length; i++) this.step();
	}
	private sample(): number {
		return Math.max(0, Math.min(this.max, this.baseline + (Math.random() - 0.5) * this.jitter));
	}
	/** Exponentially smoothed random walk; spikes are applied raw so query bursts stay visible. */
	step(spike = 0): number {
		this.smoothed = this.smoothed * 0.7 + this.sample() * 0.3;
		const v = Math.max(0, Math.min(this.max, this.smoothed + spike));
		this.values.push(v);
		if (this.values.length > 40) this.values.shift();
		return v;
	}
	get last(): number {
		return this.values[this.values.length - 1];
	}
}

export class Metrics {
	cpu = new Series('CPUUtilization', '%', 14, 6, 100);
	connections = new Series('DatabaseConnections', '', 212, 30, 1000);
	readIops = new Series('ReadIOPS', '/s', 1800, 500, 12000);
	freeMem = new Series('FreeableMemory', 'GB', 41.2, 1.2, 64);
	pendingCpuSpike = 0;
	pendingIopsSpike = 0;

	step(failing: boolean): void {
		this.cpu.step(this.pendingCpuSpike + (failing ? 20 : 0));
		this.connections.step(failing ? -150 : 0);
		this.readIops.step(this.pendingIopsSpike);
		this.freeMem.step(failing ? 4 : 0);
		this.pendingCpuSpike *= 0.5;
		this.pendingIopsSpike *= 0.4;
		if (this.pendingCpuSpike < 0.5) this.pendingCpuSpike = 0;
		if (this.pendingIopsSpike < 10) this.pendingIopsSpike = 0;
	}

	onQuery(rowsExamined: number, misses: number): void {
		this.pendingCpuSpike += 6 + rowsExamined * 0.4;
		this.pendingIopsSpike += misses * 900 + 200;
	}
}

/* ------------------------------------------------------------------ */
/* SLO / error budget                                                  */
/* ------------------------------------------------------------------ */

export class Slo {
	readonly target = 99.99;
	readonly windowDays = 30;
	downtimeMs = 0;
	incidents: Incident[] = [];

	get budgetMs(): number {
		return this.windowDays * 24 * 3600 * 1000 * (1 - this.target / 100);
	}
	get remainingMs(): number {
		return Math.max(0, this.budgetMs - this.downtimeMs);
	}
	get remainingPct(): number {
		return (this.remainingMs / this.budgetMs) * 100;
	}
	get achieved(): number {
		const windowMs = this.windowDays * 24 * 3600 * 1000;
		return (1 - this.downtimeMs / windowMs) * 100;
	}
	burn(ms: number): void {
		this.downtimeMs += ms;
	}
}

export const UPTIME_SINCE = new Date(CAREER_START);

export function formatUptime(now: Date): string {
	let years = now.getFullYear() - UPTIME_SINCE.getFullYear();
	let months = now.getMonth() - UPTIME_SINCE.getMonth();
	let days = now.getDate() - UPTIME_SINCE.getDate();
	if (days < 0) {
		months -= 1;
		days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
	}
	if (months < 0) {
		years -= 1;
		months += 12;
	}
	const hh = String(now.getHours()).padStart(2, '0');
	const mm = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	return `${years}y ${months}m ${days}d ${hh}:${mm}:${ss}`;
}

/* ------------------------------------------------------------------ */
/* MVCC: the profile row as a version chain                            */
/* ------------------------------------------------------------------ */

export interface RowVersion {
	trx: number;
	/** The transaction that superseded this version, or null if it is the live tuple. */
	supersededBy: number | null;
	committedAt: string;
	company: string;
	role: string;
	location: string;
	rollPtr: number | null;
}

/** Each role change is an UPDATE; older versions live in undo/heap until purged. */
export function buildVersionChain(): RowVersion[] {
	const roles = [...(table('experience').rows as Row[])].sort((a, b) =>
		String(a.start_date).localeCompare(String(b.start_date)),
	);
	const base = 10_000;
	return roles.map((r, i) => ({
		trx: base + i * 7 + 3,
		supersededBy: i < roles.length - 1 ? base + (i + 1) * 7 + 3 : null,
		committedAt: String(r.start_date),
		company: String(r.company),
		role: String(r.role),
		location: String(r.location),
		rollPtr: i > 0 ? base + (i - 1) * 7 + 3 : null,
	}));
}

/** Which version a snapshot taken at `asOf` (ISO date) can see. */
export function visibleVersion(chain: RowVersion[], asOf: string): RowVersion | null {
	let visible: RowVersion | null = null;
	for (const v of chain) {
		if (v.committedAt <= asOf) visible = v;
	}
	return visible;
}

export function engineIsolationNote(engine: Engine, level: 'RC' | 'RR'): string {
	if (engine === 'mysql') {
		return level === 'RR'
			? 'REPEATABLE READ (InnoDB default): the read view is created at the first read and reused for the whole transaction. Later commits stay invisible.'
			: 'READ COMMITTED: a fresh read view per statement. Each SELECT sees the newest committed version, so two reads in one transaction can differ.';
	}
	return level === 'RR'
		? 'REPEATABLE READ: the snapshot is taken at the first statement and frozen. PostgreSQL implements it with the same xmin/xmax visibility rules, just a stickier snapshot.'
		: 'READ COMMITTED (PostgreSQL default): a new snapshot per statement. Tuples with xmin committed before the snapshot and xmax not yet committed are visible.';
}
