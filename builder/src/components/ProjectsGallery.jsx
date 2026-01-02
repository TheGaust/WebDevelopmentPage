// src/components/ProjectsGallery.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSessionUser, isAdmin, logout, listAllUsers, setSessionUser } from "../utils/auth";
import { loadProjects, deleteProject } from "../utils/storage";

export default function ProjectsGallery() {
  const nav = useNavigate();
  const me = getSessionUser();
  const admin = isAdmin(me);

  const users = useMemo(() => (admin ? listAllUsers() : []), [admin]);
  const [viewUser, setViewUser] = useState(me);

  const [refreshTick, setRefreshTick] = useState(0);

  const projects = useMemo(() => loadProjects(viewUser), [viewUser, refreshTick]);

  function goLogout() {
    logout();
    nav("/", { replace: true });
  }

  function impersonate(u) {
    setSessionUser(u);
    setViewUser(u);
  }

  function openProject(p) {
    const owner = viewUser;
    const q = admin && owner && owner !== me ? `?owner=${encodeURIComponent(owner)}` : "";
    nav(`/editor/${p.id}${q}`);
  }

  function newProject() {
    const owner = viewUser;
    const q = admin && owner && owner !== me ? `?owner=${encodeURIComponent(owner)}` : "";
    nav(`/editor/new${q}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Logado como</div>
            <div className="text-xl font-semibold">{me}</div>
          </div>

          <div className="flex items-center gap-2">
            {admin && (
              <button
                className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => nav("/admin")}
              >
                Admin
              </button>
            )}
            <button className="px-3 py-2 rounded bg-white border hover:bg-slate-100" onClick={goLogout}>
              Sair
            </button>
          </div>
        </div>

        {admin && (
          <div className="mt-5 p-4 bg-white border rounded-xl">
            <div className="text-sm font-medium mb-2">Ver projetos de</div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border rounded px-3 py-2"
                value={viewUser}
                onChange={(e) => setViewUser(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.username} {u.isAdmin ? "(admin)" : ""}
                  </option>
                ))}
              </select>

              {viewUser !== me && (
                <button
                  className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => impersonate(viewUser)}
                  title="Entra como esse usuário (para abrir editor etc)"
                >
                  Entrar como
                </button>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              <b>Abrir</b><code>?owner=</code>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projetos</h2>
          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={newProject}
          >
            Novo projeto
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-white border rounded-xl p-4">
              <div className="font-semibold">{p.title || "Sem título"}</div>
              <div className="text-xs text-slate-500 mt-1">
                Atualizado: {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "-"}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => openProject(p)}
                >
                  Abrir
                </button>

                <button
                  className="px-3 py-2 rounded bg-white border hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                  onClick={() => {
                    if (!window.confirm("Excluir este projeto?")) return;
                    deleteProject(viewUser, p.id);
                    setRefreshTick((t) => t + 1); // ✅ refresh garantido
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}

          {!projects.length && (
            <div className="text-slate-500 text-sm col-span-full">Nenhum projeto ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
