import type { GridPosition, ModuleType, PlacedModule } from '../modules/ModuleDefinition'
import { MODULE_DEFINITIONS } from '../modules/ModuleTypes'

export type BlueprintStats = {
  blocks: number
  totalMass: number
  totalBuoyancy: number
  buoyancyMargin: number
  centerOfMass: GridPosition
  estimatedCenterOfBuoyancy: GridPosition
  estimatedDraft: number
  rollStability: number
  pitchStability: number
  topWeightRatio: number
  enginePower: number
  rudderPower: number
  leftRightMassImbalance: number
  frontBackMassImbalance: number
}

const emptyPoint: GridPosition = { x: 0, y: 0, z: 0 }

export class ShipBlueprint {
  private modules = new Map<string, PlacedModule>()

  addModule(type: ModuleType, gridPosition: GridPosition, rotation: number): PlacedModule | null {
    const key = this.key(gridPosition)
    if (this.modules.has(key)) return null

    const module: PlacedModule = {
      id: crypto.randomUUID(),
      type,
      gridPosition: { ...gridPosition },
      rotation,
    }

    this.modules.set(key, module)
    return module
  }

  removeModule(gridPosition: GridPosition): PlacedModule | null {
    const key = this.key(gridPosition)
    const existing = this.modules.get(key) ?? null
    this.modules.delete(key)
    return existing
  }

  clear(): void {
    this.modules.clear()
  }

  getAt(gridPosition: GridPosition): PlacedModule | null {
    return this.modules.get(this.key(gridPosition)) ?? null
  }

  getModules(): PlacedModule[] {
    return [...this.modules.values()]
  }

  serialize(): string {
    return JSON.stringify(this.getModules())
  }

  deserialize(raw: string): void {
    const parsed = JSON.parse(raw) as PlacedModule[]
    this.clear()
    parsed.forEach((module) => this.modules.set(this.key(module.gridPosition), module))
  }

  getStats(): BlueprintStats {
    const modules = this.getModules()
    if (modules.length === 0) {
      return {
        blocks: 0,
        totalMass: 0,
        totalBuoyancy: 0,
        buoyancyMargin: 0,
        centerOfMass: emptyPoint,
        estimatedCenterOfBuoyancy: emptyPoint,
        estimatedDraft: 0,
        rollStability: 0,
        pitchStability: 0,
        topWeightRatio: 0,
        enginePower: 0,
        rudderPower: 0,
        leftRightMassImbalance: 0,
        frontBackMassImbalance: 0,
      }
    }

    let totalMass = 0
    let totalBuoyancy = 0
    let massX = 0
    let massY = 0
    let massZ = 0
    let buoyX = 0
    let buoyY = 0
    let buoyZ = 0
    let leftMass = 0
    let rightMass = 0
    let bowMass = 0
    let sternMass = 0
    let topMass = 0
    let enginePower = 0
    let rudderPower = 0

    for (const module of modules) {
      const def = MODULE_DEFINITIONS[module.type]
      const { x, y, z } = module.gridPosition
      totalMass += def.mass
      totalBuoyancy += def.buoyancy
      massX += x * def.mass
      massY += y * def.mass
      massZ += z * def.mass
      buoyX += x * def.buoyancy
      buoyY += y * def.buoyancy
      buoyZ += z * def.buoyancy
      if (x < 0) leftMass += def.mass
      if (x > 0) rightMass += def.mass
      if (z < 0) bowMass += def.mass
      if (z > 0) sternMass += def.mass
      if (y >= 2 || (y >= 1 && def.mass >= 2.5)) topMass += def.mass
      enginePower += def.thrust ?? 0
      rudderPower += def.turnPower ?? 0
    }

    const widthSpan = Math.max(1, new Set(modules.map((m) => m.gridPosition.x)).size)
    const lengthSpan = Math.max(1, new Set(modules.map((m) => m.gridPosition.z)).size)
    const centerOfMass = {
      x: massX / totalMass,
      y: massY / totalMass,
      z: massZ / totalMass,
    }
    const estimatedCenterOfBuoyancy = totalBuoyancy > 0
      ? { x: buoyX / totalBuoyancy, y: buoyY / totalBuoyancy, z: buoyZ / totalBuoyancy }
      : emptyPoint
    const topWeightRatio = topMass / totalMass
    const buoyancyMargin = totalBuoyancy - totalMass
    const imbalanceBase = Math.max(totalMass, 0.001)
    const leftRightMassImbalance = (rightMass - leftMass) / imbalanceBase
    const frontBackMassImbalance = (sternMass - bowMass) / imbalanceBase

    return {
      blocks: modules.length,
      totalMass,
      totalBuoyancy,
      buoyancyMargin,
      centerOfMass,
      estimatedCenterOfBuoyancy,
      estimatedDraft: Math.max(0, Math.min(1.8, totalMass / Math.max(totalBuoyancy, 0.1))),
      rollStability: Math.max(0, Math.min(100, 78 + widthSpan * 8 - topWeightRatio * 95 - Math.abs(leftRightMassImbalance) * 50)),
      pitchStability: Math.max(0, Math.min(100, 72 + lengthSpan * 4 - Math.abs(frontBackMassImbalance) * 56 - topWeightRatio * 24)),
      topWeightRatio,
      enginePower,
      rudderPower,
      leftRightMassImbalance,
      frontBackMassImbalance,
    }
  }

  private key(position: GridPosition): string {
    return `${position.x}:${position.y}:${position.z}`
  }
}
