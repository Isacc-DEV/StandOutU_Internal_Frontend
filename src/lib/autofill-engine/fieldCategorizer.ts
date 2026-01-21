// ============================================================================
// Field Categorization - Organizing fields by type
// ============================================================================

import { FormField, CategorizedFields } from './types'

const log = (_message: string, _data?: Record<string, unknown>) => {}

export class FieldCategorizer {
  categorizeFields(fields: FormField[]): CategorizedFields {
    const standard: FormField[] = []
    const education: FormField[] = []
    const custom: FormField[] = []
    
    for (const field of fields) {
      if (this.isEducationField(field.element)) {
        log(`Education: "${field.label}"`)
        education.push(field)
      } else if (this.isCustomQuestion(field.element)) {
        log(`Custom: "${field.label}" (matched as custom question)`)
        custom.push(field)
      } else if (field.key) {
        log(`Standard: "${field.label}" (key: ${field.key})`)
        standard.push(field)
      } else {
        log(`Custom: "${field.label}" (no key match)`)
        custom.push(field)
      }
    }
    
    return { standard, education, custom }
  }
  
  private isEducationField(element: HTMLElement): boolean {
    const container = element.closest('.education--container, .education--form, [class*="education"]')
    const id = element.getAttribute('id') || ''
    const name = element.getAttribute('name') || ''
    
    return (
      container !== null ||
      /school|degree|major|discipline|gpa|field.*study/i.test(`${id} ${name}`)
    )
  }
  
  private isCustomQuestion(element: HTMLElement): boolean {
    const id = element.getAttribute('id') || ''
    const name = element.getAttribute('name') || ''
    const questionPattern = /questions?[_\[]/i
    
    return (
      questionPattern.test(id) ||
      questionPattern.test(name) ||
      element.closest('[data-test*="question"]') !== null
    )
  }
}

export const fieldCategorizer = new FieldCategorizer()
