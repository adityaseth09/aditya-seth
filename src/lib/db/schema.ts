/**
 * Relational model of the resume.
 *
 * resume.json is the single source of truth for the classic site. This module
 * normalises it into tables (with primary keys, foreign keys and secondary
 * indexes) so the "database" view can query it like a real schema.
 */
import resume from '../../data/resume.json';

export type Scalar = string | number | null;
export type Row = Record<string, Scalar>;

export interface ColumnDef {
	name: string;
	/** Dialect-neutral logical type. Rendered per dialect in dialect.ts. */
	type: 'id' | 'varchar' | 'text' | 'date' | 'year' | 'int' | 'json' | 'url';
	length?: number;
	nullable?: boolean;
	comment?: string;
	references?: { table: string; column: string };
}

export interface IndexDef {
	name: string;
	columns: string[];
	kind: 'primary' | 'unique' | 'secondary' | 'foreign';
}

export interface TableDef {
	name: string;
	comment: string;
	columns: ColumnDef[];
	indexes: IndexDef[];
	rows: Row[];
	/** Number of 16 KB / 8 KB pages the heap/clustered index occupies (for the buffer pool). */
	pages: number;
}

const MONTHS: Record<string, string> = {
	Jan: '01',
	Feb: '02',
	Mar: '03',
	Apr: '04',
	May: '05',
	Jun: '06',
	Jul: '07',
	Aug: '08',
	Sep: '09',
	Oct: '10',
	Nov: '11',
	Dec: '12',
};

/** "Feb 2022" -> "2022-02-01"; "Present" -> null */
export function toDate(value: string): string | null {
	if (!value || value === 'Present') return null;
	const [mon, year] = value.split(' ');
	const mm = MONTHS[mon];
	return mm ? `${year}-${mm}-01` : `${value}-01-01`;
}

function issuerFor(name: string): string {
	if (name.startsWith('AWS')) return 'Amazon Web Services';
	if (name.startsWith('FinOps')) return 'FinOps Foundation';
	if (name.includes('Scrum')) return 'Scrum Alliance';
	if (name.includes('Outskill')) return 'Outskill';
	return 'Other';
}

const profileRows: Row[] = [
	{
		id: 1,
		name: resume.profile.name,
		title: resume.profile.title,
		tagline: resume.profile.tagline,
		hook: resume.profile.hook,
		location: resume.profile.location,
		availability: resume.profile.availability,
		linkedin_url: resume.profile.linkedin,
		languages: JSON.stringify(resume.profile.languages),
	},
];

const experienceRows: Row[] = resume.experience.map((e, i) => ({
	id: i + 1,
	company: e.company,
	role: e.role,
	start_date: toDate(e.start),
	end_date: toDate(e.end),
	location: e.location,
	tags: JSON.stringify(e.tags),
}));

let highlightId = 0;
const highlightRows: Row[] = resume.experience.flatMap((e, i) =>
	e.highlights.map((h) => ({
		id: ++highlightId,
		experience_id: i + 1,
		body: h,
	})),
);

const educationRows: Row[] = resume.education.map((e, i) => ({
	id: i + 1,
	institution: e.institution,
	credential: e.credential,
	start_year: Number(e.start),
	end_year: Number(e.end),
	note: 'note' in e ? (e.note as string) : null,
}));

const certificationRows: Row[] = resume.certifications.map((c, i) => ({
	id: i + 1,
	name: c.name,
	issuer: issuerFor(c.name),
	verify_url: 'verifyUrl' in c ? (c.verifyUrl as string) : null,
}));

let skillId = 0;
const skillRows: Row[] = resume.skills.flatMap((g) =>
	g.items.map((item) => ({
		id: ++skillId,
		skill_group: g.group,
		name: item,
	})),
);

const metricRows: Row[] = resume.metrics.map((m, i) => ({
	id: i + 1,
	label: m.label,
	value: m.value,
	prefix: 'prefix' in m ? (m.prefix as string) : null,
	suffix: m.suffix,
}));

export const DATABASE_NAME = 'aditya_resume';

export const TABLES: TableDef[] = [
	{
		name: 'profile',
		comment: 'Single-row table. Who is being queried.',
		columns: [
			{ name: 'id', type: 'id' },
			{ name: 'name', type: 'varchar', length: 96 },
			{ name: 'title', type: 'varchar', length: 128 },
			{ name: 'tagline', type: 'text' },
			{ name: 'hook', type: 'text' },
			{ name: 'location', type: 'varchar', length: 64 },
			{ name: 'availability', type: 'text' },
			{ name: 'linkedin_url', type: 'url' },
			{ name: 'languages', type: 'json' },
		],
		indexes: [{ name: 'PRIMARY', columns: ['id'], kind: 'primary' }],
		rows: profileRows,
		pages: 1,
	},
	{
		name: 'experience',
		comment: 'One row per role. end_date IS NULL means current.',
		columns: [
			{ name: 'id', type: 'id' },
			{ name: 'company', type: 'varchar', length: 64 },
			{ name: 'role', type: 'varchar', length: 96 },
			{ name: 'start_date', type: 'date' },
			{ name: 'end_date', type: 'date', nullable: true, comment: 'NULL = current role' },
			{ name: 'location', type: 'varchar', length: 64 },
			{ name: 'tags', type: 'json' },
		],
		indexes: [
			{ name: 'PRIMARY', columns: ['id'], kind: 'primary' },
			{ name: 'idx_company', columns: ['company'], kind: 'secondary' },
			{ name: 'idx_dates', columns: ['start_date', 'end_date'], kind: 'secondary' },
		],
		rows: experienceRows,
		pages: 2,
	},
	{
		name: 'highlights',
		comment: 'Achievements, normalised 1:N from experience.',
		columns: [
			{ name: 'id', type: 'id' },
			{
				name: 'experience_id',
				type: 'int',
				references: { table: 'experience', column: 'id' },
			},
			{ name: 'body', type: 'text' },
		],
		indexes: [
			{ name: 'PRIMARY', columns: ['id'], kind: 'primary' },
			{ name: 'fk_experience', columns: ['experience_id'], kind: 'foreign' },
		],
		rows: highlightRows,
		pages: 4,
	},
	{
		name: 'education',
		comment: 'Degrees, newest first when sorted by end_year.',
		columns: [
			{ name: 'id', type: 'id' },
			{ name: 'institution', type: 'varchar', length: 96 },
			{ name: 'credential', type: 'varchar', length: 96 },
			{ name: 'start_year', type: 'year' },
			{ name: 'end_year', type: 'year' },
			{ name: 'note', type: 'text', nullable: true },
		],
		indexes: [{ name: 'PRIMARY', columns: ['id'], kind: 'primary' }],
		rows: educationRows,
		pages: 1,
	},
	{
		name: 'certifications',
		comment: 'Verified credentials. verify_url NULL = no public badge.',
		columns: [
			{ name: 'id', type: 'id' },
			{ name: 'name', type: 'varchar', length: 96 },
			{ name: 'issuer', type: 'varchar', length: 64 },
			{ name: 'verify_url', type: 'url', nullable: true },
		],
		indexes: [
			{ name: 'PRIMARY', columns: ['id'], kind: 'primary' },
			{ name: 'idx_issuer', columns: ['issuer'], kind: 'secondary' },
		],
		rows: certificationRows,
		pages: 1,
	},
	{
		name: 'skills',
		comment: 'Skill matrix flattened to rows; grouped by skill_group.',
		columns: [
			{ name: 'id', type: 'id' },
			{ name: 'skill_group', type: 'varchar', length: 64 },
			{ name: 'name', type: 'varchar', length: 64 },
		],
		indexes: [
			{ name: 'PRIMARY', columns: ['id'], kind: 'primary' },
			{ name: 'idx_group_name', columns: ['skill_group', 'name'], kind: 'secondary' },
		],
		rows: skillRows,
		pages: 2,
	},
	{
		name: 'metrics',
		comment: 'Headline numbers from the hero section.',
		columns: [
			{ name: 'id', type: 'id' },
			{ name: 'label', type: 'varchar', length: 64 },
			{ name: 'value', type: 'int' },
			{ name: 'prefix', type: 'varchar', length: 4, nullable: true },
			{ name: 'suffix', type: 'varchar', length: 4, nullable: true },
		],
		indexes: [{ name: 'PRIMARY', columns: ['id'], kind: 'primary' }],
		rows: metricRows,
		pages: 1,
	},
];

export function table(name: string): TableDef {
	const t = TABLES.find((x) => x.name === name);
	if (!t) throw new Error(`Unknown table ${name}`);
	return t;
}

/** Stable page identifiers used by the buffer pool simulation. */
export function pagesFor(tableName: string, index?: string): string[] {
	const t = table(tableName);
	if (index && index !== 'PRIMARY') return [`${tableName}.${index}#0`];
	return Array.from({ length: t.pages }, (_, i) => `${tableName}#${i}`);
}

export const ALL_PAGES: string[] = TABLES.flatMap((t) => [
	...pagesFor(t.name),
	...t.indexes.filter((i) => i.kind !== 'primary').map((i) => `${t.name}.${i.name}#0`),
]);

export const PROFILE = resume.profile;
export const CAREER_START = experienceRows.reduce<string>((min, r) => {
	const d = String(r.start_date);
	return d < min ? d : min;
}, '9999-12-31');
