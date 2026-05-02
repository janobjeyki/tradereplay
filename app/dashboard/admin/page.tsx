import { Alert } from '@/components/ui'
import { requireAdminUser } from '@/lib/admin/requireAdmin'
import { AdminPanel } from './AdminPanel'

export default async function AdminPage() {
  const adminAuth = await requireAdminUser()

  if (adminAuth.error) {
    return (
      <div className="page-content">
        <Alert type="error" message="You do not have access to the admin panel." />
      </div>
    )
  }

  return <AdminPanel />
}
