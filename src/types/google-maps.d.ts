// Minimal ambient declarations for the Google Maps JS API global.
// The real runtime types come from the script loaded at runtime.
declare namespace google {
  namespace maps {
    type Map = any;
    type Marker = any;
    type InfoWindow = any;
    type LatLng = any;
    type LatLngLiteral = any;
    type LatLngBounds = any;
    type MapOptions = any;
    type MarkerOptions = any;
    type Geocoder = any;
    type GeocoderResult = any;
    type MapMouseEvent = any;
    type Size = any;
    type Point = any;
    namespace places {
      type Autocomplete = any;
      type AutocompleteService = any;
      type PlaceResult = any;
      type AutocompletePrediction = any;
      type PlacesService = any;
    }
  }
}

declare const google: any;
