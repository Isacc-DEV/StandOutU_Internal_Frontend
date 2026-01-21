import { GREENHOUSE_SELECTORS } from "./config/domains/greenhouse/selectors.config"

export class DomainInputSimulator {
    private static readonly DEBUG = false
  
    // ========================================================================
    // Logging Utilities
    // ========================================================================
  
    private static log(message: string, ...args: any[]) {
      if (this.DEBUG) {
        console.log(`[InputSimulator] ${message}`, ...args)
      }
    }
  
    private static warn(message: string, ...args: any[]) {
      if (this.DEBUG) {
        console.warn(`[InputSimulator] ${message}`, ...args)
      }
    }
  
    // ========================================================================
    // Public API - Fill Text Input/Textarea
    // ========================================================================
  
    static async fillInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
      if (!value) {
        this.warn('fillInput: No value provided')
        return
      }
      
      this.log('fillInput: Starting', { element, value })
      
      // Focus element
      element.focus()
      await this.wait(50)
      
      // Set value using native setter for better compatibility
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set
  
      if (element instanceof HTMLInputElement && nativeInputValueSetter) {
        nativeInputValueSetter.call(element, value)
      } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(element, value)
      } else {
        element.value = value
      }
  
      // Trigger events
      this.triggerInputEvents(element)
      await this.wait(100)
      
      // Blur element
      element.blur()
      this.log('fillInput: Complete')
    }
  
    // ========================================================================
    // Public API - Fill Standard Select Dropdown
    // ========================================================================
  
    static async fillSelect(select: HTMLSelectElement, value: string): Promise<boolean> {
      if (!value || !select) {
        this.warn('fillSelect: Missing value or select element', { value, select })
        return false
      }
      
      this.log('fillSelect: Starting', { 
        value, 
        selectId: select.id,
        selectName: select.name,
        optionsCount: select.options.length
      })
      
      if (select.options.length === 0) {
        this.warn('fillSelect: Select has no options')
        return false
      }
      
      const lowerValue = value.toLowerCase().trim()
      
      // Matching strategies in order of priority
      const strategies = [
        { name: 'Exact value match', fn: (opt: HTMLOptionElement) => opt.value.toLowerCase() === lowerValue },
        { name: 'Exact text match', fn: (opt: HTMLOptionElement) => opt.text.toLowerCase() === lowerValue },
        { name: 'Exact text match (trimmed)', fn: (opt: HTMLOptionElement) => opt.text.toLowerCase().trim() === lowerValue },
        { name: 'Value contains', fn: (opt: HTMLOptionElement) => opt.value.toLowerCase().includes(lowerValue) },
        { name: 'Text contains', fn: (opt: HTMLOptionElement) => opt.text.toLowerCase().includes(lowerValue) },
        { name: 'Reverse contains', fn: (opt: HTMLOptionElement) => lowerValue.includes(opt.text.toLowerCase().trim()) },
        { name: 'Fuzzy match', fn: (opt: HTMLOptionElement) => this.fuzzyMatch(opt.text.toLowerCase(), lowerValue) }
      ]
  
      for (const strategy of strategies) {
        this.log(`fillSelect: Trying strategy: ${strategy.name}`)
        
        for (let i = 0; i < select.options.length; i++) {
          const option = select.options[i]
          if (option.value === '' || option.disabled) continue
          
          if (strategy.fn(option)) {
            this.log(`fillSelect: Match found!`, { 
              strategy: strategy.name,
              option: { index: i, value: option.value, text: option.text }
            })
            
            // Focus select
            select.focus()
            select.selectedIndex = i
            
            // Use native setter
            const nativeSelectSetter = Object.getOwnPropertyDescriptor(
              window.HTMLSelectElement.prototype,
              'value'
            )?.set
            
            if (nativeSelectSetter) {
              nativeSelectSetter.call(select, option.value)
            }
            
            // Trigger events
            this.triggerSelectEvents(select)
            select.blur()
            
            this.log('fillSelect: Complete - Success')
            return true
          }
        }
      }
      
      this.warn('fillSelect: No match found for value:', value)
      return false
    }
  
    // ========================================================================
    // Public API - Fill React-Select Dropdown
    // ========================================================================

    static async fillReactSelect(input: HTMLInputElement, value: string, isEnableIndexSelection: boolean = false ): Promise<boolean> {
      if (!input) {
        this.warn('fillReactSelect: Missing input element')
        return false
      }
      
      const isMulti = this.isMultiSelectInput(input)
      this.log('fillReactSelect: Starting', { id: input.id, value, isMulti, isEnableIndexSelection })

      // Find select__control parent component from input
      const selectControl = this.closestBySelectors(
        input,
        GREENHOUSE_SELECTORS.reactSelect.control
      ) as HTMLElement | null
      
      // Build elements to try: select__control, then its parent (2 components total)
      const elementsToTry: HTMLElement[] = []
      
      if (selectControl) {
        elementsToTry.push(selectControl)
        this.log('fillReactSelect: Found select__control element', {
          className: selectControl.className,
          tagName: selectControl.tagName
        })
        
        // Add select__control's parent if it exists
        if (selectControl.parentElement) {
          elementsToTry.push(selectControl.parentElement)
          this.log('fillReactSelect: Added select__control parent', {
            className: selectControl.parentElement.className || '',
            tagName: selectControl.parentElement.tagName
          })
        }
      } else {
        // Fallback: if select__control not found, use input and its parents
        this.log('fillReactSelect: select__control not found, falling back to input and parents')
        elementsToTry.push(input)
        let currentElement: HTMLElement | null = input.parentElement
        if (currentElement) {
          elementsToTry.push(currentElement)
        }
      }

      if (elementsToTry.length === 0) {
        const errorMsg = `fillReactSelect: No elements to click. Input ID: ${input.id || 'none'}`
        this.warn(errorMsg)
        return false
      }

      let menu: Element | null = null

      // Try clicking each element until dropdown appears
      for (let i = 0; i < elementsToTry.length; i++) {
        const elementToClick = elementsToTry[i]
        const isSelectControl = this.matchesAnySelector(
          elementToClick,
          GREENHOUSE_SELECTORS.reactSelect.control
        )
        
        this.log(`fillReactSelect: Attempting to open dropdown (attempt ${i + 1}/${elementsToTry.length}):`, {
          element: elementToClick.tagName,
          className: elementToClick.className || '',
          isSelectControl
        })

        // Focus input before clicking the control element
        input.focus()
        
        // Simulate click events on the element
        elementToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        elementToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
        elementToClick.click()
        await this.wait(50)

        // For single-select with value, type to filter options (only if NOT using index selection)
        if ((isSelectControl || elementToClick === input) && !isMulti && value && !isEnableIndexSelection) {
          await this.typeIntoReactSelectInput(input, value)
          await this.wait(50)
        }

        // Check if dropdown menu appeared with retry logic
        for (let attempt = 0; attempt < 10; attempt++) {
          menu = this.findReactSelectMenu(input)
          if (menu) {
            this.log(`fillReactSelect: Menu found after clicking attempt ${i + 1}`, { attempt: attempt + 1 })
            break
          }
          await this.wait(100)
        }

        if (menu) {
          break
        }

        this.log(`fillReactSelect: Menu did not appear after clicking attempt ${i + 1}`)
      }

      if (!menu) {
        const errorMsg = `fillReactSelect: Menu not found after trying to click ${elementsToTry.length} element(s). Input ID: ${input.id || 'none'}, Selector: ${input.className || 'none'}`
        this.warn(errorMsg)
        return false
      }

      // Log what menu was found
      this.log('fillReactSelect: Menu/listbox found', {
        tagName: menu.tagName,
        className: menu.className || '',
        role: menu.getAttribute('role'),
        id: menu.id || '',
        childrenCount: menu.children.length
      })

      // Get all visible options from the dropdown
      const options = this.getReactSelectOptions(menu)
      if (options.length === 0) {
        this.warn('fillReactSelect: No options found in menu')
        return false
      }

      this.log(`fillReactSelect: Found ${options.length} options`)

      // If value is empty, select first option
      if (!value || value.trim() === '') {
        if (options.length > 0) {
          this.log('fillReactSelect: Value is empty, selecting first option (default)')
          await this.selectReactSelectOption(options[0])
          return true
        }
        return false
      }

      // Try to match the value with options
      const matchedOption = this.findMatchingReactSelectOption(options, value, isEnableIndexSelection)
      if (!matchedOption) {
        // If no match found and it's multi-select, select first option as fallback
        if (isMulti && options.length > 0) {
          this.log('fillReactSelect: No match found, selecting first option as fallback')
          await this.selectReactSelectOption(options[0])
          return true
        }
        this.warn('fillReactSelect: No matching option found for value:', value)
        return false
      }

      // Select the matched option
      await this.selectReactSelectOption(matchedOption)
      this.log('fillReactSelect: Complete - Success')
      return true
    }
  
    // ========================================================================
    // React-Select Helper Methods
    // ========================================================================

    private static async typeIntoReactSelectInput(input: HTMLInputElement, value: string): Promise<void> {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
  
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value)
      } else {
        input.value = value
      }
  
      // Trigger input events
      try {
        input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, composed: true }))
      } catch {
        input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
      }
  
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
    }

    private static findReactSelectMenu(input: HTMLInputElement): Element | null {
      const container = this.closestBySelectors(
        input,
        GREENHOUSE_SELECTORS.reactSelect.container
      )
      if (!container) {
        this.warn('findReactSelectMenu: Container not found')
        return null
      }
      
      for (const selector of GREENHOUSE_SELECTORS.reactSelect.menuList) {
        const menu = container.querySelector(selector)
        if (menu && this.isVisible(menu)) {
          this.log('findReactSelectMenu: Menu found', {
            className: (menu as HTMLElement).className,
            role: menu.getAttribute('role')
          })
          return menu
        }
      }
      
      return null
    }
  
    private static getReactSelectOptions(menu: Element): HTMLElement[] {
      if (GREENHOUSE_SELECTORS.reactSelect.option.length === 0) {
        return []
      }
      const optionSelector = this.joinSelectors(GREENHOUSE_SELECTORS.reactSelect.option)
      const options = menu.querySelectorAll(optionSelector)
      const visibleOptions = Array.from(options).filter(opt => this.isVisible(opt)) as HTMLElement[]
      
      this.log(`getReactSelectOptions: Found ${visibleOptions.length} visible options`)
      return visibleOptions
    }
  
    private static findMatchingReactSelectOption(options: HTMLElement[], value: string, isEnableIndexSelection: boolean = false): HTMLElement | null {
      const lowerValue = value.toLowerCase().trim()
      const normalizedValue = this.normalizeSelectText(value)
      
      // Try index-based selection first if enabled
      if (isEnableIndexSelection) {
        const optionIndex = this.parseOptionIndex(value, options.length)
        if (optionIndex !== null && options[optionIndex]) {
          this.log(`findMatchingReactSelectOption: Matched by index: ${optionIndex}`)
          return options[optionIndex]
        }
      }
      
      // Matching strategies
      const strategies = [
        { name: 'Exact match', fn: (text: string) => text === lowerValue },
        { name: 'Contains', fn: (text: string) => text.includes(lowerValue) },
        { name: 'Starts with', fn: (text: string) => text.startsWith(lowerValue) },
        { name: 'Reverse contains', fn: (text: string) => lowerValue.includes(text) && text.length > 2 },
        { 
          name: 'Fuzzy match',
          fn: (text: string) => {
            const normalizedText = this.normalizeSelectText(text)
            return normalizedText.includes(normalizedValue) || normalizedValue.includes(normalizedText)
          }
        }
      ]
      
      for (const strategy of strategies) {
        this.log(`findMatchingReactSelectOption: Trying strategy: ${strategy.name}`)
        
        for (const option of options) {
          const text = option.textContent?.toLowerCase().trim() || ''
          if (strategy.fn(text)) {
            this.log(`findMatchingReactSelectOption: Match found!`, { 
              strategy: strategy.name, 
              text: option.textContent?.trim() 
            })
            return option
          }
        }
      }
      
      return null
    }
  
    private static async selectReactSelectOption(option: HTMLElement): Promise<void> {
      // Scroll into view
      option.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      await this.wait(80)
  
      // Mouse events
      option.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }))
      option.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
      await this.wait(50)
  
      option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      await this.wait(50)
  
      // Click
      option.click()
      await this.wait(200)
      
      this.log('selectReactSelectOption: Option selected')
    }
  
    // ========================================================================
    // Helper Methods
    // ========================================================================

    private static isMultiSelectInput(element: HTMLElement): boolean {
      const id = element.getAttribute('id') || ''
      return (
        id.includes('[]') ||
        element.getAttribute('aria-multiselectable') === 'true' ||
        this.closestBySelectors(element, GREENHOUSE_SELECTORS.reactSelect.multiValueContainer) !== null
      )
    }

    private static matchesAnySelector(element: Element, selectors: string[]): boolean {
      return selectors.some((selector) => element.matches(selector))
    }

    private static closestBySelectors(element: Element, selectors: string[]): Element | null {
      if (selectors.length === 0) {
        return null
      }
      return element.closest(this.joinSelectors(selectors))
    }

    private static joinSelectors(selectors: string[]): string {
      return selectors.join(', ')
    }

    private static normalizeSelectText(value: string): string {
      return value.toLowerCase().replace(/[^a-z0-9]/g, '')
    }
  
    private static parseOptionIndex(value: string, optionsLength: number): number | null {
      const trimmed = value.trim()
      // Match patterns: #0, 0, index:0, option-0
      const match = trimmed.match(/^(?:#|index:|option-)?(\d+)$/i)
      if (!match) return null
  
      const numeric = Number(match[1])
      if (!Number.isFinite(numeric)) return null
  
      // Always treat as zero-based indexing (# prefix is just a marker for index-based selection)
      if (numeric >= 0 && numeric < optionsLength) {
        return numeric
      }
  
      return null
    }
  
    private static fuzzyMatch(text: string, search: string): boolean {
      const textClean = text.replace(/[^a-z0-9]/g, '')
      const searchClean = search.replace(/[^a-z0-9]/g, '')
      return textClean.includes(searchClean) || searchClean.includes(textClean)
    }
  
    private static isVisible(element: Element): boolean {
      const style = window.getComputedStyle(element)
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        (element as HTMLElement).offsetParent !== null
      )
    }
  
    // ========================================================================
    // Event Dispatching
    // ========================================================================
  
    private static triggerInputEvents(element: HTMLInputElement | HTMLTextAreaElement): void {
      const events = [
        new InputEvent('input', { bubbles: true, cancelable: true, composed: true }),
        new Event('change', { bubbles: true, cancelable: true }),
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
        new KeyboardEvent('keyup', { key: 'Enter', bubbles: true, cancelable: true }),
        new Event('blur', { bubbles: true, cancelable: true }),
        new FocusEvent('focusout', { bubbles: true, cancelable: true })
      ]
  
      events.forEach(event => {
        try {
          element.dispatchEvent(event)
        } catch (e) {
          this.warn('triggerInputEvents: Failed to dispatch event', e)
        }
      })
    }
  
    private static triggerSelectEvents(select: HTMLSelectElement): void {
      const events = [
        new Event('change', { bubbles: true, cancelable: true }),
        new Event('input', { bubbles: true, cancelable: true }),
        new MouseEvent('click', { bubbles: true, cancelable: true }),
        new Event('blur', { bubbles: true, cancelable: true }),
        new FocusEvent('focusout', { bubbles: true, cancelable: true })
      ]
  
      events.forEach(event => {
        try {
          select.dispatchEvent(event)
        } catch (e) {
          this.warn('triggerSelectEvents: Failed to dispatch event', e)
        }
      })
    }
  
    // ========================================================================
    // Utility
    // ========================================================================
  
    private static wait(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms))
    }
  }
