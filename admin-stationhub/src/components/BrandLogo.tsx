import { cn } from '@/src/lib/utils';

type Props = {
  size?: number;
  className?: string;
};

export function BrandLogo({ size = 40, className }: Props) {
  return (
    <img
      src="/favicon.ico"
      width={size}
      height={size}
      alt=""
      className={cn('rounded-lg object-contain shrink-0', className)}
    />
  );
}
