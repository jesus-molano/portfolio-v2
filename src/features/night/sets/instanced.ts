import { boardVertexShader } from "../shaders/board";

/** The board shaders on instanced boxes: the same varyings, through the instance matrix. */
export const instancedBoardVertexShader = boardVertexShader
  .replace("vec4 world = modelMatrix * vec4(position, 1.0);", "vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);")
  .replace(
    "vNormal = normalize(mat3(modelMatrix) * normal);",
    "vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);",
  );
