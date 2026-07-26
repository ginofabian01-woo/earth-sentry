// Procedural geometry generators + buffer helpers for raw WebGL2.

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
}

/** UV sphere centered at origin, radius 1. */
export function makeUVSphere(latBands = 48, lonBands = 96): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon * 2 * Math.PI) / lonBands;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      const x = cosP * sinT;
      const y = cosT;
      const z = sinP * sinT;
      positions.push(x, y, z);
      normals.push(x, y, z);
      // u wraps with longitude, v top->bottom
      uvs.push(1 - lon / lonBands, 1 - lat / latBands);
    }
  }

  const rowLen = lonBands + 1;
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const a = lat * rowLen + lon;
      const b = a + rowLen;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

export interface Mesh {
  vao: WebGLVertexArrayObject;
  indexCount: number;
}

/** Upload a MeshData into a VAO with attribs 0=pos,1=normal,2=uv. */
export function createMesh(gl: WebGL2RenderingContext, data: MeshData): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const put = (loc: number, arr: Float32Array, size: number) => {
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  };
  put(0, data.positions, 3);
  put(1, data.normals, 3);
  put(2, data.uvs, 2);

  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  return { vao, indexCount: data.indices.length };
}

/** A flat quad in the XY plane, corners in [-0.5,0.5], attrib 0 = vec2. */
export function createQuad(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  const corners = new Float32Array([
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return vao;
}

/** Random starfield positions on a sphere of given radius, plus size/twinkle. */
export function makeStarfield(count: number, radius: number) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const twinkle = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // uniform on sphere
    const u = Math.random() * 2 - 1;
    const t = Math.random() * 2 * Math.PI;
    const r = Math.sqrt(1 - u * u);
    pos[i * 3] = radius * r * Math.cos(t);
    pos[i * 3 + 1] = radius * u;
    pos[i * 3 + 2] = radius * r * Math.sin(t);
    size[i] = 0.8 + Math.pow(Math.random(), 6) * 3.2;
    twinkle[i] = Math.random();
  }
  return { pos, size, twinkle, count };
}

export function createStarfield(
  gl: WebGL2RenderingContext,
  count: number,
  radius: number,
): { vao: WebGLVertexArrayObject; count: number } {
  const { pos, size, twinkle } = makeStarfield(count, radius);
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const attach = (loc: number, arr: Float32Array, s: number) => {
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, s, gl.FLOAT, false, 0, 0);
  };
  attach(0, pos, 3);
  attach(1, size, 1);
  attach(2, twinkle, 1);
  gl.bindVertexArray(null);
  return { vao, count };
}
