import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  CatmullRomCurve3,
  Clock,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer
} from "three";

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
    const camera = new PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.2, 11);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x07172f, 0);
    host.appendChild(renderer.domElement);

    scene.add(new HemisphereLight(0xdceeff, 0x172b44, 2.4));
    const keyLight = new PointLight(0xff8a42, 20, 24);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const journey = new Group();
    scene.add(journey);

    const orange = new MeshStandardMaterial({ color: 0xf36f21, roughness: 0.32, metalness: 0.16 });
    const blue = new MeshStandardMaterial({ color: 0x1687db, roughness: 0.3, metalness: 0.14 });
    const green = new MeshStandardMaterial({ color: 0x55a944, roughness: 0.4, metalness: 0.08 });
    const paper = new MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.58, metalness: 0 });

    const ring = new Mesh(new TorusGeometry(1.35, 0.11, 20, 90), orange);
    ring.rotation.x = Math.PI / 2.5;
    journey.add(ring);

    const tag = new Mesh(new BoxGeometry(1.55, 2.05, 0.2), paper);
    tag.position.set(0, -1.25, 0);
    tag.rotation.z = -0.08;
    journey.add(tag);

    const tagStripe = new Mesh(new BoxGeometry(1.25, 0.18, 0.23), blue);
    tagStripe.position.set(0, -0.9, 0.05);
    journey.add(tagStripe);

    const statusDot = new Mesh(new SphereGeometry(0.17, 24, 24), green);
    statusDot.position.set(0.48, -1.72, 0.2);
    journey.add(statusDot);

    const lostCard = new Mesh(new BoxGeometry(2.5, 1.45, 0.1), blue);
    lostCard.position.set(-4.4, 0.45, -1.4);
    lostCard.rotation.y = 0.28;
    scene.add(lostCard);

    const foundCard = new Mesh(new BoxGeometry(2.5, 1.45, 0.1), orange);
    foundCard.position.set(4.4, -0.35, -1.2);
    foundCard.rotation.y = -0.28;
    scene.add(foundCard);

    const path = new CatmullRomCurve3([
      new Vector3(-5.3, 2.5, -2.5),
      new Vector3(-2.8, -1.9, -1.4),
      new Vector3(0, 1.65, -1),
      new Vector3(2.7, -1.5, -1.5),
      new Vector3(5.4, 1.4, -2.4)
    ]);
    scene.add(new Mesh(
      new TubeGeometry(path, 120, 0.025, 8, false),
      new MeshBasicMaterial({ color: 0x8fcfff, transparent: true, opacity: 0.42 })
    ));

    const particles: Mesh[] = [];
    for (let index = 0; index < 18; index += 1) {
      const particle = new Mesh(
        new SphereGeometry(index % 4 === 0 ? 0.055 : 0.032, 10, 10),
        new MeshBasicMaterial({ color: index % 3 === 0 ? 0xff9b5e : 0x9bd5ff })
      );
      particle.position.copy(path.getPoint(index / 18));
      particle.userData.offset = index / 18;
      particles.push(particle);
      scene.add(particle);
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
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new Clock();
    const render = () => {
      const elapsed = clock.getElapsedTime();
      if (!reduceMotion) {
        journey.rotation.y = elapsed * 0.18 + pointerX * 0.22;
        journey.rotation.x = Math.sin(elapsed * 0.45) * 0.07 - pointerY * 0.1;
        journey.position.y = Math.sin(elapsed * 0.8) * 0.14;
        lostCard.position.y = 0.45 + Math.sin(elapsed * 0.65) * 0.12;
        foundCard.position.y = -0.35 + Math.sin(elapsed * 0.65 + 1.8) * 0.12;
        particles.forEach((particle) => particle.position.copy(path.getPoint((particle.userData.offset + elapsed * 0.045) % 1)));
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
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed) {
    return <div className="journey-fallback" role="img" aria-label="Hành trình một món đồ được tìm thấy và trả lại"><span>LOST</span><i /><strong>RETURNED</strong></div>;
  }
  return <div ref={hostRef} className="journey-scene" aria-hidden="true" />;
}
