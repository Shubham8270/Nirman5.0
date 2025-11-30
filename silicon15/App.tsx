import { useState, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { InfoPanel } from './components/InfoPanel';
import { MapView } from './components/MapView';
import { LocationSelector } from './components/LocationSelector';
import { Flame, AlertTriangle } from 'lucide-react';
import io from 'socket.io-client'; // <--- 1. NEW: Import Socket.io client

// Define the WebSocket server URL (Must match the port in server.js)
const WEBSOCKET_SERVER_URL = 'http://localhost:4000'; 

// Interface for the data coming from the Node.js bridge
export interface RealTimeData {
  sensorId: string; // The ID of the sensor sending the data (e.g., "sensor-0-0")
  temperature: number;
  smokeLevel: number;
}


export interface Sensor {
  id: string;
  q: number; // axial coordinate
  r: number; // axial coordinate
  lat: number; // latitude
  lng: number; // longitude
  temperature: number;
  smokeLevel: number;
  isActive: boolean;
  alertLevel: 'none' | 'low' | 'medium' | 'high';
}

export interface FireSource {
  q: number;
  r: number;
  intensity: number;
}

export interface ForestLocation {
// ... (Your ForestLocation interface remains the same) ...
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export const FOREST_LOCATIONS: ForestLocation[] = [
// ... (Your FOREST_LOCATIONS array remains the same) ...
  {
    id: 'kanha',
    name: 'Kanha National Park',
    state: 'Madhya Pradesh',
    lat: 22.3351,
    lng: 80.6119,
  },
  {
    id: 'corbett',
    name: 'Jim Corbett National Park',
    state: 'Uttarakhand',
    lat: 29.5308,
    lng: 78.7739,
  },
  {
    id: 'bandipur',
    name: 'Bandipur National Park',
    state: 'Karnataka',
    lat: 11.6643,
    lng: 76.5764,
  },
  {
    id: 'sundarbans',
    name: 'Sundarbans National Park',
    state: 'West Bengal',
    lat: 21.9497,
    lng: 89.1833,
  },
  {
    id: 'kaziranga',
    name: 'Kaziranga National Park',
    state: 'Assam',
    lat: 26.5775,
    lng: 93.1711,
  },
  {
    id: 'periyar',
    name: 'Periyar National Park',
    state: 'Kerala',
    lat: 9.4647,
    lng: 77.2350,
  },
  {
    id: 'ranthambore',
    name: 'Ranthambore National Park',
    state: 'Rajasthan',
    lat: 26.0173,
    lng: 76.5026,
  },
  {
    id: 'gir',
    name: 'Gir National Park',
    state: 'Gujarat',
    lat: 21.1258,
    lng: 70.7972,
  },
  {
    id: 'simlipal',
    name: 'Simlipal National Park',
    state: 'Odisha',
    lat: 21.7326,
    lng: 86.2586,
  },
  {
    id: 'betla',
    name: 'Betla National Park',
    state: 'Jharkhand',
    lat: 23.8788,
    lng: 84.1919,
  },
];

export default function App() {
  const [sensors, setSensors] = useState([] as Sensor[]);
  const [fireSource, setFireSource] = useState(null as FireSource | null);
  const [detectedOrigin, setDetectedOrigin] = useState(null as { q: number; r: number } | null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState(null as Sensor | null);
  const [currentLocation, setCurrentLocation] = useState(FOREST_LOCATIONS[0] as ForestLocation);

  const latSpacing = 0.002; // approximately 220 meters
  const lngSpacing = 0.0023; // approximately 220 meters

  // Convert hex coordinates to lat/lng based on current location
  const hexToLatLng = (q: number, r: number) => {
    const x = lngSpacing * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    const y = latSpacing * ((3 / 2) * r);
    return {
      lat: currentLocation.lat + y,
      lng: currentLocation.lng + x,
    };
  };

  // Initialize hexagonal grid of sensors
  const initializeSensors = () => {
    const gridRadius = 4;
    const newSensors: Sensor[] = [];

    for (let q = -gridRadius; q <= gridRadius; q++) {
      const r1 = Math.max(-gridRadius, -q - gridRadius);
      const r2 = Math.min(gridRadius, -q + gridRadius);
      for (let r = r1; r <= r2; r++) {
        const { lat, lng } = hexToLatLng(q, r);
        newSensors.push({
          id: `sensor-${q}-${r}`,
          q,
          r,
          lat,
          lng,
          temperature: 20 + Math.random() * 5, // Normal temperature
          smokeLevel: 0,
          isActive: true,
          alertLevel: 'none',
        });
      }
    }

    setSensors(newSensors);
  };

  // Initialize sensors on mount and when location changes
  useEffect(() => {
    initializeSensors();
    // Reset simulation state when changing location
    setIsSimulating(false);
    setFireSource(null);
    setDetectedOrigin(null);
    setSelectedSensor(null);
  }, [currentLocation]);

  // Calculate distance between two hexagonal coordinates (Kept for map logic)
  const hexDistance = (q1: number, r1: number, q2: number, r2: number) => {
    return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
  };

  // ----------------------------------------------------------------------
  // 2. NEW: WEBSOCKET DATA STREAM HANDLER
  // ----------------------------------------------------------------------
  useEffect(() => {
    const socket = io(WEBSOCKET_SERVER_URL);

    socket.on('connect', () => {
      console.log('WS: Connected to real-time bridge');
    });

    // Listen for the 'sensorData' event sent by the Node.js bridge
    socket.on('sensorData', (data: RealTimeData) => {
      console.log('WS: Received data for:', data.sensorId);

      setSensors((prevSensors) => 
        prevSensors.map((sensor) => {
          if (sensor.id === data.sensorId) {
            
            // Calculate new alert level based on received real data
            let alertLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
            if (data.temperature > 40 || data.smokeLevel > 30) alertLevel = 'low';
            if (data.temperature > 60 || data.smokeLevel > 60) alertLevel = 'medium';
            if (data.temperature > 80 || data.smokeLevel > 80) alertLevel = 'high';

            return {
              ...sensor,
              temperature: data.temperature,
              smokeLevel: data.smokeLevel,
              alertLevel: alertLevel, // Update alert status based on real data
            };
          }
          return sensor;
        })
      );
    });

    // Cleanup function: disconnect when the component unmounts
    return () => {
      socket.disconnect();
      console.log('WS: Disconnected from bridge');
    };
  }, []); // Run only once on mount

  // ----------------------------------------------------------------------
  // 3. REMOVED/UPDATED LOGIC
  // ----------------------------------------------------------------------
  
  // The original 'Update sensor readings based on fire source' useEffect is REMOVED.
  // The sensor data is now updated by the WebSocket.

  // Detect fire origin using triangulation (KEPT, but now reacts to real data)
  useEffect(() => {
    // This logic now runs whenever the 'sensors' state is updated by the WebSocket
    const highAlertSensors = sensors.filter(
      (s) => s.alertLevel === 'high' || s.alertLevel === 'medium'
    );

    if (highAlertSensors.length >= 3) {
      // Use weighted average based on alert levels
      let totalWeight = 0;
      let weightedQ = 0;
      let weightedR = 0;

      highAlertSensors.forEach((sensor) => {
        const weight = sensor.alertLevel === 'high' ? 3 : sensor.alertLevel === 'medium' ? 2 : 1;
        totalWeight += weight;
        weightedQ += sensor.q * weight;
        weightedR += sensor.r * weight;
      });

      setDetectedOrigin({
        q: Math.round(weightedQ / totalWeight),
        r: Math.round(weightedR / totalWeight),
      });
    } else {
      setDetectedOrigin(null);
    }
  }, [sensors]); // isSimulating dependency is removed

  const startFireSimulation = (q: number, r: number) => {
    // UPDATED: This now only places the visual marker for simulation, 
    // it DOES NOT start the sensor data simulation.
    setFireSource({ q, r, intensity: 1 });
    setIsSimulating(true); 
    setSelectedSensor(null);
  };

  const handleSensorSelect = (sensor: Sensor) => {
    // isSimulating check is unnecessary if controls are disabled
    setSelectedSensor(sensor);
  };

  const stopSimulation = () => {
    // UPDATED: This only resets the visual markers, it doesn't reset real sensor data.
    setIsSimulating(false);
    setFireSource(null);
    setDetectedOrigin(null);
    
    // Note: Sensor data reset is removed to allow real-time stream to continue.
    // If you need to stop the real-time stream, you must stop the ESP32 transmitter.
  };

  const randomFire = () => {
    const randomSensor = sensors[Math.floor(Math.random() * sensors.length)];
    startFireSimulation(randomSensor.q, randomSensor.r);
  };

  const handleLocationChange = (locationId: string) => {
    const location = FOREST_LOCATIONS.find(loc => loc.id === locationId);
    if (location) {
      setCurrentLocation(location);
    }
  };

  return (
    // ... (The rest of your return JSX remains the same) ...
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-emerald-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-600" />
              <div>
                <h1 className="text-gray-900">Forest Fire Detection System</h1>
                <p className="text-gray-600 text-sm">Real-time Sensor Network Monitoring - India</p>
              </div>
            </div>
            <LocationSelector
              locations={FOREST_LOCATIONS}
              currentLocation={currentLocation}
              onLocationChange={handleLocationChange}
              disabled={isSimulating}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Info */}
          <div className="lg:col-span-1 space-y-6">
            <InfoPanel
              sensors={sensors}
              fireSource={fireSource}
              detectedOrigin={detectedOrigin}
              isSimulating={isSimulating}
              selectedSensor={selectedSensor}
              currentLocation={currentLocation}
            />
          </div>

          {/* Right - Map and Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Geographic Map View */}
            <MapView
              sensors={sensors}
              selectedSensor={selectedSensor}
              fireSource={fireSource}
              detectedOrigin={detectedOrigin}
              onSensorSelect={handleSensorSelect}
              currentLocation={currentLocation}
            />

            {/* Control Panel */}
            <ControlPanel
              isSimulating={isSimulating}
              onRandomFire={randomFire}
              onStop={stopSimulation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Removed accidental global helper functions — use the component's useState setters instead.
