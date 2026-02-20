import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      pushToast("Username and password are required.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const session = await login(username, password);
      pushToast("Login successful.", "success");
      navigate(session.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      pushToast(error.message || "Login failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page page--centered">
      <div className="card login-card">
        <h1 className="section-title">Project Tracker Login</h1>
        <p className="muted">Sign in with your assigned username and password.</p>
        <form className="form" onSubmit={onSubmit}>
          <label className="form-label">
            Username
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              autoComplete="username"
            />
          </label>

          <label className="form-label">
            Password
            <input
              type="password"
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? <Spinner /> : "Login"}
          </button>
        </form>
      </div>
    </section>
  );
}

