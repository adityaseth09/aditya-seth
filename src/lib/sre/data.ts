/**
 * Data for the /sre view: the résumé reframed as an observability platform.
 * Every incident below is a real situation from resume.json, framed the SRE
 * way: inherited (the alert), triaged (detection), resolved (what he did),
 * with the business outcome as the postmortem's "what we learned".
 */

export const CAREER_START = '2006-08-01';
export const PLATFORM = 'prod.aditya';

export type Sev = 'SEV1' | 'SEV2' | 'SEV3';

export interface Incident {
	id: string;
	sev: Sev;
	title: string;
	service: string;
	opened: string;
	ttr: string;
	impact: string;
	detected: string;
	resolution: string;
	outcome: string;
	tags: string[];
}

/** Newest first — the feed reads like a real incident channel. */
export const INCIDENTS: Incident[] = [
	{
		id: 'INC-2022-042',
		sev: 'SEV1',
		title: '20k-server MySQL fleet reliability + runaway cloud spend',
		service: 'booking.com/mysql-fleet',
		opened: 'Feb 2022',
		ttr: 'ongoing · held at 99.999%',
		impact:
			'One of the world\u2019s largest MySQL fleets: 20,000+ servers on prem and in cloud, $40M+/yr of avoidable spend, 24/7 reliability on the line.',
		detected:
			'Usage telemetry + AI-driven observability rollout: right-sizing evidence pulled straight from production, not spreadsheets.',
		resolution:
			'Stood up AI-driven observability and agentic auto-remediation across the fleet; migrated thousands of servers to cloud; drove company-wide Technical FinOps with cost-visibility frameworks.',
		outcome:
			'$40M+/yr saved, a further 20% opex cut via agentic optimisation, infrastructure costs down 35%, fleet kept reliable by 24/7 on-call SRE teams.',
		tags: ['FinOps', 'AI Observability', 'Auto-Remediation', '20k+ MySQL'],
	},
	{
		id: 'INC-2024-007',
		sev: 'SEV2',
		title: 'Bangalore expansion: zero hiring pipeline',
		service: 'booking.com/org-scaling',
		opened: '2024',
		ttr: '5 months to fully resolved',
		impact:
			'Two new teams needed from a standing start; delivery forecast would slip without an end-to-end pipeline.',
		detected: 'Headcount plan vs delivery forecast — the gap showed up as schedule burn.',
		resolution:
			'Designed the hiring playbook and end-to-end recruitment pipeline for the Bangalore expansion.',
		outcome: '20+ engineers hired in 5 months, two new teams stood up, 8 in-house ICs plus outsourced teams — delivery efficiency up 30%.',
		tags: ['Hiring', 'Leadership', 'Org Design'],
	},
	{
		id: 'INC-2019-002',
		sev: 'SEV2',
		title: 'Delivery ETA latency at national scale',
		service: 'deliveryhero/time-predictions',
		opened: 'Aug 2019',
		ttr: 'shipped · stable since',
		impact:
			'Pricing and delivery-time estimates for 40+ countries needed real-time accuracy at 1M+ requests/min.',
		detected: 'Latency dashboards on the dynamic-pricing canary: P99 creeping past the SLO.',
		resolution:
			'Founded the Dynamic Pricing Service and led it from proof of concept to a critical Java/Kotlin system on Kubernetes and AWS; directed the Time Predictions Squad.',
		outcome:
			'1M+ req/min at ~15ms average latency, pricing/delivery efficiency up 35%, restaurant availability to nearby customers up 55%.',
		tags: ['Kubernetes', 'Java', 'Latency', 'Real-Time'],
	},
	{
		id: 'INC-2015-001',
		sev: 'SEV3',
		title: 'Order processing efficiency for national chains',
		service: 'deliveryhero/order-flow',
		opened: 'May 2015',
		ttr: 'shipped · efficiency +50%',
		impact:
			'Major restaurant chains (McDonald\u2019s, Domino\u2019s) needed integrations that would not fall over at national scale.',
		detected: 'Order-flow monitoring on third-party API error rates.',
		resolution:
			'Designed and executed the integrations with Python, PostgreSQL and AWS; built geolocation services for real-time tracking.',
		outcome: 'Order processing efficiency +50%, service coverage +30%, delivery accuracy +40%, customer satisfaction +25%.',
		tags: ['Python', 'PostgreSQL', 'AWS', 'Integrations'],
	},
	{
		id: 'INC-2012-001',
		sev: 'SEV3',
		title: 'Search and DB efficiency on an eCommerce platform',
		service: 'fabfurnish/platform',
		opened: 'Mar 2012',
		ttr: 'shipped · efficiency +30%',
		impact: 'Faceted search and database layer throttling the whole storefront.',
		detected: 'Slow-query digests + server saturation panels.',
		resolution:
			'Architected the platform with Solr faceted search and MySQL optimisations; led the mobile-optimised website.',
		outcome: 'Server and database efficiency +30%, mobile traffic +40%.',
		tags: ['Solr', 'MySQL', 'Architecture'],
	},
	{
		id: 'INC-2008-001',
		sev: 'SEV3',
		title: 'naukri.com LAMP stack speed',
		service: 'infoedge/naukri',
		opened: 'Feb 2008',
		ttr: 'shipped · speed +35%',
		impact: 'High-traffic recruitment platform losing users to load time.',
		detected: 'First real production monitors — this is where the on-call habit started.',
		resolution: 'Architected and optimised naukri.com and firstnaukri.com on the LAMP stack.',
		outcome: 'Site speed +35%, user retention +20%.',
		tags: ['LAMP', 'PHP', 'MySQL'],
	},
];

export interface Deploy {
	version: string;
	service: string;
	channel: string;
	start: string;
	end: string;
	region: string;
	note: string;
	current?: boolean;
}

/** The career as a deploy history: every release shipped, none rolled back. */
export const DEPLOYS: Deploy[] = [
	{ version: 'v2022.02', service: 'booking.com', channel: 'SRE Engineering Manager', start: 'Feb 2022', end: 'Present', region: 'Amsterdam', note: '20k+ MySQL fleet · AI observability · FinOps', current: true },
	{ version: 'v2019.08', service: 'deliveryhero/pricing', channel: 'Engineering Manager', start: 'Aug 2019', end: 'Dec 2021', region: 'Berlin', note: 'canary promoted: 1M+ req/min at ~15ms' },
	{ version: 'v2015.05', service: 'deliveryhero/orders', channel: 'Senior Software Engineer', start: 'May 2015', end: 'Aug 2019', region: 'Berlin', note: 'national-chain integrations, geolocation' },
	{ version: 'v2014.12', service: 'spaceways/backend', channel: 'Senior Backend Developer', start: 'Dec 2014', end: 'Apr 2015', region: 'Berlin', note: 'short deploy, clean handover' },
	{ version: 'v2014.04', service: 'makemytrip/platform', channel: 'Manager, Technology', start: 'Apr 2014', end: 'Nov 2014', region: 'Gurgaon', note: 'CDN + deployment pipelines + live monitoring' },
	{ version: 'v2012.03', service: 'fabfurnish/platform', channel: 'Technical Architect / EM', start: 'Mar 2012', end: 'Apr 2014', region: 'Gurgaon', note: 'Solr + MySQL, mobile web' },
	{ version: 'v2010.10', service: 'belzabar/apps', channel: 'Sr. Computer Scientist', start: 'Oct 2010', end: 'Mar 2012', region: 'New Delhi', note: 'AWS, analytics tooling' },
	{ version: 'v2008.02', service: 'infoedge/naukri', channel: 'Senior Software Engineer', start: 'Feb 2008', end: 'Jul 2010', region: 'Noida', note: 'LAMP at scale — first SLOs' },
	{ version: 'v2006.08', service: 'oracle/flexcube', channel: 'Associate Consultant', start: 'Aug 2006', end: 'Feb 2008', region: 'Bengaluru', note: 'initial commit: core banking' },
];

export interface SloRow {
	name: string;
	target: string;
	achieved: string;
	budget: string;
}

export const SLOS: SloRow[] = [
	{ name: 'availability', target: '99.99%', achieved: '99.999%', budget: '4m 23s / month' },
	{ name: 'fleet reliability', target: 'no SEV1 unmitigated', achieved: '0 unmitigated', budget: '24/7 on-call' },
	{ name: 'cost per request', target: '\u221235%', achieved: '\u221235% (and \u221220% opex)', budget: '$40M+/yr returned' },
	{ name: 'compliance', target: 'SOX · PCI · PII', achieved: '100%', budget: 'no exceptions' },
];

export interface Signal {
	id: string;
	label: string;
	unit: string;
	/** current value readout */
	value: string;
	/** sparkline series params: base, amplitude */
	base: number;
	amp: number;
}

/** The four golden signals, populated with career-scale numbers. */
export const SIGNALS: Signal[] = [
	{ id: 'latency', label: 'latency p99', unit: 'ms', value: '~15 ms', base: 15, amp: 3 },
	{ id: 'traffic', label: 'traffic', unit: 'req/min', value: '1M+', base: 100, amp: 14 },
	{ id: 'errors', label: 'error rate', unit: '%', value: '0.001%', base: 50, amp: 10 },
	{ id: 'saturation', label: 'saturation', unit: '%', value: '62%', base: 62, amp: 8 },
];

export const ONCALL = {
	mttd: '45s (sim)',
	mttr: 'minutes — agentic auto-remediation (sim)',
	primary: 'Aditya · 24/7',
	compliance: ['SOX', 'PCI', 'PII'],
};

export const COMMANDS = [
	'help',
	'status',
	'incidents',
	'postmortem INC-2022-042',
	'slo',
	'uptime',
	'deploys',
	'savings',
	'fleet',
	'signals',
	'oncall',
	'whoami',
	'clear',
] as const;
