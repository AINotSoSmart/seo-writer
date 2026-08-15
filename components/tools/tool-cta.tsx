import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ToolCTAProps {
    /** The contextual hook text that relates to what the user just did */
    hook: string;
    /** Primary CTA button text */
    ctaText?: string;
    /** Link destination */
    ctaLink?: string;
    /** Optional secondary description */
    description?: string;
}

export function ToolCTA({
    hook,
    ctaText = "Start Free Trial",
    ctaLink = "/login",
    description = "FlipAEO writes GEO-ready content that AI engines love to cite.",
}: ToolCTAProps) {
    return (
        <Card className="rounded-none relative overflow-hidden border-2 border-black shadow-neo">
            <CardContent className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    {/* Icon */}
                    <div className="shrink-0 p-3 rounded-xl bg-primary/10 text-primary border-2 border-primary/20">
                        <Sparkles className="h-6 w-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                        <p className="text-xl font-display font-bold text-foreground">
                            {hook}
                        </p>
                        <p className="text-base text-muted-foreground">
                            {description}
                        </p>
                    </div>

                    {/* CTA Button */}
                    <Button asChild size="lg" className="shrink-0 gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-primary text-primary-foreground font-bold">
                        <Link href={ctaLink}>
                            {ctaText}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
