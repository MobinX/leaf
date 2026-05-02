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
  const [isOpen, setIsOpen] = React.useState(false);

  const themeOptions = [
    { id: 'light', name: 'Light', icon: <Sun size={16} /> },
    { id: 'dark', name: 'Dark', icon: <Moon size={16} /> },
    { id: 'hybrid', name: 'Hybrid', icon: <Palette size={16} /> },
  ] as const;

  return (
    <>
      {/* Sleek thin handle */}
      <div 
        className={cn(
          "fixed bottom-0 left-1/2 -translate-x-1/2 w-24 h-2 bg-gray-400/50 backdrop-blur-sm dark:bg-gray-600/50 rounded-t-full cursor-pointer hover:h-3 transition-all z-[60] flex items-center justify-center group no-print",
          isOpen && "bottom-[68px]"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronUp 
          size={12} 
          className={cn(
            "text-[var(--fg-toolbar)] opacity-0 group-hover:opacity-100 transition-all transform",
            isOpen && "rotate-180 opacity-100"
          )} 
        />
      </div>

      <div className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[1200px] h-12 bg-[var(--bg-toolbar)]/70 backdrop-blur-md border border-[var(--border-toolbar)] flex items-center px-4 gap-2 overflow-x-auto shadow-xl no-print z-50 rounded-2xl transition-all duration-300 ease-in-out",
        !isOpen && "translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none"
      )}>
        <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors shrink-0",
                activeTabId === tab.id
                  ? 'bg-[var(--bg-toolbar-active)] border-[var(--border-toolbar)] text-[var(--fg-toolbar-active)] shadow-sm'
                  : 'bg-transparent border-transparent text-[var(--fg-toolbar)] hover:bg-[var(--bg-toolbar-hover)]'
              )}
            >
              {tab.name}
            </button>
          ))}
          <button
            onClick={onAddTab}
            className="p-1.5 text-sm font-medium border border-[var(--border-toolbar)] rounded-md hover:bg-[var(--bg-toolbar-hover)] flex items-center text-[var(--fg-toolbar)] transition-colors"
            title="Add new tab"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onCloneTab}
            className="p-1.5 text-sm font-medium border border-[var(--border-toolbar)] rounded-md hover:bg-[var(--bg-toolbar-hover)] flex items-center text-[var(--fg-toolbar)] transition-colors"
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
    </>
  );
}
