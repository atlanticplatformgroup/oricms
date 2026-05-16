/**
 * useKeyboardShortcuts Hook - Global keyboard shortcuts
 * 
 * Usage:
 * useKeyboardShortcuts({
 *   'ctrl+s': handleSave,
 *   'ctrl+n': handleNew,
 *   'esc': handleClose,
 * });
 */

import { useEffect, useCallback, useRef } from 'react';

type KeyCombo = string;
type ShortcutHandler = (event: KeyboardEvent) => void;

interface Shortcuts {
  [key: KeyCombo]: ShortcutHandler;
}

function normalizeKeyCombo(combo: string): string {
  return combo
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('cmd', 'meta')
    .replace('command', 'meta')
    .replace('option', 'alt')
    .replace('return', 'enter');
}

function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const normalized = normalizeKeyCombo(combo);
  const parts = normalized.split('+');
  
  const key = parts.pop() || '';
  const modifiers = parts;
  
  // Check if the key matches
  if (event.key.toLowerCase() !== key && event.code.toLowerCase() !== `key${key}`) {
    return false;
  }
  
  // Check modifiers
  const hasCtrl = modifiers.includes('ctrl');
  const hasShift = modifiers.includes('shift');
  const hasAlt = modifiers.includes('alt');
  const hasMeta = modifiers.includes('meta');
  
  if (event.ctrlKey !== hasCtrl) return false;
  if (event.shiftKey !== hasShift) return false;
  if (event.altKey !== hasAlt) return false;
  if (event.metaKey !== hasMeta) return false;
  
  return true;
}

export function useKeyboardShortcuts(
  shortcuts: Shortcuts,
  options: { enabled?: boolean; preventDefault?: boolean } = {}
) {
  const { enabled = true, preventDefault = true } = options;
  const shortcutsRef = useRef(shortcuts);
  
  // Keep ref up to date
  shortcutsRef.current = shortcuts;
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when typing in input/textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow some shortcuts even in inputs (like Ctrl+S)
      const combo = Object.keys(shortcutsRef.current).find(c => 
        matchesCombo(event, c)
      );
      
      if (combo && (combo.includes('ctrl') || combo.includes('meta'))) {
        if (preventDefault) event.preventDefault();
        shortcutsRef.current[combo](event);
      }
      return;
    }
    
    // Find matching shortcut
    const combo = Object.keys(shortcutsRef.current).find(c => 
      matchesCombo(event, c)
    );
    
    if (combo) {
      if (preventDefault) event.preventDefault();
      shortcutsRef.current[combo](event);
    }
  }, [enabled, preventDefault]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Keyboard shortcut help modal
 */
interface ShortcutDef {
  combo: string;
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutDef[];
}

export const DEFAULT_SHORTCUTS: ShortcutCategory[] = [
  {
    name: 'Navigation',
    shortcuts: [
      { combo: 'Ctrl+1', description: 'Go to Pages' },
      { combo: 'Ctrl+2', description: 'Go to Members' },
      { combo: 'Ctrl+3', description: 'Go to Settings' },
      { combo: 'Ctrl+K', description: 'Open project switcher' },
    ],
  },
  {
    name: 'Pages',
    shortcuts: [
      { combo: 'Ctrl+N', description: 'New page' },
      { combo: 'Ctrl+S', description: 'Save page' },
      { combo: 'Ctrl+E', description: 'Edit page' },
      { combo: 'Ctrl+D', description: 'Delete page' },
      { combo: 'Esc', description: 'Cancel editing' },
    ],
  },
  {
    name: 'Editor',
    shortcuts: [
      { combo: 'Ctrl+B', description: 'Bold' },
      { combo: 'Ctrl+I', description: 'Italic' },
      { combo: 'Ctrl+K', description: 'Insert link' },
      { combo: 'Ctrl+Z', description: 'Undo' },
      { combo: 'Ctrl+Shift+Z', description: 'Redo' },
    ],
  },
];

export function formatShortcut(combo: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  return combo
    .replace('Ctrl', isMac ? '⌘' : 'Ctrl')
    .replace('Meta', '⌘')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Cmd', '⌘')
    .replace(/\+/g, ' ');
}
