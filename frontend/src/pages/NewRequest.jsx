import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { createRequestApi } from '../api/exchange.api';
import { listSkillsApi } from '../api/skill.api';
import { useAuth } from '../hooks/useAuth';
import { listUsersApi } from '../api/user.api';

export default function NewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [requestedSkillId, setRequestedSkillId] = useState('');
  const [skillPickerValue, setSkillPickerValue] = useState('');
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [offeredSkillIds, setOfferedSkillIds] = useState([]);
  const [interestedSkillIds, setInterestedSkillIds] = useState([]);
  const [message, setMessage] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await listUsersApi();
      return res.data;
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await listSkillsApi();
      return res.data;
    },
  });

  const skills = data?.skills || [];

  const users = usersData?.users || [];
  const otherUsers = useMemo(() => {
    if (!user?.id) return users;
    return users.filter((u) => String(u.id) !== String(user.id));
  }, [users, user?.id]);

  const mySkills = useMemo(() => {
    if (!user?.id) return [];
    return skills.filter((s) => String(s.user_id) === String(user.id));
  }, [skills, user?.id]);

  const receiverSkills = useMemo(() => {
    if (!receiverId) return [];
    return skills.filter((s) => String(s.user_id) === String(receiverId));
  }, [skills, receiverId]);

  const otherSkills = useMemo(() => {
    if (!user?.id) return skills;
    return skills.filter((s) => String(s.user_id) !== String(user.id));
  }, [skills, user?.id]);

  const otherSkillsSorted = useMemo(() => {
    if (!otherSkills.length) return otherSkills;

    const ownerNameById = new Map(users.map((u) => [String(u.id), String(u.name || '')]));
    const getOwnerName = (skill) => ownerNameById.get(String(skill.user_id)) || '';

    return [...otherSkills].sort((a, b) => {
      const titleA = String(a?.title || '').toLocaleLowerCase();
      const titleB = String(b?.title || '').toLocaleLowerCase();
      if (titleA !== titleB) return titleA.localeCompare(titleB);

      const ownerA = getOwnerName(a).toLocaleLowerCase();
      const ownerB = getOwnerName(b).toLocaleLowerCase();
      if (ownerA !== ownerB) return ownerA.localeCompare(ownerB);

      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
  }, [otherSkills, users]);

  const ownerNameById = useMemo(() => new Map(users.map((u) => [String(u.id), String(u.name || '')])), [users]);

  const filteredOtherSkills = useMemo(() => {
    const q = String(skillPickerValue || '').trim().toLocaleLowerCase();
    if (!q) return otherSkillsSorted;
    return otherSkillsSorted.filter((s) => {
      const title = String(s?.title || '').toLocaleLowerCase();
      const ownerName = String(ownerNameById.get(String(s.user_id)) || '').toLocaleLowerCase();
      return title.includes(q) || ownerName.includes(q);
    });
  }, [otherSkillsSorted, skillPickerValue, ownerNameById]);

  const pickSkill = (skill) => {
    if (!skill?.id) return;
    const ownerName = ownerNameById.get(String(skill.user_id)) || '';
    const label = `${skill.title}${ownerName ? ` — ${ownerName}` : ''}`;
    setRequestedSkillId(String(skill.id));
    setReceiverId(String(skill.user_id));
    setInterestedSkillIds([String(skill.id)]);
    setSkillPickerValue(label);
    setSkillPickerOpen(false);
  };

  const requestedSkill = useMemo(
    () => otherSkills.find((s) => String(s.id) === String(requestedSkillId)) || null,
    [otherSkills, requestedSkillId]
  );

  const receiverName = useMemo(() => {
    if (!receiverId) return '';
    return users.find((u) => String(u.id) === String(receiverId))?.name || '';
  }, [users, receiverId]);

  const { mutate: send, isPending } = useMutation({
    mutationFn: async () => {
      if (!requestedSkillId) throw new Error('Select a skill you want');
      if (!receiverId) throw new Error('Missing skill owner');
      if (!interestedSkillIds.length) throw new Error('Select at least one skill you want');
      if (!offeredSkillIds.length) throw new Error('Select at least one skill you offer');

      const payload = {
        receiver: Number(receiverId),
        offeredSkills: offeredSkillIds.map((v) => Number(v)),
        interestedSkills: interestedSkillIds.map((v) => Number(v)),
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
      <div className="pageActions">
        <div className="muted">Create a new exchange request.</div>
      </div>

      {isLoading ? <div className="card">Loading…</div> : null}
      {isError ? <div className="card">Failed to load skills.</div> : null}

      {!isLoading ? (
        <div className="card" style={{ maxWidth: 820 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!mySkills.length) {
                toast.error('Add a skill first so you can offer it in barter');
                return;
              }
              if (!requestedSkillId) return toast.error('Please select a skill you want');
              if (!offeredSkillIds.length) return toast.error('Please select at least one skill you offer');
              send();
            }}
          >
            <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
              Skill you want
            </label>

            <div className="comboWrap">
              <input
                className="input"
                value={skillPickerValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setSkillPickerValue(next);
                  setSkillPickerOpen(true);
                  setRequestedSkillId('');
                  setReceiverId('');
                  setInterestedSkillIds([]);
                }}
                onFocus={() => setSkillPickerOpen(true)}
                onBlur={() => {
                  // allow click selection
                  setTimeout(() => setSkillPickerOpen(false), 120);
                }}
                placeholder="Select a skill…"
                aria-label="Skill you want"
                role="combobox"
                aria-expanded={skillPickerOpen}
                aria-controls="skill-picker-list"
                autoComplete="off"
              />

              {skillPickerOpen ? (
                <div className="comboList" id="skill-picker-list" role="listbox">
                  {filteredOtherSkills.length ? (
                    filteredOtherSkills.map((s) => {
                      const ownerName = ownerNameById.get(String(s.user_id)) || '';
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="comboItem"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickSkill(s);
                          }}
                          role="option"
                        >
                          <div className="comboTitle">{s.title}</div>
                          {ownerName ? <div className="comboMeta">{ownerName}</div> : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="muted" style={{ padding: 10, fontSize: 13 }}>
                      No matching skills.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div style={{ height: 10 }} />

            {requestedSkill ? (
              <>
                <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
                  Selected skill
                </label>
                <div className="miniList">
                  <div className="miniRow" role="group" aria-label="Selected skill">
                    <div style={{ minWidth: 0 }}>
                      <div className="miniTitle">{requestedSkill.title}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {mySkills.length === 0 ? (
              <div className="muted" style={{ marginTop: 8 }}>
                You don’t have any skills yet. <Link to="/skills/add">Add a skill</Link> to offer something in barter.
              </div>
            ) : null}

            <div style={{ height: 10 }} />

            <label className="muted" style={{ display: 'block', marginBottom: 6 }}>
              Skills you offer
            </label>
            <div className="miniList">
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

            {receiverId ? (
              <div className="muted" style={{ marginTop: 10 }}>
                Sending to: {receiverName || receiverId}
              </div>
            ) : null}

            <div style={{ height: 12 }} />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <button className="button secondary" type="button" onClick={() => navigate('/requests')}>
                Cancel
              </button>
              <button
                className="button"
                type="submit"
                disabled={isPending || !mySkills.length || !requestedSkillId || !receiverId || !interestedSkillIds.length || !offeredSkillIds.length}
              >
                {isPending ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
