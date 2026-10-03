"use client";
import { useEffect, useState } from "react";
export default function AudioMessage({ url }: { url: string }) {
  const [src, setSrc] = useState(url),
    [playing, setPlaying] = useState(false);
  // Polling refreshes signed URLs; do not interrupt an audio already playing.
  useEffect(() => {
    if (!playing) setSrc(url);
  }, [url, playing]);
  return (
    <audio
      className="w-full"
      controls
      preload="none"
      src={src}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
    >
      Tu navegador no permite reproducir este audio.
    </audio>
  );
}
