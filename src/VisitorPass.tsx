import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, KeyRound, MapPin } from 'lucide-react';
import { adapter } from './data';
import type { CapabilityGrant } from './domain/contracts';
import { passPayload, qrDataUrl } from './data/passQr';
import { useI18n } from './i18n';

const APARTMENT_ID = 'apt_401';
type PassState = 'pending' | 'active' | 'expired';

function backupCode(grant: CapabilityGrant) {
  const suffix = grant.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase().padStart(6, '0');
  return `C401-${suffix.slice(0, 3)}-${suffix.slice(3)}`;
}

function passState(grant: CapabilityGrant, now: number): PassState {
  if (now < Date.parse(grant.validFrom)) return 'pending';
  if (now >= Date.parse(grant.validUntil)) return 'expired';
  if (!grant.recurring) return 'active';
  const date = new Date(now);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Colombo', weekday: 'short' }).format(date).slice(0, 3).toLowerCase();
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return grant.recurring.days.includes(day as NonNullable<CapabilityGrant['recurring']>['days'][number]) && time >= grant.recurring.startTime && time < grant.recurring.endTime ? 'active' : 'pending';
}

function Mark() { return <div className="visitor-mark" aria-hidden="true"><span /><span /><span /></div>; }

export default function VisitorPass() {
  const { t, locale } = useI18n();
  const [grant, setGrant] = useState<CapabilityGrant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const grantId = decodeURIComponent(location.pathname.split('/').filter(Boolean).at(-1) ?? '');
  const suppliedCode = new URLSearchParams(location.search).get('code');

  useEffect(() => {
    const controller = new AbortController();
    adapter.fetchGrants(APARTMENT_ID, controller.signal).then((items) => {
      const match = items.find((item) => item.id === grantId);
      if (!match || suppliedCode !== backupCode(match)) throw new Error(t('This demo pass is invalid or no longer available.'));
      setGrant(match);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t('The pass could not be loaded.')); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [grantId, suppliedCode, t]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  if (loading) return <main className="visitor-shell visitor-loading"><Mark /><p>{t('Loading visitor pass…')}</p></main>;
  if (error || !grant) return <main className="visitor-shell"><section className="visitor-error"><AlertTriangle /><h1>{t('Pass unavailable')}</h1><p>{error ?? t('The pass could not be loaded.')}</p></section></main>;

  const state = passState(grant, now);
  const code = backupCode(grant);
  const qr = qrDataUrl(passPayload(grant.id, code));
  return <main className="visitor-shell"><section className="visitor-card"><header><Mark /><span>CONCORD VISITOR</span></header><span className={`grant-status ${state}`}>{t(state)}</span><div className="visitor-state-icon">{state === 'active' ? <Check /> : state === 'expired' ? <AlertTriangle /> : <Clock3 />}</div><h1>{grant.actor}</h1><p className="visitor-role">{t(grant.role)}</p><img className="visitor-qr" src={qr} alt={t('QR code for {name}', { name: grant.actor })} />
    <div className="visitor-details"><div><MapPin /><span>{t('Destination')}<strong>{t('Aster Tower · Apartment 401')}</strong></span></div><div><Clock3 /><span>{t('Access window')}<strong>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(grant.validFrom))}<br />{t('to')} {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(grant.validUntil))}</strong></span></div>{grant.recurring && <div><CalendarDays /><span>{t('Weekly schedule')}<strong>{grant.recurring.days.map((day) => t(day)).join(' · ')}<br />{grant.recurring.startTime}–{grant.recurring.endTime}</strong></span></div>}<div><KeyRound /><span>{t('Backup code')}<strong>{code}</strong></span></div></div>
    <p className="visitor-trust">{t('This QR identifies the demo pass. The building backend validates access; the QR alone does not unlock a door.')}</p>
  </section></main>;
}
