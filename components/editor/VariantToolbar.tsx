/**
 * VariantToolbar - Fixed bottom bar with variant tabs
 * Shows 3 theory variants (T1, T2, T3) and 3 discussion variants (R1, R2, R3)
 * User can click to switch between variants
 */

'use client';

import { useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface VariantToolbarProps {
  selectedTheory: 0 | 1 | 2;
  selectedDiscussion: 0 | 1 | 2;
  onTheoryChange: (index: 0 | 1 | 2) => void;
  onDiscussionChange: (index: 0 | 1 | 2) => void;
  isLoading?: boolean;
}

export default function VariantToolbar({
  selectedTheory,
  selectedDiscussion,
  onTheoryChange,
  onDiscussionChange,
  isLoading = false,
}: VariantToolbarProps) {
  const theoryTabs: Array<{ label: string; value: 0 | 1 | 2 }> = [
    { label: 'Theory 1', value: 0 },
    { label: 'Theory 2', value: 1 },
    { label: 'Theory 3', value: 2 },
  ];

  const discussionTabs: Array<{ label: string; value: 0 | 1 | 2 }> = [
    { label: 'Results 1', value: 0 },
    { label: 'Results 2', value: 1 },
    { label: 'Results 3', value: 2 },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-8">
          {/* Theory Variants */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Theory</h3>
              <span className="text-xs text-gray-500">({selectedTheory + 1}/3 selected)</span>
            </div>
            <div className="flex gap-2">
              {theoryTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => onTheoryChange(tab.value)}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    selectedTheory === tab.value
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Discussion Variants */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Results & Discussion</h3>
              <span className="text-xs text-gray-500">({selectedDiscussion + 1}/3 selected)</span>
            </div>
            <div className="flex gap-2">
              {discussionTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => onDiscussionChange(tab.value)}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    selectedDiscussion === tab.value
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
