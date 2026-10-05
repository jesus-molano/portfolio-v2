"""Deep-merged parameter dicts, so a typo in a cat's file fails the build.

Every module of the generator keeps its parameters as a `DEFAULT` dict; a
cat's file (suspects/<name>.py) gives only what differs. `merged` returns a
copy of the default updated by the cat's values and raises on any key the
default does not have, except below the keys listed in `free` (where any
name is allowed: joint names under `bones`).
"""

import copy


def merged(default, new, path, free=("bones",)):
    out = copy.deepcopy(default)

    def upd(base, values, where):
        for k, v in values.items():
            if k not in base:
                if where.split(".")[-1] in free:
                    base[k] = copy.deepcopy(v)
                    continue
                raise KeyError(f"unknown parameter {where}.{k}")
            if isinstance(base[k], dict) and isinstance(v, dict):
                upd(base[k], v, f"{where}.{k}")
            else:
                base[k] = copy.deepcopy(v)

    upd(out, new or {}, path)
    return out
