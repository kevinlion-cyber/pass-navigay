import { useState } from 'react';
import AdminAuthGate from '../components/admin/AdminAuthGate';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminRoot() {
  const [authed, setAuthed] = useState(sessionStorage.getItem('adminAuth') === 'true');

  if (!authed) {
    return <AdminAuthGate onAuthenticated={() => setAuthed(true)} />;
  }

  return <AdminLayout />;
}
