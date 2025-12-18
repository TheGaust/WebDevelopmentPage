import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadProjects, saveProjects } from "../utils/storage";

function ProjectCard({ project, onOpen, onDelete }) {
  return (
    <div className="w-1/5 p-2">
      <div className="bg-white rounded shadow h-40 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover" />
        </div>
        <div className="p-2 text-sm flex justify-between items-center">
          <span>{project.title}</span>
          <button onClick={(e)=>{e.stopPropagation(); onDelete(project.id);}} className="text-red-500">X</button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsGallery(){
  const [projects, setProjects] = useState([]);
  const nav = useNavigate();
  const user = localStorage.getItem("pagebuilder:user") || "anon";

  useEffect(()=> {
    setProjects(loadProjects(user));
  }, []);

  function newBlank() {
    // id gerado, estrutura vazia
    const id = `p_${Date.now()}`;
    const p = { id, title: "Página sem título", updatedAt: Date.now(), thumbnail: "/mnt/data/a9f4cb41-1eec-4232-938f-a6bbe7c0ed58.png", structure: { elements: [] } };
    const arr = [p, ...projects];
    setProjects(arr);
    saveProjects(user, arr);
    nav(`/editor/${p.id}`);
  }

  function openProject(id) {
    nav(`/editor/${id}`);
  }

  function deleteProject(id){
    const next = projects.filter(p=>p.id !== id);
    setProjects(next);
    saveProjects(user, next);
  }

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Seus projetos</h1>
      <div className="bg-white p-3 rounded shadow" style={{height: '520px', overflowY: 'auto'}}>
        <div className="flex flex-wrap -mx-2">
          {/* first card: new blank */}
          <div className="w-1/5 p-2">
            <div onClick={newBlank} className="h-40 bg-gray-100 rounded flex items-center justify-center cursor-pointer opacity-80">
              <span className="text-4xl text-gray-400">+</span>
            </div>
          </div>

          {projects.slice(0, 20).map(p => (
            <div key={p.id} className="w-1/5 p-2">
              <div onClick={()=>openProject(p.id)} className="bg-white rounded shadow h-40 flex flex-col cursor-pointer">
                <div className="flex-1 overflow-hidden">
                  <img src={p.thumbnail} alt={p.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 text-sm">{p.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}