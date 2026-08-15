import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function ToolsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background font-sans antialiased text-foreground">
            <Navbar />
            <main className="flex-1 py-24">
                {children}
            </main>
            <Footer />
        </div>
    );
}
