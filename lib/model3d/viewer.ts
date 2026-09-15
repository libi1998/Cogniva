import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import type { Shape3D, View3D } from "./catalog"

/**
 * Il visualizzatore dei modelli 3D nel documento: luce da studio, camera che
 * inquadra il modello, rotazione col trascinamento e zoom con la rotellina
 * (solo quando il modello è selezionato, per non rubare lo scorrimento).
 */

export type ModelSpec =
  | { kind: "shape"; shape: Shape3D; color: string }
  | { kind: "file"; src: string }

export type Viewer = {
  setSpec: (spec: ModelSpec) => void
  setView: (view: View3D, animate?: boolean) => void
  setAutoRotate: (on: boolean) => void
  setBackground: (color: string) => void
  setZoomable: (on: boolean) => void
  resize: (width: number, height: number) => void
  /** un'immagine PNG della vista attuale, per stampa ed esportazioni */
  snapshot: (maxWidth?: number) => string
  dispose: () => void
}

const FOV = 35

function shapeGeometry(shape: Shape3D): THREE.BufferGeometry {
  switch (shape) {
    case "cube":
      return new RoundedBoxGeometry(1.4, 1.4, 1.4, 6, 0.12)
    case "sphere":
      return new THREE.SphereGeometry(0.95, 64, 48)
    case "cylinder":
      return new THREE.CylinderGeometry(0.75, 0.75, 1.6, 64)
    case "cone":
      return new THREE.ConeGeometry(0.85, 1.7, 64)
    case "pyramid":
      return new THREE.ConeGeometry(1.05, 1.5, 4)
    case "torus":
      return new THREE.TorusGeometry(0.75, 0.3, 48, 96)
    case "knot":
      return new THREE.TorusKnotGeometry(0.62, 0.2, 200, 32)
    case "capsule":
      return new THREE.CapsuleGeometry(0.5, 0.9, 12, 48)
    case "gem":
      return new THREE.IcosahedronGeometry(0.95, 0)
    case "dodecahedron":
      return new THREE.DodecahedronGeometry(0.95, 0)
    case "octahedron":
      return new THREE.OctahedronGeometry(1, 0)
    case "ring":
      return new THREE.TorusGeometry(0.8, 0.12, 32, 128)
  }
}

export function createViewer(
  canvas: HTMLCanvasElement,
  {
    spec,
    view,
    autoRotate,
    background,
    onViewChange,
    onReady,
    onError,
  }: {
    spec: ModelSpec
    view: View3D
    autoRotate: boolean
    background: string
    onViewChange: (view: View3D) => void
    onReady: () => void
    onError: (message: string) => void
  }
): Viewer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment

  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(3, 5, 4)
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25))

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1000)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.enablePan = false
  controls.enableZoom = false
  controls.autoRotateSpeed = 1.6

  const root = new THREE.Group()
  scene.add(root)
  let radius = 1
  let frame = 0
  let disposed = false
  let loadToken = 0
  let animation: { from: View3D; to: View3D; start: number } | null = null
  let interacting = false

  const fitDistance = () =>
    (radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.08

  const applyView = (v: View3D) => {
    const yaw = THREE.MathUtils.degToRad(v.yaw)
    const pitch = THREE.MathUtils.degToRad(Math.max(-89, Math.min(89, v.pitch)))
    const distance = fitDistance() / Math.max(0.3, Math.min(4, v.zoom))
    camera.position.set(
      distance * Math.cos(pitch) * Math.sin(yaw),
      distance * Math.sin(pitch),
      distance * Math.cos(pitch) * Math.cos(yaw)
    )
    camera.near = distance / 100
    camera.far = distance * 100
    camera.updateProjectionMatrix()
    controls.target.set(0, 0, 0)
    camera.lookAt(0, 0, 0)
  }

  const currentView = (): View3D => {
    const offset = camera.position.clone().sub(controls.target)
    const distance = offset.length() || 1
    return {
      yaw: Math.round(THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z))),
      pitch: Math.round(
        THREE.MathUtils.radToDeg(Math.asin(offset.y / distance))
      ),
      zoom: Math.round((fitDistance() / distance) * 100) / 100,
    }
  }

  const clear = () => {
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : []
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose()
        }
        material.dispose()
      }
    })
    root.clear()
  }

  /** centra il modello e ne misura la grandezza per inquadrarlo */
  const frameObject = (object: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(object)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    object.position.sub(sphere.center)
    radius = sphere.radius || 1
    root.add(object)
    controls.minDistance = radius * 0.4
    controls.maxDistance = radius * 12
  }

  const setSpec = (next: ModelSpec) => {
    const token = ++loadToken
    clear()
    if (next.kind === "shape") {
      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(next.color || "#4f7cff"),
        roughness: 0.32,
        metalness: 0.05,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        flatShading:
          next.shape === "gem" ||
          next.shape === "dodecahedron" ||
          next.shape === "octahedron" ||
          next.shape === "pyramid",
      })
      frameObject(new THREE.Mesh(shapeGeometry(next.shape), material))
      applyView(view)
      onReady()
      return
    }
    new GLTFLoader().loadAsync(next.src).then(
      (gltf) => {
        if (disposed || token !== loadToken) return
        frameObject(gltf.scene)
        applyView(view)
        onReady()
      },
      () => {
        if (disposed || token !== loadToken) return
        onError("Modello non leggibile: serve un glTF autonomo (.glb).")
      }
    )
  }

  const render = (time: number) => {
    if (disposed) return
    if (animation) {
      const t = Math.min(1, (time - animation.start) / 450)
      const ease = 1 - Math.pow(1 - t, 3)
      // l'angolo più breve: da 170° a -170° si passa per 180°
      const dyaw =
        ((((animation.to.yaw - animation.from.yaw) % 360) + 540) % 360) - 180
      applyView({
        yaw: animation.from.yaw + dyaw * ease,
        pitch:
          animation.from.pitch +
          (animation.to.pitch - animation.from.pitch) * ease,
        zoom:
          animation.from.zoom +
          (animation.to.zoom - animation.from.zoom) * ease,
      })
      if (t >= 1) animation = null
    } else {
      controls.update()
    }
    renderer.render(scene, camera)
    frame = requestAnimationFrame(render)
  }

  controls.addEventListener("start", () => {
    interacting = true
    animation = null
  })
  controls.addEventListener("end", () => {
    interacting = false
    view = currentView()
    onViewChange(view)
  })

  controls.autoRotate = autoRotate
  renderer.setClearColor(background || 0x000000, background ? 1 : 0)
  setSpec(spec)
  frame = requestAnimationFrame(render)

  return {
    setSpec,
    setView(next, animate = true) {
      if (interacting) return
      const from = currentView()
      view = next
      if (animate) animation = { from, to: next, start: performance.now() }
      else applyView(next)
    },
    setAutoRotate(on) {
      controls.autoRotate = on
    },
    setBackground(color) {
      renderer.setClearColor(color || 0x000000, color ? 1 : 0)
    },
    setZoomable(on) {
      controls.enableZoom = on
    },
    resize(width, height) {
      if (width < 1 || height < 1) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    snapshot(maxWidth = 900) {
      renderer.render(scene, camera)
      const source = renderer.domElement
      const scale = Math.min(1, maxWidth / source.width)
      if (scale >= 1) return source.toDataURL("image/png")
      const out = document.createElement("canvas")
      out.width = Math.round(source.width * scale)
      out.height = Math.round(source.height * scale)
      out.getContext("2d")?.drawImage(source, 0, 0, out.width, out.height)
      return out.toDataURL("image/png")
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      controls.dispose()
      clear()
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
