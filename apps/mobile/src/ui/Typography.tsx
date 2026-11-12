import { createContext, useContext, type PropsWithChildren } from 'react';

export type TextSize = 'standard' | 'large';
const TextSizeContext = createContext<TextSize>('standard');

export function TextSizeProvider({ value, children }: PropsWithChildren<{ value: TextSize }>) {
  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>;
}

export function useTextScale() {
  return useContext(TextSizeContext) === 'large' ? 1.25 : 1;
}
