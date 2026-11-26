"""Furniture models for the walkthrough, made in Blender.

Run (Blender in the background, no window):
    blender --background --factory-startup --python make_furniture.py -- <out models-data.js>

What it makes (units: feet; each model sits on y = 0, centred on x and z, front toward +z
in the walkthrough's axes):
  soft upholstery  seat / back cushions with piping, throw and bed pillows with pinched corners
  bedding          duvet and runner draped over the mattress with Blender's cloth simulation
  plants           potted plants with real leaf shapes (two sizes)
  lamps            turned lamp shades, a table-lamp base, a pendant dome
  fittings         railing parts (chamfered post, pyramid cap, round bar, rounded handrail) and
                   a 4" skirting with a rounded top edge. These are made one foot long (or high)
                   and the walkthrough stretches them to each railing run and each wall.

Every model is split into parts by role ("fab", "pipe", "pot", "leaf", "shade", ...). The
walkthrough paints each role with a material of the chosen style, so one model serves all
three styles. The result is written as a small script (window.FURNITURE_MODELS) that the
walkthrough loads and that build.py puts inside the single HTML file.
"""
import base64
import json
import math
import os
import random
import struct
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'models-data.js')
HOME_NAME = ARGS[1] if len(ARGS) > 1 else 'Manglam Vila'   # lettering on the gate pier's name plate
random.seed(11)
PI = math.pi


# --------------------------------------------------------------------------------------------
# scene helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def from_bmesh(name, bm, smooth=True, sharp_deg=None):
    if sharp_deg is not None:
        lim = math.radians(sharp_deg)
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
                e.smooth = False
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    me.update()
    return link(bpy.data.objects.new(name, me))


def from_data(name, verts, faces, smooth=True, sharp_deg=None):
    bm = bmesh.new()
    bv = [bm.verts.new(v) for v in verts]
    for f in faces:
        try:
            bm.faces.new([bv[i] for i in f])
        except ValueError:
            pass
    bm.normal_update()
    return from_bmesh(name, bm, smooth, sharp_deg)


# --------------------------------------------------------------------------------------------
# shapes
def soft_box(name, A, B, C, r, rz=None, cuts=5, crown=0.0, puff=0.0, sag=0.0, wobble=0.0):
    """Rounded, slightly domed box: a cushion. Half sizes A (x), B (y), C (z)."""
    rz = r if rz is None else rz
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    ease = lambda t: math.copysign(1 - (1 - abs(t)) ** 1.7, t)  # more rows near the edges
    for v in bm.verts:
        x, y, z = ease(v.co.x) * A, ease(v.co.y) * B, ease(v.co.z) * C
        ix, iy, iz = max(-(A - r), min(A - r, x)), max(-(B - r), min(B - r, y)), max(-(C - rz), min(C - rz, z))
        d = Vector(((x - ix) / r, (y - iy) / r, (z - iz) / rz))
        if d.length > 1e-9:
            d.normalize()
        q = Vector((ix + d.x * r, iy + d.y * r, iz + d.z * rz))
        fx, fy = max(0.0, 1 - (q.x / A) ** 2), max(0.0, 1 - (q.y / B) ** 2)
        if q.z > 0:
            q.z += crown * fx * fy - sag * fx * fy * fx
        else:
            q.z -= crown * 0.25 * fx * fy
        side = max(0.0, 1 - (q.z / C) ** 2)
        q.x *= 1 + puff * side * fy
        q.y *= 1 + puff * side * fx
        if wobble:
            q.z += wobble * math.sin(q.x * 3.1 + 0.7) * math.sin(q.y * 2.3) * fx * fy * (1 if q.z > 0 else 0.4)
        v.co = q
    bm.normal_update()
    return from_bmesh(name, bm)


def tube_along(name, pts, radius, sides=5, closed=True):
    """A thin tube (piping) along a path of points."""
    n = len(pts)
    verts, faces = [], []
    for i, p in enumerate(pts):
        a, b = pts[(i - 1) % n] if closed or i > 0 else pts[i], pts[(i + 1) % n] if closed or i < n - 1 else pts[i]
        t = (Vector(b) - Vector(a)).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        nrm = t.cross(up).normalized()
        bi = t.cross(nrm).normalized()
        for k in range(sides):
            ang = 2 * PI * k / sides
            verts.append(tuple(Vector(p) + (nrm * math.cos(ang) + bi * math.sin(ang)) * radius))
    rings = n if closed else n - 1
    for i in range(rings):
        j = (i + 1) % n
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append((i * sides + k, i * sides + k2, j * sides + k2, j * sides + k))
    return from_data(name, verts, faces)


def rounded_rect_path(a, b, r, z, samples=32, warp=None):
    """Points round a rounded rectangle of half sizes a, b with corner radius r, at height z."""
    pts = []
    corners = [(a - r, b - r, 0), (-(a - r), b - r, 90), (-(a - r), -(b - r), 180), (a - r, -(b - r), 270)]
    per = max(3, samples // 4)
    for cx, cy, start in corners:
        for k in range(per):
            ang = math.radians(start + 90 * k / (per - 1))
            x, y = cx + r * math.cos(ang), cy + r * math.sin(ang)
            if warp:
                x, y = warp(x, y)
            pts.append((x, y, z))
    return pts


def lathe(name, prof, seg=28, cap_bottom=False, cap_top=False, smooth=True, sharp_deg=40):
    """Turn a profile [(radius, height), ...] (bottom to top) round the vertical axis."""
    verts, faces = [], []
    m = len(prof)
    for i in range(seg):
        a = 2 * PI * i / seg
        c, s = math.cos(a), math.sin(a)
        for r, z in prof:
            verts.append((r * c, r * s, z))
    for i in range(seg):
        i2 = (i + 1) % seg
        for j in range(m - 1):
            faces.append((i * m + j, i2 * m + j, i2 * m + j + 1, i * m + j + 1))
    if cap_bottom:
        verts.append((0, 0, prof[0][1]))
        c0 = len(verts) - 1
        for i in range(seg):
            faces.append((c0, ((i + 1) % seg) * m, i * m))
    if cap_top:
        verts.append((0, 0, prof[-1][1]))
        c1 = len(verts) - 1
        for i in range(seg):
            faces.append((c1, i * m + m - 1, ((i + 1) % seg) * m + m - 1))
    return from_data(name, verts, faces, smooth, sharp_deg)


def leaf(name, length, width, fold=0.25, droop=0.5, rows=7, cols=4, tip=1.0):
    """One leaf along +x from the origin: pointed tip, a fold along the midrib, drooping."""
    verts, faces = [], []
    for i in range(rows + 1):
        t = i / rows
        half = width * 0.5 * (math.sin(PI * min(1.0, t * 0.92 + 0.04)) ** 0.8) * (1 - 0.25 * t) * (1 if t < 0.999 else 0.05)
        bend = droop * t * t
        x = length * t * math.cos(bend)
        zc = -length * t * math.sin(bend) * 0.6
        for j in range(cols + 1):
            s = -1 + 2 * j / cols
            y = s * half
            z = zc + abs(s) * half * fold - (s * s) * half * 0.08
            verts.append((x, y, z))
    for i in range(rows):
        for j in range(cols):
            a = i * (cols + 1) + j
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    return from_data(name, verts, faces)


def bake(ob):
    """The object with its modifiers applied, as a plain mesh object (custom normals kept)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    nb = link(bpy.data.objects.new(ob.name + '_m', me))
    nb.matrix_world = ob.matrix_world.copy()
    bpy.data.objects.remove(ob)
    return nb


def rounded(ob, r, seg=3, angle=None):
    """Round an object's edges with a bevel that keeps flat faces flat, then bake it."""
    if r > 0.003:
        bv = ob.modifiers.new('round', 'BEVEL')
        bv.width, bv.segments = r, seg
        if angle is None:
            bv.limit_method = 'NONE'
        else:
            bv.limit_method, bv.angle_limit = 'ANGLE', math.radians(angle)
        bv.harden_normals = True
    return bake(ob)


def sweep(name, prof, axis, a0, a1, sharp_deg=50, bevel=0.0, seg=3):
    """A closed profile swept straight along one axis, with end caps: a moulding, a bar, a
    table top or a headboard. axis 'x': prof = [(y, z), ...] from x = a0 to a1; 'y': prof =
    [(x, z), ...] from y = a0 to a1; 'z': prof = [(x, y), ...] from z = a0 to a1. Faces turn
    outward. bevel > 0 rounds the outline's edges (soft, upholstered or eased)."""
    bm = bmesh.new()
    mk = {'x': lambda p, q, t: (t, p, q), 'y': lambda p, q, t: (p, t, q), 'z': lambda p, q, t: (p, q, t)}[axis]
    a = [bm.verts.new(mk(p, q, a0)) for p, q in prof]
    b = [bm.verts.new(mk(p, q, a1)) for p, q in prof]
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.normal_update()
    if bevel > 0:
        return rounded(from_bmesh(name, bm, smooth=True), bevel, seg, angle=35)
    return from_bmesh(name, bm, smooth=True, sharp_deg=sharp_deg)


def rbox(x0, x1, y0, y1, z0, z1, r=0.03, seg=3, name='box'):
    """A box with rounded edges, flat faces kept flat. Blender axes (z up, front toward -y)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((x0 + (v.co.x + 0.5) * (x1 - x0), y0 + (v.co.y + 0.5) * (y1 - y0), z0 + (v.co.z + 0.5) * (z1 - z0)))
    ob = from_bmesh(name, bm, smooth=True)
    return rounded(ob, min(r, (x1 - x0) * 0.48, (y1 - y0) * 0.48, (z1 - z0) * 0.48), seg)


def arc(cx, cz, r, a0, a1, n):
    """Points on a circle in the front view (x, z), from angle a0 to a1 (degrees), n steps."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def leg(x, y, h, r_top=0.065, r_foot=0.04, seg=10):
    """A tapered round leg standing on z = 0."""
    ob = lathe('leg', [(0.0, 0.0), (r_foot, 0.0), (r_top, h), (0.0, h)], seg=seg, sharp_deg=60)
    ob.location = (x, y, 0)
    bpy.context.view_layer.update()
    return ob


def placed(ob, loc, rot=(0, 0, 0)):
    ob.location, ob.rotation_euler = loc, rot
    bpy.context.view_layer.update()
    return ob


def cushion_obj(name, w, d, t, r=0.14, crown=0.04, puff=0.03):
    """A loose cushion w wide, d deep, t thick, lying flat, centred on the origin."""
    return soft_box(name, w / 2, d / 2, t / 2, min(r, w / 2 - 0.02, d / 2 - 0.02), min(r * 0.9, t / 2 - 0.01), crown=crown, puff=puff, wobble=0.004)


def join(objs, name):
    """Join objects into one (same role)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


# --------------------------------------------------------------------------------------------
# export
MODELS = {}


def mesh_arrays(ob):
    """Triangles of the finished object (modifiers applied), in walkthrough axes."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = ob.matrix_world
    nm = mw.to_3x3().inverted().transposed()
    try:
        cn = [c.vector.copy() for c in me.corner_normals]
    except AttributeError:
        cn = [l.normal.copy() for l in me.loops]
    key_to_idx, pos, nor, idx = {}, [], [], []
    for tri in me.loop_triangles:
        for l in tri.loops:
            vi = me.loops[l].vertex_index
            n = (nm @ cn[l]).normalized()
            q = (vi, round(n.x * 63), round(n.y * 63), round(n.z * 63))
            k = key_to_idx.get(q)
            if k is None:
                co = mw @ me.vertices[vi].co
                k = key_to_idx[q] = len(pos)
                pos.append((co.x, co.z, -co.y))   # Blender z-up -> walkthrough y-up, front toward +z
                nor.append((n.x, n.z, -n.y))
            idx.append(k)
    ev.to_mesh_clear()
    # Blender's front face is wound counter-clockwise from outside, and the axis swap keeps it so.
    return pos, nor, idx


def add_model(name, parts, recentre=True):
    """parts: [(role, object)]. Centres the model on x/z and puts its base on y = 0
    (unless recentre is False: then the Blender origin is kept)."""
    arrays = [(role, mesh_arrays(o)) for role, o in parts]
    xs = [p[0] for _, (pos, _, _) in arrays for p in pos]
    ys = [p[1] for _, (pos, _, _) in arrays for p in pos]
    zs = [p[2] for _, (pos, _, _) in arrays for p in pos]
    cx, cz, y0 = ((min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)) if recentre else (0.0, 0.0, 0.0)
    out = []
    for role, (pos, nor, idx) in arrays:
        pos = [(x - cx, y - y0, z - cz) for x, y, z in pos]
        lo = [min(p[k] for p in pos) for k in range(3)]
        hi = [max(p[k] for p in pos) for k in range(3)]
        span = [max(hi[k] - lo[k], 1e-6) for k in range(3)]
        qp = b''.join(struct.pack('<3H', *[int(round((p[k] - lo[k]) / span[k] * 65535)) for k in range(3)]) for p in pos)
        qn = b''.join(struct.pack('<3b', *[max(-127, min(127, int(round(n[k] * 127)))) for k in range(3)]) for n in nor)
        big = len(pos) > 65535
        qi = struct.pack('<%d%s' % (len(idx), 'I' if big else 'H'), *idx)
        out.append({'r': role, 'lo': [round(v, 5) for v in lo], 'hi': [round(v, 5) for v in hi], 'big': big,
                    'p': base64.b64encode(qp).decode(), 'n': base64.b64encode(qn).decode(), 'i': base64.b64encode(qi).decode()})
    size = [round(max(xs) - min(xs), 4), round(max(ys) - min(ys), 4), round(max(zs) - min(zs), 4)]
    MODELS[name] = {'size': size, 'parts': out}
    tris = sum(len(a[1][2]) // 3 for a in arrays)
    print('model %-14s %5d triangles  size %s' % (name, tris, size))


# --------------------------------------------------------------------------------------------
# the models
def cushion(name, A, B, C, r, rz, crown, puff, piping_at=(1, -1), pipe_r=0.022, **kw):
    """A cushion and its piping, as two parts."""
    body = soft_box(name, A, B, C, r, rz, crown=crown, puff=puff, **kw)
    rings = []
    for side in piping_at:
        zz = side * (C - rz + rz * 0.707)
        k = 1 + puff * max(0.0, 1 - (zz / C) ** 2) * 0.6
        rings.append(tube_along(name + '_pipe%d' % side, rounded_rect_path((A - r + r * 0.707) * k, (B - r + r * 0.707) * k, r * 0.707, zz), pipe_r))
    return body, rings


def make_seat():
    reset()
    body, rings = cushion('seat', 1.0, 1.12, 0.25, 0.16, 0.13, crown=0.05, puff=0.035, sag=0.02, wobble=0.006)
    add_model('seat', [('fab', body), ('pipe', join(rings, 'pipe'))])


def make_back():
    reset()
    # made lying down (piping round the face), then stood up: thickness becomes depth, the face looks forward
    body, rings = cushion('back', 1.0, 0.6, 0.27, 0.2, 0.17, crown=0.045, puff=0.05, piping_at=(1,), wobble=0.006)
    body.rotation_euler = (PI / 2, 0, 0)
    for r in rings:
        r.rotation_euler = (PI / 2, 0, 0)
    bpy.context.view_layer.update()
    add_model('back', [('fab', body), ('pipe', join(rings, 'pipe'))])


def pillow_shape(name, A, B, T, ears, cuts=7):
    ob = soft_box(name, A, B, T, min(A, B) * 0.18, T * 0.98, cuts=cuts)
    me = ob.data
    for v in me.vertices:
        x, y, z = v.co
        f = max(0.0, (1 - min(1.0, abs(x) / A) ** 2.4) * (1 - min(1.0, abs(y) / B) ** 2.4)) ** 0.5
        z *= 0.18 + 0.82 * f
        nx, ny = x * (1 - ears * (1 - (y / B) ** 2)), y * (1 - ears * (1 - (x / A) ** 2))
        v.co = (nx, ny, z)
    me.update()
    warp = lambda x, y: (x * (1 - ears * (1 - (y / B) ** 2)), y * (1 - ears * (1 - (x / A) ** 2)))
    pipe = tube_along(name + '_pipe', rounded_rect_path(A * 0.995, B * 0.995, min(A, B) * 0.15, 0.0, 40, warp), 0.022)
    return ob, pipe


def make_pillows():
    for name, A, B, T, ears in (('pillow', 0.66, 0.66, 0.24, 0.07), ('bedpillow', 1.3, 0.72, 0.27, 0.045)):
        reset()
        body, pipe = pillow_shape(name, A, B, T, ears)
        for o in (body, pipe):
            o.rotation_euler = (PI / 2, 0, 0)          # standing up, facing the front
        bpy.context.view_layer.update()
        add_model(name, [('fab', body), ('pipe', pipe)])


def make_bedding(name, W, L, top_frac, hang):
    """Duvet over the foot part of the bed, and a runner across it, both draped by cloth
    simulation. Blender axes: x across the bed, head of the mattress at y = 0, foot at y = -L,
    mattress top at z = 0. Exported without re-centring: in the walkthrough the head is at
    z = 0, the foot at z = L, and the mattress top at y = 0."""
    reset()
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, 80
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    mattress = from_bmesh('mattress', bm, smooth=False)
    mattress.scale = (W, L, 0.8)
    mattress.location = (0, -L / 2, -0.4)
    bpy.context.view_layer.update()
    mattress.modifiers.new('col', 'COLLISION')
    mattress.collision.thickness_outer = 0.02
    mattress.collision.cloth_friction = 8

    def cloth(nm, x0, x1, y0, y1, z0, nx, ny, mass):
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=nx, y_segments=ny, size=1.0)
        xs = [v.co.x for v in bm.verts]
        ys = [v.co.y for v in bm.verts]
        ax, bx, ay, by = min(xs), max(xs), min(ys), max(ys)
        for v in bm.verts:
            v.co.x = x0 + (v.co.x - ax) / (bx - ax) * (x1 - x0)
            v.co.y = y0 + (v.co.y - ay) / (by - ay) * (y1 - y0)
            v.co.z = z0
        ob = from_bmesh(nm, bm)
        md = ob.modifiers.new('cloth', 'CLOTH')
        st = md.settings
        st.quality = 7
        st.mass = mass
        st.tension_stiffness = 12
        st.compression_stiffness = 12
        st.bending_stiffness = 0.6
        st.air_damping = 2
        md.collision_settings.distance_min = 0.012
        md.collision_settings.use_self_collision = False
        md.point_cache.frame_start, md.point_cache.frame_end = 1, 80
        return ob

    def settle(ob, frames, thickness, collide):
        sc.frame_set(1)
        for f in range(1, frames):
            sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        fro = link(bpy.data.objects.new(ob.name + '_shape', me))
        fro.matrix_world = ob.matrix_world.copy()
        bpy.data.objects.remove(ob)
        for p in fro.data.polygons:
            p.use_smooth = True
        so = fro.modifiers.new('thick', 'SOLIDIFY')
        so.thickness = thickness
        so.offset = 1
        if collide:
            fro.modifiers.new('col', 'COLLISION')
            fro.collision.thickness_outer = 0.02
        bpy.context.view_layer.update()
        return fro

    run = L * top_frac
    duvet = cloth('duvet', -(W / 2 + hang), W / 2 + hang, -L - hang, -(L - run), 0.12, 34, 28, 0.3)
    duvet = settle(duvet, 48, 0.07, True)
    runner = cloth('runner', -(W / 2 + hang * 0.9), W / 2 + hang * 0.9, -L + 0.45, -L + 1.9, 0.45, 34, 8, 0.25)
    runner = settle(runner, 42, 0.04, False)
    duvet.modifiers.remove(duvet.modifiers['col'])
    bpy.data.objects.remove(mattress)
    bpy.context.view_layer.update()
    add_model(name, [('duvet', duvet), ('runner', runner)], recentre=False)


def plant_model(name, height, pot_r, n_leaves, kind):
    reset()
    pot_h = pot_r * 1.55
    pot = lathe('pot', [(pot_r * 0.7, 0), (pot_r * 0.74, 0.02), (pot_r * 0.94, pot_h * 0.86), (pot_r, pot_h * 0.9), (pot_r, pot_h),
                        (pot_r * 0.92, pot_h), (pot_r * 0.9, pot_h * 0.92)], seg=32, cap_bottom=True)
    soil = lathe('soil', [(pot_r * 0.9, pot_h * 0.9), (pot_r * 0.6, pot_h * 0.93), (0.0, pot_h * 0.94)], seg=32)
    stems, leaves_a, leaves_b = [], [], []
    top = height
    if kind == 'tall':            # fiddle-leaf fig: a few upright stems, broad leaves up the top two thirds
        trunks = [(0.0, 0.0, 1.0), (0.12, 0.08, 0.86), (-0.1, -0.06, 0.78)]
        for ti, (ox, oy, frac) in enumerate(trunks):
            h = pot_h + (top - pot_h) * frac
            pts = [(ox * pot_r * (k / 8) * 3, oy * pot_r * (k / 8) * 3, pot_h * 0.9 + (h - pot_h * 0.9) * k / 8) for k in range(9)]
            stems.append(tube_along('stem%d' % ti, pts, 0.035 * (1.0 if ti == 0 else 0.8), 6, closed=False))
            nl = int(n_leaves * (0.5 if ti == 0 else 0.25))
            for li in range(nl):
                t = 0.35 + 0.65 * (li + random.random() * 0.5) / nl
                base = Vector(pts[min(8, int(t * 8))])
                L = (0.42 + 0.22 * random.random()) * (1.25 - 0.35 * t) * height / 4.4 * 1.6
                lf = leaf('lf', L, L * 0.62, fold=0.22, droop=0.35 + 0.4 * random.random(), rows=5, cols=3)
                lf.rotation_euler = (random.uniform(-0.2, 0.2), -random.uniform(0.15, 0.7), random.uniform(0, 2 * PI))
                lf.location = base
                (leaves_a if random.random() < 0.55 else leaves_b).append(lf)
    else:                         # a full, rounded bush: leaves arcing out from the soil
        for li in range(n_leaves):
            ang = 2 * PI * li / n_leaves + random.uniform(-0.25, 0.25)
            up = random.uniform(0.35, 1.25)
            L = (top - pot_h) * random.uniform(0.55, 0.95)
            stem_len = L * 0.45
            sx, sy = math.cos(ang), math.sin(ang)
            p0 = Vector((sx * pot_r * 0.15, sy * pot_r * 0.15, pot_h * 0.92))
            p1 = p0 + Vector((sx * stem_len * math.cos(up) * 0.6, sy * stem_len * math.cos(up) * 0.6, stem_len * math.sin(up)))
            stems.append(tube_along('st%d' % li, [tuple(p0), tuple((p0 + p1) / 2 + Vector((0, 0, 0.04))), tuple(p1)], 0.016, 5, closed=False))
            lf = leaf('lf', L * 0.62, L * 0.3, fold=0.3, droop=0.9 + 0.5 * random.random(), rows=5, cols=2)
            lf.rotation_euler = (random.uniform(-0.3, 0.3), -(up * 0.85), ang)
            lf.location = p1
            (leaves_a if li % 2 else leaves_b).append(lf)
    bpy.context.view_layer.update()
    parts = [('pot', pot), ('soil', soil), ('stem', join(stems, 'stems'))]
    if leaves_a:
        parts.append(('leaf', join(leaves_a, 'leaves_a')))
    if leaves_b:
        parts.append(('leaf2', join(leaves_b, 'leaves_b')))
    add_model(name, parts)


def make_lamps():
    def shade(nm, r_bot, r_top, h, z0, t=0.022, seg=40):
        prof = [(r_bot - t, z0 + 0.01), (r_bot, z0), (r_bot + 0.008, z0 + 0.015), (r_top + 0.008, z0 + h - 0.015), (r_top, z0 + h), (r_top - t, z0 + h - 0.01), (r_bot - t, z0 + 0.01)]
        return lathe(nm, prof, seg=seg, sharp_deg=60)

    reset()   # tall cone shade (warm luxury floor lamp)
    add_model('shade_cone', [('shade', shade('s', 0.76, 0.55, 0.95, 0)), ('bulb', lathe('b', [(0.0, 0.3), (0.12, 0.36), (0.13, 0.48), (0.07, 0.6), (0.0, 0.62)], seg=16))])
    reset()   # straight drum shade (Scandinavian floor lamp)
    add_model('shade_drum', [('shade', shade('s', 0.7, 0.7, 1.0, 0)), ('bulb', lathe('b', [(0.0, 0.32), (0.12, 0.38), (0.13, 0.5), (0.07, 0.62), (0.0, 0.64)], seg=16))])
    reset()   # table lamp: a gourd-shaped base and a tapered shade
    base = lathe('base', [(0.0, 0.0), (0.14, 0.0), (0.16, 0.02), (0.22, 0.14), (0.25, 0.3), (0.2, 0.5), (0.1, 0.62), (0.07, 0.66), (0.075, 0.7), (0.0, 0.7)], seg=36, sharp_deg=70)
    add_model('tablelamp', [('base', base), ('shade', shade('s', 0.45, 0.3, 0.55, 0.72)), ('bulb', lathe('b', [(0.0, 0.8), (0.09, 0.86), (0.1, 0.95), (0.0, 1.0)], seg=12))])
    reset()   # pendant dome
    dome = lathe('dome', [(0.0, 0.0), (0.09, 0.0), (0.12, -0.02), (0.16, -0.08), (0.35, -0.28), (0.52, -0.5), (0.6, -0.66), (0.62, -0.7),
                          (0.6, -0.7), (0.58, -0.66), (0.5, -0.52), (0.33, -0.3), (0.14, -0.1), (0.0, -0.08)], seg=40, sharp_deg=70)
    add_model('dome', [('shade', dome), ('bulb', lathe('b', [(0.0, -0.2), (0.12, -0.26), (0.13, -0.38), (0.0, -0.45)], seg=14))])


def make_fittings():
    """Railing parts and skirting. Each is one foot long (or high), so the walkthrough can
    stretch it along a railing run or a wall without changing its cross-section."""
    # railing post: 2" square with chamfered edges, 1 ft high (stretched to the post height)
    reset()
    s, c = 0.08, 0.016
    post = sweep('post', [(s - c, -s), (s, -s + c), (s, s - c), (s - c, s), (-s + c, s), (-s, s - c), (-s, -s + c), (-s + c, -s)], 'z', 0.0, 1.0, sharp_deg=30)
    add_model('rail_post', [('metal', post)])
    # post cap: a low pyramid on a square collar, for the end posts
    reset()
    r = 0.105 * math.sqrt(2)
    cap = lathe('cap', [(0.0, 0.0), (r, 0.0), (r, 0.03), (r * 0.42, 0.075), (0.0, 0.082)], seg=4, cap_bottom=True, sharp_deg=20)
    cap.rotation_euler = (0, 0, PI / 4)
    bpy.context.view_layer.update()
    add_model('rail_cap', [('metal', cap)])
    # baluster bar: ¾" round, 1 ft high, eased ends
    reset()
    bar = lathe('bar', [(0.0, 0.0), (0.027, 0.0), (0.032, 0.006), (0.032, 0.994), (0.027, 1.0), (0.0, 1.0)], seg=10, sharp_deg=60)
    add_model('rail_bar', [('metal', bar)])
    # handrail: 2½" wide, 1¼" high, a narrow foot and a rounded top; 1 ft long along x
    reset()
    prof = [(-0.055, 0.0), (0.055, 0.0), (0.1, 0.03)]
    prof += [(0.1 * math.cos(PI * k / 10), 0.03 + 0.072 * math.sin(PI * k / 10)) for k in range(1, 10)]
    prof += [(-0.1, 0.03)]
    top = sweep('handrail', prof, 'x', -0.5, 0.5, sharp_deg=40)
    add_model('rail_top', [('metal', top)])
    # skirting: 4" high, ½" proud of the wall, front top edge rounded; 1 ft long along x.
    # Back on the wall at walkthrough z = 0 (Blender y = 0), front toward +z (Blender -y).
    reset()
    T_, H_, R_ = 0.042, 4 / 12, 0.028
    prof = [(0.0, 0.0), (-T_, 0.0), (-T_, H_ - R_)]
    prof += [(-(T_ - R_) - R_ * math.cos(PI / 2 * k / 6), (H_ - R_) + R_ * math.sin(PI / 2 * k / 6)) for k in range(1, 7)]
    prof += [(0.0, H_)]
    sk = sweep('skirting', prof, 'x', -0.5, 0.5, sharp_deg=50)
    add_model('skirting', [('tile', sk)], recentre=False)


# --------------------------------------------------------------------------------------------
# interior pieces. Blender axes while modelling: x across, y depth (front toward -y), z up.
# Parts by role, so each room paints them in its own palette:
#   body / cushion / leg (sofas, chairs), head / base / mattress / leg (beds),
#   fab / wood (dining chair, bench), top / base (tables), body / front / top / pull / leg (cases).
def sofa_model(name, W, kind):
    """kind 'track': slim square arms, a tight back, tapered legs.
    kind 'tux': arms as high as the back, deep seat, on a recessed plinth."""
    reset()
    D = 3.15
    body, cush, base = [], [], []
    if kind == 'track':
        foot, armW, armH, backH, backD = 0.45, 0.38, 2.0, 2.45, 0.42
        for sx in (-1, 1):
            for sy in (-1, 1):
                base.append(leg(sx * (W / 2 - 0.3), sy * (D / 2 - 0.3), foot, 0.07, 0.045))
    else:
        foot, armW, armH, backH, backD = 0.32, 0.55, 2.3, 2.3, 0.5
        base.append(rbox(-W / 2 + 0.14, W / 2 - 0.14, -D / 2 + 0.14, D / 2 - 0.14, 0.0, foot, 0.03))
    deck = foot + 0.52
    body.append(rbox(-W / 2, W / 2, -D / 2, D / 2, foot, deck, 0.07))
    body.append(rbox(-W / 2, W / 2, D / 2 - backD, D / 2, foot, backH, 0.12))
    for sx in (-1, 1):
        x0, x1 = (-W / 2, -W / 2 + armW) if sx < 0 else (W / 2 - armW, W / 2)
        body.append(rbox(x0, x1, -D / 2, D / 2 - 0.05, foot, armH, 0.11 if kind == 'track' else 0.16))
    inner = W - 2 * armW
    n = max(1, int(round(inner / 2.25)))
    cw = inner / n
    seat_d = D - backD - 0.06
    for i in range(n):
        x = -inner / 2 + cw * (i + 0.5)
        cush.append(placed(cushion_obj('seat', cw - 0.03, seat_d, 0.42), (x, -D / 2 + seat_d / 2 + 0.02, deck + 0.21)))
        bh = (backH - deck - 0.42) + 0.35
        bk = cushion_obj('back', cw - 0.05, bh, 0.36, r=0.16, crown=0.05, puff=0.05)
        cush.append(placed(bk, (x, D / 2 - backD - 0.16, deck + 0.42 + bh / 2 - 0.05), (PI / 2 - 0.13, 0, 0)))
    add_model(name, [('body', join(body, 'body')), ('cushion', join(cush, 'cushions')), ('leg', join(base, 'legs') if len(base) > 1 else base[0])], recentre=False)


def make_sofas():
    for nm, W, kind in (('sofa_track3', 7.0, 'track'), ('sofa_track2', 5.2, 'track'), ('chair_track', 2.9, 'track'),
                        ('sofa_tux3', 7.0, 'tux'), ('sofa_tux2', 5.2, 'tux'), ('chair_tux', 3.0, 'tux')):
        sofa_model(nm, W, kind)


def make_lounge_chair():
    """An armless lounge chair: a deep cushioned seat and a tall, softly arched back that leans
    back, on four splayed tapered legs."""
    reset()
    body, cush, base = [], [], []
    W, D, foot = 2.5, 2.7, 0.55
    for sx in (-1, 1):
        for sy in (-1, 1):
            base.append(placed(leg(0, 0, foot + 0.05, 0.06, 0.04), (sx * (W / 2 - 0.3), sy * (D / 2 - 0.3), 0), (sy * 0.12, -sx * 0.12, 0)))
    body.append(rbox(-W / 2, W / 2, -D / 2, D / 2, foot, foot + 0.4, 0.08))
    cush.append(placed(cushion_obj('seat', W - 0.06, D - 0.5, 0.38), (0, -0.22, foot + 0.4 + 0.19)))
    outline = [(-W / 2, 0.0), (W / 2, 0.0), (W / 2, 1.6)] + arc(0, 1.6, W / 2, 0, 180, 14)[1:]
    back = sweep('back', outline, 'y', -0.2, 0.2, bevel=0.12)
    body.append(placed(back, (0, D / 2 - 0.25, foot + 0.3), (-0.2, 0, 0)))
    add_model('chair_lounge', [('body', join(body, 'body')), ('cushion', cush[0]), ('leg', join(base, 'legs'))], recentre=False)


def bed_model(name, W, L, kind):
    """A bed with its mattress centred on the origin, base on z = 0, headboard toward +y
    (the walkthrough's -z). kind: 'channel' (tall channel-tufted, on a plinth), 'wing'
    (wingback, on legs), 'panel' (plain upholstered panel, on a plinth), 'arch' (arched, single)."""
    reset()
    head, base, mat, legs = [], [], [], []
    lift = 0.3
    base.append(rbox(-W / 2 - 0.16, W / 2 + 0.16, -L / 2 - 0.12, L / 2, lift, lift + 0.7, 0.12))
    mat.append(rbox(-W / 2, W / 2, -L / 2, L / 2 - 0.06, lift + 0.7, lift + 1.45, 0.14))
    if kind in ('channel', 'panel'):
        legs.append(rbox(-W / 2 + 0.1, W / 2 - 0.1, -L / 2 + 0.2, L / 2 - 0.25, 0.0, lift, 0.02))
    else:
        for sx in (-1, 1):
            for sy in (-1, 1):
                legs.append(leg(sx * (W / 2 - 0.1), sy * (L / 2 - 0.25), lift + 0.05, 0.07, 0.05))
    Wb = W / 2 + (0.45 if W > 4 else 0.25)
    if kind == 'channel':
        head.append(rbox(-Wb, Wb, L / 2, L / 2 + 0.3, lift, 4.9, 0.06))
        n = 11 if W > 4 else 6
        cw = 2 * Wb / n
        for i in range(n):
            ch = cushion_obj('ch', cw - 0.02, 3.1, 0.24, r=0.1, crown=0.05, puff=0.02)
            head.append(placed(ch, (-Wb + cw * (i + 0.5), L / 2 - 0.08, 3.3), (PI / 2, 0, 0)))
    elif kind == 'wing':
        top, R = 4.5, 0.85
        outline = [(-Wb, lift), (Wb, lift), (Wb, top - R)] + arc(Wb - R, top - R, R, 0, 90, 6)[1:] + arc(-Wb + R, top - R, R, 90, 180, 6)
        head.append(sweep('head', outline, 'y', L / 2 - 0.05, L / 2 + 0.4, bevel=0.14))
        for sx in (-1, 1):
            wo = [(-0.22, lift), (0.22, lift), (0.22, 3.0)] + arc(0, 3.0, 0.22, 0, 180, 6)[1:]
            wing = sweep('wing', wo, 'y', -0.85, 0.0, bevel=0.1)
            head.append(placed(wing, (sx * (Wb - 0.25), L / 2 + 0.05, 0)))
    elif kind == 'panel':
        head.append(rbox(-Wb, Wb, L / 2, L / 2 + 0.35, lift, 4.1, 0.2))
        head.append(rbox(-Wb + 0.25, Wb - 0.25, L / 2 - 0.06, L / 2 + 0.05, 1.9, 3.85, 0.1))
    else:  # arch
        top = 4.0
        outline = [(-Wb, lift), (Wb, lift), (Wb, top - Wb)] + arc(0, top - Wb, Wb, 0, 180, 18)[1:]
        head.append(sweep('head', outline, 'y', L / 2 - 0.05, L / 2 + 0.32, bevel=0.12))
    add_model(name, [('head', join(head, 'head') if len(head) > 1 else head[0]), ('base', base[0]), ('mattress', mat[0]),
                     ('leg', join(legs, 'legs') if len(legs) > 1 else legs[0])], recentre=False)


def make_beds():
    for nm, W, L, kind in (('bed_channel', 6.0, 6.75, 'channel'), ('bed_wing', 6.0, 6.75, 'wing'),
                           ('bed_panel', 6.0, 6.75, 'panel'), ('bed_arch', 3.4, 6.5, 'arch')):
        bed_model(nm, W, L, kind)


def make_dining():
    # upholstered dining chair: tapered legs, eased seat frame, padded seat, arched padded back
    reset()
    fab, wood = [], []
    W, D, sh = 1.6, 1.7, 1.55
    for sx in (-1, 1):
        for sy in (-1, 1):
            wood.append(leg(sx * (W / 2 - 0.13), sy * (D / 2 - 0.13), sh - 0.12, 0.06, 0.04))
    wood.append(rbox(-W / 2, W / 2, -D / 2, D / 2, sh - 0.2, sh - 0.06, 0.025))
    fab.append(placed(cushion_obj('seat', W - 0.06, D - 0.08, 0.2, r=0.1, crown=0.03), (0, 0, sh + 0.04)))
    outline = [(-W / 2 + 0.04, 0.0), (W / 2 - 0.04, 0.0), (W / 2 - 0.04, 0.95)] + arc(0, 0.95, W / 2 - 0.04, 0, 180, 12)[1:]
    back = sweep('back', outline, 'y', -0.1, 0.1, bevel=0.07)
    fab.append(placed(back, (0, D / 2 - 0.1, sh + 0.12), (-0.12, 0, 0)))
    for sx in (-1, 1):
        wood.append(rbox(sx * (W / 2 - 0.2) - 0.05, sx * (W / 2 - 0.2) + 0.05, D / 2 - 0.16, D / 2 - 0.04, sh - 0.1, sh + 0.45, 0.02))
    add_model('chair_dining', [('fab', join(fab, 'fab')), ('wood', join(wood, 'wood'))], recentre=False)
    # dining table: a racetrack top with an eased edge on two turned pedestals
    reset()
    W, D, H = 5.0, 3.1, 2.5
    top = sweep('top', [(p[0], p[1]) for p in rounded_rect_path(W / 2, D / 2, 1.25, 0, 48)], 'z', H - 0.15, H, bevel=0.035)
    peds = []
    for sx in (-1, 1):
        ped = lathe('ped', [(0.0, 0.0), (0.62, 0.0), (0.64, 0.05), (0.42, 0.22), (0.26, 0.55), (0.24, H - 0.6), (0.34, H - 0.25), (0.42, H - 0.15), (0.0, H - 0.15)], seg=28, sharp_deg=40)
        peds.append(placed(ped, (sx * 1.25, 0, 0)))
    peds.append(rbox(-1.25, 1.25, -0.12, 0.12, 0.35, 0.55, 0.03))
    add_model('table_dining', [('top', top), ('base', join(peds, 'base'))], recentre=False)


def make_tables():
    # round coffee table: a thick top over a recessed, gently waisted drum
    reset()
    top = lathe('top', [(0.0, 1.15), (1.45, 1.15), (1.5, 1.19), (1.5, 1.27), (1.46, 1.31), (0.0, 1.31)], seg=56, sharp_deg=40)
    drum = lathe('drum', [(0.0, 0.0), (1.05, 0.0), (1.1, 0.06), (0.98, 0.6), (1.05, 1.15), (0.0, 1.15)], seg=56, sharp_deg=50)
    add_model('table_coffee', [('top', top), ('base', drum)])
    # rectangular coffee table: eased slab top on a recessed plinth
    reset()
    add_model('table_coffee_rect', [('top', rbox(-2.1, 2.1, -1.15, 1.15, 1.12, 1.27, 0.035)), ('base', rbox(-1.7, 1.7, -0.75, 0.75, 0.0, 1.12, 0.05))])
    # side table: round top on a slim turned pedestal
    reset()
    top = lathe('top', [(0.0, 1.86), (0.78, 1.86), (0.8, 1.9), (0.78, 1.95), (0.0, 1.95)], seg=40, sharp_deg=40)
    ped = lathe('ped', [(0.0, 0.0), (0.5, 0.0), (0.52, 0.04), (0.14, 0.12), (0.08, 0.6), (0.06, 1.3), (0.11, 1.86), (0.0, 1.86)], seg=24, sharp_deg=50)
    add_model('table_side', [('top', top), ('base', ped)])


def make_cases():
    # nightstand: two drawers with recessed fronts and slim pulls, on short tapered legs
    reset()
    W, D, h0, h1 = 1.9, 1.45, 0.45, 2.0
    body = rbox(-W / 2, W / 2, -D / 2, D / 2, h0, h1, 0.05)
    fronts = [rbox(-W / 2 + 0.06, W / 2 - 0.06, -D / 2 - 0.02, -D / 2 + 0.02, z0, z1, 0.015) for z0, z1 in ((h0 + 0.06, (h0 + h1) / 2 - 0.02), ((h0 + h1) / 2 + 0.02, h1 - 0.06))]
    pulls = [rbox(-0.3, 0.3, -D / 2 - 0.07, -D / 2 - 0.02, z - 0.025, z + 0.025, 0.012) for z in ((h0 + h1) / 2 - 0.2, h1 - 0.25)]
    legs = [leg(sx * (W / 2 - 0.14), sy * (D / 2 - 0.14), h0 + 0.02, 0.05, 0.035) for sx in (-1, 1) for sy in (-1, 1)]
    add_model('nightstand', [('body', body), ('front', join(fronts, 'fronts')), ('pull', join(pulls, 'pulls')), ('leg', join(legs, 'legs'))])
    # sideboard: a reeded front between plain ends, a thin overhanging top, tapered legs
    reset()
    W, D, h0, h1 = 5.4, 1.5, 0.55, 2.55
    body = rbox(-W / 2, W / 2, -D / 2, D / 2, h0, h1, 0.04)
    top = rbox(-W / 2 - 0.05, W / 2 + 0.05, -D / 2 - 0.05, D / 2, h1, h1 + 0.1, 0.03)
    reeds = []
    nr = 44
    for i in range(nr):
        x = -W / 2 + 0.25 + (W - 0.5) * (i + 0.5) / nr
        rd = lathe('reed', [(0.0, h0 + 0.1), (0.05, h0 + 0.1), (0.05, h1 - 0.1), (0.0, h1 - 0.1)], seg=8, sharp_deg=80)
        reeds.append(placed(rd, (x, -D / 2 + 0.01, 0)))
    pulls = [rbox(x - 0.04, x + 0.04, -D / 2 - 0.1, -D / 2 - 0.04, (h0 + h1) / 2 - 0.35, (h0 + h1) / 2 + 0.35, 0.02) for x in (-0.12, 0.12)]
    legs = [leg(sx * (W / 2 - 0.25), sy * (D / 2 - 0.2), h0 + 0.02, 0.06, 0.04) for sx in (-1, 1) for sy in (-1, 1)]
    add_model('console', [('body', body), ('top', top), ('front', join(reeds, 'reeds')), ('pull', join(pulls, 'pulls')), ('leg', join(legs, 'legs'))])
    # bench for the foot of a bed: a deep padded top on a slim frame
    reset()
    W, D = 4.4, 1.5
    fab = placed(cushion_obj('seat', W, D, 0.42, r=0.14, crown=0.03), (0, 0, 1.33))
    wood = [rbox(-W / 2 + 0.05, W / 2 - 0.05, -D / 2 + 0.05, D / 2 - 0.05, 1.0, 1.12, 0.02)]
    wood += [leg(sx * (W / 2 - 0.2), sy * (D / 2 - 0.2), 1.02, 0.06, 0.04) for sx in (-1, 1) for sy in (-1, 1)]
    add_model('bench', [('fab', fab), ('wood', join(wood, 'wood'))])


def make_decor():
    reset()
    add_model('vase_tall', [('ceramic', lathe('v', [(0.0, 0.0), (0.16, 0.0), (0.2, 0.04), (0.3, 0.45), (0.31, 0.75), (0.2, 1.15), (0.11, 1.42), (0.13, 1.55), (0.11, 1.55), (0.09, 1.42), (0.0, 1.38)], seg=28, sharp_deg=70))])
    reset()
    add_model('vase_round', [('ceramic', lathe('v', [(0.0, 0.0), (0.18, 0.0), (0.36, 0.2), (0.41, 0.42), (0.33, 0.66), (0.17, 0.8), (0.18, 0.86), (0.15, 0.86), (0.0, 0.8)], seg=28, sharp_deg=70))])
    reset()
    add_model('bowl', [('ceramic', lathe('b', [(0.0, 0.0), (0.22, 0.0), (0.42, 0.1), (0.55, 0.24), (0.53, 0.25), (0.41, 0.13), (0.0, 0.05)], seg=32, sharp_deg=70))])
    reset()
    covers, pages = [], []
    z = 0.0
    for w, d, t, rot in ((1.05, 0.78, 0.1, 0.0), (0.98, 0.72, 0.08, 0.12), (0.9, 0.66, 0.09, -0.07)):
        c = rbox(-w / 2, w / 2, -d / 2, d / 2, z, z + t, 0.012)
        p = rbox(-w / 2 + 0.03, w / 2 - 0.005, -d / 2 + 0.01, d / 2 - 0.01, z + 0.012, z + t - 0.012, 0.004)
        for o in (c, p):
            o.rotation_euler = (0, 0, rot)
        covers.append(c)
        pages.append(p)
        z += t
    bpy.context.view_layer.update()
    add_model('books', [('cover', join(covers, 'covers')), ('pages', join(pages, 'pages'))])
    reset()
    holders = [placed(lathe('h', [(0.0, 0.0), (0.12, 0.0), (0.07, 0.05), (0.04, 0.25), (0.08, 0.3), (0.0, 0.3)], seg=16, sharp_deg=60), (dx, 0, 0)) for dx in (-0.14, 0.16)]
    wax = [placed(lathe('c', [(0.0, 0.0), (0.035, 0.0), (0.035, hh), (0.0, hh)], seg=10, sharp_deg=60), (dx, 0, 0.3)) for dx, hh in ((-0.14, 0.7), (0.16, 0.5))]
    add_model('candles', [('holder', join(holders, 'holders')), ('wax', join(wax, 'wax'))])


def make_curtains():
    """Curtain pieces. drape: one panel gathered into soft vertical folds, 1 ft wide and 1 ft high
    (the walkthrough stretches it to each panel and drop), its back on the rod line at walkthrough
    z = 0 and the folds toward the room (+z); the hem flares a little. rod: 1 ft long along x,
    axis at the origin. finial: a ball on a collar, pointing along +x from x = 0. bracket: a round
    wall plate and an arm from the wall (z = 0) out to the rod (z = 0.25), centred on y = 0."""
    reset()
    nx, nz, waves, depth = 24, 6, 3, 0.13
    verts, faces = [], []
    for j in range(nz + 1):
        z = j / nz
        flare = 1.0 + 0.3 * (1 - z) ** 2            # folds open out toward the hem
        for i in range(nx + 1):
            x = -0.5 + i / nx
            fold = 0.5 - 0.5 * math.cos(2 * PI * waves * i / nx)
            verts.append((x * (1 + 0.04 * (1 - z)), -depth * flare * fold, z))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    cloth = from_data('drape', verts, faces)
    so = cloth.modifiers.new('thick', 'SOLIDIFY')
    so.thickness, so.offset = 0.015, 0.0
    add_model('drape', [('fab', cloth)], recentre=False)
    reset()
    rod = sweep('rod', [(0.035 * math.cos(2 * PI * k / 10), 0.035 * math.sin(2 * PI * k / 10)) for k in range(10)], 'x', -0.5, 0.5, sharp_deg=80)
    add_model('rod', [('metal', rod)], recentre=False)
    reset()
    fin = lathe('finial', [(0.0, 0.0), (0.05, 0.0), (0.05, 0.03), (0.03, 0.05), (0.07, 0.1), (0.075, 0.14), (0.06, 0.19), (0.0, 0.22)], seg=16, sharp_deg=60)
    fin.rotation_euler = (0, PI / 2, 0)           # its axis along +x
    bpy.context.view_layer.update()
    add_model('finial', [('metal', fin)], recentre=False)
    reset()
    plate = lathe('plate', [(0.0, 0.0), (0.065, 0.0), (0.065, 0.02), (0.05, 0.035), (0.0, 0.035)], seg=16, sharp_deg=60)
    plate.rotation_euler = (PI / 2, 0, 0)          # flat on the wall, facing the room
    arm = sweep('arm', [(0.018 * math.cos(2 * PI * k / 8), 0.018 * math.sin(2 * PI * k / 8)) for k in range(8)], 'y', -0.27, 0.0, sharp_deg=80)
    cup = rbox(-0.05, 0.05, -0.29, -0.21, -0.055, -0.02, 0.012)
    bpy.context.view_layer.update()
    add_model('bracket', [('metal', join([plate, arm, cup], 'bracket'))], recentre=False)


def make_nameplate():
    """The home's name plate: a dark stone plaque with rounded edges, a raised brass border and
    raised brass lettering. Back on the wall at walkthrough z = 0, front toward +z, bottom at y = 0."""
    reset()
    W, Hh, D = 3.4, 0.92, 0.1
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * W, v.co.y * D - D / 2, v.co.z * Hh + Hh / 2))
    plate = from_bmesh('plate', bm, smooth=True, sharp_deg=30)
    bv = plate.modifiers.new('round', 'BEVEL')
    bv.width, bv.segments, bv.limit_method = 0.03, 3, 'ANGLE'
    # border: a thin raised frame inset from the edge
    parts = []
    m, t, h = 0.09, 0.022, 0.012
    for x0, x1, z0, z1 in ((-W / 2 + m, W / 2 - m, m, m + t), (-W / 2 + m, W / 2 - m, Hh - m - t, Hh - m),
                           (-W / 2 + m, -W / 2 + m + t, m, Hh - m), (W / 2 - m - t, W / 2 - m, m, Hh - m)):
        b2 = bmesh.new()
        bmesh.ops.create_cube(b2, size=1.0)
        for v in b2.verts:
            v.co = Vector((x0 + (v.co.x + 0.5) * (x1 - x0), -D - (v.co.y + 0.5) * h, z0 + (v.co.z + 0.5) * (z1 - z0)))
        parts.append(from_bmesh('rim', b2, smooth=False))
    # lettering in a serif face from this PC (Blender's own font if none is found)
    cu = bpy.data.curves.new('name', 'FONT')
    cu.body = HOME_NAME
    for fp in ('C:/Windows/Fonts/GARA.TTF', 'C:/Windows/Fonts/pala.ttf', 'C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/times.ttf'):
        if os.path.exists(fp):
            cu.font = bpy.data.fonts.load(fp)
            break
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    cu.size, cu.extrude, cu.resolution_u = 0.46, 0.014, 3
    cu.bevel_depth = 0.0   # crisp raised letters; a bevel would multiply the triangles
    txt = link(bpy.data.objects.new('name', cu))
    bpy.context.view_layer.update()
    wide = txt.dimensions.x
    if wide > W - 2 * m - 0.3:   # a long name is set smaller so it fits inside the border
        cu.size *= (W - 2 * m - 0.3) / wide
    txt.rotation_euler = (PI / 2, 0, 0)        # stood up, facing the road
    txt.location = (0, -D - 0.014, Hh / 2 - 0.02)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(txt.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    letters = link(bpy.data.objects.new('letters', me))
    letters.matrix_world = txt.matrix_world.copy()
    bpy.data.objects.remove(txt)
    for p in letters.data.polygons:
        p.use_smooth = False
    bpy.context.view_layer.update()
    add_model('nameplate', [('plate', plate), ('letters', join(parts + [letters], 'brass'))], recentre=False)


def make_compass():
    """A compass rose laid in the ground beside the house: a round stone disc, a gilt ring, eight inlaid
    points (the four main ones gilt, the four between them dark, north in red) and the letters N, E, S, W
    lying flat by the rim. North toward Blender +y (the walkthrough's -z); the walkthrough turns it to
    true north. Radius 4 ft, base on y = 0."""
    reset()
    R, T0 = 4.0, 0.06
    bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=R, depth=T0, location=(0, 0, T0 / 2))
    disc = bpy.context.active_object
    disc.name = 'disc'
    for p in disc.data.polygons:
        p.use_smooth = False
    top = T0 + 0.004

    def ring(r0, r1, h):
        bm = bmesh.new()
        n = 72
        for k in range(n):
            a0, a1 = 2 * PI * k / n, 2 * PI * (k + 1) / n
            vs = [bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, a, z in
                  ((r0, a0, top), (r1, a0, top), (r1, a1, top), (r0, a1, top),
                   (r0, a0, top + h), (r1, a0, top + h), (r1, a1, top + h), (r0, a1, top + h))]
            for f in ((4, 5, 6, 7), (1, 2, 6, 5), (0, 4, 7, 3)):
                bm.faces.new([vs[i] for i in f])
        return from_bmesh('ring', bm, smooth=False)

    def point(ang, L, w, h):
        """One point of the star: a long rhombus from the centre to the tip, ridged along its middle."""
        bm = bmesh.new()
        d = Vector((math.sin(ang), math.cos(ang), 0))       # bearing ang from north (+y), clockwise
        n = Vector((d.y, -d.x, 0))
        c = bm.verts.new((0, 0, top + h))
        tip = bm.verts.new(tuple(d * L + Vector((0, 0, top + 0.004))))
        lft = bm.verts.new(tuple(d * (L * 0.18) - n * w + Vector((0, 0, top + 0.004))))
        rgt = bm.verts.new(tuple(d * (L * 0.18) + n * w + Vector((0, 0, top + 0.004))))
        bm.faces.new((c, tip, lft))   # wound to face up
        bm.faces.new((c, rgt, tip))
        return from_bmesh('point', bm, smooth=False)

    gilt = [ring(2.95, 3.08, 0.02), ring(1.15, 1.22, 0.015)]
    dark, north = [], None
    for k in range(8):
        ang = k * PI / 4
        if k % 2:
            dark.append(point(ang, 2.0, 0.34, 0.05))
        elif k == 0:
            north = point(ang, 2.95, 0.46, 0.08)
        else:
            gilt.append(point(ang, 2.95, 0.46, 0.08))
    # letters, flat on the disc between the ring and the rim, upright with north at the top
    letters = []
    for ch, (x, y) in (('N', (0, 3.5)), ('E', (3.5, 0)), ('S', (0, -3.5)), ('W', (-3.5, 0))):
        cu = bpy.data.curves.new(ch, 'FONT')
        cu.body = ch
        for fp in ('C:/Windows/Fonts/georgiab.ttf', 'C:/Windows/Fonts/timesbd.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
            if os.path.exists(fp):
                cu.font = bpy.data.fonts.load(fp, check_existing=True)
                break
        cu.align_x, cu.align_y = 'CENTER', 'CENTER'
        cu.size, cu.extrude, cu.resolution_u = 0.62 if ch == 'N' else 0.5, 0.008, 3
        txt = link(bpy.data.objects.new(ch, cu))
        txt.location = (x, y, top + 0.008)
        bpy.context.view_layer.update()
        me = bpy.data.meshes.new_from_object(txt.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        lo = link(bpy.data.objects.new('letter', me))
        lo.matrix_world = txt.matrix_world.copy()
        bpy.data.objects.remove(txt)
        letters.append(lo)
    add_model('compass', [('base', disc), ('inlay', join(gilt, 'inlay')), ('dark', join(dark, 'dark')),
                          ('north', north), ('letters', join(letters, 'letters'))])


# --------------------------------------------------------------------------------------------
STEPS = [
    ('seat', make_seat), ('back', make_back), ('pillows', make_pillows),
    ('bed', lambda: make_bedding('bedding', 6.0, 6.75, 0.62, 0.8)),
    ('twin', lambda: make_bedding('bedding_twin', 3.4, 6.5, 0.6, 0.7)),
    ('plant_tall', lambda: plant_model('plant_tall', 4.4, 0.8, 30, 'tall')),
    ('plant_bush', lambda: plant_model('plant_bush', 3.2, 0.55, 22, 'bush')),
    ('lamps', make_lamps),
    ('fittings', make_fittings),
    ('nameplate', make_nameplate),
    ('compass', make_compass),
    ('sofas', make_sofas), ('lounge chair', make_lounge_chair), ('beds', make_beds), ('dining', make_dining),
    ('tables', make_tables), ('cases', make_cases), ('decor', make_decor), ('curtains', make_curtains),
]
for nm, fn in STEPS:
    try:
        fn()
    except Exception as err:  # one failed model must not stop the others
        import traceback
        traceback.print_exc()
        print('FAILED', nm, err)

js = ('/* Furniture models made in Blender by blender/make_furniture.py. Do not edit by hand:\n'
      '   run that script again instead. Positions are packed per part (16-bit, inside lo..hi),\n'
      '   normals 8-bit, triangles as indices. */\n'
      'window.FURNITURE_MODELS = ' + json.dumps(MODELS, separators=(',', ':')) + ';\n')
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
print('wrote', OUT, len(js) // 1024, 'KB,', len(MODELS), 'models')
