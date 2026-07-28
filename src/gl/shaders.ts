// GLSL sources inlined as ES module strings (raw WebGL2, GLSL ES 3.00).

export const planetVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat3 uNormalMat;
out vec3 vNormalW;
out vec2 vUV;
out vec3 vPosW;
void main() {
  vec4 posW = uModel * vec4(aPos, 1.0);
  vPosW = posW.xyz;
  vNormalW = normalize(uNormalMat * aNormal);
  vUV = aUV;
  gl_Position = uProj * uView * posW;
}`;

export const planetFrag = /* glsl */ `#version 300 es
precision highp float;
in vec3 vNormalW;
in vec2 vUV;
in vec3 vPosW;
uniform vec3 uSunDir;      // direction TO the sun, world space
uniform vec3 uColorA;      // base color
uniform vec3 uColorB;      // secondary / land tint
uniform float uUseTex;
uniform sampler2D uTex;
uniform float uAmbient;
uniform float uRimStrength;
uniform vec3 uCamPos;
out vec4 outColor;
void main() {
  vec3 N = normalize(vNormalW);
  float ndl = max(dot(N, normalize(uSunDir)), 0.0);
  vec3 albedo = mix(uColorA, uColorB, smoothstep(0.35, 0.65, vUV.y));
  if (uUseTex > 0.5) albedo = texture(uTex, vUV).rgb;
  // day/terminator
  float light = uAmbient + (1.0 - uAmbient) * ndl;
  vec3 col = albedo * light;
  // subtle atmospheric rim toward camera
  vec3 V = normalize(uCamPos - vPosW);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRimStrength;
  col += vec3(0.30, 0.55, 0.85) * rim * (0.4 + 0.6 * ndl);
  outColor = vec4(col, 1.0);
}`;

export const sunVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform vec3 uCamPos;
out vec3 vNormalW;
out vec3 vPosW;
void main() {
  vec4 posW = uModel * vec4(aPos, 1.0);
  vPosW = posW.xyz;
  vNormalW = normalize(mat3(uModel) * aNormal);
  gl_Position = uProj * uView * posW;
}`;

export const sunFrag = /* glsl */ `#version 300 es
precision highp float;
in vec3 vNormalW;
in vec3 vPosW;
uniform float uTime;
uniform vec3 uCamPos;
out vec4 outColor;
void main() {
  vec3 V = normalize(uCamPos - vPosW);
  float facing = max(dot(normalize(vNormalW), V), 0.0);
  float flicker = 0.92 + 0.08 * sin(uTime * 3.0);
  // hot bright center, warmer glowing limb
  vec3 core = vec3(1.0, 0.96, 0.82);
  vec3 limb = vec3(1.0, 0.55, 0.12);
  vec3 col = mix(limb, core, pow(facing, 0.6)) * flicker;
  col += limb * pow(1.0 - facing, 2.0) * 0.8; // limb glow
  outColor = vec4(col, 1.0);
}`;

export const starVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aSize;
layout(location=2) in float aTwinkle;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;
out float vAlpha;
void main() {
  // stars sit on a large sphere; strip translation from the view matrix
  mat4 v = uView;
  v[3][0] = 0.0; v[3][1] = 0.0; v[3][2] = 0.0;
  gl_Position = uProj * v * vec4(aPos, 1.0);
  gl_PointSize = aSize;
  vAlpha = 0.55 + 0.45 * sin(uTime * 1.3 + aTwinkle * 6.283);
}`;

export const starFrag = /* glsl */ `#version 300 es
precision highp float;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  outColor = vec4(vec3(0.85, 0.9, 1.0), a);
}`;

// Instanced billboard markers for NEOs. Per-instance: center, size, color, id.
export const markerVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;      // quad corner in [-0.5,0.5]
layout(location=1) in vec3 iCenter;      // instance world center
layout(location=2) in float iSize;       // instance world size
layout(location=3) in vec3 iColor;       // instance color
layout(location=4) in vec3 iPickColor;   // instance pick id color
uniform mat4 uView;
uniform mat4 uProj;
uniform float uPickMode;
uniform int uSelected;                    // selected instance index, -1 = none
out vec2 vCorner;
out vec3 vColor;
out float vSelected;
void main() {
  vCorner = aCorner;
  vSelected = (gl_InstanceID == uSelected) ? 1.0 : 0.0;
  vColor = uPickMode > 0.5 ? iPickColor : iColor;
  // camera-facing billboard: use view-space right/up
  vec3 right = vec3(uView[0][0], uView[1][0], uView[2][0]);
  vec3 up    = vec3(uView[0][1], uView[1][1], uView[2][1]);
  float s = iSize * (uPickMode > 0.5 ? 1.6 : 1.0); // fatter pick target
  vec3 world = iCenter + (right * aCorner.x + up * aCorner.y) * s;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

export const markerFrag = /* glsl */ `#version 300 es
precision highp float;
in vec2 vCorner;
in vec3 vColor;
in float vSelected;
uniform float uPickMode;
uniform float uTime;
out vec4 outColor;
void main() {
  float d = length(vCorner);
  if (uPickMode > 0.5) {
    // solid disc for reliable picking
    if (d > 0.5) discard;
    outColor = vec4(vColor, 1.0);
    return;
  }
  float ring = smoothstep(0.5, 0.42, d) - smoothstep(0.4, 0.3, d);
  float dot_ = smoothstep(0.16, 0.05, d);
  float pulse = 0.6 + 0.4 * sin(uTime * 4.0);
  float sel = vSelected > 0.5 ? (0.5 + 0.5 * sin(uTime * 8.0)) : 0.0;
  float a = clamp(dot_ + ring * pulse + sel * ring, 0.0, 1.0);
  if (a < 0.02) discard;
  outColor = vec4(vColor, a);
}`;

// Satellite point cloud (positions already in world/Earth-radii units).
export const satVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uSize;
uniform vec3 uSunDir;   // direction TO the sun (unit), scene frame
out float vShade;       // 1 = sunlit, <1 = in Earth's shadow
void main() {
  gl_Position = uProj * uView * vec4(aPos, 1.0);
  gl_PointSize = uSize;
  // eclipse: behind Earth from the sun and within the shadow cylinder (R=1)
  float proj = dot(aPos, uSunDir);
  float shade = 1.0;
  if (proj < 0.0) {
    float perp = length(aPos - proj * uSunDir);
    shade = mix(0.28, 1.0, smoothstep(0.9, 1.15, perp)); // soft penumbra
  }
  vShade = shade;
}`;

export const satFrag = /* glsl */ `#version 300 es
precision highp float;
in float vShade;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  float a = smoothstep(0.5, 0.15, d);
  if (a < 0.02) discard;
  vec3 col = uColor * vShade;
  outColor = vec4(col, a * (0.5 + 0.5 * vShade));
}`;

// Satellite color-ID picking: each point carries a global id; encode id+base
// into RGB so the pixel under the cursor resolves to a specific satellite.
export const satPickVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aId;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uSize;
uniform float uBase;
out vec3 vId;
void main() {
  gl_Position = uProj * uView * vec4(aPos, 1.0);
  gl_PointSize = uSize;
  float id = aId + uBase;
  vId = vec3(mod(id, 256.0), mod(floor(id / 256.0), 256.0), mod(floor(id / 65536.0), 256.0)) / 255.0;
}`;

export const satPickFrag = /* glsl */ `#version 300 es
precision highp float;
in vec3 vId;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  if (length(p) > 0.5) discard;
  outColor = vec4(vId, 1.0);
}`;

export const lineVert = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat4 uModel;
void main() {
  gl_Position = uProj * uView * uModel * vec4(aPos, 1.0);
}`;

export const lineFrag = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
out vec4 outColor;
void main() { outColor = vec4(uColor, uAlpha); }`;
