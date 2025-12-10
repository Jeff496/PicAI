// src/components/faces/FaceOverlay.tsx
// SVG overlay for face bounding boxes on photos

import { useState } from 'react';
import type { Face } from '@/types/api';

interface FaceOverlayProps {
  faces: Face[];
  containerWidth: number;
  containerHeight: number;
  onFaceClick: (face: Face) => void;
  showLabels?: boolean;
}

export function FaceOverlay({
  faces,
  containerWidth,
  containerHeight,
  onFaceClick,
  showLabels = true,
}: FaceOverlayProps) {
  const [hoveredFaceId, setHoveredFaceId] = useState<string | null>(null);

  if (faces.length === 0 || containerWidth === 0 || containerHeight === 0) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={containerWidth}
      height={containerHeight}
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
    >
      {faces.map((face) => {
        // Convert percentage-based bounding box to pixel coordinates
        const x = face.boundingBox.left * containerWidth;
        const y = face.boundingBox.top * containerHeight;
        const width = face.boundingBox.width * containerWidth;
        const height = face.boundingBox.height * containerHeight;

        const isHovered = hoveredFaceId === face.id;
        const isTagged = !!face.person;
        const hasSuggestion = !isTagged && !!face.match;

        // Color coding:
        // - Green (#22c55e): Tagged/confirmed face
        // - Orange (#f97316): Has suggestion (80-90% match)
        // - Blue (#3b82f6): No match found, needs manual tagging
        const color = isTagged ? '#22c55e' : hasSuggestion ? '#f97316' : '#3b82f6';

        // Build label text
        let labelText = 'Click to tag';
        if (isTagged && face.person?.name) {
          labelText = face.person.name;
        } else if (hasSuggestion && face.match) {
          labelText = `${face.match.personName || 'Unknown'}? (${Math.round(face.match.similarity)}%)`;
        }

        return (
          <g key={face.id}>
            {/* Face bounding box */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="transparent"
              stroke={color}
              strokeWidth={isHovered ? 3 : 2}
              strokeDasharray={isTagged ? 'none' : hasSuggestion ? '6 3' : '4 2'}
              opacity={isHovered ? 1 : 0.7}
              rx={4}
              className="pointer-events-auto cursor-pointer transition-all"
              onMouseEnter={() => setHoveredFaceId(face.id)}
              onMouseLeave={() => setHoveredFaceId(null)}
              onClick={(e) => {
                e.stopPropagation();
                onFaceClick(face);
              }}
            />

            {/* Label background and text */}
            {showLabels && (
              <g>
                {/* Background for label */}
                <rect
                  x={x}
                  y={y + height + 4}
                  width={Math.max(width, hasSuggestion ? 100 : 60)}
                  height={20}
                  fill={color}
                  opacity={0.9}
                  rx={4}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHoveredFaceId(face.id)}
                  onMouseLeave={() => setHoveredFaceId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFaceClick(face);
                  }}
                />

                {/* Label text */}
                <text
                  x={x + 6}
                  y={y + height + 17}
                  fill="white"
                  fontSize={11}
                  fontWeight={500}
                  className="pointer-events-none select-none"
                >
                  {labelText}
                </text>
              </g>
            )}

            {/* Hover highlight effect */}
            {isHovered && (
              <rect
                x={x - 2}
                y={y - 2}
                width={width + 4}
                height={height + 4}
                fill="transparent"
                stroke={color}
                strokeWidth={1}
                opacity={0.3}
                rx={6}
                className="pointer-events-none"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
