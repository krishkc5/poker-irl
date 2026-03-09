import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { createRoom } from '../lib/firestoreApi'
import { normalizeRoomCode } from '../lib/roomCode'
import { normalizeDisplayName, validateDisplayName } from '../lib/validation'
import { Button, ErrorBanner, PageContainer, Panel, TextInput } from '../components/Ui'

export const LandingPage = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateRoom = async () => {
    if (!user) {
      return
    }

    const normalizedName = normalizeDisplayName(displayName)
    const nameError = validateDisplayName(normalizedName)
    if (nameError) {
      setError(nameError)
      return
    }

    setBusy(true)
    setError(null)

    try {
      const roomCode = await createRoom({ uid: user.uid, displayName: normalizedName })
      navigate(`/room/${roomCode}`)
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Failed to create room.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const handleJoinRoom = () => {
    const normalizedName = normalizeDisplayName(displayName)
    const normalizedCode = normalizeRoomCode(joinCode)

    const nameError = validateDisplayName(normalizedName)
    if (nameError) {
      setError(nameError)
      return
    }

    if (normalizedCode.length !== 6) {
      setError('Enter a valid 6-letter room code.')
      return
    }

    setError(null)
    navigate(`/room/${normalizedCode}`, {
      state: {
        preferredDisplayName: normalizedName,
      },
    })
  }

  return (
    <PageContainer>
      <div className="mx-auto grid min-h-[80vh] max-w-4xl items-center gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="border-emerald-300/20 bg-gradient-to-br from-emerald-500/20 to-emerald-950/45">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-200/90">Poker IRL</p>
          <h1 className="text-4xl font-extrabold leading-tight text-emerald-50 sm:text-5xl">
            Run real-life poker nights without paper math.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-emerald-100/90 sm:text-base">
            This app tracks room state, stacks, turns, blinds, betting actions, pot size, and
            showdown payouts while you play with a physical deck.
          </p>

          <div className="mt-6 grid gap-2 text-xs text-emerald-50/80 sm:grid-cols-3">
            <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-2">No card logic</div>
            <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-2">Realtime Firestore sync</div>
            <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-2">Mobile-ready table controls</div>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Join The Table
          </h2>

          {error ? <ErrorBanner message={error} /> : null}

          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-300" htmlFor="display-name">
                Display name
              </label>
              <TextInput
                id="display-name"
                maxLength={24}
                placeholder="e.g. Krish"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>

            <Button disabled={busy || authLoading || !user} onClick={() => void handleCreateRoom()}>
              {busy ? 'Creating Room...' : 'Create Room'}
            </Button>

            <div>
              <label className="mb-1 block text-xs text-slate-300" htmlFor="room-code">
                Room code
              </label>
              <TextInput
                id="room-code"
                maxLength={6}
                placeholder="ABCDEF"
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
              />
            </div>

            <Button
              variant="secondary"
              disabled={busy || authLoading || !user}
              onClick={handleJoinRoom}
            >
              Join Room
            </Button>
          </div>
        </Panel>
      </div>
    </PageContainer>
  )
}
