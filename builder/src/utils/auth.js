// src/utils/auth.js
const USERS_KEY = "pagebuilder:users";
const SESSION_KEY = "pagebuilder:session";

// compat com seu app atual
const LEGACY_USER_KEY = "pagebuilder:user";

export function normalizeUsername(name) {
  return String(name || "").trim().toLowerCase();
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function b64FromArrayBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function randomSaltB64(lenBytes = 16) {
  if (window.crypto?.getRandomValues) {
    const arr = new Uint8Array(lenBytes);
    window.crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr));
  }
  // fallback fraco, mas funciona
  return btoa(String(Date.now()) + Math.random());
}

async function sha256B64(input) {
  if (!window.crypto?.subtle) {
    // fallback (não é hash real)
    return `plain:${input}`;
  }
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64FromArrayBuffer(digest);
}

async function hashPassword(password, saltB64) {
  const pass = String(password ?? "");
  const salt = String(saltB64 ?? "");
  return sha256B64(`${salt}:${pass}`);
}

export function getUsers() {
  const users = readJson(USERS_KEY, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  writeJson(USERS_KEY, users);
}

export function getSessionUser() {
  const sess = readJson(SESSION_KEY, null);
  if (sess?.username) return sess.username;

  // fallback legado: se tiver pagebuilder:user, assume como sessão
  const legacy = localStorage.getItem(LEGACY_USER_KEY);
  if (legacy) {
    setSessionUser(legacy);
    return legacy;
  }
  return null;
}

export function setSessionUser(username) {
  const u = String(username || "").trim();
  if (!u) return;

  writeJson(SESSION_KEY, { username: u, at: new Date().toISOString() });
  // compat com o seu editor/galeria atuais
  localStorage.setItem(LEGACY_USER_KEY, u);

  // ajuda UI a reagir caso você queira escutar (opcional)
  window.dispatchEvent(new Event("pagebuilder:authchange"));
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
  window.dispatchEvent(new Event("pagebuilder:authchange"));
}

export function findUser(username) {
  const key = normalizeUsername(username);
  return getUsers().find((u) => u.usernameKey === key) || null;
}

export function isAdmin(username) {
  const u = findUser(username);
  return !!u?.isAdmin;
}

export async function registerUser(username, password) {
  const name = String(username || "").trim();
  const pass = String(password || "");

  if (!name) return { ok: false, error: "Digite um nome de usuário." };
  if (pass.length < 4) return { ok: false, error: "Senha muito curta (mínimo 4 caracteres)." };

  const usernameKey = normalizeUsername(name);

  const users = getUsers();
  if (users.some((u) => u.usernameKey === usernameKey)) {
    return { ok: false, error: "Esse usuário já existe." };
  }

  const hasAnyAdmin = users.some((u) => u.isAdmin);

  const salt = randomSaltB64(16);
  const passHash = await hashPassword(pass, salt);

  const newUser = {
    id: `u_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    username: name,
    usernameKey,
    salt,
    passHash,
    isAdmin: !hasAnyAdmin, // ✅ primeiro usuário vira admin automaticamente
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  setSessionUser(name);
  return { ok: true, user: newUser };
}

export async function loginUser(username, password) {
  const name = String(username || "").trim();
  const pass = String(password || "");

  if (!name) return { ok: false, error: "Digite o usuário." };

  const u = findUser(name);
  if (!u) return { ok: false, error: "Usuário não encontrado." };

  const expected = u.passHash;
  const got = await hashPassword(pass, u.salt);

  if (expected !== got) return { ok: false, error: "Senha incorreta." };

  setSessionUser(u.username);
  return { ok: true, user: u };
}

// Admin ops
export function listAllUsers() {
  // ordena por username
  return [...getUsers()].sort((a, b) => a.username.localeCompare(b.username));
}

export function setUserAdmin(targetUsername, makeAdmin) {
  const key = normalizeUsername(targetUsername);
  const users = getUsers();
  const idx = users.findIndex((u) => u.usernameKey === key);
  if (idx === -1) return { ok: false, error: "Usuário não encontrado." };

  users[idx] = { ...users[idx], isAdmin: !!makeAdmin, updatedAt: new Date().toISOString() };
  saveUsers(users);
  return { ok: true };
}

export async function adminResetPassword(targetUsername, newPassword) {
  const key = normalizeUsername(targetUsername);
  const users = getUsers();
  const idx = users.findIndex((u) => u.usernameKey === key);
  if (idx === -1) return { ok: false, error: "Usuário não encontrado." };

  const pass = String(newPassword || "");
  if (pass.length < 4) return { ok: false, error: "Senha muito curta (mínimo 4 caracteres)." };

  const salt = randomSaltB64(16);
  const passHash = await hashPassword(pass, salt);

  users[idx] = {
    ...users[idx],
    salt,
    passHash,
    updatedAt: new Date().toISOString(),
  };
  saveUsers(users);
  return { ok: true };
}
