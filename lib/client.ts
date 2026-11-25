"use client";

// Client-side helpers: persistent guest identity, avatars, API fetch.

export const AVATARS: string[] = [
  "\u{1F9E0}", // brain
  "\u{1F680}", // rocket
  "\u{1F47D}", // alien
  "\u{1F916}", // robot
  "\u{1F977}", // ninja
  "\u{1F9D9}", // mage
  "\u{1F42F}", // tiger
  "\u{1F525}", // fire
  "\u{1F31F}", // glowing star
  "\u{1F47B}", // ghost
];

const PLAYER_KEY = "lw_player_id";

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(PLAYER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(PLAYER_KEY, id);
  }
  return id;
}

export async function apiFetch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((json && (json as { error?: string }).error) || `Request failed (${res.status})`);
  }
  return json as T;
}
