import React from 'react';
import { Plus, Copy } from 'lucide-react';

interface TabBarProps {
  tabs: { id: string; name: string }[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onAddTab: () => void;
  onCloneTab: () => void;
}

export default function TabBar({ tabs, activeTabId, onTabChange, onAddTab, onCloneTab }: TabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-white border-t flex items-center px-4 gap-2 overflow-x-auto shadow-md">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded-t-lg border-x border-t transition-colors ${
            activeTabId === tab.id
              ? 'bg-gray-100 border-gray-300 text-gray-900'
              : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'
          }`}
        >
          {tab.name}
        </button>
      ))}
      <button
        onClick={onAddTab}
        className="px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-gray-100 flex items-center"
        title="Add new tab"
      >
        <Plus size={16} />
      </button>
      <button
        onClick={onCloneTab}
        className="px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-gray-100 flex items-center"
        title="Clone active tab"
      >
        <Copy size={16} />
      </button>
    </div>
  );
}
