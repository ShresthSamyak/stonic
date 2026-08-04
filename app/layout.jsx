import "./globals.css";

export const metadata = {
  title: "Stonic AI — आपका हिंदी JARVIS | Voice Assistant",
  description:
    "आपके PC के लिए हिंदी बोलने वाला AI वॉइस असिस्टेंट। बोलिए, वो रिसर्च करता है, रिपोर्ट बनाता है और जवाब देता है। DeepSeek से संचालित।",
};

export const viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
