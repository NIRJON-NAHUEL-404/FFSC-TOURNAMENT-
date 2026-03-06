export interface TournamentSettings {
  round: string;
  day: string;
  rankingLimit: string;
  notice: string;
  updatedAt: any;
  timerEnd?: any;
  youtubeUrl?: string;
  bkashNumber?: string;
  nagadNumber?: string;
  registrationFee?: string;
  customId?: string;
  customPassword?: string;
  footerText?: string;
}

export interface Team {
  id?: string;
  name: string;
  logoUrl: string;
  leaderName?: string;
  matches: number;
  booyah: number;
  killPoints: number;
  m1Points?: number;
  m2Points?: number;
  m3Points?: number;
  m4Points?: number;
  m5Points?: number;
  m6Points?: number;
  positionPoints: number;
  totalPoints: number;
  order: number;
  isWinner?: boolean;
  gameTime?: string;
  position?: number;
}

export interface HistoryRecord {
  id?: string;
  date: any;
  tournamentData: TournamentSettings;
  teams: Team[];
}

export interface Notice {
  id?: string;
  title: string;
  content: string;
  createdAt: any;
}

export interface Registration {
  id?: string;
  teamName: string;
  leaderName: string;
  phone: string;
  email: string;
  players: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  userUid: string;
  logoUrl?: string;
  isWinner?: boolean;
  paymentMethod?: 'bkash' | 'nagad';
  transactionId?: string;
  paymentScreenshot?: string;
  senderNumber?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
