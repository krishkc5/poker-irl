import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type DocumentSnapshot,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type Transaction,
} from 'firebase/firestore'
import { db } from '../firebase/client'
import type {
  ActionDoc,
  ActionInput,
  HandDoc,
  PlayerDoc,
  RoomDoc,
  RoomSettingsInput,
  Street,
} from '../types/game'
import {
  findNextSeat,
  getActionOrderSummary,
  getAmountToCall,
  getFirstPostFlopActingSeat,
  getLegalActions,
  getNextActingSeat,
  getNextStreet,
  getUncalledOverbetRefunds,
  getRemainingInHandPlayers,
  hasSingleRemainingPlayer,
  initializeNewHand,
  isBettingRoundComplete,
  isPlayerAbleToAct,
  splitPotAcrossWinners,
} from './gameEngine'
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode'
import { normalizeDisplayName, validateDisplayName, validateRoomSettings } from './validation'

const DEFAULT_STARTING_STACK = 1000
const DEFAULT_SMALL_BLIND = 5
const DEFAULT_BIG_BLIND = 10
const MAX_ACTIONS = 250
const MAX_HANDS = 40
const COLLISION_ERROR = 'ROOM_CODE_COLLISION'

const getRoomRef = (roomCode: string) => doc(db, 'rooms', normalizeRoomCode(roomCode))
const getPlayersCollection = (roomCode: string) =>
  collection(db, 'rooms', normalizeRoomCode(roomCode), 'players')
const getActionsCollection = (roomCode: string) =>
  collection(db, 'rooms', normalizeRoomCode(roomCode), 'actions')
const getHandsCollection = (roomCode: string) =>
  collection(db, 'rooms', normalizeRoomCode(roomCode), 'hands')

const ensureRoomCode = (roomCode: string): string => {
  const normalized = normalizeRoomCode(roomCode)
  if (!isValidRoomCode(normalized)) {
    throw new Error('Room code must be 6 uppercase letters.')
  }

  return normalized
}

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return value
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string')
}

const isPermissionDeniedError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  String((error as { code: unknown }).code).includes('permission-denied')

const asRoomDoc = (snapshot: DocumentSnapshot<DocumentData>): RoomDoc => {
  const data = snapshot.data() ?? {}

  return {
    code: typeof data.code === 'string' ? data.code : snapshot.id,
    hostUid: typeof data.hostUid === 'string' ? data.hostUid : '',
    status: data.status === 'active' ? 'active' : 'lobby',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    startingStack: toNumber(data.startingStack, DEFAULT_STARTING_STACK),
    smallBlind: toNumber(data.smallBlind, DEFAULT_SMALL_BLIND),
    bigBlind: toNumber(data.bigBlind, DEFAULT_BIG_BLIND),
    dealerSeat: typeof data.dealerSeat === 'number' ? data.dealerSeat : null,
    currentTurnSeat: typeof data.currentTurnSeat === 'number' ? data.currentTurnSeat : null,
    currentBet: toNumber(data.currentBet, 0),
    minRaise: toNumber(data.minRaise, DEFAULT_BIG_BLIND),
    pot: toNumber(data.pot, 0),
    handNumber: toNumber(data.handNumber, 0),
    street: (['preflop', 'flop', 'turn', 'river', 'showdown'] as Street[]).includes(data.street)
      ? data.street
      : 'preflop',
    gameStarted: Boolean(data.gameStarted),
    lastAction: typeof data.lastAction === 'string' ? data.lastAction : null,
    winnersUids: toStringArray(data.winnersUids),
    lastAggressorSeat: typeof data.lastAggressorSeat === 'number' ? data.lastAggressorSeat : null,
  }
}

const asPlayerDoc = (
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): PlayerDoc => {
  const data = snapshot.data() ?? {}

  return {
    uid: typeof data.uid === 'string' ? data.uid : snapshot.id,
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Player',
    seat: typeof data.seat === 'number' ? data.seat : null,
    stack: toNumber(data.stack, DEFAULT_STARTING_STACK),
    folded: Boolean(data.folded),
    allIn: Boolean(data.allIn),
    inHand: Boolean(data.inHand),
    currentStreetContribution: toNumber(data.currentStreetContribution, 0),
    totalHandContribution: toNumber(data.totalHandContribution, 0),
    joinedAt: data.joinedAt ?? null,
    isHost: Boolean(data.isHost),
    hasActedThisStreet: Boolean(data.hasActedThisStreet),
  }
}

const asActionDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): ActionDoc => {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    uid: typeof data.uid === 'string' ? data.uid : null,
    displayName: typeof data.displayName === 'string' ? data.displayName : 'System',
    type:
      data.type === 'check' ||
      data.type === 'call' ||
      data.type === 'bet' ||
      data.type === 'raise' ||
      data.type === 'fold' ||
      data.type === 'all_in'
        ? data.type
        : 'system',
    amount: toNumber(data.amount, 0),
    createdAt: data.createdAt ?? null,
    handNumber: toNumber(data.handNumber, 0),
    street: (['preflop', 'flop', 'turn', 'river', 'showdown'] as Street[]).includes(data.street)
      ? data.street
      : 'preflop',
    message: typeof data.message === 'string' ? data.message : '',
  }
}

const asHandDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): HandDoc => {
  const data = snapshot.data()

  const winners = Array.isArray(data.winners)
    ? data.winners
        .filter(
          (winner): winner is { uid: string; displayName: string } =>
            typeof winner?.uid === 'string' && typeof winner?.displayName === 'string',
        )
        .map((winner) => ({ uid: winner.uid, displayName: winner.displayName }))
    : []

  return {
    id: snapshot.id,
    handNumber: toNumber(data.handNumber, 0),
    settledAt: data.settledAt ?? null,
    winners,
    pot: toNumber(data.pot, 0),
    summary: typeof data.summary === 'string' ? data.summary : '',
    actions: toStringArray(data.actions),
  }
}

const normalizePlayersWithSeats = (players: PlayerDoc[]): PlayerDoc[] => {
  const seated = [...players].sort((a, b) => {
    if (a.seat !== null && b.seat !== null) {
      return a.seat - b.seat
    }

    if (a.seat !== null) {
      return -1
    }

    if (b.seat !== null) {
      return 1
    }

    const left = a.joinedAt?.toMillis() ?? 0
    const right = b.joinedAt?.toMillis() ?? 0
    return left - right
  })

  const usedSeats = new Set<number>()
  for (const player of seated) {
    if (player.seat !== null) {
      usedSeats.add(player.seat)
    }
  }

  let nextSeat = 1
  return seated.map((player) => {
    if (player.seat !== null) {
      return player
    }

    while (usedSeats.has(nextSeat)) {
      nextSeat += 1
    }

    const assignedSeat = nextSeat
    usedSeats.add(assignedSeat)
    nextSeat += 1

    return {
      ...player,
      seat: assignedSeat,
    }
  })
}

const getPlayerDocRef = (roomCode: string, uid: string) =>
  doc(getPlayersCollection(roomCode), uid)

const addAction = (
  transaction: Transaction,
  roomCode: string,
  payload: Omit<ActionDoc, 'id' | 'createdAt'>,
): void => {
  const actionRef = doc(getActionsCollection(roomCode))
  transaction.set(actionRef, {
    ...payload,
    createdAt: serverTimestamp(),
  })
}

const assertRoomHost = (room: RoomDoc, requesterUid: string): void => {
  if (room.hostUid !== requesterUid) {
    throw new Error('Only the host can perform this action.')
  }
}

const sortByJoinedAt = (players: PlayerDoc[]): PlayerDoc[] =>
  [...players].sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))

export const subscribeRoom = (
  roomCode: string,
  onData: (room: RoomDoc | null) => void,
  onError: (error: FirestoreError) => void,
): (() => void) =>
  onSnapshot(
    getRoomRef(roomCode),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null)
        return
      }

      onData(asRoomDoc(snapshot))
    },
    onError,
  )

export const subscribePlayers = (
  roomCode: string,
  onData: (players: PlayerDoc[]) => void,
  onError: (error: FirestoreError) => void,
): (() => void) =>
  onSnapshot(
    query(getPlayersCollection(roomCode), orderBy('joinedAt')),
    (snapshot) => {
      onData(snapshot.docs.map(asPlayerDoc))
    },
    onError,
  )

export const subscribeActions = (
  roomCode: string,
  onData: (actions: ActionDoc[]) => void,
  onError: (error: FirestoreError) => void,
): (() => void) =>
  onSnapshot(
    query(getActionsCollection(roomCode), orderBy('createdAt', 'asc'), limit(MAX_ACTIONS)),
    (snapshot) => {
      onData(snapshot.docs.map(asActionDoc))
    },
    onError,
  )

export const subscribeHands = (
  roomCode: string,
  onData: (hands: HandDoc[]) => void,
  onError: (error: FirestoreError) => void,
): (() => void) =>
  onSnapshot(
    query(getHandsCollection(roomCode), orderBy('handNumber', 'desc'), limit(MAX_HANDS)),
    (snapshot) => {
      onData(snapshot.docs.map(asHandDoc))
    },
    onError,
  )

export const createRoom = async ({
  uid,
  displayName,
}: {
  uid: string
  displayName: string
}): Promise<string> => {
  const nameError = validateDisplayName(displayName)
  if (nameError) {
    throw new Error(nameError)
  }

  const normalizedName = normalizeDisplayName(displayName)

  for (let attempts = 0; attempts < 20; attempts += 1) {
    const code = generateRoomCode()

    try {
      await runTransaction(db, async (transaction) => {
        const roomRef = getRoomRef(code)
        const roomSnapshot = await transaction.get(roomRef)
        if (roomSnapshot.exists()) {
          throw new Error(COLLISION_ERROR)
        }

        const roomData = {
          code,
          hostUid: uid,
          status: 'lobby' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          startingStack: DEFAULT_STARTING_STACK,
          smallBlind: DEFAULT_SMALL_BLIND,
          bigBlind: DEFAULT_BIG_BLIND,
          dealerSeat: null,
          currentTurnSeat: null,
          currentBet: 0,
          minRaise: DEFAULT_BIG_BLIND,
          pot: 0,
          handNumber: 0,
          street: 'preflop' as const,
          gameStarted: false,
          lastAction: `${normalizedName} created the room.`,
          winnersUids: [] as string[],
          lastAggressorSeat: null,
        }

        transaction.set(roomRef, roomData)
      })

      const hostRef = getPlayerDocRef(code, uid)
      try {
        await setDoc(hostRef, {
          uid,
          displayName: normalizedName,
          seat: 1,
          stack: DEFAULT_STARTING_STACK,
          folded: false,
          allIn: false,
          inHand: false,
          currentStreetContribution: 0,
          totalHandContribution: 0,
          joinedAt: serverTimestamp(),
          isHost: true,
          hasActedThisStreet: false,
        })
      } catch (error) {
        try {
          await deleteDoc(getRoomRef(code))
        } catch {
          // If cleanup fails, surface the original error.
        }

        throw error
      }

      try {
        await addDoc(getActionsCollection(code), {
          uid: null,
          displayName: 'System',
          type: 'system',
          amount: 0,
          handNumber: 0,
          street: 'preflop',
          message: `${normalizedName} created room ${code}.`,
          createdAt: serverTimestamp(),
        })
      } catch (error) {
        if (!isPermissionDeniedError(error)) {
          throw error
        }
      }

      return code
    } catch (error) {
      if (error instanceof Error && error.message === COLLISION_ERROR) {
        continue
      }

      throw error
    }
  }

  throw new Error('Could not generate a unique room code. Please try again.')
}

export const joinRoom = async ({
  roomCode,
  uid,
  displayName,
}: {
  roomCode: string
  uid: string
  displayName: string
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)
  const normalizedName = normalizeDisplayName(displayName)
  const nameError = validateDisplayName(normalizedName)

  if (nameError) {
    throw new Error(nameError)
  }

  const joinResult = await runTransaction<{
    joinedAsNewPlayer: boolean
    handNumber: number
    street: Street
  }>(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found. Check the code and try again.')
    }

    const room = asRoomDoc(roomSnapshot)
    const playerRef = getPlayerDocRef(normalizedCode, uid)
    const playerSnapshot = await transaction.get(playerRef)

    if (room.status !== 'lobby' && !playerSnapshot.exists()) {
      throw new Error('This game is already in progress.')
    }

    if (playerSnapshot.exists()) {
      transaction.update(playerRef, {
        displayName: normalizedName,
      })
    } else {
      transaction.set(playerRef, {
        uid,
        displayName: normalizedName,
        seat: null,
        stack: room.startingStack,
        folded: false,
        allIn: false,
        inHand: false,
        currentStreetContribution: 0,
        totalHandContribution: 0,
        joinedAt: serverTimestamp(),
        isHost: false,
        hasActedThisStreet: false,
      })
    }

    return {
      joinedAsNewPlayer: !playerSnapshot.exists(),
      handNumber: room.handNumber,
      street: room.street,
    }
  })

  if (!joinResult.joinedAsNewPlayer) {
    return
  }

  try {
    await addDoc(getActionsCollection(normalizedCode), {
      uid,
      displayName: normalizedName,
      type: 'system',
      amount: 0,
      handNumber: joinResult.handNumber,
      street: joinResult.street,
      message: `${normalizedName} joined the room.`,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error
    }
  }
}

export const leaveRoom = async ({ roomCode, uid }: { roomCode: string; uid: string }): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      return
    }

    const room = asRoomDoc(roomSnapshot)

    const playersSnapshot = await getDocs(
      query(getPlayersCollection(normalizedCode), orderBy('joinedAt')),
    )

    const players = playersSnapshot.docs.map(asPlayerDoc)
    const leavingPlayer = players.find((player) => player.uid === uid)
    if (!leavingPlayer) {
      return
    }

    transaction.delete(getPlayerDocRef(normalizedCode, uid))

    const remainingPlayers = players.filter((player) => player.uid !== uid)
    if (!remainingPlayers.length) {
      transaction.delete(roomRef)
      return
    }

    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      lastAction: `${leavingPlayer.displayName} left the room.`,
    }

    if (room.hostUid === uid) {
      const nextHost = sortByJoinedAt(remainingPlayers)[0]
      updates.hostUid = nextHost.uid
      transaction.update(getPlayerDocRef(normalizedCode, nextHost.uid), { isHost: true })
    }

    transaction.update(roomRef, updates)

    addAction(transaction, normalizedCode, {
      uid,
      displayName: leavingPlayer.displayName,
      type: 'system',
      amount: 0,
      handNumber: room.handNumber,
      street: room.street,
      message: `${leavingPlayer.displayName} left the room.`,
    })
  })
}

export const removePlayer = async ({
  roomCode,
  requesterUid,
  targetUid,
}: {
  roomCode: string
  requesterUid: string
  targetUid: string
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  if (requesterUid === targetUid) {
    throw new Error('Use Leave Room to remove yourself.')
  }

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    if (room.status !== 'lobby') {
      throw new Error('Players can only be removed in the lobby.')
    }

    const targetRef = getPlayerDocRef(normalizedCode, targetUid)
    const targetSnapshot = await transaction.get(targetRef)
    if (!targetSnapshot.exists()) {
      return
    }

    const target = asPlayerDoc(targetSnapshot)
    transaction.delete(targetRef)

    transaction.update(roomRef, {
      updatedAt: serverTimestamp(),
      lastAction: `${target.displayName} was removed by the host.`,
    })

    addAction(transaction, normalizedCode, {
      uid: requesterUid,
      displayName: 'System',
      type: 'system',
      amount: 0,
      handNumber: room.handNumber,
      street: room.street,
      message: `${target.displayName} was removed by the host.`,
    })
  })
}

export const updateRoomSettings = async ({
  roomCode,
  requesterUid,
  settings,
}: {
  roomCode: string
  requesterUid: string
  settings: RoomSettingsInput
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)
  const validationError = validateRoomSettings(settings)
  if (validationError) {
    throw new Error(validationError)
  }

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    if (room.status !== 'lobby') {
      throw new Error('Room settings can only be changed in the lobby.')
    }

    const playersSnapshot = await getDocs(query(getPlayersCollection(normalizedCode)))
    const players = playersSnapshot.docs.map(asPlayerDoc)

    for (const player of players) {
      transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
        stack: settings.startingStack,
        folded: false,
        allIn: false,
        inHand: false,
        currentStreetContribution: 0,
        totalHandContribution: 0,
        hasActedThisStreet: false,
      })
    }

    transaction.update(roomRef, {
      startingStack: settings.startingStack,
      smallBlind: settings.smallBlind,
      bigBlind: settings.bigBlind,
      minRaise: settings.bigBlind,
      updatedAt: serverTimestamp(),
      lastAction: 'Host updated room settings.',
    })

    addAction(transaction, normalizedCode, {
      uid: requesterUid,
      displayName: 'System',
      type: 'system',
      amount: 0,
      handNumber: room.handNumber,
      street: room.street,
      message: `Settings updated: stack ${settings.startingStack}, blinds ${settings.smallBlind}/${settings.bigBlind}.`,
    })
  })
}

export const autoAssignSeats = async ({
  roomCode,
  requesterUid,
}: {
  roomCode: string
  requesterUid: string
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    const playersSnapshot = await getDocs(
      query(getPlayersCollection(normalizedCode), orderBy('joinedAt')),
    )
    const players = playersSnapshot.docs.map(asPlayerDoc)

    const seatedPlayers = normalizePlayersWithSeats(players)
    for (const player of seatedPlayers) {
      transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
        seat: player.seat,
      })
    }

    transaction.update(roomRef, {
      updatedAt: serverTimestamp(),
      lastAction: 'Host auto-assigned seats.',
    })

    addAction(transaction, normalizedCode, {
      uid: requesterUid,
      displayName: 'System',
      type: 'system',
      amount: 0,
      handNumber: room.handNumber,
      street: room.street,
      message: 'Host auto-assigned seats.',
    })
  })
}

const startHandInternal = async ({
  roomCode,
  requesterUid,
  requireLobby,
}: {
  roomCode: string
  requesterUid: string
  requireLobby: boolean
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    if (requireLobby && room.status !== 'lobby') {
      throw new Error('Game has already started.')
    }

    if (!requireLobby && room.status !== 'active') {
      throw new Error('You can start a new hand only after the game starts.')
    }

    if (!requireLobby && room.pot > 0) {
      throw new Error('Settle or reset the current hand before starting a new one.')
    }

    const playersSnapshot = await getDocs(query(getPlayersCollection(normalizedCode)))
    const loadedPlayers = playersSnapshot.docs.map(asPlayerDoc)

    if (loadedPlayers.length < 2) {
      throw new Error('At least two players are required to start.')
    }

    const playersWithSeats = normalizePlayersWithSeats(loadedPlayers)

    const seededPlayers = playersWithSeats.map((player) => {
      const seededStack = requireLobby ? room.startingStack : player.stack
      return {
        ...player,
        stack: seededStack,
        folded: false,
        allIn: false,
        inHand: seededStack > 0,
        currentStreetContribution: 0,
        totalHandContribution: 0,
        hasActedThisStreet: false,
      }
    })

    const initialized = initializeNewHand(room, seededPlayers)

    const mutationMap = new Map(initialized.playerMutations.map((mutation) => [mutation.uid, mutation.patch]))

    for (const player of seededPlayers) {
      const patch = mutationMap.get(player.uid)
      if (!patch) {
        continue
      }

      transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
        seat: player.seat,
        stack: patch.stack,
        folded: patch.folded,
        allIn: patch.allIn,
        inHand: patch.inHand,
        currentStreetContribution: patch.currentStreetContribution,
        totalHandContribution: patch.totalHandContribution,
        hasActedThisStreet: patch.hasActedThisStreet,
      })
    }

    const nextHandNumber = room.handNumber + 1
    transaction.update(roomRef, {
      status: 'active',
      gameStarted: true,
      handNumber: nextHandNumber,
      dealerSeat: initialized.dealerSeat,
      currentTurnSeat: initialized.currentTurnSeat,
      currentBet: initialized.currentBet,
      minRaise: initialized.minRaise,
      pot: initialized.pot,
      street: initialized.street,
      lastAggressorSeat: initialized.lastAggressorSeat,
      winnersUids: [],
      lastAction: initialized.summary,
      updatedAt: serverTimestamp(),
    })

    addAction(transaction, normalizedCode, {
      uid: null,
      displayName: 'System',
      type: 'system',
      amount: initialized.pot,
      handNumber: nextHandNumber,
      street: initialized.street,
      message: initialized.summary,
    })
  })
}

export const startGame = async ({
  roomCode,
  requesterUid,
}: {
  roomCode: string
  requesterUid: string
}): Promise<void> => {
  await startHandInternal({ roomCode, requesterUid, requireLobby: true })
}

export const startNewHand = async ({
  roomCode,
  requesterUid,
}: {
  roomCode: string
  requesterUid: string
}): Promise<void> => {
  await startHandInternal({ roomCode, requesterUid, requireLobby: false })
}

export const advanceStreet = async ({
  roomCode,
  requesterUid,
}: {
  roomCode: string
  requesterUid: string
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    if (room.status !== 'active') {
      throw new Error('Game has not started yet.')
    }

    if (room.street === 'showdown') {
      throw new Error('Hand is already at showdown.')
    }

    const playersSnapshot = await getDocs(query(getPlayersCollection(normalizedCode)))
    const players = playersSnapshot.docs.map(asPlayerDoc)

    const nextStreet = getNextStreet(room.street)
    if (!nextStreet) {
      throw new Error('Cannot advance beyond showdown.')
    }

    for (const player of players) {
      transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
        currentStreetContribution: 0,
        hasActedThisStreet: !isPlayerAbleToAct(player),
      })
    }

    const updates: Record<string, unknown> = {
      street: nextStreet,
      currentBet: 0,
      minRaise: room.bigBlind,
      lastAggressorSeat: null,
      updatedAt: serverTimestamp(),
      lastAction: `Host manually advanced to ${nextStreet}.`,
    }

    if (nextStreet === 'showdown') {
      updates.currentTurnSeat = null
    } else {
      if (room.dealerSeat === null) {
        throw new Error('Dealer seat is not set.')
      }

      updates.currentTurnSeat = getFirstPostFlopActingSeat(players, room.dealerSeat)
    }

    transaction.update(roomRef, updates)

    addAction(transaction, normalizedCode, {
      uid: requesterUid,
      displayName: 'System',
      type: 'system',
      amount: 0,
      handNumber: room.handNumber,
      street: nextStreet,
      message: `Host manually advanced to ${nextStreet}.`,
    })
  })
}

export const resetHand = async ({
  roomCode,
  requesterUid,
}: {
  roomCode: string
  requesterUid: string
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    if (room.status !== 'active') {
      throw new Error('Game has not started yet.')
    }

    const playersSnapshot = await getDocs(query(getPlayersCollection(normalizedCode)))
    const players = playersSnapshot.docs.map(asPlayerDoc)

    for (const player of players) {
      const restoredStack = player.stack + player.totalHandContribution
      transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
        stack: restoredStack,
        folded: false,
        allIn: false,
        inHand: restoredStack > 0,
        currentStreetContribution: 0,
        totalHandContribution: 0,
        hasActedThisStreet: false,
      })
    }

    transaction.update(roomRef, {
      currentTurnSeat: null,
      currentBet: 0,
      minRaise: room.bigBlind,
      pot: 0,
      street: 'preflop',
      winnersUids: [],
      lastAggressorSeat: null,
      updatedAt: serverTimestamp(),
      lastAction: 'Host reset the current hand.',
    })

    addAction(transaction, normalizedCode, {
      uid: requesterUid,
      displayName: 'System',
      type: 'system',
      amount: 0,
      handNumber: room.handNumber,
      street: room.street,
      message: 'Host reset the current hand and refunded contributions.',
    })
  })
}

export const settleShowdown = async ({
  roomCode,
  requesterUid,
  winnerUids,
}: {
  roomCode: string
  requesterUid: string
  winnerUids: string[]
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  if (!winnerUids.length) {
    throw new Error('Select at least one winner.')
  }

  type HandHistoryPayload = {
    handNumber: number
    winners: Array<{ uid: string; displayName: string }>
    pot: number
    summary: string
  }

  const handHistoryPayload = await runTransaction<HandHistoryPayload>(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    assertRoomHost(room, requesterUid)

    if (room.street !== 'showdown') {
      throw new Error('You can settle winners only at showdown.')
    }

    if (room.pot <= 0) {
      throw new Error('Pot is empty.')
    }

    const playersSnapshot = await getDocs(query(getPlayersCollection(normalizedCode)))
    const players = playersSnapshot.docs.map(asPlayerDoc)

    const contenders = players.filter((player) => player.inHand && !player.folded)
    const winnerSet = new Set(winnerUids)
    const winners = contenders.filter((player) => winnerSet.has(player.uid))

    if (winners.length !== winnerSet.size) {
      throw new Error('Selected winners must be active in the hand.')
    }

    const refunds = getUncalledOverbetRefunds(contenders)
    const refundMap = new Map(refunds.map((entry) => [entry.uid, entry.amount]))
    const totalRefund = refunds.reduce((total, entry) => total + entry.amount, 0)
    const distributablePot = Math.max(0, room.pot - totalRefund)

    const payouts = splitPotAcrossWinners(distributablePot, winners)
    const payoutMap = new Map(payouts.map((entry) => [entry.uid, entry.amount]))

    for (const player of players) {
      const refund = refundMap.get(player.uid) ?? 0
      const payout = payoutMap.get(player.uid) ?? 0
      const nextStack = player.stack + refund + payout
      transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
        stack: nextStack,
        folded: false,
        allIn: false,
        inHand: nextStack > 0,
        currentStreetContribution: 0,
        totalHandContribution: 0,
        hasActedThisStreet: false,
      })
    }

    const winnerNames = winners.map((winner) => winner.displayName).join(', ')
    const winSummary =
      winners.length === 1
        ? `${winnerNames} won ${distributablePot} chips.`
        : `${winnerNames} split ${distributablePot} chips.`

    const refundSummary = refunds
      .map((entry) => {
        const player = contenders.find((contender) => contender.uid === entry.uid)
        return player ? `${player.displayName} was refunded ${entry.amount} uncalled chips.` : ''
      })
      .filter(Boolean)
      .join(' ')

    const summary = refundSummary ? `${refundSummary} ${winSummary}` : winSummary

    const payload: HandHistoryPayload = {
      handNumber: room.handNumber,
      winners: winners.map((winner) => ({ uid: winner.uid, displayName: winner.displayName })),
      pot: distributablePot,
      summary,
    }

    transaction.update(roomRef, {
      pot: 0,
      currentBet: 0,
      currentTurnSeat: null,
      winnersUids: winners.map((winner) => winner.uid),
      lastAggressorSeat: null,
      updatedAt: serverTimestamp(),
      lastAction: summary,
    })

    addAction(transaction, normalizedCode, {
      uid: requesterUid,
      displayName: 'System',
      type: 'system',
      amount: distributablePot,
      handNumber: room.handNumber,
      street: 'showdown',
      message: summary,
    })

    return payload
  })

  // Hand history is best-effort and should not block pot settlement.
  const payload = handHistoryPayload

  try {
    const actionsSnapshot = await getDocs(
      query(getActionsCollection(normalizedCode), orderBy('createdAt', 'asc'), limit(MAX_ACTIONS)),
    )
    const actionLines = actionsSnapshot.docs
      .map(asActionDoc)
      .filter((action) => action.handNumber === payload.handNumber)
      .map((action) => action.message)
      .slice(-15)

    await addDoc(getHandsCollection(normalizedCode), {
      handNumber: payload.handNumber,
      settledAt: serverTimestamp(),
      winners: payload.winners,
      pot: payload.pot,
      summary: payload.summary,
      actions: actionLines,
    })
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error
    }
  }
}

const settleSingleWinnerWithoutShowdown = ({
  roomCode,
  transaction,
  room,
  players,
  winner,
}: {
  roomCode: string
  transaction: Transaction
  room: RoomDoc
  players: PlayerDoc[]
  winner: PlayerDoc
}): string => {
  const pot = room.pot

  for (const player of players) {
    const payout = player.uid === winner.uid ? pot : 0
    const nextStack = player.stack + payout
    transaction.update(getPlayerDocRef(roomCode, player.uid), {
      stack: nextStack,
      folded: false,
      allIn: false,
      inHand: nextStack > 0,
      currentStreetContribution: 0,
      totalHandContribution: 0,
      hasActedThisStreet: false,
    })
  }

  const summary = `${winner.displayName} won ${pot} chips uncontested.`

  const handRef = doc(getHandsCollection(roomCode))
  transaction.set(handRef, {
    handNumber: room.handNumber,
    settledAt: serverTimestamp(),
    winners: [{ uid: winner.uid, displayName: winner.displayName }],
    pot,
    summary,
    actions: [summary],
  })

  transaction.update(getRoomRef(roomCode), {
    pot: 0,
    currentBet: 0,
    currentTurnSeat: null,
    winnersUids: [winner.uid],
    lastAggressorSeat: null,
    street: 'showdown',
    updatedAt: serverTimestamp(),
    lastAction: summary,
  })

  addAction(transaction, roomCode, {
    uid: null,
    displayName: 'System',
    type: 'system',
    amount: pot,
    handNumber: room.handNumber,
    street: 'showdown',
    message: summary,
  })

  return summary
}

export const submitAction = async ({
  roomCode,
  uid,
  input,
}: {
  roomCode: string
  uid: string
  input: ActionInput
}): Promise<void> => {
  const normalizedCode = ensureRoomCode(roomCode)

  await runTransaction(db, async (transaction) => {
    const roomRef = getRoomRef(normalizedCode)
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found.')
    }

    const room = asRoomDoc(roomSnapshot)
    if (room.status !== 'active') {
      throw new Error('The game has not started yet.')
    }

    if (room.street === 'showdown') {
      throw new Error('Waiting for showdown settlement.')
    }

    const playersSnapshot = await getDocs(query(getPlayersCollection(normalizedCode)))
    const loadedPlayers = playersSnapshot.docs.map(asPlayerDoc)
    const mutablePlayers = new Map(loadedPlayers.map((player) => [player.uid, { ...player }]))

    const actor = mutablePlayers.get(uid)
    if (!actor) {
      throw new Error('You are not in this room.')
    }

    if (actor.seat !== room.currentTurnSeat) {
      throw new Error('It is not your turn.')
    }

    if (!isPlayerAbleToAct(actor)) {
      throw new Error('You cannot act right now.')
    }

    const legalActions = getLegalActions(room, actor)
    const amountToCall = getAmountToCall(room, actor)

    const resetOtherActionablePlayers = () => {
      mutablePlayers.forEach((player) => {
        if (player.uid === actor.uid) {
          return
        }

        if (isPlayerAbleToAct(player)) {
          player.hasActedThisStreet = false
        }
      })
    }

    const resetPlayersFacingNewAmount = (newCurrentBet: number) => {
      mutablePlayers.forEach((player) => {
        if (player.uid === actor.uid) {
          return
        }

        if (isPlayerAbleToAct(player) && player.currentStreetContribution < newCurrentBet) {
          player.hasActedThisStreet = false
        }
      })
    }

    let currentBet = room.currentBet
    let minRaise = room.minRaise
    let pot = room.pot
    let street: Street = room.street
    let currentTurnSeat = room.currentTurnSeat
    let lastAggressorSeat = room.lastAggressorSeat
    let winnersUids = room.winnersUids
    let handWasSettled = false
    let actorContribution = 0
    let transitionMessage: string | null = null

    switch (input.type) {
      case 'check': {
        if (!legalActions.canCheck) {
          throw new Error('Check is not allowed while facing a bet.')
        }

        actor.hasActedThisStreet = true
        transitionMessage = `${actor.displayName} checks.`
        break
      }

      case 'call': {
        if (!legalActions.canCall) {
          throw new Error('Call is not available.')
        }

        const callAmount = Math.min(amountToCall, actor.stack)
        actor.stack -= callAmount
        actor.currentStreetContribution += callAmount
        actor.totalHandContribution += callAmount
        actor.hasActedThisStreet = true
        actorContribution = callAmount
        pot += callAmount

        if (actor.stack === 0) {
          actor.allIn = true
        }

        transitionMessage =
          callAmount < amountToCall
            ? `${actor.displayName} calls all-in for ${callAmount}.`
            : `${actor.displayName} calls ${callAmount}.`
        break
      }

      case 'bet': {
        if (!legalActions.canBet) {
          throw new Error('Bet is not available.')
        }

        const betAmount = Math.trunc(input.amount ?? 0)
        if (betAmount < legalActions.minimumBet) {
          throw new Error(`Minimum bet is ${legalActions.minimumBet}.`)
        }

        if (betAmount > actor.stack) {
          throw new Error('You do not have enough chips for that bet.')
        }

        actor.stack -= betAmount
        actor.currentStreetContribution += betAmount
        actor.totalHandContribution += betAmount
        actor.hasActedThisStreet = true
        actorContribution = betAmount
        pot += betAmount

        currentBet = actor.currentStreetContribution
        minRaise = Math.max(betAmount, room.bigBlind)
        lastAggressorSeat = actor.seat

        if (actor.stack === 0) {
          actor.allIn = true
        }

        resetOtherActionablePlayers()
        transitionMessage = `${actor.displayName} bets ${betAmount}.`
        break
      }

      case 'raise': {
        if (!legalActions.canRaise) {
          throw new Error('Raise is not available.')
        }

        const raiseTo = Math.trunc(input.amount ?? 0)
        if (raiseTo < legalActions.minimumRaiseTo) {
          throw new Error(`Minimum raise-to is ${legalActions.minimumRaiseTo}.`)
        }

        const extraAmount = raiseTo - actor.currentStreetContribution
        if (extraAmount <= 0) {
          throw new Error('Raise amount is invalid.')
        }

        if (extraAmount > actor.stack) {
          throw new Error('You do not have enough chips for that raise.')
        }

        const previousBet = currentBet
        actor.stack -= extraAmount
        actor.currentStreetContribution = raiseTo
        actor.totalHandContribution += extraAmount
        actor.hasActedThisStreet = true
        actorContribution = extraAmount
        pot += extraAmount

        currentBet = raiseTo
        minRaise = raiseTo - previousBet
        lastAggressorSeat = actor.seat

        if (actor.stack === 0) {
          actor.allIn = true
        }

        resetOtherActionablePlayers()
        transitionMessage = `${actor.displayName} raises to ${raiseTo}.`
        break
      }

      case 'fold': {
        if (!legalActions.canFold) {
          throw new Error('Fold is not available.')
        }

        actor.folded = true
        actor.inHand = false
        actor.hasActedThisStreet = true
        transitionMessage = `${actor.displayName} folds.`
        break
      }

      case 'all_in': {
        if (!legalActions.canAllIn) {
          throw new Error('All-in is not available.')
        }

        const committed = actor.stack
        if (committed <= 0) {
          throw new Error('You do not have chips to move all-in.')
        }

        actor.stack = 0
        actor.currentStreetContribution += committed
        actor.totalHandContribution += committed
        actor.allIn = true
        actor.hasActedThisStreet = true
        actorContribution = committed
        pot += committed

        if (actor.currentStreetContribution > currentBet) {
          const raiseSize = actor.currentStreetContribution - currentBet
          const previousBet = currentBet
          currentBet = actor.currentStreetContribution
          lastAggressorSeat = actor.seat

          const fullRaise =
            previousBet === 0
              ? raiseSize >= room.bigBlind
              : raiseSize >= minRaise

          if (fullRaise) {
            minRaise = Math.max(raiseSize, room.bigBlind)
            resetOtherActionablePlayers()
          } else {
            resetPlayersFacingNewAmount(currentBet)
          }
        }

        transitionMessage = `${actor.displayName} goes all-in for ${committed}.`
        break
      }

      default:
        throw new Error('Unsupported action type.')
    }

    const playersAfterAction = Array.from(mutablePlayers.values())
    const remainingPlayers = getRemainingInHandPlayers(playersAfterAction)

    if (hasSingleRemainingPlayer(playersAfterAction) && remainingPlayers.length === 1) {
      handWasSettled = true
      winnersUids = [remainingPlayers[0].uid]
      transitionMessage = settleSingleWinnerWithoutShowdown({
        roomCode: normalizedCode,
        transaction,
        room: {
          ...room,
          pot,
        },
        players: playersAfterAction,
        winner: remainingPlayers[0],
      })
      currentTurnSeat = null
      currentBet = 0
      street = 'showdown'
      minRaise = room.bigBlind
      lastAggressorSeat = null
      pot = 0
    }

    if (!handWasSettled) {
      const roomAfterAction: RoomDoc = {
        ...room,
        currentBet,
        pot,
        minRaise,
        street,
      }

      if (isBettingRoundComplete(roomAfterAction, playersAfterAction)) {
        const nextStreet = getNextStreet(street)

        if (!nextStreet || nextStreet === 'showdown') {
          street = 'showdown'
          currentTurnSeat = null
          currentBet = 0
          minRaise = room.bigBlind
          lastAggressorSeat = null

          mutablePlayers.forEach((player) => {
            player.currentStreetContribution = 0
            player.hasActedThisStreet = false
          })

          transitionMessage = transitionMessage ?? 'Betting complete. Move to showdown.'
        } else {
          street = nextStreet
          currentBet = 0
          minRaise = room.bigBlind
          lastAggressorSeat = null

          mutablePlayers.forEach((player) => {
            player.currentStreetContribution = 0
            player.hasActedThisStreet = !isPlayerAbleToAct(player)
          })

          if (room.dealerSeat === null) {
            throw new Error('Dealer seat is missing.')
          }

          currentTurnSeat = getFirstPostFlopActingSeat(playersAfterAction, room.dealerSeat)

          transitionMessage = `${transitionMessage ?? 'Action complete.'} Street advanced to ${nextStreet}.`
        }
      } else {
        currentTurnSeat = getNextActingSeat(playersAfterAction, actor.seat)

        if (currentTurnSeat === null) {
          street = 'showdown'
          currentBet = 0
          minRaise = room.bigBlind
          lastAggressorSeat = null
          transitionMessage = `${transitionMessage ?? 'Action complete.'} All players are all-in. Proceed to showdown.`
        }
      }

      for (const player of mutablePlayers.values()) {
        transaction.update(getPlayerDocRef(normalizedCode, player.uid), {
          stack: player.stack,
          folded: player.folded,
          allIn: player.allIn,
          inHand: player.inHand,
          currentStreetContribution: player.currentStreetContribution,
          totalHandContribution: player.totalHandContribution,
          hasActedThisStreet: player.hasActedThisStreet,
        })
      }

      transaction.update(roomRef, {
        currentTurnSeat,
        currentBet,
        minRaise,
        pot,
        street,
        winnersUids,
        lastAggressorSeat,
        lastAction: transitionMessage,
        updatedAt: serverTimestamp(),
      })
    }

    addAction(transaction, normalizedCode, {
      uid: actor.uid,
      displayName: actor.displayName,
      type: input.type,
      amount: actorContribution,
      handNumber: room.handNumber,
      street: room.street,
      message: transitionMessage ?? `${actor.displayName} acted.`,
    })

    if (!handWasSettled && transitionMessage && transitionMessage.includes('Street advanced')) {
      addAction(transaction, normalizedCode, {
        uid: null,
        displayName: 'System',
        type: 'system',
        amount: 0,
        handNumber: room.handNumber,
        street,
        message: transitionMessage,
      })
    }
  })
}

export const getActionHint = (room: RoomDoc, player: PlayerDoc, players: PlayerDoc[]): string => {
  const legal = getLegalActions(room, player)
  const toCall = getAmountToCall(room, player)

  if (!isPlayerAbleToAct(player)) {
    return 'You cannot act right now.'
  }

  if (toCall > 0) {
    return `Facing ${toCall}. Minimum raise-to is ${legal.minimumRaiseTo}.`
  }

  const actionOrder =
    room.dealerSeat !== null ? getActionOrderSummary(players, room.dealerSeat) : ''

  return actionOrder
    ? `No bet to call. Action order: ${actionOrder}`
    : 'No bet to call.'
}

export const getNextHostCandidate = (players: PlayerDoc[]): PlayerDoc | null => {
  const sorted = sortByJoinedAt(players)
  return sorted.length > 0 ? sorted[0] : null
}

export const getNextSeatAfter = (players: PlayerDoc[], seat: number | null): number | null =>
  findNextSeat(players, seat, () => true)
