"""The select screen's states: a suspect refusing to be chosen, as data.

THE USUAL SUSPECTS is a character select. Each cat refuses in its own way,
and the page swaps its layer for one of these when she tries to choose it:

- `kira-back`: Kira turns her back on the lens. The whole cat turns half a
  circle about her footprint, her head a little less (the ear and a sliver
  of cheek show over her shoulder: not having it), the ears swivelled back
  toward the lens, the plume round her other haunch: her tail path turned
  with her, so it starts at her rump (now toward the lens) and wraps round
  to the far side;
- `tom-asleep`: Tom falls asleep where he sits. Only the lids change (both
  shut, the clip's blink): every other joint, and so every other strand of
  fur, is his line-up layer's, so the page can cross-fade the two images
  and only the eyes close.
- `dante-swipe`: Dante, the one who attacks, mid-strike: crouched, his
  right fore paw thrown up and out toward the lens, cocked across the swing
  with its claws out (cats/claws.py), the ears flattened back, the eyes
  narrowed to slits under lowered brows, and a hiss: the jaw dropped, the
  upper lip drawn up, the nose wrinkled.

A state keeps its cat's key, so the generator seeds every draw (fur,
whiskers) as for the cat itself: the same coat, strand for strand. Only
the pose (and the eyes and claws, for Dante) is overridden here, deep-merged into the
cat's own. The layer's name (`layer`) names the files.
"""

STATES = {
    "kira-back": dict(
        cat="kira",
        pose=dict(
            body=dict(yaw=180.0),
            # the head 22 degrees short of the body's turn, toward image
            # right: her left ear and a sliver of cheek over her shoulder
            head=dict(yaw=158.0, pitch=-4.0, roll=-3.0),
            # ears swivelled back to listen to the lens behind her
            ears=dict(L=dict(out=8.0, back=4.0, swivel=-28.0), R=dict(out=8.0, back=4.0, swivel=-34.0)),
            # paws planted as the clip has them (her line-up's small offsets
            # were toward the lens; turned, they would point away)
            paws=dict(fore=dict(L=dict(forward=0.0), R=dict(forward=0.0, out=0.0))),
            # her line-up path turned half a circle with her: from her rump
            # (now toward the lens) round her right haunch (now image right),
            # the tip on the floor beside her far paws
            tail=[(4.5, -11.5, 2.4), (8.0, -6.5, 2.4), (9.0, 0.0, 2.4), (6.5, 6.0, 2.4), (1.0, 8.5, 2.6),
                  (-3.0, 8.0, 2.8)],
        ),
    ),
    "tom-asleep": dict(
        cat="tom",
        pose=dict(lids=dict(L=dict(upper=1.0, lower=1.0), R=dict(upper=1.0, lower=1.0))),
    ),
    "dante-swipe": dict(
        cat="dante",
        pose=dict(
            # crouched into the strike: the head low and turned a little toward
            # the paw, the chin tucked behind the shoulder
            spine=dict(slump=10.0),
            head=dict(roll=-6.0, pitch=-7.0, yaw=-8.0),
            # a hiss: the eyes narrowed under lowered brows, the jaw dropped,
            # the upper lip drawn up off the teeth and the nose wrinkled
            lids=dict(L=dict(upper=0.5, lower=0.3), R=dict(upper=0.52, lower=0.3)),
            ears=dict(L=dict(back=72.0, out=58.0, swivel=-14.0), R=dict(back=72.0, out=58.0, swivel=-14.0)),
            bones={
                "Jaw": (-26.0, 0.0, 0.0),
                "UpperLip": (14.0, 0.0, 0.0), "L_UpperLip": (18.0, 0.0, 0.0), "R_UpperLip": (18.0, 0.0, 0.0),
                "L_Nasal": (8.0, 0.0, 0.0), "R_Nasal": (8.0, 0.0, 0.0),
                "L_InBrow": (-10.0, 0.0, 0.0), "R_InBrow": (-10.0, 0.0, 0.0),
            },
            # his right fore paw (image left) mid-strike: thrown up and out to
            # the side and toward the lens, the paw cocked across the swing so
            # its edge and its claws lead, the pads turned half to the lens
            paws=dict(fore=dict(R=dict(lift=13.5, forward=7.0, out=9.0, tilt=30.0, roll=-62.0, yaw=0.0))),
        ),
        # an aggressive cat's pupils: narrow slits
        eyes=dict(pupil=dict(width=0.2, height=0.84)),
        claws={"fore.R": {}},
    ),
}
