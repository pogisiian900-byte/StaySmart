import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    },
  });
  return null;
}

const LocationMap = ({ onLocationChange, initialLocation, initialCoords }) => {
  const [position, setPosition] = useState(initialCoords || [14.5995, 120.9842]); // Default to Manila, Philippines
  const [address, setAddress] = useState(initialLocation || '');

  useEffect(() => {
    if (initialCoords) {
      setPosition(initialCoords);
    }
  }, [initialCoords]);

  useEffect(() => {
    if (initialLocation) {
      setAddress(initialLocation);
    }
  }, [initialLocation]);

  const handleMapClick = async (lat, lng) => {
    setPosition([lat, lng]);
    
    // Reverse geocode to get address
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        const fullAddress = data.display_name;
        setAddress(fullAddress);
        onLocationChange(fullAddress, { lat, lng });
      } else {
        const coordsAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setAddress(coordsAddress);
        onLocationChange(coordsAddress, { lat, lng });
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      const coordsAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setAddress(coordsAddress);
      onLocationChange(coordsAddress, { lat, lng });
    }
  };

  const handleAddressChange = async (e) => {
    const newAddress = e.target.value;
    setAddress(newAddress);
    onLocationChange(newAddress, null);

    // Geocode address if it's not empty and has reasonable length
    if (newAddress.trim().length > 5) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newAddress)}&limit=1&addressdetails=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setPosition([lat, lng]);
          onLocationChange(data[0].display_name || newAddress, { lat, lng });
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
      }
    }
  };

  return (
    <div className="form-label" style={{ width: '100%' }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '8px'
      }}>
        Location:
      </label>
      
      {/* Address input field */}
      <input
        type="text"
        value={address}
        onChange={handleAddressChange}
        placeholder="Enter address or click on map to select location"
        className="form-input"
        style={{
          marginBottom: '12px'
        }}
        required
      />

      {/* Map container */}
      <div style={{
        width: '100%',
        height: '400px',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '2px solid #e5e7eb',
        marginBottom: '8px'
      }}>
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} />
          <MapClickHandler onLocationSelect={handleMapClick} />
        </MapContainer>
      </div>
      
      <p style={{
        fontSize: '0.75rem',
        color: '#6b7280',
        margin: 0,
        fontStyle: 'italic'
      }}>
        Click on the map to set your location, or type an address above
      </p>
    </div>
  );
};

export default LocationMap;

