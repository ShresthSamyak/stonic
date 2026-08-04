import "./globals.css";

export const metadata = {
  title: "Stonic AI — Your JARVIS Voice Assistant",
  description:
    "A bilingual (Hinglish) AI voice assistant for your PC. Speak, and the agents research, write a report and reply out loud. Powered by DeepSeek.",
};

export const viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
