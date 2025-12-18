import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const [user, setUser] = useState("");
    const nav = useNavigate();

    function handleLogin(e) {
        e.preventDefault();
        if (!user) return alert("Digite um nome");
        localStorage.setItem("pagebuilder:user", user);
        nav("/projects");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <form onSubmit={handleLogin} className="p-8 bg-white shadow-lg rounded-xl w-80">
                <h2 className="text-2xl font-semibold mb-4 text-center">Entrar</h2>
                <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="Nome de usuário"
                    className="w-full p-2 border rounded mb-3"
                />
                <button className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                    Entrar
                </button>
            </form>
        </div>
    );
}