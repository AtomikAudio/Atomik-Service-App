import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Brand-inspired onboarding icons, drawn from atomikaudio.com themes:
 * the "Digital + Analog" blend, precision loudspeaker engineering, and
 * "time as the cornerstone" of audio.
 */

/** A waveform that morphs from a smooth analog sine into a digital square wave. */
export const DigitalAnalogIcon: React.FC<IconProps> = ({
  size = 56,
  color = '#ffffff',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Path
      d="M4 32 Q 10 16 16 32 T 28 32"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M28 32 L28 20 L36 20 L36 44 L44 44 L44 24 L52 24 L52 32 L60 32"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** A loudspeaker driver — surround, cone and centre dome. */
export const LoudspeakerIcon: React.FC<IconProps> = ({
  size = 56,
  color = '#ffffff',
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Circle cx={32} cy={32} r={23} stroke={color} strokeWidth={3} />
    <Circle cx={32} cy={32} r={13} stroke={color} strokeWidth={2.4} />
    <Circle cx={32} cy={32} r={5} fill={color} />
  </Svg>
);

/** An audio timeline — level bars over a baseline, with a progress marker. */
export const AudioTimelineIcon: React.FC<IconProps> = ({
  size = 56,
  color = '#ffffff',
}) => {
  const bars = [
    { x: 10, h: 16 },
    { x: 20, h: 30 },
    { x: 30, h: 42 },
    { x: 40, h: 24 },
    { x: 50, h: 34 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <G>
        {bars.map((b) => (
          <Rect
            key={b.x}
            x={b.x - 2}
            y={32 - b.h / 2}
            width={4}
            height={b.h}
            rx={2}
            fill={color}
          />
        ))}
      </G>
      <Path
        d="M6 54 L58 54"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.5}
      />
      <Circle cx={30} cy={54} r={3.5} fill={color} />
    </Svg>
  );
};
