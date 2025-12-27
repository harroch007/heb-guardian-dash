interface LocationMapProps {
  latitude: number;
  longitude: number;
  name?: string;
}

export function LocationMap({ latitude, longitude, name }: LocationMapProps) {
  // Using OpenStreetMap embed via iframe - no external dependencies needed
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  
  return (
    <div className="h-[140px] sm:h-[180px] md:h-[220px] w-full rounded-xl overflow-hidden border border-border">
      <iframe
        title={name ? `מיקום ${name}` : 'מפת מיקום'}
        src={mapUrl}
        className="w-full h-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
