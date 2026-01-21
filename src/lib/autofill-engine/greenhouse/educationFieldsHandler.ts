// ============================================================================
// Education Fields Handler - Filling education-related fields
// ============================================================================

import { FormField, FillResult } from './types'
import { Profile } from "../profile";
import { fieldFiller } from './fieldFiller'

const log = (_message: string, _data?: Record<string, unknown>) => {}

export class EducationFieldsHandler {
  async fillEducationFields(fields: FormField[], profile: Profile): Promise<FillResult> {
    const education = profile.education?.[0]
    if (!education) {
      log('skipping: no education data', { totalFields: fields.length })
      return { filledCount: 0, totalFields: fields.length, unmatchedCount: fields.length }
    }
    
    let filledCount = 0
    let unmatchedCount = 0
    
    for (const field of fields) {
      const value = this.getEducationValue(field, education)
      
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
  
  private getEducationValue(field: FormField, education: any): string | null {
    const labelLower = field.label.toLowerCase()
    const id = field.element.getAttribute('id')?.toLowerCase() || ''
    const name = field.element.getAttribute('name')?.toLowerCase() || ''
    const combined = `${labelLower} ${id} ${name}`
    
    if (/school|university|college|institution/i.test(combined)) {
      return education.school || null
    }
    if (/degree/i.test(combined)) {
      return education.degree || null
    }
    if (/major|field|discipline/i.test(combined)) {
      return education.major || null
    }
    if (/gpa/i.test(combined)) {
      return education.gpa ? String(education.gpa) : null
    }
    
    return null
  }
}

export const educationFieldsHandler = new EducationFieldsHandler()
