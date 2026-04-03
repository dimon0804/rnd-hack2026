"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "cyber-drill-progress-v1";

type GameState = {
  securityScore: number;
  xp: number;
  totalChoices: number;
  safeChoices: number;
  criticalMistakes: number;
  completedScenarioIds: string[];
};

const defaultState: GameState = {
  securityScore: 100,
  xp: 0,
  totalChoices: 0,
  safeChoices: 0,
  criticalMistakes: 0,
  completedScenarioIds: [],
};

type GameContextValue = GameState & {
  level: number;
  accuracyPercent: number | null;
  applyResult: (input: {
    scenarioId: string;
    isSafe: boolean;
    severity: "none" | "low" | "medium" | "critical";
    securityDelta: number;
    xpDelta: number;
  }) => void;
  reset: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

function loadState(): GameState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      ...defaultState,
      ...parsed,
      completedScenarioIds: Array.isArray(parsed.completedScenarioIds)
        ? parsed.completedScenarioIds
        : [],
    };
  } catch {
    return defaultState;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(defaultState);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const applyResult = useCallback(
    (input: {
      scenarioId: string;
      isSafe: boolean;
      severity: "none" | "low" | "medium" | "critical";
      securityDelta: number;
      xpDelta: number;
    }) => {
      setState((prev) => {
        const nextScore = Math.min(
          100,
          Math.max(0, prev.securityScore + input.securityDelta),
        );
        const nextXp = Math.max(0, prev.xp + input.xpDelta);
        const totalChoices = prev.totalChoices + 1;
        const safeChoices = prev.safeChoices + (input.isSafe ? 1 : 0);
        const criticalMistakes =
          prev.criticalMistakes +
          (!input.isSafe && input.severity === "critical" ? 1 : 0);
        const completed = prev.completedScenarioIds.includes(input.scenarioId)
          ? prev.completedScenarioIds
          : [...prev.completedScenarioIds, input.scenarioId];
        return {
          securityScore: nextScore,
          xp: nextXp,
          totalChoices,
          safeChoices,
          criticalMistakes,
          completedScenarioIds: completed,
        };
      });
    },
    [],
  );

  const reset = useCallback(() => {
    setState(defaultState);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<GameContextValue>(() => {
    const level = Math.floor(state.xp / 120) + 1;
    const accuracyPercent =
      state.totalChoices > 0
        ? Math.round((state.safeChoices / state.totalChoices) * 100)
        : null;
    return {
      ...state,
      level,
      accuracyPercent,
      applyResult,
      reset,
    };
  }, [state, applyResult, reset]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
