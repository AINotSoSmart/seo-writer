"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
    text: string;
    className?: string;
    variant?: "default" | "outline" | "ghost" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
    onCopy?: () => void;
}

export function CopyButton({
    text,
    className,
    variant = "outline",
    size = "default",
    onCopy,
}: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            onCopy?.();
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleCopy}
            className={cn("gap-2", className)}
        >
            {copied ? (
                <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                </>
            ) : (
                <>
                    <Copy className="h-4 w-4" />
                    Copy
                </>
            )}
        </Button>
    );
}
