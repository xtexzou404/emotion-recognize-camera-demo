import { NavLink } from "react-router-dom";
import { useState } from "react";
import { getTheme, toggleTheme } from "../../services/theme.service";
import "./SideBar.css";

const SideBar = () => {
  const [theme, setTheme] = useState(getTheme);

  const handleThemeToggle = () => {
    const nextTheme = toggleTheme(theme);
    setTheme(nextTheme);
  };

  return (
    <aside className="side-bar">
      <div className="title-side">
        <p>ICB View</p>
      </div>
      <hr />
      <ul>
        <li>
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? "side-link side-link--active" : "side-link")}
          >
            Главная
          </NavLink>
        </li>
        <li>
          <NavLink to="/spy" className={({ isActive }) => (isActive ? "side-link side-link--active" : "side-link")}>
            Видеонаблюдение
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? "side-link side-link--active" : "side-link")}
          >
            Настройки
          </NavLink>
        </li>
      </ul>
      <button type="button" className="theme-toggle-btn" onClick={handleThemeToggle}>
        {theme === "dark" ? "Светлая тема" : "Темная тема"}
      </button>
    </aside>
  );
};

export default SideBar;
