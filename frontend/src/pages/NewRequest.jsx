import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { createRequestApi } from '../api/exchange.api';
import { listSkillsApi } from '../api/skill.api';
import { useAuth } from '../hooks/useAuth';

export default function NewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [requestedSkillId, setRequestedSkillId] = useState('');
  const [offeredSkillId, setOfferedSkillId] = useState('');
  const [message, setMessage] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await listSkillsApi();
      return res.data;
    },
  });

  const skills = data?.skills || [];

  const mySkills = useMemo(() => {
    if (!user?.id) return [];
    return skills.filter((s) => String(s.user_id) === String(user.id));
  }, [skills, user?.id]);

  const otherSkills = useMemo(() => {
    if (!user?.id) return skills;
    return skills.filter((s) => String(s.user_id) !== String(user.id));
  }, [skills, user?.id]);

  const selectedRequested = useMemo(
    () => otherSkills.find((s) => String(s.id) === String(requestedSkillId)),
    [otherSkills, requestedSkillId]
  );

  const { mutate: send, isPending } = useMutation({
    mutationFn: async () => {
      if (!requestedSkillId) throw new Error('Select a skill to request');
      const owner = selectedRequested?.user_id;
      if (!owner) throw new Error('Missing owner for requested skill');

      const payload = {
        owner: Number(owner),
        skillRequested: Number(requestedSkillId),
        skillOffered: offeredSkillId ? Number(offeredSkillId) : null,
        message,
      };

      const res = await createRequestApi(payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Request sent');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/requests');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send request');
    },
  });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageHeader">
        <div>
          <h2 style={{ margin: 0 }}>Add Request</h2>
          <div className="muted">Create a new exchange request.</div>
        </div>
      </div>

      {isLoading ? <div className="card">Loading…</div> : null}
      {isError ? <div className="card">Failed to load skills.</div> : null}

      {!isLoading ? (
        <div className="card" style={{ maxWidth: 820 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
              Skill you want (from others)
            </label>
            <select
              className="input"
              value={requestedSkillId}
              onChange={(e) => setRequestedSkillId(e.target.value)}
            >
              <option value="">Select a skill…</option>
              {otherSkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.owner_name || s.user_id}
                </option>
              ))}
            </select>

            <div style={{ height: 10 }} />

            <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
              Skill you offer (optional)
            </label>
            <select
              className="input"
              value={offeredSkillId}
              onChange={(e) => setOfferedSkillId(e.target.value)}
            >
              <option value="">No offered skill</option>
              {mySkills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            {mySkills.length === 0 ? (
              <div className="muted" style={{ marginTop: 8 }}>
                You don’t have any skills yet. <Link to="/skills/add">Add a skill</Link> to offer something in barter.
              </div>
            ) : null}

            <div style={{ height: 10 }} />

            <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
              Message (optional)
            </label>
            <textarea
              className="input"
              rows={5}
              placeholder="Hi! I’d like to barter skills…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            {selectedRequested ? (
              <div className="muted" style={{ marginTop: 10 }}>
                Sending to: {selectedRequested.owner_name || selectedRequested.user_id}
              </div>
            ) : null}

            <div style={{ height: 12 }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="button secondary" type="button" onClick={() => navigate('/requests')}>
                Cancel
              </button>
              <button className="button" type="submit" disabled={isPending}>
                {isPending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
