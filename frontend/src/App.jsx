import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthedLayout from './components/AuthedLayout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import UserProfile from './pages/UserProfile.jsx';
import AddSkill from './pages/AddSkill.jsx';
import EditSkill from './pages/EditSkill.jsx';
import SkillDetails from './pages/SkillDetails.jsx';
import RequestSkill from './pages/RequestSkill.jsx';
import NewRequest from './pages/NewRequest.jsx';
import Skills from './pages/Skills.jsx';
import Requests from './pages/Requests.jsx';
import Chat from './pages/Chat.jsx';

export default function App() {
  return (
    <div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--toastBg)',
            color: 'var(--text)',
            border: '1px solid var(--toastBorder)',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <AuthedLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/skills/add" element={<AddSkill />} />
          <Route path="/skills/:id" element={<SkillDetails />} />
          <Route path="/skill/:id" element={<SkillDetails />} />
          <Route path="/skills/:id/edit" element={<EditSkill />} />
          <Route path="/skills/:id/request" element={<RequestSkill />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<NewRequest />} />
          <Route path="/chat" element={<Chat />} />
        </Route>
      </Routes>
    </div>
  );
}

