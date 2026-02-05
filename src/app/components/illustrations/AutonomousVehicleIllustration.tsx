'use client'

interface Props {
  isAnimating: boolean
  className?: string
}

export default function AutonomousVehicleIllustration({ isAnimating, className = '' }: Props) {
  const strokeColor = '#374151'

  return (
    <svg
      viewBox="0 0 200 140"
      className={`w-full h-auto ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <style>
        {`
          .body {
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 600;
            stroke-dashoffset: ${isAnimating ? 0 : 600};
            transition: stroke-dashoffset 1.8s ease-out;
          }
          .detail {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 100;
            stroke-dashoffset: ${isAnimating ? 0 : 100};
            transition: stroke-dashoffset 0.8s ease-out;
          }
          .wheel {
            stroke: ${strokeColor};
            stroke-width: 1.5;
            fill: none;
            stroke-dasharray: 120;
            stroke-dashoffset: ${isAnimating ? 0 : 120};
            transition: stroke-dashoffset 0.9s ease-out;
          }
          .sensor {
            stroke: ${strokeColor};
            stroke-width: 0.75;
            stroke-linecap: round;
            opacity: 0.6;
            stroke-dasharray: 100;
            stroke-dashoffset: ${isAnimating ? 0 : 100};
            transition: stroke-dashoffset 0.6s ease-out;
          }
          .ghost-element {
            stroke: ${strokeColor};
            stroke-width: 1;
            fill: none;
            stroke-dasharray: 80;
            stroke-dashoffset: ${isAnimating ? 0 : 80};
            transition: stroke-dashoffset 0.7s ease-out;
          }
        `}
      </style>

      {/* Modern sedan/SUV body - sleek Ghost style */}
      {/* Main body profile - premium SUV silhouette */}
      <path
        d="M20 95
           L25 95
           Q30 95 35 90
           L45 75
           Q50 70 60 68
           L140 68
           Q155 68 165 75
           L175 90
           Q178 95 180 95
           L180 100
           L20 100
           Z"
        className="body"
        style={{ transitionDelay: '0.1s' }}
      />

      {/* Roof line - sleek continuous curve */}
      <path
        d="M55 68
           Q60 55 75 50
           L125 50
           Q140 50 150 60
           L155 68"
        className="body"
        style={{ transitionDelay: '0.2s' }}
      />

      {/* Windshield */}
      <path
        d="M58 68 L70 52 Q75 50 80 50"
        className="detail"
        style={{ transitionDelay: '0.3s' }}
      />

      {/* Rear window */}
      <path
        d="M142 68 L135 55 Q130 50 125 50"
        className="detail"
        style={{ transitionDelay: '0.35s' }}
      />

      {/* Side windows */}
      <path d="M82 50 L82 66" className="detail" style={{ transitionDelay: '0.4s' }} />
      <path d="M105 50 L105 66" className="detail" style={{ transitionDelay: '0.42s' }} />
      <path d="M120 52 L120 66" className="detail" style={{ transitionDelay: '0.44s' }} />

      {/* Door lines */}
      <path d="M90 68 L90 95" className="detail" style={{ transitionDelay: '0.46s' }} />
      <path d="M130 68 L130 95" className="detail" style={{ transitionDelay: '0.48s' }} />

      {/* Door handles - minimal */}
      <path d="M95 82 L105 82" className="detail" style={{ transitionDelay: '0.5s' }} />
      <path d="M135 82 L145 82" className="detail" style={{ transitionDelay: '0.52s' }} />

      {/* Headlights - modern LED style */}
      <path d="M175 85 L178 83 L180 85 L178 87 Z" className="detail" style={{ transitionDelay: '0.55s' }} />

      {/* Taillights */}
      <path d="M22 85 L25 83 L28 85 L25 87 Z" className="detail" style={{ transitionDelay: '0.58s' }} />

      {/* Front wheel */}
      <circle cx="55" cy="100" r="15" className="wheel" style={{ transitionDelay: '0.6s' }} />
      <circle cx="55" cy="100" r="10" className="wheel" style={{ transitionDelay: '0.62s' }} />
      <circle cx="55" cy="100" r="4" className="wheel" style={{ transitionDelay: '0.64s' }} />

      {/* Rear wheel */}
      <circle cx="145" cy="100" r="15" className="wheel" style={{ transitionDelay: '0.66s' }} />
      <circle cx="145" cy="100" r="10" className="wheel" style={{ transitionDelay: '0.68s' }} />
      <circle cx="145" cy="100" r="4" className="wheel" style={{ transitionDelay: '0.7s' }} />

      {/* Roof sensor array - subtle, integrated */}
      <ellipse cx="100" cy="48" rx="20" ry="5" className="ghost-element" style={{ transitionDelay: '0.75s' }} />
      <ellipse cx="100" cy="48" rx="12" ry="3" className="ghost-element" style={{ transitionDelay: '0.78s' }} />

      {/* Sensor beams - subtle, premium feel */}
      <path d="M100 43 L80 20" className="sensor" style={{ transitionDelay: '0.8s' }} />
      <path d="M100 43 L100 15" className="sensor" style={{ transitionDelay: '0.82s' }} />
      <path d="M100 43 L120 20" className="sensor" style={{ transitionDelay: '0.84s' }} />

      {/* Side sensor indicators */}
      <circle cx="180" cy="80" r="2" className="ghost-element" style={{ transitionDelay: '0.86s' }} />
      <circle cx="20" cy="80" r="2" className="ghost-element" style={{ transitionDelay: '0.88s' }} />

      {/* Ground line */}
      <path d="M10 115 L190 115" className="detail" style={{ transitionDelay: '0.9s' }} />

      {/* Ghost "G" inspired element - subtle brand reference */}
      {/* Stylized G shape near front */}
      <path
        d="M170 75 Q175 72 178 75 Q180 78 177 80 L173 80"
        className="ghost-element"
        style={{ transitionDelay: '0.95s' }}
      />

      {/* Detection field visualization - subtle arcs */}
      <path
        d="M60 25 Q100 10 140 25"
        className="sensor"
        style={{ transitionDelay: '1.0s' }}
      />
      <path
        d="M50 35 Q100 18 150 35"
        className="sensor"
        style={{ transitionDelay: '1.05s' }}
      />

      {/* Side detection arcs */}
      <path
        d="M15 70 Q5 85 15 100"
        className="sensor"
        style={{ transitionDelay: '1.1s' }}
      />
      <path
        d="M185 70 Q195 85 185 100"
        className="sensor"
        style={{ transitionDelay: '1.12s' }}
      />
    </svg>
  )
}
