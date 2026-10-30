import EditorWorkspace from '@/components/editor/EditorWorkspace';
import { fetchServerSnapshot } from '@/lib/serverApi';

/**
 * The editor is rendered on the server: the session cookie identifies the
 * visitor, so the saved tabs and their content arrive with the first
 * response instead of after a client round trip.
 */
export const dynamic = 'force-dynamic';

export default async function DynamicEditorPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const documentName = decodeURIComponent(name);
  const tabs = await fetchServerSnapshot(documentName);
  return <EditorWorkspace documentName={documentName} initialTabs={tabs} />;
}
