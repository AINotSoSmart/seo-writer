// lib/fonts.ts
import { Bricolage_Grotesque } from 'next/font/google';

// Configure the Bricolage Grotesque font
export const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'], // Specify the character subsets you need
  weight: ['200', '300', '400', '500', '600', '700', '800'], // Include all weights you might use
  variable: '--font-bricolage-grotesque', // CSS variable for flexibility
});