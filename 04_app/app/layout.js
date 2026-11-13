import "./globals.css";

export const metadata = { title: "EduTrack", description: "Seguimiento académico con roles, aprobaciones y auditoría" };

export default function RootLayout({ children }) {
  return (
    <html lang="es"><body>{children}</body></html>
  );
}
