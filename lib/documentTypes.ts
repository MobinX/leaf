/**
 * Shared shapes for the server-rendered document list and snapshots.
 * Kept in their own module so client components can import the types
 * without pulling in `next/headers`.
 */

export interface ServerDocument {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  role: string;
  tabs: { name: string; title: string; updatedAt: string; updatedBy: string | null }[];
}

export interface ServerDocTab {
  name: string;
  title: string;
  stateB64: string;
  chunkCount: number;
  bytes: number;
  updatedAt: string;
  updatedBy: string | null;
}
