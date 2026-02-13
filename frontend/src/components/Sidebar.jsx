import { NavLink, useNavigate } from 'react-router-dom';
import { FiGrid, FiPlus, FiRepeat, FiTool } from 'react-icons/fi';

export default function Sidebar() {
  const navigate = useNavigate();

  const linkClass = ({ isActive }) => `sideLink${isActive ? ' sideLinkActive' : ''}`;

  return (
    <aside className="sidebar">
      <button className="sideBrand" type="button" onClick={() => navigate('/dashboard')}>
        <span className="sideBrandLogo" aria-hidden="true">
          <img className="sideBrandLogoImg" src="/logo.svg" alt="" />
        </span>
        <span className="sideBrandText">Skill Barter</span>
      </button>

      <div className="sideSectionTitle">Menu</div>
      <nav className="sideNav">
        <NavLink className={linkClass} to="/dashboard"><FiGrid /> Dashboard</NavLink>
        <NavLink className={linkClass} to="/skills?view=mine"><FiTool /> Skills</NavLink>
        <NavLink className={linkClass} to="/requests"><FiRepeat /> Requests</NavLink>
        <NavLink className={linkClass} to="/requests/new"><FiPlus /> Add Request</NavLink>
        <NavLink className={linkClass} to="/skills/add"><FiPlus /> Add Skill</NavLink>
      </nav>
    </aside>
  );
}
