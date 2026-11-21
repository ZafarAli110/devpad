import { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, duration = 800, className }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const startValue = useRef(0);
  const targetValue = useRef(value);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startValue.current = displayValue;
    targetValue.current = value;
    startTime.current = null;
    
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      
      // Ease out quartic function for smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 4);
      
      const currentDiff = targetValue.current - startValue.current;
      const nextValue = Math.floor(startValue.current + currentDiff * ease);
      
      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue.current); // Ensure exact final value
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
}
