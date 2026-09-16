import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type Room = 'all' | 'living' | 'bedroom' | 'entry' | 'kitchen';
const CAMERA: Record<Room, { position: THREE.Vector3; target: THREE.Vector3; zoom: number }> = {
  all: { position: new THREE.Vector3(10,10,-12), target: new THREE.Vector3(0,0,0), zoom: 1.75 },
  living: { position: new THREE.Vector3(8,8,-10), target: new THREE.Vector3(-2.1,0,1.2), zoom: 2.3 },
  bedroom: { position: new THREE.Vector3(8,8,-10), target: new THREE.Vector3(2.1,0,1.5), zoom: 2.35 },
  entry: { position: new THREE.Vector3(9,8,-10), target: new THREE.Vector3(2.6,0,-1.9), zoom: 2.45 },
  kitchen: { position: new THREE.Vector3(8,9,-10), target: new THREE.Vector3(-2.2,0,-1.7), zoom: 2.4 },
};
type SceneApi={setRoom:(room:Room,instant:boolean)=>void;setPreview:(value:boolean)=>void;dispose:()=>void};
const mat=(color:string,roughness=.78)=>new THREE.MeshStandardMaterial({color,roughness});

function box(parent:THREE.Object3D,position:[number,number,number],scale:[number,number,number],color:string){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...scale),mat(color));mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function plant(parent:THREE.Object3D,position:[number,number,number]){
  const group=new THREE.Group();group.position.set(...position);parent.add(group);const pot=new THREE.Mesh(new THREE.CylinderGeometry(.17,.14,.34,16),mat('#a86045'));pot.position.y=.17;pot.castShadow=true;group.add(pot);
  [[-.12,.55,0],[.1,.65,.04],[0,.8,-.04],[-.18,.7,-.03],[.2,.48,.03]].forEach((p,i)=>{const leaf=new THREE.Mesh(new THREE.SphereGeometry(.16,14,10),mat(i%2?'#52735f':'#6f8b70'));leaf.scale.set(1,.58,.42);leaf.position.set(...p);leaf.rotation.z=i%2?-.5:.5;leaf.castShadow=true;group.add(leaf);});
}
function chair(parent:THREE.Object3D,x:number,z:number,r=0){const group=new THREE.Group();group.position.set(x,.34,z);group.rotation.y=r;parent.add(group);box(group,[0,0,0],[.45,.12,.45],'#6c7f6f');box(group,[0,.35,.19],[.45,.64,.1],'#6c7f6f');}

function createApartment(scene:THREE.Scene){
  const root=new THREE.Group();root.position.y=-.18;scene.add(root);box(root,[0,-.16,0],[8,.28,6],'#e5dfd2');box(root,[0,1.12,3],[8,.1,2.25],'#f0ede6');box(root,[-4,1.12,0],[.1,2.25,6],'#f0ede6');box(root,[.1,.71,.95],[.1,1.42,4],'#eee9df');box(root,[2.2,.71,-.55],[3.65,1.42,.1],'#eee9df');box(root,[-2.15,.71,-.65],[3.7,1.42,.1],'#eee9df');
  const glows:Partial<Record<Room,THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>>>={};
  const glow=(room:Room,x:number,z:number,w:number,d:number)=>{const material=new THREE.MeshBasicMaterial({color:'#d7e7d8',transparent:true,opacity:.08,depthWrite:false});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.006,z);mesh.scale.set(w,d,1);root.add(mesh);glows[room]=mesh;};
  glow('living',-2.05,1.2,3.75,3.2);glow('bedroom',2.05,1.35,3.8,2.9);glow('kitchen',-2.05,-1.95,3.75,2.65);glow('entry',2.05,-1.85,3.8,2.8);
  const living=new THREE.Group();living.position.set(-2.1,0,1.25);root.add(living);box(living,[0,.38,.55],[2.35,.52,.88],'#79907d');box(living,[0,.76,.92],[2.35,.7,.14],'#6e856f');box(living,[-1.04,.69,.55],[.16,.64,.9],'#6e856f');box(living,[1.04,.69,.55],[.16,.64,.9],'#6e856f');box(living,[-.55,.77,.45],[.52,.15,.5],'#e7d3b9');box(living,[.65,.77,.45],[.55,.15,.5],'#b96850');box(living,[0,.28,-.65],[1.25,.16,.72],'#ae825f');box(living,[0,.11,-.65],[.12,.28,.12],'#5d5147');const rug=new THREE.Mesh(new THREE.CircleGeometry(1.15,32),mat('#cbbca8',1));rug.rotation.x=-Math.PI/2;rug.position.set(0,.012,-.7);rug.receiveShadow=true;living.add(rug);plant(living,[-1.45,0,1.55]);
  const bedroom=new THREE.Group();bedroom.position.set(2.05,0,1.55);root.add(bedroom);box(bedroom,[0,.28,.25],[2.35,.44,2.05],'#b68d68');box(bedroom,[0,.56,.25],[2.15,.18,1.85],'#f0e9dc');box(bedroom,[0,.77,1.02],[2.18,.52,.24],'#80917d');box(bedroom,[-.6,.73,.24],[.72,.15,.55],'#d6c2a9');box(bedroom,[.6,.73,.24],[.72,.15,.55],'#d6c2a9');box(bedroom,[1.42,.48,1.45],[.68,.9,.68],'#b06f54');box(bedroom,[1.42,1.02,1.45],[.48,.18,.48],'#f1d498');
  const kitchen=new THREE.Group();kitchen.position.set(-2.15,0,-1.85);root.add(kitchen);box(kitchen,[-1.2,.47,.15],[.65,.9,2.3],'#c8bda8');box(kitchen,[-.1,.47,1],[1.5,.9,.62],'#d7cebf');box(kitchen,[.7,.5,-.55],[1.3,.18,.78],'#9b7658');box(kitchen,[.7,.24,-.55],[.12,.52,.12],'#5c5148');chair(kitchen,.25,-1.15);chair(kitchen,1.25,-.5,Math.PI/2);chair(kitchen,.2,-.5,-Math.PI/2);
  const entry=new THREE.Group();entry.position.set(2.15,0,-1.95);root.add(entry);box(entry,[1.5,1.02,.5],[.16,2.05,1.25],'#465850');box(entry,[1.35,1.02,.5],[.05,1.65,.92],'#25332f');box(entry,[-.15,.33,.15],[1.25,.48,.45],'#9a765a');plant(entry,[.25,0,1.1]);
  const livingLight=new THREE.PointLight('#ffd9a1',5.5,5,2);livingLight.position.set(-2.1,2,1.2);scene.add(livingLight);const bedLight=new THREE.PointLight('#ffe2b8',3.8,4,2);bedLight.position.set(2.05,1.9,1.7);scene.add(bedLight);return{glows,bedLight};
}

function mount(canvas:HTMLCanvasElement,initialRoom:Room,reduced:boolean):SceneApi{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dfe7dc');scene.fog=new THREE.Fog('#dfe7dc',18,34);const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);camera.position.copy(CAMERA.all.position);camera.zoom=CAMERA.all.zoom;camera.updateProjectionMatrix();const target=CAMERA.all.target.clone();camera.lookAt(target);scene.add(new THREE.HemisphereLight('#fff6e9','#9aa79d',2.1));const sun=new THREE.DirectionalLight('#fff3dd',3.2);sun.position.set(-4,12,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{near:.1,far:30,left:-8,right:8,top:8,bottom:-8});scene.add(sun);const{glows,bedLight}=createApartment(scene);
  let desiredRoom=initialRoom,preview=false,disposed=false,frame=0,viewportBoost=1,verticalShift=.12;const resize=()=>{const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;viewportBoost=width<520?.82:.86;verticalShift=width<520?.06:.12;renderer.setSize(width,height,false);const span=5.2;camera.left=-span*(width/height);camera.right=span*(width/height);camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const draw=()=>{if(disposed)return;const desired=CAMERA[desiredRoom],speed=reduced?1:.075;camera.position.lerp(desired.position,speed);target.lerp(desired.target,speed);camera.zoom=THREE.MathUtils.lerp(camera.zoom,desired.zoom*viewportBoost,speed);camera.updateProjectionMatrix();camera.projectionMatrix.elements[13]+=verticalShift;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.lookAt(target);for(const[name,mesh]of Object.entries(glows))mesh!.material.opacity=THREE.MathUtils.lerp(mesh!.material.opacity,(desiredRoom==='all'||desiredRoom===name)?.5:.07,reduced?1:.11);if(glows.bedroom)glows.bedroom.material.color.set(preview?'#f0c47b':'#d7e7d8');bedLight.color.set(preview?'#f5bb68':'#ffe2b8');bedLight.intensity=THREE.MathUtils.lerp(bedLight.intensity,preview?6:3.8,.1);renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
  return{setRoom(room,instant){desiredRoom=room;if(instant){camera.position.copy(CAMERA[room].position);target.copy(CAMERA[room].target);camera.zoom=CAMERA[room].zoom*viewportBoost;}},setPreview(value){preview=value;},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();scene.traverse((object)=>{if(object instanceof THREE.Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach((value)=>value.dispose());}});renderer.dispose();}};
}

function FallbackPlan({ room, preview }: { room: Room; preview: boolean }) {
  const active = (value: Room) => room === 'all' || room === value;
  return <div className="scene-fallback" role="img" aria-label={`Floor plan focused on ${room === 'all' ? 'the whole home' : room}`}>
    <svg viewBox="0 0 760 500" aria-hidden="true">
      <path className="plan-shell" d="M90 62h580v376H90z" />
      <path className="plan-wall" d="M380 62v376M90 270h580M535 270v168" />
      <g className={active('living') ? 'plan-room active' : 'plan-room'}><path d="M103 75h264v182H103z" /><text x="126" y="112">Living</text><rect x="145" y="162" width="138" height="48" rx="14" /><rect x="186" y="226" width="104" height="18" rx="9" /></g>
      <g className={active('bedroom') ? `plan-room active${preview ? ' preview' : ''}` : 'plan-room'}><path d="M393 75h264v182H393z" /><text x="416" y="112">Bedroom</text><rect x="446" y="142" width="158" height="96" rx="10" /><path d="M458 153h58v26h-58m76-26h58v26h-58" /></g>
      <g className={active('kitchen') ? 'plan-room active' : 'plan-room'}><path d="M103 283h264v142H103z" /><text x="126" y="320">Kitchen</text><rect x="140" y="346" width="194" height="28" rx="6" /><circle cx="178" cy="397" r="13" /><circle cx="235" cy="397" r="13" /></g>
      <g className={active('entry') ? 'plan-room active' : 'plan-room'}><path d="M393 283h129v142H393zM548 283h109v142H548z" /><text x="416" y="320">Entry</text><path d="M492 365h-62v42h62" /></g>
    </svg>
    <span>Architectural view unavailable · room controls remain active</span>
  </div>;
}

export function HomeScene({room,preview,reducedMotion}:{room:Room;preview:boolean;reducedMotion:boolean}){
  const forcedFallback = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('renderer') === 'fallback';
  const [fallback, setFallback] = useState(forcedFallback);
  const canvas=useRef<HTMLCanvasElement>(null),api=useRef<SceneApi|null>(null);
  useEffect(()=>{
    if(fallback || !canvas.current)return;
    const node=canvas.current;
    const lose=()=>setFallback(true);
    node.addEventListener('webglcontextlost',lose);
    try { api.current=mount(node,room,reducedMotion); }
    catch { setFallback(true); }
    return()=>{node.removeEventListener('webglcontextlost',lose);api.current?.dispose();api.current=null;};
  },[reducedMotion,fallback]);
  useEffect(()=>api.current?.setRoom(room,reducedMotion),[room,reducedMotion]);
  useEffect(()=>api.current?.setPreview(preview),[preview]);
  useEffect(()=>{
    const root=window as typeof window & {__STUDIO_QA__?:{snapshot:()=>unknown}};
    root.__STUDIO_QA__={snapshot:()=>({renderer:fallback?'fallback':'webgl',room,preview,reducedMotion})};
    return()=>{delete root.__STUDIO_QA__;};
  },[fallback,room,preview,reducedMotion]);
  return fallback ? <FallbackPlan room={room} preview={preview} /> : <canvas ref={canvas} className="home-canvas" aria-label={`Architectural view focused on ${room==='all'?'the whole home':room}`} />;
}
