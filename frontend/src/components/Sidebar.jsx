import { NavLink, useNavigate } from 'react-router-dom';
import { FiGrid, FiPlus, FiRepeat, FiTool } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) => `sideLink${isActive ? ' sideLinkActive' : ''}`;

  return (
    <aside className="sidebar">
      <button className="sideBrand" type="button" onClick={() => navigate('/dashboard')}>
        <span className="sideBrandLogo" aria-hidden="true">SB</span>
        <span className="sideBrandText">SkillFlow</span>
      </button>

      <div className="sideUserCard">
        <div className="sideUserRow">
          <div className="sideUserAvatar" aria-hidden="true">
            {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="sideUserHello">Hey, {user?.name || 'there'}</div>
            <div className="muted sideUserSub">Let’s barter some skills!</div>
          </div>
        </div>

        {user?.email ? <div className="muted sideUserEmail">{user.email}</div> : null}

        <div className="sideProgress">
          <div className="sideProgressLabel">Activity</div>
          <div className="sideProgressBar" aria-hidden="true">
            <div className="sideProgressFill" />
          </div>
        </div>
      </div>

      <div className="sideSectionTitle">Menu</div>
      <nav className="sideNav">
        <NavLink className={linkClass} to="/dashboard"><FiGrid /> Dashboard</NavLink>
        <NavLink className={linkClass} to="/skills?view=mine"><FiTool /> My Skills</NavLink>
        <NavLink className={linkClass} to="/requests"><FiRepeat /> Requests</NavLink>
        <NavLink className={linkClass} to="/requests/new"><FiPlus /> Add Request</NavLink>
        <NavLink className={linkClass} to="/skills/add"><FiPlus /> Add Skill</NavLink>
      </nav>

      <div className="sideFooterCard">
        <div className="sideFooterTitle">Pro tip</div>
        <div className="muted">Use the search bar to browse other users’ skills.</div>
      </div>
    </aside>
  );
}
