import * as THREE from 'three'
import type { ModuleDefinition, PlacedModule } from './ModuleDefinition'
import { MODULE_DEFINITIONS } from './ModuleTypes'

const sharedBox = new THREE.BoxGeometry(0.92, 0.92, 0.92)
const rudderShaftGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.96, 18)
const rudderTillerGeo = new THREE.BoxGeometry(0.54, 0.07, 0.12)
const rudderPinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.34, 14)
const cannonBarrelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.92, 16)
const rudderBladeGeo = createRudderBladeGeometry()

const materialCache = new Map<string, THREE.MeshStandardMaterial>()

function materialFor(def: ModuleDefinition): THREE.MeshStandardMaterial {
  const key = `${def.type}-${def.color}-${def.emissive ?? ''}`
  const cached = materialCache.get(key)
  if (cached) return cached

  const material = new THREE.MeshStandardMaterial({
    color: def.color,
    emissive: def.emissive ?? '#000000',
    emissiveIntensity: def.emissive ? 0.35 : 0,
    metalness: def.type === 'metal' || def.type === 'engine' || def.type === 'cannon' ? 0.62 : 0.08,
    roughness: def.type === 'wood' || def.type === 'cargo' ? 0.82 : 0.48,
  })
  materialCache.set(key, material)
  return material
}

function createRudderBladeGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-0.22, 0.38)
  shape.lineTo(0.2, 0.3)
  shape.lineTo(0.28, -0.28)
  shape.quadraticCurveTo(0.04, -0.48, -0.18, -0.36)
  shape.lineTo(-0.26, 0.2)
  shape.quadraticCurveTo(-0.26, 0.34, -0.22, 0.38)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelSize: 0.015,
    bevelThickness: 0.012,
    bevelSegments: 2,
  })
  geometry.translate(0, 0, -0.05)
  return geometry
}

export function createModuleMesh(module: PlacedModule): THREE.Group {
  const def = MODULE_DEFINITIONS[module.type]
  const group = new THREE.Group()
  group.name = `module-${module.id}`
  group.userData.moduleId = module.id

  const core = new THREE.Mesh(sharedBox, materialFor(def))
  core.castShadow = true
  core.receiveShadow = true
  group.add(core)

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(sharedBox),
    new THREE.LineBasicMaterial({ color: module.type === 'buoyancy' ? '#c7f5ff' : '#d8e6ff', transparent: true, opacity: 0.26 }),
  )
  group.add(edge)

  if (module.type === 'engine') {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.18, 0.08),
      new THREE.MeshBasicMaterial({ color: '#58baff' }),
    )
    glow.position.set(0, 0, 0.48)
    group.add(glow)
  }

  if (module.type === 'rudder') {
    const rudderPivot = new THREE.Group()
    rudderPivot.name = 'rudder-pivot'
    rudderPivot.userData.rudderPivot = true
    rudderPivot.position.set(0, -0.03, 0.5)

    const shaft = new THREE.Mesh(rudderShaftGeo, materialFor(def))
    shaft.castShadow = true
    shaft.receiveShadow = true
    rudderPivot.add(shaft)

    const blade = new THREE.Mesh(rudderBladeGeo, materialFor(def))
    blade.position.set(0, -0.08, 0.12)
    blade.castShadow = true
    blade.receiveShadow = true
    rudderPivot.add(blade)

    const tiller = new THREE.Mesh(rudderTillerGeo, materialFor(def))
    tiller.position.set(0, 0.43, -0.08)
    tiller.castShadow = true
    rudderPivot.add(tiller)

    const lowerPin = new THREE.Mesh(rudderPinGeo, materialFor(def))
    lowerPin.rotation.z = Math.PI / 2
    lowerPin.position.set(0, -0.28, -0.04)
    lowerPin.castShadow = true
    rudderPivot.add(lowerPin)

    group.add(rudderPivot)
  }

  if (module.type === 'cannon') {
    const barrel = new THREE.Mesh(cannonBarrelGeo, materialFor(def))
    barrel.rotation.z = Math.PI / 2
    barrel.position.y = 0.32
    barrel.castShadow = true
    group.add(barrel)
  }

  if (module.type === 'cargo') {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.08, 0.14),
      new THREE.MeshStandardMaterial({ color: '#2b1c12', roughness: 0.9 }),
    )
    strap.position.y = 0.3
    group.add(strap)
  }

  group.rotation.y = module.rotation
  return group
}
