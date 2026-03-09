import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { ensureAnonymousAuth, subscribeAuthState } from '../firebase/auth'
import { AuthContext, type AuthContextValue } from './authContext'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializeAuth = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      await ensureAnonymousAuth()
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Authentication failed.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    void initializeAuth()

    const unsubscribe = subscribeAuthState((nextUser) => {
      if (!mounted) {
        return
      }

      setUser(nextUser)
      setLoading(false)

      if (!nextUser) {
        void ensureAnonymousAuth().catch((authError) => {
          const message =
            authError instanceof Error ? authError.message : 'Authentication failed.'
          setError(message)
        })
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [initializeAuth])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      retry: initializeAuth,
    }),
    [error, initializeAuth, loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
