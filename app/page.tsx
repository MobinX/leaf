import HomeView from '@/components/home/HomeView';
import { fetchServerDocuments } from '@/lib/serverApi';

/**
 * The document list is rendered on the server: the session cookie identifies
 * the visitor, so their documents are already in the first HTML response.
 * No client-side fetch, no loading spinner.
 */
export const dynamic = 'force-dynamic';

export default async function Home() {
  const { documents, authenticated } = await fetchServerDocuments();
  return <HomeView initialDocuments={documents} serverAuthenticated={authenticated} />;
}
