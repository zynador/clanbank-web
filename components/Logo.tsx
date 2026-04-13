// components/Logo.tsx
// TGM Consigliere – Gold-Shield, kein Polygon-Punkt

interface LogoProps {
  size?: number
  className?: string
}

export default function Logo({ size = 38, className = "" }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 44"
      width={size}
      height={Math.round(size * 1.1)}
      className={className}
    >
      <defs>
        <linearGradient id="goldOuter" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8C87A" />
          <stop offset="100%" stopColor="#A87C2A" />
        </linearGradient>
        <linearGradient id="goldInner" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1C1508" />
          <stop offset="100%" stopColor="#2A1E08" />
        </linearGradient>
      </defs>
      {/* Shield äussere Form */}
      <path
        d="M20 1 L38 7 L38 23 C38 33 29 39 20 41 C11 39 2 33 2 23 L2 7 Z"
        fill="url(#goldOuter)"
        opacity="0.9"
      />
      {/* Shield innere Form */}
      <path
        d="M20 4 L35 9 L35 23 C35 31 27.5 36.5 20 38 C12.5 36.5 5 31 5 23 L5 9 Z"
        fill="url(#goldInner)"
      />
      {/* C – kein Polygon-Punkt */}
      <text
        x="20"
        y="28"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="20"
        fontWeight="bold"
        fontStyle="italic"
        fill="url(#goldOuter)"
      >
        C
      </text>
    </svg>
  )
}
