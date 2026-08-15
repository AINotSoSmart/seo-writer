/**
 * Structured Data Component
 * 
 * This component injects JSON-LD structured data into the page head.
 * It's used to provide search engines with structured information
 * about the page content for better SEO and rich snippets.
 */

import Script from 'next/script';

interface StructuredDataProps {
  data: Record<string, any> | Record<string, any>[];
  id?: string;
}

export function StructuredData({ data, id }: StructuredDataProps) {
  const jsonLd = JSON.stringify(data, null, 0);

  return (
    <Script
      id={id || 'structured-data'}
      type="application/ld+json"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}

/**
 * Multiple Structured Data Component
 * 
 * Use this when you need to inject multiple JSON-LD schemas
 */
interface MultipleStructuredDataProps {
  schemas: Array<{
    id: string;
    data: Record<string, any>;
  }>;
}

export function MultipleStructuredData({ schemas }: MultipleStructuredDataProps) {
  return (
    <>
      {schemas.map((schema) => (
        <StructuredData
          key={schema.id}
          id={schema.id}
          data={schema.data}
        />
      ))}
    </>
  );
}