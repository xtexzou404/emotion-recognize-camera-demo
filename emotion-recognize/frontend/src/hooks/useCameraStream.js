import { useCallback, useEffect, useRef, useState } from "react";

export const useCameraStream = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }

    setStatus("stopped");
  }, []);

  const start = useCallback(
    async (source) => {
      const video = videoRef.current;
      if (!video) {
        setError("Видеоэлемент не найден.");
        setStatus("error");
        return;
      }

      stop();
      setError("");
      setStatus("loading");

      try {
        if (source.type === "local") {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Браузер не поддерживает доступ к камере.");
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, min: 15 },
              facingMode: "user",
            },
            audio: false,
          });

          streamRef.current = stream;
          video.srcObject = stream;
          await video.play();
          setStatus("playing");
          return;
        }

        if (!source.ipUrl) {
          throw new Error("Введите URL для IP-камеры.");
        }

        video.srcObject = null;
        video.src = source.ipUrl;
        await video.play();
        setStatus("playing");
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Не удалось запустить видеопоток.");
      }
    },
    [stop]
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    status,
    error,
    start,
    stop,
  };
};

