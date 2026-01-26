import { GREENHOUSE_SELECTORS } from "./config/domains/greenhouse/selectors.config"
import { COMMON_SELECTORS } from "./config/domains/common/selectors.config"
import { WORKDAY_SELECTORS } from "./config/domains/workday/selectors.config"
import type { DomainAutofillSelectors } from "./config/types"
import type { EngineMode } from "./types"

export class DomainInputSimulator {
    private static readonly DEBUG = false
    private static readonly MENU_WAIT_STEPS = [50, 100, 200, 200, 200]
    private static selectors: DomainAutofillSelectors = GREENHOUSE_SELECTORS

    static setEngineMode(engineMode: EngineMode): void {
      this.selectors =
        engineMode === 'greenhouse'
          ? GREENHOUSE_SELECTORS
          : engineMode === 'workday'
            ? WORKDAY_SELECTORS
            : COMMON_SELECTORS
    }
  
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

      const elementsToTry: HTMLElement[] = []

      const pushUnique = (el: HTMLElement | null) => {
        if (!el) return
        if (!elementsToTry.includes(el)) {
          elementsToTry.push(el)
        }
      }

      // Prefer custom selectors when available
      const selectControl = this.closestBySelectors(
        input,
        this.selectors.reactSelect.control
      ) as HTMLElement | null
      const selectContainer = this.closestBySelectors(
        input,
        this.selectors.reactSelect.container
      ) as HTMLElement | null

      if (selectControl) {
        pushUnique(selectControl)
        this.log('fillReactSelect: Found select__control element', {
          className: selectControl.className,
          tagName: selectControl.tagName
        })
      }

      if (selectContainer) {
        pushUnique(selectContainer)
        this.log('fillReactSelect: Found select container element', {
          className: selectContainer.className || '',
          tagName: selectContainer.tagName
        })
      }

      // Always try input and up to 3 parent levels as fallback
      pushUnique(input)
      let currentElement: HTMLElement | null = input.parentElement
      for (let i = 0; i < 3 && currentElement; i += 1) {
        pushUnique(currentElement)
        currentElement = currentElement.parentElement
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
          this.selectors.reactSelect.control
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

        const result = await this.waitForMenuWithOptions(input)
        menu = result.menu
        options = result.options
        if (menu && options.length > 0) {
          this.log(`fillReactSelect: Menu found after clicking attempt ${i + 1}`, { attempts: result.attempts })
          break
        }

        this.log(`fillReactSelect: Menu did not appear after clicking attempt ${i + 1}`)
      }

      if (!menu || options.length === 0) {
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

    static async fillSelectTrigger(
      trigger: HTMLElement,
      value: string,
      isMulti: boolean,
      isEnableIndexSelection: boolean = false
    ): Promise<boolean> {
      if (!trigger) {
        this.warn('fillSelectTrigger: Missing trigger element')
        return false
      }

      const container = this.closestBySelectors(
        trigger,
        this.selectors.reactSelect.container
      ) as HTMLElement | null
      const input = container?.querySelector<HTMLInputElement>(this.joinSelectors(this.selectors.reactSelect.input)) ?? null

      this.log('fillSelectTrigger: Starting', {
        id: trigger.getAttribute('id') || '',
        value,
        isMulti,
        hasInput: Boolean(input),
        isEnableIndexSelection
      })

      const elementsToTry: HTMLElement[] = []
      const pushUnique = (el: HTMLElement | null) => {
        if (!el) return
        if (!elementsToTry.includes(el)) {
          elementsToTry.push(el)
        }
      }

      const selectControl = this.closestBySelectors(
        trigger,
        this.selectors.reactSelect.control
      ) as HTMLElement | null
      const selectContainer = container

      pushUnique(selectControl)
      pushUnique(selectContainer)
      pushUnique(trigger)

      let currentElement: HTMLElement | null = trigger.parentElement
      for (let i = 0; i < 3 && currentElement; i += 1) {
        pushUnique(currentElement)
        currentElement = currentElement.parentElement
      }

      if (elementsToTry.length === 0) {
        this.warn('fillSelectTrigger: No elements to click')
        return false
      }

      let menu: Element | null = null
      let options: HTMLElement[] = []

      for (let i = 0; i < elementsToTry.length; i++) {
        const elementToClick = elementsToTry[i]
        this.log(`fillSelectTrigger: Attempting to open dropdown (attempt ${i + 1}/${elementsToTry.length})`, {
          element: elementToClick.tagName,
          className: elementToClick.className || ''
        })

        if (input) {
          input.focus()
        }

        elementToClick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        elementToClick.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
        elementToClick.click()
        await this.wait(50)

        if (input && !isMulti && value && !isEnableIndexSelection) {
          await this.typeIntoReactSelectInput(input, value)
          await this.wait(50)
        }

        const result = await this.waitForMenuWithOptions(trigger)
        menu = result.menu
        options = result.options
        if (menu && options.length > 0) {
          this.log(`fillSelectTrigger: Menu found after clicking attempt ${i + 1}`, { attempts: result.attempts })
          break
        }
      }

      if (!menu || options.length === 0) {
        this.warn('fillSelectTrigger: Menu not found after all attempts')
        return false
      }

      if (!value || value.trim() === '') {
        this.log('fillSelectTrigger: Value is empty, selecting first option (default)')
        await this.selectReactSelectOption(options[0])
        return true
      }

      const matchedOption = this.findMatchingReactSelectOption(options, value, isEnableIndexSelection)
      if (!matchedOption) {
        if (isMulti && options.length > 0) {
          this.log('fillSelectTrigger: No match found, selecting first option as fallback')
          await this.selectReactSelectOption(options[0])
          return true
        }
        this.warn('fillSelectTrigger: No matching option found for value:', value)
        return false
      }

      await this.selectReactSelectOption(matchedOption)
      this.log('fillSelectTrigger: Complete - Success')
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

    private static async waitForMenuWithOptions(anchor: HTMLElement): Promise<{
      menu: Element | null
      options: HTMLElement[]
      attempts: number
    }> {
      let menu: Element | null = null
      let options: HTMLElement[] = []

      for (let attempt = 0; attempt < this.MENU_WAIT_STEPS.length; attempt++) {
        await this.wait(this.MENU_WAIT_STEPS[attempt])
        menu = this.findReactSelectMenu(anchor)
        if (!menu) {
          continue
        }
        options = this.getReactSelectOptions(menu)
        if (options.length > 0) {
          return { menu, options, attempts: attempt + 1 }
        }
      }

      return { menu, options, attempts: this.MENU_WAIT_STEPS.length }
    }

    private static findReactSelectMenu(anchor: HTMLElement): Element | null {
      const container = this.closestBySelectors(
        anchor,
        this.selectors.reactSelect.container
      )
      if (container) {
        for (const selector of this.selectors.reactSelect.menuList) {
          const menu = container.querySelector(selector)
          if (menu && this.isVisible(menu) && this.isMenuListCandidate(menu)) {
            this.log('findReactSelectMenu: Menu found', {
              className: (menu as HTMLElement).className,
              role: menu.getAttribute('role')
            })
            return menu
          }
        }
      } else {
        this.warn('findReactSelectMenu: Container not found')
      }

      return this.findGenericListbox(anchor)
    }
  
    private static getReactSelectOptions(menu: Element): HTMLElement[] {
      if (this.selectors.reactSelect.option.length === 0) {
        return []
      }
      const optionSelector = this.joinSelectors(this.selectors.reactSelect.option)
      const options = menu.querySelectorAll(optionSelector)
      const deduped = Array.from(options)
        .filter((opt) => this.isVisible(opt))
        .map((opt) => (opt.closest('[data-automation-id="menuItem"]') as HTMLElement | null) ?? opt)
      const seen = new Set<Element>()
      const visibleOptions = deduped.filter((opt) => {
        if (seen.has(opt)) {
          return false
        }
        seen.add(opt)
        return true
      }) as HTMLElement[]
      
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
      const clickTarget =
        option.querySelector('[data-automation-id="promptOption"]') ||
        option.querySelector('[data-automation-id="promptLeafNode"]') ||
        option.querySelector('[data-automation-id="radioBtn"]') ||
        option

      const clickCandidates: HTMLElement[] = []
      const pushUnique = (el: HTMLElement | null) => {
        if (!el) return
        if (!clickCandidates.includes(el)) {
          clickCandidates.push(el)
        }
      }

      if (clickTarget instanceof HTMLElement) {
        pushUnique(clickTarget)
        let parent: HTMLElement | null = clickTarget.parentElement
        for (let i = 0; i < 3 && parent; i += 1) {
          pushUnique(parent)
          parent = parent.parentElement
        }
      }

      pushUnique(option)
      let optionParent: HTMLElement | null = option.parentElement
      for (let i = 0; i < 3 && optionParent; i += 1) {
        pushUnique(optionParent)
        optionParent = optionParent.parentElement
      }

      for (const candidate of clickCandidates) {
        candidate.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        await this.wait(80)

        candidate.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }))
        candidate.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
        await this.wait(50)

        candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
        candidate.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
        candidate.click()
        await this.wait(200)

        const menuItem = option.closest('[data-automation-id="menuItem"]') as HTMLElement | null
        const selectedAttr =
          menuItem?.getAttribute('data-automation-selected') ||
          menuItem?.getAttribute('aria-selected') ||
          option.getAttribute('aria-selected') ||
          option.getAttribute('data-automation-selected')
        if (selectedAttr === 'true' || !document.body.contains(option)) {
          break
        }
      }
      
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
        this.closestBySelectors(element, this.selectors.reactSelect.multiValueContainer) !== null
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

    private static findListboxByAria(element: Element): Element | null {
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

    private static findGenericListbox(anchor: HTMLElement): Element | null {
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

    private static isMenuListCandidate(element: Element): boolean {
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
