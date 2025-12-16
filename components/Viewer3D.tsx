
import React, { useRef, Suspense, useState, useMemo, useEffect } from 'react';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Environment, 
  ContactShadows, 
  Sky,
  PerspectiveCamera,
  Html,
  TransformControls,
  GizmoHelper,
  GizmoViewcube,
  Line
} from '@react-three/drei';
import { Shape, MaterialInfo } from '../types';
import { MATERIAL_PRESETS } from '../constants';
import * as THREE from 'three';
import { 
  Box as BoxIcon, Layers, Maximize2, Minimize2, Grid, Palette, 
  Eye, EyeOff, Move, RotateCw, Maximize, MousePointer2, Copy, Clipboard, 
  LayoutTemplate, RefreshCw, Zap, Ruler, Group, Ungroup, Trash2, Sliders,
  Magnet, List, ChevronLeft, ArrowUpCircle, ArrowRightCircle, Circle,
  Scan, Sun, Moon, Monitor, Keyboard, Camera
} from 'lucide-react';

interface Viewer3DProps {
  shapes: Shape[];
  referenceImage?: string | null;
  materialLegend?: MaterialInfo[];
  onShapeUpdate: (shape: Shape) => void;
  onShapesUpdate: (shapes: Shape[]) => void;
  onAddShape: (shape: Shape) => void;
  onDeleteShapes: (ids: string[]) => void;
}

const f = (n: number) => n.toFixed(2);
const toDeg = (rad: number) => Math.round(rad * (180 / Math.PI));
const toRad = (deg: number) => deg * (Math.PI / 180);

// Helper to calculate bounding box of shapes
const getBounds = (shapes: Shape[]): THREE.Box3 => {
  const box = new THREE.Box3();
  if (shapes.length === 0) return box;

  shapes.forEach(s => {
    const center = new THREE.Vector3(...s.position);
    // Estimation of size based on shape type and args
    let maxDim = 1;
    const scales = s.scale;
    
    if (s.type === 'box') {
        const [w, h, d] = s.args || [1, 1, 1];
        // Calculate half-extents transformed by rotation would be better, but AABB estimation is okay for focus
        maxDim = Math.max(w*scales[0], h*scales[1], d*scales[2]);
    } else if (s.type === 'sphere') {
        const [r] = s.args || [1];
        maxDim = r * Math.max(...scales) * 2;
    } else {
        const args = s.args || [1, 1, 2]; 
        maxDim = Math.max(...args) * Math.max(...scales) * 2;
    }
    
    const half = maxDim / 2;
    // Expand by a cubic volume around center
    box.expandByPoint(new THREE.Vector3(center.x + half, center.y + half, center.z + half));
    box.expandByPoint(new THREE.Vector3(center.x - half, center.y - half, center.z - half));
  });
  
  return box;
};

// --- Camera Controller Helper ---
type CameraAction = 
  | { type: 'VIEW'; view: 'TOP' | 'FRONT' | 'SIDE' }
  | { type: 'FOCUS'; targetBox: THREE.Box3 };

const CameraController = ({ action }: { action: CameraAction | null }) => {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    if (!action) return;
    
    const orbitControls = controls as any;
    if (!orbitControls) return;

    if (action.type === 'VIEW') {
      const dist = camera.position.length() || 20;
      if (action.view === 'TOP') {
        camera.position.set(0, dist, 0);
      } else if (action.view === 'FRONT') {
        camera.position.set(0, 0, dist);
      } else if (action.view === 'SIDE') {
        camera.position.set(dist, 0, 0);
      }
      orbitControls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      orbitControls.update();
    } 
    else if (action.type === 'FOCUS') {
      const box = action.targetBox;
      if (box.isEmpty()) {
        // Reset to default
        camera.position.set(12, 12, 12);
        orbitControls.target.set(0, 0, 0);
        orbitControls.update();
        return;
      }

      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
      let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraDist *= 1.5; // Padding

      const direction = new THREE.Vector3().subVectors(camera.position, center).normalize();
      const newPos = center.clone().add(direction.multiplyScalar(cameraDist));
      
      camera.position.copy(newPos);
      orbitControls.target.copy(center);
      orbitControls.update();
    }

  }, [action, camera, controls]);

  return null;
};

// --- Screenshot Helper ---
const ScreenshotHandler = ({ trigger }: { trigger: number }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (trigger === 0) return;
    
    gl.render(scene, camera);
    const link = document.createElement('a');
    link.download = `cad-design-${Date.now()}.png`;
    link.href = gl.domElement.toDataURL('image/png', 1.0);
    link.click();
    
  }, [trigger, gl, scene, camera]);
  return null;
};

// --- Child Component: Render Single Shape ---
interface ShapeRendererProps {
  shape: Shape;
  clippingPlane: THREE.Plane;
  wireframe: boolean;
  isSelected: boolean;
  isGroupSelected: boolean;
  onSelect: (e: ThreeEvent<PointerEvent>) => void;
}

const ShapeRenderer: React.FC<ShapeRendererProps> = ({ 
  shape, 
  clippingPlane, 
  wireframe, 
  isSelected, 
  isGroupSelected,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false);
  const isElectrical = shape.category === 'electrical';
  
  // If hidden, render nothing
  if (shape.visible === false) return null;

  let geometry;
  let dimensionsInfo = "";

  switch (shape.type) {
    case 'box':
      const [w, h, d] = shape.args || [1, 1, 1];
      geometry = <boxGeometry args={[w, h, d]} />;
      dimensionsInfo = `${f(w * shape.scale[0])} x ${f(h * shape.scale[1])} x ${f(d * shape.scale[2])}`;
      break;
    case 'sphere':
      const [r] = shape.args || [1];
      geometry = <sphereGeometry args={shape.args as [number, number, number] || [1, 32, 32]} />;
      dimensionsInfo = `R: ${f(r * shape.scale[0])}`;
      break;
    case 'cylinder':
      const [rt, rb, hc] = shape.args || [1, 1, 2];
      geometry = <cylinderGeometry args={shape.args as [number, number, number, number] || [1, 1, 2, 32]} />;
      dimensionsInfo = `R: ${f(rt * shape.scale[0])}, H: ${f(hc * shape.scale[1])}`;
      break;
    case 'cone':
      const [rc, hcn] = shape.args || [1, 2];
      geometry = <coneGeometry args={shape.args as [number, number, number] || [1, 2, 32]} />;
      dimensionsInfo = `R: ${f(rc * shape.scale[0])}, H: ${f(hcn * shape.scale[1])}`;
      break;
    default:
      geometry = <boxGeometry />;
      dimensionsInfo = "Unknown";
  }

  // Material Defaults
  const roughness = shape.roughness ?? 0.5;
  const metalness = shape.metalness ?? 0.0;
  const opacity = shape.opacity ?? 1.0;
  const transparent = opacity < 1.0;
  
  // Emissive Logic
  // Priority: Selection Highlight -> Shape Emissive (if any) -> Electrical/Hover Highlight -> None
  const baseEmissive = shape.emissive || (isElectrical || hovered ? shape.color : 'black');
  const baseEmissiveIntensity = shape.emissiveIntensity || (isElectrical ? 0.6 : (hovered ? 0.3 : 0));
  
  const finalEmissive = (isSelected || isGroupSelected) ? '#818cf8' : baseEmissive;
  const finalEmissiveIntensity = (isSelected || isGroupSelected) ? 0.4 : baseEmissiveIntensity;

  return (
    <group
      position={shape.position}
      rotation={shape.rotation}
      scale={shape.scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; setHovered(true); }}
      onPointerOut={(e) => { document.body.style.cursor = 'auto'; setHovered(false); }}
    >
      <mesh castShadow={opacity > 0.5} receiveShadow>
        {geometry}
        <meshPhysicalMaterial 
          color={shape.color} 
          roughness={roughness}
          metalness={metalness}
          transparent={transparent}
          opacity={opacity}
          clearcoat={metalness > 0.5 ? 0.8 : 0.0}
          emissive={finalEmissive}
          emissiveIntensity={finalEmissiveIntensity} 
          clippingPlanes={[clippingPlane]} 
          clipShadows={true}
          wireframe={wireframe}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Tooltip */}
      {hovered && !isSelected && !isGroupSelected && (
        <Html distanceFactor={15} center position={[0, 0, 0]} zIndexRange={[100, 0]}>
          <div className="pointer-events-none min-w-[160px] bg-[#0f172a]/90 backdrop-blur-xl text-slate-200 p-4 rounded-xl shadow-2xl border border-white/10 flex flex-col gap-2 transform transition-all scale-100 origin-bottom ring-1 ring-black/50">
            <div>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>{shape.name || shape.type}</span>
                {isElectrical && <Zap size={10} className="text-yellow-400" />}
              </p>
              <div className="w-full h-px bg-gradient-to-r from-indigo-500/50 to-transparent"></div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-mono text-slate-400">
               <span>Dim:</span><span className="text-slate-200">{dimensionsInfo}</span>
            </div>
            {shape.groupId && <div className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded w-fit">Grouped</div>}
          </div>
        </Html>
      )}
    </group>
  );
};


// --- Helper: Group Transformer ---
const SelectionGroup = ({ 
  shapes, 
  onTransformEnd, 
  transformMode, 
  onDraggingChange,
  snapEnabled
}: { 
  shapes: Shape[], 
  onTransformEnd: (updates: Shape[]) => void, 
  transformMode: 'translate' | 'rotate' | 'scale', 
  onDraggingChange: (isDragging: boolean) => void,
  snapEnabled: boolean
}) => {
  const groupRef = useRef<THREE.Group>(null);
  
  const centroid = useMemo(() => {
    if (shapes.length === 0) return new THREE.Vector3(0,0,0);
    const center = new THREE.Vector3();
    shapes.forEach(s => center.add(new THREE.Vector3(...s.position)));
    return center.divideScalar(shapes.length);
  }, [shapes]);

  const handleMouseUp = () => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    
    const updates: Shape[] = [];
    
    group.children.forEach((child, index) => {
       const worldPos = new THREE.Vector3();
       const worldQuat = new THREE.Quaternion();
       const worldScale = new THREE.Vector3();
       
       child.getWorldPosition(worldPos);
       child.getWorldQuaternion(worldQuat);
       child.getWorldScale(worldScale);
       
       const euler = new THREE.Euler().setFromQuaternion(worldQuat);
       const originalShape = shapes[index];
       
       updates.push({
         ...originalShape,
         position: [worldPos.x, worldPos.y, worldPos.z],
         rotation: [euler.x, euler.y, euler.z],
         scale: [worldScale.x, worldScale.y, worldScale.z]
       });
    });
    
    onTransformEnd(updates);
  };

  return (
    <>
      <group ref={groupRef} position={centroid}>
        {shapes.map(shape => {
            const localPos = [
                shape.position[0] - centroid.x,
                shape.position[1] - centroid.y,
                shape.position[2] - centroid.z
            ] as [number, number, number];
            
            return (
                <group 
                  key={shape.id} 
                  position={localPos} 
                  rotation={shape.rotation} 
                  scale={shape.scale}
                >
                   {/* Proxy shapes for transform visualization */}
                   {shape.type === 'box' && <boxGeometry args={shape.args as any} />}
                   {shape.type === 'sphere' && <sphereGeometry args={shape.args as any} />}
                   {shape.type === 'cylinder' && <cylinderGeometry args={shape.args as any} />}
                   {shape.type === 'cone' && <coneGeometry args={shape.args as any} />}
                   <meshBasicMaterial color={shape.color} wireframe />
                </group>
            )
        })}
      </group>
      <TransformControls 
         object={groupRef} 
         mode={transformMode} 
         onMouseUp={handleMouseUp}
         onDraggingChange={onDraggingChange}
         size={1.2}
         translationSnap={snapEnabled ? 0.5 : null}
         rotationSnap={snapEnabled ? Math.PI / 4 : null}
         scaleSnap={snapEnabled ? 0.1 : null}
      />
    </>
  );
};


export const Viewer3D: React.FC<Viewer3DProps> = ({ shapes, referenceImage, materialLegend, onShapeUpdate, onShapesUpdate, onAddShape, onDeleteShapes }) => {
  const [clippingHeight, setClippingHeight] = useState(50);
  const [isRefExpanded, setIsRefExpanded] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showElectrical, setShowElectrical] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [envPreset, setEnvPreset] = useState<'day' | 'studio' | 'night'>('day');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [screenshotTrigger, setScreenshotTrigger] = useState(0);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [isDragging, setIsDragging] = useState(false);
  
  // Tools
  const [toolMode, setToolMode] = useState<'select' | 'measure'>('select');
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const [clipboard, setClipboard] = useState<Shape[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  
  // Camera Action Trigger
  const [cameraAction, setCameraAction] = useState<CameraAction | null>(null);

  // Ref Overlay
  const [refOpacity, setRefOpacity] = useState(1);
  const [refWidth, setRefWidth] = useState(320); 

  const clippingPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), clippingHeight), [clippingHeight]);
  
  // --- Actions ---

  const handleShapeSelect = (e: ThreeEvent<PointerEvent>, shape: Shape) => {
    if (toolMode === 'measure') {
        e.stopPropagation();
        setMeasurePoints(prev => prev.length >= 2 ? [e.point] : [...prev, e.point]);
        return;
    }

    if (e.shiftKey) {
       setSelectedIds(prev => prev.includes(shape.id) ? prev.filter(id => id !== shape.id) : [...prev, shape.id]);
    } else {
       if (shape.groupId) {
           const peers = shapes.filter(s => s.groupId === shape.groupId).map(s => s.id);
           setSelectedIds(peers);
       } else {
           setSelectedIds([shape.id]);
       }
    }
  };

  const handleCanvasClick = (e: ThreeEvent<PointerEvent>) => {
      if (toolMode === 'measure') {
          setMeasurePoints(prev => prev.length >= 2 ? [e.point] : [...prev, e.point]);
      } else {
         if (!isDragging) setSelectedIds([]);
      }
  };

  const handleGroup = () => {
      if (selectedIds.length < 2) return;
      const newGroupId = `group-${Date.now()}`;
      const updated = shapes.filter(s => selectedIds.includes(s.id)).map(s => ({ ...s, groupId: newGroupId }));
      onShapesUpdate(updated);
  };

  const handleUngroup = () => {
      if (selectedIds.length === 0) return;
      const updated = shapes.filter(s => selectedIds.includes(s.id)).map(s => ({ ...s, groupId: undefined }));
      onShapesUpdate(updated);
  };
  
  const handleCopy = () => {
     const selected = shapes.filter(s => selectedIds.includes(s.id));
     if (selected.length > 0) setClipboard(selected);
  };
  
  const handlePaste = () => {
     if (clipboard.length === 0) return;
     const newShapes = clipboard.map(s => ({
         ...s,
         id: Date.now() + Math.random().toString().slice(2,5),
         position: [s.position[0] + 2, s.position[1], s.position[2] + 2] as [number,number,number],
         groupId: undefined 
     }));
     newShapes.forEach(s => onAddShape(s));
     setSelectedIds(newShapes.map(s => s.id));
  };
  
  const handleDelete = () => {
     if (selectedIds.length === 0) return;
     onDeleteShapes(selectedIds);
     setSelectedIds([]);
  };

  const handleFocus = () => {
    let targetShapes = selectedIds.length > 0 
      ? shapes.filter(s => selectedIds.includes(s.id))
      : shapes.filter(s => s.visible !== false);
    
    if (targetShapes.length === 0 && shapes.length > 0) targetShapes = shapes;

    const box = getBounds(targetShapes);
    setCameraAction({ type: 'FOCUS', targetBox: box });
    // Reset action after short delay to allow re-trigger
    setTimeout(() => setCameraAction(null), 100);
  };
  
  const applyMaterialPreset = (preset: any) => {
    const updated = shapes.filter(s => selectedIds.includes(s.id)).map(s => ({
      ...s,
      color: preset.color,
      roughness: preset.roughness,
      metalness: preset.metalness,
      opacity: preset.opacity,
      emissive: preset.emissive || undefined,
      emissiveIntensity: preset.emissiveIntensity || undefined
    }));
    onShapesUpdate(updated);
  };

  const cycleEnvironment = () => {
    if (envPreset === 'day') setEnvPreset('studio');
    else if (envPreset === 'studio') setEnvPreset('night');
    else setEnvPreset('day');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
       
       if (e.key === 'Delete' || e.key === 'Backspace') { handleDelete(); }
       if (e.key === 'f' || e.key === 'F') { handleFocus(); }

       if ((e.ctrlKey || e.metaKey)) {
           if (e.key === 'c') { e.preventDefault(); handleCopy(); }
           if (e.key === 'v') { e.preventDefault(); handlePaste(); }
           if (e.key === 'g') { e.preventDefault(); handleGroup(); }
           if (e.key === 'u') { e.preventDefault(); handleUngroup(); }
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, clipboard, shapes, envPreset]);

  // Derived Lists
  const visibleShapes = useMemo(() => shapes.filter(s => showElectrical || s.category !== 'electrical'), [shapes, showElectrical]);
  const selectedShapes = useMemo(() => visibleShapes.filter(s => selectedIds.includes(s.id)), [visibleShapes, selectedIds]);
  const unselectedShapes = useMemo(() => visibleShapes.filter(s => !selectedIds.includes(s.id)), [visibleShapes, selectedIds]);

  // Right Panel Logic
  const [activeTab, setActiveTab] = useState<'inspector' | 'materials' | 'outliner'>('outliner');
  
  useEffect(() => {
     if (selectedIds.length > 0) setActiveTab('inspector');
  }, [selectedIds]);

  const activeShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

  return (
    <div className="w-full h-full bg-gradient-to-b from-gray-900 via-[#0a0a0a] to-black rounded-2xl overflow-hidden shadow-2xl relative group border border-gray-800 ring-1 ring-white/5">
      
      <Canvas 
        shadows 
        dpr={[1, 2]}
        gl={{ localClippingEnabled: true, antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={handleCanvasClick}
      >
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[12, 12, 12]} fov={50} />
          <CameraController action={cameraAction} /> 
          <ScreenshotHandler trigger={screenshotTrigger} />
          
          {/* Environment Logic */}
          {envPreset === 'day' && (
             <>
               <Sky sunPosition={[10, 10, 10]} />
               <Environment preset="city" />
               <ambientLight intensity={0.6} />
               <directionalLight position={[10, 20, 10]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} />
             </>
          )}
          {envPreset === 'studio' && (
             <>
               <color attach="background" args={['#1a1a1a']} />
               <Environment preset="studio" />
               <ambientLight intensity={0.8} />
               <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
             </>
          )}
          {envPreset === 'night' && (
             <>
                <color attach="background" args={['#050505']} />
                <Environment preset="city" />
                <ambientLight intensity={0.1} />
                <pointLight position={[10, 10, 10]} intensity={15} color="#818cf8" castShadow />
                <pointLight position={[-10, 5, -10]} intensity={10} color="#f472b6" />
             </>
          )}
          
          <group>
            {/* Render Unselected Shapes Normally */}
            {unselectedShapes.map((shape) => (
              <ShapeRenderer 
                key={shape.id} 
                shape={shape} 
                clippingPlane={clippingPlane} 
                wireframe={wireframe} 
                isSelected={false}
                isGroupSelected={false}
                onSelect={(e) => handleShapeSelect(e, shape)}
              />
            ))}

            {/* Render Selected Shapes Group for Transform */}
            {selectedIds.length > 0 ? (
               <SelectionGroup 
                  shapes={selectedShapes} 
                  transformMode={transformMode}
                  onDraggingChange={setIsDragging}
                  onTransformEnd={onShapesUpdate}
                  snapEnabled={snapEnabled}
               />
            ) : null}
            
            {/* Measurement Line */}
            {toolMode === 'measure' && measurePoints.length > 0 && (
                <>
                  {measurePoints.map((p, i) => (
                      <mesh key={i} position={p}>
                          <sphereGeometry args={[0.1]} />
                          <meshBasicMaterial color="red" />
                      </mesh>
                  ))}
                  {measurePoints.length === 2 && (
                      <>
                        <Line points={measurePoints} color="red" lineWidth={2} dashed={true} />
                        <Html position={new THREE.Vector3().addVectors(measurePoints[0], measurePoints[1]).multiplyScalar(0.5)}>
                            <div className="bg-black/80 text-white px-2 py-1 rounded text-xs border border-white/20 whitespace-nowrap">
                                {measurePoints[0].distanceTo(measurePoints[1]).toFixed(2)}m
                            </div>
                        </Html>
                      </>
                  )}
                </>
            )}

            {showGrid && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={(e) => handleCanvasClick(e)}>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial color={envPreset === 'studio' ? '#222' : '#1e293b'} roughness={0.9} metalness={0.1} />
                <gridHelper args={[200, 100, 0x475569, 0x334155]} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} />
              </mesh>
            )}
          </group>
          
          <ContactShadows opacity={0.5} scale={50} blur={2.5} far={4} resolution={256} color="#000000" />
          <OrbitControls makeDefault enabled={!isDragging} autoRotate={autoRotate} />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewcube color="gray" strokeColor="white" textColor="black" hoverColor="#4f46e5" opacity={0.8} />
          </GizmoHelper>

        </Suspense>
      </Canvas>
      
      {/* --- UI OVERLAYS --- */}
      
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
           <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Keyboard size={20}/> Keyboard Shortcuts</h3>
              <div className="space-y-2 text-sm text-slate-300">
                 <div className="flex justify-between"><span>Focus Selection</span><kbd className="bg-white/10 px-2 rounded">F</kbd></div>
                 <div className="flex justify-between"><span>Delete</span><kbd className="bg-white/10 px-2 rounded">Del / Bksp</kbd></div>
                 <div className="flex justify-between"><span>Group</span><kbd className="bg-white/10 px-2 rounded">Ctrl + G</kbd></div>
                 <div className="flex justify-between"><span>Ungroup</span><kbd className="bg-white/10 px-2 rounded">Ctrl + U</kbd></div>
                 <div className="flex justify-between"><span>Copy</span><kbd className="bg-white/10 px-2 rounded">Ctrl + C</kbd></div>
                 <div className="flex justify-between"><span>Paste</span><kbd className="bg-white/10 px-2 rounded">Ctrl + V</kbd></div>
                 <div className="flex justify-between"><span>Undo</span><kbd className="bg-white/10 px-2 rounded">Ctrl + Z</kbd></div>
                 <div className="flex justify-between"><span>Redo</span><kbd className="bg-white/10 px-2 rounded">Ctrl + Y</kbd></div>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="mt-6 w-full py-2 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-500">Close</button>
           </div>
        </div>
      )}

      {/* Material Legend */}
      {materialLegend && materialLegend.length > 0 && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className={`pointer-events-auto transition-all duration-300 ease-in-out bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden ring-1 ring-white/5 ${isLegendExpanded ? 'w-64' : 'w-11 h-11'}`}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                {isLegendExpanded && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Palette size={12} className="text-indigo-400"/> Materials</span>}
                <button 
                  onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 p-1.5 rounded-lg transition-colors border border-white/5"
                >
                  {isLegendExpanded ? <Minimize2 size={14} /> : <Palette size={16} />}
                </button>
              </div>
              {isLegendExpanded && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                  {materialLegend.map((item, idx) => (
                    <div key={idx} className="group bg-white/5 p-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/5">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-5 h-5 rounded-full ring-2 ring-white/10 shadow-lg" style={{ backgroundColor: item.color }} />
                        <span className="text-xs font-semibold text-slate-200 truncate">{item.name}</span>
                      </div>
                      {item.description && <p className="text-[10px] text-slate-400 leading-relaxed pl-8 font-light">{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* --- RIGHT PANEL --- */}
      <div className="absolute top-20 right-4 z-20 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5 animate-in slide-in-from-right-10 fade-in duration-300 max-h-[calc(100vh-140px)] flex flex-col">
          
          {/* Tabs */}
          <div className="flex border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
             <button 
               onClick={() => setActiveTab('outliner')}
               className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'outliner' ? 'text-white border-b-2 border-indigo-500 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <List size={12} /> Outliner
             </button>
             <button 
               onClick={() => setActiveTab('materials')}
               className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'materials' ? 'text-white border-b-2 border-indigo-500 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <Palette size={12} /> Materials
             </button>
             {selectedIds.length > 0 && (
                <button 
                  onClick={() => setActiveTab('inspector')}
                  className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === 'inspector' ? 'text-white border-b-2 border-indigo-500 bg-white/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Sliders size={12} /> Edit
                </button>
             )}
          </div>

          <div className="overflow-y-auto scrollbar-hide flex-1">
             
             {/* --- MODE: INSPECTOR --- */}
             {activeTab === 'inspector' && activeShape && (
                <div className="p-4 space-y-5">
                   {/* Common Properties */}
                   <div className="space-y-1.5">
                     <label className="text-[10px] text-slate-500 font-bold uppercase">Position</label>
                     <div className="grid grid-cols-3 gap-2">
                        {['X', 'Y', 'Z'].map((axis, i) => (
                           <div key={axis} className="relative group">
                              <span className="absolute left-2 top-1.5 text-[10px] text-slate-500">{axis}</span>
                              <input 
                                type="number" step="0.1"
                                className="w-full bg-[#0f172a] border border-white/10 rounded-lg py-1 pl-5 pr-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                value={activeShape.position[i]}
                                onChange={(e) => {
                                   const newPos = [...activeShape.position] as [number,number,number];
                                   newPos[i] = parseFloat(e.target.value);
                                   onShapeUpdate({ ...activeShape, position: newPos });
                                }}
                              />
                           </div>
                        ))}
                     </div>
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] text-slate-500 font-bold uppercase">Rotation (°)</label>
                     <div className="grid grid-cols-3 gap-2">
                        {['X', 'Y', 'Z'].map((axis, i) => (
                           <div key={axis} className="relative">
                              <span className="absolute left-2 top-1.5 text-[10px] text-slate-500">{axis}</span>
                              <input 
                                type="number" step="15"
                                className="w-full bg-[#0f172a] border border-white/10 rounded-lg py-1 pl-5 pr-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                value={toDeg(activeShape.rotation[i])}
                                onChange={(e) => {
                                   const newRot = [...activeShape.rotation] as [number,number,number];
                                   newRot[i] = toRad(parseFloat(e.target.value));
                                   onShapeUpdate({ ...activeShape, rotation: newRot });
                                }}
                              />
                           </div>
                        ))}
                     </div>
                   </div>

                   <div className="space-y-1.5">
                     <label className="text-[10px] text-slate-500 font-bold uppercase">Scale</label>
                     <div className="grid grid-cols-3 gap-2">
                        {['X', 'Y', 'Z'].map((axis, i) => (
                           <div key={axis} className="relative">
                              <span className="absolute left-2 top-1.5 text-[10px] text-slate-500">{axis}</span>
                              <input 
                                type="number" step="0.1"
                                className="w-full bg-[#0f172a] border border-white/10 rounded-lg py-1 pl-5 pr-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
                                value={activeShape.scale[i]}
                                onChange={(e) => {
                                   const newScale = [...activeShape.scale] as [number,number,number];
                                   newScale[i] = parseFloat(e.target.value);
                                   onShapeUpdate({ ...activeShape, scale: newScale });
                                }}
                              />
                           </div>
                        ))}
                     </div>
                   </div>

                   <div className="space-y-3 pt-3 border-t border-white/5">
                      <label className="text-[10px] text-slate-500 font-bold uppercase mb-2 block">Material & Color</label>
                      <div className="flex items-center gap-3">
                         <input 
                           type="color" value={activeShape.color}
                           onChange={(e) => onShapeUpdate({ ...activeShape, color: e.target.value })}
                           className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                         />
                         <span className="text-xs text-slate-400 font-mono">{activeShape.color}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-[10px] text-slate-400">Roughness</span><span className="text-[10px] text-slate-500">{(activeShape.roughness ?? 0.5).toFixed(2)}</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={activeShape.roughness ?? 0.5} onChange={(e) => onShapeUpdate({ ...activeShape, roughness: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span className="text-[10px] text-slate-400">Metalness</span><span className="text-[10px] text-slate-500">{(activeShape.metalness ?? 0.0).toFixed(2)}</span></div>
                        <input type="range" min="0" max="1" step="0.05" value={activeShape.metalness ?? 0.0} onChange={(e) => onShapeUpdate({ ...activeShape, metalness: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                      <div className="space-y-1">
                         <div className="flex justify-between"><span className="text-[10px] text-slate-400">Opacity</span><span className="text-[10px] text-slate-500">{(activeShape.opacity ?? 1.0).toFixed(2)}</span></div>
                         <input type="range" min="0" max="1" step="0.05" value={activeShape.opacity ?? 1.0} onChange={(e) => onShapeUpdate({ ...activeShape, opacity: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                   </div>
                </div>
             )}
             
             {/* --- MODE: MATERIALS LIBRARY --- */}
             {activeTab === 'materials' && (
                <div className="p-4">
                   <div className="text-xs text-slate-400 mb-4">
                      {selectedIds.length > 0 ? `Apply to ${selectedIds.length} selected item(s)` : "Select items to apply materials"}
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      {MATERIAL_PRESETS.map((preset, i) => (
                         <button 
                           key={i}
                           onClick={() => selectedIds.length > 0 && applyMaterialPreset(preset)}
                           disabled={selectedIds.length === 0}
                           className="group relative aspect-square rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                         >
                            <div 
                              className="w-10 h-10 rounded-full shadow-lg ring-1 ring-white/20" 
                              style={{ 
                                 backgroundColor: preset.color,
                                 opacity: preset.opacity,
                                 boxShadow: preset.emissive ? `0 0 10px ${preset.emissive}` : undefined
                              }} 
                            />
                            <span className="text-[10px] font-medium text-slate-300 text-center px-1">{preset.name}</span>
                            
                            {/* Shine effect for metal */}
                            {preset.metalness > 0.5 && <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
                         </button>
                      ))}
                   </div>
                </div>
             )}

             {/* --- MODE: SCENE OUTLINER --- */}
             {activeTab === 'outliner' && (
                <div className="p-2 space-y-1">
                   {shapes.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 text-xs">Scene is empty</div>
                   ) : (
                      shapes.map((s, idx) => (
                        <div 
                          key={s.id} 
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer group transition-colors ${selectedIds.includes(s.id) ? 'bg-indigo-600/20 border border-indigo-500/50' : 'hover:bg-white/5 border border-transparent'}`}
                          onClick={() => {
                             setSelectedIds([s.id]);
                          }}
                        >
                           <div className="flex items-center gap-2 overflow-hidden">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.visible === false ? 'bg-slate-700' : 'bg-indigo-500'}`} style={{ backgroundColor: s.visible !== false ? s.color : undefined }}></div>
                              <span className={`truncate ${selectedIds.includes(s.id) ? 'text-white font-medium' : 'text-slate-400'}`}>
                                 {s.name || `${s.type} ${idx + 1}`}
                              </span>
                              {s.groupId && <span className="text-[9px] px-1 py-0.5 bg-white/5 rounded text-slate-500">Grp</span>}
                           </div>
                           
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               onShapeUpdate({ ...s, visible: !(s.visible !== false) });
                             }}
                             className={`p-1 rounded hover:bg-white/10 ${s.visible === false ? 'text-slate-600' : 'text-slate-400'}`}
                           >
                              {s.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                           </button>
                        </div>
                      ))
                   )}
                </div>
             )}
          </div>
      </div>

      {/* Reference Image Overlay (unchanged) */}
      {referenceImage && (
        <div 
          className={`absolute top-4 right-4 z-30 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden ring-1 ring-white/5 transition-all duration-300 ${'mr-[270px]'}`}
          style={{ width: isRefExpanded ? refWidth : 100, opacity: isRefExpanded ? refOpacity : 1 }}
        >
           <div className="relative p-2.5 flex flex-col gap-2 h-full">
              <div className="absolute top-1.5 right-1.5 z-40 flex items-center gap-1.5">
                 {isRefExpanded && (
                    <button onClick={() => setRefOpacity(p => p === 1 ? 0.5 : 1)} className="bg-black/60 text-white p-1.5 rounded-full backdrop-blur-md">
                      <Eye size={12} />
                    </button>
                 )}
                 <button onClick={() => setIsRefExpanded(!isRefExpanded)} className="bg-black/60 text-white p-1.5 rounded-full backdrop-blur-md">
                  {isRefExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#1e293b] w-full flex-shrink-0">
                   <img src={referenceImage} alt="Ref" className={`w-full block object-contain ${isRefExpanded ? 'max-h-[60vh]' : 'h-24'}`} />
              </div>
           </div>
        </div>
      )}

      {/* --- FLOATING TOOLBAR --- */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 p-2 pl-3 pr-4 rounded-2xl flex items-center gap-4 w-auto shadow-2xl ring-1 ring-white/5 min-w-[340px] z-40">
          
          {/* Tool Mode Switcher */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
             <button onClick={() => { setToolMode('select'); setMeasurePoints([]); }} className={`p-2 rounded-lg transition-all ${toolMode === 'select' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><MousePointer2 size={18} /></button>
             <button onClick={() => { setToolMode('measure'); setSelectedIds([]); }} className={`p-2 rounded-lg transition-all ${toolMode === 'measure' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Ruler size={18} /></button>
          </div>

          <div className="w-px h-8 bg-white/10"></div>

          {/* Transformation Controls */}
          {toolMode === 'select' && selectedIds.length > 0 ? (
             <div className="flex items-center gap-1 animate-in fade-in duration-200">
                <button onClick={() => setTransformMode('translate')} className={`p-2 rounded-lg ${transformMode === 'translate' ? 'text-indigo-400' : 'text-slate-400'}`}><Move size={18}/></button>
                <button onClick={() => setTransformMode('rotate')} className={`p-2 rounded-lg ${transformMode === 'rotate' ? 'text-indigo-400' : 'text-slate-400'}`}><RotateCw size={18}/></button>
                <button onClick={() => setTransformMode('scale')} className={`p-2 rounded-lg ${transformMode === 'scale' ? 'text-indigo-400' : 'text-slate-400'}`}><Maximize size={18}/></button>
                <div className="w-px h-6 bg-white/10 mx-2"></div>
                <button onClick={() => setSnapEnabled(!snapEnabled)} className={`p-2 rounded-lg transition-colors ${snapEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white'}`} title="Snap"><Magnet size={18}/></button>
                
                <div className="w-px h-6 bg-white/10 mx-2"></div>
                {/* Focus Button */}
                <button onClick={handleFocus} className="p-2 text-indigo-400 hover:text-white hover:bg-indigo-500/10 rounded-lg" title="Focus (F)"><Scan size={18}/></button>
                
                <div className="w-px h-6 bg-white/10 mx-2"></div>
                
                <button onClick={handleGroup} className="p-2 text-slate-400 hover:text-white" title="Group (Ctrl+G)"><Group size={18}/></button>
                <button onClick={handleUngroup} className="p-2 text-slate-400 hover:text-white" title="Ungroup (Ctrl+U)"><Ungroup size={18}/></button>
                <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-white" title="Copy (Ctrl+C)"><Copy size={18}/></button>
                <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg" title="Delete (Del)"><Trash2 size={18}/></button>
             </div>
          ) : (
             /* General Controls & Camera Presets */
             <div className="flex items-center gap-3 animate-in fade-in duration-200">
                <button onClick={() => setWireframe(!wireframe)} className={`p-2 rounded-lg ${wireframe ? 'text-indigo-400' : 'text-slate-400'}`}><Grid size={18}/></button>
                <button onClick={() => setAutoRotate(!autoRotate)} className={`p-2 rounded-lg ${autoRotate ? 'text-indigo-400' : 'text-slate-400'}`}><RefreshCw size={18}/></button>
                
                {/* Environment Switcher */}
                <button 
                  onClick={cycleEnvironment} 
                  className={`p-2 rounded-lg ${envPreset === 'day' ? 'text-yellow-400' : envPreset === 'studio' ? 'text-slate-200' : 'text-indigo-400'}`}
                  title="Cycle Environment"
                >
                   {envPreset === 'day' && <Sun size={18}/>}
                   {envPreset === 'studio' && <Monitor size={18}/>}
                   {envPreset === 'night' && <Moon size={18}/>}
                </button>

                <div className="w-px h-6 bg-white/10 mx-1"></div>
                
                {/* Camera Presets */}
                <div className="flex items-center gap-1">
                   <button onClick={() => { setCameraAction({ type: 'VIEW', view: 'TOP' }); setTimeout(() => setCameraAction(null), 100); }} className="p-2 text-slate-400 hover:text-white" title="Top View"><ArrowUpCircle size={18}/></button>
                   <button onClick={() => { setCameraAction({ type: 'VIEW', view: 'FRONT' }); setTimeout(() => setCameraAction(null), 100); }} className="p-2 text-slate-400 hover:text-white" title="Front View"><Circle size={18}/></button>
                   <button onClick={() => { setCameraAction({ type: 'VIEW', view: 'SIDE' }); setTimeout(() => setCameraAction(null), 100); }} className="p-2 text-slate-400 hover:text-white" title="Side View"><ArrowRightCircle size={18}/></button>
                   {/* Main Focus Button (when nothing selected) */}
                   <button onClick={handleFocus} className="p-2 text-indigo-400 hover:text-white" title="Fit All (F)"><Scan size={18}/></button>
                </div>

                <div className="w-px h-6 bg-white/10 mx-1"></div>

                {/* Screenshot Trigger */}
                <button onClick={() => setScreenshotTrigger(prev => prev + 1)} className="p-2 text-slate-400 hover:text-emerald-400" title="Take Screenshot"><Camera size={18}/></button>
                
                {/* Keyboard Shortcuts Help Trigger */}
                <button onClick={() => setShowShortcuts(true)} className="ml-2 p-1.5 text-xs font-bold text-slate-500 border border-slate-600/50 rounded hover:text-white hover:border-white/50">?</button>

                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <div className="flex items-center gap-2">
                   <Layers size={16} className="text-slate-500" />
                   <input type="range" min="0" max="50" step="0.5" value={clippingHeight} onChange={(e) => setClippingHeight(parseFloat(e.target.value))} className="w-24 h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
             </div>
          )}
      </div>

    </div>
  );
};
