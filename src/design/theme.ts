import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { tokens } from './tokens';

type ThemeType = 'light' | 'dark';

interface ThemeContextProps {
  theme: ThemeType;
  isDark: boolean;
  colors: typeof tokens.light | typeof tokens.dark;
  space: typeof tokens.space;
  radius: typeof tokens.radius;
  duration: typeof tokens.duration;
  easing: typeof tokens.easing;
  shadow: typeof tokens.shadow.light | typeof tokens.shadow.dark;
  zIndex: typeof tokens.zIndex;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const colorScheme = useColorScheme();
  const theme: ThemeType = colorScheme === 'dark' ? 'dark' : 'light';
  const isDark = theme === 'dark';

  const value: ThemeContextProps = {
    theme,
    isDark,
    colors: isDark ? tokens.dark : tokens.light,
    space: tokens.space,
    radius: tokens.radius,
    duration: tokens.duration,
    easing: tokens.easing,
    shadow: isDark ? tokens.shadow.dark : tokens.shadow.light,
    zIndex: tokens.zIndex,
  };

  return React.createElement(ThemeContext.Provider, { value }, children);
};

export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
