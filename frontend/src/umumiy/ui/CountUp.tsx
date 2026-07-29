import { useEffect, useState } from 'react';

export function CountUp({ value, duration = 600, formatter }: { value: number, duration?: number, formatter: (v: number) => string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const endValue = value;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // ease-out cubic
      const easeOut = 1 - Math.pow(1 - percentage, 3);
      setCount(endValue * easeOut);
      
      if (percentage < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{formatter(count)}</span>;
}
