/**
 * Guided query catalogue. Each saved query knows how to:
 *  - print itself in MySQL and PostgreSQL
 *  - execute against the in-memory tables (schema.ts)
 *  - describe its EXPLAIN plan in both dialects
 *  - tell the B+Tree and buffer-pool panels what it touched
 */
import { pagesFor, table, type Row, type Scalar } from './schema';
import type { Engine } from './dialect';

export type Access = 'const' | 'ref' | 'range' | 'index' | 'all' | 'op';

export interface PlanNode {
	mysql: string;
	pg: string;
	pgDetail?: string[];
	access: Access;
	rows: number;
	cost: number;
	children?: PlanNode[];
}

export interface ResultSet {
	columns: string[];
	rows: Scalar[][];
}

export interface IndexWalk {
	table: string;
	/** Index name as defined in schema.ts, or 'PRIMARY'. */
	index: string;
	/** Key values that exist in the index, in sorted order. */
	keys: string[];
	/** For lookups: the key being searched. */
	target?: string;
	scan: 'lookup' | 'range' | 'full' | 'covering';
	/** Whether the engine must then visit the base table (bookmark / heap fetch). */
	fetchesRow: boolean;
}

export interface SavedQuery {
	id: string;
	group: 'Explore' | 'Indexes' | 'Joins & aggregates' | 'Advanced';
	title: string;
	lesson: string;
	sql: Record<Engine, string>;
	run: () => ResultSet;
	plan: PlanNode;
	walk: IndexWalk;
	pages: string[];
	rowsExamined: number;
}

const exp = table('experience').rows;
const hl = table('highlights').rows;
const edu = table('education').rows;
const certs = table('certifications').rows;
const skills = table('skills').rows;
const metrics = table('metrics').rows;
const profile = table('profile').rows[0];

const TODAY = new Date();
const TODAY_ISO = TODAY.toISOString().slice(0, 10);

function monthsBetween(start: string, end: string | null): number {
	const s = new Date(start);
	const e = end ? new Date(end) : TODAY;
	return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

function pick(rows: Row[], cols: string[]): Scalar[][] {
	return rows.map((r) => cols.map((c) => r[c] ?? null));
}

const companyKeys = [...new Set(exp.map((r) => String(r.company)))].sort();
const startDateKeys = exp.map((r) => String(r.start_date)).sort();
const issuerKeys = [...new Set(certs.map((r) => String(r.issuer)))].sort();
const groupKeys = [...new Set(skills.map((r) => String(r.skill_group)))].sort();
const pkKeys = (rows: Row[]) => rows.map((r) => String(r.id));

export const QUERIES: SavedQuery[] = [
	{
		id: 'who',
		group: 'Explore',
		title: 'Who am I querying?',
		lesson:
			'A primary-key lookup is the cheapest read a database can do: one B+Tree descent, one page. MySQL calls this access type "const"; PostgreSQL an Index Scan on the pkey.',
		sql: {
			mysql: `SELECT name, title, location, availability\nFROM profile\nWHERE id = 1;`,
			postgres: `SELECT name, title, location, availability\nFROM profile\nWHERE id = 1;`,
		},
		run: () => ({
			columns: ['name', 'title', 'location', 'availability'],
			rows: pick([profile], ['name', 'title', 'location', 'availability']),
		}),
		plan: {
			mysql: 'Rows fetched before execution (const)',
			pg: 'Index Scan using profile_pkey on profile',
			pgDetail: ['Index Cond: (id = 1)'],
			access: 'const',
			rows: 1,
			cost: 0.0,
		},
		walk: { table: 'profile', index: 'PRIMARY', keys: ['1'], target: '1', scan: 'lookup', fetchesRow: false },
		pages: pagesFor('profile'),
		rowsExamined: 1,
	},
	{
		id: 'timeline',
		group: 'Explore',
		title: 'Career timeline, newest first',
		lesson:
			'ORDER BY start_date DESC can be served by walking idx_dates backwards, so no filesort is needed. Watch the whole leaf level light up: that is an index scan, not a lookup.',
		sql: {
			mysql: `SELECT company, role, start_date, end_date, location\nFROM experience\nORDER BY start_date DESC;`,
			postgres: `SELECT company, role, start_date, end_date, location\nFROM experience\nORDER BY start_date DESC;`,
		},
		run: () => ({
			columns: ['company', 'role', 'start_date', 'end_date', 'location'],
			rows: pick(
				[...exp].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date))),
				['company', 'role', 'start_date', 'end_date', 'location'],
			),
		}),
		plan: {
			mysql: 'Index scan on experience using idx_dates (reverse)',
			pg: 'Index Scan Backward using idx_dates on experience',
			access: 'index',
			rows: exp.length,
			cost: 1.15,
		},
		walk: {
			table: 'experience',
			index: 'idx_dates',
			keys: startDateKeys,
			scan: 'full',
			fetchesRow: true,
		},
		pages: [...pagesFor('experience', 'idx_dates'), ...pagesFor('experience')],
		rowsExamined: exp.length,
	},
	{
		id: 'booking',
		group: 'Indexes',
		title: 'What do I do at Booking.com?',
		lesson:
			'Equality on an indexed column: the optimiser descends idx_company to the leaf holding "Booking.com", then follows the stored primary key back to the clustered index (InnoDB) or the heap TID (PostgreSQL) to fetch the row.',
		sql: {
			mysql: `SELECT role, start_date, location\nFROM experience\nWHERE company = 'Booking.com';`,
			postgres: `SELECT role, start_date, location\nFROM experience\nWHERE company = 'Booking.com';`,
		},
		run: () => ({
			columns: ['role', 'start_date', 'location'],
			rows: pick(
				exp.filter((r) => r.company === 'Booking.com'),
				['role', 'start_date', 'location'],
			),
		}),
		plan: {
			mysql: "Index lookup on experience using idx_company (company='Booking.com')",
			pg: 'Index Scan using idx_company on experience',
			pgDetail: ["Index Cond: (company = 'Booking.com'::text)"],
			access: 'ref',
			rows: 1,
			cost: 0.35,
		},
		walk: {
			table: 'experience',
			index: 'idx_company',
			keys: companyKeys,
			target: 'Booking.com',
			scan: 'lookup',
			fetchesRow: true,
		},
		pages: [...pagesFor('experience', 'idx_company'), 'experience#0'],
		rowsExamined: 1,
	},
	{
		id: 'current',
		group: 'Indexes',
		title: 'Current role (leftmost-prefix rule)',
		lesson:
			'idx_dates is (start_date, end_date). A predicate on end_date alone cannot use it because B+Tree keys are sorted by the leftmost column first. Result: a full scan, examining every row. This is the most common index mistake in production.',
		sql: {
			mysql: `SELECT company, role, start_date\nFROM experience\nWHERE end_date IS NULL;`,
			postgres: `SELECT company, role, start_date\nFROM experience\nWHERE end_date IS NULL;`,
		},
		run: () => ({
			columns: ['company', 'role', 'start_date'],
			rows: pick(
				exp.filter((r) => r.end_date === null),
				['company', 'role', 'start_date'],
			),
		}),
		plan: {
			mysql: 'Filter: (experience.end_date is null)',
			pg: 'Seq Scan on experience',
			pgDetail: ['Filter: (end_date IS NULL)', `Rows Removed by Filter: ${exp.length - 1}`],
			access: 'op',
			rows: 1,
			cost: 1.15,
			children: [
				{
					mysql: 'Table scan on experience',
					pg: '',
					access: 'all',
					rows: exp.length,
					cost: 1.15,
				},
			],
		},
		walk: {
			table: 'experience',
			index: 'PRIMARY',
			keys: pkKeys(exp),
			scan: 'full',
			fetchesRow: false,
		},
		pages: pagesFor('experience'),
		rowsExamined: exp.length,
	},
	{
		id: 'aws-certs',
		group: 'Indexes',
		title: 'AWS certifications',
		lesson:
			'Low-cardinality index (only a few distinct issuers). Still a win here because the table is tiny, but on a 100M-row table the optimiser might prefer a scan once selectivity drops below roughly 10-15%.',
		sql: {
			mysql: `SELECT name, verify_url\nFROM certifications\nWHERE issuer = 'Amazon Web Services';`,
			postgres: `SELECT name, verify_url\nFROM certifications\nWHERE issuer = 'Amazon Web Services';`,
		},
		run: () => ({
			columns: ['name', 'verify_url'],
			rows: pick(
				certs.filter((r) => r.issuer === 'Amazon Web Services'),
				['name', 'verify_url'],
			),
		}),
		plan: {
			mysql: "Index lookup on certifications using idx_issuer (issuer='Amazon Web Services')",
			pg: 'Bitmap Heap Scan on certifications',
			pgDetail: ["Recheck Cond: (issuer = 'Amazon Web Services'::text)"],
			access: 'ref',
			rows: 2,
			cost: 0.7,
			children: [
				{
					mysql: '',
					pg: 'Bitmap Index Scan on idx_issuer',
					pgDetail: ["Index Cond: (issuer = 'Amazon Web Services'::text)"],
					access: 'ref',
					rows: 2,
					cost: 0.3,
				},
			],
		},
		walk: {
			table: 'certifications',
			index: 'idx_issuer',
			keys: issuerKeys,
			target: 'Amazon Web Services',
			scan: 'lookup',
			fetchesRow: true,
		},
		pages: [...pagesFor('certifications', 'idx_issuer'), ...pagesFor('certifications')],
		rowsExamined: 2,
	},
	{
		id: 'skills-covering',
		group: 'Indexes',
		title: 'Skills by group (covering index)',
		lesson:
			'Every column the query needs is inside idx_group_name, so the engine never touches the table. MySQL reports "Using index"; PostgreSQL an Index Only Scan. Covering indexes are the cheapest way to make a hot query fly.',
		sql: {
			mysql: `SELECT skill_group, GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') AS skills\nFROM skills\nGROUP BY skill_group;`,
			postgres: `SELECT skill_group, string_agg(name, ', ' ORDER BY name) AS skills\nFROM skills\nGROUP BY skill_group;`,
		},
		run: () => {
			const groups = new Map<string, string[]>();
			for (const r of skills) {
				const g = String(r.skill_group);
				groups.set(g, [...(groups.get(g) ?? []), String(r.name)]);
			}
			return {
				columns: ['skill_group', 'skills'],
				rows: [...groups.entries()]
					.sort(([a], [b]) => a.localeCompare(b))
					.map(([g, items]) => [g, items.sort().join(', ')]),
			};
		},
		plan: {
			mysql: 'Group aggregate: group_concat(skills.name)',
			pg: 'GroupAggregate',
			pgDetail: ['Group Key: skill_group'],
			access: 'op',
			rows: groupKeys.length,
			cost: 3.4,
			children: [
				{
					mysql: 'Covering index scan on skills using idx_group_name',
					pg: 'Index Only Scan using idx_group_name on skills',
					pgDetail: [`Heap Fetches: 0`],
					access: 'index',
					rows: skills.length,
					cost: 3.1,
				},
			],
		},
		walk: {
			table: 'skills',
			index: 'idx_group_name',
			keys: groupKeys,
			scan: 'covering',
			fetchesRow: false,
		},
		pages: pagesFor('skills', 'idx_group_name'),
		rowsExamined: skills.length,
	},
	{
		id: 'join',
		group: 'Joins & aggregates',
		title: 'Booking.com highlights (JOIN)',
		lesson:
			'A nested-loop join driven by the selective side: find the one experience row via idx_company, then probe fk_experience once. Join order matters more than join syntax.',
		sql: {
			mysql: `SELECT e.company, h.body\nFROM experience e\nJOIN highlights h ON h.experience_id = e.id\nWHERE e.company = 'Booking.com';`,
			postgres: `SELECT e.company, h.body\nFROM experience e\nJOIN highlights h ON h.experience_id = e.id\nWHERE e.company = 'Booking.com';`,
		},
		run: () => {
			const e = exp.find((r) => r.company === 'Booking.com');
			const rows = hl.filter((h) => h.experience_id === e?.id).map((h) => [e?.company ?? null, h.body]);
			return { columns: ['company', 'body'], rows };
		},
		plan: {
			mysql: 'Nested loop inner join',
			pg: 'Nested Loop',
			access: 'op',
			rows: 8,
			cost: 2.45,
			children: [
				{
					mysql: "Index lookup on e using idx_company (company='Booking.com')",
					pg: 'Index Scan using idx_company on experience e',
					pgDetail: ["Index Cond: (company = 'Booking.com'::text)"],
					access: 'ref',
					rows: 1,
					cost: 0.35,
				},
				{
					mysql: 'Index lookup on h using fk_experience (experience_id=e.id)',
					pg: 'Index Scan using fk_experience on highlights h',
					pgDetail: ['Index Cond: (experience_id = e.id)'],
					access: 'ref',
					rows: 8,
					cost: 2.1,
				},
			],
		},
		walk: {
			table: 'highlights',
			index: 'fk_experience',
			keys: [...new Set(hl.map((h) => String(h.experience_id)))].sort((a, b) => Number(a) - Number(b)),
			target: '1',
			scan: 'lookup',
			fetchesRow: true,
		},
		pages: [
			...pagesFor('experience', 'idx_company'),
			'experience#0',
			...pagesFor('highlights', 'fk_experience'),
			'highlights#0',
		],
		rowsExamined: 9,
	},
	{
		id: 'tenure',
		group: 'Joins & aggregates',
		title: 'Tenure per company (months)',
		lesson:
			'GROUP BY on a non-indexed expression forces a temporary table (MySQL) or a HashAggregate (PostgreSQL), then a sort. Cheap at 9 rows; the same shape at 9 billion rows is where you start reading about hash spill to disk.',
		sql: {
			mysql: `SELECT company,\n       SUM(TIMESTAMPDIFF(MONTH, start_date, COALESCE(end_date, CURDATE()))) AS months\nFROM experience\nGROUP BY company\nORDER BY months DESC;`,
			postgres: `SELECT company,\n       SUM(EXTRACT(YEAR FROM age(COALESCE(end_date, CURRENT_DATE), start_date)) * 12\n         + EXTRACT(MONTH FROM age(COALESCE(end_date, CURRENT_DATE), start_date)))::int AS months\nFROM experience\nGROUP BY company\nORDER BY months DESC;`,
		},
		run: () => {
			const acc = new Map<string, number>();
			for (const r of exp) {
				const c = String(r.company);
				acc.set(c, (acc.get(c) ?? 0) + monthsBetween(String(r.start_date), r.end_date as string | null));
			}
			return {
				columns: ['company', 'months'],
				rows: [...acc.entries()].sort((a, b) => b[1] - a[1]).map(([c, m]) => [c, m]),
			};
		},
		plan: {
			mysql: 'Sort: months DESC',
			pg: 'Sort',
			pgDetail: ['Sort Key: (sum(...)) DESC', 'Sort Method: quicksort  Memory: 25kB'],
			access: 'op',
			rows: 8,
			cost: 2.9,
			children: [
				{
					mysql: 'Table scan on <temporary>',
					pg: 'HashAggregate',
					pgDetail: ['Group Key: company', 'Batches: 1  Memory Usage: 24kB'],
					access: 'op',
					rows: 8,
					cost: 2.6,
					children: [
						{
							mysql: 'Aggregate using temporary table',
							pg: 'Seq Scan on experience',
							access: 'op',
							rows: 8,
							cost: 2.3,
							children: [
								{
									mysql: 'Table scan on experience',
									pg: '',
									access: 'all',
									rows: exp.length,
									cost: 1.15,
								},
							],
						},
					],
				},
			],
		},
		walk: { table: 'experience', index: 'PRIMARY', keys: pkKeys(exp), scan: 'full', fetchesRow: false },
		pages: pagesFor('experience'),
		rowsExamined: exp.length,
	},
	{
		id: 'highlights-per-role',
		group: 'Joins & aggregates',
		title: 'Highlights per role',
		lesson:
			'A join followed by an aggregate. PostgreSQL picks a Hash Join once both sides are scanned in full; MySQL 8 does the same with its hash join since 8.0.18. Notice both engines drive from the smaller relation.',
		sql: {
			mysql: `SELECT e.company, e.role, COUNT(h.id) AS highlights\nFROM experience e\nLEFT JOIN highlights h ON h.experience_id = e.id\nGROUP BY e.id, e.company, e.role\nORDER BY highlights DESC, e.start_date DESC;`,
			postgres: `SELECT e.company, e.role, COUNT(h.id) AS highlights\nFROM experience e\nLEFT JOIN highlights h ON h.experience_id = e.id\nGROUP BY e.id, e.company, e.role\nORDER BY highlights DESC, e.start_date DESC;`,
		},
		run: () => ({
			columns: ['company', 'role', 'highlights'],
			rows: [...exp]
				.map((e) => ({ e, n: hl.filter((h) => h.experience_id === e.id).length }))
				.sort((a, b) => b.n - a.n || String(b.e.start_date).localeCompare(String(a.e.start_date)))
				.map(({ e, n }) => [e.company, e.role, n]),
		}),
		plan: {
			mysql: 'Sort: highlights DESC, e.start_date DESC',
			pg: 'Sort',
			pgDetail: ['Sort Key: (count(h.id)) DESC, e.start_date DESC'],
			access: 'op',
			rows: exp.length,
			cost: 6.8,
			children: [
				{
					mysql: 'Group aggregate: count(h.id)',
					pg: 'HashAggregate',
					pgDetail: ['Group Key: e.id'],
					access: 'op',
					rows: exp.length,
					cost: 6.1,
					children: [
						{
							mysql: 'Left hash join (h.experience_id = e.id)',
							pg: 'Hash Right Join',
							pgDetail: ['Hash Cond: (h.experience_id = e.id)'],
							access: 'op',
							rows: hl.length,
							cost: 5.4,
							children: [
								{
									mysql: 'Table scan on h',
									pg: 'Seq Scan on highlights h',
									access: 'all',
									rows: hl.length,
									cost: 1.3,
								},
								{
									mysql: 'Hash: table scan on e',
									pg: 'Hash',
									access: 'op',
									rows: exp.length,
									cost: 1.15,
									children: [
										{
											mysql: '',
											pg: 'Seq Scan on experience e',
											access: 'all',
											rows: exp.length,
											cost: 1.15,
										},
									],
								},
							],
						},
					],
				},
			],
		},
		walk: { table: 'highlights', index: 'PRIMARY', keys: pkKeys(hl), scan: 'full', fetchesRow: false },
		pages: [...pagesFor('highlights'), ...pagesFor('experience')],
		rowsExamined: hl.length + exp.length,
	},
	{
		id: 'mysql-tag',
		group: 'Advanced',
		title: 'Roles tagged MySQL (JSON)',
		lesson:
			'Searching inside a JSON document. MySQL evaluates JSON_CONTAINS row by row (full scan unless you add a multi-valued index). PostgreSQL can use a GIN index for @>; without one it also scans. Either way: JSON is a schema decision, not a free lunch.',
		sql: {
			mysql: `SELECT company, role, tags\nFROM experience\nWHERE JSON_CONTAINS(tags, '"MySQL"');`,
			postgres: `SELECT company, role, tags\nFROM experience\nWHERE tags @> '["MySQL"]'::jsonb;`,
		},
		run: () => ({
			columns: ['company', 'role', 'tags'],
			rows: pick(
				exp.filter((r) => (JSON.parse(String(r.tags)) as string[]).includes('MySQL')),
				['company', 'role', 'tags'],
			),
		}),
		plan: {
			mysql: `Filter: json_contains(experience.tags, '"MySQL"')`,
			pg: 'Seq Scan on experience',
			pgDetail: [`Filter: (tags @> '["MySQL"]'::jsonb)`],
			access: 'op',
			rows: 3,
			cost: 1.15,
			children: [{ mysql: 'Table scan on experience', pg: '', access: 'all', rows: exp.length, cost: 1.15 }],
		},
		walk: { table: 'experience', index: 'PRIMARY', keys: pkKeys(exp), scan: 'full', fetchesRow: false },
		pages: pagesFor('experience'),
		rowsExamined: exp.length,
	},
	{
		id: 'window',
		group: 'Advanced',
		title: 'Promotions (window function)',
		lesson:
			'LAG() peeks at the previous row in start_date order without a self-join. The window frame is fed by the same reverse index scan as the timeline query.',
		sql: {
			mysql: `SELECT company, role, start_date,\n       LAG(role) OVER (ORDER BY start_date) AS previous_role\nFROM experience\nORDER BY start_date DESC;`,
			postgres: `SELECT company, role, start_date,\n       LAG(role) OVER (ORDER BY start_date) AS previous_role\nFROM experience\nORDER BY start_date DESC;`,
		},
		run: () => {
			const asc = [...exp].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
			const rows = asc.map((r, i) => [r.company, r.role, r.start_date, i > 0 ? asc[i - 1].role : null]);
			return { columns: ['company', 'role', 'start_date', 'previous_role'], rows: rows.reverse() };
		},
		plan: {
			mysql: 'Sort: experience.start_date DESC',
			pg: 'Sort',
			pgDetail: ['Sort Key: start_date DESC'],
			access: 'op',
			rows: exp.length,
			cost: 2.4,
			children: [
				{
					mysql: 'Window aggregate: lag(experience.role) OVER (ORDER BY start_date)',
					pg: 'WindowAgg',
					access: 'op',
					rows: exp.length,
					cost: 2.0,
					children: [
						{
							mysql: 'Index scan on experience using idx_dates',
							pg: 'Index Scan using idx_dates on experience',
							access: 'index',
							rows: exp.length,
							cost: 1.15,
						},
					],
				},
			],
		},
		walk: { table: 'experience', index: 'idx_dates', keys: startDateKeys, scan: 'full', fetchesRow: true },
		pages: [...pagesFor('experience', 'idx_dates'), ...pagesFor('experience')],
		rowsExamined: exp.length,
	},
	{
		id: 'education',
		group: 'Explore',
		title: 'Education',
		lesson:
			'Two rows, one page. The optimiser knows from table statistics that a scan is cheaper than any index here. Small tables are almost always full-scanned on purpose.',
		sql: {
			mysql: `SELECT institution, credential, start_year, end_year, note\nFROM education\nORDER BY end_year DESC;`,
			postgres: `SELECT institution, credential, start_year, end_year, note\nFROM education\nORDER BY end_year DESC;`,
		},
		run: () => ({
			columns: ['institution', 'credential', 'start_year', 'end_year', 'note'],
			rows: pick(
				[...edu].sort((a, b) => Number(b.end_year) - Number(a.end_year)),
				['institution', 'credential', 'start_year', 'end_year', 'note'],
			),
		}),
		plan: {
			mysql: 'Sort: education.end_year DESC',
			pg: 'Sort',
			pgDetail: ['Sort Key: end_year DESC'],
			access: 'op',
			rows: edu.length,
			cost: 0.45,
			children: [{ mysql: 'Table scan on education', pg: 'Seq Scan on education', access: 'all', rows: edu.length, cost: 0.35 }],
		},
		walk: { table: 'education', index: 'PRIMARY', keys: pkKeys(edu), scan: 'full', fetchesRow: false },
		pages: pagesFor('education'),
		rowsExamined: edu.length,
	},
	{
		id: 'metrics',
		group: 'Explore',
		title: 'Headline metrics',
		lesson:
			'String concatenation happens in the projection step after rows are read. Cheap, but never index a computed expression unless your engine supports functional indexes and you actually filter on it.',
		sql: {
			mysql: `SELECT label, CONCAT(COALESCE(prefix, ''), value, COALESCE(suffix, '')) AS headline\nFROM metrics;`,
			postgres: `SELECT label, COALESCE(prefix, '') || value || COALESCE(suffix, '') AS headline\nFROM metrics;`,
		},
		run: () => ({
			columns: ['label', 'headline'],
			rows: metrics.map((m) => [m.label, `${m.prefix ?? ''}${m.value}${m.suffix ?? ''}`]),
		}),
		plan: {
			mysql: 'Table scan on metrics',
			pg: 'Seq Scan on metrics',
			access: 'all',
			rows: metrics.length,
			cost: 0.65,
		},
		walk: { table: 'metrics', index: 'PRIMARY', keys: pkKeys(metrics), scan: 'full', fetchesRow: false },
		pages: pagesFor('metrics'),
		rowsExamined: metrics.length,
	},
];

/** The dominant access method of a plan: a full scan anywhere taints the whole plan. */
export function effectiveAccess(n: PlanNode): Access {
	if (n.access === 'all') return 'all';
	if (!n.children?.length) return n.access;
	const kids = n.children.map(effectiveAccess);
	if (kids.includes('all')) return 'all';
	if (kids.includes('index')) return 'index';
	if (kids.includes('range')) return 'range';
	return kids.find((k) => k !== 'op') ?? n.access;
}

export function queryById(id: string): SavedQuery {
	const q = QUERIES.find((x) => x.id === id);
	if (!q) throw new Error(`Unknown query ${id}`);
	return q;
}

/** `SELECT * FROM <table> LIMIT n` used when a table is clicked in the schema tree. */
export function selectAllQuery(tableName: string, limit = 25): SavedQuery {
	const t = table(tableName);
	const cols = t.columns.map((c) => c.name);
	const rows = t.rows.slice(0, limit);
	return {
		id: `select-all:${tableName}`,
		group: 'Explore',
		title: `SELECT * FROM ${tableName}`,
		lesson: `${t.comment} A LIMIT without ORDER BY returns rows in storage order: InnoDB stores rows physically by primary key; PostgreSQL by heap insertion order, which can change after VACUUM. Never rely on it.`,
		sql: {
			mysql: `SELECT *\nFROM ${tableName}\nLIMIT ${limit};`,
			postgres: `SELECT *\nFROM ${tableName}\nLIMIT ${limit};`,
		},
		run: () => ({ columns: cols, rows: pick(rows, cols) }),
		plan: {
			mysql: `Limit: ${limit} row(s)`,
			pg: 'Limit',
			access: 'op',
			rows: rows.length,
			cost: 0.25 + t.rows.length * 0.1,
			children: [
				{
					mysql: `Table scan on ${tableName}`,
					pg: `Seq Scan on ${tableName}`,
					access: 'all',
					rows: t.rows.length,
					cost: 0.25 + t.rows.length * 0.1,
				},
			],
		},
		walk: { table: tableName, index: 'PRIMARY', keys: pkKeys(t.rows), scan: 'full', fetchesRow: false },
		pages: pagesFor(tableName),
		rowsExamined: t.rows.length,
	};
}

export { TODAY_ISO };
