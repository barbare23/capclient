import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail } from 'lucide-react'

export default function Parametres() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Paramètres</h2>
        <p className="text-sm text-gray-500 mt-1">Gestion de votre compte et support</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            Une question ? Besoin d'aide ? Écrivez-nous à :
          </p>
          <a
            href="mailto:contact@capclient.fr"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            contact@capclient.fr
            <Mail className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
