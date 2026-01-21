// ============================================================================
// Field Filling Logic - Core filling methods for all field types
// ============================================================================

import { FormField,  } from './types'
import { GreenhouseInputSimulator } from "./GreenhouseInputSimulator";

export class FieldFiller {
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Validate if a value exists in standard select dropdown options
   */
  async validateSelectValue(select: HTMLSelectElement, value: string): Promise<boolean> {
    if (!value || !select) return false
    
    const lowerValue = value.toLowerCase().trim()
    
    // Check each option for a match
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i]
      if (option.value === '' || option.disabled) continue
      
      const optionValue = option.value.toLowerCase().trim()
      const optionText = option.text.toLowerCase().trim()
      
      // Exact match strategies
      if (optionValue === lowerValue || optionText === lowerValue) {
        return true
      }
      
      // Contains match
      if (optionValue.includes(lowerValue) || optionText.includes(lowerValue)) {
        return true
      }
      
      // Reverse contains
      if (lowerValue.includes(optionValue) || lowerValue.includes(optionText)) {
        return true
      }
    }
    
    return false
  }
  
  /**
   * Validate if a value exists in React-Select options
   */
  async validateReactSelectValue(_input: HTMLInputElement, value: string, options?: string[]): Promise<boolean> {
    if (!value || !options || options.length === 0) return false
    
    const lowerValue = value.toLowerCase().trim()
    const normalizedValue = this.normalizeSelectText(value)
    
    // Check each option for a match
    for (const option of options) {
      const lowerOption = option.toLowerCase().trim()
      const normalizedOption = this.normalizeSelectText(option)
      
      // Exact match
      if (lowerOption === lowerValue) {
        return true
      }
      
      // Contains match
      if (lowerOption.includes(lowerValue) || lowerValue.includes(lowerOption)) {
        return true
      }
      
      // Fuzzy match (normalized)
      if (normalizedOption.includes(normalizedValue) || normalizedValue.includes(normalizedOption)) {
        return true
      }
    }
    
    return false
  }
  
  private normalizeSelectText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  
  async fillField(field: FormField, value: string): Promise<boolean> {
    if (!value) {
      return false
    }
    
    try {
      switch (field.type) {
        case 'text':
        case 'textarea':
          return await this.fillTextInput(field.element as HTMLInputElement | HTMLTextAreaElement, value)
        
        case 'select':
          return await this.fillSelectDropdown(field.element as HTMLSelectElement, value)
        
        case 'react-select':
          return await this.fillReactSelect(field.element as HTMLInputElement, value, false, false)
        
        case 'react-multi-select':
          return await this.fillReactSelect(field.element as HTMLInputElement, value, true, false)
        
        case 'checkbox':
          return await this.fillCheckbox(field.element as HTMLInputElement, value, false)
        
        case 'radio':
          return await this.fillRadio(field.element as HTMLInputElement, value)
        
        default:
          return false
      }
    } catch (error) {
      return false
    }
  }
  
  async fillFieldWithAI(field: FormField, value: string, isIndexBased: boolean = false): Promise<boolean> {
    if (!value) {
      return false
    }
    
    try {
      switch (field.type) {
        case 'text':
        case 'textarea':
          return await this.fillTextInput(field.element as HTMLInputElement | HTMLTextAreaElement, value)
        
        case 'select':
          return await this.fillSelectDropdown(field.element as HTMLSelectElement, value)
        
        case 'react-select':
          return await this.fillReactSelect(field.element as HTMLInputElement, value, false, isIndexBased)
        
        case 'react-multi-select':
          return await this.fillReactSelect(field.element as HTMLInputElement, value, true, isIndexBased)
        
        case 'checkbox':
          return await this.fillCheckbox(field.element as HTMLInputElement, value, isIndexBased)
        
        case 'radio':
          return await this.fillRadio(field.element as HTMLInputElement, value)
        
        default:
          return false
      }
    } catch (error) {
      return false
    }
  }
  
  private async fillTextInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<boolean> {
    await GreenhouseInputSimulator.fillInput(element, value)
    return true
  }
  
  private async fillSelectDropdown(select: HTMLSelectElement, value: string): Promise<boolean> {
    if (!value) {
      return await this.selectFirstOption(select)
    }

    const success = await GreenhouseInputSimulator.fillSelect(select, value)
    
    if (!success) {
      return await this.selectFirstOption(select)
    }
    
    return success
  }
  
  async selectFirstOption(select: HTMLSelectElement): Promise<boolean> {
    if (select.options.length === 0) {
      return false
    }
    
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i]
      if (option.value !== '' && !option.disabled) {
        select.focus()
        select.selectedIndex = i
        
        const nativeSelectSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value'
        )?.set
        
        if (nativeSelectSetter) {
          nativeSelectSetter.call(select, option.value)
        }
        
        select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
        select.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
        select.blur()
        
        return true
      }
    }
    
    return false
  }
  
  private async fillReactSelect(input: HTMLInputElement, value: string, isMulti: boolean, isEnableIndexSelection: boolean = false): Promise<boolean> {
    if (isMulti) {
      const values = this.splitMultiSelectValues(value)
      let anySuccess = false
      
      for (const item of values) {
        const success = await GreenhouseInputSimulator.fillReactSelect(input, item, isEnableIndexSelection)
        anySuccess = anySuccess || success
      }
      
      return anySuccess
    }
    
    return await GreenhouseInputSimulator.fillReactSelect(input, value, isEnableIndexSelection)
  }
  
  private splitMultiSelectValues(value: string): string[] {
    const trimmed = value.trim()
    if (!trimmed) return []
    
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.map(item => String(item).trim()).filter(Boolean)
        }
      } catch {
        // Fall through
      }
    }
    
    return trimmed
      .split(/[;,\n]+/)
      .map(part => part.trim())
      .filter(Boolean)
  }
  
  private async fillCheckbox(element: HTMLInputElement, value: string, isIndexBased: boolean = false): Promise<boolean> {
    const fieldset = element.closest('fieldset')
    
    if (fieldset && isIndexBased) {
      const checkboxes = Array.from(fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      
      const indices = value.split(',').map(v => {
        const trimmed = v.trim()
        const match = trimmed.match(/^#?(\d+)$/)
        return match ? parseInt(match[1], 10) : null
      }).filter(idx => idx !== null && idx >= 0 && idx < checkboxes.length) as number[]
      
      if (indices.length > 0) {
        for (const idx of indices) {
          const checkbox = checkboxes[idx]
          if (checkbox && !checkbox.checked) {
            // Simulate full click interaction
            checkbox.focus()
            await this.wait(50)
            
            // Dispatch mousedown/mouseup before click
            checkbox.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
            checkbox.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
            
            // Click the element
            checkbox.click()
            
            // Dispatch change and input events
            checkbox.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
            checkbox.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
            
            await this.wait(100)
          }
        }
        return true
      } else {
        return false
      }
    }
    
    // Single checkbox (boolean)
    const shouldCheck = ['true', 'yes', '1', 'on'].includes(value.toLowerCase())
    
    if (element.checked !== shouldCheck) {
      element.focus()
      await this.wait(50)
      
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      element.click()
      element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
      
      await this.wait(100)
    }
    
    return true
  }
  
  private async fillRadio(element: HTMLInputElement, value: string): Promise<boolean> {
    const radioGroup = document.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${element.name}"]`
    )
    
    for (const radio of radioGroup) {
      const labelElement = document.querySelector(`label[for="${radio.id}"]`)
      const label = labelElement?.textContent?.trim() || ''
      if (label.toLowerCase().includes(value.toLowerCase())) {
        radio.click()
        await this.wait(100)
        return true
      }
    }
    
    return false
  }
}

export const fieldFiller = new FieldFiller()
