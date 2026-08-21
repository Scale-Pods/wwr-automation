import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "World Wide Real Estate | AI Automation",
    description: "AI-Powered Marketing & Operations managed by ScalePods",
    icons: {
        icon: '/favicon.png',
        shortcut: '/favicon.ico',
        apple: '/apple-icon.png',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="antialiased dark">
            <body>{children}</body>
        </html>
    );
}
