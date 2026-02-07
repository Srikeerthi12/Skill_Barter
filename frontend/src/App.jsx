import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthedLayout from './components/AuthedLayout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import AddSkill from './pages/AddSkill.jsx';
import EditSkill from './pages/EditSkill.jsx';
import RequestSkill from './pages/RequestSkill.jsx';
import NewRequest from './pages/NewRequest.jsx';
import Skills from './pages/Skills.jsx';
import Requests from './pages/Requests.jsx';

export default function App() {
  return (
    <div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(255, 255, 255, 0.98)',
            color: '#0f172a',
            border: '1px solid rgba(15, 23, 42, 0.10)',
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
          <Route path="/skills" element={<Skills />} />
          <Route path="/skills/add" element={<AddSkill />} />
          <Route path="/skills/:id/edit" element={<EditSkill />} />
          <Route path="/skills/:id/request" element={<RequestSkill />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<NewRequest />} />
        </Route>
      </Routes>
    </div>
  );
}
