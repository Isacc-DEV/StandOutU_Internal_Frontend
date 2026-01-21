// ============================================================================
// Standard Fields Handler - Filling standard profile fields
// ============================================================================

import { FormField, FillResult } from './types'
import { Profile } from "./profile";
import { DOMAIN_FIELD_MATCHERS } from './domainFieldMatchers'
import { fieldFiller } from './fieldFiller'
import { getCountryInfoFromCode } from './phoneUtils'

const log = (_message: string, _data?: Record<string, unknown>) => {}

export class StandardFieldsHandler {
  async fillStandardFields(fields: FormField[], profile: Profile): Promise<FillResult> {
    let filledCount = 0
    let unmatchedCount = 0
    
    // Check if there's a separate phoneCountry field
    const hasPhoneCountryField = fields.some(f => f.key === 'phoneCountry')
    log('start', { totalFields: fields.length, hasPhoneCountryField })
    
    for (const field of fields) {
      if (!field.key) {
        unmatchedCount++
        continue
      }
      
      const matcher = DOMAIN_FIELD_MATCHERS[field.key]
      if (!matcher) {
        unmatchedCount++
        continue
      }
      
      let value = matcher.getValue(profile)
      
      // Special handling for phone field when there's a separate phoneCountry field
      if (field.key === 'phone' && hasPhoneCountryField && value) {
        // Extract only the number part (remove country code)
        value = profile.personalInfo.phone.number || undefined
      }
      
      // Special handling for phoneCountry - normalize the country code
      if (field.key === 'phoneCountry' && value) {
        const countryInfo = getCountryInfoFromCode(value)
        if (countryInfo) {
          value = countryInfo.countryCode  // Use normalized code (e.g., "+48" instead of "+486")
        } else {
          unmatchedCount++
          continue
        }
      }
      
      // Handle selects with validation
      if (field.type === 'select' && field.element instanceof HTMLSelectElement) {
        if (!value) {
          const success = await fieldFiller.selectFirstOption(field.element)
          if (success) {
            filledCount++
          } else {
            unmatchedCount++
          }
          continue
        }
        
        // Validate if value exists in options
        const valueExists = await fieldFiller.validateSelectValue(field.element, value)
        if (!valueExists) {
          // Move to custom questions - don't fill
          unmatchedCount++
          continue
        }
        
        // Fill with validated value
        const success = await fieldFiller.fillField(field, value)
        if (success) {
          filledCount++
        } else {
          unmatchedCount++
        }
        continue
      }

      // Handle React-Select with validation
      if (field.type === 'react-select' || field.type === 'react-multi-select') {
        if (!value) {
          unmatchedCount++
          continue
        }
        
        // Validate if value exists in options
        const valueExists = await fieldFiller.validateReactSelectValue(field.element as HTMLInputElement, value, field.options)
        if (!valueExists) {
          // Move to custom questions - don't fill
          unmatchedCount++
          continue
        }
        
        const success = await fieldFiller.fillField(field, value)
        if (success) {
          filledCount++
        } else {
          unmatchedCount++
        }
        continue
      }
      
      // Handle other field types
      if (!value) {
        unmatchedCount++
        continue
      }
      
      const success = await fieldFiller.fillField(field, value)
      if (success) {
        filledCount++
      } else {
        unmatchedCount++
      }
    }
    
    log('complete', { filled: filledCount, total: fields.length, unmatched: unmatchedCount })
    return { filledCount, totalFields: fields.length, unmatchedCount }
  }
}

export const standardFieldsHandler = new StandardFieldsHandler()
