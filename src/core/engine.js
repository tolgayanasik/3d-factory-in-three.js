// Renderer, scene, cameras, lighting/sky (time of day) and post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { setMaxAnisotropy } from '../world/textures.js';

export class Engine {
  constructor(container) {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    setMaxAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fb4c8);
    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.25, 3000);
    this.camera.position.set(-70, 62, 88);

    // Environment reflections (studio room) – gives metals/paint their sheen
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.55;

    // Gradient sky dome (LDR, so it never floods the bloom pass) with sun glow and stars
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x3b78c4) }, horizon: { value: new THREE.Color(0xcfe3f5) }, ground: { value: new THREE.Color(0x6f7a70) },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color(0xfff1d6) }, night: { value: 0 },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 zenith, horizon, ground, sunDir, sunColor; uniform float night; varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          float h = vDir.y;
          vec3 col = h > 0.0 ? mix(horizon, zenith, pow(clamp(h,0.0,1.0), 0.45)) : mix(horizon, ground, pow(clamp(-h*4.0,0.0,1.0), 0.6));
          float sd = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * (pow(sd, 700.0) * 0.9 + pow(sd, 12.0) * 0.18) * (1.0 - night * 0.9);
          if (night > 0.3 && h > 0.05) { vec3 q = floor(vDir * 380.0); float st = step(0.9975, hash(q)); col += vec3(st) * (night - 0.3) * 1.2; }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // Lights
    this.hemi = new THREE.HemisphereLight(0xdde8ff, 0x5a544c, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1e0, 2.6);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(4096, 4096);
    s.camera.left = -78; s.camera.right = 78; s.camera.top = 58; s.camera.bottom = -58;
    s.camera.near = 10; s.camera.far = 260;
    s.bias = -0.0004; s.normalBias = 0.035; s.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    // interior fill (the roof blocks the real sun – this stands in for the high-bay lamps)
    this.fill = new THREE.DirectionalLight(0xfff6ea, 0.6);
    this.fill.position.set(10, 40, 5);
    this.scene.add(this.fill);

    // Post-processing
    const size = new THREE.Vector2(container.clientWidth, container.clientHeight);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const comp = (this.composer = new EffectComposer(r, rt));
    comp.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, size.x, size.y);
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 2.0, scale: 1.1, samples: 12, distanceFallOff: 1 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    comp.addPass(this.gtao);
    this.outline = new OutlinePass(size, this.scene, this.camera);
    Object.assign(this.outline, { edgeStrength: 4.5, edgeGlow: 0.6, edgeThickness: 1.6, pulsePeriod: 2.5 });
    this.outline.visibleEdgeColor.set(0x33e1ff);
    this.outline.hiddenEdgeColor.set(0x1a6f8a);
    comp.addPass(this.outline);
    // hover indicator: light-weight bounding brackets instead of a 2nd outline pass
    this.hoverBox = new THREE.Box3Helper(new THREE.Box3(), 0xbff4ff);
    this.hoverBox.material.transparent = true;
    this.hoverBox.material.opacity = 0.7;
    this.hoverBox.visible = false;
    this.scene.add(this.hoverBox);
    this.bloom = new UnrealBloomPass(size, 0.5, 0.4, 2.2);
    comp.addPass(this.bloom);
    comp.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.smaa.enabled = false;
    comp.addPass(this.smaa);

    // CSS labels
    this.labels = new CSS2DRenderer();
    this.labels.setSize(container.clientWidth, container.clientHeight);
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    this.setQuality('high');
    this.setTimeOfDay(10.5);
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  setQuality(q) {
    this.quality = q;
    const r = this.renderer;
    this.gtao.enabled = q === 'high';
    this.bloom.enabled = q !== 'low';
    this.sun.shadow.mapSize.setScalar(q === 'low' ? 1024 : q === 'medium' ? 2048 : 4096);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    r.shadowMap.enabled = q !== 'low';
    r.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio, q === 'medium' ? 1.25 : 1.75));
    this.resize();
    this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
  }

  // hour 0..24 → sun position, sky, light colour; interior lamps react via callback
  setTimeOfDay(hour) {
    this.hour = hour;
    const dayAngle = ((hour - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
    const elev = Math.sin(dayAngle) * 62; // degrees
    const azim = 110 + ((hour - 6) / 12) * 140;
    const phi = THREE.MathUtils.degToRad(90 - Math.max(elev, -8));
    const theta = THREE.MathUtils.degToRad(azim);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    const day = THREE.MathUtils.clamp((elev + 4) / 30, 0, 1); // 0 night … 1 full day
    const su = this.sky.material.uniforms;
    su.sunDir.value.copy(dir);
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev - 4) / 14, 0, 1);
    su.zenith.value.setHSL(0.6, 0.55, 0.06 + day * 0.4);
    su.horizon.value.setHSL(0.58 - dusk * 0.5, 0.35 + dusk * 0.4, 0.1 + day * 0.72 + dusk * 0.1);
    su.ground.value.setHSL(0.3, 0.1, 0.05 + day * 0.35);
    su.sunColor.value.setHSL(0.1 - dusk * 0.06, 0.8, 0.75);
    su.night.value = 1 - day;
    this.daylight = day;
    const warm = THREE.MathUtils.clamp(1 - elev / 25, 0, 1) * day;
    // Keep the shadow-casting light high enough to light the interior; tint by sun
    const sd = dir.clone();
    sd.y = Math.max(sd.y, 0.55);
    sd.normalize();
    this.sun.position.copy(sd.multiplyScalar(140));
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.setHSL(0.09, 0.35 + warm * 0.4, 0.92 - warm * 0.15);
    this.sun.intensity = 0.55 + day * 1.75;
    this.hemi.intensity = 0.4 + day * 0.55;
    this.hemi.color.setHSL(0.6, 0.35, 0.55 + day * 0.35);
    this.fill.intensity = 0.45 + (1 - day) * 0.55;
    this.fill.color.setHSL(0.1, 0.25, 0.9);
    this.scene.environmentIntensity = 0.3 + day * 0.3;
    this.renderer.toneMappingExposure = 0.9 + day * 0.15;
    this.bloom.strength = 0.4 + (1 - day) * 0.45;
    this.onTimeOfDay?.(1 - day);
  }

  render() {
    // shadows are re-rendered every 2nd frame (every 4th on medium) – big saving, no visible lag
    this.frame = (this.frame || 0) + 1;
    const every = this.quality === 'high' ? 2 : 4;
    this.renderer.shadowMap.autoUpdate = false;
    if (this.frame % every === 0) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }
}
