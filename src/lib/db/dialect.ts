/**
 * Everything that differs between MySQL/InnoDB and PostgreSQL lives here:
 * type names, DDL rendering, prompts, and the vocabulary each engine uses
 * for the same internal concept.
 */
import { DATABASE_NAME, type ColumnDef, type TableDef } from './schema';

export type Engine = 'mysql' | 'postgres';

export interface DialectLabels {
	name: string;
	version: string;
	storageEngine: string;
	prompt: string;
	pageSizeKb: number;
	bufferPool: string;
	bufferHitMetric: string;
	evictionPolicy: string;
	wal: string;
	walPositionLabel: string;
	replicaStatusCmd: string;
	lagMetric: string;
	slowLogSource: string;
	explainCmd: string;
	describeCmd: (table: string) => string;
	showTablesCmd: string;
	mvcc: {
		txId: string;
		rollback: string;
		versionStore: string;
		cleanup: string;
		snapshot: string;
		defaultIsolation: string;
	};
	rdsEngine: string;
	rdsParameterGroup: string;
	fullScan: string;
}

export const LABELS: Record<Engine, DialectLabels> = {
	mysql: {
		name: 'MySQL',
		version: '8.4 LTS',
		storageEngine: 'InnoDB',
		prompt: 'mysql>',
		pageSizeKb: 16,
		bufferPool: 'InnoDB buffer pool',
		bufferHitMetric: 'Innodb_buffer_pool_read_requests',
		evictionPolicy: 'Midpoint-insertion LRU (young 5/8, old 3/8)',
		wal: 'binlog + redo log',
		walPositionLabel: 'Executed_Gtid_Set',
		replicaStatusCmd: 'SHOW REPLICA STATUS\\G',
		lagMetric: 'Seconds_Behind_Source',
		slowLogSource: 'performance_schema.events_statements_summary_by_digest',
		explainCmd: 'EXPLAIN FORMAT=TREE',
		describeCmd: (t) => `SHOW CREATE TABLE ${t}\\G`,
		showTablesCmd: 'SHOW TABLES',
		mvcc: {
			txId: 'DB_TRX_ID',
			rollback: 'DB_ROLL_PTR',
			versionStore: 'undo log',
			cleanup: 'purge thread',
			snapshot: 'read view',
			defaultIsolation: 'REPEATABLE READ',
		},
		rdsEngine: 'MySQL Community 8.4.3',
		rdsParameterGroup: 'default.mysql8.4',
		fullScan: 'Table scan',
	},
	postgres: {
		name: 'PostgreSQL',
		version: '17',
		storageEngine: 'heap',
		prompt: `${DATABASE_NAME}=#`,
		pageSizeKb: 8,
		bufferPool: 'shared_buffers',
		bufferHitMetric: 'pg_stat_database.blks_hit',
		evictionPolicy: 'Clock-sweep with usage_count (max 5)',
		wal: 'WAL',
		walPositionLabel: 'pg_current_wal_lsn()',
		replicaStatusCmd: 'SELECT * FROM pg_stat_replication;',
		lagMetric: 'replay_lag',
		slowLogSource: 'pg_stat_statements',
		explainCmd: 'EXPLAIN (ANALYZE, BUFFERS)',
		describeCmd: (t) => `\\d+ ${t}`,
		showTablesCmd: '\\dt',
		mvcc: {
			txId: 'xmin',
			rollback: 'xmax',
			versionStore: 'heap (dead tuples)',
			cleanup: 'VACUUM / autovacuum',
			snapshot: 'snapshot',
			defaultIsolation: 'READ COMMITTED',
		},
		rdsEngine: 'PostgreSQL 17.2',
		rdsParameterGroup: 'default.postgres17',
		fullScan: 'Seq Scan',
	},
};

export function columnType(col: ColumnDef, engine: Engine): string {
	const len = col.length ?? 255;
	if (engine === 'mysql') {
		switch (col.type) {
			case 'id':
				return 'INT UNSIGNED NOT NULL AUTO_INCREMENT';
			case 'int':
				return 'INT UNSIGNED';
			case 'varchar':
				return `VARCHAR(${len})`;
			case 'text':
				return 'TEXT';
			case 'date':
				return 'DATE';
			case 'year':
				return 'YEAR';
			case 'json':
				return 'JSON';
			case 'url':
				return 'VARCHAR(255)';
		}
	}
	switch (col.type) {
		case 'id':
			return 'integer GENERATED ALWAYS AS IDENTITY';
		case 'int':
			return 'integer';
		case 'varchar':
			return `varchar(${len})`;
		case 'text':
			return 'text';
		case 'date':
			return 'date';
		case 'year':
			return 'smallint';
		case 'json':
			return 'jsonb';
		case 'url':
			return 'text';
	}
}

/** Short type shown in the schema tree. */
export function shortType(col: ColumnDef, engine: Engine): string {
	return columnType(col, engine)
		.replace(' NOT NULL AUTO_INCREMENT', '')
		.replace(' GENERATED ALWAYS AS IDENTITY', '')
		.replace('INT UNSIGNED', 'INT');
}

function q(ident: string, engine: Engine): string {
	return engine === 'mysql' ? `\`${ident}\`` : `"${ident}"`;
}

export function renderCreateTable(t: TableDef, engine: Engine): string {
	const lines: string[] = [];
	const nn = (c: ColumnDef) => (c.type === 'id' ? '' : c.nullable ? '' : ' NOT NULL');

	if (engine === 'mysql') {
		lines.push(`CREATE TABLE ${q(t.name, engine)} (`);
		const body: string[] = t.columns.map((c) => {
			let s = `  ${q(c.name, engine)} ${columnType(c, engine)}${nn(c)}`;
			if (c.nullable) s += ' DEFAULT NULL';
			if (c.comment) s += ` COMMENT '${c.comment}'`;
			return s;
		});
		for (const idx of t.indexes) {
			const cols = idx.columns.map((c) => q(c, engine)).join(', ');
			if (idx.kind === 'primary') body.push(`  PRIMARY KEY (${cols})`);
			else if (idx.kind === 'unique') body.push(`  UNIQUE KEY ${q(idx.name, engine)} (${cols})`);
			else body.push(`  KEY ${q(idx.name, engine)} (${cols})`);
		}
		for (const c of t.columns) {
			if (c.references) {
				body.push(
					`  CONSTRAINT ${q(`fk_${t.name}_${c.name}`, engine)} FOREIGN KEY (${q(c.name, engine)}) REFERENCES ${q(c.references.table, engine)} (${q(c.references.column, engine)}) ON DELETE CASCADE`,
				);
			}
		}
		lines.push(body.join(',\n'));
		lines.push(
			`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='${t.comment}';`,
		);
		return lines.join('\n');
	}

	lines.push(`CREATE TABLE ${t.name} (`);
	const body: string[] = t.columns.map((c) => {
		let s = `  ${c.name} ${columnType(c, engine)}${nn(c)}`;
		if (c.type === 'id') s += ' PRIMARY KEY';
		if (c.references) s += ` REFERENCES ${c.references.table}(${c.references.column}) ON DELETE CASCADE`;
		return s;
	});
	lines.push(body.join(',\n'));
	lines.push(');');
	for (const idx of t.indexes) {
		if (idx.kind === 'primary') continue;
		const cols = idx.columns.join(', ');
		lines.push(`CREATE INDEX ${idx.name} ON ${t.name} USING btree (${cols});`);
	}
	lines.push(`COMMENT ON TABLE ${t.name} IS '${t.comment}';`);
	for (const c of t.columns) {
		if (c.comment) lines.push(`COMMENT ON COLUMN ${t.name}.${c.name} IS '${c.comment}';`);
	}
	return lines.join('\n');
}

/** Render a result-set footer the way each CLI does. */
export function resultFooter(rows: number, ms: number, engine: Engine): string {
	if (engine === 'mysql') {
		const n = rows === 1 ? '1 row' : `${rows} rows`;
		return `${n} in set (${(ms / 1000).toFixed(2)} sec)\n-- server-side: ${ms.toFixed(3)} ms (Query_time in the slow log)`;
	}
	return `(${rows} ${rows === 1 ? 'row' : 'rows'})\nTime: ${ms.toFixed(3)} ms`;
}

/** Format a WAL/binlog position for display. */
export function formatWalPosition(bytes: number, engine: Engine): string {
	if (engine === 'mysql') {
		const file = 42 + Math.floor(bytes / 1_073_741_824);
		const pos = bytes % 1_073_741_824;
		return `binlog.${String(file).padStart(6, '0')}:${pos}`;
	}
	const hi = Math.floor(bytes / 0x1_0000_0000);
	const lo = bytes % 0x1_0000_0000;
	return `${hi.toString(16).toUpperCase()}/${lo.toString(16).toUpperCase().padStart(8, '0')}`;
}
