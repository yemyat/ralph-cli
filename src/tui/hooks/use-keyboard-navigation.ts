// src/tui/hooks/use-keyboard-navigation.ts
// Extracts vim-style keyboard navigation from app.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import { TIMING } from "../lib/constants";
import type { Task, VimMode } from "../types";

export interface NavOptions {
  wrap?: boolean;
  onExit?: () => void;
  onCommand?: (command: string) => boolean;
}

export interface SearchState {
  query: string;
  matches: Task[];
  matchIndex: number;
}

export interface KeyEvent {
  input: string;
  isUpArrow?: boolean;
  isDownArrow?: boolean;
  isReturn?: boolean;
  isEscape?: boolean;
  isBackspace?: boolean;
  isDelete?: boolean;
  ctrl?: boolean;
}

export interface NavigationHandlers {
  handleKeyEvent: (event: KeyEvent) => void;
  jumpToFirst: () => void;
  jumpToLast: () => void;
  navigateToIndex: (index: number) => void;
  clearSearch: () => void;
  reset: () => void;
}

export interface NavigationState {
  mode: VimMode;
  selectedIndex: number;
  searchState: SearchState;
  commandBuffer: string;
  handlers: NavigationHandlers;
}

export function useKeyboardNavigation(
  tasks: Task[],
  options: NavOptions = {}
): NavigationState {
  const { wrap = false, onExit, onCommand } = options;

  // Mode state
  const [mode, setMode] = useState<VimMode>("normal");

  // Navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<Task[]>([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  // Command state
  const [commandBuffer, setCommandBuffer] = useState("");

  // Double-tap detection for gg
  const lastKeyRef = useRef<{ key: string; time: number }>({
    key: "",
    time: 0,
  });

  // Update search matches when query changes
  useEffect(() => {
    if (searchQuery.length > 0) {
      const matches = tasks.filter((task) =>
        task.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchMatches(matches);
      setSearchMatchIndex(0);
    } else {
      setSearchMatches([]);
      setSearchMatchIndex(0);
    }
  }, [searchQuery, tasks]);

  // Clamp selection when tasks change
  useEffect(() => {
    if (tasks.length > 0 && selectedIndex >= tasks.length) {
      setSelectedIndex(tasks.length - 1);
    }
  }, [tasks.length, selectedIndex]);

  // Navigate to specific index
  const navigateToIndex = useCallback(
    (index: number) => {
      if (tasks.length === 0) {
        return;
      }
      const clampedIndex = Math.max(0, Math.min(index, tasks.length - 1));
      setSelectedIndex(clampedIndex);
    },
    [tasks.length]
  );

  // Jump to first/last
  const jumpToFirst = useCallback(() => {
    navigateToIndex(0);
  }, [navigateToIndex]);

  const jumpToLast = useCallback(() => {
    navigateToIndex(tasks.length - 1);
  }, [navigateToIndex, tasks.length]);

  // Navigate to a task (for search match selection)
  const navigateToTask = useCallback(
    (task: Task) => {
      const index = tasks.findIndex((t) => t.id === task.id);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    },
    [tasks]
  );

  // Handle vertical navigation
  const handleVerticalNav = useCallback(
    (direction: "up" | "down") => {
      if (tasks.length === 0) {
        return;
      }

      if (direction === "up") {
        if (selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        } else if (wrap) {
          setSelectedIndex(tasks.length - 1);
        }
      } else if (selectedIndex < tasks.length - 1) {
        setSelectedIndex(selectedIndex + 1);
      } else if (wrap) {
        setSelectedIndex(0);
      }
    },
    [selectedIndex, tasks.length, wrap]
  );

  // Handle gg double-tap detection
  const handleDoubleTapG = useCallback(() => {
    const now = Date.now();
    const lastKey = lastKeyRef.current;
    if (lastKey.key === "g" && now - lastKey.time < TIMING.DOUBLE_TAP_MS) {
      jumpToFirst();
      lastKeyRef.current = { key: "", time: 0 };
    } else {
      lastKeyRef.current = { key: "g", time: now };
    }
  }, [jumpToFirst]);

  // Handle search match navigation
  const handleSearchMatchNav = useCallback(
    (direction: "next" | "prev") => {
      if (searchMatches.length === 0) {
        return;
      }
      const newIndex =
        direction === "next"
          ? (searchMatchIndex + 1) % searchMatches.length
          : (searchMatchIndex - 1 + searchMatches.length) %
            searchMatches.length;
      setSearchMatchIndex(newIndex);
      navigateToTask(searchMatches[newIndex]);
    },
    [searchMatches, searchMatchIndex, navigateToTask]
  );

  // Select current search match
  const selectSearchMatch = useCallback(() => {
    if (searchMatches.length > 0 && searchMatchIndex < searchMatches.length) {
      const match = searchMatches[searchMatchIndex];
      navigateToTask(match);
      setMode("normal");
      setSearchQuery("");
    }
  }, [searchMatches, searchMatchIndex, navigateToTask]);

  // Clear search state
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchMatches([]);
    setSearchMatchIndex(0);
  }, []);

  // Reset all navigation state
  const reset = useCallback(() => {
    setMode("normal");
    setSelectedIndex(0);
    clearSearch();
    setCommandBuffer("");
    lastKeyRef.current = { key: "", time: 0 };
  }, [clearSearch]);

  // Handle mode transitions (extracted for complexity)
  const handleModeTransition = useCallback((input: string): boolean => {
    switch (input) {
      case "/":
        setMode("search");
        setSearchQuery("");
        return true;
      case ":":
        setMode("command");
        setCommandBuffer(":");
        return true;
      default:
        return false;
    }
  }, []);

  // Handle navigation keys (extracted for complexity)
  const handleNavigationKey = useCallback(
    (input: string, isUpArrow?: boolean, isDownArrow?: boolean): boolean => {
      if (input === "G") {
        jumpToLast();
        return true;
      }
      if (isUpArrow || input === "k") {
        handleVerticalNav("up");
        return true;
      }
      if (isDownArrow || input === "j") {
        handleVerticalNav("down");
        return true;
      }
      if (input === "n") {
        handleSearchMatchNav("next");
        return true;
      }
      if (input === "N") {
        handleSearchMatchNav("prev");
        return true;
      }
      return false;
    },
    [jumpToLast, handleVerticalNav, handleSearchMatchNav]
  );

  // Handle normal mode input
  const handleNormalModeInput = useCallback(
    (event: KeyEvent) => {
      const { input, isUpArrow, isDownArrow, ctrl } = event;

      // Check for gg (double-tap g)
      if (input === "g") {
        handleDoubleTapG();
        return;
      }

      // Clear last key on any other input
      lastKeyRef.current = { key: "", time: 0 };

      // Mode transitions
      if (handleModeTransition(input)) {
        return;
      }

      // Navigation keys
      if (handleNavigationKey(input, isUpArrow, isDownArrow)) {
        return;
      }

      // Quit commands
      if (ctrl && input === "c") {
        onExit?.();
        return;
      }
      if (input === "q" && searchMatches.length === 0) {
        onExit?.();
      }
    },
    [
      handleDoubleTapG,
      handleModeTransition,
      handleNavigationKey,
      searchMatches.length,
      onExit,
    ]
  );

  // Handle search mode input
  const handleSearchModeInput = useCallback(
    (event: KeyEvent) => {
      const { input, isReturn, isEscape, isBackspace, isDelete } = event;

      // Cancel search
      if (isEscape) {
        setMode("normal");
        setSearchQuery("");
        return;
      }

      // Select current match
      if (isReturn) {
        selectSearchMatch();
        return;
      }

      // Backspace
      if (isBackspace || isDelete) {
        setSearchQuery((prev) => prev.slice(0, -1));
        return;
      }

      // Add character to search query
      if (input.length === 1 && input.charCodeAt(0) >= 32) {
        setSearchQuery((prev) => prev + input);
      }
    },
    [selectSearchMatch]
  );

  // Handle command mode input
  const handleCommandModeInput = useCallback(
    (event: KeyEvent) => {
      const { input, isReturn, isEscape, isBackspace, isDelete } = event;

      // Cancel command
      if (isEscape) {
        setMode("normal");
        setCommandBuffer("");
        return;
      }

      // Execute command
      if (isReturn) {
        // Check for custom command handler first
        const handled = onCommand?.(commandBuffer);

        // Built-in :q/:quit handling
        if (!handled && (commandBuffer === ":q" || commandBuffer === ":quit")) {
          onExit?.();
        }

        setMode("normal");
        setCommandBuffer("");
        return;
      }

      // Backspace
      if (isBackspace || isDelete) {
        if (commandBuffer.length > 1) {
          setCommandBuffer((prev) => prev.slice(0, -1));
        } else {
          setMode("normal");
          setCommandBuffer("");
        }
        return;
      }

      // Add character to command
      if (input.length === 1 && input.charCodeAt(0) >= 32) {
        setCommandBuffer((prev) => prev + input);
      }
    },
    [commandBuffer, onCommand, onExit]
  );

  // Main key event handler
  const handleKeyEvent = useCallback(
    (event: KeyEvent) => {
      switch (mode) {
        case "search":
          handleSearchModeInput(event);
          break;
        case "command":
          handleCommandModeInput(event);
          break;
        default:
          handleNormalModeInput(event);
      }
    },
    [mode, handleNormalModeInput, handleSearchModeInput, handleCommandModeInput]
  );

  return {
    mode,
    selectedIndex,
    searchState: {
      query: searchQuery,
      matches: searchMatches,
      matchIndex: searchMatchIndex,
    },
    commandBuffer,
    handlers: {
      handleKeyEvent,
      jumpToFirst,
      jumpToLast,
      navigateToIndex,
      clearSearch,
      reset,
    },
  };
}
