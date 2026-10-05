"""Tom, N° 02: almost 4, a short-haired white cat with a tabby cap.

White, with a ticked grey-brown tabby cap over the ears and eyes, a white
blaze between the eyes that narrows up the forehead into a thin streak, a
dark ringed tabby tail, olive-green eyes. In the line-up: a suspicious
sideways glance toward his siblings in slots 3 and 4.
"""

import numpy as np

from ..coat import rings
from ..vecmath import smoothstep

NAME = "Tom"
NUMBER = 2
EAR_TIP_CM = 37.7   # the biggest of the four, but only just (the owner: "más grande, pero no mucho"):
                    # his head stands under 3 cm over Kira's on the line-up chart

# a solid, slightly chubby adult tom of about 5.5 kg ("gordito, pero no
# mucho"). At a 37.7 cm ear tip a cat with Kira's proportions still reads tall
# and slim, so the bulk is in the shape: a shorter body and forelegs (with the
# ear tip fixed, they and the slumped sit scale the whole cat up about 9%, and
# `head` takes that back so his approved face keeps its size and passes the
# muzzle guards), a short thick neck as wide as his jaw, and a soft pear from
# the front: the shoulders no broader, the belly and haunches a little wider
# side to side (`width`, so the rump does not sink under the paws). Not more:
# in the line-up his silhouette is about 1.2-1.3 times Kira's width at the
# same relative heights (the owner's "10-15% wider" on top of his 10% more
# height); at 1.4-1.5 times he read as a fat cat. The fullness is in the
# belly's girth, not in `belly_pouch`: a scaled pouch joint stood out as a
# white ledge in the middle of his belly from the lens. The jowls move the
# cheek joints only: the muzzle guards have little margin left at his size.
SHAPE = dict(head=0.915, jowls=1.4, chest=1.16, belly=1.18, haunch=1.04,
             width=dict(chest=1.0, belly=1.06, haunch=1.02),
             belly_drop=0.4, belly_pouch=1.0, body_length=0.9,
             neck=dict(length=0.7, girth=1.4), fore=dict(length=0.88, girth=1.08),
             tail=dict(length=1.45))   # a long tail, as his: it wraps round his side to the front

POSE = dict(
    body=dict(yaw=-8.0),                     # turned a little to camera-left
    spine=dict(slump=6.0),                   # shoulders soft, the chest settled onto the forelegs
    hips=dict(roll=6.0),                     # his weight a little on one haunch
    head=dict(yaw=10.0, pitch=-2.0, roll=5.0),  # the face back toward camera-right, a slight tilt
    gaze=dict(yaw=20.0),                     # and the eyes further, toward slots 3 and 4
    lids=dict(L=dict(upper=0.48, lower=0.12), R=dict(upper=0.48, lower=0.12)),  # his heavy-lidded stare
    ears=dict(L=dict(swivel=18.0), R=dict(out=6.0, back=3.0)),  # one ear turned toward the glance
    # the front paws not a mirrored pair: the right one a little ahead and
    # out, the left one (behind the tail's tip) a little back
    paws=dict(fore=dict(L=dict(forward=-0.4), R=dict(forward=0.9, out=0.4)),
              hind=dict(L=dict(lift=-0.35))),  # the left hind foot flat on the floor
    # the belly joint swung back, and the skin under his trunk relaxed: with
    # the chest settled onto the forelegs the base's chest skin hung between
    # them as a lobe with a crease and a bright lip under it, which read as a
    # sac or a tear in his white coat, not as a soft belly
    bones={"Belly_Jiggle": (-40.0, 0.0, 0.0)},
    relax=dict(belly=200),
    # the tail round his left side (image right; Kira's wraps from image
    # left) and across the front of his left paw, tip flicked up, so the dark
    # ringed tail shows from the lens; never between the legs
    tail=[(6.5, 10.5, 2.2), (10.0, 4.5, 2.2), (10.0, -2.0, 2.3), (6.5, -7.5, 2.4), (2.5, -9.5, 2.6)],
    tail_tip_lift=1.5,
)

PALETTE = {
    "white": ("#eeece8", "#f2f0ec"),
    "light": ("#bdb3a6", "#716a62"),   # the cap's ticked ground: a grey-brown, barely warm
    "mid": ("#7a736b", "#3d3833"),
    "dark": ("#272321", "#161413"),    # the stripes and the crown, near black
    "silver": ("#c9c6c1", "#8f8b86"),  # the pale ticking between the tail's rings
}


def markings(c):
    ax = np.abs(c.hx)
    n1 = c.fbm(160, 3)
    n2 = c.fbm(420, 5)
    n3 = c.fbm(1100, 13)                    # hair-scale break-up of the blaze's edge
    right = smoothstep(0.05, -0.05, c.hx)   # 1 on his right side (image left)
    # the cap: the whole skull back to the occiput, the ears, round the eyes.
    # Its lower edge is lopsided, as on him: on his left it runs just under
    # the eye and rises toward the ear, the cheek below it white; on his
    # right it drops from the eye's inner corner down the outer cheek to
    # about nose level and on behind the jaw. It stays off the muzzle (the
    # edge climbs where hf is large) and, behind the ears, climbs back to the
    # ear bases: the nape and the neck are white.
    lower_l = -0.19 + 0.2 * smoothstep(0.65, 1.05, ax)
    lower_r = -0.24 - 0.3 * smoothstep(0.25, 0.8, ax)
    lower = right * lower_r + (1 - right) * lower_l
    lower = lower + 0.32 * smoothstep(0.35, 0.95, c.hf) - 0.55 * right * smoothstep(-0.3, -1.1, c.hf)
    lower = lower + (-0.12 - lower) * smoothstep(-1.15, -1.6, c.hf)
    # the back of the skull is skinned partly to the neck: the head frame
    # carries the cap there, up to the occiput (hf about -1.9 on the midline)
    skull = np.clip(c.head + c.ear, 0, 1)
    occiput = smoothstep(-2.02, -1.82, c.hf + 0.12 * (n1 - 0.5))
    skull = np.maximum(skull, occiput * np.clip(c.head + c.neck, 0, 1))
    cap = skull * smoothstep(-0.04, 0.04, c.hu - lower + 0.08 * (n1 - 0.5))
    cap = np.maximum(cap, c.ear)
    # the white blaze, measured on his photo (half-widths in head units):
    # the whole muzzle, then between the eyes out to their inner corners
    # (wider toward his right eye, which it touches), narrowing fast over the
    # brow to a point at mid-forehead, then a thin broken streak up to the
    # front of the crown, drifting a little to his right
    bw = np.interp(c.hu, [-0.4, -0.2, 0.0, 0.1, 0.2, 0.32, 0.42, 0.5, 0.58, 0.66, 0.74],
                   [0.36, 0.3, 0.27, 0.24, 0.2, 0.13, 0.075, 0.045, 0.03, 0.022, 0.0])
    wisp = smoothstep(0.36, 0.5, c.hu)
    bw = bw * (1.0 + (0.4 + 0.9 * wisp) * (n2 - 0.5)) + 0.025 * (n3 - 0.5)
    centre = -0.025 - 0.045 * smoothstep(0.0, 0.6, c.hu) + 0.03 * (c.fbm(90, 7) - 0.5) * wisp
    blaze = smoothstep(0.012, -0.012, np.abs(c.hx - centre) - bw) * smoothstep(-0.25, -0.05, c.hf)
    cap = cap * (1 - blaze)
    # tabby inside the cap: uneven dark streaks up the forehead into a
    # near-black crown, one broad dark streak along the blaze's edge on his
    # left, a line back from each eye's outer corner and a few bars on his
    # right cheek; round the eyes and over his right brow the ground stays a
    # lighter ticked grey-brown
    fore_zone = smoothstep(0.08, 0.3, c.hu) * smoothstep(0.55, 0.38, ax)
    streak = (0.5 + 0.5 * np.cos(2 * np.pi * ax / 0.12 + 3.0 * (n1 - 0.5) + 1.5 * (n2 - 0.5))) ** 2
    edge = c.hx - centre - bw   # distance outside the blaze on his left
    blaze_edge = (smoothstep(-0.01, 0.02, edge) * smoothstep(0.12, 0.06, edge) * (1 - right)
                  * smoothstep(0.05, 0.2, c.hu))
    eye_line = (smoothstep(0.06, 0.02, np.abs(c.hu + 0.02 - 0.3 * (ax - 0.55) + 0.03 * (n2 - 0.5)))
                * smoothstep(0.55, 0.7, ax) * smoothstep(-0.6, 0.1, c.hf))
    cheek_bars = (right * smoothstep(0.35, 0.55, ax) * smoothstep(-0.05, -0.15, c.hu)
                  * (0.5 + 0.5 * np.cos(2 * np.pi * (c.hu + 0.15 * ax) / 0.13 + 2.0 * (n1 - 0.5))) ** 2)
    crown = (smoothstep(0.3, 0.7, c.hu) * smoothstep(0.85, 0.3, ax) * smoothstep(0.3, 0.1, c.ear_t)
             * smoothstep(-2.0, -1.6, c.hf))
    S = np.clip(0.9 * fore_zone * streak + 0.8 * blaze_edge + 0.75 * eye_line + 0.7 * cheek_bars
                + 0.95 * crown + 0.22 * (n2 - 0.5), 0, 1)
    # the tail: near-black rings on a cool grey ticked with silver, darker
    # toward a black tip (cooler than the cap, as in the photo)
    tail = c.tail * smoothstep(0.0, 0.08, c.tail_u)
    ring = rings(c.tail_u, n=9, duty=0.5, soft=0.5)
    t_dark = np.clip(0.3 + 0.6 * ring + 0.35 * smoothstep(0.75, 1.0, c.tail_u), 0, 1)
    t_silver = 0.3 * (1 - ring) * smoothstep(0.95, 0.6, c.tail_u)
    m_tail = tail * (1 - cap)
    k_dark = np.clip(0.12 + 0.82 * S, 0, 1)
    k_light = np.clip((0.3 + 0.2 * smoothstep(0.35, 0.1, c.hu) * (1 - c.ear)) * (1 - S), 0, 1)
    dark = cap * k_dark + m_tail * t_dark
    light = cap * k_light
    silver = m_tail * t_silver
    mid = cap * np.clip(1 - k_dark - k_light, 0, 1) + m_tail * np.clip(1 - t_dark - t_silver, 0, 1)
    white = np.clip(1 - dark - light - mid - silver, 0, 1)
    return {"white": white, "light": light, "mid": mid, "dark": dark, "silver": silver}


# short and plush, soft and layered like the others' coats (clumps, a little
# frizz, guard hairs standing off it), so his white does not read as smooth
# plastic; the chest, belly and neck coat longer than his body's: it drapes
# over the folds where the chest meets the belly and the jaw the thick neck
FUR = dict(
    points=7,
    clump=0.5,
    clump_size=4.0,
    frizz=0.04,
    spread=13.0,
    guard=dict(share=0.08, length=1.35, lift=8.0),
    length=dict(body=16.0, chest=19.0, belly=19.0, neck=18.0, face=5.0, muzzle=2.5, chin=4.0, brow=4.5,
                cheek=8.0,                                   # a tomcat's full cheeks
                ear=3.0, fore=8.0, hind=11.0, paw=4.0, tail=10.0),
    lift=dict(body=(34.0, 8.0)),
    inner_ear_density=0.6,                                    # pale hairs over the pink, as on him
    furnish=dict(length=11.0, count=1500, colour="#e2dbd5"),
)
# olive sage, greyer than a lime eye, a little yellow round the pupil; his
# pupils are ovals in the photo, never slits, but not so wide that under his
# heavy lids the green shrinks to a crescent
EYES = dict(inner="#a19f78", outer="#6d7a62", limbus="#373f2c", pupil=dict(width=0.42, height=0.74))
# a dusky pink nose, small; on a white chin the default near-black lip line
# drew a cartoon mouth, his is a soft grey-pink
SKIN = dict(nose="#9e7674", inner_ear="#bfa8a4", nose_size=0.9, lips="#857073")
WHISKERS = dict(forward=-5.0)
HALO = {}
LIGHTS = dict(rim=0.6, kicker=0.75)   # white fur throws the pink rim back hard; keep him white
