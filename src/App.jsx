import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { setupInput, isTouchDevice } from './game/input'
import { useGame } from './game/store'
import { TouchControls } from './components/TouchControls'
import { GameLoop, CameraRig, Bullets, EnemyShots, Particles, Rings, Reticle } from './components/Systems'
import { Pickups, Tentacles, Shield } from './components/Powerups'
import { Floor, BloodCells, TissueWall } from './components/Environment'
import { Player } from './components/Player'
import { Enemies } from './components/Enemies'
import { Hud } from './components/Hud'

const MOBILE = isTouchDevice()

export default function App() {
  useEffect(() => setupInput(), [])
  const glow = useGame((s) => s.glow)
  return (
    <>
      {/* Remount on toggle: antialias is a context-creation flag. With glow on, the composer does
          its own MSAA; with glow off we skip post-processing entirely and use native AA. */}
      <Canvas
        key={glow ? 'glow' : 'plain'}
        flat
        dpr={MOBILE ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !glow, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: [0, 23, 12], fov: 50, near: 0.1, far: 250 }}
      >
        <color attach="background" args={['#2a0715']} />
        <GameLoop />
        <CameraRig />
        <Floor />
        <BloodCells />
        <TissueWall />
        <Sparkles count={140} scale={[70, 8, 70]} position={[0, -3, 0]} size={5} speed={0.3} color="#ffb3c8" opacity={0.5} />
        <Player />
        <Enemies />
        <Pickups />
        <Tentacles />
        <Shield />
        <Bullets />
        <EnemyShots />
        <Particles />
        <Rings />
        <Reticle />
        {glow && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={1.1} radius={0.75} />
            <Vignette eskil={false} offset={0.25} darkness={0.55} />
          </EffectComposer>
        )}
      </Canvas>
      {!glow && <div className="vignette" />}
      <TouchControls />
      <Hud />
    </>
  )
}
