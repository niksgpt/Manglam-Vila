"""The site and the sun, made in Blender: where the house faces and where the sun stands at each
moment of the walkthrough's day, written to js/site-data.js (window.SITE) for the walkthrough and
the plan editor.

Run (Blender in the background, no window):
    blender --background --factory-startup --python sun_path.py -- <out site-data.js>

The sun is found with the NOAA solar position method (the one Blender's Sun Position add-on
uses; that add-on is not bundled with Blender 5, so the method is written out here). Each moment
is also set up as a Sun lamp in a Blender scene, turned to the true orientation of the house,
and saved beside this script as site-sun.blend for checking in Blender.

Axes: the walkthrough's plan has x across the plot and y from the rear wall (y = 0) to the road.
The rear of the house faces REAR_BEARING (degrees clockwise from north, looking out of the rear
door). A direction with bearing b runs along the plan at (sin(b - REAR), -cos(b - REAR)); in the
walkthrough's 3D axes (x, up, z = plan y) the direction to the sun is
    [cos(el) sin(b - REAR), sin(el), -cos(el) cos(b - REAR)].
"""
import json
import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = ARGS[0] if ARGS else os.path.join(HERE, '..', 'js', 'site-data.js')

# --- the site (from the architect) --------------------------------------------------------
NAME = 'Manglam Vila'
LAT = 26 + 59 / 60 + 20 / 3600        # 26 deg 59' 20" N
LON = 75 + 51 / 60 + 16 / 3600        # 75 deg 51' 16" E
TZ = 5.5                              # India Standard Time, UTC + 5:30
REAR_BEARING = 132.0                  # standing in the rear-thin door, looking out: SE, 132 deg
DATE = (2026, 9, 23)                  # the September equinox: the year's average sun path

# the walkthrough's moments of the day (hours, as in lighting.js); after sunset the light
# comes from the sky glow where the sun went down, and at night from the moon
MOMENTS = [('Morning', 7.0), ('Midday', 12.5), ('Afternoon', 16.5), ('Sunset', 18.25),
           ('Dusk', 18.9), ('Dusk', 19.2)]
MOON = {'Evening': (19.5, 72.0, 38.0), 'Night': (21.5, 70.0, 44.0)}   # hour, bearing, elevation


def rad(v):
    return math.radians(v)


def deg(v):
    return math.degrees(v)


def julian_day(y, m, d):
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + d + b - 1524.5


def sun_at(hour):
    """Bearing (clockwise from north) and elevation of the sun, degrees, at local clock time."""
    jd = julian_day(*DATE) + (hour - TZ) / 24.0
    jc = (jd - 2451545.0) / 36525.0
    L = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360
    Ma = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
    e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
    C = (math.sin(rad(Ma)) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
         + math.sin(rad(2 * Ma)) * (0.019993 - 0.000101 * jc) + math.sin(rad(3 * Ma)) * 0.000289)
    app = L + C - 0.00569 - 0.00478 * math.sin(rad(125.04 - 1934.136 * jc))
    obl0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
    obl = obl0 + 0.00256 * math.cos(rad(125.04 - 1934.136 * jc))
    decl = deg(math.asin(math.sin(rad(obl)) * math.sin(rad(app))))
    vy = math.tan(rad(obl / 2)) ** 2
    eot = 4 * deg(vy * math.sin(2 * rad(L)) - 2 * e * math.sin(rad(Ma))
                  + 4 * e * vy * math.sin(rad(Ma)) * math.cos(2 * rad(L))
                  - 0.5 * vy * vy * math.sin(4 * rad(L)) - 1.25 * e * e * math.sin(2 * rad(Ma)))
    tst = (hour * 60 + eot + 4 * LON - 60 * TZ) % 1440
    ha = tst / 4 + 180 if tst / 4 < 0 else tst / 4 - 180
    cz = (math.sin(rad(LAT)) * math.sin(rad(decl))
          + math.cos(rad(LAT)) * math.cos(rad(decl)) * math.cos(rad(ha)))
    zen = deg(math.acos(max(-1.0, min(1.0, cz))))
    el = 90 - zen
    if el > -0.575:  # atmospheric refraction near the horizon (NOAA)
        te = math.tan(rad(el))
        if el > 85:
            r = 0
        elif el > 5:
            r = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5
        else:
            r = 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)))
        el += r / 3600
    ca = ((math.sin(rad(LAT)) * math.cos(rad(zen))) - math.sin(rad(decl))) / (math.cos(rad(LAT)) * math.sin(rad(zen)))
    a = deg(math.acos(max(-1.0, min(1.0, ca))))
    az = (a + 180) % 360 if ha > 0 else (540 - a) % 360
    return az, el, eot


def events():
    """Sunrise, solar noon and sunset (clock hours), by stepping the sun through the day."""
    rise = sett = None
    prev = sun_at(0)[1]
    for k in range(1, 24 * 60 + 1):
        h = k / 60
        el = sun_at(h)[1]
        if prev < -0.833 <= el and rise is None:
            rise = h
        if prev >= -0.833 > el:
            sett = h
        prev = el
    noon = max(((sun_at(k / 60)[1], k / 60) for k in range(9 * 60, 15 * 60)))[1]
    return rise, noon, sett


def direction(bearing, el):
    """Direction toward a body, in the walkthrough's axes (x, up, z = plan y)."""
    p = rad(bearing - REAR_BEARING)
    return [math.cos(rad(el)) * math.sin(p), math.sin(rad(el)), -math.cos(rad(el)) * math.cos(p)]


def side(bearing):
    names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    return names[int(((bearing % 360) + 22.5) // 45) % 8]


rise, noon, sett = events()
keys = []
for name, h in MOMENTS:
    az, el, _ = sun_at(h)
    # after sunset the light is the glow low on the horizon where the sun went down
    keys.append({'name': name, 'h': h, 'bearing': round(az, 2), 'elevation': round(el, 2),
                 'd': [round(v, 4) for v in direction(az, max(el, 3.0 if el < 3 else el))]})
for name, (h, az, el) in MOON.items():
    keys.append({'name': name, 'h': h, 'bearing': az, 'elevation': el, 'moon': True,
                 'd': [round(v, 4) for v in direction(az, el)]})

# the house's sides on the compass (plan directions)
sides = {'rear': REAR_BEARING % 360, 'front': (REAR_BEARING + 180) % 360,
         'xLow': (REAR_BEARING - 90) % 360, 'xHigh': (REAR_BEARING + 90) % 360}
site = {
    'name': NAME, 'lat': round(LAT, 5), 'lon': round(LON, 5), 'tz': TZ,
    'date': '%04d-%02d-%02d' % DATE, 'rearBearing': REAR_BEARING,
    'sides': {k: {'bearing': v, 'name': side(v)} for k, v in sides.items()},
    'sunrise': round(rise, 3), 'noon': round(noon, 3), 'sunset': round(sett, 3),
    'keys': keys,
}

# --- the same in a Blender scene, for checking: a sun lamp per moment, the house's axes --------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for k in keys:
    lamp = bpy.data.lights.new(k['name'] + ' %.2f' % k['h'], 'SUN')
    ob = bpy.data.objects.new(lamp.name, lamp)
    scene.collection.objects.link(ob)
    # Blender: x = plan x, y = -plan y (rear toward +y), z up; a sun lamp shines along its -z
    d = k['d']
    to_sun = (d[0], -d[2], d[1])
    ob.rotation_mode = 'QUATERNION'
    from mathutils import Vector
    ob.rotation_quaternion = Vector(to_sun).to_track_quat('Z', 'Y')
    ob.location = (to_sun[0] * 40, to_sun[1] * 40, to_sun[2] * 40)
for nm, b in [('North', 0), ('East', 90), ('South', 180), ('West', 270)]:
    e = bpy.data.objects.new('to ' + nm, None)
    e.empty_display_type = 'SINGLE_ARROW'
    e.empty_display_size = 20
    p = rad(b - REAR_BEARING)
    e.rotation_euler = (math.pi / 2, 0, math.atan2(-math.sin(p), math.cos(p)) - math.pi / 2)  # arrow along the bearing
    scene.collection.objects.link(e)
try:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'site-sun.blend'))
except Exception as err:  # the scene is only for checking
    print('could not save site-sun.blend:', err)

js = ('/* The site and the sun, made in Blender by blender/sun_path.py (do not edit by hand: run that\n'
      '   script again). rearBearing: the way the rear of the house faces, degrees from north.\n'
      '   keys: the sun (or moon) at each moment of the walkthrough\'s day, d = direction to it in\n'
      '   the walkthrough\'s axes (x, up, z = plan y). */\n'
      'window.SITE = ' + json.dumps(site, indent=1) + ';\n')
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
print('site', NAME, 'lat %.4f lon %.4f' % (LAT, LON), 'rear faces %s (%.0f deg)' % (side(REAR_BEARING), REAR_BEARING))
print('sunrise %.2f  noon %.2f  sunset %.2f (clock hours)' % (rise, noon, sett))
for k in keys:
    print('%-9s %5.2f h  bearing %6.1f (%s)  elevation %5.1f  d %s' % (k['name'], k['h'], k['bearing'], side(k['bearing']), k['elevation'], k['d']))
print('wrote', OUT)
