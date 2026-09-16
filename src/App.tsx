import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowRight, BellRing, Building2, Check, ChevronDown, CircleHelp,
  Clock3, DoorOpen, HeartPulse, Home, KeyRound, LayoutGrid, Leaf, LockKeyhole, Menu,
  MessageSquareText, Plus, Radio, ShieldCheck, SlidersHorizontal, Sparkles, UserRound,
  UsersRound, WandSparkles, X,
} from 'lucide-react';
import { adapter } from './data';
import type { CapabilityGrant, Conflict, Device, GrantRole, Rule, SosEvent, WhyCard, WhyOverride } from './domain/contracts';
import { HomeScene, type Room } from './scene/HomeScene';
import { DeviceIcon } from './components/Icons';
import { Dialog } from './components/Dialog';

type Route = 'home' | 'scenes' | 'access' | 'building';
type Role = 'resident' | 'operator';
type ConnectionState = 'live' | 'reconnecting' | 'stale' | 'offline';
const APARTMENT_ID = 'apt_401';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The home engine could not complete that request.';
}

const ROOM_BY_DEVICE: Record<string, Room> = {
  dev_light_living: 'living', dev_curtain_living: 'living', dev_ac_bedroom: 'bedroom',
  dev_lock_401: 'entry', dev_smoke_401: 'kitchen', dev_occ_401: 'all',
};

const NAV = [
  { id: 'home' as const, label: 'Home', icon: Home },
  { id: 'scenes' as const, label: 'Scenes', icon: WandSparkles },
  { id: 'access' as const, label: 'Access', icon: KeyRound },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function deviceLabel(device: Device) {
  if (device.type === 'light') return `${device.state.brightness}% brightness`;
  if (device.type === 'curtain') return `${device.state.openPercent}% open`;
  if (device.type === 'ac') return `${device.state.temperature}° · ${device.state.on ? 'on' : 'off'}`;
  if (device.type === 'lock') return device.state.locked ? 'Locked' : 'Unlocked';
  if (device.type === 'smoke') return device.state.alarm ? 'Alarm' : `${device.state.ppm} ppm · clear`;
  return device.state.occupied ? 'Home occupied' : 'Away';
}

function deviceName(device: Device) {
  const room = String(device.state.room ?? 'home');
  return `${room[0].toUpperCase()}${room.slice(1)} ${device.type === 'ac' ? 'climate' : device.type}`;
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function StatusChip({ card }: { card: WhyCard }) {
  if (card.status === 'alert') return <span className="status-chip alert"><AlertTriangle /> Needs attention</span>;
  if (card.status === 'proposed') return <span className="status-chip proposed"><CircleHelp /> Your call</span>;
  return <span className="status-chip done"><Check /> Done</span>;
}

function WhyCardView({ card, active, onInspect, onOverride, onProposal, busy }: {
  card: WhyCard; active: boolean; onInspect: () => void; onOverride: (value: WhyOverride) => void;
  onProposal: (decision: 'approve' | 'dismiss') => void; busy: boolean;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const resolvedCopy = card.resolvedOverride === 'not_tonight' ? 'Paused until tomorrow' : card.resolvedOverride === 'never' ? 'Routine turned off' : card.resolvedOverride === 'keep' ? 'Kept as is' : null;
  return <article className={`why-card ${active ? 'active' : ''}`} onClick={onInspect}>
    <div className="why-card-top"><StatusChip card={card} /><time dateTime={card.timestamp}>{formatTime(card.timestamp)}</time></div>
    <h3>{card.action}</h3>
    <p>{card.reason}</p>
    <button className="evidence-toggle" onClick={(e) => { e.stopPropagation(); setEvidenceOpen((v) => !v); }} aria-expanded={evidenceOpen}>
      <Radio /> {card.evidence.length} signals <ChevronDown className={evidenceOpen ? 'rotated' : ''} />
    </button>
    <AnimatePresence initial={false}>
      {evidenceOpen && <motion.ul className="evidence-list" initial={{ opacity: 0, transform: 'translateY(-4px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}>
        {card.evidence.map((item) => <li key={`${item.deviceId}-${item.field}`}><span>{item.field.replace('state.', '')}</span><strong>{String(item.value)}</strong></li>)}
      </motion.ul>}
    </AnimatePresence>
    {resolvedCopy ? <div className="resolved-row"><Check /> {resolvedCopy}</div> : card.status === 'proposed' ? <div className="why-actions proposal-actions" onClick={(e) => e.stopPropagation()}>
      <button disabled={busy} className="primary-small" onClick={() => onProposal('approve')}>Approve</button>
      <button disabled={busy} onClick={() => onProposal('dismiss')}>Dismiss</button>
    </div> : <div className="why-actions" onClick={(e) => e.stopPropagation()}>
      <button disabled={busy} className="primary-small" onClick={() => onOverride('keep')}>Keep</button>
      <button disabled={busy} onClick={() => onOverride('not_tonight')}>Not tonight</button>
      <button disabled={busy} onClick={() => onOverride('never')}>Never</button>
    </div>}
  </article>;
}

function DeviceControls({ device, busy, onCommand }: { device: Device; busy: boolean; onCommand: (device: Device, set: Record<string, unknown>) => void }) {
  if (device.type === 'light') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { on: !Boolean(device.state.on), brightness: Number(device.state.brightness ?? 60) })}>{device.state.on ? 'Turn off' : 'Turn on'}</button></div>;
  if (device.type === 'ac') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { on: !Boolean(device.state.on) })}>{device.state.on ? 'Turn off' : 'Turn on'}</button><button disabled={busy} aria-label="Lower bedroom temperature" onClick={() => onCommand(device, { on: true, temperature: Math.max(16, Number(device.state.temperature ?? 24) - 1) })}>−</button><button disabled={busy} aria-label="Raise bedroom temperature" onClick={() => onCommand(device, { on: true, temperature: Math.min(30, Number(device.state.temperature ?? 24) + 1) })}>+</button></div>;
  if (device.type === 'curtain') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { openPercent: 0 })}>Close</button><button disabled={busy} onClick={() => onCommand(device, { openPercent: 100 })}>Open</button></div>;
  if (device.type === 'lock') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { locked: !Boolean(device.state.locked) })}>{device.state.locked ? 'Unlock' : 'Lock'}</button></div>;
  return <span className="read-only-device">Sensor · read only</span>;
}

function HomeView({ devices, cards, selectedRoom, setSelectedRoom, onOverride, onProposal, overrideBusy, onCommand, commandBusy, onOpenScenes }: {
  devices: Device[]; cards: WhyCard[]; selectedRoom: Room; setSelectedRoom: (room: Room) => void;
  onOverride: (id: string, value: WhyOverride) => void; overrideBusy: string | null;
  onProposal: (id: string, decision: 'approve' | 'dismiss') => void;
  onCommand: (device: Device, set: Record<string, unknown>) => void; commandBusy: string | null; onOpenScenes: () => void;
}) {
  const reduce = Boolean(useReducedMotion());
  return <div className="home-view">
    <section className="home-main">
      <div className="greeting"><div><span className="eyebrow">Tuesday · Apartment 401</span><h1>Good evening, Maria.</h1><p>Your home has settled in. One choice is waiting for you.</p></div><button className="new-scene" onClick={onOpenScenes}><Plus /> New scene</button></div>
      <div className="home-stage">
        <div className="stage-heading"><div><span className="live-dot" /> Live home</div><span>4 rooms · 6 devices</span></div>
        <div className="scene-wrap">
          <HomeScene room={selectedRoom} preview={false} reducedMotion={reduce} devices={devices} />
          <div className="scene-caption"><Leaf /><span>Evening mode</span><strong>3 changes active</strong></div>
        </div>
        <div className="room-tabs" role="tablist" aria-label="Choose room">
          {(['all','living','bedroom','kitchen','entry'] as Room[]).map((room) => <button key={room} role="tab" aria-selected={selectedRoom === room} onClick={() => setSelectedRoom(room)}>{room === 'all' ? 'Whole home' : room}</button>)}
        </div>
      </div>
      <section className="devices-section">
        <div className="section-heading"><div><h2>Home state</h2></div><button className="text-button"><SlidersHorizontal /> All devices</button></div>
        <div className="device-grid">
          {devices.map((device) => <article className="device-item" key={device.id}>
            <button className="device-summary" onClick={() => setSelectedRoom(ROOM_BY_DEVICE[device.id] ?? 'all')}><span className={`device-icon ${device.type}`}><DeviceIcon type={device.type} /></span><span><strong>{deviceName(device)}</strong><small>{deviceLabel(device)}</small></span><span className="device-state-dot" /></button>
            <DeviceControls device={device} busy={commandBusy === device.id} onCommand={onCommand} />
          </article>)}
        </div>
      </section>
    </section>
    <aside className="activity-panel">
      <div className="activity-heading"><div><span className="eyebrow">Why feed</span><h2>What home noticed</h2></div><span className="count-badge">{cards.filter((c) => !c.resolvedOverride).length} new</span></div>
      <p className="activity-intro">Every action comes with its reason. Correct one and Concord learns the boundary.</p>
      <div className="timeline">{cards.map((card) => <WhyCardView key={card.id} card={card} active={card.evidence.some((e) => ROOM_BY_DEVICE[e.deviceId] === selectedRoom)} onInspect={() => setSelectedRoom(ROOM_BY_DEVICE[card.evidence[0]?.deviceId] ?? 'all')} onOverride={(value) => onOverride(card.id, value)} onProposal={(decision) => onProposal(card.id, decision)} busy={overrideBusy === card.id} />)}</div>
    </aside>
  </div>;
}

function conditionCopy(rule: Rule) {
  if (!rule.conditions.length) return 'No extra conditions';
  return rule.conditions.map((condition) => `${condition.field} ${condition.op} ${String(condition.value)}`).join(' · ');
}

function actionCopy(rule: Rule, devices: Device[]) {
  return rule.actions.map((action) => {
    const target = action.deviceId === 'all' ? `all ${action.deviceType} devices` : devices.find((device) => device.id === action.deviceId) ? deviceName(devices.find((device) => device.id === action.deviceId)!) : action.deviceId;
    const values = Object.entries(action.set).map(([field, value]) => `${field} ${String(value)}`).join(', ');
    return `${target}: ${values}`;
  }).join(' · ');
}

function RuleReceipt({ rule, devices, conflicts, onChange }: { rule: Rule; devices: Device[]; conflicts: Conflict[]; onChange: (rule: Rule) => void }) {
  function updateAction(index: number, action: Rule['actions'][number]) {
    onChange({ ...rule, actions: rule.actions.map((current, actionIndex) => actionIndex === index ? action : current) });
  }
  return <section className="rule-receipt">
    <div className="receipt-title"><span className="receipt-icon"><Sparkles /></span><div><span className="eyebrow">Concord understood</span><h2>{rule.name}</h2></div><span className="draft-pill">Draft</span></div>
    <div className="rule-line"><span>When</span>{rule.trigger.kind === 'time' ? <label><span className="sr-only">Trigger time</span><input type="time" value={rule.trigger.at ?? ''} onChange={(e) => onChange({ ...rule, trigger: { ...rule.trigger, at: e.target.value } })} /></label> : <strong>{rule.trigger.eventType ?? 'Unspecified event'}</strong>}</div>
    <div className="rule-line"><span>Only if</span><strong>{conditionCopy(rule)}</strong></div>
    <div className="rule-actions"><span>Then</span><div>{rule.actions.map((action, index) => {
      const compatible = devices.filter((device) => device.type === action.deviceType);
      return <fieldset className="action-editor" key={`${action.deviceType}-${index}`}><legend>{action.deviceType} action {index + 1}</legend>
        <label>Resolved target<select aria-label={`Action ${index + 1} target`} value={action.deviceId} onChange={(event) => updateAction(index, { ...action, deviceId: event.target.value })}>
          <option value="all">All {action.deviceType} devices · room not specified</option>
          {action.deviceId !== 'all' && !compatible.some((device) => device.id === action.deviceId) && <option value={action.deviceId}>{action.deviceId} · unavailable target, choose a real device</option>}
          {compatible.map((device) => <option key={device.id} value={device.id}>{deviceName(device)} · {device.id}</option>)}
        </select></label>
        <div className="action-settings">{Object.entries(action.set).map(([field, value]) => <label key={field}>{field}
          {typeof value === 'boolean' ? <select aria-label={`Action ${index + 1} ${field}`} value={String(value)} onChange={(event) => updateAction(index, { ...action, set: { ...action.set, [field]: event.target.value === 'true' } })}><option value="true">On / true</option><option value="false">Off / false</option></select> : <input aria-label={`Action ${index + 1} ${field}`} type={typeof value === 'number' ? 'number' : 'text'} value={String(value)} min={field === 'temperature' ? 16 : 0} max={field === 'temperature' ? 30 : 100} onChange={(event) => updateAction(index, { ...action, set: { ...action.set, [field]: typeof value === 'number' ? Number(event.target.value) : event.target.value } })} />}
        </label>)}</div>
      </fieldset>;
    })}</div></div>
    {conflicts.length > 0 && <p className="receipt-warning"><AlertTriangle /> The engine found {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}. Edit the target or action, then confirm to check again.</p>}
    <p className="receipt-note"><CircleHelp /> This is the engine’s exact resolution. Check the target, room and values before saving.</p>
  </section>;
}

function ScenesView({ devices, onConflict, onSaved, onWriteError }: { devices: Device[]; onConflict: (rule: Rule, conflict: Conflict) => void; onSaved: (rule: Rule) => void; onWriteError: (error: unknown) => void }) {
  const [sentence, setSentence] = useState('Make it comfortable when I sleep');
  const [proposal, setProposal] = useState<{ rule: Rule; conflicts: Conflict[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = Boolean(useReducedMotion());
  async function interpret(event: FormEvent) {
    event.preventDefault(); if (!sentence.trim()) return;
    setBusy(true); setProposal(null); setError(null);
    try {
      const result = await adapter.submitSentence({ apartmentId: APARTMENT_ID, sentence });
      setProposal(result); setPreview(true);
    } catch (cause) { setError(errorMessage(cause)); onWriteError(cause); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!proposal) return; setBusy(true); setError(null);
    try {
      const result = await adapter.saveRule({ rule: proposal.rule, resolutions: [], requestId: crypto.randomUUID() });
      if (result.status === 'conflict') {
        setProposal({ rule: result.rule, conflicts: result.conflicts });
        if (result.conflicts[0]) onConflict(result.rule, result.conflicts[0]);
        return;
      }
      onSaved(result.rule); setProposal(null); setPreview(false);
    } catch (cause) { setError(errorMessage(cause)); onWriteError(cause); }
    finally { setBusy(false); }
  }
  const previewRoom = proposal ? (proposal.rule.actions[0]?.deviceId === 'all' ? 'all' : String(devices.find((device) => device.id === proposal.rule.actions[0]?.deviceId)?.state.room ?? 'all')) as Room : 'all';
  const previewAction = proposal ? actionCopy(proposal.rule, devices) : 'No proposed changes.';
  return <div className="scenes-view">
    <section className="scene-compose">
      <h1>Say how you want home to feel.</h1><p>Describe the outcome in your words. Concord will show the exact rule before anything is saved.</p>
      <form className="prompt-box" onSubmit={interpret}><MessageSquareText /><textarea value={sentence} onChange={(e) => setSentence(e.target.value)} aria-label="Describe your scene" /><button disabled={busy || !sentence.trim()}>{busy ? 'Understanding…' : <>Make the rule <ArrowRight /></>}</button></form>
      {error && <p className="inline-error" role="alert"><AlertTriangle /> {error}</p>}
      <div className="prompt-examples"><span>Try</span>{['Lock up when everyone leaves', 'Cool the bedroom before sleep', 'Welcome me home after sunset'].map((text) => <button key={text} onClick={() => setSentence(text)}>{text}</button>)}</div>
      <AnimatePresence mode="wait">{proposal && <motion.div key={proposal.rule.id} initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .01 : .22 }}>
        <RuleReceipt rule={proposal.rule} devices={devices} conflicts={proposal.conflicts} onChange={(rule) => setProposal({ ...proposal, rule })} />
        <div className="receipt-actions"><button className="secondary-button" onClick={() => { setProposal(null); setPreview(false); }}>Discard</button><button className="primary-button" onClick={save} disabled={busy}><Check /> Check and save</button></div>
      </motion.div>}</AnimatePresence>
    </section>
    <aside className="scene-preview"><div className="preview-bar"><span><span className={preview ? 'preview-dot active' : 'preview-dot'} /> {preview ? 'Preview' : 'Live state'}</span><button onClick={() => setPreview((v) => !v)} disabled={!proposal}>{preview ? 'Show live' : 'Preview rule'}</button></div><div className="preview-canvas"><HomeScene room={previewRoom} preview={preview} reducedMotion={reduce} devices={devices} /></div><div className="preview-copy"><strong>{preview ? `Proposed change · ${previewRoom === 'all' ? 'multiple rooms' : previewRoom}` : 'Live home'}</strong><p>{preview ? previewAction : 'No preview changes are applied.'}</p></div></aside>
  </div>;
}

function AccessView({ grants, onCreate, onWriteError }: { grants: CapabilityGrant[]; onCreate: (grant: CapabilityGrant) => void; onWriteError: (error: unknown) => void }) {
  const [role, setRole] = useState<GrantRole>('visitor');
  const [name, setName] = useState('Amaya');
  const [duration, setDuration] = useState('2');
  const [qr, setQr] = useState('');
  const [created, setCreated] = useState<CapabilityGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function createPass(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    const from = new Date(); const until = new Date(from.getTime() + Number(duration) * 3_600_000);
    try {
      const grant = await adapter.createGrant({ grant: { actor: name, apartmentId: APARTMENT_ID, role, scope: ['lock.unlock'], validFrom: from.toISOString(), validUntil: until.toISOString() }, requestId: crypto.randomUUID() });
      setCreated(grant); onCreate(grant);
      setQr('/assets/pass-qr.svg');
    } catch (cause) { setError(errorMessage(cause)); onWriteError(cause); }
    finally { setBusy(false); }
  }
  return <div className="access-view"><section className="access-form"><h1>A key that knows when to leave.</h1><p>Create a pass for the right door and the right window. It expires without a reminder.</p>
    <form onSubmit={createPass} className="form-stack"><fieldset><legend>Who is it for?</legend><div className="segmented">{(['visitor','delivery','cleaner'] as GrantRole[]).map((item) => <button type="button" key={item} className={role === item ? 'selected' : ''} onClick={() => setRole(item)}>{item === 'visitor' ? <UserRound /> : item === 'delivery' ? <DoorOpen /> : <Sparkles />}{item}</button>)}</div></fieldset>
      <label>Name or service<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Access window<select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="1">Next 1 hour</option><option value="2">Next 2 hours</option><option value="4">Next 4 hours</option><option value="24">Today</option></select></label>
      <div className="scope-row"><ShieldCheck /><span><strong>Entry only</strong><small>Unlock apartment 401 · no device control</small></span></div><button className="primary-button full" disabled={busy}>{busy ? 'Creating…' : <>Create pass <ArrowRight /></>}</button>
      {error && <p className="inline-error" role="alert"><AlertTriangle /> {error}</p>}
    </form></section>
    <aside className="pass-preview">{created ? <div className="qr-ticket"><div className="ticket-top"><BrandMark /><span>CONCORD PASS</span></div><img src={qr} alt={`QR code for ${created.actor}'s demo pass`} /><h2>{created.actor}</h2><p>{created.role} · Apartment 401</p><div className="ticket-window"><Clock3 /><span>Valid until<strong>{formatTime(created.validUntil)}</strong></span></div><small>Demo pass · secure redemption pending backend integration</small></div> : <div className="empty-pass"><KeyRound /><h2>Your pass appears here</h2><p>The QR and expiry window will be ready to share.</p></div>}
      {grants.length > 0 && <div className="active-passes">{grants.map((grant) => <div key={grant.id}><span className="avatar">{grant.actor[0]}</span><span><strong>{grant.actor}</strong><small>{grant.role} · until {formatTime(grant.validUntil)}</small></span><span className="active-label">Active</span></div>)}</div>}</aside>
  </div>;
}

const UNITS = [
  { id: '401', state: 'attention', detail: 'Entry lock offline', energy: '+6%' }, { id: '402', state: 'healthy', detail: 'All devices responding', energy: '-4%' },
  { id: '403', state: 'healthy', detail: 'All devices responding', energy: '-1%' }, { id: '404', state: 'anomaly', detail: 'Energy anomaly since 14:20', energy: '+31%' },
  { id: '501', state: 'healthy', detail: 'All devices responding', energy: '-7%' }, { id: '502', state: 'attention', detail: 'Smoke sensor battery', energy: '+2%' },
  { id: '503', state: 'healthy', detail: 'All devices responding', energy: '-3%' }, { id: '504', state: 'healthy', detail: 'All devices responding', energy: '+1%' },
];

function BuildingView({ onHandover }: { onHandover: () => void }) {
  const [filter, setFilter] = useState('all');
  const visible = UNITS.filter((unit) => filter === 'all' || unit.state === filter);
  return <div className="building-view"><div className="building-heading"><div><span className="eyebrow">Aster Tower · Live overview</span><h1>Good evening, front desk.</h1><p>Three units need attention. Resident activity stays private.</p></div><button className="primary-button" onClick={onHandover}><UsersRound /> New handover</button></div>
    <div className="building-stats"><div><Activity /><span><strong>93%</strong>Device health</span></div><div><AlertTriangle /><span><strong>3</strong>Need attention</span></div><div><Leaf /><span><strong>−4.2%</strong>Energy today</span></div></div>
    <section className="unit-section"><div className="section-heading"><div><h2>48 residences</h2></div><div className="filter-row">{['all','attention','anomaly'].map((item) => <button className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div>
      <div className="unit-grid">{visible.map((unit) => <article className={`unit-card ${unit.state}`} key={unit.id}><div><span>Unit</span><strong>{unit.id}</strong></div><span className="unit-state"><i />{unit.state === 'healthy' ? 'Healthy' : unit.state === 'anomaly' ? 'Energy anomaly' : 'Needs attention'}</span><p>{unit.detail}</p><footer><span>Energy</span><strong>{unit.energy}</strong></footer></article>)}</div>
    </section></div>;
}

function App() {
  const [role, setRole] = useState<Role>('resident');
  const [route, setRoute] = useState<Route>('home');
  const [devices, setDevices] = useState<Device[]>([]);
  const [cards, setCards] = useState<WhyCard[]>([]);
  const [grants, setGrants] = useState<CapabilityGrant[]>([]);
  const [room, setRoom] = useState<Room>('all');
  const [loading, setLoading] = useState(true);
  const [overrideBusy, setOverrideBusy] = useState<string | null>(null);
  const [commandBusy, setCommandBusy] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ rule: Rule; conflict: Conflict } | null>(null);
  const [savedRule, setSavedRule] = useState<Rule | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sos, setSos] = useState<SosEvent | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('reconnecting');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const reduce = Boolean(useReducedMotion());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(devices.length === 0); setLoadError(null); setConnection('reconnecting');
    Promise.all([adapter.fetchDevices(APARTMENT_ID, controller.signal), adapter.fetchWhyCards(APARTMENT_ID, controller.signal), adapter.fetchGrants(APARTMENT_ID, controller.signal)])
      .then(([d, c, g]) => { setDevices(d); setCards(c); setGrants(g); setConnection('live'); })
      .catch((cause) => { if (!controller.signal.aborted) { setLoadError(errorMessage(cause)); setConnection('offline'); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retryKey]);

  // Live feed: polls pollFeed on a cursor, upserts WhyCards/SosEvents, refreshes
  // devices after any Event batch. Starts on mount, stops on unmount.
  useEffect(() => {
    let cancelled = false;
    let cursor: string | undefined;
    let timer: number | undefined;
    let firstCall = true;
    let failures = 0;

    async function poll() {
      if (cancelled) return;
      let nextDelay = 2000;
      try {
        const batch = await adapter.pollFeed({ apartmentId: APARTMENT_ID, cursor });
        if (cancelled) return;
        failures = 0; setConnection('live');

        if (batch.reset && !firstCall) {
          const [d, g] = await Promise.all([adapter.fetchDevices(APARTMENT_ID), adapter.fetchGrants(APARTMENT_ID)]);
          if (cancelled) return;
          setDevices(d);
          setGrants(g);
        }
        firstCall = false;
        cursor = batch.cursor;

        const newCards = batch.items.filter((i) => i.kind === 'why_card').map((i) => i.data as WhyCard);
        const newSos = batch.items.filter((i) => i.kind === 'sos_event').map((i) => i.data as SosEvent);
        const hasEvents = batch.items.some((i) => i.kind === 'event');

        if (newCards.length) {
          setCards((all) => {
            const byId = new Map(all.map((c) => [c.id, c]));
            for (const c of newCards) byId.set(c.id, c);
            return Array.from(byId.values());
          });
        }
        if (newSos.length) setSos(newSos[newSos.length - 1]);
        if (hasEvents) {
          const d = await adapter.fetchDevices(APARTMENT_ID);
          if (!cancelled) setDevices(d);
        }

        nextDelay = batch.hasMore ? 0 : 2000;
      } catch {
        failures += 1;
        setConnection(failures > 1 ? 'stale' : 'reconnecting');
        nextDelay = [2000, 4000, 8000, 15000][Math.min(failures - 1, 3)];
      }
      if (!cancelled) timer = window.setTimeout(poll, nextDelay);
    }

    poll();
    const revalidate = () => { if (document.visibilityState === 'visible') { if (timer !== undefined) window.clearTimeout(timer); void poll(); } };
    window.addEventListener('focus', revalidate); document.addEventListener('visibilitychange', revalidate);
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); };
  }, [retryKey]);

  function reportWriteError(cause: unknown) { setWriteError(errorMessage(cause)); setConnection('stale'); }

  async function override(id: string, value: WhyOverride) {
    setOverrideBusy(id);
    try { const updated = await adapter.postWhyOverride({ whyCardId: id, override: value, requestId: crypto.randomUUID() }); setCards((all) => all.map((card) => card.id === id ? updated : card)); setWriteError(null); }
    catch (cause) { reportWriteError(cause); }
    finally { setOverrideBusy(null); }
  }

  async function decideProposal(id: string, decision: 'approve' | 'dismiss') {
    setOverrideBusy(id);
    try {
      const input = { whyCardId: id, requestId: crypto.randomUUID() };
      const updated = decision === 'approve' ? await adapter.approveWhyCard(input) : await adapter.dismissWhyCard(input);
      setCards((all) => all.map((card) => card.id === id ? updated : card));
      if (decision === 'approve') setDevices(await adapter.fetchDevices(APARTMENT_ID));
      setWriteError(null);
    } catch (cause) { reportWriteError(cause); }
    finally { setOverrideBusy(null); }
  }

  async function commandDevice(device: Device, set: Record<string, unknown>) {
    setCommandBusy(device.id);
    try {
      await adapter.commandDevice({ deviceId: device.id, set, requestId: crypto.randomUUID() });
      setDevices(await adapter.fetchDevices(APARTMENT_ID));
      setWriteError(null);
    } catch (cause) { reportWriteError(cause); }
    finally { setCommandBusy(null); }
  }

  function switchRole(next: Role) { setRole(next); setRoute(next === 'operator' ? 'building' : 'home'); setMobileMenu(false); }
  async function triggerSos() { try { const event = await adapter.triggerSos({ apartmentId: APARTMENT_ID, requestId: crypto.randomUUID() }); setSos(event); setWriteError(null); } catch (cause) { reportWriteError(cause); throw cause; } }
  const pageTitle = role === 'operator' ? 'Building' : NAV.find((item) => item.id === route)?.label ?? 'Home';

  if (loading) return <div className="boot-screen"><BrandMark /><span>Connecting to Apartment 401…</span></div>;
  if (loadError && devices.length === 0) return <div className="boot-screen boot-error" role="alert"><BrandMark /><strong>Home engine offline</strong><span>{loadError}</span><button className="primary-button" onClick={() => setRetryKey((value) => value + 1)}>Retry connection</button></div>;
  const connectionCopy: Record<ConnectionState, string> = { live: 'Home engine live', reconnecting: 'Reconnecting…', stale: 'Data may be stale', offline: 'Engine offline' };
  return <div className={`app-shell ${role}`}>
    <header className="mobile-header"><button className="brand-mobile" onClick={() => { setRoute(role === 'operator' ? 'building' : 'home'); }}><BrandMark /><span>Concord</span></button><div><button className="emergency-compact" onClick={() => setSosOpen(true)}><HeartPulse /> Emergency</button><button className="icon-button" onClick={() => setMobileMenu((v) => !v)} aria-label="Open menu">{mobileMenu ? <X /> : <Menu />}</button></div></header>
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <button className="brand" onClick={() => setRoute(role === 'operator' ? 'building' : 'home')}><BrandMark /><span>Concord</span></button>
      <div className="residence-chip"><div className="residence-avatar">{role === 'resident' ? 'M' : <Building2 />}</div><span><strong>{role === 'resident' ? 'Maria’s home' : 'Aster Tower'}</strong><small>{role === 'resident' ? 'Apartment 401' : 'Building operations'}</small></span></div>
      <nav aria-label="Primary navigation">{role === 'resident' ? NAV.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => { setRoute(id); setMobileMenu(false); }}><Icon />{label}</button>) : <button className="active"><LayoutGrid />Building</button>}</nav>
      <div className="sidebar-spacer" />
      <button className="emergency-button" onClick={() => { setSosOpen(true); setMobileMenu(false); }}><HeartPulse /><span><strong>Emergency</strong><small>Get help now</small></span></button>
      <div className="role-switch"><span>Demo view</span><div><button className={role === 'resident' ? 'selected' : ''} onClick={() => switchRole('resident')}>Resident</button><button className={role === 'operator' ? 'selected' : ''} onClick={() => switchRole('operator')}>Operator</button></div></div>
    </aside>
    <main className="app-content" id="main-content"><div className="desktop-topbar"><span>{pageTitle}</span><div><span className={`connection ${connection}`} role="status"><i /> {connectionCopy[connection]}</span><button className="notification-button" aria-label="Notifications"><BellRing /></button><span className="avatar desktop-avatar">M</span></div></div>
      {connection !== 'live' && <div className="connection-banner" role="status"><AlertTriangle /><span>{connectionCopy[connection]}. The last confirmed home state remains visible.</span><button onClick={() => setRetryKey((value) => value + 1)}>Retry now</button></div>}
      <AnimatePresence mode="wait" initial={false}><motion.div key={`${role}-${route}`} className="route-frame" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .01 : .18 }}>
        {route === 'home' && <HomeView devices={devices} cards={cards} selectedRoom={room} setSelectedRoom={setRoom} onOverride={override} onProposal={decideProposal} overrideBusy={overrideBusy} onCommand={commandDevice} commandBusy={commandBusy} onOpenScenes={() => setRoute('scenes')} />}
        {route === 'scenes' && <ScenesView devices={devices} onConflict={(rule, found) => setConflict({ rule, conflict: found })} onSaved={setSavedRule} onWriteError={reportWriteError} />}
        {route === 'access' && <AccessView grants={grants} onCreate={(grant) => setGrants((all) => [grant, ...all])} onWriteError={reportWriteError} />}
        {route === 'building' && <BuildingView onHandover={() => setHandoverOpen(true)} />}
      </motion.div></AnimatePresence>
    </main>
    {role === 'resident' && <nav className="bottom-nav" aria-label="Mobile navigation">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => setRoute(id)}><Icon /><span>{label}</span></button>)}</nav>}

    <ConflictDialog value={conflict} onClose={() => setConflict(null)} />
    <EmergencyDialog open={sosOpen} sos={sos} onClose={() => { setSosOpen(false); setSos(null); }} onTrigger={triggerSos} />
    <HandoverDialog open={handoverOpen} onClose={() => setHandoverOpen(false)} onSaved={(grant) => { setGrants((all) => [grant, ...all]); setHandoverOpen(false); }} />
    <AnimatePresence>{savedRule && <motion.div className="toast" role="status" initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}><span><Check /></span><div><strong>Scene ready</strong><small>{savedRule.name}</small></div><button onClick={() => setSavedRule(null)} aria-label="Dismiss"><X /></button></motion.div>}</AnimatePresence>
    <AnimatePresence>{writeError && <motion.div className="toast error-toast" role="alert" initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}><span><AlertTriangle /></span><div><strong>Engine write failed</strong><small>{writeError}</small></div><button onClick={() => setWriteError(null)} aria-label="Dismiss error"><X /></button></motion.div>}</AnimatePresence>
  </div>;
}

function ConflictDialog({ value, onClose }: { value: { rule: Rule; conflict: Conflict } | null; onClose: () => void }) {
  return <Dialog open={Boolean(value)} title="This scene needs another edit" onClose={onClose} tone="danger">{value && <div className="conflict-content"><div className="safety-lock"><AlertTriangle /><span><strong>Conflict found by the engine</strong><small>No scene was saved</small></span></div><p>{value.conflict.reason}</p><div className="rule-compare"><div><span>Your edited scene</span><strong>{value.rule.name}</strong><small>{actionCopy(value.rule, [])}</small></div><div className="conflict-vs">conflicts with</div><div className="protected"><span>Existing rule</span><strong>{value.conflict.ruleB}</strong><small>The engine kept the existing rule unchanged.</small></div></div><div className="dialog-actions"><button className="primary-button" onClick={onClose}>Return to edit</button></div></div>}</Dialog>;
}

function EmergencyDialog({ open, sos, onClose, onTrigger }: { open: boolean; sos: SosEvent | null; onClose: () => void; onTrigger: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function send() { setBusy(true); try { await onTrigger(); } finally { setBusy(false); } }
  return <Dialog open={open} title={sos ? 'Help request sent' : 'Emergency help'} onClose={onClose} tone="danger"><div className="emergency-content">{sos ? <><div className="sos-confirm"><Check /></div><h3>Building response has been alerted.</h3><p>Request {sos.id.slice(-6)} is active. The demo operator desk is now shown as notified.</p><div className="sos-detail"><span>Status<strong>Active</strong></span><span>Escalated to<strong>Operator desk</strong></span><span>Sent<strong>{formatTime(sos.timestamp)}</strong></span></div></> : <><div className="emergency-symbol"><HeartPulse /></div><h3>Send an urgent help request?</h3><p>This demo alerts the simulated building response desk. It does not contact emergency services.</p><button className="sos-button" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send help request now'}</button></>}<button className="text-button centered" onClick={onClose}>{sos ? 'Close' : 'Cancel'}</button></div></Dialog>;
}

function HandoverDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (grant: CapabilityGrant) => void }) {
  const [name, setName] = useState('Nadia Perera'); const [unit, setUnit] = useState('405'); const [start, setStart] = useState('2026-10-01'); const [end, setEnd] = useState('2027-09-30'); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { const grant = await adapter.createGrant({ grant: { actor: name, apartmentId: `apt_${unit}`, role: 'tenant', scope: ['lock.unlock','ac.control','light.control','curtain.control'], validFrom: new Date(start + 'T00:00:00+05:30').toISOString(), validUntil: new Date(end + 'T23:59:59+05:30').toISOString() }, requestId: crypto.randomUUID() }); onSaved(grant); } finally { setBusy(false); } }
  return <Dialog open={open} title="Prepare unit handover" onClose={onClose}><form className="handover-form" onSubmit={submit}><p>Access begins with the lease and expires automatically at its end.</p><div className="form-two"><label>Unit<select value={unit} onChange={(e) => setUnit(e.target.value)}><option>405</option><option>505</option><option>604</option></select></label><label>Resident type<select><option>Tenant</option><option>Owner</option></select></label></div><label>Resident name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><div className="form-two"><label>Lease begins<input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label><label>Lease ends<input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} required /></label></div><div className="scope-row"><ShieldCheck /><span><strong>Resident controls</strong><small>Entry, climate, lights and curtains · no operator scope</small></span></div><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Activating…' : <>Activate at lease start <ArrowRight /></>}</button></div></form></Dialog>;
}

export default App;
