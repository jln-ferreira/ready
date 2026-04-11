import type { Category } from '@/types'

// Maps category names (from utils/categories.ts) to keywords (all lowercase).
// Longer/more specific phrases are listed first so they match before substrings.
const KEYWORD_MAP: [string, string[]][] = [
  // ── Income ──────────────────────────────────────────────────────────────
  ['Payroll / Salary',        ['payroll', 'salary', 'wages', 'direct deposit', 'paycheque', 'paystub']],
  ['Dividends Received',      ['dividend']],
  ['Investment Income',       ['interest income', 'investment return', 'yield']],
  ['Contract Work',           ['contract', 'freelance', 'project payment']],
  ['Client Revenue',          ['client', 'invoice', 'consulting fee', 'retainer', 'payment received']],

  // ── Expense ──────────────────────────────────────────────────────────────
  ['Business Meals',          ['tim hortons', 'starbucks', 'mcdonald', 'subway', 'harveys', "a&w",
                                'wendys', 'pizza pizza', 'doordash', 'skip the dishes', 'uber eats',
                                'restaurant', 'café', 'cafe', 'breakfast', 'lunch', 'dinner', 'coffee', 'meal']],
  ['Internet & Phone',        ['rogers', 'bell canada', 'telus', 'shaw', 'fido', 'koodo', 'virgin mobile',
                                'phone bill', 'wireless plan', 'mobile plan', 'cellular', 'internet bill']],
  ['Vehicle / Mileage',       ['petro-canada', 'esso', 'shell', 'husky', 'ultramar', 'gas station',
                                'oil change', 'car repair', 'mileage', 'vehicle', 'fuel', 'tire']],
  ['Utilities',               ['toronto hydro', 'bc hydro', 'ontario hydro', 'enbridge', 'union gas',
                                'hydro bill', 'utilities', 'electric bill', 'water bill']],
  ['Software & Subscriptions',['microsoft 365', 'office 365', 'google workspace', 'adobe', 'notion',
                                'slack', 'github', 'dropbox', 'zoom', 'figma', 'canva', 'quickbooks',
                                'freshbooks', 'xero', 'saas', 'subscription', 'software licence', 'license']],
  ['Legal & Professional',    ['legal fee', 'lawyer', 'barrister', 'cpa fee', 'accountant', 'notary',
                                'professional fee', 'consulting fee']],
  ['Advertising & Marketing', ['facebook ads', 'google ads', 'linkedin ads', 'instagram ads',
                                'advertising', 'marketing', 'promotion', 'sponsored']],
  ['Travel',                  ['airbnb', 'via rail', 'air canada', 'westjet', 'porter airlines',
                                'hotel', 'flight', 'airfare', 'taxi', 'uber', 'lyft', 'parking']],
  ['Rent',                    ['office rent', 'studio rent', 'coworking', 'wework', 'lease payment', 'rent']],
  ['Insurance',               ['insurance premium', 'coverage', 'insurance']],
  ['Equipment',               ['laptop', 'computer', 'monitor', 'printer', 'camera', 'ipad', 'tablet', 'hardware', 'equipment']],
  ['Home Office',             ['home office']],
  ['Bank Fees',               ['nsf fee', 'wire fee', 'bank fee', 'service charge', 'overdraft fee', 'monthly fee']],
  ['Office Supplies',         ['staples', 'toner', 'ink cartridge', 'office supply', 'paper supply']],
]

export type PastTx = { description: string | null; category_id: string | null }

/**
 * Returns the best-matching category_id for a given description, or null.
 *
 * Priority:
 *   1. History match — most-used category across past transactions that share
 *      at least one meaningful word with the current description.
 *   2. Keyword match — first hit in KEYWORD_MAP (more-specific phrases listed first).
 */
export function suggestCategory(
  description: string,
  categories: Category[],
  past: PastTx[],
): string | null {
  const raw = description.trim()
  if (raw.length < 3) return null
  const normalized = raw.toLowerCase()

  // Meaningful words: length > 2, not common stopwords
  const STOPWORDS = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that'])
  const words = normalized.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
  if (words.length === 0) return null

  // ── 1. History match ────────────────────────────────────────────────────
  const counts: Record<string, number> = {}
  for (const tx of past) {
    if (!tx.description || !tx.category_id) continue
    const txNorm = tx.description.toLowerCase()
    const txWords = txNorm.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
    const hit = words.some(w => txNorm.includes(w)) || txWords.some(w => normalized.includes(w))
    if (hit) counts[tx.category_id] = (counts[tx.category_id] ?? 0) + 1
  }
  if (Object.keys(counts).length > 0) {
    const bestId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    if (categories.some(c => c.id === bestId)) return bestId
  }

  // ── 2. Keyword match ────────────────────────────────────────────────────
  for (const [catName, keywords] of KEYWORD_MAP) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        const cat = categories.find(c => c.name === catName)
        if (cat) return cat.id
      }
    }
  }

  return null
}
