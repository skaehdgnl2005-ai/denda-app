import React from 'react';
import {
  House,
  UsersRound,
  Map,
  UserRound,
  Clock,
  CalendarDays,
  MapPin,
  Search,
  SlidersHorizontal,
  MoreVertical,
  Flag,
  Ban,
  Bell,
  BellOff,
  Share2,
  UserPlus,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CreditCard,
  ArrowLeftRight,
  Moon,
  BadgeCheck,
  CircleCheck,
  CircleAlert,
  Info,
  Plus,
  Trash2,
  LucideProps,
} from 'lucide-react-native';
import { useTheme } from '@/design/theme';

export const iconMap = {
  홈: House,
  친구: UsersRound,
  지도: Map,
  프로필: UserRound,
  시간: Clock,
  캘린더: CalendarDays,
  장소: MapPin,
  검색: Search,
  필터: SlidersHorizontal,
  더보기: MoreVertical,
  신고: Flag,
  차단: Ban,
  '알림 켜짐': Bell,
  '알림 꺼짐': BellOff,
  '카톡 공유': Share2,
  추가: UserPlus,
  확정: Check,
  닫기: X,
  뒤로: ChevronLeft,
  화살표: ChevronRight,
  '우측 화살표': ArrowRight,
  결제: CreditCard,
  환불: ArrowLeftRight,
  '다크/라이트': Moon,
  제휴: BadgeCheck,
  성공: CircleCheck,
  경고: CircleAlert,
  안내: Info,
  더하기: Plus,
  삭제: Trash2,
} as const;

export type IconName = keyof typeof iconMap;

export interface IconProps {
  name: IconName;
  color?: string;
  size?: number;
  /** 선택된 탭 등 '채움' 2차 신호용(§12.6 색 단독 의존 금지). 기본 미지정 = 아웃라인. */
  fill?: string;
  testID?: string;
}

export const Icon: React.FC<IconProps> = ({ name, color, size = 24, fill, testID }) => {
  const { colors } = useTheme();

  const IconComponent = iconMap[name];
  if (!IconComponent) {
    return null;
  }

  const iconColor = color || colors.text.primary;

  return React.createElement(IconComponent, {
    color: iconColor,
    size,
    strokeWidth: 2,
    fill,
    testID,
  } as LucideProps);
};
