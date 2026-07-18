(() => {
  if (window.__GAA_CATALOGUE_LOADING__) return;
  window.__GAA_CATALOGUE_LOADING__ = true;

  const catalogueRequest = fetch("/catalogue.json?v=catalogue-3", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(`Catalogue request failed with ${response.status}`);
      return response.json();
    });
  const linkStatusRequest = fetch("/link-status.json?v=trust-3", { cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null);
  const thumbnailRequest = fetch("/thumbnail-manifest.json?v=thumbnails-3", { cache: "no-store" }).then(response => response.ok ? response.json() : null).catch(() => null);

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
