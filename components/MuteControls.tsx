"use client";

import { useAudio } from "./AudioProvider";

export default function MuteControls() {
  const { musicMuted, sfxMuted, toggleMusic, toggleSfx, play } = useAudio();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          toggleMusic();
          play("click");
        }}
        className="glass rounded-lg px-3 py-1.5 text-xs text-inkdim hover:text-ink"
        aria-pressed={!musicMuted}
        aria-label={musicMuted ? "Unmute music" : "Mute music"}
      >
        {musicMuted ? "Music off" : "Music on"}
      </button>
      <button
        type="button"
        onClick={() => {
          toggleSfx();
          play("click");
        }}
        className="glass rounded-lg px-3 py-1.5 text-xs text-inkdim hover:text-ink"
        aria-pressed={!sfxMuted}
        aria-label={sfxMuted ? "Unmute sound effects" : "Mute sound effects"}
      >
        {sfxMuted ? "SFX off" : "SFX on"}
      </button>
    </div>
  );
}
