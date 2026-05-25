import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthForm } from '../components/AuthForm'
import { useAuth } from '../context/AuthContext'

function getSafeRedirectTarget(redirect: string | null): string {
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
    return '/'
  }

  return redirect
}

const Login = () => {
  const { user, loading, ensureInitialized } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTarget = getSafeRedirectTarget(searchParams.get('redirect'))

  useEffect(() => {
    void ensureInitialized()
  }, [ensureInitialized])

  if (!loading && user) {
    return <Navigate to={redirectTarget} replace />
  }

  return (
    <div
      className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-bg-primary px-6 py-12"
      style={{
        fontFamily: "'Noto Serif SC', 'Source Han Serif SC', 'SimSun', 'STSong', 'FangSong', serif",
      }}
    >
      <div className="w-full max-w-md">
        <AuthForm
          initialMode="login"
          autoFocus
          onAuthSuccess={() => {
            navigate(redirectTarget, { replace: true })
          }}
        />
      </div>
    </div>
  )
}

export default Login
