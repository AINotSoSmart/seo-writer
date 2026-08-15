"use client"

import React from "react"
import { ChevronDown } from "lucide-react"
import * as Accordion from "@radix-ui/react-accordion"
import { cn } from "@/lib/utils"

interface TOCEntry {
  url: string
  name: string
  position: number
}

interface TableOfContentsProps {
  entries: TOCEntry[]
}

export function TableOfContents({ entries }: TableOfContentsProps) {
  return (
    <div className="mb-8">
      <Accordion.Root type="single" collapsible className="w-full">
        <Accordion.Item value="toc" className="rounded-lg overflow-hidden">
          <Accordion.Header>
            <Accordion.Trigger
              className={cn(
                "flex items-center justify-between w-full px-6 py-4",
                "bg-white border border-gray-200 hover:bg-gray-50 text-gray-900",
                "text-left text-lg font-medium transition-all",
              )}
            >
              Table of Content
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="bg-white border-x border-b border-gray-200 text-gray-600">
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
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </div>
  )
}

