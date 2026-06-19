import { useNavigate } from 'react-router-dom'
import { AuthForm } from '../components/AuthForm'

const ForgotPassword = () => {
  const navigate = useNavigate()

  return (
    <div
      className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-bg-primary px-6 py-12"
      style={{
        fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', 'STSong', 'FangSong', serif",
      }}
    >
      <div className="w-full max-w-md">
        <AuthForm
          initialMode="forgot-password"
          autoFocus
          onAuthSuccess={() => {
            navigate('/login', { replace: true })
          }}
        />
      </div>
    </div>
  )
}

export default ForgotPassword
