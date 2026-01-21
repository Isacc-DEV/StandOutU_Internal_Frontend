// ============================================================================
// Field Collection - Extracting form fields from the DOM
// ============================================================================

import { FormField, FieldType } from './types'
import { matchDomainField } from './domainFieldMatchers'
import { GREENHOUSE_SELECTORS } from './config/domains/greenhouse/selectors.config'

export class FieldCollector {
  private readonly selectors = GREENHOUSE_SELECTORS

  private joinSelectors(selectors: string[]): string {
    return selectors.join(', ')
  }

  private matchesAnySelector(element: Element, selectors: string[]): boolean {
    return selectors.some((selector) => element.matches(selector))
  }

  private closestBySelectors(element: Element, selectors: string[]): Element | null {
    if (selectors.length === 0) {
      return null
    }
    return element.closest(this.joinSelectors(selectors))
  }

  private querySelectorByList(container: ParentNode, selectors: string[]): Element | null {
    if (selectors.length === 0) {
      return null
    }
    return container.querySelector(this.joinSelectors(selectors))
  }

  private async parseCheckboxGroup(fieldset: Element): Promise<FormField | null> {
    const checkboxes = fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    if (checkboxes.length === 0) return null
    
    const firstCheckbox = checkboxes[0]
    
    const legend = fieldset.querySelector('legend')
    const label = legend?.textContent ? this.cleanLabelText(legend.textContent) : this.extractFieldLabel(firstCheckbox)
    
    const options: string[] = []
    checkboxes.forEach(cb => {
      // Try finding label by 'for' attribute first
      let cbLabel = document.querySelector(`label[for="${cb.id}"]`)?.textContent?.trim()
      
      // If not found, try nextElementSibling
      if (!cbLabel) {
        cbLabel = cb.nextElementSibling?.textContent?.trim()
      }
      
      // If still not found, try parent's nextElementSibling (for wrapper structures)
      if (!cbLabel) {
        const wrapper = this.closestBySelectors(cb, this.selectors.fieldCollector.checkboxWrappers)
        if (wrapper) {
          cbLabel = wrapper.querySelector('label')?.textContent?.trim()
        }
      }
      
      if (cbLabel) {
        options.push(this.cleanLabelText(cbLabel))
      }
    })
    
    const key = this.generateFieldKey(firstCheckbox)
    
    this.log(`Parsed checkbox group - Label: "${label}", Options:`, options)
    
    return {
      element: firstCheckbox,
      key,
      label,
      type: 'checkbox',
      isRequired: this.isFieldRequired(firstCheckbox),
      options: options.length > 0 ? options : undefined
    }
  }
  
  private shouldSkipElement(element: HTMLElement): boolean {
    const skipPatterns = [
      /recaptcha/i,
      /g-recaptcha/i,
      /captcha/i,
      /hcaptcha/i,
      /cf-turnstile/i
    ]
    
    const elementString = [
      element.id,
      element.className,
      element.getAttribute('name') || '',
      element.getAttribute('data-test') || ''
    ].join(' ')
    
    return skipPatterns.some(pattern => pattern.test(elementString))
  }
  
  private async parseFormField(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): Promise<FormField | null> {
    const label = this.extractFieldLabel(element)
    const type = this.determineFieldType(element)
    const key = this.generateFieldKey(element)
    
    if (!type) {
      this.warn(`Could not determine type for element:`, element.id || element.name, element.tagName)
      return null
    }
    
    const options = await this.extractFieldOptions(element, type)
    
    return {
      element,
      key,
      label,
      type,
      isRequired: this.isFieldRequired(element),
      options
    }
  }
  
  private extractFieldLabel(element: HTMLElement): string {
    const id = element.getAttribute('id')
    if (id) {
      const labelElement = document.querySelector(`label[for="${id}"]`)
      if (labelElement?.textContent) {
        return this.cleanLabelText(labelElement.textContent)
      }
    }
    
    const ariaLabel = element.getAttribute('aria-label')
    if (ariaLabel) {
      return this.cleanLabelText(ariaLabel)
    }
    
    const container = this.closestBySelectors(element, this.selectors.fieldCollector.labelContainers)
    if (container) {
      const label = this.querySelectorByList(container, this.selectors.fieldCollector.labelElements)
      if (label?.textContent) {
        return this.cleanLabelText(label.textContent)
      }
    }
    
    const placeholder = element.getAttribute('placeholder')
    if (placeholder) {
      return this.cleanLabelText(placeholder)
    }
    
    return this.cleanLabelText(element.getAttribute('name') || 'Unknown Field')
  }
  
  private cleanLabelText(text: string): string {
    return text
      .trim()
      .replace(/\*/g, '')
      .replace(/[:;]$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  private generateFieldKey(element: HTMLElement): string | null {
    return matchDomainField(element)
  }
  
  private determineFieldType(element: HTMLElement): FieldType | null {
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea'
    }
    
    if (element instanceof HTMLSelectElement) {
      return 'select'
    }
    
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox') {
        return 'checkbox'
      }
      if (element.type === 'radio') {
        return 'radio'
      }
      
      if (this.isReactSelectInput(element)) {
        return this.isMultiSelectInput(element) ? 'react-multi-select' : 'react-select'
      }
      
      return 'text'
    }
    
    return null
  }
  
  private isReactSelectInput(element: HTMLElement): element is HTMLInputElement {
    return element instanceof HTMLInputElement && this.matchesAnySelector(element, this.selectors.reactSelect.input)
  }
  
  private isMultiSelectInput(element: HTMLElement): boolean {
    const id = element.getAttribute('id') || ''
    return (
      id.includes('[]') ||
      element.getAttribute('aria-multiselectable') === 'true' ||
      this.closestBySelectors(element, this.selectors.reactSelect.multiValueContainer) !== null
    )
  }
  
  private isFieldRequired(element: HTMLElement): boolean {
    const container = this.closestBySelectors(element, this.selectors.fieldCollector.labelContainers)
    const requiredSelector = this.selectors.fieldCollector.requiredIndicators
    const hasRequiredIndicator = Boolean(
      container &&
      requiredSelector.length > 0 &&
      container.querySelector(this.joinSelectors(requiredSelector))
    )
    return (
      element.hasAttribute('required') ||
      element.getAttribute('aria-required') === 'true' ||
      hasRequiredIndicator
    )
  }
  
  private async extractFieldOptions(element: HTMLElement, type: FieldType): Promise<string[] | undefined> {
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.options)
        .map(opt => opt.text.trim())
        .filter(text => text.length > 0)
    }
    
    if (type === 'react-select' || type === 'react-multi-select') {
      return await this.extractReactSelectOptions(element as HTMLInputElement)
    }
    
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      const fieldset = element.closest('fieldset')
      if (fieldset) {
        const checkboxes = fieldset.querySelectorAll('input[type="checkbox"]')
        const options: string[] = []
        checkboxes.forEach(cb => {
          // Try finding label by 'for' attribute first
          let label = document.querySelector(`label[for="${cb.id}"]`)?.textContent?.trim()
          
          // If not found, try nextElementSibling
          if (!label) {
            label = cb.nextElementSibling?.textContent?.trim()
          }
          
          // If still not found, try parent's nextElementSibling (for wrapper structures)
          if (!label) {
            const wrapper = this.closestBySelectors(cb, this.selectors.fieldCollector.checkboxWrappers)
            if (wrapper) {
              label = wrapper.querySelector('label')?.textContent?.trim()
            }
          }
          
          if (label) {
            options.push(this.cleanLabelText(label))
          }
        })
        this.log(`Extracted ${options.length} checkbox options:`, options)
        return options.length > 0 ? options : undefined
      }
    }
    
    return undefined
  }
  
  private async extractReactSelectOptions(input: HTMLInputElement): Promise<string[] | undefined> {
    try {
      this.log('extractReactSelectOptions: Starting', { id: input.id })
      
      const selectControl = this.closestBySelectors(input, this.selectors.reactSelect.control) as HTMLElement | null
      
      const elementsToTry: HTMLElement[] = []
      
      if (selectControl) {
        elementsToTry.push(selectControl)
        this.log('extractReactSelectOptions: Found select__control')
        
        if (selectControl.parentElement) {
          elementsToTry.push(selectControl.parentElement)
        }
      } else {
        this.log('extractReactSelectOptions: select__control not found, using input')
        elementsToTry.push(input)
        if (input.parentElement) {
          elementsToTry.push(input.parentElement)
        }
      }
      
      if (elementsToTry.length === 0) {
        this.warn('extractReactSelectOptions: No elements to click')
        return undefined
      }
      
      let menu: Element | null = null
      
      for (let i = 0; i < elementsToTry.length; i++) {
        const elementToClick = elementsToTry[i]
        this.log(`extractReactSelectOptions: Clicking attempt ${i + 1}/${elementsToTry.length}`)
        
        input.focus()
        
        elementToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        elementToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
        elementToClick.click()
        await this.wait(50)
        
        for (let attempt = 0; attempt < 10; attempt++) {
          menu = this.findReactSelectMenu(input)
          if (menu) {
            this.log(`extractReactSelectOptions: Menu found after attempt ${attempt + 1}`)
            break
          }
          await this.wait(100)
        }
        
        if (menu) {
          break
        }
      }
      
      if (!menu) {
        this.warn('extractReactSelectOptions: Menu not found after all attempts')
        return undefined
      }
      
      if (this.selectors.reactSelect.option.length === 0) {
        this.warn('extractReactSelectOptions: No option selectors configured')
        return undefined
      }

      const optionSelector = this.joinSelectors(this.selectors.reactSelect.option)
      const optionElements = menu.querySelectorAll(optionSelector)
      const options = Array.from(optionElements)
        .filter(opt => this.isVisible(opt))
        .map(opt => opt.textContent?.trim() || '')
        .filter(text => text.length > 0)
      
      input.blur()
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      input.dispatchEvent(escEvent)
      await this.wait(100)
      
      this.log(`extractReactSelectOptions: Extracted ${options.length} options:`, options)
      return options.length > 0 ? options : undefined
      
    } catch (error) {
      this.warn('extractReactSelectOptions: Error:', error)
      try {
        input.blur()
        document.body.click()
      } catch {}
      return undefined
    }
  }
  
  private findReactSelectMenu(input: HTMLInputElement): Element | null {
    const container = this.closestBySelectors(input, this.selectors.reactSelect.container)
    if (!container) {
      return null
    }
    
    for (const selector of this.selectors.reactSelect.menuList) {
      const menu = container.querySelector(selector)
      if (menu && this.isVisible(menu)) {
        return menu
      }
    }
    
    return null
  }
  
  private isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element)
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      (element as HTMLElement).offsetParent !== null
    )
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  private log(_message: string, ..._args: any[]) {}
  
  private warn(_message: string, ..._args: any[]) {}
  
  async collectAllFormFields(): Promise<FormField[]> {
    const selector = this.joinSelectors(this.selectors.fieldCollector.formFields)
    
    const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
    this.log(`Found ${elements.length} form elements matching selector`)
    
    const fields: FormField[] = []
    const processedFieldsets = new Set<Element>()
    
    for (const element of elements) {
      if (this.shouldSkipElement(element)) {
        this.log(`Skipping element (captcha/hidden):`, element.id || element.name)
        continue
      }
      
      // For checkboxes, group them by fieldset
      if (element instanceof HTMLInputElement && element.type === 'checkbox') {
        const fieldset = element.closest('fieldset')
        if (fieldset && !processedFieldsets.has(fieldset)) {
          processedFieldsets.add(fieldset)
          const field = await this.parseCheckboxGroup(fieldset)
          if (field) {
            fields.push(field)
          }
          continue
        } else if (!fieldset) {
          const field = await this.parseFormField(element)
          if (field) {
            fields.push(field)
          }
        }
        continue
      }
      
      const field = await this.parseFormField(element)
      if (field) {
        this.log(`Collected field: "${field.label}" (type: ${field.type}, key: ${field.key})`)
        fields.push(field)
      } else {
        this.log(`Failed to parse field:`, element.id || element.name, element.type)
      }
    }
    
    this.log(`Total fields collected: ${fields.length}`)
    return fields
  }
}

export const fieldCollector = new FieldCollector()
