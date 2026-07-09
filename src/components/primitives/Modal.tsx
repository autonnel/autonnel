import * as React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';

type ModalWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | '7xl';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: ModalWidth;
  showCloseButton?: boolean;
}

function closeWhenDialogDismisses(open: boolean, onClose: () => void) {
  if (!open) onClose();
}

function ModalTitleBlock({ title, description }: Pick<ModalProps, 'title' | 'description'>) {
  return (
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => closeWhenDialogDismisses(open, onClose)}>
      <DialogContent maxWidth={maxWidth} showCloseButton={showCloseButton}>
        <ModalTitleBlock title={title} description={description} />
        {children}
      </DialogContent>
    </Dialog>
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
