import { useEffect, useMemo, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { getCameraSource, saveCameraSource } from "../../services/cameraSource.service";
import { getDetectorSettings } from "../../services/detectorSettings.service";
import { useCameraStream } from "../../hooks/useCameraStream";
import "./CameraPanel.css";

const STATUS_LABELS = {
  idle: "Ожидание запуска",
  loading: "Подключение...",
  playing: "Поток активен",
  stopped: "Поток остановлен",
  error: "Ошибка",
};

const EMOTION_LABELS = {
  neutral: "Нейтрально",
  happy: "Радость",
  sad: "Грусть",
  angry: "Злость",
  fearful: "Страх",
  disgusted: "Отвращение",
  surprised: "Удивление",
};

const SENSITIVITY_PROFILES = {
  fast: {
    tinyFast: { inputSize: 224, scoreThreshold: 0.55 },
    tinyFar: { inputSize: 416, scoreThreshold: 0.3 },
    fastTickMs: 260,
    farTickMs: 700,
    ssdEvery: 5,
    label: "Быстро",
  },
  balanced: {
    tinyFast: { inputSize: 320, scoreThreshold: 0.42 },
    tinyFar: { inputSize: 608, scoreThreshold: 0.2 },
    fastTickMs: 380,
    farTickMs: 900,
    ssdEvery: 3,
    label: "Сбалансировано",
  },
  accurate: {
    tinyFast: { inputSize: 416, scoreThreshold: 0.35 },
    tinyFar: { inputSize: 608, scoreThreshold: 0.16 },
    fastTickMs: 520,
    farTickMs: 1200,
    ssdEvery: 1,
    label: "Точно",
  },
};

const SSD_OPTIONS = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.22,
  maxResults: 40,
});

const FAR_MODE_AFTER_MISSES = 3;
const IOU_THRESHOLD = 0.45;

const getDominantEmotion = (expressions) => {
  const entries = Object.entries(expressions || {});
  if (!entries.length) {
    return null;
  }

  const [emotion, score] = entries.reduce((best, current) => (current[1] > best[1] ? current : best));
  return {
    key: emotion,
    label: EMOTION_LABELS[emotion] || emotion,
    score,
  };
};

const clearCanvas = (canvas) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const getIoU = (a, b) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }

  const intersection = (x2 - x1) * (y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
};

const mergeDetections = (primary, secondary) => {
  const merged = [...primary];

  secondary.forEach((candidate) => {
    const candidateBox = candidate.detection.box;
    const alreadyExists = merged.some(
      (existing) => getIoU(existing.detection.box, candidateBox) > IOU_THRESHOLD
    );
    if (!alreadyExists) {
      merged.push(candidate);
    }
  });

  return merged;
};

const drawDetections = (canvas, detections, showEmotionText) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  detections.forEach((item, index) => {
    const { x, y, width, height } = item.detection.box;
    const label = showEmotionText ? item.label || "Лицо" : `Лицо ${index + 1}`;

    ctx.strokeStyle = "#38f8ab";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    ctx.font = "600 15px 'Gill Sans', sans-serif";
    const textWidth = ctx.measureText(label).width;
    const labelX = x;
    const labelY = Math.max(24, y - 8);

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(labelX - 6, labelY - 18, textWidth + 12, 24);

    ctx.fillStyle = "#8dfbc7";
    ctx.fillText(label, labelX, labelY);
  });
};

const CameraPanel = () => {
  const [source, setSource] = useState(getCameraSource);
  const [detectorSettings, setDetectorSettings] = useState(getDetectorSettings);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [ssdLoaded, setSsdLoaded] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [emotionError, setEmotionError] = useState("");
  const [detectorMode, setDetectorMode] = useState("fast");
  const canvasRef = useRef(null);
  const missStreakRef = useRef(0);
  const cycleRef = useRef(0);
  const { videoRef, status, error, start, stop } = useCameraStream();

  useEffect(() => {
    const syncSettings = () => {
      setDetectorSettings(getDetectorSettings());
    };

    syncSettings();
    window.addEventListener("focus", syncSettings);
    window.addEventListener("storage", syncSettings);

    return () => {
      window.removeEventListener("focus", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      setModelsError("");
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);

        const warnings = [];
        let localSsdLoaded = false;

        try {
          await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
          localSsdLoaded = true;
        } catch {
          warnings.push("SSD модель не найдена.");
        }

        // try {
        // } catch {
        //   warnings.push("Модель возраста не найдена.");
        // }

        if (!cancelled) {
          setSsdLoaded(localSsdLoaded);
          if (warnings.length) {
            setModelsError(warnings.join(" "));
          }
          setModelsLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setModelsError("Не удалось загрузить модели face-api.");
        }
      }
    };

    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    start(source);
  }, [source, start]);

  useEffect(() => {
    if (status !== "playing") {
      const canvas = canvasRef.current;
      if (canvas) {
        clearCanvas(canvas);
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }

    const updateCanvasSize = () => {
      const width = video.videoWidth || video.clientWidth;
      const height = video.videoHeight || video.clientHeight;
      if (!width || !height) {
        return;
      }

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };

    updateCanvasSize();
    video.addEventListener("loadedmetadata", updateCanvasSize);
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      video.removeEventListener("loadedmetadata", updateCanvasSize);
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [status, videoRef]);

  useEffect(() => {
    if (!modelsLoaded || status !== "playing") {
      return undefined;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return undefined;
    }

    let active = true;
    let timerId = null;

    const sensitivityKey = detectorSettings.sensitivity || "balanced";
    const profile = SENSITIVITY_PROFILES[sensitivityKey] || SENSITIVITY_PROFILES.balanced;

    const detect = async () => {
      const useFarMode = missStreakRef.current >= FAR_MODE_AFTER_MISSES;
      const tinyConfig = useFarMode ? profile.tinyFar : profile.tinyFast;
      const tinyOptions = new faceapi.TinyFaceDetectorOptions(tinyConfig);
      const runSsdThisCycle = ssdLoaded && (useFarMode || cycleRef.current % profile.ssdEvery === 0);
      cycleRef.current += 1;

      setDetectorMode(useFarMode ? "far" : runSsdThisCycle ? "hybrid" : "fast");

      try {
        const tinyTask = faceapi.detectAllFaces(video, tinyOptions).withFaceExpressions();
        const tinyPromise = tinyTask;

        const ssdPromise = runSsdThisCycle
          ? (() => {
              const ssdTask = faceapi.detectAllFaces(video, SSD_OPTIONS).withFaceExpressions();
              return ssdTask;
            })()
          : Promise.resolve([]);

        const [tinyResults, ssdResults] = await Promise.all([tinyPromise, ssdPromise]);
        if (!active) {
          return useFarMode;
        }

        const merged = mergeDetections(ssdResults, tinyResults);
        if (!merged.length) {
          missStreakRef.current += 1;
          setDetectedFaces([]);
          setEmotionError("Лица не найдены.");
          clearCanvas(canvas);
          return useFarMode;
        }

        missStreakRef.current = 0;

        const displaySize = { width: canvas.width, height: canvas.height };
        const resized = faceapi.resizeResults(merged, displaySize);
        const mappedDetections = merged.map((item, index) => {
          const dominant = getDominantEmotion(item.expressions);
          const emotionLabel = dominant ? dominant.label : "Эмоция";
          const label = emotionLabel;

          return {
            detection: resized[index].detection,
            dominant,
            label,
          };
        });

        setEmotionError("");
        setDetectedFaces(mappedDetections);

        if (detectorSettings.drawBoxes) {
          drawDetections(canvas, mappedDetections, detectorSettings.showEmotionText);
        } else {
          clearCanvas(canvas);
        }

        return useFarMode;
      } catch {
        if (active) {
          setEmotionError("Ошибка анализа кадра.");
          clearCanvas(canvas);
        }
        return useFarMode;
      }
    };

    const loop = async () => {
      if (!active) {
        return;
      }

      const useFarMode = await detect();
      const nextDelay = useFarMode ? profile.farTickMs : profile.fastTickMs;
      timerId = window.setTimeout(loop, nextDelay);
    };

    loop();

    return () => {
      active = false;
      missStreakRef.current = 0;
      cycleRef.current = 0;
      if (timerId) {
        window.clearTimeout(timerId);
      }
      clearCanvas(canvas);
    };
  }, [modelsLoaded, status, videoRef, ssdLoaded, detectorSettings]);

  const handleTypeChange = (event) => {
    const nextSource = { ...source, type: event.target.value };
    setSource(nextSource);
    saveCameraSource(nextSource);
  };

  const handleIpUrlChange = (event) => {
    const nextSource = { ...source, ipUrl: event.target.value };
    setSource(nextSource);
    saveCameraSource(nextSource);
  };

  const handleRestart = () => {
    missStreakRef.current = 0;
    cycleRef.current = 0;
    setDetectorMode("fast");
    setEmotionError("");
    start(source);
  };

  const handleStop = () => {
    missStreakRef.current = 0;
    cycleRef.current = 0;
    setDetectorMode("fast");
    setDetectedFaces([]);
    setEmotionError("");
    const canvas = canvasRef.current;
    if (canvas) {
      clearCanvas(canvas);
    }
    stop();
  };

  const emotionText = useMemo(() => {
    if (detectedFaces.length) {
      if (!detectorSettings.showEmotionText) {
        return `Лиц обнаружено: ${detectedFaces.length}`;
      }

      const summary = detectedFaces
        .slice(0, 3)
        .map((item) => {
          const emotionLabel = item.dominant?.label || "Эмоция";
          return emotionLabel;
        })
        .join(" | ");

      return `Лиц: ${detectedFaces.length}. ${summary}`;
    }

    if (emotionError) {
      return emotionError;
    }

    return "Ожидание распознавания...";
  }, [detectedFaces, emotionError, detectorSettings.showEmotionText]);

  const sensitivityLabel =
    SENSITIVITY_PROFILES[detectorSettings.sensitivity]?.label || SENSITIVITY_PROFILES.balanced.label;

  return (
    <section className="camera-panel">
      <div className="camera-panel__controls">
        <label className="camera-panel__field">
          Источник:
          <select value={source.type} onChange={handleTypeChange}>
            <option value="local">Камера ноутбука</option>
            <option value="ip">IP-камера (URL)</option>
          </select>
        </label>

        {source.type === "ip" && (
          <label className="camera-panel__field camera-panel__field--wide">
            URL IP-камеры:
            <input
              type="url"
              placeholder="http://192.168.1.100:8080/video"
              value={source.ipUrl}
              onChange={handleIpUrlChange}
            />
          </label>
        )}

        <div className="camera-panel__actions">
          <button type="button" onClick={handleRestart}>
            Запустить
          </button>
          <button type="button" onClick={handleStop}>
            Остановить
          </button>
        </div>
      </div>

      <div className="camera-panel__status">
        <span>{STATUS_LABELS[status] || "Состояние неизвестно"}</span>
        {error && <span className="camera-panel__error">{error}</span>}
      </div>

      <div className="camera-panel__status">
        <span>
          Модели: {modelsLoaded ? "Загружены" : "Загрузка..."}
        </span>
        {modelsError && <span className="camera-panel__error">{modelsError}</span>}
      </div>

      <div className="camera-panel__status">
        <span>
          Режим детектора:{" "}
          {detectorMode === "far"
            ? "Дальний"
            : detectorMode === "hybrid"
            ? "Гибридный (Tiny + SSD)"
            : "Быстрый (Tiny)"}{" "}
          | Чувствительность: {sensitivityLabel}
        </span>
      </div>

      <div className="camera-panel__video-wrap">
        <video ref={videoRef} autoPlay muted playsInline controls={source.type === "ip"} />
        <canvas ref={canvasRef} className="camera-panel__overlay-canvas" />
        {detectorSettings.showEmotionText && (
          <div className="camera-panel__emotion-overlay">
            <span>Emotions: {emotionText}</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default CameraPanel;



