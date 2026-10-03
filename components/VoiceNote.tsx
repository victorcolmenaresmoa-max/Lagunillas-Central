"use client";
import { useEffect, useRef, useState } from "react";
/** Recording stays local until the user sends the message. */
export default function VoiceNote({
  onReady,
  disabled,
}: {
  onReady: (file: File) => void;
  disabled: boolean;
}) {
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recording, setRecording] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };
  const start = async () => {
    setError("");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Este navegador no permite grabar. Puedes adjuntar un archivo de audio.",
        );
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mime)
        throw new Error(
          "No hay un formato de grabación compatible; adjunta un audio.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const r = new MediaRecorder(media, { mimeType: mime });
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const ext =
          mime === "audio/mp4" ? "m4a" : mime === "audio/ogg" ? "ogg" : "webm";
        onReady(new File(chunks, `nota.${ext}`, { type: mime }));
      };
      r.onerror = () => {
        media.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setError("No se pudo grabar. Intenta de nuevo.");
      };
      r.start();
      setRecording(true);
      timer.current = setTimeout(stop, 60000);
    } catch (e: any) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(e.message || "Permite acceso al micrófono para grabar.");
    }
  };
  return (
    <div className="space-y-2">
      <button
        className="btn-ghost"
        type="button"
        disabled={disabled && !recording}
        onClick={recording ? stop : start}
      >
        {recording ? "Detener grabación" : "Grabar nota de voz"}
      </button>
      <p className="text-xs">Máximo 60 segundos. Se envía al pulsar Enviar.</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
