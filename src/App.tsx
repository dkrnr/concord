import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowRight, BellRing, Building2, CalendarDays, Check, ChevronDown, CircleHelp,
  Clock3, Copy, DoorOpen, HeartPulse, Home, KeyRound, LayoutGrid, Leaf, LockKeyhole, Menu,
  Globe2, MessageSquareText, Moon, Plus, Radio, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Sun, TrendingUp, UserRound,
  UsersRound, WandSparkles, Wrench, X, Zap,
} from 'lucide-react';
import { adapter } from './data';
import type { CapabilityGrant, Conflict, Device, GrantRole, NotificationItem, Portfolio, Rule, SosEvent, WhyCard, WhyOverride } from './domain/contracts';
import { HomeScene, type Room } from './scene/HomeScene';
import { DeviceIcon } from './components/Icons';
import { Dialog } from './components/Dialog';
import { passPayload, qrDataUrl } from './data/passQr';
import { applyTheme, preferredTheme, type Theme } from './theme';
import { useI18n, type Language } from './i18n';

type Route = 'home' | 'scenes' | 'access' | 'profile' | 'notifications' | 'building' | 'developer';
type Role = 'resident' | 'operator' | 'developer';
type ConnectionState = 'live' | 'reconnecting' | 'stale' | 'offline';
type ResidentProfile = { name: string; photo: string | null };
const APARTMENT_ID = 'apt_401';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The home engine could not complete that request.';
}

const ROOM_BY_DEVICE: Record<string, Room> = {
  dev_light_living: 'living', dev_curtain_living: 'living', dev_ac_bedroom: 'bedroom',
  dev_lock_401: 'entry', dev_smoke_401: 'kitchen', dev_occ_401: 'all',
};

function patchDeviceState(devices: Device[], deviceId: string, set: Record<string, unknown>) {
  return devices.map((device) => device.id === deviceId
    ? { ...device, state: { ...device.state, ...set }, lastUpdated: new Date().toISOString() }
    : device);
}

function projectRuleDevices(devices: Device[], rule: Rule | null) {
  if (!rule) return devices;
  return rule.actions.reduce((projected, action) => projected.map((device) => {
    const matches = action.deviceId === 'all' ? device.type === action.deviceType : device.id === action.deviceId;
    return matches ? { ...device, state: { ...device.state, ...action.set } } : device;
  }), devices);
}

const NAV = [{ id: 'home' as const, label: 'Home', icon: Home }, { id: 'scenes' as const, label: 'Scenes', icon: WandSparkles }, { id: 'access' as const, label: 'Access', icon: KeyRound }];

function formatTime(value: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

type GrantState = 'pending' | 'active' | 'expired';
function grantState(grant: CapabilityGrant, now = Date.now()): GrantState {
  if (now < new Date(grant.validFrom).getTime()) return 'pending';
  if (now >= new Date(grant.validUntil).getTime()) return 'expired';
  if (grant.recurring) {
    const date = new Date(now);
    const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Colombo', weekday: 'short' }).format(date).slice(0, 3).toLowerCase();
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    if (!grant.recurring.days.includes(day as NonNullable<CapabilityGrant['recurring']>['days'][number]) || time < grant.recurring.startTime || time >= grant.recurring.endTime) return 'pending';
  }
  return 'active';
}

function backupCode(grant: CapabilityGrant) {
  const suffix = grant.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase().padStart(6, '0');
  return `C401-${suffix.slice(0, 3)}-${suffix.slice(3)}`;
}

function deviceLabel(device: Device, t: (message: string) => string) {
  if (device.type === 'light') return `${device.state.brightness}% ${t('brightness')}`;
  if (device.type === 'curtain') return `${device.state.openPercent}% ${t('open')}`;
  if (device.type === 'ac') return `${device.state.temperature}° · ${device.state.on ? t('on') : t('off')}`;
  if (device.type === 'lock') return device.state.locked ? t('Locked') : t('Unlocked');
  if (device.type === 'smoke') return device.state.alarm ? t('Alarm') : `${device.state.ppm} ppm · ${t('clear')}`;
  return device.state.occupied ? t('Home occupied') : t('Away');
}

function deviceName(device: Device, t: (message: string) => string = (message) => message) {
  const room = String(device.state.room ?? 'home');
  const roomName = t(room);
  return `${roomName[0].toUpperCase()}${roomName.slice(1)} ${t(device.type === 'ac' ? 'climate' : device.type)}`;
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function StatusChip({ card }: { card: WhyCard }) {
  const { t } = useI18n();
  if (card.status === 'alert') return <span className="status-chip alert"><AlertTriangle /> {t('Needs attention')}</span>;
  if (card.status === 'proposed') return <span className="status-chip proposed"><CircleHelp /> {t('Your call')}</span>;
  return <span className="status-chip done"><Check /> {t('Done')}</span>;
}

function WhyCardView({ card, active, onInspect, onOverride, onProposal, busy }: {
  card: WhyCard; active: boolean; onInspect: () => void; onOverride: (value: WhyOverride) => void;
  onProposal: (decision: 'approve' | 'dismiss') => void; busy: boolean;
}) {
  const { t, locale } = useI18n();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const resolvedCopy = card.resolvedOverride === 'not_tonight' ? t('Paused until tomorrow') : card.resolvedOverride === 'never' ? t('Routine turned off') : card.resolvedOverride === 'keep' ? t('Kept as is') : null;
  return <article className={`why-card ${active ? 'active' : ''}`} onClick={onInspect}>
    <div className="why-card-top"><StatusChip card={card} /><time dateTime={card.timestamp}>{formatTime(card.timestamp, locale)}</time></div>
    <h3>{card.action}</h3>
    <p>{card.reason}</p>
    <button className="evidence-toggle" onClick={(e) => { e.stopPropagation(); setEvidenceOpen((v) => !v); }} aria-expanded={evidenceOpen}>
      <Radio /> {t('{count} signals', { count: card.evidence.length })} <ChevronDown className={evidenceOpen ? 'rotated' : ''} />
    </button>
    <AnimatePresence initial={false}>
      {evidenceOpen && <motion.ul className="evidence-list" initial={{ opacity: 0, transform: 'translateY(-4px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}>
        {card.evidence.map((item) => <li key={`${item.deviceId}-${item.field}`}><span>{item.field.replace('state.', '')}</span><strong>{String(item.value)}</strong></li>)}
      </motion.ul>}
    </AnimatePresence>
    {resolvedCopy ? <div className="resolved-row"><Check /> {resolvedCopy}</div> : card.status === 'proposed' ? <div className="why-actions proposal-actions" onClick={(e) => e.stopPropagation()}>
      <button disabled={busy} className="primary-small" onClick={() => onProposal('approve')}>{t('Approve')}</button>
      <button disabled={busy} onClick={() => onProposal('dismiss')}>{t('Dismiss')}</button>
    </div> : <div className="why-actions" onClick={(e) => e.stopPropagation()}>
      <button disabled={busy} className="primary-small" onClick={() => onOverride('keep')}>{t('Keep')}</button>
      <button disabled={busy} onClick={() => onOverride('not_tonight')}>{t('Not tonight')}</button>
      <button disabled={busy} onClick={() => onOverride('never')}>{t('Never')}</button>
    </div>}
  </article>;
}

function DeviceControls({ device, busy, onCommand }: { device: Device; busy: boolean; onCommand: (device: Device, set: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  if (device.type === 'light') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { on: !Boolean(device.state.on), brightness: Number(device.state.brightness ?? 60) })}>{t(device.state.on ? 'Turn off' : 'Turn on')}</button></div>;
  if (device.type === 'ac') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { on: !Boolean(device.state.on) })}>{t(device.state.on ? 'Turn off' : 'Turn on')}</button><button disabled={busy} aria-label={t('Lower bedroom temperature')} onClick={() => onCommand(device, { on: true, temperature: Math.max(16, Number(device.state.temperature ?? 24) - 1) })}>−</button><button disabled={busy} aria-label={t('Raise bedroom temperature')} onClick={() => onCommand(device, { on: true, temperature: Math.min(30, Number(device.state.temperature ?? 24) + 1) })}>+</button></div>;
  if (device.type === 'curtain') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { openPercent: 0 })}>{t('Close')}</button><button disabled={busy} onClick={() => onCommand(device, { openPercent: 100 })}>{t('Open')}</button></div>;
  if (device.type === 'lock') return <div className="device-controls"><button disabled={busy} onClick={() => onCommand(device, { locked: !Boolean(device.state.locked) })}>{t(device.state.locked ? 'Unlock' : 'Lock')}</button></div>;
  return <span className="read-only-device">{t('Sensor · read only')}</span>;
}

function HomeView({ devices, cards, residentName, selectedRoom, setSelectedRoom, onOverride, onProposal, overrideBusy, onCommand, commandBusy, onOpenScenes }: {
  devices: Device[]; cards: WhyCard[]; selectedRoom: Room; setSelectedRoom: (room: Room) => void;
  residentName: string;
  onOverride: (id: string, value: WhyOverride) => void; overrideBusy: string | null;
  onProposal: (id: string, decision: 'approve' | 'dismiss') => void;
  onCommand: (device: Device, set: Record<string, unknown>) => void; commandBusy: string | null; onOpenScenes: () => void;
}) {
  const { t } = useI18n();
  const reduce = Boolean(useReducedMotion());
  return <div className="home-view">
    <section className="home-main">
      <div className="greeting"><div><span className="eyebrow">{t('Tuesday · Apartment 401')}</span><h1>{t('Good evening, {name}.', { name: residentName.split(' ')[0] })}</h1><p>{t('Your home has settled in. One choice is waiting for you.')}</p></div><button className="new-scene" onClick={onOpenScenes}><Plus /> {t('New scene')}</button></div>
      <div className="home-stage">
        <div className="stage-heading"><div><span className="live-dot" /> {t('Live home')}</div><span>{t('4 rooms · 6 devices')}</span></div>
        <div className="scene-wrap">
          <HomeScene room={selectedRoom} preview={false} reducedMotion={reduce} devices={devices} />
          <div className="scene-caption"><Leaf /><span>{t('Evening mode')}</span><strong>{t('3 changes active')}</strong></div>
        </div>
        <div className="room-tabs" role="tablist" aria-label={t('Choose room')}>
          {(['all','living','bedroom','kitchen','entry'] as Room[]).map((room) => <button key={room} role="tab" aria-selected={selectedRoom === room} onClick={() => setSelectedRoom(room)}>{t(room === 'all' ? 'Whole home' : room)}</button>)}
        </div>
      </div>
      <section className="devices-section">
        <div className="section-heading"><div><h2>{t('Home state')}</h2></div><button className="text-button"><SlidersHorizontal /> {t('All devices')}</button></div>
        <div className="device-grid">
          {devices.map((device) => <article className="device-item" key={device.id}>
            <button className="device-summary" onClick={() => setSelectedRoom(ROOM_BY_DEVICE[device.id] ?? 'all')}><span className={`device-icon ${device.type}`}><DeviceIcon type={device.type} /></span><span><strong>{deviceName(device, t)}</strong><small>{deviceLabel(device, t)}</small></span><span className="device-state-dot" /></button>
            <DeviceControls device={device} busy={commandBusy === device.id} onCommand={onCommand} />
          </article>)}
        </div>
      </section>
    </section>
    <aside className="activity-panel">
      <div className="activity-heading"><div><span className="eyebrow">{t('Why feed')}</span><h2>{t('What home noticed')}</h2></div><span className="count-badge">{t('{count} new', { count: cards.filter((c) => !c.resolvedOverride).length })}</span></div>
      <p className="activity-intro">{t('Every action comes with its reason. Correct one and Concord learns the boundary.')}</p>
      <div className="timeline">{cards.map((card) => <WhyCardView key={card.id} card={card} active={card.evidence.some((e) => ROOM_BY_DEVICE[e.deviceId] === selectedRoom)} onInspect={() => setSelectedRoom(ROOM_BY_DEVICE[card.evidence[0]?.deviceId] ?? 'all')} onOverride={(value) => onOverride(card.id, value)} onProposal={(decision) => onProposal(card.id, decision)} busy={overrideBusy === card.id} />)}</div>
    </aside>
  </div>;
}

function ProfileView({ profile, onSave }: { profile: ResidentProfile; onSave: (profile: ResidentProfile) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(profile.name);
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) {
      setError(t('Choose a JPG, PNG or WebP image under 3 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setPhoto(String(reader.result)); setError(null); };
    reader.onerror = () => setError(t('That image could not be read. Choose another file.'));
    reader.readAsDataURL(file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) { setError(t('Enter the resident name.')); return; }
    onSave({ name: nextName, photo });
    setSaved(true);
    setError(null);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return <div className="profile-view"><section className="profile-intro"><div className="profile-avatar-large">{photo ? <img src={photo} alt="" /> : <span>{name.trim()[0] || 'M'}</span>}</div><div><h1>{t('Your resident profile')}</h1><p>{t('Keep the identity shown across your home controls current. Changes stay in this demo session.')}</p></div></section><form className="profile-form" onSubmit={submit}>
    <label>{t('Resident name')}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="name" /></label>
    <label className="photo-field"><span>{t('Profile picture')}</span><span className="photo-drop"><UserRound /><span><strong>{t(photo ? 'Replace picture' : 'Choose a picture')}</strong><small>{t('JPG, PNG or WebP · up to 3 MB')}</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} /></span></label>
    {photo && <button type="button" className="text-button profile-remove" onClick={() => setPhoto(null)}>{t('Remove picture')}</button>}
    {error && <p className="inline-error" role="alert"><AlertTriangle /> {error}</p>}
    <button className="primary-button" disabled={!name.trim()}>{saved ? <><Check /> {t('Profile saved')}</> : t('Save profile')}</button>
  </form></div>;
}

function NotificationsView({ items, loading, error, onRetry, onMarkRead }: { items: NotificationItem[]; loading: boolean; error: string | null; onRetry: () => void; onMarkRead: (id: string) => Promise<void> }) {
  const { t, locale } = useI18n();
  return <div className="notifications-view"><header className="notifications-heading"><div><h1>{t('Notifications')}</h1><p>{t('Alerts, explanations and emergency updates from the live home engine.')}</p></div><span>{t('{count} unread', { count: items.filter((item) => !item.read).length })}</span></header>
    {error && <div className="inline-error notification-error" role="alert"><AlertTriangle /><span>{error}</span><button className="text-button" onClick={onRetry}>{t('Retry now')}</button></div>}
    {loading && items.length === 0 ? <div className="notification-skeleton" aria-label={t('Loading notifications')}><span /><span /><span /></div> : items.length === 0 ? <div className="empty-notifications"><BellRing /><h2>{t('You’re all caught up')}</h2><p>{t('New WhyCards, alerts and SOS updates will appear here.')}</p></div> : <div className="notification-list">{items.map((item) => <article key={item.id} className={`notification-row ${item.severity} ${item.read ? 'read' : 'unread'}`}><span className="notification-kind">{item.kind === 'sos_event' ? <HeartPulse /> : item.severity === 'alert' ? <AlertTriangle /> : <CircleHelp />}</span><div><div className="notification-meta"><span>{t(item.kind === 'sos_event' ? 'Emergency update' : 'Home explanation')}</span><time dateTime={item.timestamp}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.timestamp))}</time></div><h2>{item.title}</h2><p>{item.message}</p></div>{item.read ? <span className="read-state"><Check /> {t('Read')}</span> : <button className="secondary-button" onClick={() => onMarkRead(item.id)}>{t('Mark as read')}</button>}</article>)}</div>}
  </div>;
}

function conditionCopy(rule: Rule, t: (message: string) => string = (message) => message) {
  if (!rule.conditions.length) return t('No extra conditions');
  return rule.conditions.map((condition) => `${condition.field} ${condition.op} ${String(condition.value)}`).join(' · ');
}

function actionCopy(rule: Rule, devices: Device[], t: (message: string, values?: Record<string, string | number>) => string = (message) => message) {
  return rule.actions.map((action) => {
    const target = action.deviceId === 'all' ? t('All {type} devices', { type: t(action.deviceType) }) : devices.find((device) => device.id === action.deviceId) ? deviceName(devices.find((device) => device.id === action.deviceId)!, t) : action.deviceId;
    const values = Object.entries(action.set).map(([field, value]) => `${t(field)} ${String(value)}`).join(', ');
    return `${target}: ${values}`;
  }).join(' · ');
}

function RuleReceipt({ rule, devices, conflicts, onChange }: { rule: Rule; devices: Device[]; conflicts: Conflict[]; onChange: (rule: Rule) => void }) {
  const { t } = useI18n();
  function updateAction(index: number, action: Rule['actions'][number]) {
    onChange({ ...rule, actions: rule.actions.map((current, actionIndex) => actionIndex === index ? action : current) });
  }
  return <section className="rule-receipt">
    <div className="receipt-title"><span className="receipt-icon"><Sparkles /></span><div><span className="eyebrow">{t('Concord understood')}</span><h2>{rule.name}</h2></div><span className="draft-pill">{t('Draft')}</span></div>
    <div className="rule-line"><span>{t('When')}</span>{rule.trigger.kind === 'time' ? <label><span className="sr-only">{t('Trigger time')}</span><input type="time" value={rule.trigger.at ?? ''} onChange={(e) => onChange({ ...rule, trigger: { ...rule.trigger, at: e.target.value } })} /></label> : <strong>{rule.trigger.eventType ?? t('Unspecified event')}</strong>}</div>
    <div className="rule-line"><span>{t('Only if')}</span><strong>{conditionCopy(rule, t)}</strong></div>
    <div className="rule-actions"><span>{t('Then')}</span><div>{rule.actions.map((action, index) => {
      const compatible = devices.filter((device) => device.type === action.deviceType);
      return <fieldset className="action-editor" key={`${action.deviceType}-${index}`}><legend>{t('{type} action {count}', { type: t(action.deviceType), count: index + 1 })}</legend>
        <label>{t('Resolved target')}<select aria-label={`${t('Resolved target')} ${index + 1}`} value={action.deviceId} onChange={(event) => updateAction(index, { ...action, deviceId: event.target.value })}>
          <option value="all">{t('All {type} devices · room not specified', { type: t(action.deviceType) })}</option>
          {action.deviceId !== 'all' && !compatible.some((device) => device.id === action.deviceId) && <option value={action.deviceId}>{t('{id} · unavailable target, choose a real device', { id: action.deviceId })}</option>}
          {compatible.map((device) => <option key={device.id} value={device.id}>{deviceName(device, t)} · {device.id}</option>)}
        </select></label>
        <div className="action-settings">{Object.entries(action.set).map(([field, value]) => <label key={field}>{field}
          {typeof value === 'boolean' ? <select aria-label={`Action ${index + 1} ${field}`} value={String(value)} onChange={(event) => updateAction(index, { ...action, set: { ...action.set, [field]: event.target.value === 'true' } })}><option value="true">{t('On / true')}</option><option value="false">{t('Off / false')}</option></select> : <input aria-label={`Action ${index + 1} ${field}`} type={typeof value === 'number' ? 'number' : 'text'} value={String(value)} min={field === 'temperature' ? 16 : 0} max={field === 'temperature' ? 30 : 100} onChange={(event) => updateAction(index, { ...action, set: { ...action.set, [field]: typeof value === 'number' ? Number(event.target.value) : event.target.value } })} />}
        </label>)}</div>
      </fieldset>;
    })}</div></div>
    {conflicts.length > 0 && <p className="receipt-warning"><AlertTriangle /> {t('The engine found {count} conflicts. Edit the target or action, then confirm to check again.', { count: conflicts.length })}</p>}
    <p className="receipt-note"><CircleHelp /> {t('This is the engine’s exact resolution. Check the target, room and values before saving.')}</p>
  </section>;
}

function ScenesView({ devices, onConflict, onSaved, onWriteError }: { devices: Device[]; onConflict: (rule: Rule, conflict: Conflict) => void; onSaved: (rule: Rule) => void; onWriteError: (error: unknown) => void }) {
  const { t } = useI18n();
  const [sentence, setSentence] = useState(() => t('Make it comfortable when I sleep'));
  const [builder, setBuilder] = useState(false);
  const [manualName, setManualName] = useState('Evening comfort');
  const [manualTrigger, setManualTrigger] = useState<'time' | 'occupancy.changed' | 'motion.detected'>('time');
  const [manualTime, setManualTime] = useState('18:30');
  const [manualCondition, setManualCondition] = useState<'none' | 'occupied_false' | 'occupied_true' | 'hallway'>('none');
  const controllable = devices.filter((device) => ['light','ac','lock','curtain'].includes(device.type));
  const [manualDeviceId, setManualDeviceId] = useState(() => controllable[0]?.id ?? '');
  const [manualValue, setManualValue] = useState('60');
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
  function buildManual(event: FormEvent) {
    event.preventDefault();
    const target = controllable.find((device) => device.id === manualDeviceId) ?? controllable[0];
    if (!target) { setError(t('No controllable devices are available.')); return; }
    const conditions: Rule['conditions'] = manualCondition === 'none' ? [] : manualCondition === 'occupied_false' ? [{ field: 'value.occupied', op: 'eq', value: false }] : manualCondition === 'occupied_true' ? [{ field: 'value.occupied', op: 'eq', value: true }] : [{ field: 'value.room', op: 'eq', value: 'hallway' }];
    const set = target.type === 'light' ? { on: true, brightness: Number(manualValue) } : target.type === 'ac' ? { on: true, temperature: Number(manualValue) } : target.type === 'lock' ? { locked: manualValue === 'true' } : { openPercent: Number(manualValue) };
    const rule: Rule = { id: `draft_manual_${crypto.randomUUID()}`, apartmentId: APARTMENT_ID, name: manualName.trim() || t('Manual scene'), sourceSentence: `Manual scene: ${manualName.trim()}`, trigger: manualTrigger === 'time' ? { kind: 'time', at: manualTime } : { kind: 'event', eventType: manualTrigger }, conditions, actions: [{ deviceType: target.type, deviceId: target.id, set }], enabled: true, createdAt: new Date().toISOString() };
    setProposal({ rule, conflicts: [] }); setPreview(true); setError(null);
  }
  function selectManualDevice(id: string) {
    setManualDeviceId(id);
    const target = controllable.find((device) => device.id === id);
    setManualValue(target?.type === 'lock' ? 'true' : target?.type === 'ac' ? '23' : target?.type === 'curtain' ? '50' : '60');
  }
  const previewRoom = proposal ? (proposal.rule.actions[0]?.deviceId === 'all' ? 'all' : String(devices.find((device) => device.id === proposal.rule.actions[0]?.deviceId)?.state.room ?? 'all')) as Room : 'all';
  const previewAction = proposal ? actionCopy(proposal.rule, devices, t) : t('No proposed changes.');
  const previewDevices = useMemo(() => projectRuleDevices(devices, preview ? proposal?.rule ?? null : null), [devices, preview, proposal]);
  return <div className="scenes-view">
    <section className="scene-compose">
      <h1>{t('Say how you want home to feel.')}</h1><p>{t('Describe the outcome in your words. Concord will show the exact rule before anything is saved.')}</p>
      <div className="scene-method" role="tablist" aria-label={t('Scene creation method')}><button role="tab" aria-selected={!builder} onClick={() => setBuilder(false)}><MessageSquareText />{t('Describe it')}</button><button role="tab" aria-selected={builder} onClick={() => setBuilder(true)}><SlidersHorizontal />{t('Build manually')}</button></div>
      {!builder ? <><form className="prompt-box" onSubmit={interpret}><MessageSquareText /><textarea value={sentence} onChange={(e) => setSentence(e.target.value)} aria-label={t('Describe your scene')} /><button disabled={busy || !sentence.trim()}>{busy ? t('Understanding…') : <>{t('Make the rule')} <ArrowRight /></>}</button></form>{error && <p className="inline-error" role="alert"><AlertTriangle /> {error}</p>}<div className="prompt-examples"><span>{t('Try')}</span>{['Lock up when everyone leaves', 'Cool the bedroom before sleep', 'Welcome me home after sunset'].map((text) => <button key={text} onClick={() => setSentence(t(text))}>{t(text)}</button>)}</div></> : <form className="manual-builder" onSubmit={buildManual}><div className="manual-builder-heading"><div><h2>{t('Structured scene builder')}</h2><p>{t('Choose the trigger, optional condition and exact device action. You will review the same rule receipt before saving.')}</p></div><span>{t('Manual fallback')}</span></div><label>{t('Scene name')}<input value={manualName} onChange={(event) => setManualName(event.target.value)} maxLength={80} required /></label><div className="manual-grid"><fieldset><legend>{t('Trigger')}</legend><label>{t('Trigger type')}<select value={manualTrigger} onChange={(event) => setManualTrigger(event.target.value as typeof manualTrigger)}><option value="time">{t('At a time')}</option><option value="occupancy.changed">{t('When occupancy changes')}</option><option value="motion.detected">{t('When motion is detected')}</option></select></label>{manualTrigger === 'time' && <label>{t('Time')}<input type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} /></label>}</fieldset><fieldset><legend>{t('Condition')}</legend><label>{t('Only if')}<select value={manualCondition} onChange={(event) => setManualCondition(event.target.value as typeof manualCondition)}><option value="none">{t('No extra conditions')}</option><option value="occupied_false">{t('Home is away')}</option><option value="occupied_true">{t('Home is occupied')}</option><option value="hallway">{t('Event room is hallway')}</option></select></label></fieldset><fieldset><legend>{t('Action')}</legend><label>{t('Device')}<select value={manualDeviceId} onChange={(event) => selectManualDevice(event.target.value)}>{controllable.map((device) => <option value={device.id} key={device.id}>{deviceName(device, t)}</option>)}</select></label>{(() => { const target = controllable.find((device) => device.id === manualDeviceId) ?? controllable[0]; if (!target) return null; return <label>{t(target.type === 'light' ? 'Brightness' : target.type === 'ac' ? 'Temperature' : target.type === 'lock' ? 'Lock state' : 'Open percent')}{target.type === 'lock' ? <select value={manualValue} onChange={(event) => setManualValue(event.target.value)}><option value="true">{t('Locked')}</option><option value="false">{t('Unlocked')}</option></select> : <input type="number" min={target.type === 'ac' ? 16 : 0} max={target.type === 'ac' ? 30 : 100} value={manualValue} onChange={(event) => setManualValue(event.target.value)} />}</label>; })()}</fieldset></div>{error && <p className="inline-error" role="alert"><AlertTriangle /> {error}</p>}<button className="primary-button"><Check />{t('Review manual rule')}</button></form>}
      <AnimatePresence mode="wait">{proposal && <motion.div key={proposal.rule.id} initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .01 : .22 }}>
        <RuleReceipt rule={proposal.rule} devices={devices} conflicts={proposal.conflicts} onChange={(rule) => setProposal({ ...proposal, rule })} />
        <div className="receipt-actions"><button className="secondary-button" onClick={() => { setProposal(null); setPreview(false); }}>{t('Discard')}</button><button className="primary-button" onClick={save} disabled={busy}><Check /> {t('Check and save')}</button></div>
      </motion.div>}</AnimatePresence>
    </section>
    <aside className="scene-preview"><div className="preview-bar"><span><span className={preview ? 'preview-dot active' : 'preview-dot'} /> {t(preview ? 'Preview' : 'Live state')}</span><button onClick={() => setPreview((v) => !v)} disabled={!proposal}>{t(preview ? 'Show live' : 'Preview rule')}</button></div><div className="preview-canvas"><HomeScene room={previewRoom} preview={preview} reducedMotion={reduce} devices={previewDevices} /></div><div className="preview-copy"><strong>{preview ? `${t('Proposed change')} · ${t(previewRoom === 'all' ? 'multiple rooms' : previewRoom)}` : t('Live home')}</strong><p>{preview ? previewAction : t('No preview changes are applied.')}</p></div></aside>
  </div>;
}

function AccessView({ grants, onCreate, onWriteError }: { grants: CapabilityGrant[]; onCreate: (grant: CapabilityGrant) => Promise<void>; onWriteError: (error: unknown) => void }) {
  const { t, locale } = useI18n();
  const [role, setRole] = useState<GrantRole>('visitor');
  const [name, setName] = useState('Amaya');
  const initialStart = new Date();
  const initialEnd = new Date(initialStart.getTime() + 30 * 86_400_000);
  const [startDate, setStartDate] = useState(initialStart.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialEnd.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('21:00');
  const [recurring, setRecurring] = useState(false);
  const [days, setDays] = useState<NonNullable<CapabilityGrant['recurring']>['days']>(['sat']);
  const [created, setCreated] = useState<CapabilityGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  async function createPass(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    const from = new Date(`${startDate}T${recurring ? '00:00' : startTime}:00+05:30`);
    const until = new Date(`${endDate}T${recurring ? '23:59' : endTime}:00+05:30`);
    if (from >= until || (recurring && (!days.length || startTime >= endTime))) {
      setError(t('Choose a valid date range, at least one day, and an end time after the start time.')); setBusy(false); return;
    }
    try {
      const grant = await adapter.createGrant({ grant: { actor: name, apartmentId: APARTMENT_ID, role, scope: ['lock.unlock'], validFrom: from.toISOString(), validUntil: until.toISOString(), ...(recurring ? { recurring: { days, startTime, endTime } } : {}) }, requestId: crypto.randomUUID() });
      setCreated(grant); setNow(Date.now()); await onCreate(grant);
    } catch (cause) { setError(errorMessage(cause)); onWriteError(cause); }
    finally { setBusy(false); }
  }
  const code = created ? backupCode(created) : '';
  const qr = created ? qrDataUrl(passPayload(created.id, code)) : '';
  async function copyCode() { if (!created) return; try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); } }
  async function sharePass(copyOnly = false) {
    if (!created) return;
    const url = passPayload(created.id, code);
    try {
      if (!copyOnly && navigator.share) await navigator.share({ title: `Concord pass for ${created.actor}`, text: t('View your time-limited Concord visitor pass.'), url });
      else await navigator.clipboard.writeText(url);
      setShared(true); window.setTimeout(() => setShared(false), 1800);
    } catch (cause) { if ((cause as DOMException).name !== 'AbortError') setError(t('The pass link could not be shared. Copy it and try again.')); }
  }
  function toggleDay(day: NonNullable<CapabilityGrant['recurring']>['days'][number]) { setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]); }
  return <div className="access-view"><section className="access-form"><h1>{t('A key that knows when to leave.')}</h1><p>{t('Create a pass for the right door and the right window. It expires without a reminder.')}</p>
    <form onSubmit={createPass} className="form-stack"><fieldset><legend>{t('Who is it for?')}</legend><div className="segmented">{(['visitor','delivery','cleaner'] as GrantRole[]).map((item) => <button type="button" key={item} className={role === item ? 'selected' : ''} onClick={() => setRole(item)}>{item === 'visitor' ? <UserRound /> : item === 'delivery' ? <DoorOpen /> : <Sparkles />}{t(item)}</button>)}</div></fieldset>
      <label>{t('Name or service')}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <fieldset><legend>{t('Access schedule')}</legend><div className="segmented two"><button type="button" className={!recurring ? 'selected' : ''} onClick={() => setRecurring(false)}><Clock3 />{t('One-time')}</button><button type="button" className={recurring ? 'selected' : ''} onClick={() => setRecurring(true)}><CalendarDays />{t('Repeats weekly')}</button></div></fieldset>
      <div className="form-two"><label>{t('Starts on')}<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label><label>{t('Ends on')}<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label></div>
      {recurring && <fieldset className="recurring-days"><legend>{t('Repeats on')}</legend><div>{(['mon','tue','wed','thu','fri','sat','sun'] as const).map((day) => <button type="button" key={day} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}>{t(day)}</button>)}</div></fieldset>}
      <div className="form-two"><label>{t(recurring ? 'Window starts' : 'Start time')}<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label><label>{t(recurring ? 'Window ends' : 'End time')}<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label></div>
      <div className="scope-row"><ShieldCheck /><span><strong>{t('Entry only')}</strong><small>{t('Unlock apartment 401 · no device control')}</small></span></div><button className="primary-button full" disabled={busy}>{busy ? t('Creating…') : <>{t('Create pass')} <ArrowRight /></>}</button>
      {error && <p className="inline-error" role="alert"><AlertTriangle /> {error}</p>}
    </form></section>
    <aside className="pass-preview">{created ? <div className="qr-ticket"><div className="ticket-top"><BrandMark /><span>CONCORD PASS</span></div><span className={`grant-status ${grantState(created, now)}`}>{t(grantState(created, now))}</span><img src={qr} alt={`QR code for ${created.actor}`} /><h2>{created.actor}</h2><p>{t(created.role)} · Apartment 401</p>{created.recurring && <div className="pass-recurrence"><CalendarDays /><span><strong>{created.recurring.days.map((day) => t(day)).join(' · ')}</strong><small>{created.recurring.startTime}–{created.recurring.endTime}</small></span></div>}<div className="backup-code"><span>{t('Backup code')}</span><button onClick={copyCode} aria-label={t('Copy backup code')}><strong>{code}</strong><small>{t(copied ? 'Copied' : 'Copy')}</small></button></div><div className="ticket-window"><Clock3 /><span>{t(grantState(created, now) === 'pending' ? 'Valid from' : grantState(created, now) === 'expired' ? 'Expired at' : 'Valid until')}<strong>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(grantState(created, now) === 'pending' ? created.validFrom : created.validUntil))}</strong></span></div><div className="pass-share"><button className="primary-button" onClick={() => sharePass()}><Share2 />{shared ? t('Shared') : t('Share pass')}</button><button className="secondary-button" onClick={() => sharePass(true)} aria-label={t('Copy pass link')}><Copy /></button></div><small>{t('Demo pass · secure redemption pending backend integration')}</small></div> : <div className="empty-pass"><KeyRound /><h2>{t('Your pass appears here')}</h2><p>{t('The QR, readable backup code and expiry window will be ready to share.')}</p></div>}
      {grants.length > 0 && <div className="active-passes">{grants.map((grant) => { const state = grantState(grant, now); return <div key={grant.id}><span className="avatar">{grant.actor[0]}</span><span><strong>{grant.actor}</strong><small>{t(grant.role)} · {formatTime(state === 'pending' ? grant.validFrom : grant.validUntil, locale)}</small></span><span className={`active-label ${state}`}>{t(state)}</span></div>; })}</div>}</aside>
  </div>;
}

const UNITS = [
  { id: '401', state: 'attention', detail: 'Entry lock offline', energy: '+6%' }, { id: '402', state: 'healthy', detail: 'All devices responding', energy: '-4%' },
  { id: '403', state: 'healthy', detail: 'All devices responding', energy: '-1%' }, { id: '404', state: 'anomaly', detail: 'Energy anomaly since 14:20', energy: '+31%' },
  { id: '501', state: 'healthy', detail: 'All devices responding', energy: '-7%' }, { id: '502', state: 'attention', detail: 'Smoke sensor battery', energy: '+2%' },
  { id: '503', state: 'healthy', detail: 'All devices responding', energy: '-3%' }, { id: '504', state: 'healthy', detail: 'All devices responding', energy: '+1%' },
];

function BuildingView({ onHandover }: { onHandover: () => void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('all');
  const visible = UNITS.filter((unit) => filter === 'all' || unit.state === filter);
  return <div className="building-view"><div className="building-heading"><div><span className="eyebrow">{t('Aster Tower · Live overview')}</span><h1>{t('Good evening, front desk.')}</h1><p>{t('Three units need attention. Resident activity stays private.')}</p></div><button className="primary-button" onClick={onHandover}><UsersRound /> {t('New handover')}</button></div>
    <div className="building-stats"><div><Activity /><span><strong>93%</strong>{t('Device health')}</span></div><div><AlertTriangle /><span><strong>3</strong>{t('Need attention')}</span></div><div><Leaf /><span><strong>−4.2%</strong>{t('Energy today')}</span></div></div>
    <section className="unit-section"><div className="section-heading"><div><h2>{t('48 residences')}</h2></div><div className="filter-row">{['all','attention','anomaly'].map((item) => <button className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)} key={item}>{t(item)}</button>)}</div></div>
      <div className="unit-grid">{visible.map((unit) => <article className={`unit-card ${unit.state}`} key={unit.id}><div><span>{t('Unit')}</span><strong>{unit.id}</strong></div><span className="unit-state"><i />{t(unit.state === 'healthy' ? 'Healthy' : unit.state === 'anomaly' ? 'Energy anomaly' : 'Needs attention')}</span><p>{t(unit.detail)}</p><footer><span>{t('Energy')}</span><strong>{unit.energy}</strong></footer></article>)}</div>
    </section></div>;
}

function DeveloperView() {
  const { t, locale } = useI18n();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adapter.fetchPortfolio(controller.signal).then(setPortfolio).catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [retry]);
  if (error && !portfolio) return <div className="developer-view"><div className="inline-error developer-error"><AlertTriangle /><span>{error}</span><button className="text-button" onClick={() => { setError(null); setRetry((value) => value + 1); }}>{t('Retry now')}</button></div></div>;
  if (!portfolio) return <div className="developer-view"><div className="portfolio-loading"><span /><span /><span /></div></div>;
  const activeUnits = portfolio.handover.occupied + portfolio.handover.pending_handover;
  const recentAlerts = portfolio.units.filter((unit) => unit.fleetHealth !== 'healthy' || unit.maintenanceOpen > 0).slice(0, 5);
  return <div className="developer-view"><header className="developer-heading"><div><span className="eyebrow">{t('Aster portfolio')}</span><h1>{t('Every residence, one accountable view.')}</h1><p>{t('Building-level adoption, fleet condition and handover readiness. Resident behavior remains private.')}</p></div><span className="portfolio-updated"><span className="live-dot" />{t('Live engine aggregate')}</span></header>
    <section className="portfolio-overview" aria-label={t('Portfolio overview')}><div className="portfolio-primary"><strong>{activeUnits}<small> / {portfolio.totalUnits}</small></strong><span>{t('Active units')}</span><p>{t('{rate}% portfolio adoption', { rate: Math.round(portfolio.adoptionRate * 100) })}</p></div><div className="portfolio-measures"><div><Activity /><span>{t('Fleet health')}<strong>{portfolio.fleetHealth.healthy} {t('healthy')}</strong><small>{portfolio.fleetHealth.attention} {t('attention')} · {portfolio.fleetHealth.anomaly} {t('anomaly')}</small></span></div><div><Wrench /><span>{t('Maintenance')}<strong>{portfolio.maintenance.open} {t('open items')}</strong><small>{portfolio.maintenance.highPriority} {t('high priority')}</small></span></div><div><UsersRound /><span>{t('Handover')}<strong>{portfolio.handover.pending_handover} {t('pending')}</strong><small>{portfolio.handover.vacant} {t('vacant')}</small></span></div><div><Zap /><span>{t('Energy overview')}<strong>{portfolio.energy.totalKwhToday} kWh</strong><small>{portfolio.energy.avgKwhPerUnit} {t('kWh average per unit')}</small></span></div></div></section>
    <div className="developer-grid"><section className="portfolio-table-section"><div className="section-heading"><h2>{t('Portfolio units')}</h2><span>{portfolio.totalUnits} {t('total')}</span></div><div className="portfolio-table" role="table"><div className="portfolio-tr portfolio-th" role="row"><span>{t('Unit')}</span><span>{t('Fleet')}</span><span>{t('Handover')}</span><span>{t('Maintenance')}</span><span>{t('Energy')}</span></div>{portfolio.units.map((unit) => <div className="portfolio-tr" role="row" key={unit.apartmentId}><strong>{unit.unit}</strong><span className={`fleet-label ${unit.fleetHealth}`}><i />{t(unit.fleetHealth)}</span><span>{t(unit.handoverStatus)}</span><span>{unit.maintenanceOpen ? `${unit.maintenanceOpen} · ${t(unit.maintenancePriority ?? 'open')}` : t('Clear')}</span><span>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(unit.energyKwhToday)} kWh</span></div>)}</div></section>
    <aside className="portfolio-alerts"><div className="section-heading"><h2>{t('Recent alerts')}</h2><TrendingUp /></div>{recentAlerts.length ? recentAlerts.map((unit) => <article key={unit.apartmentId}><span className={`alert-mark ${unit.fleetHealth}`}><AlertTriangle /></span><div><strong>{t('Unit {unit}', { unit: unit.unit })}</strong><p>{unit.fleetHealth === 'anomaly' ? t('Fleet anomaly requires review.') : unit.maintenanceOpen > 0 ? t('{count} maintenance items are open.', { count: unit.maintenanceOpen }) : t('Fleet health needs attention.')}</p><small>{t(unit.handoverStatus)}</small></div></article>) : <p>{t('No building alerts.')}</p>}</aside></div>
  </div>;
}

function App() {
  const { t, language, setLanguage } = useI18n();
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
  const [theme, setTheme] = useState<Theme>(() => preferredTheme());
  const [profile, setProfile] = useState<ResidentProfile>({ name: 'Maria Perera', photo: null });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const reduce = Boolean(useReducedMotion());

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next, true);
  }

  async function refreshNotifications() {
    setNotificationsLoading(true);
    try { setNotifications(await adapter.fetchNotifications(APARTMENT_ID)); setNotificationsError(null); }
    catch (cause) { setNotificationsError(errorMessage(cause)); }
    finally { setNotificationsLoading(false); }
  }

  async function markNotificationRead(id: string) {
    try {
      await adapter.markNotificationRead(id);
      setNotifications((all) => all.map((item) => item.id === id ? { ...item, read: true } : item));
    } catch (cause) { setNotificationsError(errorMessage(cause)); }
  }

  useEffect(() => { void refreshNotifications(); }, [cards, sos]);

  // One synchronization loop owns bootstrap, polling, focus recovery and teardown.
  // Keeping these in one place prevents cursor races and overlapping focus polls.
  useEffect(() => {
    const controller = new AbortController();
    let cursor: string | undefined;
    let timer: number | undefined;
    let failures = 0;
    let polling = false;
    let pollAgain = false;
    let forceSnapshot = false;
    let lastSnapshotAt = 0;
    const seenEvents = new Set<string>();

    setLoading(devices.length === 0);
    setLoadError(null);
    setConnection('reconnecting');

    async function refreshSnapshots() {
      const [nextDevices, , nextGrants] = await Promise.all([
        adapter.fetchDevices(APARTMENT_ID, controller.signal),
        adapter.fetchRules(APARTMENT_ID, controller.signal),
        adapter.fetchGrants(APARTMENT_ID, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setDevices(nextDevices);
      setGrants(nextGrants);
      lastSnapshotAt = Date.now();
    }

    function applyFeed(items: Awaited<ReturnType<typeof adapter.pollFeed>>['items'], reset: boolean) {
      const nextCards = items.filter((item) => item.kind === 'why_card').map((item) => item.data as WhyCard);
      const nextSos = items.filter((item) => item.kind === 'sos_event').map((item) => item.data as SosEvent);
      const hasNewEvents = items.some((item) => {
        if (item.kind !== 'event' || seenEvents.has(item.data.id)) return false;
        seenEvents.add(item.data.id);
        return true;
      });

      if (reset) {
        setCards(nextCards);
        setSos(nextSos.at(-1) ?? null);
      } else {
        if (nextCards.length) {
          setCards((all) => {
            const byId = new Map(all.map((card) => [card.id, card]));
            for (const card of nextCards) byId.set(card.id, card);
            return Array.from(byId.values());
          });
        }
        if (nextSos.length) setSos(nextSos.at(-1) ?? null);
      }
      return hasNewEvents;
    }

    async function poll() {
      if (controller.signal.aborted) return;
      if (polling) { pollAgain = true; return; }
      polling = true;
      if (timer !== undefined) window.clearTimeout(timer);
      let nextDelay = 2000;
      try {
        const batch = await adapter.pollFeed({ apartmentId: APARTMENT_ID, cursor }, controller.signal);
        if (controller.signal.aborted) return;
        cursor = batch.cursor;
        const hasNewEvents = applyFeed(batch.items, batch.reset);
        const snapshotDue = Date.now() - lastSnapshotAt >= 15_000;
        if (batch.reset || hasNewEvents || forceSnapshot || snapshotDue) await refreshSnapshots();
        forceSnapshot = false;
        failures = 0;
        setLoadError(null);
        setConnection('live');
        nextDelay = batch.hasMore ? 0 : 2000;
      } catch (cause) {
        if (controller.signal.aborted) return;
        failures += 1;
        if (devices.length === 0) setLoadError(errorMessage(cause));
        setConnection(failures > 1 ? 'stale' : 'reconnecting');
        nextDelay = [2000, 4000, 8000, 15000][Math.min(failures - 1, 3)];
      } finally {
        polling = false;
        if (controller.signal.aborted) return;
        setLoading(false);
        if (pollAgain) {
          pollAgain = false;
          timer = window.setTimeout(poll, 0);
        } else {
          timer = window.setTimeout(poll, nextDelay);
        }
      }
    }

    async function bootstrap() {
      try {
        // Snapshot first, cursor-less feed second, then snapshot again to close the
        // race between those reads as required by ADAPTER.md.
        await refreshSnapshots();
        await poll();
      } catch (cause) {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(cause));
          setConnection('offline');
          setLoading(false);
        }
      }
    }

    const revalidate = () => {
      if (document.visibilityState !== 'visible') return;
      forceSnapshot = true;
      void poll();
    };
    void bootstrap();
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
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
    const previous = device;
    setCommandBusy(device.id);
    setDevices((all) => patchDeviceState(all, device.id, set));
    try {
      await adapter.commandDevice({ deviceId: device.id, set, requestId: crypto.randomUUID() });
      setDevices(await adapter.fetchDevices(APARTMENT_ID));
      setWriteError(null);
    } catch (cause) {
      try { setDevices(await adapter.fetchDevices(APARTMENT_ID)); }
      catch { setDevices((all) => all.map((item) => item.id === previous.id ? previous : item)); }
      reportWriteError(cause);
    }
    finally { setCommandBusy(null); }
  }

  function switchRole(next: Role) { setRole(next); setRoute(next === 'operator' ? 'building' : next === 'developer' ? 'developer' : 'home'); setMobileMenu(false); }
  async function triggerSos() { try { const event = await adapter.triggerSos({ apartmentId: APARTMENT_ID, requestId: crypto.randomUUID() }); setSos(event); setWriteError(null); } catch (cause) { reportWriteError(cause); throw cause; } }
  const pageTitle = t(role === 'operator' ? 'Building' : role === 'developer' ? 'Portfolio' : route === 'profile' ? 'Profile' : route === 'notifications' ? 'Notifications' : NAV.find((item) => item.id === route)?.label ?? 'Home');

  if (loading) return <div className="boot-screen"><BrandMark /><span>{t('Connecting to Apartment 401…')}</span></div>;
  if (loadError && devices.length === 0) return <div className="boot-screen boot-error" role="alert"><BrandMark /><strong>{t('Home engine offline')}</strong><span>{loadError}</span><button className="primary-button" onClick={() => setRetryKey((value) => value + 1)}>{t('Retry connection')}</button></div>;
  const connectionCopy: Record<ConnectionState, string> = { live: t('Home engine live'), reconnecting: t('Reconnecting…'), stale: t('Data may be stale'), offline: t('Engine offline') };
  return <div className={`app-shell ${role}`}>
    <header className="mobile-header"><button className="brand-mobile" onClick={() => { setRoute(role === 'operator' ? 'building' : role === 'developer' ? 'developer' : 'home'); setMobileMenu(false); }}><BrandMark /><span>Concord</span></button><div><button className="notification-button" aria-label={t('Notifications')} onClick={() => { setRole('resident'); setRoute('notifications'); setMobileMenu(false); void refreshNotifications(); }}><BellRing />{notifications.some((item) => !item.read) && <span className="unread-badge">{Math.min(99, notifications.filter((item) => !item.read).length)}</span>}</button><button className="emergency-compact" onClick={() => setSosOpen(true)}><HeartPulse /> {t('Emergency')}</button><button className="icon-button" onClick={() => setMobileMenu((v) => !v)} aria-label={t('Open menu')}>{mobileMenu ? <X /> : <Menu />}</button></div></header>
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <button className="brand" onClick={() => setRoute(role === 'operator' ? 'building' : role === 'developer' ? 'developer' : 'home')}><BrandMark /><span>Concord</span></button>
      <button className="residence-chip" onClick={() => { if (role === 'resident') setRoute('profile'); setMobileMenu(false); }}><div className="residence-avatar">{role === 'resident' ? profile.photo ? <img src={profile.photo} alt="" /> : profile.name[0] : <Building2 />}</div><span><strong>{role === 'resident' ? profile.name : role === 'developer' ? t('Concord Portfolio') : 'Aster Tower'}</strong><small>{role === 'resident' ? t('Apartment 401 · Edit profile') : t(role === 'developer' ? 'Developer overview' : 'Building')}</small></span></button>
      <nav aria-label={t('Primary navigation')}>{role === 'resident' ? NAV.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => { setRoute(id); setMobileMenu(false); }}><Icon />{t(label)}</button>) : <button className="active"><LayoutGrid />{t(role === 'developer' ? 'Portfolio' : 'Building')}</button>}</nav>
      <div className="sidebar-spacer" />
      <label className="language-switch"><Globe2 /><span className="sr-only">{t('Language')}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">{t('English')}</option><option value="es">{t('Spanish')}</option><option value="si">{t('Sinhala')}</option></select></label>
      <button className="sidebar-utility" onClick={toggleTheme}>{theme === 'light' ? <Moon /> : <Sun />}<span>{t(theme === 'light' ? 'Dark mode' : 'Light mode')}</span></button>
      <button className="emergency-button" onClick={() => { setSosOpen(true); setMobileMenu(false); }}><HeartPulse /><span><strong>{t('Emergency')}</strong><small>{t('Get help now')}</small></span></button>
      <div className="role-switch"><span>{t('Demo view')}</span><div><button className={role === 'resident' ? 'selected' : ''} onClick={() => switchRole('resident')}>{t('Resident')}</button><button className={role === 'operator' ? 'selected' : ''} onClick={() => switchRole('operator')}>{t('Operator')}</button><button className={role === 'developer' ? 'selected' : ''} onClick={() => switchRole('developer')}>{t('Developer')}</button></div></div>
    </aside>
    <main className="app-content" id="main-content"><div className="desktop-topbar"><span>{pageTitle}</span><div><span className={`connection ${connection}`} role="status"><i /> {connectionCopy[connection]}</span><button className="icon-button theme-topbar" onClick={toggleTheme} aria-label={t(theme === 'light' ? 'Use dark mode' : 'Use light mode')}>{theme === 'light' ? <Moon /> : <Sun />}</button><button className="notification-button" aria-label={t('Notifications')} onClick={() => { setRole('resident'); setRoute('notifications'); void refreshNotifications(); }}><BellRing />{notifications.some((item) => !item.read) && <span className="unread-badge">{Math.min(99, notifications.filter((item) => !item.read).length)}</span>}</button><button className="avatar desktop-avatar avatar-button" onClick={() => { setRole('resident'); setRoute('profile'); }} aria-label={t('Open profile')}>{profile.photo ? <img src={profile.photo} alt="" /> : profile.name[0]}</button></div></div>
      {connection !== 'live' && <div className="connection-banner" role="status"><AlertTriangle /><span>{connectionCopy[connection]}. {t('The last confirmed home state remains visible.')}</span><button onClick={() => setRetryKey((value) => value + 1)}>{t('Retry now')}</button></div>}
      <AnimatePresence mode="wait" initial={false}><motion.div key={`${role}-${route}`} className="route-frame" initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? .01 : .18 }}>
        {route === 'home' && <HomeView devices={devices} cards={cards} residentName={profile.name} selectedRoom={room} setSelectedRoom={setRoom} onOverride={override} onProposal={decideProposal} overrideBusy={overrideBusy} onCommand={commandDevice} commandBusy={commandBusy} onOpenScenes={() => setRoute('scenes')} />}
        {route === 'scenes' && <ScenesView devices={devices} onConflict={(rule, found) => setConflict({ rule, conflict: found })} onSaved={setSavedRule} onWriteError={reportWriteError} />}
        {route === 'access' && <AccessView grants={grants} onCreate={async () => { setGrants(await adapter.fetchGrants(APARTMENT_ID)); }} onWriteError={reportWriteError} />}
        {route === 'profile' && <ProfileView profile={profile} onSave={setProfile} />}
        {route === 'notifications' && <NotificationsView items={notifications} loading={notificationsLoading} error={notificationsError} onRetry={refreshNotifications} onMarkRead={markNotificationRead} />}
        {route === 'building' && <BuildingView onHandover={() => setHandoverOpen(true)} />}
        {route === 'developer' && <DeveloperView />}
      </motion.div></AnimatePresence>
    </main>
    {role === 'resident' && <nav className="bottom-nav" aria-label={t('Mobile navigation')}>{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? 'active' : ''} onClick={() => setRoute(id)}><Icon /><span>{t(label)}</span></button>)}</nav>}

    <ConflictDialog value={conflict} onClose={() => setConflict(null)} />
    <EmergencyDialog open={sosOpen} sos={sos} onClose={() => { setSosOpen(false); setSos(null); }} onTrigger={triggerSos} />
    <HandoverDialog open={handoverOpen} onClose={() => setHandoverOpen(false)} onSaved={(grant) => { setGrants((all) => [grant, ...all]); setHandoverOpen(false); }} />
    <AnimatePresence>{savedRule && <motion.div className="toast" role="status" initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}><span><Check /></span><div><strong>{t('Scene ready')}</strong><small>{savedRule.name}</small></div><button onClick={() => setSavedRule(null)} aria-label={t('Dismiss')}><X /></button></motion.div>}</AnimatePresence>
    <AnimatePresence>{writeError && <motion.div className="toast error-toast" role="alert" initial={{ opacity: 0, transform: 'translateY(12px)' }} animate={{ opacity: 1, transform: 'translateY(0)' }} exit={{ opacity: 0 }}><span><AlertTriangle /></span><div><strong>{t('Engine write failed')}</strong><small>{writeError}</small></div><button onClick={() => setWriteError(null)} aria-label={t('Dismiss error')}><X /></button></motion.div>}</AnimatePresence>
  </div>;
}

function ConflictDialog({ value, onClose }: { value: { rule: Rule; conflict: Conflict } | null; onClose: () => void }) {
  const { t } = useI18n();
  return <Dialog open={Boolean(value)} title={t('This scene needs another edit')} onClose={onClose} tone="danger">{value && <div className="conflict-content"><div className="safety-lock"><AlertTriangle /><span><strong>{t('Conflict found by the engine')}</strong><small>{t('No scene was saved')}</small></span></div><p>{value.conflict.reason}</p><div className="rule-compare"><div><span>{t('Your edited scene')}</span><strong>{value.rule.name}</strong><small>{actionCopy(value.rule, [], t)}</small></div><div className="conflict-vs">{t('conflicts with')}</div><div className="protected"><span>{t('Existing rule')}</span><strong>{value.conflict.ruleB}</strong><small>{t('The engine kept the existing rule unchanged.')}</small></div></div><div className="dialog-actions"><button className="primary-button" onClick={onClose}>{t('Return to edit')}</button></div></div>}</Dialog>;
}

function EmergencyDialog({ open, sos, onClose, onTrigger }: { open: boolean; sos: SosEvent | null; onClose: () => void; onTrigger: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  async function send() { setBusy(true); try { await onTrigger(); } finally { setBusy(false); } }
  return <Dialog open={open} title={t(sos ? 'Help request sent' : 'Emergency help')} onClose={onClose} tone="danger"><div className="emergency-content">{sos ? <><div className="sos-confirm"><Check /></div><h3>{t('Building response has been alerted.')}</h3><p>Request {sos.id.slice(-6)} · {t('Active')}</p><div className="sos-detail"><span>{t('Status')}<strong>{t('Active')}</strong></span><span>{t('Escalated to')}<strong>{t('Operator desk')}</strong></span><span>{t('Sent')}<strong>{formatTime(sos.timestamp, locale)}</strong></span></div></> : <><div className="emergency-symbol"><HeartPulse /></div><h3>{t('Send an urgent help request?')}</h3><p>{t('This demo alerts the simulated building response desk. It does not contact emergency services.')}</p><button className="sos-button" onClick={send} disabled={busy}>{t(busy ? 'Sending…' : 'Send help request now')}</button></>}<button className="text-button centered" onClick={onClose}>{t(sos ? 'Close' : 'Cancel')}</button></div></Dialog>;
}

function HandoverDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (grant: CapabilityGrant) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('Nadia Perera'); const [unit, setUnit] = useState('405'); const [start, setStart] = useState('2026-10-01'); const [end, setEnd] = useState('2027-09-30'); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { const grant = await adapter.createGrant({ grant: { actor: name, apartmentId: `apt_${unit}`, role: 'tenant', scope: ['lock.unlock','ac.control','light.control','curtain.control'], validFrom: new Date(start + 'T00:00:00+05:30').toISOString(), validUntil: new Date(end + 'T23:59:59+05:30').toISOString() }, requestId: crypto.randomUUID() }); onSaved(grant); } finally { setBusy(false); } }
  return <Dialog open={open} title={t('Prepare unit handover')} onClose={onClose}><form className="handover-form" onSubmit={submit}><p>{t('Access begins with the lease and expires automatically at its end.')}</p><div className="form-two"><label>{t('Unit')}<select value={unit} onChange={(e) => setUnit(e.target.value)}><option>405</option><option>505</option><option>604</option></select></label><label>{t('Resident type')}<select><option>{t('Tenant')}</option><option>{t('Owner')}</option></select></label></div><label>{t('Resident name')}<input value={name} onChange={(e) => setName(e.target.value)} required /></label><div className="form-two"><label>{t('Lease begins')}<input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></label><label>{t('Lease ends')}<input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} required /></label></div><div className="scope-row"><ShieldCheck /><span><strong>{t('Resident controls')}</strong><small>{t('Entry, climate, lights and curtains · no operator scope')}</small></span></div><div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Cancel')}</button><button className="primary-button" disabled={busy}>{busy ? t('Activating…') : <>{t('Activate at lease start')} <ArrowRight /></>}</button></div></form></Dialog>;
}

export default App;
