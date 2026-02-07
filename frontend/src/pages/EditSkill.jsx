import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteSkillApi, getSkillApi, updateSkillApi } from '../api/skill.api';
import { useAuth } from '../hooks/useAuth';

export default function EditSkill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill', id],
    queryFn: async () => {
      const res = await getSkillApi(id);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const skill = data?.skill;
  const isOwner = user?.id && skill?.user_id && String(user.id) === String(skill.user_id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!skill) return;
    setTitle(skill.title || '');
    setDescription(skill.description || '');
  }, [skill?.id]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const res = await updateSkillApi(id, { title, description });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Skill updated');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['skill', id] });
      navigate('/skills');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to update skill');
    },
  });

  const { mutate: remove, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await deleteSkillApi(id);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Skill deleted');
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      navigate('/skills');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to delete skill');
    },
  });

  if (isLoading) return <div className="card">Loading…</div>;
  if (isError) return <div className="card">Failed to load skill.</div>;
  if (!skill) return <div className="card">Skill not found.</div>;

  if (!isOwner) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <h2>Edit Skill</h2>
        <div className="muted">You can only edit your own skills.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h2>Edit Skill</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div style={{ height: 10 }} />
        <textarea
          className="input"
          placeholder="Description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div style={{ height: 12 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <button className="button secondary" type="button" onClick={() => navigate('/skills')}>
            Cancel
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="button danger"
              type="button"
              disabled={isDeleting}
              onClick={() => {
                const ok = window.confirm('Delete this skill?');
                if (ok) remove();
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
            <button className="button" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
