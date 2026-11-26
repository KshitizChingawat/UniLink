import { type ComponentProps } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function DownloadButton({ variant, size, className }: Pick<ComponentProps<typeof Button>, 'variant' | 'size' | 'className'>) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href="/install"><Download aria-hidden="true" />Downloads</Link>
    </Button>
  );
}
