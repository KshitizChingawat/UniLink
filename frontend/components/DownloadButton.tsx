import { type ComponentProps } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAppInstall } from '@/lib/app-install';

export default function DownloadButton({ variant, size, className }: Pick<ComponentProps<typeof Button>, 'variant' | 'size' | 'className'>) {
  const { standalone } = useAppInstall();
  if (standalone) return null;
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href="/install"><Download aria-hidden="true" />Download UniLink</Link>
    </Button>
  );
}
