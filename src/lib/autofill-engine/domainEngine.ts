// ============================================================================
// Domain Engine - Main autofill orchestrator
// ============================================================================

import { Profile } from "./profile";
import { FillResult, FormField } from './types'
import { AIQuestionResponse, DomainAiQuestionPayload, domainQuestionHandler } from './domainQuestionHandler'
import { fieldCollector } from './fieldCollector'
import { fieldCategorizer } from './fieldCategorizer'
import { standardFieldsHandler } from './standardFieldsHandler'
import { educationFieldsHandler } from './educationFieldsHandler'
import { customQuestionsHandler } from './customQuestionsHandler'
import { DOMAIN_FIELD_MATCHERS } from './domainFieldMatchers'
import { fieldFiller } from './fieldFiller'

const log = (_message: string, _data?: Record<string, unknown>) => {}

export class DomainEngine {
  private profile: Profile | null = null
  
  setProfile(profile: Profile) {
    this.profile = profile
  }
  
  setOpenAIKey(apiKey: string) {
    domainQuestionHandler.setApiKey(apiKey)
  }

  setAIAnswerOverrides(responses: AIQuestionResponse[] | null) {
    domainQuestionHandler.setAnswerOverrides(responses)
  }

  async collectAIQuestions(): Promise<DomainAiQuestionPayload[]> {
    if (!this.profile) {
      return []
    }

    const allFields = await fieldCollector.collectAllFormFields()
    const categorizedFields = fieldCategorizer.categorizeFields(allFields)
    const unmatchedStandardFields = await this.getUnmatchedStandardFields(categorizedFields.standard, this.profile)
    const allCustomFields = [...categorizedFields.custom, ...unmatchedStandardFields]
    return customQuestionsHandler.collectAIQuestions(allCustomFields, this.profile)
  }
  
  async autofillDomainPage(): Promise<FillResult & { aiQuestionsHandled: number }> {
    if (!this.profile) {
      log('start: missing profile')
      return { filledCount: 0, totalFields: 0, unmatchedCount: 0, aiQuestionsHandled: 0 }
    }

    log('start', { profileId: this.profile.id || 'unknown' })
    
    const allFields = await fieldCollector.collectAllFormFields()
    log('field collection complete', { totalFields: allFields.length })
    const categorizedFields = fieldCategorizer.categorizeFields(allFields)
    log('field categorization complete', {
      standard: categorizedFields.standard.length,
      education: categorizedFields.education.length,
      custom: categorizedFields.custom.length
    })
    
    // Fill standard fields and track unmatched ones
    const standardResult = await standardFieldsHandler.fillStandardFields(categorizedFields.standard, this.profile)
    log('standard fields filled', {
      filled: standardResult.filledCount,
      total: standardResult.totalFields,
      unmatched: standardResult.unmatchedCount
    })
    
    // Identify unmatched standard fields that should be sent to custom questions
    const unmatchedStandardFields = await this.getUnmatchedStandardFields(categorizedFields.standard, this.profile)
    log('unmatched standard fields', { count: unmatchedStandardFields.length })
    
    // Add unmatched standard fields to custom questions
    const allCustomFields = [...categorizedFields.custom, ...unmatchedStandardFields]
    
    // Fill education and custom fields
    const educationResult = await educationFieldsHandler.fillEducationFields(categorizedFields.education, this.profile)
    log('education fields filled', {
      filled: educationResult.filledCount,
      total: educationResult.totalFields,
      unmatched: educationResult.unmatchedCount
    })
    const customResult = await customQuestionsHandler.fillCustomQuestions(allCustomFields, this.profile)
    log('custom fields filled', {
      filled: customResult.filledCount,
      total: customResult.totalFields,
      unmatched: customResult.unmatchedCount,
      aiQuestionsHandled: customResult.aiQuestionsHandled || 0
    })
    
    const totalResult = this.calculateTotals([standardResult, educationResult, customResult])
    log('greenhouse autofill complete', {
      filled: totalResult.filledCount,
      total: totalResult.totalFields,
      unmatched: totalResult.unmatchedCount
    })
    
    return {
      ...totalResult,
      aiQuestionsHandled: customResult.aiQuestionsHandled || 0
    }
  }
  
  private async getUnmatchedStandardFields(standardFields: FormField[], profile: Profile): Promise<FormField[]> {
    const unmatched: FormField[] = []
    
    for (const field of standardFields) {
      if (!field.key) continue
      
      const matcher = DOMAIN_FIELD_MATCHERS[field.key]
      if (!matcher) continue
      
      const value = matcher.getValue(profile)
      
      // Check if select/react-select field has value that doesn't exist in options
      if (field.type === 'select' && field.element instanceof HTMLSelectElement) {
        if (value) {
          const valueExists = await fieldFiller.validateSelectValue(field.element, value)
          if (!valueExists) {
            unmatched.push(field)
          }
        }
      } else if (field.type === 'react-select' || field.type === 'react-multi-select') {
        if (value) {
          const valueExists = await fieldFiller.validateReactSelectValue(field.element as HTMLInputElement, value, field.options)
          if (!valueExists) {
            unmatched.push(field)
          }
        }
      }
    }
    
    return unmatched
  }
  
  private calculateTotals(results: FillResult[]): FillResult {
    return results.reduce(
      (total, result) => ({
        filledCount: total.filledCount + result.filledCount,
        totalFields: total.totalFields + result.totalFields,
        unmatchedCount: total.unmatchedCount + result.unmatchedCount
      }),
      { filledCount: 0, totalFields: 0, unmatchedCount: 0 }
    )
  }
}

export const domainEngine = new DomainEngine()
