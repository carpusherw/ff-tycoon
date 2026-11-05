import type { DeptKey } from '../rules/types';

/** One-color UI icons from the style mockup; they draw in `currentColor` so they follow the tokens. */

/** Details punched out of an icon take the card color behind it. */
const CUTOUT_FILL = { fill: 'var(--panel)' };
const CUTOUT_STROKE = { stroke: 'var(--panel)' };

export function BoatIcon({ size = 22 }: { size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M3 14h18l-3 5H6z" fill="currentColor" />
      <rect x="6" y="9" width="4" height="4" rx="1" fill="currentColor" />
      <rect x="11" y="9" width="4" height="4" rx="1" fill="currentColor" opacity=".7" />
      <rect x="8.5" y="5" width="4" height="4" rx="1" fill="currentColor" opacity=".55" />
    </svg>
  );
}

function ChatIcon({ size }: { size: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
        fill="currentColor"
      />
      <circle cx="8.5" cy="10.5" r="1.3" style={CUTOUT_FILL} />
      <circle cx="12" cy="10.5" r="1.3" style={CUTOUT_FILL} />
      <circle cx="15.5" cy="10.5" r="1.3" style={CUTOUT_FILL} />
    </svg>
  );
}

function LedgerIcon({ size }: { size: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="4" y="3" width="16" height="18" rx="3" fill="currentColor" />
      <path d="M8 8h8M8 12h8M8 16h5" fill="none" strokeWidth="2" strokeLinecap="round" style={CUTOUT_STROKE} />
    </svg>
  );
}

export function DeptIcon({ dept, size = 22 }: { dept: DeptKey; size?: number }) {
  if (dept === 'sales') return <ChatIcon size={size} />;
  if (dept === 'ops') return <BoatIcon size={size} />;
  return <LedgerIcon size={size} />;
}

export function DiceIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="16" cy="8" r="1.6" fill="currentColor" />
      <circle cx="8" cy="16" r="1.6" fill="currentColor" />
    </svg>
  );
}
