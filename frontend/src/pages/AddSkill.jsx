import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSkillApi } from '../api/skill.api';

export default function AddSkill() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await createSkillApi({ title, description });
      navigate('/skills');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create skill');
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>Add Skill</h2>
      <form onSubmit={onSubmit}>
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div style={{ height: 10 }} />
        <textarea
          className="input"
          placeholder="Description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={{ height: 12 }} />
        <button className="button" type="submit">Save</button>
      </form>
      {error ? <div style={{ color: '#fca5a5', marginTop: 10 }}>{error}</div> : null}
    </div>
  );
}
