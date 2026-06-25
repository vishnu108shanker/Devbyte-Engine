import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { Text3D, Center } from '@react-three/drei';
import { Theme } from '../design/theme';
import * as THREE from 'three';

interface KineticText3DProps {
  text: string;
  highlight: string;
  from?: number;
}

// Simple text wrapper to prevent text from going off-screen
const wrapText = (str: string, maxWidth: number) => {
  const words = str.split(' ');
  let line = '';
  let result = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (testLine.length > maxWidth && n > 0) {
      result += line.trim() + '\n';
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  result += line.trim();
  return result;
};

const TextScene: React.FC<KineticText3DProps> = ({ text, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animation values
  const enterSpring = spring({
    frame: frame - from,
    fps,
    config: { damping: 14, stiffness: 80, mass: 1 },
  });

  const scale = interpolate(enterSpring, [0, 1], [0.1, 1]);
  // Kinetic crash effect: starts rotated back, slams forward
  const rotX = interpolate(enterSpring, [0, 1], [Math.PI / 3, 0]);
  
  // Continuous gentle floating
  const rotY = Math.sin(frame * 0.02) * 0.15;
  const floatY = Math.sin(frame * 0.03) * 0.5;

  // Wrap text at ~15 characters
  const wrappedText = wrapText(text, 15);

  // Premium Metallic Material
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.9,
    roughness: 0.15,
  }), []);

  return (
    <group scale={scale} rotation={[rotX, rotY, 0]} position={[0, floatY, 0]}>
      {/* Dramatic Lighting */}
      <ambientLight intensity={0.8} />
      
      {/* Cyan/Blue rim light from top right */}
      <pointLight position={[10, 10, 10]} intensity={300} color={Theme.colors.brand.cyan} />
      
      {/* Violet rim light from bottom left */}
      <pointLight position={[-10, -10, -10]} intensity={200} color={Theme.colors.brand.violet} />
      
      {/* Soft fill light from front */}
      <directionalLight position={[0, 0, 20]} intensity={1.5} color="#ffffff" />

      <Center>
        <Text3D
          font={staticFile('fonts/helvetiker_bold.typeface.json')}
          size={3.5}
          height={0.8}
          curveSegments={12}
          bevelEnabled
          bevelThickness={0.15}
          bevelSize={0.08}
          bevelOffset={0}
          bevelSegments={5}
          material={material}
          lineHeight={1.2}
          letterSpacing={-0.02}
        >
          {wrappedText}
        </Text3D>
      </Center>
    </group>
  );
};

export const KineticText3D: React.FC<KineticText3DProps> = (props) => {
  const { width, height } = useVideoConfig();
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 50 }}>
      {/* camera fov adjusted for vertical aspect ratio */}
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 35], fov: 45 }}>
        <TextScene {...props} />
      </ThreeCanvas>
    </div>
  );
};
