// ============================================================================
// Standard Fields Handler - Filling standard profile fields
// ============================================================================

import { FormField, FillResult } from './types'
import { Profile } from "./profile";
import { getDomainFieldMatchers } from './domainFieldMatchers'
import { fieldFiller } from './fieldFiller'
import { getCountryInfoFromCode } from './phoneUtils'

const log = (_message: string, _data?: Record<string, unknown>) => {}

export class StandardFieldsHandler {
  async fillStandardFields(fields: FormField[], profile: Profile, engineMode: "greenhouse" | "workday" | "common"): Promise<FillResult> {
    let filledCount = 0
    let unmatchedCount = 0
    const matchers = getDomainFieldMatchers(engineMode)
    
    // Check if there's a separate phoneCountry field
    const hasPhoneCountryField = fields.some(f => f.key === 'phoneCountry')
    log('start', { totalFields: fields.length, hasPhoneCountryField })
    
    for (const field of fields) {
      if (!field.key) {
        unmatchedCount++
        continue
      }
      
      const matcher = matchers[field.key]
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
      
      const isSingleSelect = field.type === 'select' || field.type === 'react-select'
      const isMultiSelect = field.type === 'react-multi-select'

      // Handle select-like fields with validation
      if (isSingleSelect || isMultiSelect) {
        if (!value) {
          if (field.element instanceof HTMLSelectElement && isSingleSelect) {
            const success = await fieldFiller.selectFirstOption(field.element)
            if (success) {
              filledCount++
            } else {
              unmatchedCount++
            }
          } else {
            unmatchedCount++
          }
          continue
        }

        let valueExists = true
        if (field.element instanceof HTMLSelectElement) {
          valueExists = await fieldFiller.validateSelectValue(field.element, value)
        } else if (field.options && field.options.length > 0) {
          valueExists = await fieldFiller.validateReactSelectValue(field.element as HTMLInputElement, value, field.options)
        }

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
