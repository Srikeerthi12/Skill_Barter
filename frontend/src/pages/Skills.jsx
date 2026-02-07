import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listSkillsApi } from '../api/skill.api';
import { listLearningApi } from '../api/exchange.api';
import SkillCard from '../components/SkillCard.jsx';
import { useAuth } from '../hooks/useAuth';
import { Link, useSearchParams } from 'react-router-dom';

export default function Skills() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const res = await listSkillsApi();
      return res.data;
    },
  });

  const {
    data: learningData,
    isLoading: isLearningLoading,
    isError: isLearningError,
  } = useQuery({
    queryKey: ['learning'],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await listLearningApi();
      return res.data;
    },
  });

  const skills = data?.skills || [];

  const { mySkills, otherSkills } = useMemo(() => {
    const myId = user?.id;
    if (!myId) return { mySkills: [], otherSkills: skills };
    const mine = [];
    const others = [];
    for (const s of skills) {
      const ownerId = s?.user_id ?? s?.userId;
      if (ownerId && String(ownerId) === String(myId)) mine.push(s);
      else others.push(s);
    }
    return { mySkills: mine, otherSkills: others };
  }, [skills, user?.id]);

  const filteredOtherSkills = useMemo(() => {
    if (!q) return otherSkills;
    return otherSkills.filter((s) => {
      const title = String(s?.title || '').toLowerCase();
      const description = String(s?.description || '').toLowerCase();
      const ownerName = String(s?.owner_name || s?.ownerName || '').toLowerCase();
      return title.includes(q) || description.includes(q) || ownerName.includes(q);
    });
  }, [otherSkills, q]);

  useEffect(() => {
    if (isError) toast.error('Failed to load skills');
  }, [isError]);

  useEffect(() => {
    if (isLearningError) toast.error('Failed to load enrolled skills');
  }, [isLearningError]);

  const enrolledKeySet = useMemo(() => {
    const rows = learningData?.learning || [];
    const set = new Set();
    for (const ex of rows) {
      if (!ex) continue;
      const ownerId = ex.owner_id ?? ex.ownerId;
      const requestedId = ex.skill_requested_id ?? ex.skillRequestedId;
      if (!ownerId || !requestedId) continue;
      set.add(`${ownerId}:${requestedId}`);
    }
    return set;
  }, [learningData]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="pageActions">
        <div className="muted">Browse others’ skills and manage yours.</div>
      </div>

      {isLoading ? <div className="card">Loading…</div> : null}

      {!isLoading ? (
        <div className="skillsLayout">
          <div className="skillsMain">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 900 }}>Available Skills</div>
                <div className="muted">{filteredOtherSkills.length}{q ? ` / ${otherSkills.length}` : ''}</div>
              </div>
              <div style={{ height: 10 }} />
              {filteredOtherSkills.length ? (
                <div className="stack">
                  {filteredOtherSkills.map((s) => (
                    <SkillCard
                      key={s.id || s._id || s.title}
                      skill={s}
                      enrolled={enrolledKeySet.has(`${s?.user_id ?? s?.userId}:${s?.id ?? s?._id}`)}
                      enrolledText={isLearningLoading ? 'Checking…' : 'Enrolled'}
                    />
                  ))}
                </div>
              ) : (
                <div className="muted">{q ? 'No matches for your search.' : 'No other skills available yet.'}</div>
              )}
            </div>
          </div>

          <aside className="skillsAside">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 900 }}>My Skills</div>
                <div className="muted">{mySkills.length}</div>
              </div>

              <div style={{ height: 10 }} />

              {mySkills.length ? (
                <div className="miniList">
                  {mySkills.slice(0, 6).map((s) => (
                    <div key={s.id || s._id || s.title} className="miniRow">
                      <div style={{ minWidth: 0 }}>
                        <div className="miniTitle">{s.title}</div>
                        <div className="muted miniSub">Tap to edit</div>
                      </div>
                      <Link className="button secondary" to={`/skills/${s.id || s._id}/edit`}>Edit</Link>
                    </div>
                  ))}
                  {mySkills.length > 6 ? (
                    <div className="muted" style={{ fontSize: 12 }}>Showing 6 / {mySkills.length}</div>
                  ) : null}
                </div>
              ) : (
                <div className="muted">No skills yet. Add one to get started.</div>
              )}

              <div style={{ height: 12 }} />
              <Link className="button" to="/skills/add">+ Add Skill</Link>
            </div>
          </aside>
        </div>
      ) : null}

      {!isLoading && !skills.length ? <div className="card">No skills yet.</div> : null}
    </div>
  );
}
