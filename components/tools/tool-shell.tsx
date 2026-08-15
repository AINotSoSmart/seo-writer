import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface ToolShellProps {
    /** Tool name for the H1 */
    title: string;
    /** Short description below the title */
    description: string;
    /** Optional badge text (e.g., "Free", "New") */
    badge?: string;
    /** The main tool UI */
    children: ReactNode;
    /** WebApplication schema data */
    schema?: {
        name: string;
        description: string;
        url: string;
    };
}

export function ToolShell({
    title,
    description,
    badge = "100% Free",
    children,
    schema,
}: ToolShellProps) {
    // Generate WebApplication schema
    const webAppSchema = schema
        ? {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: schema.name,
            description: schema.description,
            url: schema.url,
            applicationCategory: "UtilityApplication",
            operatingSystem: "Web Browser",
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
            },
            publisher: {
                "@type": "Organization",
                name: "FlipAEO",
                url: "https://flipaeo.com",
            },
        }
        : null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Inject WebApplication Schema */}
            {webAppSchema && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
                />
            )}

            {/* Hero Section */}
            <div className="text-center mb-10">
                {badge && (
                    <Badge variant="outline" className="mb-4 border-2 border-border font-bold">
                        {badge}
                    </Badge>
                )}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight mb-4 text-foreground">
                    {title}
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    {description}
                </p>
            </div>

            {/* Tool Content */}
            {children}
        </div>
    );
}
