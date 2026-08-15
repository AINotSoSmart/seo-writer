import Link from "next/link"
import { cn } from "@/lib/utils"
import { User, Linkedin, Twitter, ExternalLink, X } from "lucide-react"

interface AuthorCardProps {
    name: string
    avatar: string
    bio?: string
    role?: string
    className?: string
}

export default function AuthorCard({
    name,
    avatar,
    bio,
    role = "Content Expert",
    className,
}: AuthorCardProps) {
    return (
        <div className={cn("w-full max-w-3xl mx-auto my-12", className)}>
            <div className="
        relative w-full
        bg-white
        border border-stone-300/50
        rounded-[15px] p-1

      ">
                <div className="
          w-full bg-stone-100/50 backdrop-blur-sm
          rounded-[12px] p-6 sm:p-8
          border border-stone-100
          flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left
        ">
                    {/* Avatar */}
                    <div className="flex-shrink-0 relative">
                        <div className="rounded-full p-1 bg-white border border-stone-200 shadow-sm relative z-10">
                            {avatar ? (
                                <img
                                    src={avatar}
                                    alt={name}
                                    className="w-20 h-20 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center">
                                    <User className="w-10 h-10 text-stone-400" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 space-y-3">
                        <div>
                            <h3 className="text-xl font-display font-bold text-stone-900">
                                {name}
                            </h3>
                            <p className="text-sm font-medium text-brand-600 uppercase tracking-wide">
                                {role}
                            </p>
                        </div>

                        <p className="text-stone-600 leading-relaxed text-sm">
                            {bio || `Founder of FlipAEO. I’ve scaled multiple SaaS and blogs using content SEO. Sharing what I’ve learned about ranking and growth, no fluff, just what actually works.`}
                        </p>

                        {/* Social / Links (Simulated for now if not in props, or just static for "human expert" proof) */}
                        <div className="flex items-center justify-center sm:justify-start gap-3 pt-2">
                            {/* Ideally these come from CMS, adding placeholders for "Human Expert" vibe */}
                            <div className="flex gap-2">
                                <Link href="https://twitter.com/AINotSoSmart">
                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-500 hover:text-brand-600 hover:border-brand-200 transition-colors cursor-pointer">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="#000000" className="bi bi-twitter-x" viewBox="0 0 16 16" id="Twitter-X--Streamline-Bootstrap" height="16" width="16">

                                            <path d="M12.6 0.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867 -5.07 -4.425 5.07H0.316l5.733 -6.57L0 0.75h5.063l3.495 4.633L12.601 0.75Zm-0.86 13.028h1.36L4.323 2.145H2.865z" strokeWidth="1"></path>
                                        </svg>
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
