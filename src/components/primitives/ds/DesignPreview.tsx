import * as React from 'react';
import {
  Card,
  StatusDot,
  Badge,
  Chip,
  Button,
  NavLink,
  Stat,
  SparkLine,
  Console,
  ConsoleLine,
  ConsoleToken,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Kbd,
  PageHeader,
} from './index';

const SWATCHES: Array<{ name: string; hex: string; cls: string }> = [
  { name: 'app',       hex: '#F7F7F8', cls: 'bg-ds-app' },
  { name: 'card',      hex: '#FFFFFF', cls: 'bg-ds-card' },
  { name: 'surface2',  hex: '#FAFAFB', cls: 'bg-ds-surface2' },
  { name: 'console',   hex: '#1F2937', cls: 'bg-ds-console' },
  { name: 'ink',       hex: '#111827', cls: 'bg-ds-ink' },
  { name: 'slate',     hex: '#4B5563', cls: 'bg-ds-slate' },
  { name: 'muted',     hex: '#6B7280', cls: 'bg-ds-muted' },
  { name: 'faint',     hex: '#9CA3AF', cls: 'bg-ds-faint' },
  { name: 'line',      hex: '#E5E7EB', cls: 'bg-ds-line' },
  { name: 'linehi',    hex: '#D1D5DB', cls: 'bg-ds-linehi' },
  { name: 'accent',    hex: '#2563EB', cls: 'bg-ds-accent' },
  { name: 'ok',        hex: '#16A34A', cls: 'bg-ds-ok' },
  { name: 'warn',      hex: '#D97706', cls: 'bg-ds-warn' },
  { name: 'bad',       hex: '#DC2626', cls: 'bg-ds-bad' },
  { name: 'okBg',      hex: '#F0FDF4', cls: 'bg-ds-okBg' },
  { name: 'warnBg',    hex: '#FFF7ED', cls: 'bg-ds-warnBg' },
  { name: 'badBg',     hex: '#FEF2F2', cls: 'bg-ds-badBg' },
];

const SECTION_TITLE = 'text-[18px] font-semibold tracking-tight text-ds-ink mb-4';
const SECTION_WRAP = 'mb-12';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={SECTION_WRAP}>
      <h2 className={SECTION_TITLE}>{title}</h2>
      {children}
    </section>
  );
}

const sparkA = [10, 18, 15, 22, 19, 24, 21, 28, 25, 30, 27, 33, 31];
const sparkB = [40, 32, 35, 28, 30, 22, 26, 18, 20, 16];
const sparkC = [12, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24];

const DesignPreview: React.FC = () => (
  <div className="min-h-screen bg-ds-app text-ds-ink font-ds-sans">
    <PageHeader
      dateLabel="Storybook-lite · Phase 10.1"
      title="Autonnel design system"
      actions={
        <>
          <Button variant="ghost" size="sm">Refresh</Button>
          <Button variant="primary" size="sm">Save</Button>
        </>
      }
    />

    <div className="px-8 pb-16 max-w-[1400px]">
      <Section id="tokens" title="1. Tokens">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {SWATCHES.map((s) => (
            <div key={s.name} className="border border-ds-line rounded-lg overflow-hidden bg-ds-card">
              <div className={`${s.cls} h-14 border-b border-ds-line`} />
              <div className="p-2">
                <div className="text-[12px] font-medium text-ds-ink">{s.name}</div>
                <div className="text-[11px] text-ds-muted font-ds-mono tabular">{s.hex}</div>
              </div>
            </div>
          ))}
        </div>
        <Card title="Typography" subtitle="Inter for prose, JetBrains Mono for numbers">
          <div className="space-y-2">
            <div className="text-[24px] font-semibold tracking-tight">Inter 24/600 — page title</div>
            <div className="text-[14px] font-semibold">Inter 14/600 — card title</div>
            <div className="text-[13px]">Inter 13/400 — body</div>
            <div className="text-[12.5px] text-ds-muted">Inter 12.5/400 muted — meta</div>
            <div className="font-ds-mono tabular text-[26px] font-semibold">248,921</div>
            <div className="font-ds-mono tabular text-[13px]">tail -f · 14:02:41 · rtt=42ms</div>
          </div>
        </Card>
      </Section>

      <Section id="card" title="2. Card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <div className="text-ds-slate text-[13px]">Default card, no header — raw children.</div>
          </Card>
          <Card title="With title" subtitle="Subtitle / meta line">
            <div className="text-ds-slate text-[13px]">Body content sits below the header.</div>
          </Card>
          <Card
            title="With actions"
            subtitle="Last sync 2m ago"
            actions={
              <>
                <Button size="sm" variant="ghost">Refresh</Button>
                <Button size="sm">Manage</Button>
              </>
            }
          >
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Pending" value="42" />
              <Stat label="Paid" value="1,128" />
              <Stat label="Refunded" value="9" />
            </div>
          </Card>
          <Card title="Unpadded" padded={false}>
            <div className="px-6 py-4 border-t border-ds-line text-[13px] text-ds-muted">
              Custom inner sections handle their own spacing.
            </div>
            <div className="px-6 py-4 border-t border-ds-line text-[13px] text-ds-muted">Row 2</div>
          </Card>
        </div>
      </Section>

      <Section id="badge" title="3. Badge">
        <div className="flex flex-wrap gap-3">
          <Badge tone="default">Default</Badge>
          <Badge tone="muted">Muted</Badge>
          <Badge tone="ok"><StatusDot status="ok" /> Connected</Badge>
          <Badge tone="warn"><StatusDot status="warn" /> Renew</Badge>
          <Badge tone="bad"><StatusDot status="bad" /> Failed</Badge>
        </div>
      </Section>

      <Section id="chip" title="4. Chip">
        <div className="flex flex-wrap gap-3">
          <Chip>Default</Chip>
          <Chip tone="ai">AI</Chip>
          <Chip tone="edge">Edge</Chip>
          <Chip tone="local">Local</Chip>
        </div>
      </Section>

      <Section id="button" title="5. Button">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Button size="sm">Small default</Button>
          <Button size="sm" variant="primary">Small primary</Button>
          <Button size="sm" variant="ghost">Small ghost</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button leftIcon={<span aria-hidden="true">+</span>}>Add funnel</Button>
          <Button rightIcon={<span aria-hidden="true">→</span>} variant="primary">Continue</Button>
        </div>
      </Section>

      <Section id="navlink" title="6. NavLink">
        <Card padded={false}>
          <nav className="p-3 flex flex-col gap-1 w-[260px]">
            <NavLink href="#" icon={<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>}>Overview</NavLink>
            <NavLink href="#" icon={<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>} count={12}>Funnels</NavLink>
            <NavLink href="#" active icon={<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>}>Active link</NavLink>
            <NavLink href="#" icon={<svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>} chip={<Chip tone="ai">AI</Chip>}>Optimizer</NavLink>
          </nav>
        </Card>
      </Section>

      <Section id="statusdot" title="7. StatusDot">
        <div className="flex flex-wrap items-center gap-6 text-[13px] text-ds-slate">
          <span className="flex items-center gap-2"><StatusDot status="ok" /> ok</span>
          <span className="flex items-center gap-2"><StatusDot status="warn" /> warn</span>
          <span className="flex items-center gap-2"><StatusDot status="bad" /> bad</span>
          <span className="flex items-center gap-2"><StatusDot status="idle" /> idle</span>
          <span className="flex items-center gap-2"><StatusDot status="ok" blink /> ok · blink</span>
          <span className="flex items-center gap-2"><StatusDot status="warn" blink /> warn · blink</span>
        </div>
      </Section>

      <Section id="stat" title="8. Stat">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card>
            <Stat
              label="Total traffic"
              value="248,921"
              delta={{ value: '11.2%', direction: 'up', tone: 'ok', context: 'vs yesterday' }}
              sparkline={sparkA}
              sparklineColor="#2563EB"
            />
          </Card>
          <Card>
            <Stat
              label="Blended conversion"
              value="3.42"
              unit="%"
              delta={{ value: '0.4pp', direction: 'down', tone: 'bad', context: 'vs 7d avg' }}
              sparkline={sparkB}
              sparklineColor="#DC2626"
            />
          </Card>
          <Card>
            <Stat label="Active funnels" value="12" delta={{ value: '2', direction: 'up', tone: 'muted' }} />
          </Card>
        </div>
      </Section>

      <Section id="sparkline" title="9. SparkLine">
        <div className="flex flex-wrap items-center gap-6">
          <SparkLine points={sparkA} color="#2563EB" />
          <SparkLine points={sparkB} color="#16A34A" />
          <SparkLine points={sparkC} color="#6366F1" />
        </div>
      </Section>

      <Section id="console" title="10. Console">
        <Console title="Agent activity log" subtitle="Live · piped from 3 agents" hint="tail -f" live>
          <ConsoleLine ts="14:02:41">boot · runtime=<ConsoleToken tone="ok">edge/cf</ConsoleToken> region=<ConsoleToken tone="highlight">iad1</ConsoleToken></ConsoleLine>
          <ConsoleLine ts="14:02:43">cron <ConsoleToken tone="muted">postback-retry</ConsoleToken> queued <ConsoleToken tone="highlight">17</ConsoleToken> jobs</ConsoleLine>
          <ConsoleLine ts="14:02:48">postback <ConsoleToken tone="ok">200 OK</ConsoleToken> meta · order_4821</ConsoleLine>
          <ConsoleLine ts="14:02:51">email queue depth=<ConsoleToken tone="highlight">3</ConsoleToken> sent=<ConsoleToken tone="ok">128</ConsoleToken> failed=<ConsoleToken tone="bad">2</ConsoleToken></ConsoleLine>
          <ConsoleLine ts="14:02:55">stripe webhook <ConsoleToken tone="ok">payment_intent.succeeded</ConsoleToken></ConsoleLine>
          <ConsoleLine ts="14:03:02">postback <ConsoleToken tone="bad">408 timeout</ConsoleToken> tiktok · retry in 30s</ConsoleLine>
        </Console>
      </Section>

      <Section id="table" title="11. Table">
        <Card padded={false}>
          <Table>
            <Thead>
              <Tr>
                <Th>Funnel</Th>
                <Th align="right">Traffic</Th>
                <Th align="right">CVR</Th>
                <Th align="right">Revenue</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>Summer hydration kit</Td>
                <Td align="right" mono>48,210</Td>
                <Td align="right" mono>3.81%</Td>
                <Td align="right" mono>$32,140</Td>
                <Td><Badge tone="ok"><StatusDot status="ok" /> Live</Badge></Td>
              </Tr>
              <Tr>
                <Td>Glow serum bundle</Td>
                <Td align="right" mono>21,002</Td>
                <Td align="right" mono>2.94%</Td>
                <Td align="right" mono>$18,902</Td>
                <Td><Badge tone="ok"><StatusDot status="ok" blink /> Syncing</Badge></Td>
              </Tr>
              <Tr>
                <Td>Pet supplement v3</Td>
                <Td align="right" mono>12,344</Td>
                <Td align="right" mono>1.20%</Td>
                <Td align="right" mono>$3,209</Td>
                <Td><Badge tone="warn"><StatusDot status="warn" /> Renew</Badge></Td>
              </Tr>
              <Tr>
                <Td>Black friday teaser</Td>
                <Td align="right" mono>902</Td>
                <Td align="right" mono>0.00%</Td>
                <Td align="right" mono>$0</Td>
                <Td><Badge tone="bad"><StatusDot status="bad" /> Failed</Badge></Td>
              </Tr>
            </Tbody>
          </Table>
        </Card>
      </Section>

      <Section id="kbd" title="12. Kbd">
        <div className="flex items-center gap-3 text-[13px] text-ds-slate">
          <span>Open command palette: <Kbd>⌘K</Kbd></span>
          <span>Save: <Kbd>⌘</Kbd> <Kbd>S</Kbd></span>
          <span>Escape: <Kbd>Esc</Kbd></span>
        </div>
      </Section>

      <Section id="pageheader" title="13. PageHeader">
        <Card padded={false}>
          <PageHeader
            breadcrumbs={[{ label: 'Funnels', href: '#' }, { label: 'Summer hydration kit' }]}
            dateLabel="Wed, Apr 8 2026 · 14:03 UTC"
            title="Summer hydration kit"
            actions={
              <>
                <Button size="sm" variant="ghost">Last 7d</Button>
                <Button size="sm">Refresh</Button>
                <Button size="sm" variant="primary">Edit funnel</Button>
              </>
            }
          />
        </Card>
      </Section>
    </div>
  </div>
);

export default DesignPreview;
