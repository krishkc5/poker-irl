import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { LobbyView } from '../components/LobbyView'
import { RoomHeader } from '../components/RoomHeader'
import { TableView } from '../components/TableView'
import {
  Button,
  ErrorBanner,
  LoadingView,
  PageContainer,
  Panel,
  TextInput,
} from '../components/Ui'
import { useAuth } from '../hooks/useAuth'
import { useRoomData } from '../hooks/useRoomData'
import {
  advanceStreet,
  autoAssignSeats,
  joinRoom,
  leaveRoom,
  removePlayer,
  resetHand,
  settleShowdown,
  startGame,
  startNewHand,
  submitAction,
  updateRoomSettings,
} from '../lib/firestoreApi'
import { normalizeRoomCode } from '../lib/roomCode'
import { normalizeDisplayName, validateDisplayName } from '../lib/validation'
import type { ActionInput, RoomSettingsInput } from '../types/game'

interface RouteState {
  preferredDisplayName?: string
}

export const RoomPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as RouteState | null
  const { roomCode: routeRoomCode = '' } = useParams()
  const normalizedRoomCode = normalizeRoomCode(routeRoomCode)

  const { user, loading: authLoading, error: authError, retry } = useAuth()

  const { room, players, actions, hands, loading, error: roomError } = useRoomData(normalizedRoomCode)

  const [displayName, setDisplayName] = useState(routeState?.preferredDisplayName ?? '')
  const [busy, setBusy] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  useEffect(() => {
    if (routeState?.preferredDisplayName) {
      setDisplayName(routeState.preferredDisplayName)
    }
  }, [routeState?.preferredDisplayName])

  const currentPlayer = useMemo(
    () => (user ? players.find((player) => player.uid === user.uid) ?? null : null),
    [players, user],
  )

  const handleFailure = (error: unknown, fallback: string): void => {
    const message = error instanceof Error ? error.message : fallback
    setOperationError(message)
  }

  const runOperation = async (operation: () => Promise<void>, fallbackError: string) => {
    setBusy(true)
    setOperationError(null)

    try {
      await operation()
    } catch (error) {
      handleFailure(error, fallbackError)
    } finally {
      setBusy(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!user || !room) {
      return
    }

    const normalizedName = normalizeDisplayName(displayName)
    const validationError = validateDisplayName(normalizedName)
    if (validationError) {
      setOperationError(validationError)
      return
    }

    await runOperation(
      async () => {
        await joinRoom({
          roomCode: room.code,
          uid: user.uid,
          displayName: normalizedName,
        })
      },
      'Unable to join room.',
    )
  }

  const handleLeaveRoom = async () => {
    if (!user || !room) {
      navigate('/')
      return
    }

    await leaveRoom({ roomCode: room.code, uid: user.uid })
    navigate('/')
  }

  const canRenderRoom = Boolean(room && user)

  if (authLoading || loading) {
    return (
      <PageContainer>
        <Panel>
          <LoadingView label="Connecting to Poker IRL..." />
        </Panel>
      </PageContainer>
    )
  }

  if (!user) {
    return (
      <PageContainer>
        <Panel className="mx-auto max-w-xl">
          <ErrorBanner message={authError ?? 'Authentication failed.'} />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void retry()}>Retry auth</Button>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Back Home
            </Button>
          </div>
        </Panel>
      </PageContainer>
    )
  }

  if (!normalizedRoomCode || !room) {
    return (
      <PageContainer>
        <Panel className="mx-auto max-w-xl">
          <ErrorBanner message={roomError ?? 'Room not found.'} />
          <div className="mt-3">
            <Button variant="secondary" onClick={() => navigate('/')}>
              Back to Landing
            </Button>
          </div>
        </Panel>
      </PageContainer>
    )
  }

  if (!currentPlayer) {
    return (
      <PageContainer>
        <div className="mx-auto max-w-xl">
          <RoomHeader room={room} players={players} currentUid={user.uid} onLeave={handleLeaveRoom} />
          <Panel>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Join Room {room.code}
            </h2>

            {operationError ? <ErrorBanner message={operationError} /> : null}

            <label className="mb-1 block text-xs text-slate-300" htmlFor="join-display-name">
              Display name
            </label>
            <TextInput
              id="join-display-name"
              maxLength={24}
              value={displayName}
              placeholder="Your name"
              onChange={(event) => setDisplayName(event.target.value)}
            />

            <div className="mt-3 flex gap-2">
              <Button disabled={busy} onClick={() => void handleJoinRoom()}>
                {busy ? 'Joining...' : 'Join Room'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')}>
                Back
              </Button>
            </div>
          </Panel>
        </div>
      </PageContainer>
    )
  }

  if (!canRenderRoom) {
    return (
      <PageContainer>
        <Panel>
          <LoadingView />
        </Panel>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <RoomHeader room={room} players={players} currentUid={user.uid} onLeave={handleLeaveRoom} />

      {roomError ? <ErrorBanner message={roomError} /> : null}

      {room.status === 'lobby' ? (
        <LobbyView
          key={`${room.startingStack}-${room.smallBlind}-${room.bigBlind}`}
          room={room}
          players={players}
          currentUid={user.uid}
          operationError={operationError}
          busy={busy}
          onUpdateSettings={(settings: RoomSettingsInput) =>
            runOperation(
              () => updateRoomSettings({ roomCode: room.code, requesterUid: user.uid, settings }),
              'Failed to update room settings.',
            )
          }
          onAutoAssignSeats={() =>
            runOperation(
              () => autoAssignSeats({ roomCode: room.code, requesterUid: user.uid }),
              'Failed to auto assign seats.',
            )
          }
          onStartGame={() =>
            runOperation(
              () => startGame({ roomCode: room.code, requesterUid: user.uid }),
              'Failed to start game.',
            )
          }
          onRemovePlayer={(targetUid: string) =>
            runOperation(
              () => removePlayer({ roomCode: room.code, requesterUid: user.uid, targetUid }),
              'Failed to remove player.',
            )
          }
        />
      ) : (
        <TableView
          room={room}
          players={players}
          actions={actions}
          hands={hands}
          currentUid={user.uid}
          busy={busy}
          operationError={operationError}
          onSubmitAction={(input: ActionInput) =>
            runOperation(
              () => submitAction({ roomCode: room.code, uid: user.uid, input }),
              'Failed to submit action.',
            )
          }
          onStartNewHand={() =>
            runOperation(
              () => startNewHand({ roomCode: room.code, requesterUid: user.uid }),
              'Failed to start new hand.',
            )
          }
          onAdvanceStreet={() =>
            runOperation(
              () => advanceStreet({ roomCode: room.code, requesterUid: user.uid }),
              'Failed to advance street.',
            )
          }
          onResetHand={() =>
            runOperation(
              () => resetHand({ roomCode: room.code, requesterUid: user.uid }),
              'Failed to reset hand.',
            )
          }
          onSettleShowdown={(winnerUids: string[]) =>
            runOperation(
              () =>
                settleShowdown({
                  roomCode: room.code,
                  requesterUid: user.uid,
                  winnerUids,
                }),
              'Failed to settle showdown.',
            )
          }
        />
      )}
    </PageContainer>
  )
}
