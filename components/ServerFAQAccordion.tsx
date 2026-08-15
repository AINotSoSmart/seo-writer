interface FAQItem {
  id: string
  question: string
  answer: string
}

interface ServerFAQAccordionProps {
  faqs: FAQItem[]
}

export function ServerFAQAccordion({ faqs }: ServerFAQAccordionProps) {
  return (
    <div className="py-8">
      <div className="space-y-4">
        {faqs.map((faq) => (
          <details key={faq.id} className="rounded-lg overflow-hidden">
            <summary className="flex items-center justify-between w-full px-6 py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 text-left text-base font-medium cursor-pointer">
              <span dangerouslySetInnerHTML={{ __html: faq.question }} />
              <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="bg-white border-x border-b border-gray-200 text-gray-600 px-6 py-4">
              <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: faq.answer }} />
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}