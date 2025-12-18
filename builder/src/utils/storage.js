export function loadProjects(user) {
    try {
        return JSON.parse(localStorage.getItem(`pagebuilder:projects:${user}`) || "[]");
    } catch { return []; }
}
export function saveProjects(user, projects) {
    localStorage.setItem(`pagebuilder:projects:${user}`, JSON.stringify(projects));
}
export function loadProjectById(user, id) {
    return loadProjects(user).find(p => p.id === id);
}
export function saveProject(user, project) {
    const arr = loadProjects(user).filter(p=>p.id !== project.id);
    arr.unshift(project);
    saveProjects(user, arr);
}