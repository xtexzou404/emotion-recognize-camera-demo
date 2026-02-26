import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SideBar from "../../components/SideBar/SideBar";
import { clearAuth, getSavedUser, saveUserProfile } from "../../services/auth.service";
import { getCameraSource, saveCameraSource } from "../../services/cameraSource.service";
import { getDetectorSettings, saveDetectorSettings } from "../../services/detectorSettings.service";
import "./Settings.css";

const Settings = () => {
  const navigate = useNavigate();
  const user = useMemo(() => getSavedUser(), []);
  const [profile, setProfile] = useState(() => ({
    name: user?.name || "",
    email: user?.email || "",
  }));
  const [cameraSource, setCameraSource] = useState(getCameraSource);
  const [detectorSettings, setDetectorSettings] = useState(getDetectorSettings);
  const [savedMessage, setSavedMessage] = useState("");

  const handleSave = () => {
    const normalizedEmail = profile.email.trim().toLowerCase();
    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setSavedMessage("Введите корректный email.");
      window.setTimeout(() => setSavedMessage(""), 1800);
      return;
    }

    saveUserProfile({
      name: profile.name.trim(),
      email: normalizedEmail,
    });

    saveCameraSource(cameraSource);
    saveDetectorSettings(detectorSettings);
    setSavedMessage("Настройки сохранены.");
    window.setTimeout(() => setSavedMessage(""), 1800);
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  return (
    <div className="settings-page">
      <div className="title-settings">
        <p>Настройки</p>
      </div>

      <section className="settings-content">
        <article className="settings-card">
          <h3>Профиль</h3>
          <label className="settings-field">
            Имя
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Введите имя"
            />
          </label>

          <label className="settings-field">
            Email
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="example@mail.com"
            />
          </label>

          <div className="settings-row">
            <span>Роль</span>
            <strong>{user?.role || "user"}</strong>
          </div>

          <button type="button" className="settings-danger-btn" onClick={handleLogout}>
            Выйти из аккаунта
          </button>
        </article>

        <article className="settings-card">
          <h3>Источник камеры</h3>
          <label className="settings-field">
            Тип источника
            <select
              value={cameraSource.type}
              onChange={(e) =>
                setCameraSource((prev) => ({
                  ...prev,
                  type: e.target.value,
                }))
              }
            >
              <option value="local">Камера ноутбука</option>
              <option value="ip">IP-камера</option>
            </select>
          </label>

          {cameraSource.type === "ip" && (
            <label className="settings-field">
              URL IP-камеры
              <input
                type="url"
                placeholder="http://192.168.1.100:8080/video"
                value={cameraSource.ipUrl}
                onChange={(e) => setCameraSource((prev) => ({ ...prev, ipUrl: e.target.value }))}
              />
            </label>
          )}
        </article>

        <article className="settings-card">
          <h3>Распознавание</h3>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={detectorSettings.drawBoxes}
              onChange={(e) =>
                setDetectorSettings((prev) => ({
                  ...prev,
                  drawBoxes: e.target.checked,
                }))
              }
            />
            Показывать рамки лиц
          </label>

          <label className="settings-check">
            <input
              type="checkbox"
              checked={detectorSettings.showEmotionText}
              onChange={(e) =>
                setDetectorSettings((prev) => ({
                  ...prev,
                  showEmotionText: e.target.checked,
                }))
              }
            />
            Показывать подпись эмоции
          </label>

          <label className="settings-field">
            Чувствительность
            <select
              value={detectorSettings.sensitivity}
              onChange={(e) => setDetectorSettings((prev) => ({ ...prev, sensitivity: e.target.value }))}
            >
              <option value="fast">Быстро (меньше точность)</option>
              <option value="balanced">Сбалансировано</option>
              <option value="accurate">Точно (медленнее)</option>
            </select>
          </label>
        </article>
      </section>

      <div className="settings-actions">
        <button type="button" className="settings-save-btn" onClick={handleSave}>
          Сохранить
        </button>
        {savedMessage && <span className="settings-saved">{savedMessage}</span>}
      </div>

      <SideBar />
    </div>
  );
};

export default Settings;
