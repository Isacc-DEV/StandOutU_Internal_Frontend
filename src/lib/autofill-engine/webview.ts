import type { Profile as WorkspaceProfile } from "@/app/workspace/types";
import type { Profile as AutofillProfile } from "./profile";
import type { AutofillRuntimeOptions, AutofillRuntimeResult } from "./runtime";
import { buildAutofillProfile } from "./profileAdapter";

export type { AutofillRuntimeOptions, AutofillRuntimeResult };

export function buildAutofillScript(
  profile: AutofillProfile,
  options?: AutofillRuntimeOptions,
  runtimeUrl?: string,
  runtimeSource?: string
) {
  const payload = JSON.stringify(profile ?? {});
  const config = JSON.stringify(options ?? {});
  const runtimeBase = runtimeUrl?.trim()
    ? runtimeUrl.trim()
    : typeof window !== "undefined"
      ? `${window.location.origin}/autofill/runtime.js`
      : "";
  const runtimeUrlJson = JSON.stringify(runtimeBase);
  const runtimeBootstrap = runtimeSource
    ? `
      const runRuntimeSource = () => {
${runtimeSource}
      };
      runRuntimeSource();
`
    : "";
  return `(async () => {
    const payload = ${payload};
    const config = ${config};
    const runtimeUrl = ${runtimeUrlJson};
    const ensureRuntime = async () => {
      if (typeof window.autofillRuntime === "function") return;
      if (runtimeUrl) {
        const existing = document.querySelector('script[data-smartwork-autofill="runtime"]');
        if (!existing) {
          await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = runtimeUrl;
            script.async = true;
            script.dataset.smartworkAutofill = "runtime";
            script.onload = () => {
              script.dataset.loaded = "true";
              resolve(true);
            };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
          });
        } else if (existing instanceof HTMLScriptElement && existing.dataset.loaded !== "true") {
          await new Promise((resolve) => {
            existing.addEventListener("load", () => resolve(true), { once: true });
            existing.addEventListener("error", () => resolve(false), { once: true });
          });
        }
      }
      if (typeof window.autofillRuntime !== "function") {
        ${runtimeBootstrap}
        if (typeof window.autofillRuntime !== "function" && typeof autofillRuntime === "function") {
          window.autofillRuntime = autofillRuntime;
        }
      }
      if (typeof window.autofillRuntime !== "function") {
        throw new Error("Autofill runtime script did not load.");
      }
    };
    await ensureRuntime();
    const runtimeFn =
      typeof window.autofillRuntime === "function" ? window.autofillRuntime : null;
    if (!runtimeFn) {
      throw new Error("Autofill runtime unavailable.");
    }
    return runtimeFn(payload, config);
  })()`;
}

export function buildCollectGreenhouseQuestionsScript(
  profile: AutofillProfile,
  options?: AutofillRuntimeOptions,
  runtimeUrl?: string,
  runtimeSource?: string
) {
  const payload = JSON.stringify(profile ?? {});
  const config = JSON.stringify(options ?? {});
  const runtimeBase = runtimeUrl?.trim()
    ? runtimeUrl.trim()
    : typeof window !== "undefined"
      ? `${window.location.origin}/autofill/runtime.js`
      : "";
  const runtimeUrlJson = JSON.stringify(runtimeBase);
  const runtimeBootstrap = runtimeSource
    ? `
      const runRuntimeSource = () => {
${runtimeSource}
      };
      runRuntimeSource();
`
    : "";
  return `(async () => {
    const payload = ${payload};
    const config = ${config};
    const runtimeUrl = ${runtimeUrlJson};
    const ensureRuntime = async () => {
      if (typeof window.autofillCollectGreenhouseQuestions === "function") return;
      if (runtimeUrl) {
        const existing = document.querySelector('script[data-smartwork-autofill="runtime"]');
        if (!existing) {
          await new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = runtimeUrl;
            script.async = true;
            script.dataset.smartworkAutofill = "runtime";
            script.onload = () => {
              script.dataset.loaded = "true";
              resolve(true);
            };
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
          });
        } else if (existing instanceof HTMLScriptElement && existing.dataset.loaded !== "true") {
          await new Promise((resolve) => {
            existing.addEventListener("load", () => resolve(true), { once: true });
            existing.addEventListener("error", () => resolve(false), { once: true });
          });
        }
      }
      if (typeof window.autofillCollectGreenhouseQuestions !== "function") {
        ${runtimeBootstrap}
        if (
          typeof window.autofillCollectGreenhouseQuestions !== "function" &&
          typeof autofillCollectGreenhouseQuestions === "function"
        ) {
          window.autofillCollectGreenhouseQuestions = autofillCollectGreenhouseQuestions;
        }
      }
      if (typeof window.autofillCollectGreenhouseQuestions !== "function") {
        throw new Error("Autofill runtime script did not load.");
      }
    };
    await ensureRuntime();
    const collectFn =
      typeof window.autofillCollectGreenhouseQuestions === "function"
        ? window.autofillCollectGreenhouseQuestions
        : null;
    if (!collectFn) {
      throw new Error("Autofill question collector unavailable.");
    }
    return collectFn(payload, config);
  })()`;
}

export function buildWorkspaceAutofillProfile(profile: WorkspaceProfile): AutofillProfile {
  return buildAutofillProfile(profile);
}
