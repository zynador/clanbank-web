export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-5xl">🎮</div>
        <h1 className="text-2xl font-bold text-teal-400">Clanbank Demo</h1>
        <p className="text-gray-400 leading-relaxed">
          Die interaktive Demo befindet sich in Vorbereitung.
          <br />
          Schau bald wieder vorbei!
        </p>
        <p className="text-gray-500 text-sm">
          The interactive demo is coming soon.
        </p>
        <a
          href="/login"
          className="inline-block mt-4 px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium transition-colors"
        >
          {'🔐 Zur Anmeldung / Sign in'}
        </a>
      </div>
    </div>
  )
}
