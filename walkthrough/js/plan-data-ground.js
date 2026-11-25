/* The editable GROUND FLOOR plan: walls, their windows and doors, pillars, the
   outdoor areas (car porch, entry lobby, walkway, open court) and wardrobes.
   Written by the plan editor (Ground floor tab).

   Units are feet, on the same axes as the first floor: X runs to the right of the
   sheet (south), Y runs down the sheet (west, toward the road). X = 0 is the
   front-left corner of the plot, Y = 0 is the outer face of the rear wall.
   r  = [x0, y0, x1, y1] footprint.   ax = direction the wall runs ("x" or "y").
   z  = [bottom, top] measured from the ground floor finish; left out means floor
        to ceiling. "H" = ceiling, "PORCH" = car porch level (1'-6" below the floor),
        "ROOF" = top of the first floor's roof slab.
   ops = openings; a/b are positions along the wall. "leaves": 2 = double door. */
window.PLAN_DATA_GROUND = {
  version: 2,
  H: 11,
  SLAB: 0.4167,
  DOOR: 7,
  walls: [
    {"id": "g-rear-pooja", "ax": "x", "r": [-1, 0, 5.125, 0.375], "ops": []},
    {"id": "g-rear-court", "ax": "x", "r": [5.125, 0, 12.885, 0.375], "ops": [{"type": "win", "a": 5.125, "b": 12.885, "sill": 0.3333333333333333, "head": 11}]},
    {"id": "g-rear-thick", "ax": "x", "r": [12.885, 0, 29.625, 0.75], "ops": [{"type": "win", "a": 22.9168, "b": 27.4168, "sill": 3, "head": 8}, {"type": "win", "a": 14.5834, "b": 17.5834, "sill": 9.5, "head": 11}]},
    {"id": "g-north-rear", "ax": "y", "r": [-1, 0.375, -0.25, 14.625], "ops": [{"type": "win", "a": 7.88, "b": 10.88, "sill": 3.0833333333333335, "head": 8}]},
    {"id": "g-pooja-court", "ax": "y", "r": [4.75, 0.375, 5.125, 4.375], "ops": [{"type": "open", "a": 1.88, "b": 4.375, "sill": 0, "head": 7}]},
    {"id": "g-court-store", "ax": "y", "r": [12.885, 0.375, 13.26, 4.375], "ops": [{"type": "open", "a": 1.88, "b": 4.375, "sill": 0, "head": 7, "hinge": "a", "swing": 1, "isOpen": false}]},
    {"id": "g-bed-east", "ax": "x", "r": [-0.25, 4.375, 12.885, 4.75], "ops": [{"type": "win", "a": 7.13, "b": 9.135, "sill": 3.0833333333333335, "head": 7}, {"type": "open", "a": 9.89, "b": 12.885, "sill": 0, "head": 7, "hinge": "b", "swing": -1, "isOpen": true}]},
    {"id": "g-wardrobe-top", "ax": "x", "r": [12.885, 4.375, 15.26, 4.75], "ops": []},
    {"id": "g-wardrobe-back", "ax": "y", "r": [14.89, 4.7133, 15.26, 9.5], "ops": []},
    {"id": "g-wardrobe-foot", "ax": "x", "r": [12.885, 9.13, 14.89, 9.5], "ops": []},
    {"id": "g-bed-toilet", "ax": "y", "r": [12.885, 9.5, 13.26, 14.25], "ops": []},
    {"id": "g-store-wc", "ax": "x", "r": [15.26, 6.38, 19.25, 6.75], "ops": [{"type": "vent", "a": 16, "b": 18.51, "sill": 9.5, "head": 11}]},
    {"id": "g-toilet-guest", "ax": "y", "r": [19.25, 0.75, 19.625, 14.25], "ops": []},
    {"id": "g-bed-hall", "ax": "x", "r": [-0.375, 14.25, 12.885, 14.625], "ops": [{"type": "door", "a": 9.39, "b": 12.885, "sill": 0, "head": 7, "hinge": "b", "swing": -1, "isOpen": true}]},
    {"id": "g-toilet-hall", "ax": "x", "r": [12.885, 14.25, 19.625, 14.625], "ops": [{"type": "door", "a": 16.13, "b": 18.88, "sill": 0, "head": 7, "hinge": "b", "swing": -1, "isOpen": true}]},
    {"id": "g-guest-hall", "ax": "x", "r": [19.625, 14.25, 29.625, 14.625], "ops": [{"type": "door", "a": 19.73, "b": 23.03, "sill": 0, "head": 7, "hinge": "a", "swing": -1, "isOpen": true}]},
    {"id": "g-guest-wardrobe-side", "ax": "y", "r": [23.13, 12.25, 23.5, 14.25], "ops": []},
    {"id": "g-hall-north", "ax": "y", "r": [-0.375, 14.625, 0.375, 28.625], "ops": [{"type": "win", "a": 18.2133, "b": 24.2133, "sill": 3.0833333333333335, "head": 8}]},
    {"id": "g-entrance", "ax": "x", "r": [0.375, 27.875, 7.75, 28.625], "ops": [{"type": "win", "a": 0.75, "b": 2, "sill": 0.4, "head": 8}, {"type": "door", "a": 2, "b": 6.5, "sill": 0, "head": 8, "hinge": "a", "swing": -1, "isOpen": true, "leaves": 2}, {"type": "win", "a": 6.5, "b": 7.75, "sill": 0.4, "head": 8}]},
    {"id": "g-kitchen-hall", "ax": "x", "r": [7.75, 27.875, 15.875, 28.25], "ops": [{"type": "door", "a": 12.625, "b": 15.875, "sill": 0, "head": 7, "hinge": "b", "swing": 1, "isOpen": true}]},
    {"id": "g-hall-toilet", "ax": "x", "r": [15.8334, 27.875, 29.625, 28.25], "ops": [{"type": "door", "a": 16.2521, "b": 19.7521, "sill": 0, "head": 7, "hinge": "a", "swing": 1, "isOpen": true}]},
    {"id": "g-lobby-kitchen", "ax": "y", "r": [7.75, 28.625, 8.5, 39], "ops": [{"type": "win", "a": 35.6, "b": 39, "sill": 4, "head": 8}]},
    {"id": "g-kitchen-west", "ax": "x", "r": [7.7667, 38.25, 15.5, 39], "ops": [{"type": "win", "a": 7.7667, "b": 11.25, "sill": 4, "head": 8}]},
    {"id": "g-kitchen-south", "ax": "y", "r": [15.875, 28.1667, 16.25, 38.25], "ops": []},
    {"id": "g-master-north", "ax": "y", "r": [15.5, 38.25, 16.25, 46.25], "ops": [{"type": "door", "a": 40.75, "b": 44.25, "sill": 0, "head": 8, "hinge": "b", "swing": 1, "isOpen": true}]},
    {"id": "g-passage-toilet", "ax": "y", "r": [19.75, 28.25, 20.125, 33.25], "ops": [{"type": "door", "a": 30.5, "b": 33.25, "sill": 0, "head": 7, "hinge": "b", "swing": 1, "isOpen": true}]},
    {"id": "g-toilet-master", "ax": "x", "r": [19.75, 33.25, 29.625, 33.625], "ops": []},
    {"id": "g-front", "ax": "x", "r": [17, 46.25, 29.625, 47], "ops": [{"type": "win", "a": 17, "b": 19, "sill": 3.0833333333333335, "head": 8}]},
    {"id": "g-master-wardrobe-side", "ax": "y", "r": [22.25, 44.25, 22.625, 46.25], "ops": []},
    {"id": "g-master-south-liner", "ax": "y", "r": [29.25, 33.625, 29.625, 46.25], "ops": []},
    {"id": "g-south", "ax": "y", "r": [29.625, 0, 30.375, 47], "ops": []},
    {"id": "g-stair-south", "ax": "y", "r": [29.625, 47, 30.375, 53.5], "z": [0, 30.833333333333332], "ops": []},
    {"id": "g-stair-front", "ax": "x", "r": [19, 52.75, 29.625, 53.5], "ops": [{"type": "vent", "a": 22.13, "b": 26.88, "sill": 3, "head": 29}], "z": [0, 30.8334]},
    {"id": "g-stair-north", "ax": "y", "r": [19, 47, 19.375, 52.75], "ops": [{"type": "door", "a": 47.0012, "b": 50.0012, "sill": 0, "head": 8, "hinge": "a", "swing": 1, "isOpen": true}, {"type": "open", "a": 47.0012, "b": 50.0012, "sill": 11.4167, "head": 19.4167}], "z": [0, 30.8334]},
    {"id": "g-north-porch", "ax": "y", "r": [0.0833, 28.6333, 0.4583, 53], "z": ["PORCH", 4.5], "mat": "stone", "ops": []},
    {"id": "g-front-pier", "ax": "x", "r": [12, 53.5001, 19.0416, 54.5001], "z": ["PORCH", 5.5], "mat": "stone", "ops": []}
  ],
  pillars: [
    {"id": "gp-rear-north", "r": [-1, 0, -0.25, 1.5]},
    {"id": "gp-rear-south", "r": [28.875, 0, 30.375, 0.75]},
    {"id": "gp-mid-1", "r": [12.885, 13.875, 14.5, 14.625]},
    {"id": "gp-mid-south", "r": [28.875, 13.875, 30.375, 14.625]},
    {"id": "gp-entrance", "r": [7.75, 27.875, 9.25, 28.625]},
    {"id": "gp-toilet", "r": [22.25, 27.875, 23.75, 28.625]},
    {"id": "gp-front-1", "r": [15.5, 46.25, 17, 47]},
    {"id": "gp-front-south", "r": [29.25, 45.5, 30, 47]},
    {"id": "gp-porch-1", "r": [0, 38.75, 0.75, 40.25], "z": ["PORCH", "H"], "mat": "stone"},
    {"id": "gp-porch-2", "r": [0, 45.5, 0.75, 47], "z": ["PORCH", "H"], "mat": "stone"},
    {"id": "gp-gate", "r": [-0.1666, 53, 1.3334, 54.5], "z": ["PORCH", 5.5], "mat": "stone"}
  ],
  areas: [
    {"id": "porch", "name": "Car Porch", "kind": "porch", "r": [0.375, 39, 12, 54.5]},
    {"id": "porch-lobby", "name": "Car Porch", "kind": "porch", "r": [0.375, 34.8, 7.75, 39]},
    {"id": "porch-side", "name": "Car Porch", "kind": "porch", "r": [12, 46.9667, 15.875, 53.75]},
    {"id": "lobby", "name": "Entry Lobby", "kind": "platform", "r": [0.375, 28.625, 7.75, 33.13]},
    {"id": "walkway", "name": "Side Walkway", "kind": "platform", "r": [12, 39, 15.875, 46.9733]},
    {"id": "stair-lobby", "name": "Front Stair Lobby", "kind": "platform", "r": [15.5417, 47, 19, 53.75]},
    {"id": "court", "name": "Open Court", "kind": "court", "r": [5.125, 0.375, 12.885, 4.375]}
  ],
  wardrobes: [
    {"id": "g-wardrobe-children", "r": [12.885, 4.7133, 14.89, 9.13], "face": "north"},
    {"id": "g-wardrobe-guest", "r": [23.5, 12.25, 29.625, 14.25], "face": "rear"},
    {"id": "g-wardrobe-master", "r": [22.625, 44.25, 29.25, 46.25], "face": "rear"}
  ]
};
