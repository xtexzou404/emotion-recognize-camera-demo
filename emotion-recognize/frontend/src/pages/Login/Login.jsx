import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, loginRequest, saveAuth } from "../../services/auth.service";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginRequest({ email, password });
      saveAuth(data);
      navigate("/dashboard");
    } catch (err) {
      const message = err?.response?.data?.message || "Ошибка авторизации.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="glass-card fade-in" onSubmit={handleSubmit}>
        <div className="logo">
          <img src="../src/pages/1.png" alt="ICB" />
        </div>
        <h2 className="title-auth">
          <br />
          <br />
          Авторизация
        </h2>

        {error && <p className="error">{error}</p>}

        <div className="input-group">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Почта</label>
        </div>

        <div className="input-group">
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <label>Пароль</label>
        </div>

        <button className="glass-button" disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}

export default Login;
