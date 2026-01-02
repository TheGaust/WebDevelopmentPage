import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import ProjectsGallery from "./components/ProjectsGallery";
import EditorPage from "./components/EditorPage";

function App() {
  const user = localStorage.getItem("pagebuilder:user");
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/projects" /> : <Login />} />
        <Route path="/projects" element={<ProjectsGallery />} />
        <Route path="/editor/:projectId" element={<EditorPage />} />
        <Route path="/logout" element={<Logout />} />
      </Routes>
    </BrowserRouter>
  );
}
function Logout() {
  localStorage.removeItem("pagebuilder:user");
  return <Navigate to="/" replace />;
}
export default App;