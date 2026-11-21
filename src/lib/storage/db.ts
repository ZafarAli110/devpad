import Dexie, { Table } from 'dexie';

export interface Note {
  id: string;
  title: string;
  content: string;
  opfsPath?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  embedding?: number[]; // Semantic Vector
  language?: string; // e.g. 'javascript', 'python'
  isProtected?: boolean;
  encryptionMetadata?: {
    iv: string;
    salt: string;
  };
  isHidden?: boolean;
}

export interface SecuritySettings {
  id: 'current';
  isSetup: boolean;
  hashedPassword?: string;
  hashedMasterKey?: string;
  salt?: string; // Salt used for hashing validation
  hint?: string;
}

export interface LogNote extends Note {
  // Can add log-specific fields here if needed
}

export interface Diagram {
  id: string;
  title: string;
  content: string; // JSON string of nodes/edges
  createdAt: number;
  updatedAt: number;
}

export interface SearchIndex {
  id: string;
  parentId: string; // noteId or logId
  lineNumber: number;
  timestamp: number;
  message: string;
  embedding?: number[];
}

export interface LogIndex extends SearchIndex {
  level: 'INF' | 'WRN' | 'ERR' | 'DBG';
  requestId?: string;
}

export interface LogAnalysis {
  id: string;
  title: string;
  fileMetadata: {
    name: string;
    opfsPath: string;
    size: number;
  }[];
  stats: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  createdAt: number;
  updatedAt: number;
}

export class SmartNotepadDB extends Dexie {
  notes!: Table<Note>;
  logs!: Table<LogNote>;
  analyses!: Table<LogAnalysis>;
  diagrams!: Table<Diagram>;
  noteIndices!: Table<SearchIndex>;
  logIndices!: Table<LogIndex>;
  settings!: Table<SecuritySettings>;

  constructor() {
    super('SmartNotepadDB');
    this.version(6).stores({
      notes: 'id, title, createdAt, updatedAt, isProtected, isHidden',
      logs: 'id, title, createdAt, updatedAt, isProtected',
      analyses: 'id, title, createdAt, updatedAt',
      diagrams: 'id, title, createdAt, updatedAt',
      noteIndices: 'id, parentId',
      logIndices: 'id, parentId, requestId, level, timestamp',
      settings: 'id'
    });
  }
}

export const db = new SmartNotepadDB();

// Expose for debugging/seeding in browser environments
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.db = db;
}
