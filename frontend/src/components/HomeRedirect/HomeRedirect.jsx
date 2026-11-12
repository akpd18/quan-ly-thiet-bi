import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';
import { getHomePath } from '../../utils/routes.js';

export default function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePath(user)} replace />;
}