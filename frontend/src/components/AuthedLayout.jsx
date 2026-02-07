import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Navbar from './Navbar.jsx';

export default function AuthedLayout() {
  return (
    <div className="appShell">
      <Sidebar />
      <div className="appMain">
        <Navbar />
        <main className="appContent">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
