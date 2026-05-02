import React from 'react';
import { Plus, Copy, Sun, Moon, Palette, ChevronUp } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

interface TabBarProps {
  tabs: { id: string; name: string }[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onAddTab: () => void;
  onCloneTab: () => void;
}

export default function TabBar({ tabs, activeTabId, onTabChange, onAddTab, onCloneTab }: TabBarProps) {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { id: 'light', name: 'Light', icon: <Sun size={16} /> },
    { id: 'dark', name: 'Dark', icon: <Moon size={16} /> },
    { id: 'hybrid', name: 'Hybrid', icon: <Palette size={16} /> },
  ] as const;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-[var(--bg-toolbar)] border-t border-[var(--border-toolbar)] flex items-center px-4 gap-2 overflow-x-auto shadow-md no-print z-50">
      <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-t-lg border-x border-t transition-colors shrink-0",
              activeTabId === tab.id
                ? 'bg-[var(--bg-app)] border-[var(--border-toolbar)] text-[var(--fg-toolbar-hover)]'
                : 'bg-[var(--bg-toolbar)] border-transparent text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]'
            )}
          >
            {tab.name}
          </button>
        ))}
        <button
          onClick={onAddTab}
          className="px-3 py-1.5 text-sm font-medium border border-[var(--border-toolbar)] rounded-md hover:bg-[var(--bg-toolbar-hover)] flex items-center text-[var(--fg-toolbar)]"
          title="Add new tab"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={onCloneTab}
          className="px-3 py-1.5 text-sm font-medium border border-[var(--border-toolbar)] rounded-md hover:bg-[var(--bg-toolbar-hover)] flex items-center text-[var(--fg-toolbar)]"
          title="Clone active tab"
        >
          <Copy size={16} />
        </button>
      </div>

      <div className="flex-none ml-auto pl-4">
        <Popover.Root>
          <Popover.Trigger asChild>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-[var(--border-toolbar)] rounded-md hover:bg-[var(--bg-toolbar-hover)] text-[var(--fg-toolbar)] transition-colors"
              title="Change theme"
            >
              {themeOptions.find(t => t.id === theme)?.icon}
              <span className="hidden sm:inline capitalize">{theme}</span>
              <ChevronUp size={14} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content 
              side="top" 
              align="end" 
              sideOffset={8}
              className="z-[100] w-40 bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-lg shadow-xl p-1 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    theme === option.id 
                      ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]" 
                      : "text-[var(--fg-popover)] hover:bg-[var(--bg-toolbar-hover)]"
                  )}
                >
                  {option.icon}
                  {option.name}
                </button>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}
