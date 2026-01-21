// ============================================================================
// Custom Questions Handler - AI-powered custom question handling
// ============================================================================

import { FormField, FillResult, FieldType } from './types'
import { Profile } from "./profile";
import { DOMAIN_FIELD_MATCHERS } from './domainFieldMatchers'
import { DomainAiQuestionPayload, DomainQuestion, domainQuestionHandler } from './domainQuestionHandler'
import { findCustomFieldDefinition, getCustomFieldValue } from './customFieldDefinitions'
import { fieldFiller } from './fieldFiller'
import { findCountryOptionIndex } from './phoneUtils'

const log = (_message: string, _data?: Record<string, unknown>) => {}

export class CustomQuestionsHandler {
  async collectAIQuestions(fields: FormField[], profile: Profile): Promise<DomainAiQuestionPayload[]> {
    if (fields.length === 0) {
      return []
    }

    const { fieldsNeedingAI } = await this.classifyFields(fields, profile)
    return fieldsNeedingAI.map((field, index) => ({
      id: this.buildQuestionId(field, index),
      type: this.mapFieldTypeToQuestionType(field.type),
      label: field.label,
      required: field.isRequired,
      options: field.options
    }))
  }

  async fillCustomQuestions(fields: FormField[], profile: Profile): Promise<FillResult & { aiQuestionsHandled: number }> {
    if (fields.length === 0) {
      log('skipping: no custom fields')
      return { filledCount: 0, totalFields: 0, unmatchedCount: 0, aiQuestionsHandled: 0 }
    }
    
    log('start', { totalFields: fields.length })
    // Log detected fields with options
    log('field detection', {
      fields: fields.map(f => ({
        label: f.label,
        type: f.type,
        options: f.options || []
      }))
    })
    
    const { fieldsWithKeys, fieldsWithDefinitions, fieldsNeedingAI } = await this.classifyFields(fields, profile)
    
    log('routing summary', {
      withKeys: fieldsWithKeys.length,
      withDefinitions: fieldsWithDefinitions.length,
      needingAI: fieldsNeedingAI.length
    })

    let filledCount = 0
    let unmatchedCount = 0
    
    for (const field of fieldsWithKeys) {
      const matcher = DOMAIN_FIELD_MATCHERS[field.key!]
      const value = matcher?.getValue(profile)
      
      if (value) {
        // For select types, find the index and use index-based filling
        if (field.type === 'select' || field.type === 'react-select' || field.type === 'react-multi-select') {
          let matchedIndex = -1
          
          // Special handling for phoneCountry and country fields
          if (field.key === 'phoneCountry' || field.key === 'country') {
            const countryCode = field.key === 'phoneCountry' 
              ? profile.personalInfo.phone.countryCode 
              : null
            const countryName = field.key === 'country' 
              ? profile.personalInfo.country 
              : null
            
            // For phoneCountry, use country code to find option
            if (field.key === 'phoneCountry' && countryCode) {
              if (field.type === 'select' && field.element instanceof HTMLSelectElement) {
                matchedIndex = findCountryOptionIndex(field.element.options, countryCode)
              } else if (field.options) {
                matchedIndex = findCountryOptionIndex(field.options, countryCode)
              }
            }
            // For country, try to find by country name first, then fallback to matching
            else if (field.key === 'country' && countryName) {
              if (field.type === 'select' && field.element instanceof HTMLSelectElement) {
                matchedIndex = await this.findSelectOptionIndex(field.element, countryName)
              } else if (field.options) {
                matchedIndex = this.findReactSelectOptionIndex(field.options, countryName)
              }
            }
          } else {
            // Normal matching for other select fields
            if (field.type === 'select' && field.element instanceof HTMLSelectElement) {
              matchedIndex = await this.findSelectOptionIndex(field.element, value)
            } else if ((field.type === 'react-select' || field.type === 'react-multi-select') && field.options) {
              matchedIndex = this.findReactSelectOptionIndex(field.options, value)
            }
          }
          
          if (matchedIndex >= 0) {
            const indexValue = `#${matchedIndex}`
            const success = await fieldFiller.fillFieldWithAI(field, indexValue, true)
            if (success) {
              filledCount++
            } else {
              unmatchedCount++
            }
          } else {
            unmatchedCount++
          }
        } else {
          // For non-select types, use normal filling
          const success = await fieldFiller.fillField(field, value)
          if (success) {
            filledCount++
          } else {
            unmatchedCount++
          }
        }
      } else {
        unmatchedCount++
      }
    }
    
    for (const field of fieldsWithDefinitions) {
      const definition = findCustomFieldDefinition(field.label, field.type)
      if (definition) {
        const value = getCustomFieldValue(definition, field.options)
        if (value) {
          const isIndexBased = value.startsWith('#')
          const success = await fieldFiller.fillFieldWithAI(field, value, isIndexBased)
          if (success) {
            filledCount++
          } else {
            unmatchedCount++
          }
        } else {
          unmatchedCount++
        }
      }
    }
    
    let aiQuestionsHandled = 0
    
    if (fieldsNeedingAI.length > 0) {
      log('sending questions to AI', { count: fieldsNeedingAI.length })
      const aiQuestions: DomainQuestion[] = fieldsNeedingAI.map((field, index) => ({
        id: this.buildQuestionId(field, index),
        type: this.mapFieldTypeToQuestionType(field.type),
        label: field.label,
        required: field.isRequired,
        element: field.element,
        options: field.options
      }))
      
      log('ai questions', {
        questions: aiQuestions.map(q => ({
          id: q.id,
          label: q.label,
          type: q.type,
          options: q.options
        }))
      })
      
      const answers = await domainQuestionHandler.analyzeAndAnswerQuestions(aiQuestions, profile)
      log('AI answers received', { count: answers.size })
      
      for (const field of fieldsNeedingAI) {
        const questionId = field.element.id || field.element.name || ''
        const answer = answers.get(questionId)
        
        if (answer) {
          const isIndexBased = answer.startsWith('#') && (
            field.type === 'react-select' || 
            field.type === 'react-multi-select' || 
            field.type === 'checkbox'
          )
          
          const success = await fieldFiller.fillFieldWithAI(field, answer, isIndexBased)
          if (success) {
            filledCount++
            aiQuestionsHandled++
          } else {
            unmatchedCount++
          }
        } else {
          unmatchedCount++
        }
      }
    }
    
    log('complete', {
      filled: filledCount,
      total: fields.length,
      unmatched: unmatchedCount,
      aiQuestionsHandled
    })
    return {
      filledCount,
      totalFields: fields.length,
      unmatchedCount,
      aiQuestionsHandled
    }
  }
  
  private mapFieldTypeToQuestionType(fieldType: FieldType): DomainQuestion['type'] {
    switch (fieldType) {
      case 'textarea':
        return 'textarea'
      case 'select':
        return 'select'
      case 'react-select':
        return 'select'  // Map react-select to 'select' for AI handling
      case 'react-multi-select':
        return 'multi_value_single_select'
      case 'checkbox':
        return 'checkbox'
      default:
        return 'text'
    }
  }

  private buildQuestionId(field: FormField, index: number): string {
    return field.element.id || field.element.name || `question_${index}`
  }

  private async classifyFields(fields: FormField[], profile: Profile) {
    const fieldsWithKeys: FormField[] = []
    const fieldsWithDefinitions: FormField[] = []
    const fieldsNeedingAI: FormField[] = []

    for (const field of fields) {
      // For select/react-select/checkbox, check if we can fill them with existing keys
      if (field.type === 'select' || field.type === 'react-select' || field.type === 'react-multi-select' || field.type === 'checkbox') {
        // If has key, try to validate the value exists in options
        if (field.key) {
          const matcher = DOMAIN_FIELD_MATCHERS[field.key]
          if (matcher) {
            const value = matcher.getValue(profile)

            if (value && field.options && field.options.length > 0) {
              let valueExists = false
              let matchedIndex = -1

              // Check if value exists in options
              if (field.type === 'select' && field.element instanceof HTMLSelectElement) {
                valueExists = await fieldFiller.validateSelectValue(field.element, value)
                // Find the matching index
                if (valueExists) {
                  matchedIndex = await this.findSelectOptionIndex(field.element, value)
                }
              } else if (field.type === 'react-select' || field.type === 'react-multi-select') {
                valueExists = await fieldFiller.validateReactSelectValue(field.element as HTMLInputElement, value, field.options)
                // Find the matching index
                if (valueExists) {
                  matchedIndex = this.findReactSelectOptionIndex(field.options, value)
                }
              }

              if (valueExists && matchedIndex >= 0) {
                fieldsWithKeys.push(field)
                continue
              } else {
                fieldsNeedingAI.push(field)
                continue
              }
            }
          }
        }

        // No key or couldn't validate - send to AI
        fieldsNeedingAI.push(field)
        continue
      }

      // For other types, check key and definitions
      if (field.key) {
        fieldsWithKeys.push(field)
      } else {
        const definition = findCustomFieldDefinition(field.label, field.type)
        if (definition) {
          fieldsWithDefinitions.push(field)
        } else {
          fieldsNeedingAI.push(field)
        }
      }
    }

    return { fieldsWithKeys, fieldsWithDefinitions, fieldsNeedingAI }
  }
  
  private async findSelectOptionIndex(select: HTMLSelectElement, value: string): Promise<number> {
    const lowerValue = value.toLowerCase().trim()
    
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i]
      if (option.value === '' || option.disabled) continue
      
      const optionValue = option.value.toLowerCase().trim()
      const optionText = option.text.toLowerCase().trim()
      
      if (optionValue === lowerValue || optionText === lowerValue ||
          optionValue.includes(lowerValue) || optionText.includes(lowerValue)) {
        return i
      }
    }
    
    return -1
  }
  
  private findReactSelectOptionIndex(options: string[], value: string): number {
    const lowerValue = value.toLowerCase().trim()
    const normalizedValue = this.normalizeText(value)
    
    for (let i = 0; i < options.length; i++) {
      const option = options[i]
      const lowerOption = option.toLowerCase().trim()
      const normalizedOption = this.normalizeText(option)
      
      if (lowerOption === lowerValue || lowerOption.includes(lowerValue) ||
          normalizedOption.includes(normalizedValue)) {
        return i
      }
    }
    
    return -1
  }
  
  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '')
  }
}

export const customQuestionsHandler = new CustomQuestionsHandler()
