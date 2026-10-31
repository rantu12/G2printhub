"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

export type PrintArea = {
  id?: string;
  name?: string;
  surface?: string;
  shape?: "round" | "circle" | "rectangle";
  diameterCm?: number;
  widthCm?: number;
  heightCm?: number;
  x?: number;
  y?: number;
  rotation?: number;
  anchor?: {
    point: [number, number, number];
    normal: [number, number, number];
    meshName?: string;
  };
};

type DesignSettings = {
  imageUrl?: string;
  scale?: number;
  rotation?: number;
  x?: number;
  y?: number;
};

type ViewerProps = {
  modelUrl: string;
  height?: number;
  printArea?: PrintArea | null;
  designSettings?: DesignSettings | null;
  autoRotate?: boolean;
  onSurfacePick?: (anchor: NonNullable<PrintArea["anchor"]>) => void;
};

type SurfaceAnchor = {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  mesh: THREE.Mesh;
};

function SurfaceOverlay({
  anchor,
  printArea,
  designSettings,
}: {
  anchor: SurfaceAnchor;
  printArea: PrintArea;
  designSettings?: DesignSettings | null;
}) {
  const imageUrl = designSettings?.imageUrl;
  const texture = useMemo(() => {
    if (!imageUrl) return null;
    const loaded = new THREE.TextureLoader().load(imageUrl);
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.wrapS = THREE.ClampToEdgeWrapping;
    loaded.wrapT = THREE.ClampToEdgeWrapping;
    return loaded;
  }, [imageUrl]);

  const isRound = printArea.shape === "round" || printArea.shape === "circle";
  const alphaMap = useMemo(() => {
    if (!isRound) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create the round print-area mask.");
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(128, 128, 127, 0, Math.PI * 2);
    context.fill();
    return new THREE.CanvasTexture(canvas);
  }, [isRound]);

  const material = useMemo(() => new THREE.MeshBasicMaterial({
    ...(texture ? { map: texture } : {}),
    ...(alphaMap ? { alphaMap } : {}),
    color: texture ? "#ffffff" : "#ef4444",
    transparent: true,
    opacity: texture ? 1 : 0.5,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  }), [texture, alphaMap]);

  const geometry = useMemo(() => {
    const widthCm = printArea.widthCm ?? printArea.diameterCm ?? 11;
    const heightCm = printArea.heightCm ?? printArea.diameterCm ?? 6.5;
    const scale = designSettings?.scale ?? 1;
    const artRotation = designSettings?.rotation ?? 0;
    const offsetX = designSettings?.x ?? 0;
    const offsetY = designSettings?.y ?? 0;

    let width = THREE.MathUtils.clamp((widthCm / 10) * 0.75, 0.03, 1.5);
    let height = THREE.MathUtils.clamp((heightCm / 10) * 0.75, 0.03, 1.5);
    if (isRound) width = height = Math.min(width, height);

    width *= THREE.MathUtils.clamp(scale, 0.1, 4);
    height *= THREE.MathUtils.clamp(scale, 0.1, 4);

    const normal = anchor.normal.clone().normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad((printArea.rotation ?? 0) + artRotation)));
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
    const position = anchor.point.clone()
      .addScaledVector(right, THREE.MathUtils.clamp(printArea.x ?? 0, -0.5, 0.5) * 0.25 + offsetX / 100)
      .addScaledVector(up, THREE.MathUtils.clamp(printArea.y ?? 0, -0.6, 0.6) * 0.25 + offsetY / 100);
    const depth = Math.min(0.15, Math.max(0.04, Math.min(width, height) * 0.2));
    position.addScaledVector(normal, depth * 0.35);
    anchor.mesh.updateMatrixWorld(true);
    return new DecalGeometry(
      anchor.mesh,
      position,
      new THREE.Euler().setFromQuaternion(rotation),
      new THREE.Vector3(width, height, depth),
    );
  }, [
    anchor,
    designSettings?.rotation,
    designSettings?.scale,
    designSettings?.x,
    designSettings?.y,
    isRound,
    printArea.diameterCm,
    printArea.heightCm,
    printArea.rotation,
    printArea.widthCm,
    printArea.x,
    printArea.y,
  ]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => alphaMap?.dispose(), [alphaMap]);
  useEffect(() => () => texture?.dispose(), [texture]);

  return <mesh geometry={geometry} material={material} renderOrder={5} />;
}

function Product({
  modelUrl,
  printArea,
  designSettings,
  onSurfacePick,
}: Omit<ViewerProps, "height" | "autoRotate">) {
  const { scene } = useGLTF(modelUrl);
  const [picked, setPicked] = useState<SurfaceAnchor | null>(null);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    let meshIndex = 0;
    clone.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        meshIndex += 1;
        object.name = `printmesh-${meshIndex}`;
      }
    });
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2.5 / (Math.max(size.x, size.y, size.z) || 1);
    clone.scale.multiplyScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.updateMatrixWorld(true);
    return clone;
  }, [scene]);

  function pickSurface(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!event.face || !(event.object as THREE.Mesh).isMesh) return;
    const mesh = event.object as THREE.Mesh;
    const normal = event.face.normal.clone()
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
    setPicked({ point: event.point.clone(), normal, mesh });
    onSurfacePick?.({
      point: [event.point.x, event.point.y, event.point.z],
      normal: [normal.x, normal.y, normal.z],
      meshName: mesh.name || undefined,
    });
  }

  const anchor = useMemo<SurfaceAnchor | null>(() => {
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.1, 3), new THREE.Vector3(0, 0, -1));
    model.updateMatrixWorld(true);
    if (printArea?.anchor) {
      const mesh = printArea.anchor.meshName
        ? model.getObjectByName(printArea.anchor.meshName)
        : null;
      if (mesh && (mesh as THREE.Mesh).isMesh) {
        return {
          point: new THREE.Vector3(...printArea.anchor.point),
          normal: new THREE.Vector3(...printArea.anchor.normal).normalize(),
          mesh: mesh as THREE.Mesh,
        };
      }
    }
    if (picked?.mesh) return picked;
    const hit = raycaster.intersectObject(model, true).find((item) => item.face && (item.object as THREE.Mesh).isMesh);
    if (!hit?.face) return null;
    const mesh = hit.object as THREE.Mesh;
    const normal = hit.face.normal.clone()
      .applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
    return { point: hit.point.clone(), normal, mesh };
  }, [picked, model, printArea]);

  const area = printArea ?? { shape: "rectangle" as const, widthCm: 11, heightCm: 6.5, x: 0, y: 0, rotation: 0 };

  return (
    <>
      <primitive object={model} onPointerDown={pickSurface} />
      {anchor && printArea && <SurfaceOverlay anchor={anchor} printArea={area} designSettings={designSettings} />}
    </>
  );
}

export default function CustomPrint3DViewer({
  modelUrl,
  height = 480,
  printArea,
  designSettings,
  autoRotate = false,
  onSurfacePick,
}: ViewerProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg bg-slate-200" style={{ height }}>
      <Canvas camera={{ position: [0, 0.15, 5], fov: 40 }} gl={{ antialias: true }}>
        <color attach="background" args={["#e2e8f0"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[4, 6, 5]} intensity={2} />
        <directionalLight position={[-4, 2, -3]} intensity={0.8} />
        <Suspense fallback={null}>
          <Product modelUrl={modelUrl} printArea={printArea} designSettings={designSettings} onSurfacePick={onSurfacePick} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={2} minDistance={2} maxDistance={8} target={[0, 0, 0]} />
      </Canvas>
    </div>
  );
}
