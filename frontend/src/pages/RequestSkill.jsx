import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createRequestApi } from '../api/exchange.api';
import { getSkillApi, listSkillsApi } from '../api/skill.api';
import { useAuth } from '../hooks/useAuth';

export default function RequestSkill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [message, setMessage] = useState('');
  const [offeredSkillIds, setOfferedSkillIds] = useState([]);
  const [interestedSkillIds, setInterestedSkillIds] = useState([]);

  const { data: skillData, isLoading: isLoadingSkill } = useQuery({
    queryKey: ['skill', id],
    queryFn: async () => {
      const res = await getSkillApi(id);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const skill = skillData?.skill;

  const { data: skillsData } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await listSkillsApi();
      return res.data;
    },
  });

  const mySkills = useMemo(() => {
    const all = skillsData?.skills || [];
    if (!user?.id) return [];
    return all.filter((s) => String(s.user_id) === String(user.id));
  }, [skillsData?.skills, user?.id]);

  const receiverSkills = useMemo(() => {
    const all = skillsData?.skills || [];
    if (!skill?.user_id) return [];
    return all.filter((s) => String(s.user_id) === String(skill.user_id));
  }, [skillsData?.skills, skill?.user_id]);

  const isOwner = user?.id && skill?.user_id && String(user.id) === String(skill.user_id);

  const { mutate: send, isPending } = useMutation({
    mutationFn: async () => {
      if (!skill?.id || !skill?.user_id) throw new Error('Missing skill data');

      if (!offeredSkillIds.length) throw new Error('Select at least one skill to offer');

      const interests = interestedSkillIds.length ? interestedSkillIds : [Number(skill.id)];
      const payload = {
        receiver: Number(skill.user_id),
        offeredSkills: offeredSkillIds.map((v) => Number(v)),
        interestedSkills: interests.map((v) => Number(v)),
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

  if (isLoadingSkill) return <div className="card">Loading…</div>;
  if (!skill) return <div className="card">Skill not found.</div>;

  if (isOwner) {
    return (
      <div className="card" style={{ maxWidth: 760 }}>
        <h2>Request Skill</h2>
        <div className="muted">You can’t request your own skill.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageActions">
        <div className="muted">Send a barter request to the skill owner.</div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>{skill.title}</div>
        <div className="muted">
          Owner:{' '}
          {skill.user_id ? (
            <Link to={`/user/${skill.user_id}`} style={{ fontWeight: 800 }}>
              {skill.owner_name || `User ${skill.user_id}`}
            </Link>
          ) : (
            skill.owner_name || 'Unknown'
          )}
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{skill.description}</div>
      </div>

      <div className="card" style={{ maxWidth: 760 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!mySkills.length) {
              toast.error('Add a skill first so you can offer it in barter');
              return;
            }
            if (!offeredSkillIds.length) {
              toast.error('Please select at least one skill to offer');
              return;
            }
            send();
          }}
        >
          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
            Offer one or more of your skills
          </label>

          <div className="miniList" style={{ marginTop: 6 }}>
            {mySkills.map((s) => {
              const checked = offeredSkillIds.includes(String(s.id));
              return (
                <label key={s.id} className="miniRow" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setOfferedSkillIds((prev) => {
                        const set = new Set(prev);
                        if (e.target.checked) set.add(String(s.id));
                        else set.delete(String(s.id));
                        return Array.from(set);
                      });
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="miniTitle">{s.title}</div>
                    <div className="muted miniSub">You offer this</div>
                  </div>
                </label>
              );
            })}
          </div>

          <div style={{ height: 12 }} />

          <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
            Skills you’re interested in learning (from {skill.owner_name || 'the owner'})
          </label>

          <div className="miniList" style={{ marginTop: 6 }}>
            {receiverSkills.map((s) => {
              const preselected = String(s.id) === String(skill.id);
              const checked = preselected || interestedSkillIds.includes(String(s.id));
              return (
                <label key={s.id} className="miniRow" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={preselected}
                    onChange={(e) => {
                      setInterestedSkillIds((prev) => {
                        const set = new Set(prev);
                        if (e.target.checked) set.add(String(s.id));
                        else set.delete(String(s.id));
                        return Array.from(set);
                      });
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="miniTitle">{s.title}</div>
                    <div className="muted miniSub">{preselected ? 'Selected from this skill page' : 'Interested'}</div>
                  </div>
                </label>
              );
            })}
          </div>

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

          <div style={{ height: 12 }} />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <button className="button secondary" type="button" onClick={() => navigate('/skills')}>
              Back
            </button>
            <button className="button" type="submit" disabled={isPending || !mySkills.length || !offeredSkillIds.length}>
              {isPending ? 'Sending…' : 'Send request'}
            </button>
          </div>

          {mySkills.length === 0 ? (
            <div className="muted" style={{ marginTop: 10 }}>
              You don’t have any skills yet. <Link to="/skills/add">Add a skill</Link> to request this.
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
