interface LocationMapProps {
  latitude: number;
  longitude: number;
  name?: string;
  height?: string;
}

export function LocationMap({ latitude, longitude, name, height = '200px' }: LocationMapProps) {
  // Using OpenStreetMap embed via iframe - no external dependencies needed
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  
  return (
    <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden border border-border">
      <iframe
        title={name ? `מיקום ${name}` : 'מפת מיקום'}
        src={mapUrl}
        style={{ width: '100%', height: '100%', border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
