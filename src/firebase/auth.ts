import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from './client'

export const ensureAnonymousAuth = async (): Promise<User> => {
  if (auth.currentUser) {
    return auth.currentUser
  }

  const credential = await signInAnonymously(auth)
  return credential.user
}

export const subscribeAuthState = (callback: (user: User | null) => void): (() => void) =>
  onAuthStateChanged(auth, callback)
