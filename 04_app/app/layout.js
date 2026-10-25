export const metadata = { title: "EduTrack", description: "Rendimiento académico de estudiantes" };
export default function RootLayout({ children }) {
  return (
    <html lang="es"><body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 860, margin: "0 auto", padding: 16, lineHeight: 1.4 }}>{children}</body></html>
  );
}
