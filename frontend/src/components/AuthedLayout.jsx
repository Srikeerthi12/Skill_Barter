import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Navbar from './Navbar.jsx';
import ChatPopup from './ChatPopup.jsx';

export default function AuthedLayout() {
  const location = useLocation();
  const isChatPage = String(location.pathname || '').startsWith('/chat');
  const showChatFab = !isChatPage;

  return (
    <div className="appShell">
      <Sidebar />
      <div className="appMain">
        <Navbar />
        <main className={isChatPage ? 'appContent appContentWide' : 'appContent'}>
          <Outlet />
        </main>
        {showChatFab ? <ChatPopup /> : null}
      </div>
    </div>
  );
}
