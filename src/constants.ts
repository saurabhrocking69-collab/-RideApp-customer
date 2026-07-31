export const API = 'https://api.sppero.com';

// Lives here, not in WelcomeScreen: AppContext needs it during boot, and
// WelcomeScreen needs useApp() from AppContext — importing the key from the
// screen would make that a cycle with the context at the root of it.
export const WELCOME_SEEN_KEY = 'welcomeSeen';
export const MAPS_KEY = 'AIzaSyAK3HFrZsahMLNVUFgxGAQMw_6OATDD8q4';

export const DEFAULT_HOURLY_PACKAGES: any = {
  auto:          { 2:{fare:180,km:20}, 4:{fare:320,km:40}, 6:{fare:460,km:60}, 8:{fare:580,km:80},  24:{fare:1500,km:200}, 48:{fare:2800,km:400}, 72:{fare:4000,km:600}, extra:8  },
  bike:          { 2:{fare:120,km:20}, 4:{fare:210,km:40}, 6:{fare:300,km:60}, 8:{fare:380,km:80},  24:{fare:1000,km:200}, 48:{fare:1800,km:400}, 72:{fare:2600,km:600}, extra:5  },
  car:           { 2:{fare:260,km:20}, 4:{fare:460,km:40}, 6:{fare:660,km:60}, 8:{fare:840,km:80},  24:{fare:2200,km:200}, 48:{fare:4000,km:400}, 72:{fare:5800,km:600}, extra:12 },
  eriksha:       { 2:{fare:150,km:20}, 4:{fare:270,km:40}, 6:{fare:390,km:60}, 8:{fare:490,km:80},  24:{fare:1200,km:200}, 48:{fare:2200,km:400}, 72:{fare:3200,km:600}, extra:7  },
  ultra_luxury:  { 2:{fare:800,km:20}, 4:{fare:1400,km:40}, 6:{fare:2000,km:60}, 8:{fare:2600,km:80}, 24:{fare:6000,km:200}, 48:{fare:10000,km:400}, 72:{fare:14000,km:600}, extra:25 },
  green_bike:    { 2:{fare:100,km:20}, 4:{fare:180,km:40}, 6:{fare:260,km:60}, 8:{fare:330,km:80},  24:{fare:850,km:200},  48:{fare:1500,km:400}, 72:{fare:2200,km:600}, extra:4  },
  electric_auto: { 2:{fare:130,km:20}, 4:{fare:240,km:40}, 6:{fare:350,km:60}, 8:{fare:440,km:80},  24:{fare:1100,km:200}, 48:{fare:2000,km:400}, 72:{fare:2900,km:600}, extra:6  },
};

export const RIDES = [
  { id: 'bike',          icon: '🏍️', label: 'Bike',          base: 15, rate: 8,  eta: '2-3 min',  tag: 'FASTEST',  tagColor: '#FF6B35', desc: 'Fastest — cuts through traffic' },
  { id: 'auto',          icon: '🛺', label: 'Auto',           base: 25, rate: 12, eta: '3-5 min',  tag: null,       tagColor: '',        desc: 'Budget friendly ride' },
  { id: 'car',           icon: '🚕', label: 'Car',            base: 40, rate: 15, eta: '5-7 min',  tag: 'POPULAR',  tagColor: '#2196F3', desc: 'AC • Comfortable' },
  { id: 'eriksha',       icon: '🛵', label: 'E-Riksha',       base: 20, rate: 10, eta: '4-6 min',  tag: 'ECO',      tagColor: '#4CAF50', desc: 'Eco-friendly ride' },
  { id: 'green_bike',    icon: '⚡', label: 'Green Bike',     base: 12, rate: 6,  eta: '2-4 min',  tag: 'GREEN',    tagColor: '#2e7d32', desc: 'Electric Bike • Zero Emission' },
  { id: 'electric_auto', icon: '🌿', label: 'Electric Auto',  base: 20, rate: 9,  eta: '3-5 min',  tag: 'GREEN',    tagColor: '#2e7d32', desc: 'Electric Auto • Eco Ride' },
  { id: 'luxury',        icon: '🚙', label: 'Ultra Luxury',   base: 80, rate: 25, eta: '7-10 min', tag: 'PREMIUM',  tagColor: '#9C27B0', desc: 'Premium SUV experience' },
];

export const rideIcon = (type: string) =>
  type === 'auto' ? '🛺' : type === 'bike' ? '🏍️' : type === 'eriksha' ? '🛵' :
  type === 'luxury' ? '🚙' : type === 'green_bike' ? '⚡' : type === 'electric_auto' ? '🌿' : '🚕';
