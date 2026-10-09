/** Calm springs: they settle without bouncing past the target more than a hair. */
export const SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 0.9 } as const;
export const SPRING_SOFT = { stiffness: 170, damping: 22, mass: 0.8 } as const;
