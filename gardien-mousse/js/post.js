// Post-processing: the scene is rendered in HDR, then
//   1. bloom (bright parts glow: chest light, sun, trails, seeds)
//   2. a Kuwahara "paint" filter that flattens textures into brush-like patches (the film's painted look)
//   3. colour grade: warm highlights, teal shadows, soft S-curve, vignette, paper grain.
// createPost(renderer) -> { setSize(w, h), render(scene, camera), setPaint(radius) }
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { SHARED, canvasTexture, rng } from "./commun.js";

const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

export function createPost(renderer) {
  const P = CONFIG.post;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.Camera();
  const rt = (w, h, samples = 0) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0 });
  let main = rt(4, 4, 4), b1 = rt(4, 4), b2 = rt(4, 4), c1 = rt(4, 4), c2 = rt(4, 4);
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); };

  const bright = new THREE.ShaderMaterial({ vertexShader: VS, uniforms: { tSrc: { value: null }, uT: { value: P.bloomThreshold } },
    fragmentShader: `uniform sampler2D tSrc; uniform float uT; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(c * smoothstep(uT, uT + 0.6, l), 1.0); }` });
  const blur = new THREE.ShaderMaterial({ vertexShader: VS, uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
        s += (texture2D(tSrc, vUv + uDir * 1.385).rgb + texture2D(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
        s += (texture2D(tSrc, vUv + uDir * 3.231).rgb + texture2D(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
        gl_FragColor = vec4(s, 1.0); }` });

  // paper grain texture (tiled)
  const paper = canvasTexture(256, 256, (g, w, h) => {
    const r = rng(12), img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 128 + (r() - 0.5) * 60; img.data.set([v, v, v, 255], i * 4); }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 0.08; for (let i = 0; i < 400; i++) { g.strokeStyle = r() < 0.5 ? "#fff" : "#000"; g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8); g.stroke(); }
  }, false);
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;

  function finalMaterial(radius) {
    return new THREE.ShaderMaterial({
      vertexShader: VS,
      defines: { RAD: radius },
      uniforms: {
        tSrc: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, tPaper: { value: paper },
        uTexel: { value: new THREE.Vector2() }, uTime: SHARED.uTime, uBloom: { value: P.bloomStrength },
        uGrain: { value: P.grain }, uVig: { value: P.vignette }, uWarm: { value: P.warmth }, uFade: { value: 0 }, uAspect: { value: 1 },
      },
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc, tBloom, tBloom2, tPaper; uniform vec2 uTexel; uniform float uTime, uBloom, uGrain, uVig, uWarm, uFade, uAspect;
        varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        vec3 paint(vec2 uv){
          #if RAD > 0
            // Kuwahara: for each of 4 quadrants, mean + variance; keep the calmest quadrant
            vec3 m[4]; vec3 s[4];
            for (int k = 0; k < 4; k++){ m[k] = vec3(0.0); s[k] = vec3(0.0); }
            for (int j = -RAD; j <= RAD; j++) for (int i = -RAD; i <= RAD; i++) {
              vec3 c = texture2D(tSrc, uv + vec2(float(i), float(j)) * uTexel).rgb;
              c = c / (1.0 + c);                           // compress HDR so bright pixels do not dominate
              vec3 c2 = c * c;
              if (i <= 0 && j <= 0) { m[0] += c; s[0] += c2; }
              if (i >= 0 && j <= 0) { m[1] += c; s[1] += c2; }
              if (i <= 0 && j >= 0) { m[2] += c; s[2] += c2; }
              if (i >= 0 && j >= 0) { m[3] += c; s[3] += c2; }
            }
            float n = float((RAD + 1) * (RAD + 1)), best = 1e9; vec3 res = vec3(0.0);
            for (int k = 0; k < 4; k++){ vec3 mu = m[k] / n; vec3 v = abs(s[k] / n - mu * mu); float sv = v.r + v.g + v.b;
              if (sv < best) { best = sv; res = mu; } }
            return res / max(1.0 - res, 0.001);
          #else
            return texture2D(tSrc, uv).rgb;
          #endif
        }
        void main(){
          vec3 c = paint(vUv);
          c += (texture2D(tBloom, vUv).rgb * 0.6 + texture2D(tBloom2, vUv).rgb * 0.8) * uBloom;
          c *= 1.08;
          c = aces(c);
          // grade: teal shadows, warm highlights, lifted blacks (soft painted film)
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, c * vec3(0.9, 1.0, 1.06) + vec3(0.0, 0.012, 0.02), (1.0 - l) * 0.6);
          c = mix(c, c * vec3(1.0 + uWarm, 1.0, 1.0 - uWarm * 1.2), l);
          c = mix(vec3(l), c, 1.04);
          c = c * 0.97 + 0.022;
          // vignette + paper + grain
          vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
          c *= 1.0 - uVig * smoothstep(0.35, 1.0, length(d) * 1.25);
          float p = texture2D(tPaper, vUv * vec2(uAspect, 1.0) * 2.5).r - 0.5;
          float g = fract(sin(dot(vUv * 1000.0 + fract(uTime) * 17.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          c += (p * 0.5 + g * 0.6) * uGrain;
          c = mix(c, vec3(0.03, 0.025, 0.03), uFade);
          gl_FragColor = vec4(toSRGB(clamp(c, 0.0, 1.0)), 1.0);
        }`,
    });
  }
  let finalMat = finalMaterial(SHARED.quality.paint);
  let W = 4, H = 4, bloomOn = SHARED.quality.bloom;

  return {
    get fade() { return finalMat.uniforms.uFade.value; },
    set fade(v) { finalMat.uniforms.uFade.value = v; },
    setPaint(radius, bloom) { const f = finalMat.uniforms.uFade.value; finalMat.dispose(); finalMat = finalMaterial(radius); finalMat.uniforms.uFade.value = f; bloomOn = bloom; this.setSize(W, H); },
    setSize(w, h) {
      W = w; H = h;
      main.setSize(w, h); b1.setSize(w >> 2, h >> 2); b2.setSize(w >> 2, h >> 2); c1.setSize(w >> 3, h >> 3); c2.setSize(w >> 3, h >> 3);
      finalMat.uniforms.uTexel.value.set(1 / w, 1 / h); finalMat.uniforms.uAspect.value = w / h;
    },
    render(scene, camera) {
      renderer.setRenderTarget(main); renderer.render(scene, camera);
      if (bloomOn) {
        bright.uniforms.tSrc.value = main.texture; pass(bright, b1);
        blur.uniforms.tSrc.value = b1.texture; blur.uniforms.uDir.value.set(1 / b1.width, 0); pass(blur, b2);
        blur.uniforms.tSrc.value = b2.texture; blur.uniforms.uDir.value.set(0, 1 / b1.height); pass(blur, b1);
        blur.uniforms.tSrc.value = b1.texture; blur.uniforms.uDir.value.set(1 / c1.width, 0); pass(blur, c2);
        blur.uniforms.tSrc.value = c2.texture; blur.uniforms.uDir.value.set(0, 1 / c1.height); pass(blur, c1);
      }
      finalMat.uniforms.tSrc.value = main.texture;
      finalMat.uniforms.tBloom.value = bloomOn ? b1.texture : null;
      finalMat.uniforms.tBloom2.value = bloomOn ? c1.texture : null;
      finalMat.uniforms.uBloom.value = bloomOn ? P.bloomStrength : 0;
      pass(finalMat, null);
    },
  };
}
