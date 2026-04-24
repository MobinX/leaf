'use client';

import dynamic from 'next/dynamic';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-lg font-medium text-gray-600 animate-pulse">Loading Math Editor...</div>
    </div>
  ),
});

export default function EditorPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      <TiptapEditor />
    </main>
  );
}
