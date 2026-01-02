// src/components/AdminPanel.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSessionUser, logout, listAllUsers, setUserAdmin, adminResetPassword, setSessionUser } from "../utils/auth";
import { listAllProjectsAcrossUsers } from "../utils/storage";

export default function AdminPanel() {
  const nav = useNavigate();
  const me = getSessionUser();

  const [tick, setTick] = useState(0);
  const users = useMemo(() => listAllUsers(), [tick]);
  const allProjects = useMemo(() => listAllProjectsAcrossUsers(), [tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  function goLogout() {
    logout();
    nav("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Admin</div>
            <div className="text-xl font-semibold">{me}</div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded bg-white border hover:bg-slate-100" onClick={() => nav("/projects")}>
              Voltar
            </button>
            <button className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800" onClick={goLogout}>
              Sair
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* USERS */}
          <div className="bg-white border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Usuários</h2>
              <button className="text-sm px-3 py-1 rounded bg-slate-100 hover:bg-slate-200" onClick={refresh}>
                Atualizar
              </button>
            </div>

            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {u.username} {u.isAdmin ? <span className="text-xs text-indigo-600">(admin)</span> : null}
                      </div>
                      <div className="text-xs text-slate-500">criado: {new Date(u.createdAt).toLocaleString()}</div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={() => {
                          setSessionUser(u.username);
                          nav("/projects");
                        }}
                        title="Entra como esse usuário (impersonar)"
                      >
                        Entrar como
                      </button>

                      <button
                        className={`text-xs px-2 py-1 rounded border ${
                          u.isAdmin ? "bg-white hover:bg-slate-50" : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                        onClick={() => {
                          const res = setUserAdmin(u.username, !u.isAdmin);
                          if (!res.ok) return alert(res.error);
                          refresh();
                        }}
                      >
                        {u.isAdmin ? "Remover admin" : "Tornar admin"}
                      </button>

                      <button
                        className="text-xs px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800"
                        onClick={async () => {
                          const np = window.prompt(`Nova senha para ${u.username} (mín 4):`);
                          if (np === null) return;
                          const res = await adminResetPassword(u.username, np);
                          if (!res.ok) return alert(res.error);
                          alert("Senha resetada.");
                          refresh();
                        }}
                      >
                        Reset senha
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!users.length && <div className="text-sm text-slate-500">Nenhum usuário ainda.</div>}
            </div>
          </div>

          {/* PROJECTS */}
          <div className="bg-white border rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Todos os projetos</h2>

            <div className="text-sm text-slate-600 mb-3">
              Total: <span className="font-semibold">{allProjects.length}</span>
            </div>

            <div className="max-h-[520px] overflow-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left border-b">
                    <th className="p-2">Dono</th>
                    <th className="p-2">Projeto</th>
                    <th className="p-2">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {allProjects.map((row) => (
                    <tr key={`${row.owner}:${row.project.id}`} className="border-b">
                      <td className="p-2">{row.owner}</td>
                      <td className="p-2">{row.project.title || row.project.id}</td>
                      <td className="p-2">
                        {row.project.updatedAt ? new Date(row.project.updatedAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                  {!allProjects.length && (
                    <tr>
                      <td className="p-2 text-slate-500" colSpan={3}>
                        Nenhum projeto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-slate-500 mt-2">
              * Para abrir um projeto de alguém, use “Entrar como” no painel de usuários e depois abra pelo /projects.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
