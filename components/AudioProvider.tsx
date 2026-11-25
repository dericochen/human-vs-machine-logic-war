"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { audio } from "@/lib/audio";

type SfxKind = "click" | "correct" | "wrong" | "start" | "stageUp" | "finalTick" | "victory" | "defeat";

interface AudioContextValue {
  musicMuted: boolean;
  sfxMuted: boolean;
  toggleMusic: () => void;
  toggleSfx: () => void;
  play: (kind: SfxKind) => void;
  startMusic: () => void;
  stopMusic: () => void;
  setIntensity: (n: number) => void;
}

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);

  const toggleMusic = useCallback(() => {
    setMusicMuted((m) => {
      audio.setMusicMuted(!m);
      return !m;
    });
  }, []);
  const toggleSfx = useCallback(() => {
    setSfxMuted((m) => {
      audio.setSfxMuted(!m);
      return !m;
    });
  }, []);

  const play = useCallback((kind: SfxKind) => audio.play(kind), []);
  const startMusic = useCallback(() => audio.startMusic(), []);
  const stopMusic = useCallback(() => audio.stopMusic(), []);
  const setIntensity = useCallback((n: number) => audio.setIntensity(n), []);

  const value = useMemo(
    () => ({ musicMuted, sfxMuted, toggleMusic, toggleSfx, play, startMusic, stopMusic, setIntensity }),
    [musicMuted, sfxMuted, toggleMusic, toggleSfx, play, startMusic, stopMusic, setIntensity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAudio must be used inside AudioProvider");
  return v;
}
