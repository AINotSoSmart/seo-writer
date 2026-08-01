export type ArticleLength = 'short' | 'medium' | 'long' | 'very_long' | 'extra_long'

export const ARTICLE_LENGTHS: { value: ArticleLength; label: string; wordRange: string }[] = [
  { value: 'short', label: 'Short', wordRange: '1,200–1,800' },
  { value: 'medium', label: 'Medium', wordRange: '1,600–2,200' },
  { value: 'long', label: 'Long', wordRange: '2,400–3,200' },
  { value: 'very_long', label: 'Very Long', wordRange: '2,800–3,800' },
  { value: 'extra_long', label: 'Extra Long', wordRange: '3,500–4,500' },
]

export const ARTICLE_LENGTH_CONFIG: Record<ArticleLength, {
  label: string
  wordRange: string
  sections: { min: number; max: number }
  wordsPerSection: string
  h2Limit: string
}> = {
  short: { label: 'Short', wordRange: '1,200–1,800', sections: { min: 3, max: 5 }, wordsPerSection: '240–360', h2Limit: '2-3' },
  medium: { label: 'Medium', wordRange: '1,600–2,200', sections: { min: 5, max: 7 }, wordsPerSection: '230–360', h2Limit: '3-4' },
  long: { label: 'Long', wordRange: '2,400–3,200', sections: { min: 7, max: 11 }, wordsPerSection: '260–420', h2Limit: '4-6' },
  very_long: { label: 'Very Long', wordRange: '2,400–3,000', sections: { min: 9, max: 13 }, wordsPerSection: '220–360', h2Limit: '5-7' },
  extra_long: { label: 'Extra Long', wordRange: '3,000–4,000', sections: { min: 11, max: 16 }, wordsPerSection: '250–400', h2Limit: '6-8' },
}

export const getArticleLengthConfig = (length: ArticleLength) => ARTICLE_LENGTH_CONFIG[length]
