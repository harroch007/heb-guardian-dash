import type { Page } from "@playwright/test";

export async function installSyntheticMaps(page: Page) {
  // Minimal offline rendering boundary; no Google Maps or location provider request.
  await page.addInitScript(() => {
      class SyntheticMap {
        constructor(public element: HTMLElement) {}
        setCenter() {}
        setZoom() {}
        fitBounds() {}
      }
      class SyntheticMarker {
        element: HTMLElement;
        constructor(options: { map: SyntheticMap; title: string; icon: { url: string } }) {
          this.element = document.createElement("span");
          this.element.dataset.testid = "synthetic-map-marker";
          this.element.setAttribute("aria-label", options.title);
          this.element.dataset.iconUrl = options.icon.url;
          this.element.textContent = options.title;
          options.map.element.appendChild(this.element);
        }
        setIcon(icon: { url: string }) { this.element.dataset.iconUrl = icon.url; }
        setTitle(title: string) { this.element.setAttribute("aria-label", title); }
        setPosition() {}
        setMap(map: SyntheticMap | null) { if (!map) this.element.remove(); }
        addListener() {}
      }
      class SyntheticInfoWindow {
        setContent() {}
        open() {}
        close() {}
      }
      Object.defineProperty(window, "google", { value: { maps: {
        version: "synthetic-offline", Map: SyntheticMap, Marker: SyntheticMarker,
        InfoWindow: SyntheticInfoWindow, Size: class {}, Point: class {},
        LatLngBounds: class { extend() {} }, event: { clearListeners() {} },
      } } });
  });
}
