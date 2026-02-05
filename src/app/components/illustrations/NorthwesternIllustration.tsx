'use client'

interface Props {
  isAnimating: boolean
  className?: string
}

export default function NorthwesternIllustration({ isAnimating, className = '' }: Props) {
  const strokeColor = '#374151'

  return (
    <svg
      viewBox="0 0 200 200"
      className={`w-full h-auto ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style>
        {`
          .seal-outer {
            stroke: ${strokeColor};
            stroke-width: 2;
            stroke-linecap: round;
            stroke-dasharray: 700;
            stroke-dashoffset: ${isAnimating ? 0 : 700};
            transition: stroke-dashoffset 2s ease-out;
          }
          .seal-inner {
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-linecap: round;
            stroke-dasharray: 500;
            stroke-dashoffset: ${isAnimating ? 0 : 500};
            transition: stroke-dashoffset 1.5s ease-out;
          }
          .seal-detail {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-dasharray: 100;
            stroke-dashoffset: ${isAnimating ? 0 : 100};
            transition: stroke-dashoffset 0.8s ease-out;
          }
          .seal-ray {
            stroke: ${strokeColor};
            stroke-width: 0.75;
            stroke-linecap: round;
            stroke-dasharray: 50;
            stroke-dashoffset: ${isAnimating ? 0 : 50};
            transition: stroke-dashoffset 0.5s ease-out;
          }
          .seal-text {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 0.5;
            stroke-dasharray: 200;
            stroke-dashoffset: ${isAnimating ? 0 : 200};
            transition: stroke-dashoffset 1.2s ease-out;
          }
        `}
      </style>

      {/* Outer circle */}
      <circle cx="100" cy="100" r="90" className="seal-outer" style={{ transitionDelay: '0.1s' }} />

      {/* Second outer ring */}
      <circle cx="100" cy="100" r="82" className="seal-inner" style={{ transitionDelay: '0.2s' }} />

      {/* Inner circle for central motif */}
      <circle cx="100" cy="100" r="55" className="seal-inner" style={{ transitionDelay: '0.3s' }} />

      {/* Radiating sun rays from center */}
      {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((angle, i) => {
        const innerRadius = 25
        const outerRadius = 50
        const rad = (angle * Math.PI) / 180
        const x1 = 100 + innerRadius * Math.cos(rad)
        const y1 = 100 + innerRadius * Math.sin(rad)
        const x2 = 100 + outerRadius * Math.cos(rad)
        const y2 = 100 + outerRadius * Math.sin(rad)
        return (
          <path
            key={angle}
            d={`M${x1} ${y1} L${x2} ${y2}`}
            className="seal-ray"
            style={{ transitionDelay: `${0.4 + i * 0.02}s` }}
          />
        )
      })}

      {/* Central book/open pages motif */}
      <path
        d="M85 95 Q100 85 115 95 L115 115 Q100 105 85 115 Z"
        className="seal-detail"
        style={{ transitionDelay: '0.9s' }}
      />

      {/* Book spine */}
      <path d="M100 88 L100 112" className="seal-detail" style={{ transitionDelay: '0.95s' }} />

      {/* Text lines on book (representing text) */}
      <path d="M88 98 L97 96" className="seal-ray" style={{ transitionDelay: '1.0s' }} />
      <path d="M88 102 L97 100" className="seal-ray" style={{ transitionDelay: '1.02s' }} />
      <path d="M88 106 L97 104" className="seal-ray" style={{ transitionDelay: '1.04s' }} />
      <path d="M103 96 L112 98" className="seal-ray" style={{ transitionDelay: '1.06s' }} />
      <path d="M103 100 L112 102" className="seal-ray" style={{ transitionDelay: '1.08s' }} />
      <path d="M103 104 L112 106" className="seal-ray" style={{ transitionDelay: '1.1s' }} />

      {/* "NORTHWESTERN UNIVERSITY" text path (simplified as arc segments) */}
      {/* Top arc - NORTHWESTERN */}
      <path
        d="M30 100 A70 70 0 0 1 170 100"
        className="seal-text"
        style={{ transitionDelay: '1.15s' }}
        strokeDasharray="3 5"
      />

      {/* Bottom arc - UNIVERSITY */}
      <path
        d="M170 100 A70 70 0 0 1 30 100"
        className="seal-text"
        style={{ transitionDelay: '1.2s' }}
        strokeDasharray="3 5"
      />

      {/* Decorative dots between text sections */}
      <circle cx="30" cy="100" r="2" className="seal-detail" style={{ transitionDelay: '1.25s' }} />
      <circle cx="170" cy="100" r="2" className="seal-detail" style={{ transitionDelay: '1.28s' }} />

      {/* Year "1851" at bottom */}
      <g style={{ transitionDelay: '1.3s' }}>
        {/* 1 */}
        <path d="M75 155 L75 165" className="seal-detail" />
        {/* 8 */}
        <circle cx="85" cy="158" r="3" className="seal-detail" />
        <circle cx="85" cy="163" r="3" className="seal-detail" />
        {/* 5 */}
        <path d="M98 155 L92 155 L92 160 L97 160 L97 165 L92 165" className="seal-detail" />
        {/* 1 */}
        <path d="M105 155 L105 165" className="seal-detail" />
      </g>

      {/* Small decorative elements around inner circle */}
      <circle cx="100" cy="45" r="2" className="seal-detail" style={{ transitionDelay: '1.35s' }} />
      <circle cx="100" cy="155" r="2" className="seal-detail" style={{ transitionDelay: '1.38s' }} />
      <circle cx="45" cy="100" r="2" className="seal-detail" style={{ transitionDelay: '1.4s' }} />
      <circle cx="155" cy="100" r="2" className="seal-detail" style={{ transitionDelay: '1.42s' }} />
    </svg>
  )
}
