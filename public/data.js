(() => {
  if (window.__GAA_CATALOGUE_LOADING__) return;
  window.__GAA_CATALOGUE_LOADING__ = true;

  const locationHref = location.href || `${location.origin}${location.pathname}${location.search || ""}${location.hash || ""}`;
  const siteRoot = new URL(document.querySelector('meta[name="gaa-site-root"]')?.content || "/", locationHref);
  const asset = name => new URL(name, siteRoot).href;
  const catalogueRequest = fetch(asset("catalogue.json?v=catalogue-4"), { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(`Catalogue request failed with ${response.status}`);
      return response.json();
    });
  const linkStatusRequest = fetch(asset("link-status.json?v=trust-4"), { cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null);
  const thumbnailRequest = fetch(asset("thumbnail-manifest.json?v=thumbnails-4"), { cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null);

  Promise.all([catalogueRequest, linkStatusRequest, thumbnailRequest])
    .then(([catalogue, linkStatus, thumbnails]) => {
      if (!catalogue || !Array.isArray(catalogue.resources) || !Array.isArray(catalogue.collections)) throw new Error("Catalogue data is incomplete");
      catalogue.linkStatus = linkStatus && Array.isArray(linkStatus.results) ? linkStatus : null;
      catalogue.thumbnails = thumbnails?.resources ? thumbnails : null;
      window.GAA = catalogue;
      window.__GAA_CATALOGUE_LOADING__ = false;
      document.dispatchEvent(new Event("gaa-ready"));
    })
    .catch(error => {
      window.__GAA_CATALOGUE_LOADING__ = false;
      window.__GAA_CATALOGUE_ERROR__ = error;
      console.error("Games as Art catalogue failed to load", error);
      document.dispatchEvent(new CustomEvent("gaa-error", { detail: { message: error.message } }));
    });
})();
