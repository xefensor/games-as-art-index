import "../styles.css";

export const metadata = {
  title: "Games as Art Index — Game development, history, and criticism",
  description: "A curated index of game development, history, and criticism.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { let mode = "auto"; try { mode = localStorage.getItem("gaa-theme") || "auto"; } catch {} const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; document.documentElement.dataset.themeMode = mode; })();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Manrope:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
