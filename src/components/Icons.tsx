import { AirVent, Blinds, Flame, Lightbulb, LockKeyhole, Radio, ScanEye } from 'lucide-react';
import type { DeviceType } from '../domain/contracts';

export function DeviceIcon({ type, size = 20 }: { type: DeviceType; size?: number }) {
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true as const };
  if (type === 'light') return <Lightbulb {...props} />;
  if (type === 'curtain') return <Blinds {...props} />;
  if (type === 'ac') return <AirVent {...props} />;
  if (type === 'lock') return <LockKeyhole {...props} />;
  if (type === 'smoke') return <Flame {...props} />;
  if (type === 'motion') return <ScanEye {...props} />;
  return <Radio {...props} />;
}
