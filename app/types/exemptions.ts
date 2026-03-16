export type ExemptionReason = 'urlaub' | 'raidleiter' | 'krank' | 'sonstiges';

export const EXEMPTION_LABELS: Record<ExemptionReason, string> = {
  urlaub:     'Urlaub',
  raidleiter: 'Raidleiter',
  krank:      'Krank',
  sonstiges:  'Sonstiges',
};

export const EXEMPTION_COLORS: Record<ExemptionReason, string> = {
  urlaub:     'bg-amber-100 text-amber-800',
  raidleiter: 'bg-teal-100 text-teal-800',
  krank:      'bg-red-100 text-red-800',
  sonstiges:  'bg-gray-100 text-gray-700',
};

export const EXEMPTION_ICONS: Record<ExemptionReason, string> = {
  urlaub:     '🏖',
  raidleiter: '⚔️',
  krank:      '🤒',
  sonstiges:  'ℹ️',
};

export interface MemberExemption {
  exemption_id: string;
  user_id:      string;
  username:     string;
  ingame_name:  string;
  reason:       ExemptionReason;
  note:         string | null;
  start_date:   string;
  end_date:     string | null;
}

export interface SetExemptionParams {
  p_user_id:    string;
  p_reason:     ExemptionReason;
  p_note?:      string | null;
  p_start_date?: string;
  p_end_date?:  string | null;
}
