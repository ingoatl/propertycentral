import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface ResponsiveModalContentProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveModalTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveModalDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

const ResponsiveModalContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

export function ResponsiveModal({ open, onOpenChange, children }: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveModalContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </ResponsiveModalContext.Provider>
  );
}

export function ResponsiveModalContent({ children, className }: ResponsiveModalContentProps) {
  const { isMobile } = React.useContext(ResponsiveModalContext);

  if (isMobile) {
    return (
      <DrawerContent className={cn("max-h-[95vh] flex flex-col overflow-hidden", className)}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={cn("max-h-[90vh] flex flex-col overflow-hidden", className)}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader({ children, className }: ResponsiveModalHeaderProps) {
  const { isMobile } = React.useContext(ResponsiveModalContext);

  if (isMobile) {
    return (
      <DrawerHeader className={cn("text-left px-4 pt-4 pb-2", className)}>
        {children}
      </DrawerHeader>
    );
  }

  return (
    <DialogHeader className={cn(className)}>
      {children}
    </DialogHeader>
  );
}

export function ResponsiveModalTitle({ children, className }: ResponsiveModalTitleProps) {
  const { isMobile } = React.useContext(ResponsiveModalContext);

  if (isMobile) {
    return (
      <DrawerTitle className={cn("text-xl", className)}>
        {children}
      </DrawerTitle>
    );
  }

  return (
    <DialogTitle className={cn(className)}>
      {children}
    </DialogTitle>
  );
}

export function ResponsiveModalDescription({ children, className }: ResponsiveModalDescriptionProps) {
  const { isMobile } = React.useContext(ResponsiveModalContext);

  if (isMobile) {
    return (
      <DrawerDescription className={cn(className)}>
        {children}
      </DrawerDescription>
    );
  }

  return (
    <DialogDescription className={cn(className)}>
      {children}
    </DialogDescription>
  );
}

export function useResponsiveModalContext() {
  return React.useContext(ResponsiveModalContext);
}
