"""The skeleton in numpy: forward kinematics, world-space edits and skinning.

A pose is the list of local "basis" matrices, one per joint, exactly as
Blender keeps them (`pose = parent_pose @ parent_rest^-1 @ rest @ basis`;
every joint of this rig inherits rotation and scale). Edits are made in world
space (rotate this joint about its head, move the root) and written back into
the basis, so the children follow, and `fk()` gives the world matrices again.

Skinning is linear blend skinning with the base's weights. A shaped rest
(see shape.py) is a new set of rest matrices plus, per joint, the affine map
that carries the original rest mesh onto the shaped one; the skinning matrix
of a joint is then `pose @ shaped_rest^-1 @ shape_map`.

Joint frames never rely on bone-local axes (the glTF importer points bone Y
sideways on the legs): directions come from joint positions (`chain_dir`).
"""

import numpy as np

from .vecmath import about, mat4, nrm, rot_between

# The joint chains of the XR cat, root to tip. Shape, pose and cat space use them.
SPINE = ["Pelvis", "Spine01", "Spine02", "Spine03", "Chest", "Neck01", "Neck02", "Neck03", "Head"]
TAIL = ["Tail01", "Tail02", "Tail03", "Tail04", "Tail05", "Tail06", "Tail07"]
LEGS = {
    "fore.L": ["leftLeg2_LoResUpperLeg", "leftLeg2_LoResLowerLeg", "leftLeg2_LoResFoot",
               "leftLeg2_LoResToe", "leftLeg2_LoResToe_end"],
    "fore.R": ["rightLeg2_LoResUpperLeg", "rightLeg2_LoResLowerLeg", "rightLeg2_LoResFoot",
               "rightLeg2_LoResToe", "rightLeg2_LoResToe_end"],
    "hind.L": ["leftLeg1_LoResUpperLeg", "leftLeg1_LoResLowerLeg", "leftLeg1_LoResFoot",
               "leftLeg1_LoResToe", "leftLeg1_LoResToe_end"],
    "hind.R": ["rightLeg1_LoResUpperLeg", "rightLeg1_LoResLowerLeg", "rightLeg1_LoResFoot",
               "rightLeg1_LoResToe", "rightLeg1_LoResToe_end"],
}
EARS = {"L": ["L_Ear01", "L_Ear02", "L_Ear03"], "R": ["R_Ear01", "R_Ear02", "R_Ear03"]}
LIDS = {"L": ("L_UpperEyeLid", "L_LowerEyeLid"), "R": ("R_UpperEyeLid", "R_LowerEyeLid")}
EYE_JOINT = {"L": "leftEye1_EyeballJoint", "R": "rightEye1_EyeballJoint"}
# Joints of the face whose clip keys are an expression (the sit frame has the
# eyes shut and the brows down): the generator starts them from rest.
FACE = ["L_UpperLip", "L_Nasal", "L_InBrow", "L_Cheek", "L_OutBrow", "L_LowerEyeLid", "L_UpperEyeLid",
        "R_UpperLip", "R_Nasal", "R_InBrow", "R_Cheek", "R_OutBrow", "R_LowerEyeLid", "R_UpperEyeLid",
        "Jaw", "L_BottomLip", "R_BottomLip", "BottomLip", "UpperLip", "Tongue01", "Tongue02", "Tongue03",
        "leftEye1_EyeballJoint", "rightEye1_EyeballJoint"]


class Skeleton:
    """Joint names, parents and rest matrices (metres, world = armature space)."""

    def __init__(self, names, parent, rest):
        self.names = list(names)
        self.parent = np.asarray(parent)
        self.rest = np.array(rest, float)
        self._idx = {n: i for i, n in enumerate(self.names)}

    def i(self, name):
        return self._idx[name]

    def copy(self, rest=None):
        return Skeleton(self.names, self.parent, self.rest if rest is None else rest)

    def head(self, name, M=None):
        """Head position of a joint in a pose (world matrices M) or at rest."""
        M = self.rest if M is None else M
        return M[self.i(name), :3, 3].copy()

    def fk(self, basis):
        """World matrices (B, 4, 4) from local basis matrices."""
        P = np.empty_like(self.rest)
        inv = np.linalg.inv(self.rest)
        for i, p in enumerate(self.parent):
            if p < 0:
                P[i] = self.rest[i] @ basis[i]
            else:
                P[i] = P[p] @ inv[p] @ self.rest[i] @ basis[i]
        return P

    def set_world(self, basis, i, Pw, P=None):
        """Change joint i's basis so that its world matrix becomes Pw."""
        P = self.fk(basis) if P is None else P
        p = self.parent[i]
        if p < 0:
            basis[i] = np.linalg.inv(self.rest[i]) @ Pw
        else:
            basis[i] = np.linalg.inv(P[p] @ np.linalg.inv(self.rest[p]) @ self.rest[i]) @ Pw
        return basis

    def rotate(self, basis, name, R, pivot=None):
        """Rotate a joint (and so its subtree) by the 3x3 world rotation R about its head."""
        P = self.fk(basis)
        i = self.i(name)
        piv = P[i, :3, 3] if pivot is None else np.asarray(pivot, float)
        return self.set_world(basis, i, about(R, piv) @ P[i], P)

    def transform_root(self, basis, M):
        """Apply a world affine M to the whole skeleton (through the root joint)."""
        P = self.fk(basis)
        return self.set_world(basis, 0, M @ P[0], P)

    def aim(self, basis, name, child, target_dir):
        """Turn a joint so the direction to `child`'s head becomes target_dir."""
        P = self.fk(basis)
        d = P[self.i(child), :3, 3] - P[self.i(name), :3, 3]
        return self.rotate(basis, name, rot_between(d, target_dir))

    def skin_matrices(self, P, shaped_rest=None, shape_maps=None):
        """Per-joint 4x4 skinning matrices from the rest mesh to the pose."""
        R = self.rest if shaped_rest is None else shaped_rest
        K = P @ np.linalg.inv(R)
        if shape_maps is not None:
            K = K @ shape_maps
        return K


def skin(V, W, K):
    """Linear blend skinning: points (N, 3), weights (N, B), matrices (B, 4, 4)."""
    A = np.einsum("nb,bij->nij", W, K[:, :3, :], optimize=True)  # (N, 3, 4)
    return np.einsum("nij,nj->ni", A[:, :, :3], V, optimize=True) + A[:, :, 3]


def skin_point(p, w, K):
    """Skin one point with one weight row."""
    A = np.einsum("b,bij->ij", w, K[:, :3, :])
    return A[:, :3] @ p + A[:, 3]


def chain_dir(skel, chain, M=None):
    """Unit directions joint -> next joint along a chain (last repeats)."""
    H = np.array([skel.head(n, M) for n in chain])
    d = nrm(np.diff(H, axis=0))
    return np.vstack([d, d[-1:]])


def frame_from(y, z_hint):
    """3x3 frame with columns X, Y, Z: Y along y, Z towards z_hint."""
    y = nrm(y)
    z = nrm(np.asarray(z_hint, float) - np.dot(z_hint, y) * y)
    return np.stack([np.cross(y, z), y, z], axis=1)


def translate(t):
    return mat4(t=t)
