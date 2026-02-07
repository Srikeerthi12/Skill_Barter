import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiCamera,
  FiCode,
  FiEdit2,
  FiGlobe,
  FiMusic,
  FiPenTool,
  FiSend,
  FiTool,
} from 'react-icons/fi';

function pickSkillIcon(skill) {
  const title = String(skill?.title || '').toLowerCase();
  const description = String(skill?.description || '').toLowerCase();
  const text = `${title} ${description}`;

  if (/(code|program|developer|dev|web|app|react|node|javascript|typescript|java|python|c\+\+|sql)/.test(text)) return FiCode;
  if (/(design|ui|ux|figma|photoshop|illustrator|canva)/.test(text)) return FiPenTool;
  if (/(photo|camera|video|editing|premiere|after effects|capcut)/.test(text)) return FiCamera;
  if (/(music|guitar|piano|sing|vocal|dj|beat)/.test(text)) return FiMusic;
  if (/(teach|tutor|math|english|study|resume|cv|interview)/.test(text)) return FiBookOpen;
  if (/(marketing|seo|sales|brand|business|ads|analytics)/.test(text)) return FiBarChart2;
  if (/(language|spanish|french|german|hindi|tamil|telugu)/.test(text)) return FiGlobe;
  if (/(fitness|gym|workout|yoga|diet|health)/.test(text)) return FiActivity;
  return FiTool;
}

export default function SkillCard({ skill, enrolled = false, enrolledText = 'Enrolled' }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const skillId = skill?.id ?? skill?._id;
  const ownerId = skill?.user_id ?? skill?.userId;
  const ownerName = skill?.owner_name ?? skill?.ownerName;
  const isOwner = user?.id && ownerId && String(ownerId) === String(user.id);
  const Icon = pickSkillIcon(skill);

  return (
    <div className="card skillCard">
      <div className="skillTop">
        <div className="skillIcon" aria-hidden="true"><Icon /></div>
        <div style={{ minWidth: 0 }}>
          <div className="skillTitle">{skill.title}</div>
          <div className="muted skillMeta">by {ownerName || `User ${ownerId || ''}`}</div>
        </div>
      </div>

      <div className="skillDesc">{skill.description}</div>

      <div className="skillActions">
        {isOwner ? (
          <button
            className="button secondary"
            disabled={!skillId}
            onClick={() => navigate(`/skills/${skillId}/edit`)}
          >
            <FiEdit2 /> Edit
          </button>
        ) : enrolled ? (
          <button className="pill" type="button" disabled>
            {enrolledText}
          </button>
        ) : (
          <button
            className="button"
            disabled={!skillId}
            onClick={() => navigate(`/skills/${skillId}/request`)}
          >
            <FiSend /> Request
          </button>
        )}
      </div>
    </div>
  );
}
