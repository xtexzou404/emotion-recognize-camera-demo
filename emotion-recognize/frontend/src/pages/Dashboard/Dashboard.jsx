import { useMemo } from "react";
import SideBar from "../../components/SideBar/SideBar";
import { getSavedUser } from "../../services/auth.service";
import { getCameraSource } from "../../services/cameraSource.service";
import "./Dashboard.css";

const RECENT_EVENTS = [
  { time: "09:12", place: "Вход 1", emotion: "Нейтрально", confidence: "78%" },
  { time: "09:08", place: "Коридор A", emotion: "Радость", confidence: "91%" },
  { time: "09:03", place: "Лаборатория 214", emotion: "Грусть", confidence: "67%" },
  { time: "08:58", place: "Вход 2", emotion: "Удивление", confidence: "73%" },
];

const Dashboard = () => {
  const user = useMemo(() => getSavedUser(), []);
  const cameraSource = useMemo(() => getCameraSource(), []);

  return (
    <div className="dashboard-page">
      <div className="title-dash">
        <p>Главная</p>
      </div>

      <section className="dashboard-content">
        <div className="dashboard-grid">
          <article className="dashboard-card">
            <h3>Состояние системы</h3>
            <p>Статус: онлайн</p>
            <p>Face API: активен</p>
            <p>Распознавание: в реальном времени</p>
          </article>

          <article className="dashboard-card">
            <h3>Профиль</h3>
            <p>Email: {user?.email || "Неизвестно"}</p>
            <p>Роль: {user?.role || "user"}</p>
            <p>Доступ: разрешён</p>
          </article>

          <article className="dashboard-card">
            <h3>Источник камеры</h3>
            <p>Тип: {cameraSource.type === "ip" ? "IP-камера" : "Камера ноутбука"}</p>
            <p>
              Адрес:{" "}
              {cameraSource.type === "ip" ? cameraSource.ipUrl || "Не задан" : "Локальный видеопоток"}
            </p>
            <p>Режим: мониторинг</p>
          </article>
        </div>

        <article className="dashboard-table-card">
          <h3>Последние события</h3>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Локация</th>
                  <th>Эмоция</th>
                  <th>Точность</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_EVENTS.map((event) => (
                  <tr key={`${event.time}-${event.place}`}>
                    <td>{event.time}</td>
                    <td>{event.place}</td>
                    <td>{event.emotion}</td>
                    <td>{event.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <SideBar />
    </div>
  );
};

export default Dashboard;

