import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { EditorCommand } from '@/lib/editorCommands';
import { cn } from '@/lib/utils';

interface CommandListProps {
  items: EditorCommand[];
  command: (item: EditorCommand) => void;
}

const CommandList = forwardRef((props: CommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="bg-[var(--bg-popover)] border border-[var(--border-popover)] rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 min-w-[220px] max-h-[400px] overflow-y-auto animate-in fade-in zoom-in duration-200 no-scrollbar">
      {props.items.map((item, index) => (
        <button
          key={index}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-left transition-colors",
            index === selectedIndex 
              ? "bg-[var(--bg-toolbar-active)] text-[var(--fg-toolbar-active)]" 
              : "text-[var(--fg-popover)] hover:bg-[var(--bg-toolbar-hover)]"
          )}
          onClick={() => selectItem(index)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className={cn(
            "flex items-center justify-center shrink-0 w-6 h-6 rounded bg-opacity-10",
            index === selectedIndex ? "bg-white/20" : "bg-[var(--bg-toolbar-hover)]"
          )}>
            {item.icon}
          </div>
          <div className="flex flex-col">
            <span>{item.title}</span>
            {item.category && <span className={cn(
              "text-[10px] opacity-60 uppercase tracking-wider font-bold",
              index === selectedIndex ? "text-white" : "text-[var(--fg-popover)]"
            )}>{item.category}</span>}
          </div>
        </button>
      ))}
    </div>
  );
});

CommandList.displayName = 'CommandList';

export default CommandList;
