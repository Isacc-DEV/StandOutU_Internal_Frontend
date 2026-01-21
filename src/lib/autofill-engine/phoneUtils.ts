// ============================================================================
// Phone Utilities - Country detection and validation
// ============================================================================

export interface CountryPhoneInfo {
  countryCode: string  // e.g., "+48"
  countryName: string  // e.g., "Poland"
  countryISO: string   // e.g., "PL"
}

// Comprehensive country code mapping
const COUNTRY_CODE_MAP: Record<string, CountryPhoneInfo> = {
  '+1': { countryCode: '+1', countryName: 'United States', countryISO: 'US' },
  '+44': { countryCode: '+44', countryName: 'United Kingdom', countryISO: 'GB' },
  '+48': { countryCode: '+48', countryName: 'Poland', countryISO: 'PL' },
  '+49': { countryCode: '+49', countryName: 'Germany', countryISO: 'DE' },
  '+33': { countryCode: '+33', countryName: 'France', countryISO: 'FR' },
  '+39': { countryCode: '+39', countryName: 'Italy', countryISO: 'IT' },
  '+34': { countryCode: '+34', countryName: 'Spain', countryISO: 'ES' },
  '+86': { countryCode: '+86', countryName: 'China', countryISO: 'CN' },
  '+91': { countryCode: '+91', countryName: 'India', countryISO: 'IN' },
  '+81': { countryCode: '+81', countryName: 'Japan', countryISO: 'JP' },
  '+82': { countryCode: '+82', countryName: 'South Korea', countryISO: 'KR' },
  '+61': { countryCode: '+61', countryName: 'Australia', countryISO: 'AU' },
  '+64': { countryCode: '+64', countryName: 'New Zealand', countryISO: 'NZ' },
  '+7': { countryCode: '+7', countryName: 'Russia', countryISO: 'RU' },
  '+55': { countryCode: '+55', countryName: 'Brazil', countryISO: 'BR' },
  '+52': { countryCode: '+52', countryName: 'Mexico', countryISO: 'MX' },
  '+54': { countryCode: '+54', countryName: 'Argentina', countryISO: 'AR' },
  '+56': { countryCode: '+56', countryName: 'Chile', countryISO: 'CL' },
  '+57': { countryCode: '+57', countryName: 'Colombia', countryISO: 'CO' },
  '+27': { countryCode: '+27', countryName: 'South Africa', countryISO: 'ZA' },
  '+20': { countryCode: '+20', countryName: 'Egypt', countryISO: 'EG' },
  '+234': { countryCode: '+234', countryName: 'Nigeria', countryISO: 'NG' },
  '+254': { countryCode: '+254', countryName: 'Kenya', countryISO: 'KE' },
  '+30': { countryCode: '+30', countryName: 'Greece', countryISO: 'GR' },
  '+31': { countryCode: '+31', countryName: 'Netherlands', countryISO: 'NL' },
  '+32': { countryCode: '+32', countryName: 'Belgium', countryISO: 'BE' },
  '+41': { countryCode: '+41', countryName: 'Switzerland', countryISO: 'CH' },
  '+43': { countryCode: '+43', countryName: 'Austria', countryISO: 'AT' },
  '+45': { countryCode: '+45', countryName: 'Denmark', countryISO: 'DK' },
  '+46': { countryCode: '+46', countryName: 'Sweden', countryISO: 'SE' },
  '+47': { countryCode: '+47', countryName: 'Norway', countryISO: 'NO' },
  '+351': { countryCode: '+351', countryName: 'Portugal', countryISO: 'PT' },
  '+353': { countryCode: '+353', countryName: 'Ireland', countryISO: 'IE' },
  '+358': { countryCode: '+358', countryName: 'Finland', countryISO: 'FI' },
  '+420': { countryCode: '+420', countryName: 'Czech Republic', countryISO: 'CZ' },
  '+421': { countryCode: '+421', countryName: 'Slovakia', countryISO: 'SK' },
  '+36': { countryCode: '+36', countryName: 'Hungary', countryISO: 'HU' },
  '+40': { countryCode: '+40', countryName: 'Romania', countryISO: 'RO' },
  '+359': { countryCode: '+359', countryName: 'Bulgaria', countryISO: 'BG' },
  '+380': { countryCode: '+380', countryName: 'Ukraine', countryISO: 'UA' },
  '+90': { countryCode: '+90', countryName: 'Turkey', countryISO: 'TR' },
  '+971': { countryCode: '+971', countryName: 'United Arab Emirates', countryISO: 'AE' },
  '+966': { countryCode: '+966', countryName: 'Saudi Arabia', countryISO: 'SA' },
  '+972': { countryCode: '+972', countryName: 'Israel', countryISO: 'IL' },
  '+65': { countryCode: '+65', countryName: 'Singapore', countryISO: 'SG' },
  '+60': { countryCode: '+60', countryName: 'Malaysia', countryISO: 'MY' },
  '+66': { countryCode: '+66', countryName: 'Thailand', countryISO: 'TH' },
  '+84': { countryCode: '+84', countryName: 'Vietnam', countryISO: 'VN' },
  '+63': { countryCode: '+63', countryName: 'Philippines', countryISO: 'PH' },
  '+62': { countryCode: '+62', countryName: 'Indonesia', countryISO: 'ID' },
  '+92': { countryCode: '+92', countryName: 'Pakistan', countryISO: 'PK' },
  '+880': { countryCode: '+880', countryName: 'Bangladesh', countryISO: 'BD' },
  '+94': { countryCode: '+94', countryName: 'Sri Lanka', countryISO: 'LK' },
  '+977': { countryCode: '+977', countryName: 'Nepal', countryISO: 'NP' },
}

const log = (_message: string, _data?: Record<string, unknown>) => {}
const warn = (_message: string) => {}

/**
 * Extract country info from a phone country code
 * Handles invalid codes by trying to match partial codes
 */
export function getCountryInfoFromCode(countryCode: string): CountryPhoneInfo | null {
  if (!countryCode) return null
  
  const normalized = countryCode.trim()
  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`
  
  // Try exact match first
  if (COUNTRY_CODE_MAP[withPlus]) {
    return COUNTRY_CODE_MAP[withPlus]
  }
  
  // Try to fix common mistakes by checking if it starts with a valid code
  // For example: "+486" should match "+48" (Poland)
  for (const validCode of Object.keys(COUNTRY_CODE_MAP)) {
    if (withPlus.startsWith(validCode)) {
      warn(`[PhoneUtils] Invalid country code "${withPlus}" corrected to "${validCode}"`)
      return COUNTRY_CODE_MAP[validCode]
    }
  }
  
  warn(`[PhoneUtils] Unknown country code: ${countryCode}`)
  return null
}

/**
 * Find matching option index in a select dropdown for country
 * Matches by: country code (+48), country name (Poland), or ISO code (PL)
 */
export function findCountryOptionIndex(
  options: HTMLOptionsCollection | string[],
  countryCode: string
): number {
  const countryInfo = getCountryInfoFromCode(countryCode)
  
  if (!countryInfo) {
    warn(`[PhoneUtils] Cannot find country option - invalid country code: ${countryCode}`)
    return -1
  }

  log(`[PhoneUtils] Searching for country: ${countryInfo.countryName} (${countryInfo.countryCode})`)

  const searchTerms = [
    countryInfo.countryCode,           // "+48"
    countryInfo.countryCode.slice(1),  // "48"
    countryInfo.countryName.toLowerCase(),  // "poland"
    countryInfo.countryISO.toLowerCase(),   // "pl"
  ]

  // Handle HTMLOptionsCollection (standard select)
  if (options instanceof HTMLOptionsCollection) {
    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      if (option.disabled || option.value === '') continue

      const optionText = option.text.toLowerCase().trim()
      const optionValue = option.value.toLowerCase().trim()
      const combined = `${optionText} ${optionValue}`

      for (const term of searchTerms) {
        if (combined.includes(term)) {
          return i
        }
      }
    }
  } 
  // Handle string array (react-select options)
  else {
    for (let i = 0; i < options.length; i++) {
      const optionText = options[i].toLowerCase().trim()

      for (const term of searchTerms) {
        if (optionText.includes(term)) {
          return i
        }
      }
    }
  }

  return -1
}

/**
 * Validate if a country code is valid
 */
export function isValidCountryCode(countryCode: string): boolean {
  if (!countryCode) return false
  const normalized = countryCode.trim()
  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`
  return COUNTRY_CODE_MAP[withPlus] !== undefined
}

/**
 * Get all valid country codes
 */
export function getAllCountryCodes(): string[] {
  return Object.keys(COUNTRY_CODE_MAP)
}

/**
 * Normalize phone number by removing common separators
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, '')
}
