// ============================================================================
// Types & Interfaces for Autofill Engine
// ============================================================================

export interface FormField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  key: string | null
  label: string
  type: FieldType
  isRequired: boolean
  options?: string[]
}

export type FieldType = 'text' | 'textarea' | 'select' | 'react-select' | 'react-multi-select' | 'checkbox' | 'radio'

export interface FillResult {
  filledCount: number
  totalFields: number
  unmatchedCount: number
  aiQuestionsHandled?: number
}

export interface CategorizedFields {
  standard: FormField[]
  education: FormField[]
  custom: FormField[]
}
