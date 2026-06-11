import * as THREE from 'three'
import type { ModuleDefinition, PlacedModule } from './ModuleDefinition'
import { MODULE_DEFINITIONS } from './ModuleTypes'

const sharedBox = new THREE.BoxGeometry(0.92, 0.92, 0.92)
const rudderGeo = new THREE.BoxGeometry(0.24, 0.8, 0.9)
const cannonBarrelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.92, 16)

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
    const fin = new THREE.Mesh(rudderGeo, materialFor(def))
    fin.position.set(0, -0.08, 0.5)
    fin.castShadow = true
    group.add(fin)
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
