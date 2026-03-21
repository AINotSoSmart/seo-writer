export type ArticleLength = 'short' | 'medium' | 'long' | 'very_long' | 'extra_long'

export const ARTICLE_LENGTHS: { value: ArticleLength; label: string; wordRange: string }[] = [
  { value: 'short', label: 'Short', wordRange: '1,000–1,400' },
  { value: 'medium', label: 'Medium', wordRange: '1,400–2,000' },
  { value: 'long', label: 'Long', wordRange: '2,000–2,800' },
  { value: 'very_long', label: 'Very Long', wordRange: '2,800–3,600' },
  { value: 'extra_long', label: 'Extra Long', wordRange: '3,600–4,500' },
]

export const ARTICLE_LENGTH_CONFIG: Record<ArticleLength, {
  label: string
  wordRange: string
  sections: { min: number; max: number }
  wordsPerSection: string
  h2Limit: string
}> = {
  short:      { label: 'Short',      wordRange: '1,000–1,400',  sections: { min: 4, max: 6 },   wordsPerSection: '150–250', h2Limit: '2-3' },
  medium:     { label: 'Medium',     wordRange: '1,400–2,000',  sections: { min: 6, max: 9 },   wordsPerSection: '180–280', h2Limit: '3-5' },
  long:       { label: 'Long',       wordRange: '2,000–2,800',  sections: { min: 8, max: 12 },  wordsPerSection: '200–320', h2Limit: '4-6' },
  very_long:  { label: 'Very Long',  wordRange: '2,800–3,600',  sections: { min: 11, max: 15 }, wordsPerSection: '220–360', h2Limit: '5-7' },
  extra_long: { label: 'Extra Long', wordRange: '3,600–4,500',  sections: { min: 14, max: 18 }, wordsPerSection: '250–400', h2Limit: '6-8' },
}

export const getArticleLengthConfig = (length: ArticleLength) => ARTICLE_LENGTH_CONFIG[length]
