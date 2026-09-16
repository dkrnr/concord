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
const APARTMENT_ID = 'apt_401';

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

function WhyCardView({ card, active, onInspect, onOverride, busy }: {
  card: WhyCard; active: boolean; onInspect: () => void; onOverride: (value: WhyOverride) => void; busy: boolean;
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
    {resolvedCopy ? <div className="resolved-row"><Check /> {resolvedCopy}</div> : <div className="why-actions" onClick={(e) => e.stopPropagation()}>
      <button disabled={busy} className="primary-small" onClick={() => onOverride('keep')}>Keep</button>
      <button disabled={busy} onClick={() => onOverride('not_tonight')}>Not tonight</button>
      <button disabled={busy} onClick={() => onOverride('never')}>Never</button>
    </div>}
  </article>;
}

function HomeView({ devices, cards, selectedRoom, setSelectedRoom, onOverride, overrideBusy, onOpenScenes }: {
  devices: Device[]; cards: WhyCard[]; selectedRoom: Room; setSelectedRoom: (room: Room) => void;
  onOverride: (id: string, value: WhyOverride) => void; overrideBusy: string | null; onOpenScenes: () => void;
}) {
  const reduce = Boolean(useReducedMotion());
  return <div className="home-view">
    <section className="home-main">
      <div className="greeting"><div><span className="eyebrow">Tuesday · Apartment 401</span><h1>Good evening, Maria.</h1><p>Your home has settled in. One choice is waiting for you.</p></div><button className="new-scene" onClick={onOpenScenes}><Plus /> New scene</button></div>
      <div className="home-stage">
        <div className="stage-heading"><div><span className="live-dot" /> Live home</div><span>4 rooms · 6 devices</span></div>
        <div className="scene-wrap">
          <HomeScene room={selectedRoom} preview={false} reducedMotion={reduce} />
          <div className="scene-caption"><Leaf /><span>Evening mode</span><strong>3 changes active</strong></div>
        </div>
        <div className="room-tabs" role="tablist" aria-label="Choose room">
          {(['all','living','bedroom','kitchen','entry'] as Room[]).map((room) => <button key={room} role="tab" aria-selected={selectedRoom === room} onClick={() => setSelectedRoom(room)}>{room === 'all' ? 'Whole home' : room}</button>)}
        </div>
      </div>
      <section className="devices-section">
        <div className="section-heading"><div><h2>Home state</h2></div><button className="text-button"><SlidersHorizontal /> All devices</button></div>
        <div className="device-grid">
          {devices.map((device) => <button className="device-item" key={device.id} onClick={() => setSelectedRoom(ROOM_BY_DEVICE[device.id] ?? 'all')}>
            <span className={`device-icon ${device.type}`}><DeviceIcon type={device.type} /></span><span><strong>{deviceName(device)}</strong><small>{deviceLabel(device)}</small></span><span className="device-state-dot" />
          </button>)}
        </div>
      </section>
    </section>
    <aside className="activity-panel">
      <div className="activity-heading"><div><span className="eyebrow">Why feed</span><h2>What home noticed</h2></div><span className="count-badge">{cards.filter((c) => !c.resolvedOverride).length} new</span></div>
      <p className="activity-intro">Every action comes with its reason. Correct one and Concord learns the boundary.</p>
      <div className="timeline">{cards.map((card) => <WhyCardView key={card.id} card={card} active={card.evidence.some((e) => ROOM_BY_DEVICE[e.deviceId] === selectedRoom)} onInspect={() => setSelectedRoom(ROOM_BY_DEVICE[card.evidence[0]?.deviceId] ?? 'all')} onOverride={(value) => onOverride(card.id, value)} busy={overrideBusy === card.id} />)}</div>
    </aside>
  </div>;
}

function RuleReceipt({ rule, onChangeTime }: { rule: Rule; onChangeTime: (value: string) => void }) {
  const actionText = rule.actions.map((action) => action.deviceType === 'ac' ? `Set bedroom climate to ${action.set.temperature}°` : action.deviceType === 'curtain' ? 'Close the curtains' : 'Lock the entry').join(' · ');
  return <section className="rule-receipt">
    <div className="receipt-title"><span className="receipt-icon"><Sparkles /></span><div><span className="eyebrow">Concord understood</span><h2>{rule.name}</h2></div><span className="draft-pill">Draft</span></div>
    <div className="rule-line"><span>When</span>{rule.trigger.kind === 'time' ? <label><span className="sr-only">Trigger time</span><input type="time" value={rule.trigger.at} onChange={(e) => onChangeTime(e.target.value)} /></label> : <strong>Everyone leaves home</strong>}</div>
    <div className="rule-line"><span>Only if</span><strong>{rule.conditions.some((c) => c.field.includes('smoke')) ? 'No smoke alarm is active' : 'Someone is home'}</strong></div>
    <div className="rule-line"><span>Then</span><strong>{actionText}</strong></div>
    <p className="receipt-note"><CircleHelp /> Suggested details stay editable until you confirm.</p>
  </section>;
}

function ScenesView({ onConflict, onSaved }: { onConflict: (rule: Rule, conflict: Conflict) => void; onSaved: (rule: Rule) => void }) {
  const [sentence, setSentence] = useState('Make it comfortable when I sleep');
  const [proposal, setProposal] = useState<{ rule: Rule; conflicts: Conflict[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const reduce = Boolean(useReducedMotion());
  async function interpret(event: FormEvent) {
    event.preventDefault(); if (!sentence.trim()) return;
    setBusy(true); setProposal(null);
    try {
      const result = await adapter.submitSentence({ apartmentId: APARTMENT_ID, sentence });
      setProposal(result); setPreview(true);
      if (result.conflicts[0]) onConflict(result.rule, result.conflicts[0]);
    } finally { setBusy(false); }
  }
  async function save() {
    if (!proposal) return; setBusy(true);
    try { const result = await adapter.saveRule({ rule: proposal.rule, resolutions: [], requestId: crypto.randomUUID() }); onSaved(result.rule); setProposal(null); setPreview(false); }
    finally { setBusy(false); }
  }
  return <div className="scenes-view">
    <section className="scene-compose">
      <h1>Say how you want home to feel.</h1><p>Describe the outcome in your words. Concord will show the exact rule before anything is saved.</p>
      <form className="prompt-box" onSubmit={interpret}><MessageSquareText /><textarea value={sentence} onChange={(e) => setSentence(e.target.value)} aria-label="Describe your scene" /><button disabled={busy || !sentence.trim()}>{busy ? 'Understanding…' : <>Make the rule <ArrowRight /></>}</button></form>
      <div className="prompt-examples"><span>Try</span>{['Lock up when everyone leaves', 'Cool the bedroom before sleep', 'Welcome me home after sunset'].map((text) => <button key={text} onClick={() => setSentence(text)}>{text}</button>)}</div>
      <AnimatePresence mode="wait">{proposal && <motion.div key={proposal.rule.id} initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .01 : .22 }}>
        <RuleReceipt rule={proposal.rule} onChangeTime={(value) => setProposal({ ...proposal, rule: { ...proposal.rule, trigger: { ...proposal.rule.trigger, at: value } } })} />
        {!proposal.conflicts.length && <div className="receipt-actions"><button className="secondary-button" onClick={() => { setProposal(null); setPreview(false); }}>Discard</button><button className="primary-button" onClick={save} disabled={busy}><Check /> Confirm scene</button></div>}
      </motion.div>}</AnimatePresence>
    </section>
    <aside className="scene-preview"><div className="preview-bar"><span><span className={preview ? 'preview-dot active' : 'preview-dot'} /> {preview ? 'Preview' : 'Live state'}</span><button onClick={() => setPreview((v) => !v)} disabled={!proposal}>{preview ? 'Show live' : 'Preview rule'}</button></div><div className="preview-canvas"><HomeScene room="bedroom" preview={preview} reducedMotion={reduce} /></div><div className="preview-copy"><strong>{preview ? 'If this scene ran now' : 'Bedroom now'}</strong><p>{preview ? 'Climate settles to 23° and evening light softens.' : 'Climate is holding at 24°. No preview changes are applied.'}</p></div></aside>
  </div>;
}

function AccessView({ grants, onCreate }: { grants: CapabilityGrant[]; onCreate: (grant: CapabilityGrant) => void }) {
  const [role, setRole] = useState<GrantRole>('visitor');
  const [name, setName] = useState('Amaya');
  const [duration, setDuration] = useState('2');
  const [qr, setQr] = useState('');
  const [created, setCreated] = useState<CapabilityGrant | null>(null);
  const [busy, setBusy] = useState(false);
  async function createPass(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    const from = new Date(); const until = new Date(from.getTime() + Number(duration) * 3_600_000);
    try {
      const grant = await adapter.createGrant({ grant: { actor: name, apartmentId: APARTMENT_ID, role, scope: ['lock.unlock'], validFrom: from.toISOString(), validUntil: until.toISOString() }, requestId: crypto.randomUUID() });
      setCreated(grant); onCreate(grant);
      setQr('/assets/pass-qr.svg');
    } finally { setBusy(false); }
  }
  return <div className="access-view"><section className="access-form"><h1>A key that knows when to leave.</h1><p>Create a pass for the right door and the right window. It expires without a reminder.</p>
    <form onSubmit={createPass} className="form-stack"><fieldset><legend>Who is it for?</legend><div className="segmented">{(['visitor','delivery','cleaner'] as GrantRole[]).map((item) => <button type="button" key={item} className={role === item ? 'selected' : ''} onClick={() => setRole(item)}>{item === 'visitor' ? <UserRound /> : item === 'delivery' ? <DoorOpen /> : <Sparkles />}{item}</button>)}</div></fieldset>
      <label>Name or service<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Access window<select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="1">Next 1 hour</option><option value="2">Next 2 hours</option><option value="4">Next 4 hours</option><option value="24">Today</option></select></label>
      <div className="scope-row"><ShieldCheck /><span><strong>Entry only</strong><small>Unlock apartment 401 · no device control</small></span></div><button className="primary-button full" disabled={busy}>{busy ? 'Creating…' : <>Create pass <ArrowRight /></>}</button>
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
  const [conflict, setConflict] = useState<{ rule: Rule; conflict: Conflict } | null>(null);
  const [savedRule, setSavedRule] = useState<Rule | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sos, setSos] = useState<SosEvent | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const reduce = Boolean(useReducedMotion());

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([adapter.fetchDevices(APARTMENT_ID, controller.signal), adapter.fetchWhyCards(APARTMENT_ID, controller.signal), adapter.fetchGrants(APARTMENT_ID, controller.signal)]).then(([d, c, g]) => { setDevices(d); setCards(c); setGrants(g); setLoading(false); });
    return () => controller.abort();
  }, []);

  // Live feed: polls pollFeed on a cursor, upserts WhyCards/SosEvents, refreshes
  // devices after any Event batch. Starts on mount, stops on unmount.
  useEffect(() => {
    let cancelled = false;
    let cursor: string | undefined;
    let timer: number | undefined;
    let firstCall = true;

    async function poll() {
      if (cancelled) return;
      let nextDelay = 2000;
      try {
        const batch = await adapter.pollFeed({ apartmentId: APARTMENT_ID, cursor });
        if (cancelled) return;

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
        // retryable per ADAPTER.md: keep last snapshot, try again next tick
      }
      if (!cancelled) timer = window.setTimeout(poll, nextDelay);
    }

    poll();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, []);

  async function override(id: string, value: WhyOverride) {
    setOverrideBusy(id);
    try { const updated = await adapter.postWhyOverride({ whyCardId: id, override: value, requestId: crypto.randomUUID() }); setCards((all) => all.map((card) => card.id === id ? updated : card)); }
    finally { setOverrideBusy(null); }
  }

  function switchRole(next: Role) { setRole(next); setRoute(next === 'operator' ? 'building' : 'home'); setMobileMenu(false); }
  async function triggerSos() { const event = await adapter.triggerSos({ apartmentId: APARTMENT_ID, requestId: crypto.randomUUID() }); setSos(event); }
  const pageTitle = role === 'operator' ? 'Building' : NAV.find((item) => item.id === route)?.label ?? 'Home';

  if (loading) return <div className="boot-screen"><BrandMark /><span>Preparing Apartment 401</span></div>;
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
    <main className="app-content" id="main-content"><div className="desktop-topbar"><span>{pageTitle}</span><div><span className="connection"><i /> Demo engine live</span><button className="notification-button" aria-label="Notifications"><BellRing /></button><span className="avatar desktop-avatar">M</span></div></div>
      <AnimatePresence mode="wait" initial={false}><motion.div key={`${role}-${route}`} className="route-frame" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .01 : .18 }}>
        {route === 'home' && <HomeView devices={devices} cards={cards} selectedRoom={room} setSelectedRoom={setRoom} onOverride={override} overrideBusy={overrideBusy} onOpenScenes={() => setRoute('scenes')} />}
        {route === 'scenes' && <ScenesView onConflict={(rule, found) => setConflict({ rule, conflict: found })} onSaved={setSavedRule} />}
        {route === 'access' && <AccessView grants={grants} onCreate={(grant) => setGrants((all) => [grant, ...all])} />}
        {route === 'building' && <BuildingView onHandover={() => setHandoverOpen(true)} />}
      </motion.div></AnimatePresence>
    </main>
    {role === 'resident' && <nav className="bottom-nav" aria-label="Mobile navigation">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => setRoute(id)}><Icon /><span>{label}</span></button>)}</nav>}

    <ConflictDialog value={conflict} onClose={() => setConflict(null)} onSaved={(rule) => { setSavedRule(rule); setConflict(null); }} />
    <EmergencyDialog open={sosOpen} sos={sos} onClose={() => { setSosOpen(false); setSos(null); }} onTrigger={triggerSos} />
    <HandoverDialog open={handoverOpen} onClose={() => setHandoverOpen(false)} onSaved={(grant) => { setGrants((all) => [grant, ...all]); setHandoverOpen(false); }} />
    <AnimatePresence>{savedRule && <motion.div className="toast" role="status" initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}><span><Check /></span><div><strong>Scene ready</strong><small>{savedRule.name}</small></div><button onClick={() => setSavedRule(null)} aria-label="Dismiss"><X /></button></motion.div>}</AnimatePresence>
  </div>;
}

function ConflictDialog({ value, onClose, onSaved }: { value: { rule: Rule; conflict: Conflict } | null; onClose: () => void; onSaved: (rule: Rule) => void }) {
  const [busy, setBusy] = useState(false);
  async function chooseSafe() {
    if (!value) return; setBusy(true);
    try { const result = await adapter.saveRule({ rule: value.rule, resolutions: [{ conflictId: value.conflict.id, type: 'edit_condition' }], requestId: crypto.randomUUID() }); onSaved(result.rule); }
    finally { setBusy(false); }
  }
  return <Dialog open={Boolean(value)} title="Safety has the right of way" onClose={onClose} tone="danger">{value && <div className="conflict-content"><div className="safety-lock"><ShieldCheck /><span><strong>Protected rule</strong><small>Life-safety automation cannot be overridden</small></span></div><p>{value.conflict.reason}</p><div className="rule-compare"><div><span>Your new rule</span><strong>{value.rule.name}</strong><small>Locks entry when the apartment is empty</small></div><div className="conflict-vs">conflicts with</div><div className="protected"><span>Safety rule</span><strong>Unlock on smoke</strong><small>Always releases exits during an alarm</small></div></div><div className="safe-solution"><span><Check /></span><div><strong>Safe adjustment</strong><p>Add “only when no smoke alarm is active” to your new rule.</p></div></div><div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={chooseSafe} disabled={busy}>{busy ? 'Checking…' : <>Use safe adjustment <ArrowRight /></>}</button></div></div>}</Dialog>;
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
