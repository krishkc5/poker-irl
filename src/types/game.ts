import type { Timestamp } from 'firebase/firestore'

export type RoomStatus = 'lobby' | 'active'
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export type ActionType =
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'fold'
  | 'all_in'
  | 'system'

export interface RoomDoc {
  code: string
  hostUid: string
  status: RoomStatus
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  startingStack: number
  smallBlind: number
  bigBlind: number
  dealerSeat: number | null
  currentTurnSeat: number | null
  currentBet: number
  minRaise: number
  pot: number
  handNumber: number
  street: Street
  gameStarted: boolean
  lastAction: string | null
  winnersUids: string[]
  lastAggressorSeat: number | null
}

export interface PlayerDoc {
  uid: string
  displayName: string
  seat: number | null
  stack: number
  folded: boolean
  allIn: boolean
  inHand: boolean
  currentStreetContribution: number
  totalHandContribution: number
  joinedAt: Timestamp | null
  isHost: boolean
  hasActedThisStreet: boolean
}

export interface ActionDoc {
  id: string
  uid: string | null
  displayName: string
  type: ActionType
  amount: number
  createdAt: Timestamp | null
  handNumber: number
  street: Street
  message: string
}

export interface HandWinner {
  uid: string
  displayName: string
}

export interface SidePot {
  index: number
  amount: number
  eligibleUids: string[]
}

export interface SidePotWinnerSelection {
  potIndex: number
  winnerUids: string[]
}

export interface HandDoc {
  id: string
  handNumber: number
  settledAt: Timestamp | null
  winners: HandWinner[]
  pot: number
  summary: string
  actions: string[]
}

export interface RoomSettingsInput {
  startingStack: number
  smallBlind: number
  bigBlind: number
}

export interface ActionInput {
  type: Exclude<ActionType, 'system'>
  amount?: number
}

export interface LegalActions {
  canCheck: boolean
  canCall: boolean
  canBet: boolean
  canRaise: boolean
  canFold: boolean
  canAllIn: boolean
  amountToCall: number
  minimumRaiseTo: number
  minimumBet: number
  maxTotalContribution: number
}
