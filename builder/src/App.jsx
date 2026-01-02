// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import ProjectsGallery from "./components/ProjectsGallery";
import EditorPage from "./components/EditorPage";
import AdminPanel from "./components/AdminPanel";
import { getSessionUser, isAdmin } from "./utils/auth";

function RequireAuth({ children }) {
  const user = getSessionUser();
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const user = getSessionUser();
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin(user)) return <Navigate to="/projects" replace />;
  return children;
}

export default function App() {
  const user = getSessionUser();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/projects" replace /> : <Login />} />

        <Route
          path="/projects"
          element={
            <RequireAuth>
              <ProjectsGallery />
            </RequireAuth>
          }
        />

        <Route
          path="/editor/:projectId"
          element={
            <RequireAuth>
              <EditorPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to={user ? "/projects" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
