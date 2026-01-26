// ============================================================================
// Domain Engine - Main autofill orchestrator
// ============================================================================

import { Profile } from "./profile";
import { FillResult, FormField, EngineMode } from './types'
import { AIQuestionResponse, DomainAiQuestionPayload, domainQuestionHandler } from './domainQuestionHandler'
import { fieldCollector } from './fieldCollector'
import { fieldCategorizer } from './fieldCategorizer'
import { standardFieldsHandler } from './standardFieldsHandler'
import { educationFieldsHandler } from './educationFieldsHandler'
import { customQuestionsHandler } from './customQuestionsHandler'
import { getDomainFieldMatchers } from './domainFieldMatchers'
import { fieldFiller } from './fieldFiller'
import { DomainInputSimulator } from './domainInputSimulator'
import { logWithData } from './utils/funcs'

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

  setAIAnswerDebug(debug: { prompt?: string; rawResponse?: string } | null) {
    domainQuestionHandler.setAnswerDebug(debug)
  }

  async collectAIQuestions(): Promise<DomainAiQuestionPayload[]> {
    if (!this.profile) {
      return []
    }

    const engineMode = await this.decideEngineMode(undefined)
    await fieldCollector.setEngineMode(engineMode)
    DomainInputSimulator.setEngineMode(engineMode)

    const allFields = await fieldCollector.collectAllFormFields()
    const categorizedFields = fieldCategorizer.categorizeFields(allFields)
    const unmatchedStandardFields = await this.getUnmatchedStandardFields(
      categorizedFields.standard,
      this.profile,
      engineMode
    )
    const allCustomFields = [...categorizedFields.custom, ...unmatchedStandardFields]
    const aiQuestions = await customQuestionsHandler.collectAIQuestions(
      allCustomFields,
      this.profile,
      engineMode
    )
    logWithData('[DomainEngine] AI question payload', {
      count: aiQuestions.length,
      labels: aiQuestions.map((question) => question.label)
    })
    return aiQuestions
  }

  async decideEngineMode(manualEngineMode: EngineMode | undefined): Promise<EngineMode> {
    if (!manualEngineMode && manualEngineMode !== "common" && manualEngineMode !== undefined) {
      return manualEngineMode
    }


    const url = window.location.href.toLowerCase()

    switch (true) {
      case url.includes("greenhouse.io"):
        return "greenhouse"
      case url.includes("myworkdayjobs.com"):
        return "workday"
      default:
        return "common"
    }
  }
  
  async autofillDomainPage(manualEngineMode: "greenhouse" | "workday" | "common" | undefined): Promise<FillResult & { aiQuestionsHandled: number }> {
    if (!this.profile) {
      logWithData('start: missing profile')
      return { filledCount: 0, totalFields: 0, unmatchedCount: 0, aiQuestionsHandled: 0 }
    }

    const engineMode = await this.decideEngineMode(manualEngineMode)
    logWithData('[DomainEngine] Engine mode:', { engineMode })


    await fieldCollector.setEngineMode(engineMode)
    
    DomainInputSimulator.setEngineMode(engineMode)
    const allFields = await fieldCollector.collectAllFormFields()
    logWithData('field collection complete', { totalFields: allFields.length })
    const categorizedFields = fieldCategorizer.categorizeFields(allFields)
    logWithData('field categorization complete', {
      categorizedFields
    })
    
    // Fill standard fields and track unmatched ones
    const standardResult = await standardFieldsHandler.fillStandardFields(
      categorizedFields.standard,
      this.profile,
      engineMode
    )
    logWithData('standard fields filled', {
      filled: standardResult.filledCount,
      total: standardResult.totalFields,
      unmatched: standardResult.unmatchedCount
    })
    
    // Identify unmatched standard fields that should be sent to custom questions
    const unmatchedStandardFields = await this.getUnmatchedStandardFields(
      categorizedFields.standard,
      this.profile,
      engineMode
    )
    logWithData('unmatched standard fields', { count: unmatchedStandardFields.length })
    
    // Add unmatched standard fields to custom questions
    const allCustomFields = [...categorizedFields.custom, ...unmatchedStandardFields]
    
    // Fill education and custom fields
    const educationResult = await educationFieldsHandler.fillEducationFields(categorizedFields.education, this.profile)
    logWithData('education fields filled', {
      filled: educationResult.filledCount,
      total: educationResult.totalFields,
      unmatched: educationResult.unmatchedCount
    })
    const customResult = await customQuestionsHandler.fillCustomQuestions(
      allCustomFields,
      this.profile,
      engineMode
    )
    logWithData('custom fields filled', {
      filled: customResult.filledCount,
      total: customResult.totalFields,
      unmatched: customResult.unmatchedCount,
      aiQuestionsHandled: customResult.aiQuestionsHandled || 0
    })
    
    const totalResult = this.calculateTotals([standardResult, educationResult, customResult])
    logWithData('greenhouse autofill complete', {
      filled: totalResult.filledCount,
      total: totalResult.totalFields,
      unmatched: totalResult.unmatchedCount
    })
    
    return {
      ...totalResult,
      aiQuestionsHandled: customResult.aiQuestionsHandled || 0
    }
  }
  
  private async getUnmatchedStandardFields(
    standardFields: FormField[],
    profile: Profile,
    engineMode: "greenhouse" | "workday" | "common"
  ): Promise<FormField[]> {
    const unmatched: FormField[] = []
    const matchers = getDomainFieldMatchers(engineMode)
    
    for (const field of standardFields) {
      if (!field.key) continue
      
      const matcher = matchers[field.key]
      if (!matcher) continue
      
      const value = matcher.getValue(profile)
      
      const isSingleSelect = field.type === 'select' || field.type === 'react-select'
      const isMultiSelect = field.type === 'react-multi-select'

      // Check if select-like field has value that doesn't exist in options
      if (isSingleSelect || isMultiSelect) {
        if (value) {
          let valueExists = true
          if (field.element instanceof HTMLSelectElement) {
            valueExists = await fieldFiller.validateSelectValue(field.element, value)
          } else if (field.options && field.options.length > 0) {
            valueExists = await fieldFiller.validateReactSelectValue(field.element as HTMLInputElement, value, field.options)
          }

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
