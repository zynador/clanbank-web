// components/Logo.tsx
// 1Ca-Bank Logo – Alle drei Varianten als React-Komponente

type LogoVariant = "large" | "small" | "favicon";

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

export default function Logo({ variant = "large", className = "" }: LogoProps) {
  if (variant === "favicon") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width="64"
        height="64"
        className={className}
      >
        <defs>
          <linearGradient id="tealGradF" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="shieldGradF" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="80%" stopColor="#0d9488" />
          </linearGradient>
          <linearGradient id="shieldInnerF" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="#0f172a" />
        <circle cx="32" cy="32" r="29" fill="none" stroke="#2dd4bf" strokeWidth="0.8" opacity="0.3" />
        <g transform="translate(12, 6)">
          <path d="M20 2 L37 8 L37 24 C37 34 29 40 20 42 C11 40 3 34 3 24 L3 8 Z" fill="url(#shieldGradF)" opacity="0.9" />
          <path d="M20 5.5 L34 10 L34 24 C34 32 27 37 20 38.5 C13 37 6 32 6 24 L6 10 Z" fill="url(#shieldInnerF)" />
          <polygon points="20,8 22,11 20,14 18,11" fill="#5eead4" opacity="0.5" />
          <text x="20" y="32" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="18" fontWeight="bold" fontStyle="italic" fill="url(#tealGradF)">1C</text>
        </g>
      </svg>
    );
  }

  if (variant === "small") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 29"
        width="120"
        height="29"
        className={className}
      >
        <defs>
          <linearGradient id="tealGradS" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="shieldGradS" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="80%" stopColor="#0d9488" />
          </linearGradient>
          <linearGradient id="shieldInnerS" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>
        <g transform="translate(2, 2) scale(0.6)">
          <path d="M20 0 L38 6 L38 22 C38 32 29 38 20 40 C11 38 2 32 2 22 L2 6 Z" fill="url(#shieldGradS)" opacity="0.9" />
          <path d="M20 3 L35 8 L35 22 C35 30 27.5 35.5 20 37 C12.5 35.5 5 30 5 22 L5 8 Z" fill="url(#shieldInnerS)" />
          <text x="20" y="27" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="20" fontWeight="bold" fontStyle="italic" fill="url(#tealGradS)">C</text>
          <polygon points="20,5 22,7.5 20,10 18,7.5" fill="#5eead4" opacity="0.6" />
        </g>
        <text x="30" y="20" fontFamily="Georgia, 'Times New Roman', serif" fontSize="17" fontWeight="bold" letterSpacing="-0.3" fill="url(#tealGradS)">1Ca</text>
        <line x1="62" y1="7" x2="62" y2="22" stroke="#2dd4bf" strokeWidth="1" opacity="0.3" />
        <text x="67" y="19" fontFamily="system-ui, -apple-system, sans-serif" fontSize="11" fontWeight="300" letterSpacing="2" fill="#5eead4" opacity="0.55">BANK</text>
      </svg>
    );
  }

  // Default: large
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 48"
      width="200"
      height="48"
      className={className}
    >
      <defs>
        <linearGradient id="tealGradL" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
        <linearGradient id="shieldGradL" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="80%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="shieldInnerL" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <g transform="translate(10, 4)">
        <path d="M20 0 L38 6 L38 22 C38 32 29 38 20 40 C11 38 2 32 2 22 L2 6 Z" fill="url(#shieldGradL)" opacity="0.9" />
        <path d="M20 3 L35 8 L35 22 C35 30 27.5 35.5 20 37 C12.5 35.5 5 30 5 22 L5 8 Z" fill="url(#shieldInnerL)" />
        <text x="20" y="27" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="20" fontWeight="bold" fontStyle="italic" fill="url(#tealGradL)">C</text>
        <polygon points="20,5 22,7.5 20,10 18,7.5" fill="#5eead4" opacity="0.6" />
      </g>
      <text x="56" y="33" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fontWeight="bold" letterSpacing="-0.5" fill="url(#tealGradL)">1Ca</text>
      <line x1="107" y1="12" x2="107" y2="36" stroke="#2dd4bf" strokeWidth="1.5" opacity="0.3" />
      <text x="115" y="31" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="300" letterSpacing="3" fill="#5eead4" opacity="0.6">BANK</text>
      <line x1="56" y1="38" x2="170" y2="38" stroke="#2dd4bf" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}
