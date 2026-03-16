import { MemberExemption, EXEMPTION_LABELS, EXEMPTION_ICONS, EXEMPTION_COLORS } from '@/types/exemptions';

interface Props {
  exemption: MemberExemption | undefined;
  showTooltip?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'unbegrenzt';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function ExemptionBadge({ exemption, showTooltip = true }: Props) {
  if (!exemption) return null;

  const label = EXEMPTION_LABELS[exemption.reason];
  const icon  = EXEMPTION_ICONS[exemption.reason];
  const color = EXEMPTION_COLORS[exemption.reason];
  const until = exemption.end_date
    ? `bis ${formatDate(exemption.end_date)}`
    : 'unbegrenzt';

  const tooltipText = [
    `${label} (${until})`,
    exemption.note ? `Notiz: ${exemption.note}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      title={showTooltip ? tooltipText : undefined}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {exemption.end_date && (
        <span className="opacity-70">· {formatDate(exemption.end_date)}</span>
      )}
    </span>
  );
}
