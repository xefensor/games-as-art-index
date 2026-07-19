"use client";

import { useEffect } from "react";
import template from "../index.html?raw";

const bodyMarkup = template
  .match(/<body>([\s\S]*?)<\/body>/i)?.[1]
  .replace(/<script[\s\S]*?<\/script>/gi, "") ?? "";

export default function HomeClient() {
  useEffect(() => {
    if (window.__GAA_INITIALIZED__) {
      requestAnimationFrame(() => window.__GAA_RESTORE__?.());
      return;
    }
    if (window.__GAA_RUNTIME_LOADING__) return;
    window.__GAA_RUNTIME_LOADING__ = true;

    const loadScript = (src, id) => new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-gaa-runtime="${id}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.dataset.gaaRuntime = id;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", reject, { once: true });
      document.body.appendChild(script);
    });

    loadScript("/data.js?v=index-13", "data")
      .then(() => loadScript("/app.js?v=index-13", "app"))
      .catch((error) => {
        window.__GAA_RUNTIME_LOADING__ = false;
        console.error("Games as Art failed to initialize", error);
        const content = document.querySelector("#content");
        if (content) content.innerHTML = '<section class="runtime-error shell"><h1>The page could not load.</h1><p>Please refresh to try again.</p></section>';
      });
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />;
}
