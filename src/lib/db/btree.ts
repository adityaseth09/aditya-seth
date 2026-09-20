/**
 * Builds a real B+Tree over a sorted key set and lays it out as SVG.
 * Fan-out is deliberately tiny so the structure is visible at resume scale.
 */
import type { IndexWalk } from './queries';
import type { Engine } from './dialect';

interface TreeNode {
	id: string;
	keys: string[];
	children: TreeNode[];
	leaf: boolean;
	x: number;
	y: number;
	w: number;
}

export interface BTreeRender {
	svg: string;
	/** Node ids from root to the target leaf (lookup) or root only (scan). */
	path: string[];
	/** Leaf ids left to right. */
	leaves: string[];
	/** Id of the row-fetch box, if any. */
	fetchId: string | null;
	edgesOnPath: string[];
}

const NODE_H = 30;
const LEVEL_GAP = 62;
const LEAF_GAP = 18;

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

function truncate(s: string, n: number): string {
	return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildTree(keys: string[]): { root: TreeNode; leaves: TreeNode[] } {
	const leafCap = keys.length > 12 ? 4 : keys.length > 6 ? 3 : 2;
	const fanout = 3;
	let level: TreeNode[] = chunk(keys, leafCap).map((ks, i) => ({
		id: `L0-${i}`,
		keys: ks,
		children: [],
		leaf: true,
		x: 0,
		y: 0,
		w: 0,
	}));
	if (level.length === 0) {
		level = [{ id: 'L0-0', keys: ['∅'], children: [], leaf: true, x: 0, y: 0, w: 0 }];
	}
	const leaves = level;
	let depth = 1;
	while (level.length > 1) {
		level = chunk(level, fanout).map((kids, i) => ({
			id: `L${depth}-${i}`,
			keys: kids.slice(1).map((k) => firstKey(k)),
			children: kids,
			leaf: false,
			x: 0,
			y: 0,
			w: 0,
		}));
		depth++;
	}
	return { root: level[0], leaves };
}

function firstKey(n: TreeNode): string {
	return n.leaf ? n.keys[0] : firstKey(n.children[0]);
}

function findLeaf(root: TreeNode, target: string): { path: TreeNode[]; found: boolean } {
	const path: TreeNode[] = [];
	let node = root;
	while (true) {
		path.push(node);
		if (node.leaf) return { path, found: node.keys.includes(target) };
		let idx = 0;
		while (idx < node.keys.length && target >= node.keys[idx]) idx++;
		node = node.children[idx];
	}
}

export function renderBTree(walk: IndexWalk, engine: Engine): BTreeRender {
	const { root, leaves } = buildTree(walk.keys);
	const maxLen = Math.min(11, Math.max(3, ...walk.keys.map((k) => k.length)));
	const cellW = Math.max(40, 7 * maxLen + 12);

	// Layout leaves left to right, then centre parents over their children.
	let cursor = 0;
	for (const leaf of leaves) {
		leaf.w = Math.max(1, leaf.keys.length) * cellW;
		leaf.x = cursor;
		cursor += leaf.w + LEAF_GAP;
	}
	const depthOf = (n: TreeNode): number => (n.leaf ? 0 : 1 + depthOf(n.children[0]));
	const height = depthOf(root);
	const layout = (n: TreeNode): void => {
		if (!n.leaf) {
			n.children.forEach(layout);
			const first = n.children[0];
			const last = n.children[n.children.length - 1];
			n.w = Math.max(1, n.keys.length) * cellW;
			n.x = (first.x + last.x + last.w) / 2 - n.w / 2;
		}
		n.y = (height - depthOf(n)) * LEVEL_GAP + 12;
	};
	layout(root);

	const totalW = cursor - LEAF_GAP;
	const fetchY = (height + 1) * LEVEL_GAP + 12;
	const showFetch = walk.fetchesRow || (walk.scan === 'lookup' && walk.index === 'PRIMARY');
	const totalH = fetchY + (showFetch ? NODE_H + 8 : 0);

	const parts: string[] = [];
	const edgesOnPath: string[] = [];
	const nodes: TreeNode[] = [];
	const collect = (n: TreeNode): void => {
		nodes.push(n);
		n.children.forEach(collect);
	};
	collect(root);

	// Edges parent -> child
	for (const n of nodes) {
		n.children.forEach((c, i) => {
			const sx = n.x + (i / Math.max(1, n.children.length - 1 || 1)) * n.w;
			const x1 = n.children.length === 1 ? n.x + n.w / 2 : sx;
			parts.push(
				`<path class="bt-edge" data-edge="${n.id}->${c.id}" d="M${x1.toFixed(1)},${n.y + NODE_H} C${x1.toFixed(1)},${n.y + NODE_H + 24} ${(c.x + c.w / 2).toFixed(1)},${c.y - 24} ${(c.x + c.w / 2).toFixed(1)},${c.y}" />`,
			);
		});
	}
	// Leaf sibling pointers
	for (let i = 0; i < leaves.length - 1; i++) {
		const a = leaves[i];
		const b = leaves[i + 1];
		parts.push(
			`<path class="bt-sibling" data-sibling="${a.id}" d="M${a.x + a.w},${a.y + NODE_H / 2} L${b.x},${b.y + NODE_H / 2}" marker-end="url(#bt-arrow)" />`,
		);
	}
	// Nodes
	for (const n of nodes) {
		const cells = n.keys
			.map((k, i) => {
				const cx = n.x + i * cellW;
				const isTarget = walk.target !== undefined && k === walk.target && n.leaf;
				return `<g class="bt-cell${isTarget ? ' is-target' : ''}"><rect x="${cx}" y="${n.y}" width="${cellW}" height="${NODE_H}" rx="4" /><text x="${cx + cellW / 2}" y="${n.y + NODE_H / 2 + 4}" text-anchor="middle">${esc(truncate(k, 11))}</text></g>`;
			})
			.join('');
		parts.push(`<g class="bt-node${n.leaf ? ' is-leaf' : ''}${n === root ? ' is-root' : ''}" data-node="${n.id}">${cells}</g>`);
	}

	// Path
	let path: string[] = [root.id];
	let fetchId: string | null = null;
	let minX = 0;
	let maxX = totalW;
	if (walk.scan === 'lookup' && walk.target !== undefined) {
		const { path: p } = findLeaf(root, walk.target);
		path = p.map((n) => n.id);
		for (let i = 0; i < p.length - 1; i++) edgesOnPath.push(`${p[i].id}->${p[i + 1].id}`);
		const leaf = p[p.length - 1];
		if (showFetch) {
			fetchId = 'fetch';
			const label =
				walk.index === 'PRIMARY'
					? engine === 'mysql'
						? 'row lives here (clustered index leaf)'
						: `heap tuple ctid=(0,${walk.target})`
					: engine === 'mysql'
						? `→ PRIMARY lookup (leaf stores PK)`
						: `→ heap fetch (leaf stores TID)`;
			const fw = Math.round(label.length * 6.7 + 24);
			const fx = Math.max(Math.min(0, totalW - fw), Math.min(totalW - fw, leaf.x + leaf.w / 2 - fw / 2));
			parts.push(
				`<path class="bt-edge" data-edge="${leaf.id}->fetch" d="M${leaf.x + leaf.w / 2},${leaf.y + NODE_H} L${fx + fw / 2},${fetchY}" />`,
			);
			edgesOnPath.push(`${leaf.id}->fetch`);
			parts.push(
				`<g class="bt-node bt-fetch" data-node="fetch"><rect x="${fx}" y="${fetchY}" width="${fw}" height="${NODE_H}" rx="6" /><text x="${fx + fw / 2}" y="${fetchY + NODE_H / 2 + 4}" text-anchor="middle">${esc(label)}</text></g>`,
			);
			minX = Math.min(minX, fx);
			maxX = Math.max(maxX, fx + fw);
		}
	}

	const vbW = maxX - minX + 12;
	// Natural size = viewBox size; CSS caps at 100% so the tree shrinks on narrow panels but never balloons.
	const svg = `<svg class="bt-svg" style="width:${vbW}px" viewBox="${minX - 6} 0 ${vbW} ${totalH + 6}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="B+Tree for ${esc(walk.table)}.${esc(walk.index)}">
	<defs><marker id="bt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" /></marker></defs>
	${parts.join('\n')}
</svg>`;

	return { svg, path, leaves: leaves.map((l) => l.id), fetchId, edgesOnPath };
}
