export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-16">
          <h1 className="text-xl font-bold text-gray-900">CapClient</h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Tableau de bord</h2>
        <p className="text-gray-600">Bienvenue sur CapClient. Commencez par ajouter vos premiers clients.</p>
      </main>
    </div>
  )
}
