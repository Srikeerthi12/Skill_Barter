import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FiChevronDown, FiLogIn, FiLogOut, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const view = searchParams.get('view') || '';

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'Dashboard';
    if (path === '/skills') return 'Skills';
    if (path === '/requests') return 'Requests';
    if (path === '/requests/new') return 'New Request';
    if (path === '/skills/add') return 'Add Skill';
    if (path === '/profile') return 'Profile';
    if (/^\/user\/.+/.test(path)) return 'User Profile';
    if (/^\/skills\/.+\/edit$/.test(path)) return 'Edit Skill';
    if (/^\/skills\/.+/.test(path)) return 'Skill Details';
    if (/^\/skill\/.+/.test(path)) return 'Skill Details';
    if (/^\/requests\/.+/.test(path)) return 'Request';
    return 'Skill Barter';
  }, [location.pathname]);

  const displayName = useMemo(() => user?.name || user?.email || 'User', [user]);
  const initials = useMemo(() => {
    const value = user?.name || user?.email || '';
    const parts = value
      .replace(/@.*/, '')
      .split(/\s+|\.|_|-/)
      .filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const second = parts[1]?.[0] || '';
    return `${first}${second}`.toUpperCase();
  }, [user]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // ignore
    }
    setTheme(next);
  }

  return (
    <div className="nav">
      <div className="navTitle">{pageTitle}</div>

      {user ? (
        <div className="navSearch">
          <div className="navSearchInner">
            <input
              className="navSearchInput"
              placeholder="Search other users’ skills…"
              value={location.pathname === '/skills' && view !== 'mine' ? q : ''}
              onChange={(e) => {
                const value = e.target.value;
                const next = new URLSearchParams();
                next.set('view', 'browse');
                if (value) next.set('q', value);
                navigate(`/skills?${next.toString()}`);
              }}
            />
            <div className="navSearchHint muted">Search applies to “Available Skills”.</div>
          </div>
        </div>
      ) : null}

      <div className="navRight">
        {user ? (
          <div className="profileMenu" ref={menuRef}>
            <button
              className="profileButton"
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="avatar" aria-hidden="true">{initials}</span>
              <span className="profileName">{displayName}</span>
              <FiChevronDown />
            </button>

            {open ? (
              <div className="profileDropdown" role="menu">
                <div className="profileDropdownHeader">
                  <div className="profileDropdownName">{displayName}</div>
                  {user?.email ? <div className="muted profileDropdownEmail">{user.email}</div> : null}
                </div>
                <button
                  className="profileDropdownItem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate('/profile');
                  }}
                  role="menuitem"
                >
                  <FiUser /> Profile
                </button>
                <button
                  className="profileDropdownItem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    toggleTheme();
                  }}
                  role="menuitem"
                >
                  {theme === 'dark' ? <FiSun /> : <FiMoon />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  className="profileDropdownItem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  role="menuitem"
                >
                  <FiLogOut /> Log out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link className="button" to="/login"><FiLogIn /> Log in</Link>
        )}
      </div>
    </div>
  );
}
