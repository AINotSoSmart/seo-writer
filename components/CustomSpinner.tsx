import { cn } from '@/lib/utils';

export const CustomSpinner = ({ className }: { className?: string }) => {
    return (
        <div className={cn("flex items-end space-x-0.5 w-7 h-7", className)}>
            {/* Wave bars animation */}
            <div className="w-0.5 bg-black rounded-full animate-bounce" style={{ height: "8px", animationDelay: "0s" }}></div>
            <div
                className="w-0.5 bg-black rounded-full animate-bounce"
                style={{ height: "12px", animationDelay: "0.1s" }}
            ></div>
            <div
                className="w-0.5 bg-black rounded-full animate-bounce"
                style={{ height: "16px", animationDelay: "0.2s" }}
            ></div>
            <div
                className="w-0.5 bg-black rounded-full animate-bounce"
                style={{ height: "20px", animationDelay: "0.3s" }}
            ></div>
            <div
                className="w-0.5 bg-black rounded-full animate-bounce"
                style={{ height: "16px", animationDelay: "0.4s" }}
            ></div>
            <div
                className="w-0.5 bg-black rounded-full animate-bounce"
                style={{ height: "12px", animationDelay: "0.5s" }}
            ></div>
            <div
                className="w-0.5 bg-black rounded-full animate-bounce"
                style={{ height: "8px", animationDelay: "0.6s" }}
            ></div>
        </div>
    );
};