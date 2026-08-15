import Link from "next/link"
import { cn } from "@/lib/utils"
import { Calendar, Clock, ArrowRight } from "lucide-react"

interface BlogCardProps {
  title: string
  excerpt: string
  slug: string
  publishedAt: string
  readTime: string
  category: string
  image: string
  featured?: boolean
}

export default function BlogCard({
  title,
  excerpt,
  slug,
  publishedAt,
  readTime,
  category,
  image,
  featured = false,
}: BlogCardProps) {
  return (
    <article className="group h-full">
      <Link href={`/blog/${slug}`} className="block h-full">
        <div className="
          relative h-full flex flex-col
          bg-white
          border border-stone-300/50
          rounded-[15px] p-1
        ">
          <div className="
            relative h-full flex flex-col
            w-full bg-stone-100/50 backdrop-blur-sm
            rounded-[12px]
            border border-stone-100
            overflow-hidden
          ">
            {/* Image */}
            <div className="relative h-56 border-b border-stone-100 overflow-hidden bg-stone-100 group-hover:opacity-95 transition-opacity">
              <img
                src={image || "/placeholder.svg"}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute top-4 left-4">
                <span className="
                  bg-white/90 backdrop-blur-sm
                  text-stone-800
                  border border-stone-200/50
                  px-3 py-1
                  text-xs font-semibold uppercase tracking-wider
                  rounded-full
                  shadow-sm
                ">
                  {category}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8 flex flex-col flex-grow">
              <div className="flex items-center text-xs font-semibold text-stone-500 mb-4 uppercase tracking-wide gap-4">
                <div className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-stone-400" />
                  <span>{publishedAt}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-stone-400" />
                  <span>{readTime}</span>
                </div>
              </div>

              <h2 className="font-display font-bold text-2xl text-stone-900 mb-3 leading-tight group-hover:text-brand-600 transition-colors">
                {title}
              </h2>

              <p className="text-stone-600 mb-6 leading-relaxed line-clamp-3 text-sm font-normal flex-grow">
                {excerpt}
              </p>

              <div className="pt-4 mt-auto">
                <div className="flex items-center text-stone-900 font-semibold text-sm group-hover:text-brand-600 transition-colors">
                  <span>Read Article</span>
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}