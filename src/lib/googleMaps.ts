import { Loader } from "@googlemaps/js-api-loader";
import type { GoogleNamespace } from "@/lib/googleMapsTypes";

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
  version: "weekly",
  libraries: ["places"],
});

let loadPromise: Promise<GoogleNamespace> | null = null;

/** Loads the Google Maps JS SDK exactly once and returns the shared `google` namespace. */
export function loadGoogleMaps(): Promise<GoogleNamespace> {
  if (!loadPromise) {
    loadPromise = loader.load();
  }
  return loadPromise;
}
