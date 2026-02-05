'use client'

interface Props {
  isAnimating: boolean
  className?: string
}

export default function MarketplaceIllustration({ isAnimating, className = '' }: Props) {
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
          .city-road {
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-linecap: round;
            stroke-dasharray: 400;
            stroke-dashoffset: ${isAnimating ? 0 : 400};
            transition: stroke-dashoffset 1.5s ease-out;
          }
          .city-road-major {
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-linecap: round;
            stroke-dasharray: 500;
            stroke-dashoffset: ${isAnimating ? 0 : 500};
            transition: stroke-dashoffset 1.8s ease-out;
          }
          .delivery-route {
            stroke: ${strokeColor};
            stroke-width: 2;
            stroke-linecap: round;
            stroke-dasharray: 8 4;
            stroke-dasharray: 300;
            stroke-dashoffset: ${isAnimating ? 0 : 300};
            transition: stroke-dashoffset 1.2s ease-out;
          }
          .vehicle {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-dasharray: 50;
            stroke-dashoffset: ${isAnimating ? 0 : 50};
            transition: stroke-dashoffset 0.6s ease-out;
          }
          .building {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 1;
            stroke-dasharray: 80;
            stroke-dashoffset: ${isAnimating ? 0 : 80};
            transition: stroke-dashoffset 0.8s ease-out;
          }
          .pin {
            fill: none;
            stroke: ${strokeColor};
            stroke-width: 1.5;
            stroke-dasharray: 40;
            stroke-dashoffset: ${isAnimating ? 0 : 40};
            transition: stroke-dashoffset 0.5s ease-out;
          }
        `}
      </style>

      {/* City grid - horizontal roads */}
      <path d="M10 40 L190 40" className="city-road" style={{ transitionDelay: '0.1s' }} />
      <path d="M10 80 L190 80" className="city-road-major" style={{ transitionDelay: '0.15s' }} />
      <path d="M10 120 L190 120" className="city-road-major" style={{ transitionDelay: '0.2s' }} />
      <path d="M10 160 L190 160" className="city-road" style={{ transitionDelay: '0.25s' }} />

      {/* City grid - vertical roads */}
      <path d="M40 10 L40 190" className="city-road" style={{ transitionDelay: '0.3s' }} />
      <path d="M80 10 L80 190" className="city-road-major" style={{ transitionDelay: '0.35s' }} />
      <path d="M120 10 L120 190" className="city-road-major" style={{ transitionDelay: '0.4s' }} />
      <path d="M160 10 L160 190" className="city-road" style={{ transitionDelay: '0.45s' }} />

      {/* Diagonal connector roads */}
      <path d="M40 40 L80 80" className="city-road" style={{ transitionDelay: '0.5s' }} />
      <path d="M120 80 L160 120" className="city-road" style={{ transitionDelay: '0.52s' }} />
      <path d="M80 120 L40 160" className="city-road" style={{ transitionDelay: '0.54s' }} />

      {/* Delivery route (highlighted path) */}
      <path d="M60 40 L60 80 L120 80 L120 140 L160 140" className="delivery-route" style={{ transitionDelay: '0.6s' }} />

      {/* Vehicle icons (small car shapes) */}
      {/* Vehicle 1 */}
      <g style={{ transitionDelay: '0.7s' }}>
        <rect x="55" y="55" width="10" height="6" rx="1" className="vehicle" />
        <circle cx="57" cy="61" r="1.5" className="vehicle" />
        <circle cx="63" cy="61" r="1.5" className="vehicle" />
      </g>

      {/* Vehicle 2 */}
      <g style={{ transitionDelay: '0.75s' }}>
        <rect x="115" y="95" width="10" height="6" rx="1" className="vehicle" />
        <circle cx="117" cy="101" r="1.5" className="vehicle" />
        <circle cx="123" cy="101" r="1.5" className="vehicle" />
      </g>

      {/* Vehicle 3 */}
      <g style={{ transitionDelay: '0.8s' }}>
        <rect x="145" y="135" width="10" height="6" rx="1" className="vehicle" />
        <circle cx="147" cy="141" r="1.5" className="vehicle" />
        <circle cx="153" cy="141" r="1.5" className="vehicle" />
      </g>

      {/* Vehicle 4 - on different route */}
      <g style={{ transitionDelay: '0.85s' }}>
        <rect x="35" y="115" width="10" height="6" rx="1" className="vehicle" />
        <circle cx="37" cy="121" r="1.5" className="vehicle" />
        <circle cx="43" cy="121" r="1.5" className="vehicle" />
      </g>

      {/* Vehicle 5 */}
      <g style={{ transitionDelay: '0.9s' }}>
        <rect x="155" y="75" width="10" height="6" rx="1" className="vehicle" />
        <circle cx="157" cy="81" r="1.5" className="vehicle" />
        <circle cx="163" cy="81" r="1.5" className="vehicle" />
      </g>

      {/* Building blocks */}
      <rect x="45" y="85" width="25" height="25" rx="2" className="building" style={{ transitionDelay: '0.95s' }} />
      <rect x="90" y="45" width="20" height="25" rx="2" className="building" style={{ transitionDelay: '1.0s' }} />
      <rect x="125" y="125" width="25" height="25" rx="2" className="building" style={{ transitionDelay: '1.05s' }} />
      <rect x="85" y="125" width="20" height="20" rx="2" className="building" style={{ transitionDelay: '1.1s' }} />

      {/* Location pins */}
      {/* Pickup pin */}
      <g style={{ transitionDelay: '1.15s' }}>
        <path d="M60 30 L60 38" className="pin" />
        <circle cx="60" cy="26" r="4" className="pin" />
        <circle cx="60" cy="26" r="1.5" className="pin" />
      </g>

      {/* Destination pin */}
      <g style={{ transitionDelay: '1.2s' }}>
        <path d="M160 152 L160 160" className="pin" />
        <circle cx="160" cy="148" r="4" className="pin" />
        <circle cx="160" cy="148" r="1.5" className="pin" />
      </g>

      {/* Additional pin */}
      <g style={{ transitionDelay: '1.25s' }}>
        <path d="M120 62 L120 70" className="pin" />
        <circle cx="120" cy="58" r="4" className="pin" />
      </g>

      {/* Network connection dots */}
      <circle cx="40" cy="40" r="3" className="building" style={{ transitionDelay: '1.3s' }} />
      <circle cx="80" cy="80" r="3" className="building" style={{ transitionDelay: '1.32s' }} />
      <circle cx="120" cy="80" r="3" className="building" style={{ transitionDelay: '1.34s' }} />
      <circle cx="120" cy="120" r="3" className="building" style={{ transitionDelay: '1.36s' }} />
      <circle cx="160" cy="120" r="3" className="building" style={{ transitionDelay: '1.38s' }} />
    </svg>
  )
}
