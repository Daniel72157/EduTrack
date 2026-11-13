"use client";
import { useState } from "react";
import { Campo, llamar, Resultado } from "../_components/ui";

export default function Login() {
  const [f, setF] = useState({ email: "", password: "" });
  const [r, setR] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEnviando(true); setR(null);
    const res = await llamar("/api/auth/login", "POST", f);
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith(res.destino) ? next : res.destino;
      return;
    }
    setR(res); setEnviando(false);
  };

  return (
    <main className="login">
      <form className="card" onSubmit={entrar}>
        <div className="brand" style={{ fontSize: 24, marginBottom: 4 }}>Edu<span>Track</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Seguimiento académico. Inicia sesión con la cuenta que te dio la institución.</p>
        <Campo name="email" label="Correo" type="email" v={f} set={setF} autoComplete="username" required autoFocus />
        <div style={{ height: 10 }} />
        <Campo name="password" label="Contraseña" type="password" v={f} set={setF} autoComplete="current-password" required />
        <div className="actions">
          <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={enviando}>{enviando ? "Entrando…" : "Iniciar sesión"}</button>
        </div>
        <Resultado r={r} />
        <p className="small muted" style={{ marginBottom: 0 }}>¿No tienes cuenta u olvidaste tu contraseña? Pídela a un administrativo.</p>
      </form>
    </main>
  );
}
