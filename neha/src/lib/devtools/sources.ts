export interface SourceFile {
	path: string;
	lang: 'tsx' | 'ts' | 'vue' | 'html' | 'css' | 'js';
	editable?: boolean;
	note: string;
	code: string;
}

export const SOURCES: SourceFile[] = [
	{
		path: 'playground/index.html',
		lang: 'html',
		editable: true,
		note: 'Live playground. Edit any of the three playground files; the preview re-renders as you type.',
		code: `<!-- A payment method group, the way it ships: a real radiogroup,
     real labels, keyboard-navigable, no div soup. Edit me. -->
<form class="pm" aria-labelledby="pm-title">
  <h2 id="pm-title">How would you like to pay?</h2>

  <div role="radiogroup" aria-labelledby="pm-title" class="pm-list">
    <label class="pm-tile">
      <input type="radio" name="pm" value="ideal" checked />
      <span class="pm-logo" data-brand="ideal">iD</span>
      <span class="pm-name">iDEAL</span>
      <span class="pm-hint">Pay with your Dutch bank</span>
    </label>

    <label class="pm-tile">
      <input type="radio" name="pm" value="card" />
      <span class="pm-logo" data-brand="card">••</span>
      <span class="pm-name">Card</span>
      <span class="pm-hint">Visa, Mastercard, Maestro</span>
    </label>

    <label class="pm-tile">
      <input type="radio" name="pm" value="applepay" />
      <span class="pm-logo" data-brand="apple"></span>
      <span class="pm-name">Apple Pay</span>
      <span class="pm-hint">Face ID, done in a second</span>
    </label>
  </div>

  <button type="submit" class="pay">
    Pay <output id="total">€ 24,30</output>
  </button>
  <p class="status" role="status" aria-live="polite"></p>
</form>`,
	},
	{
		path: 'playground/styles.css',
		lang: 'css',
		editable: true,
		note: 'Tokens first, components second. Try changing --brand or the tile radius.',
		code: `:root {
  --brand: #ff8a6c;
  --ink: #1c1523;
  --muted: #6f6479;
  --line: #e8dfd9;
  --radius: 14px;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

body { margin: 0; padding: 20px; background: #fbf7f4; color: var(--ink); }
h2 { font-size: 18px; margin: 0 0 14px; letter-spacing: -0.01em; }

.pm-list { display: grid; gap: 10px; }

.pm-tile {
  display: grid;
  grid-template-columns: 22px 40px 1fr;
  grid-template-areas: "radio logo name" "radio logo hint";
  column-gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  background: #fff;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.pm-tile:hover { border-color: color-mix(in srgb, var(--brand) 60%, var(--line)); }
.pm-tile:has(:checked) {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
}
.pm-tile:has(:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; }
.pm-tile input { grid-area: radio; accent-color: var(--brand); margin: 0; }

.pm-logo {
  grid-area: logo; display: grid; place-items: center;
  width: 40px; height: 28px; border-radius: 6px;
  font: 700 12px/1 ui-monospace, monospace; color: #fff; background: #333;
}
.pm-logo[data-brand="ideal"] { background: #cc0066; }
.pm-logo[data-brand="card"]  { background: #1a1f71; }
.pm-logo[data-brand="apple"] { background: #000; }

.pm-name { grid-area: name; font-weight: 600; }
.pm-hint { grid-area: hint; font-size: 12.5px; color: var(--muted); }

.pay {
  margin-top: 14px; width: 100%; padding: 14px 18px;
  border: 0; border-radius: 999px; font: 600 15px/1 inherit; color: #fff;
  background: var(--brand); cursor: pointer;
  box-shadow: 0 10px 24px -12px var(--brand);
}
.pay:active { transform: translateY(1px); }
.pay[aria-busy="true"] { opacity: .7; cursor: progress; }
.status { min-height: 1.2em; margin: 10px 0 0; font-size: 13px; color: var(--muted); }`,
	},
	{
		path: 'playground/app.js',
		lang: 'js',
		editable: true,
		note: 'Vanilla, on purpose: progressive enhancement over a form that already works without JS.',
		code: `const form = document.querySelector('.pm');
const status = form.querySelector('.status');
const pay = form.querySelector('.pay');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const method = new FormData(form).get('pm');
  pay.setAttribute('aria-busy', 'true');
  status.textContent = 'Contacting ' + method + '…';

  // Simulated PSP round-trip. In production this is an Adyen /payments call
  // with the result reconciled against the order total before confirmation.
  await new Promise(r => setTimeout(r, 700));

  pay.removeAttribute('aria-busy');
  status.textContent = 'Authorised via ' + method + ' ✓';
});`,
	},
	{
		path: 'src/checkout/PaymentMethodList.tsx',
		lang: 'tsx',
		note: 'Device-gated wallets: users never see a wallet they cannot use.',
		code: `import { useMemo } from 'react';
import { usePaymentMethods } from './usePaymentMethods';
import { useDeviceCapabilities } from '@platform/device';
import { PaymentMethodTile } from '@design-system/payments';
import type { Market, PaymentMethodId } from './types';

interface Props {
  market: Market;
  selected: PaymentMethodId | null;
  onSelect(id: PaymentMethodId): void;
}

export function PaymentMethodList({ market, selected, onSelect }: Props) {
  const { data, status } = usePaymentMethods(market);
  const caps = useDeviceCapabilities(); // applePay, googlePay via isReadyToPay

  const visible = useMemo(
    () =>
      (data ?? []).filter((m) => {
        if (m.id === 'applepay') return caps.applePay;
        if (m.id === 'googlepay') return caps.googlePay;
        return true;
      }),
    [data, caps],
  );

  if (status === 'loading') return <PaymentMethodList.Skeleton />;

  return (
    <fieldset className="pm-list" aria-describedby="pm-help">
      <legend className="sr-only">Payment method</legend>
      {visible.map((m) => (
        <PaymentMethodTile
          key={m.id}
          method={m}
          checked={m.id === selected}
          onChange={() => onSelect(m.id)}
        />
      ))}
      <p id="pm-help" className="sr-only">
        Methods shown depend on your country and device.
      </p>
    </fieldset>
  );
}`,
	},
	{
		path: 'src/checkout/useConversionReview.ts',
		lang: 'ts',
		note: 'The weekly review: success rate by market × method × device, drops become tickets.',
		code: `export interface ConversionRow {
  market: string;
  method: string;
  device: 'desktop' | 'ios' | 'android';
  attempts: number;
  authorised: number;
}

export function successRate(r: ConversionRow): number {
  return r.attempts === 0 ? 0 : r.authorised / r.attempts;
}

/** Flags rows whose rate dropped more than \`threshold\` week-over-week. */
export function findDrops(
  thisWeek: ConversionRow[],
  lastWeek: ConversionRow[],
  threshold = 0.004, // 0.4 pp is real money at checkout volume
) {
  const key = (r: ConversionRow) => \`\${r.market}:\${r.method}:\${r.device}\`;
  const prev = new Map(lastWeek.map((r) => [key(r), successRate(r)]));

  return thisWeek
    .map((r) => ({ row: r, delta: successRate(r) - (prev.get(key(r)) ?? successRate(r)) }))
    .filter(({ delta }) => delta < -threshold)
    .sort((a, b) => a.delta - b.delta);
}`,
	},
	{
		path: 'src/monitoring/paymentErrors.ts',
		lang: 'ts',
		note: 'The taxonomy that maps frontend failures to DataDog monitors — and matches the iOS mapping.',
		code: `/** Shared with iOS so both platforms alert on the same names. */
export const PAYMENT_ERROR = {
  'applepay.session_race':     { severity: 'P2', monitor: 'applepay-session-failures' },
  'applepay.amount_mismatch':  { severity: 'P1', monitor: 'wallet-amount-mismatch' },
  'googlepay.not_ready':       { severity: 'P4', monitor: null },
  'card.3ds_challenge_failed': { severity: 'P3', monitor: 'threeds-challenge-failures' },
  'ideal.status_timeout':      { severity: 'P3', monitor: 'bank-redirect-timeouts' },
  'paypal.popup_closed':       { severity: 'info', monitor: null }, // an abandon, not an error
  'voucher.split_declined':    { severity: 'P3', monitor: 'voucher-split-declines' },
} as const;

export type PaymentErrorCode = keyof typeof PAYMENT_ERROR;

export function logPaymentError(code: PaymentErrorCode, ctx: Record<string, unknown>) {
  const { severity, monitor } = PAYMENT_ERROR[code];
  datadogLogs.logger.error('payment.failed', {
    code: \`payments.web.\${code}\`,
    severity,
    monitor,
    ...ctx,
  });
}`,
	},
	{
		path: 'src/invoicing/InvoiceTable.vue',
		lang: 'vue',
		note: 'Partner-facing invoicing in a Vue 3 micro-frontend on the shared component library.',
		code: `<script setup lang="ts">
import { computed, ref } from 'vue';
import { DsTable, DsSearch, DsButton } from '@design-system/vue';
import { useInvoices } from './useInvoices';

const query = ref('');
const { invoices, exportCsv, preview } = useInvoices();

const rows = computed(() =>
  invoices.value.filter((i) =>
    i.number.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
</script>

<template>
  <section class="invoices">
    <header class="invoices__bar">
      <DsSearch v-model="query" label="Search invoices" />
      <DsButton variant="secondary" @click="exportCsv(rows)">
        Export {{ rows.length }} as CSV
      </DsButton>
    </header>

    <DsTable :rows="rows" :columns="['number', 'period', 'amount', 'status']">
      <template #cell-number="{ row }">
        <button class="link" @click="preview(row)">{{ row.number }}</button>
      </template>
    </DsTable>
  </section>
</template>`,
	},
];

export const PLAYGROUND_FILES = SOURCES.filter((f) => f.editable).map((f) => f.path);

/** Tiny tokenizer for read-only highlighting. Not a parser; good enough for a résumé. */
export function highlight(code: string, lang: SourceFile['lang']): string {
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	if (lang === 'css') {
		return esc(code)
			.replace(/(\/\*[\s\S]*?\*\/)/g, '<i class="c">$1</i>')
			.replace(/(--[a-z0-9-]+)/g, '<b class="v">$1</b>')
			.replace(/([.#:][a-zA-Z_-][\w-]*(?:\([^)]*\))?)(?=[^{;]*\{)/g, '<b class="s">$1</b>')
			.replace(/\b([a-z-]+)(?=\s*:)/g, '<b class="p">$1</b>')
			.replace(/(#[0-9a-fA-F]{3,8}\b)/g, '<b class="n">$1</b>');
	}
	let out = esc(code);
	out = out.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/|&lt;!--[\s\S]*?--&gt;)/gm, '<i class="c">$1</i>');
	out = out.replace(/(&#39;|'|"|`)((?:\\.|(?!\1)[^\\])*)\1/g, '<b class="str">$1$2$1</b>');
	out = out.replace(
		/\b(import|from|export|const|let|var|function|return|if|else|await|async|new|type|interface|as|default|null|true|false|typeof|keyof|extends|implements|for|of|in|class)\b/g,
		'<b class="k">$1</b>',
	);
	out = out.replace(/(&lt;\/?)([A-Za-z][\w.-]*)/g, '$1<b class="t">$2</b>');
	out = out.replace(/\s([a-zA-Z-:@#]+)(=)/g, ' <b class="a">$1</b>$2');
	out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<b class="n">$1</b>');
	return out;
}
