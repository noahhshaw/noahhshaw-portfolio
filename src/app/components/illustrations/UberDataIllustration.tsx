'use client'

interface Props {
  isAnimating: boolean
  className?: string
}

export default function UberDataIllustration({ isAnimating, className = '' }: Props) {
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
          .street {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-dasharray: 300;
            stroke-dashoffset: ${isAnimating ? 0 : 300};
            transition: stroke-dashoffset 1.2s ease-out;
          }
          .street-main {
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-linecap: round;
            stroke-dasharray: 400;
            stroke-dashoffset: ${isAnimating ? 0 : 400};
            transition: stroke-dashoffset 1.5s ease-out;
          }
          .car {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-dasharray: 60;
            stroke-dashoffset: ${isAnimating ? 0 : 60};
            transition: stroke-dashoffset 0.6s ease-out;
          }
          .route {
            stroke: ${strokeColor};
            stroke-width: 2;
            stroke-linecap: round;
            stroke-dasharray: 6 3;
            stroke-dasharray: 200;
            stroke-dashoffset: ${isAnimating ? 0 : 200};
            transition: stroke-dashoffset 1s ease-out;
          }
          .pin {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-dasharray: 50;
            stroke-dashoffset: ${isAnimating ? 0 : 50};
            transition: stroke-dashoffset 0.5s ease-out;
          }
          .data-node {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-dasharray: 30;
            stroke-dashoffset: ${isAnimating ? 0 : 30};
            transition: stroke-dashoffset 0.4s ease-out;
          }
        `}
      </style>

      {/* Street grid - more organic like London streets */}
      {/* Horizontal main roads */}
      <path d="M10 50 L190 50" className="street-main" style={{ transitionDelay: '0.1s' }} />
      <path d="M10 100 L190 100" className="street-main" style={{ transitionDelay: '0.15s' }} />
      <path d="M10 150 L190 150" className="street-main" style={{ transitionDelay: '0.2s' }} />

      {/* Vertical main roads */}
      <path d="M50 10 L50 190" className="street-main" style={{ transitionDelay: '0.25s' }} />
      <path d="M100 10 L100 190" className="street-main" style={{ transitionDelay: '0.3s' }} />
      <path d="M150 10 L150 190" className="street-main" style={{ transitionDelay: '0.35s' }} />

      {/* Secondary streets */}
      <path d="M30 30 L70 30" className="street" style={{ transitionDelay: '0.4s' }} />
      <path d="M130 30 L170 30" className="street" style={{ transitionDelay: '0.42s' }} />
      <path d="M30 75 L70 75" className="street" style={{ transitionDelay: '0.44s' }} />
      <path d="M130 75 L170 75" className="street" style={{ transitionDelay: '0.46s' }} />
      <path d="M30 125 L70 125" className="street" style={{ transitionDelay: '0.48s' }} />
      <path d="M130 125 L170 125" className="street" style={{ transitionDelay: '0.5s' }} />
      <path d="M30 175 L70 175" className="street" style={{ transitionDelay: '0.52s' }} />
      <path d="M130 175 L170 175" className="street" style={{ transitionDelay: '0.54s' }} />

      {/* Diagonal/curved streets for organic feel */}
      <path d="M50 50 Q75 65 100 50" className="street" style={{ transitionDelay: '0.56s' }} />
      <path d="M100 100 Q125 85 150 100" className="street" style={{ transitionDelay: '0.58s' }} />
      <path d="M50 150 Q75 135 100 150" className="street" style={{ transitionDelay: '0.6s' }} />

      {/* Active route (highlighted path) */}
      <path d="M60 45 Q80 60 100 50 L100 100 Q120 115 150 100" className="route" style={{ transitionDelay: '0.65s' }} />

      {/* Car icons distributed on streets */}
      {/* Car 1 - top left */}
      <g style={{ transitionDelay: '0.7s' }}>
        <rect x="35" y="45" width="12" height="7" rx="2" className="car" />
        <circle cx="38" cy="52" r="2" className="car" />
        <circle cx="44" cy="52" r="2" className="car" />
      </g>

      {/* Car 2 - center */}
      <g style={{ transitionDelay: '0.75s' }}>
        <rect x="94" y="70" width="12" height="7" rx="2" className="car" />
        <circle cx="97" cy="77" r="2" className="car" />
        <circle cx="103" cy="77" r="2" className="car" />
      </g>

      {/* Car 3 - right side */}
      <g style={{ transitionDelay: '0.8s' }}>
        <rect x="144" y="95" width="12" height="7" rx="2" className="car" />
        <circle cx="147" cy="102" r="2" className="car" />
        <circle cx="153" cy="102" r="2" className="car" />
      </g>

      {/* Car 4 - bottom */}
      <g style={{ transitionDelay: '0.85s' }}>
        <rect x="55" y="145" width="12" height="7" rx="2" className="car" />
        <circle cx="58" cy="152" r="2" className="car" />
        <circle cx="64" cy="152" r="2" className="car" />
      </g>

      {/* Car 5 */}
      <g style={{ transitionDelay: '0.88s' }}>
        <rect x="125" y="145" width="12" height="7" rx="2" className="car" />
        <circle cx="128" cy="152" r="2" className="car" />
        <circle cx="134" cy="152" r="2" className="car" />
      </g>

      {/* Car 6 - top right */}
      <g style={{ transitionDelay: '0.9s' }}>
        <rect x="155" y="25" width="12" height="7" rx="2" className="car" />
        <circle cx="158" cy="32" r="2" className="car" />
        <circle cx="164" cy="32" r="2" className="car" />
      </g>

      {/* Car 7 */}
      <g style={{ transitionDelay: '0.92s' }}>
        <rect x="25" y="95" width="12" height="7" rx="2" className="car" />
        <circle cx="28" cy="102" r="2" className="car" />
        <circle cx="34" cy="102" r="2" className="car" />
      </g>

      {/* Pickup pin */}
      <g style={{ transitionDelay: '0.95s' }}>
        <circle cx="60" cy="38" r="5" className="pin" />
        <circle cx="60" cy="38" r="2" className="pin" />
        <path d="M60 43 L60 50" className="pin" />
      </g>

      {/* Destination pin */}
      <g style={{ transitionDelay: '1.0s' }}>
        <circle cx="150" cy="93" r="5" className="pin" />
        <rect x="147" y="91" width="6" height="4" className="pin" />
        <path d="M150 98 L150 105" className="pin" />
      </g>

      {/* Data nodes (representing data science aspect) */}
      <circle cx="50" cy="50" r="3" className="data-node" style={{ transitionDelay: '1.05s' }} />
      <circle cx="100" cy="50" r="3" className="data-node" style={{ transitionDelay: '1.08s' }} />
      <circle cx="150" cy="50" r="3" className="data-node" style={{ transitionDelay: '1.1s' }} />
      <circle cx="50" cy="100" r="3" className="data-node" style={{ transitionDelay: '1.12s' }} />
      <circle cx="100" cy="100" r="3" className="data-node" style={{ transitionDelay: '1.14s' }} />
      <circle cx="150" cy="100" r="3" className="data-node" style={{ transitionDelay: '1.16s' }} />
      <circle cx="50" cy="150" r="3" className="data-node" style={{ transitionDelay: '1.18s' }} />
      <circle cx="100" cy="150" r="3" className="data-node" style={{ transitionDelay: '1.2s' }} />
      <circle cx="150" cy="150" r="3" className="data-node" style={{ transitionDelay: '1.22s' }} />

      {/* Connection lines between data nodes */}
      <path d="M53 50 L97 50" className="data-node" style={{ transitionDelay: '1.25s' }} />
      <path d="M103 50 L147 50" className="data-node" style={{ transitionDelay: '1.27s' }} />
      <path d="M50 53 L50 97" className="data-node" style={{ transitionDelay: '1.29s' }} />
      <path d="M100 53 L100 97" className="data-node" style={{ transitionDelay: '1.31s' }} />
      <path d="M150 53 L150 97" className="data-node" style={{ transitionDelay: '1.33s' }} />
    </svg>
  )
}
