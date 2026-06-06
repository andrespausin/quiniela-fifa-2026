"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

const STORAGE_KEY = "active_quiniela_id";

type QuinielaCtx = {
  activeId: string | null;
  setActive: (id: string) => void;
};

const QuinielaContext = createContext<QuinielaCtx>({
  activeId: null,
  setActive: () => {},
});

export function QuinielaProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Restaurar desde localStorage después de la hidratación
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveId(stored);
  }, []);

  const setActive = (id: string) => {
    setActiveId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <QuinielaContext.Provider value={{ activeId, setActive }}>
      {children}
    </QuinielaContext.Provider>
  );
}

export function useActiveQuiniela() {
  return useContext(QuinielaContext);
}
