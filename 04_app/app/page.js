import { redirect } from "next/navigation";

// El middleware redirige "/" al panel del rol (o a /login). Esto es solo un respaldo.
export default function Home() {
  redirect("/login");
}
