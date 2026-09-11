import React from 'react';
import { Text as RNText, TextStyle, TextProps as RNTextProps } from 'react-native';
import { useTheme } from './theme';

export interface BaseTextProps extends RNTextProps {
  children: React.ReactNode;
  tabularNums?: boolean;
  color?: string; // Custom color override, e.g. use colors.text.secondary
}

// 1. Title Component
export interface TitleProps extends BaseTextProps {
  level: 'display' | 'h1' | 'h2' | 'h3';
}

export const Title: React.FC<TitleProps> = ({
  level,
  children,
  tabularNums = false,
  color,
  style,
  ...rest
}) => {
  const { colors } = useTheme();

  let fontSize = 18;
  let lineHeight = 24;
  let fontWeight: TextStyle['fontWeight'] = '600';

  if (level === 'display') {
    // display — 온보딩 슬라이드 헤드라인 / 마케팅 히어로 (§2.2)
    fontSize = 32;
    lineHeight = 40;
    fontWeight = '700';
  } else if (level === 'h1') {
    // title-1
    fontSize = 24;
    lineHeight = 32;
    fontWeight = '700';
  } else if (level === 'h2') {
    // title-2
    fontSize = 20;
    lineHeight = 28;
    fontWeight = '600';
  } else if (level === 'h3') {
    // title-3
    fontSize = 18;
    lineHeight = 24;
    fontWeight = '600';
  }

  const letterSpacing = fontSize * -0.02;

  const textStyle: TextStyle = {
    fontFamily: 'PretendardVariable',
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    color: color || colors.text.primary,
  };

  const fontVariants: TextStyle['fontVariant'] = [];
  if (tabularNums) {
    fontVariants.push('tabular-nums');
  }

  return React.createElement(
    RNText,
    {
      style: [{ fontVariant: fontVariants }, textStyle, style],
      allowFontScaling: true,
      ...rest,
    },
    children,
  );
};

// 2. Body Component
export interface BodyProps extends BaseTextProps {
  variant?: 'primary' | 'bold' | 'sm' | 'sm-bold';
}

export const Body: React.FC<BodyProps> = ({
  variant = 'primary',
  children,
  tabularNums = false,
  color,
  style,
  ...rest
}) => {
  const { colors } = useTheme();

  let fontSize = 16;
  let lineHeight = 24;
  let fontWeight: TextStyle['fontWeight'] = '400';

  if (variant === 'primary') {
    fontSize = 16;
    lineHeight = 24;
    fontWeight = '400';
  } else if (variant === 'bold') {
    fontSize = 16;
    lineHeight = 24;
    fontWeight = '600';
  } else if (variant === 'sm') {
    fontSize = 14;
    lineHeight = 20;
    fontWeight = '400';
  } else if (variant === 'sm-bold') {
    fontSize = 14;
    lineHeight = 20;
    fontWeight = '600';
  }

  const letterSpacing = 0;

  const textStyle: TextStyle = {
    fontFamily: 'PretendardVariable',
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    color: color || colors.text.primary,
  };

  const fontVariants: TextStyle['fontVariant'] = [];
  if (tabularNums) {
    fontVariants.push('tabular-nums');
  }

  return React.createElement(
    RNText,
    {
      style: [{ fontVariant: fontVariants }, textStyle, style],
      allowFontScaling: true,
      ...rest,
    },
    children,
  );
};

// 3. Caption Component
export interface CaptionProps extends BaseTextProps {
  variant?: 'default' | 'micro' | 'button';
}

export const Caption: React.FC<CaptionProps> = ({
  variant = 'default',
  children,
  tabularNums = false,
  color,
  style,
  ...rest
}) => {
  const { colors } = useTheme();

  let fontSize = 13;
  let lineHeight = 18;
  let fontWeight: TextStyle['fontWeight'] = '500';

  if (variant === 'default') {
    fontSize = 13;
    lineHeight = 18;
    fontWeight = '500';
  } else if (variant === 'micro') {
    fontSize = 11;
    lineHeight = 16;
    fontWeight = '500';
  } else if (variant === 'button') {
    fontSize = 16;
    lineHeight = 20;
    fontWeight = '600';
  }

  const letterSpacing = fontSize * 0.01;

  const textStyle: TextStyle = {
    fontFamily: 'PretendardVariable',
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    color: color || (variant === 'button' ? colors.text.primary : colors.text.tertiary),
  };

  const fontVariants: TextStyle['fontVariant'] = [];
  if (tabularNums) {
    fontVariants.push('tabular-nums');
  }

  return React.createElement(
    RNText,
    {
      style: [{ fontVariant: fontVariants }, textStyle, style],
      allowFontScaling: true,
      ...rest,
    },
    children,
  );
};
