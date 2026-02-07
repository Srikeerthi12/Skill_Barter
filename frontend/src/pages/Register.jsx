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
      <h2>Create your account</h2>
      <p className="muted">Join and start bartering skills.</p>
      <form onSubmit={onSubmit}>
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ height: 10 }} />
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div style={{ height: 10 }} />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ height: 12 }} />
        <button className="button" type="submit">Create account</button>
      </form>
      {error ? <div style={{ color: '#fca5a5', marginTop: 10 }}>{error}</div> : null}
      <div style={{ marginTop: 12, opacity: 0.9 }}>
        Have an account? <Link to="/login">Login</Link>
      </div>
      </div>
    </div>
  );
}
