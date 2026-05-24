import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AccountMenu } from './AccountMenu'
import type { AuthMode } from './Navbar/types'
import { NotificationPanel } from './Navbar/NotificationPanel'

interface HeaderUserControlsProps {
  onLogout: () => void | Promise<void>
  onOpenAuth?: (mode: AuthMode) => void
}

export const HeaderUserControls = ({ onLogout, onOpenAuth }: HeaderUserControlsProps) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex items-center gap-4">
      {user ? <NotificationPanel onNavigate={navigate} /> : null}
      <AccountMenu onLogout={onLogout} onOpenAuth={onOpenAuth} />
    </div>
  )
}
