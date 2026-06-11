import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ShipBlueprint } from '../build/ShipBlueprint'
import { MODULE_DEFINITIONS, MODULE_ORDER } from '../modules/ModuleTypes'
import type { GridPosition, ModuleType, PlacedModule } from '../modules/ModuleDefinition'
import { createModuleMesh } from '../modules/ModuleMeshFactory'
import { analyzeStats } from '../physics/StabilityAnalyzer'
import { SEA_STATE_LABELS, SeaState, WaveField } from '../physics/WaveField'
import { RuntimeFrame, ShipRigidBody } from '../physics/ShipRigidBody'
import { generateReport } from '../diagnostics/ReportGenerator'

type AppMode = 'start' | 'build' | 'test' | 'report'

const GRID = {
  width: 3,
  height: 3,
  length: 5,
  block: 1,
}

export class Lab04App {
  private readonly embed = new URLSearchParams(window.location.search).get('embed') === '1'
  private readonly blueprint = new ShipBlueprint()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly mousePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly waveField = new WaveField()
  private readonly clock = new THREE.Clock()

  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private controls!: OrbitControls
  private canvasWrap!: HTMLDivElement
  private startScreen!: HTMLDivElement
  private hud!: HTMLDivElement
  private palette!: HTMLDivElement
  private reportPanel!: HTMLDivElement
  private activation!: HTMLButtonElement
  private launchButton!: HTMLButtonElement
  private rootEl!: HTMLDivElement
  private waterMesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>
  private shipGroup = new THREE.Group()
  private gridGroup = new THREE.Group()
  private helperGroup = new THREE.Group()
  private hoverCube!: THREE.Mesh
  private comMarker!: THREE.Mesh
  private cobMarker!: THREE.Mesh
  private buoyancyArrows: THREE.ArrowHelper[] = []
  private moduleMeshes = new Map<string, THREE.Object3D>()
  private selectedType: ModuleType = 'wood'
  private currentRotation = 0
  private hoveredCell: GridPosition | null = null
  private mode: AppMode = 'start'
  private active = false
  private paused = false
  private shipBody: ShipRigidBody | null = null
  private lastFrame: RuntimeFrame | null = null
  private animationHandle = 0

  constructor(private readonly root: HTMLDivElement) {}

  start(): void {
    this.root.className = `lab-root ${this.embed ? 'is-embed' : ''}`
    this.root.innerHTML = this.renderShell()
    this.rootEl = this.root.querySelector('.lab-root-inner')!
    this.canvasWrap = this.root.querySelector('.canvas-wrap')!
    this.startScreen = this.root.querySelector('.start-screen')!
    this.hud = this.root.querySelector('.hud')!
    this.palette = this.root.querySelector('.module-palette')!
    this.reportPanel = this.root.querySelector('.report-panel')!
    this.activation = this.root.querySelector('.activation-overlay')!
    this.launchButton = this.root.querySelector('[data-action="launch"]')!

    this.setupScene()
    this.bindUi()
    this.seedBlueprint()
    this.updateAllUi()
    this.animate()

    window.parent?.postMessage({ type: 'LAB04_READY' }, '*')
  }

  private renderShell(): string {
    return `
      <div class="lab-root-inner" tabindex="0">
        <div class="intro-logo" aria-hidden="true">
          <img src="./lab.svg" alt="" />
        </div>

        <section class="start-screen" aria-label="LAB 04 开始界面">
          <div class="start-grid" aria-hidden="true">
            ${Array.from({ length: 12 }).map((_, i) => `<span style="--i:${i}"></span>`).join('')}
          </div>
          <p class="experiment-id">实验编号 / 004</p>
          <div class="start-copy">
            <p class="present">DELEE LAB 呈现</p>
            <h1>MODULAR SHIPBUILDING</h1>
            <p class="lab-outline">LAB-04</p>
            <div class="start-rule"></div>
            <div class="directive">
              <span>行动指令</span>
              <strong>用模块搭建船体，下水测试浮力、平衡与稳定性。</strong>
            </div>
            <button class="start-button primary" data-action="enter-lab">
              <span>开始行动</span><b>-></b>
            </button>
            <button class="start-button" data-action="toggle-guide">
              <span>玩法说明</span><b>-></b>
            </button>
          </div>
          <aside class="start-guide" aria-label="玩法说明">
            <div class="panel-heading">
              <p>玩法说明 / HOW TO PLAY</p>
              <h3>建造 -> 下水 -> 诊断 -> 改造</h3>
            </div>
            <ol>
              <li><strong>选择模块</strong><span>从模块栏选择船体、浮力、压载、引擎、货物等模块。</span></li>
              <li><strong>搭建船体</strong><span>左键放置模块，右键或 Delete 删除，R 旋转，C 清空蓝图。</span></li>
              <li><strong>下水测试</strong><span>点击 Launch，观察船体是否漂浮、下沉、侧倾或前后失衡。</span></li>
              <li><strong>生成报告</strong><span>查看浮力、重心、吃水与稳定性问题，再回船坞修改设计。</span></li>
            </ol>
            <div class="guide-actions">
              <button data-action="enter-lab">开始建造</button>
              <button data-action="close-guide">关闭说明</button>
            </div>
          </aside>
        </section>

        <main class="lab-stage" aria-label="LAB 04 模块造船实验">
          <div class="canvas-wrap"></div>

          <header class="topbar">
            <div>
              <p>LAB 04 / 模块造船</p>
              <h2>Modular Shipbuilding</h2>
            </div>
            <div class="topbar-actions">
              <button data-action="back-start" title="返回开始界面">开始界面</button>
              <button data-action="clear" title="清空蓝图">清空</button>
              <button data-action="launch" title="下水测试">Launch</button>
              <button data-action="report" title="生成报告">报告</button>
            </div>
          </header>

          <aside class="module-palette" aria-label="模块栏"></aside>
          <aside class="hud" aria-live="polite"></aside>

          <div class="sea-switch" aria-label="海况选择">
            <button data-sea="calm">平静</button>
            <button data-sea="wave" class="is-active">小浪</button>
            <button data-sea="storm">风暴</button>
          </div>

          <div class="dock-actions">
            <button data-action="back-dock">返回船坞</button>
            <button data-action="reset-test">重置测试</button>
          </div>

          <section class="report-panel" aria-label="诊断报告"></section>

          <button class="activation-overlay">
            <span>Click to activate Modular Shipbuilding</span>
            <small>点击进入 Modular Shipbuilding</small>
          </button>
        </main>
      </div>
    `
  }

  private setupScene(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.canvasWrap.clientWidth, this.canvasWrap.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.canvasWrap.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#05070a')
    this.scene.fog = new THREE.Fog('#05070a', 10, 34)

    this.camera = new THREE.PerspectiveCamera(46, this.aspect(), 0.1, 120)
    this.camera.position.set(5.8, 5.2, 7.5)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0.8, 0)
    this.controls.maxPolarAngle = Math.PI * 0.46
    this.controls.minDistance = 4
    this.controls.maxDistance = 14

    this.scene.add(new THREE.AmbientLight('#9fb6ca', 0.34))
    const key = new THREE.DirectionalLight('#d9f4ff', 2.3)
    key.position.set(6, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight('#4aa7ff', 1.25)
    rim.position.set(-6, 3, -5)
    this.scene.add(rim)

    this.createDock()
    this.createWater()
    this.createHelpers()

    this.scene.add(this.gridGroup, this.shipGroup, this.helperGroup)
    this.waterMesh.visible = false

    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden
    })
  }

  private createDock(): void {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.12, 10.5),
      new THREE.MeshStandardMaterial({
        color: '#071018',
        metalness: 0.24,
        roughness: 0.68,
      }),
    )
    floor.position.y = -0.1
    floor.receiveShadow = true
    this.gridGroup.add(floor)

    const grid = new THREE.GridHelper(10, 20, '#3ba7ff', '#16314a')
    grid.position.y = 0.006
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.46
    this.gridGroup.add(grid)

    const lineMaterial = new THREE.LineBasicMaterial({ color: '#73d7ff', transparent: true, opacity: 0.55 })
    for (let x = -1.5; x <= 1.5; x += 1) {
      const points = [new THREE.Vector3(x, 0.035, -2.5), new THREE.Vector3(x, 0.035, 2.5)]
      this.gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial))
    }
    for (let z = -2.5; z <= 2.5; z += 1) {
      const points = [new THREE.Vector3(-1.5, 0.04, z), new THREE.Vector3(1.5, 0.04, z)]
      this.gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial))
    }

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.05, 5.3),
      new THREE.MeshStandardMaterial({ color: '#0b2538', emissive: '#00284a', emissiveIntensity: 0.18, transparent: true, opacity: 0.42 }),
    )
    pad.position.y = 0.02
    this.gridGroup.add(pad)
  }

  private createWater(): void {
    const geo = new THREE.PlaneGeometry(18, 28, 56, 56)
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#1da7c7',
      emissive: '#003b56',
      emissiveIntensity: 0.12,
      metalness: 0,
      roughness: 0.18,
      transmission: 0.16,
      transparent: true,
      opacity: 0.72,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      side: THREE.DoubleSide,
    })
    this.waterMesh = new THREE.Mesh(geo, mat)
    this.waterMesh.rotation.x = -Math.PI / 2
    this.waterMesh.position.y = 0
    this.waterMesh.receiveShadow = true
    this.scene.add(this.waterMesh)

    const pool = new THREE.Mesh(
      new THREE.BoxGeometry(19, 0.18, 29),
      new THREE.MeshStandardMaterial({ color: '#061018', roughness: 0.7, metalness: 0.4 }),
    )
    pool.position.y = -0.38
    pool.receiveShadow = true
    pool.visible = false
    pool.name = 'pool-base'
    this.scene.add(pool)
  }

  private createHelpers(): void {
    this.hoverCube = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.94, 0.94),
      new THREE.MeshBasicMaterial({ color: '#8ee8ff', transparent: true, opacity: 0.22, depthWrite: false }),
    )
    this.hoverCube.visible = false
    this.scene.add(this.hoverCube)

    this.comMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 18, 18),
      new THREE.MeshBasicMaterial({ color: '#ffdd66' }),
    )
    this.cobMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 18, 18),
      new THREE.MeshBasicMaterial({ color: '#79e8ff' }),
    )
    this.helperGroup.add(this.comMarker, this.cobMarker)
  }

  private bindUi(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const actionEl = target.closest<HTMLElement>('[data-action]')
      if (!actionEl) return
      const action = actionEl.dataset.action
      if (action === 'enter-lab') this.enterBuildMode()
      if (action === 'toggle-guide') this.root.classList.toggle('is-guide-open')
      if (action === 'close-guide') this.root.classList.remove('is-guide-open')
      if (action === 'back-start') this.showStart()
      if (action === 'clear') this.clearBlueprint()
      if (action === 'launch') this.launch()
      if (action === 'report') this.showReport()
      if (action === 'back-dock') this.enterBuildMode()
      if (action === 'reset-test') this.resetTest()
    })

    this.root.addEventListener('click', (event) => {
      const typeButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-module]')
      if (!typeButton) return
      this.selectedType = typeButton.dataset.module as ModuleType
      this.updatePalette()
    })

    this.root.addEventListener('click', (event) => {
      const seaButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-sea]')
      if (!seaButton) return
      this.waveField.seaState = seaButton.dataset.sea as SeaState
      this.root.querySelectorAll('[data-sea]').forEach((button) => button.classList.toggle('is-active', button === seaButton))
    })

    this.activation.addEventListener('click', () => {
      this.active = true
      this.activation.classList.add('is-hidden')
      this.rootEl.focus()
    })

    this.renderer?.domElement.addEventListener('pointermove', this.onPointerMove)
    this.renderer?.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.renderer?.domElement.addEventListener('contextmenu', (event) => event.preventDefault())
    this.rootEl.addEventListener('keydown', this.onKeyDown)

    window.addEventListener('message', (event) => {
      const type = event.data?.type
      if (type === 'LAB04_PAUSE') this.paused = true
      if (type === 'LAB04_RESUME') this.paused = false
      if (type === 'LAB04_RESET') {
        this.clearBlueprint()
        this.showStart()
      }
    })
  }

  private seedBlueprint(): void {
    const seed: Array<[ModuleType, GridPosition]> = [
      ['buoyancy', { x: -1, y: 0, z: -1 }],
      ['wood', { x: 0, y: 0, z: -1 }],
      ['buoyancy', { x: 1, y: 0, z: -1 }],
      ['wood', { x: -1, y: 0, z: 0 }],
      ['ballast', { x: 0, y: 0, z: 0 }],
      ['wood', { x: 1, y: 0, z: 0 }],
      ['wood', { x: 0, y: 1, z: 1 }],
      ['engine', { x: 0, y: 0, z: 2 }],
    ]
    seed.forEach(([type, position]) => {
      const module = this.blueprint.addModule(type, position, 0)
      if (module) this.addModuleToScene(module)
    })
  }

  private enterBuildMode(): void {
    this.mode = 'build'
    this.root.classList.remove('is-guide-open')
    this.shipBody = null
    this.lastFrame = null
    this.startScreen.classList.add('is-hidden')
    this.root.classList.add('is-running')
    this.root.classList.remove('is-testing', 'is-reporting')
    this.gridGroup.visible = true
    this.waterMesh.visible = false
    this.hoverCube.visible = true
    this.reportPanel.classList.remove('is-visible')
    this.shipGroup.position.set(0, 0, 0)
    this.shipGroup.rotation.set(0, 0, 0)
    this.controls.target.set(0, 0.8, 0)
    this.camera.position.set(5.8, 5.2, 7.5)
    this.updateAllUi()
  }

  private showStart(): void {
    this.mode = 'start'
    this.root.classList.remove('is-guide-open')
    this.startScreen.classList.remove('is-hidden')
    this.root.classList.remove('is-running', 'is-testing', 'is-reporting')
  }

  private launch(): void {
    const stats = this.blueprint.getStats()
    if (stats.blocks === 0 || stats.totalBuoyancy <= 0) {
      this.flashLaunch('请先放置至少一个有浮力的模块')
      return
    }

    this.mode = 'test'
    this.root.classList.add('is-testing')
    this.root.classList.remove('is-reporting')
    this.gridGroup.visible = false
    this.waterMesh.visible = true
    this.hoverCube.visible = false
    this.reportPanel.classList.remove('is-visible')
    this.shipBody = new ShipRigidBody(stats, this.blueprint.getModules())
    this.shipBody.reset()
    this.shipGroup.position.copy(this.shipBody.position)
    this.shipGroup.rotation.copy(this.shipBody.rotation)
    this.controls.target.set(0, 0.2, 0)
    this.camera.position.set(6.5, 3.9, 7.8)
    this.updateAllUi()
  }

  private resetTest(): void {
    if (this.mode !== 'test') return
    this.shipBody?.reset()
    this.lastFrame = null
  }

  private showReport(): void {
    this.mode = 'report'
    this.root.classList.add('is-reporting')
    this.reportPanel.classList.add('is-visible')
    const stats = this.blueprint.getStats()
    const report = generateReport(stats, this.lastFrame)
    this.reportPanel.innerHTML = `
      <div class="panel-heading">
        <p>诊断报告 / LAB 04</p>
        <h3>${report.result}</h3>
      </div>
      <div class="report-grid">
        <div><span>总质量</span><strong>${stats.totalMass.toFixed(1)}</strong></div>
        <div><span>总浮力</span><strong>${stats.totalBuoyancy.toFixed(1)}</strong></div>
        <div><span>浮力余量</span><strong>${stats.buoyancyMargin.toFixed(1)}</strong></div>
        <div><span>稳定评分</span><strong>${analyzeStats(stats).score}</strong></div>
      </div>
      <h4>问题分析</h4>
      <ul>${report.issues.map((issue) => `<li>${issue}</li>`).join('')}</ul>
      <h4>改造建议</h4>
      <ul>${report.suggestions.map((suggestion) => `<li>${suggestion}</li>`).join('')}</ul>
      <div class="report-actions">
        <button data-action="back-dock">返回船坞</button>
        <button data-action="reset-test">重新测试</button>
      </div>
    `
  }

  private clearBlueprint(): void {
    this.blueprint.clear()
    this.moduleMeshes.forEach((mesh) => this.shipGroup.remove(mesh))
    this.moduleMeshes.clear()
    this.updateAllUi()
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.mode !== 'build') return
    this.updatePointer(event)
    const cell = this.intersectGridCell()
    this.hoveredCell = cell
    this.hoverCube.visible = Boolean(cell)
    if (cell) this.hoverCube.position.set(cell.x, cell.y + 0.5, cell.z)
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.mode !== 'build') return
    this.active = true
    this.activation.classList.add('is-hidden')
    this.rootEl.focus()
    this.updatePointer(event)
    const cell = this.intersectGridCell()
    if (!cell) return

    if (event.button === 2) {
      this.removeAt(cell)
      return
    }

    const existing = this.blueprint.getAt(cell)
    if (existing) {
      this.removeAt(cell)
      return
    }

    const module = this.blueprint.addModule(this.selectedType, cell, this.currentRotation)
    if (!module) return
    this.addModuleToScene(module)
    this.updateAllUi()
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.active = false
      this.activation.classList.remove('is-hidden')
    }
    if (!this.active) return
    if (event.key.toLowerCase() === 'c') this.clearBlueprint()
    if (event.key.toLowerCase() === 'r') {
      this.currentRotation = (this.currentRotation + Math.PI / 2) % (Math.PI * 2)
      if (this.mode === 'test') this.resetTest()
    }
    if (event.key === 'Delete' && this.hoveredCell) this.removeAt(this.hoveredCell)
  }

  private updatePointer(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private intersectGridCell(): GridPosition | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const point = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.mousePlane, point)) return null

    const x = Math.round(point.x)
    const z = Math.round(point.z)
    if (x < -1 || x > 1 || z < -2 || z > 2) return null

    let y = 0
    for (let candidate = GRID.height - 1; candidate >= 0; candidate -= 1) {
      if (this.blueprint.getAt({ x, y: candidate, z })) {
        y = Math.min(GRID.height - 1, candidate + 1)
        break
      }
    }
    if (y >= GRID.height) return null
    return { x, y, z }
  }

  private addModuleToScene(module: PlacedModule): void {
    const mesh = createModuleMesh(module)
    mesh.position.set(module.gridPosition.x, module.gridPosition.y + 0.5, module.gridPosition.z)
    this.shipGroup.add(mesh)
    this.moduleMeshes.set(module.id, mesh)
  }

  private removeAt(position: GridPosition): void {
    const removed = this.blueprint.removeModule(position)
    if (!removed) return
    const mesh = this.moduleMeshes.get(removed.id)
    if (mesh) this.shipGroup.remove(mesh)
    this.moduleMeshes.delete(removed.id)
    this.updateAllUi()
  }

  private updateAllUi(): void {
    this.updatePalette()
    this.updateHud()
    this.updateMarkers()
  }

  private updatePalette(): void {
    this.palette.innerHTML = MODULE_ORDER.map((type) => {
      const def = MODULE_DEFINITIONS[type]
      const active = type === this.selectedType ? 'is-active' : ''
      return `
        <button class="module-card ${active}" data-module="${type}" title="${def.description}">
          <span class="swatch" style="background:${def.color}"></span>
          <strong>${def.name}</strong>
          <small>${def.description}</small>
          <em>Mass ${def.mass.toFixed(1)} / Buoyancy ${def.buoyancy.toFixed(1)}</em>
          <i>${def.tags.join(' · ')}</i>
        </button>
      `
    }).join('')
  }

  private updateHud(): void {
    const stats = this.blueprint.getStats()
    const summary = analyzeStats(stats)
    const frame = this.lastFrame
    this.hud.innerHTML = `
      <div class="panel-heading">
        <p>${this.mode === 'test' ? `测试海况 / ${SEA_STATE_LABELS[this.waveField.seaState]}` : '建造统计 / Blueprint'}</p>
        <h3>${this.mode === 'test' ? frame?.status ?? '下水中' : summary.status}</h3>
      </div>
      <dl>
        <div><dt>Blocks</dt><dd>${stats.blocks}</dd></div>
        <div><dt>Total Mass</dt><dd>${stats.totalMass.toFixed(1)}</dd></div>
        <div><dt>Total Buoyancy</dt><dd>${stats.totalBuoyancy.toFixed(1)}</dd></div>
        <div><dt>Buoyancy Margin</dt><dd>${stats.buoyancyMargin.toFixed(1)}</dd></div>
        <div><dt>Draft</dt><dd>${stats.estimatedDraft.toFixed(2)}</dd></div>
        <div><dt>Roll Angle</dt><dd>${(frame?.roll ?? 0).toFixed(1)}°</dd></div>
        <div><dt>Pitch Angle</dt><dd>${(frame?.pitch ?? 0).toFixed(1)}°</dd></div>
        <div><dt>Max Roll</dt><dd>${(frame?.maxRoll ?? 0).toFixed(1)}°</dd></div>
        <div><dt>Max Pitch</dt><dd>${(frame?.maxPitch ?? 0).toFixed(1)}°</dd></div>
        <div><dt>Top Weight Ratio</dt><dd>${(stats.topWeightRatio * 100).toFixed(0)}%</dd></div>
        <div><dt>Stability Score</dt><dd>${summary.score}</dd></div>
      </dl>
      <div class="warnings">
        ${summary.warnings.slice(0, 3).map((warning) => `<span>${warning}</span>`).join('') || '<span>当前设计可以进入下水测试。</span>'}
      </div>
    `
  }

  private updateMarkers(): void {
    const stats = this.blueprint.getStats()
    this.comMarker.visible = stats.blocks > 0
    this.cobMarker.visible = stats.blocks > 0
    this.comMarker.position.set(stats.centerOfMass.x, stats.centerOfMass.y + 0.5, stats.centerOfMass.z)
    this.cobMarker.position.set(stats.estimatedCenterOfBuoyancy.x, stats.estimatedCenterOfBuoyancy.y + 0.2, stats.estimatedCenterOfBuoyancy.z)
  }

  private updateWaterGeometry(): void {
    const position = this.waterMesh.geometry.attributes.position
    const vertex = new THREE.Vector3()
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i)
      position.setZ(i, this.waveField.heightAt(vertex.x, -vertex.y))
    }
    position.needsUpdate = true
    this.waterMesh.geometry.computeVertexNormals()
  }

  private updateBuoyancyHelpers(): void {
    this.buoyancyArrows.forEach((arrow) => this.helperGroup.remove(arrow))
    this.buoyancyArrows = []
    if (!this.shipBody || this.mode !== 'test') return

    this.shipBody.getSamplePoints().slice(0, 24).forEach((point, index) => {
      if (index % 2 !== 0) return
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), point, 0.58, '#79e8ff', 0.18, 0.1)
      this.helperGroup.add(arrow)
      this.buoyancyArrows.push(arrow)
    })
  }

  private animate = (): void => {
    this.animationHandle = window.requestAnimationFrame(this.animate)
    const delta = Math.min(this.clock.getDelta(), 0.05)
    if (this.paused) return

    this.waveField.update(delta)
    if (this.waterMesh.visible) this.updateWaterGeometry()

    if (this.mode === 'test' && this.shipBody) {
      this.lastFrame = this.shipBody.update(delta, this.waveField)
      this.shipGroup.position.copy(this.shipBody.position)
      this.shipGroup.rotation.copy(this.shipBody.rotation)
      this.controls.target.lerp(new THREE.Vector3(this.shipGroup.position.x, 0.2, this.shipGroup.position.z), 0.045)
      this.updateMarkers()
      this.updateBuoyancyHelpers()
      if (Math.floor(this.waveField.time * 6) % 3 === 0) this.updateHud()
    }

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private flashLaunch(message: string): void {
    this.launchButton.textContent = message
    window.setTimeout(() => {
      this.launchButton.textContent = 'Launch'
    }, 1400)
  }

  private aspect(): number {
    return Math.max(1, this.canvasWrap.clientWidth) / Math.max(1, this.canvasWrap.clientHeight)
  }

  private onResize = (): void => {
    this.camera.aspect = this.aspect()
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.canvasWrap.clientWidth, this.canvasWrap.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }
}
