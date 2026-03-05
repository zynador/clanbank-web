import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-bold text-gray-800 mb-2">404</div>
        <h2 className="text-lg font-semibold text-gray-100 mb-2">
          Seite nicht gefunden
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Die angeforderte Seite existiert nicht.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
