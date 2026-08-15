import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface BreadcrumbProps {
  title: string
}

export function Breadcrumb({ title }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
      <Link href="/" className="hover:text-gray-700">
        Home
      </Link>
      <ChevronRight className="h-4 w-4" />
      <Link href="/blog" className="hover:text-gray-700">
        Blog
      </Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-gray-900">{title}</span>
    </nav>
  )
}

