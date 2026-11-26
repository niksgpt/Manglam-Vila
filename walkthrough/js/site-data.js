/* The site and the sun, made in Blender by blender/sun_path.py (do not edit by hand: run that
   script again). rearBearing: the way the rear of the house faces, degrees from north.
   keys: the sun (or moon) at each moment of the walkthrough's day, d = direction to it in
   the walkthrough's axes (x, up, z = plan y). */
window.SITE = {
 "name": "Manglam Vila",
 "lat": 26.98889,
 "lon": 75.85444,
 "tz": 5.5,
 "date": "2026-09-23",
 "rearBearing": 132.0,
 "sides": {
  "rear": {
   "bearing": 132.0,
   "name": "SE"
  },
  "front": {
   "bearing": 312.0,
   "name": "NW"
  },
  "xLow": {
   "bearing": 42.0,
   "name": "NE"
  },
  "xHigh": {
   "bearing": 222.0,
   "name": "SW"
  }
 },
 "sunrise": 6.267,
 "noon": 12.317,
 "sunset": 18.383,
 "keys": [
  {
   "name": "Morning",
   "h": 7.0,
   "bearing": 94.7,
   "elevation": 9.18,
   "d": [
    -0.5983,
    0.1596,
    -0.7852
   ]
  },
  {
   "name": "Midday",
   "h": 12.5,
   "bearing": 186.0,
   "elevation": 62.78,
   "d": [
    0.37,
    0.8893,
    -0.2689
   ]
  },
  {
   "name": "Afternoon",
   "h": 16.5,
   "bearing": 256.68,
   "elevation": 24.02,
   "d": [
    0.7511,
    0.4071,
    0.5197
   ]
  },
  {
   "name": "Sunset",
   "h": 18.25,
   "bearing": 269.37,
   "elevation": 1.17,
   "d": [
    0.6763,
    0.0523,
    0.7347
   ]
  },
  {
   "name": "Dusk",
   "h": 18.9,
   "bearing": 273.81,
   "elevation": -7.9,
   "d": [
    0.6174,
    0.0523,
    0.7849
   ]
  },
  {
   "name": "Dusk",
   "h": 19.2,
   "bearing": 275.91,
   "elevation": -11.9,
   "d": [
    0.5883,
    0.0523,
    0.807
   ]
  },
  {
   "name": "Evening",
   "h": 19.5,
   "bearing": 72.0,
   "elevation": 38.0,
   "moon": true,
   "d": [
    -0.6824,
    0.6157,
    -0.394
   ]
  },
  {
   "name": "Night",
   "h": 21.5,
   "bearing": 70.0,
   "elevation": 44.0,
   "moon": true,
   "d": [
    -0.6351,
    0.6947,
    -0.3377
   ]
  }
 ]
};
