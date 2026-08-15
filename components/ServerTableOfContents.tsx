interface TOCEntry {
  url: string
  name: string
  position: number
}

interface ServerTableOfContentsProps {
  entries: TOCEntry[]
}

export function ServerTableOfContents({ entries }: ServerTableOfContentsProps) {
  return (
    <div className="mb-8">
      <details className="w-full rounded-lg overflow-hidden">
        <summary className="flex items-center justify-between w-full px-6 py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 text-left text-lg font-medium cursor-pointer">
          Table of Content
          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="bg-white border-x border-b border-gray-200 text-gray-600">
          <nav className="p-4">
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li key={entry.position} className="hover:bg-gray-300 rounded transition-colors">
                  <a
                    href={entry.url}
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-indigo-600"
                    dangerouslySetInnerHTML={{ __html: entry.name }}
                  />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </details>
    </div>
  )
}