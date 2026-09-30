import resume from '../../data/resume.json';

export type Market = (typeof resume.markets)[number];
export type Device = (typeof resume.devices)[number];
export type PaymentMethod = (typeof resume.paymentMethods)[number] & { devices?: string[] };
export type Role = (typeof resume.experience)[number];

export const PROFILE = resume.profile;
export const EXPERIENCE = resume.experience;
export const SKILLS = resume.skills;
export const EDUCATION = resume.education;
export const MARKETS = resume.markets;
export const DEVICES = resume.devices;
export const METHODS = resume.paymentMethods as PaymentMethod[];
export const LIGHTHOUSE = resume.lighthouse;
export const CONSOLE_FACTS = resume.consoleFacts;

export const METHOD_BY_ID = new Map(METHODS.map((m) => [m.id, m]));
export const MARKET_BY_CODE = new Map(MARKETS.map((m) => [m.code, m]));
export const DEVICE_BY_ID = new Map(DEVICES.map((d) => [d.id, d]));

/** Which payment methods are shown for a market on a device (wallets are device-gated, like isReadyToPay). */
export function methodsFor(market: Market, device: Device): PaymentMethod[] {
	return market.methods
		.map((id) => METHOD_BY_ID.get(id))
		.filter((m): m is PaymentMethod => Boolean(m))
		.filter((m) => !m.devices || m.devices.includes(device.id));
}

/** Rough FX from EUR for the demo order. */
const FX: Record<string, number> = { EUR: 1, CHF: 0.95, DKK: 7.46, GBP: 0.85 };

export const ORDER = {
	restaurant: 'Sunday Ramen Club',
	items: [
		{ name: 'Tonkotsu ramen', qty: 1, eur: 14.5 },
		{ name: 'Gyoza (6)', qty: 1, eur: 6.2 },
		{ name: 'Yuzu lemonade', qty: 2, eur: 3.1 },
	],
	deliveryEur: 2.49,
	serviceEur: 0.99,
	tipEur: 1.5,
	voucherEur: -5,
};

export function orderTotals(market: Market) {
	const fx = FX[market.currency] ?? 1;
	const items = ORDER.items.map((i) => ({ ...i, amount: i.qty * i.eur * fx }));
	const subtotal = items.reduce((n, i) => n + i.amount, 0);
	const delivery = ORDER.deliveryEur * fx;
	const service = ORDER.serviceEur * fx;
	const tip = ORDER.tipEur * fx;
	const voucher = ORDER.voucherEur * fx;
	let total = subtotal + delivery + service + tip + voucher;
	if (market.currency === 'CHF') total = Math.round(total * 20) / 20; // Swiss 0.05 rounding
	return { items, subtotal, delivery, service, tip, voucher, total };
}

export function money(amount: number, market: Market): string {
	return new Intl.NumberFormat(market.locale, { style: 'currency', currency: market.currency }).format(amount);
}

/* ------------------------------------------------------------------ */
/* Elements panel: the résumé as a DOM tree                            */
/* ------------------------------------------------------------------ */

export interface DomNode {
	id: string;
	tag: string;
	attrs?: Record<string, string>;
	text?: string;
	children?: DomNode[];
	/** "CSS rules" shown in the Styles pane */
	styles?: { selector: string; decl: Record<string, string> }[];
	/** Highlight a payment tile in the checkout page when this node is hovered */
	linkMethod?: string;
	open?: boolean;
}

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

function tenure(role: Role): string {
	const [sy, sm] = role.startISO.split('-').map(Number);
	const end = role.endISO ? role.endISO.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
	const months = (end[0] - sy) * 12 + (end[1] - sm);
	const y = Math.floor(months / 12);
	const m = months % 12;
	return y ? `${y}y${m ? ` ${m}m` : ''}` : `${m}m`;
}

export function buildDom(): DomNode {
	let n = 0;
	const id = () => `n${n++}`;

	const roles: DomNode[] = EXPERIENCE.map((role): DomNode => ({
		id: id(),
		tag: 'article',
		attrs: { class: 'role', 'data-company': slug(role.company), 'data-from': role.startISO, 'data-to': role.endISO ?? 'present' },
		open: role.id === 'jet',
		styles: [
			{
				selector: `.role[data-company="${slug(role.company)}"]`,
				decl: {
					title: `"${role.role}"`,
					tenure: tenure(role),
					location: `"${role.location}"`,
					stack: role.tags.map(slug).join(' '),
					highlights: String(role.highlights.length),
				},
			},
			{ selector: '.role', decl: { display: 'block', 'scroll-margin-top': '5rem', ownership: 'end-to-end' } },
		],
		children: [
			{ id: id(), tag: 'h2', text: role.role },
			{ id: id(), tag: 'p', attrs: { class: 'company' }, text: `${role.company} · ${role.location}` },
			{ id: id(), tag: 'time', attrs: { datetime: role.startISO }, text: `${role.start} → ${role.end}` },
			{
				id: id(),
				tag: 'ul',
				attrs: { class: 'highlights' },
				open: role.id === 'jet',
				children: role.highlights.map((h) => ({ id: id(), tag: 'li', text: h })),
			},
		],
	}));

	const skillGroups: DomNode[] = SKILLS.map((g) => ({
		id: id(),
		tag: 'ul',
		attrs: { 'data-group': g.group },
		styles: [{ selector: `ul[data-group="${g.group}"]`, decl: { items: String(g.items.length), 'max-years': String(Math.max(...g.items.map((i) => i.years))) } }],
		children: g.items.map((i) => ({
			id: id(),
			tag: 'li',
			attrs: { 'data-years': String(i.years) },
			text: i.name,
			styles: [{ selector: `li[data-years="${i.years}"]`, decl: { 'years-in-production': String(i.years), confidence: `${i.level}%` } }],
		})),
	}));

	const payments: DomNode[] = METHODS.map((m): DomNode => ({
		id: id(),
		tag: 'payment-method',
		attrs: {
			id: m.id,
			kind: m.kind,
			provider: m.provider,
			markets: MARKETS.filter((mk) => mk.methods.includes(m.id))
				.map((mk) => mk.code)
				.join(' '),
		},
		linkMethod: m.id,
		styles: [
			{
				selector: `payment-method#${m.id}`,
				decl: { flow: `"${m.flow}"`, requests: String(m.requests.length), 'p95-latency': `${Math.max(...m.requests.map((r) => r.ms))}ms` },
			},
			{ selector: 'payment-method', decl: { display: 'inline-flex', 'accessible-name': 'required', 'focus-visible': 'ring 2px' } },
		],
		children: [{ id: id(), tag: '#text', text: m.story }],
	}));

	return {
		id: id(),
		tag: 'html',
		attrs: { lang: 'en', 'data-engineer': slug(PROFILE.name), class: 'dark' },
		open: true,
		styles: [{ selector: 'html[data-engineer]', decl: { 'color-scheme': 'dark light', years: '10+', base: `"${PROFILE.location}"` } }],
		children: [
			{
				id: id(),
				tag: 'head',
				children: [
					{ id: id(), tag: 'title', text: `${PROFILE.name} — ${PROFILE.title}` },
					{ id: id(), tag: 'meta', attrs: { name: 'availability', content: PROFILE.availability } },
					{ id: id(), tag: 'meta', attrs: { name: 'languages', content: PROFILE.languages.join(', ') } },
					{ id: id(), tag: 'link', attrs: { rel: 'me', href: PROFILE.linkedin } },
					{ id: id(), tag: 'link', attrs: { rel: 'alternate', type: 'application/pdf', href: PROFILE.resumePdf } },
				],
			},
			{
				id: id(),
				tag: 'body',
				attrs: { class: 'frontend payments checkout' },
				open: true,
				styles: [{ selector: 'body.frontend.payments', decl: { 'font-family': 'TypeScript, React, Vue', 'line-height': 'calm', overflow: 'visible' } }],
				children: [
					{
						id: id(),
						tag: 'header',
						attrs: { id: 'profile' },
						open: true,
						styles: [{ selector: '#profile', decl: { name: `"${PROFILE.name}"`, title: `"${PROFILE.title}"`, focus: `"${PROFILE.focus}"` } }],
						children: [
							{ id: id(), tag: 'h1', text: PROFILE.name },
							{ id: id(), tag: 'p', attrs: { class: 'title' }, text: `${PROFILE.title} · ${PROFILE.focus}` },
							{ id: id(), tag: 'p', attrs: { class: 'hook' }, text: PROFILE.hook },
						],
					},
					{
						id: id(),
						tag: 'main',
						open: true,
						children: [
							{
								id: id(),
								tag: 'section',
								attrs: { id: 'experience' },
								open: true,
								styles: [{ selector: '#experience', decl: { roles: String(EXPERIENCE.length), span: '2016 → present', cities: 'Berlin, Amsterdam' } }],
								children: roles,
							},
							{
								id: id(),
								tag: 'section',
								attrs: { id: 'payments', 'data-markets': String(MARKETS.length), 'data-methods': String(METHODS.length) },
								styles: [
									{
										selector: '#payments',
										decl: { methods: String(METHODS.length), markets: String(MARKETS.length), psp: 'adyen', 'legacy-paths-retired': '3' },
									},
								],
								children: payments,
							},
							{
								id: id(),
								tag: 'section',
								attrs: { id: 'skills' },
								children: skillGroups,
							},
							{
								id: id(),
								tag: 'section',
								attrs: { id: 'education' },
								children: EDUCATION.map((e) => ({
									id: id(),
									tag: 'article',
									attrs: { class: 'degree', 'data-years': e.years || 'certification' },
									children: [
										{ id: id(), tag: 'h3', text: e.degree },
										{ id: id(), tag: 'p', text: e.school },
									],
								})),
							},
						],
					},
					{
						id: id(),
						tag: 'footer',
						attrs: { id: 'contact' },
						children: [
							{ id: id(), tag: 'a', attrs: { href: `mailto:${PROFILE.email}` }, text: PROFILE.email },
							{ id: id(), tag: 'a', attrs: { href: PROFILE.linkedin, rel: 'me' }, text: 'LinkedIn' },
						],
					},
				],
			},
		],
	};
}

/* ------------------------------------------------------------------ */
/* Performance panel: career as a flame chart                          */
/* ------------------------------------------------------------------ */

export interface PerfBar {
	label: string;
	detail: string;
	start: number; // fractional year
	end: number;
	track: number;
	tone: 'role' | 'stack' | 'payments';
}

export interface PerfMarker {
	label: string;
	at: number;
	kind: 'FCP' | 'LCP' | 'INP' | 'TTI' | 'CLS';
	detail: string;
}

const toYear = (iso: string) => {
	const [y, m] = iso.split('-').map(Number);
	return y + (m - 1) / 12;
};

export function perfData() {
	const now = new Date();
	const nowYear = now.getFullYear() + now.getMonth() / 12;
	const start = 2016;
	const bars: PerfBar[] = EXPERIENCE.map((r) => ({
		label: `${r.company} · ${r.role}`,
		detail: `${r.start} → ${r.end} · ${r.location}`,
		start: toYear(r.startISO),
		end: r.endISO ? toYear(r.endISO) : nowYear,
		track: 0,
		tone: 'role',
	}));
	const stack: [string, string, number, number][] = [
		['React', 'Every role since 2016', 2016.1, nowYear],
		['TypeScript', 'Strict mode since Smava', 2020, nowYear],
		['Next.js · SSR', 'Homepage & landing pages, offer stage', 2020, 2022.9],
		['Vue 3 · micro-frontend', 'Partner invoicing on a shared component library', 2024, nowYear],
	];
	stack.forEach(([label, detail, s, e], i) => bars.push({ label, detail, start: s, end: e, track: 1 + (i % 2), tone: 'stack' }));
	const payments: [string, string, number, number][] = [
		['Payment methods ×15 · 9 markets', 'Apple Pay, Google Pay, Amazon Pay, PayPal, iDEAL, Twint, Bancontact, EPS, Dankort…', 2023.7, nowYear],
		['Error taxonomy → DataDog', 'Frontend failure codes mapped to monitors, aligned with iOS', 2024.2, nowYear],
		['Payments frontend service', 'First engineer: stack, repo, CI, first release behind a flag', 2024.6, nowYear],
		['Legacy paths retired ×3', 'No checkout regression', 2024.9, 2025.6],
	];
	payments.forEach(([label, detail, s, e], i) => bars.push({ label, detail, start: s, end: e, track: 3 + (i % 2), tone: 'payments' }));

	const markers: PerfMarker[] = [
		{ label: 'FCP', at: 2016.1, kind: 'FCP', detail: 'First Commit Paint — Bonify internship, Berlin' },
		{ label: 'TTI', at: 2018, kind: 'TTI', detail: 'Time to Independent — frontend owner of features at Bonify' },
		{ label: 'LCP', at: 2024.6, kind: 'LCP', detail: 'Largest Contentful Payment — payments frontend service founded' },
		{ label: 'INP', at: 2024.8, kind: 'INP', detail: 'Interaction to Next Payment — Apple Pay iOS 18 race condition fixed' },
		{ label: 'CLS', at: 2025.2, kind: 'CLS', detail: 'Cumulative Legacy Shift — 3 legacy payment paths removed, 0 layout shift in checkout' },
	];
	return { start, end: nowYear, bars, markers };
}
