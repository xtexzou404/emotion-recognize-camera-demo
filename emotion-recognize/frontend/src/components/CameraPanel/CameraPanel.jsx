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

const GENDER_LABELS = {
  male: "Мужчина",
  female: "Женщина",
};

const SENSITIVITY_PROFILES = {
  fast: {
    tinyFast: { inputSize: 224, scoreThreshold: 0.55 },
    tinyFar: { inputSize: 416, scoreThreshold: 0.3 },
    fastTickMs: 220,
    farTickMs: 560,
    ssdEvery: 6,
    label: "Быстро",
  },
  balanced: {
    tinyFast: { inputSize: 320, scoreThreshold: 0.42 },
    tinyFar: { inputSize: 608, scoreThreshold: 0.2 },
    fastTickMs: 300,
    farTickMs: 760,
    ssdEvery: 4,
    label: "Сбалансировано",
  },
  accurate: {
    tinyFast: { inputSize: 416, scoreThreshold: 0.35 },
    tinyFar: { inputSize: 608, scoreThreshold: 0.16 },
    fastTickMs: 430,
    farTickMs: 980,
    ssdEvery: 2,
    label: "Точно",
  },
};

const SSD_OPTIONS = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.22,
  maxResults: 40,
});

const FAR_MODE_AFTER_MISSES = 3;
const IOU_THRESHOLD = 0.45;
const LANDMARK_MODEL_MISSING_WARNING =
  "Модель ключевых точек лица не найдена. Используется мягкий контур вместо сетки точек.";
const PERF_UI_UPDATE_MS = 300;
const AGE_GENDER_EVERY = 4;

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

const getGenderLabel = (gender) => GENDER_LABELS[gender] || "Пол не определён";
const getAgeLabel = (age) => (typeof age === "number" && Number.isFinite(age) ? `${Math.round(age)} лет` : "");

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

const buildFaceLabel = (item, settings) => {
  const parts = [];

  if (item.dominant) {
    parts.push(item.dominant.label);
  }

  if (settings.showGender && item.genderLabel) {
    parts.push(item.genderLabel);
  }

  if (settings.showAge && item.ageLabel) {
    parts.push(item.ageLabel);
  }

  return parts.join(" • ") || "Лицо";
};

const applyCachedFaceAttributes = (detections, cache, settings) =>
  detections.map((item) => {
    const match = cache.find((cached) => getIoU(cached.detection.box, item.detection.box) > IOU_THRESHOLD);

    const enriched = {
      ...item,
      gender: match?.gender ?? null,
      genderLabel: match?.genderLabel ?? "",
      genderScore: match?.genderScore ?? 0,
      age: match?.age ?? null,
      ageLabel: match?.ageLabel ?? "",
    };

    return {
      ...enriched,
      label: buildFaceLabel(enriched, settings),
    };
  });

const drawFacePath = (ctx, points, closePath = false) => {
  if (!points?.length) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  if (closePath) {
    ctx.closePath();
  }
  ctx.stroke();
};

const drawFacePoints = (ctx, points) => {
  points?.forEach((point, index) => {
    const radius = index % 8 === 0 ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawFallbackOutline = (ctx, box) => {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const radiusX = box.width * 0.38;
  const radiusY = box.height * 0.48;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
  ctx.fill();
};

const drawEmotionBadge = (ctx, box, label) => {
  ctx.font = "600 15px 'Gill Sans', sans-serif";
  const textWidth = ctx.measureText(label).width;
  const labelX = box.x;
  const labelY = Math.max(24, box.y - 8);

  ctx.fillStyle = "rgba(6, 12, 18, 0.82)";
  ctx.fillRect(labelX - 6, labelY - 18, textWidth + 12, 24);

  ctx.fillStyle = "#8dfbc7";
  ctx.fillText(label, labelX, labelY);
};

const drawDetections = (canvas, detections, showText) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#38f8ab";
  ctx.fillStyle = "#8dfbc7";
  ctx.lineWidth = 2;

  detections.forEach((item, index) => {
    const box = item.detection.box;
    const label = showText ? item.label || "Лицо" : `Лицо ${index + 1}`;
    const jaw = item.landmarks?.getJawOutline?.();
    const leftEye = item.landmarks?.getLeftEye?.();
    const rightEye = item.landmarks?.getRightEye?.();
    const nose = item.landmarks?.getNose?.();
    const mouth = item.landmarks?.getMouth?.();

    if (jaw?.length) {
      drawFacePath(ctx, jaw, false);
      drawFacePath(ctx, leftEye, true);
      drawFacePath(ctx, rightEye, true);
      drawFacePath(ctx, nose, false);
      drawFacePath(ctx, mouth, true);
      drawFacePoints(ctx, item.landmarks.positions);
    } else {
      drawFallbackOutline(ctx, box);
    }

    drawEmotionBadge(ctx, box, label);
  });
};

const CameraPanel = () => {
  const [source, setSource] = useState(getCameraSource);
  const [detectorSettings, setDetectorSettings] = useState(getDetectorSettings);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [ssdLoaded, setSsdLoaded] = useState(false);
  const [landmarksLoaded, setLandmarksLoaded] = useState(false);
  const [ageGenderLoaded, setAgeGenderLoaded] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [emotionError, setEmotionError] = useState("");
  const [detectorMode, setDetectorMode] = useState("fast");
  const [perfStats, setPerfStats] = useState({ fps: 0, latency: 0 });
  const canvasRef = useRef(null);
  const missStreakRef = useRef(0);
  const cycleRef = useRef(0);
  const perfRef = useRef({ lastCompletedAt: 0, fps: 0, latency: 0 });
  const detectorModeRef = useRef("fast");
  const perfUiUpdatedAtRef = useRef(0);
  const faceAttributesCacheRef = useRef([]);
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
        let localLandmarksLoaded = false;
        let localAgeGenderLoaded = false;

        try {
          await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
          localSsdLoaded = true;
        } catch {
          warnings.push("SSD-модель не найдена.");
        }

        try {
          await faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models");
          localLandmarksLoaded = true;
        } catch {
          warnings.push(LANDMARK_MODEL_MISSING_WARNING);
        }

        try {
          await faceapi.nets.ageGenderNet.loadFromUri("/models");
          localAgeGenderLoaded = true;
        } catch {
          warnings.push("Модель определения пола и возраста не найдена.");
        }

        if (!cancelled) {
          setSsdLoaded(localSsdLoaded);
          setLandmarksLoaded(localLandmarksLoaded);
          setAgeGenderLoaded(localAgeGenderLoaded);
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
      setPerfStats({ fps: 0, latency: 0 });
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
      const startedAt = performance.now();
      const useFarMode = missStreakRef.current >= FAR_MODE_AFTER_MISSES;
      const tinyConfig = useFarMode ? profile.tinyFar : profile.tinyFast;
      const tinyOptions = new faceapi.TinyFaceDetectorOptions(tinyConfig);
      const runSsdThisCycle = ssdLoaded && (useFarMode || cycleRef.current % profile.ssdEvery === 0);
      const shouldDrawOverlay = detectorSettings.drawBoxes;
      const shouldRunLandmarks = landmarksLoaded && shouldDrawOverlay;
      const wantsAgeGender = detectorSettings.showGender || detectorSettings.showAge;
      const shouldRunAgeGender = ageGenderLoaded && wantsAgeGender && cycleRef.current % AGE_GENDER_EVERY === 0;
      cycleRef.current += 1;

      const nextDetectorMode = useFarMode ? "far" : runSsdThisCycle ? "hybrid" : "fast";
      if (detectorModeRef.current !== nextDetectorMode) {
        detectorModeRef.current = nextDetectorMode;
        setDetectorMode(nextDetectorMode);
      }

      try {
        let tinyTask = faceapi.detectAllFaces(video, tinyOptions);
        if (shouldRunLandmarks) {
          tinyTask = tinyTask.withFaceLandmarks(true);
        }
        tinyTask = tinyTask.withFaceExpressions();
        if (shouldRunAgeGender) {
          tinyTask = tinyTask.withAgeAndGender();
        }

        const ssdPromise = runSsdThisCycle
          ? (() => {
              let ssdTask = faceapi.detectAllFaces(video, SSD_OPTIONS);
              if (shouldRunLandmarks) {
                ssdTask = ssdTask.withFaceLandmarks(true);
              }
              ssdTask = ssdTask.withFaceExpressions();
              if (shouldRunAgeGender) {
                ssdTask = ssdTask.withAgeAndGender();
              }
              return ssdTask;
            })()
          : Promise.resolve([]);

        const [tinyResults, ssdResults] = await Promise.all([tinyTask, ssdPromise]);
        if (!active) {
          return useFarMode;
        }

        const merged = mergeDetections(ssdResults, tinyResults);
        if (!merged.length) {
          missStreakRef.current += 1;
          setDetectedFaces([]);
          setEmotionError("Лица не обнаружены.");
          clearCanvas(canvas);
          return useFarMode;
        }

        missStreakRef.current = 0;

        const displaySize = { width: canvas.width, height: canvas.height };
        const resized = faceapi.resizeResults(merged, displaySize);
        const detectionsWithCoreData = resized.map((item) => {
          const dominant = getDominantEmotion(item.expressions);
          const prepared = {
            detection: item.detection,
            landmarks: item.landmarks || null,
            dominant,
            gender: null,
            genderLabel: "",
            genderScore: 0,
            age: null,
            ageLabel: "",
          };

          return {
            ...prepared,
            label: buildFaceLabel(prepared, detectorSettings),
          };
        });

        const mappedDetections = shouldRunAgeGender
          ? detectionsWithCoreData.map((item, index) => {
              const resizedItem = resized[index];
              const enriched = {
                ...item,
                gender: resizedItem.gender || null,
                genderLabel: detectorSettings.showGender ? getGenderLabel(resizedItem.gender) : "",
                genderScore:
                  typeof resizedItem.genderProbability === "number" ? resizedItem.genderProbability : 0,
                age: typeof resizedItem.age === "number" ? resizedItem.age : null,
                ageLabel: detectorSettings.showAge ? getAgeLabel(resizedItem.age) : "",
              };

              return {
                ...enriched,
                label: buildFaceLabel(enriched, detectorSettings),
              };
            })
          : applyCachedFaceAttributes(detectionsWithCoreData, faceAttributesCacheRef.current, detectorSettings);

        if (shouldRunAgeGender) {
          faceAttributesCacheRef.current = mappedDetections.map((item) => ({
            detection: item.detection,
            gender: item.gender,
            genderLabel: detectorSettings.showGender ? item.genderLabel : "",
            genderScore: item.genderScore,
            age: item.age,
            ageLabel: detectorSettings.showAge ? item.ageLabel : "",
          }));
        }

        const endedAt = performance.now();
        const latency = endedAt - startedAt;
        const previousCompletedAt = perfRef.current.lastCompletedAt;
        const instantFps = previousCompletedAt ? 1000 / Math.max(endedAt - previousCompletedAt, 1) : 0;
        const smoothLatency = perfRef.current.latency
          ? perfRef.current.latency * 0.7 + latency * 0.3
          : latency;
        const smoothFps = perfRef.current.fps ? perfRef.current.fps * 0.7 + instantFps * 0.3 : instantFps;

        perfRef.current = {
          lastCompletedAt: endedAt,
          fps: smoothFps,
          latency: smoothLatency,
        };

        if (endedAt - perfUiUpdatedAtRef.current >= PERF_UI_UPDATE_MS) {
          perfUiUpdatedAtRef.current = endedAt;
          setPerfStats({
            fps: smoothFps,
            latency: smoothLatency,
          });
        }

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
      faceAttributesCacheRef.current = [];
      perfRef.current = { lastCompletedAt: 0, fps: 0, latency: 0 };
      detectorModeRef.current = "fast";
      perfUiUpdatedAtRef.current = 0;
      setPerfStats({ fps: 0, latency: 0 });
      if (timerId) {
        window.clearTimeout(timerId);
      }
      clearCanvas(canvas);
    };
  }, [modelsLoaded, status, videoRef, ssdLoaded, landmarksLoaded, ageGenderLoaded, detectorSettings]);

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
    faceAttributesCacheRef.current = [];
    perfRef.current = { lastCompletedAt: 0, fps: 0, latency: 0 };
    detectorModeRef.current = "fast";
    perfUiUpdatedAtRef.current = 0;
    setDetectorMode("fast");
    setEmotionError("");
    setPerfStats({ fps: 0, latency: 0 });
    start(source);
  };

  const handleStop = () => {
    missStreakRef.current = 0;
    cycleRef.current = 0;
    faceAttributesCacheRef.current = [];
    perfRef.current = { lastCompletedAt: 0, fps: 0, latency: 0 };
    detectorModeRef.current = "fast";
    perfUiUpdatedAtRef.current = 0;
    setDetectorMode("fast");
    setDetectedFaces([]);
    setEmotionError("");
    setPerfStats({ fps: 0, latency: 0 });
    const canvas = canvasRef.current;
    if (canvas) {
      clearCanvas(canvas);
    }
    stop();
  };

  const infoText = useMemo(() => {
    if (detectedFaces.length) {
      const summary = detectedFaces
        .slice(0, 3)
        .map((item) => buildFaceLabel(item, detectorSettings))
        .join(" | ");

      return summary ? `Лиц: ${detectedFaces.length}. ${summary}` : `Лиц обнаружено: ${detectedFaces.length}`;
    }

    if (emotionError) {
      return emotionError;
    }

    return "Ожидание распознавания...";
  }, [detectedFaces, emotionError, detectorSettings]);

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
        <span>Модели: {modelsLoaded ? "Загружены" : "Загрузка..."}</span>
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

      {detectorSettings.showPerformance && (
        <div className="camera-panel__status camera-panel__status--metrics">
          <span>FPS: {perfStats.fps ? perfStats.fps.toFixed(1) : "0.0"}</span>
          <span>Задержка: {perfStats.latency ? `${Math.round(perfStats.latency)} мс` : "0 мс"}</span>
          <span>Оверлей: {detectorSettings.drawBoxes ? "включён" : "выключен"}</span>
          <span>Пол: {detectorSettings.showGender ? "включён" : "выключен"}</span>
          <span>Возраст: {detectorSettings.showAge ? "включён" : "выключен"}</span>
        </div>
      )}

      <div className="camera-panel__video-wrap">
        <video ref={videoRef} autoPlay muted playsInline controls={source.type === "ip"} />
        <canvas ref={canvasRef} className="camera-panel__overlay-canvas" />
        {detectorSettings.showEmotionText && (
          <div className="camera-panel__emotion-overlay">
            <span>{infoText}</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default CameraPanel;
