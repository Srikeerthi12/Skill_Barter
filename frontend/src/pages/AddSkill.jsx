import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createSkillApi } from '../api/skill.api';
import SkillForm from '../components/SkillForm.jsx';
import { useMutation } from '@tanstack/react-query';

export default function AddSkill() {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { mutate: create, isPending } = useMutation({
    mutationFn: async ({ title, description }) => {
      const res = await createSkillApi({ title, description });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Skill created');
      navigate('/skills');
    },
    onError: (err) => {
      setError(err?.response?.data?.message || 'Failed to create skill');
    },
  });

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>Add Skill</h2>
      <SkillForm
        onSubmit={(payload) => {
          setError('');
          create(payload);
        }}
        onCancel={() => navigate('/skills')}
        submitLabel="Save"
        isSubmitting={isPending}
      />
      {error ? <div style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div> : null}
    </div>
  );
}

