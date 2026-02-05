'use client'

interface Props {
  isAnimating: boolean
  className?: string
}

export default function AerospaceIllustration({ isAnimating, className = '' }: Props) {
  const strokeColor = '#374151'

  return (
    <svg
      viewBox="0 0 280 100"
      className={`w-full h-auto ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style>
        {`
          .fuselage {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 800;
            stroke-dashoffset: ${isAnimating ? 0 : 800};
            transition: stroke-dashoffset 2s ease-out;
          }
          .wing {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 400;
            stroke-dashoffset: ${isAnimating ? 0 : 400};
            transition: stroke-dashoffset 1.5s ease-out;
          }
          .detail {
            stroke: ${strokeColor};
            stroke-width: 0.75;
            stroke-linecap: round;
            stroke-dasharray: 100;
            stroke-dashoffset: ${isAnimating ? 0 : 100};
            transition: stroke-dashoffset 0.8s ease-out;
          }
          .window {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 0.75;
            stroke-dasharray: 20;
            stroke-dashoffset: ${isAnimating ? 0 : 20};
            transition: stroke-dashoffset 0.3s ease-out;
          }
          .engine {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-dasharray: 150;
            stroke-dashoffset: ${isAnimating ? 0 : 150};
            transition: stroke-dashoffset 1s ease-out;
          }
          .landing-gear {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-dasharray: 80;
            stroke-dashoffset: ${isAnimating ? 0 : 80};
            transition: stroke-dashoffset 0.6s ease-out;
          }
        `}
      </style>

      {/* Main fuselage - Boeing 777 style profile */}
      <path
        d="M5 50 Q8 47 15 46 L25 45 Q30 44 35 44 L245 44 Q260 44 268 46 L275 50 Q268 54 260 55 L35 55 Q30 55 25 55 L15 54 Q8 53 5 50"
        className="fuselage"
        style={{ transitionDelay: '0.1s' }}
      />

      {/* Nose cone detail */}
      <path d="M5 50 L2 50" className="fuselage" style={{ transitionDelay: '0.15s' }} />
      <path d="M8 48 Q12 47 15 46" className="detail" style={{ transitionDelay: '0.2s' }} />

      {/* Cockpit windows */}
      <path d="M18 46 L24 45" className="detail" style={{ transitionDelay: '0.25s' }} />
      <path d="M19 48 L23 47" className="detail" style={{ transitionDelay: '0.28s' }} />
      <path d="M20 50 L22 49" className="detail" style={{ transitionDelay: '0.3s' }} />

      {/* Passenger windows - many in a row */}
      {[40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={46}
          width={4}
          height={3}
          rx={0.5}
          className="window"
          style={{ transitionDelay: `${0.35 + i * 0.03}s` }}
        />
      ))}

      {/* Door indicators */}
      <path d="M38 44 L38 55" className="detail" style={{ transitionDelay: '0.4s' }} />
      <path d="M115 44 L115 55" className="detail" style={{ transitionDelay: '0.45s' }} />
      <path d="M185 44 L185 55" className="detail" style={{ transitionDelay: '0.5s' }} />

      {/* Main wing - swept back */}
      <path
        d="M100 50 L65 25 L55 25 L50 27 L52 30 L90 50"
        className="wing"
        style={{ transitionDelay: '0.55s' }}
      />

      {/* Wing detail lines */}
      <path d="M70 35 L85 45" className="detail" style={{ transitionDelay: '0.6s' }} />
      <path d="M62 30 L75 40" className="detail" style={{ transitionDelay: '0.62s' }} />

      {/* Engine under wing */}
      <ellipse cx="72" cy="38" rx="12" ry="5" className="engine" style={{ transitionDelay: '0.65s' }} />
      <path d="M60 38 L62 38" className="engine" style={{ transitionDelay: '0.68s' }} />
      <ellipse cx="72" cy="38" rx="8" ry="3" className="detail" style={{ transitionDelay: '0.7s' }} />

      {/* Second engine (closer to fuselage) */}
      <ellipse cx="92" cy="45" rx="10" ry="4" className="engine" style={{ transitionDelay: '0.72s' }} />
      <ellipse cx="92" cy="45" rx="6" ry="2.5" className="detail" style={{ transitionDelay: '0.74s' }} />

      {/* Tail section - vertical stabilizer */}
      <path
        d="M245 44 L258 22 L263 22 L265 24 L260 30 L252 44"
        className="wing"
        style={{ transitionDelay: '0.8s' }}
      />

      {/* Tail detail */}
      <path d="M250 35 L256 28" className="detail" style={{ transitionDelay: '0.85s' }} />

      {/* Horizontal stabilizer */}
      <path
        d="M248 50 L265 42 L270 42 L268 50 L265 52 L248 50"
        className="wing"
        style={{ transitionDelay: '0.9s' }}
      />

      {/* APU exhaust */}
      <path d="M273 50 L278 50" className="detail" style={{ transitionDelay: '0.95s' }} />

      {/* Landing gear - nose */}
      <g style={{ transitionDelay: '1.0s' }}>
        <path d="M28 55 L28 68" className="landing-gear" />
        <circle cx="25" cy="70" r="3" className="landing-gear" />
        <circle cx="31" cy="70" r="3" className="landing-gear" />
      </g>

      {/* Landing gear - main (rear) */}
      <g style={{ transitionDelay: '1.05s' }}>
        <path d="M130 55 L130 72" className="landing-gear" />
        <circle cx="124" cy="74" r="3" className="landing-gear" />
        <circle cx="130" cy="74" r="3" className="landing-gear" />
        <circle cx="136" cy="74" r="3" className="landing-gear" />
      </g>

      {/* Landing gear - second main */}
      <g style={{ transitionDelay: '1.1s' }}>
        <path d="M145 55 L145 72" className="landing-gear" />
        <circle cx="139" cy="74" r="3" className="landing-gear" />
        <circle cx="145" cy="74" r="3" className="landing-gear" />
        <circle cx="151" cy="74" r="3" className="landing-gear" />
      </g>

      {/* Fuselage panel lines */}
      <path d="M35 44 L35 55" className="detail" style={{ transitionDelay: '1.15s' }} />
      <path d="M240 44 L240 55" className="detail" style={{ transitionDelay: '1.18s' }} />

      {/* Antenna */}
      <path d="M160 44 L160 40 L165 40" className="detail" style={{ transitionDelay: '1.2s' }} />
    </svg>
  )
}
