function safeParse(raw, fallback) {
  try {
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function norm(user) {
  return String(user || "").trim().toLowerCase();
}

function keyFor(user) {
  const u = String(user || "").trim();
  const kExact = `pagebuilder:projects:${u}`;
  const kNorm = `pagebuilder:projects:${norm(u)}`;

  if (localStorage.getItem(kExact) !== null) return kExact;
  return kNorm;
}

export function loadProjects(user) {
  const key = keyFor(user);
  const arr = safeParse(localStorage.getItem(key), []);
  return Array.isArray(arr) ? arr : [];
}

export function saveProjects(user, projects) {
  const key = keyFor(user);
  localStorage.setItem(key, JSON.stringify(projects || []));
}

export function loadProjectById(user, id) {
  return loadProjects(user).find((p) => p.id === id);
}

export function saveProject(user, project) {
  const arr = loadProjects(user).filter((p) => p.id !== project.id);
  arr.unshift(project);
  saveProjects(user, arr);
}

export function deleteProject(user, id) {
  const arr = loadProjects(user).filter((p) => p.id !== id);
  saveProjects(user, arr);
}

export function listAllProjectsAcrossUsers() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("pagebuilder:projects:")) continue;

    const owner = k.replace("pagebuilder:projects:", "");
    const arr = safeParse(localStorage.getItem(k), []);
    if (!Array.isArray(arr)) continue;

    for (const project of arr) out.push({ owner, project });
  }
  return out;
}
