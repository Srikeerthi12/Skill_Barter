import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteSkillApi, getSkillApi, updateSkillApi } from '../api/skill.api';
import { useAuth } from '../hooks/useAuth';
import SkillForm from '../components/SkillForm.jsx';

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

  useEffect(() => {
    if (isError) toast.error('Failed to load skill');
  }, [isError]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async ({ title, description }) => {
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
      <SkillForm
        initialTitle={skill.title || ''}
        initialDescription={skill.description || ''}
        isSubmitting={isSaving}
        submitLabel="Save changes"
        onCancel={() => navigate('/skills')}
        onSubmit={(payload) => save(payload)}
      />

      <div style={{ height: 10 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
      </div>
    </div>
  );
}

