import type { FillPlanAction } from "@/app/workspace/types";

export function buildSelectionCacheScript() {
  return `(() => {
      try {
        if (window.__smartworkSelectionCache) return true;
        window.__smartworkSelectionCache = true;
        const update = () => {
          try {
            const selection = window.getSelection ? window.getSelection().toString() : '';
            const text = selection ? selection.trim() : '';
            if (text) window.__smartworkLastSelection = text;
          } catch {
            /* ignore */
          }
        };
        document.addEventListener('mouseup', update);
        document.addEventListener('keyup', update);
        const attachFrame = (frame) => {
          try {
            const doc = frame.contentDocument;
            if (!doc) return;
            doc.addEventListener('mouseup', update);
            doc.addEventListener('keyup', update);
          } catch {
            /* ignore */
          }
        };
        Array.from(document.querySelectorAll('iframe')).forEach(attachFrame);
        const obs = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of Array.from(m.addedNodes || [])) {
              if (node && node.tagName && node.tagName.toLowerCase() === 'iframe') {
                attachFrame(node);
              }
            }
          }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        return true;
      } catch {
        return false;
      }
    })()`;
}

export function buildHotkeyBridgeScript() {
  return `(() => {
      try {
        if (window.__smartworkHotkeysInstalled) return true;
        window.__smartworkHotkeysInstalled = true;
        const handler = (e) => {
          if (!e) return;
          const key = (e.key || '').toLowerCase();
          const ctrl = !!(e.ctrlKey || e.metaKey);
          const shift = !!e.shiftKey;
          if (!ctrl || !shift) return;
          if (key !== 'g' && key !== 'f') return;
          try { e.preventDefault(); } catch {}
          const payload = { key, ctrl: true, shift: true };
          try {
            window.postMessage({ __smartworkHotkey: payload }, '*');
          } catch { /* ignore */ }
          try {
            if (window.parent) {
              window.parent.postMessage({ __smartworkHotkey: payload }, '*');
            }
          } catch { /* ignore */ }
          try {
            // Electron guest -> host IPC
            if (window.ipcRenderer && typeof window.ipcRenderer.sendToHost === 'function') {
              window.ipcRenderer.sendToHost('smartwork-hotkey', payload);
            }
          } catch { /* ignore */ }
        };
        document.addEventListener('keydown', handler, true);
        const frames = Array.from(document.querySelectorAll('iframe'));
        frames.forEach((frame) => {
          try {
            const doc = frame.contentDocument;
            if (doc) {
              doc.addEventListener('keydown', handler, true);
            }
          } catch {
            /* ignore */
          }
        });
        return true;
      } catch {
        return false;
      }
    })()`;
}

export function buildCollectWebviewTextScript() {
  return `(() => {
      const readText = (doc) => {
        if (!doc) return '';
        const body = doc.body;
        const inner = body ? body.innerText || '' : '';
        const content = body ? body.textContent || '' : '';
        const title = doc.title || '';
        return [title, inner, content].filter(Boolean).join('\\n');
      };
      const mainText = readText(document);
      const frames = Array.from(document.querySelectorAll('iframe'));
      const frameText = frames
        .map((frame) => {
          try {
            const doc = frame.contentDocument;
            return readText(doc);
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .join('\\n');
      return [mainText, frameText].filter(Boolean).join('\\n');
    })()`;
}

export function buildCollectWebviewFieldsScript() {
  return `(() => {
      const fields = [];
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const textOf = (el) => norm(el && (el.textContent || el.innerText || ''));
      const getWin = (el) =>
        (el && el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : window);
      const isVisible = (el) => {
        const win = getWin(el);
        const cs = win.getComputedStyle(el);
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const esc = (doc, v) => {
        const css = doc.defaultView && doc.defaultView.CSS;
        return css && css.escape ? css.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
      };
      const getLabelText = (el, doc) => {
        try {
          const labels = el.labels;
          if (labels && labels.length) {
            const t = Array.from(labels).map((n) => textOf(n)).filter(Boolean);
            if (t.length) return t.join(' ');
          }
        } catch {
          /* ignore */
        }
        const id = el.getAttribute('id');
        if (id) {
          const lab = doc.querySelector('label[for="' + esc(doc, id) + '"]');
          const t = textOf(lab);
          if (t) return t;
        }
        const wrap = el.closest('label');
        const t2 = textOf(wrap);
        return t2 || '';
      };
      const getAriaName = (el, doc) => {
        const direct = norm(el.getAttribute('aria-label'));
        if (direct) return direct;
        const labelledBy = norm(el.getAttribute('aria-labelledby'));
        if (labelledBy) {
          const parts = labelledBy
            .split(/\\s+/)
            .map((id) => textOf(doc.getElementById(id)))
            .filter(Boolean);
          return norm(parts.join(' '));
        }
        return '';
      };
      let uid = 0;
      const collectFrom = (doc, prefix) => {
        const nodes = Array.from(
          doc.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
        );
        for (const el of nodes) {
          const tag = el.tagName.toLowerCase();
          const typeAttr = (el.getAttribute('type') || '').toLowerCase();
          const isRich = el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox';
          let type = 'text';
          if (tag === 'select') type = 'select';
          else if (tag === 'textarea') type = 'textarea';
          else if (tag === 'input') type = typeAttr || el.type || 'text';
          else if (isRich) type = 'richtext';
          else type = tag;
          if (['submit', 'button', 'reset', 'image', 'hidden', 'file'].includes(type)) continue;
          if (el.disabled) continue;
          if (!isVisible(el)) continue;
          let key = el.getAttribute('data-smartwork-field');
          if (!key) {
            key = 'sw-' + prefix + '-' + uid;
            uid += 1;
            el.setAttribute('data-smartwork-field', key);
          }
          fields.push({
            field_id: el.getAttribute('name') || null,
            id: el.id || null,
            name: el.getAttribute('name') || null,
            label: getLabelText(el, doc) || null,
            ariaName: getAriaName(el, doc) || null,
            placeholder: el.getAttribute('placeholder') || null,
            type: type || null,
            required: Boolean(el.required),
            selector: '[data-smartwork-field="' + key + '"]',
          });
          if (fields.length >= 300) break;
        }
      };
      collectFrom(document, 'main');
      const frames = Array.from(document.querySelectorAll('iframe'));
      frames.forEach((frame, idx) => {
        try {
          const doc = frame.contentDocument;
          if (doc) collectFrom(doc, 'frame' + idx);
        } catch {
          /* ignore */
        }
      });
      return fields;
    })()`;
}

export function buildApplyAutofillActionsScript(actions: FillPlanAction[]) {
  const payload = JSON.stringify(actions);
  return `(() => {
      const actions = ${payload};
      const results = { filled: [], blocked: [] };
      const norm = (s) => (s || '').toLowerCase().replace(/\\s+/g, ' ').trim();
      const escAttr = (doc, v) => {
        const css = doc.defaultView && doc.defaultView.CSS;
        return css && css.escape ? css.escape(v) : v.replace(/["\\\\]/g, '\\\\$&');
      };
      const collectDocs = () => {
        const docs = [document];
        const frames = Array.from(document.querySelectorAll('iframe'));
        frames.forEach((frame) => {
          try {
            const doc = frame.contentDocument;
            if (doc) docs.push(doc);
          } catch {
            /* ignore */
          }
        });
        return docs;
      };
      const dispatch = (el) => {
        const win =
          (el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : window);
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
        el.dispatchEvent(new win.Event('change', { bubbles: true }));
      };
      const selectOption = (el, value) => {
        const val = String(value ?? '');
        const options = Array.from(el.options || []);
        const exact = options.find((o) => o.value === val || o.label === val);
        const soft = options.find((o) => o.label && o.label.toLowerCase() === val.toLowerCase());
        const match = exact || soft;
        if (match) {
          el.value = match.value;
          dispatch(el);
          return true;
        }
        el.value = val;
        dispatch(el);
        return false;
      };
      const setValue = (el, value) => {
        const val = String(value ?? '');
        if (typeof el.focus === 'function') el.focus();
        if (el.isContentEditable) {
          el.textContent = val;
        } else {
          el.value = val;
        }
        dispatch(el);
      };
      const findByLabel = (doc, label) => {
        if (!label) return null;
        const target = norm(label);
        if (!target) return null;
        const labels = Array.from(doc.querySelectorAll('label'));
        for (const lab of labels) {
          const text = norm(lab.textContent || '');
          if (!text) continue;
          if (text === target || text.includes(target)) {
            if (lab.control) return lab.control;
            const forId = lab.getAttribute('for');
            if (forId) return doc.getElementById(forId);
          }
        }
        return null;
      };
      const findByNameOrId = (doc, value) => {
        if (!value) return null;
        const esc = escAttr(doc, String(value));
        return (
          doc.querySelector('[name="' + esc + '"]') ||
          doc.getElementById(value) ||
          doc.querySelector('#' + esc)
        );
      };
      const findByHint = (doc, hint) => {
        if (!hint) return null;
        const target = norm(hint);
        if (!target) return null;
        const nodes = Array.from(
          doc.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
        );
        for (const el of nodes) {
          const placeholder = norm(el.getAttribute('placeholder'));
          const aria = norm(el.getAttribute('aria-label'));
          const name = norm(el.getAttribute('name'));
          const id = norm(el.getAttribute('id'));
          if ([placeholder, aria, name, id].some((v) => v && v.includes(target))) {
            return el;
          }
        }
        return null;
      };
      const findElement = (doc, step) => {
        let el = null;
        if (step.selector && typeof step.selector === 'string') {
          try {
            el = doc.querySelector(step.selector);
          } catch {
            el = null;
          }
        }
        if (!el) el = findByNameOrId(doc, step.field_id || step.field);
        if (!el) el = findByLabel(doc, step.label);
        if (!el) el = findByHint(doc, step.label || step.field_id || step.field);
        return el;
      };
      const docs = collectDocs();
      for (const step of actions) {
        const action = step.action || 'fill';
        if (action === 'skip') continue;
        let el = null;
        for (const doc of docs) {
          el = findElement(doc, step);
          if (el) break;
        }
        if (!el) {
          results.blocked.push(step.field || step.selector || step.label || 'field');
          continue;
        }
        if (action === 'upload') {
          results.blocked.push(step.field || step.selector || 'upload');
          continue;
        }
        if (action === 'click') {
          el.click();
          results.filled.push({ field: step.field || step.selector || 'field', value: 'click' });
          continue;
        }
        if (action === 'check' || action === 'uncheck') {
          if ('checked' in el) {
            el.checked = action === 'check';
            dispatch(el);
            results.filled.push({ field: step.field || step.selector || 'field', value: action });
          } else {
            results.blocked.push(step.field || step.selector || 'field');
          }
          continue;
        }
        if (action === 'select') {
          if (el.tagName.toLowerCase() === 'select') {
            selectOption(el, step.value);
          } else {
            setValue(el, step.value);
          }
          results.filled.push({ field: step.field || step.selector || 'field', value: String(step.value ?? '') });
          continue;
        }
        if (el.tagName.toLowerCase() === 'select') {
          selectOption(el, step.value);
          results.filled.push({ field: step.field || step.selector || 'field', value: String(step.value ?? '') });
          continue;
        }
        setValue(el, step.value);
        results.filled.push({ field: step.field || step.selector || 'field', value: String(step.value ?? '') });
      }
      return results;
    })()`;
}

export function buildReadWebviewSelectionScript() {
  return `(() => {
        const readSelection = (win) => {
          try {
            const sel = win && win.getSelection ? win.getSelection().toString() : '';
            return sel ? sel.trim() : '';
          } catch {
            return '';
          }
        };
        const main = readSelection(window);
        if (main) return main;
        const frames = Array.from(document.querySelectorAll('iframe'));
        for (const frame of frames) {
          try {
            const win = frame.contentWindow;
            const frameSel = readSelection(win);
            if (frameSel) return frameSel;
          } catch {
            /* ignore */
          }
        }
        return window.__smartworkLastSelection || '';
      })()`;
}
