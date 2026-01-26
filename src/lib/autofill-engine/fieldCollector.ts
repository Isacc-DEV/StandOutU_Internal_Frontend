// ============================================================================
// Field Collection - Extracting form fields from the DOM
// ============================================================================

import { FormField, FieldType } from './types'
import { matchDomainField, getDomainFieldMatchers } from './domainFieldMatchers'
import { findCustomFieldDefinition } from './customFieldDefinitions'
import { GREENHOUSE_SELECTORS } from './config/domains/greenhouse/selectors.config'
import { COMMON_SELECTORS } from './config/domains/common/selectors.config'
import { WORKDAY_SELECTORS } from './config/domains/workday/selectors.config'
import type { DomainAutofillSelectors } from './config/types'
import { EngineMode } from './types'
import { logWithData } from './utils/funcs'

export class FieldCollector {
  private engineMode: EngineMode
  private selectors: DomainAutofillSelectors = GREENHOUSE_SELECTORS

  constructor(engineMode: EngineMode) {
    this.engineMode = engineMode
  }

  public setEngineMode(engineMode: EngineMode): void {
    this.engineMode = engineMode
    this.selectors =
      engineMode === 'greenhouse'
        ? GREENHOUSE_SELECTORS
        : engineMode === 'workday'
          ? WORKDAY_SELECTORS
          : COMMON_SELECTORS
  }

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

  private getCheckboxGroupContainer(element: HTMLInputElement): Element | null {
    const selectors = this.selectors.fieldCollector.checkboxGroupContainers ?? []
    if (selectors.length > 0) {
      const container = this.closestBySelectors(element, selectors)
      if (container) {
        return container
      }
    }

    return element.closest('fieldset')
  }

  private getRadioGroupContainer(element: HTMLInputElement): Element | null {
    const selectors =
      this.selectors.fieldCollector.radioGroupContainers ??
      this.selectors.fieldCollector.checkboxGroupContainers ??
      []
    if (selectors.length > 0) {
      const container = this.closestBySelectors(element, selectors)
      if (container) {
        return container
      }
    }

    return element.closest('fieldset') || element.closest('[role="group"]')
  }

  private extractCheckboxOptionLabel(checkbox: HTMLInputElement): string | null {
    const byFor = checkbox.id
      ? document.querySelector(`label[for="${checkbox.id}"]`)?.textContent?.trim()
      : null
    if (byFor) {
      return this.cleanLabelText(byFor)
    }

    const siblingText = checkbox.nextElementSibling?.textContent?.trim()
    if (siblingText) {
      return this.cleanLabelText(siblingText)
    }

    const wrapper = this.closestBySelectors(checkbox, this.selectors.fieldCollector.checkboxWrappers)
    const optionSelectors = this.selectors.fieldCollector.checkboxOptionLabelSelectors ?? []
    if (wrapper) {
      if (optionSelectors.length > 0) {
        const optionLabel = wrapper.querySelector(this.joinSelectors(optionSelectors))?.textContent?.trim()
        if (optionLabel) {
          return this.cleanLabelText(optionLabel)
        }
      }
      const label = wrapper.querySelector('label')?.textContent?.trim()
      if (label) {
        return this.cleanLabelText(label)
      }
    }

    return null
  }

  private extractCheckboxGroupLabel(container: Element, checkboxes: HTMLInputElement[]): string {
    const ariaLabel = container.getAttribute('aria-label')
    if (ariaLabel) {
      return this.cleanLabelText(ariaLabel)
    }

    const ariaLabelledBy = container.getAttribute('aria-labelledby')
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy)
      if (labelElement?.textContent) {
        return this.cleanLabelText(labelElement.textContent)
      }
    }

    const legend = container.querySelector('legend')
    if (legend?.textContent) {
      return this.cleanLabelText(legend.textContent)
    }

    if (this.selectors.fieldCollector.labelElements.length > 0) {
      const labels = Array.from(
        container.querySelectorAll<HTMLElement>(this.joinSelectors(this.selectors.fieldCollector.labelElements))
      )
      const checkboxIds = new Set(checkboxes.map((checkbox) => checkbox.id))
      for (const label of labels) {
        if (label instanceof HTMLLabelElement && label.htmlFor && checkboxIds.has(label.htmlFor)) {
          continue
        }
        const text = label.textContent?.trim()
        if (text) {
          return this.cleanLabelText(text)
        }
      }
    }

    const { label } = this.generateFieldKey(checkboxes[0])
    return this.cleanLabelText(label || checkboxes[0].getAttribute('name') || 'Unknown Field')
  }

  private extractRadioGroupLabel(container: Element, radios: HTMLInputElement[]): string {
    const ariaLabel = container.getAttribute('aria-label')
    if (ariaLabel) {
      return this.cleanLabelText(ariaLabel)
    }

    const ariaLabelledBy = container.getAttribute('aria-labelledby')
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy)
      if (labelElement?.textContent) {
        return this.cleanLabelText(labelElement.textContent)
      }
    }

    const legend = container.querySelector('legend')
    if (legend?.textContent) {
      return this.cleanLabelText(legend.textContent)
    }

    if (this.selectors.fieldCollector.labelElements.length > 0) {
      const labels = Array.from(
        container.querySelectorAll<HTMLElement>(this.joinSelectors(this.selectors.fieldCollector.labelElements))
      )
      const radioIds = new Set(radios.map((radio) => radio.id))
      for (const label of labels) {
        if (label instanceof HTMLLabelElement && label.htmlFor && radioIds.has(label.htmlFor)) {
          continue
        }
        const text = label.textContent?.trim()
        if (text) {
          return this.cleanLabelText(text)
        }
      }
    }

    const { label } = this.generateFieldKey(radios[0])
    return this.cleanLabelText(label || radios[0].getAttribute('name') || 'Unknown Field')
  }

  private async parseCheckboxGroup(container: Element, checkboxes: HTMLInputElement[]): Promise<FormField | null> {
    if (checkboxes.length === 0) return null

    const firstCheckbox = checkboxes[0]
    const label = this.extractCheckboxGroupLabel(container, checkboxes)
    const options = checkboxes
      .map((checkbox) => this.extractCheckboxOptionLabel(checkbox))
      .filter((option): option is string => Boolean(option))

    const { key } = this.generateFieldKey(firstCheckbox)

    logWithData(`Parsed checkbox group - Label: "${label}", Options:`, options)

    return {
      element: firstCheckbox,
      key,
      label,
      type: 'checkbox',
      isRequired: this.isFieldRequired(firstCheckbox),
      options: options.length > 0 ? options : undefined
    }
  }

  private async parseRadioGroup(container: Element, radios: HTMLInputElement[]): Promise<FormField | null> {
    if (radios.length === 0) return null

    const firstRadio = radios[0]
    const label = this.extractRadioGroupLabel(container, radios)
    const options = radios
      .map((radio) => this.extractRadioOptionLabel(radio))
      .filter((option): option is string => Boolean(option))

    const { key } = this.generateFieldKey(firstRadio)

    logWithData(`Parsed radio group - Label: "${label}", Options:`, options)

    return {
      element: firstRadio,
      key,
      label,
      type: 'radio',
      isRequired: this.isFieldRequired(firstRadio),
      options: options.length > 0 ? options : undefined
    }
  }
  
  private shouldSkipElement(element: HTMLElement): boolean {
    if (!this.isVisibleElement(element)) {
      return true
    }
    
    const skipPatterns = [
      /recaptcha/i,
      /g-recaptcha/i,
      /captcha/i,
      /hcaptcha/i,
      /cf-turnstile/i
    ]
    
    const ariaLabel = element.getAttribute('aria-label') || ''
    const ariaLabelledBy = element.getAttribute('aria-labelledby')
    const ariaLabelledByText = ariaLabelledBy
      ? document.getElementById(ariaLabelledBy)?.textContent || ''
      : ''
    const ariaDescribedBy = element.getAttribute('aria-describedby')
    const ariaDescribedByText = ariaDescribedBy
      ? document.getElementById(ariaDescribedBy)?.textContent || ''
      : ''

    const elementString = [
      element.id,
      element.className,
      element.getAttribute('name') || '',
      element.getAttribute('data-test') || ''
    ].join(' ')

    if ((element.getAttribute('id') || '') === 'settingsSelectorButton') {
      return true
    }

    const labelString = [ariaLabel, ariaLabelledByText, ariaDescribedByText].join(' ')
    const looksLikeStepIndicator = /current step|step\s*\d+\s*of\s*\d+/i.test(labelString)
    const isUnnamed = !element.getAttribute('name') && !element.getAttribute('id')
    if (looksLikeStepIndicator && isUnnamed) {
      return true
    }

    if (
      element.closest('[data-automation-id="progressBar"]') ||
      element.closest('[data-automation-id^="progressBar"]') ||
      element.closest('[aria-label="Application Progress"]')
    ) {
      return true
    }

    
    return skipPatterns.some(pattern => pattern.test(elementString))
  }
  
  private async parseFormField(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
  ): Promise<FormField | null> {
    const type = this.determineFieldType(element)
    const { key, label } = this.generateFieldKey(element)

    const looksLikeStepIndicator = /current step|step\s*\d+\s*of\s*\d+/i.test(label)
    if (looksLikeStepIndicator) {
      this.warn('Skipping step indicator field', {
        id: element.getAttribute('id'),
        name: element.getAttribute('name'),
        label
      })
      return null
    }
    
    if (!type) {
      this.warn(
        `Could not determine type for element:`,
        element.getAttribute('id') || element.getAttribute('name') || element.tagName
      )
      return null
    }
    
    const options = await this.extractFieldOptions(element, type)
    if ((type === 'select' || type === 'react-multi-select') && (!options || options.length === 0)) {
      this.warn('Skipping select-like field with no options', {
        id: element.getAttribute('id'),
        name: element.getAttribute('name'),
        label,
        tag: element.tagName
      })
      return null
    }
    
    return {
      element,
      key,
      label,
      type,
      isRequired: this.isFieldRequired(element),
      options
    }
  }
  
  private cleanLabelText(text: string): string {
    return text
      .trim()
      .replace(/\*/g, '')
      .replace(/[:;]$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private isVisibleElement(element: HTMLElement): boolean {
    return element.style.display !== 'none' && element.style.visibility !== 'hidden' && element.style.opacity !== '0' && element.offsetParent !== null
  }

  private generateFieldKey(element: HTMLElement): { key: string, label: string } {
    return matchDomainField(element, this.engineMode)
  }
  
  private determineFieldType(element: HTMLElement): FieldType | null {
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea'
    }
    
    if (element instanceof HTMLSelectElement) {
      return 'select'
    }

    if (this.isSelectButton(element)) {
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
        return this.isMultiSelectInput(element) ? 'react-multi-select' : 'select'
      }
      
      return 'text'
    }
    
    return null
  }
  
  private isReactSelectInput(element: HTMLElement): element is HTMLInputElement {
    return element instanceof HTMLInputElement && this.matchesAnySelector(element, this.selectors.reactSelect.input)
  }

  private isSelectButton(element: HTMLElement): element is HTMLButtonElement {
    if (!(element instanceof HTMLButtonElement)) {
      return false
    }
    const ariaHasPopup = element.getAttribute('aria-haspopup')
    if (ariaHasPopup && ariaHasPopup.toLowerCase() === 'listbox') {
      return true
    }
    if (element.getAttribute('role') === 'combobox') {
      return true
    }
    return this.matchesAnySelector(element, this.selectors.reactSelect.control)
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
    
    if ((type === 'select' || type === 'react-multi-select') && (this.isReactSelectInput(element) || this.isSelectButton(element))) {
      return await this.extractSelectOptionsFromTrigger(element as HTMLElement)
    }
    
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      const container = this.getCheckboxGroupContainer(element) ?? element.closest('fieldset')
      if (container) {
        const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
        const options = checkboxes
          .map((checkbox) => this.extractCheckboxOptionLabel(checkbox))
          .filter((option): option is string => Boolean(option))
        logWithData(`Extracted ${options.length} checkbox options:`, options)
        return options.length > 0 ? options : undefined
      }
    }
    
    return undefined
  }
  
  private async extractSelectOptionsFromTrigger(trigger: HTMLElement): Promise<string[] | undefined> {
    try {
      logWithData('extractSelectOptionsFromTrigger: Starting', { id: trigger.getAttribute('id') })
      
      const selectControl = this.closestBySelectors(trigger, this.selectors.reactSelect.control) as HTMLElement | null
      const selectContainer = this.closestBySelectors(trigger, this.selectors.reactSelect.container) as HTMLElement | null
      const input =
        selectContainer?.querySelector<HTMLInputElement>(this.joinSelectors(this.selectors.reactSelect.input)) ?? null
      
      const elementsToTry: HTMLElement[] = []
      const pushUnique = (el: HTMLElement | null) => {
        if (!el) return
        if (!elementsToTry.includes(el)) {
          elementsToTry.push(el)
        }
      }
      
      if (selectControl) {
        pushUnique(selectControl)
        logWithData('extractSelectOptionsFromTrigger: Found select control')
      }
      
      if (selectContainer) {
        pushUnique(selectContainer)
        logWithData('extractSelectOptionsFromTrigger: Found select container')
      }
      
      pushUnique(trigger)
      let currentElement: HTMLElement | null = trigger.parentElement
      for (let i = 0; i < 3 && currentElement; i += 1) {
        pushUnique(currentElement)
        currentElement = currentElement.parentElement
      }
      
      if (elementsToTry.length === 0) {
        this.warn('extractSelectOptionsFromTrigger: No elements to click')
        return undefined
      }
      
      let menu: Element | null = null
      let options: string[] = []
      const waitSteps = [50, 100, 200, 200, 200]
      
      for (let i = 0; i < elementsToTry.length; i++) {
        const elementToClick = elementsToTry[i]
        logWithData(`extractSelectOptionsFromTrigger: Clicking attempt ${i + 1}/${elementsToTry.length}`)
        
        if (input) {
          input.focus()
        } else {
          trigger.focus()
        }
        
        elementToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        elementToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
        elementToClick.click()
        await this.wait(50)
        
        for (let attempt = 0; attempt < waitSteps.length; attempt++) {
          await this.wait(waitSteps[attempt])
          menu = this.findReactSelectMenu(trigger)
          if (!menu) {
            continue
          }
          const optionSelector = this.joinSelectors(this.selectors.reactSelect.option)
          const optionElements = menu.querySelectorAll(optionSelector)
          const seen = new Set<string>()
          const collected: string[] = []
          const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim()
          const getOptionText = (option: Element): string => {
            const prompt = option.querySelector('[data-automation-id="promptOption"]')
            const text =
              prompt?.textContent?.trim() ||
              option.getAttribute('data-automation-label')?.trim() ||
              option.getAttribute('aria-label')?.trim() ||
              option.textContent?.trim() ||
              ''
            return text
          }

          Array.from(optionElements)
            .filter((opt) => this.isVisible(opt))
            .forEach((opt) => {
              const menuItem = opt.closest('[data-automation-id="menuItem"]')
              const target = menuItem ?? opt
              const text = getOptionText(target)
              const normalized = normalizeText(text)
              if (!normalized || seen.has(normalized)) {
                return
              }
              seen.add(normalized)
              collected.push(text)
            })

          if (collected.length > 0) {
            options = collected
            logWithData(`extractSelectOptionsFromTrigger: Menu found after attempt ${attempt + 1}`)
            break
          }
        }
        
        if (menu && options.length > 0) {
          break
        }
      }
      
      if (!menu || options.length === 0) {
        this.warn('extractSelectOptionsFromTrigger: Menu not found after all attempts')
        return undefined
      }
      
      if (trigger instanceof HTMLElement) {
        trigger.blur()
      }
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      trigger.dispatchEvent(escEvent)
      await this.wait(100)
      
      logWithData(`extractSelectOptionsFromTrigger: Extracted ${options.length} options:`, options)
      return options.length > 0 ? options : undefined
      
    } catch (error) {
      this.warn('extractSelectOptionsFromTrigger: Error:', error)
      try {
        trigger.blur()
        document.body.click()
      } catch {}
      return undefined
    }
  }
  
  private findReactSelectMenu(anchor: HTMLElement): Element | null {
    const container = this.closestBySelectors(anchor, this.selectors.reactSelect.container)
    if (!container) {
      return this.findGenericListbox(anchor)
    }
    
    for (const selector of this.selectors.reactSelect.menuList) {
      const menu = container.querySelector(selector)
      if (menu && this.isVisible(menu) && this.isMenuListCandidate(menu)) {
        return menu
      }
    }
    
    return this.findGenericListbox(anchor)
  }

  private findListboxByAria(element: Element): Element | null {
    const controls =
      element.getAttribute('aria-controls') || element.getAttribute('aria-owns') || ''
    const ids = controls.split(/\s+/).filter(Boolean)
    if (!ids.length) return null
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el && this.isVisible(el)) {
        return el
      }
    }
    return null
  }

  private extractRadioOptionLabel(radio: HTMLInputElement): string | null {
    const byFor = radio.id
      ? document.querySelector(`label[for="${radio.id}"]`)?.textContent?.trim()
      : null
    if (byFor) {
      return this.cleanLabelText(byFor)
    }

    const siblingText = radio.nextElementSibling?.textContent?.trim()
    if (siblingText) {
      return this.cleanLabelText(siblingText)
    }

    const wrapper = radio.parentElement
    const optionSelectors =
      this.selectors.fieldCollector.radioOptionLabelSelectors ??
      this.selectors.fieldCollector.checkboxOptionLabelSelectors ??
      []
    if (wrapper) {
      if (optionSelectors.length > 0) {
        const optionLabel = wrapper.querySelector(this.joinSelectors(optionSelectors))?.textContent?.trim()
        if (optionLabel) {
          return this.cleanLabelText(optionLabel)
        }
      }
      const label = wrapper.querySelector('label')?.textContent?.trim()
      if (label) {
        return this.cleanLabelText(label)
      }
    }

    return null
  }

  private findGenericListbox(anchor: HTMLElement): Element | null {
    const direct = this.findListboxByAria(anchor)
    if (direct) return direct

    const combo = anchor.closest('[role="combobox"]')
    if (combo) {
      const fromCombo = this.findListboxByAria(combo)
      if (fromCombo) return fromCombo
    }

    const selector = this.joinSelectors(this.selectors.reactSelect.menuList)
    const candidates = Array.from(document.querySelectorAll(selector))
      .filter((el) => this.isVisible(el) && this.isMenuListCandidate(el))

    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]

    const inputRect = anchor.getBoundingClientRect()
    let best: Element | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const candidate of candidates) {
      const rect = (candidate as HTMLElement).getBoundingClientRect()
      const dy = Math.abs(rect.top - inputRect.bottom)
      const dx = Math.abs(rect.left - inputRect.left)
      const score = dy * 2 + dx
      if (score < bestScore) {
        bestScore = score
        best = candidate
      }
    }
    return best
  }

  private isMenuListCandidate(element: Element): boolean {
    const automationId = element.getAttribute('data-automation-id') || ''
    if (automationId === 'selectedItemList') {
      return false
    }
    const ariaLabel = element.getAttribute('aria-label') || ''
    if (ariaLabel.toLowerCase().includes('items selected')) {
      return false
    }
    if (element.closest('[data-automation-id="selectedItemList"]')) {
      return false
    }
    return true
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
  
  private log(_message: string, ..._args: any[]) {

  }
  
  private warn(_message: string, ..._args: any[]) {}
  
  async collectAllFormFields(): Promise<FormField[]> {
    const selector = this.joinSelectors(this.selectors.fieldCollector.formFields)
    
    const elements = document.querySelectorAll<HTMLElement>(selector)
    logWithData(`Found ${elements.length} form elements matching selector`)
    
    const fields: FormField[] = []
    const checkboxCandidates: HTMLInputElement[] = []
    const radioCandidates: HTMLInputElement[] = []
    
    for (const element of elements) {
      if (this.shouldSkipElement(element)) {
        logWithData(
          `Skipping element (captcha/hidden):`,
          element.getAttribute('id') || element.getAttribute('name') || element.tagName
        )
        continue
      }
      
      if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox') {
          checkboxCandidates.push(element)
          continue
        }
        if (element.type === 'radio') {
          radioCandidates.push(element)
          continue
        }
      }
      
      const field = await this.parseFormField(element)
      if (field) {
        logWithData(`Collected field: "${field.label}" (type: ${field.type}, key: ${field.key})`)
        fields.push(field)
      } else {
        const elementType =
          element instanceof HTMLInputElement || element instanceof HTMLButtonElement
            ? element.type
            : element.tagName.toLowerCase()
        logWithData(`Failed to parse field:`, {
          id: element.getAttribute('id') || element.getAttribute('name') || element.tagName,
          type: elementType
        })
      }
    }
    
    if (checkboxCandidates.length > 0) {
      const grouped = new Map<Element, HTMLInputElement[]>()
      const standalone: HTMLInputElement[] = []

      for (const checkbox of checkboxCandidates) {
        const container = this.getCheckboxGroupContainer(checkbox)
        if (container) {
          const group = grouped.get(container)
          if (group) {
            group.push(checkbox)
          } else {
            grouped.set(container, [checkbox])
          }
        } else {
          standalone.push(checkbox)
        }
      }

      for (const [container, group] of grouped.entries()) {
        if (group.length <= 1) {
          standalone.push(...group)
          continue
        }
        const field = await this.parseCheckboxGroup(container, group)
        if (field) {
          fields.push(field)
        }
      }

      for (const checkbox of standalone) {
        const field = await this.parseFormField(checkbox)
        if (field) {
          logWithData(`Collected field: "${field.label}" (type: ${field.type}, key: ${field.key})`)
          fields.push(field)
        }
      }
    }

    if (radioCandidates.length > 0) {
      const grouped = new Map<Element, HTMLInputElement[]>()
      const groupedByName = new Map<string, HTMLInputElement[]>()
      const standalone: HTMLInputElement[] = []

      for (const radio of radioCandidates) {
        const container = this.getRadioGroupContainer(radio)
        if (container) {
          const group = grouped.get(container)
          if (group) {
            group.push(radio)
          } else {
            grouped.set(container, [radio])
          }
          continue
        }

        const name = radio.getAttribute('name') || ''
        if (name) {
          const group = groupedByName.get(name)
          if (group) {
            group.push(radio)
          } else {
            groupedByName.set(name, [radio])
          }
        } else {
          standalone.push(radio)
        }
      }

      for (const [container, group] of grouped.entries()) {
        if (group.length <= 1) {
          standalone.push(...group)
          continue
        }
        const field = await this.parseRadioGroup(container, group)
        if (field) {
          fields.push(field)
        }
      }

      for (const [, group] of groupedByName.entries()) {
        if (group.length <= 1) {
          standalone.push(...group)
          continue
        }
        const fallbackContainer =
          group[0].closest('[role="group"]') || group[0].closest('fieldset') || group[0].parentElement
        if (fallbackContainer) {
          const field = await this.parseRadioGroup(fallbackContainer, group)
          if (field) {
            fields.push(field)
            continue
          }
        }
        const field = await this.parseFormField(group[0])
        if (field) {
          fields.push(field)
        }
      }

      for (const radio of standalone) {
        const field = await this.parseFormField(radio)
        if (field) {
          logWithData(`Collected field: "${field.label}" (type: ${field.type}, key: ${field.key})`)
          fields.push(field)
        }
      }
    }

    logWithData(`Total fields collected: ${fields.length}`)
    if (fields.length > 0) {
      const summary = fields
        .map((field, index) => {
          const fallbackLabel =
            field.element?.getAttribute('name') ||
            field.element?.getAttribute('id') ||
            'Unknown Field'
          const label = field.label || fallbackLabel
          const route = this.describeFieldRoute(field)
          const optionsLength = field.options?.length ?? 0
          const optionsInfo =
            field.type === 'select' || field.type === 'react-select' || field.type === 'react-multi-select'
              ? ` | optionsLength: ${optionsLength}`
              : ''
          return `${index + 1}. ${label} | key: ${field.key} | type: ${field.type} | route: ${route}${optionsInfo}`
        })
        .join('\n')
      logWithData('[FieldCollector] Detected fields (label | key | type | route):\n' + summary)
    }
    return fields
  }

  private describeFieldRoute(field: FormField): string {
    const matchers = getDomainFieldMatchers(this.engineMode)
    if (field.key && matchers[field.key]) {
      return 'default'
    }
    const definition = findCustomFieldDefinition(field.label, field.type)
    if (definition) {
      return 'custom-definition'
    }
    return 'custom-question'
  }
}

export const fieldCollector = new FieldCollector('common')
