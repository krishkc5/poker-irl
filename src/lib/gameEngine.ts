import type {
  LegalActions,
  PlayerDoc,
  RoomDoc,
  SidePot,
  Street,
} from '../types/game'

export interface PlayerMutation {
  uid: string
  patch: Partial<PlayerDoc>
}

export interface HandInitResult {
  dealerSeat: number
  currentTurnSeat: number | null
  currentBet: number
  minRaise: number
  pot: number
  street: Street
  lastAggressorSeat: number | null
  playerMutations: PlayerMutation[]
  summary: string
}

const STREET_SEQUENCE: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown']

export const getSeatedPlayers = (players: PlayerDoc[]): PlayerDoc[] =>
  players
    .filter((player) => player.seat !== null)
    .sort((a, b) => (a.seat ?? Number.MAX_SAFE_INTEGER) - (b.seat ?? Number.MAX_SAFE_INTEGER))

const getSeatedInHandPlayers = (players: PlayerDoc[]): PlayerDoc[] =>
  getSeatedPlayers(players).filter((player) => player.inHand)

export const isPlayerAbleToAct = (player: PlayerDoc): boolean =>
  player.inHand && !player.folded && !player.allIn && player.stack > 0

export const getAmountToCall = (room: RoomDoc, player: PlayerDoc): number =>
  Math.max(0, room.currentBet - player.currentStreetContribution)

export const getMinimumRaiseTo = (room: RoomDoc): number =>
  room.currentBet > 0 ? room.currentBet + room.minRaise : Math.max(room.bigBlind, room.minRaise)

const getSeatIndex = (players: PlayerDoc[], seat: number | null): number => {
  if (seat === null) {
    return -1
  }

  return players.findIndex((player) => player.seat === seat)
}

export const findNextSeat = (
  players: PlayerDoc[],
  fromSeat: number | null,
  predicate: (player: PlayerDoc) => boolean,
): number | null => {
  const seatedPlayers = getSeatedPlayers(players)
  if (!seatedPlayers.length) {
    return null
  }

  const fromIndex = getSeatIndex(seatedPlayers, fromSeat)
  for (let offset = 1; offset <= seatedPlayers.length; offset += 1) {
    const index = ((fromIndex + offset) % seatedPlayers.length + seatedPlayers.length) % seatedPlayers.length
    const candidate = seatedPlayers[index]
    if (predicate(candidate)) {
      return candidate.seat
    }
  }

  return null
}

export const getNextActingSeat = (players: PlayerDoc[], fromSeat: number | null): number | null =>
  findNextSeat(players, fromSeat, isPlayerAbleToAct)

export const getFirstPostFlopActingSeat = (
  players: PlayerDoc[],
  dealerSeat: number,
): number | null => getNextActingSeat(players, dealerSeat)

export const isBettingRoundComplete = (room: RoomDoc, players: PlayerDoc[]): boolean => {
  const activePlayers = players.filter((player) => player.inHand && !player.folded)
  if (activePlayers.length <= 1) {
    return true
  }

  const actionablePlayers = activePlayers.filter(isPlayerAbleToAct)
  if (actionablePlayers.length === 0) {
    return true
  }

  return actionablePlayers.every(
    (player) => player.hasActedThisStreet && player.currentStreetContribution === room.currentBet,
  )
}

export const getRemainingInHandPlayers = (players: PlayerDoc[]): PlayerDoc[] =>
  players.filter((player) => player.inHand && !player.folded)

export const hasSingleRemainingPlayer = (players: PlayerDoc[]): boolean =>
  getRemainingInHandPlayers(players).length === 1

export const getNextStreet = (street: Street): Street | null => {
  const index = STREET_SEQUENCE.indexOf(street)
  if (index < 0 || index + 1 >= STREET_SEQUENCE.length) {
    return null
  }

  return STREET_SEQUENCE[index + 1]
}

export const rotateDealerSeat = (previousDealerSeat: number | null, players: PlayerDoc[]): number => {
  const eligible = getSeatedPlayers(players).filter((player) => player.stack > 0)
  if (eligible.length < 2) {
    throw new Error('At least two players with chips are required to start a hand.')
  }

  if (previousDealerSeat === null) {
    return eligible[0].seat as number
  }

  const nextSeat = findNextSeat(eligible, previousDealerSeat, () => true)
  if (nextSeat === null) {
    throw new Error('Unable to rotate dealer seat.')
  }

  return nextSeat
}

const getPlayerBySeat = (players: PlayerDoc[], seat: number | null): PlayerDoc | null => {
  if (seat === null) {
    return null
  }

  return players.find((player) => player.seat === seat) ?? null
}

const postBlind = (player: PlayerDoc, amount: number): Partial<PlayerDoc> => {
  const blind = Math.min(player.stack, amount)
  const stackAfter = player.stack - blind

  return {
    stack: stackAfter,
    currentStreetContribution: player.currentStreetContribution + blind,
    totalHandContribution: player.totalHandContribution + blind,
    allIn: stackAfter === 0,
  }
}

export const initializeNewHand = (room: RoomDoc, players: PlayerDoc[]): HandInitResult => {
  const seatedPlayers = getSeatedPlayers(players)
  if (seatedPlayers.length < 2) {
    throw new Error('At least two seated players are required.')
  }

  const playerState = new Map<string, PlayerDoc>(
    seatedPlayers.map((player) => [
      player.uid,
      {
        ...player,
        inHand: player.stack > 0,
        folded: false,
        allIn: false,
        currentStreetContribution: 0,
        totalHandContribution: 0,
        hasActedThisStreet: false,
      },
    ]),
  )

  const activePlayers = Array.from(playerState.values()).filter((player) => player.inHand)
  if (activePlayers.length < 2) {
    throw new Error('At least two players with chips are required to start a hand.')
  }

  const dealerSeat = rotateDealerSeat(room.dealerSeat, activePlayers)

  let smallBlindSeat: number | null
  let bigBlindSeat: number | null

  if (activePlayers.length === 2) {
    smallBlindSeat = dealerSeat
    bigBlindSeat = findNextSeat(activePlayers, smallBlindSeat, () => true)
  } else {
    smallBlindSeat = findNextSeat(activePlayers, dealerSeat, () => true)
    bigBlindSeat = findNextSeat(activePlayers, smallBlindSeat, () => true)
  }

  if (smallBlindSeat === null || bigBlindSeat === null) {
    throw new Error('Unable to assign blinds for this hand.')
  }

  const sbPlayer = getPlayerBySeat(Array.from(playerState.values()), smallBlindSeat)
  const bbPlayer = getPlayerBySeat(Array.from(playerState.values()), bigBlindSeat)

  if (!sbPlayer || !bbPlayer) {
    throw new Error('Blind seats are invalid.')
  }

  const sbPatch = postBlind(sbPlayer, room.smallBlind)
  const sbUpdated: PlayerDoc = { ...sbPlayer, ...sbPatch }
  playerState.set(sbUpdated.uid, sbUpdated)

  const bbPatch = postBlind(bbPlayer, room.bigBlind)
  const bbUpdated: PlayerDoc = { ...bbPlayer, ...bbPatch }
  playerState.set(bbUpdated.uid, bbUpdated)

  const smallBlindPosted = sbUpdated.currentStreetContribution
  const bigBlindPosted = bbUpdated.currentStreetContribution

  let currentTurnSeat: number | null
  if (activePlayers.length === 2) {
    currentTurnSeat = getNextActingSeat(Array.from(playerState.values()), bigBlindSeat)
  } else {
    currentTurnSeat = getNextActingSeat(Array.from(playerState.values()), bigBlindSeat)
  }

  const pot = smallBlindPosted + bigBlindPosted
  const summary = `Hand #${room.handNumber + 1} started. Blinds posted (${smallBlindPosted}/${bigBlindPosted}).`

  return {
    dealerSeat,
    currentTurnSeat,
    currentBet: bigBlindPosted,
    minRaise: Math.max(room.bigBlind, 1),
    pot,
    street: currentTurnSeat === null ? 'showdown' : 'preflop',
    lastAggressorSeat: bigBlindSeat,
    playerMutations: Array.from(playerState.values()).map((player) => ({
      uid: player.uid,
      patch: {
        inHand: player.inHand,
        folded: player.folded,
        allIn: player.allIn,
        currentStreetContribution: player.currentStreetContribution,
        totalHandContribution: player.totalHandContribution,
        hasActedThisStreet: false,
        stack: player.stack,
      },
    })),
    summary,
  }
}

export const getLegalActions = (room: RoomDoc, player: PlayerDoc): LegalActions => {
  const amountToCall = getAmountToCall(room, player)
  const minRaiseTo = getMinimumRaiseTo(room)
  const minimumBet = Math.max(room.bigBlind, 1)
  const maxTotalContribution = player.currentStreetContribution + player.stack

  const canAct = isPlayerAbleToAct(player)

  const canBet = canAct && room.currentBet === 0 && player.stack >= minimumBet
  const canRaise =
    canAct &&
    room.currentBet > 0 &&
    maxTotalContribution > room.currentBet &&
    maxTotalContribution >= minRaiseTo

  return {
    canCheck: canAct && amountToCall === 0,
    canCall: canAct && amountToCall > 0,
    canBet,
    canRaise,
    canFold: canAct,
    canAllIn: canAct,
    amountToCall,
    minimumRaiseTo: minRaiseTo,
    minimumBet,
    maxTotalContribution,
  }
}

export const splitPotAcrossWinners = (
  pot: number,
  winners: PlayerDoc[],
): Array<{ uid: string; amount: number }> => {
  if (winners.length === 0) {
    throw new Error('At least one winner is required to settle the pot.')
  }

  const sortedWinners = [...winners].sort(
    (a, b) => (a.seat ?? Number.MAX_SAFE_INTEGER) - (b.seat ?? Number.MAX_SAFE_INTEGER),
  )

  const base = Math.floor(pot / sortedWinners.length)
  let remainder = pot % sortedWinners.length

  return sortedWinners.map((winner) => {
    const extra = remainder > 0 ? 1 : 0
    remainder = Math.max(0, remainder - 1)
    return {
      uid: winner.uid,
      amount: base + extra,
    }
  })
}

export const calculateSidePots = (players: PlayerDoc[]): SidePot[] => {
  const contributors = players.filter((player) => player.totalHandContribution > 0)
  if (!contributors.length) {
    return []
  }

  const levels = Array.from(
    new Set(
      contributors
        .map((player) => Math.trunc(player.totalHandContribution))
        .filter((contribution) => contribution > 0),
    ),
  ).sort((a, b) => a - b)

  const pots: SidePot[] = []
  let previousLevel = 0

  for (const level of levels) {
    const layer = level - previousLevel
    if (layer <= 0) {
      previousLevel = level
      continue
    }

    const participants = contributors.filter((player) => player.totalHandContribution >= level)
    const eligibleUids = participants
      .filter((player) => player.inHand && !player.folded)
      .sort((a, b) => (a.seat ?? Number.MAX_SAFE_INTEGER) - (b.seat ?? Number.MAX_SAFE_INTEGER))
      .map((player) => player.uid)

    const amount = layer * participants.length
    if (amount > 0 && eligibleUids.length > 0) {
      pots.push({
        index: pots.length,
        amount,
        eligibleUids,
      })
    }

    previousLevel = level
  }

  return pots
}

export const resetStreetState = (players: PlayerDoc[]): PlayerMutation[] =>
  players.map((player) => ({
    uid: player.uid,
    patch: {
      currentStreetContribution: 0,
      hasActedThisStreet: !isPlayerAbleToAct(player),
    },
  }))

export const getActionOrderSummary = (
  players: PlayerDoc[],
  dealerSeat: number,
): string => {
  const seated = getSeatedInHandPlayers(players)
  if (!seated.length) {
    return ''
  }

  const firstSeat = findNextSeat(seated, dealerSeat, () => true)
  if (firstSeat === null) {
    return ''
  }

  const ordered: string[] = []
  let currentSeat = firstSeat
  let guard = 0

  while (guard < seated.length) {
    const player = seated.find((entry) => entry.seat === currentSeat)
    if (!player) {
      break
    }

    ordered.push(player.displayName)
    const nextSeat = findNextSeat(seated, currentSeat, () => true)
    guard += 1
    if (nextSeat === null || nextSeat === firstSeat) {
      break
    }

    currentSeat = nextSeat
  }

  return ordered.join(' -> ')
}
