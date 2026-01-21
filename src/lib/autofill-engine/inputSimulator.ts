export class CommonInputSimulator {
  private static readonly WAIT_TIMEOUT = 5000;
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly DEBUG = true;

  private static log(message: string, ...args: unknown[]) {
    if (this.DEBUG) {
      console.log(`[CommonInputSimulator] ${message}`, ...args);
    }
  }

  private static warn(message: string, ...args: unknown[]) {
    if (this.DEBUG) {
      console.warn(`[CommonInputSimulator] ${message}`, ...args);
    }
  }

  static async fillInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
    if (!value) {
      this.warn("fillInput: No value provided");
      return;
    }

    this.log("fillInput: Starting", { element, value });

    element.focus();
    this.log("fillInput: Focused element");
    await this.wait(50);

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (element instanceof HTMLInputElement && nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
      this.log("fillInput: Used native input setter");
    } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(element, value);
      this.log("fillInput: Used native textarea setter");
    } else {
      element.value = value;
      this.log("fillInput: Used direct value assignment");
    }

    this.triggerInputEvents(element);
    this.log("fillInput: Triggered events");
    await this.wait(100);
    element.blur();
    this.log("fillInput: Blurred element - Complete");
  }

  static async fillSelect(
    select: HTMLSelectElement,
    value: string,
    options?: { searchable?: boolean; retryCount?: number }
  ): Promise<boolean> {
    const retryCount = options?.retryCount || 0;

    if (!value || !select) {
      this.warn("fillSelect: Missing value or select element", { value, select });
      return false;
    }

    this.log("fillSelect: Starting", {
      value,
      searchable: options?.searchable,
      retryCount,
      selectId: select.id,
      selectName: select.name,
    });

    if (retryCount >= this.RETRY_ATTEMPTS) {
      this.warn(`fillSelect: Failed after ${this.RETRY_ATTEMPTS} attempts`);
      return false;
    }

    if (options?.searchable) {
      this.log("fillSelect: Using searchable dropdown mode");
      const success = await this.fillSearchableSelect(select, value);
      if (!success && retryCount < this.RETRY_ATTEMPTS - 1) {
        this.log(`fillSelect: Retry attempt ${retryCount + 1}`);
        await this.wait(200);
        return this.fillSelect(select, value, { ...options, retryCount: retryCount + 1 });
      }
      this.log("fillSelect: Searchable result:", success);
      return success;
    }

    this.log("fillSelect: Using standard select mode");
    return this.fillStandardSelect(select, value);
  }

  private static fillStandardSelect(select: HTMLSelectElement, value: string): boolean {
    if (select.options.length === 0) {
      this.warn("fillStandardSelect: Select has no options");
      return false;
    }

    this.log("fillStandardSelect: Processing", {
      value,
      optionsCount: select.options.length,
      options: Array.from(select.options).map((opt) => ({ value: opt.value, text: opt.text })),
    });

    const lowerValue = value.toLowerCase().trim();
    const strategies = [
      { name: "Exact value match", fn: (opt: HTMLOptionElement) => opt.value.toLowerCase() === lowerValue },
      { name: "Exact text match", fn: (opt: HTMLOptionElement) => opt.text.toLowerCase() === lowerValue },
      {
        name: "Exact text match (trimmed)",
        fn: (opt: HTMLOptionElement) => opt.text.toLowerCase().trim() === lowerValue,
      },
      { name: "Value contains", fn: (opt: HTMLOptionElement) => opt.value.toLowerCase().includes(lowerValue) },
      { name: "Text contains", fn: (opt: HTMLOptionElement) => opt.text.toLowerCase().includes(lowerValue) },
      {
        name: "Reverse contains",
        fn: (opt: HTMLOptionElement) => lowerValue.includes(opt.text.toLowerCase().trim()),
      },
      { name: "Fuzzy match", fn: (opt: HTMLOptionElement) => this.fuzzyMatch(opt.text.toLowerCase(), lowerValue) },
    ];

    for (const strategy of strategies) {
      this.log(`fillStandardSelect: Trying strategy: ${strategy.name}`);
      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        if (option.value === "" || option.disabled) continue;

        if (strategy.fn(option)) {
          this.log("fillStandardSelect: Match found!", {
            strategy: strategy.name,
            option: { index: i, value: option.value, text: option.text },
          });

          select.focus();
          select.selectedIndex = i;

          const nativeSelectSetter = Object.getOwnPropertyDescriptor(
            window.HTMLSelectElement.prototype,
            "value"
          )?.set;

          if (nativeSelectSetter) {
            nativeSelectSetter.call(select, option.value);
            this.log("fillStandardSelect: Used native setter");
          }

          this.triggerSelectEvents(select);
          this.log("fillStandardSelect: Events triggered");
          select.blur();
          this.log("fillStandardSelect: Complete - Success");
          return true;
        }
      }
    }

    this.warn("fillStandardSelect: No match found for value:", value);
    return false;
  }

  private static fuzzyMatch(text: string, search: string): boolean {
    const textClean = text.replace(/[^a-z0-9]/g, "");
    const searchClean = search.replace(/[^a-z0-9]/g, "");
    return textClean.includes(searchClean) || searchClean.includes(textClean);
  }

  private static async fillSearchableSelect(select: HTMLSelectElement, value: string): Promise<boolean> {
    this.log("fillSearchableSelect: Starting", { value, select });

    select.focus();
    this.log("fillSearchableSelect: Focused select");
    await this.wait(150);

    select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    this.log("fillSearchableSelect: Dispatched mousedown");
    await this.wait(100);

    select.click();
    this.log("fillSearchableSelect: Clicked select");
    await this.wait(500);

    const customDropdown = this.findCustomDropdown(select);

    if (customDropdown) {
      this.log("fillSearchableSelect: Custom dropdown found", customDropdown);
      const success = await this.fillCustomDropdown(customDropdown, value);
      if (success) {
        this.log("fillSearchableSelect: Custom dropdown filled successfully");
        return true;
      }
      this.warn("fillSearchableSelect: Custom dropdown fill failed, retrying...");

      await this.wait(300);
      select.click();
      await this.wait(500);

      const retryDropdown = this.findCustomDropdown(select);
      if (retryDropdown) {
        const retrySuccess = await this.fillCustomDropdown(retryDropdown, value);
        if (retrySuccess) return true;
      }
    } else {
      this.warn("fillSearchableSelect: No custom dropdown found, falling back to standard");
    }

    return this.fillStandardSelect(select, value);
  }

  private static findCustomDropdown(select: HTMLSelectElement): Element | null {
    const parent = select.parentElement;
    if (!parent) {
      this.warn("findCustomDropdown: No parent element");
      return null;
    }

    this.log("findCustomDropdown: Searching for dropdown...");

    const selectors = [
      '[class*="menu"]:not([class*="hidden"])',
      '[class*="Menu"]:not([class*="hidden"])',
      '[class*="dropdown"]:not([class*="hidden"])',
      '[class*="Dropdown"]:not([class*="hidden"])',
      ".select__menu",
      ".select__menu-list",
      ".vs__dropdown-menu",
      ".mat-select-panel",
      ".mat-autocomplete-panel",
      ".menu.transition.visible",
      '[role="listbox"]',
      '[role="menu"]',
      ".select2-results",
      ".choices__list--dropdown",
    ];

    for (const selector of selectors) {
      const dropdown = parent.querySelector(selector) || document.querySelector(selector);
      if (dropdown && this.isVisible(dropdown)) {
        this.log("findCustomDropdown: Found dropdown with selector:", selector, dropdown);
        return dropdown;
      }
    }

    this.warn("findCustomDropdown: No dropdown found");
    return null;
  }

  private static isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    const visible =
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      (element as HTMLElement).offsetParent !== null;
    this.log("isVisible:", { element, visible });
    return visible;
  }

  private static async fillCustomDropdown(dropdown: Element, value: string): Promise<boolean> {
    this.log("fillCustomDropdown: Starting", { dropdown, value });

    await this.waitForOptions(dropdown);

    const searchInput = dropdown.querySelector('input[type="text"], input[type="search"], input[class*="input"]');
    if (searchInput && searchInput instanceof HTMLInputElement) {
      this.log("fillCustomDropdown: Search input found, typing value");
      await this.typeIntoSearch(searchInput, value);
      await this.wait(500);

      await this.waitForOptions(dropdown);
    } else {
      this.log("fillCustomDropdown: No search input found");
    }

    const options = this.getDropdownOptions(dropdown);
    this.log("fillCustomDropdown: Found options", {
      count: options.length,
      options: options.map((opt) => ({ text: opt.textContent?.trim(), classes: (opt as HTMLElement).className })),
    });

    if (options.length === 0) {
      this.warn("fillCustomDropdown: No options found after waiting");
      return false;
    }

    const lowerValue = value.toLowerCase().trim();

    const strategies = [
      {
        name: "Exact match",
        fn: (opt: Element) => {
          const text = opt.textContent?.toLowerCase().trim() || "";
          const val = opt.getAttribute("value")?.toLowerCase() || "";
          return text === lowerValue || val === lowerValue;
        },
      },
      {
        name: "Text contains",
        fn: (opt: Element) => {
          const text = opt.textContent?.toLowerCase().trim() || "";
          return text.includes(lowerValue);
        },
      },
      {
        name: "Reverse contains",
        fn: (opt: Element) => {
          const text = opt.textContent?.toLowerCase().trim() || "";
          return lowerValue.includes(text) && text.length > 2;
        },
      },
      {
        name: "Fuzzy match",
        fn: (opt: Element) => {
          const text = opt.textContent?.toLowerCase().trim() || "";
          return this.fuzzyMatch(text, lowerValue);
        },
      },
    ];

    for (const strategy of strategies) {
      this.log(`fillCustomDropdown: Trying strategy: ${strategy.name}`);
      for (const option of options) {
        if (strategy.fn(option)) {
          this.log("fillCustomDropdown: Match found!", {
            strategy: strategy.name,
            option: option.textContent?.trim(),
          });

          option.scrollIntoView({ block: "nearest", behavior: "smooth" });
          this.log("fillCustomDropdown: Scrolled into view");
          await this.wait(150);

          (option as HTMLElement).dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true }));
          (option as HTMLElement).dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
          this.log("fillCustomDropdown: Dispatched mouse events");
          await this.wait(100);

          (option as HTMLElement).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          await this.wait(50);
          (option as HTMLElement).click();
          this.log("fillCustomDropdown: Clicked option");
          await this.wait(200);

          this.log("fillCustomDropdown: Complete - Success");
          return true;
        }
      }
    }

    this.warn("fillCustomDropdown: No matching option found");
    return false;
  }

  private static async typeIntoSearch(input: HTMLInputElement, value: string): Promise<void> {
    this.log("typeIntoSearch: Starting", { input, value });

    input.focus();
    this.log("typeIntoSearch: Focused input");
    await this.wait(50);

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    if (nativeSetter) {
      nativeSetter.call(input, value);
      this.log("typeIntoSearch: Used native setter");
    } else {
      input.value = value;
      this.log("typeIntoSearch: Used direct assignment");
    }

    this.triggerInputEvents(input);
    this.log("typeIntoSearch: Triggered events");
    await this.wait(50);
    this.log("typeIntoSearch: Complete");
  }

  private static getDropdownOptions(dropdown: Element): Element[] {
    this.log("getDropdownOptions: Searching for options...");

    const selectors = [
      '[class*="option"]:not([class*="hidden"])',
      '[class*="Option"]:not([class*="hidden"])',
      ".select__option",
      ".vs__dropdown-option",
      "mat-option",
      ".mat-option",
      ".item:not(.disabled)",
      '[role="option"]',
      ".select2-results__option",
      ".choices__item",
      'div[id*="option"]',
      'div[id*="react-select"]',
    ];

    for (const selector of selectors) {
      const options = Array.from(dropdown.querySelectorAll(selector)).filter(
        (opt) => this.isVisible(opt) && !(opt as HTMLElement).classList.contains("disabled")
      );
      if (options.length > 0) {
        this.log(`getDropdownOptions: Found ${options.length} options with selector: ${selector}`);
        return options;
      }
    }

    this.warn("getDropdownOptions: No options found");
    return [];
  }

  private static async waitForOptions(dropdown: Element): Promise<void> {
    this.log("waitForOptions: Waiting for options to appear...");
    const startTime = Date.now();

    while (Date.now() - startTime < this.WAIT_TIMEOUT) {
      const options = this.getDropdownOptions(dropdown);
      if (options.length > 0) {
        this.log("waitForOptions: Options appeared");
        return;
      }
      await this.wait(100);
    }

    this.warn("waitForOptions: Timeout - no options appeared");
  }

  private static triggerInputEvents(element: HTMLInputElement | HTMLTextAreaElement): void {
    this.log("triggerInputEvents: Triggering events for input");
    const events = [
      new InputEvent("input", { bubbles: true, cancelable: true, composed: true }),
      new Event("change", { bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true }),
      new Event("blur", { bubbles: true, cancelable: true }),
      new FocusEvent("focusout", { bubbles: true, cancelable: true }),
    ];

    events.forEach((event) => {
      try {
        element.dispatchEvent(event);
      } catch (error) {
        this.warn("triggerInputEvents: Failed to dispatch event", error);
      }
    });
  }

  private static triggerSelectEvents(select: HTMLSelectElement): void {
    this.log("triggerSelectEvents: Triggering events for select");
    const events = [
      new Event("change", { bubbles: true, cancelable: true }),
      new Event("input", { bubbles: true, cancelable: true }),
      new MouseEvent("click", { bubbles: true, cancelable: true }),
      new Event("blur", { bubbles: true, cancelable: true }),
      new FocusEvent("focusout", { bubbles: true, cancelable: true }),
    ];

    events.forEach((event) => {
      try {
        select.dispatchEvent(event);
      } catch (error) {
        this.warn("triggerSelectEvents: Failed to dispatch event", error);
      }
    });
  }

  private static wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
