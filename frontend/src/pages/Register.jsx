import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerApi } from '../api/auth.api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await registerApi({ name, email, password });
      toast.success('Account created. Please log in.');
      navigate('/login');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Registration failed';
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

        <h2 className="authTitle">Create your account</h2>
        <p className="muted authSubtitle">Join and start bartering skills.</p>

        <form className="authForm" onSubmit={onSubmit}>
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
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
            autoComplete="new-password"
          />
          <button className="button block" type="submit">Create account</button>
        </form>

        {error ? <div className="authError">{error}</div> : null}
        <div className="authFooter">
          Have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}
