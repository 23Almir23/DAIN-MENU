import { ChefHat, Mail } from "lucide-react";

export default function InviteOnly() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-3">
            Early access
          </p>
          <h1 className="text-2xl font-serif">Dain Menu is currently invite-only.</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            We&apos;re onboarding pilot restaurants one by one to make sure every
            setup is smooth. Contact us to get early access.
          </p>
        </div>
        <a
          href="mailto:hello@dainmenu.com"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <Mail className="h-4 w-4" />
          hello@dainmenu.com
        </a>
      </div>
    </div>
  );
}
