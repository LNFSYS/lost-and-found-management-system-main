import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Clock,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer
} from "three";

type BoxSize = [number, number, number];
type Position = [number, number, number];
type Rotation = [number, number, number];

export function JourneyScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    } catch {
      setFailed(true);
      return;
    }

    const scene = new Scene();
    const camera = new PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0.25, 3.15, 10.4);
    camera.lookAt(0, 0.35, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0xf1f8ff, 0);
    host.appendChild(renderer.domElement);

    scene.add(new HemisphereLight(0xffffff, 0xb7cadc, 2.45));
    const keyLight = new PointLight(0xffffff, 40, 30);
    keyLight.position.set(-4.5, 7, 5);
    scene.add(keyLight);
    const warmLight = new PointLight(0xff9b55, 18, 24);
    warmLight.position.set(4.8, 3.5, 4.5);
    scene.add(warmLight);

    const campus = new Group();
    campus.rotation.set(-0.08, -0.2, 0);
    campus.position.set(0, -0.12, 0);
    scene.add(campus);

    const textures: CanvasTexture[] = [];
    const materials = {
      white: new MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.62, metalness: 0.02 }),
      whiteWarm: new MeshStandardMaterial({ color: 0xfffdf8, roughness: 0.66, metalness: 0 }),
      glass: new MeshStandardMaterial({ color: 0xa9d9f5, roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.72 }),
      glassDark: new MeshStandardMaterial({ color: 0x2f6d98, roughness: 0.28, metalness: 0.08, transparent: true, opacity: 0.68 }),
      concrete: new MeshStandardMaterial({ color: 0xdde6ee, roughness: 0.74, metalness: 0 }),
      pavement: new MeshStandardMaterial({ color: 0xeaf1f8, roughness: 0.86, metalness: 0 }),
      courtyard: new MeshStandardMaterial({ color: 0xd97454, roughness: 0.72, metalness: 0 }),
      red: new MeshStandardMaterial({ color: 0xe85f28, roughness: 0.44, metalness: 0.04 }),
      blue: new MeshStandardMaterial({ color: 0x0b63b6, roughness: 0.38, metalness: 0.06 }),
      orange: new MeshStandardMaterial({ color: 0xf47b20, roughness: 0.4, metalness: 0.06 }),
      green: new MeshStandardMaterial({ color: 0x42a85b, roughness: 0.62, metalness: 0.02 }),
      leaf: new MeshStandardMaterial({ color: 0x2f8d58, roughness: 0.7, metalness: 0 }),
      trunk: new MeshStandardMaterial({ color: 0x8a5734, roughness: 0.78, metalness: 0 }),
      shadow: new MeshBasicMaterial({ color: 0x9fb7ca, transparent: true, opacity: 0.18 }),
      lineBlue: new MeshBasicMaterial({ color: 0x8fcfff, transparent: true, opacity: 0.56 }),
      lineOrange: new MeshBasicMaterial({ color: 0xff9b5e })
    };

    function addBox(parent: Group, size: BoxSize, position: Position, material: MeshStandardMaterial | MeshBasicMaterial, rotation: Rotation = [0, 0, 0]) {
      const mesh = new Mesh(new BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      parent.add(mesh);
      return mesh;
    }

    function createLabelTexture(lines: string[], colors: string[] = ["#123e6d"], width = 640, height = 220) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return undefined;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.fillRect(0, 0, width, height);
      context.fillStyle = colors[0];
      context.font = "800 70px Arial";
      context.textBaseline = "middle";
      context.fillText(lines[0], 34, height * 0.42);
      if (lines[1]) {
        context.fillStyle = colors[1] ?? "#66788d";
        context.font = "700 34px Arial";
        context.fillText(lines[1], 36, height * 0.72);
      }
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      textures.push(texture);
      return texture;
    }

    function addLabel(parent: Group, lines: string[], position: Position, size: [number, number], colors?: string[]) {
      const texture = createLabelTexture(lines, colors);
      if (!texture) return;
      const material = new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide });
      const label = new Mesh(new PlaneGeometry(size[0], size[1]), material);
      label.position.set(...position);
      parent.add(label);
    }

    function addPalm(parent: Group, x: number, z: number, scale = 1) {
      const tree = new Group();
      tree.position.set(x, -1.0, z);
      parent.add(tree);

      const trunk = new Mesh(new CylinderGeometry(0.045 * scale, 0.075 * scale, 0.9 * scale, 8), materials.trunk);
      trunk.position.y = 0.45 * scale;
      trunk.rotation.z = 0.08;
      tree.add(trunk);

      for (let index = 0; index < 7; index += 1) {
        const angle = (index / 7) * Math.PI * 2;
        const leaf = new Mesh(new BoxGeometry(0.11 * scale, 0.035 * scale, 0.74 * scale), materials.leaf);
        leaf.position.set(Math.sin(angle) * 0.18 * scale, 0.92 * scale, Math.cos(angle) * 0.18 * scale);
        leaf.rotation.set(index % 2 ? 0.18 : -0.08, angle, index % 2 ? 0.22 : -0.22);
        tree.add(leaf);
      }

      const crown = new Mesh(new SphereGeometry(0.12 * scale, 12, 12), materials.green);
      crown.position.y = 0.88 * scale;
      tree.add(crown);
    }

    addBox(campus, [10.4, 0.08, 6.2], [0, -1.08, 0.18], materials.pavement);
    addBox(campus, [9.5, 0.012, 5.3], [0, -1.025, 0.28], materials.shadow);
    addBox(campus, [4.2, 0.035, 1.55], [0.6, -1.0, 1.18], materials.courtyard);
    addBox(campus, [1.75, 0.04, 2.8], [0.35, -0.98, 0.2], materials.red, [0, -0.38, 0]);

    const lowBlock = new Group();
    campus.add(lowBlock);
    addBox(lowBlock, [4.7, 2.1, 1.5], [-2.45, 0.02, 0.1], materials.whiteWarm);
    addBox(lowBlock, [4.9, 0.14, 1.62], [-2.45, 1.15, 0.1], materials.concrete);
    addBox(lowBlock, [4.65, 0.08, 1.5], [-2.45, 1.28, -0.04], materials.red);
    for (let floor = 0; floor < 4; floor += 1) {
      const y = -0.65 + floor * 0.47;
      addBox(lowBlock, [4.3, 0.13, 0.045], [-2.45, y, 0.88], materials.glass);
      addBox(lowBlock, [4.55, 0.055, 0.24], [-2.45, y - 0.17, 0.96], materials.concrete);
      for (let column = 0; column < 6; column += 1) {
        const x = -4.28 + column * 0.73;
        addBox(lowBlock, [0.09, 0.34, 0.05], [x, y, 0.91], materials.white);
      }
      for (let planter = 0; planter < 5; planter += 1) {
        addBox(lowBlock, [0.35, 0.06, 0.08], [-4.0 + planter * 0.88, y - 0.26, 1.09], materials.green);
      }
    }

    const tower = new Group();
    campus.add(tower);
    addBox(tower, [2.25, 4.65, 1.55], [2.25, 1.25, -0.18], materials.white);
    addBox(tower, [2.55, 0.62, 1.82], [2.25, 3.9, -0.25], materials.whiteWarm);
    addBox(tower, [1.9, 0.32, 0.06], [2.25, 3.9, 0.68], materials.concrete);
    addBox(tower, [1.72, 0.26, 0.07], [2.25, 3.46, 0.69], materials.glassDark);
    for (let floor = 0; floor < 7; floor += 1) {
      const y = -0.62 + floor * 0.56;
      addBox(tower, [2.52, 0.065, 1.92], [2.25, y + 0.24, -0.18], materials.concrete);
      addBox(tower, [1.62, 0.2, 0.055], [2.25, y, 0.64], materials.glass);
      addBox(tower, [0.16, 0.28, 0.058], [1.35, y, 0.64], materials.whiteWarm);
      addBox(tower, [0.16, 0.28, 0.058], [3.15, y, 0.64], materials.whiteWarm);
      if (floor % 2 === 0) {
        addBox(tower, [2.72, 0.08, 0.42], [2.25, y - 0.2, 0.72], materials.concrete);
      }
    }
    addBox(tower, [0.72, 4.2, 0.08], [3.47, 1.18, -0.18], materials.glassDark, [0, Math.PI / 2, 0]);
    for (let stripe = 0; stripe < 4; stripe += 1) {
      addBox(tower, [0.08, 0.34, 1.45], [3.5, -0.32 + stripe * 0.82, -0.18], materials.whiteWarm);
    }

    addBox(campus, [1.45, 0.28, 0.44], [-0.08, -0.23, 0.28], materials.red);
    addBox(campus, [1.55, 0.06, 0.54], [-0.08, -0.04, 0.28], materials.orange);
    addBox(campus, [0.52, 0.58, 0.52], [0.78, -0.68, 1.08], materials.glass);
    addBox(campus, [0.44, 0.08, 0.62], [0.78, -0.33, 1.08], materials.concrete);

    addBox(campus, [4.95, 0.26, 0.12], [-1.42, -0.82, 2.45], materials.white);
    addLabel(campus, ["FPT UNIVERSITY", "DA NANG CAMPUS"], [-1.42, -0.78, 2.52], [4.25, 0.58], ["#0b63b6", "#f47b20"]);
    addBox(campus, [0.7, 0.32, 0.13], [-4.03, -0.56, 2.54], materials.blue);
    addBox(campus, [0.7, 0.32, 0.13], [-3.3, -0.56, 2.54], materials.orange);
    addBox(campus, [0.7, 0.32, 0.13], [-2.57, -0.56, 2.54], materials.green);

    addPalm(campus, -4.72, 1.96, 1.1);
    addPalm(campus, -3.95, 2.18, 0.92);
    addPalm(campus, -3.2, 2.05, 1.0);
    addPalm(campus, 4.25, 1.85, 0.98);
    addPalm(campus, 4.85, 1.32, 0.82);

    addBox(campus, [0.52, 0.72, 0.08], [-4.45, 0.2, -1.2], materials.blue);
    addBox(campus, [0.52, 0.72, 0.08], [4.75, 0.06, -1.08], materials.orange);
    addBox(campus, [0.22, 0.22, 0.22], [-4.45, 0.7, -1.14], materials.blue);
    addBox(campus, [0.22, 0.22, 0.22], [4.75, 0.56, -1.02], materials.orange);

    const path = new CatmullRomCurve3([
      new Vector3(-4.65, 1.05, -1.18),
      new Vector3(-3.4, 2.55, -0.65),
      new Vector3(-0.9, 1.55, 0.95),
      new Vector3(1.35, 2.35, 0.7),
      new Vector3(3.2, 1.2, -0.35),
      new Vector3(4.76, 0.85, -1.03)
    ]);
    campus.add(new Mesh(new TubeGeometry(path, 120, 0.026, 8, false), materials.lineBlue));

    const particles: Mesh[] = [];
    for (let index = 0; index < 24; index += 1) {
      const particle = new Mesh(
        new SphereGeometry(index % 5 === 0 ? 0.06 : 0.035, 10, 10),
        new MeshBasicMaterial({ color: index % 4 === 0 ? 0xff9b5e : 0x8fcfff })
      );
      particle.position.copy(path.getPoint(index / 24));
      particle.userData.offset = index / 24;
      particles.push(particle);
      campus.add(particle);
    }

    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    const pointerHandler = (event: PointerEvent) => {
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", pointerHandler, { passive: true });

    const resize = () => {
      const width = host.clientWidth || 640;
      const height = host.clientHeight || 640;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.set(width < 520 ? 0.3 : 0.25, width < 520 ? 3.55 : 3.15, width < 520 ? 11.3 : 10.4);
      camera.lookAt(0, 0.35, 0);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new Clock();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!reduceMotion) {
        campus.rotation.y = -0.2 + Math.sin(elapsed * 0.22) * 0.035 + pointerX * 0.12;
        campus.rotation.x = -0.08 + Math.sin(elapsed * 0.32) * 0.018 - pointerY * 0.06;
        campus.position.y = -0.12 + Math.sin(elapsed * 0.7) * 0.035;
        particles.forEach((particle) => {
          particle.position.copy(path.getPoint((particle.userData.offset + elapsed * 0.04) % 1));
        });
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", pointerHandler);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
          meshMaterials.forEach((material) => material.dispose());
        }
      });
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed) {
    return <div className="journey-fallback" role="img" aria-label="FPT University campus lost and found journey"><span>FPTU</span><i /><strong>LOST &amp; FOUND</strong></div>;
  }
  return <div ref={hostRef} className="journey-scene" aria-hidden="true" />;
}
