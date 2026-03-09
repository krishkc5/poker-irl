interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

const getRequiredEnv = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRequiredEnv('VITE_FIREBASE_APP_ID'),
}
