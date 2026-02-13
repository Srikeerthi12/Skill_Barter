import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginApi } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { data } = await loginApi({ email, password });
      login(data.token);
      toast.success('Logged in');
      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div className="authWrap">
      <div className="card authCard">
        <div className="authBrand" aria-label="Skill Barter">
          <span className="authBrandLogo" aria-hidden="true">
            <img className="authBrandLogoImg" src="/logo.svg" alt="" />
          </span>
          <span className="authBrandText">Skill Barter</span>
        </div>

        <h2 className="authTitle">Welcome back</h2>
        <p className="muted authSubtitle">Log in to continue.</p>

        <form className="authForm" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className="button block" type="submit">Login</button>
        </form>

        {error ? <div className="authError">{error}</div> : null}
        <div className="authFooter">
          No account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
