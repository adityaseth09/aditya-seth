/**
 * Data for the /sre view: the résumé reframed as an observability platform.
 * Every incident below is drawn from the CV (Aditya-Kumar-Seth-CV.pdf):
 * the B.SQL turnaround after the ~70,000-order outage, the Datadog
 * adoption, the FinOps cuts, the on-call redesign, the Bangalore expansion,
 * and the earlier career — framed the SRE way: the alert, the triage,
 * the resolution, and the business outcome as the postmortem's "what we
 * learned".
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
		title: 'B.SQL outage: ~70,000 orders lost, platform failing weekly',
		service: 'booking.com/b.sql',
		opened: '2022',
		ttr: '6-week freeze → sustained turnaround',
		impact:
			'A 2022 outage lost ~70,000 orders while the database platform failed several times a week — B.SQL was burning availability budget as a top offender.',
		detected:
			'Availability-budget dashboards and the MySQL Availability Reporter: B.SQL sat at the top of the availability-budget-loss list per team.',
		resolution:
			'Negotiated a 6-week feature freeze with senior management, then steadily improved the team\u2019s processes. Introduced percentage-based canary deployments for database changes — a first for the team — plus risk-based test coverage, with a standing rule that every pull request must improve reliability or test coverage.',
		outcome:
			'B.SQL taken off the top-offender list for availability budget loss (sustained since); on-call pages cut to roughly once a month.',
		tags: ['Incident Management', 'Canary Deploys', 'Availability Budget'],
	},
	{
		id: 'INC-2022-077',
		sev: 'SEV2',
		title: 'Observability gap: VividCortex sunsetting, AWS databases blind',
		service: 'booking.com/observability',
		opened: '2022',
		ttr: 'rolled out · VividCortex decommissioned',
		impact:
			'The fleet\u2019s monitoring tooling was being sunset with no replacement, and AWS-hosted databases had no coverage.',
		detected:
			'Vendor roadmap review plus a monitoring-coverage audit across on-prem and AWS MySQL.',
		resolution:
			'Owned Datadog adoption end to end — evaluation, POC, vendor selection, Legal and Procurement — negotiating the licence to ~50% of the initial quote, below the cost of VividCortex. Led the full migration off VividCortex (now decommissioned), extended monitoring to AWS-hosted databases, and brought the Datadog MCP into Fabric so every engineer can query monitoring data through AI tooling. Ran 3+ workshops, including Observability Day for 30+ attendees.',
		outcome:
			'One observability platform company-wide, at half the quoted price; AI-assisted monitoring queries available to every engineer.',
		tags: ['Datadog', 'Vendor Negotiation', 'AI Tooling', 'Workshops'],
	},
	{
		id: 'INC-2022-100',
		sev: 'SEV2',
		title: 'MySQL infrastructure spend burning $40M+/yr',
		service: 'booking.com/dml-finops',
		opened: '2022',
		ttr: 'ongoing · 65%+ reduction',
		impact:
			'Company-wide cloud and tech costs for the DML department needed a step change across AWS and on-prem MySQL.',
		detected: 'Cost-visibility work across the department\u2019s AWS and on-prem estates.',
		resolution:
			'Lead company-wide cloud and tech cost optimisation for the DML department; supervised the migration of thousands of servers to AWS; own a multi-million-dollar vendor budget.',
		outcome: 'MySQL infrastructure costs cut by more than USD 40M per year — a 65%+ reduction.',
		tags: ['FinOps', 'AWS Migration', 'Vendor Budget'],
	},
	{
		id: 'INC-2023-011',
		sev: 'SEV3',
		title: 'Unhealthy on-call: pager fatigue across the fleet',
		service: 'booking.com/oncall',
		opened: '2023',
		ttr: 'sustained · ~1 page/month',
		impact:
			'Engineers were paged for routine L1 work; onboarding was slow and runbooks were stale.',
		detected: 'Page-frequency review and a failure-mode audit of the runbooks.',
		resolution:
			'Redesigned on-call so the outsourced Pythian ops team handles routine L1 work; runbooks now cover ~95% of known failure modes and are updated after every new repeating or big failure; overhauled onboarding for Booking and Pythian engineers with recorded training sessions and shadowing.',
		outcome:
			'On-call pages cut to roughly once a month; onboarding time significantly reduced.',
		tags: ['On-Call Design', 'Runbooks', 'Pythian'],
	},
	{
		id: 'INC-2024-021',
		sev: 'SEV2',
		title: 'Bangalore expansion: three teams, five months',
		service: 'booking.com/org-scaling',
		opened: '2024',
		ttr: '3 teams in <5 months',
		impact:
			'The department needed new teams in Bangalore with no local pipeline, while company policy capped spans at 6–8 and required a team split.',
		detected: 'Headcount plan vs delivery forecast — the gap showed up as schedule burn.',
		resolution:
			'Drove the Bangalore hiring initiative end to end: interviewed 100+ candidates for EM, PM and SRE roles across 2 hiring sprints. Led up to 13 direct reports across Amsterdam, Manchester, Cambridge, Madrid, Croatia and Switzerland; took over Data Solutions (6–7 engineers) during a leadership gap while continuing to lead Discovery.',
		outcome:
			'3 teams set up in under 5 months; 5 promotions driven with a 100% success rate; EM coaching across ADS, DML, ABU and FinTech.',
		tags: ['Hiring', 'Distributed Leadership', 'Promotions'],
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
			'Founded the Dynamic Pricing Service and led it from proof of concept to a critical Java/Kotlin system on Kubernetes and AWS; led the Time Predictions Squad for time-estimation and real-time order tracking.',
		outcome:
			'1M+ req/min at ~15ms average latency; pricing and delivery efficiency up to +35%; restaurant availability to nearby customers up 55%.',
		tags: ['Kubernetes', 'Java', 'Latency', 'Real-Time'],
	},
	{
		id: 'INC-2015-001',
		sev: 'SEV3',
		title: 'Order processing for national chains',
		service: 'deliveryhero/order-flow',
		opened: 'May 2015',
		ttr: 'shipped · efficiency +50%',
		impact:
			'Major restaurant chains — McDonald\u2019s, Domino\u2019s — needed integrations that would not fall over at national scale.',
		detected: 'Order-flow monitoring on third-party API error rates.',
		resolution:
			'Built the integrations with the restaurant chains, and geolocation services for real-time customer location tracking.',
		outcome: 'Order processing efficiency +50%; service coverage +30%; delivery accuracy +40%.',
		tags: ['Integrations', 'Geolocation', 'Scale'],
	},
	{
		id: 'INC-2008-001',
		sev: 'SEV3',
		title: 'naukri.com LAMP stack speed',
		service: 'infoedge/naukri',
		opened: 'Feb 2008',
		ttr: 'shipped · speed +35%',
		impact: 'India\u2019s high-traffic recruitment platform was losing users to load time.',
		detected: 'First real production monitors — this is where the on-call habit started.',
		resolution: 'Optimised naukri.com on the LAMP stack.',
		outcome: 'Site speed improved by 35%.',
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
	{ version: 'v2022.02', service: 'booking.com', channel: 'SRE Engineering Manager', start: 'Feb 2022', end: 'Present', region: 'Amsterdam', note: 'B.SQL turnaround · Datadog rollout · −$40M/yr (65%+)', current: true },
	{ version: 'v2019.08', service: 'deliveryhero/pricing', channel: 'Engineering Manager', start: 'Aug 2019', end: 'Dec 2021', region: 'Berlin', note: 'canary promoted: 1M+ req/min at ~15ms' },
	{ version: 'v2015.05', service: 'deliveryhero/orders', channel: 'Senior Software Engineer', start: 'May 2015', end: 'Aug 2019', region: 'Berlin', note: 'McDonald\u2019s & Domino\u2019s integrations · geolocation' },
	{ version: 'v2014.12', service: 'spaceways/backend', channel: 'Senior Backend Developer', start: 'Dec 2014', end: 'Apr 2015', region: 'Berlin', note: 'PHP (Phalcon) · Docker · Vagrant' },
	{ version: 'v2014.04', service: 'makemytrip/platform', channel: 'Manager, Technology', start: 'Apr 2014', end: 'Nov 2014', region: 'Gurgaon', note: 'CDN, deployment pipelines, live monitoring · +23% engagement' },
	{ version: 'v2012.03', service: 'fabfurnish/platform', channel: 'Technical Architect / EM', start: 'Mar 2012', end: 'Apr 2014', region: 'Gurgaon', note: 'MySQL + Solr: +30% efficiency · mobile traffic +40%' },
	{ version: 'v2010.10', service: 'belzubar/apps', channel: 'Sr. Computer Scientist', start: '2010', end: '2012', region: 'New Delhi', note: 'AWS management, architecture, database optimisation' },
	{ version: 'v2010.02', service: 'kaango/platform', channel: 'Senior Software Developer', start: '2010', end: '2010', region: 'US (remote)', note: 'two major platform features with the US team' },
	{ version: 'v2008.02', service: 'infoedge/naukri', channel: 'Senior Software Engineer', start: '2008', end: '2010', region: 'Noida', note: 'LAMP at scale · site speed +35%' },
	{ version: 'v2006.08', service: 'oracle/flexcube', channel: 'Associate Consultant', start: '2006', end: '2008', region: 'Bengaluru', note: 'initial commit: Flexcube core banking · PL/SQL' },
];

export interface SloRow {
	name: string;
	target: string;
	achieved: string;
	budget: string;
}

export const SLOS: SloRow[] = [
	{ name: 'availability', target: 'leave the top-offender list', achieved: 'off it — sustained since', budget: 'availability budget recovered' },
	{ name: 'on-call health', target: 'healthy rotation', achieved: '~1 page / month', budget: 'Pythian handles L1' },
	{ name: 'runbooks', target: 'every failure mode', achieved: '~95% coverage', budget: 'updated after every big failure' },
	{ name: 'cost', target: 'cut MySQL infra spend', achieved: '−$40M+/yr (65%+)', budget: 'Datadog licence ~50% of quote' },
	{ name: 'compliance', target: 'SOX · PCI · PII', achieved: '100%', budget: 'no exceptions' },
];

export interface Signal {
	id: string;
	label: string;
	unit: string;
	/** current value readout */
	value: string;
	/** sparkline series params: base, amplitude (0–100 scale) */
	base: number;
	amp: number;
}

/** The four golden signals, populated with career-scale numbers. */
export const SIGNALS: Signal[] = [
	{ id: 'latency', label: 'latency p99', unit: 'ms', value: '~15 ms', base: 15, amp: 3 },
	{ id: 'traffic', label: 'traffic', unit: 'req/min', value: '1M+', base: 100, amp: 14 },
	{ id: 'errors', label: 'error rate (sim)', unit: '%', value: '~0 · pages 1/mo', base: 50, amp: 10 },
	{ id: 'saturation', label: 'fleet saturation', unit: '%', value: '20k+ servers', base: 62, amp: 8 },
];

export const ONCALL = {
	primary: 'Aditya · ADS escalation rotation',
	escalation: 'ADS-level · Manchester DB shifts · DML on-call (setting up)',
	runbooks: '~95% of failure modes',
	pages: '~1 / month',
	compliance: ['SOX', 'PCI', 'PII'],
};

export const OBSERVABILITY_STACK = [
	'Datadog (incl. the MCP, wired into Fabric for AI-assisted queries)',
	'Grafana',
	'AWS Performance Insights',
	'CloudWatch',
	'SLIs and SLOs (MySQL Availability Reporter)',
	'Canary deployments for database changes',
	'Runbooks · incident response · on-call design',
];

export interface Talk {
	event: string;
	when: string;
	title: string;
}

export const TALKS: Talk[] = [
	{ event: 'Booking.com Tech Summit 2026', when: '24 Nov 2026 · upcoming', title: 'Faster, Cheaper MySQL: Sizing the Right Resources with BC2' },
	{ event: 'Datadog Live Amsterdam 2026', when: '25 Nov 2026 · upcoming', title: 'From Slow Queries to Clear Answers: MySQL Observability at Booking.com' },
	{ event: 'Percona Live Amsterdam 2026', when: '2026', title: 'Right-Sizing MySQL EC2 with Production Evidence' },
	{ event: 'FinOps X, San Diego 2025', when: '2025', title: 'Chalk talk: value-driven optimisation' },
	{ event: 'Findy Architecture Conference, Tokyo 2025', when: '2025', title: 'Scaling MySQL at Booking.com' },
];

export const HEADLINE = 'SRE Engineering Manager · Observability, Incident Management, Reliability at Scale';

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
	'observability',
	'talks',
	'oncall',
	'whoami',
	'clear',
] as const;
